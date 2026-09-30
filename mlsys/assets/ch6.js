/* ch6.js — chapter 6 widgets: the GPT-2 op census and the number-format explorer. */
(function () {
  'use strict';
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function fmt(x, d) { return x.toLocaleString('en-US', { maximumFractionDigits: d == null ? 1 : d, minimumFractionDigits: d == null ? 1 : d }); }
  function sig(x) {
    if (x === 0) return '0';
    var a = Math.abs(x);
    if (a >= 1000) return fmt(x, 0);
    if (a >= 100) return fmt(x, 0);
    if (a >= 10) return fmt(x, 1);
    if (a >= 1) return fmt(x, 2);
    if (a >= 0.01) return fmt(x, 3);
    return x.toExponential(1);
  }
  function stat(parent, k) { var d = el('div', 'w-stat'); d.appendChild(el('span', 'k', k)); var v = el('span', 'v'); d.appendChild(v); parent.appendChild(d); return v; }
  function labelled(parent, text, control, out) {
    var l = el('label'); l.appendChild(document.createTextNode(text + ' '));
    if (out) l.appendChild(out);
    l.appendChild(control); parent.appendChild(l); return l;
  }

  /* ================= op census: one decode step of GPT-2 small ================= */
  var host = document.getElementById('w-census');
  if (host) {
    var C = 768, H = 3072, V = 50257, L = 12;
    var BW = 672e9 * 0.88, FP32 = 30.9e12, TENSOR16 = 61.7e12, FLOOR = 3e-6;

    host.innerHTML = '';
    host.appendChild(el('h4', null, 'Op census: one decode step of GPT-2 small on your RTX 5070'));
    host.appendChild(el('p', 'w-sub', 'Each row is one kind of operation, summed over the whole model (the number of kernels is in brackets). Time is the roofline time: the larger of FLOPs / peak and bytes / (88% of 672 GB/s). Biases are folded into their matmuls, attention is one fused kernel per layer, and every sequence reads its own cached keys and values.'));

    var ctr = el('div', 'w-controls');
    var mSel = el('select'); [1, 8, 64, 256, 1024].forEach(function (m) { var o = el('option', null, String(m)); o.value = m; mSel.appendChild(o); });
    labelled(ctr, 'Sequences in the batch, M', mSel);
    var tOut = el('output'); var tIn = el('input'); tIn.type = 'range'; tIn.min = 16; tIn.max = 1024; tIn.step = 16; tIn.value = 256;
    labelled(ctr, 'Context already cached, t =', tIn, tOut);
    var pSel = el('select');
    [['fp32', 'FP32 (4 B, CUDA cores)'], ['fp16', 'FP16 (2 B, tensor cores)']].forEach(function (p) { var o = el('option', null, p[1]); o.value = p[0]; pSel.appendChild(o); });
    labelled(ctr, 'Number format', pSel);
    var fl = el('label', 'c6-check'); var fIn = el('input'); fIn.type = 'checkbox';
    fl.appendChild(fIn); fl.appendChild(document.createTextNode(' Launch floor: no kernel takes less than 3 µs'));
    ctr.appendChild(fl);
    host.appendChild(ctr);

    var rowsHost = el('div', 'c6-rows'); host.appendChild(rowsHost);
    var out = el('div', 'w-out');
    var vStep = stat(out, 'time per step'), vTok = stat(out, 'tokens / s'), vMM = stat(out, 'linear layers'), vK = stat(out, 'kernels per step');
    host.appendChild(out);
    var verdict = el('div', 'w-verdict'); verdict.setAttribute('aria-live', 'polite'); host.appendChild(verdict);

    function mm(M, K, N, s) { return { f: 2 * M * K * N, b: s * (M * K + K * N + M * N + N), mm: true }; }

    function census(M, t, s, floor) {
      var peakMM = s === 2 ? TENSOR16 : FP32;
      var ops = [
        { name: 'embedding lookup', n: 1, c: { f: M * C, b: s * 3 * M * C } },
        { name: 'layernorm', n: 2 * L + 1, c: { f: 8 * M * C, b: s * (2 * M * C + 2 * C) } },
        { name: 'linear Q,K,V', n: L, c: mm(M, C, 3 * C, s) },
        { name: 'attention', n: L, c: { f: 4 * M * t * C, b: s * M * C * (2 * t + 4), mm: true, attn: true } },
        { name: 'linear attn out', n: L, c: mm(M, C, C, s) },
        { name: 'residual add', n: 2 * L, c: { f: M * C, b: s * 3 * M * C } },
        { name: 'linear MLP up', n: L, c: mm(M, C, H, s) },
        { name: 'GELU', n: L, c: { f: 8 * M * H, b: s * 2 * M * H } },
        { name: 'linear MLP down', n: L, c: mm(M, H, C, s) },
        { name: 'LM head', n: 1, c: mm(M, C, V, s) }
      ];
      var r = { ops: ops, total: 0, kernels: 0, mmTime: 0, below: 0, small: 0 };
      ops.forEach(function (o) {
        var peak = o.c.mm ? peakMM : FP32;
        var tc = o.c.f / peak, tm = o.c.b / BW, roof = Math.max(tc, tm);
        var per = floor ? Math.max(roof, FLOOR) : roof;
        o.bound = (floor && FLOOR > roof) ? 'launch' : (tc > tm ? 'compute' : 'memory');
        if (floor && FLOOR > roof) r.below += o.n;
        o.time = per * o.n; o.bytes = o.c.b * o.n; o.flops = o.c.f * o.n;
        r.total += o.time; r.kernels += o.n;
        if (o.c.mm && !o.c.attn) r.mmTime += o.time;
        if (!o.c.mm) r.small += o.time;
      });
      return r;
    }

    function render() {
      var M = +mSel.value, t = +tIn.value, s = pSel.value === 'fp16' ? 2 : 4, floor = fIn.checked;
      tOut.textContent = t;
      var r = census(M, t, s, floor), ops = r.ops, total = r.total;
      rowsHost.innerHTML = '';
      ops.forEach(function (o) {
        var share = o.time / total;
        var row = el('div', 'c6-row');
        var nm = el('div', 'c6-name'); nm.appendChild(el('b', null, o.name)); nm.appendChild(el('span', null, ' [' + o.n + ']'));
        row.appendChild(nm);
        var tr = el('div', 'track'); var fillEl = el('div', 'fill' + (o.bound === 'compute' ? ' alt' : o.bound === 'launch' ? ' bind' : ''));
        fillEl.style.width = Math.max(0.4, 100 * share).toFixed(1) + '%'; tr.appendChild(fillEl); row.appendChild(tr);
        row.appendChild(el('div', 'c6-num', sig(o.time * 1e6) + ' \u00b5s \u00b7 ' + fmt(100 * share, 1) + '%'));
        row.appendChild(el('div', 'c6-meta', sig(o.bytes / 1e6) + ' MB \u00b7 ' + sig(o.flops / 1e9) + ' GFLOP \u00b7 ' + sig(o.c.f / o.c.b) + ' FLOP/B \u00b7 ' + o.bound));
        rowsHost.appendChild(row);
      });
      vStep.textContent = sig(total * 1e3) + ' ms';
      vTok.textContent = fmt(M / total, 0);
      vMM.textContent = fmt(100 * r.mmTime / total, 0) + '%';
      vK.textContent = String(r.kernels);
      var attn = ops[3].time / total, msg;
      if (M === 1 && !floor) msg = 'One user: the linear layers are ' + fmt(100 * r.mmTime / total, 0) + '% of the step, and all of it is weight bytes. Tokens per second = bandwidth / model size. Now turn on the launch floor.';
      else if (M === 1) msg = r.below + ' of ' + r.kernels + ' kernels do less work than one launch costs. The small operations now take ' + fmt(100 * r.small / total, 0) + '% of the step: the overhead-bound regime, which fusion and CUDA graphs attack.';
      else if (attn > 0.4) msg = 'Attention is ' + fmt(100 * attn, 0) + '% of the step: each of the ' + M + ' sequences reads its own ' + t + '-token cache, so its bytes grow with M \u00d7 t and are never reused. Chapter 4\u2019s \u201cattention does not batch\u201d.';
      else {
        var one = census(1, t, s, floor).total;
        msg = 'One step serves ' + M + ' sequences in ' + sig(total * 1e3) + ' ms; ' + M + ' single-user steps would take ' + sig(M * one * 1e3) + ' ms. Batching reuses each weight ' + M + ' times: ' + fmt(M * one / total, 1) + '\u00d7 the throughput. Watch the linear rows turn from memory- to compute-bound as M grows.';
      }
      verdict.className = 'w-verdict' + (floor && M === 1 ? ' bad' : attn > 0.4 ? ' mem' : ' comp');
      verdict.textContent = msg;
    }
    [mSel, tIn, pSel, fIn].forEach(function (c) { c.addEventListener('input', render); c.addEventListener('change', render); });
    render();
  }

  /* ================= number formats and accumulation ================= */
  var fh = document.getElementById('w-formats');
  if (fh) {
    var FORMATS = {
      FP32: { e: 8, m: 23 }, BF16: { e: 8, m: 7 }, FP16: { e: 5, m: 10 },
      'FP8 E4M3': { e: 4, m: 3, max: 448, sat: true }, 'FP8 E5M2': { e: 5, m: 2 }, 'FP4 E2M1': { e: 2, m: 1, max: 6, sat: true }
    };
    Object.keys(FORMATS).forEach(function (k) {
      var f = FORMATS[k], bias = Math.pow(2, f.e - 1) - 1;
      f.emin = 1 - bias;
      if (f.max == null) f.max = (2 - Math.pow(2, -f.m)) * Math.pow(2, Math.pow(2, f.e) - 2 - bias);
    });
    function rhe(v) { var f = Math.floor(v), d = v - f; if (d > 0.5) return f + 1; if (d < 0.5) return f; return (f % 2 === 0) ? f : f + 1; }
    function q(x, name) {
      if (name === 'FP32') return Math.fround(x);
      var f = FORMATS[name];
      if (x === 0 || !isFinite(x)) return x;
      var a = Math.abs(x), ex = Math.floor(Math.log2(a));
      if (Math.pow(2, ex) > a) ex--; else if (Math.pow(2, ex + 1) <= a) ex++;
      if (ex < f.emin) ex = f.emin;
      var step = Math.pow(2, ex - f.m), r = rhe(a / step) * step;
      if (r > f.max) r = f.sat ? f.max : Infinity;
      return x < 0 ? -r : r;
    }

    fh.innerHTML = '';
    fh.appendChild(el('h4', null, 'Formats and long sums'));
    fh.appendChild(el('p', 'w-sub', 'Top: how each format stores a number you type. Bottom: add the same small number N times, with the addend and the running total each rounded to a format of your choice, the way a dot product accumulates.'));

    var c1 = el('div', 'w-controls');
    var vIn = el('input'); vIn.type = 'number'; vIn.step = 'any'; vIn.value = '0.1';
    vIn.className = 'c6-num-in';
    labelled(c1, 'Value to store', vIn);
    fh.appendChild(c1);
    var tbl = el('div', 'c6-fmt'); fh.appendChild(tbl);

    fh.appendChild(el('p', 'c6-sep', 'A running sum'));
    var c2 = el('div', 'w-controls');
    var aIn = el('input'); aIn.type = 'number'; aIn.step = 'any'; aIn.value = '0.01'; aIn.className = 'c6-num-in';
    labelled(c2, 'Addend', aIn);
    var nOut = el('output'); var nIn = el('input'); nIn.type = 'range'; nIn.min = 100; nIn.max = 20000; nIn.step = 100; nIn.value = 5000;
    labelled(c2, 'Number of additions, N =', nIn, nOut);
    function fmtSelect(def, list) { var s = el('select'); list.forEach(function (k) { var o = el('option', null, k); o.value = k; if (k === def) o.selected = true; s.appendChild(o); }); return s; }
    var addSel = fmtSelect('FP16', ['FP32', 'BF16', 'FP16', 'FP8 E4M3']);
    var accSel = fmtSelect('FP16', ['FP32', 'BF16', 'FP16']);
    labelled(c2, 'Addend stored as', addSel);
    labelled(c2, 'Running total kept in', accSel);
    fh.appendChild(c2);

    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 600 150'); svg.setAttribute('class', 'c6-sum');
    svg.setAttribute('role', 'img');
    fh.appendChild(svg);
    var out2 = el('div', 'w-out');
    var sTrue = stat(out2, 'exact sum'), sGot = stat(out2, 'computed'), sErr = stat(out2, 'error'), sStall = stat(out2, 'stopped growing at');
    fh.appendChild(out2);
    var v2 = el('div', 'w-verdict'); v2.setAttribute('aria-live', 'polite'); fh.appendChild(v2);

    function renderTable() {
      var x = parseFloat(vIn.value);
      tbl.innerHTML = '';
      var head = el('div', 'c6-fr c6-fh'); ['format', 'stored as', 'relative error'].forEach(function (h) { head.appendChild(el('span', null, h)); }); tbl.appendChild(head);
      if (!isFinite(x)) return;
      Object.keys(FORMATS).forEach(function (k) {
        var r = q(x, k), row = el('div', 'c6-fr');
        row.appendChild(el('span', null, k));
        var stored, err;
        if (!isFinite(r)) { stored = 'overflow (∞)'; err = '—'; }
        else if (r === 0 && x !== 0) { stored = '0 (underflow)'; err = '100%'; }
        else {
          stored = Math.abs(r) >= 1e5 || (Math.abs(r) < 1e-4 && r !== 0) ? r.toExponential(6) : String(+r.toPrecision(9));
          if (FORMATS[k].sat && Math.abs(x) > FORMATS[k].max) stored += ' (saturated)';
          err = x === 0 ? '0' : (100 * Math.abs(r - x) / Math.abs(x)).toPrecision(2) + '%';
        }
        row.appendChild(el('span', null, stored)); row.appendChild(el('span', null, err));
        tbl.appendChild(row);
      });
    }

    function renderSum() {
      var a = parseFloat(aIn.value), N = +nIn.value, fa = addSel.value, fc = accSel.value;
      nOut.textContent = N.toLocaleString('en-US');
      if (!isFinite(a)) return;
      var aq = q(a, fa), sum = 0, stallAt = -1, pts = [], every = Math.max(1, Math.floor(N / 200));
      for (var i = 1; i <= N; i++) {
        var ns = q(sum + aq, fc);
        if (ns === sum && stallAt < 0) stallAt = i;
        sum = ns;
        if (i % every === 0 || i === N) pts.push([i, sum]);
      }
      var exact = a * N;
      sTrue.textContent = sig(exact);
      sGot.textContent = sig(sum);
      sErr.textContent = exact === 0 ? '0' : fmt(100 * Math.abs(sum - exact) / Math.abs(exact), 1) + '%';
      sStall.textContent = stallAt < 0 ? 'never' : 'step ' + stallAt.toLocaleString('en-US') + ' (' + sig(sum) + ')';
      // chart
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var ymax = Math.max(exact, sum) * 1.05 || 1, x0 = 46, x1 = 590, y0 = 130, y1 = 10;
      function X(i) { return x0 + (x1 - x0) * i / N; }
      function Y(v) { return y0 - (y0 - y1) * v / ymax; }
      function line(xa, ya, xb, yb, st, dash) { var l = document.createElementNS(NS, 'line'); l.setAttribute('x1', xa); l.setAttribute('y1', ya); l.setAttribute('x2', xb); l.setAttribute('y2', yb); l.setAttribute('stroke', st); if (dash) l.setAttribute('stroke-dasharray', dash); svg.appendChild(l); }
      function text(x, y, s, fill, anchor) { var t = document.createElementNS(NS, 'text'); t.setAttribute('x', x); t.setAttribute('y', y); t.setAttribute('font-size', '10'); t.setAttribute('font-family', 'var(--lk-mono)'); t.setAttribute('fill', fill); if (anchor) t.setAttribute('text-anchor', anchor); t.textContent = s; svg.appendChild(t); }
      line(x0, y0, x1, y0, 'var(--lk-rule)'); line(x0, y0, x0, y1, 'var(--lk-rule)');
      line(x0, y0, x1, Y(exact), 'var(--lk-rule)', '4 3');
      var pl = document.createElementNS(NS, 'polyline');
      pl.setAttribute('points', [[0, 0]].concat(pts).map(function (p) { return X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1); }).join(' '));
      pl.setAttribute('fill', 'none'); pl.setAttribute('stroke', 'var(--lk-cobalt)'); pl.setAttribute('stroke-width', '2');
      svg.appendChild(pl);
      text(x0 - 4, y1 + 8, sig(ymax / 1.05), 'var(--lk-ink-soft)', 'end');
      text(x0 - 4, y0, '0', 'var(--lk-ink-soft)', 'end');
      text(x1, y0 + 14, 'N = ' + N.toLocaleString('en-US'), 'var(--lk-ink-soft)', 'end');
      text(x1 - 4, Y(exact) - 5, 'exact', 'var(--lk-ink-soft)', 'end');
      svg.setAttribute('aria-label', 'Running sum of ' + N + ' additions: exact ' + sig(exact) + ', computed ' + sig(sum) + '.');
      var bad = exact !== 0 && Math.abs(sum - exact) / Math.abs(exact) > 0.01;
      v2.className = 'w-verdict ' + (bad ? 'bad' : 'comp');
      if (bad && stallAt > 0) v2.textContent = 'The total stopped growing at ' + sig(sum) + ': there, half the spacing between ' + fc + ' numbers is larger than the addend, so every addition rounds back to the same total. Keep the addend in ' + fa + ' but switch the running total to FP32.';
      else if (bad) v2.textContent = 'Every addition rounds the total, and the rounding errors pile up in one direction. Try an FP32 running total.';
      else v2.textContent = fc === 'FP32' && fa !== 'FP32' ? 'Narrow inputs, FP32 total: the only error is the one rounding of the addend itself. This is what tensor cores do.' : 'Within 1% of the exact sum.';
    }
    vIn.addEventListener('input', renderTable);
    [aIn, nIn, addSel, accSel].forEach(function (c) { c.addEventListener('input', renderSum); c.addEventListener('change', renderSum); });
    renderTable(); renderSum();
  }
})();
