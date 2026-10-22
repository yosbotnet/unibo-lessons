// Lab 09 - attention.cu: causal self-attention as three kernels, three ways (chapter 10).
//
//   ./attention test            every version vs a double-precision CPU reference, awkward shapes
//   ./attention bench [--T n] [--B n]   B = 1, H = 12, D = 64, T = 128 ... 4096 (or the one T given):
//                               per-kernel time, S bytes, share, GB/s, TFLOPS
//   ./attention waste [--T n]   full kernels vs tile skipping vs truncated softmax rows, T = 1024, 4096
//   ./attention profile [cublas|tiled|skip|naive] [--T n]   one attention at T = 1024: the run for ncu
//
// q, k, v come from a qkv[B*T, 3C] buffer in the engine's layout, the output is att[B*T, C],
// S[B*H][T][T] is scratch. The kernels are in attn_naive.h:
//   v1 naive    one thread per score / per output element; softmax_warp_online in between
//   v2 tiled    16 x 16 shared-memory tiles with the batch index (full square)
//   v2 skip     the same, tiles above the diagonal skipped, softmax rows stop at the diagonal:
//               this is attn_prefill_naive, the engine-ready entry point
//   v3 cuBLAS   cublasSgemmStridedBatched for both matmuls, the softmax applying the mask

#include <string>
#include "attn_naive.h"

// ---------------------------------------------------------------------------
// CPU reference in double, the same convention as ../gpt2/cpu_ref.h:
// att[b*T + i][h*D + d] = sum_{j <= i} softmax_j(q_i . k_j / sqrt(D)) v_j[d].
// ---------------------------------------------------------------------------
static void cpu_attention(const float* qkv, float* att, int B, int T, int H, int D)
{
    const int C = H * D;
    const double scale = 1.0 / std::sqrt((double)D);
    std::vector<double> s(T);
    for (int b = 0; b < B; ++b)
        for (int h = 0; h < H; ++h)
            for (int i = 0; i < T; ++i) {
                const float* q = qkv + ((size_t)b * T + i) * 3 * C + h * D;
                double m = -1e300;
                for (int j = 0; j <= i; ++j) {
                    const float* k = qkv + ((size_t)b * T + j) * 3 * C + C + h * D;
                    double d = 0;
                    for (int e = 0; e < D; ++e) d += (double)q[e] * k[e];
                    s[j] = d * scale;
                    m = std::max(m, s[j]);
                }
                double sum = 0;
                for (int j = 0; j <= i; ++j) { s[j] = std::exp(s[j] - m); sum += s[j]; }
                for (int e = 0; e < D; ++e) {
                    double o = 0;
                    for (int j = 0; j <= i; ++j) o += s[j] * qkv[((size_t)b * T + j) * 3 * C + 2 * C + h * D + e];
                    att[((size_t)b * T + i) * C + h * D + e] = (float)(o / sum);
                }
            }
}

// ---------------------------------------------------------------------------
// The versions, each split into its three launches so that bench can time them
// one by one.
// ---------------------------------------------------------------------------
struct Shape { int B, T, H, D; };
using Step = void (*)(const float* qkv, float* S, float* att, Shape p);

struct Impl {
    const char* name;
    const char* tag;
    Step scores, softmax, pv;
};

static void sc_naive(const float* qkv, float* S, float*, Shape p)  { launch_scores_naive(qkv, S, p.B, p.T, p.H, p.D); }
static void sc_tiled(const float* qkv, float* S, float*, Shape p)  { launch_scores_tiled<false>(qkv, S, p.B, p.T, p.H, p.D); }
static void sc_skip(const float* qkv, float* S, float*, Shape p)   { launch_scores_tiled<true>(qkv, S, p.B, p.T, p.H, p.D); }
static void sc_cublas(const float* qkv, float* S, float*, Shape p) { attn_scores_cublas(qkv, S, p.B, p.T, p.H, p.D, 1.0f / sqrtf((float)p.D)); }
static void sm_full(const float*, float* S, float*, Shape p)       { launch_softmax(S, p.B, p.T, p.H, MASK_NONE); }
static void sm_trunc(const float*, float* S, float*, Shape p)      { launch_softmax(S, p.B, p.T, p.H, MASK_TRUNCATED); }
static void sm_causal(const float*, float* S, float*, Shape p)     { launch_softmax(S, p.B, p.T, p.H, MASK_CAUSAL); }
static void pv_naive(const float* qkv, float* S, float* att, Shape p)  { launch_pv_naive(S, qkv, att, p.B, p.T, p.H, p.D); }
static void pv_tiled(const float* qkv, float* S, float* att, Shape p)  { launch_pv_tiled<false>(S, qkv, att, p.B, p.T, p.H, p.D); }
static void pv_skip(const float* qkv, float* S, float* att, Shape p)   { launch_pv_tiled<true>(S, qkv, att, p.B, p.T, p.H, p.D); }
static void pv_cublas(const float* qkv, float* S, float* att, Shape p) { attn_pv_cublas(S, qkv, att, p.B, p.T, p.H, p.D); }

static const Impl IMPLS[] = {
    {"v1 naive",            "naive",  sc_naive,  sm_full,   pv_naive},
    {"v2 tiled",            "tiled",  sc_tiled,  sm_full,   pv_tiled},
    {"v2 tiled + skip",     "skip",   sc_skip,   sm_trunc,  pv_skip},
    {"v3 cuBLAS batched",   "cublas", sc_cublas, sm_causal, pv_cublas},
};
static const Impl& impl(const char* tag)
{
    for (const Impl& i : IMPLS) if (std::strcmp(i.tag, tag) == 0) return i;
    std::fprintf(stderr, "unknown implementation '%s' (naive, tiled, skip, cublas)\n", tag);
    std::exit(2);
}

static void run_impl(const Impl& im, const float* qkv, float* S, float* att, Shape p)
{
    im.scores(qkv, S, att, p);
    im.softmax(qkv, S, att, p);
    im.pv(qkv, S, att, p);
}

// Device buffers for one shape: random qkv, S scratch, att.
struct Bufs {
    float *qkv = nullptr, *S = nullptr, *att = nullptr;
    std::vector<float> h_qkv;
    Shape p;
    explicit Bufs(Shape p_, uint32_t seed = 1234) : p(p_)
    {
        size_t nq = (size_t)p.B * p.T * 3 * p.H * p.D;
        h_qkv.resize(nq);
        fill_random(h_qkv.data(), nq, seed);
        CUDA_CHECK(cudaMalloc(&qkv, nq * sizeof(float)));
        CUDA_CHECK(cudaMemcpy(qkv, h_qkv.data(), nq * sizeof(float), cudaMemcpyHostToDevice));
        CUDA_CHECK(cudaMalloc(&S, attn_prefill_naive_scratch_bytes(p.B, p.T, p.H, p.D)));
        CUDA_CHECK(cudaMalloc(&att, (size_t)p.B * p.T * p.H * p.D * sizeof(float)));
    }
    ~Bufs() { cudaFree(qkv); cudaFree(S); cudaFree(att); }
    size_t n_att() const { return (size_t)p.B * p.T * p.H * p.D; }
};

// ---------------------------------------------------------------------------
// test
// ---------------------------------------------------------------------------
static int run_test()
{
    const Shape shapes[] = {{1, 1, 1, 8}, {1, 5, 2, 8}, {2, 16, 2, 16}, {1, 37, 3, 16},
                            {2, 64, 4, 64}, {1, 128, 12, 64}, {3, 70, 2, 32}};
    bool all_ok = true;
    for (const Shape& p : shapes) {
        Bufs bf(p, 1000 + p.T);
        std::vector<float> ref(bf.n_att()), got(bf.n_att());
        cpu_attention(bf.h_qkv.data(), ref.data(), p.B, p.T, p.H, p.D);
        std::printf("B=%d T=%-4d H=%-2d D=%-2d\n", p.B, p.T, p.H, p.D);
        auto check = [&](const char* name) {
            CUDA_CHECK_LAUNCH(true);
            CUDA_CHECK(cudaMemcpy(got.data(), bf.att, got.size() * sizeof(float), cudaMemcpyDeviceToHost));
            CompareResult r = compare(ref.data(), got.data(), got.size(), 1e-4, 1e-4);
            std::printf("  %-34s ", name);
            print_compare(r);
            std::printf("\n");
            all_ok = all_ok && r.pass;
        };
        for (const Impl& im : IMPLS) {
            // Poison S and att first, so a kernel that skips something it should write shows up.
            CUDA_CHECK(cudaMemset(bf.S, 0x7f, attn_prefill_naive_scratch_bytes(p.B, p.T, p.H, p.D)));
            CUDA_CHECK(cudaMemset(bf.att, 0x7f, bf.n_att() * sizeof(float)));
            run_impl(im, bf.qkv, bf.S, bf.att, p);
            check(im.name);
        }
        CUDA_CHECK(cudaMemset(bf.S, 0x7f, attn_prefill_naive_scratch_bytes(p.B, p.T, p.H, p.D)));
        CUDA_CHECK(cudaMemset(bf.att, 0x7f, bf.n_att() * sizeof(float)));
        attn_prefill_naive(bf.qkv, bf.att, p.B, p.T, p.H, p.D, bf.S, 0);
        check("attn_prefill_naive (engine entry)");
    }
    std::printf("PASTE: lab09 attention test %s\n", all_ok ? "PASS" : "FAIL");
    return all_ok ? 0 : 1;
}

// ---------------------------------------------------------------------------
// bench
// ---------------------------------------------------------------------------
struct KTimes { double scores, softmax, pv, total; };

static KTimes time_impl(const Impl& im, Bufs& bf)
{
    Shape p = bf.p;
    bool slow = im.scores == sc_naive && p.T >= 2048;
    int reps = slow ? 5 : 20, warm = slow ? 1 : 3;
    // Run once in order so S holds probabilities before the PV kernel is timed alone.
    run_impl(im, bf.qkv, bf.S, bf.att, p);
    KTimes t;
    t.scores  = time_gpu([&] { im.scores(bf.qkv, bf.S, bf.att, p); }, warm, reps).median_ms * 1e3;
    t.softmax = time_gpu([&] { im.softmax(bf.qkv, bf.S, bf.att, p); }, warm, reps).median_ms * 1e3;
    t.pv      = time_gpu([&] { im.pv(bf.qkv, bf.S, bf.att, p); }, warm, reps).median_ms * 1e3;
    t.total   = time_gpu([&] { run_impl(im, bf.qkv, bf.S, bf.att, p); }, warm, reps).median_ms * 1e3;
    return t;
}

static int run_bench(int only_T, int B)
{
    int dev = require_cuda_device();
    DevicePeaks pk = query_device_peaks(dev);
    print_device_peaks(pk);
    const int H = 12, D = 64;
    std::vector<int> Ts = {128, 256, 512, 1024, 2048, 4096};
    if (only_T > 0) Ts = {only_T};
    std::printf("\nB = %d, H = %d, D = %d, FP32. Ideal bytes: scores = read Q, K + write S; softmax = 2 x S;\n"
                "PV = read S + V + write O. FLOPs per matmul = 2 B H T^2 D (the full square).\n", B, H, D);
    for (int T : Ts) {
        Shape p{B, T, H, D};
        double Sb = (double)B * H * T * T * 4, opb = (double)B * T * H * D * 4;   // S; one of Q, K, V, O
        double by_sc = 2 * opb + Sb, by_sm = 2 * Sb, by_pv = Sb + 2 * opb, fl = 2.0 * B * H * T * T * D;
        Bufs bf(p);
        std::printf("\nT = %d   S = %.1f MB (B*H*T*T*4)\n", T, Sb / 1e6);
        std::printf("  %-20s %10s %10s %10s %10s   %-17s %-23s %s\n", "version", "scores us", "softmax us",
                    "pv us", "total us", "share sc/sm/pv", "GB/s sc/sm/pv", "TFLOPS sc/pv");
        KTimes all[4];
        int k = 0;
        for (const Impl& im : IMPLS) {
            KTimes t = time_impl(im, bf);
            all[k++] = t;
            double sum = t.scores + t.softmax + t.pv;
            std::printf("  %-20s %10.1f %10.1f %10.1f %10.1f   %3.0f/%3.0f/%3.0f %%     %5.0f/%5.0f/%5.0f       %5.2f/%5.2f\n",
                        im.name, t.scores, t.softmax, t.pv, t.total,
                        100 * t.scores / sum, 100 * t.softmax / sum, 100 * t.pv / sum,
                        by_sc / t.scores / 1e3, by_sm / t.softmax / 1e3, by_pv / t.pv / 1e3,
                        fl / t.scores / 1e6, fl / t.pv / 1e6);
        }
        std::printf("  roofline at 590 GB/s and 30.9 TFLOPS: scores %.1f us, softmax %.1f us, pv %.1f us\n",
                    std::max(by_sc / 590e3, fl / 30.9e6), by_sm / 590e3, std::max(by_pv / 590e3, fl / 30.9e6));
        const KTimes &tn = all[0], &tt = all[1], &tc = all[3];
        std::printf("PASTE: lab09 attention T=%d S_MB=%.1f cublas: scores=%.0f softmax=%.0f pv=%.0f total=%.0f | tiled: total=%.0f | naive: total=%.0f\n",
                    T, Sb / 1e6, tc.scores, tc.softmax, tc.pv, tc.total, tt.total, tn.total);
    }
    return 0;
}

// ---------------------------------------------------------------------------
// waste: what the causal mask is worth when the kernels stop computing it
// ---------------------------------------------------------------------------
static int run_waste(int only_T)
{
    int dev = require_cuda_device();
    print_device_peaks(query_device_peaks(dev));
    std::vector<int> Ts = {1024, 4096};
    if (only_T > 0) Ts = {only_T};
    for (int T : Ts) {
        Shape p{1, T, 12, 64};
        Bufs bf(p);
        KTimes full = time_impl(impl("tiled"), bf), skip = time_impl(impl("skip"), bf);
        auto pct = [](double a, double b) { return 100.0 * (a - b) / a; };
        int n = (T + AT - 1) / AT;
        long dead = (long)n * (n - 1) / 2;
        std::printf("\nT = %d: %d x %d tiles of 16 x 16, %ld dead (%.1f%%), %d on the diagonal\n",
                    T, n, n, dead, 100.0 * dead / ((double)n * n), n);
        std::printf("  %-10s %12s %12s %8s\n", "kernel", "full us", "skip us", "saving");
        std::printf("  %-10s %12.1f %12.1f %7.1f%%\n", "scores", full.scores, skip.scores, pct(full.scores, skip.scores));
        std::printf("  %-10s %12.1f %12.1f %7.1f%%   (full rows vs rows truncated at the diagonal)\n",
                    "softmax", full.softmax, skip.softmax, pct(full.softmax, skip.softmax));
        std::printf("  %-10s %12.1f %12.1f %7.1f%%\n", "pv", full.pv, skip.pv, pct(full.pv, skip.pv));
        std::printf("  %-10s %12.1f %12.1f %7.1f%%\n", "total", full.total, skip.total, pct(full.total, skip.total));
        std::printf("PASTE: lab09 waste T=%d scores=%.0f softmax=%.0f pv=%.0f total=%.0f\n", T,
                    pct(full.scores, skip.scores), pct(full.softmax, skip.softmax), pct(full.pv, skip.pv),
                    pct(full.total, skip.total));
    }
    return 0;
}

// ---------------------------------------------------------------------------
// profile: one attention at T = 1024 (or --T), B = 1, H = 12, D = 64, no warm-up, so
// that ncu sees exactly the three kernels of one version (cuBLAS by default).
// ---------------------------------------------------------------------------
static int run_profile(const char* tag, int T)
{
    require_cuda_device();
    Shape p{1, T > 0 ? T : 1024, 12, 64};
    Bufs bf(p);
    cublas_handle();                       // create the handle before the profiled launches
    CUDA_CHECK(cudaDeviceSynchronize());
    run_impl(impl(tag), bf.qkv, bf.S, bf.att, p);
    CUDA_CHECK_LAUNCH(true);
    double Sb = 12.0 * p.T * p.T * 4;
    std::printf("profile: %s at T = %d: S = %.1f MB; 4 x S = %.1f MB; Q, K, V, O = %.1f MB each\n",
                impl(tag).name, p.T, Sb / 1e6, 4 * Sb / 1e6, p.T * 768.0 * 4 / 1e6);
    return 0;
}

int main(int argc, char** argv)
{
    std::string mode = argc > 1 ? argv[1] : "test";
    int T = 0, B = 1;
    const char* tag = "cublas";
    for (int i = 2; i < argc; ++i) {
        std::string a = argv[i];
        if (a == "--T" && i + 1 < argc) T = std::atoi(argv[++i]);
        else if (a == "--B" && i + 1 < argc) B = std::atoi(argv[++i]);
        else tag = argv[i];
    }
    if (mode == "test") return run_test();
    if (mode == "bench") return run_bench(T, B);
    if (mode == "waste") return run_waste(T);
    if (mode == "profile") return run_profile(tag, T);
    std::fprintf(stderr, "usage: %s test | bench [--T n] [--B n] | waste [--T n] | profile [cublas|tiled|skip|naive] [--T n]\n", argv[0]);
    return 2;
}
