// softmax.cuh - lab 8's softmax kernels (chapter 9, sections 2 to 6).
//
// y[row, :] = softmax(x[row, :]) for M rows of T floats, row-major.
//
//   v1 softmax_thread3       one thread per row, three passes (max, sum, write)
//   v2 softmax_warp3         one warp per row, three passes: the chapter's section 3 snippet
//   v3 softmax_warp_online   one warp per row, online (m, d) in one look + the formula pass: section 4
//   v4 softmax_warp_reg<TM>  one warp per row, the row in registers: one read, one write. Section 5
//   v5 softmax_block_smem    one block per row, the row in shared memory: one read, one write
//
// Masked entries are -INFINITY in the input (the test writes them there). Every
// kernel has section 6's guard: a fully masked row (max = -INFINITY) is written
// as zeros instead of NaN.
#pragma once

#include "rowops.h"

// ---------------------------------------------------------------------------
// v1: one thread per row. Thread i walks row i alone: no cooperation, and at
// every load the 32 lanes of a warp touch 32 different rows (32 sectors for
// 128 useful bytes). 256-thread blocks.
// ---------------------------------------------------------------------------
__global__ void softmax_thread3(const float* __restrict__ x, float* __restrict__ y, int M, int T)
{
    int row = blockIdx.x * blockDim.x + threadIdx.x;
    if (row >= M) return;
    const float* xr = x + (size_t)row * T;
    float* yr = y + (size_t)row * T;
    float m = -INFINITY;
    for (int i = 0; i < T; ++i) m = fmaxf(m, xr[i]);                   // pass 1
    if (m == -INFINITY) { for (int i = 0; i < T; ++i) yr[i] = 0.0f; return; }   // fully masked row
    float d = 0.0f;
    for (int i = 0; i < T; ++i) d += expf(xr[i] - m);                  // pass 2
    float inv = 1.0f / d;
    for (int i = 0; i < T; ++i) yr[i] = expf(xr[i] - m) * inv;         // pass 3
}

// ---------------------------------------------------------------------------
// v2: one warp per row, three passes. This is the chapter's snippet (section 3)
// plus the two lines of section 6's guard. 256-thread blocks = 8 rows per block.
// ---------------------------------------------------------------------------
__global__ void softmax_warp3(const float* __restrict__ x, float* __restrict__ y, int M, int T)
{
    int row = (blockIdx.x * blockDim.x + threadIdx.x) / 32, lane = threadIdx.x % 32;
    if (row >= M) return;
    const float* xr = x + (size_t)row * T;
    float m = -INFINITY;
    for (int i = lane; i < T; i += 32) m = fmaxf(m, xr[i]);          // pass 1: the row max
    m = warp_max(m);
    if (m == -INFINITY) {                                              // section 6: fully masked row
        for (int i = lane; i < T; i += 32) y[(size_t)row * T + i] = 0.0f;
        return;
    }
    float d = 0.0f;
    for (int i = lane; i < T; i += 32) d += expf(xr[i] - m);         // pass 2: the sum of exponentials
    d = warp_sum(d);
    float inv = 1.0f / d;
    for (int i = lane; i < T; i += 32)                               // pass 3: read again, write
        y[(size_t)row * T + i] = expf(xr[i] - m) * inv;
}

// ---------------------------------------------------------------------------
// v3: one warp per row, online softmax (section 4). Pass 1 builds (m, d) in one
// look at each element, the shuffles merge the 32 lanes' pairs, pass 2 writes.
//
// Section 6's hole, and the guard: when the max so far is still -INFINITY
// (every element this lane has seen is masked, which a causal row produces on
// most lanes), m - mn = -inf - (-inf) = NaN. So the exponentials subtract
// m_safe, which is 0 instead of -INFINITY: both terms are then exp(-inf) = 0,
// d stays 0, and the pair (-INFINITY, 0) means "nothing seen yet".
// ---------------------------------------------------------------------------
__global__ void softmax_warp_online(const float* __restrict__ x, float* __restrict__ y, int M, int T)
{
    int row = (blockIdx.x * blockDim.x + threadIdx.x) / 32, lane = threadIdx.x % 32;
    if (row >= M) return;
    const float* xr = x + (size_t)row * T;
    float m = -INFINITY, d = 0.0f;
    for (int i = lane; i < T; i += 32) {
        float v = xr[i];
        float mn = fmaxf(m, v);
        float m_safe = (mn == -INFINITY) ? 0.0f : mn;                  // section 6
        d = d * expf(m - m_safe) + expf(v - m_safe);                   // rescale, then add the new term
        m = mn;
    }
    for (int o = 16; o > 0; o >>= 1) {                                 // merge the 32 lanes' pairs
        float m2 = __shfl_xor_sync(0xffffffffu, m, o);
        float d2 = __shfl_xor_sync(0xffffffffu, d, o);
        float mn = fmaxf(m, m2);
        float m_safe = (mn == -INFINITY) ? 0.0f : mn;
        d = d * expf(m - m_safe) + d2 * expf(m2 - m_safe);
        m = mn;
    }
    if (m == -INFINITY) {                                              // fully masked row
        for (int i = lane; i < T; i += 32) y[(size_t)row * T + i] = 0.0f;
        return;
    }
    float inv = 1.0f / d;
    for (int i = lane; i < T; i += 32) y[(size_t)row * T + i] = expf(xr[i] - m) * inv;   // pass 2
}

// ---------------------------------------------------------------------------
// v4: one warp per row, the row in registers: one read and one write (section 5).
// TM is the compile-time capacity (a multiple of 32), so v[] is a register
// array; the row length n can be anything up to TM. Elements past n are
// -INFINITY (exp gives 0, they change neither max nor sum) and are not stored.
// The chapter's snippet is the special case n = TM.
// ---------------------------------------------------------------------------
template <int TM>
__global__ void softmax_warp_reg(const float* __restrict__ x, float* __restrict__ y, int M, int n)
{
    static_assert(TM % 32 == 0, "the register capacity is a multiple of the warp size");
    constexpr int PER_LANE = TM / 32;
    int row = (blockIdx.x * blockDim.x + threadIdx.x) / 32, lane = threadIdx.x % 32;
    if (row >= M) return;
    const float* xr = x + (size_t)row * n;
    float* yr = y + (size_t)row * n;
    float v[PER_LANE];
    float m = -INFINITY;
#pragma unroll
    for (int k = 0; k < PER_LANE; ++k) {
        int i = lane + 32 * k;
        v[k] = (i < n) ? xr[i] : -INFINITY;                            // the padded tail
        m = fmaxf(m, v[k]);
    }
    m = warp_max(m);
    if (m == -INFINITY) {                                              // fully masked row
#pragma unroll
        for (int k = 0; k < PER_LANE; ++k) if (lane + 32 * k < n) yr[lane + 32 * k] = 0.0f;
        return;
    }
    float d = 0.0f;
#pragma unroll
    for (int k = 0; k < PER_LANE; ++k) { v[k] = expf(v[k] - m); d += v[k]; }   // the exponential, kept
    d = warp_sum(d);
    float inv = 1.0f / d;
#pragma unroll
    for (int k = 0; k < PER_LANE; ++k)
        if (lane + 32 * k < n) yr[lane + 32 * k] = v[k] * inv;          // the guarded store
}

// ---------------------------------------------------------------------------
// v5: one block of ROW_THREADS threads per row, the row in dynamic shared
// memory (T * 4 bytes; the default limit of 48 KB allows T <= 12,288). Each
// thread owns columns tid, tid + 256, ... in every pass, so the passes over
// shared memory need no barrier of their own; block_max and block_sum have
// theirs. One read from DRAM, one write.
// ---------------------------------------------------------------------------
constexpr int SMEM_MAX_T = 12288;

__global__ void softmax_block_smem(const float* __restrict__ x, float* __restrict__ y, int M, int T)
{
#ifdef CUDASIM
    __shared__ float row_s[SMEM_MAX_T];        // cudasim has no dynamic shared memory: the largest row, statically
#else
    extern __shared__ float row_s[];           // T floats, sized at launch
#endif
    __shared__ float s_warp[ROW_THREADS / 32];
    int row = blockIdx.x;
    if (row >= M) return;                      // the whole block leaves together: safe
    const float* xr = x + (size_t)row * T;
    float m = -INFINITY;
    for (int i = threadIdx.x; i < T; i += ROW_THREADS) { float v = xr[i]; row_s[i] = v; m = fmaxf(m, v); }
    m = block_max(m, s_warp);
    float* yr = y + (size_t)row * T;
    if (m == -INFINITY) {                      // fully masked row: every thread sees the same m
        for (int i = threadIdx.x; i < T; i += ROW_THREADS) yr[i] = 0.0f;
        return;
    }
    float d = 0.0f;
    for (int i = threadIdx.x; i < T; i += ROW_THREADS) { float e = expf(row_s[i] - m); row_s[i] = e; d += e; }
    d = block_sum(d, s_warp);
    float inv = 1.0f / d;
    for (int i = threadIdx.x; i < T; i += ROW_THREADS) yr[i] = row_s[i] * inv;
}

// ---------------------------------------------------------------------------
// Launchers: every kernel with the same signature, for the tables.
// ---------------------------------------------------------------------------
inline unsigned warp_rows_blocks(int M) { return (unsigned)((M + ROW_THREADS / 32 - 1) / (ROW_THREADS / 32)); }

inline void run_softmax_v1(const float* x, float* y, int M, int T)
{ softmax_thread3<<<(M + ROW_THREADS - 1) / ROW_THREADS, ROW_THREADS>>>(x, y, M, T); }
inline void run_softmax_v2(const float* x, float* y, int M, int T)
{ softmax_warp3<<<warp_rows_blocks(M), ROW_THREADS>>>(x, y, M, T); }
inline void run_softmax_v3(const float* x, float* y, int M, int T)
{ softmax_warp_online<<<warp_rows_blocks(M), ROW_THREADS>>>(x, y, M, T); }
// v4 picks the smallest instantiation that holds the row; rows longer than 2,048 are not its job.
inline bool softmax_v4_ok(int T) { return T <= 2048; }
inline void run_softmax_v4(const float* x, float* y, int M, int T)
{
    if (T <= 768)       softmax_warp_reg<768><<<warp_rows_blocks(M), ROW_THREADS>>>(x, y, M, T);
    else if (T <= 1024) softmax_warp_reg<1024><<<warp_rows_blocks(M), ROW_THREADS>>>(x, y, M, T);
    else                softmax_warp_reg<2048><<<warp_rows_blocks(M), ROW_THREADS>>>(x, y, M, T);
}
inline bool softmax_v5_ok(int T) { return T <= SMEM_MAX_T; }
inline void run_softmax_v5(const float* x, float* y, int M, int T)
{ softmax_block_smem<<<M, ROW_THREADS, (size_t)T * sizeof(float)>>>(x, y, M, T); }

struct SoftmaxKernel {
    const char* name;   // for the tables
    const char* tag;    // for the PASTE lines
    void (*run)(const float*, float*, int, int);
    bool (*ok)(int T);  // which row lengths it handles (nullptr: all)
};

inline const SoftmaxKernel* softmax_kernels(int* count)
{
    static const SoftmaxKernel ks[] = {
        {"v1 thread per row, 3 passes", "v1", run_softmax_v1, nullptr},
        {"v2 warp per row, 3 passes",   "v2", run_softmax_v2, nullptr},
        {"v3 warp, online, 2 passes",   "v3", run_softmax_v3, nullptr},
        {"v4 warp, row in registers",   "v4", run_softmax_v4, softmax_v4_ok},
        {"v5 block, row in shared",     "v5", run_softmax_v5, softmax_v5_ok},
    };
    *count = 5;
    return ks;
}
