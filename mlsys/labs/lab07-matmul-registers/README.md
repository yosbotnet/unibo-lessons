# Lab 07 — Matmul II: register blocking, warp tiling, tensor cores

Chapter 8 of the course. Two programs on the harness in `../common/gemm.h`:

**`sgemm2`**: FP32 on the CUDA cores, each kernel adding one idea:

| version | idea | shared loads per FMA |
|---|---|---|
| v3 tiled, T = 16 | lab 6's baseline | 2 |
| v4 1D register blocking | 8 outputs per thread, in a column | 1.125 |
| v5 2D register blocking | 8 x 8 outputs per thread, outer product | 0.25 |
| v6 + 16-byte loads | float4 global loads, A tile transposed, LDS.128 | 0.25, in 4x fewer instructions |
| v7 + warp tiling | each warp owns a 64 x 64 square | same per thread, less per output |
| cuBLAS | `cublasSgemm`, plain FP32 | |

**`hgemm`**: FP16 inputs, FP32 accumulation, on the tensor cores via WMMA:

| version | idea |
|---|---|
| t1 | one warp per 16 x 16 tile, fragments straight from global memory |
| t2 | 128 x 128 block tile staged in shared memory, 8 warps of 64 x 32 |
| t3 | t2 + `cp.async` double buffering |
| cuBLAS | `cublasGemmEx`, FP16 in, FP32 compute |

All FP32 kernels handle any shape. The tensor-core kernels need multiples
of 128; the harness pads with zeros and the test checks the logical shape.

## Run

```sh
make test         # sgemm2 and hgemm: all PASS
make bench        # both tables; hgemm's "% tensor pk" is against 61.7 TFLOPS
make sass         # FFMA / LDS / LDS.128 / HMMA / LDSM per kernel
make ncu-table    # the FP32 kernels' metrics at 2048 cubed
make ncu-tensor   # Speed of Light, compute and memory sections for t1..t3
```

Before `make bench`, fill in the prediction table in chapter 8 section 9.
Paste back the `PASTE:` lines (two from `make test`, six from
`make bench`) and the output of `make sass` and `make ncu-table`.

## If something goes wrong

- Register spills: `make` prints `-Xptxas -v` lines. v7 should use well
  under 255 registers per thread with 0 bytes of spill stores; if you see
  spills, say so, the chapter's numbers assume none.
- `make ARCH=sm_89 NVCC=/usr/local/cuda/bin/nvcc` for another GPU or toolkit
  path; `make clean` first when you change `ARCH`. The WMMA and `cp.async`
  kernels need `sm_80` or newer.
- Metric names drift between Nsight Compute versions:
  `ncu --query-metrics --chip gb205 | grep <part of the name>`.
