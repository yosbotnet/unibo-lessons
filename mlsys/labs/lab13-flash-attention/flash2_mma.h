// flash2_mma.h - lab 13: FlashAttention-2 on the tensor cores (chapter 14, sections 5-8).
//
// FP16 Q, K, V read from a [B*T, 3C] half buffer in the engine's column layout,
// FP32 accumulation everywhere, O written as FP16 into [B*T, C], plus the
// per-row log-sum-exp L = m + log2(l) (log2 units, because the scores are
// scaled by log2(e) so that the kernel can use exp2f) into lse[B*H*T].
//
// Br = Bc = D = 64, 128 threads = 4 warps; warp w owns query rows 16w .. 16w+15
// of the block. grid (ceil(T/64), B*H). Shared memory: Q tile plus two
// buffers of K and V (cp.async double buffering), rows padded 64 -> 72 halves
// so that the eight row addresses of an ldmatrix block hit different banks:
// (64 + 2*64 + 2*64) * 72 * 2 bytes = 46,080 bytes, static.
#pragma once
#include <cmath>
#include <cuda_runtime.h>
#include <cuda_fp16.h>
#include <cuda_pipeline.h>
#include "ptx.h"

constexpr int F2_BR = 64, F2_BC = 64, F2_D = 64, F2_PAD = 72, F2_THREADS = 128;

// Copy 64 rows x 64 halves (row r = token row0 + r) into a [64][72] tile:
// 64 x 8 chunks of 16 bytes = 512 chunks, 4 per thread, with cp.async.
// Rows at or beyond T are zero-filled with plain stores, never copied.
__device__ __forceinline__ void load_tile_async(__half (*dst)[F2_PAD], const __half* src, int row0, int T,
                                                int ld, int tid)
{
#pragma unroll
    for (int c = 0; c < (F2_BR * F2_D / 8) / F2_THREADS; ++c) {
        const int chunk = tid + c * F2_THREADS, r = chunk / 8, col = (chunk % 8) * 8;
        if (row0 + r < T)
            __pipeline_memcpy_async(&dst[r][col], src + (size_t)(row0 + r) * ld + col, 16);
        else
            *reinterpret_cast<float4*>(&dst[r][col]) = make_float4(0.f, 0.f, 0.f, 0.f);
    }
}

// s *= scale_log2; keys >= T always masked; under causal, key > row masked
// (only the diagonal tile can have such keys, because the loop stops there).
__device__ __forceinline__ void scale_and_mask(float s[8][4], int j, int row_g, int t, int T, bool causal,
                                               float scale_log2)
{
#pragma unroll
    for (int n = 0; n < 8; ++n)
#pragma unroll
        for (int e = 0; e < 4; ++e) {
            const int row = row_g + (e >> 1) * 8;               // c0, c1: row g; c2, c3: row g + 8
            const int key = j * F2_BC + n * 8 + 2 * t + (e & 1);
            s[n][e] *= scale_log2;
            if (key >= T || (causal && key > row)) s[n][e] = -INFINITY;
        }
}

__global__ void __launch_bounds__(F2_THREADS)
flash2_mma_kernel(const __half* __restrict__ qkv, __half* __restrict__ out, float* __restrict__ lse,
                  int B, int T, int H, bool causal)
{
    __shared__ __align__(16) __half Qs[64][72];
    __shared__ __align__(16) __half Ks[2][64][72];
    __shared__ __align__(16) __half Vs[2][64][72];
    const int tid = threadIdx.x;
    const int qblk = gridDim.x - 1 - blockIdx.x;                // Q block, reversed: the longest causal blocks launch first (FA2)
    const int qrow0 = qblk * 64, bh = blockIdx.y, warp = tid / 32, lane = tid % 32;
    const int g = lane / 4, t = lane % 4;
    const int b = bh / H, h = bh % H, C = H * F2_D, ld = 3 * C;
    const int all_tiles = (T + 63) / 64;
    const int n_tiles = causal ? min(all_tiles, qblk + 1) : all_tiles;              // up to the diagonal tile
    const float scale_log2 = 0.18033688f;                     // (1 / sqrt(64)) * log2(e)
    const unsigned FULL = 0xffffffffu;

    const __half* q = qkv + (size_t)b * T * ld + h * F2_D;      // token rows of this sequence, head h
    const __half* k = q + C;
    const __half* v = q + 2 * C;

    load_tile_async(Qs, q, qrow0, T, ld, tid);
    load_tile_async(Ks[0], k, 0, T, ld, tid);
    load_tile_async(Vs[0], v, 0, T, ld, tid);
    __pipeline_commit();
    __pipeline_wait_prior(0);
    __syncthreads();
    uint32_t qa[4][4];                                         // 4 k-steps x one A fragment, kept for the whole loop
#pragma unroll
    for (int ks = 0; ks < 4; ++ks) ldmatrix_x4(qa[ks], &Qs[warp * 16 + (lane % 16)][ks * 16 + (lane / 16) * 8]);

    float o[8][4];                                             // O~: 16 rows x 64 dims per warp
#pragma unroll
    for (int n = 0; n < 8; ++n) o[n][0] = o[n][1] = o[n][2] = o[n][3] = 0.0f;
    float m[2] = {-INFINITY, -INFINITY}, l[2] = {0.0f, 0.0f};  // rows g and g + 8
    const int row_g = qrow0 + warp * 16 + g;                   // global query row of c0, c1

    for (int j = 0; j < n_tiles; ++j) {
        if (j + 1 < n_tiles) {
            load_tile_async(Ks[(j + 1) & 1], k, (j + 1) * 64, T, ld, tid);
            load_tile_async(Vs[(j + 1) & 1], v, (j + 1) * 64, T, ld, tid);
        }
        __pipeline_commit();                                   // (an empty batch on the last tile keeps the count simple)
        __pipeline_wait_prior(1);                              // my copies of tile j are done...
        __syncthreads();                                       // ...and everyone else's
        float s[8][4];
#pragma unroll
        for (int n = 0; n < 8; ++n) s[n][0] = s[n][1] = s[n][2] = s[n][3] = 0.0f;
#pragma unroll
        for (int ks = 0; ks < 4; ++ks)                         // S~ = Q K^T: 8 n-tiles x 4 k-steps = 32 MMAs
#pragma unroll
            for (int n = 0; n < 8; n += 2) {
                uint32_t kb[4];                                // B fragments of n-tiles n and n+1 at k-step ks
                ldmatrix_x4(kb, &Ks[j & 1][n * 8 + (lane % 8) + (lane / 16) * 8][ks * 16 + ((lane / 8) % 2) * 8]);
                mma_16816(s[n], qa[ks], kb);                   // kb[0], kb[1]
                mma_16816(s[n + 1], qa[ks], kb + 2);           // kb[2], kb[3]
            }
        scale_and_mask(s, j, row_g, t, T, causal, scale_log2);
        // row max over this lane's 16 values per row, then across the quad
        float mx[2] = {m[0], m[1]};
#pragma unroll
        for (int n = 0; n < 8; ++n) {
            mx[0] = fmaxf(mx[0], fmaxf(s[n][0], s[n][1]));
            mx[1] = fmaxf(mx[1], fmaxf(s[n][2], s[n][3]));
        }
#pragma unroll
        for (int r = 0; r < 2; ++r) {
            mx[r] = fmaxf(mx[r], __shfl_xor_sync(FULL, mx[r], 1));
            mx[r] = fmaxf(mx[r], __shfl_xor_sync(FULL, mx[r], 2));
        }
        float mu[2];                                           // guard: a row with nothing visible yet (cannot
#pragma unroll                                                 // happen under the loop bounds, kept for safety)
        for (int r = 0; r < 2; ++r) mu[r] = (mx[r] == -INFINITY) ? 0.0f : mx[r];
        float alpha[2] = {exp2f(m[0] - mu[0]), exp2f(m[1] - mu[1])};
        float rs[2] = {0.0f, 0.0f};
#pragma unroll
        for (int n = 0; n < 8; ++n) {
            s[n][0] = exp2f(s[n][0] - mu[0]);  s[n][1] = exp2f(s[n][1] - mu[0]);
            s[n][2] = exp2f(s[n][2] - mu[1]);  s[n][3] = exp2f(s[n][3] - mu[1]);
            rs[0] += s[n][0] + s[n][1];  rs[1] += s[n][2] + s[n][3];
        }
#pragma unroll
        for (int r = 0; r < 2; ++r) {
            rs[r] += __shfl_xor_sync(FULL, rs[r], 1);
            rs[r] += __shfl_xor_sync(FULL, rs[r], 2);
        }
#pragma unroll
        for (int r = 0; r < 2; ++r) { l[r] = alpha[r] * l[r] + rs[r]; m[r] = mx[r]; }
#pragma unroll
        for (int n = 0; n < 8; ++n) { o[n][0] *= alpha[0]; o[n][1] *= alpha[0]; o[n][2] *= alpha[1]; o[n][3] *= alpha[1]; }
#pragma unroll
        for (int ks = 0; ks < 4; ++ks) {                       // O~ += P~ V: 4 k-steps (16 keys) x 8 n-tiles (8 dims)
            uint32_t pa[4] = { pack_half2(s[2 * ks][0], s[2 * ks][1]), pack_half2(s[2 * ks][2], s[2 * ks][3]),
                               pack_half2(s[2 * ks + 1][0], s[2 * ks + 1][1]), pack_half2(s[2 * ks + 1][2], s[2 * ks + 1][3]) };
#pragma unroll
            for (int n = 0; n < 8; n += 2) {
                uint32_t vb[4];                                // B fragments of dims n*8.. and (n+1)*8.. for keys ks*16..
                ldmatrix_x4_trans(vb, &Vs[j & 1][ks * 16 + (lane % 8) + ((lane / 8) % 2) * 8][n * 8 + (lane / 16) * 8]);
                mma_16816(o[n], pa, vb);  mma_16816(o[n + 1], pa, vb + 2);
            }
        }
        __syncthreads();                                       // nobody still reads buffer j&1: iteration j+1 may refill it
    }
    // epilogue: O = O~ / l, written as FP16; L = m + log2(l) in log2 units, one per row
    const float inv0 = 1.0f / l[0], inv1 = 1.0f / l[1];
    const int row_h = row_g + 8;
#pragma unroll
    for (int n = 0; n < 8; ++n) {
        const int d = n * 8 + 2 * t;
        if (row_g < T)
            *reinterpret_cast<__half2*>(out + ((size_t)b * T + row_g) * C + h * F2_D + d) =
                __floats2half2_rn(o[n][0] * inv0, o[n][1] * inv0);
        if (row_h < T)
            *reinterpret_cast<__half2*>(out + ((size_t)b * T + row_h) * C + h * F2_D + d) =
                __floats2half2_rn(o[n][2] * inv1, o[n][3] * inv1);
    }
    if (t == 0) {
        if (row_g < T) lse[(size_t)bh * T + row_g] = m[0] + log2f(l[0]);
        if (row_h < T) lse[(size_t)bh * T + row_h] = m[1] + log2f(l[1]);
    }
}

inline void flash2_mma(const __half* qkv, __half* out, float* lse, int B, int T, int H, bool causal,
                       cudaStream_t s = 0)
{
    dim3 grid((T + 63) / 64, B * H);
    flash2_mma_kernel<<<grid, F2_THREADS, 0, s>>>(qkv, out, lse, B, T, H, causal);
}
