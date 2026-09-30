// cudasim - run the course's CUDA labs on a CPU, to check kernels without a GPU.
//
// This is a correctness tool, not a simulator of performance. Blocks run one
// after another; inside a block every CUDA thread is a fiber, so that
// __syncthreads(), __shared__ memory (one static copy, safe because blocks
// never overlap), warp shuffles and WMMA fragments behave as the CUDA
// programming model promises. Index bugs, missing guards, and wrong tile
// arithmetic show up as wrong results, exactly as on the GPU.
//
// Usage (from the repo root):  dev/cudasim/run.sh mlsys/labs/lab06-matmul-tiling/sgemm.cu test
// run.sh rewrites kernel<<<grid, block, smem, stream>>>(args) into a call the
// shim understands, then compiles with g++ -std=c++20.
//
// Not modelled: timing, occupancy, caches, clocks, streams (everything is
// synchronous), concurrency between blocks, inline PTX.
#pragma once

#include <atomic>
#include <ucontext.h>
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <functional>
#include <memory>
#include <thread>
#include <vector>

#define CUDASIM 1

#define __global__
#define __device__
#define __host__
#define __forceinline__ inline
#define __noinline__
#define __launch_bounds__(...)
#define __restrict__ __restrict
// Blocks run one at a time, so one static copy per kernel is exactly "per block".
#define __shared__ static

struct dim3 {
    unsigned x, y, z;
    constexpr dim3(unsigned x_ = 1, unsigned y_ = 1, unsigned z_ = 1) : x(x_), y(y_), z(z_) {}
};
struct uint3 { unsigned x, y, z; };

struct float2 { float x, y; };
struct alignas(16) float4 { float x, y, z, w; };
struct int4 { int x, y, z, w; };
inline float2 make_float2(float x, float y) { return {x, y}; }
inline float4 make_float4(float x, float y, float z, float w) { return {x, y, z, w}; }

namespace cudasim {
// Every CUDA thread of a block is a fiber (ucontext) on ONE OS thread. A fiber
// runs until it finishes or reaches a barrier, then the next one runs. So a
// thread that skips a needed __syncthreads() races far ahead of its block,
// which makes missing barriers produce wrong results reliably instead of
// occasionally.
inline thread_local dim3 tIdx, bIdx;
inline dim3 bDim, gDim;

struct Fiber { ucontext_t ctx; bool done; int waiting; /* 0 none, 1 block, 2 warp */ };
struct BlockState {
    std::vector<Fiber> f;
    std::vector<std::vector<uint64_t>> warp_buf;
    ucontext_t sched;
    unsigned cur = 0;
    const std::function<void()>* body = nullptr;
};
inline BlockState* g_bs = nullptr;
inline std::vector<std::vector<char>> g_stacks;
constexpr size_t STACK = 256 * 1024;

inline unsigned linear_tid() { return tIdx.x + tIdx.y * bDim.x + tIdx.z * bDim.x * bDim.y; }
inline unsigned threads_per_block() { return bDim.x * bDim.y * bDim.z; }

inline void set_ids(unsigned t)
{
    tIdx = dim3(t % bDim.x, (t / bDim.x) % bDim.y, t / (bDim.x * bDim.y));
}
inline void yield_wait(int kind)
{
    BlockState& b = *g_bs;
    b.f[b.cur].waiting = kind;
    swapcontext(&b.f[b.cur].ctx, &b.sched);
    set_ids(b.cur);
}
inline void block_barrier() { yield_wait(1); }
inline void warp_barrier() { yield_wait(2); }

inline void fiber_entry()
{
    BlockState& b = *g_bs;
    set_ids(b.cur);
    (*b.body)();
    b.f[b.cur].done = true;
    swapcontext(&b.f[b.cur].ctx, &b.sched);
}

// Run `body` for every thread of every block. Synchronous, like a launch
// followed by cudaDeviceSynchronize().
inline void launch(dim3 grid, dim3 block, const std::function<void()>& body)
{
    const unsigned nt = block.x * block.y * block.z;
    if (nt == 0 || nt > 1024) { std::fprintf(stderr, "cudasim: bad block size %u\n", nt); std::exit(1); }
    bDim = block; gDim = grid;
    while (g_stacks.size() < nt) g_stacks.emplace_back(STACK);
    const unsigned nw = (nt + 31) / 32;
    for (unsigned bz = 0; bz < grid.z; ++bz)
    for (unsigned by = 0; by < grid.y; ++by)
    for (unsigned bx = 0; bx < grid.x; ++bx) {
        BlockState b;
        b.body = &body;
        b.f.assign(nt, Fiber{});
        b.warp_buf.assign(nw, std::vector<uint64_t>(32));
        bIdx = dim3(bx, by, bz);
        g_bs = &b;
        for (unsigned t = 0; t < nt; ++t) {
            getcontext(&b.f[t].ctx);
            b.f[t].ctx.uc_stack.ss_sp = g_stacks[t].data();
            b.f[t].ctx.uc_stack.ss_size = STACK;
            b.f[t].ctx.uc_link = nullptr;
            makecontext(&b.f[t].ctx, fiber_entry, 0);
        }
        for (;;) {
            bool progressed = false;
            for (unsigned t = 0; t < nt; ++t) {
                if (b.f[t].done || b.f[t].waiting) continue;
                b.cur = t;
                swapcontext(&b.sched, &b.f[t].ctx);
                progressed = true;
            }
            bool all_done = true;
            for (auto& x : b.f) all_done = all_done && x.done;
            if (all_done) break;
            if (progressed) continue;
            // Everyone left is waiting. Release warp barriers first: a warp is
            // released when every live lane of it waits at a warp barrier.
            bool released = false;
            for (unsigned w = 0; w < nw; ++w) {
                unsigned lo = 32 * w, hi = std::min(nt, lo + 32);
                bool any = false, all = true;
                for (unsigned t = lo; t < hi; ++t) {
                    if (b.f[t].done) continue;
                    any = true;
                    if (b.f[t].waiting != 2) all = false;
                }
                if (any && all) { for (unsigned t = lo; t < hi; ++t) b.f[t].waiting = 0; released = true; }
            }
            if (released) continue;
            // Block barrier: every live thread must be waiting at it.
            bool all_block = true, any_done = false;
            for (auto& x : b.f) { if (x.done) any_done = true; else if (x.waiting != 1) all_block = false; }
            if (all_block) {
                if (any_done) {
                    std::fprintf(stderr, "cudasim: __syncthreads() reached by only part of block (%u,%u,%u): "
                                 "some threads already returned. Undefined behaviour on a GPU.\n", bx, by, bz);
                    std::exit(3);
                }
                for (auto& x : b.f) x.waiting = 0;
                continue;
            }
            std::fprintf(stderr, "cudasim: deadlock in block (%u,%u,%u): threads wait at different barriers\n", bx, by, bz);
            std::exit(3);
        }
        g_bs = nullptr;
    }
}

template <typename T>
T shfl(T v, int src_lane)
{
    static_assert(sizeof(T) <= 8, "cudasim: shuffle of a type wider than 8 bytes");
    unsigned t = linear_tid(), w = t / 32, lane = t % 32;
    uint64_t bits = 0; std::memcpy(&bits, &v, sizeof(T));
    g_bs->warp_buf[w][lane] = bits;
    warp_barrier();
    uint64_t got = g_bs->warp_buf[w][src_lane & 31];
    warp_barrier();
    T r; std::memcpy(&r, &got, sizeof(T));
    return r;
}
}  // namespace cudasim

#define threadIdx (cudasim::tIdx)
#define blockIdx  (cudasim::bIdx)
#define blockDim  (cudasim::bDim)
#define gridDim   (cudasim::gDim)
#define warpSize  32

inline void __syncthreads() { cudasim::block_barrier(); }
inline void __syncwarp(unsigned = 0xffffffffu) { cudasim::warp_barrier(); }

// Shuffles (full warps only: the labs always shuffle with all 32 lanes).
template <typename T> T __shfl_sync(unsigned, T v, int src, int = 32)
{ return cudasim::shfl(v, src); }
template <typename T> T __shfl_down_sync(unsigned, T v, unsigned d, int = 32)
{ unsigned lane = cudasim::linear_tid() % 32; return cudasim::shfl(v, (lane + d < 32) ? lane + d : lane); }
template <typename T> T __shfl_up_sync(unsigned, T v, unsigned d, int = 32)
{ unsigned lane = cudasim::linear_tid() % 32; return cudasim::shfl(v, (lane >= d) ? lane - d : lane); }
template <typename T> T __shfl_xor_sync(unsigned, T v, int m, int = 32)
{ unsigned lane = cudasim::linear_tid() % 32; return cudasim::shfl(v, (int)(lane ^ m)); }

// One OS thread runs everything, so plain read-modify-write is atomic here.
template <typename T> T atomicAdd(T* p, T v) { T o = *p; *p = o + v; return o; }
inline float atomicMax(float* p, float v) { float o = *p; if (v > o) *p = v; return o; }

// Math intrinsics used by the labs
inline float __expf(float x) { return std::exp(x); }
inline float __logf(float x) { return std::log(x); }
inline float __fdividef(float a, float b) { return a / b; }
inline float rsqrtf(float x) { return 1.0f / std::sqrt(x); }
inline float __frsqrt_rn(float x) { return 1.0f / std::sqrt(x); }
inline float __ldg(const float* p) { return *p; }
inline float4 __ldg(const float4* p) { return *p; }
#include <math.h>   // fmaxf, expf, tanhf, ... as global functions, like CUDA's

// ---------------------------------------------------------------------------
// Runtime API: device memory is host memory, everything is synchronous.
// ---------------------------------------------------------------------------
enum cudaError_t { cudaSuccess = 0, cudaErrorMemoryAllocation = 2, cudaErrorInvalidValue = 1 };
enum cudaMemcpyKind { cudaMemcpyHostToHost, cudaMemcpyHostToDevice, cudaMemcpyDeviceToHost, cudaMemcpyDeviceToDevice, cudaMemcpyDefault };
typedef struct CUstream_st* cudaStream_t;
typedef struct CUevent_st { double t; }* cudaEvent_t;

inline const char* cudaGetErrorString(cudaError_t e) { return e == cudaSuccess ? "no error" : "cudasim error"; }
inline const char* cudaGetErrorName(cudaError_t e) { return e == cudaSuccess ? "cudaSuccess" : "cudaErrorSim"; }
inline cudaError_t cudaGetLastError() { return cudaSuccess; }
inline cudaError_t cudaPeekAtLastError() { return cudaSuccess; }
inline cudaError_t cudaDeviceSynchronize() { return cudaSuccess; }
inline cudaError_t cudaStreamSynchronize(cudaStream_t) { return cudaSuccess; }
inline cudaError_t cudaGetDeviceCount(int* c) { *c = 1; return cudaSuccess; }
inline cudaError_t cudaSetDevice(int) { return cudaSuccess; }
template <typename T> cudaError_t cudaMalloc(T** p, size_t n)
{ *p = (T*)std::aligned_alloc(256, (n + 255) / 256 * 256); return *p ? cudaSuccess : cudaErrorMemoryAllocation; }
inline cudaError_t cudaMemGetInfo(size_t* f, size_t* t) { *f = 1ull << 30; *t = 12ull << 30; return cudaSuccess; }
inline cudaError_t cudaFree(void* p) { std::free(p); return cudaSuccess; }
inline cudaError_t cudaMemcpy(void* d, const void* s, size_t n, cudaMemcpyKind) { std::memcpy(d, s, n); return cudaSuccess; }
inline cudaError_t cudaMemcpyAsync(void* d, const void* s, size_t n, cudaMemcpyKind, cudaStream_t = nullptr) { std::memcpy(d, s, n); return cudaSuccess; }
inline cudaError_t cudaMemset(void* d, int v, size_t n) { std::memset(d, v, n); return cudaSuccess; }
inline cudaError_t cudaMemsetAsync(void* d, int v, size_t n, cudaStream_t = nullptr) { std::memset(d, v, n); return cudaSuccess; }
inline cudaError_t cudaEventCreate(cudaEvent_t* e) { *e = new CUevent_st{0}; return cudaSuccess; }
inline cudaError_t cudaEventDestroy(cudaEvent_t e) { delete e; return cudaSuccess; }
inline cudaError_t cudaEventRecord(cudaEvent_t, cudaStream_t = nullptr) { return cudaSuccess; }
inline cudaError_t cudaEventSynchronize(cudaEvent_t) { return cudaSuccess; }
inline cudaError_t cudaEventElapsedTime(float* ms, cudaEvent_t, cudaEvent_t) { *ms = 1.0f; return cudaSuccess; }
enum cudaFuncAttribute { cudaFuncAttributeMaxDynamicSharedMemorySize, cudaFuncAttributePreferredSharedMemoryCarveout };
template <typename F> cudaError_t cudaFuncSetAttribute(F, cudaFuncAttribute, int) { return cudaSuccess; }

struct cudaDeviceProp { char name[256]; size_t sharedMemPerBlockOptin; int multiProcessorCount; };
inline cudaError_t cudaGetDeviceProperties(cudaDeviceProp* p, int)
{ std::memset(p, 0, sizeof *p); std::snprintf(p->name, sizeof p->name, "cudasim (CPU)"); p->multiProcessorCount = 48; p->sharedMemPerBlockOptin = 101376; return cudaSuccess; }
enum cudaDeviceAttr { cudaDevAttrComputeCapabilityMajor, cudaDevAttrComputeCapabilityMinor, cudaDevAttrMultiProcessorCount,
    cudaDevAttrClockRate, cudaDevAttrMemoryClockRate, cudaDevAttrGlobalMemoryBusWidth, cudaDevAttrL2CacheSize,
    cudaDevAttrMaxSharedMemoryPerBlockOptin, cudaDevAttrMaxGridDimX };
inline cudaError_t cudaDeviceGetAttribute(int* v, cudaDeviceAttr a, int)
{
    switch (a) {
    case cudaDevAttrComputeCapabilityMajor: *v = 12; break;
    case cudaDevAttrComputeCapabilityMinor: *v = 0; break;
    case cudaDevAttrMultiProcessorCount: *v = 48; break;
    case cudaDevAttrClockRate: *v = 2512000; break;
    case cudaDevAttrMemoryClockRate: *v = 14001000; break;
    case cudaDevAttrGlobalMemoryBusWidth: *v = 192; break;
    case cudaDevAttrL2CacheSize: *v = 48 << 20; break;
    case cudaDevAttrMaxSharedMemoryPerBlockOptin: *v = 101376; break;
    case cudaDevAttrMaxGridDimX: *v = 2147483647; break;
    }
    return cudaSuccess;
}
