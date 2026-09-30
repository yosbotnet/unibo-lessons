/* decode-ceiling.js — back-of-envelope decode speed for a dense LLM.
   Model: every decode step reads all weights once (bytes = params * bytesPerParam)
   and does 2 FLOPs per parameter per sequence in the batch.
   Ignores KV-cache reads, activations and launch overhead (see chapter text). */
(function () {
  'use strict';
  var host = document.getElementById('w-decode');
  if (!host) return;

  var GPUS = {
    rtx5070: { name: 'RTX 5070', bw: 672e9, vram: 12e9,
      peak: { fp32: 30.9e12, fp16: 61.7e12, fp8: 123.5e12, fp4: 493.9e12 } },
    h100: { name: 'H100 SXM', bw: 3.35e12, vram: 80e9,
      peak: { fp32: 67e12, fp16: 989e12, fp8: 1979e12, fp4: 1979e12 } }
  };
  // bytes per weight, and which tensor-core rate does the math
  var FORMATS = {
    fp32: { label: 'FP32 (4 B)', bytes: 4, math: 'fp32' },
    fp16: { label: 'FP16 / BF16 (2 B)', bytes: 2, math: 'fp16' },
    fp8: { label: 'FP8 (1 B)', bytes: 1, math: 'fp8' },
    int4: { label: 'INT4 weights, FP16 math (0.5 B)', bytes: 0.5, math: 'fp16' },
    fp4: { label: 'FP4 (0.5 B)', bytes: 0.5, math: 'fp4' }
  };
  var SIZES = [0.124, 0.5, 1, 3, 7, 8, 14, 32, 70];

  host.innerHTML =
    '<h4>Decode ceiling calculator</h4>' +
    '<p class="w-sub">One decode step = read every weight once, do 2 FLOPs per weight per sequence. Which limit do you hit first?</p>' +
    '<div class="w-controls">' +
      '<label>GPU<select id="dc-gpu"><option value="rtx5070">RTX 5070 · 672 GB/s</option><option value="h100">H100 SXM · 3.35 TB/s</option></select></label>' +
      '<label>Parameters: <output id="dc-p-out"></output><input id="dc-p" type="range" min="0" max="' + (SIZES.length - 1) + '" step="1" value="3"></label>' +
      '<label>Weight format<select id="dc-f"></select></label>' +
      '<label>Batch size: <output id="dc-b-out"></output><input id="dc-b" type="range" min="0" max="9" step="1" value="0"></label>' +
    '</div>' +
    '<div class="w-out">' +
      '<div class="w-stat"><span class="k">weights</span><span class="v" id="dc-w"></span></div>' +
      '<div class="w-stat"><span class="k">memory time / step</span><span class="v" id="dc-tm"></span></div>' +
      '<div class="w-stat"><span class="k">compute time / step</span><span class="v" id="dc-tc"></span></div>' +
      '<div class="w-stat"><span class="k">tokens/s per sequence</span><span class="v" id="dc-tps"></span></div>' +
      '<div class="w-stat"><span class="k">tokens/s total</span><span class="v" id="dc-agg"></span></div>' +
      '<div class="w-stat"><span class="k">batch where compute catches up</span><span class="v" id="dc-bs"></span></div>' +
    '</div>' +
    '<div class="w-bars" aria-hidden="true">' +
      '<div class="w-bar"><span>memory</span><div class="track"><div class="fill" id="dc-bm"></div></div><span class="num" id="dc-bmn"></span></div>' +
      '<div class="w-bar"><span>compute</span><div class="track"><div class="fill alt" id="dc-bc"></div></div><span class="num" id="dc-bcn"></span></div>' +
    '</div>' +
    '<div class="w-verdict" id="dc-v" role="status" aria-live="polite"></div>';

  var fSel = host.querySelector('#dc-f');
  Object.keys(FORMATS).forEach(function (k) {
    var o = document.createElement('option'); o.value = k; o.textContent = FORMATS[k].label;
    if (k === 'fp16') o.selected = true; fSel.appendChild(o);
  });

  function $(id) { return host.querySelector('#' + id); }
  function fmtTime(s) {
    if (s < 1e-3) return (s * 1e6).toFixed(s < 1e-5 ? 1 : 0) + ' µs';
    return (s * 1e3).toFixed(s < 1e-2 ? 2 : 1) + ' ms';
  }
  function fmtRate(x) {
    if (x >= 1e4) return (x / 1e3).toFixed(1) + 'k';
    if (x >= 100) return Math.round(x).toString();
    return x.toFixed(1);
  }
  function fmtParams(p) { return p < 1 ? Math.round(p * 1000) + 'M' : p + 'B'; }

  function update() {
    var g = GPUS[$('dc-gpu').value];
    var P = SIZES[+$('dc-p').value] * 1e9;
    var f = FORMATS[fSel.value];
    var B = Math.pow(2, +$('dc-b').value);
    var peak = g.peak[f.math];
    var bytes = P * f.bytes;
    var flops = 2 * P * B;
    var tm = bytes / g.bw, tc = flops / peak;
    var t = Math.max(tm, tc);
    var bStar = peak * f.bytes / (2 * g.bw);

    $('dc-p-out').textContent = fmtParams(SIZES[+$('dc-p').value]);
    $('dc-b-out').textContent = B;
    $('dc-w').textContent = (bytes / 1e9).toFixed(bytes < 1e9 ? 2 : 1) + ' GB';
    $('dc-tm').textContent = fmtTime(tm);
    $('dc-tc').textContent = fmtTime(tc);
    $('dc-tps').textContent = fmtRate(1 / t);
    $('dc-agg').textContent = fmtRate(B / t);
    $('dc-bs').textContent = '≈ ' + Math.round(bStar);
    $('dc-bm').style.width = (100 * tm / t).toFixed(1) + '%';
    $('dc-bc').style.width = (100 * tc / t).toFixed(1) + '%';
    $('dc-bmn').textContent = fmtTime(tm);
    $('dc-bcn').textContent = fmtTime(tc);

    var v = $('dc-v');
    if (bytes > g.vram) {
      v.className = 'w-verdict bad';
      v.textContent = 'Does not fit: ' + (bytes / 1e9).toFixed(1) + ' GB of weights vs ' + g.vram / 1e9 + ' GB on the ' + g.name + ' (and the KV cache needs room too). Quantize, or use a bigger GPU.';
    } else if (tm >= tc) {
      v.className = 'w-verdict mem';
      v.textContent = 'Memory-bound: streaming the weights takes ' + (tm / tc).toFixed(tm / tc < 10 ? 1 : 0) + '× longer than the math. More FLOPs are free until the batch reaches ≈ ' + Math.round(bStar) + '.';
    } else {
      v.className = 'w-verdict comp';
      v.textContent = 'Compute-bound: the math takes ' + (tc / tm).toFixed(1) + '× longer than reading the weights. Bigger batches now raise latency per sequence.';
    }
  }
  ['dc-gpu', 'dc-p', 'dc-f', 'dc-b'].forEach(function (id) {
    var e = id === 'dc-f' ? fSel : $(id);
    e.addEventListener('input', update); e.addEventListener('change', update);
  });
  update();
})();
