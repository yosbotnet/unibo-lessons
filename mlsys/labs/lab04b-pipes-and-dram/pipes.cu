// pipes.cu - Lab 4b, experiments A-D: the execution pipes of an SM.
//
//   ./pipes test    every kernel computes what it claims (small sizes)
//   ./pipes bench   A latency, B throughput, C warps x ILP, D MUFU + k FFMA
//
// One kernel template does all the work: every thread runs ILP independent
// chains x = step(x), each step one instruction of the kind under test.
//   - One warp, one chain:      the time per step is the instruction's LATENCY.
//   - A full GPU, 8 chains:     the steps per clock per SM are its THROUGHPUT.
// Check with `make sass` that each loop really is the instruction it claims:
// the compiler is clever, and a microbenchmark that measures the wrong
// instruction is worse than none.
#include <cmath>
#include <cstdio>
#include <cstring>
#include <string>
#include <vector>

#include <cuda_fp16.h>

#include "check.h"
#include "bench.h"
#include "probe.h"

// ---------------------------------------------------------------------------
// The instructions under test. Each has a device step (one SASS instruction,
// two for POPC) and a host reference for `test`. a and b are kernel
// arguments, so the compiler cannot precompute anything.
// ---------------------------------------------------------------------------

// MUFU through inline PTX: the plain C functions (exp2f, rsqrtf) add range
// checks around the MUFU. On the CPU simulator, the exact functions.
__device__ __forceinline__ float ex2_approx(float x)
{
#ifdef CUDASIM
    return std::exp2(x);
#else
    float y;
    asm("ex2.approx.ftz.f32 %0, %1;" : "=f"(y) : "f"(x));
    return y;
#endif
}
__device__ __forceinline__ float rsqrt_approx(float x)
{
#ifdef CUDASIM
    return 1.0f / std::sqrt(x);
#else
    float y;
    asm("rsqrt.approx.ftz.f32 %0, %1;" : "=f"(y) : "f"(x));
    return y;
#endif
}

struct OpFFMA {             // FFMA: FP32 fused multiply-add
    using T = float;
    static constexpr const char* name = "FFMA"; static constexpr double expect = 128;
    __device__ static T make(double v) { return (float)v; }
    __device__ static T step(T x, T a, T b, T) { return fmaf(x, a, b); }
    static double ref(double x, double a, double b, double) { return (double)fmaf((float)x, (float)a, (float)b); }
    static double x0(int i) { return 0.5 + 1e-3 * i; }
    static constexpr double a = 0.9999, b = 1e-4;
    static constexpr double tol = 1e-6;                        // relative, for `test`
};
struct OpHFMA2 {            // HFMA2: two FP16 FMAs in one 32-bit register (counted as one result here)
    using T = __half2;
    static constexpr const char* name = "HFMA2"; static constexpr double expect = 64;
    __device__ static T make(double v) { return __float2half2_rn((float)v); }
    __device__ static T step(T x, T a, T b, T) { return __hfma2(x, a, b); }
    static double ref(double x, double a, double b, double) { return x * a + b; }   // FP16 rounding: compared loosely
    static double x0(int i) { return 0.5 + 1e-3 * (i % 16); }
    static constexpr double a = 0.999, b = 1e-3;
    static constexpr double tol = 2e-2;                        // relative, for `test`
};
struct OpIMAD {             // IMAD: integer multiply-add (the heavy FMA pipe only), x = x * y + a
    using T = unsigned;     // y is the neighbouring chain: with a constant multiplier the compiler
                            // would fold 64 steps into one (x*a+b is affine, so is its composition)
    static constexpr const char* name = "IMAD"; static constexpr double expect = 64;
    __device__ static T make(double v) { return (unsigned)v; }
    __device__ static T step(T x, T a, T, T y) { return x * y + a; }
    static double ref(double x, double a, double, double y) { return (double)((unsigned)x * (unsigned)y + (unsigned)a); }
    static double x0(int i) { return 12345.0 + i; }
    static constexpr double a = 1013904223.0, b = 0;
    static constexpr double tol = 0;                        // relative, for `test`
};
struct OpLOP3 {             // LOP3: any logic function of three inputs, here (x & y) ^ a
    using T = unsigned;     // with y the neighbouring chain; a chain of (x ^ a) & b alone would
                            // collapse, since applying it twice gives x & b
    static constexpr const char* name = "LOP3"; static constexpr double expect = 64;
    __device__ static T make(double v) { return (unsigned)v; }
    __device__ static T step(T x, T a, T, T y) { return (x & y) ^ a; }
    static double ref(double x, double a, double, double y) { return (double)(((unsigned)x & (unsigned)y) ^ (unsigned)a); }
    static double x0(int i) { return 777.0 + 1031.0 * i; }
    static constexpr double a = 1540483477.0, b = 0;
    static constexpr double tol = 0;                        // relative, for `test`
};
struct OpSHFL {             // SHFL: swap with the neighbouring lane
    using T = float;
    static constexpr const char* name = "SHFL"; static constexpr double expect = 32;
    __device__ static T make(double v) { return (float)v; }
    __device__ static T step(T x, T, T, T) { return __shfl_xor_sync(0xffffffffu, x, 1); }
    // Two swaps bring every value home, and every run makes an even number of steps.
    static double ref(double x, double, double, double) { return x; }
    static double x0(int i) { return 0.25 * i; }
    static constexpr double a = 0, b = 0;
    static constexpr double tol = 0;                        // relative, for `test`
};
struct OpEX2 {              // MUFU.EX2 on the SFU: 2^-x, so the values stay in (0.5, 1)
    using T = float;
    static constexpr const char* name = "MUFU.EX2"; static constexpr double expect = 16;
    __device__ static T make(double v) { return (float)v; }
    __device__ static T step(T x, T, T, T) { return ex2_approx(-x); }
    static double ref(double x, double, double, double) { return std::exp2(-x); }
    static double x0(int i) { return 0.5 + 1e-3 * i; }
    static constexpr double a = 0, b = 0;
    static constexpr double tol = 1e-4;                        // relative, for `test`
};
struct OpRSQ {              // MUFU.RSQ on the SFU: 1/sqrt(x), which converges to 1
    using T = float;
    static constexpr const char* name = "MUFU.RSQ"; static constexpr double expect = 16;
    __device__ static T make(double v) { return (float)v; }
    __device__ static T step(T x, T, T, T) { return rsqrt_approx(x); }
    static double ref(double x, double, double, double) { return 1.0 / std::sqrt(x); }
    static double x0(int i) { return 2.0 + 1e-3 * i; }
    static constexpr double a = 0, b = 0;
    static constexpr double tol = 1e-4;                        // relative, for `test`
};
struct OpPOPC {             // POPC (+ an IADD that keeps the bits changing): the IADD hides behind the POPC
    using T = unsigned;
    static constexpr const char* name = "POPC"; static constexpr double expect = 16;
    __device__ static T make(double v) { return (unsigned)v; }
    __device__ static T step(T x, T a, T, T) { return (unsigned)__popc(x) + a; }
    static double ref(double x, double a, double, double) { return (double)((unsigned)__builtin_popcount((unsigned)x) + (unsigned)a); }
    static double x0(int i) { return 4242.0 + i; }
    static constexpr double a = 2654435769.0, b = 0;
    static constexpr double tol = 0;                        // relative, for `test`
};
struct OpDFMA {             // DFMA: FP64 fused multiply-add, 2 per clock per SM on GeForce
    using T = double;
    static constexpr const char* name = "DFMA"; static constexpr double expect = 2;
    __device__ static T make(double v) { return v; }
    __device__ static T step(T x, T a, T b, T) { return fma(x, a, b); }
    static double ref(double x, double a, double b, double) { return std::fma(x, a, b); }
    static double x0(int i) { return 0.5 + 1e-3 * i; }
    static constexpr double a = 0.9999, b = 1e-4;
    static constexpr double tol = 1e-12;                        // relative, for `test`
};

// Value of one result, for the host check (the low half of a __half2).
inline double to_d(float v) { return v; }
inline double to_d(double v) { return v; }
inline double to_d(unsigned v) { return v; }
inline double to_d(__half2 v) { return (double)__low2float(v); }

// ---------------------------------------------------------------------------
// The kernel: ILP chains per thread, 64 steps per loop iteration (unrolled),
// so the loop's own instructions are a few percent of the total. Each step
// may also read the neighbouring chain (IMAD and LOP3 do, see above); that
// keeps a step's ILP instructions independent of each other, except the last.
// ---------------------------------------------------------------------------
template <class Op, int ILP>
__global__ void chains(typename Op::T* out, double x0, double dx, double a_, double b_, int iters, Stamp* st)
{
    using T = typename Op::T;
    constexpr int UNROLL = 64 / ILP;
    const T a = Op::make(a_), b = Op::make(b_);
    const unsigned tid = blockIdx.x * blockDim.x + threadIdx.x;
    T x[ILP];
#pragma unroll
    for (int j = 0; j < ILP; ++j) x[j] = Op::make(x0 + dx * (double)((threadIdx.x % 32) + 32 * j));
    stamp_begin(st);
    for (int i = 0; i < iters; ++i) {
#pragma unroll
        for (int u = 0; u < UNROLL; ++u)
#pragma unroll
            for (int j = 0; j < ILP; ++j) x[j] = Op::step(x[j], a, b, x[(j + 1) % ILP]);
    }
    stamp_end(st);
#pragma unroll
    for (int j = 0; j < ILP; ++j) out[(size_t)tid * ILP + j] = x[j];   // keeps every chain alive
}

// Experiment D: per group, one MUFU and K FFMAs, all independent of each other.
template <int K>
__global__ void mix(float* out, float a, float b, int iters, Stamp* st)
{
    float e = 0.5f + 1e-3f * (threadIdx.x % 32), acc[8];
#pragma unroll
    for (int j = 0; j < 8; ++j) acc[j] = 0.25f * j;
    stamp_begin(st);
    for (int i = 0; i < iters; ++i) {
#pragma unroll
        for (int g = 0; g < 8; ++g) {                 // 8 groups per iteration
            e = ex2_approx(-e);
#pragma unroll
            for (int k = 0; k < K; ++k) acc[k % 8] = fmaf(acc[k % 8], a, b);
        }
    }
    stamp_end(st);
    float s = e;
#pragma unroll
    for (int j = 0; j < 8; ++j) s += acc[j];
    out[blockIdx.x * blockDim.x + threadIdx.x] = s;
}

// ---------------------------------------------------------------------------
// Host side
// ---------------------------------------------------------------------------
struct Shape { int blocks, threads, iters; };

template <class Op, int ILP>
Run run_chains(const Shape& s, std::vector<double>* host_out = nullptr)
{
    using T = typename Op::T;
    size_t n = (size_t)s.blocks * s.threads * ILP;
    T* d_out; CUDA_CHECK(cudaMalloc(&d_out, n * sizeof(T)));
    Stamps st(s.blocks);
    chains<Op, ILP><<<s.blocks, s.threads>>>(d_out, Op::x0(0), Op::x0(1) - Op::x0(0), Op::a, Op::b, s.iters, st.d);
    CUDA_CHECK_LAUNCH(true);
    if (host_out) {
        std::vector<T> h(n);
        CUDA_CHECK(cudaMemcpy(h.data(), d_out, n * sizeof(T), cudaMemcpyDeviceToHost));
        host_out->resize(n);
        for (size_t i = 0; i < n; ++i) (*host_out)[i] = to_d(h[i]);
    }
    Run r = st.read(s.blocks);
    CUDA_CHECK(cudaFree(d_out));
    return r;
}

// Run the same chain on the host for every (thread, chain) and compare.
template <class Op, int ILP>
bool test_chains()
{
    Shape s{2, 64, 2};
    std::vector<double> got;
    run_chains<Op, ILP>(s, &got);
    const int steps = s.iters * 64 / ILP;              // steps per chain
    const double step0 = Op::x0(1) - Op::x0(0);
    double worst = 0;
    bool ok = true;
    for (int t = 0; t < s.blocks * s.threads; ++t) {
        double x[ILP];
        for (int j = 0; j < ILP; ++j) x[j] = Op::x0(0) + step0 * ((t % 32) + 32 * j);
        for (int k = 0; k < steps; ++k)
            for (int j = 0; j < ILP; ++j) x[j] = Op::ref(x[j], Op::a, Op::b, x[(j + 1) % ILP]);
        for (int j = 0; j < ILP; ++j) {
            double g = got[(size_t)t * ILP + j];
            double err = std::fabs(g - x[j]) / std::max(1.0, std::fabs(x[j]));
            worst = std::max(worst, err);
            if (!(err <= Op::tol)) ok = false;
        }
    }
    std::printf("  %-9s ILP %d: %s (max rel err %.2g)\n", Op::name, ILP, ok ? "PASS" : "FAIL", worst);
    return ok;
}

// A: one warp, one chain. Cycles per step = latency.
template <class Op>
double latency(int iters)
{
    Run r = run_chains<Op, 1>(Shape{1, 32, iters});
    return r.cycles / ((double)iters * 64);
}

// B: one full wave (6 blocks of 256 threads per SM = 48 warps), 8 chains each.
// Results per clock per SM = steps / (kernel cycles x SMs).
template <class Op>
double throughput(int sms, double* ghz = nullptr)
{
    int iters = std::max(16, (int)(16384 * Op::expect / 128));   // ~10-20 ms per kernel on a 5070
    Shape s{sms * 6, 256, iters};
    run_chains<Op, 8>(Shape{sms * 6, 256, std::max(1, iters / 8)});   // warm-up: clocks up, code loaded
    Run r = run_chains<Op, 8>(s);
    if (ghz) *ghz = r.ghz;
    double steps = (double)s.blocks * s.threads * s.iters * 64;
    return steps / (r.cycles * sms);
}

// C: 4*w warps per SM (w per scheduler), ILP chains each: one block per SM,
// or two when 4*w warps would exceed the 1,024-thread block limit.
template <int ILP>
double fma_fraction(int sms, int w)
{
    int iters = 49152 / w, per_sm = w > 8 ? 2 : 1;
    Shape s{sms * per_sm, 128 * w / per_sm, iters};
    Run r = run_chains<OpFFMA, ILP>(s);
    double steps = (double)s.blocks * s.threads * s.iters * 64;
    return steps / (r.cycles * sms) / 128.0;
}

// D: cycles per group (1 MUFU + K FFMA) per scheduler, with 12 warps per
// scheduler (two blocks of 768 threads per SM).
template <int K>
double mix_cycles(int sms, bool check = false)
{
    const int threads = check ? 64 : 768, blocks = check ? 1 : 2 * sms, iters = check ? 2 : 4096;
    float* d_out; CUDA_CHECK(cudaMalloc(&d_out, sizeof(float) * blocks * threads));
    Stamps st(blocks);
    mix<K><<<blocks, threads>>>(d_out, 0.9999f, 1e-4f, iters, st.d);
    CUDA_CHECK_LAUNCH(true);
    if (check) {   // thread t: e after 16 exps, accumulators after their FFMAs
        std::vector<float> h(blocks * threads);
        CUDA_CHECK(cudaMemcpy(h.data(), d_out, sizeof(float) * h.size(), cudaMemcpyDeviceToHost));
        bool ok = true;
        for (int t = 0; t < threads; ++t) {
            double e = 0.5f + 1e-3f * (t % 32), acc[8];
            for (int j = 0; j < 8; ++j) acc[j] = 0.25 * j;
            for (int g = 0; g < iters * 8; ++g) { e = std::exp2(-e); for (int k = 0; k < K; ++k) acc[k % 8] = acc[k % 8] * 0.9999 + 1e-4; }
            double s = e; for (int j = 0; j < 8; ++j) s += acc[j];
            if (std::fabs(h[t] - s) > 1e-4 * std::max(1.0, std::fabs(s))) ok = false;
        }
        CUDA_CHECK(cudaFree(d_out));
        return ok ? 0 : -1;
    }
    Run r = st.read(blocks);
    CUDA_CHECK(cudaFree(d_out));
    double groups_per_sched = 12.0 * iters * 8;
    return r.cycles / groups_per_sched;
}

static int run_test()
{
    std::printf("pipes test: every chain against a host reference\n");
    bool ok = true;
    ok &= test_chains<OpFFMA, 1>();  ok &= test_chains<OpFFMA, 8>();
    ok &= test_chains<OpHFMA2, 8>(); ok &= test_chains<OpIMAD, 8>();
    ok &= test_chains<OpLOP3, 8>();  ok &= test_chains<OpSHFL, 8>();
    ok &= test_chains<OpEX2, 1>();   ok &= test_chains<OpEX2, 8>();
    ok &= test_chains<OpRSQ, 8>();   ok &= test_chains<OpPOPC, 8>();
    ok &= test_chains<OpDFMA, 1>();  ok &= test_chains<OpDFMA, 8>();
    bool mok = mix_cycles<0>(1, true) == 0 && mix_cycles<3>(1, true) == 0 && mix_cycles<12>(1, true) == 0;
    std::printf("  mix (1 MUFU + k FFMA): %s\n", mok ? "PASS" : "FAIL");
    ok &= mok;
    std::printf("PASTE: lab04b pipes test %s\n", ok ? "PASS" : "FAIL");
    return ok ? 0 : 1;
}

template <class Op>
void row_b(int sms, std::string& paste, double* ghz_out)
{
    double ghz = 0, r = throughput<Op>(sms, &ghz);
    std::printf("  %-9s %7.1f   (table: %3.0f)   clock %.2f GHz\n", Op::name, r, Op::expect, ghz);
    char b[64]; std::snprintf(b, sizeof b, " %s=%.1f", Op::name, r); paste += b;
    *ghz_out = ghz;
}

static int run_bench()
{
    DevicePeaks d = query_device_peaks();
    print_device_peaks(d);
    const int sms = d.sm_count;
    std::string paste = "PASTE: lab04b pipes";
    char b[96];

    std::printf("\nA. Latency: one warp, one dependent chain (cycles per step)\n");
    double la[6] = {latency<OpFFMA>(2048), latency<OpIMAD>(2048), latency<OpEX2>(1024),
                    latency<OpRSQ>(1024), latency<OpDFMA>(256), latency<OpSHFL>(1024)};
    const char* ln[6] = {"FFMA", "IMAD", "MUFU.EX2", "MUFU.RSQ", "DFMA", "SHFL"};
    paste += " | A";
    for (int i = 0; i < 6; ++i) {
        std::printf("  %-9s %6.1f\n", ln[i], la[i]);
        std::snprintf(b, sizeof b, " %s=%.1f", ln[i], la[i]); paste += b;
    }

    std::printf("\nB. Throughput: results per clock per SM (48 warps per SM, 8 chains per thread)\n");
    double ghz = 0;
    paste += " | B";
    row_b<OpFFMA>(sms, paste, &ghz);  row_b<OpHFMA2>(sms, paste, &ghz); row_b<OpIMAD>(sms, paste, &ghz);
    row_b<OpLOP3>(sms, paste, &ghz);  row_b<OpSHFL>(sms, paste, &ghz);  row_b<OpEX2>(sms, paste, &ghz);
    row_b<OpRSQ>(sms, paste, &ghz);   row_b<OpPOPC>(sms, paste, &ghz);  row_b<OpDFMA>(sms, paste, &ghz);
    std::snprintf(b, sizeof b, " clk=%.2fGHz", ghz); paste += b;

    std::printf("\nC. FFMA throughput, %% of 128 per clock per SM\n  warps/scheduler   ILP 1   ILP 2   ILP 4\n");
    paste += " | C";
    for (int w : {1, 2, 3, 4, 6, 8, 12}) {
        double f1 = fma_fraction<1>(sms, w), f2 = fma_fraction<2>(sms, w), f4 = fma_fraction<4>(sms, w);
        std::printf("  %15d   %4.0f%%   %4.0f%%   %4.0f%%\n", w, 100 * f1, 100 * f2, 100 * f4);
        std::snprintf(b, sizeof b, " %d:%.0f/%.0f/%.0f", w, 100 * f1, 100 * f2, 100 * f4); paste += b;
    }

    std::printf("\nD. One MUFU + k FFMA: cycles per group per scheduler (prediction: max(8, 1+k))\n");
    paste += " | D";
    double dk[] = {mix_cycles<0>(sms), mix_cycles<1>(sms), mix_cycles<2>(sms), mix_cycles<4>(sms), mix_cycles<6>(sms),
                   mix_cycles<7>(sms), mix_cycles<8>(sms), mix_cycles<10>(sms), mix_cycles<12>(sms), mix_cycles<16>(sms)};
    int ks[] = {0, 1, 2, 4, 6, 7, 8, 10, 12, 16};
    for (int i = 0; i < 10; ++i) {
        std::printf("  k = %2d   %5.1f   (predicted %d)\n", ks[i], dk[i], std::max(8, 1 + ks[i]));
        std::snprintf(b, sizeof b, " %d:%.1f", ks[i], dk[i]); paste += b;
    }
    std::printf("\n%s\n", paste.c_str());
    return 0;
}

int main(int argc, char** argv)
{
    require_cuda_device();
    std::string mode = argc > 1 ? argv[1] : "bench";
    if (mode == "test") return run_test();
    if (mode == "bench") return run_bench();
    std::fprintf(stderr, "usage: %s test|bench\n", argv[0]);
    return 2;
}
