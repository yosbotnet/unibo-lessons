# Lab 11 — The course's kernels in Triton

Chapter 12 of the course. Python only: the kernels of Part II rewritten as Triton
programs, each checked against the PyTorch op and timed against PyTorch and against
your CUDA labs.

> **Not run on any GPU.** This lab was written against the API of Triton 3.8 (the
> official tutorials: vector add, fused softmax, matrix multiplication, layer norm) and
> checked by reading and with `python3 -m py_compile`, on a machine with no GPU, no
> torch and no triton. The version-sensitive details (the compiled-kernel handle's
> `asm`, `n_regs`, `n_spills`, `metadata.shared`; `do_bench`'s arguments; the autotuner's
> `best_config`) were checked against the Triton 3.8.0 source. Expect to fix small
> things on the first run, and paste back whatever breaks.

## Setup (WSL2)

```sh
python3 -m venv ~/venvs/triton && . ~/venvs/triton/bin/activate
pip install torch --index-url https://download.pytorch.org/whl/cu128   # brings a matching triton
python -c "import torch, triton; print(torch.__version__, torch.version.cuda, triton.__version__)"
```

You need `triton` >= 3.3 and a PyTorch built for CUDA 12.8 or newer (`cu128` or `cu130`
wheels). Run every `make` target with that Python on the path (or `make PYTHON=...`).

## Files

| file | what it does |
|---|---|
| `common.py` | the harness: `env_report()` (`make env`), `check()` (PASS/FAIL with max abs and rel error), `bench_cold()` (`triton.testing.do_bench`, L2 flushed, median and q20..q80), `bench_warm()` (lab 7's `bench.h` protocol: 3 warm-ups, 20 timed, no flush), `fmt_row()` |
| `01_vecadd.py` | section 2's `add_kernel` / `add`. Test: n = 1,024, 2^20, 50,000,001 vs `x + y`, exact. Bench: 64M floats, GB/s = 12n / t vs `torch.add` |
| `02_softmax.py` | section 3's `softmax_kernel` / `softmax` (one program per row) and the tutorial's persistent kernel (`softmax_kernel_persistent`, HIP branch dropped). Test: [12288, 1024], [1024, 8192], [37, 1000] and a row with a `-inf` prefix vs `torch.softmax`. Bench: GB/s = 8 rows cols / t |
| `03_layernorm.py` | section 4's `layernorm_kernel` (the row is the tile), the tutorial's three-loop `_layer_norm_fwd_fused`, and `residual_layernorm_kernel` (chapter 9's add + norm). Test: [4096, 768] FP32 and FP16 vs `F.layer_norm`, eps 1e-5; rows with mean 1000 and std 1 against an FP64 reference (with the one-pass formula's error printed for contrast). Bench: GB/s = (2MNs + 2Ns) / t |
| `04_matmul.py` | section 5's `matmul_kernel` (as printed) and `matmul_kernel_tuned` (the same kernel under `@triton.autotune` with the tutorial's eight FP16 configs, `key=['M','N','K']`). Test: 5 shapes incl. a ragged (1000, 777, 333) vs an FP32 matmul of the same FP16 inputs, rtol = atol = 1e-2. Bench: 6 shapes, cold (`do_bench`) and warm, TFLOP/s = 2MNK / t, % of torch, % of 61.7 TFLOPS; prints the winning config and the runner-up timings per shape |
| `05_fused_matmul_gelu.py` | the same kernel with section 6's epilogue (`HAS_BIAS`, `ACT`, `HAS_RESIDUAL` as `tl.constexpr`). Test: bias + GELU at (4096, 768, 3072), bias + residual at (4096, 3072, 768), all three at a ragged shape, no flags. Bench: matmul alone vs fused vs torch's matmul, + bias, `F.gelu` |
| `inspect_asm.py` | `make asm`: every kernel compiled once with a fixed config; writes `asm/<kernel>.{ttir,ttgir,llir,ptx}` (and `.sass` if Triton's bundled `cuobjdump` works), prints section 7's PTX counts, `n_regs`, `n_spills`, shared bytes, `convert_layout` count, SASS HMMA / LDSM / LDGSTS, and the blocked layout of `add_kernel` (check figure 3 against it). Not called `inspect.py`: that name would shadow Python's `inspect` module |

Shapes of the matmuls are written (M, K, N): C[M, N] = A[M, K] @ B[K, N], FP16 in, FP32
accumulate, FP16 out, row-major.

## Run

```sh
cd ~/unibo-lessons/mlsys/labs/lab11-triton
make env          # versions, capability, and the PTX instruction counts of section 10
make test         # every kernel vs its PyTorch op: all PASS
make bench        # the tables: GB/s for the row kernels, TFLOP/s for the matmuls, vs PyTorch
make bench-warm   # the matmul again without the L2 flush, for the lab 7 comparison
make asm          # inspect_asm.py: layouts and instruction counts per kernel, PTX in ./asm/
```

`make bench` sets `TRITON_PRINT_AUTOTUNING=1`: each config is printed as the autotuner
tries it, then the winner and the total tuning time. The first call at every new shape
compiles and tunes (seconds); every benchmark calls the kernel once before the clock starts.

For the lab 7 comparison, put `make bench-warm`'s numbers at 1024^3, 2048^3 and 4096^3
next to the `hgemm` lines of lab 7's `make bench` (t3 and cuBLAS GemmEx). Both use the
same protocol (3 warm-ups, 20 timed runs, no flush); lab 7's C is FP32, this lab's FP16.

## Triton on sm_120 (chapter 12, section 10)

- Blackwell targets, including consumer sm_120, entered Triton with **3.3** (April 2025),
  the version PyTorch 2.7 shipped with its CUDA 12.8 wheels. The current release is
  **3.8.0** (August 2026).
- Triton bundles its own `ptxas`; your system `nvcc` does not matter to it. Since 3.6 it
  uses a separate `ptxas-blackwell` for sm_100 and newer (override:
  `TRITON_PTXAS_BLACKWELL_PATH`; before 3.6, `TRITON_PTXAS_PATH`).
- `ptxas fatal: Value 'sm_120' is not defined ...` and
  `LLVM ERROR: ptx87 is required for target sm_120` both mean a toolchain older than the
  card: an old wheel (a `cu126` PyTorch, or Triton < 3.3), or a `TRITON_PTXAS*_PATH`
  pointing at an old CUDA toolkit. Blackwell needs PTX ISA 8.7 (CUDA 12.8).
- Expected, unverified: no `wgmma` and no `tcgen05` on this card, so `tl.dot` lowers to
  `mma.sync` (the Ampere / Ada path). `make env` is the test. FP8 `tl.dot` on sm_120 is
  not part of this lab.

## Predictions (chapter 12, section 11): write yours down first

| step | prediction |
|---|---|
| env: mma.sync / ldmatrix / cp.async in the matmul PTX | all nonzero; wgmma, tcgen05 zero |
| vecadd 64M | within 5% of lab 0's ceiling and of torch.add |
| softmax 1024 / 8192 | near the ceiling; persistent slightly ahead at 1024; both near torch |
| layernorm 768, M = 4096 | near the ceiling, within a few % of F.layer_norm; 3-loop version close behind |
| matmul 4096^3 cold | 70-95% of torch.matmul; winning config num_stages >= 3 |
| matmul warm vs lab 7 t3 / cuBLAS | between t3 and cuBLAS, or clearly above t3 |
| fused matmul+bias+gelu vs matmul | within a few %; vs matmul + 2 torch ops: ~100-170 us saved |
| matmul M = 64, M = 1 | behind cuBLAS, more so at M = 1 |

## Paste back

- the whole `make env` block, ending in `PASTE: env ...`
- `make test`: five lines `PASTE: test 01_vecadd PASS k/k` ... `PASTE: test 05_fused_matmul_gelu PASS k/k`
- `make bench`: `PASTE: vecadd ...`; `PASTE: softmax <shape> ...` (two); `PASTE: layernorm <dtype> ...`
  (two); `PASTE: matmul <shape> cold ... / warm ...` (six); `PASTE: fused ...` (one); and the
  `PASTE: best_config matmul <shape> ...` lines (six)
- `make asm`: the summary table at the end
- anything that failed, with its traceback

## If something goes wrong

- `torch.cuda.is_available()` is False: the venv has a CPU wheel; reinstall from the
  `cu128` index above.
- An autotuning line `Autotuning failed with OutOfResources ... shared memory`: that config
  needs more shared memory than an SM has (e.g. 128x256x64 with 3 stages is ~147 KB); the
  autotuner skips it and the others still run. Not an error.
- A first call that takes seconds: compilation and autotuning. Compiled kernels are cached
  in `~/.triton/cache/`; delete it to force a recompile (also needed when
  `MLIR_ENABLE_DUMP=1` prints nothing).
- `make asm` prints `sass not available`: Triton's bundled `cuobjdump` failed; the PTX
  counts are still valid. `cuobjdump -sass` on the `.cubin` in `~/.triton/cache/<hash>/`
  does the same by hand.
