// decode.cu - lab 14: decode attention, one query row per (sequence, head) against the KV cache.
// Chapter 15 of the ML Systems course.
//
//   ./decode test            kv_append, then v1..v5 (+ v3b, the engine wrapper, v6 if clusters exist)
//                            against a double-precision CPU reference: PASS / FAIL per kernel and shape
//   ./decode bench           B = 1, 4, 16 x T = 1k, 4k, 16k, 32k (H = 12, D = 64): us, GB/s, % of 672
//   ./decode bench-one B T   each kernel once at one shape (for ncu)
//   ./decode ragged          B = 4 with T_ctx = 512, 2048, 4096, 32768 in one launch (the stretch)
//   ./decode nofence         v3b 200 times at B = 1, H = 12, T = 4096; build with -DNOFENCE to remove
//                            its fences (make nofence) and count the wrong answers
//
// Checked for correctness on cudasim (dev/cudasim/run.sh decode.cu test); never run on a GPU here.
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>
#include <cuda_runtime.h>
#include <cuda_fp16.h>

#include "check.h"
#include "bench.h"
#include "decode_kernels.h"
#include "decode_engine.h"
#include "kv_cache.h"

constexpr int D = 64;
constexpr double PEAK_GBS = 672.0;

// ---------------------------------------------------------------------------
// CPU reference in double. Query head hq reads kv head hq / g (g = H_q / H_kv; g = 1 without GQA).
// q of (b, hq) at q[b*q_stride + hq*D]; caches [B][H_kv][T_max][D]; out [B][H_q][D].
// T_arr (optional): one context length per sequence.
// ---------------------------------------------------------------------------
static void attn_decode_ref(const float* q, int q_stride, const float* kc, const float* vc, float* out,
                            int B, int H_q, int H_kv, int T_ctx, const int* T_arr, int T_max)
{
    const int g = H_q / H_kv;
    std::vector<double> s;
    for (int b = 0; b < B; ++b)
        for (int hq = 0; hq < H_q; ++hq) {
            const int T = T_arr ? T_arr[b] : T_ctx, hk = hq / g;
            const float* qr = q + (size_t)b * q_stride + hq * D;
            const float* K = kc + ((size_t)b * H_kv + hk) * T_max * D;
            const float* V = vc + ((size_t)b * H_kv + hk) * T_max * D;
            s.assign(T, 0.0);
            double mx = -INFINITY;
            for (int j = 0; j < T; ++j) {
                double acc = 0.0;
                for (int d = 0; d < D; ++d) acc += (double)qr[d] * K[(size_t)j * D + d];
                s[j] = acc / std::sqrt((double)D);
                mx = std::max(mx, s[j]);
            }
            double l = 0.0;
            for (int j = 0; j < T; ++j) { s[j] = std::exp(s[j] - mx); l += s[j]; }
            for (int d = 0; d < D; ++d) {
                double o = 0.0;
                for (int j = 0; j < T; ++j) o += s[j] * V[(size_t)j * D + d];
                out[((size_t)b * H_q + hq) * D + d] = (float)(o / l);
            }
        }
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
template <typename T> T* dalloc(size_t n) { T* p = nullptr; CUDA_CHECK(cudaMalloc(&p, n * sizeof(T))); return p; }
template <typename T> void up(T* d, const std::vector<T>& h) { CUDA_CHECK(cudaMemcpy(d, h.data(), h.size() * sizeof(T), cudaMemcpyHostToDevice)); }
template <typename T> void down(std::vector<T>& h, const T* d) { CUDA_CHECK(cudaMemcpy(h.data(), d, h.size() * sizeof(T), cudaMemcpyDeviceToHost)); }

static int g_fail = 0, g_checks = 0;

// Compare att [B][H][D] with the reference; one line per check.
static void report(const char* kernel, const char* shape, const std::vector<float>& ref, const std::vector<float>& got,
                   int H, double atol, double rtol)
{
    CompareResult r = compare(ref.data(), got.data(), ref.size(), atol, rtol);
    ++g_checks;
    if (r.pass) { std::printf("PASS %-18s %s  max_err %.2e\n", kernel, shape, r.max_abs_err); return; }
    ++g_fail;
    size_t i = r.first_bad;
    if (std::isnan(r.got_value)) r.max_abs_err = NAN;                  // compare() skips NaNs in its max
    std::printf("FAIL %-18s %s  max_err %.2e  first bad b=%zu h=%zu d=%zu (ref %.6g, got %.6g)\n", kernel, shape,
                r.max_abs_err, i / ((size_t)H * D), (i / D) % H, i % D, (double)r.ref_value, (double)r.got_value);
}

// Launch split-K v3 with S splits: DIRECT when S == 1, else split + combine. out_partials: scratch.
static void run_v3(const float* qkv, int stride, const float* kc, const float* vc, float* att, float* scratch,
                   int B, int H, int T_ctx, const int* T_arr, int T_max, int S, cudaStream_t s = nullptr)
{
    if (S == 1) {
        decode_v3_split<D, true><<<dim3(B * H, 1), DEC_BLOCK, 0, s>>>(qkv, stride, kc, vc, att, H, T_ctx, T_arr, T_max, 1);
        return;
    }
    decode_v3_split<D, false><<<dim3(B * H, S), DEC_BLOCK, 0, s>>>(qkv, stride, kc, vc, scratch, H, T_ctx, T_arr, T_max, S);
    decode_combine<D><<<B * H, D, 0, s>>>(scratch, att, H, S);
}
static void run_v4(const float* qkv, int stride, const __half* kc, const __half* vc, float* att, float* scratch,
                   int B, int H, int T_ctx, int T_max, int S, cudaStream_t s = nullptr)
{
    if (S == 1) {
        decode_v4_half<D, true><<<dim3(B * H, 1), DEC_BLOCK, 0, s>>>(qkv, stride, kc, vc, att, H, T_ctx, T_max, 1);
        return;
    }
    decode_v4_half<D, false><<<dim3(B * H, S), DEC_BLOCK, 0, s>>>(qkv, stride, kc, vc, scratch, H, T_ctx, T_max, S);
    decode_combine<D><<<B * H, D, 0, s>>>(scratch, att, H, S);
}
template <int G>
static void run_v5g(const float* qkv, int stride, const float* kc, const float* vc, float* att, float* scratch,
                    int B, int H_kv, int T_ctx, int T_max, int S, cudaStream_t s)
{
    if (S == 1) {
        decode_v5_gqa<D, G, true><<<dim3(B * H_kv, 1), DEC_BLOCK, 0, s>>>(qkv, stride, kc, vc, att, H_kv, T_ctx, T_max, 1);
        return;
    }
    decode_v5_gqa<D, G, false><<<dim3(B * H_kv, S), DEC_BLOCK, 0, s>>>(qkv, stride, kc, vc, scratch, H_kv, T_ctx, T_max, S);
    decode_combine<D><<<B * H_kv * G, D, 0, s>>>(scratch, att, H_kv * G, S);
}
static void run_v5(const float* qkv, int stride, const float* kc, const float* vc, float* att, float* scratch,
                   int B, int H_q, int H_kv, int T_ctx, int T_max, int S, cudaStream_t s = nullptr)
{
    switch (H_q / H_kv) {
    case 1: run_v5g<1>(qkv, stride, kc, vc, att, scratch, B, H_kv, T_ctx, T_max, S, s); break;
    case 2: run_v5g<2>(qkv, stride, kc, vc, att, scratch, B, H_kv, T_ctx, T_max, S, s); break;
    case 4: run_v5g<4>(qkv, stride, kc, vc, att, scratch, B, H_kv, T_ctx, T_max, S, s); break;
    case 8: run_v5g<8>(qkv, stride, kc, vc, att, scratch, B, H_kv, T_ctx, T_max, S, s); break;
    default: std::fprintf(stderr, "v5: group size %d not instantiated (1, 2, 4, 8)\n", H_q / H_kv); std::exit(2);
    }
}
static void run_v3b(const float* qkv, int stride, const float* kc, const float* vc, float* att, float* scratch,
                    unsigned* counter, int B, int H, int T_ctx, int T_max, int S, cudaStream_t s = nullptr)
{
    decode_v3b_lastblock<D><<<dim3(B * H, S), DEC_BLOCK, 0, s>>>(qkv, stride, kc, vc, scratch, counter, att, H, T_ctx, T_max, S);
}

// v6: returns "" when it launched, else why it was skipped.
static std::string run_v6(const float* qkv, int stride, const float* kc, const float* vc, float* att,
                          int B, int H, int T_ctx, int T_max)
{
#if defined(CUDASIM)
    (void)qkv; (void)stride; (void)kc; (void)vc; (void)att; (void)B; (void)H; (void)T_ctx; (void)T_max;
    return "cudasim has no thread block clusters";
#elif !defined(LAB14_ARCH) || LAB14_ARCH < 90
    (void)qkv; (void)stride; (void)kc; (void)vc; (void)att; (void)B; (void)H; (void)T_ctx; (void)T_max;
    return "built for ARCH below sm_90: make ARCH=sm_120";
#else
    int major = 0;
    CUDA_CHECK(cudaDeviceGetAttribute(&major, cudaDevAttrComputeCapabilityMajor, 0));
    if (major < 9) return "device below compute capability 9.0";
    cudaLaunchConfig_t cfg = {};
    cfg.gridDim = dim3(DEC_CLUSTER, B * H, 1);
    cfg.blockDim = dim3(DEC_BLOCK, 1, 1);
    cfg.dynamicSmemBytes = 0;
    cfg.stream = nullptr;
    cudaLaunchAttribute attr[1];
    attr[0].id = cudaLaunchAttributeClusterDimension;
    attr[0].val.clusterDim.x = DEC_CLUSTER;
    attr[0].val.clusterDim.y = 1;
    attr[0].val.clusterDim.z = 1;
    cfg.attrs = attr;
    cfg.numAttrs = 1;
    int clusters = 0;
    cudaError_t e = cudaOccupancyMaxActiveClusters(&clusters, decode_v6_cluster<D>, &cfg);
    if (e != cudaSuccess) { cudaGetLastError(); return std::string("cudaOccupancyMaxActiveClusters failed: ") + cudaGetErrorString(e); }
    if (clusters == 0) return "cudaOccupancyMaxActiveClusters says 0 clusters of 8 fit";
    e = cudaLaunchKernelEx(&cfg, decode_v6_cluster<D>, qkv, stride, kc, vc, att, H, T_ctx, T_max);
    if (e != cudaSuccess) { cudaGetLastError(); return std::string("cluster launch failed: ") + cudaGetErrorString(e); }
    return "";
#endif
}

// ---------------------------------------------------------------------------
// test
// ---------------------------------------------------------------------------
struct Shape { int B, H, T_ctx, T_max; };

static void test_kv_append()
{
    const int B = 2, H = 3, C = H * D, T_max = 16;
    const size_t n = (size_t)B * H * T_max * D;
    std::vector<float> hk(n, -7.0f), hv(n, -7.0f);              // a sentinel where nothing was written
    float* kc = dalloc<float>(n); float* vc = dalloc<float>(n);
    up(kc, hk); up(vc, hv);
    struct Step { int T_new, pos0; } steps[2] = {{1, 7 - 1}, {5, 10}};   // T_ctx = 7: the new token at 6
    bool ok = true;
    for (int si = 0; si < 2; ++si) {
        const int T_new = steps[si].T_new, pos0 = steps[si].pos0;
        std::vector<float> hqkv((size_t)B * T_new * 3 * C);
        fill_random(hqkv.data(), hqkv.size(), 101u + si);
        float* dq = dalloc<float>(hqkv.size()); up(dq, hqkv);
        kv_append(dq, kc, vc, B, T_new, pos0, H, D, T_max, nullptr);
        CUDA_CHECK_LAUNCH(true);
        for (int b = 0; b < B; ++b) for (int t = 0; t < T_new; ++t) for (int h = 0; h < H; ++h) for (int d = 0; d < D; ++d) {
            const float* row = &hqkv[((size_t)b * T_new + t) * 3 * C];
            size_t dst = (((size_t)b * H + h) * T_max + pos0 + t) * D + d;
            hk[dst] = row[C + h * D + d]; hv[dst] = row[2 * C + h * D + d];
        }
        CUDA_CHECK(cudaFree(dq));
    }
    std::vector<float> gk(n), gv(n);
    down(gk, kc); down(gv, vc);
    size_t bad = n;
    for (size_t i = 0; i < n && bad == n; ++i) if (gk[i] != hk[i] || gv[i] != hv[i]) bad = i;
    ok = bad == n;
    ++g_checks;
    if (ok) std::printf("PASS %-18s B=2 H=3 T_max=16: T_new=1 at pos 6, T_new=5 at pos 10, every element\n", "kv_append");
    else {
        ++g_fail;
        std::printf("FAIL %-18s element %zu (b=%zu h=%zu p=%zu d=%zu): k ref %g got %g, v ref %g got %g\n", "kv_append", bad,
                    bad / ((size_t)H * T_max * D), (bad / ((size_t)T_max * D)) % H, (bad / D) % T_max, bad % D,
                    (double)hk[bad], (double)gk[bad], (double)hv[bad], (double)gv[bad]);
    }
    CUDA_CHECK(cudaFree(kc)); CUDA_CHECK(cudaFree(vc));
}

// The shapes of every check: awkward T_ctx, T_max > T_ctx, several heads and batches.
static void test_shape(const Shape& sh)
{
    const int B = sh.B, H = sh.H, T = sh.T_ctx, T_max = sh.T_max, C = H * D;
    const size_t n = (size_t)B * H * T_max * D;
    char shape[96];
    // cache: random in [-1, 1] below the new token, NaN poison at and beyond T_ctx (a read past the
    // context poisons the output); the new token's k, v come from qkv through kv_append, as in the engine
    std::vector<float> hk(n), hv(n);
    fill_random(hk.data(), n, 7u + T); fill_random(hv.data(), n, 9u + T);
    for (int bh = 0; bh < B * H; ++bh)
        for (int p = T - 1; p < T_max; ++p)
            for (int d = 0; d < D; ++d) { hk[((size_t)bh * T_max + p) * D + d] = NAN; hv[((size_t)bh * T_max + p) * D + d] = NAN; }
    std::vector<float> hqkv((size_t)B * 3 * C);
    fill_random(hqkv.data(), hqkv.size(), 11u + T);
    for (int b = 0; b < B; ++b) for (int e = 0; e < C; ++e) hqkv[(size_t)b * 3 * C + e] *= 0.5f;   // q scaled by 0.5
    float* kc = dalloc<float>(n); float* vc = dalloc<float>(n); float* qkv = dalloc<float>(hqkv.size());
    up(kc, hk); up(vc, hv); up(qkv, hqkv);
    kv_append(qkv, kc, vc, B, 1, T - 1, H, D, T_max, nullptr);
    CUDA_CHECK_LAUNCH(true);
    down(hk, kc); down(hv, vc);                                   // the reference reads exactly this cache
    std::vector<float> ref((size_t)B * H * D), got(ref.size());
    attn_decode_ref(hqkv.data(), 3 * C, hk.data(), hv.data(), ref.data(), B, H, H, T, nullptr, T_max);

    float* att = dalloc<float>(ref.size());
    float* scratch = dalloc<float>(attn_decode_split_scratch_bytes(B, T, H, D) / sizeof(float));
    unsigned* counter = dalloc<unsigned>(B * H);
    CUDA_CHECK(cudaMemset(counter, 0, B * H * sizeof(unsigned)));
    const double TOL = 1e-4;
    auto run_check = [&](const char* name, int S, auto launch, double tol) {
        CUDA_CHECK(cudaMemset(att, 0xFF, ref.size() * sizeof(float)));   // NaN: an unwritten output fails
        launch();
        CUDA_CHECK_LAUNCH(true);
        down(got, att);
        if (S > 0) std::snprintf(shape, sizeof shape, "B=%d H=%-2d T_ctx=%-4d T_max=%-4d S=%d", B, H, T, T_max, S);
        else       std::snprintf(shape, sizeof shape, "B=%d H=%-2d T_ctx=%-4d T_max=%-4d", B, H, T, T_max);
        report(name, shape, ref, got, H, tol, tol);
    };
    run_check("v1_twopass", 0, [&] { decode_v1_twopass<D><<<B * H, DEC_BLOCK>>>(qkv, 3 * C, kc, vc, att, H, T, T_max); }, TOL);
    run_check("v2_online", 0, [&] { decode_v2_online<D><<<B * H, DEC_BLOCK>>>(qkv, 3 * C, kc, vc, att, H, T, T_max); }, TOL);
    const int S_auto = choose_splits(B, H, T);
    for (int S : {S_auto, 2, 3, 7, DEC_S_MAX}) {
        run_check("v3_split", S, [&] { run_v3(qkv, 3 * C, kc, vc, att, scratch, B, H, T, nullptr, T_max, S); }, TOL);
    }
    run_check("engine split", S_auto, [&] { attn_decode_split(qkv, kc, vc, att, B, H, D, T, T_max, scratch, nullptr); }, TOL);
    for (int S : {S_auto, 7})
        run_check("v3b_lastblock", S, [&] { run_v3b(qkv, 3 * C, kc, vc, att, scratch, counter, B, H, T, T_max, S); }, TOL);
    {
        // the counter must be back at zero after every launch (the last block resets it)
        std::vector<unsigned> hc(B * H); down(hc, counter);
        bool zero = true; for (unsigned x : hc) zero = zero && x == 0;
        ++g_checks; if (!zero) ++g_fail;
        std::printf("%s %-18s B=%d H=%-2d T_ctx=%-4d counters reset by the last block\n", zero ? "PASS" : "FAIL", "v3b_counter", B, H, T);
    }
    {
        // v4: FP16 cache; the reference uses the FP16-rounded cache values
        __half* kh = dalloc<__half>(n); __half* vh = dalloc<__half>(n);
        cache_to_half(kc, kh, n); cache_to_half(vc, vh, n);
        CUDA_CHECK_LAUNCH(true);
        std::vector<__half> hh(n); std::vector<float> rk(n), rv(n), ref16(ref.size());
        down(hh, kh); for (size_t i = 0; i < n; ++i) rk[i] = __half2float(hh[i]);
        down(hh, vh); for (size_t i = 0; i < n; ++i) rv[i] = __half2float(hh[i]);
        attn_decode_ref(hqkv.data(), 3 * C, rk.data(), rv.data(), ref16.data(), B, H, H, T, nullptr, T_max);
        std::swap(ref, ref16);
        for (int S : {S_auto, 3})
            run_check("v4_half", S, [&] { run_v4(qkv, 3 * C, kh, vh, att, scratch, B, H, T, T_max, S); }, 2e-3);
        std::swap(ref, ref16);
        CUDA_CHECK(cudaFree(kh)); CUDA_CHECK(cudaFree(vh));
    }
    {
        std::string why = run_v6(qkv, 3 * C, kc, vc, att, B, H, T, T_max);
        if (why.empty()) {
            CUDA_CHECK_LAUNCH(true);
            run_check("v6_cluster", 8, [&] { run_v6(qkv, 3 * C, kc, vc, att, B, H, T, T_max); }, TOL);
        } else if (T == 1) std::printf("SKIP %-18s %s\n", "v6_cluster", why.c_str());
    }
    CUDA_CHECK(cudaFree(kc)); CUDA_CHECK(cudaFree(vc)); CUDA_CHECK(cudaFree(qkv));
    CUDA_CHECK(cudaFree(att)); CUDA_CHECK(cudaFree(scratch)); CUDA_CHECK(cudaFree(counter));
}

// v5: H_q query heads over H_kv cached heads. The GQA qkv row is [q: H_q*D | k: H_kv*D | v: H_kv*D].
static void test_gqa(int B, int H_q, int H_kv, int T, int T_max)
{
    const int stride = (H_q + 2 * H_kv) * D;
    const size_t n = (size_t)B * H_kv * T_max * D;
    std::vector<float> hk(n), hv(n), hq((size_t)B * stride);
    fill_random(hk.data(), n, 21u + T); fill_random(hv.data(), n, 23u + T); fill_random(hq.data(), hq.size(), 25u + T);
    for (auto& x : hq) x *= 0.5f;
    for (int bh = 0; bh < B * H_kv; ++bh)
        for (int p = T; p < T_max; ++p)
            for (int d = 0; d < D; ++d) { hk[((size_t)bh * T_max + p) * D + d] = NAN; hv[((size_t)bh * T_max + p) * D + d] = NAN; }
    std::vector<float> ref((size_t)B * H_q * D), got(ref.size());
    attn_decode_ref(hq.data(), stride, hk.data(), hv.data(), ref.data(), B, H_q, H_kv, T, nullptr, T_max);
    float* kc = dalloc<float>(n); float* vc = dalloc<float>(n); float* q = dalloc<float>(hq.size());
    up(kc, hk); up(vc, hv); up(q, hq);
    float* att = dalloc<float>(ref.size());
    float* scratch = dalloc<float>((size_t)B * H_q * DEC_S_MAX * (D + 2));
    const int S_auto = choose_splits(B, H_kv, T);
    char shape[96];
    for (int S : {S_auto, 5}) {
        CUDA_CHECK(cudaMemset(att, 0xFF, ref.size() * sizeof(float)));
        run_v5(q, stride, kc, vc, att, scratch, B, H_q, H_kv, T, T_max, S);
        CUDA_CHECK_LAUNCH(true);
        down(got, att);
        std::snprintf(shape, sizeof shape, "B=%d H=%-2d T_ctx=%-4d T_max=%-4d S=%d (H_kv=%d, g=%d)", B, H_q, T, T_max, S, H_kv, H_q / H_kv);
        report("v5_gqa", shape, ref, got, H_q, 1e-4, 1e-4);
    }
    CUDA_CHECK(cudaFree(kc)); CUDA_CHECK(cudaFree(vc)); CUDA_CHECK(cudaFree(q));
    CUDA_CHECK(cudaFree(att)); CUDA_CHECK(cudaFree(scratch));
}

// Ragged batch: one context length per sequence (the stretch's starting point).
static void test_ragged()
{
    const int B = 4, H = 2, C = H * D, T_max = 320;
    const int Ts[4] = {5, 40, 100, 300};
    const size_t n = (size_t)B * H * T_max * D;
    std::vector<float> hk(n), hv(n), hqkv((size_t)B * 3 * C);
    fill_random(hk.data(), n, 31u); fill_random(hv.data(), n, 33u); fill_random(hqkv.data(), hqkv.size(), 35u);
    for (int b = 0; b < B; ++b) for (int h = 0; h < H; ++h) for (int p = Ts[b]; p < T_max; ++p) for (int d = 0; d < D; ++d) {
        hk[(((size_t)b * H + h) * T_max + p) * D + d] = NAN; hv[(((size_t)b * H + h) * T_max + p) * D + d] = NAN;
    }
    std::vector<float> ref((size_t)B * H * D), got(ref.size());
    attn_decode_ref(hqkv.data(), 3 * C, hk.data(), hv.data(), ref.data(), B, H, H, 0, Ts, T_max);
    float* kc = dalloc<float>(n); float* vc = dalloc<float>(n); float* qkv = dalloc<float>(hqkv.size());
    int* dT = dalloc<int>(B);
    up(kc, hk); up(vc, hv); up(qkv, hqkv);
    CUDA_CHECK(cudaMemcpy(dT, Ts, sizeof Ts, cudaMemcpyHostToDevice));
    float* att = dalloc<float>(ref.size());
    float* scratch = dalloc<float>((size_t)B * H * DEC_S_MAX * (D + 2));
    char shape[96];
    for (int S : {choose_splits(B, H, 300), 5}) {
        CUDA_CHECK(cudaMemset(att, 0xFF, ref.size() * sizeof(float)));
        run_v3(qkv, 3 * C, kc, vc, att, scratch, B, H, 0, dT, T_max, S);
        CUDA_CHECK_LAUNCH(true);
        down(got, att);
        std::snprintf(shape, sizeof shape, "B=4 H=2  T_ctx=5,40,100,300 T_max=320 S=%d", S);
        report("v3_split ragged", shape, ref, got, H, 1e-4, 1e-4);
    }
    CUDA_CHECK(cudaFree(kc)); CUDA_CHECK(cudaFree(vc)); CUDA_CHECK(cudaFree(qkv)); CUDA_CHECK(cudaFree(dT));
    CUDA_CHECK(cudaFree(att)); CUDA_CHECK(cudaFree(scratch));
}

static int mode_test()
{
    std::printf("lab14 decode test: every kernel vs a double-precision CPU reference (D = 64, FP32 cache)\n");
    std::printf("tolerance |got - ref| <= 1e-4 + 1e-4 |ref| (FP32), 2e-3 + 2e-3 |ref| for v4 against the FP16-rounded cache\n");
    test_kv_append();
    const Shape shapes[] = {{1, 1, 1, 8}, {1, 2, 7, 16}, {2, 3, 100, 128}, {1, 12, 1000, 1024}, {3, 4, 4097, 4608}};
    for (const Shape& s : shapes) test_shape(s);
    for (const Shape& s : shapes) test_gqa(s.B, 12, 3, s.T_ctx, s.T_max);   // g = 4
    test_gqa(2, 4, 4, 100, 128);                                             // g = 1
    test_gqa(2, 8, 1, 1000, 1024);                                           // g = 8 (MQA-like)
    test_ragged();
    if (g_fail) { std::printf("%d of %d checks FAILED\n", g_fail, g_checks); return 1; }
    std::printf("ALL PASS (%d checks)\n", g_checks);
    std::printf("PASTE: lab14 test ALL PASS (%d checks)\n", g_checks);
    return 0;
}

// ---------------------------------------------------------------------------
// bench
// ---------------------------------------------------------------------------
// Fill a device array with pseudo-random values in [-1, 1) (an integer hash: no host copy of GBs).
__global__ void fill_hash(float* p, size_t n, unsigned seed)
{
    for (size_t i = (size_t)blockIdx.x * blockDim.x + threadIdx.x; i < n; i += (size_t)gridDim.x * blockDim.x) {
        unsigned x = (unsigned)i * 2654435761u ^ seed;
        x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16;
        p[i] = (float)(x >> 8) * (1.0f / 8388608.0f) - 1.0f;
    }
}
static void dfill(float* p, size_t n, unsigned seed)
{
    fill_hash<<<1024, 256>>>(p, n, seed);
    CUDA_CHECK_LAUNCH(true);
}
template <typename T> static T* try_alloc(size_t n)
{
    T* p = nullptr;
    if (cudaMalloc(&p, n * sizeof(T)) != cudaSuccess) { cudaGetLastError(); return nullptr; }
    return p;
}

struct BenchBufs {
    int B, T, H, H_kv;
    size_t n, n_kv;
    float *kc = nullptr, *vc = nullptr, *kg = nullptr, *vg = nullptr, *qkv = nullptr, *qg = nullptr, *att = nullptr, *scratch = nullptr;
    __half *kh = nullptr, *vh = nullptr;
    unsigned* counter = nullptr;
    bool ok = false;
    BenchBufs(int B_, int T_, int H_, int H_kv_) : B(B_), T(T_), H(H_), H_kv(H_kv_)
    {
        n = (size_t)B * H * T * D; n_kv = (size_t)B * H_kv * T * D;
        kc = try_alloc<float>(n); vc = try_alloc<float>(n);
        kh = try_alloc<__half>(n); vh = try_alloc<__half>(n);
        kg = try_alloc<float>(n_kv); vg = try_alloc<float>(n_kv);
        qkv = try_alloc<float>((size_t)B * 3 * H * D); qg = try_alloc<float>((size_t)B * (H + 2 * H_kv) * D);
        att = try_alloc<float>((size_t)B * H * D);
        scratch = try_alloc<float>(attn_decode_split_scratch_bytes(B, T, H, D) / sizeof(float));
        counter = try_alloc<unsigned>(B * H);
        ok = kc && vc && kh && vh && kg && vg && qkv && qg && att && scratch && counter;
        if (!ok) return;
        dfill(kc, n, 1u); dfill(vc, n, 2u); dfill(kg, n_kv, 3u); dfill(vg, n_kv, 4u);
        dfill(qkv, (size_t)B * 3 * H * D, 5u); dfill(qg, (size_t)B * (H + 2 * H_kv) * D, 6u);
        cache_to_half(kc, kh, n); cache_to_half(vc, vh, n);
        CUDA_CHECK(cudaMemset(counter, 0, B * H * sizeof(unsigned)));
        CUDA_CHECK_LAUNCH(true);
    }
    ~BenchBufs()
    {
        for (void* p : {(void*)kc, (void*)vc, (void*)kh, (void*)vh, (void*)kg, (void*)vg, (void*)qkv, (void*)qg,
                        (void*)att, (void*)scratch, (void*)counter})
            if (p) cudaFree(p);
    }
};

struct BenchRow { double us[7]; int S, S5; std::string v6; };

// Times every kernel at one shape (reps = 1, warmup = 0 for bench-one).
static BenchRow bench_shape(BenchBufs& z, int warm, int reps)
{
    const int B = z.B, T = z.T, H = z.H, Hk = z.H_kv, C = H * D;
    BenchRow r{};
    r.S = choose_splits(B, H, T); r.S5 = choose_splits(B, Hk, T);
    auto t = [&](auto f) { return 1e3 * time_gpu(f, warm, reps).median_ms; };
    r.us[0] = t([&] { decode_v1_twopass<D><<<B * H, DEC_BLOCK>>>(z.qkv, 3 * C, z.kc, z.vc, z.att, H, T, T); });
    r.us[1] = t([&] { decode_v2_online<D><<<B * H, DEC_BLOCK>>>(z.qkv, 3 * C, z.kc, z.vc, z.att, H, T, T); });
    r.us[2] = t([&] { run_v3(z.qkv, 3 * C, z.kc, z.vc, z.att, z.scratch, B, H, T, nullptr, T, r.S); });
    r.us[3] = t([&] { run_v3b(z.qkv, 3 * C, z.kc, z.vc, z.att, z.scratch, z.counter, B, H, T, T, r.S); });
    r.us[4] = t([&] { run_v4(z.qkv, 3 * C, z.kh, z.vh, z.att, z.scratch, B, H, T, T, r.S); });
    r.us[5] = t([&] { run_v5(z.qg, (H + 2 * Hk) * D, z.kg, z.vg, z.att, z.scratch, B, H, Hk, T, T, r.S5); });
    r.v6 = run_v6(z.qkv, 3 * C, z.kc, z.vc, z.att, B, H, T, T);
    if (r.v6.empty()) r.us[6] = t([&] { run_v6(z.qkv, 3 * C, z.kc, z.vc, z.att, B, H, T, T); });
    return r;
}

static int mode_bench(bool one, int B1, int T1)
{
    DevicePeaks pk = query_device_peaks();
    print_device_peaks(pk);
    std::printf("lab14 decode bench: H = 12, D = 64, T_max = T; FP32 cache unless noted; median of 20 runs\n");
    std::printf("GB/s = cache bytes the kernel must read / time: v1 1.5x (K twice), v4 FP16 (half), v5 GQA H_kv = 3 (quarter)\n");
#ifdef CUDASIM
    std::printf("cudasim: event timings are fake, the numbers below are meaningless (code path check only)\n");
#endif
    std::vector<int> Bs = {1, 4, 16}, Ts = {1024, 4096, 16384, 32768};
#ifdef CUDASIM
    Bs = {1}; Ts = {1024};
#endif
    if (one) { Bs = {B1}; Ts = {T1}; }
    const char* names[7] = {"v1_twopass", "v2_online", "v3_split+combine", "v3b_lastblock", "v4_half", "v5_gqa", "v6_cluster"};
    std::string v6_line;
    for (int B : Bs) for (int T : Ts) {
        BenchBufs z(B, T, 12, 3);
        if (!z.ok) {
            std::printf("\nB=%d T=%d: skipped, the caches (%.2f GB FP32 + FP16 copy + GQA) do not fit in device memory\n",
                        B, T, 2.0 * z.n * 4 / 1e9);
            continue;
        }
        BenchRow r = one ? bench_shape(z, 0, 1) : bench_shape(z, 3, 20);
        const double cache = 2.0 * z.n * sizeof(float);          // K and V, FP32, all heads
        const double bytes[7] = {1.5 * cache, cache, cache, cache, cache / 2, cache / 4, cache};
        std::printf("\nB=%d T=%d: cache %.1f MB per layer (FP32), splits S=%d (v5: S=%d over %d kv heads)\n",
                    B, T, cache / 1e6, r.S, r.S5, 3);
        std::printf("  %-18s %10s %9s %9s\n", "kernel", "us", "GB/s", "% of 672");
        for (int k = 0; k < 7; ++k) {
            if (k == 6 && !r.v6.empty()) { std::printf("  %-18s skipped: %s\n", names[k], r.v6.c_str()); continue; }
            double gbs = bytes[k] / (r.us[k] * 1e-6) / 1e9;
            std::printf("  %-18s %10.1f %9.1f %8.1f%%\n", names[k], r.us[k], gbs, 100.0 * gbs / PEAK_GBS);
        }
        double g3 = cache / (r.us[2] * 1e-6) / 1e9;
        std::printf("PASTE: decode B=%d T=%d v1=%.1f v2=%.1f v3=%.1f (S=%d) v3b=%.1f v4=%.1f v5=%.1f us; v3 GB/s=%.0f (%.0f%% of 672)\n",
                    B, T, r.us[0], r.us[1], r.us[2], r.S, r.us[3], r.us[4], r.us[5], g3, 100.0 * g3 / PEAK_GBS);
        if (v6_line.empty()) {
            char buf[160];
            if (r.v6.empty()) std::snprintf(buf, sizeof buf, "PASTE: v6_cluster ran (B=%d T=%d: %.1f us)", B, T, r.us[6]);
            else std::snprintf(buf, sizeof buf, "PASTE: v6_cluster skipped (%s)", r.v6.c_str());
            v6_line = buf;
        }
    }
    if (!v6_line.empty()) std::printf("%s\n", v6_line.c_str());
    return 0;
}

// Ragged: B = 4, contexts 512, 2048, 4096, 32768 in one launch, with v3's per-(b, h) split rule
// (S from the longest sequence, each sequence's chunk = its own T / S). Your stretch: balance it.
static int mode_ragged()
{
    const int B = 4, H = 12, C = H * D;
#ifdef CUDASIM
    const int Ts[4] = {16, 64, 128, 1024};
    std::printf("cudasim: ragged runs at T = 16, 64, 128, 1024 and its timings are meaningless\n");
#else
    const int Ts[4] = {512, 2048, 4096, 32768};
#endif
    const int T_max = Ts[3];
    const size_t n = (size_t)B * H * T_max * D;
    float* kc = dalloc<float>(n); float* vc = dalloc<float>(n); float* qkv = dalloc<float>((size_t)B * 3 * C);
    float* att = dalloc<float>((size_t)B * C);
    float* scratch = dalloc<float>((size_t)B * H * DEC_S_MAX * (D + 2));
    int* dT = dalloc<int>(B);
    dfill(kc, n, 1u); dfill(vc, n, 2u); dfill(qkv, (size_t)B * 3 * C, 3u);
    CUDA_CHECK(cudaMemcpy(dT, Ts, sizeof Ts, cudaMemcpyHostToDevice));
    double keys = 0; for (int T : Ts) keys += T;
    const double bytes = keys * H * 2 * D * sizeof(float);
    const int S = choose_splits(B, H, T_max);
    double us = 1e3 * time_gpu([&] { run_v3(qkv, 3 * C, kc, vc, att, scratch, B, H, 0, dT, T_max, S); }).median_ms;
    std::printf("ragged B=4 T_ctx=%d,%d,%d,%d: per-(b, h) splits S=%d, %.1f us, %.0f GB/s of the %.1f MB actually read\n",
                Ts[0], Ts[1], Ts[2], Ts[3], S, us, bytes / (us * 1e-6) / 1e9, bytes / 1e6);
    std::printf("  ideal at 590 GB/s: %.1f us. The longest sequence's chunks are %d keys, the shortest's %d.\n",
                bytes / 590e9 * 1e6, split_chunk(Ts[3], S), split_chunk(Ts[0], S));
    std::printf("PASTE: ragged per-(b,h) S=%d %.1f us (ideal %.1f us)\n", S, us, bytes / 590e9 * 1e6);
    CUDA_CHECK(cudaFree(kc)); CUDA_CHECK(cudaFree(vc)); CUDA_CHECK(cudaFree(qkv)); CUDA_CHECK(cudaFree(att));
    CUDA_CHECK(cudaFree(scratch)); CUDA_CHECK(cudaFree(dT));
    return 0;
}

// The fence experiment: v3b many times, the scratch poisoned with NaN before each run so that a
// partial read before it landed shows up as a wrong output.
static int mode_nofence()
{
#ifdef NOFENCE
    const char* build = "NOFENCE build: both __threadfence() removed";
#else
    const char* build = "normal build, fences in place; make nofence runs the experiment";
#endif
    const int B = 1, H = 12, T = 4096, C = H * D;
#ifdef CUDASIM
    const int runs = 3;
    std::printf("cudasim runs blocks one after another: the fence cannot matter here; 3 runs only\n");
#else
    const int runs = 200;
#endif
    const size_t n = (size_t)B * H * T * D;
    std::vector<float> hk(n), hv(n), hq((size_t)B * 3 * C), ref((size_t)B * C), got(ref.size());
    fill_random(hk.data(), n, 41u); fill_random(hv.data(), n, 43u); fill_random(hq.data(), hq.size(), 45u);
    attn_decode_ref(hq.data(), 3 * C, hk.data(), hv.data(), ref.data(), B, H, H, T, nullptr, T);
    float* kc = dalloc<float>(n); float* vc = dalloc<float>(n); float* qkv = dalloc<float>(hq.size());
    up(kc, hk); up(vc, hv); up(qkv, hq);
    float* att = dalloc<float>(ref.size());
    const size_t ns = (size_t)B * H * DEC_S_MAX * (D + 2);
    float* scratch = dalloc<float>(ns);
    unsigned* counter = dalloc<unsigned>(B * H);
    CUDA_CHECK(cudaMemset(counter, 0, B * H * sizeof(unsigned)));
    const int S = choose_splits(B, H, T);
    int failures = 0;
    for (int i = 0; i < runs; ++i) {
        CUDA_CHECK(cudaMemset(scratch, 0xFF, ns * sizeof(float)));
        run_v3b(qkv, 3 * C, kc, vc, att, scratch, counter, B, H, T, T, S);
        CUDA_CHECK_LAUNCH(true);
        down(got, att);
        if (!compare(ref.data(), got.data(), ref.size(), 1e-4, 1e-4).pass) ++failures;
    }
    std::printf("v3b_lastblock B=1 H=12 T=4096 S=%d, %d runs: %d wrong (%s)\n", S, runs, failures, build);
    std::printf("PASTE: %s failures=%d/%d\n",
#ifdef NOFENCE
                "nofence",
#else
                "fenced",
#endif
                failures, runs);
    CUDA_CHECK(cudaFree(kc)); CUDA_CHECK(cudaFree(vc)); CUDA_CHECK(cudaFree(qkv)); CUDA_CHECK(cudaFree(att));
    CUDA_CHECK(cudaFree(scratch)); CUDA_CHECK(cudaFree(counter));
#ifdef NOFENCE
    return 0;                                                 // wrong answers are the experiment's result
#else
    return failures ? 1 : 0;
#endif
}

int main(int argc, char** argv)
{
    require_cuda_device();
    const char* mode = argc > 1 ? argv[1] : "test";
    if (!std::strcmp(mode, "test")) return mode_test();
    if (!std::strcmp(mode, "bench")) return mode_bench(false, 0, 0);
    if (!std::strcmp(mode, "bench-one") && argc > 3) return mode_bench(true, std::atoi(argv[2]), std::atoi(argv[3]));
    if (!std::strcmp(mode, "ragged")) return mode_ragged();
    if (!std::strcmp(mode, "nofence")) return mode_nofence();
    std::fprintf(stderr, "usage: %s test | bench | bench-one B T | ragged | nofence\n", argv[0]);
    return 2;
}
