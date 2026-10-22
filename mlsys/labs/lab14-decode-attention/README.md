# Lab 14 — Decode attention: split-K, FlashDecoding, KV-cache kernels

Chapter 15 of the course. One program, `decode.cu`, that computes one decode step of attention:
for every sequence `b` and head `h`, the new token's query row against the `T_ctx` cached keys
and values. The cache has the engine's layout, `[B][H][T_max][D]` FP32 (position `p` of
`(b, h)` at `((b*H + h)*T_max + p)*D`), and `D = 64` everywhere.

| kernel | file | idea | grid |
|---|---|---|---|
| `kv_append` | `kv_cache.h` | the new tokens' k, v from the `qkv` row (columns `C + h*D`, `2C + h*D`) into the cache | (B*T_new, H) |
| `decode_v1_twopass` | `decode_kernels.h` | one block per (b, h): a max pass, then an exp pass (K read twice) | B*H |
| `decode_v2_online` | | one block per (b, h), one pass with a running (m, l, O~) per half-warp | B*H |
| `decode_v3_split` + `decode_combine` | | split-K (FlashDecoding): S blocks per (b, h), partials, a second kernel merges | (B*H, S) + B*H |
| `decode_v3b_lastblock` | | v3 with the merge done by the last block to finish: `atomicAdd` ticket + `__threadfence` | (B*H, S) |
| `decode_v4_half` | | FP16 cache, 8 halves per 16-byte load, 8 lanes per key, FP32 arithmetic | (B*H, S) |
| `decode_v5_gqa` | | grouped-query attention: one K/V read serves the g query heads of a group | (B*H_kv, S) |
| `decode_v6_cluster` | | optional, sm_90+: a cluster of 8 splits merges through distributed shared memory | (8, B*H) |

Every kernel uses 128 threads (4 warps). A key row is 64 floats = 256 bytes, read by a half-warp
as 16 `float4` loads (FP16: by 8 lanes as 8 `uint4` loads of 8 halves); the score is summed by
`__shfl_xor_sync` with 8, 4, 2, 1 (FP16: 4, 2, 1). Each half-warp issues the loads of 4 keys
(`DEC_UNROLL = 4`: 128 bytes per lane) before using any of them. The number of splits is
`choose_splits(B, H, T_ctx)` from section 3 of the chapter: about 4 blocks per SM, at least 256
keys per chunk.

`decode_engine.h` holds the engine-ready version, with the contract's signatures:

```cpp
size_t attn_decode_split_scratch_bytes(int B, int T_ctx, int H, int D);   // B*H*64*(D+2)*4 bytes
void attn_decode_split(const float* qkv, const float* k_cache, const float* v_cache, float* att,
                       int B, int H, int D, int T_ctx, int T_max, float* scratch, cudaStream_t s);
```

It launches `decode_v3_split<64>` and, when S > 1, `decode_combine<64>` on stream `s`
(with S = 1 the split kernel writes `att` directly). It includes only `decode_kernels.h`, not
`kv_cache.h`, so the engine's own `kv_append` does not clash. In the engine it is
`--attn-decode split`.

## Run

```sh
make               # registers per kernel (-Xptxas -v); v6_cluster only if ARCH >= sm_90
make test          # kv_append, then every kernel vs a double CPU reference: ALL PASS
make bench         # B = 1, 4, 16 x T = 1k, 4k, 16k, 32k: us, GB/s, % of 672, splits chosen
make nofence       # the fence experiment: v3b with and without __threadfence, 200 runs each
make ragged        # the stretch's starting point: B = 4, T_ctx = 512, 2k, 4k, 32k in one launch
make ncu           # v2 vs v3 at B = 1, T = 4k: Speed of Light, Occupancy, Warp State Statistics
make sass          # LDG.E.128, SHFL.BFLY, ATOM/RED, MEMBAR per kernel
```

Before `make bench`, write down the predictions of the chapter's section 9 and the lab table of
section 10. Paste back:

- the `PASTE: lab14 test ALL PASS` line;
- the twelve `PASTE: decode B=.. T=..` lines and the `PASTE: v6_cluster ran|skipped (...)` line
  of `make bench` (the only test of thread block clusters on your card in this course);
- the two lines of `make nofence` (`PASTE: fenced failures=0/200` and
  `PASTE: nofence failures=N/200`; N = 0 is a possible and honest result);
- the output of `make sass` and the Speed of Light / Occupancy sections of `make ncu`.

## What the test checks

- `kv_append`: B = 2, H = 3, T_max = 16; one token at position 6 and five at positions 10..14,
  every element of both caches compared with the expected copy (the rest keeps its sentinel).
- Every kernel at (B, H, T_ctx, T_max) = (1, 1, 1, 8), (1, 2, 7, 16), (2, 3, 100, 128),
  (1, 12, 1000, 1024), (3, 4, 4097, 4608). The cache is random in [-1, 1] below the new token, the
  new token's k and v enter through `kv_append`, and every slot at or past `T_ctx` holds NaN, so a
  kernel that reads past the context fails. Outputs start as NaN, so an unwritten one fails too.
- v3 with the automatic S and with S = 2, 3, 7, 64 (S = 64 at small T leaves most blocks with no
  keys: they write m = -inf, l = 0, which the combine weighs by exp(-inf) = 0); the engine wrapper;
  v3b with the automatic S and S = 7, and its counters back at zero afterwards; v4 against the
  reference on the FP16-rounded cache (tolerance 2e-3); v5 with 12 query heads over 3 kv heads
  (g = 4) at every T, plus g = 1 and g = 8; v3 on a ragged batch (T_ctx = 5, 40, 100, 300).
- FP32 tolerance: |got - ref| <= 1e-4 + 1e-4 |ref|, against a double-precision reference.

`make test` passes on cudasim, the course's CPU simulator (`dev/cudasim/run.sh decode.cu test`).
cudasim runs blocks one after another, so v3b's last block is simply the last block launched and
the fence experiment cannot fail there: it is meaningful only on the GPU. v6 is compiled out under
cudasim (no clusters). **Nothing here has run on a GPU yet**: the bench numbers in the chapter are
a bytes-in-flight model until you paste yours.

## If something goes wrong

- Spills: v5 with g = 8 holds 8 query rows and 8 running states per lane; `-Xptxas -v` should
  show it under 255 registers with no spill stores. If it spills, say so.
- `v6_cluster skipped (...)`: the reason is printed. "built for ARCH below sm_90" means the build
  was not for your card; "says 0 clusters of 8 fit" or a launch error means the driver refused the
  cluster on this GPU, which is an answer too.
- `make ARCH=sm_89 NVCC=/usr/local/cuda/bin/nvcc` for another GPU or toolkit path; `make clean`
  first when you change `ARCH`.
- B = 16, T = 32k needs 3.2 GB of FP32 cache plus its FP16 copy and the GQA cache; if it does not
  fit, the bench prints a note and skips that shape.
