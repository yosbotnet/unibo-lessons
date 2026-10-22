// attention.cuh - causal self-attention, the KV cache, and the table of implementations.
//
// Layout (the engine contract; chapters 13-15 keep it):
//   qkv [B*T, 3C]   row = one token; columns [0, C) = q, [C, 2C) = k, [2C, 3C) = v;
//                   head h occupies columns h*D .. h*D + D - 1 inside each third
//   att [B*T, C]    the heads' outputs side by side, same column order
//   k_cache, v_cache  per layer [B][H][T_max][D]: one head's keys are a contiguous T x D block
//
// Implementations shipped here:
//   prefill "naive"   chapter 10: S = Q K^T (scaled), causal softmax, O = P V; S goes to DRAM
//   decode  "simple"  one block per (sequence, head): fine for a first engine, and too few blocks
//                     to fill the GPU, which is chapter 15's starting point
// Chapter 14 added prefill "flash" (lab 13), chapter 15 decode "split" (lab 14): see the tables at the end.
#pragma once

#include <cfloat>
#include "kernels.cuh"

// ---------------------------------------------------------------------------
// KV cache append: the k and v of T_new new tokens of every sequence go to
// positions pos0 .. pos0 + T_new - 1. One block per token; a thread per value.
// ---------------------------------------------------------------------------
__global__ void kv_append_kernel(const float* __restrict__ qkv, float* __restrict__ k_cache,
                                 float* __restrict__ v_cache, int T_new, int pos0, int H, int D, int T_max)
{
    const int r = blockIdx.x, b = r / T_new, t = r % T_new, C = H * D;
    const float* src = qkv + (size_t)r * 3 * C;
    for (int e = threadIdx.x; e < C; e += blockDim.x) {
        int h = e / D, d = e % D;
        size_t dst = (((size_t)b * H + h) * T_max + pos0 + t) * D + d;
        k_cache[dst] = src[C + e];
        v_cache[dst] = src[2 * C + e];
    }
}

inline void kv_append(const float* qkv, float* k_cache, float* v_cache, int B, int T_new, int pos0,
                      int H, int D, int T_max, cudaStream_t s)
{
    kv_append_kernel<<<B * T_new, 256, 0, s>>>(qkv, k_cache, v_cache, T_new, pos0, H, D, T_max);
}

// ---------------------------------------------------------------------------
// Naive prefill attention, three kernels, S[B*H][T][T] in scratch.
// ---------------------------------------------------------------------------
constexpr int AT = 16;   // tile edge of the two matmul-like kernels

// S[bh][i][j] = (q_i . k_j) / sqrt(D) for j <= i, one 16 x 16 tile per block,
// D walked 16 at a time through shared memory (chapter 7's tiling). Tiles
// entirely above the diagonal (all j > i) are skipped: nothing reads them.
__global__ void attn_scores(const float* __restrict__ qkv, float* __restrict__ S, int T, int H, int D, float scale)
{
    const int bh = blockIdx.z, b = bh / H, h = bh % H, C = H * D;
    const int i0 = blockIdx.y * AT, j0 = blockIdx.x * AT;
    if (j0 > i0 + AT - 1) return;                         // fully masked tile: the whole block leaves
    __shared__ float Qs[AT][AT + 1], Ks[AT][AT + 1];
    const int ty = threadIdx.y, tx = threadIdx.x;
    float acc = 0.0f;
    for (int d0 = 0; d0 < D; d0 += AT) {
        int qi = i0 + ty, kj = j0 + ty, d = d0 + tx;      // rows of Q and K, loaded along d (coalesced)
        Qs[ty][tx] = (qi < T && d < D) ? qkv[((size_t)b * T + qi) * 3 * C + h * D + d] : 0.0f;
        Ks[ty][tx] = (kj < T && d < D) ? qkv[((size_t)b * T + kj) * 3 * C + C + h * D + d] : 0.0f;
        __syncthreads();
#pragma unroll
        for (int k = 0; k < AT; ++k) acc += Qs[ty][k] * Ks[tx][k];
        __syncthreads();
    }
    int i = i0 + ty, j = j0 + tx;
    if (i < T && j < T && j <= i) S[((size_t)bh * T + i) * T + j] = acc * scale;
}

// Row softmax over j = 0 .. i, in place: one warp per row, three passes
// (max, sum, write). Entries j > i are never read or written.
__global__ void attn_softmax_causal(float* __restrict__ S, int rows, int T)
{
    int row = blockIdx.x * (blockDim.x / 32) + threadIdx.x / 32, lane = threadIdx.x % 32;
    if (row >= rows) return;                              // whole warps leave together
    int i = row % T;
    float* s = S + (size_t)row * T;
    float m = -FLT_MAX;
    for (int j = lane; j <= i; j += 32) m = fmaxf(m, s[j]);
    for (int o = 16; o > 0; o >>= 1) m = fmaxf(m, __shfl_xor_sync(0xffffffffu, m, o));
    float sum = 0.0f;
    for (int j = lane; j <= i; j += 32) sum += expf(s[j] - m);
    for (int o = 16; o > 0; o >>= 1) sum += __shfl_xor_sync(0xffffffffu, sum, o);
    float inv = 1.0f / sum;
    for (int j = lane; j <= i; j += 32) s[j] = expf(s[j] - m) * inv;
}

// att[b*T + i][h*D + d] = sum over j <= i of P[bh][i][j] * v_j[d]; 16 x 16 output tiles.
__global__ void attn_pv(const float* __restrict__ P, const float* __restrict__ qkv, float* __restrict__ att,
                        int T, int H, int D)
{
    const int bh = blockIdx.z, b = bh / H, h = bh % H, C = H * D;
    const int i0 = blockIdx.y * AT, d0 = blockIdx.x * AT;
    __shared__ float Ps[AT][AT + 1], Vs[AT][AT + 1];
    const int ty = threadIdx.y, tx = threadIdx.x;
    float acc = 0.0f;
    const int jend = min(T, i0 + AT);                     // rows of this tile see keys up to i0 + 15
    for (int j0 = 0; j0 < jend; j0 += AT) {
        int i = i0 + ty, j = j0 + tx;
        Ps[ty][tx] = (i < T && j <= i) ? P[((size_t)bh * T + i) * T + j] : 0.0f;
        int vj = j0 + ty, d = d0 + tx;
        Vs[ty][tx] = (vj < T && d < D) ? qkv[((size_t)b * T + vj) * 3 * C + 2 * C + h * D + d] : 0.0f;
        __syncthreads();
#pragma unroll
        for (int k = 0; k < AT; ++k) acc += Ps[ty][k] * Vs[k][tx];
        __syncthreads();
    }
    int i = i0 + ty, d = d0 + tx;
    if (i < T && d < D) att[((size_t)b * T + i) * C + h * D + d] = acc;
}

inline size_t attn_prefill_naive_scratch_bytes(int B, int T, int H, int /*D*/)
{
    return (size_t)B * H * T * T * sizeof(float);
}

inline void attn_prefill_naive(const float* qkv, float* att, int B, int T, int H, int D, float* scratch, cudaStream_t s)
{
    float scale = 1.0f / sqrtf((float)D);
    dim3 blk(AT, AT);
    attn_scores<<<dim3(cdiv(T, AT), cdiv(T, AT), B * H), blk, 0, s>>>(qkv, scratch, T, H, D, scale);
    int rows = B * H * T;
    attn_softmax_causal<<<cdiv(rows, 8), 256, 0, s>>>(scratch, rows, T);
    attn_pv<<<dim3(cdiv(D, AT), cdiv(T, AT), B * H), blk, 0, s>>>(scratch, qkv, att, T, H, D);
}

// ---------------------------------------------------------------------------
// Simple decode attention: one new query per sequence, against T_ctx cached
// keys (the new token's own k and v were appended first). One block of 128
// threads per (b, h): the scores go to shared memory, then a block-wide max
// and sum, then the weighted sum of values with the threads split over d.
// B * H blocks: 12 for one sequence of GPT-2 small, on a 48-SM GPU.
// ---------------------------------------------------------------------------
constexpr int DEC_THREADS = 128, DEC_MAXT = 1024, DEC_MAXD = 128;

__device__ float block_reduce_dec(float v, float* red, bool is_max)
{
    for (int o = 16; o > 0; o >>= 1) {
        float w = __shfl_xor_sync(0xffffffffu, v, o);
        v = is_max ? fmaxf(v, w) : v + w;
    }
    if (threadIdx.x % 32 == 0) red[threadIdx.x / 32] = v;
    __syncthreads();
    float r = red[0];
    for (int w = 1; w < DEC_THREADS / 32; ++w) r = is_max ? fmaxf(r, red[w]) : r + red[w];
    __syncthreads();
    return r;
}

__global__ void __launch_bounds__(DEC_THREADS)
attn_decode_simple_kernel(const float* __restrict__ qkv, const float* __restrict__ k_cache,
                          const float* __restrict__ v_cache, float* __restrict__ att,
                          int H, int D, int T_ctx, int T_max, float scale)
{
    __shared__ float p[DEC_MAXT], q[DEC_MAXD], red[DEC_THREADS / 32], part[DEC_THREADS];
    const int bh = blockIdx.x, b = bh / H, h = bh % H, C = H * D, tid = threadIdx.x;
    const float* K = k_cache + (size_t)bh * T_max * D;
    const float* V = v_cache + (size_t)bh * T_max * D;
    for (int d = tid; d < D; d += DEC_THREADS) q[d] = qkv[(size_t)b * 3 * C + h * D + d];
    __syncthreads();
    float m = -FLT_MAX;
    for (int j = tid; j < T_ctx; j += DEC_THREADS) {      // a thread per key: reads one whole key row
        float s = 0.0f;
        for (int d = 0; d < D; ++d) s += q[d] * K[(size_t)j * D + d];
        p[j] = s * scale;
        m = fmaxf(m, p[j]);
    }
    m = block_reduce_dec(m, red, true);
    float sum = 0.0f;
    for (int j = tid; j < T_ctx; j += DEC_THREADS) { p[j] = expf(p[j] - m); sum += p[j]; }
    sum = block_reduce_dec(sum, red, false);              // its barrier also publishes p[]
    const int parts = DEC_THREADS / D, d = tid % D, g = tid / D;   // D divides 128
    float o = 0.0f;
    if (g < parts)
        for (int j = g; j < T_ctx; j += parts) o += p[j] * V[(size_t)j * D + d];
    part[tid] = o;
    __syncthreads();
    if (tid < D) {
        float t = 0.0f;
        for (int k = 0; k < parts; ++k) t += part[k * D + tid];
        att[(size_t)b * C + h * D + tid] = t / sum;
    }
}

inline size_t attn_decode_simple_scratch_bytes(int, int, int, int) { return 0; }

inline void attn_decode_simple(const float* qkv, const float* k_cache, const float* v_cache, float* att,
                               int B, int H, int D, int T_ctx, int T_max, float* /*scratch*/, cudaStream_t s)
{
    if (T_ctx > DEC_MAXT || D > DEC_MAXD || DEC_THREADS % D) {
        std::fprintf(stderr, "attn_decode_simple: needs T_ctx <= %d and D dividing %d (got %d, %d)\n",
                     DEC_MAXT, DEC_THREADS, T_ctx, D);
        std::exit(2);
    }
    attn_decode_simple_kernel<<<B * H, DEC_THREADS, 0, s>>>(qkv, k_cache, v_cache, att, H, D, T_ctx, T_max,
                                                            1.0f / sqrtf((float)D));
}

// ---------------------------------------------------------------------------
// The tables. A new implementation is one function with the same signature,
// one scratch-size function, and one line here.
// ---------------------------------------------------------------------------
using PrefillFn = void (*)(const float* qkv, float* att, int B, int T, int H, int D, float* scratch, cudaStream_t s);
using DecodeFn  = void (*)(const float* qkv, const float* k_cache, const float* v_cache, float* att,
                           int B, int H, int D, int T_ctx, int T_max, float* scratch, cudaStream_t s);
using ScratchFn = size_t (*)(int B, int T, int H, int D);

// The faster kernels live in their labs; the engine takes them as they are.
#include "../lab13-flash-attention/flash_fp32.h"
#include "../lab14-decode-attention/decode_engine.h"

struct PrefillImpl { const char* name; PrefillFn run; ScratchFn scratch; };
struct DecodeImpl  { const char* name; DecodeFn run; ScratchFn scratch; };

static const PrefillImpl PREFILL_IMPLS[] = {
    {"naive", attn_prefill_naive, attn_prefill_naive_scratch_bytes},
    {"flash", attn_prefill_flash, attn_prefill_flash_scratch_bytes},      // chapter 14, lab 13 (D = 64)
};
static const DecodeImpl DECODE_IMPLS[] = {
    {"simple", attn_decode_simple, attn_decode_simple_scratch_bytes},
    {"split", attn_decode_split, attn_decode_split_scratch_bytes},        // chapter 15, lab 14 (D = 64)
};

template <typename Impl, size_t N>
const Impl* find_impl(const Impl (&tab)[N], const char* name)
{
    for (const Impl& i : tab) if (std::strcmp(i.name, name) == 0) return &i;
    std::fprintf(stderr, "unknown attention implementation '%s'; available:", name);
    for (const Impl& i : tab) std::fprintf(stderr, " %s", i.name);
    std::fprintf(stderr, "\n");
    std::exit(2);
}
