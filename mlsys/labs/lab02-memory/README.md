# Lab 02 — The memory hierarchy

Four experiments from chapter 3. Write your predictions down before running.

| Program     | Experiment | What it measures |
|-------------|------------|------------------|
| `latency`   | A | latency of one load: shared memory, then global memory for working sets of 4 KB … 512 MB (pointer chasing) |
| `access`    | B1 | useful bandwidth of strided reads, stride 1 … 32 |
|             | B2 | a copy shifted by 0 … 32 floats (misalignment) |
|             | C  | a copy with a fixed number of threads: float vs float4 vs 4× ILP, at 17% and 100% occupancy |
| `transpose` | D | 8192×8192 transpose: naive, shared tile, padded tile, against a copy |

## Run (WSL2 / Linux)

```sh
cd ~/unibo-lessons/mlsys/labs/lab02-memory   # keep the repo inside the WSL filesystem
make          # ptxas lines: note the transpose kernels' shared memory (4096 vs 4224 bytes)
make test     # every kernel against a CPU reference: all PASS
make bench    # ~1 minute; needs ~4.3 GB of free VRAM for experiment B1
```

Then paste every `PASTE:` line back (3 from `make test`, 5 from `make bench`).

Close other GPU-heavy programs (games, browsers with video) while benchmarking: on
WSL2 the Windows desktop shares the GPU.

If `nvcc` is not on your `PATH`, or your GPU is not an RTX 50xx:

```sh
make clean && make ARCH=sm_89 NVCC=/usr/local/cuda/bin/nvcc
```
