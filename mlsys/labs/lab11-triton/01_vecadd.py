"""Lab 11 - 01_vecadd.py: chapter 12 section 2's vector add.

    python3 01_vecadd.py test     n = 1,024, 2^20 and 50,000,001 (an odd tail) vs x + y, exact
    python3 01_vecadd.py bench    n = 64M floats (768 MiB moved): GB/s vs torch.add

Not run on any GPU yet (see README.md).
"""
import torch, triton, triton.language as tl

from common import bench_cold, check, fmt_row, header, need_cuda, test_summary, usage


@triton.jit
def add_kernel(x_ptr, y_ptr, out_ptr, n, BLOCK: tl.constexpr):
    pid = tl.program_id(axis=0)                 # which program instance am I
    offs = pid * BLOCK + tl.arange(0, BLOCK)    # a tile of BLOCK indices
    mask = offs < n                             # the ragged edge
    x = tl.load(x_ptr + offs, mask=mask)        # a tile of BLOCK floats
    y = tl.load(y_ptr + offs, mask=mask)
    tl.store(out_ptr + offs, x + y, mask=mask)


def add(x, y):
    out = torch.empty_like(x)
    n = out.numel()
    grid = lambda meta: (triton.cdiv(n, meta['BLOCK']),)   # one program per tile
    add_kernel[grid](x, y, out, n, BLOCK=1024)
    return out


def test():
    torch.manual_seed(0)
    results = []
    for n in (1024, 1 << 20, 50_000_001):
        x = torch.randn(n, device='cuda')
        y = torch.randn(n, device='cuda')
        results.append(check(f'add n={n:,}', add(x, y), x + y, atol=0.0, rtol=0.0))
        del x, y
    return test_summary('01_vecadd', results)


def bench():
    torch.manual_seed(0)
    n = 64 * 1024 * 1024
    nbytes = 12 * n                                  # read x, read y, write out: 3 x 4 B per element
    print(f'vector add, n = {n:,} FP32: assumes {nbytes / 2**20:.0f} MiB moved ({nbytes / 1e9:.3f} GB), 0 FLOPs that matter')
    x = torch.randn(n, device='cuda')
    y = torch.randn(n, device='cuda')
    out = torch.empty_like(x)
    ok = check('add at the bench shape', add(x, y), x + y, atol=0.0, rtol=0.0)
    header()
    t_torch = bench_cold(lambda: torch.add(x, y, out=out))
    t_tri = bench_cold(lambda: add(x, y))
    g_tri, _ = fmt_row('triton add_kernel', '64M', *t_tri, nbytes=nbytes, ref_ms=t_torch[0])
    g_torch, _ = fmt_row('torch.add', '64M', *t_torch, nbytes=nbytes)
    print(f'PASTE: vecadd 64M  triton {g_tri:.1f} GB/s  torch {g_torch:.1f} GB/s{"" if ok else "  (CHECK FAILED)"}')


if __name__ == '__main__':
    mode = usage(__doc__, ('test', 'bench'))
    need_cuda()
    if mode == 'test':
        raise SystemExit(0 if test() else 1)
    bench()
