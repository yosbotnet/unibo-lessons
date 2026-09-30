// roofline.cu - Lab 03: trace the roofline of your own GPU.
//
//   ./roofline test    correctness of the dial kernel and the tensor-core kernel
//   ./roofline bench   A: the intensity dial (FP32 roofline, DRAM slope to FP32 roof)
//                      B: tensor-core peak with FP32 and FP16 accumulators
//
// A. The "intensity dial". Every thread loads ONE float, runs F fused
//    multiply-adds on it, and stores ONE float. Bytes per element are fixed
//    (4 read + 4 written = 8 B); FLOPs per element are 2F (an FMA is 2 FLOPs).
//    So the arithmetic intensity is exactly 2F / 8 = F / 4 FLOP per byte, and
//    turning F up walks the kernel from the memory-bound slope, past the ridge,
//    onto the compute-bound roof. The array (2 x 256 MB) is far bigger than the
//    48 MB L2, so every byte really comes from DRAM.
//
// B. Tensor cores. Each warp keeps its matrix tiles in registers and runs
//    mma_sync in a loop: almost no memory traffic, so this measures the roof
//    itself, not a point under it. Run once with FP32 accumulators and once
//    with FP16 accumulators: on GeForce cards they are different roofs.
#include <cstdio>
#include <cstring>
#include <cmath>
#include <vector>

#include <cuda_fp16.h>
#include <mma.h>

#include "check.h"
#include "bench.h"

// ---------------------------------------------------------------------------
// A. The intensity dial
// ---------------------------------------------------------------------------

// F FMAs per element, split over (up to) 4 independent chains so that each
// thread has several FMAs in flight (instruction-level parallelism). A single
// dependent chain would wait ~4 cycles for every result and never reach the
// FP32 roof; that would be a ceiling below the roof, not the roof.
// F is a template parameter so the loop is fully unrolled: no loop counter,
// no branch, nothing but FMAs between the load and the store.
template <int F>
__global__ void dial(const float* __restrict__ x, float* __restrict__ y, size_t n,
                     float s, float t)
{
    constexpr int CHAINS = F < 4 ? F : 4;
    constexpr int STEPS  = F / CHAINS;
    size_t i = (size_t)blockIdx.x * blockDim.x + threadIdx.x;
    if (i >= n) return;

    float v = x[i];
    float a[CHAINS];
#pragma unroll
    for (int c = 0; c < CHAINS; ++c) a[c] = v + (float)c;   // 4 different start values
#pragma unroll
    for (int k = 0; k < STEPS; ++k)
#pragma unroll
        for (int c = 0; c < CHAINS; ++c) a[c] = fmaf(a[c], s, t);
    float r = 0.0f;
#pragma unroll
    for (int c = 0; c < CHAINS; ++c) r += a[c];              // CHAINS-1 extra adds: noise
    y[i] = r;
}

// CPU reference for one element, same operations in the same order.
static float dial_ref(float v, int F, float s, float t)
{
    int chains = F < 4 ? F : 4, steps = F / chains;
    float a[4];
    for (int c = 0; c < chains; ++c) a[c] = v + (float)c;
    for (int k = 0; k < steps; ++k)
        for (int c = 0; c < chains; ++c) a[c] = std::fma(a[c], s, t);
    float r = 0.0f;
    for (int c = 0; c < chains; ++c) r += a[c];
    return r;
}

typedef void (*DialFn)(const float*, float*, size_t, float, float);
struct DialCase { int F; DialFn fn; };
static const DialCase kDial[] = {
    {1, dial<1>},     {2, dial<2>},     {4, dial<4>},     {8, dial<8>},
    {16, dial<16>},   {32, dial<32>},   {64, dial<64>},   {128, dial<128>},
    {256, dial<256>}, {512, dial<512>}, {1024, dial<1024>}, {2048, dial<2048>},
};

// s, t chosen so the values stay bounded: a -> a*s + t converges to t/(1-s).
static const float kS = 0.999f, kT = 0.001f;

// ---------------------------------------------------------------------------
// B. Tensor-core peak via WMMA (the portable C++ API over the mma instructions;
//    Part II goes one level down to mma.sync PTX).
// ---------------------------------------------------------------------------
using namespace nvcuda;

// Each warp: load one 16x16 A and B tile once, then run `reps` rounds of 4
// independent accumulations (4 accumulators = 4 MMAs in flight per warp).
// FLOPs per mma_sync on 16x16x16 = 2 * 16 * 16 * 16 = 8192.
template <typename Acc>
__global__ void mma_peak(const half* __restrict__ A, const half* __restrict__ B,
                         float* __restrict__ out, int reps)
{
    wmma::fragment<wmma::matrix_a, 16, 16, 16, half, wmma::row_major> fa;
    wmma::fragment<wmma::matrix_b, 16, 16, 16, half, wmma::col_major> fb;
    wmma::fragment<wmma::accumulator, 16, 16, 16, Acc> c0, c1, c2, c3;
    wmma::load_matrix_sync(fa, A, 16);
    wmma::load_matrix_sync(fb, B, 16);
    wmma::fill_fragment(c0, (Acc)0.0f);
    wmma::fill_fragment(c1, (Acc)0.0f);
    wmma::fill_fragment(c2, (Acc)0.0f);
    wmma::fill_fragment(c3, (Acc)0.0f);
    for (int r = 0; r < reps; ++r) {
        wmma::mma_sync(c0, fa, fb, c0);
        wmma::mma_sync(c1, fa, fb, c1);
        wmma::mma_sync(c2, fa, fb, c2);
        wmma::mma_sync(c3, fa, fb, c3);
    }
    // Every warp folds its accumulators into one value and "maybe" writes it,
    // so the compiler cannot delete any of the work. The condition is never
    // true in practice.
    float v = 0.0f;
    for (int e = 0; e < c0.num_elements; ++e)
        v += (float)c0.x[e] + (float)c1.x[e] + (float)c2.x[e] + (float)c3.x[e];
    if (v == -1.0f) out[0] = v;

    // Warp 0 of block 0 stores its first accumulator tile for the test.
    // (Fragment element layouts are opaque, so go through store_matrix_sync.)
    __shared__ Acc tile[16 * 16];
    if (blockIdx.x == 0 && threadIdx.x < 32) {
        wmma::store_matrix_sync(tile, c0, 16, wmma::mem_row_major);
        __syncwarp();
        for (int e = threadIdx.x; e < 256; e += 32) out[e] = (float)tile[e];
    }
}

// ---------------------------------------------------------------------------
// test
// ---------------------------------------------------------------------------
static int run_test()
{
    bool ok = true;
    // A: dial kernels on an awkward size, every F.
    const size_t n = (1u << 18) + 37;   // CPU reference cost grows with F
    std::vector<float> hx(n), hy(n);
    fill_random(hx.data(), n);
    float *dx, *dy;
    CUDA_CHECK(cudaMalloc(&dx, n * sizeof(float)));
    CUDA_CHECK(cudaMalloc(&dy, n * sizeof(float)));
    CUDA_CHECK(cudaMemcpy(dx, hx.data(), n * sizeof(float), cudaMemcpyHostToDevice));
    for (const DialCase& c : kDial) {
        unsigned grid = (unsigned)((n + 255) / 256);
        c.fn<<<grid, 256>>>(dx, dy, n, kS, kT);
        CUDA_CHECK_LAUNCH(true);
        CUDA_CHECK(cudaMemcpy(hy.data(), dy, n * sizeof(float), cudaMemcpyDeviceToHost));
        std::vector<float> ref(n);
        for (size_t i = 0; i < n; ++i) ref[i] = dial_ref(hx[i], c.F, kS, kT);
        CompareResult r = compare(ref.data(), hy.data(), n, 1e-5, 1e-5);
        std::printf("dial F=%-5d ", c.F);
        print_compare(r);
        ok = ok && r.pass;
    }
    CUDA_CHECK(cudaFree(dx));
    CUDA_CHECK(cudaFree(dy));

    // B: A and B filled with 0.25, so every product is 1/16 and one 16x16x16
    // MMA adds 16 * 1/16 = 1 to every accumulator element. After `reps`
    // rounds, every element of c0 must be exactly `reps` (exact in FP16 too
    // for reps <= 2048).
    const int reps = 1000;
    std::vector<half> h16(256, __float2half(0.25f));
    half *dA, *dB;
    float* dout;
    CUDA_CHECK(cudaMalloc(&dA, 256 * sizeof(half)));
    CUDA_CHECK(cudaMalloc(&dB, 256 * sizeof(half)));
    CUDA_CHECK(cudaMalloc(&dout, 256 * sizeof(float)));
    CUDA_CHECK(cudaMemcpy(dA, h16.data(), 256 * sizeof(half), cudaMemcpyHostToDevice));
    CUDA_CHECK(cudaMemcpy(dB, h16.data(), 256 * sizeof(half), cudaMemcpyHostToDevice));
    std::vector<float> want(256, (float)reps), got(256);
    for (int acc16 = 0; acc16 < 2; ++acc16) {
        if (acc16) mma_peak<half><<<4, 128>>>(dA, dB, dout, reps);
        else       mma_peak<float><<<4, 128>>>(dA, dB, dout, reps);
        CUDA_CHECK_LAUNCH(true);
        CUDA_CHECK(cudaMemcpy(got.data(), dout, 256 * sizeof(float), cudaMemcpyDeviceToHost));
        CompareResult r = compare(want.data(), got.data(), 256, 0.0, 0.0);
        std::printf("mma  %s acc ", acc16 ? "FP16" : "FP32");
        print_compare(r);
        ok = ok && r.pass;
    }
    CUDA_CHECK(cudaFree(dA));
    CUDA_CHECK(cudaFree(dB));
    CUDA_CHECK(cudaFree(dout));

    std::printf("PASTE: lab03 roofline test %s\n", ok ? "PASS" : "FAIL");
    return ok ? 0 : 1;
}

// ---------------------------------------------------------------------------
// bench
// ---------------------------------------------------------------------------
static int run_bench()
{
    DevicePeaks d = query_device_peaks();
    print_device_peaks(d);

    // ---- A. intensity dial --------------------------------------------------
    const size_t n = (size_t)1 << 26;             // 64 M floats = 256 MB per array
    float *dx, *dy;
    CUDA_CHECK(cudaMalloc(&dx, n * sizeof(float)));
    CUDA_CHECK(cudaMalloc(&dy, n * sizeof(float)));
    {
        std::vector<float> hx(n);
        fill_random(hx.data(), n);
        CUDA_CHECK(cudaMemcpy(dx, hx.data(), n * sizeof(float), cudaMemcpyHostToDevice));
    }
    const unsigned grid = (unsigned)((n + 255) / 256);

    std::printf("\nA. Intensity dial: load 1 float, F FMAs, store 1 float  (%zu elements, %.0f MB moved per run)\n",
                n, 8.0 * n / 1e6);
    std::printf("%6s %10s %10s %11s %9s %9s %8s\n",
                "F", "FLOP/B", "time ms", "GFLOP/s", "GB/s", "%FP32pk", "%DRAMpk");
    double best_gbs = 0, best_gflops = 0;
    char paste[1024];
    int plen = std::snprintf(paste, sizeof paste, "PASTE: lab03 dial");
    for (const DialCase& c : kDial) {
        Timing t = time_gpu([&] { c.fn<<<grid, 256>>>(dx, dy, n, kS, kT); });
        double sec    = t.median_ms / 1e3;
        double ai     = c.F / 4.0;
        double gflops = 2.0 * c.F * n / sec / 1e9;
        double gbs    = 8.0 * n / sec / 1e9;
        best_gbs = gbs > best_gbs ? gbs : best_gbs;
        best_gflops = gflops > best_gflops ? gflops : best_gflops;
        std::printf("%6d %10.2f %10.3f %11.0f %9.0f %8.1f%% %7.1f%%\n", c.F, ai, t.median_ms,
                    gflops, gbs, d.fp32_tflops > 0 ? 100.0 * gflops / (d.fp32_tflops * 1e3) : 0.0,
                    100.0 * gbs / d.dram_gbs());
        if (plen < (int)sizeof paste - 32)
            plen += std::snprintf(paste + plen, sizeof paste - plen, " %g:%.0f", ai, gflops);
    }
    CUDA_CHECK(cudaFree(dx));
    CUDA_CHECK(cudaFree(dy));
    std::printf("Measured roofs: %.0f GB/s (best bandwidth) and %.0f GFLOP/s (best compute)\n",
                best_gbs, best_gflops);
    std::printf("Measured ridge: %.1f FLOP/B (spec ridge: %.1f)\n", best_gflops / best_gbs,
                d.fp32_tflops > 0 ? d.fp32_tflops * 1e3 / d.dram_gbs() : 0.0);
    std::printf("%s\n", paste);

    // ---- B. tensor-core peak ------------------------------------------------
    std::vector<half> h16(256, __float2half(0.25f));
    half *dA, *dB;
    float* dout;
    CUDA_CHECK(cudaMalloc(&dA, 256 * sizeof(half)));
    CUDA_CHECK(cudaMalloc(&dB, 256 * sizeof(half)));
    CUDA_CHECK(cudaMalloc(&dout, 256 * sizeof(float)));
    CUDA_CHECK(cudaMemcpy(dA, h16.data(), 256 * sizeof(half), cudaMemcpyHostToDevice));
    CUDA_CHECK(cudaMemcpy(dB, h16.data(), 256 * sizeof(half), cudaMemcpyHostToDevice));

    const int reps = 4096, threads = 256;                  // 8 warps per block
    const int blocks = d.sm_count * 6;                      // 48 warps per SM: full
    const double flops = 2.0 * 16 * 16 * 16 * 4.0 * reps * (blocks * threads / 32);
    Timing t32 = time_gpu([&] { mma_peak<float><<<blocks, threads>>>(dA, dB, dout, reps); });
    Timing t16 = time_gpu([&] { mma_peak<half><<<blocks, threads>>>(dA, dB, dout, reps); });
    double tf32 = flops / (t32.median_ms / 1e3) / 1e12;
    double tf16 = flops / (t16.median_ms / 1e3) / 1e12;
    std::printf("\nB. Tensor cores (WMMA 16x16x16, FP16 inputs, operands in registers)\n");
    std::printf("   FP32 accumulate: %7.1f TFLOPS   (RTX 5070 spec: 61.7)\n", tf32);
    std::printf("   FP16 accumulate: %7.1f TFLOPS   (RTX 5070 spec: 123.5)\n", tf16);
    std::printf("PASTE: lab03 mma fp32acc=%.1f fp16acc=%.1f\n", tf32, tf16);
    CUDA_CHECK(cudaFree(dA));
    CUDA_CHECK(cudaFree(dB));
    CUDA_CHECK(cudaFree(dout));

    std::printf("\nReading the table: at small F the time is flat (memory-bound, GB/s near its best);\n"
                "past the ridge the time grows with F (compute-bound, GFLOP/s near its best).\n"
                "The F where GB/s starts to fall is your card's ridge point, measured.\n");
    return 0;
}

int main(int argc, char** argv)
{
    if (argc != 2 || (std::strcmp(argv[1], "test") && std::strcmp(argv[1], "bench"))) {
        std::fprintf(stderr, "usage: %s test|bench\n", argv[0]);
        return 1;
    }
    require_cuda_device();
    return std::strcmp(argv[1], "test") == 0 ? run_test() : run_bench();
}
