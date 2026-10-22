// Lab 10 - gpt2.cu: GPT-2 inference in CUDA, the course's spine engine.
//
//   ./gpt2 test            random small models vs a double-precision CPU forward (no files needed)
//   ./gpt2 verify          the real GPT-2 small vs reference logits from Python (export.py, reference.py)
//   ./gpt2 generate        text from a prompt (prompt.py writes the token ids)
//   ./gpt2 bench           chapter 11: weight loading three ways, forward time vs T, where the time goes
//   ./gpt2 bench-prefill   chapter 13: time to first token vs prompt length and batch
//   ./gpt2 bench-decode    chapter 13: time per output token vs context length and batch
//   ./gpt2 profile         one prefill and 16 decode steps, nothing else: the run for nsys
//
// Options (any mode):
//   --weights F (gpt2_124M.bin)  --tokens F (gpt2_tokens.bin)  --ref F (ref_logits.bin)
//   --linear cublas|own          the matmul backend (kernels.cuh)
//   --attn-prefill naive|flash   --attn-decode simple|split   (attention.cuh's tables; flash and split: D = 64)
//   --prompt F   --n 64   --temp 1.0 (0 = greedy)   --topk 40 (0 = all)   --seed 1   --B 1   --no-cache
//   --B 1,4,16 --T 128,1024   the grid of bench-prefill / bench-decode (generate uses the first B)
//   --dump L                  verify: write x after layer L to dump_L.bin, compare with dump_L_ref.bin
//
// The forward pass for B sequences of T_new new tokens each, starting at position pos0:
//
//   x   = wte[tokens] + wpe[pos0 ..]                      embed
//   for each layer:
//     h   = layernorm(x)                                  ln1
//     qkv = h W_qkv + b                                   [B*T_new, 3C]
//     (cache) k, v of the new tokens -> k_cache, v_cache  kv_append
//     a   = attention(q, k, v)                            prefill (pos0 = 0) or decode (T_new = 1)
//     x  += a W_prj + b                                   residual fused into the matmul
//     h   = layernorm(x)                                  ln2
//     u   = gelu(h W_fc + b)                              [B*T_new, 4C]
//     x  += u W_fc2 + b
//   logits = layernorm(x) wte^T                           all rows (verify) or each sequence's last
//
// Without the cache (--no-cache, chapter 11), every generated token reruns the
// whole sequence. With it (chapter 13), the prompt runs once (prefill) and each
// new token is one row (decode).

#include <chrono>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>

#include "model.h"
#include "kernels.cuh"
#include "attention.cuh"
#include "sample.cuh"
#include "cpu_ref.h"

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------
struct Options {
    const char* weights = "gpt2_124M.bin";
    const char* tokens = "gpt2_tokens.bin";
    const char* ref = "ref_logits.bin";
    const char* prompt = nullptr;
    const char* prefill = "naive";
    const char* decode = "simple";
    Backend be = Backend::cublas;
    int n = 64, topk = 40, B = 1, dump = -1;
    std::vector<int> Bs, Ts;          // bench-prefill / bench-decode: --B 1,4,16  --T 128,1024
    float temp = 1.0f;
    uint32_t seed = 1;
    bool cache = true;
};

static Options parse(int argc, char** argv)
{
    Options o;
    for (int i = 2; i < argc; ++i) {
        std::string a = argv[i];
        auto val = [&]() -> const char* {
            if (i + 1 >= argc) { std::fprintf(stderr, "%s needs a value\n", a.c_str()); std::exit(2); }
            return argv[++i];
        };
        if (a == "--weights") o.weights = val();
        else if (a == "--tokens") o.tokens = val();
        else if (a == "--ref") o.ref = val();
        else if (a == "--prompt") o.prompt = val();
        else if (a == "--attn-prefill") o.prefill = val();
        else if (a == "--attn-decode") o.decode = val();
        else if (a == "--linear") {
            std::string v = val();
            if (v == "cublas") o.be = Backend::cublas;
            else if (v == "own") o.be = Backend::own;
            else { std::fprintf(stderr, "--linear cublas|own\n"); std::exit(2); }
        }
        else if (a == "--n") o.n = std::atoi(val());
        else if (a == "--topk") o.topk = std::atoi(val());
        else if (a == "--B" || a == "--T") {
            std::vector<int>& v = a == "--B" ? o.Bs : o.Ts;
            for (const char* q = val(); *q; ) { v.push_back(std::atoi(q)); while (*q && *q != ',') ++q; if (*q) ++q; }
            if (a == "--B") o.B = v[0];
        }
        else if (a == "--dump") o.dump = std::atoi(val());
        else if (a == "--temp") o.temp = (float)std::atof(val());
        else if (a == "--seed") o.seed = (uint32_t)std::atoi(val());
        else if (a == "--no-cache") o.cache = false;
        else { std::fprintf(stderr, "unknown option %s\n", a.c_str()); std::exit(2); }
    }
    return o;
}

static double now_s()
{
    return std::chrono::duration<double>(std::chrono::steady_clock::now().time_since_epoch()).count();
}

// ---------------------------------------------------------------------------
// Where the time goes: events around each operation of one forward pass,
// summed per class. Only used by `bench`; recording events costs a little.
// ---------------------------------------------------------------------------
enum OpClass { OP_EMBED, OP_NORM, OP_LINEAR, OP_KV, OP_ATTN, OP_HEAD, OP_NCLASS };
static const char* OP_NAME[OP_NCLASS] = {"embedding", "layernorm", "linear (qkv, prj, fc, fc2)",
                                         "kv append", "attention", "lm head"};

struct Prof {
    struct Rec { int cls; cudaEvent_t a, b; };
    std::vector<Rec> recs;
    size_t used = 0;
    void begin(int cls)
    {
        if (used == recs.size()) {
            Rec r{cls, nullptr, nullptr};
            CUDA_CHECK(cudaEventCreate(&r.a)); CUDA_CHECK(cudaEventCreate(&r.b));
            recs.push_back(r);
        }
        recs[used].cls = cls;
        CUDA_CHECK(cudaEventRecord(recs[used].a));
    }
    void end() { CUDA_CHECK(cudaEventRecord(recs[used].b)); ++used; }
    void reset() { used = 0; }
    void add_to(double* ms)
    {
        CUDA_CHECK(cudaDeviceSynchronize());
        for (size_t i = 0; i < used; ++i) {
            float t; CUDA_CHECK(cudaEventElapsedTime(&t, recs[i].a, recs[i].b));
            ms[recs[i].cls] += t;
        }
    }
};

// ---------------------------------------------------------------------------
// The engine: weights, one arena of activations planned up front, the cache.
// ---------------------------------------------------------------------------
struct Engine {
    Config c;
    Options o;
    Params p;
    float* w = nullptr;        // all weights, one buffer
    float* wteT = nullptr;     // [C, V], own backend only
    int Bmax = 1, Tmax = 1, Tpre = 1, logit_rows = 1;   // Tpre: most new tokens per pass (activations)
    float *x, *ln, *qkv, *att, *fc, *last, *logits, *scratch;
    std::vector<float*> kc, vc;
    float* arena = nullptr;
    int* tok_d; int* next_d; float* u_d;
    const PrefillImpl* pre;
    const DecodeImpl* dec;
    Prof* prof = nullptr;
    int dump_layer = -1;              // --dump L: copy x after layer L to dump_x
    std::vector<float> dump_x;
    size_t bytes_act = 0, bytes_scratch = 0, bytes_cache = 0, bytes_logits = 0;

    void op(int cls) { if (prof) prof->begin(cls); }
    void done() { if (prof) prof->end(); }
};

// Plan all activation memory once, for at most Bmax sequences of Tmax tokens
// (the cache), of which at most Tpre arrive in one pass (the activations; a
// decode-only run needs one row per sequence): one cudaMalloc, carved into
// buffers. Nothing is allocated while running.
static void engine_init(Engine& E, float* weights_dev, const Config& c, const Options& o,
                        int Bmax, int Tmax, int logit_rows, int Tpre = -1)
{
    if (Tpre < 0) Tpre = Tmax;
    E.c = c; E.o = o; E.w = weights_dev; E.p = map_params(c, weights_dev);
    E.Bmax = Bmax; E.Tmax = Tmax; E.Tpre = Tpre; E.logit_rows = logit_rows;
    E.pre = find_impl(PREFILL_IMPLS, o.prefill);
    E.dec = find_impl(DECODE_IMPLS, o.decode);
    const size_t C = c.C, rows = (size_t)Bmax * Tpre;
    size_t act = rows * C * 3 + rows * 3 * C + rows * 4 * C + (size_t)Bmax * C;      // x, ln, att | qkv | fc | last
    size_t scr = std::max(Tpre > 1 ? E.pre->scratch(Bmax, Tpre, c.H, c.D()) : 0,
                          E.dec->scratch(Bmax, Tmax, c.H, c.D())) / sizeof(float) + 1;
    size_t cache = o.cache ? 2 * (size_t)c.L * Bmax * Tmax * C : 0;                // k and v, [B][H][Tmax][D] per layer
    size_t lg = (size_t)logit_rows * c.V;
    E.bytes_act = act * 4; E.bytes_scratch = scr * 4; E.bytes_cache = cache * 4; E.bytes_logits = lg * 4;
    // Every buffer starts on a 256-byte boundary, as its own cudaMalloc would: kernels that load 16
    // bytes at a time (float4) need aligned rows, and an odd V would misalign whatever follows the logits.
    auto pad = [](size_t n) { return (n + 63) / 64 * 64; };
    size_t total = 3 * pad(rows * C) + pad(rows * 3 * C) + pad(rows * 4 * C) + pad((size_t)Bmax * C) + pad(scr) + pad(lg)
                 + (o.cache ? 2 * (size_t)c.L * pad((size_t)Bmax * Tmax * C) : 0);
    CUDA_CHECK(cudaMalloc(&E.arena, total * sizeof(float)));
    float* q = E.arena;
    auto take = [&](size_t n) { float* r = q; q += pad(n); return r; };
    E.x = take(rows * C); E.ln = take(rows * C); E.att = take(rows * C);
    E.qkv = take(rows * 3 * C); E.fc = take(rows * 4 * C); E.last = take((size_t)Bmax * C);
    E.scratch = take(scr); E.logits = take(lg);
    E.kc.assign(c.L, nullptr); E.vc.assign(c.L, nullptr);
    if (o.cache)
        for (int l = 0; l < c.L; ++l) { E.kc[l] = take((size_t)Bmax * Tmax * C); E.vc[l] = take((size_t)Bmax * Tmax * C); }
    CUDA_CHECK(cudaMalloc(&E.tok_d, rows * sizeof(int)));
    CUDA_CHECK(cudaMalloc(&E.next_d, Bmax * sizeof(int)));
    CUDA_CHECK(cudaMalloc(&E.u_d, Bmax * sizeof(float)));
    if (o.be == Backend::own) {
        CUDA_CHECK(cudaMalloc(&E.wteT, (size_t)c.V * C * sizeof(float)));
        transpose<<<dim3(cdiv(c.C, 32), cdiv(c.V, 32)), dim3(32, 8)>>>(E.p.wte, E.wteT, c.V, c.C);
        CUDA_CHECK_LAUNCH(true);
    }
}

static void engine_free(Engine& E)
{
    CUDA_CHECK(cudaFree(E.arena)); CUDA_CHECK(cudaFree(E.tok_d)); CUDA_CHECK(cudaFree(E.next_d));
    CUDA_CHECK(cudaFree(E.u_d));
    if (E.wteT) CUDA_CHECK(cudaFree(E.wteT));
}

static void print_plan(const Engine& E)
{
    auto mb = [](size_t b) { return b / 1e6; };      // MB = 10^6 bytes, as in the chapters
    std::printf("memory plan: weights %.0f MB | activations %.1f MB | attention scratch %.1f MB | "
                "KV cache %.1f MB | logits %.1f MB  (B <= %d, T <= %d)\n",
                mb(param_count(E.c) * 4 + (E.wteT ? (size_t)E.c.V * E.c.C * 4 : 0)), mb(E.bytes_act),
                mb(E.bytes_scratch), mb(E.bytes_cache), mb(E.bytes_logits), E.Bmax, E.Tmax);
}

static std::vector<float> download(const float* d, size_t n)
{
    std::vector<float> h(n);
    CUDA_CHECK(cudaMemcpy(h.data(), d, n * sizeof(float), cudaMemcpyDeviceToHost));
    return h;
}

// One forward pass. tokens: B * T_new ids, sequence-major. Returns device
// logits: B * T_new rows if all_logits, else one row per sequence (its last token).
static float* forward(Engine& E, const int* tokens, int B, int T_new, int pos0, bool use_cache, bool all_logits)
{
    const Config& c = E.c;
    const int C = c.C, H = c.H, D = c.D(), M = B * T_new;
    const Backend be = E.o.be;
    if (B > E.Bmax || pos0 + T_new > E.Tmax || T_new > E.Tpre || (all_logits && M > E.logit_rows) || (!all_logits && B > E.logit_rows)) {
        std::fprintf(stderr, "forward: B = %d, T = %d exceeds the memory plan\n", B, pos0 + T_new); std::exit(2);
    }
    const bool decode = use_cache && pos0 > 0;
    if (decode && T_new != 1) { std::fprintf(stderr, "forward: decode takes one token per sequence\n"); std::exit(2); }
    if (!use_cache && pos0 != 0) { std::fprintf(stderr, "forward: without the cache every pass starts at 0\n"); std::exit(2); }

    CUDA_CHECK(cudaMemcpy(E.tok_d, tokens, M * sizeof(int), cudaMemcpyHostToDevice));
    E.op(OP_EMBED);
    embed<<<M, 256>>>(E.tok_d, E.p.wte, E.p.wpe, E.x, T_new, pos0, C);
    E.done();
    for (int l = 0; l < c.L; ++l) {
        const LayerParams& w = E.p.layer[l];
        E.op(OP_NORM);   layernorm<<<M, LN_THREADS>>>(E.x, w.ln1_g, w.ln1_b, E.ln, C);          E.done();
        E.op(OP_LINEAR); linear(be, EPI_BIAS, E.ln, w.qkv_w, w.qkv_b, E.qkv, M, 3 * C, C);     E.done();
        if (use_cache) {
            E.op(OP_KV); kv_append(E.qkv, E.kc[l], E.vc[l], B, T_new, pos0, H, D, E.Tmax, nullptr); E.done();
        }
        E.op(OP_ATTN);
        if (decode) E.dec->run(E.qkv, E.kc[l], E.vc[l], E.att, B, H, D, pos0 + 1, E.Tmax, E.scratch, nullptr);
        else        E.pre->run(E.qkv, E.att, B, T_new, H, D, E.scratch, nullptr);
        E.done();
        E.op(OP_LINEAR); linear(be, EPI_BIAS_RESIDUAL, E.att, w.prj_w, w.prj_b, E.x, M, C, C);  E.done();
        E.op(OP_NORM);   layernorm<<<M, LN_THREADS>>>(E.x, w.ln2_g, w.ln2_b, E.ln, C);          E.done();
        E.op(OP_LINEAR); linear(be, EPI_BIAS_GELU, E.ln, w.fc_w, w.fc_b, E.fc, M, 4 * C, C);    E.done();
        E.op(OP_LINEAR); linear(be, EPI_BIAS_RESIDUAL, E.fc, w.fc2_w, w.fc2_b, E.x, M, C, 4 * C); E.done();
        if (l == E.dump_layer) E.dump_x = download(E.x, (size_t)M * C);      // --dump: x after layer l
    }
    E.op(OP_NORM); layernorm<<<M, LN_THREADS>>>(E.x, E.p.lnf_g, E.p.lnf_b, E.ln, C); E.done();
    E.op(OP_HEAD);
    if (all_logits) {
        lm_head(be, E.ln, E.p.wte, E.wteT, E.logits, M, c.V, C);
    } else {
        gather_last_rows<<<B, 256>>>(E.ln, E.last, T_new, C);
        lm_head(be, E.last, E.p.wte, E.wteT, E.logits, B, c.V, C);
    }
    E.done();
    CUDA_CHECK_LAUNCH(false);
    return E.logits;
}

// ---------------------------------------------------------------------------
// Sampling: next token of each of B sequences from E.logits (one row each).
// ---------------------------------------------------------------------------
static uint32_t g_rng = 1;
static float rng_uniform()       // xorshift32 -> [0, 1)
{
    g_rng ^= g_rng << 13; g_rng ^= g_rng >> 17; g_rng ^= g_rng << 5;
    return (g_rng >> 8) * (1.0f / 16777216.0f);
}

static void sample_next(Engine& E, int B, std::vector<int>& next)
{
    if (E.o.temp <= 0.0f || E.o.topk == 1) {
        argmax_rows<<<B, SAMPLE_THREADS>>>(E.logits, E.c.V, E.next_d);
    } else {
        std::vector<float> u(B);
        for (auto& v : u) v = rng_uniform();
        CUDA_CHECK(cudaMemcpy(E.u_d, u.data(), B * sizeof(float), cudaMemcpyHostToDevice));
        sample_rows<<<B, SAMPLE_THREADS>>>(E.logits, E.c.V, E.o.temp, E.o.topk, E.u_d, E.next_d);
    }
    next.resize(B);
    CUDA_CHECK(cudaMemcpy(next.data(), E.next_d, B * sizeof(int), cudaMemcpyDeviceToHost));
}

// Generate n tokens for B copies of a prompt. Returns the new tokens of sequence 0.
// t_first: seconds to the first new token; t_rest: seconds for the others.
static std::vector<int> generate_tokens(Engine& E, const std::vector<int>& prompt, int B, int n,
                                        bool use_cache, double* t_first, double* t_rest, bool print,
                                        const Tokenizer* tk)
{
    const int T0 = (int)prompt.size();
    n = std::min(n, E.Tmax - T0);
    std::vector<std::vector<int>> seq(B, prompt);
    std::vector<int> out, next, flat;
    double t0 = now_s(), t1 = t0;
    for (int step = 0; step < n; ++step) {
        const int T = T0 + step;
        if (use_cache && step > 0) {
            flat.assign(B, 0);
            for (int b = 0; b < B; ++b) flat[b] = seq[b].back();
            forward(E, flat.data(), B, 1, T - 1, true, false);
        } else {
            flat.clear();
            for (int b = 0; b < B; ++b) flat.insert(flat.end(), seq[b].begin(), seq[b].end());
            forward(E, flat.data(), B, T, 0, use_cache, false);
        }
        sample_next(E, B, next);
        for (int b = 0; b < B; ++b) seq[b].push_back(next[b]);
        out.push_back(next[0]);
        if (step == 0) t1 = now_s();
        if (print && tk) { tk->print(next[0]); std::fflush(stdout); }
    }
    double t2 = now_s();
    if (t_first) *t_first = t1 - t0;
    if (t_rest) *t_rest = t2 - t1;
    return out;
}

// ---------------------------------------------------------------------------
// Weights: from the file to the GPU, three ways (chapter 11).
//   pageable  read into ordinary memory, one cudaMemcpy: the driver copies it
//             again into a pinned staging buffer behind your back, chunk by chunk
//   pinned    read straight into page-locked memory (cudaMallocHost): the copy
//             engine reads it directly over PCIe
//   overlap   two pinned 32 MB buffers: while chunk i crosses PCIe on a stream,
//             the CPU reads chunk i + 1 from the file
// ---------------------------------------------------------------------------
enum class LoadMode { pageable, pinned, overlap };

static double load_weights(const char* path, Config& c, float** dev, LoadMode mode)
{
    FILE* f = std::fopen(path, "rb");
    if (!f) { std::fprintf(stderr, "cannot open %s: run  python3 export.py  first\n", path); std::exit(1); }
    if (!read_header(f, c, path)) std::exit(1);
    const size_t bytes = param_count(c) * sizeof(float);
    if (!*dev) CUDA_CHECK(cudaMalloc(dev, bytes));
    double t0 = now_s();
    if (mode == LoadMode::pageable || mode == LoadMode::pinned) {
        char* h = nullptr;
        if (mode == LoadMode::pinned) CUDA_CHECK(cudaMallocHost(&h, bytes));
        else h = (char*)std::malloc(bytes);
        if (std::fread(h, 1, bytes, f) != bytes) { std::fprintf(stderr, "%s: short read\n", path); std::exit(1); }
        CUDA_CHECK(cudaMemcpy(*dev, h, bytes, cudaMemcpyHostToDevice));
        if (mode == LoadMode::pinned) CUDA_CHECK(cudaFreeHost(h)); else std::free(h);
    } else {
        const size_t CH = 32u << 20;
        char* buf[2]; cudaEvent_t done[2]; cudaStream_t s;
        CUDA_CHECK(cudaStreamCreate(&s));
        for (int i = 0; i < 2; ++i) { CUDA_CHECK(cudaMallocHost(&buf[i], CH)); CUDA_CHECK(cudaEventCreate(&done[i])); }
        for (size_t off = 0, i = 0; off < bytes; off += CH, ++i) {
            const int k = i % 2;
            const size_t n = std::min(CH, bytes - off);
            if (i >= 2) CUDA_CHECK(cudaEventSynchronize(done[k]));   // its previous copy has left buf[k]
            if (std::fread(buf[k], 1, n, f) != n) { std::fprintf(stderr, "%s: short read\n", path); std::exit(1); }
            CUDA_CHECK(cudaMemcpyAsync((char*)*dev + off, buf[k], n, cudaMemcpyHostToDevice, s));
            CUDA_CHECK(cudaEventRecord(done[k], s));
        }
        CUDA_CHECK(cudaStreamSynchronize(s));
        for (int i = 0; i < 2; ++i) { CUDA_CHECK(cudaFreeHost(buf[i])); CUDA_CHECK(cudaEventDestroy(done[i])); }
        CUDA_CHECK(cudaStreamDestroy(s));
    }
    double t = now_s() - t0;
    std::fclose(f);
    return t;
}

static std::vector<int> read_ids(const char* path)
{
    std::vector<int> ids;
    FILE* f = std::fopen(path, "r");
    if (!f) { std::fprintf(stderr, "cannot open %s\n", path); std::exit(1); }
    int v;
    while (std::fscanf(f, "%d", &v) == 1) ids.push_back(v);
    std::fclose(f);
    return ids;
}

// ---------------------------------------------------------------------------
// test: random models, every path against ref::forward
// ---------------------------------------------------------------------------
static void random_params(const Config& c, std::vector<float>& h, uint32_t seed)
{
    h.resize(param_count(c));
    fill_random(h.data(), h.size(), seed);           // [-1, 1)
    Params p = map_params(c, h.data());
    const size_t C = c.C;
    auto scale = [](float* a, size_t n, float s, float add) { for (size_t i = 0; i < n; ++i) a[i] = a[i] * s + add; };
    scale(p.wte, (size_t)c.V * C, 0.2f, 0); scale(p.wpe, (size_t)c.T_max * C, 0.1f, 0);
    for (auto& l : p.layer) {
        scale(l.ln1_g, C, 0.1f, 1); scale(l.ln1_b, C, 0.1f, 0); scale(l.ln2_g, C, 0.1f, 1); scale(l.ln2_b, C, 0.1f, 0);
        scale(l.qkv_w, C * 3 * C, 0.15f, 0); scale(l.qkv_b, 3 * C, 0.05f, 0);
        scale(l.prj_w, C * C, 0.1f, 0);      scale(l.prj_b, C, 0.05f, 0);
        scale(l.fc_w, C * 4 * C, 0.1f, 0);   scale(l.fc_b, 4 * C, 0.05f, 0);
        scale(l.fc2_w, 4 * C * C, 0.05f, 0); scale(l.fc2_b, C, 0.05f, 0);
    }
    scale(p.lnf_g, C, 0.1f, 1); scale(p.lnf_b, C, 0.1f, 0);
}

static bool report(const char* what, const std::vector<float>& ref, const std::vector<float>& got)
{
    CompareResult r = compare(ref.data(), got.data(), ref.size(), 2e-4, 2e-4);
    std::printf("  %-52s ", what);
    print_compare(r);
    std::printf("\n");
    return r.pass;
}

static bool test_model(const Config& c, int B, int T, Backend be, const char* pre_impl = "naive", const char* dec_impl = "simple")
{
    std::vector<float> hw;
    random_params(c, hw, 1000 + c.C + c.L);
    Params hp = map_params(c, hw.data());
    std::vector<int> tok(B * T);
    uint32_t s = 7;
    for (auto& t : tok) { s ^= s << 13; s ^= s >> 17; s ^= s << 5; t = s % c.V; }
    std::vector<float> want = ref::forward(c, hp, tok, B, T);

    float* dw = nullptr;
    CUDA_CHECK(cudaMalloc(&dw, hw.size() * sizeof(float)));
    CUDA_CHECK(cudaMemcpy(dw, hw.data(), hw.size() * sizeof(float), cudaMemcpyHostToDevice));
    Options o; o.be = be; o.cache = true; o.prefill = pre_impl; o.decode = dec_impl;
    Engine E;
    engine_init(E, dw, c, o, B, T, B * T);
    char name[160];
    std::snprintf(name, sizeof name, "L=%d C=%d H=%d V=%d B=%d T=%d %s %s+%s", c.L, c.C, c.H, c.V, B, T,
                  be == Backend::cublas ? "cublas" : "own", pre_impl, dec_impl);
    std::printf("%s\n", name);
    bool ok = true;

    // 1. the whole sequence at once, every position's logits (no cache)
    forward(E, tok.data(), B, T, 0, false, true);
    ok &= report("full forward, all positions", want, download(E.logits, want.size()));

    // 2. prefill the first T0 tokens into the cache, then decode the rest one by one
    const int T0 = T / 2;
    std::vector<int> pre;
    for (int b = 0; b < B; ++b) pre.insert(pre.end(), tok.begin() + b * T, tok.begin() + b * T + T0);
    forward(E, pre.data(), B, T0, 0, true, true);
    std::vector<float> got_pre = download(E.logits, (size_t)B * T0 * c.V), want_pre, want_dec, got_dec;
    for (int b = 0; b < B; ++b)
        want_pre.insert(want_pre.end(), want.begin() + (size_t)b * T * c.V, want.begin() + ((size_t)b * T + T0) * c.V);
    ok &= report("prefill into the KV cache", want_pre, got_pre);
    std::vector<int> one(B);
    for (int t = T0; t < T; ++t) {
        for (int b = 0; b < B; ++b) one[b] = tok[b * T + t];
        forward(E, one.data(), B, 1, t, true, false);
        std::vector<float> g = download(E.logits, (size_t)B * c.V);
        got_dec.insert(got_dec.end(), g.begin(), g.end());
        for (int b = 0; b < B; ++b)
            want_dec.insert(want_dec.end(), want.begin() + ((size_t)b * T + t) * c.V, want.begin() + ((size_t)b * T + t + 1) * c.V);
    }
    ok &= report("decode with the KV cache, one token at a time", want_dec, got_dec);

    // 3. greedy generation: with and without the cache, the same tokens
    if (B == 1) {
        E.o.temp = 0.0f;
        std::vector<int> prompt(tok.begin(), tok.begin() + T0);
        auto a = generate_tokens(E, prompt, 1, T - T0, false, nullptr, nullptr, false, nullptr);
        auto b2 = generate_tokens(E, prompt, 1, T - T0, true, nullptr, nullptr, false, nullptr);
        bool same = a == b2;
        std::printf("  %-52s %s\n", "greedy tokens, cache vs recompute", same ? "PASS (identical)" : "FAIL");
        ok &= same;
    }
    engine_free(E);
    CUDA_CHECK(cudaFree(dw));
    return ok;
}

// Sampling kernels against a CPU definition on random rows of a real-size vocabulary.
static bool test_sampling()
{
    const int R = 3, V = 50257;
    std::vector<float> h((size_t)R * V);
    fill_random(h.data(), h.size(), 99);
    for (auto& v : h) v *= 6.0f;
    float *d, *du; int* dout;
    CUDA_CHECK(cudaMalloc(&d, h.size() * 4)); CUDA_CHECK(cudaMalloc(&du, R * 4)); CUDA_CHECK(cudaMalloc(&dout, R * 4));
    CUDA_CHECK(cudaMemcpy(d, h.data(), h.size() * 4, cudaMemcpyHostToDevice));
    bool ok = true;
    std::vector<int> got(R);

    argmax_rows<<<R, SAMPLE_THREADS>>>(d, V, dout);
    CUDA_CHECK(cudaMemcpy(got.data(), dout, R * 4, cudaMemcpyDeviceToHost));
    for (int r = 0; r < R; ++r) {
        int bi = 0;
        for (int i = 1; i < V; ++i) if (h[(size_t)r * V + i] > h[(size_t)r * V + bi]) bi = i;
        ok &= got[r] == bi;
    }
    std::printf("  %-52s %s\n", "argmax over 50,257 logits", ok ? "PASS" : "FAIL");

    const int ks[] = {1, 40, 0};
    const float us[] = {0.0f, 0.13f, 0.37f, 0.5f, 0.81f, 0.999f};
    for (int k : ks) {
        bool okk = true;
        for (float uu : us) {
            std::vector<float> u(R, uu);
            CUDA_CHECK(cudaMemcpy(du, u.data(), R * 4, cudaMemcpyHostToDevice));
            const float temp = 0.8f;
            sample_rows<<<R, SAMPLE_THREADS>>>(d, V, temp, k, du, dout);
            CUDA_CHECK(cudaMemcpy(got.data(), dout, R * 4, cudaMemcpyDeviceToHost));
            for (int r = 0; r < R; ++r) {
                const float* x = &h[(size_t)r * V];
                std::vector<float> sorted(x, x + V);
                std::sort(sorted.begin(), sorted.end(), [](float a, float b) { return a > b; });
                float thr = (k > 0 && k < V) ? sorted[k - 1] : -1e30f, m = sorted[0];
                double Z = 0;
                for (int i = 0; i < V; ++i) if (x[i] >= thr) Z += std::exp((double)(x[i] - m) / temp);
                // the pick must survive top-k, and the cumulative distribution must bracket u there
                int g = got[r];
                double before = 0;
                for (int i = 0; i < g; ++i) if (x[i] >= thr) before += std::exp((double)(x[i] - m) / temp) / Z;
                double after = (g >= 0 && g < V && x[g] >= thr) ? before + std::exp((double)(x[g] - m) / temp) / Z : -1;
                bool good = g >= 0 && g < V && x[g] >= thr && before <= uu + 1e-4 && uu < after + 1e-4;
                okk &= good;
            }
        }
        char what[64];
        std::snprintf(what, sizeof what, "top-k sampling, k = %d (radix select + scan)", k);
        std::printf("  %-52s %s\n", what, okk ? "PASS" : "FAIL");
        ok &= okk;
    }
    CUDA_CHECK(cudaFree(d)); CUDA_CHECK(cudaFree(du)); CUDA_CHECK(cudaFree(dout));
    return ok;
}

static int run_test()
{
    bool ok = true;
    struct Case { Config c; int B, T; };
    std::vector<Case> cases;
    { Config c; c.L = 2; c.C = 64;  c.H = 4; c.V = 97;  c.T_max = 32; cases.push_back({c, 2, 13}); }
    { Config c; c.L = 1; c.C = 128; c.H = 2; c.V = 301; c.T_max = 64; cases.push_back({c, 1, 37}); }
    { Config c; c.L = 2; c.C = 96;  c.H = 3; c.V = 50;  c.T_max = 16; cases.push_back({c, 3, 7}); }
    for (Backend be : {Backend::cublas, Backend::own})
        for (auto& k : cases) ok &= test_model(k.c, k.B, k.T, be);
    {   // chapters 14 and 15: lab 13's flash prefill and lab 14's split-K decode (both need D = 64)
        Config c; c.L = 2; c.C = 128; c.H = 2; c.V = 301; c.T_max = 160;
        ok &= test_model(c, 2, 150, Backend::cublas, "flash", "split");
    }
    std::printf("sampling\n");
    ok &= test_sampling();
    std::printf("PASTE: lab10 test %s\n", ok ? "ALL PASS" : "FAILED");
    return ok ? 0 : 1;
}

// --dump L: write the residual stream x after layer L ([T, C] float32) to
// dump_L.bin, and if reference.py --dump L left dump_L_ref.bin, compare the two:
// the first layer whose error jumps is where the bug is (chapter 11, section 6).
static void dump_compare(const Engine& E, int L, int T)
{
    char a[64], b[64];
    std::snprintf(a, sizeof a, "dump_%d.bin", L);
    std::snprintf(b, sizeof b, "dump_%d_ref.bin", L);
    FILE* f = std::fopen(a, "wb");
    std::fwrite(E.dump_x.data(), 4, E.dump_x.size(), f);
    std::fclose(f);
    std::printf("  wrote %s: x after layer %d, %d x %d float32\n", a, L, T, E.c.C);
    f = std::fopen(b, "rb");
    if (!f) { std::printf("  (no %s: run  python3 reference.py --dump %d  to compare)\n", b, L); return; }
    std::vector<float> r(E.dump_x.size());
    size_t got = std::fread(r.data(), 4, r.size(), f);
    std::fclose(f);
    if (got != r.size()) { std::printf("  %s has %zu floats, expected %zu\n", b, got, r.size()); return; }
    double e = 0, m = 0;
    for (size_t i = 0; i < r.size(); ++i) { e = std::max(e, (double)std::fabs(r[i] - E.dump_x[i])); m = std::max(m, (double)std::fabs(r[i])); }
    std::printf("  layer %d: max |x error| %.2e (|x| up to %.1f)\n", L, e, m);
}

// ---------------------------------------------------------------------------
// verify: the real model against reference logits (reference.py)
// ref_logits.bin: int32 magic, T, V, then T int32 token ids, then T x V float32 logits
// ---------------------------------------------------------------------------
static int run_verify(const Options& o)
{
    FILE* f = std::fopen(o.ref, "rb");
    if (!f) { std::fprintf(stderr, "cannot open %s: run  python3 reference.py  first\n", o.ref); return 1; }
    int32_t h[3];
    if (std::fread(h, 4, 3, f) != 3 || h[0] != GPT2_MAGIC) { std::fprintf(stderr, "%s: bad header\n", o.ref); return 1; }
    const int T = h[1], V = h[2];
    std::vector<int> tok(T);
    std::vector<float> want((size_t)T * V);
    if (std::fread(tok.data(), 4, T, f) != (size_t)T || std::fread(want.data(), 4, want.size(), f) != want.size()) {
        std::fprintf(stderr, "%s: short file\n", o.ref); return 1;
    }
    std::fclose(f);

    Config c; float* dw = nullptr;
    double t = load_weights(o.weights, c, &dw, LoadMode::pinned);
    std::printf("weights: %s, %.1f M parameters, loaded in %.2f s\n", o.weights, param_count(c) / 1e6, t);
    if (V != c.V) { std::fprintf(stderr, "vocabulary mismatch: %d vs %d\n", V, c.V); return 1; }
    Options oo = o; oo.cache = true;
    Engine E;
    engine_init(E, dw, c, oo, 1, T, T);
    print_plan(E);

    auto score = [&](const std::vector<float>& got, int t0, int t1, const char* what) {
        double maxerr = 0, maxref = 0; int agree = 0;
        for (int t = t0; t < t1; ++t) {
            const float* g = &got[(size_t)(t - t0) * V];
            const float* w = &want[(size_t)t * V];
            int ag = 0, aw = 0;
            for (int v = 0; v < V; ++v) {
                maxerr = std::max(maxerr, (double)std::fabs(g[v] - w[v]));
                maxref = std::max(maxref, (double)std::fabs(w[v]));
                if (g[v] > g[ag]) ag = v;
                if (w[v] > w[aw]) aw = v;
            }
            agree += ag == aw;
        }
        bool pass = maxerr < 1e-2 && agree == t1 - t0;
        std::printf("  %-34s max |logit error| %.2e (logits up to %.1f), top-1 agrees at %d / %d positions: %s\n",
                    what, maxerr, maxref, agree, t1 - t0, pass ? "PASS" : "FAIL");
        return std::make_pair(pass, maxerr);
    };
    if (o.dump >= c.L) { std::fprintf(stderr, "--dump %d: the model has layers 0 .. %d\n", o.dump, c.L - 1); return 1; }
    E.dump_layer = o.dump;
    forward(E, tok.data(), 1, T, 0, false, true);
    E.dump_layer = -1;
    auto a = score(download(E.logits, (size_t)T * V), 0, T, "full forward");
    if (o.dump >= 0) dump_compare(E, o.dump, T);
    const int T0 = T / 2;
    forward(E, tok.data(), 1, T0, 0, true, true);
    std::vector<float> got = download(E.logits, (size_t)T0 * V);
    for (int t = T0; t < T; ++t) {
        forward(E, &tok[t], 1, 1, t, true, false);
        std::vector<float> g = download(E.logits, V);
        got.insert(got.end(), g.begin(), g.end());
    }
    auto b = score(got, 0, T, "prefill + decode with the cache");
    std::printf("PASTE: lab10 verify T=%d %s maxerr_full=%.2e maxerr_cache=%.2e %s\n", T,
                o.be == Backend::cublas ? "cublas" : "own", a.second, b.second, (a.first && b.first) ? "PASS" : "FAIL");
    engine_free(E);
    CUDA_CHECK(cudaFree(dw));
    return (a.first && b.first) ? 0 : 1;
}

// ---------------------------------------------------------------------------
// generate
// ---------------------------------------------------------------------------
static int run_generate(const Options& o)
{
    Config c; float* dw = nullptr;
    load_weights(o.weights, c, &dw, LoadMode::overlap);
    Tokenizer tk;
    bool have_tk = tk.load(o.tokens);
    // default prompt: <|endoftext|> alone (id 50256 = V - 1), GPT-2's start of a document
    std::vector<int> prompt = o.prompt ? read_ids(o.prompt) : std::vector<int>{c.V - 1};
    for (int id : prompt)
        if (id < 0 || id >= c.V) { std::fprintf(stderr, "prompt token %d is outside the vocabulary\n", id); return 1; }
    Engine E;
    engine_init(E, dw, c, o, o.B, c.T_max, o.B);
    g_rng = o.seed ? o.seed : 1;
    if (have_tk) for (int id : prompt) tk.print(id);
    else std::printf("(no %s: printing token ids)\n", o.tokens);
    double tf, tr;
    std::vector<int> out = generate_tokens(E, prompt, o.B, o.n, o.cache, &tf, &tr, have_tk, &tk);
    if (!have_tk) for (int id : out) std::printf("%d ", id);
    std::printf("\n\n%zu tokens, B = %d, %s: first token %.1f ms, then %.2f ms per token (%.1f tokens/s per sequence)\n",
                out.size(), o.B, o.cache ? "KV cache" : "no cache (recompute)", tf * 1e3,
                out.size() > 1 ? tr * 1e3 / (out.size() - 1) : 0.0, out.size() > 1 ? (out.size() - 1) / tr : 0.0);
    engine_free(E);
    CUDA_CHECK(cudaFree(dw));
    return 0;
}

// ---------------------------------------------------------------------------
// bench (chapter 11), bench-prefill and bench-decode (chapter 13)
// ---------------------------------------------------------------------------
static std::vector<int> random_ids(size_t n, int V, uint32_t s = 3)
{
    std::vector<int> v(n);
    for (auto& t : v) { s ^= s << 13; s ^= s >> 17; s ^= s << 5; t = s % V; }
    return v;
}

static int run_bench(const Options& o)
{
    DevicePeaks pk = query_device_peaks();
    print_device_peaks(pk);
    Config c; float* dw = nullptr;
    const char* names[3] = {"pageable", "pinned", "overlap"};
    double gbs[3];
    std::printf("\nweight upload, %s (the first read may come from disk, later ones from the OS page cache):\n", o.weights);
    for (int m = 0; m < 3; ++m) {
        double t = load_weights(o.weights, c, &dw, (LoadMode)m);
        gbs[m] = param_count(c) * 4.0 / t / 1e9;
        std::printf("  %-9s %7.1f ms  %6.2f GB/s\n", names[m], t * 1e3, gbs[m]);
    }
    Options oo = o; oo.cache = false;
    Engine E;
    engine_init(E, dw, c, oo, 1, c.T_max, c.T_max);
    print_plan(E);

    std::printf("\nforward pass, B = 1, last-token logits (generation without a cache reruns this for every token):\n");
    std::printf("  %6s %10s %14s\n", "T", "ms", "tokens/s");
    const int Ts[] = {64, 128, 256, 512, 1024};
    double ms1024 = 0;
    for (int T : Ts) {
        if (T > c.T_max) continue;                                   // (small test models)
        std::vector<int> ids = random_ids(T, c.V);
        Timing tm = time_gpu([&] { forward(E, ids.data(), 1, T, 0, false, false); }, 2, 10);
        std::printf("  %6d %10.2f %14.1f\n", T, tm.median_ms, 1e3 / tm.median_ms);
        if (T == 1024) ms1024 = tm.median_ms;
    }
    std::printf("\nwhere the time goes (events around every operation, summed):\n");
    Prof prof;
    for (int T : {64, 1024}) {
        T = std::min(T, c.T_max);
        std::vector<int> ids = random_ids(T, c.V);
        double ms[OP_NCLASS] = {}, tot = 0;
        E.prof = &prof;
        for (int r = 0; r < 5; ++r) { prof.reset(); forward(E, ids.data(), 1, T, 0, false, false); prof.add_to(ms); }
        E.prof = nullptr;
        for (double v : ms) tot += v;
        std::printf("  T = %d (%zu timed operations per pass):\n", T, prof.used);
        for (int k = 0; k < OP_NCLASS; ++k)
            if (ms[k] > 0) std::printf("    %-28s %8.3f ms  %5.1f%%\n", OP_NAME[k], ms[k] / 5, 100 * ms[k] / tot);
    }
    std::printf("PASTE: lab10 bench %s load_GBs=%.1f/%.1f/%.1f fwd_T1024_ms=%.2f\n",
                o.be == Backend::cublas ? "cublas" : "own", gbs[0], gbs[1], gbs[2], ms1024);
    engine_free(E);
    CUDA_CHECK(cudaFree(dw));
    return 0;
}

// The roofline arithmetic of chapter 13, in C, so each bench line carries its own prediction.
//   n_mm  weights that take part in a matmul, biases included, plus the LM head's V x C
//   F_lin = 2 n_mm FLOPs per token; attention adds 4 L t C per token at context t
//   prefill runs the LM head on the last position only (the engine's logit_rows), so it pays
//   2 (n_mm - V C) per prompt token plus 2 V C once
//   kv    = 2 L C 4 bytes of cache per token (k and v, FP32)
struct Arith {
    double n_mm, W, kv, peak, bw;
    Arith(const Config& c, const DevicePeaks& pk)
    {
        const double C = c.C;
        n_mm = c.L * (12 * C * C + 9 * C) + (double)c.V * C;
        W = 4.0 * param_count(c);
        kv = 2.0 * c.L * C * 4;
        peak = pk.fp32_tflops > 0 ? pk.fp32_tflops * 1e12 : 30.9e12;
        bw = pk.dram_gbs() * 1e9;
    }
    double prefill_flops(const Config& c, int B, int T) const
    {
        const double head = (double)c.V * c.C;
        return B * (T * 2 * (n_mm - head) + 2 * head + 2.0 * c.L * (double)T * T * c.C);
    }
    double decode_flops(const Config& c, int B, int t) const { return B * (2 * n_mm + 4.0 * c.L * (double)t * c.C); }
    double roof_ms(double flops, double bytes) const { return 1e3 * std::max(flops / peak, bytes / bw); }
};

// Weights for the bench modes: the real file if present, else random GPT-2
// small weights (the timing does not care what the numbers are).
static bool bench_weights(const Options& o, Config& c, float** dw)
{
    if (FILE* f = std::fopen(o.weights, "rb")) {
        std::fclose(f);
        load_weights(o.weights, c, dw, LoadMode::overlap);
        std::printf("weights: %s\n", o.weights);
        return true;
    }
    c = Config();
    std::vector<float> h;
    random_params(c, h, 1);
    CUDA_CHECK(cudaMalloc(dw, h.size() * sizeof(float)));
    CUDA_CHECK(cudaMemcpy(*dw, h.data(), h.size() * sizeof(float), cudaMemcpyHostToDevice));
    std::printf("weights: random GPT-2 small (no %s; timings are the same)\n", o.weights);
    return false;
}

static std::vector<int> list_or(const std::vector<int>& v, std::initializer_list<int> d, int cap)
{
    std::vector<int> r;
    for (int x : (v.empty() ? std::vector<int>(d) : v)) if (x <= cap) r.push_back(x);
    return r;
}

static size_t free_bytes() { size_t f, t; CUDA_CHECK(cudaMemGetInfo(&f, &t)); return f; }

static int run_bench_prefill(const Options& o)
{
    DevicePeaks pk = query_device_peaks();
    print_device_peaks(pk);
    Config c; float* dw = nullptr;
    bench_weights(o, c, &dw);
    Arith ar(c, pk);
    std::vector<int> Bs = list_or(o.Bs, {1, 4}, 64), Ts = list_or(o.Ts, {128, 256, 512, 1024}, c.T_max);
    int Bmax = *std::max_element(Bs.begin(), Bs.end()), Tmax = *std::max_element(Ts.begin(), Ts.end());
    Options oo = o; oo.cache = true;
    Engine E;
    size_t f0 = free_bytes();
    engine_init(E, dw, c, oo, Bmax, Tmax, Bmax);
    print_plan(E);
    std::printf("engine memory (cudaMemGetInfo): %.0f MB besides the weights\n", (f0 - free_bytes()) / 1e6);
    std::printf("\nprefill: B prompts of T tokens into the KV cache, last-token logits (median of 10, after 3 warm-ups)\n"
                "attention: %s; prediction = max(FLOPs / %.1f TFLOP/s, bytes / %.0f GB/s), bytes = weights + cache written\n",
                E.pre->name, ar.peak / 1e12, ar.bw / 1e9);
    for (int B : Bs)
        for (int T : Ts) {
            std::vector<int> ids = random_ids((size_t)B * T, c.V);
            Timing tm = time_gpu([&] { forward(E, ids.data(), B, T, 0, true, false); }, 3, 10);
            double fl = ar.prefill_flops(c, B, T), pred = ar.roof_ms(fl, ar.W + B * (double)T * ar.kv);
            std::printf("PASTE: prefill B=%d T=%d ms=%.3f gflop=%.1f tflops=%.2f pred_roof_ms=%.3f frac=%.2f\n",
                        B, T, tm.median_ms, fl / 1e9, fl / tm.median_ms / 1e9, pred, pred / tm.median_ms);
        }
    engine_free(E);
    CUDA_CHECK(cudaFree(dw));
    return 0;
}

// Fill a cache region with small pseudo-random values: decode timing needs a
// full cache, not a meaningful one, and a prefill of B x T tokens would need
// B x T rows of activations that a decode-only run never uses.
__global__ void fill_cache(float* p, size_t n, uint32_t seed)
{
    for (size_t i = (size_t)blockIdx.x * blockDim.x + threadIdx.x; i < n; i += (size_t)gridDim.x * blockDim.x) {
        uint32_t h = (uint32_t)i * 2654435761u ^ seed;
        h ^= h >> 15; h *= 2246822519u; h ^= h >> 13;
        p[i] = ((h >> 8) * (1.0f / 16777216.0f) - 0.5f) * 0.2f;
    }
}

static int run_bench_decode(const Options& o)
{
    DevicePeaks pk = query_device_peaks();
    print_device_peaks(pk);
    Config c; float* dw = nullptr;
    bench_weights(o, c, &dw);
    Arith ar(c, pk);
    std::vector<int> Bs = list_or(o.Bs, {1, 4, 16, 64}, 1 << 20), Ts = list_or(o.Ts, {128, 256, 512, 1024}, c.T_max);
    int Bmax = *std::max_element(Bs.begin(), Bs.end()), Tmax = *std::max_element(Ts.begin(), Ts.end());
    Options oo = o; oo.cache = true;
    Engine E;
    size_t f0 = free_bytes();
    engine_init(E, dw, c, oo, Bmax, Tmax, Bmax, 1);                    // decode only: one activation row per sequence
    print_plan(E);
    std::printf("engine memory (cudaMemGetInfo): %.0f MB besides the weights\n", (f0 - free_bytes()) / 1e6);
    for (int l = 0; l < c.L; ++l) {
        size_t n = (size_t)Bmax * Tmax * c.C;
        fill_cache<<<1024, 256>>>(E.kc[l], n, 2 * l + 1);
        fill_cache<<<1024, 256>>>(E.vc[l], n, 2 * l + 2);
    }
    CUDA_CHECK_LAUNCH(true);
    std::printf("\ndecode: one new token for each of B sequences at context t (the token at position t - 1);\n"
                "the same step is timed 20 times with the position fixed (median); attention = the %d layers'\n"
                "%s kernels alone, its GB/s = cache bytes read / attention time\n", c.L, E.dec->name);
    std::vector<int> next;
    for (int B : Bs)
        for (int t : Ts) {
            std::vector<int> one = random_ids(B, c.V, 11);
            Timing tm = time_gpu([&] { forward(E, one.data(), B, 1, t - 1, true, false); sample_next(E, B, next); }, 3, 20);
            Timing ta = time_gpu([&] {
                for (int l = 0; l < c.L; ++l)
                    E.dec->run(E.qkv, E.kc[l], E.vc[l], E.att, B, c.H, c.D(), t, E.Tmax, E.scratch, nullptr);
            }, 3, 20);
            double bkv = B * (double)t * ar.kv, pred = ar.roof_ms(ar.decode_flops(c, B, t), ar.W + bkv);
            std::printf("PASTE: decode B=%d t=%d ms=%.3f bytes_w=%.0f bytes_kv=%.0f pred_roof_ms=%.3f frac=%.2f "
                        "attn_ms=%.3f attn_gbs=%.0f cache_mb=%.1f\n", B, t, tm.median_ms, ar.W, bkv, pred,
                        pred / tm.median_ms, ta.median_ms, bkv / ta.median_ms / 1e6, B * (double)E.Tmax * ar.kv / 1e6);
        }
    engine_free(E);
    CUDA_CHECK(cudaFree(dw));
    return 0;
}

static int run_profile(const Options& o)
{
    Config c; float* dw = nullptr;
    load_weights(o.weights, c, &dw, LoadMode::overlap);
    Options oo = o; oo.temp = 0.0f;
    Engine E;
    engine_init(E, dw, c, oo, 1, c.T_max, 1);
    std::vector<int> prompt = random_ids(std::min(256, c.T_max / 2), c.V);
    generate_tokens(E, prompt, 1, 2, oo.cache, nullptr, nullptr, false, nullptr);          // warm up
    CUDA_CHECK(cudaDeviceSynchronize());
    generate_tokens(E, prompt, 1, 17, oo.cache, nullptr, nullptr, false, nullptr);         // 1 prefill + 16 decode steps
    CUDA_CHECK(cudaDeviceSynchronize());
    std::printf("profile: prefill of 256 tokens and 16 decode steps (%s)\n", oo.cache ? "KV cache" : "recompute");
    engine_free(E);
    CUDA_CHECK(cudaFree(dw));
    return 0;
}

int main(int argc, char** argv)
{
    require_cuda_device();
    if (argc < 2) {
        std::fprintf(stderr, "usage: %s test | verify | generate | bench | bench-prefill | bench-decode | profile [options]\n", argv[0]);
        return 2;
    }
    std::string mode = argv[1];
    Options o = parse(argc, argv);
    if (mode == "test") return run_test();
    if (mode == "verify") return run_verify(o);
    if (mode == "generate") return run_generate(o);
    if (mode == "bench") return run_bench(o);
    if (mode == "bench-prefill") return run_bench_prefill(o);
    if (mode == "bench-decode") return run_bench_decode(o);
    if (mode == "profile") return run_profile(o);
    std::fprintf(stderr, "unknown mode %s\n", mode.c_str());
    return 2;
}
