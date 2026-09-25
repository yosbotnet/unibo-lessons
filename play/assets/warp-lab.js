// Warp access lab: which 32-byte memory sectors do the 32 threads of one warp touch
// when each reads its element of A, B or C in the matmul loop?
// Model: 4-byte floats, row-major N x N matrices, one warp = threadIdx.x 0..31 with the
// same threadIdx.y, memory served in 32-byte sectors (the unit a modern NVIDIA GPU moves).
(function (root, factory) { const api = factory(); if (typeof module === 'object' && module.exports) module.exports = api; else root.WarpLab = api; })(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SECTOR = 32, FLOAT = 4, WARP = 32;
  const MAPPINGS = {
    naive: { label: 'naive: threadIdx.x picks the row', row: (tx) => tx, col: () => 0 },
    coalesced: { label: 'swapped: threadIdx.x picks the column', row: () => 0, col: (tx) => tx }
  };
  // Element index read by thread tx at loop step k, for each matrix of C[row][col] += A[row][k] * B[k][col].
  function index(matrix, m, tx, k, N) {
    const row = m.row(tx), col = m.col(tx);
    if (matrix === 'A') return row * N + k;
    if (matrix === 'B') return k * N + col;
    return row * N + col;
  }
  function access(mapping, matrix, N, k = 0) {
    const m = MAPPINGS[mapping];
    if (!m) throw Error('unknown mapping ' + mapping);
    const addrs = [];
    for (let tx = 0; tx < WARP; tx++) addrs.push(index(matrix, m, tx, k, N) * FLOAT);
    const sectors = [...new Set(addrs.map((a) => Math.floor(a / SECTOR)))];
    const distinct = new Set(addrs).size;
    const moved = sectors.length * SECTOR, used = distinct * FLOAT;
    return { addrs, sectors, distinct, moved, used, efficiency: used / moved, broadcast: distinct === 1 };
  }
  function summary(mapping, N) {
    const r = {};
    for (const mtx of ['A', 'B', 'C']) r[mtx] = access(mapping, mtx, N);
    // Per loop iteration a warp issues one load of A and one of B; C is written once at the end.
    r.loopSectors = r.A.sectors.length + r.B.sectors.length;
    return r;
  }

  function mount(sel) {
    const host = document.querySelector(sel); if (!host) return;
    let mapping = 'naive', N = 4096, matrix = 'A';
    const el = (tag, cls, text, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; if (parent) parent.appendChild(e); return e; };
    function render() {
      host.replaceChildren(); host.classList.add('gl-lab');
      const bar = el('div', 'gl-row', null, host);
      const ms = el('div', 'gl-seg', null, bar);
      for (const [k, v] of Object.entries(MAPPINGS)) { const b = el('button', mapping === k ? 'on' : '', v.label, ms); b.type = 'button'; b.setAttribute('aria-pressed', mapping === k); b.onclick = () => { mapping = k; render(); }; }
      const mt = el('div', 'gl-seg', null, bar);
      for (const k of ['A', 'B', 'C']) { const b = el('button', matrix === k ? 'on' : '', 'reads of ' + k, mt); b.type = 'button'; b.setAttribute('aria-pressed', matrix === k); b.onclick = () => { matrix = k; render(); }; }
      const nl = el('label', 'gl-n', 'N = ', bar); const ni = el('select', null, null, nl);
      for (const v of [64, 1024, 4096]) { const o = el('option', null, String(v), ni); o.value = v; } ni.value = N; ni.onchange = () => { N = +ni.value; render(); };

      const r = access(mapping, matrix, N);
      const warp = el('div', 'gl-warp', null, host); el('div', 'gl-cap', 'one warp: threads t0-t31, each reading its ' + matrix + ' element; sN = the sector it lands in', warp);
      const cells = el('div', 'gl-cells', null, warp);
      const palette = new Map(r.sectors.map((s, i) => [s, i]));
      r.addrs.forEach((a, tx) => { const si = palette.get(Math.floor(a / SECTOR)); const c = el('div', 'gl-cell', null, cells); c.dataset.s = si % 8; el('b', null, 't' + tx, c); el('span', null, 's' + si, c); c.title = `thread ${tx}: byte ${a}, sector s${si}`; });
      const mem = el('div', 'gl-warp', null, host);
      el('div', 'gl-cap', `memory sectors fetched (32 bytes each): ${r.sectors.length}`, mem);
      const strip = el('div', 'gl-cells', null, mem);
      r.sectors.slice(0, 32).forEach((s, i) => { const c = el('div', 'gl-cell gl-sector', null, strip); c.dataset.s = i % 8; const usedHere = r.addrs.filter((a) => Math.floor(a / SECTOR) === s).length; el('b', null, 's' + i, c); el('span', null, usedHere * FLOAT + '/32B', c); c.title = `sector ${s}: ${usedHere * FLOAT} of 32 bytes used`; });
      const s = summary(mapping, N);
      const out = el('div', 'gl-out', null, host); out.setAttribute('role', 'status');
      el('p', null, r.broadcast ? `${matrix}: all 32 threads want the same float, so one ${SECTOR}-byte sector serves the whole warp (a broadcast): cheap.` : `${matrix}: ${r.moved} bytes moved for the ${r.used} bytes the warp actually needs · efficiency ${(r.efficiency * 100).toFixed(1)}%`, out);
      el('p', 'gl-strong', `Each step of the k-loop, this warp costs ${s.loopSectors} sectors (A ${s.A.sectors.length} + B ${s.B.sectors.length}).`, out);
      if (mapping === 'naive') el('p', null, 'Try the other mapping. Same arithmetic, same answer: only who reads what changes.', out);
      else el('p', null, `That is ${summary('naive', N).loopSectors / s.loopSectors}x fewer sectors per step than the naive mapping.`, out);
    }
    render();
  }
  return { access, summary, MAPPINGS, mount };
});
