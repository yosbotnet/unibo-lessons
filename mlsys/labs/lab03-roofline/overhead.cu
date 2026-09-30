// overhead.cu - Lab 03, experiment C: the regime the roofline does not show.
//
//   ./overhead test    the counting kernel and the CUDA graph really run every launch
//   ./overhead bench   C1 back-to-back launches, C2 launch + synchronize round trip,
//                      C3 the same launches replayed from a CUDA graph
//
// A kernel that does no work still costs time: the CPU has to build and submit
// the launch, the GPU has to schedule the grid and retire it. When a model runs
// hundreds of small kernels per step, this fixed cost can be as large as the
// useful work. Here we measure it with kernels that do (almost) nothing.
#include <chrono>
#include <cstdio>
#include <cstring>
#include <vector>

#include "check.h"
#include "bench.h"

__global__ void empty_kernel() {}

// Adds 1 to a counter: lets the test prove that every launch actually ran.
__global__ void count_kernel(int* counter)
{
    if (threadIdx.x == 0) atomicAdd(counter, 1);
}

static const int K = 1000;   // kernels per measurement

// Build a CUDA graph containing K launches of `count` (or empty) kernels by
// capturing them from a stream: the graph replays the whole sequence with a
// single submission from the CPU.
static cudaGraphExec_t build_graph(cudaStream_t s, int* counter)
{
    cudaGraph_t g;
    CUDA_CHECK(cudaStreamBeginCapture(s, cudaStreamCaptureModeGlobal));
    for (int k = 0; k < K; ++k) {
        if (counter) count_kernel<<<1, 32, 0, s>>>(counter);
        else         empty_kernel<<<1, 32, 0, s>>>();
    }
    CUDA_CHECK(cudaStreamEndCapture(s, &g));
    cudaGraphExec_t exec;
    CUDA_CHECK(cudaGraphInstantiate(&exec, g, 0));
    CUDA_CHECK(cudaGraphDestroy(g));
    return exec;
}

static int run_test()
{
    bool ok = true;
    int* dcount;
    int h = 0;
    CUDA_CHECK(cudaMalloc(&dcount, sizeof(int)));

    CUDA_CHECK(cudaMemset(dcount, 0, sizeof(int)));
    for (int k = 0; k < K; ++k) count_kernel<<<1, 32>>>(dcount);
    CUDA_CHECK_LAUNCH(true);
    CUDA_CHECK(cudaMemcpy(&h, dcount, sizeof(int), cudaMemcpyDeviceToHost));
    std::printf("stream launches: counter = %d (want %d) %s\n", h, K, h == K ? "PASS" : "FAIL");
    ok = ok && h == K;

    cudaStream_t s;
    CUDA_CHECK(cudaStreamCreate(&s));
    cudaGraphExec_t exec = build_graph(s, dcount);
    CUDA_CHECK(cudaMemset(dcount, 0, sizeof(int)));
    CUDA_CHECK(cudaGraphLaunch(exec, s));
    CUDA_CHECK(cudaStreamSynchronize(s));
    CUDA_CHECK(cudaMemcpy(&h, dcount, sizeof(int), cudaMemcpyDeviceToHost));
    std::printf("graph replay:    counter = %d (want %d) %s\n", h, K, h == K ? "PASS" : "FAIL");
    ok = ok && h == K;

    CUDA_CHECK(cudaGraphExecDestroy(exec));
    CUDA_CHECK(cudaStreamDestroy(s));
    CUDA_CHECK(cudaFree(dcount));
    std::printf("PASTE: lab03 overhead test %s\n", ok ? "PASS" : "FAIL");
    return ok ? 0 : 1;
}

static int run_bench()
{
    DevicePeaks d = query_device_peaks();
    print_device_peaks(d);
    cudaStream_t s;
    CUDA_CHECK(cudaStreamCreate(&s));

    // C1. K empty kernels queued back to back; GPU-side time per kernel. The
    // CPU enqueues ahead of the GPU, so this is the launch *throughput*.
    Timing t1 = time_gpu([&] { for (int k = 0; k < K; ++k) empty_kernel<<<1, 32, 0, s>>>(); });
    // time_gpu records its events on the default stream; our stream s is a
    // blocking stream, so the events still bracket the work correctly.
    double us_back_to_back = t1.median_ms * 1e3 / K;

    // C2. Launch one kernel and wait for it, K times; CPU wall clock. This is
    // the round trip a program pays whenever the CPU needs a GPU result
    // before it can decide what to do next.
    for (int k = 0; k < 50; ++k) { empty_kernel<<<1, 32, 0, s>>>(); CUDA_CHECK(cudaStreamSynchronize(s)); }
    std::vector<double> rt;
    for (int k = 0; k < K; ++k) {
        auto a = std::chrono::steady_clock::now();
        empty_kernel<<<1, 32, 0, s>>>();
        CUDA_CHECK(cudaStreamSynchronize(s));
        auto b = std::chrono::steady_clock::now();
        rt.push_back(std::chrono::duration<double, std::micro>(b - a).count());
    }
    double us_round_trip = median_of(rt);

    // C3. The same K kernels captured once into a CUDA graph and replayed.
    cudaGraphExec_t exec = build_graph(s, nullptr);
    Timing t3 = time_gpu([&] { CUDA_CHECK(cudaGraphLaunch(exec, s)); });
    double us_graph = t3.median_ms * 1e3 / K;
    CUDA_CHECK(cudaGraphExecDestroy(exec));
    CUDA_CHECK(cudaStreamDestroy(s));

    std::printf("\nC. Launch overhead (%d empty kernels per measurement)\n", K);
    std::printf("   C1 back-to-back launches:        %6.2f us per kernel\n", us_back_to_back);
    std::printf("   C2 launch + synchronize:         %6.2f us per round trip\n", us_round_trip);
    std::printf("   C3 replayed from a CUDA graph:   %6.2f us per kernel\n", us_graph);
    std::printf("\nAny kernel whose useful work is shorter than C1 is overhead-bound, whatever\n"
                "the roofline says. Under WSL2 these numbers can be higher than on native\n"
                "Linux: every submission crosses into the Windows driver.\n");
    std::printf("PASTE: lab03 overhead b2b=%.2fus sync=%.2fus graph=%.2fus\n",
                us_back_to_back, us_round_trip, us_graph);
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
