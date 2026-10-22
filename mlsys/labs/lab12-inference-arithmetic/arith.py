#!/usr/bin/env python3
"""Lab 12 - arith.py: chapter 13's inference arithmetic as a script (standard library only).

Every step of an inference engine costs max(FLOPs / peak, bytes / bandwidth) plus
overhead. This module counts the FLOPs and the bytes of a prefill and of a decode
step for five model presets on two GPUs, and derives TTFT, TPOT, tokens/s,
memory, the largest batch and the crossovers. It is the same model as the
chapter's widgets (assets/ch13.js): the two must agree to the digit.

  python3 arith.py --model gpt2-small --gpu rtx5070 --dtype fp32 --kv fp32 --batch 1 --prompt 1024 --out 128
  python3 arith.py --model llama-3-8b --gpu h100 --dtype fp16 --batch 64 --prompt 2048 --out 256
  python3 arith.py ... --eff 0.88            achieved bandwidth and peak (one factor, 0.5 .. 1)
  python3 arith.py ... --floor 3e-6          add a launch floor: seconds per kernel launch
  python3 arith.py ... --launches 148        override the kernels per decode step (default 12 L + 4)
  python3 arith.py ... --graph               the floor at 0.5 us per kernel (a captured CUDA graph)
  python3 arith.py --table [--context 1024]  section 5's table (B = 1, 4, 16, 64, 128)
  python3 arith.py ... --json                every readout as JSON (compare.py uses the module directly)
  python3 arith.py --selftest                the chapter's numbers, asserted to 3 significant figures

All times are roofs (or roofs scaled by --eff) unless a floor is given: predictions, not measurements.
"""
import argparse
import json
import math
import sys

# ---------------------------------------------------------------------------
# Presets
#   tied: the LM head shares the input embedding   bias: GPT-2's biases exist
#   swiglu: gate/up/down MLP of width ff            pos: learned position rows (0 for RoPE)
#   ctx: the model's context limit (the widgets clamp their sliders to it)
# ---------------------------------------------------------------------------
MODELS = {
    'gpt2-small':   dict(name='GPT-2 small (124M)', L=12, C=768, H=12, Hkv=12, D=64, ff=3072, V=50257,
                         tied=True, bias=True, swiglu=False, pos=1024, ctx=1024),
    'gpt2-medium':  dict(name='GPT-2 medium (355M)', L=24, C=1024, H=16, Hkv=16, D=64, ff=4096, V=50257,
                         tied=True, bias=True, swiglu=False, pos=1024, ctx=1024),
    'gpt2-xl':      dict(name='GPT-2 XL (1.5B)', L=48, C=1600, H=25, Hkv=25, D=64, ff=6400, V=50257,
                         tied=True, bias=True, swiglu=False, pos=1024, ctx=1024),
    'llama-3.2-1b': dict(name='Llama-3.2-1B', L=16, C=2048, H=32, Hkv=8, D=64, ff=8192, V=128256,
                         tied=True, bias=False, swiglu=True, pos=0, ctx=131072),
    'llama-3-8b':   dict(name='Llama-3-8B', L=32, C=4096, H=32, Hkv=8, D=128, ff=14336, V=128256,
                         tied=False, bias=False, swiglu=True, pos=0, ctx=8192),
}

GPUS = {
    'rtx5070': dict(name='RTX 5070', bw=672e9, vram=12e9, sms=48,
                    peak={'fp32': 30.9e12, 'fp16': 61.7e12, 'fp8': 123.5e12}),
    'h100':    dict(name='H100 SXM', bw=3.35e12, vram=80e9, sms=132,
                    peak={'fp32': 67e12, 'fp16': 989e12, 'fp8': 1979e12}),
}

# weight format -> (bytes per element, which peak does the math); cache format -> bytes
WFMT = {'fp32': (4, 'fp32'), 'fp16': (2, 'fp16'), 'fp8': (1, 'fp8'), 'int4': (0.5, 'fp16')}
KFMT = {'fp32': 4, 'fp16': 2, 'fp8': 1}

LAUNCH_S = 3e-6      # the launch floor per kernel, unfused engine (chapter 4's few microseconds)
GRAPH_S = 0.5e-6     # per kernel inside a captured CUDA graph


def launches(m, phase):
    """Kernels per pass of an engine built like chapter 11's (cuBLAS backend, each
    cuBLAS call counted once). Per layer: layernorm, GEMM + bias (qkv), kv_append,
    attention, GEMM + bias (proj), layernorm, GEMM + bias-GELU, GEMM + bias = 12 at
    decode (one decode-attention kernel); prefill's naive attention is 3 kernels, so
    14. Plus the embedding, the final layernorm, the last-row gather and the head: 4."""
    return (12 if phase == 'decode' else 14) * m['L'] + 4


def params(m):
    """Parameter count, and N_mm: the parameters that sit in matrix multiplies
    (the block linears, biases included, plus the LM head's V x C, tied or not)."""
    L, C, H, Hkv, D, ff, V = m['L'], m['C'], m['H'], m['Hkv'], m['D'], m['ff'], m['V']
    b = 1 if m['bias'] else 0
    q = C * H * D + b * H * D
    k = C * Hkv * D + b * Hkv * D
    v = k
    o = H * D * C + b * C
    mlp = 3 * C * ff if m['swiglu'] else C * ff + b * ff + ff * C + b * C
    norm_block = 2 * (2 * C if m['bias'] else C)          # layernorm: gamma + beta; RMSNorm: gamma
    block = q + k + v + o + mlp + norm_block
    emb = V * C
    head = 0 if m['tied'] else V * C
    final_norm = 2 * C if m['bias'] else C
    total = emb + m['pos'] * C + L * block + final_norm + head
    n_mm = L * (q + k + v + o + mlp) + V * C
    return dict(total=total, n_mm=n_mm, block=block)


def kv_bytes_per_token(m, s):
    """Keys and values, every layer, every KV head: 2 L Hkv D s."""
    return 2 * m['L'] * m['Hkv'] * m['D'] * s


def act_bytes(m, B, s_w):
    """Decode-time activations: per sequence, the engine's row buffers (x, normed x,
    attention output, qkv: about 6 C; the MLP's ff) plus FP32 logits over the vocabulary."""
    return B * ((6 * m['C'] + m['ff']) * s_w + m['V'] * 4)


class Setup:
    """A model on a GPU with a weight format and a cache format, plus the corrections."""

    def __init__(self, model='gpt2-small', gpu='rtx5070', dtype='fp32', kv=None, eff=1.0,
                 floor=None, graph=False, launches_decode=None):
        self.key, self.m, self.g = model, MODELS[model], GPUS[gpu]
        self.gpu = gpu
        self.dtype = dtype
        self.kvfmt = kv or (dtype if dtype in KFMT else 'fp16')
        self.s_w, math_fmt = WFMT[dtype]
        self.s_k = KFMT[self.kvfmt]
        self.peak = self.g['peak'][math_fmt]
        self.bw = self.g['bw']
        self.eff = eff
        p = params(self.m)
        self.total, self.n_mm = p['total'], p['n_mm']
        self.W = self.total * self.s_w
        self.kv = kv_bytes_per_token(self.m, self.s_k)
        self.F_lin = 2 * self.n_mm
        # launch floor: seconds per kernel (None = off); --graph means 0.5 us per kernel
        if graph:
            floor = GRAPH_S
        self.floor = floor
        self.n_dec = launches_decode if launches_decode else launches(self.m, 'decode')
        self.n_pre = launches(self.m, 'prefill')

    def F_att(self, t):
        return 4 * self.m['L'] * t * self.m['C']

    def _time(self, flops, bytes_, n_launch):
        t_c = flops / (self.peak * self.eff)
        t_m = bytes_ / (self.bw * self.eff)
        roof = max(t_c, t_m)
        t_f = n_launch * self.floor if self.floor else 0.0
        bound = 'compute' if t_c >= t_m else 'memory'
        if t_f > roof:
            bound = 'launch'
        return dict(flops=flops, bytes=bytes_, t_c=t_c, t_m=t_m, roof=roof, t_floor=t_f,
                    time=roof + t_f, bound=bound, intensity=flops / bytes_)

    def prefill(self, B, Tp):
        """B prompts of Tp tokens together. FLOPs: the block linears at every position,
        the LM head once (only the last position's logits are needed, as in chapter
        11's engine), the causal half of the attention. Bytes: the weights once and the
        cache written once; the activations between kernels are ignored (small next to
        either with a fused attention kernel, chapter 14)."""
        L, C = self.m['L'], self.m['C']
        head = 2 * self.m['V'] * C                                   # the LM head, one position
        lin = B * (Tp * (self.F_lin - head) + head)
        att = B * 2 * L * Tp * Tp * C                                # causal half of the attention
        bytes_ = self.W + B * Tp * self.kv
        r = self._time(lin + att, bytes_, self.n_pre)
        r.update(flops_lin=lin, flops_att=att, bytes_w=self.W, bytes_kv=B * Tp * self.kv)
        return r

    def decode_step(self, B, t):
        """One new token for each of B sequences at context t (t includes the new token)."""
        flops = B * (self.F_lin + self.F_att(t))
        bytes_ = self.W + B * t * self.kv
        r = self._time(flops, bytes_, self.n_dec)
        r.update(flops_lin=B * self.F_lin, flops_att=B * self.F_att(t), bytes_w=self.W, bytes_kv=B * t * self.kv)
        return r

    def memory(self, B, T):
        return self.W + B * T * self.kv + act_bytes(self.m, B, self.s_w)

    def max_batch(self, T, activations=True):
        """Largest B with W + B T kv (+ activations) <= VRAM; 0 if the weights alone do not fit."""
        free = self.g['vram'] - self.W
        if free <= 0:
            return 0
        per = T * self.kv + (act_bytes(self.m, 1, self.s_w) if activations else 0)
        return int(free // per)

    def crossovers(self, t):
        """Readouts at the roof (no efficiency): where the cache bytes equal the weight
        bytes, where compute would catch up with memory, and decode's intensity limit."""
        slots = self.W / self.kv
        r = self.F_lin * self.bw / self.peak          # the per-sequence weight work, as bytes
        denom = r - t * self.kv
        return dict(slots=slots, B_slots=slots / t, catchup_nocache=self.W / r, work_bytes=r,
                    catchup_cache=(self.W / denom) if denom > 0 else None,
                    limit=(self.F_lin + self.F_att(t)) / (t * self.kv))


def estimate(cfg):
    """Every readout of the calculator for one configuration (a dict)."""
    S = Setup(cfg.get('model', 'gpt2-small'), cfg.get('gpu', 'rtx5070'), cfg.get('dtype', 'fp32'),
              cfg.get('kv'), cfg.get('eff', 1.0), cfg.get('floor'), cfg.get('graph', False),
              cfg.get('launches'))
    B, Tp, To = cfg.get('batch', 1), cfg.get('prompt', 1024), cfg.get('out', 128)
    pre = S.prefill(1, Tp)          # TTFT: each prompt prefilled on its own (section 9)
    pre_b = S.prefill(B, Tp)        # all B prompts in one pass: more throughput, every TTFT this long
    steps = [S.decode_step(B, t) for t in range(Tp + 1, Tp + To + 1)]
    tpot = sum(s['time'] for s in steps) / len(steps)
    first, last = steps[0], steps[-1]
    bounds = [s['bound'] for s in steps]
    tpot_bound = max(set(bounds), key=bounds.count)
    T_end = Tp + To
    cx = S.crossovers(T_end)
    return dict(
        model=S.key, gpu=S.gpu, dtype=S.dtype, kv=S.kvfmt, batch=B, prompt=Tp, out=To, eff=S.eff,
        floor=S.floor, launches_decode=S.n_dec, launches_prefill=S.n_pre,
        params_total=S.total, n_mm=S.n_mm, F_lin=S.F_lin, peak=S.peak, bw=S.bw,
        weights_bytes=S.W, kv_per_token=S.kv, cache_end_bytes=B * T_end * S.kv,
        memory_bytes=S.memory(B, T_end), vram=S.g['vram'], fits=S.memory(B, T_end) <= S.g['vram'],
        max_batch=S.max_batch(T_end), max_batch_no_act=S.max_batch(T_end, False),
        prefill=pre, prefill_batch=pre_b, ttft=pre['time'], ttft_bound=pre['bound'],
        decode_first=first, decode_last=last, tpot=tpot, tpot_bound=tpot_bound,
        tokens_per_s=B / tpot, tokens_per_s_seq=1 / tpot,
        request_latency=pre['time'] + (To - 1) * tpot,
        prefill_intensity=pre['intensity'], decode_intensity_end=last['intensity'],
        ridge=S.peak / S.bw, crossovers=cx)


# ---------------------------------------------------------------------------
# Printing
# ---------------------------------------------------------------------------
def sig(x, n=3):
    """x rounded to n significant figures, as a string with thousands separators."""
    if x == 0:
        return '0'
    d = n - 1 - int(math.floor(math.log10(abs(x))))
    v = round(x, d)
    return f'{v:,.{max(d, 0)}f}'


def t_str(s):
    return f'{sig(s * 1e6)} us' if s < 1e-3 else (f'{sig(s * 1e3)} ms' if s < 1 else f'{sig(s)} s')


def b_str(b):
    for u, k in (('GB', 1e9), ('MB', 1e6), ('KB', 1e3)):
        if b >= k:
            return f'{sig(b / k)} {u}'
    return f'{b:.0f} B'


def f_str(f):
    for u, k in (('TFLOP', 1e12), ('GFLOP', 1e9), ('MFLOP', 1e6)):
        if f >= k:
            return f'{sig(f / k)} {u}'
    return f'{f:.0f} FLOP'


def print_estimate(e):
    m, g = MODELS[e['model']], GPUS[e['gpu']]
    corr = []
    if e['eff'] != 1.0:
        corr.append(f"eff {e['eff']:.0%}")
    if e['floor']:
        corr.append(f"floor {e['floor'] * 1e6:g} us x {e['launches_decode']} kernels/step, {e['launches_prefill']}/prefill")
    print(f"{m['name']} on {g['name']}: weights {e['dtype']}, cache {e['kv']}, B = {e['batch']}, "
          f"prompt {e['prompt']} + out {e['out']}  [{'roof' if not corr else ', '.join(corr)}]")
    print(f"  parameters        total {e['params_total']:,}   N_mm {e['n_mm']:,}   2 N_mm = {f_str(e['F_lin'])} per token")
    print(f"  weights           {b_str(e['weights_bytes'])}")
    print(f"  cache per token   {e['kv_per_token']:,.0f} B ({b_str(e['kv_per_token'])});  at the end, all sequences: {b_str(e['cache_end_bytes'])}")
    print(f"  memory            {b_str(e['memory_bytes'])} of {b_str(e['vram'])}: {'fits' if e['fits'] else 'DOES NOT FIT'};"
          f"  max batch at {e['prompt'] + e['out']} tokens: {e['max_batch']} ({e['max_batch_no_act']} ignoring activations)")
    p = e['prefill']
    print(f"  prefill, 1 prompt {f_str(p['flops'])} (linear, head once {f_str(p['flops_lin'])}, attention {f_str(p['flops_att'])}),"
          f" bytes {b_str(p['bytes'])} (weights + cache written)")
    print(f"                    compute {t_str(p['t_c'])}, memory {t_str(p['t_m'])}"
          f"{', floor ' + t_str(p['t_floor']) if p['t_floor'] else ''} -> TTFT {t_str(e['ttft'])}  [{e['ttft_bound']}],"
          f" intensity {sig(p['intensity'])} FLOP/B (ridge {sig(e['ridge'])})")
    for lab, d, t in (('decode, first', e['decode_first'], e['prompt'] + 1), ('decode, last', e['decode_last'], e['prompt'] + e['out'])):
        print(f"  {lab + ' step':<19}t = {t}: {f_str(d['flops'])}, bytes {b_str(d['bytes_w'])} weights + {b_str(d['bytes_kv'])} cache;"
              f" compute {t_str(d['t_c'])}, memory {t_str(d['t_m'])}{', floor ' + t_str(d['t_floor']) if d['t_floor'] else ''}"
              f" -> {t_str(d['time'])}  [{d['bound']}], {sig(d['intensity'])} FLOP/B")
    if e['batch'] > 1:
        pb = e['prefill_batch']
        print(f"  prefill, all {e['batch']} prompts in one pass: {f_str(pb['flops'])}, {t_str(pb['time'])}  [{pb['bound']}]"
              f" (every prompt's first token waits for the whole pass)")
    print(f"  TPOT (mean)       {t_str(e['tpot'])}  [{e['tpot_bound']}]")
    print(f"  tokens/s          {sig(e['tokens_per_s'])} all sequences, {sig(e['tokens_per_s_seq'])} per sequence")
    print(f"  request latency   {t_str(e['request_latency'])}")
    c = e['crossovers']
    cc = 'never at this context' if c['catchup_cache'] is None else sig(c['catchup_cache'])
    print(f"  crossovers        cache = weights at B x t = {sig(c['slots'])} token-slots (B = {sig(c['B_slots'], 2)} at t = {e['prompt'] + e['out']})")
    print(f"                    compute catches up at B = {sig(c['catchup_nocache'])} without the cache; with it: {cc}"
          f" (t kv = {b_str((e['prompt'] + e['out']) * e['kv_per_token'])} vs 2 N_mm bw / peak = {b_str(c['work_bytes'])})")
    print(f"                    decode intensity limit as B -> infinity: {sig(c['limit'])} FLOP/B")


def table(S, t, Bs):
    rows = []
    for B in Bs:
        d = S.decode_step(B, t)
        rows.append((B, d, B / d['time'], S.W + B * t * S.kv))
    return rows


def print_table(S, t, Bs):
    print(f"decode at t = {t}: {S.m['name']}, weights {S.dtype}, cache {S.kvfmt}, {S.g['name']}, "
          f"{'roof' if S.eff == 1 else f'eff {S.eff:.0%}'}")
    print(f"  {'B':>4} {'FLOPs':>11} {'weights':>9} {'cache':>9} {'compute':>9} {'memory':>9} {'step':>9} {'tokens/s':>9} {'memory used':>11}")
    for B, d, tps, mem in table(S, t, Bs):
        print(f"  {B:>4} {f_str(d['flops']):>11} {b_str(d['bytes_w']):>9} {b_str(d['bytes_kv']):>9} {t_str(d['t_c']):>9}"
              f" {t_str(d['t_m']):>9} {t_str(d['time']):>9} {sig(tps):>9} {b_str(mem):>11}")


# ---------------------------------------------------------------------------
# Self-test: the chapter's numbers
# ---------------------------------------------------------------------------
def selftest():
    fails = []

    def check(what, got, want, sf=3):
        # `want` is the number as the chapter writes it, to `sf` significant figures:
        # `got` must round to it (within half a unit in its last place).
        unit = 10 ** (math.floor(math.log10(abs(want))) - sf + 1)
        ok = abs(got - want) <= 0.5 * unit * (1 + 1e-9)
        if not ok:
            fails.append(what)
        print(f"  {'ok  ' if ok else 'FAIL'} {what:<58} {got:>16.6g}  (chapter: {want:g})")

    def exact(what, got, want):
        ok = got == want
        if not ok:
            fails.append(what)
        print(f"  {'ok  ' if ok else 'FAIL'} {what:<58} {got:>16,}  (published: {want:,})")

    print("parameter counts")
    totals = [124439808, 354823168, 1557611200, 1235814400, 8030261248]
    nmms = [123614976, 353674240, 1555662400, 1235746816, 7504658432]
    for k, tt, nm in zip(MODELS, totals, nmms):
        p = params(MODELS[k])
        exact(k + ' total', p['total'], tt)
        exact(k + ' N_mm', p['n_mm'], nm)
    print("launch counts (chapter 11's engine, cuBLAS backend)")
    exact('gpt2-small kernels per decode step', launches(MODELS['gpt2-small'], 'decode'), 148)
    exact('gpt2-small kernels per prefill', launches(MODELS['gpt2-small'], 'prefill'), 172)

    print("section 2-3: per-token counts")
    g2, l8 = Setup('gpt2-small', 'rtx5070', 'fp32'), Setup('llama-3-8b', 'h100', 'fp16')
    check('gpt2 2 N_mm (M)', g2.F_lin / 1e6, 247)
    check('llama-8b 2 N_mm (G)', l8.F_lin / 1e9, 15.0)
    exact('gpt2 4 L C', 4 * 12 * 768, 36864)
    exact('llama-8b 4 L C', 4 * 32 * 4096, 524288)
    check('gpt2 attention at t=1024 (M)', g2.F_att(1024) / 1e6, 37.7)
    check('gpt2 attention share at 1024 (%)', 100 * g2.F_att(1024) / (g2.F_lin + g2.F_att(1024)), 13, 2)
    check('llama-8b attention at t=1024 (M)', l8.F_att(1024) / 1e6, 537)
    check('llama-8b attention share at 1024 (%)', 100 * l8.F_att(1024) / (l8.F_lin + l8.F_att(1024)), 3.5, 2)
    check('gpt2 attention = linear at t', g2.n_mm / (2 * 12 * 768), 6700, 2)
    check('llama-8b attention = linear at t', l8.n_mm / (2 * 32 * 4096), 28600)
    exact('gpt2 kv bytes per token, fp32', g2.kv, 73728)
    check('gpt2 cache per 1,024 tokens (MB)', 1024 * g2.kv / 1e6, 75.5)
    check('gpt2 fp16 kv per token (KB)', kv_bytes_per_token(g2.m, 2) / 1e3, 36.9)
    l1 = Setup('llama-3.2-1b', 'rtx5070', 'fp16')
    check('llama-1b kv per token (KB)', l1.kv / 1e3, 32.8)
    check('llama-1b weights (GB)', l1.W / 1e9, 2.47)
    check('llama-1b cache share of weights at 1024 (%)', 100 * 1024 * l1.kv / l1.W, 1.4, 2)
    exact('llama-8b kv bytes per token, fp16', l8.kv, 131072)
    check('llama-8b cache per 1,024 (MB)', 1024 * l8.kv / 1e6, 134)
    check('llama-8b cache share at 1024 (%)', 100 * 1024 * l8.kv / l8.W, 0.8, 1)
    check('llama-8b with 32 KV heads, per token (KB)', 4 * l8.kv / 1e3, 524)
    check('gpt2 max batch at 1,024 slots (no activations)', g2.max_batch(1024, False), 152)

    print("section 4: prefill, gpt2-small fp32 rtx5070, T = 1024")
    p = g2.prefill(1, 1024)
    check('weights W (MB)', g2.W / 1e6, 497.8, 4)
    check('blocks per token, 2 (N_mm - V C) (M)', (g2.F_lin - 2 * 50257 * 768) / 1e6, 170)
    check('LM head, once (M)', 2 * 50257 * 768 / 1e6, 77.2)
    check('prefill FLOPs (GFLOP)', p['flops'] / 1e9, 193.5, 4)
    check('prefill linear FLOPs, head once (GFLOP)', p['flops_lin'] / 1e9, 174)
    check('prefill attention FLOPs (GFLOP)', p['flops_att'] / 1e9, 19.3)
    check('prefill time (ms)', p['time'] * 1e3, 6.26)
    check('prefill bytes (MB)', p['bytes'] / 1e6, 573)
    check('prefill memory time (ms)', p['t_m'] * 1e3, 0.853)
    check('prefill 2048 tokens (ms)', g2.prefill(1, 2048)['time'] * 1e3, 14, 2)
    check('prefill fp16 math (ms)', p['flops'] / 61.7e12 * 1e3, 3.1, 2)
    check('8 prompts of 1,024 together (ms)', g2.prefill(8, 1024)['time'] * 1e3, 50, 2)

    print("section 5: decode, gpt2-small fp32 rtx5070, t = 1024")
    want = {1: (0.28, 75.5, 9.2, 0.853, 1170, 0.573), 4: (1.1, 302, 36.9, 1.19, 3360, 0.80),
            16: (4.6, 1210, 148, 2.54, 6300, 1.7), 64: (18.2, 4830, 590, 7.93, 8070, 5.3),
            128: (36.5, 9660, 1180, 15.1, 8460, 10.2)}
    for B, d, tps, mem in table(g2, 1024, [1, 4, 16, 64, 128]):
        wf, wc, wtc, wst, wtps, wmem = want[B]
        check(f'B={B} FLOPs (G)', d['flops'] / 1e9, wf, 2 if B < 64 else 3)
        check(f'B={B} cache bytes (MB)', d['bytes_kv'] / 1e6, wc)
        check(f'B={B} compute time (us)', d['t_c'] * 1e6, wtc, 2 if B == 1 else 3)
        check(f'B={B} step (ms)', d['time'] * 1e3, wst)
        check(f'B={B} tokens/s', tps, wtps)
        check(f'B={B} memory with caches (GB)', mem / 1e9, wmem, 3 if B in (1, 128) else 2)
    c = g2.crossovers(1024)
    check('cache = weights at token-slots', c['slots'], 6750)
    check('cache = weights at B (t = 1024)', c['B_slots'], 6.6, 2)
    check('catch-up batch, no cache', c['catchup_nocache'], 92.6)
    check('catch-up batch, no cache, FP16', Setup('gpt2-small', 'rtx5070', 'fp16').crossovers(1024)['catchup_nocache'], 92, 2)
    ok = c['catchup_cache'] is None
    print(f"  {'ok  ' if ok else 'FAIL'} {'catch-up batch with the cache':<58} {str(c['catchup_cache']):>16}  (chapter: never)")
    if not ok:
        fails.append('catch-up with cache')
    check('intensity limit at t = 1024 (FLOP/B)', c['limit'], 3.77)
    check('weight work as bytes, 2 N_mm bw / peak (MB)', c['work_bytes'] / 1e6, 5.4, 2)
    check('same, llama-8b fp16 h100 (MB)', l8.crossovers(2048)['work_bytes'] / 1e6, 51, 2)
    check('llama-8b one cache at 2048 (MB)', 2048 * l8.kv / 1e6, 268)
    check('B=64 t=128 step (ms)', g2.decode_step(64, 128)['time'] * 1e3, 1.64)
    check('B=64 t=128 tokens/s', 64 / g2.decode_step(64, 128)['time'], 39000, 2)
    g2h = Setup('gpt2-small', 'rtx5070', 'fp32', 'fp16')
    check('fp16 cache, B=64 t=1024 step (ms)', g2h.decode_step(64, 1024)['time'] * 1e3, 4.3, 2)

    print("section 6: fig. 3's decode trail (t = 1024)")
    for B, wi in ((1, 0.50), (4, 1.43), (16, 2.67), (64, 3.42), (128, 3.59), (256, 3.68)):
        check(f'B={B} intensity (FLOP/B)', g2.decode_step(B, 1024)['intensity'], wi, 2 if B == 1 else 3)

    print("section 8: fig. 4, B = 1, t = 1024")
    d = g2.decode_step(1, 1024)
    check('roof: weights (ms)', g2.W / g2.bw * 1e3, 0.741)
    check('roof: cache (ms)', d['bytes_kv'] / g2.bw * 1e3, 0.112)
    check('roof: compute (ms)', d['t_c'] * 1e3, 0.0092, 2)
    g88 = Setup('gpt2-small', 'rtx5070', 'fp32', eff=0.88, floor=LAUNCH_S)
    d88 = g88.decode_step(1, 1024)
    check('88 %: memory (ms)', d88['t_m'] * 1e3, 0.969)
    check('floor: 148 x 3 us (ms)', d88['t_floor'] * 1e3, 0.444)
    check('88 % + floor (ms)', d88['time'] * 1e3, 1.41)
    dg = Setup('gpt2-small', 'rtx5070', 'fp32', eff=0.88, graph=True).decode_step(1, 1024)
    check('88 % + graph (ms)', dg['time'] * 1e3, 1.04)
    check('tokens/s roof / floor / graph', 1 / d['time'], 1170)
    check('tokens/s, 88 % + floor', 1 / d88['time'], 708)
    check('tokens/s, 88 % + graph', 1 / dg['time'], 958)
    check('fig. 1: B=2 step at t = 1024 (ms)', g2.decode_step(2, 1024)['time'] * 1e3, 0.965)

    print("section 9: the interview, llama-3-8b fp16 h100, B = 64, 2048 + 256")
    e = estimate(dict(model='llama-3-8b', gpu='h100', dtype='fp16', batch=64, prompt=2048, out=256))
    check('weights (GB)', e['weights_bytes'] / 1e9, 16.06, 4)
    check('cache per sequence at 2304 (MB)', 2304 * e['kv_per_token'] / 1e6, 302)
    check('cache at the end, 64 sequences (GB)', e['cache_end_bytes'] / 1e9, 19.3)
    check('memory (GB)', e['memory_bytes'] / 1e9, 35.4)
    check('blocks per token, 2 (N_mm - V C) (G)', (l8.F_lin - 2 * 128256 * 4096) / 1e9, 14.0)
    check('prefill blocks, 2,048 positions (TFLOP)', 2048 * (l8.F_lin - 2 * 128256 * 4096) / 1e12, 28.6)
    check('prefill per prompt (TFLOP)', l8.prefill(1, 2048)['flops'] / 1e12, 29.69, 4)
    check('TTFT per prompt at the roof (ms)', l8.prefill(1, 2048)['time'] * 1e3, 30.0)
    check('TTFT in the calculator: one prompt (ms)', e['ttft'] * 1e3, 30.0)
    check('64 prompts together (s)', e['prefill_batch']['time'], 1.9, 2)
    check('decode step t = 2048 (ms)', l8.decode_step(64, 2048)['time'] * 1e3, 9.92)
    check('decode step t = 2304 (ms)', l8.decode_step(64, 2304)['time'] * 1e3, 10.56, 4)
    check('decode FLOPs at 2048 (TFLOP)', l8.decode_step(64, 2048)['flops'] / 1e12, 1.03)
    check('decode compute at 2048 (ms)', l8.decode_step(64, 2048)['t_c'] * 1e3, 1.04)
    check('TPOT (ms)', e['tpot'] * 1e3, 10.2)
    check('tokens/s', e['tokens_per_s'], 6250)
    check('tokens/s per sequence', e['tokens_per_s_seq'], 98, 2)
    check('max batch at 2304 (no activations)', e['max_batch_no_act'], 211)
    e75 = estimate(dict(model='llama-3-8b', gpu='h100', dtype='fp16', batch=64, prompt=2048, out=256, eff=0.75))
    check('eff 75 %: TPOT (ms)', e75['tpot'] * 1e3, 13.7)
    check('eff 75 %: tokens/s', e75['tokens_per_s'], 4700, 2)
    print("section 9: llama-3.2-1b fp16 rtx5070, t = 4096")
    check('B=1 step (ms)', l1.decode_step(1, 4096)['time'] * 1e3, 3.88)
    check('B=1 tokens/s', 1 / l1.decode_step(1, 4096)['time'], 258)
    check('B=64 step (ms)', l1.decode_step(64, 4096)['time'] * 1e3, 16.5)
    check('B=64 tokens/s', 64 / l1.decode_step(64, 4096)['time'], 3890)
    check('B=64 intensity (FLOP/B)', l1.decode_step(64, 4096)['intensity'], 17.4)
    check('max batch at 4096, no activations', l1.max_batch(4096, False), 70)
    check('max batch at 4096, with activations', l1.max_batch(4096), 70)
    check('FP16 ridge on the RTX 5070 (FLOP/B)', l1.peak / l1.bw, 92, 2)
    print("section 9: your engine, gpt2-small fp32 rtx5070, B = 1, 896 + 128 (GPT-2's 1,024 positions)")
    y = estimate(dict(model='gpt2-small', gpu='rtx5070', dtype='fp32', batch=1, prompt=896, out=128))
    check('TTFT (ms)', y['ttft'] * 1e3, 5.41)
    check('TPOT, t = 897 .. 1024 (ms)', y['tpot'] * 1e3, 0.846)
    check('tokens/s', y['tokens_per_s'], 1180)
    yf = estimate(dict(model='gpt2-small', gpu='rtx5070', dtype='fp32', batch=1, prompt=896, out=128, floor=LAUNCH_S))
    check('with the floor: TPOT (ms)', yf['tpot'] * 1e3, 1.29)
    yff = estimate(dict(model='gpt2-small', gpu='rtx5070', dtype='fp32', batch=1, prompt=896, out=128, floor=LAUNCH_S, eff=0.88))
    check('eff 88 % and the floor: TPOT (ms)', yff['tpot'] * 1e3, 1.41)
    print(f"PASTE: lab12 selftest {'ALL PASS' if not fails else 'FAILED: ' + ', '.join(fails)}")
    return 0 if not fails else 1


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--model', default='gpt2-small', choices=list(MODELS))
    ap.add_argument('--gpu', default='rtx5070', choices=list(GPUS))
    ap.add_argument('--dtype', default='fp32', choices=list(WFMT), help='weight format')
    ap.add_argument('--kv', default=None, choices=list(KFMT), help='cache format (default: the weight format; fp16 for int4)')
    ap.add_argument('--batch', type=int, default=1)
    ap.add_argument('--prompt', type=int, default=1024)
    ap.add_argument('--out', type=int, default=128)
    ap.add_argument('--eff', type=float, default=1.0, help='fraction of peak bandwidth and FLOP/s achieved')
    ap.add_argument('--floor', type=float, default=None, help='launch floor, seconds per kernel (e.g. 3e-6)')
    ap.add_argument('--launches', type=int, default=None, help='kernels per decode step (default 12 L + 4)')
    ap.add_argument('--graph', action='store_true', help='launch floor of a captured CUDA graph, 0.5 us per kernel')
    ap.add_argument('--table', action='store_true', help="section 5's table")
    ap.add_argument('--context', type=int, default=1024, help='--table: context length t')
    ap.add_argument('--json', action='store_true')
    ap.add_argument('--selftest', action='store_true')
    a = ap.parse_args(argv)
    if a.selftest:
        return selftest()
    if a.out < 1 or a.prompt < 1 or a.batch < 1:
        ap.error('--batch, --prompt and --out must be at least 1')
    if a.prompt + a.out > MODELS[a.model]['ctx']:
        print(f"note: {a.prompt} + {a.out} tokens is past {a.model}'s context of {MODELS[a.model]['ctx']:,} positions;"
              " the arithmetic below extrapolates", file=sys.stderr)
    if a.table:
        S = Setup(a.model, a.gpu, a.dtype, a.kv, a.eff, a.floor, a.graph, a.launches)
        print_table(S, a.context, [1, 4, 16, 64, 128])
        return 0
    cfg = dict(model=a.model, gpu=a.gpu, dtype=a.dtype, kv=a.kv, batch=a.batch, prompt=a.prompt, out=a.out,
               eff=a.eff, floor=a.floor, graph=a.graph, launches=a.launches)
    e = estimate(cfg)
    if a.json:
        print(json.dumps(e, indent=1))
    else:
        print_estimate(e)
    return 0


if __name__ == '__main__':
    sys.exit(main())
