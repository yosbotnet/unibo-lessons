// rowops.h - the shared pieces of lab 8 (chapter 9).
//
//   warp_max, warp_sum        chapter 5's shuffle reductions; every lane gets the result
//   block_max, block_sum      lab 5's block reduction: shuffles, 8 partials in shared memory, a barrier
//   Welford, welford_push,    the running (n, mean, M2) summary of section 7, its per-element update
//   chan_merge, warp_welford  and Chan's merge of two summaries, then the merge across 32 lanes
//   gelu                      GPT-2's GELU, the tanh form (lab 5, chapter 6)
//   add_bias, gelu_ew,        lab 5's elementwise kernels, copied unchanged except for the name
//   residual_add              gelu_ew (lab 5 called it gelu; here gelu is the device function)
//   small_mode(argc, argv)    true under cudasim or with --small: the test shrinks its big shapes
//
// Header only; every program of the lab includes it.
#pragma once

#include <cmath>
#include <cstring>
#include <cuda_runtime.h>

constexpr float LN_EPS = 1e-5f;      // GPT-2's layernorm epsilon
constexpr int ROW_THREADS = 256;     // threads per block in every kernel of this lab

// ---------------------------------------------------------------------------
// Reductions (chapter 5). __shfl_xor_sync leaves the result in EVERY lane,
// which is what a row operation wants: every lane goes on to use it.
// ---------------------------------------------------------------------------
__device__ __forceinline__ float warp_max(float v) { for (int o = 16; o > 0; o >>= 1) v = fmaxf(v, __shfl_xor_sync(0xffffffffu, v, o)); return v; }
__device__ __forceinline__ float warp_sum(float v) { for (int o = 16; o > 0; o >>= 1) v += __shfl_xor_sync(0xffffffffu, v, o); return v; }

// Lab 5's block_sum, for blocks of ROW_THREADS threads. s_warp: ROW_THREADS / 32 floats of shared memory.
__device__ __forceinline__ float block_sum(float v, float* s_warp)
{
    v = warp_sum(v);                                       // every lane: its warp's sum
    int warp = threadIdx.x / 32, lane = threadIdx.x % 32;
    if (lane == 0) s_warp[warp] = v;
    __syncthreads();
    float t = (lane < ROW_THREADS / 32) ? s_warp[lane] : 0.0f;
    t = warp_sum(t);                                       // every lane of every warp: the block's sum
    __syncthreads();                                       // s_warp may be reused by the next call
    return t;
}

// The same with max. The neutral element is -INFINITY, not 0.
__device__ __forceinline__ float block_max(float v, float* s_warp)
{
    v = warp_max(v);
    int warp = threadIdx.x / 32, lane = threadIdx.x % 32;
    if (lane == 0) s_warp[warp] = v;
    __syncthreads();
    float t = (lane < ROW_THREADS / 32) ? s_warp[lane] : -INFINITY;
    t = warp_max(t);
    __syncthreads();
    return t;
}

// ---------------------------------------------------------------------------
// Welford and Chan (section 7). A summary of a set of elements: count n, mean,
// and M2 = sum of squared deviations from the mean. variance = M2 / n.
// ---------------------------------------------------------------------------
struct Welford { float n, mean, M2; };

__device__ __forceinline__ void welford_push(Welford& w, float v)
{
    w.n += 1.0f;
    float delta = v - w.mean;
    w.mean += delta / w.n;
    w.M2 += delta * (v - w.mean);                          // the UPDATED mean
}

// Chan, Golub and LeVeque: merge two summaries. A lane that saw no elements
// (rows shorter than 32) has n = 0; nn = 0 when both are empty, so guard it.
__device__ __forceinline__ void chan_merge(Welford& a, float n2, float mean2, float M22)
{
    float nn = a.n + n2;
    if (nn > 0.0f) {
        float delta = mean2 - a.mean;
        a.mean += delta * (n2 / nn);
        a.M2 += M22 + delta * delta * (a.n * n2 / nn);
    }
    a.n = nn;
}

// Five shuffle rounds merge the 32 lanes' summaries; every lane ends with the row's.
__device__ __forceinline__ void warp_welford(Welford& w)
{
    for (int o = 16; o > 0; o >>= 1) {
        float n2 = __shfl_xor_sync(0xffffffffu, w.n, o), mean2 = __shfl_xor_sync(0xffffffffu, w.mean, o);
        float M22 = __shfl_xor_sync(0xffffffffu, w.M2, o);
        chan_merge(w, n2, mean2, M22);
    }
}

// ---------------------------------------------------------------------------
// GELU, tanh approximation (Hendrycks & Gimpel 2016), as in lab 5 and GPT-2.
// ---------------------------------------------------------------------------
__device__ __forceinline__ float gelu(float x)
{
    const float k = 0.7978845608f;                         // sqrt(2 / pi)
    return 0.5f * x * (1.0f + tanhf(k * (x + 0.044715f * x * x * x)));
}

// ---------------------------------------------------------------------------
// Lab 5's elementwise kernels: one thread per element.
// ---------------------------------------------------------------------------
constexpr int EW_THREADS = 256;
inline unsigned ew_blocks(size_t n) { return (unsigned)((n + EW_THREADS - 1) / EW_THREADS); }

__global__ void add_bias(float* __restrict__ y, const float* __restrict__ b, int M, int N)
{
    size_t i = (size_t)blockIdx.x * EW_THREADS + threadIdx.x;
    if (i < (size_t)M * N) y[i] += b[i % N];
}

__global__ void gelu_ew(float* __restrict__ y, size_t n)
{
    size_t i = (size_t)blockIdx.x * EW_THREADS + threadIdx.x;
    if (i < n) y[i] = gelu(y[i]);
}

__global__ void residual_add(float* __restrict__ out, const float* __restrict__ x,
                             const float* __restrict__ v, size_t n)
{
    size_t i = (size_t)blockIdx.x * EW_THREADS + threadIdx.x;
    if (i < n) out[i] = x[i] + v[i];
}

// ---------------------------------------------------------------------------
// Host helpers shared by the programs.
// ---------------------------------------------------------------------------
// cudasim runs about a microsecond per CUDA thread, so under it (or with
// --small on a GPU) the tests use smaller versions of the large shapes.
inline bool small_mode(int argc, char** argv)
{
#ifdef CUDASIM
    (void)argc; (void)argv;
    return true;
#else
    for (int i = 1; i < argc; ++i) if (!std::strcmp(argv[i], "--small")) return true;
    return false;
#endif
}
