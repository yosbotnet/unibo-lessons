"""Lab 11 - inspect_asm.py (make asm): chapter 12 section 7 for every kernel of the lab.

    python3 inspect_asm.py

For each kernel of 01..05, one fixed config, compiled on small inputs:
  - writes asm/<kernel>.{ttir,ttgir,llir,ptx} (and .sass when Triton's bundled cuobjdump works)
  - prints the PTX counts of section 7, n_regs, n_spills, shared bytes, the number of
    convert_layout ops in the TTGIR, and SASS counts of HMMA / LDSM / LDGSTS when available
  - for add_kernel, prints the blocked layout the compiler chose (check figure 3 against it)

(Named inspect_asm.py, not inspect.py: a file called inspect.py next to the script would
shadow Python's own `inspect` module, which torch and triton import.)

Prediction on sm_120 (not verified): matmul PTX has mma.sync > 0, ldmatrix > 0,
cp.async > 0, wgmma = tcgen05 = 0. Not run on any GPU yet (see README.md).
"""
import os
import re

import torch
import triton

from common import HERE, lab_module, need_cuda, ptx_counts

ASM_DIR = os.path.join(HERE, 'asm')
BLOCKED = re.compile(r'#(?:ttg|triton_gpu)\.blocked<\{[^}]*\}>')
LDG_V4 = re.compile(r'ld\.global(?:\.[\w:]+)*\.v4')      # also catches ld.global.L1::evict_last.v4 etc.
SASS_OPS = ('HMMA', 'LDSM', 'LDGSTS', 'LDG.E.128')


def compiled_kernels():
    """Yields (name, handle) for every kernel, each compiled once with one fixed config."""
    va = lab_module('01_vecadd')
    sm = lab_module('02_softmax')
    ln = lab_module('03_layernorm')
    mm = lab_module('04_matmul')
    fu = lab_module('05_fused_matmul_gelu')
    f32, f16 = torch.float32, torch.float16

    x = torch.randn(4096, device='cuda')
    y = torch.randn_like(x)
    out = torch.empty_like(x)
    yield 'add_kernel', va.add_kernel[(triton.cdiv(4096, 1024),)](x, y, out, 4096, BLOCK=1024)

    x = torch.randn(64, 1024, device='cuda')
    out = torch.empty_like(x)
    yield 'softmax_kernel', sm.softmax_kernel[(64,)](out, x, x.stride(0), 1024, BLOCK=1024, num_warps=4)
    h = sm.softmax_kernel_persistent.warmup(out, x, x.stride(0), out.stride(0), 64, 1024, BLOCK_SIZE=1024,
                                            num_stages=2, num_warps=8, grid=(1, ))
    h._init_handles()
    yield 'softmax_kernel_persistent', h

    x = torch.randn(64, 768, device='cuda', dtype=f16)
    r = torch.randn_like(x)
    w = torch.ones(768, device='cuda', dtype=f16)
    b = torch.zeros(768, device='cuda', dtype=f16)
    out = torch.empty_like(x)
    s = torch.empty_like(x)
    yield 'layernorm_kernel', ln.layernorm_kernel[(64,)](out, x, w, b, x.stride(0), 768, 1e-5, BLOCK=1024, num_warps=4)
    yield 'residual_layernorm_kernel', ln.residual_layernorm_kernel[(64,)](out, s, x, r, w, b, x.stride(0), 768, 1e-5,
                                                                           BLOCK=1024, num_warps=4)
    mean = torch.empty(64, device='cuda', dtype=f32)
    rstd = torch.empty(64, device='cuda', dtype=f32)
    yield '_layer_norm_fwd_fused', ln._layer_norm_fwd_fused[(64,)](x, out, w, b, mean, rstd, x.stride(0), 768, 1e-5,
                                                                   BLOCK_SIZE=1024, num_warps=4)

    a = torch.randn(512, 512, device='cuda', dtype=f16)
    bm = torch.randn(512, 512, device='cuda', dtype=f16)
    c = torch.empty(512, 512, device='cuda', dtype=f16)
    yield 'matmul_kernel', mm.matmul_fixed(a, bm, c)          # 128 x 128 x 32, GROUP_M 8, 4 warps, 3 stages

    bias = torch.zeros(512, device='cuda', dtype=f16)
    grid = (triton.cdiv(512, 128) * triton.cdiv(512, 128), )
    yield 'matmul_epi_kernel (bias+gelu)', fu.matmul_epi_kernel[grid](
        a, bm, c, bias, c, 512, 512, 512, a.stride(0), a.stride(1), bm.stride(0), bm.stride(1), c.stride(0), c.stride(1),
        BLOCK_M=128, BLOCK_N=128, BLOCK_K=32, GROUP_M=8, HAS_BIAS=True, ACT='gelu', HAS_RESIDUAL=False)


def main():
    need_cuda()
    os.makedirs(ASM_DIR, exist_ok=True)
    print(f'triton {triton.__version__}  torch {torch.__version__}  {torch.cuda.get_device_name()} '
          f'{torch.cuda.get_device_capability()}')
    rows = []
    for name, h in compiled_kernels():
        torch.cuda.synchronize()
        base = re.sub(r'\W+', '_', name).strip('_')
        for ext in ('ttir', 'ttgir', 'llir', 'ptx'):
            with open(os.path.join(ASM_DIR, f'{base}.{ext}'), 'w') as f:
                f.write(h.asm[ext])
        counts = ptx_counts(h)
        ttgir = h.asm['ttgir']
        n_convert = ttgir.count('convert_layout')
        n_ldg_v4 = len(LDG_V4.findall(h.asm['ptx']))
        print(f'\n{name}: n_regs={h.n_regs} n_spills={h.n_spills} shared={h.metadata.shared} B '
              f'num_warps={h.metadata.num_warps} num_stages={h.metadata.num_stages}')
        print('  ptx   ' + '  '.join(f'{s} {n}' for s, n in counts.items()) + f'  (ld.global*.v4, any qualifiers: {n_ldg_v4})')
        print(f'  ttgir convert_layout ops: {n_convert}')
        if name == 'add_kernel':
            for layout in sorted(set(BLOCKED.findall(ttgir))):
                print(f'  blocked layout: {layout}')
        try:
            sass = h.asm['sass']                             # disassembled with Triton's bundled cuobjdump
            with open(os.path.join(ASM_DIR, f'{base}.sass'), 'w') as f:
                f.write(sass)
            sass_counts = {op: len(re.findall(r'\b' + re.escape(op) + r'\b', sass)) for op in SASS_OPS}
            print('  sass  ' + '  '.join(f'{op} {n}' for op, n in sass_counts.items()))
        except Exception as e:                               # no cuobjdump, or a version without 'sass'
            print(f'  sass  not available ({type(e).__name__}: {e})')
        rows.append((name, counts, h.n_regs, h.n_spills, h.metadata.shared, n_convert))

    print('\nsummary')
    print(f'  {"kernel":<32} {"mma.sync":>8} {"ldmatrix":>8} {"cp.async":>8} {"ld.g.v4":>8} {"wgmma":>6} {"tcgen05":>7}'
          f' {"regs":>5} {"spills":>6} {"shared":>7} {"cvt":>4}')
    for name, cn, regs, spills, shared, ncvt in rows:
        print(f'  {name:<32} {cn["mma.sync"]:>8} {cn["ldmatrix"]:>8} {cn["cp.async"]:>8} {cn["ld.global.v4"]:>8}'
              f' {cn["wgmma"]:>6} {cn["tcgen05"]:>7} {regs:>5} {spills:>6} {shared:>7} {ncvt:>4}')
    print(f'\nIR and PTX written to {ASM_DIR}/')


if __name__ == '__main__':
    main()
