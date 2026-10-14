/* u1.js — Unit 1 widgets.
   1. The ladder at one learning rate (illustrative model from fig-surface.js, anchored to CS 312's measured gaps).
   2. Seeds and noise: what a difference between runs can tell you (exact Gaussian arithmetic; sigma measured by CS 312).
   3. Two charts of CS 312's measured quiz-1 numbers (jitter vs batch, WSD decay gaps).
   Charts are the explainer kit's (assets/xp/xp-plot.js): drawn at the box's width, redrawn when it changes. */
(function () {
  'use strict';
  var XP = window.XP || {};
  function $(id) { return document.getElementById(id); }

  /* ---------- statistics helpers ---------- */
  function erf(x) {                                            // Abramowitz-Stegun 7.1.26, |error| < 1.5e-7
    var s = x < 0 ? -1 : 1; x = Math.abs(x);
    var t = 1 / (1 + 0.3275911 * x);
    var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  function Phi(z) { return 0.5 * (1 + erf(z / Math.SQRT2)); }
  function lgamma(x) {                                         // Lanczos
    var g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
      12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
    x -= 1; var a = c[0], t = x + g + 0.5;
    for (var i = 1; i < 9; i++) a += c[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }
  function gammaP(a, x) {                                      // regularized lower incomplete gamma
    if (x <= 0) return 0;
    if (x < a + 1) {
      var sum = 1 / a, del = sum, ap = a;
      for (var n = 0; n < 500; n++) { ap += 1; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-14) break; }
      return sum * Math.exp(-x + a * Math.log(x) - lgamma(a));
    }
    var b = x + 1 - a, c = 1 / 1e-300, d = 1 / b, h = d;
    for (var i = 1; i < 500; i++) {
      var an = -i * (i - a); b += 2;
      d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
      c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d; var dl = d * c; h *= dl; if (Math.abs(dl - 1) < 1e-14) break;
    }
    return 1 - Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
  }
  function chi2q(p, k) {                                       // quantile of chi-square with k degrees of freedom
    var lo = 0, hi = Math.max(10, k * 10);
    for (var i = 0; i < 200; i++) { var m = (lo + hi) / 2; if (gammaP(k / 2, m / 2) < p) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }
  window.AlchemyStats = { Phi: Phi, chi2q: chi2q, gammaP: gammaP };

  /* ---------- 1. the ladder at one learning rate ---------- */
  function ladder() {
    var root = $('w-ladder'); if (!root || !window.Alchemy || !Alchemy.loss || !XP.plot) return;
    var M = Alchemy.loss, lrIn = $('lad-lr'), lrOut = $('lad-lr-o'), tuneIn = $('lad-tune'), plot = $('lad-plot');
    var RUNGS = [4, 6, 8, 12, 16], P = null;
    function lrAt(v) { return 0.0005 * Math.pow(100, v / 100); }
    function draw() {
      var lr = lrAt(+lrIn.value), tune = tuneIn.checked;
      lrOut.textContent = lr < 0.001 ? lr.toFixed(5) : lr.toFixed(4);
      var series = [
        { kind: 'line', fn: function (X) { return M.loss(X, lr); }, from: 4, to: 16, label: 'every rung at the chosen rate' },
        { kind: 'points', data: RUNGS.map(function (X) { return [X, M.loss(X, lr)]; }) }
      ];
      if (tune) series.push({ kind: 'line', fn: M.lbest, from: 4, to: 16, mat: 'workx', dash: true, label: 'each rung at its best rate' },
                            { kind: 'points', shape: 'sq', mat: 'workx', data: RUNGS.map(function (X) { return [X, M.lbest(X)]; }) });
      var spec = {
        label: 'Final validation loss against model size, at one learning rate for every rung' + (tune ? ' and at each rung’s own best rate.' : '.'),
        x: { log: 2, min: 4, max: 16, ticks: RUNGS, fmt: function (X) { return 'd' + X; }, grid: true,
             label: 'model dX (depth X, width 64X): parameters grow as X³', short: 'model dX (depth X, width 64X)' },
        y: { min: 2.7, max: 3.5, label: 'final val loss' },
        series: series, aspect: 0.47
      };
      if (P) P.draw(spec); else P = XP.plot(plot, spec);
      var gFix = M.loss(8, lr) - M.loss(16, lr), gTrue = M.lbest(8) - M.lbest(16), ratio = gFix / gTrue;
      $('lad-gfix').textContent = gFix.toFixed(3);
      $('lad-gtrue').textContent = gTrue.toFixed(3);
      $('lad-ratio').textContent = Math.round(100 * ratio) + '%';
      $('lad-best').textContent = M.lrStar(4).toFixed(4) + ' → ' + M.lrStar(16).toFixed(4);
      var vd = $('lad-verdict');
      if (ratio < 0.85) { vd.className = 'w-verdict bad'; vd.innerHTML = 'At this rate the ladder shows only <b>' + Math.round(100 * ratio) + '%</b> of what d16 really buys over d8. The rate is closer to the small rungs&rsquo; optimum than to the big ones&rsquo;, so the big rungs lose more to it and the curve bends early and &ldquo;width stops paying&rdquo; looks like a finding.'; }
      else if (ratio > 1.15) { vd.className = 'w-verdict bad'; vd.innerHTML = 'At this rate the ladder shows <b>' + Math.round(100 * ratio) + '%</b> of the real gain: the rate is too low for every rung, but further from the small rungs&rsquo; optimum, so they are hurt more and scale looks better than it is.'; }
      else { vd.className = 'w-verdict good'; vd.innerHTML = 'Within 15% of the true gain: this rate sits between the rungs&rsquo; optima, so the errors roughly cancel. That is luck, not a property of the ladder.'; }
    }
    lrIn.addEventListener('input', draw); tuneIn.addEventListener('change', draw);
    draw();
  }

  /* ---------- 2. seeds and noise ---------- */
  function noise() {
    var root = $('w-noise'); if (!root || !XP.plot) return;
    var SIG = 0.0029, dIn = $('nz-d'), nIn = $('nz-n'), rIn = $('nz-r'), plot = $('nz-plot'), P = null;
    function draw() {
      var d = +dIn.value / 10000, n = +nIn.value, rho = +rIn.value / 100;
      $('nz-d-o').textContent = d.toFixed(4) + ' (' + (d / SIG).toFixed(1) + 'σ)';
      $('nz-n-o').textContent = n;
      $('nz-r-o').textContent = rho === 0 ? '0 · unpaired' : rho.toFixed(2);
      var se = SIG * Math.sqrt(2 * (1 - rho) / n);
      var pWrong = d > 0 ? Phi(-d / se) : 0.5;
      var pPass = Phi(d / se - 2) + Phi(-d / se - 2);
      var need = d > 0 ? Math.ceil(2 * (1 - rho) * Math.pow((2 + 0.8416) * SIG / d, 2)) : Infinity;
      $('nz-se').textContent = se.toFixed(4);
      $('nz-wrong').textContent = (100 * pWrong).toFixed(pWrong < 0.01 ? 2 : 0) + '%';
      $('nz-pass').textContent = Math.round(100 * pPass) + '%';
      $('nz-need').textContent = need === Infinity ? '∞' : need > 999 ? '> 999' : String(need);
      var lo = n > 1 ? Math.sqrt((n - 1) / chi2q(0.975, n - 1)) : null, hi = n > 1 ? Math.sqrt((n - 1) / chi2q(0.025, n - 1)) : null;
      $('nz-sig').textContent = n > 1 ? lo.toFixed(2) + '× to ' + (hi < 10 ? hi.toFixed(1) : hi.toFixed(0)) + '×' : 'unknown';
      var span = Math.max(d + 4 * se, 4 * se, 0.004), peak = 1 / (se * Math.sqrt(2 * Math.PI));
      function pdf(v) { return Math.exp(-0.5 * Math.pow((v - d) / se, 2)) * peak; }
      var series = [
        { kind: 'area', fn: pdf, from: -span, to: Math.min(0, span), mat: 'memx', label: 'wrong winner' },
        { kind: 'area', fn: pdf, from: Math.min(2 * se, span), to: span, mat: 'workx', label: 'passes a 2-standard-error test' },
        { kind: 'line', fn: pdf, from: -span, to: span, n: 200, label: 'spread of the difference you would measure' }
      ];
      var refs = [{ x: 0, mat: 'ink', dash: false }, { x: 2 * se, label: '2 SE', mat: 'ink' }];
      if (d > 0) { refs.push({ x: d, label: 'true Δ', mat: 'workx' }); series.push({ legendOnly: true, mat: 'workx', dash: true, label: 'the true difference' }); }
      var spec = {
        label: 'The spread of the difference you would measure between the two arms, with the region where it has the wrong sign shaded.',
        x: { min: -span, max: span, fmt: function (v) { return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(3).replace(/^0\.000$/, '0'); },
             label: 'measured difference in final val loss (B better than A →)', short: 'measured difference (B better →)' },
        y: { min: 0, max: peak * 1.09, ticks: [], grid: false },
        series: series, refs: refs, aspect: 0.36
      };
      if (P) P.draw(spec); else P = XP.plot(plot, spec);
      var vd = $('nz-verdict');
      if (n === 1 && rho === 0) { vd.className = 'w-verdict bad'; vd.innerHTML = 'One run per arm, unpaired: you cannot even estimate the noise from these runs, and the difference you see carries the full noise of two runs.'; }
      else if (pWrong > 0.1) { vd.className = 'w-verdict bad'; vd.innerHTML = 'About <b>' + Math.round(100 * pWrong) + '%</b> of the time this design shows the wrong winner. More seeds, or pairing, or both.'; }
      else if (pPass < 0.8) { vd.className = 'w-verdict'; vd.innerHTML = 'Usually the right sign, but a 2-standard-error test passes only ' + Math.round(100 * pPass) + '% of the time. Expect &ldquo;inconclusive&rdquo; often; for 80% you need about ' + (need === Infinity ? '∞' : need) + ' runs per arm.'; }
      else { vd.className = 'w-verdict good'; vd.innerHTML = 'This design detects the difference ' + Math.round(100 * pPass) + '% of the time and almost never shows the wrong winner.'; }
    }
    [dIn, nIn, rIn].forEach(function (e) { e.addEventListener('input', draw); });
    draw();
  }

  /* ---------- 3. measured charts ---------- */
  function jitterChart() {
    var host = $('c-jitter'); if (!host || !XP.plot) return;
    var pts = [[16, 0.0769], [64, 0.0404], [256, 0.0198]];
    XP.plot(host, {
      label: 'Late-training jitter against batch size on log axes: three measured points on a line of slope minus one half.',
      x: { log: 2, min: 8, max: 512, ticks: [16, 64, 256], label: 'batch size (sequences)', grid: true },
      y: { log: 2, min: 0.01, max: 0.16, ticks: [0.01, 0.02, 0.04, 0.08, 0.16], fmt: String, label: 'jitter' },
      series: [
        { kind: 'line', fn: function (b) { return 0.0404 * Math.sqrt(64 / b); }, mat: 'ink', dash: true, label: '∝ 1/√B through batch 64' },
        { kind: 'points', data: pts, r: 4.5, label: 'measured (CS 312)' }
      ],
      notes: pts.map(function (p) { return { x: p[0], y: p[1], text: p[1].toFixed(3), align: 'l', dy: -9, mat: 'subject' }; }),
      aspect: 0.5
    });
  }
  function wsdChart() {
    var host = $('c-wsd'); if (!host || !XP.plot) return;
    var pts = [['2%', 0.085], ['5%', 0.051], ['10%', 0.030], ['20%', 0.009]];
    function bars(ok) { return pts.map(function (p, i) { return [i + 1, (p[1] < 0.02) === ok ? p[1] : null]; }); }
    XP.plot(host, {
      label: 'Final-loss gap of each WSD run to the linear-decay run, for decay fractions of 2, 5, 10 and 20 percent, with the 0.02 threshold drawn.',
      x: { min: 0.4, max: 4.6, ticks: [1, 2, 3, 4], fmt: function (i) { return pts[i - 1][0]; }, label: 'fraction of training spent decaying' },
      y: { min: 0, max: 0.1, label: 'gap to linear decay' },
      series: [
        { kind: 'bars', data: bars(false), w: 0.56, mat: 'memx', label: 'more than 0.02 worse' },
        { kind: 'bars', data: bars(true), w: 0.56, mat: 'workx', label: 'within 0.02' }
      ],
      refs: [{ y: 0.02, label: 'within 0.02', mat: 'subject' }],
      notes: pts.map(function (p, i) { return { x: i + 1, y: p[1], text: '+' + p[1].toFixed(3), mat: p[1] < 0.02 ? 'workx' : 'memx' }; }),
      aspect: 0.5
    });
  }

  function init() { ladder(); noise(); jitterChart(); wsdChart(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
