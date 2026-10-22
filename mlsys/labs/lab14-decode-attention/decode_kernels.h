// decode_kernels.h - lab 14's decode-attention kernels (chapter 15).
//
// One new query row per (sequence b, head h) against T_ctx cached keys and values.
// Cache layout (the engine contract): [B][H][T_max][D] FP32, element (b, h, p, d) at
// ((b*H + h)*T_max + p)*D + d. q of (b, h) at qkv + b*qkv_stride + h*D (qkv_stride = 3C
// for the engine's fused QKV row). Output att[b*C + h*D + d], C = H*D. Scale 1/sqrt(D).
//
//   decode_v1_twopass      grid B*H     one block per (b, h); max pass, then exp pass: K read twice
//   decode_v2_online       grid B*H     one pass, running (m, l, o4) per half-warp (chapter 14's merge)
//   decode_v3_split        grid (B*H, S) split-K: each block a chunk of keys, one partial (m, l, O~)
//   decode_combine         grid B*H     merges the S partials of each (b, h)
//   decode_v3b_lastblock   grid (B*H, S) v3 + the merge done by the last block to finish (atomics + fences)
//   decode_v4_half         grid (B*H, S) FP16 cache, 8 lanes per key (16-byte loads of 8 halves), FP32 math
//   decode_v5_gqa          grid (B*H_kv, S) one K/V read serves the G query heads of a group
//   decode_v6_cluster      grid (8, B*H), clusters of 8: partials in distributed shared memory (sm_90+, optional)
//
// Every kernel: 128 threads = 4 warps. FP32 layout: a key row is D = 64 floats = 256 bytes, read by a
// half-warp as 16 float4s; half = lane / 16 picks the key, c = lane % 16 the 4 dimensions 4c..4c+3.
// The 8 half-warps of a block walk keys j = start + 2*warp + half, step 8 (section 5's listing), with
// UNROLL = 4 keys per half-warp issued before any is used.
#pragma once

#include <cmath>
#include <cstring>
#include <cuda_runtime.h>
#include <cuda_fp16.h>

constexpr int DEC_BLOCK   = 128;   // threads per block, every kernel
constexpr int DEC_UNROLL  = 4;     // keys per half-warp (quarter-warp for FP16) loaded before use
constexpr int DEC_S_MAX   = 64;    // the most splits the engine's scratch is sized for
constexpr unsigned DEC_FULL = 0xffffffffu;

// ---------------------------------------------------------------------------
// How many ways to split the keys of each (b, h). Verbatim from chapter 15, section 3.
// ---------------------------------------------------------------------------
// lab 14 / engine: how many ways to split the keys of each (b, h)
inline int choose_splits(int B, int H, int T_ctx) {
    int want = (192 + B * H - 1) / (B * H);          // ~4 blocks per SM on 48 SMs
    int max_s = (T_ctx + 255) / 256;                  // at least 256 keys per chunk
    return max(1, min(want, max_s));
}

// Keys per split: ceil(T / S), rounded up to a multiple of 32 (one unrolled block step).
__host__ __device__ inline int split_chunk(int T, int S) { return (((T + S - 1) / S) + 31) & ~31; }

// The 16 bytes at p, as a float4 (FP32 cache) or as raw bits (FP16 cache).
__device__ __forceinline__ float4 ld4(const float* p) { return *reinterpret_cast<const float4*>(p); }
__device__ __forceinline__ uint4 ld16(const __half* p)
{
#ifdef CUDASIM
    uint4 r; std::memcpy(&r, p, 16); return r;
#else
    return *reinterpret_cast<const uint4*>(p);
#endif
}
// 8 halves (one uint4) -> 8 floats.
__device__ __forceinline__ void halves_to_floats(const uint4& raw, float f[8])
{
    __half2 h[4];
#ifdef CUDASIM
    std::memcpy(h, &raw, 16);
#else
    const __half2* hp = reinterpret_cast<const __half2*>(&raw);
    h[0] = hp[0]; h[1] = hp[1]; h[2] = hp[2]; h[3] = hp[3];
#endif
    for (int i = 0; i < 4; ++i) { f[2 * i] = __low2float(h[i]); f[2 * i + 1] = __high2float(h[i]); }
}

// The half-warp's partial dot product, then its sum over the 16 lanes: four shuffle steps.
// Every lane of the warp must call it (the shuffles take the full mask).
__device__ __forceinline__ float dot_half_warp(float4 q4, float4 k4)
{
    float s = q4.x * k4.x + q4.y * k4.y + q4.z * k4.z + q4.w * k4.w;                // partial dot: 4 of 64 terms
    s += __shfl_xor_sync(DEC_FULL, s, 8); s += __shfl_xor_sync(DEC_FULL, s, 4);
    s += __shfl_xor_sync(DEC_FULL, s, 2); s += __shfl_xor_sync(DEC_FULL, s, 1);      // all 16 lanes hold the score
    return s;
}

// The online-softmax update for one key (chapter 14): running max m, sum l, unnormalized o4.
__device__ __forceinline__ void online_update(float s, float4 v4, float& m, float& l, float4& o4)
{
    float m_new = fmaxf(m, s), alpha = __expf(m - m_new), p = __expf(s - m_new);
    l = alpha * l + p;
    o4.x = alpha * o4.x + p * v4.x;  o4.y = alpha * o4.y + p * v4.y;
    o4.z = alpha * o4.z + p * v4.z;  o4.w = alpha * o4.w + p * v4.w;
    m = m_new;
}

// ---------------------------------------------------------------------------
// The body every FP32 one-pass kernel shares: one half-warp's (m, l, o4) over keys [start, end).
// Main loop: 32 keys per block step (8 half-warps x UNROLL 4); each half-warp issues its 8 float4
// loads (4 keys x K and V, 128 bytes per lane) before using any. Tail (< 32 keys): one key per
// half-warp per step, loads guarded, shuffles still done by the whole warp.
// ---------------------------------------------------------------------------
template <int D>
__device__ __forceinline__ void online_range(const float* __restrict__ kc, const float* __restrict__ vc,
                                             float4 q4, float scale, int start, int end,
                                             float& m, float& l, float4& o4)
{
    static_assert(D == 64, "the half-warp layout needs D = 64: 16 lanes x float4");
    const int lane = threadIdx.x & 31, w = threadIdx.x >> 5, half = lane >> 4, c = lane & 15;
    int base = start;
    for (; base + 32 <= end; base += 32) {
        float4 k4[DEC_UNROLL], v4[DEC_UNROLL];
#pragma unroll
        for (int u = 0; u < DEC_UNROLL; ++u) {
            const int j = base + 8 * u + 2 * w + half;                                    // 4 warps x 2 keys per warp-step
            k4[u] = ld4(kc + (size_t)j * D + 4 * c);                                       // 16 B per lane, 256 B per half-warp
            v4[u] = ld4(vc + (size_t)j * D + 4 * c);
        }
#pragma unroll
        for (int u = 0; u < DEC_UNROLL; ++u)
            online_update(dot_half_warp(q4, k4[u]) * scale, v4[u], m, l, o4);
    }
    for (int j0 = base + 2 * w; j0 < end; j0 += 8) {                                       // warp-uniform tail
        const int j = j0 + half;
        const bool ok = j < end;
        const float4 z = make_float4(0.f, 0.f, 0.f, 0.f);
        float4 k4 = ok ? ld4(kc + (size_t)j * D + 4 * c) : z;
        float4 v4 = ok ? ld4(vc + (size_t)j * D + 4 * c) : z;
        float s = dot_half_warp(q4, k4) * scale;
        if (ok) online_update(s, v4, m, l, o4);
    }
}

// ---------------------------------------------------------------------------
// End-of-block merge of NG groups (8 half-warps, or 16 quarter-warps for FP16), each holding a
// running (m, l) and VPL output values per lane, through shared memory, with the merge rule
// (M = max, weights exp(m_g - M)). Afterwards thread d < D holds M, L and O[d] (unnormalized).
// An empty block (no keys) gives M = -INF, L = 0, O = 0, which the combine weighs by exp(-INF) = 0.
// Ends with a barrier, so the shared arrays can be reused by the next call.
// ---------------------------------------------------------------------------
template <int D, int NG, int VPL>
__device__ __forceinline__ void block_merge(float m, float l, const float* o, float& M, float& L, float& O)
{
    __shared__ float sm_m[NG], sm_l[NG], sm_o[NG][D];
    const int lpg = D / VPL, g = threadIdx.x / lpg, c = threadIdx.x % lpg;
    if (c == 0) { sm_m[g] = m; sm_l[g] = l; }
    for (int i = 0; i < VPL; ++i) sm_o[g][VPL * c + i] = o[i];
    __syncthreads();
    M = -INFINITY; L = 0.f; O = 0.f;
    if (threadIdx.x < D) {
        for (int k = 0; k < NG; ++k) M = fmaxf(M, sm_m[k]);
        if (M != -INFINITY)
            for (int k = 0; k < NG; ++k) {
                float wgt = __expf(sm_m[k] - M);
                L += sm_l[k] * wgt;  O += sm_o[k][threadIdx.x] * wgt;
            }
    }
    __syncthreads();
}

// Write the block's result: DIRECT (one split) -> att = O / L; else the partial [m, l, O~[0..D)].
template <int D, bool DIRECT>
__device__ __forceinline__ void write_result(float M, float L, float O, float* out, size_t att_idx, size_t part_idx)
{
    const int d = threadIdx.x;
    if (d >= D) return;
    if (DIRECT) { out[att_idx + d] = O / L; return; }
    float* p = out + part_idx * (D + 2);
    if (d == 0) { p[0] = M; p[1] = L; }
    p[2 + d] = O;
}

// ---------------------------------------------------------------------------
// v1: one block per (b, h), two passes. Pass 1 computes every score and keeps the max; pass 2 reads
// K again for the scores and V for the weighted sum, with the block's common max M (no rescale).
// ---------------------------------------------------------------------------
template <int D>
__global__ void __launch_bounds__(DEC_BLOCK)
decode_v1_twopass(const float* __restrict__ qkv, int qkv_stride, const float* __restrict__ k_cache,
                  const float* __restrict__ v_cache, float* __restrict__ att, int H, int T_ctx, int T_max)
{
    __shared__ float sm_max[8], sm_l[8], sm_o[8][D];
    const int bh = blockIdx.x, b = bh / H, h = bh % H, tid = threadIdx.x;
    const int lane = tid & 31, w = tid >> 5, half = lane >> 4, c = lane & 15, g = tid >> 4;
    const float* kc = k_cache + (size_t)bh * T_max * D;
    const float* vc = v_cache + (size_t)bh * T_max * D;
    const float4 q4 = ld4(qkv + (size_t)b * qkv_stride + h * D + 4 * c);
    const float scale = rsqrtf((float)D);
    const float4 z = make_float4(0.f, 0.f, 0.f, 0.f);

    // pass 1: the max score
    float mx = -INFINITY;
    int base = 0;
    for (; base + 32 <= T_ctx; base += 32) {
        float4 k4[DEC_UNROLL];
#pragma unroll
        for (int u = 0; u < DEC_UNROLL; ++u) k4[u] = ld4(kc + (size_t)(base + 8 * u + 2 * w + half) * D + 4 * c);
#pragma unroll
        for (int u = 0; u < DEC_UNROLL; ++u) mx = fmaxf(mx, dot_half_warp(q4, k4[u]) * scale);
    }
    for (int j0 = base + 2 * w; j0 < T_ctx; j0 += 8) {
        const int j = j0 + half; const bool ok = j < T_ctx;
        float s = dot_half_warp(q4, ok ? ld4(kc + (size_t)j * D + 4 * c) : z) * scale;
        if (ok) mx = fmaxf(mx, s);
    }
    if (c == 0) sm_max[g] = mx;
    __syncthreads();
    float M = -INFINITY;
    for (int k = 0; k < 8; ++k) M = fmaxf(M, sm_max[k]);

    // pass 2: K again for the scores, V for the sum
    float l = 0.f; float4 o4 = z;
    base = 0;
    for (; base + 32 <= T_ctx; base += 32) {
        float4 k4[DEC_UNROLL], v4[DEC_UNROLL];
#pragma unroll
        for (int u = 0; u < DEC_UNROLL; ++u) {
            const int j = base + 8 * u + 2 * w + half;
            k4[u] = ld4(kc + (size_t)j * D + 4 * c);
            v4[u] = ld4(vc + (size_t)j * D + 4 * c);
        }
#pragma unroll
        for (int u = 0; u < DEC_UNROLL; ++u) {
            float p = __expf(dot_half_warp(q4, k4[u]) * scale - M);
            l += p;
            o4.x += p * v4[u].x; o4.y += p * v4[u].y; o4.z += p * v4[u].z; o4.w += p * v4[u].w;
        }
    }
    for (int j0 = base + 2 * w; j0 < T_ctx; j0 += 8) {
        const int j = j0 + half; const bool ok = j < T_ctx;
        float4 k4 = ok ? ld4(kc + (size_t)j * D + 4 * c) : z;
        float4 v4 = ok ? ld4(vc + (size_t)j * D + 4 * c) : z;
        float s = dot_half_warp(q4, k4) * scale;
        if (ok) {
            float p = __expf(s - M);
            l += p;
            o4.x += p * v4.x; o4.y += p * v4.y; o4.z += p * v4.z; o4.w += p * v4.w;
        }
    }
    // the 8 half-warps share M: their l and o slices just add
    if (c == 0) sm_l[g] = l;
    sm_o[g][4 * c] = o4.x; sm_o[g][4 * c + 1] = o4.y; sm_o[g][4 * c + 2] = o4.z; sm_o[g][4 * c + 3] = o4.w;
    __syncthreads();
    if (tid < D) {
        float L = 0.f, O = 0.f;
        for (int k = 0; k < 8; ++k) { L += sm_l[k]; O += sm_o[k][tid]; }
        att[(size_t)b * H * D + h * D + tid] = O / L;
    }
}

// ---------------------------------------------------------------------------
// v2: one block per (b, h), one pass (section 5's listing), merge of the 8 half-warps at the end.
// ---------------------------------------------------------------------------
template <int D>
__global__ void __launch_bounds__(DEC_BLOCK)
decode_v2_online(const float* __restrict__ qkv, int qkv_stride, const float* __restrict__ k_cache,
                 const float* __restrict__ v_cache, float* __restrict__ att, int H, int T_ctx, int T_max)
{
    const int bh = blockIdx.x, b = bh / H, h = bh % H, c = threadIdx.x & 15;
    const float* kc = k_cache + (size_t)bh * T_max * D;
    const float* vc = v_cache + (size_t)bh * T_max * D;
    const float4 q4 = ld4(qkv + (size_t)b * qkv_stride + h * D + 4 * c);
    float m = -INFINITY, l = 0.f; float4 o4 = make_float4(0.f, 0.f, 0.f, 0.f);
    online_range<D>(kc, vc, q4, rsqrtf((float)D), 0, T_ctx, m, l, o4);
    float o[4] = {o4.x, o4.y, o4.z, o4.w}, M, L, O;
    block_merge<D, 8, 4>(m, l, o, M, L, O);
    write_result<D, true>(M, L, O, att, (size_t)b * H * D + h * D, 0);
}

// ---------------------------------------------------------------------------
// v3: split-K. Block (bh, s) handles keys [s*chunk, min(T, (s+1)*chunk)); same body as v2; writes its
// partial to out + (bh*S + s)*(D + 2) as [m, l, O~[0..D)], or att directly when DIRECT (S == 1).
// T_arr (optional, ragged mode): a context length per sequence instead of T_ctx.
// ---------------------------------------------------------------------------
template <int D, bool DIRECT>
__global__ void __launch_bounds__(DEC_BLOCK)
decode_v3_split(const float* __restrict__ qkv, int qkv_stride, const float* __restrict__ k_cache,
                const float* __restrict__ v_cache, float* __restrict__ out, int H, int T_ctx,
                const int* __restrict__ T_arr, int T_max, int S)
{
    const int bh = blockIdx.x, s = blockIdx.y, b = bh / H, h = bh % H, c = threadIdx.x & 15;
    const int T = T_arr ? T_arr[b] : T_ctx, chunk = split_chunk(T, S);
    const int start = min(T, s * chunk), end = min(T, start + chunk);
    const float* kc = k_cache + (size_t)bh * T_max * D;
    const float* vc = v_cache + (size_t)bh * T_max * D;
    const float4 q4 = ld4(qkv + (size_t)b * qkv_stride + h * D + 4 * c);
    float m = -INFINITY, l = 0.f; float4 o4 = make_float4(0.f, 0.f, 0.f, 0.f);
    online_range<D>(kc, vc, q4, rsqrtf((float)D), start, end, m, l, o4);
    float o[4] = {o4.x, o4.y, o4.z, o4.w}, M, L, O;
    block_merge<D, 8, 4>(m, l, o, M, L, O);
    write_result<D, DIRECT>(M, L, O, out, (size_t)b * H * D + h * D, (size_t)bh * S + s);
}

// The combine: grid B*H (or B*H_q for GQA), D threads; thread d merges the S partials' O~[d].
template <int D>
__global__ void __launch_bounds__(D)
decode_combine(const float* __restrict__ partials, float* __restrict__ att, int H, int S)
{
    const int bh = blockIdx.x, b = bh / H, h = bh % H, d = threadIdx.x;
    const float* p = partials + (size_t)bh * S * (D + 2);
    float M = -INFINITY;
    for (int s = 0; s < S; ++s) M = fmaxf(M, p[s * (D + 2)]);
    float L = 0.f, O = 0.f;
    for (int s = 0; s < S; ++s) {
        float w = __expf(p[s * (D + 2)] - M);
        L += p[s * (D + 2) + 1] * w;  O += p[s * (D + 2) + 2 + d] * w;
    }
    att[(size_t)b * H * D + h * D + d] = O / L;
}

// ---------------------------------------------------------------------------
// v3b: v3 whose last block to finish does the combine (chapter 15, section 4). counter[B*H] must be
// zero before the first launch (cudaMemset); the last block resets it. NOFENCE removes both fences
// (the fence experiment: run it on a GPU, never on cudasim, which runs blocks one after another).
// ---------------------------------------------------------------------------
template <int D>
__global__ void __launch_bounds__(DEC_BLOCK)
decode_v3b_lastblock(const float* __restrict__ qkv, int qkv_stride, const float* __restrict__ k_cache,
                     const float* __restrict__ v_cache, float* partials, unsigned* counter,
                     float* __restrict__ att, int H, int T_ctx, int T_max, int S)
{
    const int bh = blockIdx.x, split = blockIdx.y, b = bh / H, h = bh % H, tid = threadIdx.x, c = tid & 15;
    const int C = H * D, chunk = split_chunk(T_ctx, S);
    const int start = min(T_ctx, split * chunk), end = min(T_ctx, start + chunk);
    const float* kc = k_cache + (size_t)bh * T_max * D;
    const float* vc = v_cache + (size_t)bh * T_max * D;
    const float4 q4 = ld4(qkv + (size_t)b * qkv_stride + h * D + 4 * c);
    float m = -INFINITY, l = 0.f; float4 o4 = make_float4(0.f, 0.f, 0.f, 0.f);
    online_range<D>(kc, vc, q4, rsqrtf((float)D), start, end, m, l, o4);
    float o[4] = {o4.x, o4.y, o4.z, o4.w}, Mb, Lb, Ob;
    block_merge<D, 8, 4>(m, l, o, Mb, Lb, Ob);

    // the tail of section 4's listing
    __shared__ bool am_last;
    write_result<D, false>(Mb, Lb, Ob, partials, 0, (size_t)bh * S + split);   // publish: D + 2 floats, plain stores
#ifndef NOFENCE
    __threadfence();                                           // my stores are visible device-wide before anything after this
#endif
    __syncthreads();                                           // ...and every thread of the block has fenced
    if (tid == 0) am_last = (atomicAdd(&counter[bh], 1u) == (unsigned)(S - 1));
    __syncthreads();
    if (!am_last) return;
#ifndef NOFENCE
    __threadfence();                                           // the others' partials are visible to me
#endif
    if (tid < D) {                                             // thread d < D merges the S partials (L2 reads: __ldcg)
        const int d = tid;
        const float* p = partials + (size_t)bh * S * (D + 2);
        float M = -INFINITY;
        for (int s = 0; s < S; ++s) M = fmaxf(M, __ldcg(&p[s * (D + 2)]));
        float L = 0.f, O = 0.f;
        for (int s = 0; s < S; ++s) {
            float ms = __ldcg(&p[s * (D + 2)]), ls = __ldcg(&p[s * (D + 2) + 1]), os = __ldcg(&p[s * (D + 2) + 2 + d]);
            float w = __expf(ms - M);  L += ls * w;  O += os * w;
        }
        att[(size_t)b * C + h * D + d] = O / L;
    }
    if (tid == 0) counter[bh] = 0;                             // reset for the next launch (nobody races)
}

// ---------------------------------------------------------------------------
// v4: FP16 cache [B][H][T_max][D] of __half. A 16-byte load holds 8 halves, so a key row (128 bytes)
// takes 8 lanes: quarter r = lane / 8 picks the key, c = lane % 8 the dims 8c..8c+7; a warp reads 4
// keys per step (512 contiguous bytes), the block 16; shuffle tree xor 4, 2, 1. All arithmetic FP32,
// q FP32. Split-K and partials exactly as v3 (the same combine).
// ---------------------------------------------------------------------------
__device__ __forceinline__ float dot_quarter_warp(const float q[8], const uint4& raw)
{
    float k[8]; halves_to_floats(raw, k);
    float s = 0.f;
#pragma unroll
    for (int i = 0; i < 8; ++i) s += q[i] * k[i];
    s += __shfl_xor_sync(DEC_FULL, s, 4); s += __shfl_xor_sync(DEC_FULL, s, 2);
    s += __shfl_xor_sync(DEC_FULL, s, 1);                                                // all 8 lanes hold the score
    return s;
}
__device__ __forceinline__ void online_update8(float s, const uint4& vraw, float& m, float& l, float o[8])
{
    float v[8]; halves_to_floats(vraw, v);
    float m_new = fmaxf(m, s), alpha = __expf(m - m_new), p = __expf(s - m_new);
    l = alpha * l + p;
#pragma unroll
    for (int i = 0; i < 8; ++i) o[i] = alpha * o[i] + p * v[i];
    m = m_new;
}

template <int D, bool DIRECT>
__global__ void __launch_bounds__(DEC_BLOCK)
decode_v4_half(const float* __restrict__ qkv, int qkv_stride, const __half* __restrict__ k_cache,
               const __half* __restrict__ v_cache, float* __restrict__ out, int H, int T_ctx, int T_max, int S)
{
    static_assert(D == 64, "8 lanes x 8 halves = 64");
    const int bh = blockIdx.x, s = blockIdx.y, b = bh / H, h = bh % H, tid = threadIdx.x;
    const int lane = tid & 31, w = tid >> 5, r = lane >> 3, c = lane & 7;
    const int chunk = split_chunk(T_ctx, S), start = min(T_ctx, s * chunk), end = min(T_ctx, start + chunk);
    const __half* kc = k_cache + (size_t)bh * T_max * D;
    const __half* vc = v_cache + (size_t)bh * T_max * D;
    const float* qp = qkv + (size_t)b * qkv_stride + h * D + 8 * c;
    float q[8]; { float4 a = ld4(qp), bq = ld4(qp + 4); q[0] = a.x; q[1] = a.y; q[2] = a.z; q[3] = a.w;
                  q[4] = bq.x; q[5] = bq.y; q[6] = bq.z; q[7] = bq.w; }
    const float scale = rsqrtf((float)D);
    float m = -INFINITY, l = 0.f, o[8] = {0.f, 0.f, 0.f, 0.f, 0.f, 0.f, 0.f, 0.f};
    int base = start;
    for (; base + 64 <= end; base += 64) {                       // 16 quarter-warps x UNROLL 4
        uint4 k8[DEC_UNROLL], v8[DEC_UNROLL];
#pragma unroll
        for (int u = 0; u < DEC_UNROLL; ++u) {
            const int j = base + 16 * u + 4 * w + r;
            k8[u] = ld16(kc + (size_t)j * D + 8 * c);
            v8[u] = ld16(vc + (size_t)j * D + 8 * c);
        }
#pragma unroll
        for (int u = 0; u < DEC_UNROLL; ++u) online_update8(dot_quarter_warp(q, k8[u]) * scale, v8[u], m, l, o);
    }
    for (int j0 = base + 4 * w; j0 < end; j0 += 16) {          // warp-uniform tail
        const int j = j0 + r; const bool ok = j < end;
        const uint4 z = make_uint4(0u, 0u, 0u, 0u);
        uint4 k8 = ok ? ld16(kc + (size_t)j * D + 8 * c) : z;
        uint4 v8 = ok ? ld16(vc + (size_t)j * D + 8 * c) : z;
        float sc = dot_quarter_warp(q, k8) * scale;
        if (ok) online_update8(sc, v8, m, l, o);
    }
    float M, L, O;
    block_merge<D, 16, 8>(m, l, o, M, L, O);
    write_result<D, DIRECT>(M, L, O, out, (size_t)b * H * D + h * D, (size_t)bh * S + s);
}

// ---------------------------------------------------------------------------
// v5: grouped-query attention. The cache has H_kv heads; query head hq reads kv head hq / G. A block
// serves one (b, kv head, split) and the G query rows of the group: every key row loaded gives G dot
// products (G shuffle trees) and G online updates. Partials per query head at (b*H_q + hq)*S + s;
// the combine runs per query head (decode_combine with H = H_q). Output att[b*H_q*D + hq*D + d].
// ---------------------------------------------------------------------------
template <int D, int G, bool DIRECT>
__global__ void __launch_bounds__(DEC_BLOCK)
decode_v5_gqa(const float* __restrict__ qkv, int qkv_stride, const float* __restrict__ k_cache,
              const float* __restrict__ v_cache, float* __restrict__ out, int H_kv, int T_ctx, int T_max, int S)
{
    const int bkv = blockIdx.x, s = blockIdx.y, b = bkv / H_kv, hk = bkv % H_kv, tid = threadIdx.x;
    const int lane = tid & 31, w = tid >> 5, half = lane >> 4, c = lane & 15, H_q = H_kv * G;
    const int chunk = split_chunk(T_ctx, S), start = min(T_ctx, s * chunk), end = min(T_ctx, start + chunk);
    const float* kc = k_cache + (size_t)bkv * T_max * D;
    const float* vc = v_cache + (size_t)bkv * T_max * D;
    const float scale = rsqrtf((float)D);
    float4 q4[G], o4[G]; float m[G], l[G];
#pragma unroll
    for (int i = 0; i < G; ++i) {
        q4[i] = ld4(qkv + (size_t)b * qkv_stride + (hk * G + i) * D + 4 * c);
        o4[i] = make_float4(0.f, 0.f, 0.f, 0.f); m[i] = -INFINITY; l[i] = 0.f;
    }
    int base = start;
    for (; base + 32 <= end; base += 32) {
        float4 k4[DEC_UNROLL], v4[DEC_UNROLL];
#pragma unroll
        for (int u = 0; u < DEC_UNROLL; ++u) {
            const int j = base + 8 * u + 2 * w + half;
            k4[u] = ld4(kc + (size_t)j * D + 4 * c);
            v4[u] = ld4(vc + (size_t)j * D + 4 * c);
        }
#pragma unroll
        for (int u = 0; u < DEC_UNROLL; ++u)
#pragma unroll
            for (int i = 0; i < G; ++i) online_update(dot_half_warp(q4[i], k4[u]) * scale, v4[u], m[i], l[i], o4[i]);
    }
    for (int j0 = base + 2 * w; j0 < end; j0 += 8) {
        const int j = j0 + half; const bool ok = j < end;
        const float4 z = make_float4(0.f, 0.f, 0.f, 0.f);
        float4 k4 = ok ? ld4(kc + (size_t)j * D + 4 * c) : z;
        float4 v4 = ok ? ld4(vc + (size_t)j * D + 4 * c) : z;
#pragma unroll
        for (int i = 0; i < G; ++i) {
            float sc = dot_half_warp(q4[i], k4) * scale;
            if (ok) online_update(sc, v4, m[i], l[i], o4[i]);
        }
    }
#pragma unroll
    for (int i = 0; i < G; ++i) {
        const int hq = hk * G + i;
        float o[4] = {o4[i].x, o4[i].y, o4[i].z, o4[i].w}, M, L, O;
        block_merge<D, 8, 4>(m[i], l[i], o, M, L, O);
        write_result<D, DIRECT>(M, L, O, out, (size_t)b * H_q * D + hq * D, ((size_t)b * H_q + hq) * S + s);
    }
}

// ---------------------------------------------------------------------------
// v6 (optional): thread block clusters with distributed shared memory, sm_90 and newer only.
// Grid (8, B*H), launched with a cluster of 8 blocks along x (cudaLaunchKernelEx), so the 8 splits of
// one (b, h) are one cluster. Each block leaves its partial in its own shared memory; cluster.sync();
// block 0 reads the 8 partials through map_shared_rank and writes att; cluster.sync() again so the
// others stay resident until it has read them. Not compiled under cudasim (no clusters there).
// ---------------------------------------------------------------------------
#if !defined(CUDASIM)
#include <cooperative_groups.h>
constexpr int DEC_CLUSTER = 8;
template <int D>
__global__ void __launch_bounds__(DEC_BLOCK)
decode_v6_cluster(const float* __restrict__ qkv, int qkv_stride, const float* __restrict__ k_cache,
                  const float* __restrict__ v_cache, float* __restrict__ att, int H, int T_ctx, int T_max)
{
#if defined(__CUDA_ARCH__) && __CUDA_ARCH__ >= 900
    namespace cg = cooperative_groups;
    cg::cluster_group cluster = cg::this_cluster();
    __shared__ float part[D + 2];
    const int s = (int)cluster.block_rank(), bh = blockIdx.y, b = bh / H, h = bh % H, tid = threadIdx.x, c = tid & 15;
    const int chunk = (T_ctx + DEC_CLUSTER - 1) / DEC_CLUSTER;
    const int start = min(T_ctx, s * chunk), end = min(T_ctx, start + chunk);
    const float* kc = k_cache + (size_t)bh * T_max * D;
    const float* vc = v_cache + (size_t)bh * T_max * D;
    const float4 q4 = ld4(qkv + (size_t)b * qkv_stride + h * D + 4 * c);
    float m = -INFINITY, l = 0.f; float4 o4 = make_float4(0.f, 0.f, 0.f, 0.f);
    online_range<D>(kc, vc, q4, rsqrtf((float)D), start, end, m, l, o4);
    float o[4] = {o4.x, o4.y, o4.z, o4.w}, M, L, O;
    block_merge<D, 8, 4>(m, l, o, M, L, O);
    if (tid < D) { if (tid == 0) { part[0] = M; part[1] = L; } part[2 + tid] = O; }
    cluster.sync();                                            // every block's partial is in its shared memory
    if (s == 0 && tid < D) {
        float Mc = -INFINITY;
        for (int r = 0; r < DEC_CLUSTER; ++r) Mc = fmaxf(Mc, cluster.map_shared_rank(part, r)[0]);
        float Lc = 0.f, Oc = 0.f;
        for (int r = 0; r < DEC_CLUSTER; ++r) {
            const float* pr = cluster.map_shared_rank(part, r);
            float w = __expf(pr[0] - Mc);  Lc += pr[1] * w;  Oc += pr[2 + tid] * w;
        }
        att[(size_t)b * H * D + h * D + tid] = Oc / Lc;
    }
    cluster.sync();                                            // keep the partials alive until block 0 has read them
#endif
}
#endif
