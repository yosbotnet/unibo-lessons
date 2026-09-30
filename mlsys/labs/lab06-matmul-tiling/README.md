# Lab 06 — FP32 matmul: from naive to shared-memory tiles

Chapter 7 of the course. One program, `sgemm`, holds four kernels for
C = A @ B (row-major, FP32) and cuBLAS as the reference:

| version | idea |
|---|---|
| v1 naive, x walks rows | one thread per output; a warp spans 32 rows |
| v2 naive, x walks cols | same kernel, a warp spans 32 columns |
| v3 tiled, T = 16 / 32 | shared-memory tiles, each loaded element used T times |
| cuBLAS | `cublasSgemm`, plain FP32 (no TF32) |

The test, benchmark and cuBLAS call live in `../common/gemm.h`, shared with lab 7.

## Run

```sh
make test       # 9 awkward shapes, every kernel: all PASS
make bench      # TFLOP/s at 1024, 2048, 4096 cubed (v1 at 4096 takes a few seconds)
make ncu-table  # chapter 7's metrics for every kernel at 2048 cubed
make ncu KERNEL=tiled   # full report of the tiled kernels, for the GUI
make sass       # FFMA and shared-load instruction counts per kernel
```

Before `make bench`, fill in the prediction table in chapter 7 section 8.
Paste back the `PASTE:` lines (one from `make test`, three from
`make bench`) and the text output of `make ncu-table` and `make sass`.

## Reading `make ncu-table`

- `l1tex__average_t_sectors_per_request_pipe_lsu_mem_global_op_ld.ratio`:
  sectors per warp-wide global load. v1 averages its A loads (32) and B
  loads (1); v2 its A (1) and B (4).
- `smsp__inst_executed_op_shared_ld_pred_on_any.sum` divided by
  (`smsp__sass_thread_inst_executed_op_ffma_pred_on.sum` / 32): shared-memory
  load instructions per warp-wide FMA. The chapter predicts 2 for v3.
- The four `stalled_*` ratios: what the warps waited for. Chapter 7 predicts
  `long_scoreboard` for the naive kernels and `mio_throttle` /
  `short_scoreboard` for the tiled ones.

Metric names drift between Nsight Compute versions. If one is reported as
missing, `ncu --query-metrics --chip gb205 | grep <part of the name>` shows
what your version calls it.

## If something goes wrong

- `make ARCH=sm_89 NVCC=/usr/local/cuda/bin/nvcc` for another GPU or toolkit
  path; `make clean` first when you change `ARCH`.
- Link errors about cuBLAS: the library ships with the toolkit; if `nvcc`
  cannot find it, add `LIBS="-L/usr/local/cuda/lib64 -lcublas"`.
