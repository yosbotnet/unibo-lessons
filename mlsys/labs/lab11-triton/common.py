"""Lab 11 - common.py: the harness shared by every file of the lab.

    python3 common.py env      versions, capability, and the PTX instruction counts of
                               chapter 12 section 7 for the vector add and the matmul

What is here:
    env_report()      the environment check (make env)
    check(...)        torch.testing.assert_close wrapped to print PASS / FAIL and the errors
    test_summary(...) the PASTE line of a test run
    bench_cold(fn)    triton.testing.do_bench: L2 flushed before every timed run (section 8)
    bench_warm(fn)    lab 7's bench.h protocol: 3 warm-ups, 20 timed runs, no flush
    fmt_row(...)      one row of a results table

Written against Triton 3.8 (the official tutorials' API; 3.3 is the oldest release that
targets sm_120) and NOT run on any GPU: checked by reading and by py_compile only.
"""
import importlib
import os
import statistics
import sys

import torch
import triton

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

PEAK_FP16_TFLOPS = 61.7     # RTX 5070: FP16 tensor cores, FP32 accumulate, dense (chapter 1)
PEAK_DRAM_GBS = 672.0       # RTX 5070 GDDR7 peak; lab 0 measured your real ceiling

# Chapter 12 section 7: the strings counted in the PTX. Plain substring counts, as the
# chapter's listing does ('cp.async' also counts cp.async.commit_group / wait_group).
PTX_STRINGS = ('mma.sync', 'ldmatrix', 'cp.async', 'ld.global.v4', 'wgmma', 'tcgen05')


def lab_module(name):
    """Import a lab file by name. The files start with a digit, so `import 01_vecadd`
    is a syntax error; importlib takes the name as a string."""
    return importlib.import_module(name)


def need_cuda():
    if not torch.cuda.is_available():
        print('torch.cuda.is_available() is False: this lab needs a CUDA build of PyTorch and a GPU.')
        print('torch', torch.__version__, 'built for CUDA', torch.version.cuda)
        sys.exit(1)


def ptx_counts(h):
    ptx = h.asm['ptx']
    return {s: ptx.count(s) for s in PTX_STRINGS}


def print_handle(name, h):
    """Section 7's listing, for one compiled kernel handle."""
    counts = ptx_counts(h)
    print(f'  {name}: n_regs={h.n_regs} n_spills={h.n_spills} shared={h.metadata.shared} B'
          f'  num_warps={h.metadata.num_warps} num_stages={h.metadata.num_stages}')
    print('    ' + '  '.join(f'{s} {n}' for s, n in counts.items()))
    return counts


# ---------------------------------------------------------------------------
# make env
# ---------------------------------------------------------------------------
def env_report():
    print('triton', triton.__version__)
    print('torch ', torch.__version__, '  torch.version.cuda', torch.version.cuda)
    need_cuda()
    name = torch.cuda.get_device_name()
    cap = torch.cuda.get_device_capability()
    print('device', name, '  capability', cap, '(expected (12, 0) on the RTX 5070)')

    va = lab_module('01_vecadd')
    mm = lab_module('04_matmul')

    print('compiling add_kernel (BLOCK = 1024, 4 warps) on 4,096 floats ...')
    x = torch.randn(4096, device='cuda')
    y = torch.randn(4096, device='cuda')
    out = torch.empty_like(x)
    h_add = va.add_kernel[(triton.cdiv(x.numel(), 1024),)](x, y, out, x.numel(), BLOCK=1024)
    torch.cuda.synchronize()
    print('  asm keys:', list(h_add.asm.keys()))
    print_handle('add_kernel', h_add)

    print('compiling matmul_kernel (128 x 128 x 32, GROUP_M 8, 4 warps, 3 stages) on 512^3 FP16 ...')
    a = torch.randn(512, 512, device='cuda', dtype=torch.float16)
    b = torch.randn(512, 512, device='cuda', dtype=torch.float16)
    c = torch.empty(512, 512, device='cuda', dtype=torch.float16)
    h_mm = mm.matmul_fixed(a, b, c)
    torch.cuda.synchronize()
    counts = print_handle('matmul_kernel', h_mm)

    print('PASTE: env triton=%s torch=%s cuda=%s cap=%d.%d %s | matmul ptx: %s | regs=%d spills=%d shared=%d'
          % (triton.__version__, torch.__version__, torch.version.cuda, cap[0], cap[1], name.replace(' ', '_'),
             ' '.join(f'{s}={n}' for s, n in counts.items()), h_mm.n_regs, h_mm.n_spills, h_mm.metadata.shared))
    ok = counts['mma.sync'] > 0 and counts['ldmatrix'] > 0 and counts['cp.async'] > 0 \
        and counts['wgmma'] == 0 and counts['tcgen05'] == 0
    print('prediction (section 10): mma.sync, ldmatrix, cp.async nonzero; wgmma, tcgen05 zero ->',
          'as predicted' if ok else 'NOT as predicted: paste this block back')


# ---------------------------------------------------------------------------
# checking
# ---------------------------------------------------------------------------
def check(name, got, ref, atol, rtol):
    """Compare in FP32. Prints PASS / FAIL, the max abs error and the max rel error (the
    latter over elements with |ref| > atol, so that near-zero references do not dominate).
    Returns True on PASS."""
    g = got.float()
    r = ref.float()
    if g.shape != r.shape:
        print(f'  FAIL  {name}: shape {tuple(g.shape)} vs {tuple(r.shape)}')
        return False
    finite = torch.isfinite(r)
    diff = (g - r).abs()
    max_abs = diff[finite].max().item() if finite.any() else 0.0
    big = finite & (r.abs() > max(atol, 1e-30))
    max_rel = (diff[big] / r[big].abs()).max().item() if big.any() else 0.0
    try:
        torch.testing.assert_close(g, r, atol=atol, rtol=rtol)
        ok = True
    except AssertionError:
        ok = False
    print(f'  {"PASS" if ok else "FAIL"}  {name:<44} max abs {max_abs:.3e}  max rel {max_rel:.3e}'
          f'  (atol {atol:g}, rtol {rtol:g})')
    return ok


def test_summary(lab, results):
    n_ok = sum(1 for r in results if r)
    status = 'PASS' if n_ok == len(results) else 'FAIL'
    print(f'PASTE: test {lab} {status} {n_ok}/{len(results)}')
    return n_ok == len(results)


# ---------------------------------------------------------------------------
# timing (section 8)
# ---------------------------------------------------------------------------
def bench_cold(fn):
    """triton.testing.do_bench: ~25 ms of warm-up, then ~100 ms of timed runs with a 256 MB
    buffer written before each one (the L2 is cold). Returns (median, q20, q80) in ms.
    fn() is called once first, explicitly, so that a compile error or an autotuning run
    is a traceback or a pause here, never part of a timing."""
    fn()
    torch.cuda.synchronize()
    med, q20, q80 = triton.testing.do_bench(fn, warmup=25, rep=100, quantiles=[0.5, 0.2, 0.8])
    return med, q20, q80


def bench_warm(fn, warmup=3, reps=20):
    """Lab 7's ../common/bench.h protocol, for a like-for-like comparison with lab 7:
    `warmup` untimed calls, then `reps` timed calls, each between two CUDA events and
    synchronized, no cache flush. Returns (median, min) in ms."""
    for _ in range(warmup):
        fn()
    torch.cuda.synchronize()
    times = []
    for _ in range(reps):
        start = torch.cuda.Event(enable_timing=True)
        stop = torch.cuda.Event(enable_timing=True)
        start.record()
        fn()
        stop.record()
        stop.synchronize()
        times.append(start.elapsed_time(stop))
    return statistics.median(times), min(times)


def header():
    print(f'  {"kernel":<22} | {"shape":<18} | {"ms (q20..q80)":<26} | {"GB/s":>7} | {"TFLOP/s":>7} | % of ref')
    print('  ' + '-' * 100)


def fmt_row(name, shape, ms, lo=None, hi=None, nbytes=None, flops=None, ref_ms=None):
    """name | shape | ms (q20..q80) | GB/s | TFLOP/s | % of ref. For warm timings pass
    lo = the minimum and hi = None. Returns (GB/s, TFLOP/s)."""
    gbs = nbytes / (ms * 1e-3) / 1e9 if nbytes else None
    tfs = flops / (ms * 1e-3) / 1e12 if flops else None
    if lo is not None and hi is not None:
        spread = f'{ms:.4f} ({lo:.4f}..{hi:.4f})'
    elif lo is not None:
        spread = f'{ms:.4f} (min {lo:.4f})'
    else:
        spread = f'{ms:.4f}'
    pct = f'{100.0 * ref_ms / ms:6.1f}%' if ref_ms else '      '
    print(f'  {name:<22} | {shape:<18} | {spread:<26} | '
          f'{(f"{gbs:7.1f}" if gbs else "      -")} | {(f"{tfs:7.2f}" if tfs else "      -")} | {pct}')
    return gbs, tfs


def usage(doc, modes):
    if len(sys.argv) != 2 or sys.argv[1] not in modes:
        print(doc)
        sys.exit(2)
    return sys.argv[1]


if __name__ == '__main__':
    mode = usage(__doc__, ('env',))
    env_report()
