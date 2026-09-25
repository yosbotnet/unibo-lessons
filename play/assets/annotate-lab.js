// Annotate an access: mark each index uniform (same for all 32 threads of a warp) or varying,
// then predict the cost of the warp's request: broadcast, packed or scattered. Checked on demand.
(function (root, factory) { const api = factory(); if (typeof module === 'object' && module.exports) module.exports = api; else root.AnnotateLab = api; })(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // Same three outcomes, two vocabularies: global memory (sectors) and shared memory (banks, for [32][32] floats).
  const COSTS = {
    global: { broadcast: 'broadcast (1 sector)', packed: 'packed (4 sectors)', scattered: 'scattered (32 sectors)' },
    shared: { broadcast: 'broadcast (1 step)', packed: 'conflict-free (1 step)', scattered: '32-way bank conflict (32 steps)' }
  };
  const expected = (a) => a.answer || costOf(a.idx);
  const kindOf = (a) => a.kind || 'global';
  // Rule: an index that depends on the varying worker id is varying. Cost: no varying index -> broadcast;
  // varying only in the last index -> packed; varying in a non-last index -> scattered.
  function costOf(idx) {
    const v = idx.map((d) => d.ans === 'v');
    if (!v.some(Boolean)) return 'broadcast';
    return v.slice(0, -1).some(Boolean) ? 'scattered' : 'packed';
  }
  const EXERCISES = [
    { id: 'transpose', title: 'Transpose a matrix', code: 'out[x][y] = in[y][x];',
      context: 'Each worker (x, y) copies one element. A warp is 32 workers with neighbouring x and the same y.',
      accesses: [{ name: 'in', idx: [{ n: 'y', ans: 'u' }, { n: 'x', ans: 'v' }] }, { name: 'out', idx: [{ n: 'x', ans: 'v' }, { n: 'y', ans: 'u' }] }],
      debrief: 'The read is packed and the write is scattered, and swapping x and y only moves the problem to the other side: a transpose cannot be coalesced on both ends by choosing a mapping. Level 2\'s shared memory is the way out: read a tile packed, write it packed along the other direction.' },
    { id: 'bt', title: 'B stored transposed', code: 'acc += A[y][k] * Bt[x][k];   // Bt[c][k] holds B[k][c]',
      context: 'The swapped matmul (worker x owns column x of row y of C), but B arrives stored column by column. k is the loop variable.',
      accesses: [{ name: 'A', idx: [{ n: 'y', ans: 'u' }, { n: 'k', ans: 'u' }] }, { name: 'Bt', idx: [{ n: 'x', ans: 'v' }, { n: 'k', ans: 'u' }] }],
      debrief: 'A is a broadcast as before, but Bt puts the varying x in the first index: scattered again. The layout of the data decides which mapping is right; this is why libraries take a "transpose" flag.' },
    { id: 'rowsum', title: 'Sum each row of a matrix', code: 'for (k = 0; k < N; k++) s += M[x][k];',
      context: 'Worker x adds up row x of M (one worker per row, no y). A warp is workers x .. x+31.',
      accesses: [{ name: 'M', idx: [{ n: 'x', ans: 'v' }, { n: 'k', ans: 'u' }] }],
      debrief: 'Scattered: each thread walks its own row, the CPU-friendly pattern, and the warp is spread 16 KB apart at every step. Column sums (s += M[k][x]) would be packed. For row sums, one fix is to let a whole warp share one row: 32 threads read 32 neighbours, then combine their partial sums.' }
  ];

  function mount(sel, opts = {}) {
    const host = document.querySelector(sel); if (!host) return;
    const EXS = opts.exercises || EXERCISES;
    const store = opts.store || { get: () => ({}), set: () => {} };
    const el = (tag, cls, text, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; if (parent) parent.appendChild(e); return e; };
    let ex = 0; const state = store.get() || {};
    function render() {
      host.replaceChildren(); host.classList.add('gl-lab', 'gl-annotate');
      const tabs = el('div', 'gl-seg', null, el('div', 'gl-row', null, host));
      EXS.forEach((e, n) => { const b = el('button', n === ex ? 'on' : '', `${n + 1}. ${e.title}`, tabs); b.type = 'button'; b.setAttribute('aria-pressed', n === ex); b.onclick = () => { ex = n; render(); }; });
      const e = EXS[ex]; const s = (state[e.id] = state[e.id] || { marks: {}, costs: {}, checked: false });
      el('p', null, e.context, host);
      el('pre', 'gl-code', e.code, host);
      el('p', 'gl-cap', 'Tap each index to mark it uniform (grey box) or varying (blue, wavy), then pick the cost of one warp request.', host);
      for (const a of e.accesses) {
        const row = el('div', 'gl-access', null, host);
        const expr = el('span', 'gl-expr', null, row);
        expr.append(a.label || a.name);
        a.idx.forEach((d, n) => {
          const key = a.name + n, mark = s.marks[key];
          expr.append('[');
          const b = el('button', 'gl-tok ' + (mark === 'u' ? 'u' : mark === 'v' ? 'v' : 'q'), d.n, expr); b.type = 'button';
          b.setAttribute('aria-label', `${d.n}: ${mark === 'u' ? 'uniform' : mark === 'v' ? 'varying' : 'not marked'}`);
          b.onclick = () => { s.marks[key] = mark === 'u' ? 'v' : mark === 'v' ? undefined : 'u'; s.checked = false; store.set(state); render(); };
          if (s.checked) { const ok = mark === d.ans; el('span', ok ? 'gl-ok' : 'gl-bad', ok ? '✓' : '✗', expr); }
          expr.append(']');
        });
        const sel = el('select', null, null, row); sel.setAttribute('aria-label', 'cost of the warp request for ' + a.name);
        el('option', null, 'cost…', sel).value = '';
        for (const [k, v] of Object.entries(COSTS[kindOf(a)])) el('option', null, v, sel).value = k;
        sel.value = s.costs[a.name] || '';
        sel.onchange = () => { s.costs[a.name] = sel.value; s.checked = false; store.set(state); render(); };
        if (s.checked) { const ok = s.costs[a.name] === expected(a); el('span', ok ? 'gl-ok' : 'gl-bad', ok ? '✓' : `✗ it is ${COSTS[kindOf(a)][expected(a)]}`, row); }
      }
      const btn = el('button', null, 'Check', el('div', 'gl-row', null, host)); btn.type = 'button';
      btn.onclick = () => { s.checked = true; store.set(state); render(); };
      if (s.checked) {
        const all = e.accesses.every((a) => a.idx.every((d, n) => s.marks[a.name + n] === d.ans) && s.costs[a.name] === expected(a));
        const out = el('div', 'gl-out', null, host); out.setAttribute('role', 'status');
        el('p', 'gl-strong', all ? 'All right.' : 'Not quite: the ✗ marks show where. Uniform = the same for all 32 threads; varying = depends on x.', out);
        if (all) el('p', null, e.debrief, out);
      }
    }
    render();
  }
  return { EXERCISES, COSTS, costOf, expected, mount };
});
