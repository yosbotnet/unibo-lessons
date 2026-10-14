/* u1.js — Unit 1 widgets.
   1. The ladder at one learning rate (illustrative model from fig-surface.js, anchored to CS 312's measured gaps).
   2. Seeds and noise: what a difference between runs can tell you (exact Gaussian arithmetic; sigma measured by CS 312).
   3. Two charts of CS 312's measured quiz-1 numbers (jitter vs batch, WSD decay gaps). */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(parent, x, y, s, attrs) { var t = svg('text', Object.assign({ x: x, y: y }, attrs || {}), parent); t.textContent = s; return t; }
  function $(id) { return document.getElementById(id); }
  function width(el, max) { var w = Math.round(el.clientWidth || 0); return w ? Math.max(300, Math.min(max, w)) : max; }
  function watch(el, draw) {                                  // redraw when the box changes width (also when a hidden answer opens)
    if (!window.ResizeObserver) return;
    var last = 0;
    new ResizeObserver(function () { var w = Math.round(el.clientWidth); if (w && w !== last) { last = w; draw(); } }).observe(el);
  }
  function line(pts) { return pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(''); }

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
    var root = $('w-ladder'); if (!root || !window.Alchemy || !Alchemy.loss) return;
    var M = Alchemy.loss, lrIn = $('lad-lr'), lrOut = $('lad-lr-o'), tuneIn = $('lad-tune'), plot = $('lad-plot');
    var W = 640, H = 300, L = 58, R = 18, T = 16, B = 40;
    var RUNGS = [4, 6, 8, 12, 16];
    function xOf(X) { return L + (Math.log2(X) - 2) / 2 * (W - L - R); }
    var y0 = 2.70, y1 = 3.50;
    function yOf(v) { return T + (y1 - Math.min(Math.max(v, y0), y1)) / (y1 - y0) * (H - T - B); }
    function lrAt(v) { return 0.0005 * Math.pow(100, v / 100); }
    function draw() {
      W = width(plot, 640);
      var lr = lrAt(+lrIn.value), tune = tuneIn.checked;
      lrOut.textContent = lr < 0.001 ? lr.toFixed(5) : lr.toFixed(4);
      plot.innerHTML = '';
      var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'w-plot', role: 'img', 'aria-label': 'Final validation loss against model size, at one learning rate for every rung and at each rung’s own best rate.' }, plot);
      for (var v = 2.8; v <= 3.41; v += 0.1) {
        svg('line', { x1: L, x2: W - R, y1: yOf(v), y2: yOf(v), class: 'grid' }, s);
        txt(s, L - 6, yOf(v) + 4, v.toFixed(1), { 'text-anchor': 'end' });
      }
      RUNGS.forEach(function (X) { svg('line', { x1: xOf(X), x2: xOf(X), y1: T, y2: H - B, class: 'grid' }, s); txt(s, xOf(X), H - B + 16, 'd' + X, { 'text-anchor': 'middle' }); });
      svg('path', { d: 'M' + L + ' ' + T + 'V' + (H - B) + 'H' + (W - R), class: 'ax' }, s);
      txt(s, (L + W - R) / 2, H - 6, W < 480 ? 'model dX (depth X, width 64X)' : 'model dX (depth X, width 64X): parameters grow as X³', { 'text-anchor': 'middle' });
      txt(s, 14, T + (H - T - B) / 2, 'final val loss', { transform: 'rotate(-90 14 ' + (T + (H - T - B) / 2) + ')', 'text-anchor': 'middle' });
      var xs = []; for (var X = 4; X <= 16.001; X *= Math.pow(2, 1 / 16)) xs.push(X);
      var fixed = xs.map(function (X) { return [xOf(X), yOf(M.loss(X, lr))]; });
      var best = xs.map(function (X) { return [xOf(X), yOf(M.lbest(X))]; });
      if (tune) svg('path', { d: line(best), class: 'c-g c-dash' }, s);
      svg('path', { d: line(fixed), class: 'c-a' }, s);
      RUNGS.forEach(function (X) {
        svg('circle', { cx: xOf(X), cy: yOf(M.loss(X, lr)), r: 4, class: 'pt-a' }, s);
        if (tune) svg('rect', { x: xOf(X) - 3.5, y: yOf(M.lbest(X)) - 3.5, width: 7, height: 7, class: 'pt-g' }, s);
      });
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
    draw(); watch(plot, draw);
  }

  /* ---------- 2. seeds and noise ---------- */
  function noise() {
    var root = $('w-noise'); if (!root) return;
    var SIG = 0.0029, dIn = $('nz-d'), nIn = $('nz-n'), rIn = $('nz-r'), plot = $('nz-plot');
    var W = 640, H = 230, L = 20, R = 20, T = 18, B = 40;
    function draw() {
      W = width(plot, 640);
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
      plot.innerHTML = '';
      var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'w-plot', role: 'img', 'aria-label': 'The spread of the difference you would measure between the two arms, with the region where it has the wrong sign shaded.' }, plot);
      var span = Math.max(d + 4 * se, 4 * se, 0.004), xa = -span, xb = span;
      function xOf(v) { return L + (v - xa) / (xb - xa) * (W - L - R); }
      var peak = 1 / (se * Math.sqrt(2 * Math.PI));
      function yOf(p) { return H - B - p / peak * (H - T - B) * 0.92; }
      function pdf(v) { return Math.exp(-0.5 * Math.pow((v - d) / se, 2)) * peak; }
      var N = 160, k, v, pts = [];
      for (k = 0; k <= N; k++) { v = xa + (xb - xa) * k / N; pts.push([xOf(v), yOf(pdf(v))]); }
      // regions: wrong sign (vermilion) and "passes a 2-standard-error test" (forest)
      function area(a, b, cls) {
        if (b <= a) return;
        var q = [[xOf(a), H - B]];
        for (k = 0; k <= 60; k++) { v = a + (b - a) * k / 60; q.push([xOf(v), yOf(pdf(v))]); }
        q.push([xOf(b), H - B]);
        svg('path', { d: line(q) + 'Z', class: cls }, s);
      }
      area(xa, Math.min(0, xb), 'nz-wrong');
      area(Math.max(2 * se, xa), xb, 'nz-pass');
      svg('path', { d: 'M' + L + ' ' + (H - B) + 'H' + (W - R), class: 'ax' }, s);
      svg('path', { d: line(pts), class: 'c-a' }, s);
      svg('line', { x1: xOf(0), x2: xOf(0), y1: T - 4, y2: H - B, class: 'c-k' }, s);
      txt(s, xOf(0), H - B + 15, '0', { 'text-anchor': 'middle' });
      if (d > 0) { svg('line', { x1: xOf(d), x2: xOf(d), y1: T - 4, y2: H - B, class: 'c-g c-dash' }, s); txt(s, xOf(d) + 4, T + 6, 'true Δ', { class: 'lbl-g' }); }
      svg('line', { x1: xOf(2 * se), x2: xOf(2 * se), y1: H - B, y2: H - B + 6, class: 'ax' }, s);
      txt(s, xOf(2 * se), H - B + 15, '2 SE', { 'text-anchor': 'middle' });
      txt(s, xOf(xa) + 2, H - B + 15, (-span).toFixed(3), { 'text-anchor': 'start' });
      txt(s, xOf(xb) - 2, H - B + 15, '+' + span.toFixed(3), { 'text-anchor': 'end' });
      txt(s, (L + W - R) / 2, H - 6, W < 480 ? 'measured difference (B better →)' : 'measured difference in final val loss (B better than A →)', { 'text-anchor': 'middle' });
      var vd = $('nz-verdict');
      if (n === 1 && rho === 0) { vd.className = 'w-verdict bad'; vd.innerHTML = 'One run per arm, unpaired: you cannot even estimate the noise from these runs, and the difference you see carries the full noise of two runs.'; }
      else if (pWrong > 0.1) { vd.className = 'w-verdict bad'; vd.innerHTML = 'About <b>' + Math.round(100 * pWrong) + '%</b> of the time this design shows the wrong winner. More seeds, or pairing, or both.'; }
      else if (pPass < 0.8) { vd.className = 'w-verdict'; vd.innerHTML = 'Usually the right sign, but a 2-standard-error test passes only ' + Math.round(100 * pPass) + '% of the time. Expect &ldquo;inconclusive&rdquo; often; for 80% you need about ' + (need === Infinity ? '∞' : need) + ' runs per arm.'; }
      else { vd.className = 'w-verdict good'; vd.innerHTML = 'This design detects the difference ' + Math.round(100 * pPass) + '% of the time and almost never shows the wrong winner.'; }
    }
    [dIn, nIn, rIn].forEach(function (e) { e.addEventListener('input', draw); });
    draw(); watch(plot, draw);
  }

  /* ---------- 3. measured charts ---------- */
  function jitterChart() {
    var host = $('c-jitter'); if (!host) return;
    draw(); watch(host, draw);
    function draw() {
    host.innerHTML = '';
    var W = width(host, 520), H = 230, L = 56, R = 20, T = 16, B = 40;
    var pts = [[16, 0.0769], [64, 0.0404], [256, 0.0198]];
    function xOf(b) { return L + (Math.log2(b) - 3) / 6 * (W - L - R); }
    function yOf(v) { return T + (Math.log2(0.16) - Math.log2(v)) / (Math.log2(0.16) - Math.log2(0.01)) * (H - T - B); }
    var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'w-plot', role: 'img', 'aria-label': 'Late-training jitter against batch size on log axes: three measured points on a line of slope minus one half.' }, host);
    [0.01, 0.02, 0.04, 0.08, 0.16].forEach(function (v) { svg('line', { x1: L, x2: W - R, y1: yOf(v), y2: yOf(v), class: 'grid' }, s); txt(s, L - 6, yOf(v) + 4, String(v), { 'text-anchor': 'end' }); });
    [8, 16, 32, 64, 128, 256, 512].forEach(function (b) { svg('line', { x1: xOf(b), x2: xOf(b), y1: T, y2: H - B, class: 'grid' }, s); txt(s, xOf(b), H - B + 16, String(b), { 'text-anchor': 'middle' }); });
    svg('path', { d: 'M' + L + ' ' + T + 'V' + (H - B) + 'H' + (W - R), class: 'ax' }, s);
    var ref = function (b) { return 0.0404 * Math.sqrt(64 / b); };
    svg('path', { d: line([[xOf(8), yOf(ref(8))], [xOf(512), yOf(ref(512))]]), class: 'c-k c-dash' }, s);
    pts.forEach(function (p) { svg('circle', { cx: xOf(p[0]), cy: yOf(p[1]), r: 5, class: 'pt-a' }, s); txt(s, xOf(p[0]) + 8, yOf(p[1]) - 7, p[1].toFixed(3), { class: 'lbl-a' }); });
    txt(s, (L + W - R) / 2, H - 6, 'batch size (sequences)', { 'text-anchor': 'middle' });
    txt(s, W - R - 4, yOf(ref(512)) - 8, '∝ 1/√B', { 'text-anchor': 'end' });
    }
  }
  function wsdChart() {
    var host = $('c-wsd'); if (!host) return;
    draw(); watch(host, draw);
    function draw() {
    host.innerHTML = '';
    var W = width(host, 520), H = 220, L = 56, R = 20, T = 16, B = 40;
    var pts = [['2%', 0.085], ['5%', 0.051], ['10%', 0.030], ['20%', 0.009]];
    var bw = (W - L - R) / pts.length;
    function yOf(v) { return T + (0.1 - v) / 0.1 * (H - T - B); }
    var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'w-plot', role: 'img', 'aria-label': 'Final-loss gap of each WSD run to the linear-decay run, for decay fractions of 2, 5, 10 and 20 percent, with the 0.02 threshold drawn.' }, host);
    [0, 0.02, 0.04, 0.06, 0.08, 0.1].forEach(function (v) { svg('line', { x1: L, x2: W - R, y1: yOf(v), y2: yOf(v), class: 'grid' }, s); txt(s, L - 6, yOf(v) + 4, v.toFixed(2), { 'text-anchor': 'end' }); });
    pts.forEach(function (p, i) {
      var x = L + i * bw + bw * 0.22, w = bw * 0.56, ok = p[1] < 0.02;
      svg('rect', { x: x, y: yOf(p[1]), width: w, height: yOf(0) - yOf(p[1]), class: ok ? 'pt-g' : 'pt-a' }, s);
      txt(s, x + w / 2, yOf(p[1]) - 5, '+' + p[1].toFixed(3), { 'text-anchor': 'middle', class: ok ? 'lbl-g' : 'lbl-a' });
      txt(s, x + w / 2, H - B + 16, p[0], { 'text-anchor': 'middle' });
    });
    svg('line', { x1: L, x2: W - R, y1: yOf(0.02), y2: yOf(0.02), class: 'c-b c-dash' }, s);
    txt(s, W - R - 4, yOf(0.02) - 5, 'within 0.02', { 'text-anchor': 'end', class: 'lbl-b' });
    svg('path', { d: 'M' + L + ' ' + T + 'V' + yOf(0) + 'H' + (W - R), class: 'ax' }, s);
    txt(s, (L + W - R) / 2, H - 6, 'fraction of training spent decaying', { 'text-anchor': 'middle' });
    }
  }

  function init() { ladder(); noise(); jitterChart(); wsdChart(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
