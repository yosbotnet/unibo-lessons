// gemm.h - the shared harness of the matmul labs (6 and 7).
//
//   C[M, N] = A[M, K] @ B[K, N], all row-major, FP32 in and out.
//
//   GemmKernel               one entry of a lab's kernel table: name, short tag, launcher
//   gemm_test(table)         every kernel vs a double-precision CPU reference, awkward sizes
//   gemm_bench(table, ...)   TFLOP/s of every kernel, % of FP32 peak and % of cuBLAS
//   gemm_profile(table, n)   every kernel launched once at n x n x n: the run for ncu
//   cublas_sgemm(...)        cuBLAS on row-major data (see the comment on the trick)
//
// And the same four for FP16 inputs with FP32 accumulation and output (lab 7's
// tensor-core kernels): GemmKernelH, hgemm_test, hgemm_bench, hgemm_profile,
// cublas_hgemm. Tensor-core kernels work on whole tiles, so the FP16 harness
// pads every matrix with zeros to a multiple of PAD (128) and hands kernels
// the padded sizes; the test still checks the logical, awkward shape.
//
// A lab defines its kernels and a table; main() hands the table to these.
#pragma once

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <cmath>
#include <functional>
#include <vector>
#include <cublas_v2.h>
#include <cuda_fp16.h>

#include "check.h"
#include "bench.h"

#define CUBLAS_CHECK(call)                                                        \
    do {                                                                          \
        cublasStatus_t st_ = (call);                                              \
        if (st_ != CUBLAS_STATUS_SUCCESS) {                                       \
            std::fprintf(stderr, "cuBLAS error at %s:%d\n  %s\n  -> %s\n",        \
                         __FILE__, __LINE__, #call, cublasGetStatusString(st_)); \
            std::exit(EXIT_FAILURE);                                              \
        }                                                                         \
    } while (0)

// A launcher gets device pointers and sizes, and must enqueue the whole GEMM.
using GemmLaunch = std::function<void(const float* A, const float* B, float* C, int M, int N, int K)>;

struct GemmKernel {
    const char* name;   // printed in tables, e.g. "v3 tiled, T=16"
    const char* tag;    // short name for PASTE lines, e.g. "tiled16"
    GemmLaunch  run;
    bool        slow = false;   // bench it with fewer repetitions (the naive kernels)
};

inline unsigned cdiv(int a, int b) { return (unsigned)((a + b - 1) / b); }

// ---------------------------------------------------------------------------
// cuBLAS on row-major matrices.
// cuBLAS is column-major: it reads a row-major M x K matrix as its transpose,
// a column-major K x M one. So instead of asking for C = A B, ask for
// C^T = B^T A^T: pass B first, then A, and swap M and N. The column-major
// N x M result it writes is exactly our row-major M x N C. No copies.
// ---------------------------------------------------------------------------
inline cublasHandle_t cublas_handle()
{
    static cublasHandle_t h = nullptr;
    if (!h) {
        CUBLAS_CHECK(cublasCreate(&h));
        // Plain FP32 on the CUDA cores: no TF32 tensor cores behind our back,
        // so the comparison with our FP32 kernels is fair.
        CUBLAS_CHECK(cublasSetMathMode(h, CUBLAS_DEFAULT_MATH));
    }
    return h;
}

inline void cublas_sgemm(const float* A, const float* B, float* C, int M, int N, int K)
{
    const float alpha = 1.0f, beta = 0.0f;
    CUBLAS_CHECK(cublasSgemm(cublas_handle(), CUBLAS_OP_N, CUBLAS_OP_N, N, M, K,
                             &alpha, B, N, A, K, &beta, C, N));
}

// ---------------------------------------------------------------------------
// Reference and data
// ---------------------------------------------------------------------------
inline void gemm_reference(const float* A, const float* B, float* C, int M, int N, int K)
{
    std::vector<double> row(N);
    for (int m = 0; m < M; ++m) {
        std::fill(row.begin(), row.end(), 0.0);
        for (int k = 0; k < K; ++k) {
            double a = A[(size_t)m * K + k];
            const float* b = B + (size_t)k * N;
            for (int n = 0; n < N; ++n) row[n] += a * b[n];
        }
        for (int n = 0; n < N; ++n) C[(size_t)m * N + n] = (float)row[n];
    }
}

struct DeviceGemm {
    float *A = nullptr, *B = nullptr, *C = nullptr;
    int M, N, K;
    DeviceGemm(int M_, int N_, int K_, uint32_t seed) : M(M_), N(N_), K(K_)
    {
        std::vector<float> a((size_t)M * K), b((size_t)K * N);
        fill_random(a.data(), a.size(), seed);
        fill_random(b.data(), b.size(), seed + 1);
        CUDA_CHECK(cudaMalloc(&A, a.size() * sizeof(float)));
        CUDA_CHECK(cudaMalloc(&B, b.size() * sizeof(float)));
        CUDA_CHECK(cudaMalloc(&C, (size_t)M * N * sizeof(float)));
        CUDA_CHECK(cudaMemcpy(A, a.data(), a.size() * sizeof(float), cudaMemcpyHostToDevice));
        CUDA_CHECK(cudaMemcpy(B, b.data(), b.size() * sizeof(float), cudaMemcpyHostToDevice));
    }
    ~DeviceGemm() { cudaFree(A); cudaFree(B); cudaFree(C); }
    std::vector<float> host(const float* d, size_t n) const
    {
        std::vector<float> h(n);
        CUDA_CHECK(cudaMemcpy(h.data(), d, n * sizeof(float), cudaMemcpyDeviceToHost));
        return h;
    }
};

// ---------------------------------------------------------------------------
// test: shapes chosen to break kernels that assume multiples of a tile size.
// Inputs are in [-1, 1), so a dot product of length K is at most K in size
// and its FP32 rounding error grows like sqrt(K) * 6e-8 * K: the tolerance
// is scaled with K accordingly.
// ---------------------------------------------------------------------------
inline int gemm_test(const std::vector<GemmKernel>& ks, const char* lab)
{
    require_cuda_device();
    const int shapes[][3] = {  // M, N, K
        {1, 1, 1}, {1, 300, 77}, {17, 33, 9}, {64, 64, 64}, {128, 128, 128},
        {130, 260, 100}, {257, 129, 513}, {300, 200, 1}, {96, 384, 1000}};
    std::printf("=== %s test: C = A @ B vs a double-precision CPU reference ===\n", lab);
    bool all_ok = true;
    for (auto& s : shapes) {
        int M = s[0], N = s[1], K = s[2];
        DeviceGemm g(M, N, K, 1000u + M + N + K);
        std::vector<float> a = g.host(g.A, (size_t)M * K), b = g.host(g.B, (size_t)K * N), ref((size_t)M * N);
        gemm_reference(a.data(), b.data(), ref.data(), M, N, K);
        double tol = 1e-5 * std::max(1.0, std::sqrt((double)K));
        for (auto& k : ks) {
            CUDA_CHECK(cudaMemset(g.C, 0xff, (size_t)M * N * sizeof(float)));   // NaN: unwritten outputs fail
            k.run(g.A, g.B, g.C, M, N, K);
            CUDA_CHECK_LAUNCH(true);
            std::vector<float> got = g.host(g.C, (size_t)M * N);
            CompareResult r = compare(ref.data(), got.data(), got.size(), tol, tol);
            all_ok = all_ok && r.pass;
            std::printf("  %4d x %4d x %4d  %-26s ", M, N, K, k.name);
            print_compare(r);
            std::printf("\n");
        }
    }
    std::printf(all_ok ? "ALL TESTS PASSED\n" : "SOME TESTS FAILED\n");
    std::printf("PASTE: %s test %s\n", lab, all_ok ? "PASS" : "FAIL");
    return all_ok ? 0 : 1;
}

// ---------------------------------------------------------------------------
// bench: square GEMMs. The last row of every table is cuBLAS; % of cuBLAS
// is the number to watch.
// ---------------------------------------------------------------------------
inline int gemm_bench(const std::vector<GemmKernel>& ks, const char* lab, std::vector<int> sizes)
{
    require_cuda_device();
    DevicePeaks peaks = query_device_peaks();
    print_device_peaks(peaks);
    for (int n : sizes) {
        DeviceGemm g(n, n, n, 7u);
        double flops = 2.0 * n * n * (double)n;
        std::vector<double> tf(ks.size());
        for (size_t i = 0; i < ks.size(); ++i) {
            bool big_and_slow = ks[i].slow && n >= 4096;
            Timing t = time_gpu([&] { ks[i].run(g.A, g.B, g.C, n, n, n); },
                                big_and_slow ? 1 : 3, big_and_slow ? 3 : 20);
            tf[i] = flops / (t.median_ms * 1e-3) / 1e12;
        }
        double ref = tf.back();   // cuBLAS is the last entry
        std::printf("\n%d x %d x %d  (%.1f GFLOP per run)\n", n, n, n, flops / 1e9);
        std::printf("  %-28s %9s %9s %10s\n", "kernel", "TFLOP/s", "% peak", "% cuBLAS");
        for (size_t i = 0; i < ks.size(); ++i)
            std::printf("  %-28s %9.2f %8.1f%% %9.1f%%\n", ks[i].name, tf[i],
                        peaks.fp32_tflops > 0 ? 100.0 * tf[i] / peaks.fp32_tflops : 0.0, 100.0 * tf[i] / ref);
        std::printf("PASTE: %s n=%d", lab, n);
        for (size_t i = 0; i < ks.size(); ++i) std::printf(" %s=%.2f", ks[i].tag, tf[i]);
        std::printf("\n");
    }
    std::printf("\n%% peak is against the FP32 peak printed above (boost clock). Under a\n"
                "long run the card may clock lower, which is one reason even cuBLAS\n"
                "stays below 100%%: compare kernels by %% of cuBLAS.\n");
    return 0;
}

// profile: every kernel once at n x n x n
inline int gemm_profile(const std::vector<GemmKernel>& ks, int n)
{
    require_cuda_device();
    DeviceGemm g(n, n, n, 3u);
    cublas_handle();   // create the handle before profiling starts
    for (auto& k : ks) {
        k.run(g.A, g.B, g.C, n, n, n);
        CUDA_CHECK_LAUNCH(true);
        std::printf("ran %s\n", k.name);
    }
    return 0;
}

// ===========================================================================
// FP16 in, FP32 accumulate and out
// ===========================================================================
constexpr int PAD = 128;
inline int pad_up(int x) { return (x + PAD - 1) / PAD * PAD; }

// A launcher gets padded sizes: Mp, Np, Kp are multiples of PAD, and the
// padding of A and B is zero, so the extra products add nothing.
using HgemmLaunch = std::function<void(const __half* A, const __half* B, float* C, int Mp, int Np, int Kp)>;
struct GemmKernelH {
    const char* name;
    const char* tag;
    HgemmLaunch run;
};

// cuBLAS: FP16 inputs, FP32 compute and output, row-major trick as above.
inline void cublas_hgemm(const __half* A, const __half* B, float* C, int M, int N, int K)
{
    const float alpha = 1.0f, beta = 0.0f;
    CUBLAS_CHECK(cublasGemmEx(cublas_handle(), CUBLAS_OP_N, CUBLAS_OP_N, N, M, K, &alpha,
                              B, CUDA_R_16F, N, A, CUDA_R_16F, K, &beta, C, CUDA_R_32F, N,
                              CUBLAS_COMPUTE_32F, CUBLAS_GEMM_DEFAULT));
}

struct DeviceGemmH {
    __half *A = nullptr, *B = nullptr;
    float* C = nullptr;
    int M, N, K, Mp, Np, Kp;
    std::vector<float> a, b;   // the FP16-rounded values, as floats, for the reference
    DeviceGemmH(int M_, int N_, int K_, uint32_t seed)
        : M(M_), N(N_), K(K_), Mp(pad_up(M_)), Np(pad_up(N_)), Kp(pad_up(K_))
    {
        a.resize((size_t)M * K); b.resize((size_t)K * N);
        fill_random(a.data(), a.size(), seed);
        fill_random(b.data(), b.size(), seed + 1);
        std::vector<__half> ha((size_t)Mp * Kp, __float2half(0.0f)), hb((size_t)Kp * Np, __float2half(0.0f));
        for (int m = 0; m < M; ++m)
            for (int k = 0; k < K; ++k) {
                __half h = __float2half(a[(size_t)m * K + k]);
                ha[(size_t)m * Kp + k] = h;
                a[(size_t)m * K + k] = __half2float(h);
            }
        for (int k = 0; k < K; ++k)
            for (int n = 0; n < N; ++n) {
                __half h = __float2half(b[(size_t)k * N + n]);
                hb[(size_t)k * Np + n] = h;
                b[(size_t)k * N + n] = __half2float(h);
            }
        CUDA_CHECK(cudaMalloc(&A, ha.size() * sizeof(__half)));
        CUDA_CHECK(cudaMalloc(&B, hb.size() * sizeof(__half)));
        CUDA_CHECK(cudaMalloc(&C, (size_t)Mp * Np * sizeof(float)));
        CUDA_CHECK(cudaMemcpy(A, ha.data(), ha.size() * sizeof(__half), cudaMemcpyHostToDevice));
        CUDA_CHECK(cudaMemcpy(B, hb.data(), hb.size() * sizeof(__half), cudaMemcpyHostToDevice));
    }
    ~DeviceGemmH() { cudaFree(A); cudaFree(B); cudaFree(C); }
    std::vector<float> result() const   // the logical M x N part of the padded C
    {
        std::vector<float> full((size_t)Mp * Np), out((size_t)M * N);
        CUDA_CHECK(cudaMemcpy(full.data(), C, full.size() * sizeof(float), cudaMemcpyDeviceToHost));
        for (int m = 0; m < M; ++m)
            std::memcpy(&out[(size_t)m * N], &full[(size_t)m * Np], N * sizeof(float));
        return out;
    }
};

// The reference multiplies the FP16-ROUNDED inputs in double precision, so
// the only differences left come from the FP32 accumulation inside the
// kernel. Tensor cores do not round every internal addition the way an FFMA
// does (Fasi et al., 2021, measured truncation inside the MMA), so the
// tolerance is 4x the FP32 test's.
inline int hgemm_test(const std::vector<GemmKernelH>& ks, const char* lab)
{
    require_cuda_device();
    const int shapes[][3] = {{1, 1, 1}, {17, 33, 9}, {128, 128, 128}, {130, 260, 100}, {257, 129, 513}, {96, 384, 1000}};
    std::printf("=== %s test: FP16 inputs, FP32 accumulate, vs a double-precision reference ===\n", lab);
    bool all_ok = true;
    for (auto& s : shapes) {
        int M = s[0], N = s[1], K = s[2];
        DeviceGemmH g(M, N, K, 2000u + M + N + K);
        std::vector<float> ref((size_t)M * N);
        gemm_reference(g.a.data(), g.b.data(), ref.data(), M, N, K);
        double tol = 4e-5 * std::max(1.0, std::sqrt((double)K));
        for (auto& k : ks) {
            CUDA_CHECK(cudaMemset(g.C, 0xff, (size_t)g.Mp * g.Np * sizeof(float)));
            k.run(g.A, g.B, g.C, g.Mp, g.Np, g.Kp);
            CUDA_CHECK_LAUNCH(true);
            std::vector<float> got = g.result();
            CompareResult r = compare(ref.data(), got.data(), got.size(), tol, tol);
            all_ok = all_ok && r.pass;
            std::printf("  %4d x %4d x %4d  %-30s ", M, N, K, k.name);
            print_compare(r);
            std::printf("\n");
        }
    }
    std::printf(all_ok ? "ALL TESTS PASSED\n" : "SOME TESTS FAILED\n");
    std::printf("PASTE: %s test %s\n", lab, all_ok ? "PASS" : "FAIL");
    return all_ok ? 0 : 1;
}

// Peak for FP16 inputs with FP32 accumulation on the tensor cores. GeForce
// cards run this at half the rate of FP16 accumulation; for the RTX 5070 the
// Blackwell whitepaper lists 61.7 dense TFLOPS. Unknown GPUs: printed as 0.
inline double tensor_fp16_fp32acc_peak(const DevicePeaks& d)
{
    return is_rtx_5070(d.name) ? 61.7 : 0.0;
}

inline int hgemm_bench(const std::vector<GemmKernelH>& ks, const char* lab, std::vector<int> sizes)
{
    require_cuda_device();
    DevicePeaks peaks = query_device_peaks();
    print_device_peaks(peaks);
    double tpeak = tensor_fp16_fp32acc_peak(peaks);
    for (int n : sizes) {
        DeviceGemmH g(n, n, n, 9u);
        double flops = 2.0 * n * n * (double)n;
        std::vector<double> tf(ks.size());
        for (size_t i = 0; i < ks.size(); ++i) {
            Timing t = time_gpu([&] { ks[i].run(g.A, g.B, g.C, g.Mp, g.Np, g.Kp); });
            tf[i] = flops / (t.median_ms * 1e-3) / 1e12;
        }
        double ref = tf.back();
        std::printf("\n%d x %d x %d, FP16 in, FP32 accumulate  (%.1f GFLOP per run)\n", n, n, n, flops / 1e9);
        std::printf("  %-30s %9s %13s %10s\n", "kernel", "TFLOP/s", "% tensor pk", "% cuBLAS");
        for (size_t i = 0; i < ks.size(); ++i)
            std::printf("  %-30s %9.2f %12.1f%% %9.1f%%\n", ks[i].name, tf[i],
                        tpeak > 0 ? 100.0 * tf[i] / tpeak : 0.0, 100.0 * tf[i] / ref);
        std::printf("PASTE: %s n=%d", lab, n);
        for (size_t i = 0; i < ks.size(); ++i) std::printf(" %s=%.2f", ks[i].tag, tf[i]);
        std::printf("\n");
    }
    return 0;
}

inline int hgemm_profile(const std::vector<GemmKernelH>& ks, int n)
{
    require_cuda_device();
    DeviceGemmH g(n, n, n, 3u);
    cublas_handle();
    for (auto& k : ks) {
        k.run(g.A, g.B, g.C, g.Mp, g.Np, g.Kp);
        CUDA_CHECK_LAUNCH(true);
        std::printf("ran %s\n", k.name);
    }
    return 0;
}

inline int gemm_main(int argc, char** argv, const std::vector<GemmKernel>& ks, const char* lab,
                     std::vector<int> bench_sizes, int profile_n)
{
    if (argc != 2 || (std::strcmp(argv[1], "test") && std::strcmp(argv[1], "bench") &&
                      std::strcmp(argv[1], "profile"))) {
        std::fprintf(stderr, "usage: %s test|bench|profile\n", argv[0]);
        return 1;
    }
    if (!std::strcmp(argv[1], "test")) return gemm_test(ks, lab);
    if (!std::strcmp(argv[1], "bench")) return gemm_bench(ks, lab, bench_sizes);
    return gemm_profile(ks, profile_n);
}

inline int hgemm_main(int argc, char** argv, const std::vector<GemmKernelH>& ks, const char* lab,
                      std::vector<int> bench_sizes, int profile_n)
{
    if (argc != 2 || (std::strcmp(argv[1], "test") && std::strcmp(argv[1], "bench") &&
                      std::strcmp(argv[1], "profile"))) {
        std::fprintf(stderr, "usage: %s test|bench|profile\n", argv[0]);
        return 1;
    }
    if (!std::strcmp(argv[1], "test")) return hgemm_test(ks, lab);
    if (!std::strcmp(argv[1], "bench")) return hgemm_bench(ks, lab, bench_sizes);
    return hgemm_profile(ks, profile_n);
}
