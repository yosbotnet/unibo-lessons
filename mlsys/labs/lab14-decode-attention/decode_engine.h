// decode_engine.h - lab 14's split-K decode attention with the engine contract's signatures
// (PLAN section 4), ready for mlsys/labs/gpt2/: include this header from attention.cuh and add
//     {"split", attn_decode_split, attn_decode_split_scratch_bytes},
// to DECODE_IMPLS. It brings only the kernels (decode_kernels.h), not lab 14's kv_append, so it does
// not clash with the engine's own.
//
//   qkv      [B, 3C]  row b = the new token of sequence b (q at columns h*D .. h*D + D - 1)
//   k_cache, v_cache  [B][H][T_max][D] FP32, the new token already appended (T_ctx includes it)
//   att      [B, C]   heads merged in the same column order
//   scratch  B*H*64*(D + 2) floats: one partial (m, l, O~[D]) per (b, h, split), at most 64 splits
#pragma once

#include <cassert>
#include "decode_kernels.h"

inline size_t attn_decode_split_scratch_bytes(int B, int /*T_ctx*/, int H, int D)
{
    return (size_t)B * H * DEC_S_MAX * (D + 2) * sizeof(float);
}

inline void attn_decode_split(const float* qkv, const float* k_cache, const float* v_cache, float* att,
                              int B, int H, int D, int T_ctx, int T_max, float* scratch, cudaStream_t s)
{
    assert(D == 64 && "lab 14's kernels are instantiated for D = 64");
    const int C = H * D;
    const int S = min(choose_splits(B, H, T_ctx), DEC_S_MAX);   // the clamp only matters when B*H < 3
    if (S == 1) {                                                 // no partials, no combine
        decode_v3_split<64, true><<<dim3(B * H, 1), DEC_BLOCK, 0, s>>>(qkv, 3 * C, k_cache, v_cache, att, H, T_ctx,
                                                                      nullptr, T_max, 1);
        return;
    }
    decode_v3_split<64, false><<<dim3(B * H, S), DEC_BLOCK, 0, s>>>(qkv, 3 * C, k_cache, v_cache, scratch, H, T_ctx,
                                                                   nullptr, T_max, S);
    decode_combine<64><<<B * H, 64, 0, s>>>(scratch, att, H, S);
}
