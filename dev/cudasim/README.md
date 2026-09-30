# cudasim: check CUDA lab kernels on a machine without a GPU

A correctness tool for the ML Systems labs, not a performance model. It runs a
lab's `.cu` file on the CPU with the semantics that decide whether a kernel is
*correct*: blocks, threads, `__syncthreads()`, `__shared__` memory, warp
shuffles, WMMA fragments, the async-copy primitives, and the cuBLAS calls the
labs use (with cuBLAS's column-major rules, so a wrong transpose fails here
too).

```sh
dev/cudasim/run.sh mlsys/labs/lab06-matmul-tiling/sgemm.cu test
CUDASIM_CXXFLAGS="-DSOMETHING -O0 -g" dev/cudasim/run.sh file.cu args
```

How it works: `launch2cpp.py` rewrites `kernel<<<grid, block>>>(args)` into a
call to `cudasim::launch`, and the headers in this directory stand in for
`cuda_runtime.h`, `cuda_fp16.h`, `mma.h`, `cuda_pipeline.h` and `cublas_v2.h`.
Blocks run one after another; inside a block every CUDA thread is a fiber that
runs until it reaches a barrier. A thread that skips a needed barrier therefore
races ahead of its whole block, so a missing `__syncthreads()` gives wrong
results reliably. A barrier reached by only part of a block, or threads waiting
at different barriers, stops the program with a message.

Not modelled: time (event timings are fake, so `bench` output is meaningless),
occupancy, caches, concurrency between blocks, streams, inline PTX. About
1 microsecond per CUDA thread: keep test sizes to a few million threads.
