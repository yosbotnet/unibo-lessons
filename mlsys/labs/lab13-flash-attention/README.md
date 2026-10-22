# Lab 13 — FlashAttention 1 -> 2: three attention kernels

Chapter 14 of the course. One program, `flash.cu`, with three implementations of
causal (and non-causal) attention for every head of a batch, in the GPT-2 engine's
layout: `qkv [B*T, 3C]` (q | k | v, head `h` at columns `h*D ..` of each third),
output `[B*T, C]`. `D = 64` throughout.

| kernel | file | what it is |
|---|---|---|
| `naive` | `attn_naive.h` | chapter 10's three kernels: S = QK<sup>T</sup> for the full T x T square in DRAM, a row softmax in place, O = PV. The yardstick. |
| `flash_fp32` | `flash_fp32.h` | FlashAttention on the FP32 lanes: one thread per query row (Br = 64), K/V tiles of 64 rows in shared memory, the online-softmax merge of section 3 once per tile, causal tiles skipped. |
| `flash2_mma` | `flash2_mma.h` | FA2 on the tensor cores, section 7's listing: FP16 Q/K/V, FP32 accumulation, Br = Bc = D = 64, 4 warps of 16 rows, `mma.sync.m16n8k16` + `ldmatrix` (+ `.trans` for V) + `cp.async` double buffering; writes O in FP16 and the log-sum-exp L = m + log2(l). |

`ptx.h` holds the three inline-PTX wrappers (`mma_16816`, `ldmatrix_x4`,
`ldmatrix_x4_trans`) and `pack_half2`; it is the only inline assembly in the course.

**The engine kernel.** `flash_fp32.h` is engine-ready: `attn_prefill_flash(qkv, att, B, T, H, D, scratch, stream)`
and `attn_prefill_flash_scratch_bytes(B, T, H, D)` (it needs no scratch: 0) have the
signatures of the engine contract, so `labs/gpt2/attention.cuh` can include this header and
add one line to its table: `{"flash", attn_prefill_flash, attn_prefill_flash_scratch_bytes}`.
That is `./gpt2 --attn-prefill flash`. The engine call is always causal and needs D = 64
(GPT-2's head size; anything else stops with a message).

`naive` here is a minimal version written for this lab (16 x 16 shared-memory tiles for the
two products, a warp per row for the softmax, the full square computed); lab 9's
kernels were not finished when lab 13 was built. Swap them in if you want lab 9's numbers.

## Run

```sh
make               # read the -Xptxas -v line of flash2_mma_kernel: registers, 0 bytes spill expected
make test          # ptx self-test, then 3 kernels x 5 shapes x causal on/off: ALL PASS
make bench         # T = 1024, 2048, 4096, 8192; one PASTE line per T, plus the register line
make sass          # HMMA / LDSM / LDSM.MT88 (.trans) / LDGSTS / MUFU.EX2 / SHFL per kernel
make ncu           # flash2_mma at T = 4096: tensor pipe, L2 hit rate, stalls, occupancy
python3 sdpa.py    # optional, needs torch: PyTorch's scaled_dot_product_attention at the same shapes
```

Before `make bench`, fill in the prediction table of chapter 14 (section 10 and the lab box).
Paste back the `PASTE:` lines, the register line, and the output of `make sass`.

## What `test` checks

1. **ptx** (first, on its own): one warp loads a random 16 x 16 FP16 tile A and a 16 x 16 Bt
   with `ldmatrix_x4` using exactly the kernel's Q and K addressing, multiplies with two
   `mma_16816`, and compares with a plain loop (A Bt<sup>T</sup> + C); the same with V loaded by
   `ldmatrix_x4_trans` (A V + C); checks every register of the A fragment against the layout
   the chapter states; and checks that `ldmatrix_x4_trans` of V gives the same registers as
   `ldmatrix_x4` of V<sup>T</sup>. If any of this fails the kernels are not tested.
2. Shapes (B, H, T) = (1, 1, 64), (1, 2, 100), (2, 3, 257), (1, 12, 1024), (3, 4, 1030), causal on
   and off: T not a multiple of 64, several heads, batch > 1. Inputs: random in [-0.5, 0.5).
   Reference: three loops in double. Tolerances: `naive` and `flash_fp32` abs 1e-4 + rel 1e-4;
   `flash2_mma` abs 2e-2 + rel 2e-2 against a reference computed from the FP16-rounded inputs
   (P and O are FP16, as in lab 7), and its log-sum-exp within 1e-2 (log2 units).
   Outputs are pre-filled with NaN, so a row nobody wrote fails. A failure prints the kernel,
   the shape, the first bad (row, column) and the expected and actual values.

## Checked on cudasim, never run on a GPU

This lab was checked for correctness on the CPU simulator (`dev/cudasim`), not on a GPU:

```sh
dev/cudasim/run.sh mlsys/labs/lab13-flash-attention/flash.cu test        # from the repo root, ~25 min
dev/cudasim/run.sh mlsys/labs/lab13-flash-attention/flash.cu test quick  # ptx + the three small shapes, ~4 min
```

cudasim cannot execute inline PTX, so under `CUDASIM` (which the simulator defines) `ptx.h`
takes the three wrappers from `dev/cudasim/cudasim_ptx.h`, an emulation with the PTX ISA's
fragment layouts. A kernel that passes there has the right fragment and addressing logic; if
the emulation itself had a layout wrong, the ptx self-test on your GPU is what catches it,
which is why it runs first. Timings on cudasim are fake: only `test` means anything there.

## If something goes wrong

- **ptx fails on the GPU**: the wrappers or the layout assumptions are wrong for your toolkit
  or card; nothing after it can be trusted. Paste the three ptx lines.
- **Only causal fails**: the diagonal tile's mask or the loop bound (`n_tiles`). **Only T = 100,
  257, 1030 fail**: the edge block (rows or keys at or beyond T: zero-filled rows, keys masked).
- **Spills** in the `-Xptxas -v` line of `flash2_mma_kernel`: the chapter assumes none. Try
  `-maxrregcount` only to see what changes; the fix is fewer live fragments.
- **bench at T = 8192**: naive needs 3.2 GB for S (12 heads, in place); if that allocation
  fails it is skipped with a note.
- `make ARCH=sm_89 NVCC=/usr/local/cuda/bin/nvcc` for another GPU or toolkit; `make clean` first.

## Stretch (chapter 14's box)

- Br = 128 with 8 warps; three K/V stages; D = 128 (Llama's head size). The widget in section 6
  predicts shared memory and registers for each.
- The Q blocks of a head already launch longest first (`qblk = gridDim.x - 1 - blockIdx.x`), as
  FA2 does: flip it back to `qblk = blockIdx.x` and measure the causal tail at T = 2048.
