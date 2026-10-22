// sample.cuh - picking the next token from a row of V logits, on the GPU.
//
//   argmax_rows   greedy decoding: a max-with-index reduction per row
//   sample_rows   temperature + top-k sampling, one block of 1,024 threads per row:
//     1. radix select finds the k-th largest logit without sorting: four passes
//        over the row, each building a 256-bin histogram of one byte of the
//        (order-preserving) bit pattern, in SHARED memory with atomics
//        (privatization: the block's own histogram, not one in DRAM), then a
//        scan over the bins picks the byte where the count crosses k;
//     2. softmax over the survivors (logit >= threshold);
//     3. a block-wide scan of per-thread sums turns the probabilities into a
//        cumulative distribution in index order, and u in [0, 1) picks a token.
//   The random number u comes from the host, so a run is reproducible.
#pragma once

#include <cfloat>
#include <cstdint>
#include "kernels.cuh"

// Order-preserving map from float bits to unsigned: a > b (floats) iff key(a) > key(b) (unsigned).
// Positive floats already compare like their bits once the sign bit is set;
// negative ones compare backwards, so all their bits are flipped.
__device__ __forceinline__ uint32_t float_key(float x)
{
    uint32_t u = __float_as_uint(x);
    return (u & 0x80000000u) ? ~u : (u | 0x80000000u);
}

constexpr int SAMPLE_THREADS = 1024;

// Inclusive scan of one value per thread across the block (1,024 threads):
// warp scans with shuffles, then a scan of the 32 warp totals. Returns the
// inclusive prefix; *total gets the block's sum.
template <typename T>
__device__ T block_inclusive_scan(T v, T* s_warp /* 32 */, T* total)
{
    const int lane = threadIdx.x % 32, warp = threadIdx.x / 32;
    for (int o = 1; o < 32; o <<= 1) {
        T n = __shfl_up_sync(0xffffffffu, v, o);
        if (lane >= o) v += n;
    }
    if (lane == 31) s_warp[warp] = v;
    __syncthreads();
    if (warp == 0) {
        T w = s_warp[lane];
        for (int o = 1; o < 32; o <<= 1) {
            T n = __shfl_up_sync(0xffffffffu, w, o);
            if (lane >= o) w += n;
        }
        s_warp[lane] = w;                                 // inclusive prefix of warp totals
    }
    __syncthreads();
    T r = v + (warp > 0 ? s_warp[warp - 1] : (T)0);
    *total = s_warp[31];
    __syncthreads();                                      // s_warp may be reused
    return r;
}

// Greedy: index of the largest logit (smallest index on ties).
__global__ void __launch_bounds__(SAMPLE_THREADS)
argmax_rows(const float* __restrict__ logits, int V, int* __restrict__ out)
{
    __shared__ float sv[32];
    __shared__ int si[32];
    const float* x = logits + (size_t)blockIdx.x * V;
    float best = -FLT_MAX; int bi = 0x7fffffff;
    for (int i = threadIdx.x; i < V; i += SAMPLE_THREADS)
        if (x[i] > best) { best = x[i]; bi = i; }
    for (int o = 16; o > 0; o >>= 1) {
        float v = __shfl_xor_sync(0xffffffffu, best, o);
        int j = __shfl_xor_sync(0xffffffffu, bi, o);
        if (v > best || (v == best && j < bi)) { best = v; bi = j; }
    }
    if (threadIdx.x % 32 == 0) { sv[threadIdx.x / 32] = best; si[threadIdx.x / 32] = bi; }
    __syncthreads();
    if (threadIdx.x == 0) {
        for (int w = 1; w < 32; ++w)
            if (sv[w] > best || (sv[w] == best && si[w] < bi)) { best = sv[w]; bi = si[w]; }
        out[blockIdx.x] = bi;
    }
}

// Temperature + top-k. k <= 0 or k >= V keeps every token.
__global__ void __launch_bounds__(SAMPLE_THREADS)
sample_rows(const float* __restrict__ logits, int V, float temperature, int k,
            const float* __restrict__ u, int* __restrict__ out)
{
    __shared__ unsigned hist[256];
    __shared__ unsigned s_scan[32];
    __shared__ float f_scan[32];
    __shared__ uint32_t s_prefix, s_kk;
    __shared__ float s_max;
    __shared__ int s_pick, s_last;
    const float* x = logits + (size_t)blockIdx.x * V;
    const int tid = threadIdx.x;
    const float inv_t = 1.0f / temperature;

    // --- 1. radix select: the key of the k-th largest logit -------------------
    uint32_t prefix = 0, mask = 0;
    if (k > 0 && k < V) {
        uint32_t kk = k;                                  // rank still to find among the candidates
        for (int shift = 24; shift >= 0; shift -= 8) {
            if (tid < 256) hist[tid] = 0;
            __syncthreads();
            for (int i = tid; i < V; i += SAMPLE_THREADS) {
                uint32_t key = float_key(x[i]);           // temperature > 0 does not change the order
                if ((key & mask) == prefix) atomicAdd(&hist[(key >> shift) & 255u], 1u);
            }
            __syncthreads();
            // Scan the bins from the top byte down: thread t holds bin 255 - t.
            unsigned c = (tid < 256) ? hist[255 - tid] : 0u, tot;
            unsigned incl = block_inclusive_scan(c, s_scan, &tot);
            unsigned excl = incl - c;
            if (tid < 256 && excl < kk && incl >= kk) {   // the k-th largest has this byte
                s_prefix = prefix | ((uint32_t)(255 - tid) << shift);
                s_kk = kk - excl;
            }
            __syncthreads();
            prefix = s_prefix; kk = s_kk;
            mask |= 255u << shift;
            __syncthreads();
        }
    }
    const uint32_t thr = prefix;                          // keys >= thr survive (0 keeps all)

    // --- 2. the max, for a stable softmax ---------------------------------------
    float m = -FLT_MAX;
    for (int i = tid; i < V; i += SAMPLE_THREADS) m = fmaxf(m, x[i]);
    for (int o = 16; o > 0; o >>= 1) m = fmaxf(m, __shfl_xor_sync(0xffffffffu, m, o));
    if (tid % 32 == 0) f_scan[tid / 32] = m;
    __syncthreads();
    if (tid == 0) { float r = f_scan[0]; for (int w = 1; w < 32; ++w) r = fmaxf(r, f_scan[w]); s_max = r; s_pick = -1; s_last = -1; }
    __syncthreads();
    m = s_max;

    // --- 3. per-thread sums over a contiguous chunk, scanned in index order -----
    const int chunk = (V + SAMPLE_THREADS - 1) / SAMPLE_THREADS;
    const int i0 = tid * chunk, i1 = min(V, i0 + chunk);
    float part = 0.0f;
    for (int i = i0; i < i1; ++i)
        if (float_key(x[i]) >= thr) part += expf((x[i] - m) * inv_t);
    float total;
    float incl = block_inclusive_scan(part, f_scan, &total);
    float excl = incl - part;
    float target = u[blockIdx.x] * total;
    if (part > 0.0f) atomicMax(&s_last, tid);             // fallback if rounding leaves target >= total
    if (part > 0.0f && target >= excl && target < incl) {
        float acc = excl; int pick = -1;
        for (int i = i0; i < i1; ++i) {
            if (float_key(x[i]) < thr) continue;
            pick = i;                                     // last survivor seen: the fallback inside the chunk
            acc += expf((x[i] - m) * inv_t);
            if (target < acc) break;
        }
        s_pick = pick;
    }
    __syncthreads();
    if (tid == 0) {
        int p = s_pick;
        if (p < 0) {                                      // target fell past the end by rounding
            int t = s_last, a = t * chunk, b = min(V, a + chunk);
            for (int i = a; i < b; ++i) if (float_key(x[i]) >= thr) p = i;
        }
        out[blockIdx.x] = p;
    }
}
