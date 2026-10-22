// attn_naive.h - lab 13: chapter 10's three-kernel attention, for scale.
//
// S = Q K^T / sqrt(D) for the FULL T x T square (the mask is applied by the
// softmax, as lab 9's first versions do), a row softmax in place (S becomes
// P), then O = P V over the full square. S lives in DRAM: B*H*T*T floats.
// Minimal versions written for this lab (lab 9 was not finished when lab 13
// was built): chapter 7's 16 x 16 shared-memory tiles for the two products,
// one warp per row for the softmax. They are the yardstick, not a target.
#pragma once
#include <cmath>
#include <cuda_runtime.h>

constexpr int NV_T = 16;

// S[bh][i][j] = (q_i . k_j) * scale for every (i, j), masked or not.
__global__ void attn_naive_scores(const float* __restrict__ qkv, float* __restrict__ S, int T, int H, int D,
                                  float scale)
{
    const int bh = blockIdx.z, b = bh / H, h = bh % H, C = H * D;
    const int i0 = blockIdx.y * NV_T, j0 = blockIdx.x * NV_T, ty = threadIdx.y, tx = threadIdx.x;
    __shared__ float Qs[NV_T][NV_T + 1], Ks[NV_T][NV_T + 1];
    float acc = 0.0f;
    for (int d0 = 0; d0 < D; d0 += NV_T) {
        const int qi = i0 + ty, kj = j0 + ty, d = d0 + tx;
        Qs[ty][tx] = (qi < T && d < D) ? qkv[((size_t)b * T + qi) * 3 * C + h * D + d] : 0.0f;
        Ks[ty][tx] = (kj < T && d < D) ? qkv[((size_t)b * T + kj) * 3 * C + C + h * D + d] : 0.0f;
        __syncthreads();
#pragma unroll
        for (int k = 0; k < NV_T; ++k) acc += Qs[ty][k] * Ks[tx][k];
        __syncthreads();
    }
    const int i = i0 + ty, j = j0 + tx;
    if (i < T && j < T) S[((size_t)bh * T + i) * T + j] = acc * scale;
}

// Row softmax in place, one warp per row; under causal, entries j > i become 0.
__global__ void attn_naive_softmax(float* __restrict__ S, int rows, int T, bool causal)
{
    const int row = blockIdx.x * (blockDim.x / 32) + threadIdx.x / 32, lane = threadIdx.x % 32;
    if (row >= rows) return;                                  // whole warps leave together
    const int i = row % T, last = causal ? i : T - 1;
    float* s = S + (size_t)row * T;
    float m = -INFINITY;
    for (int j = lane; j <= last; j += 32) m = fmaxf(m, s[j]);
    for (int o = 16; o > 0; o >>= 1) m = fmaxf(m, __shfl_xor_sync(0xffffffffu, m, o));
    float sum = 0.0f;
    for (int j = lane; j <= last; j += 32) sum += expf(s[j] - m);
    for (int o = 16; o > 0; o >>= 1) sum += __shfl_xor_sync(0xffffffffu, sum, o);
    const float inv = 1.0f / sum;
    for (int j = lane; j < T; j += 32) s[j] = (j <= last) ? expf(s[j] - m) * inv : 0.0f;
}

// att[b*T + i][h*D + d] = sum over all j of P[bh][i][j] * v_j[d] (the zeros included).
__global__ void attn_naive_pv(const float* __restrict__ P, const float* __restrict__ qkv, float* __restrict__ att,
                              int T, int H, int D)
{
    const int bh = blockIdx.z, b = bh / H, h = bh % H, C = H * D;
    const int i0 = blockIdx.y * NV_T, d0 = blockIdx.x * NV_T, ty = threadIdx.y, tx = threadIdx.x;
    __shared__ float Ps[NV_T][NV_T + 1], Vs[NV_T][NV_T + 1];
    float acc = 0.0f;
    for (int j0 = 0; j0 < T; j0 += NV_T) {
        const int i = i0 + ty, j = j0 + tx, vj = j0 + ty, d = d0 + tx;
        Ps[ty][tx] = (i < T && j < T) ? P[((size_t)bh * T + i) * T + j] : 0.0f;
        Vs[ty][tx] = (vj < T && d < D) ? qkv[((size_t)b * T + vj) * 3 * C + 2 * C + h * D + d] : 0.0f;
        __syncthreads();
#pragma unroll
        for (int k = 0; k < NV_T; ++k) acc += Ps[ty][k] * Vs[k][tx];
        __syncthreads();
    }
    const int i = i0 + ty, d = d0 + tx;
    if (i < T && d < D) att[((size_t)b * T + i) * C + h * D + d] = acc;
}

inline size_t attn_naive_scratch_bytes(int B, int T, int H, int /*D*/) { return (size_t)B * H * T * T * sizeof(float); }

inline void attn_naive(const float* qkv, float* att, int B, int T, int H, int D, bool causal, float* S,
                       cudaStream_t s = 0)
{
    const float scale = 1.0f / sqrtf((float)D);
    const dim3 blk(NV_T, NV_T);
    const int nt = (T + NV_T - 1) / NV_T, rows = B * H * T;
    attn_naive_scores<<<dim3(nt, nt, B * H), blk, 0, s>>>(qkv, S, T, H, D, scale);
    attn_naive_softmax<<<(rows + 7) / 8, 256, 0, s>>>(S, rows, T, causal);
    attn_naive_pv<<<dim3((D + NV_T - 1) / NV_T, nt, B * H), blk, 0, s>>>(S, qkv, att, T, H, D);
}
