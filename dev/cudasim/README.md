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

Not modelled: time (event timings and `clock64()` are fake, so `bench` output is meaningless),
occupancy, caches, concurrency between blocks, streams, inline PTX. About
1 microsecond per CUDA thread: keep test sizes to a few million threads.

## Inline PTX: `cudasim_ptx.h` (lab 13)

cudasim cannot execute `asm volatile(...)`. Lab 13 (chapter 14) keeps its inline PTX
behind three wrapper functions in `mlsys/labs/lab13-flash-attention/ptx.h`, and that header
includes `cudasim_ptx.h` instead of the asm blocks when `CUDASIM` is defined (it always is:
`cuda_runtime.h` defines it). The emulated instructions:

| wrapper | PTX |
|---|---|
| `mma_16816(float c[4], const uint32_t a[4], const uint32_t b[2])` | `mma.sync.aligned.m16n8k16.row.col.f32.f16.f16.f32` |
| `ldmatrix_x4(uint32_t r[4], const void* row)` | `ldmatrix.sync.aligned.m8n8.x4.shared.b16` |
| `ldmatrix_x4_trans(uint32_t r[4], const void* row)` | `ldmatrix.sync.aligned.m8n8.x4.trans.shared.b16` |

They use the per-warp exchange behind `shfl`: each lane publishes its operands (six
registers, or its row address) in a per-warp table, waits at a warp barrier, then reads the
other lanes' slots and computes only its own outputs, using the PTX ISA register layouts
(g = lane / 4, t = lane % 4; in a 32-bit register the element with the lower index is in the
low 16 bits):

- A (16x16, row): register i, half h holds A[g + (i & 1) * 8][2t + h + (i >> 1) * 8]
- B (16x8, col, k x n): register i, half h holds B[2t + h + 8i][g]
- C/D (16x8, FP32): float i holds C[g + (i >> 1) * 8][2t + (i & 1)]
- ldmatrix x4: lanes 8k .. 8k+7 give the row addresses of 8x8 block k (16-byte aligned, else the
  program stops); register k, half h = block k [lane / 4][2 (lane % 4) + h]; `.trans`:
  block k [2 (lane % 4) + h][lane / 4]

Products of two FP16 values are exact in FP32 and are summed in FP32 in k order; the GPU's
order inside an MMA is unspecified, so results agree to FP32 rounding, not bit for bit.
`mma_16816` alternates between two slot tables by call count, so it needs one barrier per
call; `ldmatrix` keeps a second barrier, like `shfl`, because it reads shared memory after the
exchange. Every slot carries the lane's call count: an instruction reached by fewer than
32 lanes of a warp (an early return before it, a divergent branch) stops the program, since
`.sync.aligned` needs the whole warp on the GPU. `cuda_fp16.h` gained `__floats2half2_rn`
for `pack_half2` (cvt.rn.f16x2.f32: the first argument in the low half).

Lab 13's `flash test` starts with a `ptx` self-test that runs on both cudasim and the GPU:
`ldmatrix_x4` + two `mma_16816` against a plain 16x16x16 loop, the same with
`ldmatrix_x4_trans`, every A-fragment register against the layout above, and `.trans` of V
against a plain load of V transposed. On cudasim it checks the emulation; on the GPU it checks
that the layouts the emulation assumes are the hardware's. Cost: about 200 warp barriers per
64x64 attention tile per warp, so lab 13's full `test` takes about 25 minutes here;
`flash test quick` runs the ptx self-test and the three small shapes in about 4.
