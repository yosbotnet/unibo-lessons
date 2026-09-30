# Lab 04 — Profiling: reductions, launch gaps, transposes under ncu

Chapter 5 of the course. Run everything inside WSL2, with the repo in `~/`
(not `/mnt/c/`). Profiling needs the Windows-side switch from chapter 1:
NVIDIA Control Panel → Developer → Manage GPU Performance Counters →
allow access to all users. Without it `ncu` stops with `ERR_NVGPUCTRPERM`.

## Run

```sh
make test          # v1..v6 and CUB, int (exact) and float (tolerance); graph demo
make bench         # GB/s of every reduction; launch overhead three ways
make nsys          # timeline of the launch-gap demo -> reports/graphs.nsys-rep
make ncu-table     # the chapter's key metrics for every reduction, as text
make ncu           # full Nsight Compute report -> reports/reduce.ncu-rep
make ncu KERNEL=reduce_v3          # only kernels matching the name
make ncu-transpose # lab 2's transposes: sectors/request, shared wavefronts, conflicts
```

Open the `.nsys-rep` / `.ncu-rep` files with the Nsight Systems and Nsight
Compute GUIs installed on Windows. Windows sees the WSL files at
`\\wsl$\Ubuntu-24.04\home\<you>\...`.

Paste back the `PASTE:` lines (two from `make test`, two from `make bench`)
and the text output of `make ncu-table` and `make ncu-transpose`.

## If something goes wrong

- `nsys` or `ncu` not found: they ship with the CUDA toolkit, usually in
  `/usr/local/cuda/bin` (`ncu`) and `/usr/local/cuda/bin` or
  `/opt/nvidia/nsight-systems/.../bin` (`nsys`). Pass the path:
  `make nsys NSYS=/path/to/nsys`.
- The timeline looks wrong under WSL2 (GPU work drawn before the launch that
  caused it): NVIDIA documented a timestamp problem on WSL for Nsight Systems
  2025.x. The workaround from their release notes:
  `mkdir -p "$(dirname "$(nsys -z)")"; echo 'CuptiUseRawGpuTimestamps=false' >> "$(nsys -z)"`
- `make ARCH=sm_89 NVCC=/usr/local/cuda/bin/nvcc` for another GPU or toolkit
  path; `make clean` first when you change `ARCH`.
