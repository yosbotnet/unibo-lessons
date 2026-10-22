// kernels.cuh - every kernel of the forward pass except attention and sampling.
//
//   embed                 x[row] = wte[token] + wpe[position]            (a gather: chapter 6)
//   layernorm             lab 5's kernel: one block per row, two passes over the row
//   add_bias, bias_gelu, add_bias_residual                         elementwise, fused where it is free
//   gather_last_rows      the last token of each sequence, for the LM head during generation
//   linear(...)           y = x W + b with an epilogue (none, GELU, residual), on one of two backends:
//                           cublas: cuBLAS SGEMM, then one fused elementwise kernel for the epilogue
//                           own:    lab 7's v7 warp-tiled SGEMM with the epilogue fused into its
//                                   stores, or a GEMV-style kernel when M is small (decode)
//
// Everything is FP32, row-major, one row per token (chapter 6).
#pragma once

#include <cmath>
#include "gemm.h"      // check.h, bench.h, cdiv, cublas_handle (lab 6 and 7's harness)

constexpr float LN_EPS = 1e-5f;
constexpr int EW_THREADS = 256;
static unsigned ew_blocks(size_t n) { return (unsigned)((n + EW_THREADS - 1) / EW_THREADS); }

// GPT-2's GELU, the tanh approximation (chapter 6, lab 5).
__device__ __forceinline__ float gelu_tanh(float x)
{
    const float k = 0.7978845608f;                        // sqrt(2 / pi)
    return 0.5f * x * (1.0f + tanhf(k * (x + 0.044715f * x * x * x)));
}

// ---------------------------------------------------------------------------
// Embedding: one block per token row. tokens[r] picks a row of wte, the row's
// position (pos0 + r % T) picks a row of wpe. Both rows are contiguous, so the
// block's loads are coalesced even though the rows are scattered in the table.
// ---------------------------------------------------------------------------
__global__ void embed(const int* __restrict__ tokens, const float* __restrict__ wte,
                      const float* __restrict__ wpe, float* __restrict__ x, int T, int pos0, int C)
{
    int r = blockIdx.x;
    const float* te = wte + (size_t)tokens[r] * C;
    const float* pe = wpe + (size_t)(pos0 + r % T) * C;
    for (int i = threadIdx.x; i < C; i += blockDim.x) x[(size_t)r * C + i] = te[i] + pe[i];
}

// ---------------------------------------------------------------------------
// Layernorm, lab 5's kernel unchanged: 256 threads per row, mean, then the
// variance around the mean, then the output. Chapter 9's lab has the faster
// one-read versions; this one is simple and exact.
// ---------------------------------------------------------------------------
constexpr int LN_THREADS = 256;

__device__ float block_sum(float v, float* s_warp)       // s_warp: LN_THREADS / 32 floats of shared memory
{
    for (int o = 16; o > 0; o >>= 1) v += __shfl_xor_sync(0xffffffffu, v, o);
    int warp = threadIdx.x / 32, lane = threadIdx.x % 32;
    if (lane == 0) s_warp[warp] = v;
    __syncthreads();
    float t = (lane < LN_THREADS / 32) ? s_warp[lane] : 0.0f;
    for (int o = 16; o > 0; o >>= 1) t += __shfl_xor_sync(0xffffffffu, t, o);
    __syncthreads();
    return t;
}

__global__ void layernorm(const float* __restrict__ x, const float* __restrict__ gamma,
                          const float* __restrict__ beta, float* __restrict__ y, int n)
{
    __shared__ float s_warp[LN_THREADS / 32];
    const float* xr = x + (size_t)blockIdx.x * n;
    float s = 0.0f;
    for (int i = threadIdx.x; i < n; i += LN_THREADS) s += xr[i];
    float mean = block_sum(s, s_warp) / n;
    float q = 0.0f;
    for (int i = threadIdx.x; i < n; i += LN_THREADS) { float d = xr[i] - mean; q += d * d; }
    float rstd = rsqrtf(block_sum(q, s_warp) / n + LN_EPS);
    for (int i = threadIdx.x; i < n; i += LN_THREADS)
        y[(size_t)blockIdx.x * n + i] = (xr[i] - mean) * rstd * gamma[i] + beta[i];
}

// ---------------------------------------------------------------------------
// Elementwise epilogues for the cuBLAS backend. cuBLAS writes x W; these add
// the bias and whatever comes after it, in one read and one write.
// For the residual, cuBLAS already did out = x W + 1 * out (beta = 1), so only
// the bias is left: the residual add cost nothing.
// ---------------------------------------------------------------------------
__global__ void add_bias(float* __restrict__ y, const float* __restrict__ b, int M, int N)
{
    size_t i = (size_t)blockIdx.x * EW_THREADS + threadIdx.x;
    if (i < (size_t)M * N) y[i] += b[i % N];
}

__global__ void bias_gelu(float* __restrict__ y, const float* __restrict__ b, int M, int N)
{
    size_t i = (size_t)blockIdx.x * EW_THREADS + threadIdx.x;
    if (i < (size_t)M * N) y[i] = gelu_tanh(y[i] + b[i % N]);
}

// Copy row (b * T + T - 1) of x to row b of y: the last token of each sequence.
__global__ void gather_last_rows(const float* __restrict__ x, float* __restrict__ y, int T, int C)
{
    int b = blockIdx.x;
    const float* src = x + ((size_t)b * T + T - 1) * C;
    for (int i = threadIdx.x; i < C; i += blockDim.x) y[(size_t)b * C + i] = src[i];
}

// ---------------------------------------------------------------------------
// The own backend. What happens after the multiply is a template parameter,
// so it is fused into the kernel's stores: chapter 9's epilogue fusion.
// ---------------------------------------------------------------------------
enum Epi { EPI_NONE, EPI_BIAS, EPI_BIAS_GELU, EPI_BIAS_RESIDUAL };

template <int EPI>
__device__ __forceinline__ float epilogue(float acc, const float* __restrict__ bias, const float* out_old, int c)
{
    if (EPI == EPI_NONE) return acc;
    float v = acc + bias[c];
    if (EPI == EPI_BIAS_GELU) v = gelu_tanh(v);
    if (EPI == EPI_BIAS_RESIDUAL) v += *out_old;           // out = out + (x W + b)
    return v;
}

// Lab 7's tile loaders (v6 / v7): the A tile stored transposed, groups of 4.
template <int BM, int BK, int NT, bool VEC>
__device__ __forceinline__ void load_A_transposed(const float* __restrict__ A, float (*As)[BM],
                                                  int row0, int k0, int M, int K, int tid)
{
    constexpr int GROUPS = BM * BK / 4;
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

// Lab 7's v7 (BM = BN = 128, BK = 16, 64 x 64 warp tiles, 8 x 16 outputs per
// thread), with the epilogue applied to each output before it is stored.
template <int EPI, bool VEC>
__global__ void __launch_bounds__(128)
sgemm_epi(const float* __restrict__ A, const float* __restrict__ B, float* C,
          const float* __restrict__ bias, int M, int N, int K)
{
    constexpr int BM = 128, BN = 128, BK = 16, WM = 64, WN = 64, WNITER = 4, TM = 8, TN = 4;
    constexpr int NT = 128;
    constexpr int WMITER = (WM * WN) / (32 * TM * TN * WNITER);
    constexpr int WSUBM = WM / WMITER, WSUBN = WN / WNITER;
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
#pragma unroll
    for (int ws = 0; ws < WMITER; ++ws)
#pragma unroll
        for (int i = 0; i < TM; ++i)
#pragma unroll
            for (int wn = 0; wn < WNITER; ++wn)
#pragma unroll
                for (int j = 0; j < TN; ++j) {
                    int r = row0 + warpRow * WM + ws * WSUBM + tRowInWarp * TM + i;
                    int c = col0 + warpCol * WN + wn * WSUBN + tColInWarp * TN + j;
                    if (r < M && c < N) {
                        float* o = &C[(size_t)r * N + c];
                        *o = epilogue<EPI>(acc[ws * TM + i][wn * TN + j], bias, o, c);
                    }
                }
}

// ---------------------------------------------------------------------------
// Small M (decode: M = number of sequences, 1 to 8). A 128 x 128 tile would
// leave 127 of its 128 rows empty, and N / 128 blocks (6 for N = 768) cannot
// keep 48 SMs busy. Here every output column is one lane and a block of 8
// warps covers 32 columns, the warps splitting K among themselves; each lane
// keeps one accumulator per row. A warp's load of W[k][n0 .. n0 + 31] is one
// coalesced 128-byte line, and W is read exactly once, which is all decode
// asks for: it is memory-bound (chapters 4 and 13).
// ---------------------------------------------------------------------------
constexpr int GEMV_MAXM = 8;

template <int EPI>
__global__ void __launch_bounds__(256)
gemv_epi(const float* __restrict__ A, const float* __restrict__ W, float* C,
         const float* __restrict__ bias, int M, int N, int K)
{
    __shared__ float part[8][GEMV_MAXM][32];
    const int lane = threadIdx.x % 32, warp = threadIdx.x / 32;
    const int n = blockIdx.x * 32 + lane;
    const int kper = (K + 7) / 8, k0 = warp * kper, k1 = min(K, k0 + kper);
    float acc[GEMV_MAXM] = {};
    if (n < N) {
#pragma unroll 4
        for (int k = k0; k < k1; ++k) {
            float w = W[(size_t)k * N + n];
#pragma unroll
            for (int m = 0; m < GEMV_MAXM; ++m)
                if (m < M) acc[m] += A[(size_t)m * K + k] * w;    // A[m][k]: the same address in every lane
        }
    }
#pragma unroll
    for (int m = 0; m < GEMV_MAXM; ++m) part[warp][m][lane] = acc[m];
    __syncthreads();
    // 256 threads, M x 32 outputs: thread t finishes output (m = t / 32, lane)
    for (int m = warp; m < M; m += 8) {
        float s = 0.0f;
#pragma unroll
        for (int w = 0; w < 8; ++w) s += part[w][m][lane];
        if (n < N) {
            float* o = &C[(size_t)m * N + n];
            *o = epilogue<EPI>(s, bias, o, n);
        }
    }
}

// ---------------------------------------------------------------------------
// One entry point for every linear layer of the model.
//   out[M, N] = epilogue(x[M, K] @ W[K, N] + b)      W row-major [K, N]
// EPI_BIAS_RESIDUAL means out = out + (x W + b): out holds the residual
// stream and is updated in place (x must not alias out).
// ---------------------------------------------------------------------------
enum class Backend { cublas, own };

inline void linear(Backend be, int epi, const float* x, const float* W, const float* b, float* out,
                   int M, int N, int K, cudaStream_t s = nullptr)
{
    if (be == Backend::cublas) {
        const float one = 1.0f, zero = 0.0f;
        const float* beta = (epi == EPI_BIAS_RESIDUAL) ? &one : &zero;
        CUBLAS_CHECK(cublasSetStream(cublas_handle(), s));
        // row-major trick (lab 6): ask cuBLAS for out^T = W^T x^T
        CUBLAS_CHECK(cublasSgemm(cublas_handle(), CUBLAS_OP_N, CUBLAS_OP_N, N, M, K,
                                 &one, W, N, x, K, beta, out, N));
        if (epi == EPI_BIAS || epi == EPI_BIAS_RESIDUAL)
            add_bias<<<ew_blocks((size_t)M * N), EW_THREADS, 0, s>>>(out, b, M, N);
        else if (epi == EPI_BIAS_GELU)
            bias_gelu<<<ew_blocks((size_t)M * N), EW_THREADS, 0, s>>>(out, b, M, N);
        return;
    }
    if (M <= GEMV_MAXM) {
        dim3 g(cdiv(N, 32));
        switch (epi) {
        case EPI_NONE:          gemv_epi<EPI_NONE><<<g, 256, 0, s>>>(x, W, out, b, M, N, K); break;
        case EPI_BIAS:          gemv_epi<EPI_BIAS><<<g, 256, 0, s>>>(x, W, out, b, M, N, K); break;
        case EPI_BIAS_GELU:     gemv_epi<EPI_BIAS_GELU><<<g, 256, 0, s>>>(x, W, out, b, M, N, K); break;
        case EPI_BIAS_RESIDUAL: gemv_epi<EPI_BIAS_RESIDUAL><<<g, 256, 0, s>>>(x, W, out, b, M, N, K); break;
        }
        return;
    }
    dim3 g(cdiv(N, 128), cdiv(M, 128));
    bool vec = N % 4 == 0 && K % 4 == 0;
#define SGEMM_EPI(E) (vec ? sgemm_epi<E, true><<<g, 128, 0, s>>>(x, W, out, b, M, N, K) \
                          : sgemm_epi<E, false><<<g, 128, 0, s>>>(x, W, out, b, M, N, K))
    switch (epi) {
    case EPI_NONE:          SGEMM_EPI(EPI_NONE); break;
    case EPI_BIAS:          SGEMM_EPI(EPI_BIAS); break;
    case EPI_BIAS_GELU:     SGEMM_EPI(EPI_BIAS_GELU); break;
    case EPI_BIAS_RESIDUAL: SGEMM_EPI(EPI_BIAS_RESIDUAL); break;
    }
#undef SGEMM_EPI
}

// The LM head: logits[M, V] = x[M, C] @ wte^T, the embedding table reused
// (tied weights). wte is [V, C], so this is the one matmul with a transposed
// operand. cuBLAS takes the transpose as a flag; the own backend multiplies by
// a transposed copy wteT [C, V] made once at load time (154 MB for GPT-2 small:
// the price of not writing a second kernel layout).
inline void lm_head(Backend be, const float* x, const float* wte, const float* wteT, float* logits,
                    int M, int V, int C, cudaStream_t s = nullptr)
{
    if (be == Backend::cublas) {
        const float one = 1.0f, zero = 0.0f;
        CUBLAS_CHECK(cublasSetStream(cublas_handle(), s));
        // column-major view: logits^T [V, M] = wte [V, C] (stored as col-major C x V, so OP_T) x x^T [C, M]
        CUBLAS_CHECK(cublasSgemm(cublas_handle(), CUBLAS_OP_T, CUBLAS_OP_N, V, M, C,
                                 &one, wte, C, x, C, &zero, logits, V));
    } else {
        linear(Backend::own, EPI_NONE, x, wteT, nullptr, logits, M, V, C, s);
    }
}

// wteT[c][v] = wte[v][c], 32 x 32 tiles through shared memory (lab 2's transpose).
__global__ void transpose(const float* __restrict__ in, float* __restrict__ out, int R, int Cc)
{
    __shared__ float t[32][33];
    int c = blockIdx.x * 32 + threadIdx.x;
    for (int i = threadIdx.y; i < 32; i += 8) {
        int r = blockIdx.y * 32 + i;
        if (r < R && c < Cc) t[i][threadIdx.x] = in[(size_t)r * Cc + c];
    }
    __syncthreads();
    int r = blockIdx.y * 32 + threadIdx.x;
    for (int i = threadIdx.y; i < 32; i += 8) {
        int cc = blockIdx.x * 32 + i;
        if (cc < Cc && r < R) out[(size_t)cc * R + r] = t[threadIdx.x][i];
    }
}
