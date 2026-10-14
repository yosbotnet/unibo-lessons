# Lab 04b — The hardware underneath: pipes, DRAM and clocks

The optional interlude between Part I and Part II. Two microbenchmark
programs: `pipes` measures single instructions (how long one takes, how many
an SM finishes per clock), `dram` measures the memory below the L2 (streaming,
random chunks, the TLB). Every number is printed per clock per SM or in GB/s,
next to the value the interlude predicts.

Close other GPU programs first (the desktop shares the GPU, chapter 5) and let
the card warm up for a minute: the SM clock moves with temperature and power
(interlude, section 8). Both programs print the clock they actually ran at.

## Run

```sh
make test          # every kernel against a host reference
make sass          # instruction counts per kernel: is each loop what it claims?
make bench-pipes   # A latency, B throughput, C warps x ILP, D MUFU + k FFMA
make bench-dram    # E read/write/copy, F working set, G random chunks, H TLB
```

Run `make sass` before trusting `bench-pipes`. Each throughput kernel
(`chains<OpX, 8>`) does 64 steps per loop iteration, so it should contain 64 of
its instruction (`FFMA`, `HFMA2`, `IMAD`, `LOP3`, `SHFL`, `MUFU.EX2`,
`MUFU.RSQ`, `POPC`, `DFMA`) plus a handful of others for the loop. A smaller
count means the compiler found a shortcut and that row of B measures nothing.
`IMAD` also counts the compiler's `IMAD.MOV` copies, so expect a few extra.

Paste back the `PASTE:` lines: two from `make test`, two from the benches.

## What each experiment does

| | Method | Compare with |
|---|---|---|
| A | one warp, one dependent chain; cycles per step from `clock64()` | FFMA: 4 cycles (Nsight Compute Profiling Guide) |
| B | 48 warps per SM, 8 chains per thread; results per clock per SM | CUDA Best Practices Guide, column 12.0 |
| C | FFMA with 1-12 warps per scheduler and 1, 2, 4 chains | full rate once warps x chains >= 4 |
| D | 1 `MUFU.EX2` + k `FFMA` per group, 12 warps per scheduler | max(8, 1 + k) cycles per group |
| E | 1 GB read, write, copy with `float4` | ~88% of 672 GB/s (chapter 4) |
| F | read the same 1 MB ... 1 GB set until 1 GB has moved | a step down past the 48 MB L2 |
| G | groups of lanes read random aligned chunks of 32 B ... 8 KB | the shape of the interlude's DRAM table |
| H | one thread, one node per 2 MB page, spans 16 MB ... 4 GB, L2-only loads | a step where the TLB stops covering the span |

Notes:

- Every kernel reads `%globaltimer` (ns) and `clock64()` (cycles) at the start
  and end of each block (`probe.h`). Rates use the kernel's own cycles, so they
  do not depend on the clock; the clock itself is printed alongside.
- The MUFU loops use inline PTX (`ex2.approx.ftz.f32`, `rsqrt.approx.ftz.f32`):
  the C functions `exp2f` and `rsqrtf` wrap the MUFU in extra instructions.
- `IMAD` and `LOP3` mix in the neighbouring chain (`x * y + a`, `(x & y) ^ a`).
  With constants only, the compiler can fold 64 steps of `x * a + b` into one,
  and two steps of `(x ^ a) & b` into `x & b`.
- C and D need exactly one or two blocks on each SM. The block scheduler
  spreads blocks evenly when there are as many as SMs (or twice as many), which
  is what these experiments launch.
- H's nodes all fit in the L2 and the loads skip L1 (`__ldcg`), so the only
  thing that grows with the span is the number of pages whose translation the
  TLBs must hold. NVIDIA doesn't publish TLB sizes; Jia et al. (2018, 2019)
  measured earlier GPUs the same way.

## If something goes wrong

- `make ARCH=sm_89 NVCC=/usr/local/cuda/bin/nvcc` for another GPU or toolkit
  path; `make clean` first when you change `ARCH`. On a non-GeForce GPU the
  `table:` column of B is wrong for FP64 (datacenter chips have far more).
- `cuobjdump` not found: it ships with the toolkit, next to `nvcc`.
- H stops early: it halves the largest span until it fits in free memory.
