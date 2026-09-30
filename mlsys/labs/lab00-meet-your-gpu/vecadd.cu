// vecadd.cu - Lab 00: your first CUDA kernel, c[i] = a[i] + b[i].
//
//   ./vecadd test    check the GPU result against a CPU loop for a few sizes
//   ./vecadd bench   measure time and effective bandwidth for N = 2^10 .. 2^28
#include <chrono>
#include <cstdio>
#include <cstring>
#include <vector>

#include "check.h"
#include "bench.h"

// ===========================================================================
// The kernel
// ===========================================================================

// __global__ marks a *kernel*: a function that runs on the GPU and is launched
// from the CPU. Kernels always return void; results go through pointers.
// a, b, c are *device* pointers (memory from cudaMalloc, living in VRAM).
__global__ void vecadd(const float* a, const float* b, float* c, size_t n)
{
    // Thousands of threads run this same code at once. Each one finds "its"
    // element from three built-in variables:
    //   blockIdx.x  = index of this thread's block in the grid
    //   blockDim.x  = threads per block (256 in this lab)
    //   threadIdx.x = index of this thread inside its block (0..255)
    // The cast to size_t comes BEFORE the multiply: in 32-bit arithmetic
    // blockIdx.x * blockDim.x would overflow for arrays with >= 2^32 elements.
    size_t i = (size_t)blockIdx.x * blockDim.x + threadIdx.x;

    // Bounds check: the grid has a whole number of blocks, so when n is not a
    // multiple of 256 the last block has extra threads past the end of the
    // arrays. Without this `if` they would read and write out of bounds.
    if (i < n) {
        c[i] = a[i] + b[i];  // 2 loads + 1 store (12 bytes) for 1 FLOP
    }
}

// ===========================================================================
// Host-side helpers
// ===========================================================================

static const int kThreadsPerBlock = 256;
static int g_max_grid_x = 0;  // max blocks in the x dimension, queried in main()

// Launch one thread per element: enough blocks of 256 threads to cover n.
static void launch_vecadd(const float* d_a, const float* d_b, float* d_c, size_t n)
{
    // Ceil-division in 64 bits: rounds up so that the last partial block exists.
    size_t blocks = (n + kThreadsPerBlock - 1) / kThreadsPerBlock;
    if (blocks == 0) return;  // n == 0: nothing to do (a 0-block launch is an error)
    if (blocks > (size_t)g_max_grid_x) {
        std::fprintf(stderr, "n = %zu needs %zu blocks, more than gridDim.x max %d\n",
                     n, blocks, g_max_grid_x);
        std::exit(EXIT_FAILURE);
    }
    vecadd<<<(unsigned)blocks, kThreadsPerBlock>>>(d_a, d_b, d_c, n);
}

// CPU reference. noinline keeps it a separate, honest loop when we time it.
__attribute__((noinline)) static void cpu_vecadd(const float* a, const float* b, float* c,
                                                 size_t n)
{
    for (size_t i = 0; i < n; ++i) c[i] = a[i] + b[i];
}

static double gbs(size_t n, double ms)  // 3 arrays of n floats moved in `ms`
{
    return 3.0 * n * sizeof(float) / (ms * 1e-3) / 1e9;
}

// ===========================================================================
// Mode "test": correctness
// ===========================================================================

static int run_test()
{
    // Odd sizes on purpose: 1 and 31 are smaller than one block, 1000003 and
    // 2^24+7 leave a partially filled last block (exercises the bounds check).
    const size_t sizes[] = {1, 31, 256, 1000003, (1u << 24) + 7};
    int failures = 0;

    std::printf("=== Lab 00 / vecadd test ===\n");
    for (size_t n : sizes) {
        const size_t bytes = n * sizeof(float);
        std::vector<float> h_a(n), h_b(n), h_c(n), ref(n);
        fill_random(h_a.data(), n, 1);
        fill_random(h_b.data(), n, 2);

        float *d_a, *d_b, *d_c;
        CUDA_CHECK(cudaMalloc(&d_a, bytes));
        CUDA_CHECK(cudaMalloc(&d_b, bytes));
        CUDA_CHECK(cudaMalloc(&d_c, bytes));
        CUDA_CHECK(cudaMemcpy(d_a, h_a.data(), bytes, cudaMemcpyHostToDevice));
        CUDA_CHECK(cudaMemcpy(d_b, h_b.data(), bytes, cudaMemcpyHostToDevice));

        launch_vecadd(d_a, d_b, d_c, n);
        CUDA_CHECK_LAUNCH(true);  // sync so runtime errors show up here
        CUDA_CHECK(cudaMemcpy(h_c.data(), d_c, bytes, cudaMemcpyDeviceToHost));

        cpu_vecadd(h_a.data(), h_b.data(), ref.data(), n);
        CompareResult r = compare(ref.data(), h_c.data(), n);
        std::printf("  N = %-10zu ", n);
        print_compare(r);
        std::printf("\n");
        if (!r.pass) ++failures;

        CUDA_CHECK(cudaFree(d_a));
        CUDA_CHECK(cudaFree(d_b));
        CUDA_CHECK(cudaFree(d_c));
    }
    std::printf("%s\n", failures ? "SOME TESTS FAILED" : "ALL TESTS PASSED");
    std::printf("PASTE: vecadd test,%s,failures=%d\n", failures ? "FAIL" : "PASS", failures);
    return failures ? EXIT_FAILURE : EXIT_SUCCESS;
}

// ===========================================================================
// Mode "bench": performance
// ===========================================================================

static int run_bench()
{
    const DevicePeaks peaks = query_device_peaks();
    const double peak_gbs = peaks.dram_gbs();
    const double MB = 1024.0 * 1024.0;  // sizes in MB = 2^20 bytes; GB/s = 1e9 bytes/s

    std::printf("=== Lab 00 / vecadd bench ===\n");
    print_device_peaks(peaks);
    std::printf("%% of peak below uses %.1f GB/s (%s)\n\n", peak_gbs,
                peaks.dram_gbs_spec > 0 ? "spec" : "computed");

    const int k_min = 10, k_max = 28;  // N = 2^10, 2^12, ..., 2^28
    const size_t n_max = (size_t)1 << k_max;

    // Host inputs: allocated and filled once at the largest size; each smaller
    // run just uses the first N elements. h_c receives results for checking.
    std::printf("Preparing %.0f MB of host input data...\n", 3.0 * n_max * sizeof(float) / MB);
    std::vector<float> h_a(n_max), h_b(n_max), h_c(n_max);
    fill_random(h_a.data(), n_max, 1);
    fill_random(h_b.data(), n_max, 2);

    std::printf("\n%-6s %11s %14s %12s %12s %10s %8s\n",
                "N", "elements", "working set", "median", "min", "eff. BW", "% peak");
    std::printf("%-6s %11s %14s %12s %12s %10s %8s\n",
                "", "", "(3 arrays)", "(us)", "(us)", "(GB/s)", "");

    std::vector<size_t> paste_n;
    std::vector<double> paste_gbs;

    for (int k = k_min; k <= k_max; k += 2) {
        const size_t n = (size_t)1 << k;
        const size_t bytes = n * sizeof(float);
        const size_t working_set = 3 * bytes;

        // Leave some headroom: the desktop and other apps also use VRAM.
        size_t free_b = 0, total_b = 0;
        CUDA_CHECK(cudaMemGetInfo(&free_b, &total_b));
        if (working_set > free_b / 10 * 9) {
            std::printf("2^%-4d  skipped: needs %.0f MB, only %.0f MB of VRAM free\n",
                        k, working_set / MB, free_b / MB);
            continue;
        }

        float *d_a, *d_b, *d_c;
        CUDA_CHECK(cudaMalloc(&d_a, bytes));
        CUDA_CHECK(cudaMalloc(&d_b, bytes));
        CUDA_CHECK(cudaMalloc(&d_c, bytes));
        CUDA_CHECK(cudaMemcpy(d_a, h_a.data(), bytes, cudaMemcpyHostToDevice));
        CUDA_CHECK(cudaMemcpy(d_b, h_b.data(), bytes, cudaMemcpyHostToDevice));

        Timing t = time_gpu([&] { launch_vecadd(d_a, d_b, d_c, n); });

        // Sanity check: a fast wrong answer is worthless.
        CUDA_CHECK(cudaMemcpy(h_c.data(), d_c, bytes, cudaMemcpyDeviceToHost));
        bool ok = true;
        for (size_t i = 0; i < n && ok; ++i) ok = (h_c[i] == h_a[i] + h_b[i]);

        const double bw = gbs(n, t.median_ms);
        std::printf("2^%-4d %11zu %11.2f MB %12.2f %12.2f %10.1f %7.1f%%%s%s\n",
                    k, n, working_set / MB, t.median_ms * 1e3, t.min_ms * 1e3, bw,
                    100.0 * bw / peak_gbs,
                    working_set < (size_t)peaks.l2_bytes ? "  (fits in L2)" : "",
                    ok ? "" : "  WRONG RESULT!");
        paste_n.push_back(n);
        paste_gbs.push_back(bw);

        CUDA_CHECK(cudaFree(d_a));
        CUDA_CHECK(cudaFree(d_b));
        CUDA_CHECK(cudaFree(d_c));
    }

    // CPU comparison: same loop, one CPU core, N = 2^24 (192 MB working set,
    // far larger than CPU caches, so this is the CPU's single-core DRAM speed).
    const size_t n_cpu = (size_t)1 << 24;
    cpu_vecadd(h_a.data(), h_b.data(), h_c.data(), n_cpu);  // warm-up
    std::vector<double> cpu_ms;
    for (int r = 0; r < 5; ++r) {
        auto t0 = std::chrono::steady_clock::now();
        cpu_vecadd(h_a.data(), h_b.data(), h_c.data(), n_cpu);
        auto t1 = std::chrono::steady_clock::now();
        cpu_ms.push_back(std::chrono::duration<double, std::milli>(t1 - t0).count());
    }
    const double cpu_med = median_of(cpu_ms);
    const double cpu_bw = gbs(n_cpu, cpu_med);
    std::printf("\nCPU, 1 thread, N = 2^24: median %.2f ms of 5 -> %.1f GB/s\n", cpu_med, cpu_bw);

    std::printf(
        "\nHow to read the table (expected three regimes):\n"
        "  * tiny N (first rows): launch-overhead-bound. The time barely changes with N:\n"
        "    there is a floor of a few microseconds to launch a kernel and record events,\n"
        "    so the \"bandwidth\" is tiny. The GPU is mostly idle.\n"
        "  * mid N (the largest rows marked \"fits in L2\"): the same arrays are reused\n"
        "    run after run, so they stay in the %.0f MB L2 cache and DRAM is barely\n"
        "    touched. The bandwidth can EXCEED 100%% of the DRAM peak - it is L2 bandwidth.\n"
        "  * large N (working set >> L2): DRAM-bandwidth-bound. Time grows linearly with N\n"
        "    and bandwidth plateaus; expect roughly 80-92%% of peak. This is the ceiling\n"
        "    for any kernel that does this little math per byte.\n"
        "  eff. BW = 3 * N * 4 bytes / median time (read a, read b, write c).\n",
        peaks.l2_bytes / MB);

    std::printf("\nPASTE: vecadd bench GB/s");
    for (size_t i = 0; i < paste_n.size(); ++i)
        std::printf(",%zu:%.1f", paste_n[i], paste_gbs[i]);
    std::printf(",cpu%zu:%.1f,peak:%.1f\n", n_cpu, cpu_bw, peak_gbs);
    return EXIT_SUCCESS;
}

// ===========================================================================

int main(int argc, char** argv)
{
    const bool test  = argc == 2 && std::strcmp(argv[1], "test") == 0;
    const bool bench = argc == 2 && std::strcmp(argv[1], "bench") == 0;
    if (!test && !bench) {
        std::fprintf(stderr, "usage: %s test|bench\n", argv[0]);
        return EXIT_FAILURE;
    }

    const int dev = require_cuda_device();
    g_max_grid_x = device_attr(cudaDevAttrMaxGridDimX, dev);

    return test ? run_test() : run_bench();
}
