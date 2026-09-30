// devquery.cu - Lab 00: print the key hardware numbers of your GPU.
//
// Every number here matters later in the course: SM count and threads per SM
// decide how much parallel work the GPU can keep in flight, registers and
// shared memory per SM limit how many blocks fit on an SM, and the peak
// bandwidth / FLOPS are the ceilings every benchmark is compared against.
//
// Build: make        Run: ./devquery
#include <cstdio>

#include "check.h"
#include "bench.h"

// One aligned "label ..... value" row.
static void row(const char* label, const char* fmt_value)
{
    std::printf("  %-36s %s\n", label, fmt_value);
}

int main()
{
    const int dev = require_cuda_device();
    const DevicePeaks d = query_device_peaks(dev);

    int n_devices = 0, driver_ver = 0, runtime_ver = 0;
    CUDA_CHECK(cudaGetDeviceCount(&n_devices));
    CUDA_CHECK(cudaDriverGetVersion(&driver_ver));
    CUDA_CHECK(cudaRuntimeGetVersion(&runtime_ver));

    cudaDeviceProp prop;  // only used for total memory (still present in CUDA 13)
    CUDA_CHECK(cudaGetDeviceProperties(&prop, dev));

    const int warp_size        = device_attr(cudaDevAttrWarpSize, dev);
    const int max_thr_block    = device_attr(cudaDevAttrMaxThreadsPerBlock, dev);
    const int max_thr_sm       = device_attr(cudaDevAttrMaxThreadsPerMultiProcessor, dev);
    const int max_blocks_sm    = device_attr(cudaDevAttrMaxBlocksPerMultiprocessor, dev);
    const int regs_sm          = device_attr(cudaDevAttrMaxRegistersPerMultiprocessor, dev);
    const int smem_sm          = device_attr(cudaDevAttrMaxSharedMemoryPerMultiprocessor, dev);
    const int smem_block       = device_attr(cudaDevAttrMaxSharedMemoryPerBlock, dev);
    const int smem_block_optin = device_attr(cudaDevAttrMaxSharedMemoryPerBlockOptin, dev);
    const int max_warps_sm     = max_thr_sm / warp_size;  // derived, not queried

    const double MiB = 1024.0 * 1024.0;
    char v[256];  // scratch buffer for formatted values

    std::printf("=== Lab 00 / devquery ===\n");
    std::printf("CUDA driver %d.%d, runtime %d.%d, %d device(s) found, using device %d\n\n",
                driver_ver / 1000, (driver_ver % 1000) / 10,
                runtime_ver / 1000, (runtime_ver % 1000) / 10, n_devices, dev);

    std::printf("-- Identity --\n");
    row("Name", d.name);
    std::snprintf(v, sizeof v, "%d.%d (sm_%d%d)", d.cc_major, d.cc_minor, d.cc_major, d.cc_minor);
    row("Compute capability", v);

    std::printf("-- Compute units --\n");
    std::snprintf(v, sizeof v, "%d", d.sm_count);                 row("Streaming multiprocessors (SMs)", v);
    std::snprintf(v, sizeof v, "%d threads", warp_size);          row("Warp size", v);
    std::snprintf(v, sizeof v, "%d", max_thr_block);              row("Max threads per block", v);
    std::snprintf(v, sizeof v, "%d", max_thr_sm);                 row("Max threads per SM", v);
    std::snprintf(v, sizeof v, "%d (= %d / %d)", max_warps_sm, max_thr_sm, warp_size);
    row("Max warps per SM (derived)", v);
    std::snprintf(v, sizeof v, "%d", max_blocks_sm);              row("Max blocks per SM", v);
    std::snprintf(v, sizeof v, "%d (%d KiB)", regs_sm, regs_sm * 4 / 1024);
    row("32-bit registers per SM", v);
    std::snprintf(v, sizeof v, "%.0f MHz", d.sm_clock_khz / 1e3); row("SM clock (peak)", v);

    std::printf("-- On-chip memory --\n");
    std::snprintf(v, sizeof v, "%d KiB", smem_sm / 1024);         row("Shared memory per SM", v);
    std::snprintf(v, sizeof v, "%d KiB (opt-in max: %d KiB)", smem_block / 1024, smem_block_optin / 1024);
    row("Shared memory per block", v);
    std::snprintf(v, sizeof v, "%.1f MiB", d.l2_bytes / MiB);     row("L2 cache", v);

    std::printf("-- DRAM (VRAM) --\n");
    std::snprintf(v, sizeof v, "%.2f GiB (%zu bytes)", prop.totalGlobalMem / (MiB * 1024.0),
                  (size_t)prop.totalGlobalMem);
    row("Total VRAM", v);
    std::snprintf(v, sizeof v, "%d bit", d.bus_width_bits);       row("Memory bus width", v);
    std::snprintf(v, sizeof v, "%.0f MHz (as reported by the driver)", d.mem_clock_khz / 1e3);
    row("Memory clock", v);

    std::printf("-- Theoretical peaks --\n");
    std::snprintf(v, sizeof v, "%.1f GB/s (= 2 x mem clock x bus width / 8)", d.dram_gbs_computed);
    row("DRAM bandwidth (computed)", v);
    if (d.dram_gbs_spec > 0) {
        std::snprintf(v, sizeof v, "%.0f GB/s (28 Gbps x 192 bit / 8)", d.dram_gbs_spec);
        row("DRAM bandwidth (RTX 5070 spec)", v);
    }
    if (d.fp32_lanes_per_sm > 0) {
        std::snprintf(v, sizeof v, "%.2f TFLOPS (= %d SMs x %d lanes x 2 x clock)",
                      d.fp32_tflops, d.sm_count, d.fp32_lanes_per_sm);
    } else {
        std::snprintf(v, sizeof v, "unknown (no FP32 lanes/SM entry for CC %d.%d)",
                      d.cc_major, d.cc_minor);
    }
    row("FP32 peak", v);

    // One line with everything, easy to copy and paste back.
    std::printf("\nPASTE: devquery,%s,cc=%d.%d,SMs=%d,warp=%d,thr/blk=%d,thr/SM=%d,warps/SM=%d,"
                "blk/SM=%d,regs/SM=%d,smem/SM=%dKiB,smem/blk=%dKiB,smem/blk_optin=%dKiB,L2=%.1fMiB,"
                "VRAM=%.2fGiB,bus=%dbit,memclk=%.0fMHz,BW_computed=%.1fGB/s,BW_spec=%.0fGB/s,"
                "smclk=%.0fMHz,FP32=%.2fTFLOPS,driver=%d,runtime=%d\n",
                d.name, d.cc_major, d.cc_minor, d.sm_count, warp_size, max_thr_block, max_thr_sm,
                max_warps_sm, max_blocks_sm, regs_sm, smem_sm / 1024, smem_block / 1024,
                smem_block_optin / 1024, d.l2_bytes / MiB, prop.totalGlobalMem / (MiB * 1024.0),
                d.bus_width_bits, d.mem_clock_khz / 1e3, d.dram_gbs_computed, d.dram_gbs_spec,
                d.sm_clock_khz / 1e3, d.fp32_tflops, driver_ver, runtime_ver);
    return 0;
}
