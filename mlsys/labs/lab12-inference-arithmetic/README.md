# Lab 12 — Inference arithmetic: predicted against measured

Chapter 13 of the course: <https://notes.ybc.sh/mlsys/cap-13-inference-arithmetic.html>

Two halves. `arith.py` (Python standard library only) is the chapter's calculator as a
script: for a model, a GPU, a weight and a cache format, a batch, a prompt and an output
length, it prints every quantity of sections 2 to 9 (parameters, weights, cache per token,
memory and the largest batch, prefill FLOPs, bytes and TTFT, decode steps and TPOT,
tokens/s, request latency, the crossovers), as the roof or at a chosen efficiency. It is
the same model as the chapter's two widgets, digit for digit. The second half runs
chapter 11's engine (`../gpt2`) in its two benchmark modes and puts the measurements next
to the predictions.

Status: `arith.py --selftest` and `compare.py --selftest` pass; the engine's
`bench-prefill` and `bench-decode` modes were checked on cudasim (a CPU simulator) for
"runs and prints lines of the right shape" on a tiny model. Nothing here has been run on
a GPU: every time is a prediction until you run it.

## Prerequisites

The arithmetic needs only `python3`. The benchmarks need what lab 10 needs: WSL2
(Ubuntu) with the CUDA toolkit 12.8 or newer, cuBLAS, and the engine built in `../gpt2`
(`make` here builds it for you). With `../gpt2/gpt2_124M.bin` present (`make -C ../gpt2
export`) the engine uses the real weights, otherwise random GPT-2 small weights: the
timings are the same.

## Run

```sh
python3 arith.py --model gpt2-small --gpu rtx5070 --dtype fp32 --kv fp32 --batch 1 --prompt 896 --out 128
python3 arith.py --model llama-3-8b --gpu h100 --dtype fp16 --batch 64 --prompt 2048 --out 256   # section 9
make bench-prefill    # the engine: TTFT at T = 128, 256, 512, 1024, B = 1 and 4; predicted beside measured
make bench-decode     # TPOT at t = 128 .. 1024 and B = 1, 4, 16, 64; bytes, effective GB/s, cache memory
make compare          # reads both outputs and prints achieved fractions of the roofs
```

More of `arith.py`:

```sh
python3 arith.py --table                       # section 5's table: B = 1, 4, 16, 64, 128 at t = 1,024
python3 arith.py ... --eff 0.88                # achieved bandwidth and peak (lab 0's 88 %)
python3 arith.py ... --floor 3e-6              # a launch floor: 148 kernels x 3 us per decode step (12 L + 4)
python3 arith.py ... --floor 3e-6 --graph      # the same floor in a CUDA graph: 0.5 us per kernel
python3 arith.py ... --launches 120            # your own kernel count per decode step
python3 arith.py ... --json                    # every readout as JSON
make selftest                                  # the chapter's numbers, asserted: PASTE: lab12 selftest ALL PASS
make test                                      # selftest + compare.py's own test
```

Models: `gpt2-small`, `gpt2-medium`, `gpt2-xl`, `llama-3.2-1b`, `llama-3-8b`. GPUs:
`rtx5070`, `h100`. Weight formats `fp32 fp16 fp8 int4`; cache formats `fp32 fp16 fp8`.

The grids of the benchmark modes can be changed from the command line:

```sh
make bench-decode DECODE_ARGS="--B 1,8,32 --T 256,1024"
make bench-prefill PREFILL_ARGS="--B 1 --T 64,128,256,512,768,1024"
```

## What the engine measures

- `bench-prefill`: one forward pass of B prompts of T random tokens into the KV cache,
  last-token logits; 3 warm-ups, median of 10, CUDA events. Each line carries the
  engine's own roof (the same formulas as `arith.py`, with the peak from the clock it
  queries).
- `bench-decode`: one decode step for B sequences at context t. The cache is filled with
  random values (not by a prefill), and the same step is timed 20 times with the position
  held fixed (median). The timed step includes the copy of the token ids in and the
  greedy pick out (argmax kernel and copy back). `attn_ms` times the decode-attention
  kernels of all 12 layers alone over the same cache, and `attn_gbs` is the cache bytes
  read divided by that time. `cache_mb` is the cache the engine allocated (B x T_max x
  73,728 B, with T_max the largest t of the run); the `engine memory (cudaMemGetInfo)` line
  is the same allocation measured, without the weights.
- There is no CUDA-graph option: capturing a step is the chapter's stretch.

## Predictions (write yours down first)

| Step | Prediction |
|---|---|
| `bench-prefill`: TTFT at T = 1,024, B = 1 | 6.3 ms at the roof (the LM head runs once, on the last position); measured 11-17 ms (FP32 cuBLAS at 60-85% of peak, naive attention computing the masked half and moving 2.6 GB of scores, small kernels between) |
| `bench-prefill`: TTFT vs T | nearly linear in T from 256 up; below that, the launch floor flattens it |
| `bench-decode`: TPOT at B = 1, t = 1,024 | 0.85 ms at the roof, 0.97 at lab 0's bandwidth; measured 1.3-2 ms without graphs (the launch floor), the engine's `profile` mode saying where |
| `bench-decode`: TPOT vs t at B = 1 | flat to within 10% from 128 to 1,024 (the cache is 15% of the bytes at most) |
| `bench-decode`: TPOT vs B at t = 1,024 | section 5's column, plus a constant; the cache overtakes the weights near B = 7; effective GB/s of the attention kernel well below 590 at small B (section 7: chapter 15's problem) |
| `bench-decode`: memory at B = 64 | 4.8 GB of cache reported (`cache_mb`, and the `cudaMemGetInfo` line), plus the 0.5 GB of weights: section 5's 5.3 GB |
| `compare`: achieved fraction of the roof | prefill 35-60%; decode 40-70% at B = 1 rising with B, and the attention kernel the weakest line |

## Paste back

The two `arith.py` outputs, the `PASTE:` lines of both bench modes and the `compare` table:

```
PASTE: prefill B= T= ms= gflop= tflops= pred_roof_ms= frac=
PASTE: decode B= t= ms= bytes_w= bytes_kv= pred_roof_ms= frac= attn_ms= attn_gbs= cache_mb=
PASTE: lab12 compare prefill_B1_T1024= decode_B1_t1024= decode_B64_t1024= attn_gbs_B1_t1024=
```

## Files

- `arith.py` — the model (`MODELS`, `GPUS`, `params`, `kv_bytes_per_token`, `Setup.prefill`,
  `Setup.decode_step`, `estimate`) and its CLI; `--selftest` asserts the chapter's numbers.
- `compare.py` — parses the engine's `PASTE:` lines and prints measured against predicted.
- `testdata/` — the engine's output on cudasim (tiny model, fake timings), for `compare.py --selftest`.
- `Makefile` — `selftest`, `test`, `bench-prefill`, `bench-decode`, `bench`, `compare`, `clean`.
