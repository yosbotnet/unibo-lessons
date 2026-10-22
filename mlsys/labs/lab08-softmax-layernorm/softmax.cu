// Lab 08 - softmax.cu: softmax from three passes to one (chapter 9, sections 2 to 6).
//
//   ./softmax test      every kernel vs a double-precision CPU reference: GPT-2 shapes,
//                       awkward lengths, a causal mask, a fully masked row, an overflow row
//   ./softmax bench     us, MB moved, GB/s and x ideal per kernel at three shapes
//   ./softmax profile   every kernel once at 12,288 x 1,024 and 1,536 x 8,192: the run for ncu
//
// Kernels (softmax.cuh): v1 thread per row, v2 warp per row with three passes,
// v3 online with two, v4 row in registers, v5 row in shared memory.

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <cmath>
#include <vector>

#include "check.h"
#include "bench.h"
#include "softmax.cuh"

static float* dalloc(size_t n) { float* p; CUDA_CHECK(cudaMalloc(&p, n * sizeof(float))); return p; }
static void upload(float* d, const std::vector<float>& h) { CUDA_CHECK(cudaMemcpy(d, h.data(), h.size() * sizeof(float), cudaMemcpyHostToDevice)); }
static std::vector<float> download(const float* d, size_t n) { std::vector<float> h(n); CUDA_CHECK(cudaMemcpy(h.data(), d, n * sizeof(float), cudaMemcpyDeviceToHost)); return h; }

// CPU reference in double, same convention as the kernels: a fully masked row is zeros.
static std::vector<float> ref_softmax(const std::vector<float>& x, int M, int T)
{
    std::vector<float> y(x.size());
    for (int r = 0; r < M; ++r) {
        const float* xr = &x[(size_t)r * T];
        double m = -INFINITY;
        for (int i = 0; i < T; ++i) m = std::max(m, (double)xr[i]);
        if (m == -INFINITY) { for (int i = 0; i < T; ++i) y[(size_t)r * T + i] = 0.0f; continue; }
        double d = 0.0;
        for (int i = 0; i < T; ++i) d += std::exp((double)xr[i] - m);
        for (int i = 0; i < T; ++i) y[(size_t)r * T + i] = (float)(std::exp((double)xr[i] - m) / d);
    }
    return y;
}

// Scores like attention's: uniform in [-4, 4). Row 1 fully masked, row 2 in the hundreds
// (overflows without the max subtraction), when the matrix has those rows.
static std::vector<float> make_scores(int M, int T, uint32_t seed, bool stress_rows)
{
    std::vector<float> x((size_t)M * T);
    fill_random(x.data(), x.size(), seed);
    for (auto& v : x) v *= 4.0f;
    if (stress_rows && M > 1) for (int i = 0; i < T; ++i) x[(size_t)1 * T + i] = -INFINITY;
    if (stress_rows && M > 2) for (int i = 0; i < T; ++i) x[(size_t)2 * T + i] = 150.0f + 12.5f * x[(size_t)2 * T + i];
    return x;
}

// A causal score matrix S of shape [H*T, T]: row r is query i = r % T, which
// sees keys 0..i; keys j > i are -INFINITY (chapter 10).
static std::vector<float> make_causal(int H, int T, uint32_t seed)
{
    std::vector<float> x = make_scores(H * T, T, seed, false);
    for (int r = 0; r < H * T; ++r)
        for (int j = r % T + 1; j < T; ++j) x[(size_t)r * T + j] = -INFINITY;
    return x;
}

static bool run_case(const char* what, const std::vector<float>& x, int M, int T)
{
    int nk; const SoftmaxKernel* ks = softmax_kernels(&nk);
    std::vector<float> ref = ref_softmax(x, M, T);
    float *dx = dalloc(x.size()), *dy = dalloc(x.size());
    upload(dx, x);
    bool ok = true;
    for (int k = 0; k < nk; ++k) {
        if (ks[k].ok && !ks[k].ok(T)) continue;
        CUDA_CHECK(cudaMemset(dy, 0xff, x.size() * sizeof(float)));  // NaN: unwritten outputs fail
        ks[k].run(dx, dy, M, T);
        CUDA_CHECK_LAUNCH(true);
        CompareResult r = compare(ref.data(), download(dy, x.size()).data(), x.size(), 1e-5, 1e-4);
        std::printf("  %-22s %5d x %-5d %-28s ", what, M, T, ks[k].name);
        print_compare(r);
        std::printf("\n");
        ok = ok && r.pass;
    }
    CUDA_CHECK(cudaFree(dx)); CUDA_CHECK(cudaFree(dy));
    return ok;
}

static int run_test()
{
    require_cuda_device();
    std::printf("=== Lab 08 / softmax test (tolerance 1e-5 abs + 1e-4 rel) ===\n");
    std::printf("Rows 1 and 2 of each GPT-2 shape: fully masked (must be zeros), values 100..200 (overflow without the max).\n");
    bool ok = true;
    const int shapes[][2] = {{64, 768}, {128, 1024}, {16, 2048}, {8, 4096}, {4, 8192}};
    for (auto& s : shapes) ok &= run_case("GPT-2 / attention", make_scores(s[0], s[1], 7u + s[1], true), s[0], s[1]);
    ok &= run_case("awkward", make_scores(37, 1000, 21u, true), 37, 1000);
    ok &= run_case("awkward", make_scores(5, 33, 22u, true), 5, 33);
    ok &= run_case("causal, H = 2", make_causal(2, 256, 23u), 2 * 256, 256);
    std::printf(ok ? "ALL TESTS PASSED\n" : "SOME TESTS FAILED\n");
    std::printf("PASTE: lab08 softmax test %s\n", ok ? "PASS" : "FAIL");
    return ok ? 0 : 1;
}

// ---------------------------------------------------------------------------
// bench: ideal bytes = one read + one write of the matrix, rows * T * 8.
// ideal time = ideal bytes at 590 GB/s (chapter 6's practical ceiling).
// ---------------------------------------------------------------------------
static int run_bench()
{
    require_cuda_device();
    DevicePeaks peaks = query_device_peaks();
    print_device_peaks(peaks);
    int nk; const SoftmaxKernel* ks = softmax_kernels(&nk);
    struct Shape { int M, T; const char* which; };   // which kernels go on the PASTE line
    const Shape shapes[] = {{12288, 1024, "v1 v2 v3 v4 v5"}, {1536, 8192, "v1 v2 v3 v5"}, {8192, 768, "v2 v4"}};
    for (const Shape& s : shapes) {
        size_t n = (size_t)s.M * s.T;
        std::vector<float> x = make_scores(s.M, s.T, 99u, false);
        float *dx = dalloc(n), *dy = dalloc(n);
        upload(dx, x);
        double bytes = 8.0 * n, ideal_us = bytes / 590e3;
        std::printf("\nrows = %d, T = %d: %.1f MB moved at best, ideal %.1f us at 590 GB/s\n", s.M, s.T, bytes / 1e6, ideal_us);
        std::printf("  %-28s %9s %9s %8s %9s\n", "kernel", "us", "MB", "GB/s", "x ideal");
        double us[5] = {0, 0, 0, 0, 0};
        for (int k = 0; k < nk; ++k) {
            if (ks[k].ok && !ks[k].ok(s.T)) continue;
            bool slow = (k == 0);
            us[k] = time_gpu([&] { ks[k].run(dx, dy, s.M, s.T); }, slow ? 1 : 3, slow ? 5 : 20).median_ms * 1e3;
            std::printf("  %-28s %9.1f %9.1f %8.1f %9.2f\n", ks[k].name, us[k], bytes / 1e6, bytes / (us[k] * 1e3), us[k] / ideal_us);
        }
        std::printf("PASTE: lab08 softmax rows=%d T=%d", s.M, s.T);
        for (int k = 0; k < nk; ++k)
            if (std::strstr(s.which, ks[k].tag)) std::printf(" %s=%.1f", ks[k].tag, us[k]);
        std::printf(" ideal=%.1f\n", ideal_us);
        CUDA_CHECK(cudaFree(dx)); CUDA_CHECK(cudaFree(dy));
    }
    std::printf("\nv1 is timed with 5 runs instead of 20 (it is slow). Compare x ideal with section 9's ranges.\n");
    return 0;
}

// profile: every kernel once per shape, nothing else: the run for `make ncu-table`.
static int run_profile()
{
    require_cuda_device();
    int nk; const SoftmaxKernel* ks = softmax_kernels(&nk);
    const int shapes[][2] = {{12288, 1024}, {1536, 8192}};
    for (auto& s : shapes) {
        size_t n = (size_t)s[0] * s[1];
        float *dx = dalloc(n), *dy = dalloc(n);
        upload(dx, make_scores(s[0], s[1], 99u, false));
        for (int k = 0; k < nk; ++k) {
            if (ks[k].ok && !ks[k].ok(s[1])) continue;
            ks[k].run(dx, dy, s[0], s[1]);
            CUDA_CHECK_LAUNCH(true);
            std::printf("ran %s at %d x %d\n", ks[k].name, s[0], s[1]);
        }
        CUDA_CHECK(cudaFree(dx)); CUDA_CHECK(cudaFree(dy));
    }
    return 0;
}

int main(int argc, char** argv)
{
    if (argc < 2 || (std::strcmp(argv[1], "test") && std::strcmp(argv[1], "bench") && std::strcmp(argv[1], "profile"))) {
        std::fprintf(stderr, "usage: %s test|bench|profile\n", argv[0]);
        return 1;
    }
    if (!std::strcmp(argv[1], "test")) return run_test();
    if (!std::strcmp(argv[1], "bench")) return run_bench();
    return run_profile();
}
