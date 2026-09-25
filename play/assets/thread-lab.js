// Thread explorer: pick a block and a thread, see which output of C it owns, what it reads,
// and which 32 outputs its warp (threadIdx.x 0..31, same threadIdx.y) computes together.
// Real sizes: N = 4096, blocks of 32 x 32 threads, a grid of 128 x 128 blocks.
(function (root, factory) { const api = factory(); if (typeof module === 'object' && module.exports) module.exports = api; else root.ThreadLab = api; })(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const N = 4096, BD = 32, GRID = N / BD;
  function owner(mapping, bx, by, tx, ty) {
    if (mapping === 'naive') return { row: bx * BD + tx, col: by * BD + ty };
    return { row: by * BD + ty, col: bx * BD + tx };
  }
  function warpOutputs(mapping, bx, by, ty) {
    const out = [];
    for (let tx = 0; tx < 32; tx++) out.push(owner(mapping, bx, by, tx, ty));
    return out;
  }

  function mount(sel) {
    const host = document.querySelector(sel); if (!host) return;
    let mapping = 'naive', bx = 0, by = 0, tx = 5, ty = 2;
    const el = (tag, cls, text, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; if (parent) parent.appendChild(e); return e; };
    function num(label, value, max, set, parent) {
      const l = el('label', 'gl-num', label + ' ', parent); const i = el('input', null, null, l);
      i.type = 'number'; i.min = 0; i.max = max; i.value = value;
      i.onchange = () => { const v = Math.max(0, Math.min(max, Math.round(+i.value || 0))); set(v); render(); host.querySelector(`[data-f="${label}"]`)?.focus(); };
      i.dataset.f = label; return i;
    }
    function render() {
      host.replaceChildren(); host.classList.add('gl-lab');
      const seg = el('div', 'gl-seg', null, el('div', 'gl-row', null, host));
      for (const [k, label] of [['naive', 'naive: threadIdx.x picks the row'], ['swapped', 'swapped: threadIdx.x picks the column']]) {
        const b = el('button', mapping === k ? 'on' : '', label, seg); b.type = 'button'; b.setAttribute('aria-pressed', mapping === k); b.onclick = () => { mapping = k; render(); };
      }
      const row1 = el('div', 'gl-row', null, host);
      num('blockIdx.x', bx, GRID - 1, (v) => (bx = v), row1); num('blockIdx.y', by, GRID - 1, (v) => (by = v), row1);
      num('threadIdx.x', tx, BD - 1, (v) => (tx = v), row1); num('threadIdx.y', ty, BD - 1, (v) => (ty = v), row1);

      const o = owner(mapping, bx, by, tx, ty);
      const calc = el('div', 'gl-calc', null, host);
      // Each token is text, 'u' (uniform across the warp) or 'v' (varying across the warp).
      const line = (parts) => { const d = el('div', null, null, calc); for (const [t, c] of parts) { if (c) el('span', c, t, d); else d.append(t); } };
      const U = (t) => [t, 'u'], V = (t) => [t, 'v'], T = (t) => [t, null];
      if (mapping === 'naive') {
        line([V('row'), T(' = '), U('blockIdx.x'), T(' × 32 + '), V('threadIdx.x'), T(` = ${bx} × 32 + ${tx} = ${o.row}`)]);
        line([U('col'), T(' = '), U('blockIdx.y'), T(' × 32 + '), U('threadIdx.y'), T(` = ${by} × 32 + ${ty} = ${o.col}`)]);
      } else {
        line([V('col'), T(' = '), U('blockIdx.x'), T(' × 32 + '), V('threadIdx.x'), T(` = ${bx} × 32 + ${tx} = ${o.col}`)]);
        line([U('row'), T(' = '), U('blockIdx.y'), T(' × 32 + '), U('threadIdx.y'), T(` = ${by} × 32 + ${ty} = ${o.row}`)]);
      }
      el('p', null, `This thread computes C[${o.row}][${o.col}]: it walks row ${o.row} of A and column ${o.col} of B, 4,096 multiply-adds.`, host);

      // The 32 x 32 patch of C owned by this block, with the thread and its warp highlighted.
      const w = warpOutputs(mapping, bx, by, ty);
      const r0 = mapping === 'naive' ? bx * BD : by * BD, c0 = mapping === 'naive' ? by * BD : bx * BD;
      const fig = el('div', 'gl-patch-wrap', null, host);
      el('div', 'gl-cap', `the block's 32 × 32 patch of C: rows ${r0}–${r0 + 31} ↓, columns ${c0}–${c0 + 31} →`, fig);
      const patch = el('div', 'gl-patch', null, fig);
      const warpSet = new Set(w.map((p) => p.row + ',' + p.col));
      for (let r = r0; r < r0 + BD; r++) for (let c = c0; c < c0 + BD; c++) {
        const cell = el('span', null, null, patch);
        if (r === o.row && c === o.col) cell.className = 'me'; else if (warpSet.has(r + ',' + c)) cell.className = 'warp';
      }
      const legend = el('div', 'gl-row gl-cap', null, fig);
      for (const [cls, text] of [['me', 'this thread'], ['warp', 'its warp: threadIdx.x 0–31, same threadIdx.y']]) {
        const item = el('span', 'gl-keyitem', null, legend); el('span', 'gl-key ' + cls, null, item); item.append(' ' + text);
      }

      const out = el('div', 'gl-out', null, host); out.setAttribute('role', 'status');
      const vertical = mapping === 'naive';
      el('p', 'gl-strong', vertical
        ? `The warp owns a vertical strip: C[${w[0].row}…${w[31].row}][${w[0].col}]. Same column, 32 different rows.`
        : `The warp owns a horizontal strip: C[${w[0].row}][${w[0].col}…${w[31].col}]. Same row, 32 neighbouring columns.`, out);
      el('p', null, vertical
        ? 'So at each step of the loop its 32 threads read 32 different rows of A (16 KB apart) and one shared float of B.'
        : 'So at each step of the loop its 32 threads read one shared float of A and 32 neighbouring floats of B (128 contiguous bytes).', out);
    }
    render();
  }
  return { owner, warpOutputs, mount, N, BD, GRID };
});
