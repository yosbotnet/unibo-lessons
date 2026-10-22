// model.h - GPT-2's shape, the order of its tensors in one flat buffer, and the weight file.
//
//   Config               L, C, H, V, T_max (and D = C / H)
//   Params               a pointer to every tensor inside ONE flat FP32 buffer
//   param_count(cfg)     how many floats that buffer holds
//   read_header(...)     the 256-int header of gpt2_124M.bin (written by export.py)
//
// The file is the header followed by every tensor in this order, FP32, row-major:
//
//   wte   [V, C]          token embedding; also the LM head (tied weights, chapter 10)
//   wpe   [T_max, C]      learned position embedding
//   for each of the L layers:
//     ln1_g, ln1_b  [C]
//     qkv_w [C, 3C]  qkv_b [3C]    HF c_attn: columns q | k | v, head h at h*D .. h*D+D-1 in each
//     prj_w [C, C]   prj_b [C]     HF attn.c_proj
//     ln2_g, ln2_b  [C]
//     fc_w  [C, 4C]  fc_b  [4C]    HF mlp.c_fc
//     fc2_w [4C, C]  fc2_b [C]     HF mlp.c_proj
//   lnf_g, lnf_b  [C]
//
// Linear weights are [in, out] (HF's Conv1D layout, the original GPT-2
// checkpoint), so every linear layer is y = x W + b with no transpose
// (chapter 6). Layer-major order means one layer's weights are contiguous:
// that is what a kernel streams during decode, and what export.py writes.
#pragma once

#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <vector>

struct Config {
    int L = 12, C = 768, H = 12, V = 50257, T_max = 1024;
    int D() const { return C / H; }
};

struct LayerParams {
    float *ln1_g, *ln1_b, *qkv_w, *qkv_b, *prj_w, *prj_b;
    float *ln2_g, *ln2_b, *fc_w, *fc_b, *fc2_w, *fc2_b;
};

struct Params {
    float *wte, *wpe;
    std::vector<LayerParams> layer;
    float *lnf_g, *lnf_b;
};

inline size_t layer_param_count(const Config& c)
{
    size_t C = c.C;
    return 2 * C + C * 3 * C + 3 * C + C * C + C + 2 * C + C * 4 * C + 4 * C + 4 * C * C + C;
}

inline size_t param_count(const Config& c)
{
    return (size_t)c.V * c.C + (size_t)c.T_max * c.C + c.L * layer_param_count(c) + 2 * (size_t)c.C;
}

// Point every tensor into the flat buffer `base` (device or host memory alike).
inline Params map_params(const Config& c, float* base)
{
    Params p;
    size_t C = c.C;
    float* q = base;
    auto take = [&](size_t n) { float* r = q; q += n; return r; };
    p.wte = take((size_t)c.V * C);
    p.wpe = take((size_t)c.T_max * C);
    p.layer.resize(c.L);
    for (auto& l : p.layer) {
        l.ln1_g = take(C);         l.ln1_b = take(C);
        l.qkv_w = take(C * 3 * C); l.qkv_b = take(3 * C);
        l.prj_w = take(C * C);     l.prj_b = take(C);
        l.ln2_g = take(C);         l.ln2_b = take(C);
        l.fc_w  = take(C * 4 * C); l.fc_b  = take(4 * C);
        l.fc2_w = take(4 * C * C); l.fc2_b = take(C);
    }
    p.lnf_g = take(C);
    p.lnf_b = take(C);
    return p;
}

// ---------------------------------------------------------------------------
// The weight file header: 256 int32. export.py writes exactly this.
//   [0] magic 20261022   [1] version 1   [2] L  [3] C  [4] H  [5] V  [6] T_max
//   [7] number of floats that follow (low 32 bits)  [8] (high 32 bits)
// ---------------------------------------------------------------------------
constexpr int32_t GPT2_MAGIC = 20261022;
constexpr int HEADER_INTS = 256;

inline bool read_header(FILE* f, Config& c, const char* path)
{
    int32_t h[HEADER_INTS];
    if (std::fread(h, sizeof(int32_t), HEADER_INTS, f) != HEADER_INTS || h[0] != GPT2_MAGIC || h[1] != 1) {
        std::fprintf(stderr, "%s: not a gpt2 weight file (run: python3 export.py)\n", path);
        return false;
    }
    c.L = h[2]; c.C = h[3]; c.H = h[4]; c.V = h[5]; c.T_max = h[6];
    uint64_t n = (uint32_t)h[7] | ((uint64_t)(uint32_t)h[8] << 32);
    if (n != param_count(c)) {
        std::fprintf(stderr, "%s: header says %llu floats, the shape needs %zu\n", path,
                     (unsigned long long)n, param_count(c));
        return false;
    }
    return true;
}

// Token id -> bytes, from gpt2_tokens.bin (export.py): int32 magic, int32 V,
// then for each id a uint8 length and that many bytes. Used only to print text.
struct Tokenizer {
    std::vector<std::vector<char>> piece;
    bool load(const char* path)
    {
        FILE* f = std::fopen(path, "rb");
        if (!f) return false;
        int32_t h[2];
        bool ok = std::fread(h, 4, 2, f) == 2 && h[0] == GPT2_MAGIC;
        if (ok) {
            piece.resize(h[1]);
            for (auto& p : piece) {
                unsigned char n;
                if (std::fread(&n, 1, 1, f) != 1) { ok = false; break; }
                p.resize(n);
                if (n && std::fread(p.data(), 1, n, f) != n) { ok = false; break; }
            }
        }
        std::fclose(f);
        return ok;
    }
    void print(int id) const
    {
        if (id >= 0 && id < (int)piece.size()) std::fwrite(piece[id].data(), 1, piece[id].size(), stdout);
        else std::printf("<%d>", id);
    }
};
