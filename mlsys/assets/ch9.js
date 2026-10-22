/* ch9.js - chapter 9 widgets: the online-softmax stepper (w-online-softmax) and the fusion byte counter (w-fusion-bytes). */
(function () {
  'use strict';
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function btn(txt, cls) { var b = el('button', cls, txt); b.type = 'button'; return b; }
  function stat(parent, k, cls) { var d = el('div', 'w-stat'); d.appendChild(el('span', 'k', k)); var v = el('span', 'v' + (cls ? ' ' + cls : '')); d.appendChild(v); parent.appendChild(d); return v; }
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ================= online softmax stepper ================= */
  var host = document.getElementById('w-online-softmax');
  if (host) {
    var DEF = [2, 5, 1, 7, 3];
    var vals = DEF.slice(), k = 0, cut = 3, timer = null;

    // The model: a pair (m, d). exp(-inf) = 0 and the first step never forms -inf - (-inf).
    function stepPair(p, x) {
      var mn = Math.max(p.m, x);
      var sc = p.m === -Infinity ? 0 : Math.exp(p.m - mn);
      return { m: mn, d: p.d * sc + Math.exp(x - mn), sc: sc };
    }
    function pairOf(a) { var p = { m: -Infinity, d: 0 }; a.forEach(function (x) { p = stepPair(p, x); }); return p; }
    function merge(a, b) {
      var m = Math.max(a.m, b.m);
      var fa = a.m === -Infinity ? 0 : Math.exp(a.m - m), fb = b.m === -Infinity ? 0 : Math.exp(b.m - m);
      return { m: m, d: a.d * fa + b.d * fb, fa: fa, fb: fb };
    }
    function f3(v) { return v.toFixed(3); }
    function num(v) {   // an input value or a max, as HTML
      if (v === -Infinity) return '&minus;&infin;';
      var s = Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(Math.abs(v))) : Math.abs(v).toFixed(3);
      return (v < 0 ? '&minus;' : '') + s;
    }
    function ex(a, b) { return 'e<sup>' + num(a) + '&minus;' + (b < 0 ? '(' + num(b) + ')' : num(b)) + '</sup>'; }

    host.innerHTML = '';
    host.setAttribute('tabindex', '0');
    host.setAttribute('aria-label', 'Online softmax stepper. Right arrow: step; left arrow: back.');
    host.appendChild(el('h4', null, 'Online softmax: one look at each element'));
    host.appendChild(el('p', 'w-sub', 'The running pair (m, d): the max so far, and the sum of the exponentials relative to it. Step through the row; when a larger element arrives, the sum is rescaled instead of recomputed. Edit any cell.'));
    var tabs = el('div', 'c9-btns'); tabs.setAttribute('role', 'tablist');
    var tA = btn('Step through'), tB = btn('Split and merge');
    [tA, tB].forEach(function (t) { t.setAttribute('role', 'tab'); tabs.appendChild(t); });
    host.appendChild(tabs);
    var paneA = el('div'), paneB = el('div');
    paneA.setAttribute('role', 'tabpanel'); paneB.setAttribute('role', 'tabpanel');
    host.appendChild(paneA); host.appendChild(paneB);

    // ---- pane A: step through
    paneA.appendChild(el('div', 'c9-lbl', 'The row'));
    var rowA = el('div', 'c9-row'); paneA.appendChild(rowA);
    var edit = el('div', 'c9-btns');
    var bAdd = btn('+ cell', 'c9-quiet'), bDel = btn('- cell', 'c9-quiet'), bRnd = btn('Random', 'c9-quiet'), bDef = btn('Default row', 'c9-quiet');
    [bAdd, bDel, bRnd, bDef].forEach(function (b) { edit.appendChild(b); });
    paneA.appendChild(edit);
    var gauges = el('div', 'c9-gauges');
    var gM = el('div', 'c9-gauge'); gM.appendChild(el('span', 'k', 'm (running max)')); var vM = el('span', 'v'); gM.appendChild(vM);
    var gD = el('div', 'c9-gauge'); gD.appendChild(el('span', 'k', 'd (running sum)')); var vD = el('span', 'v'); gD.appendChild(vD);
    var tr = el('div', 'track'), fill = el('div', 'fill'); tr.appendChild(fill); gD.appendChild(tr);
    var sc = el('span', 'sc'); gD.appendChild(sc);
    gauges.appendChild(gM); gauges.appendChild(gD); paneA.appendChild(gauges);
    var op = el('div', 'c9-op'); op.setAttribute('aria-live', 'polite'); paneA.appendChild(op);
    var ctl = el('div', 'lk-step-btns');
    var bStep = btn('Step'), bRun = btn(reduce ? 'Run (off: reduced motion)' : 'Run'), bBack = btn('Back'), bReset = btn('Reset');
    bReset.className = 'lk-step-reset';
    if (reduce) bRun.disabled = true;
    [bStep, bRun, bBack, bReset].forEach(function (b) { ctl.appendChild(b); });
    paneA.appendChild(ctl);
    var scr = el('div', 'c9-scroll'); var tbl = el('table', 'c9-ticks'); scr.appendChild(tbl); paneA.appendChild(scr);

    // ---- pane B: split and merge
    paneB.appendChild(el('div', 'c9-lbl', 'The same row, cut in two (click a gap, or use the slider)'));
    var rowB = el('div', 'c9-split'); paneB.appendChild(rowB);
    var cutCtl = el('div', 'w-controls'); var cl = el('label'); cl.appendChild(document.createTextNode('Cut after element '));
    var cutOut = el('output'); cl.appendChild(cutOut);
    var cutIn = el('input'); cutIn.type = 'range'; cutIn.min = 1; cl.appendChild(cutIn); cutCtl.appendChild(cl); paneB.appendChild(cutCtl);
    var cards = el('div', 'c9-cards'); paneB.appendChild(cards);
    var cA = el('div', 'c9-card a'), cB = el('div', 'c9-card b'), cMg = el('div', 'c9-card m');
    cards.appendChild(cA); cards.appendChild(cB); cards.appendChild(cMg);
    var conf = el('div', 'w-verdict comp'); conf.setAttribute('aria-live', 'polite'); paneB.appendChild(conf);

    var tab = 0;
    function setTab(i) {
      tab = i; stop();
      tA.setAttribute('aria-selected', String(i === 0)); tB.setAttribute('aria-selected', String(i === 1));
      paneA.hidden = i !== 0; paneB.hidden = i !== 1;
      render();
    }
    tA.addEventListener('click', function () { setTab(0); });
    tB.addEventListener('click', function () { setTab(1); });

    function cellInput(i, small) {
      var c = el('div', 'c9-cell'); var inp = el('input'); inp.type = 'number'; inp.step = '1'; inp.value = vals[i];
      inp.setAttribute('aria-label', 'element ' + (i + 1));
      inp.addEventListener('input', function () { var v = parseFloat(inp.value); if (!isNaN(v) && isFinite(v) && Math.abs(v) < 1000) { vals[i] = v; render(true); } });
      inp.addEventListener('keydown', function (e) { e.stopPropagation(); });
      c.appendChild(inp); c.appendChild(el('span', 'ix', small ? String(i + 1) : 'x' + (i + 1)));
      return c;
    }
    function buildRows() {
      rowA.innerHTML = ''; rowB.innerHTML = '';
      for (var i = 0; i < vals.length; i++) rowA.appendChild(cellInput(i, false));
      for (i = 0; i < vals.length; i++) {
        if (i > 0) {
          (function (g) {
            var gap = btn('', 'c9-gap'); gap.setAttribute('aria-label', 'cut after element ' + g);
            gap.addEventListener('click', function () { cut = g; render(); });
            rowB.appendChild(gap);
          })(i);
        }
        rowB.appendChild(cellInput(i, true));
      }
    }

    function render(keepRows) {
      if (!keepRows) buildRows();
      var n = vals.length;
      if (k > n) k = n;
      if (cut > n - 1) cut = n - 1;
      if (cut < 1) cut = 1;
      bDel.disabled = n <= 2; bAdd.disabled = n >= 8;
      // pane A
      var cellsA = rowA.querySelectorAll('.c9-cell');
      cellsA.forEach(function (c, i) { c.classList.toggle('done', i < k); c.classList.toggle('cur', i === k); });
      var hist = [{ m: -Infinity, d: 0 }];
      for (var i = 0; i < n; i++) hist.push(stepPair(hist[i], vals[i]));
      var p = hist[k];
      vM.innerHTML = num(p.m);
      vD.textContent = f3(p.d);
      fill.style.width = (k ? 100 * p.d / k : 0).toFixed(1) + '%';
      sc.textContent = k ? 'bar: d out of ' + k + ', its value if all ' + k + ' equalled the max' : 'bar: d out of the elements seen';
      op.className = 'c9-op';
      if (k === 0) op.innerHTML = 'Start: m = &minus;&infin;, d = 0. Nothing seen yet.';
      else {
        var a = hist[k - 1], x = vals[k - 1];
        if (a.m === -Infinity) op.innerHTML = 'Element ' + num(x) + ' is the first: m = ' + num(x) + ', d = 0 &times; e<sup>&minus;&infin;</sup> + e<sup>0</sup> = 1';
        else if (x > a.m) { op.className = 'c9-op up'; op.innerHTML = 'The max moves ' + num(a.m) + ' &rarr; ' + num(x) + ': rescale, d = ' + f3(a.d) + ' &times; ' + ex(a.m, x) + ' = ' + f3(a.d * p.sc) + ', + 1 = ' + f3(p.d); }
        else op.innerHTML = num(x) + ' &le; m = ' + num(a.m) + ': the max stands, d = ' + f3(a.d) + ' + ' + ex(x, a.m) + ' = ' + f3(a.d) + ' + ' + f3(Math.exp(x - a.m)) + ' = ' + f3(p.d);
      }
      var h = '<tr><th>Step</th><th>x</th><th>New m</th><th>Rescale e<sup>m &minus; m&prime;</sup></th><th>New d</th></tr>';
      h += '<tr><td>start</td><td></td><td>&minus;&infin;</td><td></td><td>0</td></tr>';
      for (i = 1; i <= k; i++) {
        var q = hist[i], o = hist[i - 1], xs = vals[i - 1], fac;
        if (o.m === -Infinity) fac = '0 (e<sup>&minus;&infin;</sup>)';
        else if (xs > o.m) fac = ex(o.m, xs) + ' = ' + f3(q.sc);
        else fac = '1';
        h += '<tr><td>' + i + '</td><td>' + num(xs) + '</td><td>' + num(q.m) + '</td><td>' + fac + '</td><td>' + f3(q.d) + '</td></tr>';
      }
      if (k === n) {
        var mx = hist[n].m, direct = 0;
        vals.forEach(function (v) { direct += Math.exp(v - mx); });
        h += '<tr class="c9-direct"><td colspan="5">direct: sum of e<sup>x &minus; ' + num(mx) + '</sup> = ' + f3(direct) + ': the same d, from the three-pass order</td></tr>';
      }
      tbl.innerHTML = h;
      bStep.disabled = k >= n; bBack.disabled = k <= 0;
      if (!reduce) bRun.disabled = k >= n && !timer;
      // pane B
      cutIn.max = n - 1; cutIn.value = cut; cutOut.textContent = String(cut);
      rowB.querySelectorAll('.c9-gap').forEach(function (g, j) { g.classList.toggle('on', j + 1 === cut); g.setAttribute('aria-pressed', String(j + 1 === cut)); });
      rowB.querySelectorAll('.c9-cell').forEach(function (c, j) { c.classList.toggle('half-b', j >= cut); });
      var A = pairOf(vals.slice(0, cut)), B = pairOf(vals.slice(cut)), M = merge(A, B), full = hist[n];
      cA.innerHTML = '<b>A: elements 1..' + cut + '</b><span class="big">(' + num(A.m) + ', ' + f3(A.d) + ')</span>';
      cB.innerHTML = '<b>B: elements ' + (cut + 1) + '..' + n + '</b><span class="big">(' + num(B.m) + ', ' + f3(B.d) + ')</span>';
      cMg.innerHTML = '<b>A &oplus; B, the merge</b>m = max(' + num(A.m) + ', ' + num(B.m) + ') = ' + num(M.m) + '<br>d = ' + f3(A.d) + ' &times; ' + ex(A.m, M.m) +
        '<br>&nbsp;&nbsp;+ ' + f3(B.d) + ' &times; ' + ex(B.m, M.m) + '<br>&nbsp;&nbsp;= ' + f3(A.d * M.fa) + ' + ' + f3(B.d * M.fb) + ' = <span class="big">' + f3(M.d) + '</span>';
      var same = Math.abs(M.d - full.d) < 1e-9 && M.m === full.m;
      conf.innerHTML = 'The whole row, one element at a time: (' + num(full.m) + ', ' + f3(full.d) + '). ' +
        (same ? 'The merged pair is the same wherever the cut is: neither half was reread when the other turned out to hold the larger max.' : 'Mismatch (should not happen).');
    }

    function stop() { if (timer) { clearInterval(timer); timer = null; bRun.textContent = 'Run'; } }
    function step() { if (k < vals.length) { k++; render(true); } if (k >= vals.length) stop(); }
    bStep.addEventListener('click', function () { stop(); step(); });
    bBack.addEventListener('click', function () { stop(); if (k > 0) { k--; render(true); } });
    bReset.addEventListener('click', function () { stop(); k = 0; render(true); });
    bRun.addEventListener('click', function () {
      if (reduce) return;
      if (timer) { stop(); render(true); return; }
      if (k >= vals.length) k = 0;
      bRun.textContent = 'Pause';
      step();
      timer = setInterval(step, 900);
    });
    bAdd.addEventListener('click', function () { if (vals.length < 8) { vals.push(Math.floor(Math.random() * 10)); render(); } });
    bDel.addEventListener('click', function () { if (vals.length > 2) { vals.pop(); render(); } });
    bRnd.addEventListener('click', function () {
      stop(); var n = 5 + Math.floor(Math.random() * 4); vals = [];
      for (var i = 0; i < n; i++) vals.push(Math.floor(Math.random() * 10));
      k = 0; cut = Math.min(cut, n - 1); render();
    });
    bDef.addEventListener('click', function () { stop(); vals = DEF.slice(); k = 0; cut = 3; render(); });
    cutIn.addEventListener('input', function () { cut = +cutIn.value; render(true); });
    host.addEventListener('keydown', function (e) {
      if (tab !== 0) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); stop(); step(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); stop(); if (k > 0) { k--; render(true); } }
    });
    setTab(0);
  }

  /* ================= fusion byte counter ================= */
  var fh = document.getElementById('w-fusion-bytes');
  if (fh) {
    var C = 768, F = 3072, BW = 590e9;
    // Tensors: size in elements as a function of M; w = weights or parameters (count once per kernel that reads them).
    var TEN = {
      x: function (M) { return M * C; }, y: function (M) { return M * C; }, r: function (M) { return M * C; },
      n: function (M) { return M * C; }, h: function (M) { return M * F; }, hb: function (M) { return M * F; },
      g: function (M) { return M * F; }, o: function (M) { return M * C; }, ob: function (M) { return M * C; },
      xo: function (M) { return M * C; }, ln: function () { return 2 * C; }, W1: function () { return C * F; },
      b1: function () { return F; }, W2: function () { return F * C; }, b2: function () { return C; }
    };
    var LABEL = { hb: 'h + b', ob: 'o + b', xo: "x'" };
    function disp(x) { return LABEL[x] || x; }
    var OPS = [
      { name: 'residual add', sub: 'r = x + y', ins: ['x', 'y'], out: 'r' },
      { name: 'layernorm', sub: 'n = LN(r)', ins: ['r', 'ln'], out: 'n' },
      { name: 'GEMM up', sub: 'h = n W1', ins: ['n', 'W1'], out: 'h', gemm: true },
      { name: 'bias', sub: '+ b1', ins: ['h', 'b1'], out: 'hb' },
      { name: 'GELU', sub: 'g = gelu', ins: ['hb'], out: 'g' },
      { name: 'GEMM down', sub: 'o = g W2', ins: ['g', 'W2'], out: 'o', gemm: true },
      { name: 'bias', sub: '+ b2', ins: ['o', 'b2'], out: 'ob' },
      { name: 'residual add', sub: "x' = r + o", ins: ['ob', 'r'], out: 'xo' }
    ];
    var FINAL = { xo: true };
    var DIS = {
      1: 'Layernorm cannot join the GEMM: it needs the whole row, and a GEMM block holds one tile of it (section 8).',
      4: 'The two GEMMs cannot join: GELU\'s output is the down GEMM\'s A operand, and every block of that GEMM needs a whole row band of it, written by other blocks.'
    };
    var PRE = [
      { name: 'all separate', fused: [] },
      { name: 'lab 5 (bias_gelu)', fused: [3] },
      { name: 'chapter 9', fused: [0, 2, 3, 5, 6] }
    ];
    var Ms = [256, 1024, 4096];
    var st = { M: 1024, half: false, fused: {} };

    fh.innerHTML = '';
    fh.appendChild(el('h4', null, 'The MLP sublayer as kernels: move the boundaries'));
    fh.appendChild(el('p', 'w-sub', 'Eight operations of one GPT-2 MLP sublayer, top to bottom. A red line is a kernel boundary: the tensor that crosses it is written to DRAM and read back. Click a boundary to remove it (the operations on both sides then share a kernel, tagged K1, K2, ...); dotted boundaries cannot be removed. Bytes are counted, times are modelled.'));
    var pre = el('div', 'c9-btns'); var pb = [];
    PRE.forEach(function (P) {
      var b = btn(P.name); b.addEventListener('click', function () { st.fused = {}; P.fused.forEach(function (i) { st.fused[i] = true; }); render2(''); });
      pb.push(b); pre.appendChild(b);
    });
    fh.appendChild(pre);
    var chain = el('div', 'c9-chain'); var chips = [], cuts = [];
    OPS.forEach(function (o, i) {
      var c = el('div', 'c9-op8' + (o.gemm ? ' gemm' : '')); c.appendChild(el('span', 'nm', (i + 1) + '. ' + o.name)); c.appendChild(el('span', 'sub', o.sub));
      var tag = el('span', 'tag'); c.appendChild(tag); c._tag = tag;
      chips.push(c); chain.appendChild(c);
      if (i < OPS.length - 1) {
        var cut = btn('', 'c9-cut'); cut._lbl = el('span'); cut.appendChild(cut._lbl);
        cut.setAttribute('aria-label', 'kernel boundary between ' + o.name + ' and ' + OPS[i + 1].name);
        if (DIS[i]) { cut.setAttribute('aria-disabled', 'true'); cut.title = DIS[i]; cut.setAttribute('aria-pressed', 'true'); }
        cut.addEventListener('click', function () {
          if (DIS[i]) { render2(DIS[i]); return; }
          st.fused[i] = !st.fused[i]; render2('');
        });
        cuts.push(cut); chain.appendChild(cut);
      }
    });
    fh.appendChild(chain);
    var ctr = el('div', 'w-controls');
    var lm = el('label'); lm.appendChild(document.createTextNode('Tokens M = B x T'));
    var sel = el('select'); Ms.forEach(function (m) { var o = el('option', null, m.toLocaleString('en-US')); o.value = m; sel.appendChild(o); });
    sel.value = st.M; sel.addEventListener('change', function () { st.M = +sel.value; render2(''); });
    lm.appendChild(sel); ctr.appendChild(lm);
    var lh = el('label', 'c9-check'); var hIn = el('input'); hIn.type = 'checkbox';
    lh.appendChild(hIn); lh.appendChild(el('span', null, 'FP16 activations and weights (2 bytes; GEMMs on the FP16 tensor cores)'));
    hIn.addEventListener('change', function () { st.half = hIn.checked; render2(''); });
    ctr.appendChild(lh);
    fh.appendChild(ctr);
    var out = el('div', 'w-out');
    var vB = stat(out, 'DRAM bytes', 'ver'), vT = stat(out, 'time (modelled)'), vL = stat(out, 'launches'), vS = stat(out, 'saved vs all separate', 'gold');
    fh.appendChild(out);
    fh.appendChild(el('div', 'c9-lbl', 'Bytes per kernel, against all separate'));
    var stack = el('div', 'c9-stack'); fh.appendChild(stack);
    var skey = el('div', 'c9-skey'); fh.appendChild(skey);
    var scr2 = el('div', 'c9-scroll'); var kt = el('table', 'c9-ticks'); scr2.appendChild(kt); fh.appendChild(scr2);
    var ver = el('div', 'w-verdict mem'); ver.setAttribute('aria-live', 'polite'); fh.appendChild(ver);
    fh.appendChild(el('p', 'c9-note', 'Model: every kernel reads each input it does not produce once and writes each output that leaves it once; weights, biases and the layernorm\'s gamma and beta count once per kernel that reads them. A kernel with a GEMM takes max(FLOPs / (0.8 x peak), bytes / 590 GB/s), peak 30.9 TFLOPS FP32 or 61.7 FP16 tensor; the others bytes / 590 GB/s. Launch overhead (a few us each, chapter 4) is not included. The final residual add could also join the next block\'s layernorm; not modelled.'));

    function kernelsOf(fused) {
      var ks = [], cur = [0];
      for (var i = 0; i < OPS.length - 1; i++) {
        if (fused[i] && !DIS[i]) cur.push(i + 1); else { ks.push(cur); cur = [i + 1]; }
      }
      ks.push(cur);
      return ks;
    }
    function cost(fused, M, half) {
      var bpe = half ? 2 : 4, peak = (half ? 61.7 : 30.9) * 1e12;
      var ks = kernelsOf(fused), res = [], tot = 0, time = 0;
      ks.forEach(function (g) {
        var inG = {}; g.forEach(function (i) { inG[i] = true; });
        var produced = {}; g.forEach(function (i) { produced[OPS[i].out] = true; });
        var reads = {}, writes = {}, flops = 0;
        g.forEach(function (i) {
          OPS[i].ins.forEach(function (tn) { if (!produced[tn]) reads[tn] = true; });
          var o = OPS[i].out, outside = !!FINAL[o];
          OPS.forEach(function (op2, j) { if (!inG[j] && op2.ins.indexOf(o) >= 0) outside = true; });
          if (outside) writes[o] = true;
          if (OPS[i].gemm) flops += 2 * M * C * F;
        });
        var b = 0;
        Object.keys(reads).forEach(function (tn) { b += TEN[tn](M) * bpe; });
        Object.keys(writes).forEach(function (tn) { b += TEN[tn](M) * bpe; });
        var t = b / BW; if (flops) t = Math.max(t, flops / (0.8 * peak));
        res.push({ ops: g, bytes: b, t: t, gemm: flops > 0, reads: reads, writes: writes });
        tot += b; time += t;
      });
      return { ks: res, bytes: tot, time: time };
    }
    function mb(b) { return (b / 1e6).toFixed(1); }

    function render2(msg) {
      PRE.forEach(function (P, i) {
        var same = [0, 1, 2, 3, 4, 5, 6].every(function (j) { return !!st.fused[j] === (P.fused.indexOf(j) >= 0); });
        pb[i].setAttribute('aria-pressed', String(same));
      });
      cuts.forEach(function (c, i) {
        var tn = OPS[i].out, sz = mb(TEN[tn](st.M) * (st.half ? 2 : 4)), nm = disp(tn);
        if (DIS[i]) { c._lbl.textContent = nm + ' crosses (' + sz + ' MB each way): cannot fuse here'; return; }
        c.setAttribute('aria-pressed', String(!st.fused[i]));
        var later = OPS.some(function (op2, j) { return j > i + 1 && op2.ins.indexOf(tn) >= 0; });
        c._lbl.textContent = st.fused[i] ? 'fused: ' + nm + (later ? ' still written (op 8 needs it), not read back here' : ' stays on chip') + ' (click to cut)' : 'boundary: ' + nm + ' written and read back, ' + sz + ' MB each way (click to fuse)';
      });
      var R = cost(st.fused, st.M, st.half), base = cost({}, st.M, st.half);
      R.ks.forEach(function (k, ki) { k.ops.forEach(function (i) { chips[i].classList.toggle('k0', ki % 2 === 0); chips[i].classList.toggle('k1', ki % 2 === 1); chips[i]._tag.textContent = 'K' + (ki + 1); }); });
      vB.textContent = mb(R.bytes) + ' MB';
      vT.textContent = (R.time * 1e6).toFixed(0) + ' us';
      vL.textContent = String(R.ks.length);
      var saved = base.bytes - R.bytes;
      vS.textContent = mb(saved) + ' MB, ' + (100 * saved / base.bytes).toFixed(0) + '%';
      stack.innerHTML = '';
      R.ks.forEach(function (k, ki) {
        var s = el('div', 'c9-seg' + (ki % 2 ? ' alt' : '')); s.style.width = (100 * k.bytes / base.bytes) + '%';
        if (k.bytes / base.bytes > 0.07) s.textContent = 'K' + (ki + 1);
        s.title = 'K' + (ki + 1) + ': ' + mb(k.bytes) + ' MB';
        stack.appendChild(s);
      });
      if (saved > 0) { var s2 = el('div', 'c9-seg saved'); s2.style.width = (100 * saved / base.bytes) + '%'; if (saved / base.bytes > 0.1) s2.textContent = 'saved'; stack.appendChild(s2); }
      skey.innerHTML = '';
      skey.appendChild(el('span', null, 'red: bytes each kernel moves'));
      skey.appendChild(el('span', null, 'striped gold: bytes no longer moved'));
      skey.appendChild(el('span', null, 'us*: set by the GEMM\'s FLOPs, not its bytes'));
      var h = '<tr><th>Kernel</th><th>Operations</th><th>Reads</th><th>Writes</th><th>MB</th><th>us</th></tr>';
      R.ks.forEach(function (k, ki) {
        var nm = k.ops.map(function (i) { return OPS[i].name; }).join(' + ');
        var rd = Object.keys(k.reads).filter(function (x) { return ['b1', 'b2', 'ln'].indexOf(x) < 0; });
        h += '<tr><td>K' + (ki + 1) + '</td><td>' + nm + '</td><td>' + rd.map(disp).join(', ') + '</td><td>' +
          Object.keys(k.writes).map(disp).join(', ') + '</td><td>' + mb(k.bytes) + '</td><td>' + (k.t * 1e6).toFixed(1) + (k.gemm ? '*' : '') + '</td></tr>';
      });
      kt.innerHTML = h;
      if (msg) { ver.className = 'w-verdict bad'; ver.textContent = msg; return; }
      ver.className = 'w-verdict mem';
      var fz = Object.keys(st.fused).filter(function (i) { return st.fused[i]; }).map(Number).sort();
      if (!fz.length) ver.textContent = 'Eight kernels: every intermediate goes to DRAM and comes back. ' + mb(base.bytes) + ' MB, of which the two weight matrices are ' + mb(2 * C * F * (st.half ? 2 : 4)) + '.';
      else {
        var parts = fz.map(function (i) {
          var tn = OPS[i].out, other = OPS.some(function (op2, j) { return j > i + 1 && op2.ins.indexOf(tn) >= 0; });
          var sz = TEN[tn](st.M) * (st.half ? 2 : 4);
          return (LABEL[tn] || tn) + (other ? ' (still written: a later kernel needs it; one read saved, ' + mb(sz) + ' MB)' : ' (' + mb(2 * sz) + ' MB)');
        });
        ver.textContent = R.ks.length + ' kernels. No longer written and read back: ' + parts.join(', ') + '. ' +
          'Modelled time ' + (R.time * 1e6).toFixed(0) + ' us against ' + (base.time * 1e6).toFixed(0) + ' us all separate: the GEMMs cost the same, the elementwise and layernorm kernels that disappeared took their bytes with them.';
      }
    }
    render2('');
  }
})();
