// Barrier race: a block reduced to two warps. Each loop step t: L = load my half of the tile,
// S1 = barrier, C = compute on the WHOLE tile, S2 = barrier. You step the warps by hand; a disabled
// barrier is skipped. C(t) is correct only if both halves hold step t's data.
(function (root, factory) { const api = factory(); if (typeof module === 'object' && module.exports) module.exports = api; else root.BarrierLab = api; })(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const STEPS = 3, OPS = ['L', 'S1', 'C', 'S2'];
  function create(b1 = true, b2 = true) {
    return { b1, b2, pc: [0, 0], half: [-1, -1], log: [], errors: [] };
  }
  const opOf = (pc) => OPS[pc % 4], stepOf = (pc) => Math.floor(pc / 4);
  const done = (s, w) => s.pc[w] >= STEPS * 4;
  function blocked(s, w) {
    if (done(s, w)) return true;
    const op = opOf(s.pc[w]);
    if ((op === 'S1' && s.b1) || (op === 'S2' && s.b2)) return s.pc[1 - w] < s.pc[w] && !done(s, 1 - w); // wait until the other warp has arrived here
    return false;
  }
  function step(s, w) {
    if (blocked(s, w)) return false;
    const op = opOf(s.pc[w]), t = stepOf(s.pc[w]);
    if (op === 'L') { s.half[w] = t; s.log.push(`W${w}: load its half for step ${t}`); }
    else if (op === 'C') {
      const other = s.half[1 - w];
      if (other === t) s.log.push(`W${w}: compute step ${t} (both halves are step ${t}: correct)`);
      else {
        const what = other < t ? `the other half still holds ${other < 0 ? 'nothing' : 'step ' + other} (not loaded yet)` : `the other half already holds step ${other} (overwritten)`;
        s.log.push(`W${w}: compute step ${t}: WRONG, ${what}`); s.errors.push({ warp: w, t, other });
      }
    } else s.log.push(`W${w}: ${op} ${(op === 'S1' ? s.b1 : s.b2) ? 'passed' : 'skipped (barrier removed)'}`);
    s.pc[w]++; return true;
  }
  // Greedy schedule: always advance W0 when it can, else W1: the "fast warp" that exposes races.
  function runFast(s) { let guard = 100; while (guard-- && !(done(s, 0) && done(s, 1))) { if (!step(s, 0)) step(s, 1); } return s; }

  function mount(sel) {
    const host = document.querySelector(sel); if (!host) return;
    let s = create();
    const el = (tag, cls, text, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; if (parent) parent.appendChild(e); return e; };
    function render() {
      host.replaceChildren(); host.classList.add('gl-lab');
      const opts = el('div', 'gl-row', null, host);
      for (const [k, label] of [['b1', 'first __syncthreads() (after the loads)'], ['b2', 'second __syncthreads() (after the compute)']]) {
        const l = el('label', null, null, opts); const cb = el('input', null, null, l); cb.type = 'checkbox'; cb.checked = s[k];
        cb.onchange = () => { const b = { b1: s.b1, b2: s.b2 }; b[k] = cb.checked; s = create(b.b1, b.b2); render(); };
        l.append(' ' + label);
      }
      const cols = el('div', 'gl-cols', null, host);
      for (const w of [0, 1]) {
        const box = el('div', 'gl-warpbox', null, cols); el('h5', null, `Warp W${w} (writes half ${w} of the tile)`, box);
        el('p', 'gl-mono', done(s, w) ? 'finished' : `next: ${opOf(s.pc[w])} of step ${stepOf(s.pc[w])}` + (blocked(s, w) ? ' · waiting at the barrier' : ''), box);
        const b = el('button', null, `Step W${w}`, box); b.type = 'button'; b.disabled = blocked(s, w); b.onclick = () => { step(s, w); render(); };
      }
      el('p', 'gl-mono', `tile now: half 0 = ${s.half[0] < 0 ? 'empty' : 'step ' + s.half[0]} · half 1 = ${s.half[1] < 0 ? 'empty' : 'step ' + s.half[1]}`, host);
      const ctr = el('div', 'gl-row', null, host);
      const f = el('button', null, 'Let W0 run ahead whenever it can', ctr); f.type = 'button'; f.onclick = () => { s = runFast(create(s.b1, s.b2)); render(); };
      const r = el('button', null, 'Reset', ctr); r.type = 'button'; r.onclick = () => { s = create(s.b1, s.b2); render(); };
      const out = el('div', 'gl-out', null, host); out.setAttribute('role', 'status');
      if (s.errors.length) el('p', 'gl-bad', `Race: ${s.errors.length} wrong compute step${s.errors.length > 1 ? 's' : ''}. ` + s.log.filter((l) => l.includes('WRONG'))[0], out);
      else if (done(s, 0) && done(s, 1)) el('p', 'gl-ok', 'All steps computed on complete, current tiles.', out);
      else el('p', null, 'Step the warps in any order you like, or let W0 run ahead.', out);
      if (s.log.length) { const d = el('details', null, null, out); d.open = true; el('summary', null, `Log (${s.log.length})`, d); const ol = el('ol', 'gl-mono', null, d); s.log.forEach((l) => el('li', null, l, ol)); }
    }
    render();
  }
  return { create, step, blocked, runFast, mount };
});
