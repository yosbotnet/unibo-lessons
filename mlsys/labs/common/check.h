// check.h - error checking helpers shared by every lab.
//
// Almost every CUDA runtime call returns a cudaError_t. If you ignore it, a
// failure (out of memory, bad launch configuration, missing driver...) goes
// unnoticed and the program keeps running with garbage. These helpers turn any
// error into a clear message with file:line, then stop the program.
#pragma once

#include <cstdio>
#include <cstdlib>
#include <cuda_runtime.h>

// Wrap every CUDA runtime call:   CUDA_CHECK(cudaMalloc(&p, bytes));
// The do { } while (0) makes the macro behave like one statement (safe inside
// an if/else without braces).
#define CUDA_CHECK(call)                                                      \
    do {                                                                      \
        cudaError_t err_ = (call);                                            \
        if (err_ != cudaSuccess) {                                            \
            std::fprintf(stderr, "CUDA error at %s:%d\n  %s\n  -> %s (%s)\n", \
                         __FILE__, __LINE__, #call,                           \
                         cudaGetErrorString(err_), cudaGetErrorName(err_));  \
            std::exit(EXIT_FAILURE);                                          \
        }                                                                     \
    } while (0)

// Kernel launches (kernel<<<grid, block>>>(...)) do NOT return an error code.
// Two kinds of errors can happen:
//   1. launch errors (e.g. too many threads per block): reported immediately
//      by cudaGetLastError().
//   2. errors while the kernel runs (e.g. out-of-bounds access): the launch is
//      asynchronous, so they only show up at the next synchronisation point.
// Passing sync = true waits for the kernel so that kind 2 is caught right here,
// next to the launch that caused it. It costs time, so do not use it inside
// timed loops.
inline void check_last_launch(bool sync, const char* file, int line)
{
    cudaError_t err = cudaGetLastError();
    if (err == cudaSuccess && sync) err = cudaDeviceSynchronize();
    if (err != cudaSuccess) {
        std::fprintf(stderr, "CUDA kernel error at %s:%d\n  -> %s (%s)\n",
                     file, line, cudaGetErrorString(err), cudaGetErrorName(err));
        std::exit(EXIT_FAILURE);
    }
}
// Usage, right after a launch:  CUDA_CHECK_LAUNCH(true);
#define CUDA_CHECK_LAUNCH(sync) check_last_launch((sync), __FILE__, __LINE__)

// Call this first in main(). If there is no usable GPU (no driver, driver too
// old for this toolkit, no NVIDIA card, WSL2 without GPU support...) print one
// clear message and exit with a nonzero code instead of crashing later.
// Returns the device index in use (always 0 in these labs).
inline int require_cuda_device()
{
    int count = 0;
    cudaError_t err = cudaGetDeviceCount(&count);
    if (err != cudaSuccess || count == 0) {
        std::fprintf(stderr, "No CUDA device found (%s).\n",
                     err != cudaSuccess ? cudaGetErrorString(err)
                                        : "cudaGetDeviceCount returned 0");
        std::fprintf(stderr,
                     "Checklist: does `nvidia-smi` work? Is the NVIDIA driver recent "
                     "enough for this CUDA toolkit? (WSL2: install the driver on "
                     "Windows, not inside Linux.)\n");
        std::exit(EXIT_FAILURE);
    }
    const int dev = 0;
    CUDA_CHECK(cudaSetDevice(dev));
    return dev;
}
