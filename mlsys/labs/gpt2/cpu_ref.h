// cpu_ref.h - GPT-2's forward pass on the CPU in double precision, written
// as plainly as possible: the definition the GPU engine is tested against.
// Every position attends to itself and all earlier positions; no cache, no tricks.
#pragma once

#include <cmath>
#include <vector>
#include "model.h"

namespace ref {

inline void layernorm(const double* x, const float* g, const float* b, double* y, int n)
{
    double mean = 0, var = 0;
    for (int i = 0; i < n; ++i) mean += x[i];
    mean /= n;
    for (int i = 0; i < n; ++i) var += (x[i] - mean) * (x[i] - mean);
    var /= n;
    double rstd = 1.0 / std::sqrt(var + 1e-5);
    for (int i = 0; i < n; ++i) y[i] = (x[i] - mean) * rstd * g[i] + b[i];
}

// y[N] = x[K] W[K, N] + b
inline void linear(const double* x, const float* W, const float* b, double* y, int K, int N)
{
    for (int n = 0; n < N; ++n) y[n] = b ? b[n] : 0.0;
    for (int k = 0; k < K; ++k)
        for (int n = 0; n < N; ++n) y[n] += x[k] * W[(size_t)k * N + n];
}

inline double gelu(double x)
{
    return 0.5 * x * (1.0 + std::tanh(0.7978845608028654 * (x + 0.044715 * x * x * x)));
}

// logits[b*T + t][V] for every position of B sequences of T tokens.
inline std::vector<float> forward(const Config& c, const Params& p, const std::vector<int>& tok, int B, int T)
{
    const int C = c.C, H = c.H, D = c.D(), V = c.V;
    std::vector<float> logits((size_t)B * T * V);
    std::vector<double> x((size_t)T * C), h(C), qkv((size_t)T * 3 * C), att(C), y(4 * C), u(4 * C), s(T);
    for (int b = 0; b < B; ++b) {
        for (int t = 0; t < T; ++t)
            for (int i = 0; i < C; ++i)
                x[(size_t)t * C + i] = (double)p.wte[(size_t)tok[b * T + t] * C + i] + p.wpe[(size_t)t * C + i];
        for (int l = 0; l < c.L; ++l) {
            const LayerParams& w = p.layer[l];
            for (int t = 0; t < T; ++t) {
                layernorm(&x[(size_t)t * C], w.ln1_g, w.ln1_b, h.data(), C);
                linear(h.data(), w.qkv_w, w.qkv_b, &qkv[(size_t)t * 3 * C], C, 3 * C);
            }
            for (int t = 0; t < T; ++t) {
                for (int hh = 0; hh < H; ++hh) {
                    const double* q = &qkv[(size_t)t * 3 * C + hh * D];
                    double m = -1e300, sum = 0;
                    for (int j = 0; j <= t; ++j) {
                        const double* k = &qkv[(size_t)j * 3 * C + C + hh * D];
                        double d = 0;
                        for (int e = 0; e < D; ++e) d += q[e] * k[e];
                        s[j] = d / std::sqrt((double)D);
                        m = std::max(m, s[j]);
                    }
                    for (int j = 0; j <= t; ++j) { s[j] = std::exp(s[j] - m); sum += s[j]; }
                    for (int e = 0; e < D; ++e) {
                        double o = 0;
                        for (int j = 0; j <= t; ++j) o += s[j] * qkv[(size_t)j * 3 * C + 2 * C + hh * D + e];
                        att[hh * D + e] = o / sum;
                    }
                }
                // safe to update x[t] now: every token's q, k, v were computed above
                linear(att.data(), w.prj_w, w.prj_b, y.data(), C, C);
                for (int i = 0; i < C; ++i) x[(size_t)t * C + i] += y[i];
            }
            for (int t = 0; t < T; ++t) {
                layernorm(&x[(size_t)t * C], w.ln2_g, w.ln2_b, h.data(), C);
                linear(h.data(), w.fc_w, w.fc_b, y.data(), C, 4 * C);
                for (int i = 0; i < 4 * C; ++i) y[i] = gelu(y[i]);
                linear(y.data(), w.fc2_w, w.fc2_b, u.data(), 4 * C, C);
                for (int i = 0; i < C; ++i) x[(size_t)t * C + i] += u[i];
            }
        }
        for (int t = 0; t < T; ++t) {
            layernorm(&x[(size_t)t * C], p.lnf_g, p.lnf_b, h.data(), C);
            for (int v = 0; v < V; ++v) {
                double d = 0;
                for (int i = 0; i < C; ++i) d += h[i] * p.wte[(size_t)v * C + i];
                logits[((size_t)b * T + t) * V + v] = (float)d;
            }
        }
    }
    return logits;
}

}  // namespace ref
