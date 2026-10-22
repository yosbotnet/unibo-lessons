"""Lab 11 - 05_fused_matmul_gelu.py: section 5's matmul with section 6's epilogue
(bias, GPT-2's tanh GELU, residual add), each a tl.constexpr flag.

    python3 05_fused_matmul_gelu.py test    (4096, 768, 3072) bias + GELU; (4096, 3072, 768) bias +
                                            residual; a ragged shape with all three; no flags
    python3 05_fused_matmul_gelu.py bench   (4096, 768, 3072) FP16: matmul alone, matmul + bias + GELU
                                            fused, and torch matmul -> + bias -> F.gelu (three kernels)

Shapes are (M, K, N). Not run on any GPU yet (see README.md).
"""
import torch, triton, triton.language as tl
import torch.nn.functional as F

from common import bench_cold, check, fmt_row, header, lab_module, need_cuda, test_summary, usage

mm = lab_module('04_matmul')


@triton.jit
def matmul_epi_kernel(a_ptr, b_ptr, c_ptr, bias_ptr, res_ptr, M, N, K,
                      stride_am, stride_ak, stride_bk, stride_bn, stride_cm, stride_cn,
                      BLOCK_M: tl.constexpr, BLOCK_N: tl.constexpr, BLOCK_K: tl.constexpr,
                      GROUP_M: tl.constexpr,
                      HAS_BIAS: tl.constexpr, ACT: tl.constexpr, HAS_RESIDUAL: tl.constexpr):
    # --- which tile of C: grouped ordering (section 5, unchanged)
    pid = tl.program_id(0)
    num_pid_m = tl.cdiv(M, BLOCK_M)
    num_pid_n = tl.cdiv(N, BLOCK_N)
    num_in_group = GROUP_M * num_pid_n
    group = pid // num_in_group
    first_m = group * GROUP_M
    group_m = min(num_pid_m - first_m, GROUP_M)
    pid_m = first_m + (pid % num_in_group) % group_m
    pid_n = (pid % num_in_group) // group_m
    # --- pointer tiles for the first K step
    offs_m = (pid_m * BLOCK_M + tl.arange(0, BLOCK_M)) % M
    offs_n = (pid_n * BLOCK_N + tl.arange(0, BLOCK_N)) % N
    offs_k = tl.arange(0, BLOCK_K)
    a_ptrs = a_ptr + offs_m[:, None] * stride_am + offs_k[None, :] * stride_ak
    b_ptrs = b_ptr + offs_k[:, None] * stride_bk + offs_n[None, :] * stride_bn
    # --- the K loop
    acc = tl.zeros((BLOCK_M, BLOCK_N), dtype=tl.float32)
    for k in range(0, tl.cdiv(K, BLOCK_K)):
        a = tl.load(a_ptrs, mask=offs_k[None, :] < K - k * BLOCK_K, other=0.0)
        b = tl.load(b_ptrs, mask=offs_k[:, None] < K - k * BLOCK_K, other=0.0)
        acc = tl.dot(a, b, acc)
        a_ptrs += BLOCK_K * stride_ak
        b_ptrs += BLOCK_K * stride_bk
    offs_cm = pid_m * BLOCK_M + tl.arange(0, BLOCK_M)
    offs_cn = pid_n * BLOCK_N + tl.arange(0, BLOCK_N)
    c_ptrs = c_ptr + offs_cm[:, None] * stride_cm + offs_cn[None, :] * stride_cn
    c_mask = (offs_cm[:, None] < M) & (offs_cn[None, :] < N)
    # --- section 6: after the K loop, acc is [BLOCK_M, BLOCK_N] in FP32 registers
    if HAS_BIAS:                                   # tl.constexpr flags: dead code is removed
        bias = tl.load(bias_ptr + offs_cn, mask=offs_cn < N, other=0.0)
        acc = acc + bias[None, :]                  # one value per output column
    if ACT == "gelu":                              # GPT-2's tanh GELU, written with a sigmoid:
        u = 0.7978845608 * (acc + 0.044715 * acc * acc * acc)   # 0.5 (1 + tanh u) = sigmoid(2u)
        acc = acc * tl.sigmoid(2.0 * u)
    if HAS_RESIDUAL:
        r = tl.load(res_ptr + offs_cm[:, None] * stride_cm + offs_cn[None, :] * stride_cn, mask=c_mask, other=0.0)
        acc = acc + r.to(tl.float32)
    tl.store(c_ptrs, acc.to(tl.float16), mask=c_mask)


# The same eight configs as 04_matmul.py. The flags are in the key, so each combination is
# tuned on its own (each is a different compiled kernel anyway).
matmul_epi_tuned = triton.autotune(configs=mm.get_cuda_autotune_config(),
                                   key=['M', 'N', 'K', 'HAS_BIAS', 'ACT', 'HAS_RESIDUAL'])(matmul_epi_kernel)

_dummy = {}


def dummy(device):
    """Triton needs a pointer argument even when a flag removes its use."""
    if device not in _dummy:
        _dummy[device] = torch.empty(1, device=device, dtype=torch.float16)
    return _dummy[device]


def matmul_epi(a, b, bias=None, act="", residual=None):
    assert a.shape[1] == b.shape[0], "Incompatible dimensions"
    M, K = a.shape
    K, N = b.shape
    c = torch.empty((M, N), device=a.device, dtype=torch.float16)
    if residual is not None:
        assert residual.shape == c.shape and residual.stride() == c.stride(), "residual must be laid out like C"
    grid = lambda META: (triton.cdiv(M, META['BLOCK_M']) * triton.cdiv(N, META['BLOCK_N']), )
    matmul_epi_tuned[grid](a, b, c,
                           bias if bias is not None else dummy(a.device),
                           residual if residual is not None else dummy(a.device),
                           M, N, K, a.stride(0), a.stride(1), b.stride(0), b.stride(1), c.stride(0), c.stride(1),
                           HAS_BIAS=bias is not None, ACT=act, HAS_RESIDUAL=residual is not None)
    return c


def gelu_ref(x):
    return F.gelu(x, approximate='tanh')


def test():
    torch.manual_seed(0)
    torch.backends.cuda.matmul.allow_tf32 = False
    results = []
    tol = dict(atol=2e-2, rtol=2e-2)

    M, K, N = 4096, 768, 3072                         # GPT-2's MLP up-projection, M = 4 x 1,024 tokens
    a, b = mm.inputs(M, K, N)
    bias = (0.1 * torch.randn(N, device='cuda')).to(torch.float16)
    ref = gelu_ref(a.float() @ b.float() + bias.float())
    results.append(check(f'bias + gelu ({M},{K},{N})', matmul_epi(a, b, bias=bias, act='gelu'), ref, **tol))

    M, K, N = 4096, 3072, 768                         # the down-projection, with the residual stream
    a, b = mm.inputs(M, K, N)
    bias = (0.1 * torch.randn(N, device='cuda')).to(torch.float16)
    r = torch.randn(M, N, device='cuda').to(torch.float16)
    ref = a.float() @ b.float() + bias.float() + r.float()
    results.append(check(f'bias + residual ({M},{K},{N})', matmul_epi(a, b, bias=bias, residual=r), ref, **tol))

    M, K, N = 1000, 777, 333                          # ragged: the bias and residual masks at the edges
    a, b = mm.inputs(M, K, N)
    bias = (0.1 * torch.randn(N, device='cuda')).to(torch.float16)
    r = torch.randn(M, N, device='cuda').to(torch.float16)
    ref = gelu_ref(a.float() @ b.float() + bias.float()) + r.float()
    results.append(check(f'bias + gelu + residual ({M},{K},{N})',
                         matmul_epi(a, b, bias=bias, act='gelu', residual=r), ref, **tol))

    M, K, N = 512, 512, 512                           # no flags: the plain matmul
    a, b = mm.inputs(M, K, N)
    results.append(check(f'no epilogue ({M},{K},{N})', matmul_epi(a, b), a.float() @ b.float(), atol=1e-2, rtol=1e-2))
    return test_summary('05_fused_matmul_gelu', results)


def bench():
    torch.manual_seed(0)
    torch.backends.cuda.matmul.allow_tf32 = False
    M, K, N = 4096, 768, 3072
    shape = f'{M}x{K}x{N}'
    flops = 2 * M * N * K
    out_bytes = M * N * 2
    saved = 2 * 2 * out_bytes                         # two elementwise kernels, each reads + writes C
    print(f'matmul + bias + GELU, (M, K, N) = ({M}, {K}, {N}) FP16: {flops / 1e9:.1f} GFLOP; C is {out_bytes / 1e6:.1f} MB; '
          f'fusing bias and GELU saves 2 x 2 x {out_bytes / 1e6:.1f} = {saved / 1e6:.1f} MB of DRAM traffic')
    a, b = mm.inputs(M, K, N)
    bias = (0.1 * torch.randn(N, device='cuda')).to(torch.float16)
    ok = check('fused at the bench shape', matmul_epi(a, b, bias=bias, act='gelu'),
               gelu_ref(a.float() @ b.float() + bias.float()), atol=2e-2, rtol=2e-2)
    matmul_epi(a, b)                                  # tune the no-flag variant before timing

    def torch3():
        return F.gelu(torch.matmul(a, b) + bias, approximate='tanh')   # matmul, add, gelu: three kernels

    header()
    t_plain = bench_cold(lambda: matmul_epi(a, b))
    t_fused = bench_cold(lambda: matmul_epi(a, b, bias=bias, act='gelu'))
    t_torch3 = bench_cold(torch3)
    t_torchmm = bench_cold(lambda: torch.matmul(a, b))
    fmt_row('triton matmul', shape, *t_plain, flops=flops)
    fmt_row('triton mm+bias+gelu', shape, *t_fused, flops=flops, ref_ms=t_plain[0])
    fmt_row('torch mm, +bias, gelu', shape, *t_torch3, flops=flops)
    fmt_row('torch.matmul alone', shape, *t_torchmm, flops=flops)
    us = lambda ms: 1000.0 * ms
    epi_cost = us(t_fused[0] - t_plain[0])
    torch_elementwise = us(t_torch3[0] - t_torchmm[0])
    print(f'  epilogue cost inside the Triton kernel: {epi_cost:+.1f} us ({100 * (t_fused[0] / t_plain[0] - 1):+.1f}%)')
    print(f'  the two separate PyTorch elementwise kernels cost: {torch_elementwise:.1f} us '
          f'(= {saved / 1e9 / (torch_elementwise * 1e-6) if torch_elementwise > 0 else 0:.0f} GB/s over {saved / 1e6:.1f} MB)')
    print(f'  saved by fusing, against the separate ops: {torch_elementwise - epi_cost:.1f} us')
    print(f'PASTE: fused {shape}  matmul {us(t_plain[0]):.1f} us  fused {us(t_fused[0]):.1f} us ({epi_cost:+.1f} us)  '
          f'torch 3 ops {us(t_torch3[0]):.1f} us  torch matmul {us(t_torchmm[0]):.1f} us  '
          f'elementwise {torch_elementwise:.1f} us  saved {torch_elementwise - epi_cost:.1f} us / {saved / 1e6:.1f} MB'
          f'{"" if ok else "  (CHECK FAILED)"}')


if __name__ == '__main__':
    mode = usage(__doc__, ('test', 'bench'))
    need_cuda()
    if mode == 'test':
        raise SystemExit(0 if test() else 1)
    bench()
