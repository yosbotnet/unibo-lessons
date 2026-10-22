#!/usr/bin/env python3
"""Lab 13, optional: PyTorch's scaled_dot_product_attention at the shapes of `make bench`.

Needs torch with CUDA (never run on the machine that wrote this lab: it has no GPU and no torch).
B = 1, H = 12, D = 64, causal, FP16, T = 1024 .. 8192. Prints one PASTE line per T, and which
backend PyTorch picked if it can tell (flash, memory-efficient or math).
"""
import sys

try:
    import torch
    import torch.nn.functional as F
except ImportError:
    sys.exit("sdpa.py needs torch (pip install torch); this step is optional")

if not torch.cuda.is_available():
    sys.exit("no CUDA device visible to torch")

B, H, D = 1, 12, 64
print(f"torch {torch.__version__}, {torch.cuda.get_device_name()}")


def time_ms(fn, reps=20, warmup=3):
    for _ in range(warmup):
        fn()
    torch.cuda.synchronize()
    times = []
    for _ in range(reps):
        a, b = torch.cuda.Event(enable_timing=True), torch.cuda.Event(enable_timing=True)
        a.record()
        fn()
        b.record()
        b.synchronize()
        times.append(a.elapsed_time(b))
    times.sort()
    return times[len(times) // 2]


def backend_ms(q, k, v, which):
    try:
        from torch.nn.attention import sdpa_kernel, SDPBackend
        ctx = sdpa_kernel({"flash": SDPBackend.FLASH_ATTENTION, "efficient": SDPBackend.EFFICIENT_ATTENTION,
                           "math": SDPBackend.MATH}[which])
    except Exception:
        return None
    try:
        with ctx:
            return time_ms(lambda: F.scaled_dot_product_attention(q, k, v, is_causal=True))
    except RuntimeError:
        return None   # this backend has no kernel for this GPU / dtype


for T in (1024, 2048, 4096, 8192):
    q, k, v = (torch.randn(B, H, T, D, device="cuda", dtype=torch.float16) * 0.5 for _ in range(3))
    ms = time_ms(lambda: F.scaled_dot_product_attention(q, k, v, is_causal=True))
    flops = 2.0 * T * T * D * H   # the causal half, as flash.cu counts it
    tf = flops / (ms * 1e-3) / 1e12
    per = {w: backend_ms(q, k, v, w) for w in ("flash", "efficient", "math")}
    detail = " ".join(f"{w}={m:.3f}" if m is not None else f"{w}=n/a" for w, m in per.items())
    print(f"PASTE: sdpa T={T} default={ms:.3f} ms (TFLOPS {tf:.1f}, {100 * tf / 61.7:.0f}% of 61.7) backends: {detail}")
