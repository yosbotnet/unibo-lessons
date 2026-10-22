"""Lab 11 - 02_softmax.py: chapter 12 section 3's softmax, one program per row, and the
official tutorial's persistent version.

    python3 02_softmax.py test     [12288, 1024], [1024, 8192], [37, 1000] FP32 vs torch.softmax,
                                   plus a row whose first 10 entries are -inf
    python3 02_softmax.py bench    [12288, 1024] and [1024, 8192] FP32: both kernels and torch.softmax

Not run on any GPU yet (see README.md).
"""
import torch, triton, triton.language as tl
from triton.runtime import driver

from common import bench_cold, check, fmt_row, header, need_cuda, test_summary, usage


# ---------------------------------------------------------------------------
# Chapter 12 section 3: the row is the tile.
# ---------------------------------------------------------------------------
@triton.jit
def softmax_kernel(out_ptr, x_ptr, stride_row, n_cols, BLOCK: tl.constexpr):
    row = tl.program_id(0)
    cols = tl.arange(0, BLOCK)                      # BLOCK = next power of two >= n_cols
    mask = cols < n_cols
    x = tl.load(x_ptr + row * stride_row + cols, mask=mask, other=-float('inf'))
    x = x - tl.max(x, axis=0)                       # pass 1: the row max (a reduction)
    e = tl.exp(x)                                   # masked lanes: exp(-inf) = 0
    y = e / tl.sum(e, axis=0)                       # pass 2: the sum; pass 3: normalize
    tl.store(out_ptr + row * stride_row + cols, y, mask=mask)


def softmax(x):                                     # x: [rows, n_cols], row-major
    rows, n_cols = x.shape
    BLOCK = triton.next_power_of_2(n_cols)
    num_warps = min(max(BLOCK // 256, 1), 16)       # more warps for longer rows
    y = torch.empty_like(x)
    softmax_kernel[(rows,)](y, x, x.stride(0), n_cols, BLOCK=BLOCK, num_warps=num_warps)
    return y


# ---------------------------------------------------------------------------
# The official tutorial's kernel (python/tutorials/02-fused-softmax.py, Triton 3.8),
# renamed softmax_kernel_persistent; the HIP branch is dropped. As many programs as fit
# on the GPU at once, each looping over rows with stride num_programs; tl.range with
# num_stages asks the compiler to pipeline the row loop.
# ---------------------------------------------------------------------------
@triton.jit
def softmax_kernel_persistent(output_ptr, input_ptr, input_row_stride, output_row_stride, n_rows, n_cols,
                              BLOCK_SIZE: tl.constexpr, num_stages: tl.constexpr):
    # starting row of the program
    row_start = tl.program_id(0)
    row_step = tl.num_programs(0)
    for row_idx in tl.range(row_start, n_rows, row_step, num_stages=num_stages):
        # The stride represents how much we need to increase the pointer to advance 1 row
        row_start_ptr = input_ptr + row_idx * input_row_stride
        # The block size is the next power of two greater than n_cols, so we can fit each
        # row in a single block
        col_offsets = tl.arange(0, BLOCK_SIZE)
        input_ptrs = row_start_ptr + col_offsets
        # Load the row into SRAM, using a mask since BLOCK_SIZE may be > than n_cols
        mask = col_offsets < n_cols
        row = tl.load(input_ptrs, mask=mask, other=-float('inf'))
        # Subtract maximum for numerical stability
        row_minus_max = row - tl.max(row, axis=0)
        # Note that exponentiation in Triton is fast but approximate (i.e., think __expf in CUDA)
        numerator = tl.exp(row_minus_max)
        denominator = tl.sum(numerator, axis=0)
        softmax_output = numerator / denominator
        # Write back output to DRAM
        output_row_start_ptr = output_ptr + row_idx * output_row_stride
        output_ptrs = output_row_start_ptr + col_offsets
        tl.store(output_ptrs, softmax_output, mask=mask)


_props = None
kernels = {}


def _device_properties():
    global _props
    if _props is None:
        _props = driver.active.utils.get_device_properties(torch.cuda.current_device())
    return _props


def softmax_persistent(x):
    properties = _device_properties()
    NUM_SM = properties["multiprocessor_count"]
    NUM_REGS = properties["max_num_regs"]
    SIZE_SMEM = properties["max_shared_mem"]
    WARP_SIZE = properties["warpSize"]

    n_rows, n_cols = x.shape
    # The block size of each loop iteration is the smallest power of two greater than the number of columns in `x`
    BLOCK_SIZE = triton.next_power_of_2(n_cols)
    num_warps = 8
    # Number of software pipelining stages.
    num_stages = 4 if SIZE_SMEM > 200000 else 2
    y = torch.empty_like(x)
    # lab: compile and size once per shape (the tutorial's unused `kernels` dict), so that
    # timed calls do not repeat the warm-up lookup
    key = (n_rows, n_cols, x.dtype)
    if key not in kernels:
        # pre-compile kernel to get register usage and compute thread occupancy.
        kernel = softmax_kernel_persistent.warmup(y, x, x.stride(0), y.stride(0), n_rows, n_cols, BLOCK_SIZE=BLOCK_SIZE,
                                                  num_stages=num_stages, num_warps=num_warps, grid=(1, ))
        kernel._init_handles()
        n_regs = kernel.n_regs
        size_smem = kernel.metadata.shared
        occupancy = NUM_REGS // (n_regs * WARP_SIZE * num_warps)
        occupancy = min(occupancy, SIZE_SMEM // max(size_smem, 1))   # lab: max(.., 1) guards a 0-byte kernel
        num_programs = NUM_SM * max(occupancy, 1)                    # lab: at least one program per SM
        num_programs = min(num_programs, n_rows)
        kernels[key] = (kernel, num_programs)
    kernel, num_programs = kernels[key]
    # Create a number of persistent programs.
    kernel[(num_programs, 1, 1)](y, x, x.stride(0), y.stride(0), n_rows, n_cols, BLOCK_SIZE, num_stages)
    return y


KERNELS = (('softmax (row = tile)', softmax), ('softmax persistent', softmax_persistent))


def test():
    torch.manual_seed(0)
    results = []
    for rows, cols in ((12288, 1024), (1024, 8192), (37, 1000)):
        x = torch.randn(rows, cols, device='cuda')
        ref = torch.softmax(x, dim=-1)
        for name, fn in KERNELS:
            results.append(check(f'{name} [{rows}, {cols}]', fn(x), ref, atol=1e-6, rtol=1e-5))
    # a row that starts with 10 masked-out scores (-inf): the max is finite, the -inf lanes
    # give exp(-inf) = 0, nothing may become NaN
    x = torch.randn(37, 1000, device='cuda')
    x[3, :10] = -float('inf')
    ref = torch.softmax(x, dim=-1)
    for name, fn in KERNELS:
        y = fn(x)
        finite = bool(torch.isfinite(y).all())
        ok = check(f'{name} -inf prefix', y, ref, atol=1e-6, rtol=1e-5) and finite
        if not finite:
            print('        ... output has non-finite values')
        results.append(ok)
    return test_summary('02_softmax', results)


def bench():
    torch.manual_seed(0)
    for rows, cols in ((12288, 1024), (1024, 8192)):
        nbytes = 8 * rows * cols                     # read the row once, write it once, FP32
        shape = f'{rows}x{cols}'
        print(f'\nsoftmax [{rows}, {cols}] FP32: assumes {nbytes / 1e6:.1f} MB moved (one read + one write)')
        x = torch.randn(rows, cols, device='cuda')
        ref = torch.softmax(x, dim=-1)
        ok = all(check(f'{n} at the bench shape', f(x), ref, atol=1e-6, rtol=1e-5) for n, f in KERNELS)
        header()
        t_torch = bench_cold(lambda: torch.softmax(x, dim=-1))
        t_row = bench_cold(lambda: softmax(x))
        t_pers = bench_cold(lambda: softmax_persistent(x))
        g_row, _ = fmt_row('triton row = tile', shape, *t_row, nbytes=nbytes, ref_ms=t_torch[0])
        g_pers, _ = fmt_row('triton persistent', shape, *t_pers, nbytes=nbytes, ref_ms=t_torch[0])
        g_torch, _ = fmt_row('torch.softmax', shape, *t_torch, nbytes=nbytes)
        print(f'PASTE: softmax {shape}  row {g_row:.1f} GB/s  persistent {g_pers:.1f} GB/s  torch {g_torch:.1f} GB/s'
              f'{"" if ok else "  (CHECK FAILED)"}')


if __name__ == '__main__':
    mode = usage(__doc__, ('test', 'bench'))
    need_cuda()
    if mode == 'test':
        raise SystemExit(0 if test() else 1)
    bench()
