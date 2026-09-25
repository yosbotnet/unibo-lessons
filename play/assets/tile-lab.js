// Tile walker: one block of the tiled kernel, step by step. The picture is scaled down to an
// 8 x 8 grid of 32 x 32 tiles; the counters are for the real 4096 x 4096 problem (128 tiles a side).
(function (root, factory) { const api = factory(); if (typeof module === 'object' && module.exports) module.exports = api; else root.TileLab = api; })(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const T = 32, N = 4096, STEPS = N / T, VIEW = 8;
  // Per block and per step: 2 tiles of T*T floats loaded, T*T threads x T multiply-adds.
  function perStep() { return { floats: 2 * T * T, fma: T * T * T }; }
  function totals() {
    const naiveBytes = 2 * N ** 3 * 4;            // every multiply-add fetches two floats from global memory
    const tiledBytes = (2 * N ** 3 / T) * 4;      // each fetched float feeds T multiply-adds
    return { naiveBytes, tiledBytes, ratio: naiveBytes / tiledBytes, intensityNaive: 2 / 8, intensityTiled: (2 * T) / 8 };
  }
  function mount(sel) {
    const host = document.querySelector(sel); if (!host) return;
    let bi = 2, bj = 5, t = 0;
    const el = (tag, cls, text, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; if (parent) parent.appendChild(e); return e; };
    const gb = (b) => (b / 1e9).toFixed(1) + ' GB';
    function grid(name, cls, pick) {
      const box = el('div', 'gl-mat', null); el('div', 'gl-matname', name, box);
      const g = el('div', 'gl-tilegrid', null, box);
      for (let r = 0; r < VIEW; r++) for (let c = 0; c < VIEW; c++) { const s = el(cls === 'C' ? 'button' : 'span', pick(r, c) || '', null, g); if (cls === 'C') { s.type = 'button'; s.setAttribute('aria-label', `block (${r}, ${c})`); s.onclick = () => { bi = r; bj = c; t = 0; render(); }; } }
      return box;
    }
    function render() {
      host.replaceChildren(); host.classList.add('gl-lab');
      const row = el('div', 'gl-mats', null, host);
      const tv = Math.min(t, VIEW - 1);
      row.appendChild(grid('A: tiles of row-strip ' + bi, 'A', (r, c) => (r === bi && c === tv ? 'now' : r === bi && c < tv ? 'done' : r === bi ? 'strip' : '')));
      el('span', 'gl-op', '×', row);
      row.appendChild(grid('B: tiles of column-strip ' + bj, 'B', (r, c) => (c === bj && r === tv ? 'now' : c === bj && r < tv ? 'done' : c === bj ? 'strip' : '')));
      el('span', 'gl-op', '=', row);
      row.appendChild(grid('C: tap a block', 'C', (r, c) => (r === bi && c === bj ? 'me' : '')));
      const ctr = el('div', 'gl-row', null, host);
      const prev = el('button', null, '◀ previous step', ctr); prev.type = 'button'; prev.disabled = t === 0; prev.onclick = () => { t--; render(); };
      const next = el('button', null, 'next step ▶', ctr); next.type = 'button'; next.disabled = t >= VIEW - 1; next.onclick = () => { t++; render(); };
      el('span', 'gl-cap', `step t = ${t} (drawn with 8 tiles a side; the real matrix has ${STEPS})`, ctr);
      const p = perStep(), s = t + 1;
      const out = el('div', 'gl-out', null, host); out.setAttribute('role', 'status');
      el('p', 'gl-strong', `Step ${t}: the block copies tile (${bi}, ${t}) of A and tile (${t}, ${bj}) of B into shared memory: ${p.floats.toLocaleString('en')} floats from global memory, one per thread per tile.`, out);
      el('p', null, `Then its 1,024 threads do ${p.fma.toLocaleString('en')} multiply-adds reading only shared memory: each loaded float is used by 32 threads. So far: ${(s * p.floats).toLocaleString('en')} floats loaded for ${(s * p.fma).toLocaleString('en')} multiply-adds.`, out);
      const tt = totals();
      el('p', null, `Whole problem: the untiled kernels ask global memory for ${gb(tt.naiveBytes)} in total; tiling brings it to ${gb(tt.tiledBytes)}, ${tt.ratio}x less. Intensity goes from ${tt.intensityNaive} to ${tt.intensityTiled} FLOP per byte.`, out);
    }
    render();
  }
  return { T, N, STEPS, perStep, totals, mount };
});
