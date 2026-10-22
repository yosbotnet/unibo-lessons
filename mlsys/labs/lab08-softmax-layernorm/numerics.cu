// Lab 08 - numerics.cu: the stress rows of chapter 9 (sections 6 and 7), every variant side by side.
//
//   ./numerics [test]   three experiments, then one verdict; exits 0 when every expectation holds
//
// 1. The cancellation row: 768 values 10000 + 0.1 u, u uniform in [-1, 1). True
//    variance about 0.0033. Two-pass (layernorm_block2's statistics), Welford
//    (layernorm_welford's) and a deliberately written one-pass kernel,
//    variance_onepass: E[x^2] - E[x]^2 in FP32. Expected: the first two within
//    1e-2 of the reference, the one-pass off by orders of magnitude (or
//    negative, and its rstd NaN). Three seeds; the worst one-pass is reported.
// 2. A fully masked row (all -INFINITY): every softmax kernel must write zeros.
//    softmax_noguard, v2 without section 6's guard, shows the NaN it prevents.
// 3. An overflow row (values 100..200): softmax_nomax, which skips the max
//    subtraction, gives inf / inf = NaN; the real kernels give the right distribution.
// No bench: nothing here is about time.

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <cmath>
#include <vector>

#include "check.h"
#include "bench.h"
#include "softmax.cuh"
#include "layernorm.cuh"

// The trap of section 7: one pass, sum and sum of squares, then a subtraction of two
// numbers near 1e8 whose FP32 spacing is 8. One warp per row.
__global__ void variance_onepass(const float* __restrict__ x, float* __restrict__ var_out,
                                 float* __restrict__ rstd_out, int M, int C)
{
    int row = (blockIdx.x * blockDim.x + threadIdx.x) / 32, lane = threadIdx.x % 32;
    if (row >= M) return;
    const float* xr = x + (size_t)row * C;
    float s = 0.0f, ss = 0.0f;
    for (int i = lane; i < C; i += 32) { float v = xr[i]; s += v; ss += v * v; }
    s = warp_sum(s); ss = warp_sum(ss);
    float mean = s / C;
    float var = ss / C - mean * mean;                      // E[x^2] - E[x]^2
    if (lane == 0) { var_out[row] = var; rstd_out[row] = rsqrtf(var + LN_EPS); }
}

// v2 without the fully-masked guard: -inf - (-inf) = NaN.
__global__ void softmax_noguard(const float* __restrict__ x, float* __restrict__ y, int M, int T)
{
    int row = (blockIdx.x * blockDim.x + threadIdx.x) / 32, lane = threadIdx.x % 32;
    if (row >= M) return;
    const float* xr = x + (size_t)row * T;
    float m = -INFINITY;
    for (int i = lane; i < T; i += 32) m = fmaxf(m, xr[i]);
    m = warp_max(m);
    float d = 0.0f;
    for (int i = lane; i < T; i += 32) d += expf(xr[i] - m);
    d = warp_sum(d);
    for (int i = lane; i < T; i += 32) y[(size_t)row * T + i] = expf(xr[i] - m) / d;
}

// Softmax without the max: exp(200) is inf in FP32 (the limit is about 88.7).
__global__ void softmax_nomax(const float* __restrict__ x, float* __restrict__ y, int M, int T)
{
    int row = (blockIdx.x * blockDim.x + threadIdx.x) / 32, lane = threadIdx.x % 32;
    if (row >= M) return;
    const float* xr = x + (size_t)row * T;
    float d = 0.0f;
    for (int i = lane; i < T; i += 32) d += expf(xr[i]);
    d = warp_sum(d);
    for (int i = lane; i < T; i += 32) y[(size_t)row * T + i] = expf(xr[i]) / d;
}

static float* dalloc(size_t n) { float* p; CUDA_CHECK(cudaMalloc(&p, n * sizeof(float))); return p; }
static void upload(float* d, const std::vector<float>& h) { CUDA_CHECK(cudaMemcpy(d, h.data(), h.size() * sizeof(float), cudaMemcpyHostToDevice)); }
static std::vector<float> download(const float* d, size_t n) { std::vector<float> h(n); CUDA_CHECK(cudaMemcpy(h.data(), d, n * sizeof(float), cudaMemcpyDeviceToHost)); return h; }

// "ok", "nan" or "inf": what a softmax output row looks like.
static const char* classify(const std::vector<float>& y, const std::vector<float>* ref)
{
    bool nan = false, inf = false;
    for (float v : y) { nan |= std::isnan(v); inf |= std::isinf(v); }
    if (nan) return "nan";
    if (inf) return "inf";
    if (ref && !compare(ref->data(), y.data(), y.size(), 1e-5, 1e-4).pass) return "wrong";
    return "ok";
}

struct VarResult { double ref, twopass, welford, onepass, onepass_rstd; };

static VarResult cancellation_row(uint32_t seed)
{
    const int C = 768;
    std::vector<float> x(C), g(C, 1.0f), b(C, 0.0f);
    fill_random(x.data(), C, seed);
    for (auto& v : x) v = 10000.0f + 0.1f * v;
    double mean = 0; for (float v : x) mean += v; mean /= C;
    double var = 0;  for (float v : x) var += (v - mean) * (v - mean); var /= C;   // of the stored FP32 values

    float *dx = dalloc(C), *dg = dalloc(C), *db = dalloc(C), *dy = dalloc(C), *dm = dalloc(1), *dr = dalloc(1), *dv = dalloc(1);
    upload(dx, x); upload(dg, g); upload(db, b);
    VarResult r{var, 0, 0, 0, 0};
    // The layernorm kernels return mean and rstd = 1 / sqrt(var + eps); var = 1 / rstd^2 - eps.
    layernorm_block2<<<1, ROW_THREADS>>>(dx, dg, db, dy, 1, C, dm, dr);
    CUDA_CHECK_LAUNCH(true);
    double rs = download(dr, 1)[0]; r.twopass = 1.0 / (rs * rs) - LN_EPS;
    layernorm_welford<<<1, ROW_THREADS>>>(dx, dg, db, dy, 1, C, dm, dr);
    CUDA_CHECK_LAUNCH(true);
    rs = download(dr, 1)[0]; r.welford = 1.0 / (rs * rs) - LN_EPS;
    variance_onepass<<<1, 32>>>(dx, dv, dr, 1, C);
    CUDA_CHECK_LAUNCH(true);
    r.onepass = download(dv, 1)[0]; r.onepass_rstd = download(dr, 1)[0];
    for (float* p : {dx, dg, db, dy, dm, dr, dv}) CUDA_CHECK(cudaFree(p));
    return r;
}

static double relerr(double got, double ref) { return std::isfinite(got) ? std::fabs(got - ref) / std::fabs(ref) : INFINITY; }

int main(int argc, char** argv)
{
    if (argc > 2 || (argc == 2 && std::strcmp(argv[1], "test"))) { std::fprintf(stderr, "usage: %s [test]\n", argv[0]); return 1; }
    require_cuda_device();
    bool ok = true;

    // 1 ----------------------------------------------------------------------
    std::printf("=== 1. The cancellation row: 768 x (10000 + 0.1 u) ===\n");
    std::printf("  %-6s %13s %13s %13s %13s %11s\n", "seed", "reference", "two-pass", "Welford", "one-pass", "1p rstd");
    VarResult worst{0, 0, 0, 0, 0};
    double worst_err = -1;
    for (uint32_t seed : {11u, 12u, 13u}) {
        VarResult r = cancellation_row(seed);
        std::printf("  %-6u %13.6g %13.6g %13.6g %13.6g %11.4g\n", seed, r.ref, r.twopass, r.welford, r.onepass, r.onepass_rstd);
        bool good = relerr(r.twopass, r.ref) < 1e-2 && relerr(r.welford, r.ref) < 1e-2;
        if (!good) std::printf("    two-pass or Welford is off by more than 1e-2 relative: unexpected\n");
        ok = ok && good;
        double e = relerr(r.onepass, r.ref);
        if (std::isnan(r.onepass_rstd)) e = INFINITY;
        if (e > worst_err) { worst_err = e; worst = r; }
    }
    // rstd is what the layernorm multiplies by: compare it with the true one.
    double true_rstd = 1.0 / std::sqrt(worst.ref + LN_EPS);
    std::printf("  worst one-pass: variance %.6g against %.6g (relative error %.3g); rstd %.4g against %.4g\n",
                worst.onepass, worst.ref, worst_err, worst.onepass_rstd, true_rstd);
    bool onepass_fails = !(worst_err < 1e-2);
    std::printf("  %s: two-pass and Welford within 1e-2 on every seed; the one-pass formula %s\n",
                ok && onepass_fails ? "PASS" : "FAIL", onepass_fails ? "is garbage, as section 7 predicts" : "came out right on every seed (unexpected)");
    ok = ok && onepass_fails;

    // 2 ----------------------------------------------------------------------
    std::printf("\n=== 2. A fully masked row: 1,024 x -INFINITY ===\n");
    const int T = 1024;
    std::vector<float> masked(T, -INFINITY), zeros(T, 0.0f);
    float *dx = dalloc(T), *dy = dalloc(T);
    upload(dx, masked);
    int nk; const SoftmaxKernel* ks = softmax_kernels(&nk);
    bool masked_ok = true;
    for (int k = 0; k < nk; ++k) {
        CUDA_CHECK(cudaMemset(dy, 0xff, T * sizeof(float)));
        ks[k].run(dx, dy, 1, T);
        CUDA_CHECK_LAUNCH(true);
        const char* c = classify(download(dy, T), &zeros);
        std::printf("  %-30s %s\n", ks[k].name, !std::strcmp(c, "ok") ? "zeros" : c);
        masked_ok = masked_ok && !std::strcmp(c, "ok");
    }
    softmax_noguard<<<1, 32>>>(dx, dy, 1, T);
    CUDA_CHECK_LAUNCH(true);
    std::printf("  %-30s %s   (no guard: -inf - (-inf) = NaN)\n", "softmax_noguard", classify(download(dy, T), &zeros));
    std::printf("  %s: every kernel writes zeros\n", masked_ok ? "PASS" : "FAIL");
    ok = ok && masked_ok;

    // 3 ----------------------------------------------------------------------
    std::printf("\n=== 3. The overflow row: 1,024 values in [100, 200], max 200 ===\n");
    std::vector<float> big(T);
    fill_random(big.data(), T, 31u);
    for (auto& v : big) v = 150.0f + 50.0f * v;
    big[T / 2] = 200.0f;
    std::vector<float> ref(T);
    { double m = 200.0, d = 0; for (float v : big) d += std::exp(v - m); for (int i = 0; i < T; ++i) ref[i] = (float)(std::exp(big[i] - m) / d); }
    upload(dx, big);
    softmax_nomax<<<1, 32>>>(dx, dy, 1, T);
    CUDA_CHECK_LAUNCH(true);
    const char* nomax = classify(download(dy, T), &ref);
    std::printf("  %-30s %s   (exp(200) = inf in FP32)\n", "softmax_nomax", nomax);
    bool over_ok = true;
    for (int k = 0; k < nk; ++k) {
        CUDA_CHECK(cudaMemset(dy, 0xff, T * sizeof(float)));
        ks[k].run(dx, dy, 1, T);
        CUDA_CHECK_LAUNCH(true);
        const char* c = classify(download(dy, T), &ref);
        std::printf("  %-30s %s\n", ks[k].name, c);
        over_ok = over_ok && !std::strcmp(c, "ok");
    }
    bool nomax_fails = std::strcmp(nomax, "ok") != 0;
    std::printf("  %s: the real kernels match the reference%s\n", over_ok && nomax_fails ? "PASS" : "FAIL",
                nomax_fails ? ", the one without the max does not" : "; softmax_nomax came out right (unexpected)");
    ok = ok && over_ok && nomax_fails;
    CUDA_CHECK(cudaFree(dx)); CUDA_CHECK(cudaFree(dy));

    std::printf("\n%s\n", ok ? "ALL EXPECTATIONS HELD" : "SOME EXPECTATIONS FAILED");
    std::printf("PASTE: lab08 numerics onepass_var=%.6g twopass_var=%.6g welford_var=%.6g ref_var=%.6g masked_row=%s nomax=%s\n",
                worst.onepass, worst.twopass, worst.welford, worst.ref, masked_ok ? "ok" : "nan", nomax);
    std::printf("PASTE: lab08 numerics test %s\n", ok ? "PASS" : "FAIL");
    return ok ? 0 : 1;
}
