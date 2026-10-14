/* u2b.js — Unit 2b widgets. Everything here is real computation in the browser, seeded and deterministic:
   1. Coordinate check: a toy ReLU MLP (input 32, two hidden layers of width n, 10 classes, one fixed batch of 16),
      trained a few Adam steps under standard parametrization (SP) and under µP; how much do features move, per width?
   2. Newton–Schulz: the quintic iteration Muon uses, applied to a 64×128 matrix; singular values per iteration,
      and the scalar polynomial it applies to each singular value.
   3. An illustrative loss-vs-LR picture for SP and µP (a made-up model, labelled as such on the page).
   The numerical core is plain functions, exported to node for checking; the page code only draws. */
(function () {
  'use strict';

  /* ---------- seeded randomness ---------- */
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(r) {
    var u = 0, v = 0;
    while (u === 0) u = r();
    v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function fill(arr, r, sd) { for (var i = 0; i < arr.length; i++) arr[i] = sd * gauss(r); return arr; }

  /* ---------- 1. coordinate check ---------- */
  var CC = { d: 32, B: 16, q: 10, n0: 64, eta: 0.004, b1: 0.9, b2: 0.999, eps: 1e-8, dataSeed: 7, weightSeed: 11 };

  function ccData() {
    var r = rng(CC.dataSeed), X = fill(new Float64Array(CC.B * CC.d), r, 1), Y = new Int32Array(CC.B);
    for (var b = 0; b < CC.B; b++) Y[b] = Math.floor(r() * CC.q);
    return { X: X, Y: Y };
  }

  // One layer y[b,i] = mult * sum_j W[i,j] x[b,j] (+ optional relu); W is out×in, row-major.
  function lin(W, x, B, out, inn, mult) {
    var y = new Float64Array(B * out);
    for (var i = 0; i < out; i++) {
      var o = i * inn;
      for (var b = 0; b < B; b++) {
        var s = 0, xo = b * inn;
        for (var j = 0; j < inn; j++) s += W[o + j] * x[xo + j];
        y[b * out + i] = mult * s;
      }
    }
    return y;
  }
  function relu(a) { var h = new Float64Array(a.length); for (var i = 0; i < a.length; i++) h[i] = a[i] > 0 ? a[i] : 0; return h; }

  function forward(P, X) {
    var d = CC.d, B = CC.B, n = P.n, q = CC.q;
    var p1 = lin(P.W1, X, B, n, d, 1), h1 = relu(p1);
    var p2 = lin(P.W2, h1, B, n, n, 1), h2 = relu(p2);
    var z = lin(P.W3, h2, B, q, n, P.mult3);
    return { p1: p1, h1: h1, p2: p2, h2: h2, z: z };
  }

  // Adam update of one row block of a matrix from its gradient row g (length len), in place.
  function adamRow(W, M, V, o, g, len, lr, t) {
    var b1 = CC.b1, b2 = CC.b2, c1 = 1 - Math.pow(b1, t), c2 = 1 - Math.pow(b2, t);
    for (var j = 0; j < len; j++) {
      var k = o + j, gj = g[j];
      M[k] = b1 * M[k] + (1 - b1) * gj;
      V[k] = b2 * V[k] + (1 - b2) * gj * gj;
      W[k] -= lr * (M[k] / c1) / (Math.sqrt(V[k] / c2) + CC.eps);
    }
  }

  // Build the network for width n under 'sp' or 'mup'. Same weight draws for both: only scales, multipliers and LRs differ.
  function ccInit(n, param) {
    var r = rng(CC.weightSeed * 1000 + n), d = CC.d, q = CC.q, m = n / CC.n0;
    var W1 = fill(new Float32Array(n * d), r, Math.sqrt(2 / d));
    var W2 = fill(new Float32Array(n * n), r, Math.sqrt(2 / n));
    var W3 = fill(new Float32Array(q * n), r, 1);
    var mup = param === 'mup', s3 = mup ? Math.sqrt(1 / CC.n0) : Math.sqrt(1 / n);
    for (var i = 0; i < W3.length; i++) W3[i] *= s3;
    return {
      n: n, W1: W1, W2: W2, W3: W3, mult3: mup ? 1 / m : 1,
      lr: [CC.eta, mup ? CC.eta / m : CC.eta, CC.eta],
      M1: new Float32Array(n * d), V1: new Float32Array(n * d),
      M2: new Float32Array(n * n), V2: new Float32Array(n * n),
      M3: new Float32Array(q * n), V3: new Float32Array(q * n)
    };
  }

  // One Adam step on the fixed batch: backprop by hand, updating each row as soon as its gradient is known.
  function ccStep(P, D, t) {
    var d = CC.d, B = CC.B, n = P.n, q = CC.q, X = D.X;
    var F = forward(P, X);
    var dz = new Float64Array(B * q);
    for (var b = 0; b < B; b++) {
      var mx = -Infinity, s = 0, k;
      for (k = 0; k < q; k++) mx = Math.max(mx, F.z[b * q + k]);
      for (k = 0; k < q; k++) { dz[b * q + k] = Math.exp(F.z[b * q + k] - mx); s += dz[b * q + k]; }
      for (k = 0; k < q; k++) dz[b * q + k] = (dz[b * q + k] / s - (k === D.Y[b] ? 1 : 0)) / B;
    }
    // readout: dh2 first (uses W3 before its update), then W3 rows
    var dh2 = new Float64Array(B * n), g = new Float64Array(Math.max(n, d)), i, j, c;
    for (i = 0; i < q; i++) {
      for (b = 0; b < B; b++) { c = P.mult3 * dz[b * q + i]; for (j = 0; j < n; j++) dh2[b * n + j] += c * P.W3[i * n + j]; }
    }
    for (i = 0; i < q; i++) {
      for (j = 0; j < n; j++) g[j] = 0;
      for (b = 0; b < B; b++) { c = P.mult3 * dz[b * q + i]; if (c) for (j = 0; j < n; j++) g[j] += c * F.h2[b * n + j]; }
      adamRow(P.W3, P.M3, P.V3, i * n, g, n, P.lr[2], t);
    }
    // hidden layer 2
    var dp2 = new Float64Array(B * n);
    for (i = 0; i < B * n; i++) dp2[i] = F.p2[i] > 0 ? dh2[i] : 0;
    var dh1 = new Float64Array(B * n);
    for (i = 0; i < n; i++) {
      var o = i * n;
      for (b = 0; b < B; b++) { c = dp2[b * n + i]; if (c) for (j = 0; j < n; j++) dh1[b * n + j] += c * P.W2[o + j]; }
    }
    for (i = 0; i < n; i++) {
      for (j = 0; j < n; j++) g[j] = 0;
      for (b = 0; b < B; b++) { c = dp2[b * n + i]; if (c) for (j = 0; j < n; j++) g[j] += c * F.h1[b * n + j]; }
      adamRow(P.W2, P.M2, P.V2, i * n, g, n, P.lr[1], t);
    }
    // input layer
    for (i = 0; i < n; i++) {
      for (j = 0; j < d; j++) g[j] = 0;
      for (b = 0; b < B; b++) { c = F.p1[b * n + i] > 0 ? dh1[b * n + i] : 0; if (c) for (j = 0; j < d; j++) g[j] += c * X[b * d + j]; }
      adamRow(P.W1, P.M1, P.V1, i * d, g, d, P.lr[0], t);
    }
  }

  function rmsDiff(a, b) { var s = 0; for (var i = 0; i < a.length; i++) { var e = a[i] - b[i]; s += e * e; } return Math.sqrt(s / a.length); }
  function rms(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i] * a[i]; return Math.sqrt(s / a.length); }

  // A generator: yields after every Adam step so the page can stay responsive. Result: per-step RMS feature changes.
  function* ccRun(n, param, steps, D) {
    var P = ccInit(n, param), F0 = forward(P, D.X), out = { n: n, param: param, h1: [], h2: [], z: [], z0: rms(F0.z), h2init: rms(F0.h2) };
    for (var t = 1; t <= steps; t++) {
      ccStep(P, D, t);
      var F = forward(P, D.X);
      out.h1.push(rmsDiff(F.h1, F0.h1)); out.h2.push(rmsDiff(F.h2, F0.h2)); out.z.push(rmsDiff(F.z, F0.z));
      yield t;
    }
    return out;
  }

  // least-squares slope of log y against log x
  function slope(xs, ys) {
    var k = xs.length, mx = 0, my = 0, sxx = 0, sxy = 0, i;
    for (i = 0; i < k; i++) { mx += Math.log(xs[i]); my += Math.log(ys[i]); }
    mx /= k; my /= k;
    for (i = 0; i < k; i++) { var dx = Math.log(xs[i]) - mx; sxx += dx * dx; sxy += dx * (Math.log(ys[i]) - my); }
    return sxy / sxx;
  }

  /* ---------- 2. Newton–Schulz ---------- */
  var NS = { a: 3.4445, b: -4.7750, c: 2.0315, rows: 64, cols: 128 };

  // Two test matrices: 'grad' = rank-4 signal plus small noise (what a gradient often looks like);
  // 'power' = singular values falling off as 1/i.
  function nsMatrix(kind) {
    var r = rng(kind === 'grad' ? 21 : 22), R = NS.rows, C = NS.cols, G = new Float64Array(R * C), i, j, k;
    if (kind === 'grad') {
      var rank = 4, U = fill(new Float64Array(R * rank), r, 1), Vv = fill(new Float64Array(C * rank), r, 1), w = [8, 4, 2, 1];
      for (i = 0; i < R; i++) for (j = 0; j < C; j++) {
        var s = 0;
        for (k = 0; k < rank; k++) s += w[k] * U[i * rank + k] * Vv[j * rank + k];
        G[i * C + j] = s / Math.sqrt(C) + 0.25 * gauss(r);
      }
    } else {
      fill(G, r, 1);
      for (i = 0; i < R; i++) for (j = 0; j < C; j++) G[i * C + j] /= (i + 1);
    }
    return G;
  }
  function gram(X, R, C) {           // X Xᵀ, R×R
    var A = new Float64Array(R * R);
    for (var i = 0; i < R; i++) for (var j = i; j < R; j++) {
      var s = 0;
      for (var k = 0; k < C; k++) s += X[i * C + k] * X[j * C + k];
      A[i * R + j] = A[j * R + i] = s;
    }
    return A;
  }
  function nsStep(X, R, C) {          // X ← aX + (bA + cA²)X, A = XXᵀ
    var A = gram(X, R, C), B = new Float64Array(R * R), i, j, k, s;
    for (i = 0; i < R; i++) for (j = 0; j < R; j++) {
      s = 0;
      for (k = 0; k < R; k++) s += A[i * R + k] * A[k * R + j];
      B[i * R + j] = NS.b * A[i * R + j] + NS.c * s;
    }
    var Y = new Float64Array(R * C);
    for (i = 0; i < R; i++) for (j = 0; j < C; j++) {
      s = 0;
      for (k = 0; k < R; k++) s += B[i * R + k] * X[k * C + j];
      Y[i * C + j] = NS.a * X[i * C + j] + s;
    }
    return Y;
  }
  // eigenvalues of a symmetric matrix by cyclic Jacobi rotations
  function symEig(A0, R) {
    var A = Float64Array.from(A0), sweep, p, q, i;
    for (sweep = 0; sweep < 60; sweep++) {
      var off = 0;
      for (p = 0; p < R; p++) for (q = p + 1; q < R; q++) off += A[p * R + q] * A[p * R + q];
      if (off < 1e-26) break;
      for (p = 0; p < R; p++) for (q = p + 1; q < R; q++) {
        var apq = A[p * R + q];
        if (Math.abs(apq) < 1e-300) continue;
        var th = (A[q * R + q] - A[p * R + p]) / (2 * apq);
        var t = (th >= 0 ? 1 : -1) / (Math.abs(th) + Math.sqrt(th * th + 1));
        var c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (i = 0; i < R; i++) {          // columns p, q
          var aip = A[i * R + p], aiq = A[i * R + q];
          A[i * R + p] = c * aip - s * aiq; A[i * R + q] = s * aip + c * aiq;
        }
        for (i = 0; i < R; i++) {          // rows p, q
          var api = A[p * R + i], aqi = A[q * R + i];
          A[p * R + i] = c * api - s * aqi; A[q * R + i] = s * api + c * aqi;
        }
      }
    }
    var ev = [];
    for (i = 0; i < R; i++) ev.push(A[i * R + i]);
    return ev;
  }
  function singular(X, R, C) { return symEig(gram(X, R, C), R).map(function (e) { return Math.sqrt(Math.max(e, 0)); }).sort(function (x, y) { return y - x; }); }

  // Singular values after k = 0..steps iterations, starting from G / ||G||_F (the k = 0 row).
  function nsSpectra(kind, steps) {
    var R = NS.rows, C = NS.cols, G = nsMatrix(kind), f = 0, i;
    for (i = 0; i < G.length; i++) f += G[i] * G[i];
    f = Math.sqrt(f);
    var X = G.map(function (v) { return v / (f + 1e-7); }), out = [singular(X, R, C)];
    for (var k = 1; k <= steps; k++) { X = nsStep(X, R, C); out.push(singular(X, R, C)); }
    return out;
  }
  function pScalar(s, k) { for (var i = 0; i < k; i++) s = NS.a * s + NS.b * s * s * s + NS.c * s * s * s * s * s; return s; }

  var core = { CC: CC, NS: NS, rng: rng, ccData: ccData, ccRun: ccRun, slope: slope, nsSpectra: nsSpectra, pScalar: pScalar, symEig: symEig };
  if (typeof module !== 'undefined' && module.exports) { module.exports = core; return; }

  /* ================= page code ================= */
  var XP = window.XP;
  function $(id) { return document.getElementById(id); }
  // charts are the explainer kit's (assets/xp/xp-plot.js): sized to their box, redrawn from a spec
  function chart(host, shared) {
    var P = null;
    return function (spec) { if (shared) spec.legend = false; if (P) P.draw(spec); else P = XP.plot(host, spec); };
  }
  function supE(e) { return String(e).replace(/[-0-9]/g, function (c) { return '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(c)]; }); }

  /* ---------- widget 1: coordinate check ---------- */
  function initCoord() {
    var box = $('w-coord'); if (!box) return;
    var plot = chart($('cc-plot')), run = $('cc-run'), note = $('cc-note'), stepsSel = $('cc-steps'), qSel = $('cc-q'), big = $('cc-big');
    var cache = {}, busy = false, D = ccData();
    var NAMES = { h1: 'hidden layer 1 (fan-in 32, fixed)', h2: 'hidden layer 2 (fan-in n)', z: 'logits' };

    function key() { return stepsSel.value + (big.checked ? 'b' : ''); }
    function widths() { return big.checked ? [64, 128, 256, 512, 1024, 2048] : [64, 128, 256, 512, 1024]; }

    function draw() {
      var res = cache[key()], qty = qSel.value, steps = +stepsSel.value, ws = widths();
      // y range: decades covering the data, at least 1e-2 .. 1e1
      var lo = -2, hi = 1;
      if (res) ['sp', 'mup'].forEach(function (p) { res[p].forEach(function (o) { var v = o[qty][steps - 1]; lo = Math.min(lo, Math.floor(Math.log10(v))); hi = Math.max(hi, Math.ceil(Math.log10(v))); }); });
      var yt = []; for (var e = lo; e <= hi; e++) yt.push(Math.pow(10, e));
      var series = [
        { kind: 'line', shape: 'sq', mat: 'memx', dash: true, data: res ? res.sp.map(function (o) { return [o.n, o[qty][steps - 1]]; }) : [], label: 'standard parametrization (SP)' },
        { kind: 'line', shape: 'dot', r: 4.5, data: res ? res.mup.map(function (o) { return [o.n, o[qty][steps - 1]]; }) : [], label: 'µP' }
      ];
      if (res) {                                                   // a slope-1 guide from the SP start
        var r0 = res.sp[0][qty][steps - 1], nA = ws[0], nB = ws[ws.length - 1];
        if (r0 * nB / nA <= Math.pow(10, hi) * 1.01) series.push({ kind: 'line', data: [[nA, r0], [nB, r0 * nB / nA]], mat: 'ink', dash: true, o: 0.6, label: 'slope 1 guide' });
      }
      plot({ label: 'Log-log plot of RMS feature change after training against width, for SP and µP.', height: 270,
        x: { log: 2, min: ws[0], max: ws[ws.length - 1], ticks: ws, label: 'width n (log scale)', grid: true },
        y: { log: true, min: yt[0], max: yt[yt.length - 1], ticks: yt, fmt: function (v) { var e = Math.round(Math.log10(v)); return e >= 0 ? String(v) : e >= -3 ? v.toFixed(-e) : '10' + supE(e); }, label: 'RMS change, log' },
        series: series, message: res ? '' : busy ? 'computing…' : 'press “Run the check”' });
    }

    function stats() {
      var res = cache[key()], steps = +stepsSel.value, ws = widths();
      ['h2', 'z'].forEach(function (qty) {
        ['sp', 'mup'].forEach(function (p) {
          var el = $('cc-s-' + qty + '-' + p);
          if (!el) return;
          el.textContent = res ? (function () { var s = slope(ws, res[p].map(function (o) { return o[qty][steps - 1]; })); return (s >= 0 ? '+' : '−') + Math.abs(s).toFixed(2); })() : '–';
        });
      });
      var v = $('cc-verdict'), last = $('cc-last');
      if (!res) { v.className = 'w-verdict'; v.textContent = 'Nothing computed yet. The check runs in your browser, a few seconds at most.'; last.textContent = '–'; return; }
      var sp = slope(ws, res.sp.map(function (o) { return o.h2[steps - 1]; })), mu = slope(ws, res.mup.map(function (o) { return o.h2[steps - 1]; }));
      var a = res.sp[ws.length - 1].h2[steps - 1] / res.mup[ws.length - 1].h2[steps - 1];
      last.textContent = (res.sp[ws.length - 1].h2[steps - 1] / res.sp[ws.length - 2].h2[steps - 1]).toFixed(2) + '×';
      v.className = 'w-verdict ' + (Math.abs(mu) < 0.2 ? 'good' : 'bad');
      v.textContent = 'After ' + steps + ' step' + (steps > 1 ? 's' : '') + ', layer-2 features move with slope ' + sp.toFixed(2) + ' under SP and ' + (mu < 0 ? '\u2212' : '') + Math.abs(mu).toFixed(2) +
        ' under µP. At width ' + ws[ws.length - 1] + ' SP moves them ' + a.toFixed(0) + '× more than µP: the same base LR that is gentle at width 64 is far too hot there.';
    }
    function render() { draw(); stats(); }

    run.addEventListener('click', function () {
      if (busy) return;
      var k = key(); if (cache[k]) { render(); return; }
      busy = true; run.disabled = true;
      var steps = +stepsSel.value, ws = widths(), jobs = [], res = { sp: [], mup: [] };
      ws.forEach(function (n) { jobs.push([n, 'sp'], [n, 'mup']); });
      var ji = 0, gen = null;
      draw();
      function tick() {
        if (!gen) { gen = ccRun(jobs[ji][0], jobs[ji][1], steps, D); }
        note.textContent = 'width ' + jobs[ji][0] + ', ' + (jobs[ji][1] === 'sp' ? 'SP' : 'µP') + ' (' + (ji + 1) + ' of ' + jobs.length + ')';
        var r = gen.next();
        if (r.done) {
          res[jobs[ji][1]].push(r.value); gen = null; ji++;
          if (ji === jobs.length) { cache[k] = res; busy = false; run.disabled = false; note.textContent = 'done: ' + jobs.length + ' training runs, ' + steps + ' Adam step' + (steps > 1 ? 's' : '') + ' each'; render(); return; }
        }
        setTimeout(tick, 0);
      }
      setTimeout(tick, 30);
    });
    [stepsSel, big].forEach(function (s) { s.addEventListener('change', function () { note.textContent = cache[key()] ? '' : 'settings changed: press Run'; render(); }); });
    qSel.addEventListener('change', render);
    render();
  }

  /* ---------- widget 2: Newton–Schulz ---------- */
  function initNS() {
    var box = $('w-ns'); if (!box) return;
    var kSel = $('ns-k'), kOut = $('ns-k-out'), mSel = $('ns-m'), plotA = chart($('ns-plot'), true), plotB = chart($('ns-map'), true), leg = $('ns-legend');
    var cache = {};
    function spectra() { var m = mSel.value; if (!cache[m]) cache[m] = nsSpectra(m, 5); return cache[m]; }

    var KEYS = [{ kind: 'bars', label: 'singular values at k (bars)' }, { mat: 'ink', dash: true, label: 'k = 0, for comparison' }, { mat: 'workx', label: 'the target, 1' },
                { label: 'p iterated k times' }, { mat: 'ink', o: 0.3, label: 'other k (faint)' }];
    function drawSpectrum() {
      var S = spectra(), k = +kSel.value, R = S[0].length;
      var series = [{ kind: 'bars', data: S[k].map(function (v, i) { return [i + 1, Math.min(v, 1.3)]; }), o: 0.85, w: 0.8 }];
      if (k > 0) series.push({ kind: 'line', data: S[0].map(function (v, i) { return [i + 1, v]; }), mat: 'ink', dash: true });
      plotA({ label: 'Bar chart of the 64 singular values after k Newton–Schulz iterations.', height: 240,
        x: { min: 0.3, max: R + 0.7, ticks: [1, 16, 32, 48, 64], label: 'singular value, largest to smallest (index)', short: 'index, largest first' },
        y: { min: 0, max: 1.3, ticks: [0, 0.5, 1] }, series: series, refs: [{ y: 1, mat: 'workx', dash: false }] });
      var mx = S[k][0], mn = S[k][R - 1];
      $('ns-max').textContent = mx.toFixed(3);
      $('ns-min').textContent = mn < 0.001 ? mn.toExponential(1) : mn.toFixed(3);
      $('ns-cond').textContent = (mx / mn).toFixed(mx / mn >= 10 ? 0 : 2) + '×';
      var v = $('ns-verdict');
      v.className = 'w-verdict' + (k === 5 ? ' good' : '');
      v.textContent = k === 0 ? 'Before any iteration: the matrix divided by its Frobenius norm, so every singular value is below 1 and most are much smaller.'
        : k < 5 ? 'After ' + k + ' iteration' + (k > 1 ? 's' : '') + ': small singular values are being pulled up fast; the large ones overshoot and come back.'
        : 'After the 5 iterations Muon uses: every singular value sits between ' + mn.toFixed(2) + ' and ' + mx.toFixed(2) + '. Not exactly 1, and that is fine.';
    }

    function drawMap() {
      var k = +kSel.value, series = [];
      // earlier iterates faint, the chosen one bold; k = 0 is the identity
      for (var j = 0; j <= k; j++) (function (j) { series.push({ kind: 'line', fn: function (x) { return Math.max(0, Math.min(pScalar(x, j), 1.4)); }, from: 0, to: 1.2, n: 240, mat: j === k ? 'subject' : 'ink', o: j === k ? 1 : 0.3 }); })(j);
      plotB({ label: 'Curves of the Newton–Schulz polynomial iterated one to five times.', height: 220,
        x: { min: 0, max: 1.2, ticks: [0, 0.3, 0.6, 0.9, 1.2], label: 'input singular value σ' }, y: { min: 0, max: 1.4, ticks: [0, 0.5, 1] },
        series: series, refs: [{ y: 1, mat: 'workx', dash: false }], notes: k === 0 ? [{ x: 0.62, y: 0.62, text: 'k = 0: output = input', align: 'r', mat: 'subject', dy: -10 }] : [] });
      leg.innerHTML = XP.plot.keys(KEYS);
    }
    function render() { kOut.textContent = kSel.value; drawSpectrum(); drawMap(); }
    kSel.addEventListener('input', render);
    mSel.addEventListener('change', render);
    // computed lazily, the first time the widget comes near the screen
    var started = false;
    function start() { if (started) return; started = true; render(); }
    if (window.IntersectionObserver) new IntersectionObserver(function (es, ob) { if (es.some(function (e) { return e.isIntersecting; })) { ob.disconnect(); start(); } }, { rootMargin: '400px' }).observe(box);
    else start();
  }

  /* ---------- widget 3 (illustrative): loss against LR at four widths ---------- */
  function initTransfer() {
    var box = $('w-xfer'); if (!box) return;
    var plot = chart($('xf-plot')), btns = box.querySelectorAll('[data-param]'), mode = 'sp';
    var WS = [128, 256, 512, 1024], E = 2.4, A = 4, al = 0.25, kap = 0.02, base = 0.003;
    // made-up model: L = E + A n^-al + kap * (log2(eta / eta*(n)))^2 with eta*(n) = base*512/n under SP, base under µP
    function L(n, eta) { var st = mode === 'sp' ? base * 512 / n : base; var d = Math.log2(eta / st); return E + A * Math.pow(n, -al) + kap * d * d; }
    function draw() {
      var mat = mode === 'sp' ? 'memx' : 'subject', series = [], best = [];
      WS.forEach(function (n, wi) {
        var st = mode === 'sp' ? base * 512 / n : base;
        series.push({ kind: 'line', fn: function (eta) { return L(n, eta); }, from: 0.0003, to: 0.03, n: 120, mat: mat, dash: wi < 2, o: 0.45 + 0.18 * wi,
                      label: wi === 0 ? 'widths 128 and 256 (dashed); lighter = narrower' : wi === 3 ? 'widths 512 and 1024' : null });
        best.push([st, L(n, st)]);
      });
      series.push({ kind: 'points', data: best, mat: mat, r: 4, label: (mode === 'sp' ? 'SP' : 'µP') + ': best LR at each width' });
      plot({ label: 'Illustrative loss against learning rate curves for widths 128, 256, 512 and 1024.', height: 250,
        x: { log: 2, min: 0.0003, max: 0.03, ticks: [0.0003, 0.001, 0.003, 0.01, 0.03], fmt: String, label: 'base learning rate (log scale)', grid: true },
        y: { min: 3.0, max: 4.2, ticks: [3.0, 3.2, 3.4, 3.6, 3.8, 4.0, 4.2], fmt: function (v) { return v.toFixed(1); }, label: 'loss' },
        series: series, notes: best.map(function (b, i) { return { x: b[0], y: b[1], text: String(WS[i]), align: 'l', dy: 4, mat: mat }; }) });
      $('xf-note').textContent = mode === 'sp' ? 'Standard parametrization: each doubling of width halves the best LR. A rate tuned at 128 is 8× too hot at 1024.'
        : 'µP: the best base LR sits in the same place at every width, so you tune once at the small width.';
      [].forEach.call(btns, function (b) { b.classList.toggle('alt', b.getAttribute('data-param') !== mode); b.setAttribute('aria-pressed', b.getAttribute('data-param') === mode); });
    }
    [].forEach.call(btns, function (b) { b.addEventListener('click', function () { mode = b.getAttribute('data-param'); draw(); }); });
    draw();
  }

  function init() { initCoord(); initNS(); initTransfer(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
