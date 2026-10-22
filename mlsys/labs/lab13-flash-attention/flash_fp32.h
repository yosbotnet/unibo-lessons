// flash_fp32.h - lab 13: FlashAttention on the FP32 lanes (chapter 14, sections 3-5).
//
// Engine-ready: attn_prefill_flash() has the engine contract's signature
// (PLAN section 4 / labs/gpt2/attention.cuh), so the engine can include this
// header unchanged and add one line to PREFILL_IMPLS:
//     {"flash", attn_prefill_flash, attn_prefill_flash_scratch_bytes},
//
// Layout (the engine's): qkv [B*T, 3C], columns [0,C) q, [C,2C) k, [2C,3C) v,
// head h at columns h*D .. h*D+D-1 of each third; att [B*T, C], same column order.
//
// One block = 64 query rows (Br) of one head (b, h); one thread per query row.
// Key tiles of Bc = 64 rows of K and V go through shared memory; every thread
// keeps its row's q (64 floats), the unnormalized output o (64 floats), the
// running max m and running sum l in registers, and applies section 3's merge
// once per tile. Causal: tiles above the diagonal are never loaded.
#pragma once
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cuda_runtime.h>

constexpr int FLASH32_BR = 64, FLASH32_BC = 64;

template <int D>
__global__ void __launch_bounds__(FLASH32_BR)
flash_fp32_kernel(const float* __restrict__ qkv, float* __restrict__ att, int B, int T, int H, bool causal)
{
    // All 64 threads read the same K (or V) row at the same time: a broadcast, so no padding is needed.
    // Ss[r][t] = score of key r for thread t's row: consecutive threads, consecutive banks.
    __shared__ float Ks[FLASH32_BC][D], Vs[FLASH32_BC][D], Ss[FLASH32_BC][FLASH32_BR];
    const int t = threadIdx.x, bh = blockIdx.y, b = bh / H, h = bh % H, C = H * D;
    const int i = blockIdx.x * FLASH32_BR + t;               // this thread's query row
    const bool valid = i < T;                                 // rows >= T compute (barriers!) but never store
    const float scale = 1.0f / sqrtf((float)D);

    float q[D], o[D];
    const float* qrow = qkv + ((size_t)b * T + (valid ? i : 0)) * 3 * C + h * D;
#pragma unroll
    for (int d = 0; d < D; ++d) { q[d] = valid ? qrow[d] : 0.0f; o[d] = 0.0f; }
    float m = -INFINITY, l = 0.0f;

    const int all_tiles = (T + FLASH32_BC - 1) / FLASH32_BC;
    const int n_tiles = causal ? min(all_tiles, (int)blockIdx.x + 1) : all_tiles;   // Br = Bc: tile j <= block
    for (int j = 0; j < n_tiles; ++j) {
        const int key0 = j * FLASH32_BC;
        __syncthreads();                                      // everyone is done reading the previous tile
        for (int r = 0; r < FLASH32_BC; ++r) {                // thread t loads column t of each row: coalesced
            const int key = key0 + r;
            const size_t src = ((size_t)b * T + key) * 3 * C + h * D;
            for (int d = t; d < D; d += FLASH32_BR) {
                Ks[r][d] = key < T ? qkv[src + C + d] : 0.0f;
                Vs[r][d] = key < T ? qkv[src + 2 * C + d] : 0.0f;
            }
        }
        __syncthreads();
        // pass 1: scores and the tile's max
        float mx = m;
        for (int r = 0; r < FLASH32_BC; ++r) {
            const int key = key0 + r;
            float s = 0.0f;
#pragma unroll
            for (int d = 0; d < D; ++d) s += q[d] * Ks[r][d];
            s *= scale;
            if (key >= T || (causal && key > i)) s = -INFINITY;
            Ss[r][t] = s;
            mx = fmaxf(mx, s);
        }
        // the merge: rescale what is there by alpha, then add this tile
        const float m_use = (mx == -INFINITY) ? 0.0f : mx;   // a row with nothing visible yet: avoid inf - inf
        const float alpha = expf(m - m_use);
        l *= alpha;
#pragma unroll
        for (int d = 0; d < D; ++d) o[d] *= alpha;
        // pass 2: exponentials, sum, and the weighted sum of V
        for (int r = 0; r < FLASH32_BC; ++r) {
            const float p = expf(Ss[r][t] - m_use);
            l += p;
#pragma unroll
            for (int d = 0; d < D; ++d) o[d] += p * Vs[r][d];
        }
        m = mx;
    }
    if (!valid) return;                                       // after the last barrier: safe
    float* out = att + ((size_t)b * T + i) * C + h * D;
    const float inv = 1.0f / l;
#pragma unroll
    for (int d = 0; d < D; ++d) out[d] = o[d] * inv;
}

// The engine contract. Causal always (the engine's prefill); D must be 64.
inline size_t attn_prefill_flash_scratch_bytes(int /*B*/, int /*T*/, int /*H*/, int /*D*/) { return 0; }

inline void attn_prefill_flash_causal(const float* qkv, float* att, int B, int T, int H, int D, bool causal,
                                      cudaStream_t s)
{
    if (D != 64) {
        std::fprintf(stderr, "attn_prefill_flash: head size D = %d; only D = 64 is instantiated\n", D);
        std::exit(2);
    }
    dim3 grid((T + FLASH32_BR - 1) / FLASH32_BR, B * H);
    flash_fp32_kernel<64><<<grid, FLASH32_BR, 0, s>>>(qkv, att, B, T, H, causal);
}

inline void attn_prefill_flash(const float* qkv, float* att, int B, int T, int H, int D, float* /*scratch*/,
                               cudaStream_t s)
{
    attn_prefill_flash_causal(qkv, att, B, T, H, D, true, s);
}
