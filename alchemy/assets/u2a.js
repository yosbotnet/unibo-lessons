/* u2a.js — the two widgets of Unit 2a.
   1. The noisy quadratic of CS 312 assignment 2 (H = diag(1, 10), gradient noise N(0, I/B), N = 8,192 examples).
      SGD, SGD with momentum and preconditioned SGD are exact: their expected loss is a linear recursion on
      second moments, iterated (or powered by squaring) here. Adam has no closed form and is simulated.
   2. A scale-invariant weight in the plane under decoupled weight decay or Hyperball: an exact simulation.
   Every random draw comes from a seeded generator, so the same settings always draw the same picture.
   The math core also loads in node (module.exports) so the numbers can be checked outside the page. */
(function () {
  'use strict';

  /* ================= math core ================= */
  var H = [1, 10], S0 = [1, 0.1], NTOT = 8192, RUNS = 64, SEED = 312;
  var MUS = [0, 0.5, 0.8, 0.9, 0.95, 0.98];

  function rng(seed) {
    var a = seed >>> 0, spare = null;
    function u() { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    function g() {
      if (spare !== null) { var s = spare; spare = null; return s; }
      var r, x, y; do { x = 2 * u() - 1; y = 2 * u() - 1; r = x * x + y * y; } while (r >= 1 || r === 0);
      var f = Math.sqrt(-2 * Math.log(r) / r); spare = y * f; return x * f;
    }
    return { u: u, g: g };
  }

  // SGD with per-coordinate step eta * h^-p (p = 0 plain, p = 1/2 preconditioned): closed form after T steps,
  // split into what is left of the start (bias) and what the gradient noise put there (noise).
  function sgdFinal(eta, B, p, T) {
    var bias = 0, noise = 0;
    for (var i = 0; i < 2; i++) {
      var a = eta * Math.pow(H[i], -p), r2 = (1 - a * H[i]) * (1 - a * H[i]), rT = Math.pow(r2, T);
      var geo = Math.abs(1 - r2) < 1e-15 ? T : (1 - rT) / (1 - r2);
      bias += 0.5 * H[i] * rT * S0[i];
      noise += 0.5 * H[i] * a * a / B * geo;
    }
    return { bias: bias, noise: noise, loss: bias + noise };
  }
  // heavy ball (s' = mu s + g, w' = w - eta s', as in the assignment): the covariance of (w, s) evolves by an
  // affine map, so T steps are one 4x4 matrix power.
  function mul4(X, Y) {
    var Z = new Array(16);
    for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++) { var s = 0; for (var k = 0; k < 4; k++) s += X[4 * i + k] * Y[4 * k + j]; Z[4 * i + j] = s; }
    return Z;
  }
  function momMap(eta, B, mu, h) {
    var a = 1 - eta * h, b = -eta * mu, c = h, d = mu;
    return [a * a, 2 * a * b, b * b, eta * eta / B,
            a * c, a * d + b * c, b * d, -eta / B,
            c * c, 2 * c * d, d * d, 1 / B,
            0, 0, 0, 1];
  }
  function momFinal(eta, B, mu, T) {
    var bias = 0, noise = 0;
    for (var i = 0; i < 2; i++) {
      var R = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], P = momMap(eta, B, mu, H[i]), n = T;
      while (n > 0) { if (n & 1) R = mul4(R, P); n = Math.floor(n / 2); if (n) P = mul4(P, P); }
      bias += 0.5 * H[i] * R[0] * S0[i];
      noise += 0.5 * H[i] * R[3];
    }
    return { bias: bias, noise: noise, loss: bias + noise };
  }
  function finalExact(opt, eta, B, T, mu) {
    return opt === 'sgd' ? sgdFinal(eta, B, 0, T) : opt === 'pre' ? sgdFinal(eta, B, 0.5, T) : momFinal(eta, B, mu, T);
  }
  // the noise floor a run would settle on if it ran forever (null if it diverges)
  function floorExact(opt, eta, B, mu) {
    var f = finalExact(opt, eta, B, 1 << 24, mu);
    return isFinite(f.noise) && f.noise < 1e6 ? f.noise : null;
  }
  // expected loss after every step, by iterating the second moments
  function exactCurve(opt, eta, B, T, mu) {
    var out = new Float64Array(T + 1), st = [0, 1].map(function (i) { return [S0[i], 0, 0]; });
    for (var t = 0; t <= T; t++) {
      var L = 0;
      for (var i = 0; i < 2; i++) {
        var h = H[i], q = st[i];
        L += 0.5 * h * q[0];
        if (t === T) continue;
        if (opt === 'sgd' || opt === 'pre') {
          var al = opt === 'pre' ? eta / Math.sqrt(h) : eta, r = 1 - al * h;
          q[0] = r * r * q[0] + al * al / B;
        } else {
          var m = momMap(eta, B, mu, h), p11 = q[0], p12 = q[1], p22 = q[2];
          q[0] = m[0] * p11 + m[1] * p12 + m[2] * p22 + m[3];
          q[1] = m[4] * p11 + m[5] * p12 + m[6] * p22 + m[7];
          q[2] = m[8] * p11 + m[9] * p12 + m[10] * p22 + m[11];
        }
      }
      out[t] = L;
    }
    return out;
  }
  // Monte Carlo over RUNS seeded runs: mean loss after every step, plus the path of one run
  var SAMPLE = (function () {   // the first run whose start is far enough out to be seen on the plot
    for (var k = 0; k < RUNS; k++) { var R = rng(SEED + 7919 * k), a = R.g(), b = R.g() * Math.sqrt(S0[1]); if (Math.abs(a) > 1.2 && Math.abs(a) < 2.2 && Math.abs(b) > 0.15) return k; }
    return 0;
  })();
  function simulate(opt, eta, B, T, mu, runs) {
    runs = runs || RUNS;
    var mean = new Float64Array(T + 1), path = [], one = new Float64Array(T + 1), sd = 1 / Math.sqrt(B);
    for (var k = 0; k < runs; k++) {
      var R = rng(SEED + 7919 * k), w = [R.g() * Math.sqrt(S0[0]), R.g() * Math.sqrt(S0[1])];
      var s = [0, 0], m = [0, 0], v = [0, 0], b1t = 1, b2t = 1;
      for (var t = 0; t <= T; t++) {
        var L = 0.5 * (H[0] * w[0] * w[0] + H[1] * w[1] * w[1]);
        if (!isFinite(L) || L > 1e30) L = 1e30;
        mean[t] += L / runs;
        if (k === SAMPLE) { path.push([w[0], w[1]]); one[t] = L; }
        if (t === T) break;
        b1t *= 0.9; b2t *= 0.95;
        for (var i = 0; i < 2; i++) {
          var g = H[i] * w[i] + sd * R.g();
          if (opt === 'sgd') w[i] -= eta * g;
          else if (opt === 'pre') w[i] -= eta / Math.sqrt(H[i]) * g;
          else if (opt === 'mom') { s[i] = mu * s[i] + g; w[i] -= eta * s[i]; }
          else { m[i] = 0.9 * m[i] + 0.1 * g; v[i] = 0.95 * v[i] + 0.05 * g * g; w[i] -= eta * (m[i] / (1 - b1t)) / (Math.sqrt(v[i] / (1 - b2t)) + 1e-8); }
          if (!isFinite(w[i]) || Math.abs(w[i]) > 1e15) w[i] = 1e15;
        }
      }
    }
    return { mean: mean, path: path, one: one };
  }
  // best eta at batch B by a coarse grid in log10(eta), then a fine one around the winner
  function bestEta(f, lo, hi) {
    lo = lo == null ? -5 : lo; hi = hi == null ? 0.5 : hi;
    var best = null, x, e, L;
    function tryX(x) { e = Math.pow(10, x); L = f(e); if (isFinite(L) && (!best || L < best.loss)) best = { eta: e, loss: L, x: x }; }
    for (x = lo; x <= hi + 1e-9; x += 0.1) tryX(x);
    if (!best) return null;
    var c = best.x;
    for (x = c - 0.1; x <= c + 0.1 + 1e-9; x += 0.005) tryX(x);
    return best;
  }
  function bestAt(opt, B, mu) {
    var T = NTOT / B;
    return bestEta(function (e) { return finalExact(opt, e, B, T, mu).loss; });
  }
  function bestMomentum(B) {   // momentum coefficient tuned too, as in the assignment
    var out = null;
    MUS.forEach(function (mu) { var b = bestAt('mom', B, mu); if (b && (!out || b.loss < out.loss)) { out = b; out.mu = mu; } });
    return out;
  }
  function limitFor(opt, mu) {   // largest stable eta * h_max
    return opt === 'mom' ? 2 * (1 + mu) : 2;
  }

  /* --- the norm toy: a weight w in the plane, loss depending only on its angle --- */
  // Each step moves w by a fixed-size normalized (Adam-like) step tangent to its circle, toward the target angle
  // when the noisy sign says so. Decoupled weight decay shrinks w by (1 - eta*lambda) first; Hyperball instead
  // scales the step to the current norm and projects back.
  var PHI_STAR = 2.2, R0 = 0.05, NT = 3000;
  function normRun(o) {
    var R = rng(o.seed || 11), w = [R0, 0], r = [], ang = [], loss = [], pts = [[w[0], w[1]]];
    for (var t = 0; t < NT; t++) {
      var et = o.sched === 'linear' ? o.eta * (1 - t / NT) : o.eta;
      var rr = Math.hypot(w[0], w[1]), phi = Math.atan2(w[1], w[0]);
      var s = Math.sin(PHI_STAR - phi) + R.g() >= 0 ? 1 : -1, tx = -Math.sin(phi), ty = Math.cos(phi), nw;
      if (o.mode === 'ball') {
        nw = [w[0] + et * rr * s * tx, w[1] + et * rr * s * ty];
        var k = rr / Math.hypot(nw[0], nw[1]); nw = [nw[0] * k, nw[1] * k];
      } else {
        var d = 1 - et * o.lam;
        nw = [d * w[0] + et * s * tx, d * w[1] + et * s * ty];
      }
      var dphi = Math.atan2(w[0] * nw[1] - w[1] * nw[0], w[0] * nw[0] + w[1] * nw[1]);
      w = nw;
      r.push(Math.hypot(w[0], w[1])); ang.push(Math.abs(dphi)); loss.push(1 - Math.cos(Math.atan2(w[1], w[0]) - PHI_STAR));
      pts.push([w[0], w[1]]);
    }
    return { r: r, ang: ang, loss: loss, pts: pts };
  }
  function eqRadius(eta, lam) { return lam > 0 ? Math.sqrt(eta / (lam * (2 - eta * lam))) : null; }
  function eqAngle(eta, lam) { var p = eta * lam; return Math.atan(Math.sqrt(p * (2 - p)) / (1 - p)); }   // exact for the toy; about sqrt(2 eta lambda)

  var CORE = { H: H, S0: S0, NTOT: NTOT, rng: rng, sgdFinal: sgdFinal, momFinal: momFinal, finalExact: finalExact, floorExact: floorExact,
               exactCurve: exactCurve, simulate: simulate, bestAt: bestAt, bestMomentum: bestMomentum, limitFor: limitFor,
               normRun: normRun, eqRadius: eqRadius, eqAngle: eqAngle, NT: NT, R0: R0 };
  if (typeof module === 'object' && module.exports) module.exports = CORE;
  if (typeof document === 'undefined') return;

  /* ================= drawing ================= */
  var NS = 'http://www.w3.org/2000/svg', clipN = 0;
  function S(tag, at, parent, txt) {
    var e = document.createElementNS(NS, tag);
    for (var k in at) if (at[k] != null) e.setAttribute(k, at[k]);
    if (txt != null) e.textContent = txt;
    if (parent) parent.appendChild(e);
    return e;
  }
  function clear(svg) { while (svg.firstChild) svg.removeChild(svg.firstChild); }
  function sup(n) { return '1e' + n; }
  function fmtE(x) {
    if (x == null || !isFinite(x)) return '–';
    if (x === 0) return '0';
    var a = Math.abs(x);
    if (a >= 0.01 && a < 1000) return x.toPrecision(3).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
    var e = Math.floor(Math.log10(a)), m = x / Math.pow(10, e);
    return m.toFixed(2) + '×10<sup>' + (e < 0 ? '−' : '') + Math.abs(e) + '</sup>';
  }
  function fmtEta(x) { return x >= 0.01 ? x.toPrecision(3).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') : x.toPrecision(2); }
  function nice(x) { return x.toLocaleString('en-US'); }

  // a plot frame: W x H viewBox, margins, linear or log axes; returns mappers and a clipped group
  function frame(svg, o) {
    clear(svg);
    svg.setAttribute('viewBox', '0 0 ' + o.W + ' ' + o.H);
    var l = o.l, r = o.W - o.r, t = o.t, b = o.H - o.b;
    function map(ax, lo, hi) {
      var a0 = ax.log ? Math.log10(ax.min) : ax.min, a1 = ax.log ? Math.log10(ax.max) : ax.max;
      return function (v) { var u = ax.log ? Math.log10(Math.max(v, 1e-300)) : v; return lo + (u - a0) / (a1 - a0) * (hi - lo); };
    }
    var X = map(o.x, l, r), Y = map(o.y, b, t);
    var id = 'u2a-clip-' + (++clipN);
    var cp = S('clipPath', { id: id }, S('defs', {}, svg));
    S('rect', { x: l, y: t, width: r - l, height: b - t }, cp);
    S('rect', { x: l, y: t, width: r - l, height: b - t, fill: 'var(--lk-paper)', stroke: 'none' }, svg);
    (o.x.ticks || []).forEach(function (v) {
      var x = X(v);
      S('line', { x1: x, y1: t, x2: x, y2: b, 'class': 'grid' }, svg);
      S('text', { x: x, y: b + 14, 'text-anchor': 'middle' }, svg, o.x.fmt ? o.x.fmt(v) : String(v));
    });
    (o.y.ticks || []).forEach(function (v) {
      var y = Y(v);
      S('line', { x1: l, y1: y, x2: r, y2: y, 'class': 'grid' }, svg);
      S('text', { x: l - 5, y: y + 4, 'text-anchor': 'end' }, svg, o.y.fmt ? o.y.fmt(v) : String(v));
    });
    S('rect', { x: l, y: t, width: r - l, height: b - t, 'class': 'ax' }, svg);
    if (o.x.label) S('text', { x: (l + r) / 2, y: o.H - 4, 'text-anchor': 'middle', fill: 'var(--lk-ink)' }, svg, o.x.label);
    if (o.y.label) S('text', { x: l, y: t - 7, 'text-anchor': 'start', fill: 'var(--lk-ink)' }, svg, o.y.label);
    var g = S('g', { 'clip-path': 'url(#' + id + ')' }, svg);
    return { X: X, Y: Y, g: g, l: l, r: r, t: t, b: b, svg: svg };
  }
  function line(F, pts, cls, extra) {
    var d = [];
    pts.forEach(function (p) {
      if (p == null || !isFinite(p[0]) || !isFinite(p[1])) return;
      var x = F.X(p[0]), y = F.Y(p[1]);
      if (!isFinite(x) || !isFinite(y)) return;
      x = Math.max(F.l - 40, Math.min(F.r + 40, x));
      y = Math.max(F.t - 40, Math.min(F.b + 40, y));
      d.push(x.toFixed(1) + ',' + y.toFixed(1));
    });
    var at = { points: d.join(' '), 'class': cls };
    for (var k in extra || {}) at[k] = extra[k];
    return S('polyline', at, F.g);
  }
  function marker(F, x, y, shape, cls, size) {
    var px = F.X(x), py = F.Y(y), s = size || 3.6;
    if (!isFinite(px) || !isFinite(py)) return;
    if (shape === 'sq') S('rect', { x: px - s, y: py - s, width: 2 * s, height: 2 * s, 'class': cls }, F.g);
    else if (shape === 'tri') S('polygon', { points: [px, py - s * 1.2, px - s * 1.1, py + s * 0.8, px + s * 1.1, py + s * 0.8].map(function (v) { return v.toFixed(1); }).join(' '), 'class': cls }, F.g);
    else if (shape === 'ring') S('circle', { cx: px, cy: py, r: s + 2.5, fill: 'none', stroke: 'var(--lk-vermilion)', 'stroke-width': 2 }, F.g);
    else S('circle', { cx: px, cy: py, r: s, 'class': cls }, F.g);
  }
  function stat(k, v) { return '<div class="w-stat"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>'; }
  // legend swatches drawn like the marks they explain: colour, dash and marker shape (two cues, never colour alone)
  var COL = { a: 'var(--lk-cobalt)', b: 'var(--lk-vermilion)', g: 'var(--lk-forest)', k: 'var(--lk-ink-soft)' };
  function icon(sp) {
    var c = COL[sp.c], s = '<svg class="u2a-sw" width="28" height="12" viewBox="0 0 28 12" aria-hidden="true">';
    if (sp.line !== false) s += '<line x1="1" y1="6" x2="27" y2="6" stroke="' + c + '" stroke-width="' + (sp.w || 2) + '"' +
      (sp.dash === 'dot' ? ' stroke-dasharray="1 3"' : sp.dash ? ' stroke-dasharray="5 3"' : '') + (sp.op ? ' opacity="' + sp.op + '"' : '') + '/>';
    if (sp.mk === 'dot') s += '<circle cx="14" cy="6" r="3.4" fill="' + c + '"/>';
    if (sp.mk === 'sq') s += '<rect x="11" y="3" width="6" height="6" fill="' + c + '"/>';
    if (sp.mk === 'tri') s += '<polygon points="14,1.8 10.2,8.8 17.8,8.8" fill="' + c + '"/>';
    if (sp.mk === 'ring') s += '<circle cx="14" cy="6" r="4.6" fill="none" stroke="' + c + '" stroke-width="2"/>';
    if (sp.mk === 'cross') s += '<path d="M9 6h10M14 1v10" stroke="' + c + '" stroke-width="2"/>';
    return s + '</svg>';
  }
  function legend(items) {
    return items.map(function (it) { return '<span>' + icon(it[0]) + it[1] + '</span>'; }).join('');
  }
  var LOGT = [1e-4, 1e-3, 1e-2, 1e-1, 1, 10];
  function fmtPow(v) { var e = Math.round(Math.log10(v)); return e === 0 ? '1' : e === 1 ? '10' : sup(e); }

  /* ================= widget 1: the noisy quadratic ================= */
  function initNQM(root) {
    var q = function (s) { return root.querySelector(s); };
    var cOpt = q('[data-k=opt]'), cB = q('[data-k=b]'), cLR = q('[data-k=lr]'), cMu = q('[data-k=mu]'), cView = q('[data-k=view]');
    var oB = q('[data-o=b]'), oLR = q('[data-o=lr]'), oMu = q('[data-o=mu]'), muBox = q('[data-box=mu]');
    var svgA = q('svg[data-k=a]'), svgB = q('svg[data-k=b]'), leg = q('.w-legend'), out = q('.w-out'), ver = q('.w-verdict'), cap = q('[data-k=cap]');
    var sweep = null;
    function getSweep() {
      if (sweep) return sweep;
      sweep = [];
      for (var k = 0; k <= 9; k++) {
        var B = 1 << k;
        sweep.push({ B: B, sgd: bestAt('sgd', B, 0), pre: bestAt('pre', B, 0), mom: bestMomentum(B) });
      }
      return sweep;
    }
    function controls() {
      var B = 1 << +cB.value, eta = Math.pow(10, +cLR.value), mu = +cMu.value, opt = cOpt.value;
      oB.textContent = B + '  (' + nice(NTOT / B) + ' steps)';
      oLR.textContent = fmtEta(eta);
      oMu.textContent = mu.toFixed(2);
      muBox.hidden = opt !== 'mom';
      return { B: B, eta: eta, mu: mu, opt: opt, T: NTOT / B, view: cView.value };
    }
    function drawRun(c) {
      var exact = c.opt !== 'adam';
      var sim = simulate(c.opt, c.eta, c.B, c.T, c.mu);
      var cur = exact ? exactCurve(c.opt, c.eta, c.B, c.T, c.mu) : null;
      var fin = exact ? finalExact(c.opt, c.eta, c.B, c.T, c.mu) : null;
      var lossEnd = exact ? fin.loss : sim.mean[c.T];
      var diverged = !isFinite(lossEnd) || lossEnd > 1e3;
      var floor = exact && !diverged ? floorExact(c.opt, c.eta, c.B, c.mu) : null;

      // left: contours and one run's path
      var Fa = frame(svgA, { W: 340, H: 214, l: 34, r: 10, t: 22, b: 32,
        x: { min: -2.4, max: 2.4, ticks: [-2, -1, 0, 1, 2], label: 'w1 (flat direction, h = 1)' },
        y: { min: -1.2, max: 1.2, ticks: [-1, 0, 1], label: 'w2 (steep, h = 10)' } });
      [0.02, 0.1, 0.3, 0.7, 1.4, 2.4].forEach(function (L) {
        var rx = Math.sqrt(2 * L), ry = Math.sqrt(2 * L / 10);
        S('ellipse', { cx: Fa.X(0), cy: Fa.Y(0), rx: Fa.X(rx) - Fa.X(0), ry: Fa.Y(0) - Fa.Y(ry), fill: 'none', stroke: 'var(--lk-rule-soft)', 'stroke-width': 1 }, Fa.g);
      });
      var P = sim.path, n = P.length, keep = [];
      for (var i = 0; i < n; i++) if (i < 400 || i % Math.ceil(n / 1200) === 0 || i === n - 1) keep.push(P[i]);
      line(Fa, keep, 'c-a', { 'stroke-width': 1.3, 'stroke-linejoin': 'round' });
      S('path', { d: 'M' + (Fa.X(0) - 5) + ' ' + Fa.Y(0) + 'h10M' + Fa.X(0) + ' ' + (Fa.Y(0) - 5) + 'v10', stroke: 'var(--lk-forest)', 'stroke-width': 2 }, Fa.g);
      marker(Fa, P[0][0], P[0][1], 'dot', 'pt-k', 3.6);
      var last = P[n - 1];
      if (Math.abs(last[0]) < 2.4 && Math.abs(last[1]) < 1.2) marker(Fa, last[0], last[1], 'sq', 'pt-a', 3.2);

      // right: expected loss against examples seen
      var Fb = frame(svgB, { W: 340, H: 214, l: 40, r: 10, t: 22, b: 32,
        x: { min: 1, max: NTOT, log: true, ticks: [1, 8, 64, 512, 4096], fmt: nice, label: 'examples seen (steps × B)' },
        y: { min: 1e-4, max: 10, log: true, ticks: LOGT, fmt: fmtPow, label: 'loss' } });
      function pts(arr) { var o = []; for (var t = 0; t <= c.T; t++) o.push([Math.max(1, t * c.B), Math.max(arr[t], 1e-6)]); return o; }
      if (floor != null) line(Fb, [[1, floor], [NTOT, floor]], 'c-b c-dash', { 'stroke-width': 1.4 });
      line(Fb, pts(sim.one), 'c-k', { 'stroke-width': 0.9, opacity: 0.55 });
      line(Fb, pts(sim.mean), exact ? 'c-k c-dash' : 'c-a c-dash', { 'stroke-width': 1.6 });
      if (cur) line(Fb, pts(cur), 'c-a');

      var items = [[{ c: 'k', line: false, mk: 'dot' }, 'start of one run'], [{ c: 'a', w: 1.3 }, 'its path (left)'],
                   [{ c: 'a', line: false, mk: 'sq' }, 'where it ends'], [{ c: 'g', line: false, mk: 'cross' }, 'the minimum']];
      var items2 = exact ? [[{ c: 'a' }, 'expected loss, exact'], [{ c: 'k', dash: true }, 'mean of ' + RUNS + ' simulated runs'], [{ c: 'k', w: 1, op: 0.6 }, 'the one run']]
                         : [[{ c: 'a', dash: true }, 'mean of ' + RUNS + ' simulated runs (Adam has no closed form)'], [{ c: 'k', w: 1, op: 0.6 }, 'the one run']];
      if (floor != null) items2.push([{ c: 'b', dash: true }, 'noise floor if it ran forever']);
      leg.innerHTML = legend(items.concat(items2));

      // readout
      var best = exact ? (c.opt === 'mom' ? bestAt('mom', c.B, c.mu) : bestAt(c.opt, c.B, 0)) : null;
      var sgdBest = bestAt('sgd', c.B, 0);
      var effH = c.opt === 'pre' ? c.eta * Math.sqrt(10) : c.eta * 10, lim = limitFor(c.opt, c.mu);
      var html = stat('steps (N / B)', nice(c.T));
      html += stat(exact ? 'final loss (exact)' : 'final loss (simulated)', diverged ? 'diverged' : fmtE(lossEnd));
      if (exact && !diverged) html += stat('left from the start', fmtE(fin.bias)) + stat('put there by noise', fmtE(fin.noise));
      html += c.opt === 'adam' ? stat('η × h<sub>max</sub>', fmtE(c.eta * 10) + ' (no hard limit)') : stat('step × h<sub>max</sub> (limit ' + lim.toFixed(1) + ')', fmtE(effH));
      if (best) html += stat('best η here' + (c.opt === 'mom' ? ' at this μ' : ''), fmtEta(best.eta) + ' → ' + fmtE(best.loss));
      else html += stat('best SGD at this B (exact)', fmtEta(sgdBest.eta) + ' → ' + fmtE(sgdBest.loss));
      out.innerHTML = html;

      var cls = '', msg;
      if (diverged) { cls = 'bad'; msg = '<strong>Diverged.</strong> The steep direction (h = 10) overshoots the minimum by more than it started with, every step: step × h = ' + fmtE(effH) + ' is past ' + (c.opt === 'adam' ? 'what this run can absorb' : 'the stability limit of ' + lim.toFixed(1)) + '.'; }
      else if (!exact) { msg = 'Adam is simulated only. Its step has roughly the same size in every coordinate whatever the gradient, so it rattles at a scale set by η instead of settling. Compare its final loss with the exact best for SGD at this batch: ' + fmtE(sgdBest.loss) + '.'; }
      else {
        var ratio = fin.loss / best.loss;
        if (ratio < 1.1) { cls = 'good'; msg = '<strong>Within 10% of the best η for this batch.</strong> ' + (fin.bias > fin.noise ? 'What remains is mostly the flat direction not yet finished.' : 'What remains is mostly gradient noise: the two terms are balanced about as well as they can be.'); }
        else if (fin.bias > fin.noise && best.eta < c.eta) { cls = 'bad'; msg = '<strong>Overshooting.</strong> Most of the remaining loss is left over from the start, but not because the run is slow: the step is large enough that the run swings past the minimum' + (c.opt === 'mom' ? ' and momentum keeps it ringing' : '') + '. A smaller η would help. Best here: η = ' + fmtEta(best.eta) + '.'; }
        else if (fin.bias > fin.noise) { cls = 'bad'; msg = '<strong>Too slow.</strong> Most of the remaining loss is left over from the start: the flat direction (h = 1) moves at rate η per step and has not arrived. A larger η, or a smaller batch (more steps for the same data), would help. Best here: η = ' + fmtEta(best.eta) + '.'; }
        else { cls = 'bad'; msg = '<strong>Noise-bound.</strong> Most of the remaining loss is gradient noise, which η amplifies and B averages away. A smaller η would lower the floor. Best here: η = ' + fmtEta(best.eta) + '.'; }
      }
      ver.className = 'w-verdict' + (cls ? ' ' + cls : '');
      ver.innerHTML = msg;
      cap.textContent = 'Left: the loss surface’s contours and the path of one seeded run. Right: loss against examples seen, so every batch size spends the same 8,192 examples. The start is random, as in the assignment (w1 with variance 1, w2 with variance 0.1), so the expected starting loss is 1.';
    }
    function drawSweep(c) {
      var sw = getSweep();
      var Fa = frame(svgA, { W: 340, H: 214, l: 44, r: 10, t: 22, b: 32,
        x: { min: 0.8, max: 640, log: true, ticks: [1, 4, 16, 64, 256], label: 'batch size B' },
        y: { min: 1e-4, max: 1, log: true, ticks: [1e-4, 1e-3, 1e-2, 1e-1, 1], fmt: fmtPow, label: 'best step size (momentum: η/(1−μ))' } });
      line(Fa, [[0.8, 0.2], [640, 0.2]], 'c-b c-dash', { 'stroke-width': 1.3 });
      var lt = S('text', { x: Fa.l + 5, y: Fa.Y(0.2) - 5, 'class': 'lbl-b' }, Fa.g, 'SGD limit 2/h');
      S('tspan', { dy: 3, 'font-size': 9 }, lt, 'max');
      var e1 = sw[0].sgd.eta;
      line(Fa, [[0.8, e1 * 0.8], [640, e1 * 640]], 'c-k', { 'stroke-width': 1, 'stroke-dasharray': '2 3' });
      line(Fa, sw.map(function (r) { return [r.B, r.sgd.eta]; }), 'c-a');
      line(Fa, sw.map(function (r) { return [r.B, r.mom.eta / (1 - r.mom.mu)]; }), 'c-g c-dash');
      line(Fa, sw.map(function (r) { return [r.B, r.pre.eta]; }), 'c-k', { 'stroke-dasharray': '1 3', 'stroke-width': 1.8 });
      sw.forEach(function (r) {
        marker(Fa, r.B, r.sgd.eta, 'dot', 'pt-a');
        marker(Fa, r.B, r.mom.eta / (1 - r.mom.mu), 'sq', 'pt-g', 3);
        marker(Fa, r.B, r.pre.eta, 'tri', 'pt-k', 3.4);
      });
      var effEta = c.opt === 'mom' ? c.eta / (1 - c.mu) : c.eta;
      marker(Fa, c.B, effEta, 'ring');

      var Fb = frame(svgB, { W: 340, H: 214, l: 44, r: 10, t: 22, b: 32,
        x: { min: 0.8, max: 640, log: true, ticks: [1, 4, 16, 64, 256], label: 'batch size B' },
        y: { min: 1e-4, max: 1e-2, log: true, ticks: [1e-4, 1e-3, 1e-2], fmt: fmtPow, label: 'best final loss, η tuned' } });
      line(Fb, sw.map(function (r) { return [r.B, r.sgd.loss]; }), 'c-a');
      line(Fb, sw.map(function (r) { return [r.B, r.mom.loss]; }), 'c-g c-dash');
      line(Fb, sw.map(function (r) { return [r.B, r.pre.loss]; }), 'c-k', { 'stroke-dasharray': '1 3', 'stroke-width': 1.8 });
      sw.forEach(function (r) {
        marker(Fb, r.B, r.sgd.loss, 'dot', 'pt-a');
        marker(Fb, r.B, r.mom.loss, 'sq', 'pt-g', 3);
        marker(Fb, r.B, r.pre.loss, 'tri', 'pt-k', 3.4);
      });
      var here = c.opt !== 'adam' ? finalExact(c.opt, c.eta, c.B, c.T, c.mu).loss : null;
      if (here != null && isFinite(here) && here < 1e-2) marker(Fb, c.B, here, 'ring');

      leg.innerHTML = legend([[{ c: 'a', mk: 'dot' }, 'SGD'], [{ c: 'g', dash: true, mk: 'sq' }, 'SGD + momentum, μ and η tuned'],
        [{ c: 'k', dash: 'dot', mk: 'tri' }, 'preconditioned SGD (H<sup>−1/2</sup>)'], [{ c: 'k', w: 1, dash: 'dot' }, 'slope 1: η ∝ B'],
        [{ c: 'b', dash: true }, 'SGD stability limit 2/h<sub>max</sub>'], [{ c: 'b', line: false, mk: 'ring' }, 'your current setting']]);

      var crit = sw[sw.length - 1].B;
      for (var i = 0; i < sw.length; i++) if (sw[i].sgd.loss > 1.1 * sw[0].sgd.loss) { crit = sw[i].B; break; }
      var row = sw[+cB.value];
      out.innerHTML = stat('B', String(c.B)) + stat('SGD: best η, loss', fmtEta(row.sgd.eta) + ', ' + fmtE(row.sgd.loss)) +
        stat('momentum: best μ, η', row.mom.mu + ', ' + fmtEta(row.mom.eta)) + stat('momentum: loss', fmtE(row.mom.loss) + ' (' + (row.sgd.loss / row.mom.loss).toFixed(2) + '× better)') +
        stat('preconditioned: loss', fmtE(row.pre.loss) + ' (' + (row.sgd.loss / row.pre.loss).toFixed(2) + '× better)');
      ver.className = 'w-verdict';
      ver.innerHTML = 'Every point is exact: the best η is found by search over the closed form (momentum also searches μ over ' + MUS.join(', ') + '). SGD’s best η doubles with every doubling of B until it nears the stability limit; its best loss first rises by more than 10% at <strong>B = ' + crit + '</strong>, this toy’s critical batch. Tuned momentum buys almost nothing at B = 1; preconditioning buys a constant factor there (the noise here is the same in both directions, so it also cuts the noise along the steep one). Both gain the most at the largest batches.';
      cap.textContent = 'Each batch size gets the same 8,192 examples, so B = 512 means 16 steps. Left: the tuned step size; momentum is shown as its effective step η/(1−μ). Right: the loss each optimizer reaches with its best settings. Adam is not in the sweep: it has no closed form, and the assignment has you sweep it yourself.';
    }
    function draw() { var c = controls(); if (c.view === 'sweep') drawSweep(c); else drawRun(c); }
    [cOpt, cB, cLR, cMu, cView].forEach(function (e) { e.addEventListener('input', draw); e.addEventListener('change', draw); });
    root.classList.add('ready');
    draw();
  }

  /* ================= widget 2: rotational equilibrium ================= */
  var ETAS = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1], LAMS = [0, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2];
  function initNorm(root) {
    var q = function (s) { return root.querySelector(s); };
    var cMode = q('[data-k=mode]'), cEta = q('[data-k=eta]'), cLam = q('[data-k=lam]'), cSched = q('[data-k=sched]'), cTwin = q('[data-k=twin]');
    var oEta = q('[data-o=eta]'), oLam = q('[data-o=lam]'), lamBox = q('[data-box=lam]'), twinBox = q('[data-box=twin]');
    var svgP = q('svg[data-k=plane]'), svgR = q('svg[data-k=r]'), svgA = q('svg[data-k=ang]'), leg = q('.w-legend'), out = q('.w-out'), ver = q('.w-verdict');
    function draw() {
      var mode = cMode.value, eta = ETAS[+cEta.value], lam = mode === 'ball' ? 0 : LAMS[+cLam.value], sched = cSched.value;
      oEta.textContent = String(eta); oLam.textContent = String(lam);
      lamBox.hidden = mode === 'ball'; twinBox.hidden = mode === 'ball' || lam === 0;
      var twin = mode !== 'ball' && lam > 0 && cTwin.checked;
      var A = normRun({ mode: mode, eta: eta, lam: lam, sched: sched, seed: 11 });
      var Bt = twin ? normRun({ mode: mode, eta: eta * 4, lam: lam / 4, sched: sched, seed: 11 }) : null;

      // the plane
      var rmax = 0; A.r.concat(Bt ? Bt.r : []).forEach(function (v) { if (v > rmax) rmax = v; });
      rmax = Math.max(rmax, R0) * 1.12;
      var tick = Math.pow(10, Math.floor(Math.log10(rmax))), tks = [];
      for (var v = -Math.floor(rmax / tick) * tick; v <= rmax + 1e-12; v += tick) tks.push(+v.toPrecision(3));
      if (tks.length > 7) tks = tks.filter(function (v, i) { return i % 2 === 0; });
      var Fp = frame(svgP, { W: 300, H: 300, l: 42, r: 10, t: 22, b: 32,
        x: { min: -rmax, max: rmax, ticks: tks }, y: { min: -rmax, max: rmax, ticks: tks, label: 'the weight w, in its plane' } });
      var ox = Fp.X(0), oy = Fp.Y(0), sc = Fp.X(1) - Fp.X(0);
      S('line', { x1: ox, y1: oy, x2: ox + Math.cos(PHI_STAR) * rmax * sc, y2: oy - Math.sin(PHI_STAR) * rmax * sc, stroke: 'var(--lk-ink-soft)', 'stroke-width': 1, 'stroke-dasharray': '6 3' }, Fp.g);
      var req = mode === 'ball' ? R0 : eqRadius(eta, lam);
      if (req && sched === 'const') S('circle', { cx: ox, cy: oy, r: req * sc, fill: 'none', stroke: 'var(--lk-forest)', 'stroke-width': 1.6, 'stroke-dasharray': '5 3' }, Fp.g);
      // the paths jitter along their circle (a noisy sign each step), so draw them thin and mark where they end
      if (Bt) line(Fp, Bt.pts, 'c-k', { 'stroke-width': 0.7, opacity: 0.5 });
      line(Fp, A.pts, 'c-a', { 'stroke-width': 0.8, opacity: 0.6 });
      marker(Fp, R0, 0, 'dot', 'pt-k', 3.4);
      if (Bt) { var eb = Bt.pts[Bt.pts.length - 1]; marker(Fp, eb[0], eb[1], 'sq', 'pt-k', 3.6); }
      var ea = A.pts[A.pts.length - 1]; marker(Fp, ea[0], ea[1], 'sq', 'pt-a', 3.6);

      // |w| and the angular step over time
      var stepT = function (arr) { var o = []; for (var t = 0; t < arr.length; t += 6) o.push([t + 1, arr[t]]); o.push([arr.length, arr[arr.length - 1]]); return o; };
      var rr0 = rmax / 1.12 * 1.05, mag = Math.pow(10, Math.floor(Math.log10(rr0))), rTop = Math.ceil(rr0 / mag) * mag;
      var Fr = frame(svgR, { W: 340, H: 150, l: 46, r: 18, t: 22, b: 30,
        x: { min: 0, max: NT, ticks: [0, 1000, 2000, 3000], fmt: nice, label: 'step' },
        y: { min: 0, max: rTop, ticks: [0, +(rTop / 2).toPrecision(2), +rTop.toPrecision(2)], label: '|w|' } });
      if (req && sched === 'const') line(Fr, [[0, req], [NT, req]], 'c-g c-dash', { 'stroke-width': 1.4 });
      if (Bt) { var rq2 = eqRadius(eta * 4, lam / 4); if (sched === 'const' && rq2 < rTop) line(Fr, [[0, rq2], [NT, rq2]], 'c-g c-dash', { 'stroke-width': 1 }); line(Fr, stepT(Bt.r), 'c-k'); }
      line(Fr, stepT(A.r), 'c-a');

      var deg = 180 / Math.PI;
      var Fa = frame(svgA, { W: 340, H: 150, l: 46, r: 18, t: 22, b: 30,
        x: { min: 0, max: NT, ticks: [0, 1000, 2000, 3000], fmt: nice, label: 'step' },
        y: { min: 0.03, max: 60, log: true, ticks: [0.1, 1, 10], fmt: function (v) { return v + '°'; }, label: 'angle turned per step' } });
      var aeq = mode === 'ball' ? Math.atan(eta) : lam > 0 ? eqAngle(eta, lam) : null;
      if (aeq && sched === 'const') line(Fa, [[0, aeq * deg], [NT, aeq * deg]], 'c-g c-dash', { 'stroke-width': 1.4 });
      var degs = function (run) { return run.ang.map(function (a) { return Math.max(a * deg, 0.031); }); };
      if (Bt) line(Fa, stepT(degs(Bt)), 'c-k');
      line(Fa, stepT(degs(A)), 'c-a');

      var L = [[{ c: 'a' }, 'w: η = ' + eta + (mode === 'ball' ? ' (Hyperball)' : ', λ = ' + lam)]];
      if (Bt) L.push([{ c: 'k', w: 1.4 }, 'twin: η = ' + +(eta * 4).toPrecision(3) + ', λ = ' + +(lam / 4).toPrecision(3) + ' (same η·λ)']);
      if (sched === 'const' && (req || aeq)) L.push([{ c: 'g', dash: true }, mode === 'ball' ? 'fixed radius; angle per step = arctan η' : 'predicted equilibrium']);
      L.push([{ c: 'k', w: 1, dash: true }, 'direction of lowest loss'], [{ c: 'k', line: false, mk: 'dot' }, 'start, |w| = ' + R0],
             [{ c: 'a', line: false, mk: 'sq' }, 'where each run ends (paths are thin: they jitter along the circle)']);
      leg.innerHTML = legend(L);

      var tail = function (arr) { var s = 0, n = 0; for (var t = Math.floor(arr.length * 0.9); t < arr.length; t++) { s += arr[t]; n++; } return s / n; };
      var peak = Math.max.apply(null, A.r), fin = A.r[A.r.length - 1];
      var html = stat('final |w|', fmtE(fin)) + stat('final / peak |w|', (100 * fin / peak).toFixed(1) + '%');
      if (sched === 'const' && req) html += stat('predicted |w|', fmtE(req));
      html += stat('angle per step, end', (A.ang[A.ang.length - 1] * deg).toFixed(2) + '°');
      if (aeq && sched === 'const') html += stat(mode === 'ball' ? 'arctan η' : 'predicted (≈ √(2ηλ))', (aeq * deg).toFixed(2) + '°');
      html += stat('loss, last 10%', fmtE(tail(A.loss)));
      if (Bt) html += stat('twin: loss, last 10%', fmtE(tail(Bt.loss)));
      out.innerHTML = html;

      var tau = lam > 0 ? 1 / (2 * eta * lam) : Infinity, cls = '', msg;
      if (mode === 'ball') { cls = 'good'; msg = '<strong>Hyperball:</strong> the norm never moves, so the angle turned per step is arctan η' + (sched === 'linear' ? '<sub>t</sub>, following the schedule exactly' : ' from the first step to the last') + '. The learning rate is the angular step; there is no weight decay to trade against it.'; }
      else if (lam === 0) { cls = 'bad'; msg = '<strong>No weight decay:</strong> every step is at right angles to w, so |w| only grows (|w|² gains η² per step) and the angle turned per step keeps shrinking, like 1/√t. The effective learning rate decays on its own, on a schedule nobody chose.'; }
      else if (NT < 3 * tau) { msg = '<strong>Not at equilibrium yet.</strong> The norm relaxes on a timescale of about 1/(2ηλ) = ' + nice(Math.round(tau)) + ' steps, against the run’s ' + nice(NT) + '. The effective step is still set by the history of the run, not by η and λ.'; }
      else if (sched === 'linear') { cls = 'good'; msg = '<strong>Equilibrium, then a moving one.</strong> The norm first settles toward √(η/(2λ)); as η decays the equilibrium radius shrinks and |w| follows it down, so it ends below its peak. The angle per step falls with η, to zero at the end: the schedule, not the norm, now sets the effective step.'; }
      else { cls = 'good'; msg = '<strong>Equilibrium.</strong> After about 1/(2ηλ) = ' + nice(Math.round(tau)) + ' steps the shrinking and the growth balance. The angle turned per step settles at a value that depends only on η·λ' + (Bt ? ': the twin, with η four times larger and λ four times smaller, sits on a circle four times wider and turns by the same angle.' : '. Tick the twin to see it.'); }
      ver.className = 'w-verdict' + (cls ? ' ' + cls : '');
      ver.innerHTML = msg;
    }
    [cMode, cEta, cLam, cSched, cTwin].forEach(function (e) { e.addEventListener('input', draw); e.addEventListener('change', draw); });
    root.classList.add('ready');
    draw();
  }

  function init() {
    var a = document.getElementById('w-nqm'); if (a) initNQM(a);
    var b = document.getElementById('w-norm'); if (b) initNorm(b);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
