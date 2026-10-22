"""Lab 11 - 04_matmul.py: chapter 12 section 5's FP16 matmul (tl.dot on the tensor cores,
grouped launch order), autotuned over the official tutorial's FP16 configs.

    python3 04_matmul.py test        5 shapes (M, K, N), one ragged, vs an FP32 matmul of the same FP16 inputs
    python3 04_matmul.py bench       6 shapes: Triton vs torch.matmul, do_bench (L2 flushed) and warm
    python3 04_matmul.py bench-warm  the same shapes with lab 7's bench.h protocol only (no flush),
                                     for the side-by-side with lab 7's `make bench`

Shapes are written (M, K, N): C[M, N] = A[M, K] @ B[K, N]. FP16 in, FP32 accumulate, FP16 out.
Not run on any GPU yet (see README.md).
"""
import torch, triton, triton.language as tl

from common import (PEAK_FP16_TFLOPS, bench_cold, bench_warm, check, fmt_row, header, need_cuda,
                    test_summary, usage)


# ---------------------------------------------------------------------------
# Chapter 12 section 5, as printed in the chapter (no decorator: the autotuned version is
# matmul_kernel_tuned below, so that this one can also be launched with a fixed config).
# ---------------------------------------------------------------------------
@triton.jit
def matmul_kernel(a_ptr, b_ptr, c_ptr, M, N, K,
                  stride_am, stride_ak, stride_bk, stride_bn, stride_cm, stride_cn,
                  BLOCK_M: tl.constexpr, BLOCK_N: tl.constexpr, BLOCK_K: tl.constexpr,
                  GROUP_M: tl.constexpr):
    # --- which tile of C: grouped ordering, so that programs running at the
    #     same time share rows of A and columns of B in L2 (fig. 1)
    pid = tl.program_id(0)
    num_pid_m = tl.cdiv(M, BLOCK_M)
    num_pid_n = tl.cdiv(N, BLOCK_N)
    num_in_group = GROUP_M * num_pid_n
    group = pid // num_in_group
    first_m = group * GROUP_M
    group_m = min(num_pid_m - first_m, GROUP_M)          # the last group may be short
    pid_m = first_m + (pid % num_in_group) % group_m      # walk down the group's rows...
    pid_n = (pid % num_in_group) // group_m               # ...then move one column right
    # --- pointer tiles for the first K step
    offs_m = (pid_m * BLOCK_M + tl.arange(0, BLOCK_M)) % M   # wrap instead of mask (see text)
    offs_n = (pid_n * BLOCK_N + tl.arange(0, BLOCK_N)) % N
    offs_k = tl.arange(0, BLOCK_K)
    a_ptrs = a_ptr + offs_m[:, None] * stride_am + offs_k[None, :] * stride_ak   # [BLOCK_M, BLOCK_K]
    b_ptrs = b_ptr + offs_k[:, None] * stride_bk + offs_n[None, :] * stride_bn   # [BLOCK_K, BLOCK_N]
    # --- the K loop: chapter 7's phases
    acc = tl.zeros((BLOCK_M, BLOCK_N), dtype=tl.float32)
    for k in range(0, tl.cdiv(K, BLOCK_K)):
        a = tl.load(a_ptrs, mask=offs_k[None, :] < K - k * BLOCK_K, other=0.0)
        b = tl.load(b_ptrs, mask=offs_k[:, None] < K - k * BLOCK_K, other=0.0)
        acc = tl.dot(a, b, acc)                 # tensor cores: acc += a @ b, FP32 accumulate
        a_ptrs += BLOCK_K * stride_ak
        b_ptrs += BLOCK_K * stride_bk
    # --- epilogue (section 6 adds bias + GELU here) and masked store
    offs_cm = pid_m * BLOCK_M + tl.arange(0, BLOCK_M)
    offs_cn = pid_n * BLOCK_N + tl.arange(0, BLOCK_N)
    c_ptrs = c_ptr + offs_cm[:, None] * stride_cm + offs_cn[None, :] * stride_cn
    tl.store(c_ptrs, acc.to(tl.float16), mask=(offs_cm[:, None] < M) & (offs_cn[None, :] < N))


def get_cuda_autotune_config():
    """The official tutorial's CUDA configs (python/tutorials/03-matrix-multiplication.py,
    Triton 3.8): the first eight, the FP16 ones, with the chapter's parameter names. Configs
    that need more shared memory than an SM has fail to compile and the autotuner skips them."""
    return [
        triton.Config({'BLOCK_M': 128, 'BLOCK_N': 256, 'BLOCK_K': 64, 'GROUP_M': 8}, num_stages=3, num_warps=8),
        triton.Config({'BLOCK_M': 64, 'BLOCK_N': 256, 'BLOCK_K': 32, 'GROUP_M': 8}, num_stages=4, num_warps=4),
        triton.Config({'BLOCK_M': 128, 'BLOCK_N': 128, 'BLOCK_K': 32, 'GROUP_M': 8}, num_stages=4, num_warps=4),
        triton.Config({'BLOCK_M': 128, 'BLOCK_N': 64, 'BLOCK_K': 32, 'GROUP_M': 8}, num_stages=4, num_warps=4),
        triton.Config({'BLOCK_M': 64, 'BLOCK_N': 128, 'BLOCK_K': 32, 'GROUP_M': 8}, num_stages=4, num_warps=4),
        triton.Config({'BLOCK_M': 128, 'BLOCK_N': 32, 'BLOCK_K': 32, 'GROUP_M': 8}, num_stages=4, num_warps=4),
        triton.Config({'BLOCK_M': 64, 'BLOCK_N': 32, 'BLOCK_K': 32, 'GROUP_M': 8}, num_stages=5, num_warps=2),
        triton.Config({'BLOCK_M': 32, 'BLOCK_N': 64, 'BLOCK_K': 32, 'GROUP_M': 8}, num_stages=5, num_warps=2),
    ]


matmul_kernel_tuned = triton.autotune(configs=get_cuda_autotune_config(), key=['M', 'N', 'K'])(matmul_kernel)


def matmul(a, b):
    assert a.shape[1] == b.shape[0], "Incompatible dimensions"
    M, K = a.shape
    K, N = b.shape
    c = torch.empty((M, N), device=a.device, dtype=torch.float16)
    grid = lambda META: (triton.cdiv(M, META['BLOCK_M']) * triton.cdiv(N, META['BLOCK_N']), )
    matmul_kernel_tuned[grid](a, b, c, M, N, K,
                              a.stride(0), a.stride(1), b.stride(0), b.stride(1), c.stride(0), c.stride(1))
    return c


def matmul_fixed(a, b, c, BLOCK_M=128, BLOCK_N=128, BLOCK_K=32, GROUP_M=8, **launch):
    """Section 7's listing: one fixed config, returns the compiled-kernel handle.
    num_warps / num_stages default to Triton's 4 and 3; pass them in `launch` to change."""
    M, K = a.shape
    K, N = b.shape
    grid = lambda META: (triton.cdiv(M, META['BLOCK_M']) * triton.cdiv(N, META['BLOCK_N']), )
    strides = (a.stride(0), a.stride(1), b.stride(0), b.stride(1), c.stride(0), c.stride(1))
    h = matmul_kernel[grid](a, b, c, M, N, K, *strides, BLOCK_M=BLOCK_M, BLOCK_N=BLOCK_N, BLOCK_K=BLOCK_K,
                            GROUP_M=GROUP_M, **launch)
    return h


def describe(cfg):
    kw = cfg.kwargs
    return (f"BLOCK {kw['BLOCK_M']}x{kw['BLOCK_N']}x{kw['BLOCK_K']} GROUP_M {kw['GROUP_M']} "
            f"num_warps {cfg.num_warps} num_stages {cfg.num_stages}")


def print_tuning(shape):
    """The winner and the runner-up configs for the shape just tuned (Autotuner.configs_timings
    holds [median, q20, q80] ms per config; inf = failed to compile, e.g. too much shared memory)."""
    best = matmul_kernel_tuned.best_config
    print(f'  best_config {shape}: {describe(best)}')
    timings = getattr(matmul_kernel_tuned, 'configs_timings', None)
    if timings:
        for cfg, t in sorted(timings.items(), key=lambda kv: kv[1][0])[:8]:
            ms = t[0] if isinstance(t, (list, tuple)) else t
            print(f'      {describe(cfg):<58} {ms:9.4f} ms' if ms != float('inf') else f'      {describe(cfg):<58}   skipped')
    print(f'PASTE: best_config matmul {shape} {describe(best)}')


TEST_SHAPES = ((512, 512, 512), (1024, 768, 3072), (4096, 768, 3072), (4096, 4096, 4096), (1000, 777, 333))
BENCH_SHAPES = ((1024, 1024, 1024), (2048, 2048, 2048), (4096, 4096, 4096), (4096, 768, 3072),
                (64, 768, 3072), (1, 768, 3072))


def inputs(M, K, N):
    a = torch.randn(M, K, device='cuda').to(torch.float16)
    b = torch.randn(K, N, device='cuda').to(torch.float16)
    return a, b


def reference(a, b):
    # FP32 matmul of the same FP16 inputs (TF32 off): the tensor-core result rounded to FP16
    # must agree with it to about 1e-2 relative (chapter 8); a wrong tile is off by O(1).
    torch.backends.cuda.matmul.allow_tf32 = False
    return a.float() @ b.float()


def test():
    torch.manual_seed(0)
    results = []
    for M, K, N in TEST_SHAPES:
        a, b = inputs(M, K, N)
        c = matmul(a, b)
        ok = check(f'matmul (M,K,N)=({M},{K},{N})', c, reference(a, b), atol=1e-2, rtol=1e-2)
        d = (c.float() - torch.matmul(a, b).float()).abs().max().item()
        print(f'        max abs difference from torch.matmul (FP16): {d:.3e}   config: {describe(matmul_kernel_tuned.best_config)}')
        results.append(ok)
    return test_summary('04_matmul', results)


def bench(cold=True, warm=True):
    torch.manual_seed(0)
    lines = []
    for M, K, N in BENCH_SHAPES:
        shape = f'{M}x{K}x{N}'
        flops = 2 * M * N * K
        nbytes = 2 * (M * K + K * N + M * N)                  # every operand once, FP16
        print(f'\nmatmul (M, K, N) = ({M}, {K}, {N}) FP16: assumes {flops / 1e9:.2f} GFLOP, '
              f'{nbytes / 1e6:.1f} MB of operands (compulsory traffic)')
        a, b = inputs(M, K, N)
        c = matmul(a, b)                                     # first call: compiles and autotunes
        print_tuning(shape)
        ok = check('matmul at the bench shape', c, reference(a, b), atol=1e-2, rtol=1e-2)
        res = {}
        if cold:
            print('  do_bench (L2 flushed before every run):')
            header()
            t_torch = bench_cold(lambda: torch.matmul(a, b))
            t_tri = bench_cold(lambda: matmul(a, b))
            _, tf_tri = fmt_row('triton matmul', shape, *t_tri, nbytes=nbytes, flops=flops, ref_ms=t_torch[0])
            _, tf_torch = fmt_row('torch.matmul', shape, *t_torch, nbytes=nbytes, flops=flops)
            res['cold'] = (tf_tri, 100.0 * t_torch[0] / t_tri[0])
            print(f'  triton: {100 * tf_tri / PEAK_FP16_TFLOPS:.1f}% of {PEAK_FP16_TFLOPS} TFLOPS; '
                  f'torch: {100 * tf_torch / PEAK_FP16_TFLOPS:.1f}%')
        if warm:
            print("  warm (lab 7's bench.h protocol: 3 warm-ups, 20 timed, no flush; column 3 shows the min):")
            header()
            w_torch = bench_warm(lambda: torch.matmul(a, b))
            w_tri = bench_warm(lambda: matmul(a, b))
            _, wf_tri = fmt_row('triton matmul (warm)', shape, w_tri[0], w_tri[1], None, nbytes=nbytes, flops=flops,
                                ref_ms=w_torch[0])
            _, wf_torch = fmt_row('torch.matmul (warm)', shape, w_torch[0], w_torch[1], None, nbytes=nbytes, flops=flops)
            res['warm'] = (wf_tri, 100.0 * w_torch[0] / w_tri[0])
        flag = '' if ok else '  (CHECK FAILED)'
        if cold and warm:
            lines.append(f'PASTE: matmul {shape} cold {res["cold"][0]:.2f} TFLOP/s ({res["cold"][1]:.0f}% torch) / '
                         f'warm {res["warm"][0]:.2f} TFLOP/s ({res["warm"][1]:.0f}% torch){flag}')
        elif warm:
            lines.append(f'PASTE: matmul {shape} warm {res["warm"][0]:.2f} TFLOP/s ({res["warm"][1]:.0f}% torch){flag}')
        del a, b, c
    print()
    for line in lines:
        print(line)
    if warm:
        print("Lab 7 comparison: put these warm numbers at 1024^3, 2048^3, 4096^3 next to lab 7's `make bench`"
              " hgemm lines (t3 and cuBLAS GemmEx). Note lab 7's C is FP32 and this one's is FP16.")


if __name__ == '__main__':
    mode = usage(__doc__, ('test', 'bench', 'bench-warm'))
    need_cuda()
    if mode == 'test':
        raise SystemExit(0 if test() else 1)
    if mode == 'bench':
        bench(cold=True, warm=True)
    else:
        bench(cold=False, warm=True)
