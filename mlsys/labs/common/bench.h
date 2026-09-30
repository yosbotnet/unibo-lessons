// bench.h - small, header-only benchmarking helpers shared by every lab.
//
//   time_gpu(f)          time a GPU workload with CUDA events (median + min)
//   fill_random(p, n)    deterministic pseudo-random floats
//   compare(ref, got, n) check results with an absolute + relative tolerance
//   query_device_peaks() device name, SM count, peak DRAM bandwidth, peak FP32
#pragma once

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <vector>
#include <cuda_runtime.h>

#include "check.h"

// ---------------------------------------------------------------------------
// GPU timing
// ---------------------------------------------------------------------------

struct Timing {
    double median_ms;  // the number to report
    double min_ms;     // best case: useful to see how noisy the runs were
};

// Median of a list of samples (sorts a copy).
inline double median_of(std::vector<double> v)
{
    std::sort(v.begin(), v.end());
    size_t n = v.size();
    return (n % 2) ? v[n / 2] : 0.5 * (v[n / 2 - 1] + v[n / 2]);
}

// Time `launch` (any callable that enqueues GPU work, e.g. a lambda that
// launches a kernel) and return the median and minimum time in milliseconds.
//
// Why warm-up runs? The first launches pay one-off costs: loading the kernel
// code onto the GPU, the GPU raising its clocks from idle, caches and TLBs
// being cold. We want the steady state, so we run a few times untimed first.
//
// Why the median? Timings are noisy (other processes, the desktop compositor,
// clock changes). The mean is dragged up by a single slow outlier; the median
// is not. The min is printed too: if min and median are far apart, the
// measurement is noisy and should be taken with a grain of salt.
//
// Why CUDA events and not a CPU clock? Kernel launches are asynchronous: the
// CPU returns immediately while the GPU is still working. Events are
// timestamps recorded by the GPU itself, in the same stream as the work, so
// they measure exactly the time the GPU spent between them.
template <typename F>
Timing time_gpu(F&& launch, int warmup = 3, int reps = 20)
{
    for (int i = 0; i < warmup; ++i) launch();
    CUDA_CHECK_LAUNCH(true);  // catch errors before we start timing

    cudaEvent_t start, stop;
    CUDA_CHECK(cudaEventCreate(&start));
    CUDA_CHECK(cudaEventCreate(&stop));

    std::vector<double> samples;
    for (int i = 0; i < reps; ++i) {
        CUDA_CHECK(cudaEventRecord(start));
        launch();
        CUDA_CHECK(cudaEventRecord(stop));
        CUDA_CHECK(cudaEventSynchronize(stop));  // wait until the GPU is done
        float ms = 0.0f;
        CUDA_CHECK(cudaEventElapsedTime(&ms, start, stop));
        samples.push_back(ms);
    }
    CUDA_CHECK_LAUNCH(true);

    CUDA_CHECK(cudaEventDestroy(start));
    CUDA_CHECK(cudaEventDestroy(stop));
    return Timing{median_of(samples),
                  *std::min_element(samples.begin(), samples.end())};
}

// ---------------------------------------------------------------------------
// Deterministic input data
// ---------------------------------------------------------------------------

// Fill p[0..n) with pseudo-random floats in [-1, 1).
// We use our own tiny generator (xorshift32) with a fixed seed instead of
// rand() or <random> distributions, so every run, compiler and OS produces
// exactly the same numbers: results are reproducible and comparable.
inline void fill_random(float* p, size_t n, uint32_t seed = 12345u)
{
    uint32_t s = seed ? seed : 1u;  // xorshift must never be seeded with 0
    for (size_t i = 0; i < n; ++i) {
        s ^= s << 13;
        s ^= s >> 17;
        s ^= s << 5;
        // top 24 bits -> [0, 1) exactly representable in a float -> [-1, 1)
        p[i] = (float)(s >> 8) * (1.0f / 16777216.0f) * 2.0f - 1.0f;
    }
}

// ---------------------------------------------------------------------------
// Result checking
// ---------------------------------------------------------------------------

struct CompareResult {
    bool   pass;
    double max_abs_err;
    size_t first_bad;   // index of the first mismatch (valid only if !pass)
    float  ref_value;   // ref[first_bad]
    float  got_value;   // got[first_bad]
};

// Element i passes if |got - ref| <= atol + rtol * |ref|.
// Why both? Floating point results can legitimately differ in the last bits
// (different operation order, fused multiply-add). A relative tolerance scales
// with the magnitude of the value; the absolute one handles values near zero,
// where any relative tolerance would be far too strict.
inline CompareResult compare(const float* ref, const float* got, size_t n,
                             double atol = 1e-5, double rtol = 1e-5)
{
    CompareResult r{true, 0.0, 0, 0.0f, 0.0f};
    for (size_t i = 0; i < n; ++i) {
        double err = std::fabs((double)got[i] - (double)ref[i]);
        bool ok = err <= atol + rtol * std::fabs((double)ref[i]);
        if (std::isnan(got[i]) != std::isnan(ref[i])) ok = false;
        if (err > r.max_abs_err) r.max_abs_err = err;
        if (!ok && r.pass) {
            r.pass = false;
            r.first_bad = i;
            r.ref_value = ref[i];
            r.got_value = got[i];
        }
    }
    return r;
}

// One line summary, e.g. "PASS (max abs err 0)".
inline void print_compare(const CompareResult& r)
{
    if (r.pass)
        std::printf("PASS (max abs err %.3g)", r.max_abs_err);
    else
        std::printf("FAIL (max abs err %.3g; first mismatch at [%zu]: expected %.9g, got %.9g)",
                    r.max_abs_err, r.first_bad, (double)r.ref_value, (double)r.got_value);
}

// ---------------------------------------------------------------------------
// Device peak numbers
// ---------------------------------------------------------------------------

// Theoretical limits of the GPU. Benchmarks are compared against these to
// answer "how close to the hardware limit am I?".
struct DevicePeaks {
    char   name[256];
    int    cc_major, cc_minor;
    int    sm_count;
    int    sm_clock_khz;        // peak (boost) SM clock as reported by the driver
    int    mem_clock_khz;       // memory clock as reported by the driver
    int    bus_width_bits;
    int    l2_bytes;
    int    fp32_lanes_per_sm;   // 0 = unknown for this architecture
    double dram_gbs_computed;   // from the formula below
    double dram_gbs_spec;       // marketing number, 0 if we do not know it
    double fp32_tflops;         // 0 if lanes per SM is unknown

    // Bandwidth to use for "% of peak": the spec value if known, else computed.
    double dram_gbs() const { return dram_gbs_spec > 0 ? dram_gbs_spec : dram_gbs_computed; }
};

// FP32 lanes ("CUDA cores") per SM depend on the architecture and are not
// exposed by the CUDA API, so we keep a small table.
inline int fp32_lanes_per_sm(int major, int minor)
{
    if (major == 12) return 128;                   // Blackwell consumer (RTX 50xx)
    if (major == 9 && minor == 0) return 128;      // Hopper (H100)
    if (major == 8 && minor == 9) return 128;      // Ada (RTX 40xx)
    if (major == 8 && minor == 6) return 128;      // Ampere consumer (RTX 30xx)
    if (major == 8 && minor == 0) return 64;       // Ampere A100
    if (major == 7 && minor == 5) return 64;       // Turing (RTX 20xx)
    return 0;                                      // unknown
}

// Plain RTX 5070 (not the 5070 Ti, which has a wider bus and 896 GB/s).
inline bool is_rtx_5070(const char* name)
{
    return std::strstr(name, "RTX 5070") != nullptr && std::strstr(name, "5070 Ti") == nullptr;
}

inline int device_attr(cudaDeviceAttr attr, int dev)
{
    int v = 0;
    CUDA_CHECK(cudaDeviceGetAttribute(&v, attr, dev));
    return v;
}

// Note: we read clocks and bus width with cudaDeviceGetAttribute, not from
// cudaDeviceProp: fields like prop.clockRate / prop.memoryClockRate were
// removed in CUDA 13, while the attributes work on both CUDA 12 and 13.
inline DevicePeaks query_device_peaks(int dev = 0)
{
    DevicePeaks d{};
    cudaDeviceProp prop;
    CUDA_CHECK(cudaGetDeviceProperties(&prop, dev));
    std::snprintf(d.name, sizeof d.name, "%s", prop.name);

    d.cc_major       = device_attr(cudaDevAttrComputeCapabilityMajor, dev);
    d.cc_minor       = device_attr(cudaDevAttrComputeCapabilityMinor, dev);
    d.sm_count       = device_attr(cudaDevAttrMultiProcessorCount, dev);
    d.sm_clock_khz   = device_attr(cudaDevAttrClockRate, dev);
    d.mem_clock_khz  = device_attr(cudaDevAttrMemoryClockRate, dev);
    d.bus_width_bits = device_attr(cudaDevAttrGlobalMemoryBusWidth, dev);
    d.l2_bytes       = device_attr(cudaDevAttrL2CacheSize, dev);

    // DRAM bandwidth = 2 transfers per clock (double data rate)
    //                * memory clock in Hz * bus width in bytes.
    // Caveat: for GDDR6X/GDDR7 the reported clock does not always match the
    // real signalling rate, so this can differ from the marketing number.
    d.dram_gbs_computed = 2.0 * d.mem_clock_khz * 1e3 * (d.bus_width_bits / 8.0) / 1e9;
    d.dram_gbs_spec     = is_rtx_5070(d.name) ? 672.0 : 0.0;

    // FP32 peak = SMs * lanes per SM * 2 FLOP per lane per clock (one fused
    // multiply-add = a*b+c counts as 2 FLOP) * clock in Hz.
    d.fp32_lanes_per_sm = fp32_lanes_per_sm(d.cc_major, d.cc_minor);
    d.fp32_tflops = (double)d.sm_count * d.fp32_lanes_per_sm * 2.0 * d.sm_clock_khz * 1e3 / 1e12;
    return d;
}

// Print the peak lines (used by several labs so that every output is
// self-contained).
inline void print_device_peaks(const DevicePeaks& d)
{
    std::printf("GPU: %s | CC %d.%d | %d SMs | SM clock %.0f MHz | L2 %.1f MB\n",
                d.name, d.cc_major, d.cc_minor, d.sm_count, d.sm_clock_khz / 1e3,
                d.l2_bytes / (1024.0 * 1024.0));
    std::printf("Peak DRAM bandwidth: %.1f GB/s computed (2 x %.0f MHz x %d bit / 8)",
                d.dram_gbs_computed, d.mem_clock_khz / 1e3, d.bus_width_bits);
    if (d.dram_gbs_spec > 0) std::printf(", %.0f GB/s spec", d.dram_gbs_spec);
    std::printf("\n");
    if (d.fp32_lanes_per_sm > 0)
        std::printf("Peak FP32: %.1f TFLOPS (%d SMs x %d lanes x 2 x %.0f MHz)\n",
                    d.fp32_tflops, d.sm_count, d.fp32_lanes_per_sm, d.sm_clock_khz / 1e3);
    else
        std::printf("Peak FP32: unknown (FP32 lanes per SM unknown for CC %d.%d)\n",
                    d.cc_major, d.cc_minor);
}
