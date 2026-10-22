# Lab 10 - the GPT-2 engine

Chapter 11 of the course (`cap-11-gpt2-forward-pass.html`); chapters 13, 14 and 15
add measurements and attention implementations to it. GPT-2 small (124 M
parameters) in FP32 CUDA, checked against a double-precision CPU forward and
against PyTorch's logits.

**Status: checked for correctness on cudasim (`./gpt2 test`, and `make e2e`'s
verify on the tiny model), never run on a GPU.** The real-weight verification,
the upload rates and every timing are predictions until you run them.

## Files

| file | what it is |
|---|---|
| `gpt2.cu` | the engine: options, memory plan (`engine_init`), `forward()`, sampling, weight loading three ways, every mode |
| `model.h` | shapes, the tensor order inside one flat FP32 buffer, the weight-file header, the token-bytes file |
| `kernels.cuh` | embed, layernorm (lab 5), `add_bias`, `bias_gelu`, `gather_last_rows`, `sgemm_epi` (lab 7's v7 with fused epilogues), `gemv_epi` (M <= 8), `linear()`, `lm_head()`, `transpose` |
| `attention.cuh` | `kv_append`, naive prefill attention (`attn_scores`, `attn_softmax_causal`, `attn_pv`), `attn_decode_simple`, the two implementation tables |
| `sample.cuh` | `float_key`, `block_inclusive_scan`, `argmax_rows`, `sample_rows` (radix select, shared-memory histogram, scan, draw) |
| `cpu_ref.h` | the double-precision CPU forward that `test` checks against |
| `export.py` | stdlib only: HF `model.safetensors` -> `gpt2_124M.bin`, `vocab.json` -> `gpt2_tokens.bin` (byte ranges copied, never parsed) |
| `reference.py` | `ref_logits.bin` for a fixed prompt: PyTorch (`transformers`) if installed, else a numpy forward |
| `prompt.py` | text -> token ids with `tiktoken` (or the `transformers` tokenizer) |
| `make_tiny.py` | a random 2-layer GPT-2 in Hugging Face's file format, tensors shuffled, for `make e2e` |

## Run order

```sh
make                 # builds ./gpt2; read the -Xptxas -v lines (registers, spills)
make test            # random small models vs the CPU reference, both backends, sampling: ALL PASS
make e2e             # tiny fake model: make_tiny.py -> export.py -> reference.py --numpy -> ./gpt2 verify (needs numpy)
make export          # downloads model.safetensors, config.json, vocab.json (548 MB) to hf/small once,
                     #   writes gpt2_124M.bin and gpt2_tokens.bin
make reference       # ref_logits.bin (PyTorch if installed, else numpy reading hf/small/model.safetensors)
make verify          # the real weights vs the reference, --linear cublas then --linear own: PASS + max error
make generate        # prompt.txt (from prompt.py): greedy, then --temp 0.8 --topk 40
make bench           # upload pageable / pinned / overlap; forward vs T; where the time goes; both backends
make nsys            # profile: prefill of 256 tokens + 16 decode steps, with and without the cache
make bench-prefill   # chapter 13 (lab 12): time to first token vs B and T, PASTE lines with the roofline prediction
make bench-decode    # chapter 13 (lab 12): time per output token vs B and context, PASTE lines
```

`make ARCH=sm_89 NVCC=/usr/local/cuda/bin/nvcc` for another GPU or toolkit.
`bench-prefill` and `bench-decode` run on random GPT-2 small weights when
`gpt2_124M.bin` is absent (timings do not depend on the values).

Before `make bench`, write down the predictions below. Paste back the `PASTE:`
lines of `test`, `verify` (one per backend) and `bench` (one per backend), and
the kernel table that `make nsys` prints; the `bench-prefill` / `bench-decode`
lines go to chapter 13.

### Modes and options

```
./gpt2 test | verify | generate | bench | bench-prefill | bench-decode | profile [options]
  --weights F (gpt2_124M.bin)  --tokens F (gpt2_tokens.bin)  --ref F (ref_logits.bin)
  --linear cublas|own          --attn-prefill naive|flash    --attn-decode simple|split
  --prompt F  --n 64  --temp 1.0 (0 = greedy)  --topk 40 (0 = all)  --seed 1  --B 1  --no-cache
  --B 1,4,16 --T 128,1024      the grid of bench-prefill / bench-decode
  --dump L                     verify: write x after layer L to dump_L.bin, compare with dump_L_ref.bin
```

Script options: `export.py --model DIR` (use files already in DIR), `--size
medium|large|xl`, `--out F --tokens-out F`; `reference.py --numpy`, `--ids F`,
`--model DIR` (default `hf/small`), `--out F`, `--dump L`.

## File formats (from `model.h`)

`gpt2_124M.bin` = a header of 256 int32, then every tensor, FP32, row-major:

```
header  [0] magic 20261022  [1] version 1  [2] L  [3] C  [4] H  [5] V  [6] T_max
        [7] number of floats that follow (low 32 bits)  [8] (high 32 bits)  [9..255] zero
wte   [V, C]          token embedding; also the LM head (tied weights)
wpe   [T_max, C]      learned position embedding
for each of the L layers:
  ln1_g, ln1_b  [C]
  qkv_w [C, 3C]  qkv_b [3C]    HF attn.c_attn: columns q | k | v, head h at h*D .. h*D+D-1 in each
  prj_w [C, C]   prj_b [C]     HF attn.c_proj
  ln2_g, ln2_b  [C]
  fc_w  [C, 4C]  fc_b  [4C]    HF mlp.c_fc
  fc2_w [4C, C]  fc2_b [C]     HF mlp.c_proj
lnf_g, lnf_b  [C]
```

Linear weights are [in, out] (HF's Conv1D layout), so every linear layer is
`y = x W + b` with no transpose. GPT-2 small: 124,439,808 floats, 497.8 MB, of
which each layer is 28.35 MB. The loader refuses a header whose float count
does not match the shape.

`gpt2_tokens.bin` = int32 magic 20261022, int32 V, then for each id a uint8
length and that many bytes (only for printing text).

`ref_logits.bin` = int32 magic 20261022, int32 T, int32 V, then T int32 token
ids, then T x V float32 logits.

`dump_L.bin` / `dump_L_ref.bin` = the residual stream x after layer L (0-based)
of the full forward, T x C float32, no header.

## Checking

| mode | reference | passes when |
|---|---|---|
| `test` | `cpu_ref.h`, double precision, on random models (L = 1-2, C = 64-128, odd T, B = 1-3) | every logit within 2e-4 absolute + 2e-4 relative, both backends: full forward, prefill into the cache, decode one token at a time; greedy tokens identical with and without the cache (B = 1 case); argmax and top-k sampling (k = 1, 40, all) on 50,257 random logits |
| `verify` | `reference.py`'s logits for the real weights | max abs logit error < 1e-2 and top-1 agreeing at every position, for the full forward and for prefill + decode |

`reference.py`'s numpy path reads `model.safetensors` itself, not
`gpt2_124M.bin`, so a mistake in `export.py` cannot hide by being made on both
sides. `make e2e` checks exactly that pipeline on a tiny model whose
safetensors file stores the tensors in a shuffled order.

### Debugging a mismatch (chapter 11, section 6)

Bisect by layer: `python3 reference.py --dump L` then `./gpt2 verify --dump L`
prints the largest difference of x after layer L; find the first layer that
diverges, then look inside it.

| fingerprint | usual cause |
|---|---|
| wrong from the embedding on, everything garbage | tensor order or offsets in the export; header count mismatch (the loader checks it) |
| every position wrong by a lot, first layer | a transposed weight: cuBLAS flags or leading dimensions in the row-major trick |
| position 0 right, later positions wrong | attention: head column offsets (h*D inside each third), the key third at +C, the scale, or the mask off by one (query sees j <= i) |
| wrong by a few percent everywhere | exact GELU instead of the tanh form (HF's `gelu_new`), or epsilon in the layernorm |
| full forward right, decode wrong | position embedding not offset by `pos0`, or the cache written at the wrong position (`pos0 + t`) |
| right up to the last layernorm, logits wrong | the LM head's transpose, or reading a separate head matrix that the checkpoint does not have |
| right at small T, NaN at large T | a softmax without the max subtraction, or scratch sized for the wrong T |

## Predictions (chapter 11, section 9): write yours down first

| measurement | prediction | why |
|---|---|---|
| `test` | all PASS, max error 1e-6 to 1e-5 on random models | FP32 rounding across 1-2 small layers |
| `verify`, max logit error | 1e-3 to 1e-2, top-1 at every position | two FP32 pipelines with different summation orders over 12 layers |
| upload: pageable / pinned / overlap | 5-12 / 20-50 / limited by `fread` GB/s | the staging copy; PCIe 5.0 x16; the page cache |
| forward at T = 1,024, cuBLAS backend | 12-20 ms | a roofline floor of about 10.8 ms: chapter 10's 13.1 ms less 2.3 ms of LM head, since `bench` computes one logit row (0.26 ms, not 2.6); kernels at 60-90% of their roofs, naive attention worst |
| forward at T = 64 | 1.5-3 ms, not 1/16 of the above | the launch floor: 160 launches at a few us |
| own backend vs cuBLAS at T = 1,024 | 1.1-1.5x slower | v7 at 70-90% of cuBLAS (chapter 8), epilogues fused |
| own backend vs cuBLAS at T = 64 | close, or faster | about 50 fewer launches; the GEMV path for M <= 8 does not apply here |
| where the time goes at 1,024; at 64 | linear 40-60%, attention 30-55%, head 2-4%, the rest under 5%; at 64: linear 55-80%, head 15-30%, attention 5-10%, the rest under 10% | chapter 10's table with one logit row, scaled by the kernels' efficiencies; at 64 the head still reads its 154 MB, the linear layers turn into weight reads, and launches weigh |
| `generate --no-cache`, ms per token after a 256-token prompt | tens of ms, growing | a full forward per token |
| `generate` with the cache | 1.5-3 ms per token | 1 ms of weight reads plus the floor; chapter 13 measures it properly |

### Kernel launches, counted from the code

Per layer (cuBLAS's own internal kernels not counted; it may add a split-K
reduction for some shapes):

| pass | cuBLAS backend | own backend |
|---|---|---|
| no cache (`bench`, `generate --no-cache`) | 13: layernorm, SGEMM + `add_bias`, 3 attention, SGEMM + `add_bias`, layernorm, SGEMM + `bias_gelu`, SGEMM + `add_bias` | 9: layernorm, `sgemm_epi`, 3 attention, `sgemm_epi`, layernorm, 2 `sgemm_epi` |
| prefill into the cache | 14 (+ `kv_append`) | 10 |
| decode step (one token) | 12: `kv_append` + 1 decode attention kernel instead of 3 | 8 (`gemv_epi` for the linears) |

Plus embed, final layernorm, `gather_last_rows` and the LM head (4), and one
sampling kernel (`argmax_rows` or `sample_rows`): a pass without the cache is
160 launches (cuBLAS) or 112 (own); a decode step 148 or 100, plus the sampler.

## Notes

- Every MB the engine prints is 10^6 bytes, as in the chapters.
- `attn_decode_simple` keeps the scores in shared memory: T_ctx <= 1,024
  (`DEC_MAXT`) and D <= 128 dividing 128 (it stops with a message otherwise).
  GPT-2's context is 1,024; chapter
  15's split-K kernel lifts the limit.
- The `own` backend allocates a transposed copy of `wte` (154 MB for GPT-2
  small) for the LM head.
- New attention implementations: one function with the contract's signature,
  one scratch-size function, one line in `PREFILL_IMPLS` / `DECODE_IMPLS` in
  `attention.cuh`; select with `--attn-prefill` / `--attn-decode`.
- `flash` (chapter 14) and `split` (chapter 15) come from labs 13 and 14,
  included by `attention.cuh`; both need D = 64 (GPT-2's heads). `make test`
  runs a D = 64 model through both, and through `naive` + `simple`.
- Buffers are carved from one arena, each padded to 256 bytes as a cudaMalloc
  of its own would be: the float4 loads of the split-K kernel need 16-byte
  aligned rows, and an odd vocabulary size would otherwise misalign the cache.
