/* ch10.js - chapter 10 widgets: the attention explorer (toy T = 8, D = 4) and the block cost model. */
(function () {
  'use strict';
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function btn(txt) { var b = el('button', null, txt); b.type = 'button'; return b; }
  function stat(parent, k) { var d = el('div', 'w-stat'); d.appendChild(el('span', 'k', k)); var v = el('span', 'v'); d.appendChild(v); parent.appendChild(d); return v; }
  var SVGNS = 'http://www.w3.org/2000/svg';
  function cross() {   // the -inf glyph: a small drawn cross, no unicode
    var s = document.createElementNS(SVGNS, 'svg'); s.setAttribute('viewBox', '0 0 10 10'); s.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS(SVGNS, 'path'); p.setAttribute('d', 'M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5');
    p.setAttribute('stroke', 'currentColor'); p.setAttribute('stroke-width', '1.6'); p.setAttribute('fill', 'none');
    s.appendChild(p); return s;
  }

  /* ================= attention explorer ================= */
  var ah = document.getElementById('w-attn-explorer');
  if (ah) {
    var T = 8, D = 4, DEFAULT_SEED = 11;
    var st = { seed: DEFAULT_SEED, mask: true, scale: true, sel: 5 };
    var Q, K, V;
    function rng(seed) {   // mulberry32
      var a = seed >>> 0;
      return function () { a = (a + 0x6D2B79F5) >>> 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    }
    function gen() {
      var r = rng(st.seed);
      function m() { var x = []; for (var i = 0; i < T; i++) { x.push([]); for (var d = 0; d < D; d++) x[i].push(Math.floor(r() * 5) - 2); } return x; }
      Q = m(); K = m(); V = m();
    }
    function compute(scaleOn, maskOn) {
      var sc = scaleOn ? 1 / Math.sqrt(D) : 1, S = [], P = [], O = [];
      for (var i = 0; i < T; i++) {
        S.push([]); P.push([]); O.push([]);
        var mx = -Infinity;
        for (var j = 0; j < T; j++) {
          var s = 0; for (var d = 0; d < D; d++) s += Q[i][d] * K[j][d];
          s = (maskOn && j > i) ? -Infinity : s * sc;
          S[i].push(s); if (s > mx) mx = s;
        }
        var sum = 0;
        for (j = 0; j < T; j++) { var e = S[i][j] === -Infinity ? 0 : Math.exp(S[i][j] - mx); P[i].push(e); sum += e; }
        for (j = 0; j < T; j++) P[i][j] /= sum;
        for (d = 0; d < D; d++) { var o = 0; for (j = 0; j < T; j++) o += P[i][j] * V[j][d]; O[i].push(o); }
      }
      return { S: S, P: P, O: O };
    }
    function f2(x) { var s = x.toFixed(2); return s === '-0.00' ? '0.00' : s; }

    ah.innerHTML = '';
    ah.appendChild(el('h4', null, 'Attention at toy size: T = 8 tokens, D = 4'));
    ah.appendChild(el('p', 'w-sub', 'Q, K and V hold small integers, one row per token. S = Q K^T / sqrt(D), P = softmax of each row of S, O = P V. Click a row of Q or O (or focus the matrices and use the up and down keys): see which keys that query is scored against, the weights it gives them, and the values it averages.'));
    var bar = el('div', 'c10-btns');
    var bMask = btn('causal mask'), bScale = btn('scale 1/sqrt(D)'), bRand = btn('randomize'), bReset = btn('reset');
    [bMask, bScale, bRand, bReset].forEach(function (b) { bar.appendChild(b); });
    ah.appendChild(bar);
    var cards = el('div', 'c10-cards'); cards.tabIndex = 0; cards.setAttribute('role', 'group');
    cards.setAttribute('aria-label', 'Attention matrices; up and down arrows change the selected query row');
    ah.appendChild(cards);

    function mkCard(parent, title, sub, cols, wide, click) {
      var c = el('div', 'c10-card'); var tt = el('div', 'c10-ct', title + ' '); tt.appendChild(el('small', null, sub)); c.appendChild(tt);
      var wrap = el('div', 'c10-withlab');
      var lab = el('div', 'c10-rowlab'); for (var i = 0; i < T; i++) lab.appendChild(el('span', null, 't' + i)); wrap.appendChild(lab);
      var g = el('div', 'c10-m' + (wide ? ' wide' : '') + (click ? ' click' : '')); g.style.gridTemplateColumns = 'repeat(' + cols + ', auto)';
      g.setAttribute('aria-hidden', 'true');
      var cells = [];
      for (i = 0; i < T; i++) { cells.push([]); for (var j = 0; j < cols; j++) { var x = el('span', 'c10-c'); x.dataset.r = i; g.appendChild(x); cells[i].push(x); } }
      if (click) g.addEventListener('click', function (ev) { var t = ev.target.closest('.c10-c'); if (t) { st.sel = +t.dataset.r; render(); } });
      wrap.appendChild(g); c.appendChild(wrap); parent.appendChild(c);
      return { cells: cells, wrap: wrap };
    }
    var cQ = mkCard(cards, 'Q [8, 4]', 'queries: click a row', D, false, true);
    var cK = mkCard(cards, 'K [8, 4]', 'keys', D, false, false);
    var cV = mkCard(cards, 'V [8, 4]', 'values, bar = p', D, false, false);
    var vb = el('div', 'c10-vbars'); var vbars = [];
    for (var i = 0; i < T; i++) { var r = el('div', 'c10-vbar'); var ii = el('i'); r.appendChild(ii); vb.appendChild(r); vbars.push(ii); }
    cV.wrap.appendChild(vb);
    var cS = mkCard(cards, 'S [8, 8]', 'scores, keys j across', T, true, false);
    var cP = mkCard(cards, 'P [8, 8]', 'softmax of each row', T, true, false);
    var cO = mkCard(cards, 'O [8, 4]', 'outputs: click a row', D, true, true);
    var key = el('div', 'c10-key');
    [['q', 'the selected query'], ['k', 'keys it may read'], ['p', 'its weights p (darker = larger)'], ['o', 'its output o = sum p v']].forEach(function (k) {
      var s = el('span'); s.appendChild(el('i', k[0])); s.appendChild(document.createTextNode(k[1])); key.appendChild(s);
    });
    var xs = el('span'); xs.appendChild(cross()); xs.firstChild.style.width = '10px'; xs.firstChild.style.height = '10px';
    xs.appendChild(document.createTextNode('= -inf (masked)')); key.appendChild(xs);
    ah.appendChild(key);
    var read = el('div', 'w-verdict comp c10-read'); read.setAttribute('aria-live', 'polite'); ah.appendChild(read);

    function shade(cell, p) {
      var x = Math.round(p * 85);
      cell.style.background = 'color-mix(in srgb, var(--lk-forest) ' + x + '%, var(--lk-paper-light))';
      cell.classList.toggle('pd', x > 42);
    }
    function render() {
      bMask.setAttribute('aria-pressed', String(st.mask)); bScale.setAttribute('aria-pressed', String(st.scale));
      bMask.textContent = 'causal mask: ' + (st.mask ? 'on' : 'off'); bScale.textContent = 'scale 1/sqrt(D): ' + (st.scale ? 'on' : 'off');
      var R = compute(st.scale, st.mask), s = st.sel;
      var lastKey = st.mask ? s : T - 1;
      function fillInt(card, M, cls, rowsLit) {
        for (var i = 0; i < T; i++) for (var d = 0; d < D; d++) {
          var c = card.cells[i][d]; c.textContent = String(M[i][d]);
          c.className = 'c10-c' + (rowsLit(i) ? ' ' + cls : '');
        }
      }
      fillInt(cQ, Q, 'q', function (i) { return i === s; });
      fillInt(cK, K, 'k', function (i) { return i <= lastKey; });
      fillInt(cV, V, 'k', function (i) { return i <= lastKey; });
      for (var i = 0; i < T; i++) {
        vbars[i].style.width = Math.round(R.P[s][i] * 46) + 'px';
        for (var j = 0; j < T; j++) {
          var cs = cS.cells[i][j], cp = cP.cells[i][j], sv = R.S[i][j];
          cs.className = 'c10-c'; cp.className = 'c10-c'; cs.style.background = ''; cp.style.background = '';
          cs.textContent = '';
          if (sv === -Infinity) { cs.appendChild(cross()); cs.classList.add('dim'); } else cs.textContent = f2(sv);
          cp.textContent = f2(R.P[i][j]);
          if (R.P[i][j] === 0 && sv === -Infinity) cp.classList.add('dim');
          if (i === s) { shade(cs, R.P[i][j]); shade(cp, R.P[i][j]); }
        }
        for (var d = 0; d < D; d++) { var co = cO.cells[i][d]; co.textContent = f2(R.O[i][d]); co.className = 'c10-c' + (i === s ? ' o' : ''); }
      }
      var best = 0; for (j = 1; j < T; j++) if (R.P[s][j] > R.P[s][best]) best = j;
      var n = lastKey + 1;
      var ties = []; for (j = 0; j < T; j++) if (f2(R.P[s][j]) === f2(R.P[s][best])) ties.push(j);
      var msg = 'Token ' + s + ' reads ' + n + ' token' + (n > 1 ? 's' : '') + '; the largest weight is on token' +
        (ties.length > 1 ? 's ' + ties.join(', ') + ' (p = ' + f2(R.P[s][best]) + ' each).' : ' ' + best + ' (p = ' + f2(R.P[s][best]) + ').');
      if (st.mask && s === 0) msg += ' Row 0 has one live score, so p = 1 and o0 = v0 exactly.';
      if (!st.mask) msg += ' Without the mask it also reads tokens after itself, which a model generating left to right may not see.';
      if (!st.scale) {
        var A = compute(true, st.mask), b2 = 0; for (j = 1; j < T; j++) if (A.P[s][j] > A.P[s][b2]) b2 = j;
        msg += ' Scores without 1/sqrt(D) are twice as large; the row sharpens: the top weight is ' + f2(R.P[s][best]) + ' instead of ' + f2(A.P[s][b2]) + ' with the scale.';
      }
      read.textContent = msg;
    }
    bMask.addEventListener('click', function () { st.mask = !st.mask; render(); });
    bScale.addEventListener('click', function () { st.scale = !st.scale; render(); });
    bRand.addEventListener('click', function () { st.seed = (st.seed * 7919 + 104729) % 1000003; gen(); render(); });
    bReset.addEventListener('click', function () { st = { seed: DEFAULT_SEED, mask: true, scale: true, sel: 5 }; gen(); render(); });
    cards.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        st.sel = (st.sel + (e.key === 'ArrowDown' ? 1 : T - 1)) % T; e.preventDefault(); render();
      }
    });
    gen(); render();
  }

  /* ================= block cost vs T and B ================= */
  var bh = document.getElementById('w-block-cost');
  if (bh) {
    var BW = 590e9, PK = 30.9e12, C = 768, NH = 12, F = 3072;
    var TS = [128, 256, 512, 1024, 2048, 4096, 8192], BS = [1, 2, 4, 8];
    var OPS = [
      { k: 'ln1', name: 'layernorm 1', cls: 'oth' }, { k: 'qkv', name: 'QKV GEMM', cls: 'gemm' },
      { k: 'sc', name: 'scores QK^T', cls: 'att' }, { k: 'sm', name: 'softmax', cls: 'sm' },
      { k: 'pv', name: 'weighted sum PV', cls: 'att' }, { k: 'proj', name: 'output proj.', cls: 'gemm' },
      { k: 'ln2', name: 'layernorm 2', cls: 'oth' }, { k: 'fc', name: 'MLP up', cls: 'gemm' }, { k: 'fc2', name: 'MLP down', cls: 'gemm' }
    ];
    var CLS = [{ c: 'gemm', name: 'weight GEMMs' }, { c: 'att', name: 'attention matmuls' }, { c: 'sm', name: 'softmax over S' }, { c: 'oth', name: 'norms' }];
    // [FLOPs, ideal bytes] per op for one layer; skip = causal tiles skipped (section 6)
    function model(T, B, skip) {
      var M = B * T, S = B * NH * T * T * 4, f = skip ? 0.5 : 1, act = M * C * 4;
      return {
        ln1: [5 * M * C, 2 * act], ln2: [5 * M * C, 2 * act],
        qkv: [2 * M * C * 3 * C, act + C * 3 * C * 4 + M * 3 * C * 4],
        sc: [2 * B * NH * T * T * 64 * f, S * f + 2 * act],
        sm: [5 * B * NH * T * T * f, 2 * S * f],
        pv: [2 * B * NH * T * T * 64 * f, S * f + 2 * act],
        proj: [2 * M * C * C, 3 * act + C * C * 4],
        fc: [2 * M * C * F, act + C * F * 4 + M * F * 4],
        fc2: [2 * M * F * C, M * F * 4 + F * C * 4 + 2 * act]
      };
    }
    function us(x) { return x >= 1000 ? (x / 1000).toFixed(x >= 10000 ? 1 : 2) + ' ms' : x.toFixed(x >= 100 ? 0 : 1) + ' \u00b5s'; }
    function bytes(x) { return x >= 1e9 ? (x / 1e9).toFixed(1) + ' GB' : (x / 1e6).toFixed(x >= 1e8 ? 0 : 1) + ' MB'; }

    bh.innerHTML = '';
    bh.appendChild(el('h4', null, 'Where one block\u2019s time goes, as T and B grow'));
    bh.appendChild(el('p', 'w-sub', 'Modelled, not measured: each op of one GPT-2 small layer takes max(FLOPs / 30.9 TFLOPS, ideal bytes / 590 GB/s), FP32, naive attention with S in DRAM. Slide the context length and the batch.'));
    var ctr = el('div', 'w-controls');
    var lT = el('label'); lT.appendChild(document.createTextNode('Context length T: ')); var oT = el('output'); lT.appendChild(oT);
    var iT = el('input'); iT.type = 'range'; iT.min = 0; iT.max = TS.length - 1; iT.step = 1; iT.value = 3; lT.appendChild(iT); ctr.appendChild(lT);
    var lB = el('label'); lB.appendChild(document.createTextNode('Batch B: ')); var oB = el('output'); lB.appendChild(oB);
    var iB = el('input'); iB.type = 'range'; iB.min = 0; iB.max = BS.length - 1; iB.step = 1; iB.value = 0; lB.appendChild(iB); ctr.appendChild(lB);
    var lS = el('label', 'c10-check'); var iS = el('input'); iS.type = 'checkbox';
    lS.appendChild(iS); lS.appendChild(el('span', null, 'causal skip: do not compute the masked half (section 6)'));
    ctr.appendChild(lS);
    bh.appendChild(ctr);
    var sb = el('div', 'c10-stackbar'); sb.setAttribute('role', 'img'); var segs = {};
    CLS.forEach(function (c) { var s = el('span', 'c10-cls-' + c.c); segs[c.c] = s; sb.appendChild(s); });
    bh.appendChild(sb);
    var leg = el('div', 'c10-legend'); var legv = {};
    CLS.forEach(function (c) { var s = el('span'); s.appendChild(el('i', 'c10-cls-' + c.c)); var tx = el('span'); s.appendChild(tx); legv[c.c] = tx; legv[c.c].dataset.name = c.name; leg.appendChild(s); });
    bh.appendChild(leg);
    var out = el('div', 'w-out');
    var vShare = stat(out, 'attention core: time'), vFl = stat(out, 'attention: FLOPs'), vS = stat(out, 'S per layer'), vL = stat(out, 'one layer / x 12');
    bh.appendChild(out);
    var ops = el('div', 'w-bars c10-ops'); var orow = {};
    OPS.forEach(function (o) {
      var r = el('div', 'w-bar'); r.appendChild(el('span', null, o.name));
      var tr = el('span', 'track'); var fi = el('span', 'fill ' + o.cls); fi.style.display = 'block'; tr.appendChild(fi); r.appendChild(tr);
      var nm = el('span', 'num'); r.appendChild(nm); ops.appendChild(r); orow[o.k] = { fill: fi, num: nm };
    });
    bh.appendChild(ops);
    var ver = el('div', 'w-verdict'); ver.setAttribute('aria-live', 'polite'); bh.appendChild(ver);
    bh.appendChild(el('p', 'c10-note', 'Attention core = scores + softmax + weighted sum. Bars: roofline time per op. Left out: the KV append (only with a cache, 21 \u00b5s at T = 1,024), the embedding and the LM head (section 8).'));

    function render() {
      var T = TS[+iT.value], B = BS[+iB.value], skip = iS.checked;
      oT.textContent = T.toLocaleString('en-US'); oB.textContent = String(B);
      var m = model(T, B, skip), t = {}, tot = 0, fl = 0, by = {}, mx = 0;
      OPS.forEach(function (o) { var x = Math.max(m[o.k][0] / PK, m[o.k][1] / BW) * 1e6; t[o.k] = x; tot += x; fl += m[o.k][0]; mx = Math.max(mx, x); by[o.cls] = (by[o.cls] || 0) + x; });
      CLS.forEach(function (c) {
        var p = 100 * by[c.c] / tot; segs[c.c].style.width = p + '%';
        legv[c.c].textContent = legv[c.c].dataset.name + ' ' + p.toFixed(0) + '%';
      });
      sb.setAttribute('aria-label', CLS.map(function (c) { return c.name + ' ' + (100 * by[c.c] / tot).toFixed(0) + '%'; }).join(', '));
      OPS.forEach(function (o) { orow[o.k].fill.style.width = (100 * t[o.k] / mx) + '%'; orow[o.k].num.textContent = us(t[o.k]); });
      var att = t.sc + t.sm + t.pv, attF = m.sc[0] + m.sm[0] + m.pv[0];
      vShare.textContent = (100 * att / tot).toFixed(0) + '% (' + us(att) + ')';
      vFl.textContent = (100 * attF / fl).toFixed(0) + '% of FLOPs';
      var Sb = B * NH * T * T * 4;
      vS.className = 'v mem'; vS.textContent = bytes(Sb);
      if (Sb > 8e9) { var sm = el('small', null, 'does not fit in 12 GB'); vS.appendChild(sm); }
      vL.textContent = us(tot) + ' / ' + us(12 * tot);
      var gem = t.qkv + t.proj + t.fc + t.fc2;
      if (Sb > 8e9) { ver.className = 'w-verdict bad'; ver.textContent = 'S alone is ' + bytes(Sb) + ' per layer: with the weights and the other activations it does not fit on a 12 GB card. Naive attention stops here, whatever its speed.'; }
      else if (att > gem) { ver.className = 'w-verdict bad'; ver.textContent = 'The three attention kernels take ' + (att / gem).toFixed(1) + 'x the time of the four weight GEMMs, for ' + (100 * attF / fl).toFixed(0) + '% of the FLOPs: the time is the passes over S, which grow with T\u00b2 while everything else grows with T.'; }
      else { ver.className = 'w-verdict comp'; ver.textContent = 'The weight GEMMs still dominate: attention is ' + (100 * att / tot).toFixed(0) + '% of the time for ' + (100 * attF / fl).toFixed(0) + '% of the FLOPs. Its share grows with T, not with B: both S and the GEMMs scale with B.'; }
    }
    [iT, iB, iS].forEach(function (x) { x.addEventListener('input', render); x.addEventListener('change', render); });
    render();
  }
})();
