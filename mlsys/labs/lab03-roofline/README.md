# Lab 03 — The roofline of your GPU

Chapter 4 of the course: <https://notes.ybc.sh/mlsys/cap-04-roofline.html>

## Prerequisites

Same as lab 0: WSL2 (Ubuntu) with the CUDA toolkit **12.8 or newer** installed from NVIDIA's
WSL-Ubuntu repository, the NVIDIA driver installed on **Windows only**, and this repository
cloned inside the Linux filesystem (`~/...`, not `/mnt/c/...`).

## Run

```sh
make          # build roofline and overhead (ptxas prints registers per kernel)
make test     # every dial kernel vs a CPU reference, the tensor-core tile, the launch counters
make bench    # A intensity dial · B tensor-core peak · C launch overhead
```

Experiment A allocates 512 MB of VRAM; close games and video first, since under WSL2 the
Windows desktop shares the GPU. Then **paste the `PASTE:` lines back** (two from `make test`,
three from `make bench`).

If `nvcc` is not on your `PATH`, or your GPU is not an RTX 50xx:

```sh
make ARCH=sm_89 NVCC=/usr/local/cuda/bin/nvcc
```

`make clean` removes the binaries (run it before rebuilding with a different `ARCH`).
