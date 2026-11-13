/* explorer2.js: design-preview copy of mlsys/assets/roofline-explorer.js.
   Same data and formulas; new controls (key buttons, a roof tray), chart drawn like figure 1, readouts without boxes.
   Log-log: x = arithmetic intensity (FLOP per DRAM byte), y = TFLOP/s. Attainable = min(peak, intensity x bandwidth). */
(function () {
  'use strict';
  var host = document.getElementById('w-roofline');
  if (!host) return;

  var BW = 0.672, BW_PRACT = 0.672 * 0.88;
  var ROOFS = {
    fp32: { label: 'FP32 CUDA cores', key: 'FP32 CUDA', peak: 30.9, color: 'var(--lk-cobalt)' },
    fp16: { label: 'FP16 tensor, FP32 acc', key: 'FP16 tensor', peak: 61.7, color: 'var(--lk-forest)' },
    fp8:  { label: 'FP8 tensor, FP32 acc', key: 'FP8 tensor', peak: 123.5, color: 'var(--lk-ink-soft)' },
    fp4:  { label: 'FP4 tensor', key: 'FP4 tensor', peak: 493.9, color: 'var(--lk-rule)' }
  };
  function decodeAI(b) { var K = 4096, N = 4096; return (2 * K * N * b) / (2 * K * N + 2 * b * (K + N)); }
  var GROUPS = [
    ['Elementwise', [
      { id: 'vecadd', key: 'vecadd', label: 'vecadd (FP32)', ai: 1 / 12, roof: 'fp32', how: '1 add per element; read 8 B, write 4 B: 1 / 12 FLOP/B.' },
      { id: 'saxpy', key: 'SAXPY', label: 'SAXPY y = a·x + y (FP32)', ai: 2 / 12, roof: 'fp32', how: '1 FMA = 2 FLOPs per element; read x and y, write y: 12 B.' },
      { id: 'softmax', key: 'softmax', label: 'softmax, fused, one row per block (FP32)', ai: 5 / 8, roof: 'fp32', how: '≈5 FLOPs per element (max, subtract, exp, sum, scale); read 4 B, write 4 B once.' },
      { id: 'layernorm', key: 'layernorm', label: 'layernorm, fused (FP32)', ai: 1, roof: 'fp32', how: '≈8 FLOPs per element (mean, variance, normalize, scale, shift); 8 B per element.' }]],
    ['Matmul', [
      { id: 'naive', key: 'naive', label: 'naive matmul, no reuse (FP32)', ai: 0.25, roof: 'fp32', how: 'Every FMA fetches both operands from DRAM: 2 FLOPs per 8 B. Caches rescue some of it in practice.' },
      { id: 'tile32', key: 'tiled 32×32', label: 'tiled matmul, 32×32 shared tiles (FP32)', ai: 8, roof: 'fp32', how: 'Each element loaded into shared memory is used 32 times: 32 × 2 FLOPs per 2 × 4 B.' },
      { id: 'regtile', key: 'register-tiled', label: 'register-tiled matmul, 128×128 block tile (FP32)', ai: 32, roof: 'fp32', how: 'A 128×128 output tile per block: 2·128·128 FLOPs per (128 + 128)·4 B loaded per k-step.' },
      { id: 'gemm', key: 'GEMM 4096³', label: 'GEMM 4096×4096×4096 (FP16, tensor cores)', ai: 4096 / 3, roof: 'fp16', how: '2·4096³ FLOPs over 3 matrices of 4096² × 2 B, each read or written once: N / 3.' }]],
    ['Inference', [
      { id: 'decode', key: 'decode layer', label: 'decode linear layer 4096×4096 (FP16 weights)', ai: 1, roof: 'fp16', batch: true, how: 'Weights read once per step and used by every sequence in the batch: intensity ≈ batch size.' },
      { id: 'attdec', key: 'attention, decode', label: 'attention, decode step (FP16 KV cache)', ai: 1, roof: 'fp16', how: 'Each sequence reads its own KV cache: ~1 FLOP per byte, and batching does not share it.' },
      { id: 'attpre', key: 'attention, prefill', label: 'attention, prefill, FlashAttention-2 (L = 4096, d = 128, FP16)', ai: 124, roof: 'fp16', how: '4·L²·d FLOPs; K and V re-read once per 128-row query tile: ≈ 1 / (1/128 + 1/L) FLOP/B.' },
      { id: 'custom', key: 'your own', label: 'custom intensity (slider)', ai: 10, roof: 'fp32', custom: true, how: 'Drag the slider: where does the kernel sit, and which limit binds?' }]]
  ];
  var PRESETS = []; GROUPS.forEach(function (g) { PRESETS = PRESETS.concat(g[1]); });

  var W = 900, H = 400, L = 56, R = W - 150, T = 34, B = H - 46, XMIN = -2, XMAX = 4, YMIN = -3, YMAX = 3;
  function X(ai) { return L + (Math.log10(ai) - XMIN) / (XMAX - XMIN) * (R - L); }
  function Y(tf) { return B - (Math.log10(tf) - YMIN) / (YMAX - YMIN) * (B - T); }
  var NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, text) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; }

  var kernelRows = GROUPS.map(function (g) {
    return '<div class="x-row"><span class="x-lab">' + g[0] + '</span><div class="x-keys">' +
      g[1].map(function (p) { return '<button class="btn x-k" data-k="' + p.id + '" title="' + p.label + '" aria-pressed="false">' + p.key + '</button>'; }).join('') +
      '</div></div>';
  }).join('');
  host.className = 'x wide';
  host.innerHTML =
    '<div class="x-head"><h4>Roofline explorer</h4><p>Pick a kernel. Its point sits at its arithmetic intensity; the roof above it is the best it can possibly do on your card.</p></div>' +
    kernelRows +
    '<div class="x-row"><span class="x-lab">Compute roof</span><div class="tray" role="group" aria-label="Compute roof">' +
      Object.keys(ROOFS).map(function (k) { return '<button data-r="' + k + '" aria-pressed="false">' + ROOFS[k].key + ' <span>' + ROOFS[k].peak + '</span></button>'; }).join('') +
    '</div></div>' +
    '<div class="x-row" id="x-bl" hidden><span class="x-lab">Batch size</span><input id="x-b" type="range" min="0" max="9" step="1" value="0" aria-label="batch size"><output id="x-bo"></output></div>' +
    '<div class="x-row" id="x-al" hidden><span class="x-lab">Intensity</span><input id="x-a" type="range" min="-2" max="4" step="0.05" value="1" aria-label="intensity"><output id="x-ao"></output></div>' +
    '<div class="figure-diagram x-plot" tabindex="0" role="region" aria-label="Roofline chart"></div>' +
    '<dl class="x-out">' +
      '<div><dt>Intensity</dt><dd id="x-ai"></dd></div>' +
      '<div><dt>Attainable, spec</dt><dd id="x-att"></dd></div>' +
      '<div><dt>Attainable, about 88% of DRAM</dt><dd id="x-prac"></dd></div>' +
      '<div><dt>Ridge of this roof</dt><dd id="x-ridge"></dd></div>' +
    '</dl>' +
    '<p class="x-how" id="x-how"></p>' +
    '<p class="x-verdict" id="x-v" role="status" aria-live="polite"></p>';

  var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Roofline chart of the RTX 5070 with the selected kernel' });
  var XL = { '-2': '0.01', '-1': '0.1', '0': '1', '1': '10', '2': '100', '3': '1k', '4': '10k' };
  var YL = { '-3': '0.001', '-2': '0.01', '-1': '0.1', '0': '1', '1': '10', '2': '100', '3': '1000' };
  for (var e = YMIN; e <= YMAX; e++) {
    svg.appendChild(el('line', { x1: L, y1: Y(Math.pow(10, e)), x2: R, y2: Y(Math.pow(10, e)), stroke: 'var(--lk-rule-soft)', 'stroke-width': e === YMIN ? 1 : 0.7 }));
    svg.appendChild(el('text', { x: L - 8, y: Y(Math.pow(10, e)) + 4.5, 'text-anchor': 'end', 'font-size': 13, fill: 'var(--lk-ink-soft)' }, YL[e]));
  }
  for (e = XMIN; e <= XMAX; e++) {
    svg.appendChild(el('line', { x1: X(Math.pow(10, e)), y1: B, x2: X(Math.pow(10, e)), y2: B + 4, stroke: 'var(--lk-ink-soft)', 'stroke-width': 0.8 }));
    svg.appendChild(el('text', { x: X(Math.pow(10, e)), y: B + 21, 'text-anchor': 'middle', 'font-size': 13, fill: 'var(--lk-ink-soft)' }, XL[e]));
  }
  svg.appendChild(el('text', { x: (L + R) / 2, y: H - 4, 'text-anchor': 'middle', 'font-size': 13, fill: 'var(--lk-ink)' }, 'arithmetic intensity (FLOP per DRAM byte) →'));
  svg.appendChild(el('text', { x: 2, y: T - 14, 'font-size': 13, fill: 'var(--lk-ink)' }, 'TFLOP/s'));
  svg.appendChild(el('text', { x: R + 10, y: T - 14, 'font-size': 12, fill: 'var(--lk-ink-soft)' }, 'peak, TFLOP/s'));
  var roofLines = {}, roofTxt = {};
  var x0 = Math.pow(10, XMIN);
  svg.appendChild(el('line', { x1: X(x0), y1: Y(x0 * BW_PRACT), x2: X(100), y2: Y(100 * BW_PRACT), stroke: 'var(--lk-cobalt)', 'stroke-width': 1, 'stroke-dasharray': '3 3', opacity: 0.7 }));
  Object.keys(ROOFS).forEach(function (k) {
    var r = ROOFS[k], ridge = r.peak / BW;
    var pl = el('polyline', { points: X(x0) + ',' + Y(x0 * BW) + ' ' + X(ridge) + ',' + Y(r.peak) + ' ' + R + ',' + Y(r.peak), fill: 'none', stroke: r.color, 'stroke-linejoin': 'round' });
    svg.appendChild(pl); roofLines[k] = pl;
    var dy = 4.5;
    var t = el('text', { x: R + 10, y: Y(r.peak) + dy, 'font-size': 13, fill: r.color });
    t.appendChild(el('tspan', { 'font-weight': 600 }, String(r.peak))); t.appendChild(document.createTextNode('  ' + r.key));
    svg.appendChild(t); roofTxt[k] = t;
  });
  var ridgeLine = el('line', { y1: B, stroke: 'var(--lk-cobalt)', 'stroke-dasharray': '1.5 3' });
  var ridgeTxt = el('text', { y: B - 8, 'font-size': 13 });
  var drop = el('line', { stroke: 'var(--lk-vermilion)', 'stroke-width': 1, 'stroke-dasharray': '1.5 3' });
  var dot = el('circle', { r: 6, fill: 'var(--lk-vermilion)', stroke: 'var(--lk-paper)', 'stroke-width': 2 });
  var dotTxt = el('text', { 'font-size': 14, 'font-weight': 600, fill: 'var(--lk-ink)' });
  [ridgeLine, ridgeTxt, drop, dot, dotTxt].forEach(function (n) { svg.appendChild(n); });
  host.querySelector('.x-plot').appendChild(svg);

  function $(id) { return host.querySelector('#' + id); }
  function fmtT(tf) { return tf >= 10 ? tf.toFixed(1) : tf >= 0.1 ? tf.toFixed(2) : tf.toFixed(3); }
  function fmtAI(a) { return a >= 100 ? Math.round(a).toString() : a >= 1 ? a.toFixed(1) : a.toFixed(3); }
  var cur = 'vecadd', roofKey = 'fp32';
  function preset() { for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].id === cur) return PRESETS[i]; }

  function update() {
    var p = preset(), roof = ROOFS[roofKey];
    [].forEach.call(host.querySelectorAll('.x-k'), function (b) { b.setAttribute('aria-pressed', b.dataset.k === cur); });
    [].forEach.call(host.querySelectorAll('.tray button'), function (b) { b.setAttribute('aria-pressed', b.dataset.r === roofKey); });
    $('x-bl').hidden = !p.batch; $('x-al').hidden = !p.custom;
    var ai = p.ai, b = Math.pow(2, +$('x-b').value);
    if (p.batch) { ai = decodeAI(b); $('x-bo').textContent = b; }
    if (p.custom) { ai = Math.pow(10, +$('x-a').value); $('x-ao').textContent = fmtAI(ai) + ' FLOP/B'; }
    var att = Math.min(roof.peak, ai * BW), prac = Math.min(roof.peak, ai * BW_PRACT), ridge = roof.peak / BW;
    Object.keys(roofLines).forEach(function (k) {
      var on = k === roofKey;
      roofLines[k].setAttribute('stroke-width', on ? 2.6 : 1.1);
      roofLines[k].setAttribute('opacity', on ? 1 : 0.4);
      roofTxt[k].setAttribute('opacity', on ? 1 : 0.55);
    });
    ridgeLine.setAttribute('x1', X(ridge)); ridgeLine.setAttribute('x2', X(ridge)); ridgeLine.setAttribute('y2', Y(roof.peak)); ridgeLine.setAttribute('stroke', roof.color);
    ridgeTxt.setAttribute('x', X(ridge) + 6); ridgeTxt.setAttribute('fill', roof.color); ridgeTxt.textContent = 'ridge ' + Math.round(ridge);
    dot.setAttribute('cx', X(ai)); dot.setAttribute('cy', Y(att));
    drop.setAttribute('x1', X(ai)); drop.setAttribute('x2', X(ai)); drop.setAttribute('y1', Y(att)); drop.setAttribute('y2', B);
    // on the slope: below and to the right (the line climbs away from the label); on the flat roof: under it
    var right = X(ai) > R - 200;
    dotTxt.setAttribute('x', X(ai) + (right ? -12 : 14)); dotTxt.setAttribute('y', Y(att) + (right ? 24 : 20));
    dotTxt.setAttribute('text-anchor', right ? 'end' : 'start'); dotTxt.textContent = fmtT(att) + ' TFLOP/s';
    var plot = host.querySelector('.x-plot');
    if (plot.scrollWidth > plot.clientWidth) plot.scrollLeft = Math.max(0, X(ai) / W * plot.scrollWidth - plot.clientWidth / 2);
    $('x-ai').textContent = fmtAI(ai) + ' FLOP/B';
    $('x-att').textContent = fmtT(att) + ' TFLOP/s';
    $('x-prac').textContent = fmtT(prac) + ' TFLOP/s';
    $('x-ridge').textContent = Math.round(ridge) + ' FLOP/B';
    $('x-how').textContent = p.label + '. ' + p.how;
    var v = $('x-v');
    if (ai < ridge) {
      v.className = 'x-verdict mem';
      v.innerHTML = '<b>Memory-bound.</b> ' + (ridge / ai).toFixed(ridge / ai < 10 ? 1 : 0) + '× below the ridge. At best ' +
        (100 * att / roof.peak).toFixed(att / roof.peak < 0.01 ? 2 : 1) + '% of the ' + roof.label + ' peak. To move right, use each byte more (reuse, fusion, batching) or store smaller types.';
    } else {
      v.className = 'x-verdict comp';
      v.innerHTML = '<b>Compute-bound.</b> ' + (ai / ridge).toFixed(ai / ridge < 10 ? 1 : 0) + '× past the ridge. Faster math (tensor cores, lower precision) raises the roof; saving bytes no longer helps.';
    }
  }
  host.addEventListener('click', function (e) {
    var k = e.target.closest('.x-k'), r = e.target.closest('.tray button');
    if (k) { cur = k.dataset.k; roofKey = preset().roof; update(); }
    if (r) { roofKey = r.dataset.r; update(); }
  });
  ['x-b', 'x-a'].forEach(function (id) { $(id).addEventListener('input', update); });
  update();
})();
