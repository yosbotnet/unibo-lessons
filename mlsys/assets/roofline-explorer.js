/* roofline-explorer.js — place real kernels on the RTX 5070 roofline.
   Log-log: x = arithmetic intensity (FLOP per DRAM byte), y = TFLOP/s.
   Attainable = min(peak of the chosen roof, intensity x bandwidth). */
(function () {
  'use strict';
  var host = document.getElementById('w-roofline');
  if (!host) return;

  var BW = 0.672;                 // TB/s, DRAM spec
  var BW_PRACT = 0.672 * 0.88;    // a typical achievable fraction (lab 0 measures yours)
  var ROOFS = {
    fp32: { label: 'FP32 CUDA cores', peak: 30.9, color: 'var(--lk-cobalt)' },
    fp16: { label: 'FP16 tensor, FP32 acc', peak: 61.7, color: 'var(--lk-forest)' },
    fp8:  { label: 'FP8 tensor, FP32 acc', peak: 123.5, color: 'var(--lk-ink-soft)' },
    fp4:  { label: 'FP4 tensor', peak: 493.9, color: 'var(--lk-rule)' }
  };
  // K = N = 4096 for the decode layer: AI = 2KNB / (2KN + 2B(K+N)) bytes in FP16
  function decodeAI(b) { var K = 4096, N = 4096; return (2 * K * N * b) / (2 * K * N + 2 * b * (K + N)); }
  var PRESETS = [
    { id: 'vecadd', label: 'vecadd (FP32)', ai: 1 / 12, roof: 'fp32',
      how: '1 add per element; read 8 B, write 4 B: 1 / 12 FLOP/B.' },
    { id: 'saxpy', label: 'SAXPY y = a·x + y (FP32)', ai: 2 / 12, roof: 'fp32',
      how: '1 FMA = 2 FLOPs per element; read x and y, write y: 12 B.' },
    { id: 'softmax', label: 'softmax, fused, one row per block (FP32)', ai: 5 / 8, roof: 'fp32',
      how: '≈5 FLOPs per element (max, subtract, exp, sum, scale); read 4 B, write 4 B once.' },
    { id: 'layernorm', label: 'layernorm, fused (FP32)', ai: 1, roof: 'fp32',
      how: '≈8 FLOPs per element (mean, variance, normalize, scale, shift); 8 B per element.' },
    { id: 'naive', label: 'naive matmul, no reuse (FP32)', ai: 0.25, roof: 'fp32',
      how: 'Every FMA fetches both operands from DRAM: 2 FLOPs per 8 B. Caches rescue some of it in practice.' },
    { id: 'tile32', label: 'tiled matmul, 32×32 shared tiles (FP32)', ai: 8, roof: 'fp32',
      how: 'Each element loaded into shared memory is used 32 times: 32 × 2 FLOPs per 2 × 4 B.' },
    { id: 'regtile', label: 'register-tiled matmul, 128×128 block tile (FP32)', ai: 32, roof: 'fp32',
      how: 'A 128×128 output tile per block: 2·128·128 FLOPs per (128 + 128)·4 B loaded per k-step.' },
    { id: 'gemm', label: 'GEMM 4096×4096×4096 (FP16, tensor cores)', ai: 4096 / 3, roof: 'fp16',
      how: '2·4096³ FLOPs over 3 matrices of 4096² × 2 B, each read or written once: N / 3.' },
    { id: 'decode', label: 'decode linear layer 4096×4096 (FP16 weights) — batch slider', ai: 1, roof: 'fp16', batch: true,
      how: 'Weights read once per step and used by every sequence in the batch: intensity ≈ batch size.' },
    { id: 'attdec', label: 'attention, decode step (FP16 KV cache)', ai: 1, roof: 'fp16',
      how: 'Each sequence reads its own KV cache: ~1 FLOP per byte, and batching does not share it.' },
    { id: 'attpre', label: 'attention, prefill, FlashAttention-2 (L = 4096, d = 128, FP16)', ai: 124, roof: 'fp16',
      how: '4·L²·d FLOPs; K and V re-read once per 128-row query tile: ≈ 1 / (1/128 + 1/L) FLOP/B.' },
    { id: 'custom', label: 'custom intensity (slider)', ai: 10, roof: 'fp32', custom: true,
      how: 'Drag the slider: where does the kernel sit, and which limit binds?' }
  ];

  // plot geometry (same frame as the chapter's figures)
  var L = 78, R = 640, T = 22, B = 300, XMIN = -2, XMAX = 4, YMIN = -3, YMAX = 3;
  function X(ai) { return L + (Math.log10(ai) - XMIN) / (XMAX - XMIN) * (R - L); }
  function Y(tf) { return B - (Math.log10(tf) - YMIN) / (YMAX - YMIN) * (B - T); }
  var NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, text) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }

  host.innerHTML =
    '<h4>Roofline explorer</h4>' +
    '<p class="w-sub">Pick a kernel. Its point sits at its arithmetic intensity; the roof above it is the best it can possibly do on your card.</p>' +
    '<div class="w-controls">' +
      '<label>Kernel<select id="rf-k"></select></label>' +
      '<label>Compute roof<select id="rf-r"></select></label>' +
      '<label id="rf-bl" hidden>Batch: <output id="rf-bo"></output><input id="rf-b" type="range" min="0" max="9" step="1" value="0"></label>' +
      '<label id="rf-al" hidden>Intensity: <output id="rf-ao"></output><input id="rf-a" type="range" min="-2" max="4" step="0.05" value="1"></label>' +
    '</div>' +
    '<div class="figure-diagram rf-plot" tabindex="0" role="region" aria-label="Roofline chart"></div>' +
    '<div class="w-out">' +
      '<div class="w-stat"><span class="k">intensity</span><span class="v" id="rf-ai"></span></div>' +
      '<div class="w-stat"><span class="k">attainable (spec)</span><span class="v" id="rf-att"></span></div>' +
      '<div class="w-stat"><span class="k">attainable (≈88% DRAM)</span><span class="v" id="rf-prac"></span></div>' +
      '<div class="w-stat"><span class="k">ridge of this roof</span><span class="v" id="rf-ridge"></span></div>' +
    '</div>' +
    '<p class="rf-how" id="rf-how"></p>' +
    '<div class="w-verdict" id="rf-v" role="status" aria-live="polite"></div>';

  var kSel = host.querySelector('#rf-k'), rSel = host.querySelector('#rf-r');
  PRESETS.forEach(function (p) { var o = document.createElement('option'); o.value = p.id; o.textContent = p.label; kSel.appendChild(o); });
  Object.keys(ROOFS).forEach(function (k) { var o = document.createElement('option'); o.value = k; o.textContent = ROOFS[k].label + ' · ' + ROOFS[k].peak; rSel.appendChild(o); });

  // static chart
  var svg = el('svg', { viewBox: '0 0 660 340', style: 'width:660px', 'font-family': 'var(--lk-mono)', role: 'img', 'aria-label': 'Roofline chart of the RTX 5070 with the selected kernel' });
  svg.appendChild(el('rect', { x: L, y: T, width: R - L, height: B - T, fill: 'var(--lk-paper)', stroke: 'var(--lk-rule-soft)' }));
  var XL = { '-2': '0.01', '-1': '0.1', '0': '1', '1': '10', '2': '100', '3': '1k', '4': '10k' };
  var YL = { '-3': '0.001', '-2': '0.01', '-1': '0.1', '0': '1', '1': '10', '2': '100', '3': '1000' };
  for (var e = XMIN; e <= XMAX; e++) {
    svg.appendChild(el('line', { x1: X(Math.pow(10, e)), y1: T, x2: X(Math.pow(10, e)), y2: B, stroke: 'var(--lk-rule-soft)', 'stroke-width': 0.6 }));
    svg.appendChild(el('text', { x: X(Math.pow(10, e)), y: B + 14, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--lk-ink-soft)' }, XL[e]));
  }
  for (e = YMIN; e <= YMAX; e++) {
    svg.appendChild(el('line', { x1: L, y1: Y(Math.pow(10, e)), x2: R, y2: Y(Math.pow(10, e)), stroke: 'var(--lk-rule-soft)', 'stroke-width': 0.6 }));
    svg.appendChild(el('text', { x: L - 6, y: Y(Math.pow(10, e)) + 3.5, 'text-anchor': 'end', 'font-size': 10, fill: 'var(--lk-ink-soft)' }, YL[e]));
  }
  svg.appendChild(el('text', { x: (L + R) / 2, y: B + 30, 'text-anchor': 'middle', 'font-size': 10.5, fill: 'var(--lk-ink)' }, 'arithmetic intensity (FLOP per DRAM byte)'));
  svg.appendChild(el('text', { x: 16, y: (T + B) / 2, 'text-anchor': 'middle', 'font-size': 10.5, fill: 'var(--lk-ink)', transform: 'rotate(-90 16 ' + (T + B) / 2 + ')' }, 'TFLOP/s'));
  var roofLines = {};
  Object.keys(ROOFS).forEach(function (k) {
    var r = ROOFS[k], ridge = r.peak / BW, x0 = Math.pow(10, XMIN);
    var pl = el('polyline', { points: X(x0) + ',' + Y(x0 * BW) + ' ' + X(ridge) + ',' + Y(r.peak) + ' ' + X(Math.pow(10, XMAX)) + ',' + Y(r.peak),
      fill: 'none', stroke: r.color, 'stroke-width': 1, opacity: 0.45 });
    svg.appendChild(pl); roofLines[k] = pl;
  });
  var x0p = Math.pow(10, XMIN);
  svg.appendChild(el('line', { x1: X(x0p), y1: Y(x0p * BW_PRACT), x2: X(100), y2: Y(100 * BW_PRACT), stroke: 'var(--lk-cobalt)', 'stroke-width': 1, 'stroke-dasharray': '3 3', opacity: 0.8 }));
  var ridgeLine = el('line', { y1: B, y2: T, stroke: 'var(--lk-cobalt)', 'stroke-dasharray': '2 3' });
  var ridgeTxt = el('text', { y: B - 6, 'font-size': 10, fill: 'var(--lk-cobalt)' });
  var drop = el('line', { stroke: 'var(--lk-vermilion)', 'stroke-width': 1, 'stroke-dasharray': '2 3' });
  var dot = el('circle', { r: 5, fill: 'var(--lk-vermilion)' });
  var dotTxt = el('text', { 'font-size': 10.5, fill: 'var(--lk-ink)' });
  [ridgeLine, ridgeTxt, drop, dot, dotTxt].forEach(function (n) { svg.appendChild(n); });
  host.querySelector('.rf-plot').appendChild(svg);

  function $(id) { return host.querySelector('#' + id); }
  function fmtT(tf) { return tf >= 10 ? tf.toFixed(1) : tf >= 0.1 ? tf.toFixed(2) : tf.toFixed(3); }
  function fmtAI(a) { return a >= 100 ? Math.round(a).toString() : a >= 1 ? a.toFixed(1) : a.toFixed(3); }

  function preset() { for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].id === kSel.value) return PRESETS[i]; }
  function onKernel() { var p = preset(); rSel.value = p.roof; update(); }

  function update() {
    var p = preset(), roof = ROOFS[rSel.value];
    $('rf-bl').hidden = !p.batch; $('rf-al').hidden = !p.custom;
    var ai = p.ai, b = Math.pow(2, +$('rf-b').value);
    if (p.batch) { ai = decodeAI(b); $('rf-bo').textContent = b; }
    if (p.custom) { ai = Math.pow(10, +$('rf-a').value); $('rf-ao').textContent = fmtAI(ai) + ' FLOP/B'; }
    var att = Math.min(roof.peak, ai * BW), prac = Math.min(roof.peak, ai * BW_PRACT), ridge = roof.peak / BW;

    Object.keys(roofLines).forEach(function (k) {
      var on = ROOFS[k] === roof;
      roofLines[k].setAttribute('stroke-width', on ? 2.4 : 1);
      roofLines[k].setAttribute('opacity', on ? 1 : 0.45);
    });
    ridgeLine.setAttribute('x1', X(ridge)); ridgeLine.setAttribute('x2', X(ridge));
    ridgeLine.setAttribute('y2', Y(roof.peak)); ridgeLine.setAttribute('stroke', roof.color);
    ridgeTxt.setAttribute('x', X(ridge) + 4); ridgeTxt.setAttribute('fill', roof.color);
    ridgeTxt.textContent = 'ridge ' + Math.round(ridge);
    dot.setAttribute('cx', X(ai)); dot.setAttribute('cy', Y(att));
    drop.setAttribute('x1', X(ai)); drop.setAttribute('x2', X(ai)); drop.setAttribute('y1', Y(att)); drop.setAttribute('y2', B);
    var right = X(ai) > 470;
    dotTxt.setAttribute('x', X(ai) + (right ? -9 : 9)); dotTxt.setAttribute('y', Y(att) - 9);
    dotTxt.setAttribute('text-anchor', right ? 'end' : 'start');
    dotTxt.textContent = fmtT(att) + ' TFLOP/s';

    // On narrow screens the chart scrolls sideways: keep the point in view.
    var plot = host.querySelector('.rf-plot');
    if (plot.scrollWidth > plot.clientWidth) plot.scrollLeft = Math.max(0, X(ai) - plot.clientWidth / 2);

    $('rf-ai').textContent = fmtAI(ai) + ' FLOP/B';
    $('rf-att').textContent = fmtT(att) + ' TFLOP/s';
    $('rf-prac').textContent = fmtT(prac) + ' TFLOP/s';
    $('rf-ridge').textContent = Math.round(ridge) + ' FLOP/B';
    $('rf-how').textContent = p.how;
    var v = $('rf-v');
    if (ai < ridge) {
      v.className = 'w-verdict mem';
      v.textContent = 'Memory-bound: ' + (ridge / ai).toFixed(ridge / ai < 10 ? 1 : 0) + '× below the ridge. At best ' +
        (100 * att / roof.peak).toFixed(att / roof.peak < 0.01 ? 2 : 1) + '% of the ' + roof.label + ' peak. To move right, use each byte more (reuse, fusion, batching) or store smaller types.';
    } else {
      v.className = 'w-verdict comp';
      v.textContent = 'Compute-bound: ' + (ai / ridge).toFixed(ai / ridge < 10 ? 1 : 0) + '× past the ridge. Faster math (tensor cores, lower precision) raises the roof; saving bytes no longer helps.';
    }
  }
  kSel.addEventListener('change', onKernel);
  rSel.addEventListener('change', update);
  ['rf-b', 'rf-a'].forEach(function (id) { $(id).addEventListener('input', update); });
  onKernel();
})();
