// probe.h - Lab 4b: the two clocks every kernel in this lab reads.
//
//   clock64()     the SM's own cycle counter (every SM has its own)
//   gtimer_ns()   %globaltimer, a nanosecond clock shared by the whole GPU
//
// Thread 0 of every block reads both at the start and at the end of the
// block's work. Cycles divided by nanoseconds is the clock the SM actually ran
// at, whatever GPU Boost chose (interlude, section 8); the earliest start and
// the latest end over all blocks give the kernel's time without launch
// overhead. Rates are then reported per clock per SM, the unit of NVIDIA's
// throughput table, so they do not depend on the clock.
#pragma once

#include <algorithm>
#include <cstdio>
#include <vector>

#include "check.h"
#ifdef CUDASIM
#include <chrono>
#endif

struct Stamp {
    long long c0, c1;             // clock64() at start and end
    unsigned long long t0, t1;    // %globaltimer at start and end (ns)
};

__device__ __forceinline__ unsigned long long gtimer_ns()
{
#ifdef CUDASIM
    return (unsigned long long)std::chrono::duration<double, std::nano>(
        std::chrono::steady_clock::now().time_since_epoch()).count();
#else
    unsigned long long t;
    asm volatile("mov.u64 %0, %%globaltimer;" : "=l"(t));
    return t;
#endif
}

// Every thread of the block calls these (they contain barriers).
__device__ __forceinline__ void stamp_begin(Stamp* s)
{
    __syncthreads();
    if (threadIdx.x == 0) { s[blockIdx.x].t0 = gtimer_ns(); s[blockIdx.x].c0 = clock64(); }
    __syncthreads();
}
__device__ __forceinline__ void stamp_end(Stamp* s)
{
    __syncthreads();
    if (threadIdx.x == 0) { s[blockIdx.x].c1 = clock64(); s[blockIdx.x].t1 = gtimer_ns(); }
}

struct Run {
    double ns;        // earliest start to latest end, over all blocks
    double ghz;       // cycles per ns, averaged over blocks
    double cycles;    // ns * ghz: the kernel's length in SM cycles
};

// Device buffer of one Stamp per block, and the host side that reads it.
struct Stamps {
    Stamp* d = nullptr;
    int n = 0;
    explicit Stamps(int blocks) : n(blocks) { CUDA_CHECK(cudaMalloc(&d, sizeof(Stamp) * n)); }
    ~Stamps() { cudaFree(d); }
    Run read(int blocks) const
    {
        std::vector<Stamp> h(blocks);
        CUDA_CHECK(cudaMemcpy(h.data(), d, sizeof(Stamp) * blocks, cudaMemcpyDeviceToHost));
        unsigned long long t0 = h[0].t0, t1 = h[0].t1;
        double cyc = 0, ns = 0;
        for (const Stamp& s : h) {
            t0 = std::min(t0, s.t0); t1 = std::max(t1, s.t1);
            cyc += (double)(s.c1 - s.c0); ns += (double)(s.t1 - s.t0);
        }
        Run r;
        r.ns = (double)(t1 - t0);
        r.ghz = ns > 0 ? cyc / ns : 0;
        r.cycles = r.ns * r.ghz;
        return r;
    }
};
