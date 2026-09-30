// divergence.cu - Lab 01, experiment A: what does a branch cost?
//
//   ./divergence test    check every variant against a CPU reference
//   ./divergence bench   time the variants (compute-bound, so only branches matter)
//
// Every thread runs a long arithmetic chain on its own number. There are two
// chains, path A and path B, and five ways of choosing which thread runs which:
//
//   all-A       every thread takes path A            (the branch is uniform)
//   all-B       every thread takes path B            (the branch is uniform)
//   warp-split  even WARPS take A, odd warps take B  (uniform inside each warp)
//   lane-split  even THREADS take A, odd take B      (varying inside each warp)
//   one-lane    lane 0 of every warp takes B, the other 31 take A
//
// The chapter asks you to predict the time of each variant before running.
#include <cstdio>
#include <cstring>
#include <vector>

#include "check.h"
#include "bench.h"

enum Mode { ALL_A = 0, ALL_B, WARP_SPLIT, LANE_SPLIT, ONE_LANE, NUM_MODES };
static const char* kModeName[NUM_MODES] = {"all-A", "all-B", "warp-split", "lane-split",
                                           "one-lane"};

// Path A: one fused multiply-add per step (1 instruction).
__host__ __device__ inline float path_a(float x, int iters)
{
    for (int k = 0; k < iters; ++k) x = fmaf(x, 0.999f, 0.001f);
    return x;
}

// Path B: the same map, but as a separate multiply and add (2 instructions).
// __fmul_rn / __fadd_rn forbid the compiler from fusing them into one FMA, so
// path B really costs about twice path A - and the two paths cannot be merged
// into one instruction stream.
__device__ inline float path_b_dev(float x, int iters)
{
    for (int k = 0; k < iters; ++k) x = __fadd_rn(__fmul_rn(x, 0.999f), 0.001f);
    return x;
}
static float path_b_host(float x, int iters)
{
    for (int k = 0; k < iters; ++k) {
        volatile float m = x * 0.999f;  // volatile: keep the mul and add separate
        x = m + 0.001f;
    }
    return x;
}

// Which path does this thread take? `lane` = position inside the warp (0..31),
// `warp` = index of the warp inside the block.
__host__ __device__ inline bool takes_a(int mode, unsigned tid)
{
    const unsigned lane = tid % 32, warp = tid / 32;
    switch (mode) {
        case ALL_A:      return true;
        case ALL_B:      return false;
        case WARP_SPLIT: return warp % 2 == 0;  // depends only on the warp: uniform
        case LANE_SPLIT: return lane % 2 == 0;  // differs between neighbours: varying
        default:         return lane != 0;      // ONE_LANE: a single lane goes to B
    }
}

__global__ void branchy(const float* in, float* out, int n, int iters, int mode)
{
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i >= n) return;
    float x = in[i];
    if (takes_a(mode, threadIdx.x))
        x = path_a(x, iters);
    else
        x = path_b_dev(x, iters);
    out[i] = x;
}

static const int kBlock = 256;

static void launch(const float* d_in, float* d_out, int n, int iters, int mode)
{
    branchy<<<(n + kBlock - 1) / kBlock, kBlock>>>(d_in, d_out, n, iters, mode);
}

static int run_test()
{
    std::printf("=== Lab 01 / divergence test ===\n");
    const int n = 100003, iters = 37;  // odd sizes: partial last block, odd step count
    std::vector<float> h_in(n), h_out(n), ref(n);
    fill_random(h_in.data(), n, 7);
    float *d_in, *d_out;
    CUDA_CHECK(cudaMalloc(&d_in, n * sizeof(float)));
    CUDA_CHECK(cudaMalloc(&d_out, n * sizeof(float)));
    CUDA_CHECK(cudaMemcpy(d_in, h_in.data(), n * sizeof(float), cudaMemcpyHostToDevice));

    int failures = 0;
    for (int mode = 0; mode < NUM_MODES; ++mode) {
        launch(d_in, d_out, n, iters, mode);
        CUDA_CHECK_LAUNCH(true);
        CUDA_CHECK(cudaMemcpy(h_out.data(), d_out, n * sizeof(float), cudaMemcpyDeviceToHost));
        for (int i = 0; i < n; ++i) {
            unsigned tid = (unsigned)(i % kBlock);  // threadIdx.x of element i
            ref[i] = takes_a(mode, tid) ? path_a(h_in[i], iters) : path_b_host(h_in[i], iters);
        }
        CompareResult r = compare(ref.data(), h_out.data(), n, 1e-5, 1e-4);
        std::printf("  %-11s ", kModeName[mode]);
        print_compare(r);
        std::printf("\n");
        if (!r.pass) ++failures;
    }
    CUDA_CHECK(cudaFree(d_in));
    CUDA_CHECK(cudaFree(d_out));
    std::printf("%s\n", failures ? "SOME TESTS FAILED" : "ALL TESTS PASSED");
    std::printf("PASTE: divergence test,%s,failures=%d\n", failures ? "FAIL" : "PASS", failures);
    return failures ? EXIT_FAILURE : EXIT_SUCCESS;
}

static int run_bench()
{
    const DevicePeaks peaks = query_device_peaks();
    std::printf("=== Lab 01 / divergence bench ===\n");
    print_device_peaks(peaks);

    // Enough threads to fill every SM several times over; long chains so the
    // kernel is purely compute-bound (memory traffic is 8 bytes per thread).
    const int n = 1 << 21, iters = 4096;
    std::vector<float> h_in(n);
    fill_random(h_in.data(), n, 7);
    float *d_in, *d_out;
    CUDA_CHECK(cudaMalloc(&d_in, n * sizeof(float)));
    CUDA_CHECK(cudaMalloc(&d_out, n * sizeof(float)));
    CUDA_CHECK(cudaMemcpy(d_in, h_in.data(), n * sizeof(float), cudaMemcpyHostToDevice));

    std::printf("\n%d threads x %d steps. Path A = 1 FMA per step, path B = 1 MUL + 1 ADD.\n\n",
                n, iters);
    std::printf("%-11s %12s %12s %12s\n", "variant", "median (ms)", "min (ms)", "vs all-A");
    double t_a = 0;
    std::vector<double> ms(NUM_MODES);
    for (int mode = 0; mode < NUM_MODES; ++mode) {
        Timing t = time_gpu([&] { launch(d_in, d_out, n, iters, mode); }, 2, 10);
        ms[mode] = t.median_ms;
        if (mode == ALL_A) t_a = t.median_ms;
        std::printf("%-11s %12.3f %12.3f %11.2fx\n", kModeName[mode], t.median_ms, t.min_ms,
                    t.median_ms / t_a);
    }
    // Achieved FMA throughput of the all-A run, as a sanity check against the peak.
    const double tflops = 2.0 * n * (double)iters / (t_a * 1e-3) / 1e12;
    std::printf("\nall-A achieves %.1f TFLOPS", tflops);
    if (peaks.fp32_tflops > 0)
        std::printf(" = %.0f%% of the %.1f TFLOPS FP32 peak", 100 * tflops / peaks.fp32_tflops,
                    peaks.fp32_tflops);
    std::printf("\n");

    CUDA_CHECK(cudaFree(d_in));
    CUDA_CHECK(cudaFree(d_out));
    std::printf("\nPASTE: divergence ms");
    for (int mode = 0; mode < NUM_MODES; ++mode) std::printf(",%s:%.3f", kModeName[mode], ms[mode]);
    std::printf(",allA_tflops:%.1f\n", tflops);
    return EXIT_SUCCESS;
}

int main(int argc, char** argv)
{
    const bool test  = argc == 2 && std::strcmp(argv[1], "test") == 0;
    const bool bench = argc == 2 && std::strcmp(argv[1], "bench") == 0;
    if (!test && !bench) {
        std::fprintf(stderr, "usage: %s test|bench\n", argv[0]);
        return EXIT_FAILURE;
    }
    require_cuda_device();
    return test ? run_test() : run_bench();
}
