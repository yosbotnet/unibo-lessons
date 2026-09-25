// Matmul refresher: tap a cell of C, see the row of A and the column of B it needs,
// and the dot product written out. Small integers so the arithmetic can be checked by eye.
(function (root, factory) { const api = factory(); if (typeof module === 'object' && module.exports) module.exports = api; else root.MatmulLab = api; })(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const A = [[1, 2, 0], [3, 1, 2], [0, 4, 1]];
  const B = [[2, 0, 1], [1, 3, 0], [4, 1, 2]];
  const n = 3;
  function cell(i, j) { let s = 0; const terms = []; for (let k = 0; k < n; k++) { s += A[i][k] * B[k][j]; terms.push(`${A[i][k]}·${B[k][j]}`); } return { value: s, terms }; }
  function mount(sel) {
    const host = document.querySelector(sel); if (!host) return;
    let i = 0, j = 0;
    const el = (tag, cls, text, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; if (parent) parent.appendChild(e); return e; };
    function matrix(name, M, hl, clickable, parent) {
      const box = el('div', 'gl-mat', null, parent); el('div', 'gl-matname', name, box);
      const grid = el('div', 'gl-matgrid', null, box);
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        const b = el(clickable ? 'button' : 'span', hl(r, c) ? 'hl' : '', String(M[r][c]), grid);
        if (clickable) { b.type = 'button'; b.setAttribute('aria-label', `C[${r}][${c}]`); b.onclick = () => { i = r; j = c; render(); host.querySelector(`[aria-label="C[${r}][${c}]"]`).focus(); }; }
      }
    }
    function render() {
      host.replaceChildren(); host.classList.add('gl-lab');
      const C = Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => cell(r, c).value));
      const row = el('div', 'gl-mats', null, host);
      matrix('A', A, (r) => r === i, false, row); el('span', 'gl-op', '×', row);
      matrix('B', B, (r, c) => c === j, false, row); el('span', 'gl-op', '=', row);
      matrix('C (tap a cell)', C, (r, c) => r === i && c === j, true, row);
      const x = cell(i, j);
      const out = el('div', 'gl-out', null, host); out.setAttribute('role', 'status');
      el('p', 'gl-strong', `C[${i}][${j}] = row ${i} of A · column ${j} of B = ${x.terms.join(' + ')} = ${x.value}`, out);
      el('p', null, `Its right neighbour C[${i}][${(j + 1) % n}] uses the same row ${i} of A; its lower neighbour C[${(i + 1) % n}][${j}] uses the same column ${j} of B. Tap them to see.`, out);
    }
    render();
  }
  return { A, B, cell, mount };
});
