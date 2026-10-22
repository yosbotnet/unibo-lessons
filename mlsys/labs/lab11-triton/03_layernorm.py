"""Lab 11 - 03_layernorm.py: chapter 12 section 4's layernorm (the row is the tile), the
official tutorial's three-loop kernel, and chapter 9's fused residual + layernorm.

    python3 03_layernorm.py test    [4096, 768] FP32 and FP16 vs F.layer_norm (eps 1e-5), the
                                    fused residual version vs F.layer_norm(x + r), and rows
                                    with mean 1000 and std 1 (chapter 9's cancellation case)
    python3 03_layernorm.py bench   [4096, 768] FP32 and FP16: both kernels vs F.layer_norm

Not run on any GPU yet (see README.md).
"""
import torch, triton, triton.language as tl
import torch.nn.functional as F

from common import bench_cold, check, fmt_row, header, need_cuda, test_summary, usage


# ---------------------------------------------------------------------------
# Chapter 12 section 4: two reductions on the same tile, one read.
# ---------------------------------------------------------------------------
@triton.jit
def layernorm_kernel(out_ptr, x_ptr, w_ptr, b_ptr, stride_row, n_cols, eps, BLOCK: tl.constexpr):
    row = tl.program_id(0)
    cols = tl.arange(0, BLOCK)
    mask = cols < n_cols
    x = tl.load(x_ptr + row * stride_row + cols, mask=mask, other=0.0).to(tl.float32)
    mean = tl.sum(x, axis=0) / n_cols
    xc = tl.where(mask, x - mean, 0.0)             # masked lanes must not enter the variance
    var = tl.sum(xc * xc, axis=0) / n_cols
    rstd = 1.0 / tl.sqrt(var + eps)
    w = tl.load(w_ptr + cols, mask=mask)
    b = tl.load(b_ptr + cols, mask=mask)
    y = xc * rstd * w + b
    tl.store(out_ptr + row * stride_row + cols, y.to(x_ptr.dtype.element_ty), mask=mask)


def _warps(BLOCK):
    return min(max(BLOCK // 256, 1), 8)            # the tutorial's heuristic


def layernorm(x, w, b, eps=1e-5):
    M, N = x.shape
    BLOCK = triton.next_power_of_2(N)
    y = torch.empty_like(x)
    layernorm_kernel[(M,)](y, x, w, b, x.stride(0), N, eps, BLOCK=BLOCK, num_warps=_warps(BLOCK))
    return y


# ---------------------------------------------------------------------------
# Chapter 9's add + norm: one more pointer and one add. Writes the sum (the residual
# stream, needed by the next block) and the normalized output.
# ---------------------------------------------------------------------------
@triton.jit
def residual_layernorm_kernel(out_ptr, sum_ptr, x_ptr, r_ptr, w_ptr, b_ptr, stride_row, n_cols, eps,
                              BLOCK: tl.constexpr):
    row = tl.program_id(0)
    cols = tl.arange(0, BLOCK)
    mask = cols < n_cols
    x = tl.load(x_ptr + row * stride_row + cols, mask=mask, other=0.0).to(tl.float32)
    r = tl.load(r_ptr + row * stride_row + cols, mask=mask, other=0.0).to(tl.float32)
    x = x + r
    tl.store(sum_ptr + row * stride_row + cols, x.to(x_ptr.dtype.element_ty), mask=mask)
    mean = tl.sum(x, axis=0) / n_cols
    xc = tl.where(mask, x - mean, 0.0)
    var = tl.sum(xc * xc, axis=0) / n_cols
    rstd = 1.0 / tl.sqrt(var + eps)
    w = tl.load(w_ptr + cols, mask=mask)
    b = tl.load(b_ptr + cols, mask=mask)
    y = xc * rstd * w + b
    tl.store(out_ptr + row * stride_row + cols, y.to(x_ptr.dtype.element_ty), mask=mask)


def residual_layernorm(x, r, w, b, eps=1e-5):
    M, N = x.shape
    BLOCK = triton.next_power_of_2(N)
    y = torch.empty_like(x)
    s = torch.empty_like(x)
    residual_layernorm_kernel[(M,)](y, s, x, r, w, b, x.stride(0), N, eps, BLOCK=BLOCK, num_warps=_warps(BLOCK))
    return y, s


# ---------------------------------------------------------------------------
# The official tutorial's forward kernel (python/tutorials/05-layer-norm.py, Triton 3.8),
# unchanged: three loops over BLOCK_SIZE chunks (mean, variance, normalize), so the row is
# read three times; for short rows the second and third reads hit L1 / L2.
# ---------------------------------------------------------------------------
@triton.jit
def _layer_norm_fwd_fused(
    X,  # pointer to the input
    Y,  # pointer to the output
    W,  # pointer to the weights
    B,  # pointer to the biases
    Mean,  # pointer to the mean
    Rstd,  # pointer to the 1/std
    stride,  # how much to increase the pointer when moving by 1 row
    N,  # number of columns in X
    eps,  # epsilon to avoid division by zero
    BLOCK_SIZE: tl.constexpr,
):
    # Map the program id to the row of X and Y it should compute.
    row = tl.program_id(0)
    Y += row * stride
    X += row * stride
    # Compute mean
    mean = 0
    _mean = tl.zeros([BLOCK_SIZE], dtype=tl.float32)
    for off in range(0, N, BLOCK_SIZE):
        cols = off + tl.arange(0, BLOCK_SIZE)
        a = tl.load(X + cols, mask=cols < N, other=0.).to(tl.float32)
        _mean += a
    mean = tl.sum(_mean, axis=0) / N
    # Compute variance
    _var = tl.zeros([BLOCK_SIZE], dtype=tl.float32)
    for off in range(0, N, BLOCK_SIZE):
        cols = off + tl.arange(0, BLOCK_SIZE)
        x = tl.load(X + cols, mask=cols < N, other=0.).to(tl.float32)
        x = tl.where(cols < N, x - mean, 0.)
        _var += x * x
    var = tl.sum(_var, axis=0) / N
    rstd = 1 / tl.sqrt(var + eps)
    # Write mean / rstd
    tl.store(Mean + row, mean)
    tl.store(Rstd + row, rstd)
    # Normalize and apply linear transformation
    for off in range(0, N, BLOCK_SIZE):
        cols = off + tl.arange(0, BLOCK_SIZE)
        mask = cols < N
        w = tl.load(W + cols, mask=mask)
        b = tl.load(B + cols, mask=mask)
        x = tl.load(X + cols, mask=mask, other=0.).to(tl.float32)
        x_hat = (x - mean) * rstd
        y = x_hat * w + b
        # Write output
        tl.store(Y + cols, y, mask=mask)


def layernorm_tutorial(x, weight, bias, eps=1e-5):
    """The tutorial's LayerNorm.forward without the autograd class."""
    y = torch.empty_like(x)
    x_arg = x.reshape(-1, x.shape[-1])
    M, N = x_arg.shape
    mean = torch.empty((M, ), dtype=torch.float32, device=x.device)
    rstd = torch.empty((M, ), dtype=torch.float32, device=x.device)
    # Less than 64KB per feature: enqueue fused kernel
    MAX_FUSED_SIZE = 65536 // x.element_size()
    BLOCK_SIZE = min(MAX_FUSED_SIZE, triton.next_power_of_2(N))
    if N > BLOCK_SIZE:
        raise RuntimeError("This layer norm doesn't support feature dim >= 64KB.")
    # heuristics for number of warps
    num_warps = min(max(BLOCK_SIZE // 256, 1), 8)
    _layer_norm_fwd_fused[(M, )](  #
        x_arg, y, weight, bias, mean, rstd,  #
        x_arg.stride(0), N, eps,  #
        BLOCK_SIZE=BLOCK_SIZE, num_warps=num_warps, num_ctas=1)
    return y


TOL = {torch.float32: dict(atol=1e-5, rtol=1e-5), torch.float16: dict(atol=1e-2, rtol=1e-2)}
M, N, EPS = 4096, 768, 1e-5


def make(dtype, mean=0.0):
    x = (mean + torch.randn(M, N, device='cuda')).to(dtype)
    w = (1.0 + 0.1 * torch.randn(N, device='cuda')).to(dtype)
    b = (0.1 * torch.randn(N, device='cuda')).to(dtype)
    return x, w, b


def test():
    torch.manual_seed(0)
    results = []
    for dtype in (torch.float32, torch.float16):
        tag = 'fp32' if dtype == torch.float32 else 'fp16'
        x, w, b = make(dtype)
        ref = F.layer_norm(x, (N,), w, b, EPS)
        results.append(check(f'layernorm_kernel {tag} [{M}, {N}]', layernorm(x, w, b, EPS), ref, **TOL[dtype]))
        results.append(check(f'tutorial 3-loop {tag} [{M}, {N}]', layernorm_tutorial(x, w, b, EPS), ref, **TOL[dtype]))
        r = torch.randn(M, N, device='cuda').to(dtype)
        y, s = residual_layernorm(x, r, w, b, EPS)
        results.append(check(f'residual sum {tag}', s, x + r, **TOL[dtype]))
        results.append(check(f'residual + layernorm {tag}', y, F.layer_norm(x + r, (N,), w, b, EPS), **TOL[dtype]))

    # Chapter 9's cancellation case: rows with mean 1000 and std 1, FP32. The reference is
    # computed in FP64. The centred two-reduction kernel must stay at FP32 level (here:
    # max abs error below 2e-3 on outputs of size ~1; the input itself is only stored to
    # ~6e-5 at 1000). For contrast, the one-pass E[x^2] - E[x]^2 formula in FP32 is printed.
    x = 1000.0 + torch.randn(256, N, device='cuda')
    w = torch.ones(N, device='cuda')
    b = torch.zeros(N, device='cuda')
    ref64 = F.layer_norm(x.double(), (N,), w.double(), b.double(), EPS)
    results.append(check('layernorm_kernel, mean 1000 std 1', layernorm(x, w, b, EPS), ref64, atol=2e-3, rtol=0.0))
    m1 = x.mean(-1, keepdim=True)
    var1 = (x * x).mean(-1, keepdim=True) - m1 * m1           # one pass, FP32: cancels
    y1 = (x - m1) / torch.sqrt(var1.clamp_min(0) + EPS)
    print(f'        (for contrast, not a test: one-pass FP32 formula max abs error '
          f'{(y1.double() - ref64).abs().max().item():.3e})')
    return test_summary('03_layernorm', results)


def bench():
    torch.manual_seed(0)
    for dtype in (torch.float32, torch.float16):
        tag = 'fp32' if dtype == torch.float32 else 'fp16'
        s = torch.tensor([], dtype=dtype).element_size()
        nbytes = 2 * M * N * s + 2 * N * s                    # x read, y written, w and b read once
        print(f'\nlayernorm [{M}, {N}] {tag}: assumes {nbytes / 1e6:.2f} MB moved (row read once, written once, w and b once)')
        x, w, b = make(dtype)
        ref = F.layer_norm(x, (N,), w, b, EPS)
        ok = check('layernorm_kernel at the bench shape', layernorm(x, w, b, EPS), ref, **TOL[dtype]) and \
            check('tutorial at the bench shape', layernorm_tutorial(x, w, b, EPS), ref, **TOL[dtype])
        header()
        t_torch = bench_cold(lambda: F.layer_norm(x, (N,), w, b, EPS))
        t_tile = bench_cold(lambda: layernorm(x, w, b, EPS))
        t_tut = bench_cold(lambda: layernorm_tutorial(x, w, b, EPS))
        shape = f'{M}x{N}'
        g_tile, _ = fmt_row('triton row = tile', shape, *t_tile, nbytes=nbytes, ref_ms=t_torch[0])
        g_tut, _ = fmt_row('triton tutorial 3-loop', shape, *t_tut, nbytes=nbytes, ref_ms=t_torch[0])
        g_torch, _ = fmt_row('F.layer_norm', shape, *t_torch, nbytes=nbytes)
        print(f'PASTE: layernorm {tag} {shape}  tile {g_tile:.1f} GB/s  3-loop {g_tut:.1f} GB/s  torch {g_torch:.1f} GB/s'
              f'{"" if ok else "  (CHECK FAILED)"}')


if __name__ == '__main__':
    mode = usage(__doc__, ('test', 'bench'))
    need_cuda()
    if mode == 'test':
        raise SystemExit(0 if test() else 1)
    bench()
