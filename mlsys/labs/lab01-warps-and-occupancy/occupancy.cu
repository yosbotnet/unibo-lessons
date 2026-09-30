// occupancy.cu - Lab 01, experiments B, C and D: how many warps does an SM need?
//
//   ./occupancy test    correctness of every kernel used below
//   ./occupancy bench   run the three experiments
//
// B. Block-size sweep: the same vector add with 32 ... 1024 threads per block.
// C. Occupancy knob: reserve unused shared memory per block to force fewer
//    resident blocks per SM, and watch memory bandwidth as occupancy drops.
//    Then the same with 4 elements per thread (more bytes in flight per warp).
// D. Registers vs occupancy: one register-hungry kernel compiled twice, once
//    free and once with __launch_bounds__ forcing it to full occupancy.
//
// Every row prints the THEORETICAL occupancy from the CUDA occupancy API next
// to what you measure, so you can see when occupancy matters and when not.
#include <cstdio>
#include <cstring>
#include <vector>

#include "check.h"
#include "bench.h"

// ---------------------------------------------------------------------------
// Kernels
// ---------------------------------------------------------------------------

// Lab 0's vector add. The optional dynamic shared memory is never touched:
// it only exists to occupy space on the SM (experiment C).
__global__ void vecadd(const float* a, const float* b, float* c, int n)
{
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i < n) c[i] = a[i] + b[i];
}

// Same work, 4 consecutive elements per thread with 16-byte loads (float4).
// n4 = number of float4 groups; n must be a multiple of 4 here.
__global__ void vecadd4(const float4* a, const float4* b, float4* c, int n4)
{
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i < n4) {
        float4 x = a[i], y = b[i];
        c[i] = make_float4(x.x + y.x, x.y + y.y, x.z + y.z, x.w + y.w);
    }
}

// Register-hungry: every thread keeps an 8x8 tile of accumulators (64 floats)
// alive for the whole kernel and updates it with an outer product of two
// 8-vectors per step - the "register blocking" pattern that fast matrix
// multiplies use (Part II). It needs ~64 registers for the tile alone.
constexpr int T = 8, STEPS = 4, PLANES = 2 * T * STEPS;  // 64 input planes
__device__ __forceinline__ void tile_body(const float* __restrict__ x, float* __restrict__ out,
                                          int m)
{
    // m = number of outputs; input x has PLANES * m floats laid out as planes of m.
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i >= m) return;
    float acc[T][T] = {};
#pragma unroll
    for (int s = 0; s < STEPS; ++s) {
        float a[T], b[T];
#pragma unroll
        for (int t = 0; t < T; ++t) {
            a[t] = x[(size_t)(s * 2 * T + t) * m + i];      // coalesced across threads
            b[t] = x[(size_t)(s * 2 * T + T + t) * m + i];
        }
#pragma unroll
        for (int r = 0; r < T; ++r)
#pragma unroll
            for (int c = 0; c < T; ++c) acc[r][c] = fmaf(a[r], b[c], acc[r][c]);
    }
    float sum = 0.0f;
#pragma unroll
    for (int r = 0; r < T; ++r)
#pragma unroll
        for (int c = 0; c < T; ++c) sum += acc[r][c];
    out[i] = sum;
}
// Free: the compiler uses as many registers as it wants.
__global__ void tile_free(const float* __restrict__ x, float* __restrict__ out, int m)
{
    tile_body(x, out, m);
}
// Bounded: "256-thread blocks, and I want at least 6 of them per SM" =
// 1536 threads = full occupancy on CC 12.0, so at most 65536 / 1536 = 42
// registers per thread. 64 accumulators do not fit: the compiler must spill.
__global__ void __launch_bounds__(256, 6)
tile_bounded(const float* __restrict__ x, float* __restrict__ out, int m)
{
    tile_body(x, out, m);
}

static float tile_ref(const float* x, int m, int i)
{
    float acc[T][T] = {};
    for (int s = 0; s < STEPS; ++s)
        for (int r = 0; r < T; ++r)
            for (int c = 0; c < T; ++c)
                acc[r][c] = std::fma(x[(size_t)(s * 2 * T + r) * m + i],
                                     x[(size_t)(s * 2 * T + T + c) * m + i], acc[r][c]);
    float sum = 0.0f;
    for (int r = 0; r < T; ++r)
        for (int c = 0; c < T; ++c) sum += acc[r][c];
    return sum;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

struct Occ {
    int blocks_per_sm;
    double occupancy;  // resident warps / max warps per SM
};

// Ask the runtime how many blocks of `kernel` fit on one SM.
template <typename Kern>
static Occ occupancy_of(Kern kernel, int block, size_t dyn_smem)
{
    int dev = 0, blocks = 0;
    CUDA_CHECK(cudaGetDevice(&dev));
    CUDA_CHECK(cudaOccupancyMaxActiveBlocksPerMultiprocessor(&blocks, kernel, block, dyn_smem));
    const int max_threads = device_attr(cudaDevAttrMaxThreadsPerMultiProcessor, dev);
    const int warps_per_block = (block + 31) / 32;
    return Occ{blocks, (double)blocks * warps_per_block * 32 / max_threads};
}

template <typename Kern>
static int regs_of(Kern kernel)
{
    cudaFuncAttributes attr;
    CUDA_CHECK(cudaFuncGetAttributes(&attr, kernel));
    return attr.numRegs;
}

template <typename Kern>
static size_t local_bytes_of(Kern kernel)  // > 0 means the compiler spilled
{
    cudaFuncAttributes attr;
    CUDA_CHECK(cudaFuncGetAttributes(&attr, kernel));
    return attr.localSizeBytes;
}

static double gbs(double bytes, double ms) { return bytes / (ms * 1e-3) / 1e9; }

// Allow up to 99 KB of dynamic shared memory per block (default limit is 48 KB)
// and ask for the largest shared-memory carveout of the unified L1/shared.
template <typename Kern>
static void allow_big_smem(Kern kernel)
{
    int dev = 0;
    CUDA_CHECK(cudaGetDevice(&dev));
    const int optin = device_attr(cudaDevAttrMaxSharedMemoryPerBlockOptin, dev);
    CUDA_CHECK(cudaFuncSetAttribute(kernel, cudaFuncAttributeMaxDynamicSharedMemorySize, optin));
    CUDA_CHECK(cudaFuncSetAttribute(kernel, cudaFuncAttributePreferredSharedMemoryCarveout,
                                    (int)cudaSharedmemCarveoutMaxShared));
}

// ---------------------------------------------------------------------------
// test
// ---------------------------------------------------------------------------

static int run_test()
{
    std::printf("=== Lab 01 / occupancy test ===\n");
    int failures = 0;

    // vecadd and vecadd4 at an awkward size, with odd block sizes and big smem.
    const int n = (1 << 20) + 12;  // multiple of 4, not of any block size
    std::vector<float> ha(n), hb(n), hc(n), ref(n);
    fill_random(ha.data(), n, 1);
    fill_random(hb.data(), n, 2);
    for (int i = 0; i < n; ++i) ref[i] = ha[i] + hb[i];
    float *da, *db, *dc;
    CUDA_CHECK(cudaMalloc(&da, n * sizeof(float)));
    CUDA_CHECK(cudaMalloc(&db, n * sizeof(float)));
    CUDA_CHECK(cudaMalloc(&dc, n * sizeof(float)));
    CUDA_CHECK(cudaMemcpy(da, ha.data(), n * sizeof(float), cudaMemcpyHostToDevice));
    CUDA_CHECK(cudaMemcpy(db, hb.data(), n * sizeof(float), cudaMemcpyHostToDevice));
    allow_big_smem(vecadd);
    allow_big_smem(vecadd4);

    const int blocks_to_try[] = {32, 96, 256, 1024};
    for (int bs : blocks_to_try) {
        for (size_t smem : {(size_t)0, (size_t)64 * 1024}) {
            CUDA_CHECK(cudaMemset(dc, 0, n * sizeof(float)));
            vecadd<<<(n + bs - 1) / bs, bs, smem>>>(da, db, dc, n);
            CUDA_CHECK_LAUNCH(true);
            CUDA_CHECK(cudaMemcpy(hc.data(), dc, n * sizeof(float), cudaMemcpyDeviceToHost));
            CompareResult r = compare(ref.data(), hc.data(), n);
            std::printf("  vecadd  block %4d smem %5zu KB  ", bs, smem / 1024);
            print_compare(r);
            std::printf("\n");
            failures += !r.pass;

            CUDA_CHECK(cudaMemset(dc, 0, n * sizeof(float)));
            const int n4 = n / 4;
            vecadd4<<<(n4 + bs - 1) / bs, bs, smem>>>((const float4*)da, (const float4*)db,
                                                      (float4*)dc, n4);
            CUDA_CHECK_LAUNCH(true);
            CUDA_CHECK(cudaMemcpy(hc.data(), dc, n * sizeof(float), cudaMemcpyDeviceToHost));
            r = compare(ref.data(), hc.data(), n);
            std::printf("  vecadd4 block %4d smem %5zu KB  ", bs, smem / 1024);
            print_compare(r);
            std::printf("\n");
            failures += !r.pass;
        }
    }
    CUDA_CHECK(cudaFree(da));
    CUDA_CHECK(cudaFree(db));
    CUDA_CHECK(cudaFree(dc));

    // register-tile kernels
    const int m = 100003;
    std::vector<float> hx((size_t)PLANES * m), hout(m), gref(m);
    fill_random(hx.data(), hx.size(), 3);
    for (int i = 0; i < m; ++i) gref[i] = tile_ref(hx.data(), m, i);
    float *dx, *dout;
    CUDA_CHECK(cudaMalloc(&dx, hx.size() * sizeof(float)));
    CUDA_CHECK(cudaMalloc(&dout, m * sizeof(float)));
    CUDA_CHECK(cudaMemcpy(dx, hx.data(), hx.size() * sizeof(float), cudaMemcpyHostToDevice));
    for (int which = 0; which < 2; ++which) {
        CUDA_CHECK(cudaMemset(dout, 0, m * sizeof(float)));
        if (which == 0) tile_free<<<(m + 255) / 256, 256>>>(dx, dout, m);
        else            tile_bounded<<<(m + 255) / 256, 256>>>(dx, dout, m);
        CUDA_CHECK_LAUNCH(true);
        CUDA_CHECK(cudaMemcpy(hout.data(), dout, m * sizeof(float), cudaMemcpyDeviceToHost));
        CompareResult r = compare(gref.data(), hout.data(), m, 1e-4, 1e-4);
        std::printf("  %-14s ", which == 0 ? "tile_free" : "tile_bounded");
        print_compare(r);
        std::printf("\n");
        failures += !r.pass;
    }
    CUDA_CHECK(cudaFree(dx));
    CUDA_CHECK(cudaFree(dout));

    std::printf("%s\n", failures ? "SOME TESTS FAILED" : "ALL TESTS PASSED");
    std::printf("PASTE: occupancy test,%s,failures=%d\n", failures ? "FAIL" : "PASS", failures);
    return failures ? EXIT_FAILURE : EXIT_SUCCESS;
}

// ---------------------------------------------------------------------------
// bench
// ---------------------------------------------------------------------------

static int run_bench()
{
    const DevicePeaks peaks = query_device_peaks();
    const double peak = peaks.dram_gbs();
    std::printf("=== Lab 01 / occupancy bench ===\n");
    print_device_peaks(peaks);
    {
        int dev = 0;
        CUDA_CHECK(cudaGetDevice(&dev));
        std::printf("Per SM: max %d threads, %d blocks, %d registers, %d KB shared memory "
                    "(%d KB per block opt-in, %d B reserved per block)\n",
                    device_attr(cudaDevAttrMaxThreadsPerMultiProcessor, dev),
                    device_attr(cudaDevAttrMaxBlocksPerMultiprocessor, dev),
                    device_attr(cudaDevAttrMaxRegistersPerMultiprocessor, dev),
                    device_attr(cudaDevAttrMaxSharedMemoryPerMultiprocessor, dev) / 1024,
                    device_attr(cudaDevAttrMaxSharedMemoryPerBlockOptin, dev) / 1024,
                    device_attr(cudaDevAttrReservedSharedMemoryPerBlock, dev));
    }

    // Working set 3 x 256 MB: far bigger than L2, so this measures DRAM.
    const int n = 1 << 26;
    const double bytes = 3.0 * n * sizeof(float);
    float *da, *db, *dc;
    CUDA_CHECK(cudaMalloc(&da, n * sizeof(float)));
    CUDA_CHECK(cudaMalloc(&db, n * sizeof(float)));
    CUDA_CHECK(cudaMalloc(&dc, n * sizeof(float)));
    {
        std::vector<float> h(n);
        fill_random(h.data(), n, 1);
        CUDA_CHECK(cudaMemcpy(da, h.data(), n * sizeof(float), cudaMemcpyHostToDevice));
        fill_random(h.data(), n, 2);
        CUDA_CHECK(cudaMemcpy(db, h.data(), n * sizeof(float), cudaMemcpyHostToDevice));
    }
    allow_big_smem(vecadd);
    allow_big_smem(vecadd4);

    // ---- B: block size sweep ----
    std::printf("\n[B] Block-size sweep: vecadd, N = 2^26 (%.0f MB moved per run)\n", bytes / 1e6);
    std::printf("%8s %10s %11s %10s %10s %8s\n", "block", "blocks/SM", "occupancy", "median us",
                "GB/s", "% peak");
    const int sweep[] = {32, 64, 128, 256, 512, 768, 1024};
    std::vector<double> paste_b;
    for (int bs : sweep) {
        Occ o = occupancy_of(vecadd, bs, 0);
        Timing t = time_gpu([&] { vecadd<<<(n + bs - 1) / bs, bs>>>(da, db, dc, n); });
        double bw = gbs(bytes, t.median_ms);
        std::printf("%8d %10d %10.0f%% %10.1f %10.1f %7.1f%%\n", bs, o.blocks_per_sm,
                    100 * o.occupancy, t.median_ms * 1e3, bw, 100 * bw / peak);
        paste_b.push_back(bw);
    }

    // ---- C: occupancy knob via unused shared memory ----
    std::printf("\n[C] Occupancy knob: 256-thread blocks + unused dynamic shared memory\n");
    std::printf("%8s %10s %11s %14s %14s\n", "smem KB", "blocks/SM", "occupancy",
                "vecadd GB/s", "vecadd4 GB/s");
    const int smem_kb[] = {0, 12, 16, 24, 32, 48, 64, 99};
    const int bs = 256;
    std::vector<double> paste_c1, paste_c4;
    for (int kb : smem_kb) {
        size_t smem = (size_t)kb * 1024;
        Occ o = occupancy_of(vecadd, bs, smem);
        Timing t1 = time_gpu([&] { vecadd<<<(n + bs - 1) / bs, bs, smem>>>(da, db, dc, n); });
        const int n4 = n / 4;
        Timing t4 = time_gpu([&] {
            vecadd4<<<(n4 + bs - 1) / bs, bs, smem>>>((const float4*)da, (const float4*)db,
                                                     (float4*)dc, n4);
        });
        double b1 = gbs(bytes, t1.median_ms), b4 = gbs(bytes, t4.median_ms);
        std::printf("%8d %10d %10.0f%% %14.1f %14.1f\n", kb, o.blocks_per_sm, 100 * o.occupancy,
                    b1, b4);
        paste_c1.push_back(b1);
        paste_c4.push_back(b4);
    }
    CUDA_CHECK(cudaFree(da));
    CUDA_CHECK(cudaFree(db));
    CUDA_CHECK(cudaFree(dc));

    // ---- D: registers vs occupancy ----
    const int m = 1 << 21;  // PLANES * m floats = 512 MB of input
    float *dx, *dout;
    CUDA_CHECK(cudaMalloc(&dx, (size_t)PLANES * m * sizeof(float)));
    CUDA_CHECK(cudaMalloc(&dout, m * sizeof(float)));
    CUDA_CHECK(cudaMemset(dx, 0, (size_t)PLANES * m * sizeof(float)));
    const double gbytes = ((double)PLANES + 1) * m * sizeof(float);
    std::printf("\n[D] Registers vs occupancy: 8x8 register tile per thread (%.0f MB moved)\n",
                gbytes / 1e6);
    std::printf("%-15s %6s %12s %10s %11s %10s %10s\n", "kernel", "regs", "spill bytes",
                "blocks/SM", "occupancy", "median us", "GB/s");
    double paste_d[2];
    for (int which = 0; which < 2; ++which) {
        auto kern = which == 0 ? tile_free : tile_bounded;
        Occ o = occupancy_of(kern, 256, 0);
        Timing t = time_gpu([&] { kern<<<(m + 255) / 256, 256>>>(dx, dout, m); });
        double bw = gbs(gbytes, t.median_ms);
        std::printf("%-15s %6d %12zu %10d %10.0f%% %10.1f %10.1f\n",
                    which == 0 ? "tile_free" : "tile_bounded", regs_of(kern),
                    local_bytes_of(kern), o.blocks_per_sm, 100 * o.occupancy, t.median_ms * 1e3,
                    bw);
        paste_d[which] = bw;
    }
    CUDA_CHECK(cudaFree(dx));
    CUDA_CHECK(cudaFree(dout));

    std::printf(
        "\nHow to read it:\n"
        "  [B] occupancy is set by whichever limit binds first: 32-thread blocks hit the\n"
        "      blocks-per-SM limit; 1024-thread blocks cannot tile the thread limit evenly.\n"
        "  [C] fewer resident warps = fewer loads in flight (Little's law). Watch where\n"
        "      vecadd starts to lose bandwidth, and how much later vecadd4 does: each of\n"
        "      its threads keeps 4x more bytes in flight.\n"
        "  [D] capping registers to reach 100%% occupancy forces the 64 accumulators out\n"
        "      of registers into local memory (spill bytes > 0): more warps, but each does\n"
        "      extra memory traffic. Compare the two times.\n");

    std::printf("\nPASTE: occupancy B");
    for (size_t i = 0; i < paste_b.size(); ++i) std::printf(",%d:%.0f", sweep[i], paste_b[i]);
    std::printf(" | C");
    for (size_t i = 0; i < paste_c1.size(); ++i)
        std::printf(",%dK:%.0f/%.0f", smem_kb[i], paste_c1[i], paste_c4[i]);
    std::printf(" | D,free:%d:%.0f,bounded:%d:%.0f\n", regs_of(tile_free), paste_d[0],
                regs_of(tile_bounded), paste_d[1]);
    return EXIT_SUCCESS;
}

int main(int argc, char** argv)
{
    const bool test  = argc == 2 && std::strcmp(argv[1], "test") == 0;
    const bool bench = argc == 2 && std::strcmp(argv[1], "bench") == 0;
    if (!test && !bench) {
        std::fprintf(stderr, "usage: %s test|bench\n", argv[0]);
        return EXIT_FAILURE;
    }
    require_cuda_device();
    return test ? run_test() : run_bench();
}
