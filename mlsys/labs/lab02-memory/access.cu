// access.cu - Lab 02, experiments B and C: how a warp's addresses turn into
// memory traffic, and how many bytes you need in flight.
//
//   ./access test    correctness of the copy kernels
//   ./access bench   B1 strided reads, B2 misaligned copy, C bytes in flight
//
// B1. Each thread reads ONE float, a[i * stride]. Stride 1 = a warp reads 128
//     contiguous bytes (4 sectors of 32 B). Stride 8 or more = every thread
//     lands in its own sector: 32 sectors for 128 useful bytes.
// B2. out[i] = in[i + offset]: same pattern as a perfect copy, shifted by a few
//     floats so warps straddle sector boundaries.
// C.  A copy with a FIXED number of threads (grid-stride loop), at high and
//     low occupancy, moving 4 bytes per load (float), 16 bytes per load
//     (float4), or 4 independent 4-byte loads per iteration (ILP). Chapter 1's
//     Little's-law puzzle, measured.
#include <cstdio>
#include <cstring>
#include <vector>

#include "check.h"
#include "bench.h"

// ---------------------------------------------------------------------------
// Kernels
// ---------------------------------------------------------------------------

// B1: one strided read per thread. The result is only "used" in a branch that
// never happens (the array is all zeros), so the compiler cannot delete the
// load, but we do not pay for a store.
__global__ void strided_read(const float* __restrict__ a, int stride, size_t n, float* sink)
{
    size_t i = (size_t)blockIdx.x * blockDim.x + threadIdx.x;
    if (i < n) {
        float v = a[i * stride];
        if (v == 1234.5f) *sink = v;
    }
}

// B2: shifted copy.
__global__ void offset_copy(const float* __restrict__ in, float* __restrict__ out,
                            int offset, size_t n)
{
    size_t i = (size_t)blockIdx.x * blockDim.x + threadIdx.x;
    if (i < n) out[i] = in[i + offset];
}

// C: grid-stride copies. The grid is deliberately small (a fixed number of
// resident threads); each thread loops over the array. `stride` = total
// number of threads in the grid.

// 1 float (4 bytes) per load; one load in flight per thread per iteration.
__global__ void copy_f1(const float* __restrict__ in, float* __restrict__ out, size_t n)
{
    size_t stride = (size_t)gridDim.x * blockDim.x;
    for (size_t i = (size_t)blockIdx.x * blockDim.x + threadIdx.x; i < n; i += stride)
        out[i] = in[i];
}

// 1 float4 (16 bytes) per load: 4x the bytes per request. n4 = n / 4.
__global__ void copy_f4(const float4* __restrict__ in, float4* __restrict__ out, size_t n4)
{
    size_t stride = (size_t)gridDim.x * blockDim.x;
    for (size_t i = (size_t)blockIdx.x * blockDim.x + threadIdx.x; i < n4; i += stride)
        out[i] = in[i];
}

// 4 independent float loads per iteration, issued before any store: 4 loads
// in flight per thread without vector types (instruction-level parallelism).
// Each of the 4 is still coalesced: consecutive threads read consecutive floats.
__global__ void copy_ilp4(const float* __restrict__ in, float* __restrict__ out, size_t n)
{
    size_t stride = (size_t)gridDim.x * blockDim.x;
    size_t i = (size_t)blockIdx.x * blockDim.x + threadIdx.x;
    for (; i + 3 * stride < n; i += 4 * stride) {
        float x0 = in[i], x1 = in[i + stride], x2 = in[i + 2 * stride], x3 = in[i + 3 * stride];
        out[i] = x0; out[i + stride] = x1; out[i + 2 * stride] = x2; out[i + 3 * stride] = x3;
    }
    for (; i < n; i += stride) out[i] = in[i];  // tail
}

// ---------------------------------------------------------------------------
// test
// ---------------------------------------------------------------------------
static bool check_copy(const char* name, const std::vector<float>& ref, float* d_out, size_t n)
{
    std::vector<float> got(n);
    CUDA_CHECK(cudaMemcpy(got.data(), d_out, n * sizeof(float), cudaMemcpyDeviceToHost));
    CompareResult r = compare(ref.data(), got.data(), n, 0.0, 0.0);  // copies must be exact
    std::printf("  %-28s ", name); print_compare(r); std::printf("\n");
    return r.pass;
}

static int run_test()
{
    bool ok = true;
    size_t sizes[] = {1, 31, 1000003, (size_t)1 << 22};
    for (size_t n : sizes) {
        std::printf("n = %zu\n", n);
        size_t alloc = n + 64;
        std::vector<float> h(alloc);
        fill_random(h.data(), alloc, 42u);
        float *d_in, *d_out;
        CUDA_CHECK(cudaMalloc(&d_in, alloc * sizeof(float)));
        CUDA_CHECK(cudaMalloc(&d_out, alloc * sizeof(float)));
        CUDA_CHECK(cudaMemcpy(d_in, h.data(), alloc * sizeof(float), cudaMemcpyHostToDevice));

        // offset copy, offset 3
        std::vector<float> ref(h.begin() + 3, h.begin() + 3 + n);
        CUDA_CHECK(cudaMemset(d_out, 0, alloc * sizeof(float)));
        offset_copy<<<(unsigned)((n + 255) / 256), 256>>>(d_in, d_out, 3, n);
        CUDA_CHECK_LAUNCH(true);
        ok &= check_copy("offset_copy (offset 3)", ref, d_out, n);

        std::vector<float> ref0(h.begin(), h.begin() + n);
        CUDA_CHECK(cudaMemset(d_out, 0, alloc * sizeof(float)));
        copy_f1<<<7, 128>>>(d_in, d_out, n);  // odd grid on purpose
        CUDA_CHECK_LAUNCH(true);
        ok &= check_copy("copy_f1 (grid-stride)", ref0, d_out, n);

        CUDA_CHECK(cudaMemset(d_out, 0, alloc * sizeof(float)));
        copy_ilp4<<<7, 128>>>(d_in, d_out, n);
        CUDA_CHECK_LAUNCH(true);
        ok &= check_copy("copy_ilp4 (grid-stride)", ref0, d_out, n);

        if (n % 4 == 0) {  // float4 version needs a multiple of 4 floats
            CUDA_CHECK(cudaMemset(d_out, 0, alloc * sizeof(float)));
            copy_f4<<<7, 128>>>((const float4*)d_in, (float4*)d_out, n / 4);
            CUDA_CHECK_LAUNCH(true);
            ok &= check_copy("copy_f4 (grid-stride)", ref0, d_out, n);
        }
        CUDA_CHECK(cudaFree(d_in));
        CUDA_CHECK(cudaFree(d_out));
    }
    std::printf("PASTE: lab02 access test %s\n", ok ? "PASS" : "FAIL");
    return ok ? 0 : 1;
}

// ---------------------------------------------------------------------------
// bench
// ---------------------------------------------------------------------------
static int run_bench()
{
    DevicePeaks peaks = query_device_peaks();
    print_device_peaks(peaks);
    const double peak = peaks.dram_gbs();
    char paste[1024];
    size_t plen;

    // ---- B1: strided reads ------------------------------------------------
    // 32M threads -> 128 MB of useful data at stride 1 (well above the L2),
    // and a 4 GB array so that stride 32 still stays in bounds.
    const size_t nthreads = (size_t)1 << 25;
    const int max_stride = 32;
    float *d_a, *d_sink;
    CUDA_CHECK(cudaMalloc(&d_a, nthreads * max_stride * sizeof(float)));
    CUDA_CHECK(cudaMemset(d_a, 0, nthreads * max_stride * sizeof(float)));
    CUDA_CHECK(cudaMalloc(&d_sink, sizeof(float)));

    std::printf("\nB1. strided read: thread i reads a[i * stride] (4 bytes), %zu threads\n", nthreads);
    std::printf("%6s %10s %12s %14s %16s\n", "stride", "time ms", "useful GB/s",
                "sectors/warp", "useful bytes %");
    plen = std::snprintf(paste, sizeof paste, "PASTE: lab02 strided");
    for (int s = 1; s <= max_stride; s *= 2) {
        Timing t = time_gpu([&] {
            strided_read<<<(unsigned)(nthreads / 256), 256>>>(d_a, s, nthreads, d_sink);
        });
        double gbs = nthreads * 4.0 / (t.median_ms * 1e6);
        int sectors = s >= 8 ? 32 : 4 * s;  // 32 threads x 4 B spread over 4*s*32 B
        std::printf("%6d %10.3f %12.1f %14d %15.1f%%\n", s, t.median_ms, gbs, sectors, 100.0 * 4 / sectors);
        plen += std::snprintf(paste + plen, sizeof paste - plen, " s%d=%.0f", s, gbs);
    }
    std::printf("%s\n", paste);
    CUDA_CHECK(cudaFree(d_a));
    CUDA_CHECK(cudaFree(d_sink));

    // ---- B2: misaligned copy ----------------------------------------------
    const size_t n = (size_t)1 << 26;  // 256 MB per array
    float *d_in, *d_out;
    CUDA_CHECK(cudaMalloc(&d_in, (n + 64) * sizeof(float)));
    CUDA_CHECK(cudaMalloc(&d_out, (n + 64) * sizeof(float)));
    CUDA_CHECK(cudaMemset(d_in, 0, (n + 64) * sizeof(float)));

    std::printf("\nB2. out[i] = in[i + offset], %zu floats (read + write = %.0f MB per run)\n",
                n, 2.0 * n * 4 / 1e6);
    std::printf("%6s %10s %10s %10s\n", "offset", "time ms", "GB/s", "% of peak");
    plen = std::snprintf(paste, sizeof paste, "PASTE: lab02 offset");
    int offsets[] = {0, 1, 2, 4, 8, 16, 32};
    for (int off : offsets) {
        Timing t = time_gpu([&] {
            offset_copy<<<(unsigned)(n / 256), 256>>>(d_in, d_out, off, n);
        });
        double gbs = 2.0 * n * 4 / (t.median_ms * 1e6);
        std::printf("%6d %10.3f %10.1f %9.1f%%\n", off, t.median_ms, gbs, 100.0 * gbs / peak);
        plen += std::snprintf(paste + plen, sizeof paste - plen, " o%d=%.0f", off, gbs);
    }
    std::printf("%s\n", paste);

    // ---- C: bytes in flight -----------------------------------------------
    // A fixed population of resident threads: 1 block of 256 per SM (low,
    // 8 warps of 48 = 17% occupancy) or 6 blocks of 256 per SM (full, 100%).
    std::printf("\nC. copy %zu floats with a FIXED number of threads (grid-stride loop)\n", n);
    std::printf("%-6s %-10s %8s %10s %10s\n", "occ.", "kernel", "threads", "GB/s", "% of peak");
    plen = std::snprintf(paste, sizeof paste, "PASTE: lab02 inflight");
    const int blocks_per_sm[] = {1, 6};
    for (int b : blocks_per_sm) {
        unsigned grid = (unsigned)(peaks.sm_count * b);
        const char* occ = b == 1 ? "17%" : "100%";
        struct { const char* name; int kind; } ks[] = {{"float", 0}, {"float4", 1}, {"4x ILP", 2}};
        for (auto& k : ks) {
            Timing t = time_gpu([&] {
                if (k.kind == 0) copy_f1<<<grid, 256>>>(d_in, d_out, n);
                else if (k.kind == 1) copy_f4<<<grid, 256>>>((const float4*)d_in, (float4*)d_out, n / 4);
                else copy_ilp4<<<grid, 256>>>(d_in, d_out, n);
            });
            double gbs = 2.0 * n * 4 / (t.median_ms * 1e6);
            std::printf("%-6s %-10s %8u %10.1f %9.1f%%\n", occ, k.name, grid * 256, gbs, 100.0 * gbs / peak);
            plen += std::snprintf(paste + plen, sizeof paste - plen, " %s/%s=%.0f",
                                  b == 1 ? "low" : "full", k.kind == 0 ? "f1" : k.kind == 1 ? "f4" : "ilp4", gbs);
        }
    }
    std::printf("%s\n", paste);
    CUDA_CHECK(cudaFree(d_in));
    CUDA_CHECK(cudaFree(d_out));

    std::printf("\nWhat to look for:\n"
                "  B1: useful GB/s should fall roughly as 1/stride up to stride 8, then flatten\n"
                "      (every thread already has its own 32-byte sector). If it keeps falling\n"
                "      to 16, the DRAM moves 64 bytes at a time, not 32.\n"
                "  B2: an offset costs at most one extra sector per warp: expect a few %%.\n"
                "  C:  at low occupancy, float starves (too few bytes in flight); float4 and\n"
                "      4x ILP recover most of it. At full occupancy the gap mostly closes.\n");
    return 0;
}

int main(int argc, char** argv)
{
    if (argc != 2 || (std::strcmp(argv[1], "test") && std::strcmp(argv[1], "bench"))) {
        std::fprintf(stderr, "usage: %s test|bench\n", argv[0]);
        return 1;
    }
    require_cuda_device();
    return std::strcmp(argv[1], "test") == 0 ? run_test() : run_bench();
}
