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

  /* ================= drawing: the explainer kit's charts (assets/xp/xp-plot.js) ================= */
  var XP = window.XP;
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
  function stat(k, v) { return '<div class="w-stat"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>'; }
  // a chart per host, made on first use and redrawn from a spec after that; one legend shared by the widget's charts
  function chart(host) {
    var P = null;
    return function (spec) { spec.legend = false; if (P) P.draw(spec); else P = XP.plot(host, spec); };
  }
  function clamp(v, lo, hi) { return v == null || !isFinite(v) ? null : Math.max(lo, Math.min(hi, v)); }
  var LOGT = [1e-4, 1e-3, 1e-2, 1e-1, 1, 10];
  function fmtPow(v) { var e = Math.round(Math.log10(v)); return e === 0 ? '1' : e === 1 ? '10' : '10' + String(e).replace(/[-0-9]/g, function (c) { return '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(c)]; }); }

  /* ================= widget 1: the noisy quadratic ================= */
  function initNQM(root) {
    var q = function (s) { return root.querySelector(s); };
    var cOpt = q('[data-k=opt]'), cB = q('[data-k=b]'), cLR = q('[data-k=lr]'), cMu = q('[data-k=mu]'), cView = q('[data-k=view]');
    var oB = q('[data-o=b]'), oLR = q('[data-o=lr]'), oMu = q('[data-o=mu]'), muBox = q('[data-box=mu]');
    var plotA = chart(q('.u2a-plot[data-k=a]')), plotB = chart(q('.u2a-plot[data-k=b]')), leg = q('.w-legend'), out = q('.w-out'), ver = q('.w-verdict'), cap = q('[data-k=cap]');
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
      var contours = [0.02, 0.1, 0.3, 0.7, 1.4, 2.4].map(function (L) {
        var rx = Math.sqrt(2 * L), ry = Math.sqrt(2 * L / 10), d = [];
        for (var k = 0; k <= 72; k++) { var u = 2 * Math.PI * k / 72; d.push([rx * Math.cos(u), ry * Math.sin(u)]); }
        return { kind: 'line', data: d, mat: 'steel', width: 1, o: 0.45 };
      });
      var P = sim.path, n = P.length, keep = [];
      for (var i = 0; i < n; i++) if (i < 400 || i % Math.ceil(n / 1200) === 0 || i === n - 1) keep.push([clamp(P[i][0], -9, 9), clamp(P[i][1], -9, 9)]);
      var last = P[n - 1], inside = Math.abs(last[0]) < 2.4 && Math.abs(last[1]) < 1.2;
      var sA = contours.concat([
        { kind: 'line', data: keep, width: 1.3, label: 'one run’s path' },
        { kind: 'points', data: [[0, 0]], shape: 'cross', mat: 'workx', label: 'the minimum' },
        { kind: 'points', data: [P[0]], mat: 'ink', label: 'its start' },
        { kind: 'points', data: inside ? [last] : [], shape: 'sq', label: 'where it ends' }
      ]);
      plotA({ label: 'The loss surface’s contours and the path of one seeded run, in the plane of the two weights.', equal: true,
        x: { min: -2.4, max: 2.4, ticks: [-2, -1, 0, 1, 2], label: 'w1 (flat, h = 1)', grid: true },
        y: { min: -1.2, max: 1.2, ticks: [-1, 0, 1], label: 'w2 (steep, h = 10)' }, series: sA });

      // right: expected loss against examples seen
      function pts(arr) { var o = []; for (var t = 0; t <= c.T; t++) o.push([Math.max(1, t * c.B), clamp(arr[t], 1e-6, 1e4)]); return o; }
      var sB = [{ kind: 'line', data: pts(sim.one), mat: 'ink', width: 0.9, o: 0.55, label: 'the one run' },
                { kind: 'line', data: pts(sim.mean), mat: exact ? 'ink' : 'subject', dash: true, width: 1.6, label: 'mean of ' + RUNS + ' simulated runs' + (exact ? '' : ' (Adam has no closed form)') }];
      if (cur) sB.push({ kind: 'line', data: pts(cur), label: 'expected loss, exact' });
      if (floor != null) sB.push({ kind: 'line', data: [[1, floor], [NTOT, floor]], mat: 'memx', dash: true, width: 1.4, label: 'noise floor if it ran forever' });
      plotB({ label: 'Loss against examples seen, on log axes: the exact expected loss, the mean of simulated runs and one run.',
        x: { log: true, min: 1, max: NTOT, ticks: [1, 8, 64, 512, 4096], fmt: nice, label: 'examples seen (steps × B)', grid: true },
        y: { log: true, min: 1e-4, max: 10, ticks: LOGT, fmt: fmtPow, label: 'loss' }, series: sB });
      leg.innerHTML = XP.plot.keys(sA.concat(sB));

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
      var effEta = c.opt === 'mom' ? c.eta / (1 - c.mu) : c.eta, e1 = sw[0].sgd.eta;
      var X = { log: true, min: 0.8, max: 640, ticks: [1, 4, 16, 64, 256], label: 'batch size B', grid: true };
      function row(f) { return sw.map(function (r) { return [r.B, f(r)]; }); }
      var sgd = { kind: 'line', shape: 'dot', label: 'SGD' },
          mom = { kind: 'line', shape: 'sq', mat: 'workx', dash: true, label: 'SGD + momentum, μ and η tuned' },
          pre = { kind: 'line', shape: 'tri', mat: 'ink', dash: '1 3', width: 1.8, label: 'preconditioned SGD (H⁻¹ᐟ²)' };
      var sA = [
        Object.assign({ data: row(function (r) { return r.sgd.eta; }) }, sgd),
        Object.assign({ data: row(function (r) { return r.mom.eta / (1 - r.mom.mu); }) }, mom),
        Object.assign({ data: row(function (r) { return r.pre.eta; }) }, pre),
        { kind: 'line', data: [[0.8, e1 * 0.8], [640, e1 * 640]], mat: 'ink', width: 1, dash: '2 3', label: 'slope 1: η ∝ B' },
        { kind: 'points', data: [[c.B, effEta]], shape: 'ring', mat: 'memx', label: 'your current setting' }
      ];
      plotA({ label: 'The best step size against batch size for SGD, momentum and preconditioned SGD, with the stability limit.',
        x: X, y: { log: true, min: 1e-4, max: 1, ticks: [1e-4, 1e-3, 1e-2, 1e-1, 1], fmt: fmtPow, label: 'best step (momentum: η/(1−μ))', short: 'best step size' },
        series: sA, refs: [{ y: 0.2, label: 'SGD limit 2/hₘₐₓ', mat: 'memx' }] });
      var here = c.opt !== 'adam' ? finalExact(c.opt, c.eta, c.B, c.T, c.mu).loss : null;
      var sB = [
        Object.assign({ data: row(function (r) { return r.sgd.loss; }) }, sgd),
        Object.assign({ data: row(function (r) { return r.mom.loss; }) }, mom),
        Object.assign({ data: row(function (r) { return r.pre.loss; }) }, pre),
        { kind: 'points', data: here != null && isFinite(here) && here < 1e-2 ? [[c.B, here]] : [], shape: 'ring', mat: 'memx' }
      ];
      plotB({ label: 'The best final loss against batch size for each optimizer, its step size tuned.',
        x: X, y: { log: true, min: 1e-4, max: 1e-2, ticks: [1e-4, 1e-3, 1e-2], fmt: fmtPow, label: 'best final loss, η tuned' }, series: sB });
      leg.innerHTML = XP.plot.keys(sA.concat([{ legendOnly: true, mat: 'memx', dash: true, label: 'SGD stability limit 2/hₘₐₓ' }]));

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
    var plotP = chart(q('.u2a-plot[data-k=plane]')), plotR = chart(q('.u2a-plot[data-k=r]')), plotA = chart(q('.u2a-plot[data-k=ang]')), leg = q('.w-legend'), out = q('.w-out'), ver = q('.w-verdict');
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
      var req = mode === 'ball' ? R0 : eqRadius(eta, lam), aeq = mode === 'ball' ? Math.atan(eta) : lam > 0 ? eqAngle(eta, lam) : null, deg = 180 / Math.PI;
      function circle(r) { var d = []; for (var k = 0; k <= 96; k++) { var u = 2 * Math.PI * k / 96; d.push([r * Math.cos(u), r * Math.sin(u)]); } return d; }
      var aLab = 'w: η = ' + eta + (mode === 'ball' ? ' (Hyperball)' : ', λ = ' + lam), bLab = Bt ? 'twin: η = ' + +(eta * 4).toPrecision(3) + ', λ = ' + +(lam / 4).toPrecision(3) + ' (same η·λ)' : '';
      var eqOn = sched === 'const' && (req || aeq), eqLab = mode === 'ball' ? 'fixed radius; angle per step = arctan η' : 'predicted equilibrium';
      var ea = A.pts[A.pts.length - 1], eb = Bt ? Bt.pts[Bt.pts.length - 1] : null;
      var sP = [{ kind: 'line', data: [[0, 0], [Math.cos(PHI_STAR) * rmax * 1.5, Math.sin(PHI_STAR) * rmax * 1.5]], mat: 'ink', width: 1, dash: '6 3', label: 'direction of lowest loss' }];
      if (req && sched === 'const') sP.push({ kind: 'line', data: circle(req), mat: 'workx', width: 1.6, dash: '5 3' });
      if (Bt) sP.push({ kind: 'line', data: Bt.pts, mat: 'ink', width: 0.7, o: 0.5 });
      sP.push({ kind: 'line', data: A.pts, width: 0.8, o: 0.6 },
              { kind: 'points', data: [[R0, 0]], mat: 'ink', r: 3.4, label: 'start, |w| = ' + R0 },
              { kind: 'points', data: eb ? [eb] : [], mat: 'ink', shape: 'sq', r: 3.6 },
              { kind: 'points', data: [ea], shape: 'sq', r: 3.6, label: 'where each run ends (paths are thin: they jitter along the circle)' });
      plotP({ label: 'The weight’s path in its plane, spiralling out from a small start and settling on a circle when weight decay is on.', equal: true, aspect: 1,
        x: { min: -rmax, max: rmax, ticks: tks, grid: true }, y: { min: -rmax, max: rmax, ticks: tks, label: 'the weight w, in its plane' }, series: sP });

      // |w| and the angular step over time
      var stepT = function (arr) { var o = []; for (var t = 0; t < arr.length; t += 6) o.push([t + 1, arr[t]]); o.push([arr.length, arr[arr.length - 1]]); return o; };
      var rr0 = rmax / 1.12 * 1.05, mag = Math.pow(10, Math.floor(Math.log10(rr0))), rTop = Math.ceil(rr0 / mag) * mag;
      var X = { min: 0, max: NT, ticks: [0, 1000, 2000, 3000], fmt: nice, label: 'step' };
      var sR = [];
      if (req && sched === 'const') sR.push({ kind: 'line', data: [[0, req], [NT, req]], mat: 'workx', dash: true, width: 1.4 });
      if (Bt) { var rq2 = eqRadius(eta * 4, lam / 4); if (sched === 'const' && rq2 < rTop) sR.push({ kind: 'line', data: [[0, rq2], [NT, rq2]], mat: 'workx', dash: true, width: 1 }); sR.push({ kind: 'line', data: stepT(Bt.r), mat: 'ink', width: 1.4 }); }
      sR.push({ kind: 'line', data: stepT(A.r) });
      plotR({ label: 'The weight’s norm against step.', aspect: 0.42, x: X, y: { min: 0, max: rTop, ticks: [0, +(rTop / 2).toPrecision(2), +rTop.toPrecision(2)], label: '|w|' }, series: sR });

      var degs = function (run) { return run.ang.map(function (a) { return Math.max(a * deg, 0.031); }); };
      var sA = [];
      if (aeq && sched === 'const') sA.push({ kind: 'line', data: [[0, aeq * deg], [NT, aeq * deg]], mat: 'workx', dash: true, width: 1.4 });
      if (Bt) sA.push({ kind: 'line', data: stepT(degs(Bt)), mat: 'ink', width: 1.4 });
      sA.push({ kind: 'line', data: stepT(degs(A)) });
      plotA({ label: 'Angle turned per step against step, log scale.', aspect: 0.42, x: X,
        y: { log: true, min: 0.03, max: 60, ticks: [0.1, 1, 10], fmt: function (v) { return v + '°'; }, label: 'angle per step', short: 'angle/step' }, series: sA });

      var L = [{ label: aLab }];
      if (Bt) L.push({ label: bLab, mat: 'ink', width: 1.4 });
      if (eqOn) L.push({ label: eqLab, mat: 'workx', dash: '5 3' });
      leg.innerHTML = XP.plot.keys(L.concat(sP.filter(function (x) { return x.label; })));

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
