# Lab 05 — GPT-2's MLP sublayer, op by op

Chapter 6 of the course. One program, `mlp`, runs the MLP half of a GPT-2
small layer as seven separate kernels (layernorm, two naive matrix
multiplies, two bias adds, GELU, the residual add) plus one fused
`bias_gelu`, and times each of them at three sizes: M = 1 token (one user,
decode), 64 and 512 tokens (a batch, or a prompt).

## Run

```sh
make test       # every kernel vs a double-precision CPU reference: all PASS
make bench      # the op-by-op table at M = 1, 64, 512
make nsys       # optional: the timeline of one M = 512 pass
make ncu-table  # optional: DRAM / SM throughput and grid size per kernel
```

Before `make bench`, fill in the prediction table in chapter 6 section 9.
Then paste back the `PASTE:` lines (one from `make test`, three from
`make bench`) and, if you ran it, the output of `make ncu-table`.

## What the columns mean

- **us**: median kernel time over 20 runs (CUDA events).
- **MB moved**: the *minimum* bytes the op must move: every input read once,
  every output written once. The real traffic can be higher (the naive
  matmul re-reads its inputs; caches absorb part of that).
- **GB/s** = MB moved / time: compare it with your lab 0 ceiling.
- **GFLOP/s** = FLOPs / time: compare it with the peak FP32 line at the top.
- **FLOP/B**: the op's algorithmic intensity (chapter 4). Anything below the
  ridge (~46 for FP32 on your card) cannot be compute-bound.
- **share**: fraction of the unfused sublayer's total time.

## If something goes wrong

- `make ARCH=sm_89 NVCC=/usr/local/cuda/bin/nvcc` for another GPU or toolkit
  path; `make clean` first when you change `ARCH`.
- `ncu` stops with `ERR_NVGPUCTRPERM`: turn on the Windows-side performance
  counter switch (chapter 1, lab 4).
