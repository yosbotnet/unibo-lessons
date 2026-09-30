#!/usr/bin/env python3
"""Rewrite CUDA launches  kernel<T, 4><<<grid, block[, smem[, stream]]>>>(args);
into  cudasim::launch(dim3(grid), dim3(block), [&]{ kernel<T, 4>(args); });
so that g++ can compile a .cu file against the cudasim headers."""
import sys

def split_top(s):
    out, depth, cur = [], 0, ''
    for ch in s:
        if ch in '([{<': depth += 1
        elif ch in ')]}>': depth -= 1
        if ch == ',' and depth == 0:
            out.append(cur); cur = ''
        else:
            cur += ch
    out.append(cur)
    return [x.strip() for x in out]

def convert(src):
    out, i = [], 0
    while True:
        j = src.find('<<<', i)
        if j < 0:
            out.append(src[i:]); break
        # kernel name: walk back over template args and identifier
        k = j
        if src[k - 1] == '>':
            depth, k = 0, k - 1
            while True:
                if src[k] == '>': depth += 1
                elif src[k] == '<':
                    depth -= 1
                    if depth == 0: break
                k -= 1
        while k > 0 and (src[k - 1].isalnum() or src[k - 1] in '_:'):
            k -= 1
        name = src[k:j]
        e = src.find('>>>', j)
        cfg = split_top(src[j + 3:e])
        p = src.index('(', e)
        depth, q = 0, p
        while True:
            if src[q] == '(': depth += 1
            elif src[q] == ')':
                depth -= 1
                if depth == 0: break
            q += 1
        args = src[p + 1:q]
        out.append(src[i:k])
        out.append(f'cudasim::launch(dim3({cfg[0]}), dim3({cfg[1]}), [&]{{ {name}({args}); }})')
        i = q + 1
    return ''.join(out)

sys.stdout.write(convert(open(sys.argv[1]).read()))
