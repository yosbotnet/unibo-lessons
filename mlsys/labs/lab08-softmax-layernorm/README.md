# Lab 08 — Softmax, layernorm, epilogues

Chapter 9 of the course. Row operations taken from three passes to one, then
fused into their neighbours. Four programs, built into `bin/`:

**`softmax`**: y = softmax(x) per row, five kernels (`softmax.cuh`):

| version | kernel | idea | DRAM passes |
|---|---|---|---|
| v1 | `softmax_thread3` | one thread per row, three passes | 3 reads + 1 write, uncoalesced |
| v2 | `softmax_warp3` | one warp per row, three passes (chapter section 3) | 3 reads + 1 write |
| v3 | `softmax_warp_online` | online (m, d), shuffle merge, formula pass (section 4) | 2 reads + 1 write |
| v4 | `softmax_warp_reg<768/1024/2048>` | the row in registers (section 5) | 1 read + 1 write |
| v5 | `softmax_block_smem` | one block per row, the row in shared memory, T <= 12,288 | 1 read + 1 write |

**`layernorm`** (`layernorm.cuh`): `layernorm_block2` (lab 5's two-pass
kernel), `layernorm_welford` (Welford + Chan, then a formula pass),
`layernorm_warp_reg<768>` (the row in 24 registers per lane, Welford over the
registers: one read, one write), `residual_layernorm<768>` (add and norm
fused: writes r = x + y and LN(r)), `rmsnorm<768>`.

**`epilogue`**: lab 7's v7 SGEMM with an `EPI` template parameter
(`sgemm_v7_epi.h`; lab 7 itself is unchanged): `EpiBiasGelu` for the MLP up
projection (1,024 x 768 x 3,072) and `EpiBiasResid` for the down projection
(1,024 x 3,072 x 768), against the plain GEMM followed by lab 5's
`add_bias`, `gelu` (here `gelu_ew`) and `residual_add`, and against cuBLAS
followed by the same kernels.

**`numerics`**: the stress rows: the cancellation row (768 values near
10,000 with variance ~0.003: two-pass and Welford against the one-pass
E[x^2] - E[x]^2), a fully masked row through every softmax kernel, and a
row with max 200 through a softmax without the max subtraction.

Shared helpers (`warp_max`, `warp_sum`, `block_sum`, `block_max`, Welford
and Chan, `gelu`, lab 5's elementwise kernels) are in `rowops.h`.

Masked entries are `-INFINITY` in the input. Every softmax kernel writes a
fully masked row as zeros (section 6's guard). v3 also guards a lane whose
elements are all masked, which a causal row produces even when the row is
not: inside the exponentials it subtracts `m_safe` (0 while the max is
still `-INFINITY`), so `-inf - (-inf)` never happens.

## Run

```sh
make test         # every kernel vs a double-precision CPU reference: all PASS
make numerics     # the three stress rows, every variant side by side
make bench        # the tables of chapter 9 section 9
make nsys         # the MLP half as separate kernels vs fused, in NVTX ranges
make ncu-table    # softmax: sectors/request, L2 hit rate, DRAM bytes, occupancy
```

Before `make bench`, write down your predictions (the table below is
chapter 9's section 9). Paste back the `PASTE:` lines (four from `make
test`, three from the softmax bench, one each from layernorm, two from
epilogue) and the output of `make numerics` and `make ncu-table`.

| Kernel, shape | Ideal bytes | Prediction | What to look for |
|---|---|---|---|
| softmax v1 thread per row, 12,288 x 1,024 | 100 MB, 0.17 ms | 5-20x the ideal | sectors per request near 32; low achieved occupancy |
| softmax v2 warp, 3 passes, same | | 1.2-1.8x ideal | L1/L2 hit rate high: the rereads mostly hit |
| softmax v3 online, 2 passes, same | | 1.1-1.5x ideal | fewer L2 reads than v2 |
| softmax v4 registers, same | | at the ceiling, 85-95% of 672 GB/s | DRAM bytes ~ ideal bytes |
| softmax v2 vs v5 (shared), 1,536 x 8,192 | 100 MB | v2 1.8-3x ideal; v5 near the ceiling | v2's L2 hit rate drops: 32 KB rows do not stay cached |
| layernorm two-pass (lab 5) vs Welford vs registers, 8,192 x 768 | 50 MB, 85 us | all within 1.3x of each other; registers fastest | the rereads of a 3 KB row hit L1 |
| residual + layernorm fused vs separate, 8,192 x 768 | 100 MB vs 150 MB | fused 1.3-1.6x faster | bytes, and one launch fewer |
| v7 GEMM + bias + GELU, 1,024 x 768 x 3,072: separate vs epilogue | +50 MB vs +0 | separate adds 60-100 us; epilogue adds under 10 | the two extra launches on the nsys timeline |
| `numerics`: one-pass variance on the stress row | | NaN or an error of 10^3x and more; two-pass and Welford pass | the printed variances side by side (cudasim gives 8 and 16 against 0.0033) |

## What the columns mean

- **us**: median of 20 runs (CUDA events, `../common/bench.h`); v1 is timed
  with 5, it is slow.
- **MB**: the ideal bytes, every input read once and every output written
  once (softmax and layernorm: rows x length x 8). Real traffic is higher
  for the multi-pass kernels; `make ncu-table` shows `dram__bytes`.
- **x ideal**: time against the ideal bytes at 590 GB/s, chapter 6's
  practical ceiling (88% of 672).
- **extra (us)** in `epilogue bench`: the pipeline's time minus the plain
  GEMM's: what bias, GELU and the residual cost on top of the matmul.

## Checked how

Every program's `test` mode passes on cudasim (`dev/cudasim`, the course's
CPU correctness simulator) and has been seen to fail with a planted bug.
Under cudasim (or with `--small`) `epilogue test` runs M = 128 rows instead
of 1,024; the other shapes are the ones above. **None of this has run on a
GPU yet**: the bench numbers are yours to produce.

## If something goes wrong

- `make ARCH=sm_89 NVCC=/usr/local/cuda/bin/nvcc` for another GPU or toolkit
  path; `make clean` first when you change `ARCH`.
- Register spills: `make` prints `-Xptxas -v` lines. `softmax_warp_reg<2048>`
  holds 64 floats per lane and the layernorm register kernels 24; all
  should show 0 bytes of spill stores. If one spills, say so: section 5's
  argument assumes the row stays in registers.
- `ncu` stops with `ERR_NVGPUCTRPERM`: turn on the Windows-side performance
  counter switch (chapter 1, lab 4). Metric names drift between Nsight
  Compute versions: `ncu --query-metrics --chip gb205 | grep <part of the name>`.
- `make nsys` without NVTX headers still runs; the ranges are then missing
  and only `cuda_gpu_kern_sum` is useful.
