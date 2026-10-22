// kv_cache.h - the kernels around the cache (chapter 15, section 7): the append, and the FP16 copy.
//
// Layout (the engine contract): k_cache, v_cache [B][H][T_max][D]; position p of sequence b, head h
// starts at ((b*H + h)*T_max + p)*D. qkv [B*T_new, 3C]: row b*T_new + t is token t of sequence b,
// q at columns [0, C), k at [C, 2C), v at [2C, 3C), head h at h*D .. h*D + D - 1 inside each.
//
// The engine (mlsys/labs/gpt2/attention.cuh) has its own kv_append with this signature; the lab keeps
// this one separate (decode_engine.h does not include it) so that the two never meet.
#pragma once

#include <algorithm>
#include <cuda_runtime.h>
#include <cuda_fp16.h>

// grid (B*T_new, H), block D threads: thread d copies k[d] and v[d] of one (token, head).
__global__ void kv_append_kernel(const float* __restrict__ qkv, float* __restrict__ k_cache,
                                 float* __restrict__ v_cache, int T_new, int pos0, int H, int T_max)
{
    const int D = blockDim.x, r = blockIdx.x, h = blockIdx.y, d = threadIdx.x, C = H * D;
    const int b = r / T_new, t = r % T_new;
    const float* row = qkv + (size_t)r * 3 * C;
    const size_t dst = (((size_t)b * H + h) * T_max + pos0 + t) * D + d;
    k_cache[dst] = row[C + h * D + d];          // columns C + h*D onward
    v_cache[dst] = row[2 * C + h * D + d];      // columns 2C + h*D onward
}

// The k and v of T_new new tokens of every sequence go to positions pos0 .. pos0 + T_new - 1.
inline void kv_append(const float* qkv, float* k_cache, float* v_cache, int B, int T_new, int pos0, int H, int D,
                      int T_max, cudaStream_t s)
{
    kv_append_kernel<<<dim3(B * T_new, H), D, 0, s>>>(qkv, k_cache, v_cache, T_new, pos0, H, T_max);
}

// FP32 cache -> FP16 cache (round to nearest), same layout. Lab 14's v4 reads the result; in a real
// engine the QKV epilogue would write halves directly.
__global__ void cache_to_half_kernel(const float* __restrict__ in, __half* __restrict__ out, size_t n)
{
    for (size_t i = (size_t)blockIdx.x * blockDim.x + threadIdx.x; i < n; i += (size_t)gridDim.x * blockDim.x)
        out[i] = __float2half_rn(in[i]);
}
inline void cache_to_half(const float* in, __half* out, size_t n, cudaStream_t s = nullptr)
{
    const int blocks = (int)std::min<size_t>((n + 255) / 256, 4096);
    cache_to_half_kernel<<<blocks, 256, 0, s>>>(in, out, n);
}
