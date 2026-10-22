# Lab 09 — Naive attention: three kernels, three ways, and the cost of S

Chapter 10 of the course. One program, `attention`, runs causal self-attention
the straightforward way: scores `S = Q K^T / sqrt(D)` to a scratch buffer in
DRAM, a masked row softmax over `S` in place, then `O = P V`. It reads q, k, v
from a `qkv[B*T, 3C]` buffer in the engine's layout and writes `att[B*T, C]`.
The kernels are in `attn_naive.h` (header-only, so chapter 14's lab can
include it).

| version | scores | softmax | weighted sum |
|---|---|---|---|
| v1 naive | `attn_scores_naive`: one thread per score, mask written as `-INFINITY` | `softmax_warp_online`, rows as they are | `attn_pv_naive`: one thread per output, all `T` keys |
| v2 tiled | `attn_scores_tiled<false>`: chapter 7's 16 x 16 tiles, batch on `blockIdx.z` | same | `attn_pv_tiled<false>`: tiles, all `T` keys |
| v2 tiled + skip | `attn_scores_tiled<true>`: tiles above the diagonal return at once | rows truncated at the diagonal | `attn_pv_tiled<true>`: stops at the diagonal tile |
| v3 cuBLAS | `cublasSgemmStridedBatched`, the 12 heads as the batch | the softmax applies the mask | `cublasSgemmStridedBatched` |

`softmax_warp_online` is lab 8's v3 (one warp per row, the online `(m, d)`
pair, two passes), with a guard for `-INFINITY` inputs and a `mask` argument:
`MASK_NONE` (v1, v2), `MASK_CAUSAL` (v3: cuBLAS computed the whole square, so
entries `j > i` are treated as `-INFINITY` and written as 0) and
`MASK_TRUNCATED` (v2 + skip: only `j <= i` is read and written).

The engine-ready entry point has the contract's signature:

```cpp
size_t attn_prefill_naive_scratch_bytes(int B, int T, int H, int D);   // B*H*T*T*4
void   attn_prefill_naive(const float* qkv, float* att, int B, int T, int H, int D,
                          float* scratch, cudaStream_t s);              // = v2 + skip
```

It is the same algorithm as the engine's `attn_prefill_naive` in
`../gpt2/attention.cuh` (there the kernels are called `attn_scores`,
`attn_softmax_causal`, `attn_pv`, and the softmax takes three passes).
Do not include both headers in one program: they define the same function.

## Run

```sh
make test       # 7 shapes, 4 versions + the engine entry vs the CPU reference: all PASS
make bench      # T = 128 ... 4096: per-kernel us, S bytes, share, GB/s, TFLOPS
make waste      # full kernels vs tile skipping vs truncated softmax rows
make ncu-table  # DRAM bytes per kernel of the cuBLAS version at T = 1024
make bench8k    # optional: T = 8192, 3.2 GB of S
./attention bench --T 1024 --B 4    # stretch: does the time scale with B?
```

Before `make bench`, fill in the prediction table in chapter 10 section 10.
Paste back the `PASTE:` lines (one from `make test`, six from `make bench`,
two from `make waste`) and the text of `make ncu-table`.

## Predictions (chapter 10, section 10)

B = 1, H = 12, D = 64, FP32. Ranges from the byte counts; nothing here has
been measured yet.

| Measurement | Prediction | Why |
|---|---|---|
| S bytes printed at T = 1,024 / 4,096 | 50 MB / 805 MB | 12 · T² · 4 |
| naive scores at 1,024, time | 5–15x the 96 us roofline | lab 5's naive matmul behaviour: no reuse, long dependent loads |
| tiled scores at 1,024 | 1.5–3x the roofline | tiling fixes the input reuse; the output write stays |
| cuBLAS batched scores at 1,024 | 1.1–1.6x the roofline | memory-bound on the write of S; cuBLAS cannot beat the bytes |
| softmax share of the three attention kernels (cuBLAS version) | 35–50% | two passes over S of the four |
| time at 4,096 vs 1,024 (cuBLAS version) | 14–18x | T² bytes, with a little better efficiency at the larger size |
| `waste`: tile-skipping saving | 40–48% at 1,024, approaching 50% at 4,096 | section 6's tile count |
| attention's share of a full block at 1,024 (lab 9 vs lab 7 and lab 8 numbers) | 35–50% | section 5's table, scaled by the kernels' efficiencies |

## The cuBLAS calls, spelled out

cuBLAS is column-major. A row-major `[rows, cols]` matrix with leading
dimension `ld` is, to cuBLAS, a column-major `[cols, rows]` matrix with the
same `ld`: its transpose, for free (lab 6's `gemm.h` uses the same trick).
Head `h` of sequence `b` inside `qkv` is a row-major `[T, D]` matrix with
`ld = 3C`, and head `h + 1` starts `D` floats later: that is the batch stride.
One call per sequence `b`, `batchCount = H`.

Scores: we want row-major `S = scale · Q K^T` (`[T, T]`, `ld = T`). Ask cuBLAS
for its transpose, `S^T = K Q^T`, which it writes column-major, i.e. exactly
row-major `S`:

```cpp
// K_b = qkv + b*T*3C + C,  Q_b = qkv + b*T*3C,  S_b = S + b*H*T*T
cublasSgemmStridedBatched(h, CUBLAS_OP_T, CUBLAS_OP_N, T, T, D,
                          &scale, K_b, 3C, D,          // K, seen as [D, T]: OP_T makes it [T, D]
                                  Q_b, 3C, D,          // Q, seen as [D, T] = Q^T already
                          &zero,  S_b, T, (long long)T*T, H);
```

Weighted sum: we want row-major `O = P V` (`[T, D]`, written into `att` at
column `h·D`, `ld = C`). Ask for `O^T = V^T P^T`:

```cpp
// V_b = qkv + b*T*3C + 2C,  att_b = att + b*T*C
cublasSgemmStridedBatched(h, CUBLAS_OP_N, CUBLAS_OP_N, D, T, T,
                          &one,  V_b, 3C, D,           // V seen as [D, T] = V^T
                                 P_b, T, (long long)T*T, // P seen as [T, T] = P^T
                          &zero, att_b, C, D, H);      // O^T, column-major [D, T], ld C
```

Getting one flag wrong is the classic attention bug, and `make test` catches it
(swapping `CUBLAS_OP_T, CUBLAS_OP_N` in the scores call fails every shape).

## Reading the output

- `bench` times each kernel alone (median of 20 via `time_gpu`, 5 for the
  naive kernels at T >= 2,048) and the three together. GB/s uses the ideal
  bytes (scores: read Q, K + write S; softmax: 2 x S; PV: read S + V + write
  O); TFLOPS counts the full square, `2 B H T² D` per matmul, also for the
  skip version, so its TFLOPS reads high by up to 2x: that is the saving.
- `waste` compares v2 with v2 + skip kernel by kernel and prints the dead-tile
  count it is up against (section 6: 2,016 of 4,096 tiles at T = 1,024).
- `ncu-table`: add `dram__bytes_read.sum` and `dram__bytes_write.sum` over the
  three kernels and compare with 4 x S (201 MB at T = 1,024) plus about 13 MB
  for Q, K, V and O. At T = 1,024 part of S stays in the 48 MB L2 between
  kernels, so expect somewhat less than 4 x S; at T = 4,096 (S = 805 MB,
  far larger than L2) the count should be close to 4 x S:
  `ncu --metrics dram__bytes_read.sum,dram__bytes_write.sum ./attention profile cublas --T 4096`.

## Stretch

1. `./attention bench --T 1024 --B 4`: time and S bytes should both grow 4x.
2. Write `attn_decode_simple` (the engine's signature, chapter 11 contract):
   one block per (b, h), the new token's query row in registers, a loop over
   the cached keys with lab 8's online softmax, then the weighted sum of the
   cached values. Fill a `[B][H][T_max][D]` cache from this lab's `qkv`, and
   check it against `cpu_attention` for the last position. The engine's
   version is in `../gpt2/attention.cuh`, for comparison afterwards.

## Status

Checked for correctness on cudasim (the CPU simulator in `dev/cudasim`,
including a column-major `cublasSgemmStridedBatched`), never run on a GPU.
The `bench`, `waste` and `ncu-table` numbers are yours to produce.

## If something goes wrong

- `make ARCH=sm_89 NVCC=/usr/local/cuda/bin/nvcc` for another GPU or toolkit
  path; `make clean` first when you change `ARCH`.
- `cudaMalloc` fails at `--T 8192 --B 4`: that is 12.9 GB of S, more than the
  card has (chapter 10 section 5).
- Metric names drift between Nsight Compute versions:
  `ncu --query-metrics --chip gb205 | grep dram__bytes`.
