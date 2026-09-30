# Lab 01 — Warps and occupancy

Companion to chapter 2 (*The execution model*). Make the predictions in the chapter **before** running.

```sh
make          # build (read the ptxas lines: registers and spills per kernel)
make test     # every kernel checked against a CPU reference: all must PASS
make bench    # A: divergence · B: block-size sweep · C: occupancy knob · D: registers vs occupancy
```

Then **paste the `PASTE:` lines back** (two from `make test`, two from `make bench`).

- `divergence` — five ways to split two arithmetic paths among the threads of a warp.
- `occupancy` — the same vector add at different block sizes and forced occupancies, with 1 and 4
  elements per thread; and a register-hungry kernel compiled free vs capped with `__launch_bounds__`.

Same prerequisites and overrides as lab 00 (`make ARCH=... NVCC=...`; `make clean` before changing `ARCH`).
`make bench` needs about 1 GB of free VRAM.
