// attn_naive.h - lab 9's attention kernels: causal self-attention with the score
// matrix S in DRAM (chapter 10). Header-only, so that chapter 14's lab and the
// engine can include it unchanged.
//
// Layout (the engine contract, chapter 10 section 3):
//   qkv [B*T, 3C]   row = one token; columns [0, C) = q, [C, 2C) = k, [2C, 3C) = v;
//                   head h occupies columns h*D .. h*D + D - 1 inside each third
//   att [B*T, C]    the heads' outputs side by side, same column order
//   S   [B*H][T][T] scratch: the scores, then (in place) the probabilities P
// Scale 1/sqrt(D); causal mask: query i sees keys 0..i.
//
// Three ways to do the two matmuls, one row softmax in between:
//   v1 naive   attn_scores_naive, attn_pv_naive: one thread per output element
//   v2 tiled   attn_scores_tiled<skip>, attn_pv_tiled<skip>: chapter 7's 16 x 16 shared-memory
//              tiles with the batch index on blockIdx.z; skip = leave out the tiles above the diagonal
//   v3 cuBLAS  attn_scores_cublas, attn_pv_cublas: cublasSgemmStridedBatched, the heads as the batch
//   softmax_warp_online   lab 8's v3 (one warp per row, online (m, d), two passes), in place,
//                         with three ways to treat the masked half (RowMask below)
// Engine-ready: attn_prefill_naive + attn_prefill_naive_scratch_bytes, the contract's signature.
// It is v2 with the skip and the truncated softmax: the same algorithm as the engine's own
// attn_prefill_naive in ../gpt2/attention.cuh (whose kernels are called attn_scores,
// attn_softmax_causal, attn_pv). Do not include both files in one program: they define the
// same entry point.
#pragma once

#include <cfloat>
#include <cmath>
#include "gemm.h"      // check.h, bench.h, cdiv, CUBLAS_CHECK, cublas_handle (lab 6's harness)

constexpr int AT = 16;   // tile edge of the matmul-like kernels (v1's block, v2's tile)

// ---------------------------------------------------------------------------
// v1, scores: one thread per score. grid = (ceil(T/16), ceil(T/16), B*H), block = (16, 16).
// Chapter 7's naive matmul with the batch on blockIdx.z and the mask folded in.
// ---------------------------------------------------------------------------
__global__ void attn_scores_naive(const float* __restrict__ qkv, float* __restrict__ S,
                                  int B, int T, int H, int D, float scale)
{
    int bh = blockIdx.z, b = bh / H, h = bh % H;
    int i = blockIdx.y * 16 + threadIdx.y;            // query row
    int j = blockIdx.x * 16 + threadIdx.x;            // key column
    if (i >= T || j >= T) return;
    int C3 = 3 * H * D;
    float* Srow = S + ((size_t)bh * T + i) * T;
    if (j > i) { Srow[j] = -INFINITY; return; }      // the causal mask
    const float* q = qkv + ((size_t)b * T + i) * C3 + h * D;
    const float* k = qkv + ((size_t)b * T + j) * C3 + H * D + h * D;
    float s = 0.0f;
    for (int d = 0; d < D; ++d) s += q[d] * k[d];
    Srow[j] = s * scale;
}

// ---------------------------------------------------------------------------
// v1, weighted sum: one thread per output element, att[b*T + i][h*D + d] =
// sum over ALL j < T of P[bh][i][j] * v_j[d]. The masked half of the row is
// zeros, and this kernel multiplies them by V anyway (chapter 10 section 6).
// threadIdx.x walks d, so a warp's V loads are contiguous and P[i][j] is a broadcast.
// ---------------------------------------------------------------------------
__global__ void attn_pv_naive(const float* __restrict__ P, const float* __restrict__ qkv,
                              float* __restrict__ att, int B, int T, int H, int D)
{
    int bh = blockIdx.z, b = bh / H, h = bh % H, C = H * D;
    int d = blockIdx.x * 16 + threadIdx.x;
    int i = blockIdx.y * 16 + threadIdx.y;
    if (i >= T || d >= D) return;
    const float* p = P + ((size_t)bh * T + i) * T;
    const float* v = qkv + (size_t)b * T * 3 * C + 2 * C + h * D + d;
    float o = 0.0f;
    for (int j = 0; j < T; ++j) o += p[j] * v[(size_t)j * 3 * C];
    att[((size_t)b * T + i) * C + h * D + d] = o;
}

// ---------------------------------------------------------------------------
// Masked row softmax, in place: one warp per row of S, rows = B*H*T, row r is
// query i = r % T. Lab 8's softmax_warp_online: lane l owns columns l, l+32, ...;
// pass 1 builds the running (max m, sum d) per lane and merges the 32 pairs by
// shuffles, pass 2 writes exp(s - m) / d. Three treatments of the masked half:
//   MASK_NONE       the row is read as it is; entries already -INFINITY (v1 and v2
//                   write them) come out as 0
//   MASK_CAUSAL     entries j > i are treated as -INFINITY whatever they hold and
//                   written as 0 (cuBLAS computed the whole square)
//   MASK_TRUNCATED  only j <= i is read and written; the rest of the row is left
//                   alone, so the next kernel must not read it (v2 with skip)
// A row that is entirely -INFINITY gives zeros, not NaN. That cannot happen under
// the causal mask (the diagonal is always live), and the guard stays anyway.
// ---------------------------------------------------------------------------
enum RowMask { MASK_NONE = 0, MASK_CAUSAL = 1, MASK_TRUNCATED = 2 };

__global__ void softmax_warp_online(float* S, int rows, int T, int mask)
{
    int row = blockIdx.x * (blockDim.x / 32) + threadIdx.x / 32, lane = threadIdx.x % 32;
    if (row >= rows) return;                          // whole warps leave together
    int i = row % T;
    int n = (mask == MASK_TRUNCATED) ? i + 1 : T;     // columns this kernel touches
    float* s = S + (size_t)row * T;
    float m = -INFINITY, d = 0.0f;
    for (int j = lane; j < n; j += 32) {
        float v = (mask == MASK_CAUSAL && j > i) ? -INFINITY : s[j];
        if (v == -INFINITY) continue;                 // adds exp(-inf) = 0; and -inf - (-inf) would be NaN
        float mn = fmaxf(m, v);
        d = d * expf(m - mn) + expf(v - mn);          // rescale, then add the new term
        m = mn;
    }
    for (int o = 16; o > 0; o >>= 1) {                // merge the 32 lanes' pairs
        float m2 = __shfl_xor_sync(0xffffffffu, m, o);
        float d2 = __shfl_xor_sync(0xffffffffu, d, o);
        float mn = fmaxf(m, m2);
        if (mn != -INFINITY) d = d * expf(m - mn) + d2 * expf(m2 - mn);
        m = mn;
    }
    float inv = d > 0.0f ? 1.0f / d : 0.0f;
    for (int j = lane; j < n; j += 32) {
        float v = (mask == MASK_CAUSAL && j > i) ? -INFINITY : s[j];
        s[j] = (m == -INFINITY) ? 0.0f : expf(v - m) * inv;
    }
}

// ---------------------------------------------------------------------------
// v2, scores: S[bh][i][j] = (q_i . k_j) / sqrt(D), one 16 x 16 tile of S per
// block, D walked 16 at a time through shared memory (chapter 7's tiling; the
// +1 column avoids the bank conflicts of reading Ks by column).
//   skip = false: every tile is computed; the store writes -INFINITY where j > i
//   skip = true:  tiles entirely above the diagonal leave at once and nothing is
//                 stored where j > i: pair it with MASK_TRUNCATED and attn_pv_tiled<true>
// ---------------------------------------------------------------------------
template <bool skip>
__global__ void attn_scores_tiled(const float* __restrict__ qkv, float* __restrict__ S,
                                  int T, int H, int D, float scale)
{
    const int bh = blockIdx.z, b = bh / H, h = bh % H, C = H * D;
    const int i0 = blockIdx.y * AT, j0 = blockIdx.x * AT;
    if (skip && j0 > i0 + AT - 1) return;             // fully masked tile: the whole block leaves
    __shared__ float Qs[AT][AT + 1], Ks[AT][AT + 1];
    const int ty = threadIdx.y, tx = threadIdx.x;
    float acc = 0.0f;
    for (int d0 = 0; d0 < D; d0 += AT) {
        int qi = i0 + ty, kj = j0 + ty, d = d0 + tx;  // rows of Q and K, loaded along d (coalesced)
        Qs[ty][tx] = (qi < T && d < D) ? qkv[((size_t)b * T + qi) * 3 * C + h * D + d] : 0.0f;
        Ks[ty][tx] = (kj < T && d < D) ? qkv[((size_t)b * T + kj) * 3 * C + C + h * D + d] : 0.0f;
        __syncthreads();
#pragma unroll
        for (int k = 0; k < AT; ++k) acc += Qs[ty][k] * Ks[tx][k];
        __syncthreads();
    }
    int i = i0 + ty, j = j0 + tx;
    if (i < T && j < T) {
        if (j <= i) S[((size_t)bh * T + i) * T + j] = acc * scale;
        else if (!skip) S[((size_t)bh * T + i) * T + j] = -INFINITY;   // the mask, applied at the store
    }
}

// ---------------------------------------------------------------------------
// v2, weighted sum: att[b*T + i][h*D + d] = sum_j P[bh][i][j] * v_j[d], one
// 16 x 16 output tile (16 queries x 16 of the D columns) per block.
//   skip = false: the loop runs over all T keys (the masked zeros included)
//   skip = true:  it stops at the tile holding the diagonal, and reads P only where j <= i
// ---------------------------------------------------------------------------
template <bool skip>
__global__ void attn_pv_tiled(const float* __restrict__ P, const float* __restrict__ qkv,
                              float* __restrict__ att, int T, int H, int D)
{
    const int bh = blockIdx.z, b = bh / H, h = bh % H, C = H * D;
    const int i0 = blockIdx.y * AT, d0 = blockIdx.x * AT;
    __shared__ float Ps[AT][AT + 1], Vs[AT][AT + 1];
    const int ty = threadIdx.y, tx = threadIdx.x;
    float acc = 0.0f;
    const int jend = skip ? min(T, i0 + AT) : T;      // rows of this tile see keys up to i0 + 15
    for (int j0 = 0; j0 < jend; j0 += AT) {
        int i = i0 + ty, j = j0 + tx;
        bool live = skip ? (i < T && j <= i) : (i < T && j < T);
        Ps[ty][tx] = live ? P[((size_t)bh * T + i) * T + j] : 0.0f;
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

// ---------------------------------------------------------------------------
// v3: cuBLAS, one strided-batched call per sequence b, the H heads as the batch.
// cuBLAS is column-major (lab 6's gemm.h): a row-major [rows, cols] matrix with
// leading dimension ld is, to cuBLAS, a column-major [cols, rows] one with the
// same ld. Head h of sequence b inside qkv is a row-major [T, D] matrix with
// ld = 3C; the next head starts D floats later, which is the batch stride.
//
// Scores. We want row-major S = scale * Q K^T, [T, T] with ld T. cuBLAS writes
// column-major, so ask for S^T = K Q^T: m = n = T (keys, queries), k = D.
//   A = K, seen by cuBLAS as column-major [D, T] -> needs OP_T to become [T, D]
//   B = Q, seen as column-major [D, T]            -> OP_N, it is already Q^T
//   C = S, column-major [T(keys), T(queries)] with ldc T = row-major S[i][j]
// ---------------------------------------------------------------------------
inline void attn_scores_cublas(const float* qkv, float* S, int B, int T, int H, int D, float scale,
                               cudaStream_t s = 0)
{
    const int C = H * D;
    const float zero = 0.0f;
    cublasHandle_t hd = cublas_handle();
    CUBLAS_CHECK(cublasSetStream(hd, s));
    for (int b = 0; b < B; ++b) {
        const float* Q_b = qkv + (size_t)b * T * 3 * C;
        const float* K_b = Q_b + C;
        float* S_b = S + (size_t)b * H * T * T;
        CUBLAS_CHECK(cublasSgemmStridedBatched(hd, CUBLAS_OP_T, CUBLAS_OP_N, T, T, D,
                                               &scale, K_b, 3 * C, D, Q_b, 3 * C, D,
                                               &zero, S_b, T, (long long)T * T, H));
    }
}

// Weighted sum. We want row-major O = P V, [T, D] with ld C (the head's columns
// of att). Ask for O^T = V^T P^T: m = D, n = T (queries), k = T (keys).
//   A = V, seen as column-major [D, T] = V^T     -> OP_N
//   B = P, row-major [T, T] seen as P^T          -> OP_N
//   C = att + h*D, column-major [D, T] with ldc C = row-major O[i][d]
inline void attn_pv_cublas(const float* P, const float* qkv, float* att, int B, int T, int H, int D,
                           cudaStream_t s = 0)
{
    const int C = H * D;
    const float one = 1.0f, zero = 0.0f;
    cublasHandle_t hd = cublas_handle();
    CUBLAS_CHECK(cublasSetStream(hd, s));
    for (int b = 0; b < B; ++b) {
        const float* V_b = qkv + (size_t)b * T * 3 * C + 2 * C;
        const float* P_b = P + (size_t)b * H * T * T;
        float* att_b = att + (size_t)b * T * C;
        CUBLAS_CHECK(cublasSgemmStridedBatched(hd, CUBLAS_OP_N, CUBLAS_OP_N, D, T, T,
                                               &one, V_b, 3 * C, D, P_b, T, (long long)T * T,
                                               &zero, att_b, C, D, H));
    }
}

// ---------------------------------------------------------------------------
// Launchers for the three versions (S is B*H*T*T floats of scratch).
// ---------------------------------------------------------------------------
inline void launch_softmax(float* S, int B, int T, int H, int mask, cudaStream_t s = 0)
{
    int rows = B * H * T;
    softmax_warp_online<<<cdiv(rows, 8), 256, 0, s>>>(S, rows, T, mask);   // 8 warps = 8 rows per block
}

inline void launch_scores_naive(const float* qkv, float* S, int B, int T, int H, int D, cudaStream_t s = 0)
{
    attn_scores_naive<<<dim3(cdiv(T, 16), cdiv(T, 16), B * H), dim3(16, 16), 0, s>>>(
        qkv, S, B, T, H, D, 1.0f / sqrtf((float)D));
}
inline void launch_pv_naive(const float* P, const float* qkv, float* att, int B, int T, int H, int D,
                            cudaStream_t s = 0)
{
    attn_pv_naive<<<dim3(cdiv(D, 16), cdiv(T, 16), B * H), dim3(16, 16), 0, s>>>(P, qkv, att, B, T, H, D);
}

template <bool skip>
inline void launch_scores_tiled(const float* qkv, float* S, int B, int T, int H, int D, cudaStream_t s = 0)
{
    attn_scores_tiled<skip><<<dim3(cdiv(T, AT), cdiv(T, AT), B * H), dim3(AT, AT), 0, s>>>(
        qkv, S, T, H, D, 1.0f / sqrtf((float)D));
}
template <bool skip>
inline void launch_pv_tiled(const float* P, const float* qkv, float* att, int B, int T, int H, int D,
                            cudaStream_t s = 0)
{
    attn_pv_tiled<skip><<<dim3(cdiv(D, AT), cdiv(T, AT), B * H), dim3(AT, AT), 0, s>>>(P, qkv, att, T, H, D);
}

// ---------------------------------------------------------------------------
// Engine-ready (contract of chapter 11): v2 with the tile skip and the
// truncated softmax. scratch holds S: B*H*T*T floats.
// ---------------------------------------------------------------------------
inline size_t attn_prefill_naive_scratch_bytes(int B, int T, int H, int /*D*/)
{
    return (size_t)B * H * T * T * sizeof(float);
}

inline void attn_prefill_naive(const float* qkv, float* att, int B, int T, int H, int D, float* scratch, cudaStream_t s)
{
    launch_scores_tiled<true>(qkv, scratch, B, T, H, D, s);
    launch_softmax(scratch, B, T, H, MASK_TRUNCATED, s);
    launch_pv_tiled<true>(scratch, qkv, att, B, T, H, D, s);
}
