// sgemm_v7_epi.h - lab 7's v7 (warp-tiled FP32 SGEMM, chapter 8) with an epilogue.
//
// The kernel is lab 7's sgemm_warptile copied unchanged (lab 7 itself is not
// modified), except for the last loop: instead of store4, every finished
// accumulator goes through epi(acc, r, c) on its way to memory. EPI is a
// template parameter, so the call is inlined: the bias add, GELU or residual
// add happens in registers, and the [M, N] output is written exactly once.
//
//   EpiNone        C = A B                          (plain v7)
//   EpiBiasGelu    C = gelu(A B + bias)             MLP up projection (chapter 9, section 8)
//   EpiBiasResid   C = A B + bias + res             MLP down projection with the residual add
#pragma once

#include "rowops.h"

struct EpiNone      { __device__ float operator()(float acc, int, int) const { return acc; } };
struct EpiBiasGelu  { const float* bias; __device__ float operator()(float acc, int r, int c) const { return gelu(acc + bias[c]); } };
struct EpiBiasResid { const float* bias; const float* res; int N;
                      __device__ float operator()(float acc, int r, int c) const { return acc + bias[c] + res[(size_t)r * N + c]; } };

// Lab 7's tile loaders (v6 / v7), copied. The A tile is stored transposed.
template <int BM, int BK, int NT, bool VEC>
__device__ __forceinline__ void load_A_transposed(const float* __restrict__ A, float (*As)[BM],
                                                  int row0, int k0, int M, int K, int tid)
{
    constexpr int GROUPS = BM * BK / 4;                 // groups of 4 consecutive k in one row
    for (int g = tid; g < GROUPS; g += NT) {
        int r = g / (BK / 4), c = (g % (BK / 4)) * 4;
        int gr = row0 + r, gk = k0 + c;
        float v[4];
        if (VEC && gr < M && gk + 3 < K) {
            float4 t = *reinterpret_cast<const float4*>(&A[(size_t)gr * K + gk]);
            v[0] = t.x; v[1] = t.y; v[2] = t.z; v[3] = t.w;
        } else {
#pragma unroll
            for (int q = 0; q < 4; ++q) v[q] = (gr < M && gk + q < K) ? A[(size_t)gr * K + gk + q] : 0.0f;
        }
#pragma unroll
        for (int q = 0; q < 4; ++q) As[c + q][r] = v[q];
    }
}

template <int BN, int BK, int NT, bool VEC>
__device__ __forceinline__ void load_B(const float* __restrict__ B, float (*Bs)[BN],
                                       int k0, int col0, int N, int K, int tid)
{
    constexpr int GROUPS = BK * BN / 4;
    for (int g = tid; g < GROUPS; g += NT) {
        int r = g / (BN / 4), c = (g % (BN / 4)) * 4;
        int gk = k0 + r, gc = col0 + c;
        if (VEC && gk < K && gc + 3 < N) {
            *reinterpret_cast<float4*>(&Bs[r][c]) = *reinterpret_cast<const float4*>(&B[(size_t)gk * N + gc]);
        } else {
#pragma unroll
            for (int q = 0; q < 4; ++q) Bs[r][c + q] = (gk < K && gc + q < N) ? B[(size_t)gk * N + gc + q] : 0.0f;
        }
    }
}

// store4 with the epilogue: 4 consecutive outputs of row r, columns c .. c + 3.
// The VEC branch is the chapter's snippet: epi on each accumulator, one 16-byte store.
template <bool VEC, class EPI>
__device__ __forceinline__ void store4_epi(float* __restrict__ C, int r, int c, int M, int N, const float* acc, const EPI& epi)
{
    if (r >= M) return;
    if (VEC && c + 3 < N) {
        float4 o;
        o.x = epi(acc[0], r, c + 0);  o.y = epi(acc[1], r, c + 1);
        o.z = epi(acc[2], r, c + 2);  o.w = epi(acc[3], r, c + 3);
        *reinterpret_cast<float4*>(&C[(size_t)r * N + c]) = o;
    } else {
#pragma unroll
        for (int q = 0; q < 4; ++q)
            if (c + q < N) C[(size_t)r * N + c + q] = epi(acc[q], r, c + q);
    }
}

// v7, BM = BN = 128, BK = 16, WM = WN = 64, WNITER = 4, TM = 8, TN = 4 in the
// launcher below: 128 threads, 8 x 16 accumulators per thread (chapter 8, section 5).
template <int BM, int BN, int BK, int WM, int WN, int WNITER, int TM, int TN, bool VEC, class EPI>
__global__ void __launch_bounds__((BM / WM) * (BN / WN) * 32)
sgemm_warptile_epi(const float* __restrict__ A, const float* __restrict__ B, float* __restrict__ C,
                   int M, int N, int K, EPI epi)
{
    constexpr int NT = (BM / WM) * (BN / WN) * 32;
    constexpr int WMITER = (WM * WN) / (32 * TM * TN * WNITER);   // row strips per warp tile
    constexpr int WSUBM = WM / WMITER, WSUBN = WN / WNITER;
    static_assert(WMITER >= 1 && WMITER * 32 * TM * TN * WNITER == WM * WN, "warp tile must be covered exactly");
    static_assert((WSUBN / TN) * (WSUBM / TM) == 32, "a sub-tile is covered by the 32 lanes");
    static_assert(TM % 4 == 0 && TN % 4 == 0, "register tiles are read 4 floats at a time");
    __shared__ __align__(16) float As[BK][BM];
    __shared__ __align__(16) float Bs[BK][BN];

    const int tid = threadIdx.x, lane = tid % 32, warp = tid / 32;
    const int warpRow = warp / (BN / WN), warpCol = warp % (BN / WN);
    const int tColInWarp = lane % (WSUBN / TN), tRowInWarp = lane / (WSUBN / TN);
    const int row0 = blockIdx.y * BM, col0 = blockIdx.x * BN;

    float acc[WMITER * TM][WNITER * TN] = {};
    float regM[WMITER * TM], regN[WNITER * TN];
    for (int k0 = 0; k0 < K; k0 += BK) {
        load_A_transposed<BM, BK, NT, VEC>(A, As, row0, k0, M, K, tid);
        load_B<BN, BK, NT, VEC>(B, Bs, k0, col0, N, K, tid);
        __syncthreads();
#pragma unroll
        for (int k = 0; k < BK; ++k) {
#pragma unroll
            for (int ws = 0; ws < WMITER; ++ws)
#pragma unroll
                for (int i = 0; i < TM; i += 4)
                    *reinterpret_cast<float4*>(&regM[ws * TM + i]) = *reinterpret_cast<const float4*>(
                        &As[k][warpRow * WM + ws * WSUBM + tRowInWarp * TM + i]);
#pragma unroll
            for (int ws = 0; ws < WNITER; ++ws)
#pragma unroll
                for (int j = 0; j < TN; j += 4)
                    *reinterpret_cast<float4*>(&regN[ws * TN + j]) = *reinterpret_cast<const float4*>(
                        &Bs[k][warpCol * WN + ws * WSUBN + tColInWarp * TN + j]);
#pragma unroll
            for (int i = 0; i < WMITER * TM; ++i)
#pragma unroll
                for (int j = 0; j < WNITER * TN; ++j) acc[i][j] += regM[i] * regN[j];
        }
        __syncthreads();
    }
    // The epilogue: the only part that differs from lab 7.
#pragma unroll
    for (int ws = 0; ws < WMITER; ++ws)
#pragma unroll
        for (int i = 0; i < TM; ++i)
#pragma unroll
            for (int wn = 0; wn < WNITER; ++wn)
#pragma unroll
                for (int j = 0; j < TN; j += 4) {
                    int r = row0 + warpRow * WM + ws * WSUBM + tRowInWarp * TM + i;
                    int c = col0 + warpCol * WN + wn * WSUBN + tColInWarp * TN + j;
                    store4_epi<VEC>(C, r, c, M, N, &acc[ws * TM + i][wn * TN + j], epi);
                }
}

inline unsigned cdiv_u(int a, int b) { return (unsigned)((a + b - 1) / b); }

// The launcher: lab 7's v7 configuration, 16-byte paths when K and N are multiples of 4.
template <class EPI>
inline void sgemm_v7(const float* A, const float* B, float* C, int M, int N, int K, EPI epi)
{
    dim3 grid(cdiv_u(N, 128), cdiv_u(M, 128));
    if (N % 4 == 0 && K % 4 == 0) sgemm_warptile_epi<128, 128, 16, 64, 64, 4, 8, 4, true, EPI><<<grid, 128>>>(A, B, C, M, N, K, epi);
    else                          sgemm_warptile_epi<128, 128, 16, 64, 64, 4, 8, 4, false, EPI><<<grid, 128>>>(A, B, C, M, N, K, epi);
}
