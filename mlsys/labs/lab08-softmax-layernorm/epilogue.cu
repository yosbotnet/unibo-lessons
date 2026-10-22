// Lab 08 - epilogue.cu: bias, GELU and the residual add ride in the GEMM's epilogue (chapter 9, section 8).
//
//   ./epilogue test      fused and separate pipelines vs a double-precision CPU reference
//   ./epilogue bench     each pipeline's time, and what it adds over the plain GEMM
//   ./epilogue profile   the separate and the fused pipelines once each, in NVTX ranges: the run for nsys
//
// The MLP sublayer's two GEMMs at prefill, T = 1,024 tokens of GPT-2 small:
//   up:   h = gelu(n W1 + b1)    M = 1,024, K = 768,   N = 3,072
//   down: x' = g W2 + b2 + r     M = 1,024, K = 3,072, N = 768
// Each as v7 + lab 5's separate kernels (add_bias, gelu_ew, residual_add), as
// v7 with the epilogue (sgemm_v7_epi.h), and as cuBLAS + the separate kernels.

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <cmath>
#include <vector>

#include "gemm.h"
#include "sgemm_v7_epi.h"

#if __has_include(<nvtx3/nvToolsExt.h>)
#include <nvtx3/nvToolsExt.h>
struct NvtxRange {
    explicit NvtxRange(const char* name) { nvtxRangePushA(name); }
    ~NvtxRange() { nvtxRangePop(); }
};
#else
struct NvtxRange { explicit NvtxRange(const char*) {} };  // NVTX headers not installed
#endif

static float* dalloc(size_t n) { float* p; CUDA_CHECK(cudaMalloc(&p, n * sizeof(float))); return p; }
static void upload(float* d, const std::vector<float>& h) { CUDA_CHECK(cudaMemcpy(d, h.data(), h.size() * sizeof(float), cudaMemcpyHostToDevice)); }
static std::vector<float> download(const float* d, size_t n) { std::vector<float> h(n); CUDA_CHECK(cudaMemcpy(h.data(), d, n * sizeof(float), cudaMemcpyDeviceToHost)); return h; }
static std::vector<float> make(size_t n, uint32_t seed, float scale = 1.0f)
{
    std::vector<float> v(n);
    fill_random(v.data(), n, seed);
    for (auto& e : v) e *= scale;
    return v;
}

// One GEMM problem with everything its two epilogues need.
struct Problem {
    int M, N, K;
    std::vector<float> A, W, bias, res;
    float *dA, *dW, *dbias, *dres, *dC, *dT;   // dT: the separate down pipeline's intermediate
    Problem(int M_, int N_, int K_, uint32_t seed) : M(M_), N(N_), K(K_)
    {
        A = make((size_t)M * K, seed); W = make((size_t)K * N, seed + 1);
        bias = make(N, seed + 2); res = make((size_t)M * N, seed + 3);
        dA = dalloc(A.size()); dW = dalloc(W.size()); dbias = dalloc(N); dres = dalloc(res.size()); dC = dalloc((size_t)M * N);
        dT = dalloc((size_t)M * N);
        upload(dA, A); upload(dW, W); upload(dbias, bias); upload(dres, res);
    }
    ~Problem() { for (float* p : {dA, dW, dbias, dres, dC, dT}) cudaFree(p); }
};

enum Pipe { UP_V7_SEP, UP_V7_EPI, UP_CUBLAS_SEP, DOWN_V7_SEP, DOWN_V7_EPI, DOWN_CUBLAS_SEP, PLAIN_V7, PLAIN_CUBLAS };

static void run_pipe(Pipe p, Problem& q)
{
    const int M = q.M, N = q.N, K = q.K;
    const size_t n = (size_t)M * N;
    switch (p) {
    case PLAIN_V7:     sgemm_v7(q.dA, q.dW, q.dC, M, N, K, EpiNone{}); break;
    case PLAIN_CUBLAS: cublas_sgemm(q.dA, q.dW, q.dC, M, N, K); break;
    case UP_V7_SEP:
    case UP_CUBLAS_SEP:
        if (p == UP_V7_SEP) sgemm_v7(q.dA, q.dW, q.dC, M, N, K, EpiNone{});
        else                cublas_sgemm(q.dA, q.dW, q.dC, M, N, K);
        add_bias<<<ew_blocks(n), EW_THREADS>>>(q.dC, q.dbias, M, N);
        gelu_ew<<<ew_blocks(n), EW_THREADS>>>(q.dC, n);
        break;
    case UP_V7_EPI:    sgemm_v7(q.dA, q.dW, q.dC, M, N, K, EpiBiasGelu{q.dbias}); break;
    case DOWN_V7_SEP:
    case DOWN_CUBLAS_SEP:
        if (p == DOWN_V7_SEP) sgemm_v7(q.dA, q.dW, q.dT, M, N, K, EpiNone{});
        else                  cublas_sgemm(q.dA, q.dW, q.dT, M, N, K);
        add_bias<<<ew_blocks(n), EW_THREADS>>>(q.dT, q.dbias, M, N);
        residual_add<<<ew_blocks(n), EW_THREADS>>>(q.dC, q.dres, q.dT, n);   // x' = r + v
        break;
    case DOWN_V7_EPI:  sgemm_v7(q.dA, q.dW, q.dC, M, N, K, EpiBiasResid{q.dbias, q.dres, N}); break;
    }
}

// CPU reference in double: gelu(A W + b) or A W + b + res.
static std::vector<float> reference(const Problem& q, bool up)
{
    std::vector<float> C((size_t)q.M * q.N);
    std::vector<double> row(q.N);
    for (int m = 0; m < q.M; ++m) {
        std::fill(row.begin(), row.end(), 0.0);
        for (int k = 0; k < q.K; ++k) {
            double a = q.A[(size_t)m * q.K + k];
            const float* w = &q.W[(size_t)k * q.N];
            for (int n = 0; n < q.N; ++n) row[n] += a * w[n];
        }
        for (int n = 0; n < q.N; ++n) {
            double v = row[n] + q.bias[n];
            if (up) v = 0.5 * v * (1.0 + std::tanh(0.7978845608028654 * (v + 0.044715 * v * v * v)));
            else    v += q.res[(size_t)m * q.N + n];
            C[(size_t)m * q.N + n] = (float)v;
        }
    }
    return C;
}

static const char* pipe_name(Pipe p)
{
    switch (p) {
    case UP_V7_SEP:       return "v7 + add_bias + gelu_ew";
    case UP_V7_EPI:       return "v7, EpiBiasGelu";
    case UP_CUBLAS_SEP:   return "cuBLAS + add_bias + gelu_ew";
    case DOWN_V7_SEP:     return "v7 + add_bias + residual_add";
    case DOWN_V7_EPI:     return "v7, EpiBiasResid";
    case DOWN_CUBLAS_SEP: return "cuBLAS + add_bias + residual_add";
    case PLAIN_V7:        return "v7 plain";
    default:              return "cuBLAS plain";
    }
}

static bool test_problem(int M, int K, int N, bool up)
{
    Problem q(M, N, K, 500u + M + N + K);
    std::vector<float> ref = reference(q, up);
    double tol = 1e-5 * std::max(1.0, std::sqrt((double)K));   // gemm.h's FP32 tolerance
    bool ok = true;
    const Pipe ps[3] = {up ? UP_V7_SEP : DOWN_V7_SEP, up ? UP_V7_EPI : DOWN_V7_EPI, up ? UP_CUBLAS_SEP : DOWN_CUBLAS_SEP};
    for (Pipe p : ps) {
        CUDA_CHECK(cudaMemset(q.dC, 0xff, (size_t)M * N * sizeof(float)));   // NaN: unwritten outputs fail
        run_pipe(p, q);
        CUDA_CHECK_LAUNCH(true);
        CompareResult r = compare(ref.data(), download(q.dC, (size_t)M * N).data(), ref.size(), tol, tol);
        std::printf("  %-5s %4d x %4d x %4d  %-32s ", up ? "up" : "down", M, K, N, pipe_name(p));
        print_compare(r);
        std::printf("\n");
        ok = ok && r.pass;
    }
    return ok;
}

static int run_test(bool small)
{
    require_cuda_device();
    std::printf("=== Lab 08 / epilogue test (M x K x N; tolerance 1e-5 * sqrt(K), abs + rel) ===\n");
    const int M = small ? 128 : 1024;     // cudasim: 128 rows of the real K and N
    if (small) std::printf("(small mode: M = %d instead of 1,024)\n", M);
    bool ok = true;
    ok &= test_problem(M, 768, 3072, true);
    ok &= test_problem(M, 3072, 768, false);
    ok &= test_problem(100, 68, 132, true);     // partial tiles, 16-byte path on
    ok &= test_problem(100, 68, 132, false);
    ok &= test_problem(100, 67, 131, true);     // K, N not multiples of 4: the scalar path
    ok &= test_problem(100, 67, 131, false);
    std::printf(ok ? "ALL TESTS PASSED\n" : "SOME TESTS FAILED\n");
    std::printf("PASTE: lab08 epilogue test %s\n", ok ? "PASS" : "FAIL");
    return ok ? 0 : 1;
}

static int run_bench()
{
    require_cuda_device();
    DevicePeaks peaks = query_device_peaks();
    print_device_peaks(peaks);
    for (int up = 1; up >= 0; --up) {
        const int M = 1024, K = up ? 768 : 3072, N = up ? 3072 : 768;
        Problem q(M, N, K, 77u);
        double act_mb = 4.0 * M * N / 1e6;
        std::printf("\n%s: M = %d, K = %d, N = %d (%.1f TFLOP/s would be %.1f us; one pass of C = %.1f MB)\n",
                    up ? "up" : "down", M, K, N, peaks.fp32_tflops, 2.0 * M * N * K / (peaks.fp32_tflops * 1e6), act_mb);
        std::printf("  %-36s %9s %12s\n", "pipeline", "us", "extra (us)");
        const Pipe ps[] = {PLAIN_V7, up ? UP_V7_SEP : DOWN_V7_SEP, up ? UP_V7_EPI : DOWN_V7_EPI,
                           PLAIN_CUBLAS, up ? UP_CUBLAS_SEP : DOWN_CUBLAS_SEP};
        double us[5];
        for (int i = 0; i < 5; ++i) {
            us[i] = time_gpu([&] { run_pipe(ps[i], q); }).median_ms * 1e3;
            double base = (i < 3) ? us[0] : us[3];
            std::printf("  %-36s %9.1f %12.1f\n", pipe_name(ps[i]), us[i], us[i] - base);
        }
        std::printf("  (extra: over the plain GEMM of the same family; the separate kernels move %.1f MB more)\n",
                    (up ? 4 : 5) * act_mb);
        std::printf("PASTE: lab08 epilogue %s: gemm=%.1f gemm+bias+%s=%.1f gemm_epi=%.1f\n",
                    up ? "up" : "down", us[0], up ? "gelu" : "resid", us[1], us[2]);
    }
    return 0;
}

static int run_profile()
{
    require_cuda_device();
    for (int up = 1; up >= 0; --up) {
        const int M = 1024, K = up ? 768 : 3072, N = up ? 3072 : 768;
        Problem q(M, N, K, 77u);
        run_pipe(PLAIN_V7, q);   // warm-up: module load, clocks
        CUDA_CHECK_LAUNCH(true);
        {
            NvtxRange r(up ? "up: separate (v7, add_bias, gelu_ew)" : "down: separate (v7, add_bias, residual_add)");
            run_pipe(up ? UP_V7_SEP : DOWN_V7_SEP, q);
            CUDA_CHECK_LAUNCH(true);
        }
        {
            NvtxRange r(up ? "up: fused (v7 with EpiBiasGelu)" : "down: fused (v7 with EpiBiasResid)");
            run_pipe(up ? UP_V7_EPI : DOWN_V7_EPI, q);
            CUDA_CHECK_LAUNCH(true);
        }
        std::printf("ran %s: separate, then fused\n", up ? "up" : "down");
    }
    return 0;
}

int main(int argc, char** argv)
{
    if (argc < 2 || (std::strcmp(argv[1], "test") && std::strcmp(argv[1], "bench") && std::strcmp(argv[1], "profile"))) {
        std::fprintf(stderr, "usage: %s test [--small]|bench|profile\n", argv[0]);
        return 1;
    }
    if (!std::strcmp(argv[1], "test")) return run_test(small_mode(argc, argv));
    if (!std::strcmp(argv[1], "bench")) return run_bench();
    return run_profile();
}
