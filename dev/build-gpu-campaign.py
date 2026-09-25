#!/usr/bin/env python3
"""Build play/gpu/campaign.ipynb from the kernel sources in play/gpu/kernels/.

Usage: python3 dev/build-gpu-campaign.py   (needs the nbformat package)
The notebook runs on any CUDA GPU with CuPy: Google Colab (Runtime > Change runtime type > GPU)
or a local Jupyter with `pip install cupy-cuda12x`.
"""
from pathlib import Path
import nbformat as nbf

ROOT = Path(__file__).resolve().parent.parent
K = ROOT / 'play' / 'gpu' / 'kernels'
OUT = ROOT / 'play' / 'gpu' / 'campaign.ipynb'
SITE = 'https://notes.ybc.sh/play/gpu/'

naive = (K / 'naive.cu').read_text()
coalesced = (K / 'coalesced.cu').read_text()
tiled = (K / 'tiled.cu').read_text()

level1_challenge = naive.replace('matmul_naive', 'matmul_mine').replace(
    '// Level 1, as given: one thread per output element of C = A x B (N x N, row-major).',
    '// Level 1, your move: change which index follows threadIdx.x so a warp reads contiguous memory.')
level2_challenge = '''// Level 2, your move: fill in the three TODOs. The skeleton compiles as is but gives wrong results.
#define TILE 32
extern "C" __global__ void matmul_tiled_mine(const float* A, const float* B, float* C, int N) {
    __shared__ float As[TILE][TILE];
    __shared__ float Bs[TILE][TILE];
    int tx = threadIdx.x, ty = threadIdx.y;
    int row = blockIdx.y * TILE + ty;
    int col = blockIdx.x * TILE + tx;
    float acc = 0.0f;
    for (int t = 0; t < N; t += TILE) {
        // TODO 1: each thread loads ONE element of the A tile and ONE of the B tile.
        //         Tile of A: rows of this block, columns t..t+TILE-1. Tile of B: rows t..t+TILE-1, columns of this block.
        //         Keep neighbouring threads (tx, tx+1) on neighbouring addresses. Write 0.0f when out of bounds.
        As[ty][tx] = 0.0f;
        Bs[ty][tx] = 0.0f;
        // TODO 2: a barrier, so the tile is complete before anyone reads it.
        for (int k = 0; k < TILE; ++k)
            acc += As[ty][k] * Bs[k][tx];
        // TODO 3: a second barrier. Why is it needed? (Level 2 explains.)
    }
    if (row < N && col < N)
        C[row * N + col] = acc;
}
'''

md = nbf.v4.new_markdown_cell
code = nbf.v4.new_code_cell
cells = [
    md(f'''# GPU kernels, a campaign: the notebook

This is the hands-on side of the campaign at **{SITE}**. Read a level there first, then come here to write the kernel,
time it and compare it with cuBLAS on your own GPU.

**Colab:** Runtime > Change runtime type > **T4 GPU** (free), then run the cells top to bottom.
**Your own GPU:** Jupyter with `pip install cupy-cuda12x` (CUDA 12 drivers).

At the end, the last cell prints a **score line**: paste it into the ladder on the campaign pages.'''),
    md('## Setup: which GPU are we on?'),
    code('''import subprocess, sys
try:
    import cupy as cp
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "cupy-cuda12x"])
    import cupy as cp
import numpy as np

props = cp.cuda.runtime.getDeviceProperties(0)
GPU = props["name"].decode() if isinstance(props["name"], bytes) else str(props["name"])
sms = props["multiProcessorCount"]
print(f"GPU: {GPU}   SMs: {sms}   compute capability {props['major']}.{props['minor']}")
mem_khz, bus_bits = props.get("memoryClockRate"), props.get("memoryBusWidth")
if mem_khz and bus_bits:
    print(f"theoretical memory bandwidth ~ {2 * mem_khz * 1e3 * bus_bits / 8 / 1e9:.0f} GB/s")'''),
    md('## The harness: data, a reference answer, and a stopwatch'),
    code('''N = 4096                                   # C = A x B, all N x N float32
A = cp.random.standard_normal((N, N), dtype=cp.float32)
B = cp.random.standard_normal((N, N), dtype=cp.float32)
C_ref = A @ B                              # cuBLAS: the number to chase
FLOPS = 2 * N**3                           # one multiply + one add per term
SCORES = {}

def time_ms(launch, reps=3):
    launch(); cp.cuda.Device().synchronize()          # warm-up (and first-call compilation)
    start, end = cp.cuda.Event(), cp.cuda.Event()
    start.record()
    for _ in range(reps):
        launch()
    end.record(); end.synchronize()
    return cp.cuda.get_elapsed_time(start, end) / reps

out = cp.empty_like(A)
cublas_ms = time_ms(lambda: cp.matmul(A, B, out=out))
SCORES["cublas"] = FLOPS / (cublas_ms * 1e-3) / 1e9
print(f"cuBLAS: {cublas_ms:.2f} ms = {SCORES['cublas']:.0f} GFLOP/s   <- 100% on your ladder")

def run(src, name, label, block=(32, 32)):
    kernel = cp.RawKernel(src, name)
    grid = ((N + block[0] - 1) // block[0], (N + block[1] - 1) // block[1])
    C = cp.zeros_like(A)
    ms = time_ms(lambda: kernel(grid, block, (A, B, C, cp.int32(N))))
    err = float(cp.linalg.norm(C - C_ref) / cp.linalg.norm(C_ref))
    gflops = FLOPS / (ms * 1e-3) / 1e9
    if err > 1e-4:
        print(f"{label}: WRONG ANSWER (relative error {err:.1e}); not scored. Check your indices.")
        return
    SCORES[label] = gflops
    print(f"{label}: {ms:.1f} ms = {gflops:.0f} GFLOP/s = {100 * gflops / SCORES['cublas']:.1f}% of cuBLAS   (correct, error {err:.1e})")'''),
    md(f'''## Level 1: the 1% kernel ([story]({SITE}level-1.html))

First the kernel as given: one thread per element of C. Before running it, write down your guess: what % of cuBLAS?'''),
    code(f'naive_src = r"""\n{naive}"""\nrun(naive_src, "matmul_naive", "naive")'),
    md('''**Your move.** The kernel below is the same one, renamed. Change it so the 32 threads of a warp read contiguous
memory. It is a two-line change. Predict the speedup first, then run.'''),
    code(f'mine_src = r"""\n{level1_challenge}"""\nrun(mine_src, "matmul_mine", "coalesced")'),
    md(f'''## Level 2: stop fetching the same numbers ([story]({SITE}level-2.html))

Fill in the three TODOs: cooperative tile loads, then two barriers. The skeleton compiles but is wrong until you do.
Predict first: tiling cuts global-memory reads by 32x. How much faster than your coalesced kernel will it be?'''),
    code(f'tiled_src = r"""\n{level2_challenge}"""\nrun(tiled_src, "matmul_tiled_mine", "tiled")'),
    md('## Your score line: paste it into the ladder on the campaign pages'),
    code('''line = ";".join([f"gpu={GPU}"] + [f"{k}={v:.1f}" for k, v in SCORES.items()])
print(line)'''),
    md('''---
## Spoilers: the reference solutions

Run these only after trying. They also let you compare your numbers with a known-good kernel.'''),
    code(f'ref_coalesced = r"""\n{coalesced}"""\nrun(ref_coalesced, "matmul_coalesced", "ref_coalesced")'),
    code(f'ref_tiled = r"""\n{tiled}"""\nrun(ref_tiled, "matmul_tiled", "ref_tiled")'),
]
nb = nbf.v4.new_notebook(cells=cells)
nb.metadata = {'accelerator': 'GPU', 'colab': {'provenance': [], 'gpuType': 'T4'},
               'kernelspec': {'name': 'python3', 'display_name': 'Python 3'}, 'language_info': {'name': 'python'}}
nbf.validate(nb)
OUT.write_text(nbf.writes(nb), encoding='utf-8')
print(f'wrote {OUT.relative_to(ROOT)} ({len(cells)} cells)')
