// Lab 04 - graphs.cu: where launch overhead hides, and how CUDA graphs remove it.
//
//   ./graphs test     all three modes produce the same result
//   ./graphs bench    time 1000 tiny kernels three ways (run it under nsys: `make nsys`)
//
// The kernel is deliberately tiny (4096 floats, 16 blocks): its GPU time is a
// couple of microseconds, comparable to what it costs just to launch it.
//   A  launch + cudaStreamSynchronize, 1000 times   the CPU waits for every kernel
//   B  1000 launches, one sync at the end            launches queue up, CPU runs ahead
//   C  the same 1000 launches captured in a graph    one launch for the whole sequence
// NVTX ranges name each mode on the Nsight Systems timeline.

#include <cstdio>
#include <cstring>
#include <chrono>
#include <vector>

#include "check.h"

#if __has_include(<nvtx3/nvToolsExt.h>)
#include <nvtx3/nvToolsExt.h>
struct NvtxRange {
    explicit NvtxRange(const char* name) { nvtxRangePushA(name); }
    ~NvtxRange() { nvtxRangePop(); }
};
#else
struct NvtxRange { explicit NvtxRange(const char*) {} };  // NVTX headers not installed
#endif

constexpr int N = 4096;      // elements touched by each tiny kernel
constexpr int K = 1000;      // kernels per mode

__global__ void bump(float* x, int n)
{
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i < n) x[i] += 1.0f;
}

static void launch_bump(float* d, cudaStream_t st)
{
    bump<<<(N + 255) / 256, 256, 0, st>>>(d, N);
}

using Clock = std::chrono::steady_clock;
static double us_since(Clock::time_point t0)
{
    return std::chrono::duration<double, std::micro>(Clock::now() - t0).count();
}

struct Result { double a_us, b_us, c_us; float value; };

// Runs the three modes once each on a zeroed array. Returns wall-clock time
// per kernel for each mode and the final value of x[0] (should be 3*K).
static Result run_modes(float* d, cudaStream_t st, cudaGraphExec_t exec)
{
    Result r{};
    CUDA_CHECK(cudaMemset(d, 0, N * sizeof(float)));
    CUDA_CHECK(cudaDeviceSynchronize());

    {   NvtxRange range("A: launch + sync each");
        auto t0 = Clock::now();
        for (int k = 0; k < K; ++k) {
            launch_bump(d, st);
            CUDA_CHECK(cudaStreamSynchronize(st));   // the CPU waits every time
        }
        r.a_us = us_since(t0) / K;
    }
    {   NvtxRange range("B: async launches");
        auto t0 = Clock::now();
        for (int k = 0; k < K; ++k) launch_bump(d, st);
        CUDA_CHECK(cudaStreamSynchronize(st));       // one wait at the end
        r.b_us = us_since(t0) / K;
    }
    {   NvtxRange range("C: one CUDA graph");
        auto t0 = Clock::now();
        CUDA_CHECK(cudaGraphLaunch(exec, st));       // 1000 kernels, one launch
        CUDA_CHECK(cudaStreamSynchronize(st));
        r.c_us = us_since(t0) / K;
    }
    CUDA_CHECK_LAUNCH(true);
    CUDA_CHECK(cudaMemcpy(&r.value, d, sizeof(float), cudaMemcpyDeviceToHost));
    return r;
}

int main(int argc, char** argv)
{
    if (argc != 2 || (std::strcmp(argv[1], "test") && std::strcmp(argv[1], "bench"))) {
        std::fprintf(stderr, "usage: %s test|bench\n", argv[0]);
        return 1;
    }
    bool bench = !std::strcmp(argv[1], "bench");
    require_cuda_device();

    float* d = nullptr;
    CUDA_CHECK(cudaMalloc(&d, N * sizeof(float)));
    cudaStream_t st;
    CUDA_CHECK(cudaStreamCreate(&st));

    // Build the graph ONCE: record the K launches instead of running them.
    cudaGraph_t graph;
    cudaGraphExec_t exec;
    CUDA_CHECK(cudaStreamBeginCapture(st, cudaStreamCaptureModeGlobal));
    for (int k = 0; k < K; ++k) launch_bump(d, st);
    CUDA_CHECK(cudaStreamEndCapture(st, &graph));
    CUDA_CHECK(cudaGraphInstantiate(&exec, graph, 0));  // the expensive, one-off step

    // Round 1 is a warm-up (first launches load code, raise clocks). Round 2 counts.
    Result r = run_modes(d, st, exec);
    r = run_modes(d, st, exec);
    bool ok = r.value == 3.0f * K;

    if (!bench) {
        std::printf("x[0] = %.0f after three modes x %d kernels (expected %d): %s\n",
                    r.value, K, 3 * K, ok ? "PASS" : "FAIL");
        std::printf("PASTE: lab04 graphs test %s\n", ok ? "PASS" : "FAIL");
    } else {
        std::printf("%d tiny kernels (%d floats each), wall-clock time per kernel:\n", K, N);
        std::printf("  A  launch + sync each       %8.2f us\n", r.a_us);
        std::printf("  B  async launches, 1 sync   %8.2f us\n", r.b_us);
        std::printf("  C  one CUDA graph           %8.2f us\n", r.c_us);
        std::printf("PASTE: lab04 graphs A=%.2f B=%.2f C=%.2f %s\n", r.a_us, r.b_us, r.c_us,
                    ok ? "ok" : "WRONG");
        std::printf("\nA pays the full round trip CPU -> driver -> GPU -> CPU every time.\n"
                    "B overlaps: the CPU queues launches while the GPU runs earlier ones,\n"
                    "so the cost is whichever is slower, submitting or executing.\n"
                    "C submits the whole sequence at once; what is left is the GPU's own\n"
                    "per-kernel cost. Under WSL2 every submission crosses into the Windows\n"
                    "driver, so A and B cost more than on native Linux; graphs help more.\n");
    }

    CUDA_CHECK(cudaGraphExecDestroy(exec));
    CUDA_CHECK(cudaGraphDestroy(graph));
    CUDA_CHECK(cudaStreamDestroy(st));
    CUDA_CHECK(cudaFree(d));
    return ok ? 0 : 1;
}
