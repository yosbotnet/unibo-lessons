# Lab 00 — Meet your GPU

## Prerequisites

- An NVIDIA GPU and a driver recent enough for your CUDA toolkit (`nvidia-smi` must work;
  on WSL2 install the driver on Windows, not inside Linux).
- CUDA toolkit **12.8 or newer** (`nvcc --version`): it is the first release that supports
  `sm_120` (RTX 50xx).
- GNU make (Linux or WSL2).

## Run

```sh
make          # build devquery and vecadd (ptxas prints the registers each kernel uses)
make test     # correctness check of vecadd: every size must say PASS
make bench    # device info + vecadd benchmark
```

Then **paste the `PASTE:` lines back** (one from `make test`, two from `make bench`).

If `nvcc` is not on your `PATH`, or your GPU is not an RTX 50xx, override the defaults, e.g.:

```sh
make ARCH=sm_89 NVCC=/usr/local/cuda/bin/nvcc
```

`make clean` removes the binaries (run it before rebuilding with a different `ARCH`).
