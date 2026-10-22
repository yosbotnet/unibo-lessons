// flash.cu - lab 13 (chapter 14): three attention kernels for one layer's heads.
//
//   ./flash test [quick]  the PTX wrappers on their own (ptx), then every kernel against a
//                     double-precision CPU reference, causal and not, on awkward shapes
//                     (quick: only the three small shapes; for cudasim, where the full test takes minutes)
//   ./flash bench     B = 1, H = 12, D = 64, causal, T = 1024 .. 8192: ms, TFLOPS, GB/s, PASTE lines
//   ./flash profile   one launch of each kernel at T = 4096 (for make ncu)
//
// Kernels (names as chapter 14 uses them):
//   naive        attn_naive.h   chapter 10's three kernels around S in DRAM (full square, for scale)
//   flash_fp32   flash_fp32.h   one thread per query row, K/V tiles in shared memory, online softmax;
//                               attn_prefill_flash() is the engine's --attn-prefill flash
//   flash2_mma   flash2_mma.h   FA2 on the tensor cores: mma.sync + ldmatrix (ptx.h) + cp.async, FP16 in
//
// Layout: the engine's. qkv [B*T, 3C] (q | k | v, head h at columns h*D.. of each third), out [B*T, C].
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
#include "ptx.h"
#include "attn_naive.h"
#include "flash_fp32.h"
#include "flash2_mma.h"

constexpr int D = 64;

// ---------------------------------------------------------------------------
// ptx: the three wrappers against plain loops, before any kernel uses them.
// One warp. A is 16x16 (row-major), Bt is the 16x8 B operand of two n-tiles
// stored n-major (Bt[n][k], like K in attention), V is k-major (V[k][n], like V).
// ---------------------------------------------------------------------------
constexpr int PP = 24;   // padded row of the test tiles, in halves (48 bytes: 16-byte aligned rows)

__global__ void ptx_selftest(const __half* A, const __half* Bt, const __half* V, const float* C0,
                             float* out_kb, float* out_v, uint32_t* reg_plain, uint32_t* reg_trans,
                             uint32_t* reg_vt)
{
    __shared__ __align__(16) __half As[16][PP], Bs[16][PP], Vs[16][PP], Vts[16][PP];
    const int lane = threadIdx.x, g = lane / 4, t = lane % 4;
    for (int e = lane; e < 256; e += 32) {
        const int r = e / 16, c = e % 16;
        As[r][c] = A[e];  Bs[r][c] = Bt[e];  Vs[r][c] = V[e];  Vts[c][r] = V[e];   // Vts = V transposed
    }
    __syncthreads();
    uint32_t a[4], kb[4], vb[4], vt[4];
    ldmatrix_x4(a, &As[lane % 16][(lane / 16) * 8]);                          // A fragment (Q's addressing)
    ldmatrix_x4(kb, &Bs[(lane % 8) + (lane / 16) * 8][((lane / 8) % 2) * 8]);  // two B fragments (K's addressing)
    ldmatrix_x4_trans(vb, &Vs[(lane % 8) + ((lane / 8) % 2) * 8][(lane / 16) * 8]);   // two B fragments (V's)
    ldmatrix_x4(vt, &Vts[(lane % 8) + (lane / 16) * 8][((lane / 8) % 2) * 8]);  // V^T loaded straight, K-style
    float c1[2][4], c2[2][4];
    for (int nt = 0; nt < 2; ++nt)
        for (int i = 0; i < 4; ++i) {
            const int row = g + (i >> 1) * 8, col = nt * 8 + 2 * t + (i & 1);
            c1[nt][i] = c2[nt][i] = C0[row * 16 + col];
        }
    mma_16816(c1[0], a, kb);  mma_16816(c1[1], a, kb + 2);                  // A Bt^T + C0
    mma_16816(c2[0], a, vb);  mma_16816(c2[1], a, vb + 2);                  // A V + C0
    for (int nt = 0; nt < 2; ++nt)
        for (int i = 0; i < 4; ++i) {
            const int row = g + (i >> 1) * 8, col = nt * 8 + 2 * t + (i & 1);   // the C layout
            out_kb[row * 16 + col] = c1[nt][i];
            out_v[row * 16 + col] = c2[nt][i];
        }
    // the A tile again, raw: the host checks the documented ldmatrix layout register by register
    for (int k = 0; k < 4; ++k) {
        reg_plain[lane * 4 + k] = a[k];
        reg_trans[lane * 4 + k] = vb[k];
        reg_vt[lane * 4 + k] = vt[k];
    }
}

static float h2f(__half h) { return __half2float(h); }
static float lo_of(uint32_t x) { __half h; uint16_t b = (uint16_t)(x & 0xffff); std::memcpy(&h, &b, 2); return h2f(h); }
static float hi_of(uint32_t x) { __half h; uint16_t b = (uint16_t)(x >> 16); std::memcpy(&h, &b, 2); return h2f(h); }

static bool run_ptx_test()
{
    std::vector<float> fa(256), fb(256), fv(256), c0(256);
    fill_random(fa.data(), 256, 11u);  fill_random(fb.data(), 256, 12u);
    fill_random(fv.data(), 256, 13u);  fill_random(c0.data(), 256, 14u);
    std::vector<__half> ha(256), hb(256), hv(256);
    for (int e = 0; e < 256; ++e) { ha[e] = __float2half(fa[e]); hb[e] = __float2half(fb[e]); hv[e] = __float2half(fv[e]); }
    __half *dA, *dB, *dV; float *dC0, *dkb, *dvo; uint32_t *rp, *rt, *rvt;
    CUDA_CHECK(cudaMalloc(&dA, 512));  CUDA_CHECK(cudaMalloc(&dB, 512));  CUDA_CHECK(cudaMalloc(&dV, 512));
    CUDA_CHECK(cudaMalloc(&dC0, 1024)); CUDA_CHECK(cudaMalloc(&dkb, 1024)); CUDA_CHECK(cudaMalloc(&dvo, 1024));
    CUDA_CHECK(cudaMalloc(&rp, 512));  CUDA_CHECK(cudaMalloc(&rt, 512));  CUDA_CHECK(cudaMalloc(&rvt, 512));
    CUDA_CHECK(cudaMemcpy(dA, ha.data(), 512, cudaMemcpyHostToDevice));
    CUDA_CHECK(cudaMemcpy(dB, hb.data(), 512, cudaMemcpyHostToDevice));
    CUDA_CHECK(cudaMemcpy(dV, hv.data(), 512, cudaMemcpyHostToDevice));
    CUDA_CHECK(cudaMemcpy(dC0, c0.data(), 1024, cudaMemcpyHostToDevice));
    ptx_selftest<<<1, 32>>>(dA, dB, dV, dC0, dkb, dvo, rp, rt, rvt);
    CUDA_CHECK_LAUNCH(true);
    std::vector<float> okb(256), ov(256);
    std::vector<uint32_t> regp(128), regt(128), regvt(128);
    CUDA_CHECK(cudaMemcpy(okb.data(), dkb, 1024, cudaMemcpyDeviceToHost));
    CUDA_CHECK(cudaMemcpy(ov.data(), dvo, 1024, cudaMemcpyDeviceToHost));
    CUDA_CHECK(cudaMemcpy(regp.data(), rp, 512, cudaMemcpyDeviceToHost));
    CUDA_CHECK(cudaMemcpy(regt.data(), rt, 512, cudaMemcpyDeviceToHost));
    CUDA_CHECK(cudaMemcpy(regvt.data(), rvt, 512, cudaMemcpyDeviceToHost));
    bool all = true;
    // 1. mma(ldmatrix(A), ldmatrix(Bt)) = A Bt^T + C0, and mma(ldmatrix(A), ldmatrix.trans(V)) = A V + C0
    double e1 = 0, e2 = 0;
    for (int i = 0; i < 16; ++i)
        for (int j = 0; j < 16; ++j) {
            double s1 = c0[i * 16 + j], s2 = c0[i * 16 + j];
            for (int k = 0; k < 16; ++k) {
                s1 += (double)h2f(ha[i * 16 + k]) * h2f(hb[j * 16 + k]);
                s2 += (double)h2f(ha[i * 16 + k]) * h2f(hv[k * 16 + j]);
            }
            e1 = std::max(e1, std::fabs(s1 - okb[i * 16 + j]));
            e2 = std::max(e2, std::fabs(s2 - ov[i * 16 + j]));
        }
    bool p1 = e1 < 1e-4, p2 = e2 < 1e-4;
    std::printf("%s ptx  ldmatrix_x4 + mma_16816 = A Bt^T + C (16x16x16, plain loop)    max_abs_err %.2g\n", p1 ? "PASS" : "FAIL", e1);
    std::printf("%s ptx  ldmatrix_x4_trans + mma_16816 = A V + C                       max_abs_err %.2g\n", p2 ? "PASS" : "FAIL", e2);
    // 2. ldmatrix_x4 register layout, as chapter 14 states it: r[k] of lane L = block k (L/4, 2(L%4) +0/+1),
    //    blocks of the A tile in the order (rows 0-7, cols 0-7), (8-15, 0-7), (0-7, 8-15), (8-15, 8-15)
    int bad = 0;
    for (int L = 0; L < 32; ++L)
        for (int k = 0; k < 4; ++k) {
            const int r = (k & 1) * 8 + L / 4, c = (k >> 1) * 8 + 2 * (L % 4);
            if (lo_of(regp[L * 4 + k]) != h2f(ha[r * 16 + c]) || hi_of(regp[L * 4 + k]) != h2f(ha[r * 16 + c + 1])) ++bad;
        }
    std::printf("%s ptx  ldmatrix_x4 layout: r[k] = block k (lane/4, 2(lane%%4)..+1)      %d of 128 registers wrong\n", bad ? "FAIL" : "PASS", bad);
    all = all && p1 && p2 && !bad;
    // 3. .trans of V equals the plain load of V^T, register for register (the transpose)
    int badt = 0;
    for (int e = 0; e < 128; ++e) badt += regt[e] != regvt[e];
    std::printf("%s ptx  ldmatrix_x4_trans(V) = ldmatrix_x4(V^T), all 128 registers         %d differ\n", badt ? "FAIL" : "PASS", badt);
    all = all && !badt;
    cudaFree(dA); cudaFree(dB); cudaFree(dV); cudaFree(dC0); cudaFree(dkb); cudaFree(dvo);
    cudaFree(rp); cudaFree(rt); cudaFree(rvt);
    return all;
}

// ---------------------------------------------------------------------------
// CPU reference: three loops in double. out [B*T, C]; lse2 [B*H*T] in log2 units
// (log2 of the sum of exp(s) over visible keys, s = q.k / sqrt(D)).
// ---------------------------------------------------------------------------
static void attn_ref_cpu(const float* qkv, int B, int T, int H, bool causal, std::vector<double>& out,
                         std::vector<double>& lse2)
{
    const int C = H * D;
    const double scale = 1.0 / std::sqrt((double)D);
    out.assign((size_t)B * T * C, 0.0);
    lse2.assign((size_t)B * H * T, 0.0);
    std::vector<double> s(T);
    for (int b = 0; b < B; ++b)
        for (int h = 0; h < H; ++h)
            for (int i = 0; i < T; ++i) {
                const float* q = qkv + ((size_t)b * T + i) * 3 * C + h * D;
                const int last = causal ? i : T - 1;
                double mx = -INFINITY;
                for (int j = 0; j <= last; ++j) {
                    const float* k = qkv + ((size_t)b * T + j) * 3 * C + C + h * D;
                    double acc = 0;
                    for (int d = 0; d < D; ++d) acc += (double)q[d] * k[d];
                    s[j] = acc * scale;
                    mx = std::max(mx, s[j]);
                }
                double sum = 0;
                for (int j = 0; j <= last; ++j) { s[j] = std::exp(s[j] - mx); sum += s[j]; }
                double* o = &out[((size_t)b * T + i) * C + h * D];
                for (int j = 0; j <= last; ++j) {
                    const float* v = qkv + ((size_t)b * T + j) * 3 * C + 2 * C + h * D;
                    const double p = s[j] / sum;
                    for (int d = 0; d < D; ++d) o[d] += p * v[d];
                }
                lse2[((size_t)b * H + h) * T + i] = (mx + std::log(sum)) / std::log(2.0);
            }
}

// |got - ref| <= atol + rtol |ref| everywhere; prints one PASS/FAIL line.
static bool check(const char* kernel, const char* what, const std::vector<double>& ref, const std::vector<float>& got,
                  int B, int T, int H, bool causal, double atol, double rtol, int cols)
{
    double max_err = 0; long long first = -1;
    for (size_t e = 0; e < ref.size(); ++e) {
        const double err = std::fabs((double)got[e] - ref[e]);
        if (!(err <= atol + rtol * std::fabs(ref[e]))) { if (first < 0) first = (long long)e; if (std::isnan(err)) max_err = NAN; }
        if (err > max_err) max_err = err;
    }
    char shape[64];
    std::snprintf(shape, sizeof shape, "B=%d H=%d T=%d", B, H, T);
    if (first < 0) {
        std::printf("PASS %-10s %-4s %-18s causal=%d  max_abs_err %.2g\n", kernel, what, shape, (int)causal, max_err);
        return true;
    }
    std::printf("FAIL %-10s %-4s %-18s causal=%d  max_abs_err %.3g  first bad: row %lld col %lld (expected %.6g, got %.6g)\n",
                kernel, what, shape, (int)causal, max_err, first / cols, first % cols, ref[first], (double)got[first]);
    return false;
}

__global__ void convert_qkv_half(const float* __restrict__ x, __half* __restrict__ y, size_t n)
{
    size_t i = (size_t)blockIdx.x * blockDim.x + threadIdx.x;
    if (i < n) y[i] = __float2half_rn(x[i]);
}
static void to_half(const float* d_x, __half* d_y, size_t n)
{
    convert_qkv_half<<<(unsigned)((n + 255) / 256), 256>>>(d_x, d_y, n);
}

static bool test_shape(int B, int H, int T, bool causal)
{
    const int C = H * D;
    const size_t nqkv = (size_t)B * T * 3 * C, nout = (size_t)B * T * C;
    std::vector<float> qkv(nqkv);
    fill_random(qkv.data(), nqkv, 1000u + B * 100 + H * 10 + T);
    for (float& x : qkv) x *= 0.5f;                            // [-0.5, 0.5): moderate scores
    std::vector<float> qkv16(nqkv);                            // the FP16-rounded copy flash2_mma sees
    for (size_t e = 0; e < nqkv; ++e) qkv16[e] = __half2float(__float2half_rn(qkv[e]));

    float *d_qkv, *d_att, *d_S, *d_lse; __half *d_qkvh, *d_outh;
    CUDA_CHECK(cudaMalloc(&d_qkv, nqkv * 4));
    CUDA_CHECK(cudaMalloc(&d_att, nout * 4));
    CUDA_CHECK(cudaMalloc(&d_S, attn_naive_scratch_bytes(B, T, H, D)));
    CUDA_CHECK(cudaMalloc(&d_lse, (size_t)B * H * T * 4));
    CUDA_CHECK(cudaMalloc(&d_qkvh, nqkv * 2));
    CUDA_CHECK(cudaMalloc(&d_outh, nout * 2));
    CUDA_CHECK(cudaMemcpy(d_qkv, qkv.data(), nqkv * 4, cudaMemcpyHostToDevice));

    std::vector<double> ref, lse_ref, ref16, lse16;
    attn_ref_cpu(qkv.data(), B, T, H, causal, ref, lse_ref);
    attn_ref_cpu(qkv16.data(), B, T, H, causal, ref16, lse16);
    std::vector<float> got(nout), glse((size_t)B * H * T);
    std::vector<__half> goth(nout);
    bool ok = true;

    CUDA_CHECK(cudaMemset(d_att, 0xff, nout * 4));             // NaN: an output nobody wrote fails
    attn_naive(d_qkv, d_att, B, T, H, D, causal, d_S);
    CUDA_CHECK_LAUNCH(true);
    CUDA_CHECK(cudaMemcpy(got.data(), d_att, nout * 4, cudaMemcpyDeviceToHost));
    ok &= check("naive", "O", ref, got, B, T, H, causal, 1e-4, 1e-4, C);

    CUDA_CHECK(cudaMemset(d_att, 0xff, nout * 4));
    if (causal) attn_prefill_flash(d_qkv, d_att, B, T, H, D, nullptr, 0);   // the engine's entry point
    else        attn_prefill_flash_causal(d_qkv, d_att, B, T, H, D, false, 0);
    CUDA_CHECK_LAUNCH(true);
    CUDA_CHECK(cudaMemcpy(got.data(), d_att, nout * 4, cudaMemcpyDeviceToHost));
    ok &= check("flash_fp32", "O", ref, got, B, T, H, causal, 1e-4, 1e-4, C);

    to_half(d_qkv, d_qkvh, nqkv);
    CUDA_CHECK(cudaMemset(d_outh, 0xff, nout * 2));
    CUDA_CHECK(cudaMemset(d_lse, 0xff, (size_t)B * H * T * 4));
    flash2_mma(d_qkvh, d_outh, d_lse, B, T, H, causal);
    CUDA_CHECK_LAUNCH(true);
    CUDA_CHECK(cudaMemcpy(goth.data(), d_outh, nout * 2, cudaMemcpyDeviceToHost));
    CUDA_CHECK(cudaMemcpy(glse.data(), d_lse, glse.size() * 4, cudaMemcpyDeviceToHost));
    for (size_t e = 0; e < nout; ++e) got[e] = __half2float(goth[e]);
    ok &= check("flash2_mma", "O", ref16, got, B, T, H, causal, 2e-2, 2e-2, C);
    ok &= check("flash2_mma", "L", lse16, glse, B, T, H, causal, 1e-2, 0.0, T);

    cudaFree(d_qkv); cudaFree(d_att); cudaFree(d_S); cudaFree(d_lse); cudaFree(d_qkvh); cudaFree(d_outh);
    return ok;
}

static int run_test(bool quick)
{
    bool ok = run_ptx_test();
    if (!ok) { std::printf("ptx wrappers wrong: not testing the kernels\nSOME FAIL\n"); return 1; }
    const int shapes[][3] = {{1, 1, 64}, {1, 2, 100}, {2, 3, 257}, {1, 12, 1024}, {3, 4, 1030}};   // (B, H, T)
    for (int n = 0; n < (quick ? 3 : 5); ++n) {
        const int* s = shapes[n];
        for (int causal = 1; causal >= 0; --causal)
            ok &= test_shape(s[0], s[1], s[2], causal == 1);
    }
    std::printf(ok ? "ALL PASS\n" : "SOME FAIL\n");
    return ok ? 0 : 1;
}

// ---------------------------------------------------------------------------
// bench: B = 1, H = 12, D = 64, causal.
// ---------------------------------------------------------------------------
static int run_bench(bool profile)
{
    DevicePeaks pk = query_device_peaks();
    print_device_peaks(pk);
    const double tensor_peak = 61.7;                           // FP16 in, FP32 accumulate, RTX 5070 (chapter 8)
    const int B = 1, H = 12, C = H * D;
    std::vector<int> Ts = profile ? std::vector<int>{4096} : std::vector<int>{1024, 2048, 4096, 8192};
    std::printf("\nB = 1, H = 12, D = 64, causal. FLOPs: naive 4 T^2 D H (it computes the full square), "
                "flash 2 T^2 D H (the causal half).\n");
    std::printf("GB/s: naive = 16 T^2 H bytes of S and P / time; flash = Q, K, V, O once / time (only true if K/V re-reads hit L2).\n\n");
    std::printf("%6s  %-10s %9s %8s %7s %8s %9s\n", "T", "kernel", "ms", "TFLOPS", "% pk", "GB/s", "vs naive");
    for (int T : Ts) {
        const size_t nqkv = (size_t)B * T * 3 * C, nout = (size_t)B * T * C;
        std::vector<float> h(nqkv);
        fill_random(h.data(), nqkv, 7u);
        for (float& x : h) x *= 0.5f;
        float *d_qkv, *d_att, *d_lse, *d_S = nullptr; __half *d_qkvh, *d_outh;
        CUDA_CHECK(cudaMalloc(&d_qkv, nqkv * 4));
        CUDA_CHECK(cudaMalloc(&d_att, nout * 4));
        CUDA_CHECK(cudaMalloc(&d_lse, (size_t)B * H * T * 4));
        CUDA_CHECK(cudaMalloc(&d_qkvh, nqkv * 2));
        CUDA_CHECK(cudaMalloc(&d_outh, nout * 2));
        CUDA_CHECK(cudaMemcpy(d_qkv, h.data(), nqkv * 4, cudaMemcpyHostToDevice));
        to_half(d_qkv, d_qkvh, nqkv);
        const size_t sbytes = attn_naive_scratch_bytes(B, T, H, D);
        if (cudaMalloc(&d_S, sbytes) != cudaSuccess) {
            cudaGetLastError();                                // clear the error
            d_S = nullptr;
            std::printf("%6d  naive: cudaMalloc of %.1f GB for S failed; skipped at this T\n", T, sbytes / 1e9);
        }
        const double f_full = 4.0 * T * T * D * H, f_causal = 2.0 * T * T * D * H;
        const double s_traffic = 16.0 * T * T * H;
        double t_naive = 0, t_f32 = 0, t_mma = 0;
        if (profile) {
            if (d_S) attn_naive(d_qkv, d_att, B, T, H, D, true, d_S);
            attn_prefill_flash(d_qkv, d_att, B, T, H, D, nullptr, 0);
            flash2_mma(d_qkvh, d_outh, d_lse, B, T, H, true);
            CUDA_CHECK_LAUNCH(true);
        } else {
            if (d_S) t_naive = time_gpu([&] { attn_naive(d_qkv, d_att, B, T, H, D, true, d_S); }).median_ms;
            t_f32 = time_gpu([&] { attn_prefill_flash(d_qkv, d_att, B, T, H, D, nullptr, 0); }).median_ms;
            t_mma = time_gpu([&] { flash2_mma(d_qkvh, d_outh, d_lse, B, T, H, true); }).median_ms;
            auto row = [&](const char* name, double ms, double flops, double bytes, double peak) {
                if (ms <= 0) return;
                const double tf = flops / (ms * 1e-3) / 1e12;
                std::printf("%6d  %-10s %9.3f %8.2f %6.0f%% %8.0f", T, name, ms, tf, 100.0 * tf / peak, bytes / (ms * 1e-3) / 1e9);
                if (t_naive > 0) std::printf(" %8.1fx", t_naive / ms); else std::printf(" %9s", "-");
                std::printf("\n");
            };
            row("naive", t_naive, f_full, s_traffic, pk.fp32_tflops > 0 ? pk.fp32_tflops : 30.9);
            row("flash_fp32", t_f32, f_causal, 4.0 * T * D * H * 4, pk.fp32_tflops > 0 ? pk.fp32_tflops : 30.9);
            row("flash2_mma", t_mma, f_causal, 4.0 * T * D * H * 2, tensor_peak);
            const double tf = f_causal / (t_mma * 1e-3) / 1e12;
            char nv[32];
            if (t_naive > 0) std::snprintf(nv, sizeof nv, "%.3f", t_naive); else std::snprintf(nv, sizeof nv, "skipped");
            std::printf("PASTE: flash T=%d naive=%s ms flash_fp32=%.3f ms flash2_mma=%.3f ms (TFLOPS %.1f, %.0f%% of 61.7)\n",
                        T, nv, t_f32, t_mma, tf, 100.0 * tf / tensor_peak);
        }
        cudaFree(d_qkv); cudaFree(d_att); cudaFree(d_lse); cudaFree(d_qkvh); cudaFree(d_outh);
        if (d_S) cudaFree(d_S);
    }
    std::printf("(%% pk: naive and flash_fp32 against the FP32 peak, flash2_mma against 61.7 TFLOPS FP16-in/FP32-acc.)\n");
    return 0;
}

int main(int argc, char** argv)
{
    const std::string mode = argc > 1 ? argv[1] : "test";
    require_cuda_device();
    if (mode == "test") return run_test(argc > 2 && std::string(argv[2]) == "quick");
    if (mode == "bench") return run_bench(false);
    if (mode == "profile") return run_bench(true);
    std::fprintf(stderr, "usage: %s test | bench | profile\n", argv[0]);
    return 2;
}
