// layernorm.cuh - lab 8's normalization kernels (chapter 9, sections 7 and 8).
//
// y[row, :] = (x - mean) * rstd * gamma + beta, rstd = 1 / sqrt(var + eps), for M rows of C floats.
//
//   layernorm_block2         lab 5's kernel: one block per row, two-pass statistics, three reads
//   layernorm_welford        one warp per row: Welford per lane + Chan across lanes (one read for the
//                            statistics), then a second read for the formula. Any C.
//   layernorm_warp_reg<CM>   one warp per row, the row in registers (CM / 32 per lane): Welford over
//                            the registers, one read, one write. C <= CM.
//   residual_layernorm<CM>   add and norm fused: r = x + y written, n = LN(r) written, row in registers
//   rmsnorm<CM>              y = x * rsqrt(mean(x^2) + eps) * gamma, row in registers
//
// mean_out / rstd_out (may be nullptr) receive each row's statistics, as
// PyTorch's layernorm returns them for the backward pass; numerics.cu reads them.
#pragma once

#include "rowops.h"

// ---------------------------------------------------------------------------
// Lab 5's layernorm, copied: one block of 256 threads per row, a strided slice
// per thread, block_sum for the mean, again for the variance around it, and a
// third read while writing. A 3 KB row stays in L1 between the reads.
// ---------------------------------------------------------------------------
__global__ void layernorm_block2(const float* __restrict__ x, const float* __restrict__ gamma,
                                 const float* __restrict__ beta, float* __restrict__ y, int M, int C,
                                 float* __restrict__ mean_out = nullptr, float* __restrict__ rstd_out = nullptr)
{
    __shared__ float s_warp[ROW_THREADS / 32];
    int row = blockIdx.x;
    if (row >= M) return;                                 // whole block leaves together: safe
    const float* xr = x + (size_t)row * C;
    float s = 0.0f;
    for (int i = threadIdx.x; i < C; i += ROW_THREADS) s += xr[i];
    float mean = block_sum(s, s_warp) / C;
    float q = 0.0f;
    for (int i = threadIdx.x; i < C; i += ROW_THREADS) { float d = xr[i] - mean; q += d * d; }
    float rstd = rsqrtf(block_sum(q, s_warp) / C + LN_EPS);
    for (int i = threadIdx.x; i < C; i += ROW_THREADS)
        y[(size_t)row * C + i] = (xr[i] - mean) * rstd * gamma[i] + beta[i];
    if (threadIdx.x == 0 && mean_out) { mean_out[row] = mean; rstd_out[row] = rstd; }
}

// ---------------------------------------------------------------------------
// Welford, one warp per row (the chapter's section 7 snippet, with chan_merge's
// guard for lanes that saw no element). The statistics take one look at each
// element; the formula reads the row again.
// ---------------------------------------------------------------------------
__global__ void layernorm_welford(const float* __restrict__ x, const float* __restrict__ gamma,
                                  const float* __restrict__ beta, float* __restrict__ y, int M, int C,
                                  float* __restrict__ mean_out = nullptr, float* __restrict__ rstd_out = nullptr)
{
    int row = (blockIdx.x * blockDim.x + threadIdx.x) / 32, lane = threadIdx.x % 32;
    if (row >= M) return;
    const float* xr = x + (size_t)row * C;
    Welford w{0.0f, 0.0f, 0.0f};
    for (int i = lane; i < C; i += 32) welford_push(w, xr[i]);
    warp_welford(w);
    float rstd = rsqrtf(w.M2 / w.n + LN_EPS);
    for (int i = lane; i < C; i += 32)
        y[(size_t)row * C + i] = (xr[i] - w.mean) * rstd * gamma[i] + beta[i];
    if (lane == 0 && mean_out) { mean_out[row] = w.mean; rstd_out[row] = rstd; }
}

// ---------------------------------------------------------------------------
// The row in registers. CM is the capacity (a multiple of 32, a compile-time
// constant so that v[] stays in registers: chapter 8's spills otherwise). Each
// lane holds columns lane, lane + 32, ...; slots past C are skipped.
// ---------------------------------------------------------------------------
template <int CM>
__device__ __forceinline__ Welford welford_regs(const float (&v)[CM / 32], int lane, int C)
{
    Welford w{0.0f, 0.0f, 0.0f};
#pragma unroll
    for (int k = 0; k < CM / 32; ++k) if (lane + 32 * k < C) welford_push(w, v[k]);
    warp_welford(w);
    return w;
}

template <int CM>
__global__ void layernorm_warp_reg(const float* __restrict__ x, const float* __restrict__ gamma,
                                   const float* __restrict__ beta, float* __restrict__ y, int M, int C)
{
    static_assert(CM % 32 == 0, "the register capacity is a multiple of the warp size");
    int row = (blockIdx.x * blockDim.x + threadIdx.x) / 32, lane = threadIdx.x % 32;
    if (row >= M) return;
    const float* xr = x + (size_t)row * C;
    float v[CM / 32];
#pragma unroll
    for (int k = 0; k < CM / 32; ++k) { int i = lane + 32 * k; v[k] = (i < C) ? xr[i] : 0.0f; }   // the one read
    Welford w = welford_regs<CM>(v, lane, C);
    float rstd = rsqrtf(w.M2 / w.n + LN_EPS);
#pragma unroll
    for (int k = 0; k < CM / 32; ++k) {
        int i = lane + 32 * k;
        if (i < C) y[(size_t)row * C + i] = (v[k] - w.mean) * rstd * gamma[i] + beta[i];   // the one write
    }
}

// Add and norm (section 8): r = x + y is the new residual stream (written: the
// next residual add needs it), n = LN(r) feeds the next GEMM. Two inputs read
// once, two outputs written once.
template <int CM>
__global__ void residual_layernorm(const float* __restrict__ x, const float* __restrict__ y,
                                   const float* __restrict__ gamma, const float* __restrict__ beta,
                                   float* __restrict__ r_out, float* __restrict__ n_out, int M, int C)
{
    static_assert(CM % 32 == 0, "the register capacity is a multiple of the warp size");
    int row = (blockIdx.x * blockDim.x + threadIdx.x) / 32, lane = threadIdx.x % 32;
    if (row >= M) return;
    size_t base = (size_t)row * C;
    float v[CM / 32];
#pragma unroll
    for (int k = 0; k < CM / 32; ++k) {
        int i = lane + 32 * k;
        if (i < C) { v[k] = x[base + i] + y[base + i]; r_out[base + i] = v[k]; } else v[k] = 0.0f;
    }
    Welford w = welford_regs<CM>(v, lane, C);
    float rstd = rsqrtf(w.M2 / w.n + LN_EPS);
#pragma unroll
    for (int k = 0; k < CM / 32; ++k) {
        int i = lane + 32 * k;
        if (i < C) n_out[base + i] = (v[k] - w.mean) * rstd * gamma[i] + beta[i];
    }
}

// RMSNorm (Zhang and Sennrich 2019): no mean, no beta. One sum, one reduction.
template <int CM>
__global__ void rmsnorm(const float* __restrict__ x, const float* __restrict__ gamma,
                        float* __restrict__ y, int M, int C)
{
    static_assert(CM % 32 == 0, "the register capacity is a multiple of the warp size");
    int row = (blockIdx.x * blockDim.x + threadIdx.x) / 32, lane = threadIdx.x % 32;
    if (row >= M) return;
    const float* xr = x + (size_t)row * C;
    float v[CM / 32], ss = 0.0f;
#pragma unroll
    for (int k = 0; k < CM / 32; ++k) { int i = lane + 32 * k; v[k] = (i < C) ? xr[i] : 0.0f; ss += v[k] * v[k]; }
    float r = rsqrtf(warp_sum(ss) / C + LN_EPS);
#pragma unroll
    for (int k = 0; k < CM / 32; ++k) {
        int i = lane + 32 * k;
        if (i < C) y[(size_t)row * C + i] = v[k] * r * gamma[i];
    }
}
