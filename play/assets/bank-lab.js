// Bank lab: shared memory is split into 32 banks of 4 bytes; float i of a shared array lives in
// bank i mod 32. A warp's access costs as many steps as the most distinct addresses any one bank
// must serve (same address = broadcast, served once).
(function (root, factory) { const api = factory(); if (typeof module === 'object' && module.exports) module.exports = api; else root.BankLab = api; })(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const BANKS = 32;
  const CASES = {
    asRow: { code: 'As[ty][k]', note: 'all uniform', idx: (tx, W) => 5 * W + 3 },
    bsRow: { code: 'Bs[k][tx]', note: 'varying in the last index', idx: (tx, W) => 3 * W + tx },
    asCol: { code: 'As[tx][k]', note: 'varying in the first index', idx: (tx, W) => tx * W + 3 },
  };
  function access(key, padded) {
    const W = padded ? 33 : 32;                 // row length of the shared array: [32][32] or [32][33]
    const idx = []; for (let tx = 0; tx < 32; tx++) idx.push(CASES[key].idx(tx, W));
    const perBank = Array.from({ length: BANKS }, () => new Set());
    idx.forEach((i) => perBank[i % BANKS].add(i));
    const steps = Math.max(...perBank.map((s) => s.size));
    return { idx, perBank: perBank.map((s) => s.size), steps };
  }
  function mount(sel) {
    const host = document.querySelector(sel); if (!host) return;
    let key = 'bsRow', padded = false;
    const el = (tag, cls, text, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; if (parent) parent.appendChild(e); return e; };
    function render() {
      host.replaceChildren(); host.classList.add('gl-lab');
      const seg = el('div', 'gl-seg', null, el('div', 'gl-row', null, host));
      for (const [k, c] of Object.entries(CASES)) { const b = el('button', key === k ? 'on' : '', c.code, seg); b.type = 'button'; b.setAttribute('aria-pressed', key === k); b.onclick = () => { key = k; render(); }; }
      const l = el('label', null, null, el('div', 'gl-row', null, host)); const cb = el('input', null, null, l); cb.type = 'checkbox'; cb.checked = padded; cb.onchange = () => { padded = cb.checked; render(); };
      l.append(' pad each row to 33 floats: __shared__ float As[32][33]');
      const r = access(key, padded);
      el('div', 'gl-cap', `the 32 banks; the number = how many different addresses of this warp request that bank has to serve (k = 3)`, host);
      const banks = el('div', 'gl-cells', null, host);
      r.perBank.forEach((n, b) => { const c = el('div', 'gl-cell', null, banks); c.dataset.s = n > 1 ? 1 : n === 1 ? 0 : 7; el('b', null, 'b' + b, c); el('span', null, n ? String(n) : '·', c); });
      const out = el('div', 'gl-out', null, host); out.setAttribute('role', 'status');
      el('p', 'gl-strong', `${CASES[key].code} (${CASES[key].note})${padded ? ', padded' : ''}: ${r.steps === 1 ? 'one step' : r.steps + ' steps, a ' + r.steps + '-way bank conflict'}.`, out);
      if (key === 'asRow') el('p', null, 'Every thread wants the same float: one bank, one address, broadcast to the warp.', out);
      if (key === 'bsRow') el('p', null, '32 neighbouring floats sit in 32 different banks: all served at once.', out);
      if (key === 'asCol' && !padded) el('p', null, 'Rows are 32 floats long, so going down a column adds 32 each time: every address lands in the same bank, and the bank serves them one after another.', out);
      if (key === 'asCol' && padded) el('p', null, 'With rows of 33 floats, going down a column adds 33: bank = (tx + k) mod 32, a different bank for every thread. One wasted float per row buys a 32x faster access.', out);
    }
    render();
  }
  return { CASES, access, mount };
});
