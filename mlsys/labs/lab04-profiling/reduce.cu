// Lab 04 - reduce.cu: six versions of a sum reduction, plus CUB as the ceiling.
//
//   ./reduce test      every version, int (exact) and float (tolerance), awkward sizes
//   ./reduce bench     GB/s of every version on 2^26 floats (256 MB, far bigger than L2)
//   ./reduce profile   each version launched ONCE on 2^24 floats: the run to hand to ncu
//
// The versions follow chapter 5. Each one changes ONE thing, so the profiler
// shows one metric moving at a time:
//   v1  interleaved tree, "tid % (2*stride) == 0"      divergent warps
//   v2  same tree, compact thread index               no divergence, bank conflicts
//   v3  sequential addressing                         no divergence, no conflicts
//   v4  v3 + each thread first sums COARSE elements   fewer blocks, less tree overhead
//   v5  v4 + warp shuffles for the last 5 levels      fewer barriers and smem ops
//   v6  grid-stride loop, 16-byte loads, shuffles     one wave of blocks, wide loads
//   cub cub::DeviceReduce::Sum                        the library, as the ceiling
//
// Every version ends with ONE atomicAdd per block into *out (which must be
// zeroed first): blocks cannot wait for each other (chapter 2), so the last
// level of the tree is done by the atomic unit in L2.

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <cmath>
#include <vector>
#include <cub/cub.cuh>

#include "check.h"
#include "bench.h"

constexpr int BLOCK  = 256;  // threads per block for v1..v5 (a power of two)
constexpr int COARSE = 8;    // elements each thread sums privately in v4 / v5

// ---------------------------------------------------------------------------
// v1: interleaved addressing. At level `stride` the active threads are the
// multiples of 2*stride: tid 0, 2, 4... then 0, 4, 8... They are spread over
// every warp, so every warp stays active (and divergent) far too long.
// ---------------------------------------------------------------------------
template <typename T>
__global__ void reduce_v1(const T* __restrict__ in, T* __restrict__ out, size_t n)
{
    __shared__ T s[BLOCK];
    unsigned tid = threadIdx.x;
    size_t i = (size_t)blockIdx.x * BLOCK + tid;
    s[tid] = (i < n) ? in[i] : T(0);
    __syncthreads();

    for (unsigned stride = 1; stride < BLOCK; stride *= 2) {
        if (tid % (2 * stride) == 0)       // varying condition: diverges inside every warp
            s[tid] += s[tid + stride];
        __syncthreads();                   // outside the if: every thread reaches it
    }
    if (tid == 0) atomicAdd(out, s[0]);
}

// ---------------------------------------------------------------------------
// v2: same pairs, but thread t now does the work that thread 2*stride*t did.
// The active threads are 0, 1, 2, ... contiguous: whole warps are active or
// idle, so divergence disappears (until fewer than 32 threads remain).
// New problem: thread t touches s[2*stride*t]. Neighbouring threads are
// 2*stride words apart, which lands them on the same bank: conflicts.
// ---------------------------------------------------------------------------
template <typename T>
__global__ void reduce_v2(const T* __restrict__ in, T* __restrict__ out, size_t n)
{
    __shared__ T s[BLOCK];
    unsigned tid = threadIdx.x;
    size_t i = (size_t)blockIdx.x * BLOCK + tid;
    s[tid] = (i < n) ? in[i] : T(0);
    __syncthreads();

    for (unsigned stride = 1; stride < BLOCK; stride *= 2) {
        unsigned idx = 2 * stride * tid;   // strided index: bank conflicts
        if (idx < BLOCK)
            s[idx] += s[idx + stride];
        __syncthreads();
    }
    if (tid == 0) atomicAdd(out, s[0]);
}

// ---------------------------------------------------------------------------
// v3: sequential addressing. Fold the upper half onto the lower half:
// thread t adds s[t + stride] into s[t], stride = 128, 64, ..., 1.
// Active threads are contiguous (no divergence) AND neighbouring threads touch
// neighbouring words (no bank conflicts).
// ---------------------------------------------------------------------------
template <typename T>
__global__ void reduce_v3(const T* __restrict__ in, T* __restrict__ out, size_t n)
{
    __shared__ T s[BLOCK];
    unsigned tid = threadIdx.x;
    size_t i = (size_t)blockIdx.x * BLOCK + tid;
    s[tid] = (i < n) ? in[i] : T(0);
    __syncthreads();

    for (unsigned stride = BLOCK / 2; stride > 0; stride >>= 1) {
        if (tid < stride)
            s[tid] += s[tid + stride];
        __syncthreads();
    }
    if (tid == 0) atomicAdd(out, s[0]);
}

// ---------------------------------------------------------------------------
// v4: thread coarsening. v1..v3 spend 8 barriers and a tree on every 256
// elements, and half the threads go idle after the first level. Here each
// thread first adds COARSE elements in a register (no barrier, all threads
// busy), then the block runs v3's tree once per 256*COARSE elements.
// The loads stay coalesced: at step k the block reads 256 consecutive values.
// ---------------------------------------------------------------------------
template <typename T>
__device__ __forceinline__ T coarse_sum(const T* __restrict__ in, size_t n)
{
    size_t base = (size_t)blockIdx.x * BLOCK * COARSE + threadIdx.x;
    T sum = T(0);
#pragma unroll
    for (int k = 0; k < COARSE; ++k) {
        size_t idx = base + (size_t)k * BLOCK;
        if (idx < n) sum += in[idx];
    }
    return sum;
}

template <typename T>
__global__ void reduce_v4(const T* __restrict__ in, T* __restrict__ out, size_t n)
{
    __shared__ T s[BLOCK];
    unsigned tid = threadIdx.x;
    s[tid] = coarse_sum(in, n);
    __syncthreads();

    for (unsigned stride = BLOCK / 2; stride > 0; stride >>= 1) {
        if (tid < stride)
            s[tid] += s[tid + stride];
        __syncthreads();
    }
    if (tid == 0) atomicAdd(out, s[0]);
}

// ---------------------------------------------------------------------------
// Warp-level sum with shuffles: each step, every lane adds the value held by
// the lane `offset` positions above it, register to register. No shared
// memory, no barrier: the 32 lanes of a warp exchange values directly.
// After 5 steps lane 0 holds the sum of all 32 lanes.
// ---------------------------------------------------------------------------
template <typename T>
__device__ __forceinline__ T warp_sum(T v)
{
#pragma unroll
    for (int offset = 16; offset > 0; offset >>= 1)
        v += __shfl_down_sync(0xffffffffu, v, offset);
    return v;
}

// v5: v4, but the tree stops at 64 values in shared memory; the last 5
// levels (32 -> 1) run inside warp 0 with shuffles: 5 fewer barriers,
// 5 fewer rounds of shared-memory loads and stores.
template <typename T>
__global__ void reduce_v5(const T* __restrict__ in, T* __restrict__ out, size_t n)
{
    __shared__ T s[BLOCK];
    unsigned tid = threadIdx.x;
    s[tid] = coarse_sum(in, n);
    __syncthreads();

    for (unsigned stride = BLOCK / 2; stride > 32; stride >>= 1) {
        if (tid < stride)
            s[tid] += s[tid + stride];
        __syncthreads();
    }
    if (tid < 32) {                        // warp 0 only: a uniform branch
        T v = s[tid] + s[tid + 32];
        v = warp_sum(v);
        if (tid == 0) atomicAdd(out, v);
    }
}

// ---------------------------------------------------------------------------
// v6: the modern shape. Launch only as many blocks as fit on the GPU at once
// (one "wave"); each thread walks the whole array with a grid-stride loop,
// reading 16 bytes (4 values) per load. Then shuffles inside each warp,
// one shared-memory slot per warp, and shuffles again in warp 0.
// ---------------------------------------------------------------------------
template <typename T> struct Vec4;
template <> struct Vec4<float> { using type = float4; };
template <> struct Vec4<int>   { using type = int4; };

template <typename T>
__global__ void reduce_v6(const T* __restrict__ in, T* __restrict__ out, size_t n)
{
    using V = typename Vec4<T>::type;
    const V* in4 = reinterpret_cast<const V*>(in);   // cudaMalloc memory is 256-byte aligned
    size_t n4 = n / 4;
    size_t tid_global = (size_t)blockIdx.x * blockDim.x + threadIdx.x;
    size_t step = (size_t)gridDim.x * blockDim.x;

    T sum = T(0);
    for (size_t j = tid_global; j < n4; j += step) {  // coalesced: a warp reads 512 bytes
        V v = in4[j];
        sum += (v.x + v.y) + (v.z + v.w);
    }
    for (size_t j = 4 * n4 + tid_global; j < n; j += step)  // the 0-3 leftover values
        sum += in[j];

    __shared__ T warp_sums[32];
    unsigned lane = threadIdx.x % 32, warp = threadIdx.x / 32;
    sum = warp_sum(sum);
    if (lane == 0) warp_sums[warp] = sum;
    __syncthreads();
    if (warp == 0) {
        unsigned nwarps = blockDim.x / 32;
        T v = (lane < nwarps) ? warp_sums[lane] : T(0);
        v = warp_sum(v);
        if (lane == 0) atomicAdd(out, v);
    }
}

// ---------------------------------------------------------------------------
// Launching
// ---------------------------------------------------------------------------
enum Version { V1, V2, V3, V4, V5, V6, CUB, NUM_VERSIONS };
static const char* version_name[] = {"v1 interleaved", "v2 compact idx", "v3 sequential",
                                     "v4 coarsened x8", "v5 + warp shfl", "v6 grid-stride",
                                     "cub DeviceReduce"};
static const char* version_tag[] = {"v1", "v2", "v3", "v4", "v5", "v6", "cub"};

static size_t ceil_div(size_t a, size_t b) { return (a + b - 1) / b; }

// Grid for v6: as many 256-thread blocks as can be resident at once.
static int one_wave_blocks()
{
    static int blocks = 0;
    if (!blocks) {
        int sms = 0, per_sm = 0;
        CUDA_CHECK(cudaDeviceGetAttribute(&sms, cudaDevAttrMultiProcessorCount, 0));
        CUDA_CHECK(cudaOccupancyMaxActiveBlocksPerMultiprocessor(&per_sm, reduce_v6<float>, BLOCK, 0));
        blocks = sms * per_sm;
    }
    return blocks;
}

// CUB needs a scratch buffer; its size depends on n. Kept alive between calls.
struct CubScratch { void* p = nullptr; size_t bytes = 0; };

template <typename T>
static void run(Version v, const T* d_in, T* d_out, size_t n, CubScratch& cub)
{
    CUDA_CHECK(cudaMemsetAsync(d_out, 0, sizeof(T)));   // the atomics accumulate into *out
    switch (v) {
    case V1: reduce_v1<T><<<ceil_div(n, BLOCK), BLOCK>>>(d_in, d_out, n); break;
    case V2: reduce_v2<T><<<ceil_div(n, BLOCK), BLOCK>>>(d_in, d_out, n); break;
    case V3: reduce_v3<T><<<ceil_div(n, BLOCK), BLOCK>>>(d_in, d_out, n); break;
    case V4: reduce_v4<T><<<ceil_div(n, (size_t)BLOCK * COARSE), BLOCK>>>(d_in, d_out, n); break;
    case V5: reduce_v5<T><<<ceil_div(n, (size_t)BLOCK * COARSE), BLOCK>>>(d_in, d_out, n); break;
    case V6: reduce_v6<T><<<one_wave_blocks(), BLOCK>>>(d_in, d_out, n); break;
    case CUB: {
        size_t need = 0;
        CUDA_CHECK(cub::DeviceReduce::Sum(nullptr, need, d_in, d_out, (long long)n));
        if (need > cub.bytes) {
            if (cub.p) CUDA_CHECK(cudaFree(cub.p));
            CUDA_CHECK(cudaMalloc(&cub.p, need));
            cub.bytes = need;
        }
        CUDA_CHECK(cub::DeviceReduce::Sum(cub.p, cub.bytes, d_in, d_out, (long long)n));
        break;
    }
    default: break;
    }
}

// ---------------------------------------------------------------------------
// test: ints must match exactly; floats within a tolerance (see below)
// ---------------------------------------------------------------------------
static int run_test()
{
    require_cuda_device();
    const size_t sizes[] = {1, 255, 256, 257, 2048 + 3, 1000003, (1u << 24) + 3};
    size_t nmax = sizes[sizeof sizes / sizeof sizes[0] - 1];

    std::vector<int> hi(nmax);
    std::vector<float> hf(nmax);
    uint32_t s = 2024u;
    for (size_t i = 0; i < nmax; ++i) {
        s = s * 1664525u + 1013904223u;
        hi[i] = (int)(s >> 28) - 8;                       // integers in [-8, 7]
    }
    fill_random(hf.data(), nmax, 7u);                    // floats in [0, 1)
    for (size_t i = 0; i < nmax; ++i) hf[i] = 0.5f * (hf[i] + 1.0f);

    int *di, *dio; float *df, *dfo;
    CUDA_CHECK(cudaMalloc(&di, nmax * sizeof(int)));
    CUDA_CHECK(cudaMalloc(&df, nmax * sizeof(float)));
    CUDA_CHECK(cudaMalloc(&dio, sizeof(int)));
    CUDA_CHECK(cudaMalloc(&dfo, sizeof(float)));
    CUDA_CHECK(cudaMemcpy(di, hi.data(), nmax * sizeof(int), cudaMemcpyHostToDevice));
    CUDA_CHECK(cudaMemcpy(df, hf.data(), nmax * sizeof(float), cudaMemcpyHostToDevice));
    CubScratch cub;

    bool all_ok = true;
    std::printf("%-18s %10s  %-6s %-24s\n", "version", "n", "int", "float (rel. error)");
    for (size_t n : sizes) {
        long long ref_i = 0;
        double ref_f = 0.0;    // reference in double precision
        float seq_f = 0.0f;    // what a plain sequential float loop gets
        for (size_t i = 0; i < n; ++i) { ref_i += hi[i]; ref_f += hf[i]; seq_f += hf[i]; }

        for (int v = 0; v < NUM_VERSIONS; ++v) {
            int got_i = 0; float got_f = 0.0f;
            run<int>((Version)v, di, dio, n, cub);
            run<float>((Version)v, df, dfo, n, cub);
            CUDA_CHECK_LAUNCH(true);
            CUDA_CHECK(cudaMemcpy(&got_i, dio, sizeof(int), cudaMemcpyDeviceToHost));
            CUDA_CHECK(cudaMemcpy(&got_f, dfo, sizeof(float), cudaMemcpyDeviceToHost));
            bool ok_i = (long long)got_i == ref_i;
            double rel = std::fabs(got_f - ref_f) / std::max(1.0, std::fabs(ref_f));
            bool ok_f = rel < 1e-4;
            all_ok = all_ok && ok_i && ok_f;
            std::printf("%-18s %10zu  %-6s %-6s %.1e\n", version_name[v], n,
                        ok_i ? "PASS" : "FAIL", ok_f ? "PASS" : "FAIL", rel);
        }
        double seq_rel = std::fabs(seq_f - ref_f) / std::max(1.0, std::fabs(ref_f));
        std::printf("%-18s %10zu  %-6s %-6s %.1e   <- one float accumulator, in order\n\n",
                    "CPU sequential", n, "", "", seq_rel);
    }
    std::printf("Floats: addition is not associative, so every version (and every run of\n"
                "the atomic ones) sums in a different order and gets slightly different\n"
                "bits. The tolerance is 1e-4 relative to a double-precision reference.\n"
                "Watch the CPU sequential line at the large sizes: one float accumulator\n"
                "added in order is the LEAST accurate, because once the running sum is\n"
                "large each small addend loses most of its bits. Trees add numbers of\n"
                "similar size, so they lose far less.\n");
    std::printf("PASTE: lab04 reduce test %s\n", all_ok ? "PASS" : "FAIL");

    CUDA_CHECK(cudaFree(di)); CUDA_CHECK(cudaFree(df));
    CUDA_CHECK(cudaFree(dio)); CUDA_CHECK(cudaFree(dfo));
    if (cub.p) CUDA_CHECK(cudaFree(cub.p));
    return all_ok ? 0 : 1;
}

// ---------------------------------------------------------------------------
// bench: 2^26 floats = 256 MB, read once per run. A reduction does 1 add per
// 4 bytes: deeply memory-bound, so the target is lab 0's practical ceiling.
// ---------------------------------------------------------------------------
static int run_bench()
{
    require_cuda_device();
    DevicePeaks peaks = query_device_peaks();
    print_device_peaks(peaks);
    const size_t n = (size_t)1 << 26;
    std::vector<float> h(n);
    fill_random(h.data(), n, 11u);
    float *d_in, *d_out;
    CUDA_CHECK(cudaMalloc(&d_in, n * sizeof(float)));
    CUDA_CHECK(cudaMalloc(&d_out, sizeof(float)));
    CUDA_CHECK(cudaMemcpy(d_in, h.data(), n * sizeof(float), cudaMemcpyHostToDevice));
    CubScratch cub;

    std::printf("\nSum of 2^26 floats (%.0f MB read per run)\n", n * 4 / 1e6);
    std::printf("%-18s %10s %10s %10s\n", "version", "time ms", "GB/s", "% of peak");
    char paste[512];
    size_t plen = std::snprintf(paste, sizeof paste, "PASTE: lab04 reduce");
    for (int v = 0; v < NUM_VERSIONS; ++v) {
        Timing t = time_gpu([&] { run<float>((Version)v, d_in, d_out, n, cub); });
        double gbs = n * 4.0 / (t.median_ms * 1e6);
        std::printf("%-18s %10.3f %10.1f %9.1f%%\n", version_name[v], t.median_ms, gbs,
                    100.0 * gbs / peaks.dram_gbs());
        plen += std::snprintf(paste + plen, sizeof paste - plen, " %s=%.0f", version_tag[v], gbs);
    }
    std::printf("%s\n", paste);
    std::printf("\nCompare the last rows with your lab 0 vecadd number at 2^28: that is the\n"
                "practical ceiling for any kernel that must read every byte once.\n"
                "Timings include a 4-byte cudaMemsetAsync of the output (a few us).\n");
    CUDA_CHECK(cudaFree(d_in)); CUDA_CHECK(cudaFree(d_out));
    if (cub.p) CUDA_CHECK(cudaFree(cub.p));
    return 0;
}

// ---------------------------------------------------------------------------
// profile: each version once, on 2^24 floats (64 MB: still above the 48 MB L2,
// small enough that ncu's many replay passes finish quickly).
// ---------------------------------------------------------------------------
static int run_profile()
{
    require_cuda_device();
    const size_t n = (size_t)1 << 24;
    std::vector<float> h(n);
    fill_random(h.data(), n, 3u);
    float *d_in, *d_out;
    CUDA_CHECK(cudaMalloc(&d_in, n * sizeof(float)));
    CUDA_CHECK(cudaMalloc(&d_out, sizeof(float)));
    CUDA_CHECK(cudaMemcpy(d_in, h.data(), n * sizeof(float), cudaMemcpyHostToDevice));
    CubScratch cub;
    run<float>(CUB, d_in, d_out, n, cub);          // allocate CUB's scratch before profiling
    CUDA_CHECK_LAUNCH(true);
    for (int v = 0; v < NUM_VERSIONS; ++v) {
        run<float>((Version)v, d_in, d_out, n, cub);
        CUDA_CHECK_LAUNCH(true);
        std::printf("ran %s\n", version_name[v]);
    }
    CUDA_CHECK(cudaFree(d_in)); CUDA_CHECK(cudaFree(d_out));
    if (cub.p) CUDA_CHECK(cudaFree(cub.p));
    return 0;
}

int main(int argc, char** argv)
{
    if (argc != 2 || (std::strcmp(argv[1], "test") && std::strcmp(argv[1], "bench") &&
                      std::strcmp(argv[1], "profile"))) {
        std::fprintf(stderr, "usage: %s test|bench|profile\n", argv[0]);
        return 1;
    }
    if (!std::strcmp(argv[1], "test")) return run_test();
    if (!std::strcmp(argv[1], "bench")) return run_bench();
    return run_profile();
}
