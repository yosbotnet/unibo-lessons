// Lab 08 - layernorm.cu: layernorm to one pass, add and norm fused, RMSNorm (chapter 9, sections 7 and 8).
//
//   ./layernorm test      every kernel vs a double-precision CPU reference
//   ./layernorm bench     every kernel at M = 8,192 x C = 768; fused residual + layernorm vs separate
//   ./layernorm profile   every kernel once at the bench shape: the run for ncu
//
// Kernels (layernorm.cuh): layernorm_block2 (lab 5), layernorm_welford,
// layernorm_warp_reg<768>, residual_layernorm<768>, rmsnorm<768>; and lab 5's
// residual_add (rowops.h) for the separate add-then-norm pipeline.

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <cmath>
#include <vector>

#include "check.h"
#include "bench.h"
#include "layernorm.cuh"

static float* dalloc(size_t n) { float* p; CUDA_CHECK(cudaMalloc(&p, n * sizeof(float))); return p; }
static void upload(float* d, const std::vector<float>& h) { CUDA_CHECK(cudaMemcpy(d, h.data(), h.size() * sizeof(float), cudaMemcpyHostToDevice)); }
static std::vector<float> download(const float* d, size_t n) { std::vector<float> h(n); CUDA_CHECK(cudaMemcpy(h.data(), d, n * sizeof(float), cudaMemcpyDeviceToHost)); return h; }
static std::vector<float> make(size_t n, uint32_t seed, float scale, float offset = 0.0f)
{
    std::vector<float> v(n);
    fill_random(v.data(), n, seed);
    for (auto& e : v) e = offset + scale * e;
    return v;
}

constexpr int CREG = 768;    // the register kernels' capacity: GPT-2's C

// CPU references, in double
static std::vector<float> ref_layernorm(const std::vector<float>& x, const std::vector<float>& g,
                                        const std::vector<float>& b, int M, int C)
{
    std::vector<float> y(x.size());
    for (int r = 0; r < M; ++r) {
        const float* xr = &x[(size_t)r * C];
        double mean = 0; for (int i = 0; i < C; ++i) mean += xr[i]; mean /= C;
        double var = 0;  for (int i = 0; i < C; ++i) var += (xr[i] - mean) * (xr[i] - mean); var /= C;
        double rstd = 1.0 / std::sqrt(var + LN_EPS);
        for (int i = 0; i < C; ++i) y[(size_t)r * C + i] = (float)((xr[i] - mean) * rstd * g[i] + b[i]);
    }
    return y;
}
static std::vector<float> ref_rmsnorm(const std::vector<float>& x, const std::vector<float>& g, int M, int C)
{
    std::vector<float> y(x.size());
    for (int r = 0; r < M; ++r) {
        const float* xr = &x[(size_t)r * C];
        double ss = 0; for (int i = 0; i < C; ++i) ss += (double)xr[i] * xr[i];
        double rr = 1.0 / std::sqrt(ss / C + LN_EPS);
        for (int i = 0; i < C; ++i) y[(size_t)r * C + i] = (float)(xr[i] * rr * g[i]);
    }
    return y;
}

static bool report(const char* what, int M, int C, const std::vector<float>& ref, const std::vector<float>& got)
{
    CompareResult r = compare(ref.data(), got.data(), ref.size(), 1e-5, 1e-4);
    std::printf("  %5d x %-5d %-34s ", M, C, what);
    print_compare(r);
    std::printf("\n");
    return r.pass;
}

static unsigned warp_blocks(int M) { return (unsigned)((M + ROW_THREADS / 32 - 1) / (ROW_THREADS / 32)); }

static bool test_shape(int M, int C, bool reg_kernels)
{
    std::vector<float> x = make((size_t)M * C, 100u + M + C, 1.0f, 0.1f), y = make((size_t)M * C, 200u + M + C, 1.0f);
    std::vector<float> g = make(C, 1, 0.1f, 1.0f), b = make(C, 2, 0.1f);
    size_t n = (size_t)M * C;
    float *dx = dalloc(n), *dy = dalloc(n), *dg = dalloc(C), *db = dalloc(C), *dout = dalloc(n), *dr = dalloc(n);
    upload(dx, x); upload(dy, y); upload(dg, g); upload(db, b);
    std::vector<float> ref = ref_layernorm(x, g, b, M, C);
    bool ok = true;
    auto fresh = [&] { CUDA_CHECK(cudaMemset(dout, 0xff, n * sizeof(float))); CUDA_CHECK(cudaMemset(dr, 0xff, n * sizeof(float))); };

    fresh(); layernorm_block2<<<M, ROW_THREADS>>>(dx, dg, db, dout, M, C); CUDA_CHECK_LAUNCH(true);
    ok &= report("layernorm_block2 (lab 5)", M, C, ref, download(dout, n));
    fresh(); layernorm_welford<<<warp_blocks(M), ROW_THREADS>>>(dx, dg, db, dout, M, C); CUDA_CHECK_LAUNCH(true);
    ok &= report("layernorm_welford", M, C, ref, download(dout, n));
    if (reg_kernels) {
        fresh(); layernorm_warp_reg<CREG><<<warp_blocks(M), ROW_THREADS>>>(dx, dg, db, dout, M, C); CUDA_CHECK_LAUNCH(true);
        ok &= report("layernorm_warp_reg<768>", M, C, ref, download(dout, n));

        std::vector<float> r(n);
        for (size_t i = 0; i < n; ++i) r[i] = x[i] + y[i];       // FP32 sum, exactly as the kernel forms it
        std::vector<float> refn = ref_layernorm(r, g, b, M, C);
        fresh(); residual_layernorm<CREG><<<warp_blocks(M), ROW_THREADS>>>(dx, dy, dg, db, dr, dout, M, C); CUDA_CHECK_LAUNCH(true);
        ok &= report("residual_layernorm<768>: r = x + y", M, C, r, download(dr, n));
        ok &= report("residual_layernorm<768>: LN(r)", M, C, refn, download(dout, n));

        fresh(); rmsnorm<CREG><<<warp_blocks(M), ROW_THREADS>>>(dx, dg, dout, M, C); CUDA_CHECK_LAUNCH(true);
        ok &= report("rmsnorm<768>", M, C, ref_rmsnorm(x, g, M, C), download(dout, n));
    }
    for (float* p : {dx, dy, dg, db, dout, dr}) CUDA_CHECK(cudaFree(p));
    return ok;
}

static int run_test()
{
    require_cuda_device();
    std::printf("=== Lab 08 / layernorm test (tolerance 1e-5 abs + 1e-4 rel) ===\n");
    bool ok = true;
    for (int M : {64, 1000, 4097}) ok &= test_shape(M, CREG, true);
    // Other widths for the kernels that take any C. C = 20: lanes 20..31 see no
    // element. C = 5: lanes 5..31 see none, and the first shuffle round merges
    // two empty lanes (n = 0 + 0), the case chan_merge's guard exists for.
    for (int C : {100, 5000, 20, 5}) ok &= test_shape(37, C, false);
    // The register kernels also take C < 768 (their slots past C are skipped).
    ok &= test_shape(9, 700, true);
    std::printf(ok ? "ALL TESTS PASSED\n" : "SOME TESTS FAILED\n");
    std::printf("PASTE: lab08 layernorm test %s\n", ok ? "PASS" : "FAIL");
    return ok ? 0 : 1;
}

// ---------------------------------------------------------------------------
// bench: M = 8,192 rows of 768. Ideal bytes of a layernorm: read x, write y,
// 8 bytes per element (gamma and beta are 6 KB, ignored). Add-and-norm: read
// x and y, write r and n, 16 bytes per element; the separate pipeline adds a
// write of r and a read of it back: 24.
// ---------------------------------------------------------------------------
static int run_bench()
{
    require_cuda_device();
    DevicePeaks peaks = query_device_peaks();
    print_device_peaks(peaks);
    const int M = 8192, C = CREG;
    size_t n = (size_t)M * C;
    float *dx = dalloc(n), *dy = dalloc(n), *dg = dalloc(C), *db = dalloc(C), *dout = dalloc(n), *dr = dalloc(n);
    upload(dx, make(n, 5, 1.0f, 0.1f)); upload(dy, make(n, 6, 1.0f)); upload(dg, make(C, 1, 0.1f, 1.0f)); upload(db, make(C, 2, 0.1f));
    double ln_bytes = 8.0 * n, ideal_ln = ln_bytes / 590e3;
    struct Row { const char* name; const char* tag; double bytes; double us; };
    std::vector<Row> rows = {
        {"layernorm_block2 (lab 5)", "block2", ln_bytes, 0},
        {"layernorm_welford", "welford", ln_bytes, 0},
        {"layernorm_warp_reg<768>", "reg", ln_bytes, 0},
        {"rmsnorm<768>", "rms", ln_bytes, 0},
        {"residual_layernorm<768> (fused)", "fused_resln", 16.0 * n, 0},
        {"residual_add + layernorm_warp_reg", "separate_resln", 24.0 * n, 0},
    };
    rows[0].us = time_gpu([&] { layernorm_block2<<<M, ROW_THREADS>>>(dx, dg, db, dout, M, C); }).median_ms * 1e3;
    rows[1].us = time_gpu([&] { layernorm_welford<<<warp_blocks(M), ROW_THREADS>>>(dx, dg, db, dout, M, C); }).median_ms * 1e3;
    rows[2].us = time_gpu([&] { layernorm_warp_reg<CREG><<<warp_blocks(M), ROW_THREADS>>>(dx, dg, db, dout, M, C); }).median_ms * 1e3;
    rows[3].us = time_gpu([&] { rmsnorm<CREG><<<warp_blocks(M), ROW_THREADS>>>(dx, dg, dout, M, C); }).median_ms * 1e3;
    rows[4].us = time_gpu([&] { residual_layernorm<CREG><<<warp_blocks(M), ROW_THREADS>>>(dx, dy, dg, db, dr, dout, M, C); }).median_ms * 1e3;
    rows[5].us = time_gpu([&] {
        residual_add<<<ew_blocks(n), EW_THREADS>>>(dr, dx, dy, n);
        layernorm_warp_reg<CREG><<<warp_blocks(M), ROW_THREADS>>>(dr, dg, db, dout, M, C);
    }).median_ms * 1e3;
    std::printf("\nM = %d, C = %d. Ideal: bytes at 590 GB/s.\n", M, C);
    std::printf("  %-36s %9s %9s %8s %9s\n", "kernel", "us", "MB", "GB/s", "x ideal");
    for (auto& r : rows)
        std::printf("  %-36s %9.1f %9.1f %8.1f %9.2f\n", r.name, r.us, r.bytes / 1e6, r.bytes / (r.us * 1e3), r.us / (r.bytes / 590e3));
    std::printf("  fused add + norm is %.2fx faster than separate\n", rows[5].us / rows[4].us);
    std::printf("PASTE: lab08 layernorm M=%d C=%d", M, C);
    for (auto& r : rows) std::printf(" %s=%.1f", r.tag, r.us);
    std::printf(" ideal_ln=%.1f\n", ideal_ln);
    for (float* p : {dx, dy, dg, db, dout, dr}) CUDA_CHECK(cudaFree(p));
    return 0;
}

static int run_profile()
{
    require_cuda_device();
    const int M = 8192, C = CREG;
    size_t n = (size_t)M * C;
    float *dx = dalloc(n), *dy = dalloc(n), *dg = dalloc(C), *db = dalloc(C), *dout = dalloc(n), *dr = dalloc(n);
    upload(dx, make(n, 5, 1.0f, 0.1f)); upload(dy, make(n, 6, 1.0f)); upload(dg, make(C, 1, 0.1f, 1.0f)); upload(db, make(C, 2, 0.1f));
    layernorm_block2<<<M, ROW_THREADS>>>(dx, dg, db, dout, M, C);
    layernorm_welford<<<warp_blocks(M), ROW_THREADS>>>(dx, dg, db, dout, M, C);
    layernorm_warp_reg<CREG><<<warp_blocks(M), ROW_THREADS>>>(dx, dg, db, dout, M, C);
    rmsnorm<CREG><<<warp_blocks(M), ROW_THREADS>>>(dx, dg, dout, M, C);
    residual_layernorm<CREG><<<warp_blocks(M), ROW_THREADS>>>(dx, dy, dg, db, dr, dout, M, C);
    residual_add<<<ew_blocks(n), EW_THREADS>>>(dr, dx, dy, n);
    CUDA_CHECK_LAUNCH(true);
    std::printf("ran every layernorm kernel once at %d x %d\n", M, C);
    for (float* p : {dx, dy, dg, db, dout, dr}) CUDA_CHECK(cudaFree(p));
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
