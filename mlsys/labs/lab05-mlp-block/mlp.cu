// Lab 05 - mlp.cu: GPT-2's MLP sublayer, one kernel per operation, timed op by op.
//
//   ./mlp test      every kernel against a CPU reference (double precision), awkward sizes
//   ./mlp bench     each operation at M = 1, 64 and 512 tokens: time, bytes, FLOPs, share
//   ./mlp profile   one pass at M = 512, each kernel launched once: the run for nsys / ncu
//
// The sublayer, as in GPT-2 small (C = 768 channels, hidden size 4C = 3072):
//
//   h   = layernorm(x)            [M, 768]    reduction per row
//   u   = h  @ W_fc               [M, 3072]   matrix multiply (naive kernel)
//   u  += b_fc                                elementwise
//   u   = gelu(u)                             elementwise
//   v   = u  @ W_proj             [M, 768]    matrix multiply (naive kernel)
//   v  += b_proj                              elementwise
//   out = x + v                               elementwise (the residual connection)
//
// Chapter 6 predicts where the time goes before you run it. The bias and GELU
// steps also exist fused into ONE kernel (bias_gelu): same math, half the bytes.
//
// Weights are stored [in, out] = [K, N], the layout of GPT-2's original
// checkpoints, so y = x @ W with no transpose. (PyTorch's nn.Linear stores
// [out, in] and computes x @ W^T: same numbers, other layout. Chapter 6.)

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <cmath>
#include <vector>

#include "check.h"
#include "bench.h"

constexpr int C = 768;       // model width of GPT-2 small
constexpr int H = 4 * C;     // MLP hidden width
constexpr float LN_EPS = 1e-5f;

// ---------------------------------------------------------------------------
// Layernorm: one block of 256 threads per row. Each thread sums a strided
// slice of the row (coalesced: consecutive threads, consecutive floats), then
// the block combines 256 partial sums with warp shuffles and one small
// shared array (chapter 5's v6 pattern). Two passes over the row: mean, then
// variance around the mean (numerically safer than E[x^2] - E[x]^2). The
// second read hits in L1/L2: a 768-float row is 3 KB.
// ---------------------------------------------------------------------------
constexpr int LN_THREADS = 256;

__device__ float block_sum(float v, float* s_warp)       // s_warp: 8 floats of shared memory
{
    for (int o = 16; o > 0; o >>= 1) v += __shfl_xor_sync(0xffffffffu, v, o);   // every lane gets its warp's sum
    int warp = threadIdx.x / 32, lane = threadIdx.x % 32;
    if (lane == 0) s_warp[warp] = v;
    __syncthreads();
    float t = (lane < LN_THREADS / 32) ? s_warp[lane] : 0.0f;
    for (int o = 16; o > 0; o >>= 1) t += __shfl_xor_sync(0xffffffffu, t, o);   // every lane of every warp: the block's sum
    __syncthreads();                                      // s_warp may be reused by the next call
    return t;
}

__global__ void layernorm(const float* __restrict__ x, const float* __restrict__ gamma,
                          const float* __restrict__ beta, float* __restrict__ y, int M, int n)
{
    __shared__ float s_warp[LN_THREADS / 32];
    int row = blockIdx.x;
    if (row >= M) return;                                 // whole block leaves together: safe
    const float* xr = x + (size_t)row * n;
    float s = 0.0f;
    for (int i = threadIdx.x; i < n; i += LN_THREADS) s += xr[i];
    float mean = block_sum(s, s_warp) / n;
    float q = 0.0f;
    for (int i = threadIdx.x; i < n; i += LN_THREADS) { float d = xr[i] - mean; q += d * d; }
    float rstd = rsqrtf(block_sum(q, s_warp) / n + LN_EPS);
    for (int i = threadIdx.x; i < n; i += LN_THREADS)
        y[(size_t)row * n + i] = (xr[i] - mean) * rstd * gamma[i] + beta[i];
}

// ---------------------------------------------------------------------------
// Naive matrix multiply: Y[M, N] = A[M, K] @ W[K, N], one thread per output.
// threadIdx.x walks n (the contiguous dimension of W and Y), so a warp reads 32
// consecutive floats of a row of W (coalesced) and one A element that all 32
// lanes share (a broadcast: one sector). blockIdx.y is the row m.
// Chapter 7 starts from exactly this kernel.
// ---------------------------------------------------------------------------
constexpr int MM_THREADS = 256;

__global__ void matmul_naive(const float* __restrict__ A, const float* __restrict__ W,
                             float* __restrict__ Y, int M, int K, int N)
{
    int n = blockIdx.x * MM_THREADS + threadIdx.x;
    int m = blockIdx.y;
    if (m >= M || n >= N) return;
    const float* a = A + (size_t)m * K;
    float acc = 0.0f;
    for (int k = 0; k < K; ++k) acc += a[k] * W[(size_t)k * N + n];
    Y[(size_t)m * N + n] = acc;
}

// ---------------------------------------------------------------------------
// Elementwise kernels: one thread per element, grid-sized to cover n.
// ---------------------------------------------------------------------------
constexpr int EW_THREADS = 256;

__global__ void add_bias(float* __restrict__ y, const float* __restrict__ b, int M, int N)
{
    size_t i = (size_t)blockIdx.x * EW_THREADS + threadIdx.x;
    if (i < (size_t)M * N) y[i] += b[i % N];
}

// GPT-2's GELU: the tanh approximation (Hendrycks & Gimpel, 2016).
__device__ __forceinline__ float gelu_tanh(float x)
{
    const float k = 0.7978845608f;                        // sqrt(2 / pi)
    return 0.5f * x * (1.0f + tanhf(k * (x + 0.044715f * x * x * x)));
}

__global__ void gelu(float* __restrict__ y, size_t n)
{
    size_t i = (size_t)blockIdx.x * EW_THREADS + threadIdx.x;
    if (i < n) y[i] = gelu_tanh(y[i]);
}

// add_bias and gelu fused: one read and one write per element instead of two of each.
__global__ void bias_gelu(float* __restrict__ y, const float* __restrict__ b, int M, int N)
{
    size_t i = (size_t)blockIdx.x * EW_THREADS + threadIdx.x;
    if (i < (size_t)M * N) y[i] = gelu_tanh(y[i] + b[i % N]);
}

__global__ void residual_add(float* __restrict__ out, const float* __restrict__ x,
                             const float* __restrict__ v, size_t n)
{
    size_t i = (size_t)blockIdx.x * EW_THREADS + threadIdx.x;
    if (i < n) out[i] = x[i] + v[i];
}

static unsigned ew_blocks(size_t n) { return (unsigned)((n + EW_THREADS - 1) / EW_THREADS); }

// ---------------------------------------------------------------------------
// Host side: buffers and the sublayer, op by op
// ---------------------------------------------------------------------------
struct Weights { float *g, *b, *Wfc, *bfc, *Wproj, *bproj; };
struct Acts    { float *x, *h, *u, *v, *out; };

enum Op { OP_LN, OP_FC, OP_FC_BIAS, OP_GELU, OP_PROJ, OP_PROJ_BIAS, OP_RES, OP_BIAS_GELU, NUM_OPS };
static const char* op_name[NUM_OPS] = {
    "layernorm", "matmul fc", "bias fc", "gelu", "matmul proj", "bias proj", "residual", "bias+gelu fused"};
static const char* op_tag[NUM_OPS] = {"ln", "fc", "bfc", "gelu", "proj", "bproj", "res", "bgelu"};

static void run_op(Op op, const Weights& w, const Acts& a, int M)
{
    switch (op) {
    case OP_LN:        layernorm<<<M, LN_THREADS>>>(a.x, w.g, w.b, a.h, M, C); break;
    case OP_FC:        matmul_naive<<<dim3((H + MM_THREADS - 1) / MM_THREADS, M), MM_THREADS>>>(a.h, w.Wfc, a.u, M, C, H); break;
    case OP_FC_BIAS:   add_bias<<<ew_blocks((size_t)M * H), EW_THREADS>>>(a.u, w.bfc, M, H); break;
    case OP_GELU:      gelu<<<ew_blocks((size_t)M * H), EW_THREADS>>>(a.u, (size_t)M * H); break;
    case OP_PROJ:      matmul_naive<<<dim3((C + MM_THREADS - 1) / MM_THREADS, M), MM_THREADS>>>(a.u, w.Wproj, a.v, M, H, C); break;
    case OP_PROJ_BIAS: add_bias<<<ew_blocks((size_t)M * C), EW_THREADS>>>(a.v, w.bproj, M, C); break;
    case OP_RES:       residual_add<<<ew_blocks((size_t)M * C), EW_THREADS>>>(a.out, a.x, a.v, (size_t)M * C); break;
    case OP_BIAS_GELU: bias_gelu<<<ew_blocks((size_t)M * H), EW_THREADS>>>(a.u, w.bfc, M, H); break;
    default: break;
    }
}

// The minimum bytes each op must move (every input read once, every output
// written once) and the FLOPs it performs. GELU is counted as 8 FLOPs per
// element (the tanh is a handful more on the hardware; it does not matter,
// as you will see).
static void op_cost(Op op, int M, double* bytes, double* flops)
{
    const double m = M, c = C, h = H;
    switch (op) {
    case OP_LN:        *bytes = 4 * (2 * m * c + 2 * c);          *flops = 8 * m * c; break;
    case OP_FC:        *bytes = 4 * (m * c + c * h + m * h);      *flops = 2 * m * c * h; break;
    case OP_FC_BIAS:   *bytes = 4 * (2 * m * h + h);              *flops = m * h; break;
    case OP_GELU:      *bytes = 4 * (2 * m * h);                  *flops = 8 * m * h; break;
    case OP_PROJ:      *bytes = 4 * (m * h + h * c + m * c);      *flops = 2 * m * h * c; break;
    case OP_PROJ_BIAS: *bytes = 4 * (2 * m * c + c);              *flops = m * c; break;
    case OP_RES:       *bytes = 4 * (3 * m * c);                  *flops = m * c; break;
    case OP_BIAS_GELU: *bytes = 4 * (2 * m * h + h);              *flops = 9 * m * h; break;
    default: *bytes = *flops = 0;
    }
}

static float* dalloc(size_t n) { float* p; CUDA_CHECK(cudaMalloc(&p, n * sizeof(float))); return p; }
static void upload(float* d, const std::vector<float>& h) { CUDA_CHECK(cudaMemcpy(d, h.data(), h.size() * sizeof(float), cudaMemcpyHostToDevice)); }
static std::vector<float> download(const float* d, size_t n) { std::vector<float> h(n); CUDA_CHECK(cudaMemcpy(h.data(), d, n * sizeof(float), cudaMemcpyDeviceToHost)); return h; }

// Deterministic weights at GPT-2's scale: N(0, 0.02)-ish, here uniform in [-0.035, 0.035).
static std::vector<float> make(size_t n, uint32_t seed, float scale, float offset = 0.0f)
{
    std::vector<float> v(n);
    fill_random(v.data(), n, seed);
    for (auto& e : v) e = offset + scale * e;
    return v;
}

struct HostWeights { std::vector<float> g, b, Wfc, bfc, Wproj, bproj; };
static HostWeights make_weights()
{
    return { make(C, 1, 0.1f, 1.0f), make(C, 2, 0.1f), make((size_t)C * H, 3, 0.035f),
             make(H, 4, 0.02f), make((size_t)H * C, 5, 0.035f), make(C, 6, 0.02f) };
}
static Weights upload_weights(const HostWeights& hw)
{
    Weights w{dalloc(C), dalloc(C), dalloc((size_t)C * H), dalloc(H), dalloc((size_t)H * C), dalloc(C)};
    upload(w.g, hw.g); upload(w.b, hw.b); upload(w.Wfc, hw.Wfc);
    upload(w.bfc, hw.bfc); upload(w.Wproj, hw.Wproj); upload(w.bproj, hw.bproj);
    return w;
}
static Acts alloc_acts(int M)
{
    return { dalloc((size_t)M * C), dalloc((size_t)M * C), dalloc((size_t)M * H), dalloc((size_t)M * C), dalloc((size_t)M * C) };
}
static void free_all(Weights w, Acts a)
{
    for (float* p : {w.g, w.b, w.Wfc, w.bfc, w.Wproj, w.bproj, a.x, a.h, a.u, a.v, a.out}) CUDA_CHECK(cudaFree(p));
}

// ---------------------------------------------------------------------------
// CPU reference, in double precision
// ---------------------------------------------------------------------------
static void ref_sublayer(const HostWeights& w, const std::vector<float>& x, int M,
                         std::vector<float>& h, std::vector<float>& u, std::vector<float>& v, std::vector<float>& out)
{
    h.assign((size_t)M * C, 0); u.assign((size_t)M * H, 0); v.assign((size_t)M * C, 0); out.assign((size_t)M * C, 0);
    for (int m = 0; m < M; ++m) {
        const float* xr = &x[(size_t)m * C];
        double mean = 0; for (int i = 0; i < C; ++i) mean += xr[i]; mean /= C;
        double var = 0;  for (int i = 0; i < C; ++i) var += (xr[i] - mean) * (xr[i] - mean); var /= C;
        double rstd = 1.0 / std::sqrt(var + LN_EPS);
        for (int i = 0; i < C; ++i) h[(size_t)m * C + i] = (float)((xr[i] - mean) * rstd * w.g[i] + w.b[i]);
        for (int n = 0; n < H; ++n) {
            double acc = w.bfc[n];
            for (int k = 0; k < C; ++k) acc += (double)h[(size_t)m * C + k] * w.Wfc[(size_t)k * H + n];
            double t = 0.7978845608028654 * (acc + 0.044715 * acc * acc * acc);
            u[(size_t)m * H + n] = (float)(0.5 * acc * (1.0 + std::tanh(t)));
        }
        for (int n = 0; n < C; ++n) {
            double acc = w.bproj[n];
            for (int k = 0; k < H; ++k) acc += (double)u[(size_t)m * H + k] * w.Wproj[(size_t)k * C + n];
            v[(size_t)m * C + n] = (float)acc;
            out[(size_t)m * C + n] = (float)(xr[n] + acc);
        }
    }
}

// ---------------------------------------------------------------------------
// test
// ---------------------------------------------------------------------------
static bool check(const char* what, int M, const std::vector<float>& ref, const std::vector<float>& got,
                  double atol, double rtol)
{
    CompareResult r = compare(ref.data(), got.data(), ref.size(), atol, rtol);
    std::printf("  M = %-4d %-26s ", M, what);
    print_compare(r);
    std::printf("\n");
    return r.pass;
}

static int run_test()
{
    require_cuda_device();
    std::printf("=== Lab 05 / mlp test ===\n");
    HostWeights hw = make_weights();
    bool ok = true;
    for (int M : {1, 7, 64}) {
        Weights w = upload_weights(hw);
        Acts a = alloc_acts(M);
        std::vector<float> x = make((size_t)M * C, 100 + M, 1.0f, 0.1f);
        upload(a.x, x);
        std::vector<float> rh, ru, rv, rout;
        ref_sublayer(hw, x, M, rh, ru, rv, rout);

        // unfused path, checking every intermediate
        run_op(OP_LN, w, a, M);        CUDA_CHECK_LAUNCH(true);
        ok &= check("layernorm", M, rh, download(a.h, (size_t)M * C), 1e-5, 1e-4);
        run_op(OP_FC, w, a, M);  run_op(OP_FC_BIAS, w, a, M);  run_op(OP_GELU, w, a, M);  CUDA_CHECK_LAUNCH(true);
        ok &= check("fc + bias + gelu", M, ru, download(a.u, (size_t)M * H), 1e-5, 1e-4);
        run_op(OP_PROJ, w, a, M);  run_op(OP_PROJ_BIAS, w, a, M);  CUDA_CHECK_LAUNCH(true);
        ok &= check("proj + bias", M, rv, download(a.v, (size_t)M * C), 1e-5, 1e-4);
        run_op(OP_RES, w, a, M);  CUDA_CHECK_LAUNCH(true);
        ok &= check("residual (sublayer output)", M, rout, download(a.out, (size_t)M * C), 1e-5, 1e-4);

        // fused path must give the same u
        run_op(OP_FC, w, a, M);  run_op(OP_BIAS_GELU, w, a, M);  CUDA_CHECK_LAUNCH(true);
        ok &= check("fc + fused bias_gelu", M, ru, download(a.u, (size_t)M * H), 1e-5, 1e-4);
        free_all(w, a);
    }

    // The matmul on shapes that are not multiples of anything.
    for (auto s : {std::vector<int>{3, 100, 77}, std::vector<int>{5, 1, 300}, std::vector<int>{2, 257, 513}}) {
        int M = s[0], K = s[1], N = s[2];
        std::vector<float> A = make((size_t)M * K, 7, 1.0f), W = make((size_t)K * N, 8, 1.0f), ref((size_t)M * N);
        for (int m = 0; m < M; ++m)
            for (int n = 0; n < N; ++n) {
                double acc = 0;
                for (int k = 0; k < K; ++k) acc += (double)A[(size_t)m * K + k] * W[(size_t)k * N + n];
                ref[(size_t)m * N + n] = (float)acc;
            }
        float *dA = dalloc(A.size()), *dW = dalloc(W.size()), *dY = dalloc(ref.size());
        upload(dA, A); upload(dW, W);
        matmul_naive<<<dim3((N + MM_THREADS - 1) / MM_THREADS, M), MM_THREADS>>>(dA, dW, dY, M, K, N);
        CUDA_CHECK_LAUNCH(true);
        char what[64]; std::snprintf(what, sizeof what, "matmul %dx%dx%d", M, K, N);
        ok &= check(what, M, ref, download(dY, ref.size()), 1e-4, 1e-4);
        CUDA_CHECK(cudaFree(dA)); CUDA_CHECK(cudaFree(dW)); CUDA_CHECK(cudaFree(dY));
    }
    std::printf(ok ? "ALL TESTS PASSED\n" : "SOME TESTS FAILED\n");
    std::printf("PASTE: lab05 mlp test %s\n", ok ? "PASS" : "FAIL");
    return ok ? 0 : 1;
}

// ---------------------------------------------------------------------------
// bench: every op at M = 1, 64, 512
// ---------------------------------------------------------------------------
static int run_bench()
{
    require_cuda_device();
    DevicePeaks peaks = query_device_peaks();
    print_device_peaks(peaks);
    HostWeights hw = make_weights();
    Weights w = upload_weights(hw);
    std::printf("\nPASTE lines: microseconds per op (median of 20).\n");
    for (int M : {1, 64, 512}) {
        Acts a = alloc_acts(M);
        upload(a.x, make((size_t)M * C, 100 + M, 1.0f, 0.1f));
        run_op(OP_LN, w, a, M);                               // valid inputs for every op
        run_op(OP_FC, w, a, M);
        run_op(OP_PROJ, w, a, M);
        CUDA_CHECK_LAUNCH(true);

        double t[NUM_OPS], total = 0.0;
        for (int op = 0; op < NUM_OPS; ++op) {
            // GELU and the biases run in place: timing them repeatedly changes the
            // values, not the work, so the timing is still fair.
            t[op] = time_gpu([&] { run_op((Op)op, w, a, M); }).median_ms * 1e3;
            if (op != OP_BIAS_GELU) total += t[op];
        }
        std::printf("\nM = %d tokens\n", M);
        std::printf("  %-16s %9s %9s %9s %10s %9s %7s\n", "op", "us", "MB moved", "GB/s", "GFLOP/s", "FLOP/B", "share");
        for (int op = 0; op < NUM_OPS; ++op) {
            double bytes, flops;
            op_cost((Op)op, M, &bytes, &flops);
            std::printf("  %-16s %9.1f %9.2f %9.1f %10.1f %9.2f %6.1f%%\n", op_name[op], t[op], bytes / 1e6,
                        bytes / (t[op] * 1e3), flops / (t[op] * 1e3), flops / bytes,
                        op == OP_BIAS_GELU ? 0.0 : 100.0 * t[op] / total);
        }
        double fused_total = total - t[OP_FC_BIAS] - t[OP_GELU] + t[OP_BIAS_GELU];
        std::printf("  %-16s %9.1f   (fused path: %.1f us)\n", "total", total, fused_total);
        std::printf("PASTE: lab05 mlp M=%d", M);
        for (int op = 0; op < NUM_OPS; ++op) std::printf(" %s=%.1f", op_tag[op], t[op]);
        std::printf("\n");
        CUDA_CHECK(cudaFree(a.x)); CUDA_CHECK(cudaFree(a.h)); CUDA_CHECK(cudaFree(a.u));
        CUDA_CHECK(cudaFree(a.v)); CUDA_CHECK(cudaFree(a.out));
    }
    std::printf("\nRead the table against chapter 6: which ops sit at your DRAM ceiling,\n"
                "which at the launch floor, and what fraction of peak FLOP/s the naive\n"
                "matmul reaches (peak FP32 is printed at the top).\n");
    for (float* p : {w.g, w.b, w.Wfc, w.bfc, w.Wproj, w.bproj}) CUDA_CHECK(cudaFree(p));
    return 0;
}

// profile: one pass of the sublayer at M = 512, every kernel once
static int run_profile()
{
    require_cuda_device();
    const int M = 512;
    HostWeights hw = make_weights();
    Weights w = upload_weights(hw);
    Acts a = alloc_acts(M);
    upload(a.x, make((size_t)M * C, 612, 1.0f, 0.1f));
    for (int op = 0; op < NUM_OPS; ++op) {
        run_op((Op)op, w, a, M);
        CUDA_CHECK_LAUNCH(true);
        std::printf("ran %s\n", op_name[op]);
    }
    free_all(w, a);
    return 0;
}

int main(int argc, char** argv)
{
    if (argc != 2 || (std::strcmp(argv[1], "test") && std::strcmp(argv[1], "bench") &&
                      std::strcmp(argv[1], "profile"))) {
        std::fprintf(stderr, "usage: %s test|bench|profile\n", argv[0]);
        return 1;
    }
    if (!std::strcmp(argv[1], "test")) return run_test();
    if (!std::strcmp(argv[1], "bench")) return run_bench();
    return run_profile();
}
