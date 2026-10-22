#!/usr/bin/env python3
"""Lab 12 - compare.py: the engine's measurements next to arith.py's predictions.

Reads the output of the engine's two benchmark modes (any text containing their
PASTE: lines, from files or stdin) and prints, line by line, the measured time,
arith.py's roof, the roof at 88 % of peak (lab 0's bandwidth), the same plus the
launch floor (148 kernels x 3 us per decode step, 172 per prefill), and the
achieved fraction of the roof.

  python3 compare.py out/prefill.txt out/decode.txt      (what  make compare  runs)
  ../gpt2/gpt2 bench-decode | python3 compare.py         (stdin)
  python3 compare.py --selftest

The engine's lines (labs/gpt2/gpt2.cu, bench-prefill and bench-decode):
  PASTE: prefill B= T= ms= gflop= tflops= pred_roof_ms= frac=
  PASTE: decode B= t= ms= bytes_w= bytes_kv= pred_roof_ms= frac= attn_ms= attn_gbs= cache_mb=
What they measure: prefill = one forward pass of B prompts of T tokens into the cache,
last-token logits, median of 10. decode = one step for B sequences at context t, the
cache filled with random values (not a prefill) and the position held fixed, timed with
the token-id copy in and the greedy pick out (argmax + copy back), median of 20.
attn = the L layers' decode-attention kernels alone, over the same cache.
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import arith  # noqa: E402

LINE = re.compile(r'PASTE:\s+(prefill|decode)\s+(.*)$')
KV = re.compile(r'(\w+)=(\S+)')
MEM = re.compile(r'engine memory \(cudaMemGetInfo\):\s+([\d.]+) MB')
EFF = 0.88

PREFILL_KEYS = ('B', 'T', 'ms', 'gflop', 'tflops', 'pred_roof_ms', 'frac')
DECODE_KEYS = ('B', 't', 'ms', 'bytes_w', 'bytes_kv', 'pred_roof_ms', 'frac', 'attn_ms', 'attn_gbs', 'cache_mb')


def parse(text):
    """-> (prefill rows, decode rows, [engine memory MB per run]); each row a dict of floats."""
    pre, dec, mem = [], [], []
    for raw in text.splitlines():
        m = MEM.search(raw)
        if m:
            mem.append(float(m.group(1)))
        m = LINE.search(raw)
        if not m:
            continue
        kind, rest = m.groups()
        row = {k: float(v) for k, v in KV.findall(rest)}
        need = PREFILL_KEYS if kind == 'prefill' else DECODE_KEYS
        missing = [k for k in need if k not in row]
        if missing:
            raise ValueError(f'{kind} line without {", ".join(missing)}: {raw.strip()}')
        (pre if kind == 'prefill' else dec).append(row)
    return pre, dec, mem


def fmt(x, w=8):
    if x != x:                       # nan: a column that does not apply
        return f'{"-":>{w}}'
    return f'{x:{w}.3f}' if x < 100 else f'{x:{w}.1f}'


def report(pre, dec, mem, out=print):
    roof = arith.Setup('gpt2-small', 'rtx5070', 'fp32')
    at = arith.Setup('gpt2-small', 'rtx5070', 'fp32', eff=EFF)
    fl = arith.Setup('gpt2-small', 'rtx5070', 'fp32', eff=EFF, floor=arith.LAUNCH_S)
    W = roof.W
    is_gpt2 = all(abs(r['bytes_w'] - W) <= 1e-3 * W for r in dec)
    if pre and not dec:
        is_gpt2 = all(abs(r['gflop'] - roof.prefill(int(r['B']), int(r['T']))['flops'] / 1e9) <= 0.051 + 1e-3 * r['gflop'] for r in pre)
    summary = {}
    if not is_gpt2:
        out('note: these lines are not GPT-2 small (the weight bytes differ); arith.py columns use the engine\'s own'
            ' pred_roof_ms instead, and the 88 % / floor columns are left out')
    if pre:
        out('\nprefill (TTFT): B prompts of T tokens, ms')
        out(f"  {'B':>3} {'T':>5} {'measured':>9} {'roof':>8} {'@88%':>8} {'+floor':>8} {'engine':>8} {'of roof':>8} {'TFLOP/s':>8}")
        for r in pre:
            B, T = int(r['B']), int(r['T'])
            if is_gpt2:
                p_roof = roof.prefill(B, T)['time'] * 1e3
                p_at, p_fl = at.prefill(B, T)['time'] * 1e3, fl.prefill(B, T)['time'] * 1e3
            else:
                p_roof, p_at, p_fl = r['pred_roof_ms'], float('nan'), float('nan')
            frac = p_roof / r['ms'] if r['ms'] > 0 else 0.0
            out(f"  {B:>3} {T:>5} {fmt(r['ms'], 9)} {fmt(p_roof)} {fmt(p_at)} {fmt(p_fl)} {fmt(r['pred_roof_ms'])}"
                f" {frac:>7.0%} {r['tflops']:>8.2f}")
            summary[f'prefill_B{B}_T{T}'] = frac
    if dec:
        out('\ndecode (TPOT): one step for B sequences at context t, ms')
        out(f"  {'B':>3} {'t':>5} {'measured':>9} {'roof':>8} {'@88%':>8} {'+floor':>8} {'engine':>8} {'of roof':>8}"
            f" | {'attn ms':>8} {'attn roof':>9} {'GB/s':>6} {'of 672':>6} {'cache MB':>9} {'read MB':>8}")
        for r in dec:
            B, t = int(r['B']), int(r['t'])
            if is_gpt2:
                p_roof = roof.decode_step(B, t)['time'] * 1e3
                p_at, p_fl = at.decode_step(B, t)['time'] * 1e3, fl.decode_step(B, t)['time'] * 1e3
            else:
                p_roof, p_at, p_fl = r['pred_roof_ms'], float('nan'), float('nan')
            frac = p_roof / r['ms'] if r['ms'] > 0 else 0.0
            a_roof = r['bytes_kv'] / roof.bw * 1e3              # the cache read at spec bandwidth
            # cache_mb is the allocation: B x T_max x kv; T_max = the largest t of the run
            out(f"  {B:>3} {t:>5} {fmt(r['ms'], 9)} {fmt(p_roof)} {fmt(p_at)} {fmt(p_fl)} {fmt(r['pred_roof_ms'])}"
                f" {frac:>7.0%} | {fmt(r['attn_ms'])} {fmt(a_roof, 9)} {r['attn_gbs']:>6.0f} {r['attn_gbs'] / 672:>6.0%}"
                f" {r['cache_mb']:>9.1f} {r['bytes_kv'] / 1e6:>8.1f}")
            summary[f'decode_B{B}_t{t}'] = frac
            summary[f'attn_gbs_B{B}_t{t}'] = r['attn_gbs']
        out('  (read MB = the cache bytes one step reads at this t; cache MB = what the engine allocated, for its largest t)')
        if is_gpt2:
            Bmax = max(int(r['B']) for r in dec)
            out(f'\nmemory at B = {Bmax}: section 5 predicts {roof.W / 1e9:.2f} GB of weights + '
                f'{Bmax * 1024 * roof.kv / 1e9:.2f} GB of cache at 1,024 slots = {(roof.W + Bmax * 1024 * roof.kv) / 1e9:.1f} GB'
                + (f'; the engine reported {mem[-1]:.0f} MB besides the weights (cudaMemGetInfo)' if mem else ''))
    keys = [k for k in ('prefill_B1_T1024', 'decode_B1_t1024', 'decode_B64_t1024') if k in summary]
    parts = [f'{k}={summary[k]:.2f}' for k in keys]
    if 'attn_gbs_B1_t1024' in summary:
        parts.append(f"attn_gbs_B1_t1024={summary['attn_gbs_B1_t1024']:.0f}")
    out('\nPASTE: lab12 compare ' + (' '.join(parts) if parts else f'{len(pre)} prefill + {len(dec)} decode lines'))
    return summary


def selftest():
    fails = []

    def ok(what, cond):
        print(f"  {'ok  ' if cond else 'FAIL'} {what}")
        if not cond:
            fails.append(what)

    # 1. synthetic GPT-2 small lines in the engine's format, measured = roof / 0.6: compare must recover 60 %
    S = arith.Setup('gpt2-small', 'rtx5070', 'fp32')
    lines = []
    for B, T in ((1, 128), (1, 1024), (4, 1024)):
        p = S.prefill(B, T)
        ms = p['time'] * 1e3 / 0.6
        lines.append(f"PASTE: prefill B={B} T={T} ms={ms:.3f} gflop={p['flops'] / 1e9:.1f} tflops={p['flops'] / ms / 1e9:.2f}"
                     f" pred_roof_ms={p['time'] * 1e3:.3f} frac=0.60")
    for B, t in ((1, 1024), (64, 1024)):
        d = S.decode_step(B, t)
        ms, bkv = d['time'] * 1e3 / 0.6, B * t * S.kv
        lines.append(f"PASTE: decode B={B} t={t} ms={ms:.3f} bytes_w={S.W:.0f} bytes_kv={bkv:.0f} pred_roof_ms={d['time'] * 1e3:.3f}"
                     f" frac=0.60 attn_ms=0.500 attn_gbs={bkv / 0.5 / 1e6:.0f} cache_mb={B * 1024 * S.kv / 1e6:.1f}")
    lines.append('engine memory (cudaMemGetInfo): 4850 MB besides the weights')
    pre, dec, mem = parse('\n'.join(lines))
    ok('synthetic: 3 prefill + 2 decode lines parsed, engine memory read', (len(pre), len(dec), mem) == (3, 2, [4850.0]))
    quiet = []
    summ = report(pre, dec, mem, out=quiet.append)
    ok('synthetic: prefill fraction recovered (0.60)', abs(summ.get('prefill_B1_T1024', -1) - 0.6) < 0.005)
    ok('synthetic: decode fractions recovered (0.60)', abs(summ.get('decode_B1_t1024', -1) - 0.6) < 0.005 and abs(summ.get('decode_B64_t1024', -1) - 0.6) < 0.005)
    ok('synthetic: recognised as GPT-2 small', not any(q.startswith('note:') for q in quiet))
    try:
        parse('PASTE: decode B=1 t=8 ms=1.0 bytes_w=1')
        ok('a line with missing fields is rejected', False)
    except ValueError:
        ok('a line with missing fields is rejected', True)
    # 2. the engine's real output on cudasim (tiny model; timings fake): shape only
    here = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'testdata')
    for name, kind in (('cudasim-prefill.txt', 0), ('cudasim-decode.txt', 1)):
        path = os.path.join(here, name)
        if not os.path.exists(path):
            ok(f'{name} present', False)
            continue
        with open(path) as f:
            got = parse(f.read())
        ok(f'{name}: 4 {"decode" if kind else "prefill"} lines in the engine\'s format', len(got[kind]) == 4 and not got[1 - kind])
        quiet = []
        report(*got, out=quiet.append)
        ok(f'{name}: not GPT-2 small, reported with the engine\'s own prediction', any(q.startswith('note:') for q in quiet))
    print(f"PASTE: lab12 compare selftest {'ALL PASS' if not fails else 'FAILED'}")
    return 0 if not fails else 1


def main(argv):
    if '--selftest' in argv:
        return selftest()
    paths = [a for a in argv if not a.startswith('-')]
    text = ''
    if paths:
        found = [p for p in paths if os.path.exists(p)]
        for p in paths:
            if p not in found:
                print(f'compare.py: {p} not found (run  make bench-prefill  and  make bench-decode  first)', file=sys.stderr)
        if not found:
            return 1
        for p in found:
            with open(p) as f:
                text += f.read() + '\n'
    else:
        text = sys.stdin.read()
    pre, dec, mem = parse(text)
    if not pre and not dec:
        print('compare.py: no PASTE: prefill / decode lines found', file=sys.stderr)
        return 1
    for line in text.splitlines():
        if line.startswith('GPU:') or line.startswith('weights:'):
            print(line)
    report(pre, dec, mem)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
