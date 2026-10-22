/* ch13.js - chapter 13: inference arithmetic. One pure model (the same as lab 12's
   arith.py, to the digit) behind two widgets: w-bytes (two kinds of bytes) and
   w-calc (the inference calculator). --lk-* tokens only, styles in ch13.css. */
var C13 = (function () {
  'use strict';
  var MODELS = {
    'gpt2-small':   { name: 'GPT-2 small (124M)', L: 12, C: 768, H: 12, Hkv: 12, D: 64, ff: 3072, V: 50257, tied: true, bias: true, swiglu: false, pos: 1024, ctx: 1024 },
    'gpt2-medium':  { name: 'GPT-2 medium (355M)', L: 24, C: 1024, H: 16, Hkv: 16, D: 64, ff: 4096, V: 50257, tied: true, bias: true, swiglu: false, pos: 1024, ctx: 1024 },
    'gpt2-xl':      { name: 'GPT-2 XL (1.5B)', L: 48, C: 1600, H: 25, Hkv: 25, D: 64, ff: 6400, V: 50257, tied: true, bias: true, swiglu: false, pos: 1024, ctx: 1024 },
    'llama-3.2-1b': { name: 'Llama-3.2-1B', L: 16, C: 2048, H: 32, Hkv: 8, D: 64, ff: 8192, V: 128256, tied: true, bias: false, swiglu: true, pos: 0, ctx: 131072 },
    'llama-3-8b':   { name: 'Llama-3-8B', L: 32, C: 4096, H: 32, Hkv: 8, D: 128, ff: 14336, V: 128256, tied: false, bias: false, swiglu: true, pos: 0, ctx: 8192 }
  };
  var GPUS = {
    rtx5070: { name: 'RTX 5070', bw: 672e9, vram: 12e9, sms: 48, peak: { fp32: 30.9e12, fp16: 61.7e12, fp8: 123.5e12 } },
    h100: { name: 'H100 SXM', bw: 3.35e12, vram: 80e9, sms: 132, peak: { fp32: 67e12, fp16: 989e12, fp8: 1979e12 } }
  };
  var WFMT = { fp32: [4, 'fp32'], fp16: [2, 'fp16'], fp8: [1, 'fp8'], int4: [0.5, 'fp16'] };
  var KFMT = { fp32: 4, fp16: 2, fp8: 1 };
  var LAUNCH_S = 3e-6, GRAPH_S = 0.5e-6;

  // kernels per pass of chapter 11's engine (cuBLAS backend, each cuBLAS call once):
  // 12 per layer at decode, 14 at prefill (naive attention is 3 kernels), plus 4
  function launches(m, phase) { return (phase === 'decode' ? 12 : 14) * m.L + 4; }

  function params(m) {
    var L = m.L, C = m.C, H = m.H, Hkv = m.Hkv, D = m.D, ff = m.ff, V = m.V, b = m.bias ? 1 : 0;
    var q = C * H * D + b * H * D, k = C * Hkv * D + b * Hkv * D, v = k, o = H * D * C + b * C;
    var mlp = m.swiglu ? 3 * C * ff : C * ff + b * ff + ff * C + b * C;
    var normBlock = 2 * (m.bias ? 2 * C : C);
    var block = q + k + v + o + mlp + normBlock;
    var total = V * C + m.pos * C + L * block + (m.bias ? 2 * C : C) + (m.tied ? 0 : V * C);
    return { total: total, n_mm: L * (q + k + v + o + mlp) + V * C };
  }
  function kvBytes(m, s) { return 2 * m.L * m.Hkv * m.D * s; }
  function actBytes(m, B, sw) { return B * ((6 * m.C + m.ff) * sw + m.V * 4); }

  // cfg: {model, gpu, dtype, kv, eff, floor (s per kernel or 0), graph}
  function setup(cfg) {
    var m = MODELS[cfg.model], g = GPUS[cfg.gpu], wf = WFMT[cfg.dtype];
    var kvf = cfg.kv || (KFMT[cfg.dtype] ? cfg.dtype : 'fp16');
    var p = params(m);
    var S = { m: m, g: g, dtype: cfg.dtype, kvfmt: kvf, s_w: wf[0], s_k: KFMT[kvf], peak: g.peak[wf[1]], bw: g.bw,
      eff: cfg.eff || 1, total: p.total, n_mm: p.n_mm };
    S.W = S.total * S.s_w; S.kv = kvBytes(m, S.s_k); S.F_lin = 2 * S.n_mm;
    S.floor = cfg.graph ? GRAPH_S : (cfg.floor || 0);
    S.n_dec = launches(m, 'decode'); S.n_pre = launches(m, 'prefill');
    S.F_att = function (t) { return 4 * m.L * t * m.C; };
    function time(flops, bytes, n) {
      var tc = flops / (S.peak * S.eff), tm = bytes / (S.bw * S.eff), roof = Math.max(tc, tm);
      var tf = S.floor ? n * S.floor : 0, bound = tc >= tm ? 'compute' : 'memory';
      if (tf > roof) bound = 'launch';
      return { flops: flops, bytes: bytes, t_c: tc, t_m: tm, roof: roof, t_floor: tf, time: roof + tf, bound: bound, intensity: flops / bytes };
    }
    // prefill: the block linears at every position, the LM head once (only the last
    // position's logits are needed), the causal half of the attention
    S.prefill = function (B, Tp) {
      var head = 2 * m.V * m.C, fl = B * (Tp * (S.F_lin - head) + head), fa = B * 2 * m.L * Tp * Tp * m.C;
      var r = time(fl + fa, S.W + B * Tp * S.kv, S.n_pre);
      r.flops_lin = fl; r.flops_att = fa; r.bytes_w = S.W; r.bytes_kv = B * Tp * S.kv;
      return r;
    };
    S.decode = function (B, t) {
      var fl = B * S.F_lin, fa = B * S.F_att(t);
      var r = time(fl + fa, S.W + B * t * S.kv, S.n_dec);
      r.flops_lin = fl; r.flops_att = fa; r.bytes_w = S.W; r.bytes_kv = B * t * S.kv;
      return r;
    };
    S.memory = function (B, T) { return S.W + B * T * S.kv + actBytes(m, B, S.s_w); };
    S.maxBatch = function (T, act) {
      var free = g.vram - S.W;
      if (free <= 0) return 0;
      return Math.floor(free / (T * S.kv + (act === false ? 0 : actBytes(m, 1, S.s_w))));
    };
    S.cross = function (t) {
      var r = S.F_lin * S.bw / S.peak, den = r - t * S.kv;
      return { slots: S.W / S.kv, B_slots: S.W / S.kv / t, catchup_nocache: S.W / r, work_bytes: r,
        catchup_cache: den > 0 ? S.W / den : null, limit: (S.F_lin + S.F_att(t)) / (t * S.kv) };
    };
    return S;
  }

  // every readout of the calculator (mirrors arith.estimate)
  function estimate(cfg) {
    var S = setup(cfg), B = cfg.batch, Tp = cfg.prompt, To = cfg.out;
    var pre = S.prefill(1, Tp), preB = S.prefill(B, Tp), sum = 0, first = null, last = null, nb = {};
    for (var t = Tp + 1; t <= Tp + To; t++) {
      var d = S.decode(B, t); sum += d.time;
      nb[d.bound] = (nb[d.bound] || 0) + 1;
      if (!first) first = d; last = d;
    }
    var tpot = sum / To, tb = 'memory', best = -1;
    Object.keys(nb).forEach(function (k) { if (nb[k] > best) { best = nb[k]; tb = k; } });
    var Tend = Tp + To, mem = S.memory(B, Tend);
    return { S: S, weights_bytes: S.W, kv_per_token: S.kv, cache_end_bytes: B * Tend * S.kv, memory_bytes: mem,
      vram: S.g.vram, fits: mem <= S.g.vram, max_batch: S.maxBatch(Tend), max_batch_no_act: S.maxBatch(Tend, false),
      prefill: pre, prefill_batch: preB, ttft: pre.time, ttft_bound: pre.bound, decode_first: first, decode_last: last,
      tpot: tpot, tpot_bound: tb, tokens_per_s: B / tpot, tokens_per_s_seq: 1 / tpot,
      request_latency: pre.time + (To - 1) * tpot, prefill_intensity: pre.intensity,
      decode_intensity_end: last.intensity, ridge: S.peak / S.bw, crossovers: S.cross(Tend) };
  }

  // formatting: 3 significant figures, thousands separators (as arith.py's sig)
  function sig(x, n) {
    n = n || 3;
    if (x === 0) return '0';
    var d = n - 1 - Math.floor(Math.log10(Math.abs(x)));
    var v = Math.round(x * Math.pow(10, Math.max(d, 0))) / Math.pow(10, Math.max(d, 0));
    if (d < 0) v = Math.round(x / Math.pow(10, -d)) * Math.pow(10, -d);
    var s = v.toFixed(Math.max(d, 0)), parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }
  function tStr(s) { return s < 1e-3 ? sig(s * 1e6) + ' \u00b5s' : s < 1 ? sig(s * 1e3) + ' ms' : sig(s) + ' s'; }
  function bStr(b) { return b >= 1e9 ? sig(b / 1e9) + ' GB' : b >= 1e6 ? sig(b / 1e6) + ' MB' : b >= 1e3 ? sig(b / 1e3) + ' KB' : Math.round(b) + ' B'; }

  return { MODELS: MODELS, GPUS: GPUS, WFMT: WFMT, KFMT: KFMT, LAUNCH_S: LAUNCH_S, GRAPH_S: GRAPH_S,
    launches: launches, params: params, kvBytes: kvBytes, setup: setup, estimate: estimate, sig: sig, tStr: tStr, bStr: bStr };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = C13;

(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  var M = C13, sig = M.sig, tStr = M.tStr, bStr = M.bStr;
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function stat(parent, k) { var d = el('div', 'w-stat'); d.appendChild(el('span', 'k', k)); var v = el('span', 'v'); d.appendChild(v); var s = el('span', 'c13-s'); d.appendChild(s); parent.appendChild(d); return { v: v, s: s, box: d }; }
  function select(label, opts, val) {
    var l = el('label'); l.appendChild(document.createTextNode(label));
    var s = el('select');
    opts.forEach(function (o) { var e = el('option', null, o[1]); e.value = o[0]; s.appendChild(e); });
    s.value = val; l.appendChild(s); return { label: l, input: s };
  }
  function slider(label, values, idx, show) {
    var l = el('label'), head = el('span', null, label + ': '), out = el('output');
    head.appendChild(out); l.appendChild(head);
    var r = el('input'); r.type = 'range'; r.min = 0; r.max = values.length - 1; r.step = 1; r.value = idx;
    r.setAttribute('aria-label', label);
    l.appendChild(r);
    var o = { label: l, input: r, out: out, values: values, show: show || function (v) { return sig(v, 4); } };
    o.get = function () { return values[+r.value]; };
    o.set = function (v) { var i = values.indexOf(v); if (i < 0) { i = 0; while (i < values.length - 1 && values[i + 1] <= v) i++; } r.value = i; };
    o.sync = function () { var v = o.get(); out.textContent = o.show(v); r.setAttribute('aria-valuetext', o.show(v)); };
    return o;
  }
  var MODEL_OPTS = Object.keys(M.MODELS).map(function (k) { return [k, M.MODELS[k].name]; });
  var GPU_OPTS = [['rtx5070', 'RTX 5070, 12 GB'], ['h100', 'H100 SXM, 80 GB']];
  var W_OPTS = [['fp32', 'FP32 (4 B)'], ['fp16', 'FP16 / BF16 (2 B)'], ['fp8', 'FP8 (1 B)'], ['int4', 'INT4, FP16 math (0.5 B)']];
  var K_OPTS = [['fp32', 'FP32 (4 B)'], ['fp16', 'FP16 (2 B)'], ['fp8', 'FP8 (1 B)']];
  var POW2 = [1, 2, 4, 8, 16, 32, 64, 128, 256];
  var CTX = [128, 256, 512, 1024, 2048, 4096, 8192];
  function n0(x) { return sig(x, 4).replace(/\.\d+$/, ''); }
  function int(x) { return String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  /* ======================= w-bytes: two kinds of bytes ======================= */
  var hb = document.getElementById('w-bytes');
  if (hb) {
    hb.innerHTML = '';
    hb.appendChild(el('h4', null, 'Two kinds of bytes'));
    hb.appendChild(el('p', 'w-sub', 'One decode step at the roof (spec bandwidth, no overheads). The weights are read once for the whole batch; each sequence\u2019s cache is read once for itself. All three bars are times on one scale.'));
    var ctr = el('div', 'w-controls');
    var sM = select('Model', MODEL_OPTS, 'gpt2-small'), sW = select('Weights', W_OPTS, 'fp32'), sK = select('Cache', K_OPTS, 'fp32'), sG = select('GPU', GPU_OPTS, 'rtx5070');
    var rB = slider('Batch B', POW2, 0, int), rT = slider('Context t', CTX, 3, int);
    [sM, sW, sK, sG, rB, rT].forEach(function (c) { ctr.appendChild(c.label); });
    hb.appendChild(ctr);
    var bars = el('div', 'w-bars c13-bars'); bars.setAttribute('aria-hidden', 'true');
    function bar(name, cls) {
      var r = el('div', 'w-bar'); r.appendChild(el('span', null, name));
      var tr = el('div', 'track'), f = el('div', 'fill ' + cls); tr.appendChild(f); r.appendChild(tr);
      var n = el('span', 'num'); r.appendChild(n); bars.appendChild(r); return { fill: f, num: n, track: tr };
    }
    var bW = bar('weights, shared', 'c13-w'), bK = bar('caches, private', 'c13-k'), bC = bar('compute', 'alt');
    var mark = el('div', 'c13-mark'); bK.track.appendChild(mark);
    hb.appendChild(bars);
    var key = el('p', 'c13-key');
    key.innerHTML = '<span class="c13-sw c13-w"></span>weight bytes / bandwidth <span class="c13-sw c13-k"></span>cache bytes / bandwidth <span class="c13-sw alt"></span>FLOPs / peak <span class="c13-sw c13-g"></span>the caches reach the weights here';
    hb.appendChild(key);
    var out = el('div', 'w-out c13-out');
    var xW = stat(out, 'weight bytes'), xK = stat(out, 'cache bytes'), xM = stat(out, 'memory time'), xC = stat(out, 'compute time'),
      xS = stat(out, 'step'), xT = stat(out, 'tokens/s, all'), xP = stat(out, 'tokens/s, per sequence'), xX = stat(out, 'cache = weights at B \u00d7 t ='), xU = stat(out, 'memory used');
    hb.appendChild(out);
    var vb = el('div', 'w-verdict'); vb.setAttribute('aria-live', 'polite'); hb.appendChild(vb);

    var renderB = function () {
      var m = M.MODELS[sM.input.value];
      var ctxMax = Math.min(m.ctx, 8192);
      if (rT.get() > ctxMax) rT.set(ctxMax);
      rT.input.max = CTX.indexOf(ctxMax) >= 0 ? CTX.indexOf(ctxMax) : CTX.length - 1;
      rB.sync(); rT.sync();
      var S = M.setup({ model: sM.input.value, gpu: sG.input.value, dtype: sW.input.value, kv: sK.input.value });
      var B = rB.get(), t = rT.get(), d = S.decode(B, t);
      var tw = S.W / S.bw, tk = d.bytes_kv / S.bw, tc = d.t_c, sc = Math.max(tw, tk, tc) * 1.08;
      bW.fill.style.width = (100 * tw / sc) + '%'; bK.fill.style.width = (100 * tk / sc) + '%'; bC.fill.style.width = (100 * tc / sc) + '%';
      bW.num.textContent = tStr(tw); bK.num.textContent = tStr(tk); bC.num.textContent = tStr(tc);
      mark.style.left = (100 * tw / sc) + '%';
      var cx = S.cross(t), mem = S.memory(B, t), fits = mem <= S.g.vram;
      xW.v.textContent = bStr(S.W); xW.s.textContent = 'read once per step';
      xK.v.textContent = bStr(d.bytes_kv); xK.s.textContent = B + ' \u00d7 ' + int(t) + ' \u00d7 ' + sig(S.kv / 1e3) + ' KB';
      xM.v.textContent = tStr(d.t_m); xM.s.textContent = 'bytes / ' + (S.bw >= 1e12 ? sig(S.bw / 1e12) + ' TB/s' : int(S.bw / 1e9) + ' GB/s');
      xC.v.textContent = tStr(d.t_c); xC.s.textContent = sig(d.flops / 1e9) + ' GFLOP';
      xS.v.textContent = tStr(d.time); xS.s.textContent = d.bound + '-bound, ' + sig(d.intensity) + ' FLOP/B';
      xT.v.textContent = sig(B / d.time); xT.s.textContent = B + (B === 1 ? ' token' : ' tokens') + ' per step';
      xP.v.textContent = sig(1 / d.time); xP.s.textContent = 'one token per step';
      xX.v.textContent = sig(cx.slots) + ' slots'; xX.s.textContent = 'B \u2248 ' + sig(cx.B_slots, 2) + ' at t = ' + int(t);
      xU.v.textContent = bStr(mem); xU.s.textContent = fits ? 'fits in ' + S.g.vram / 1e9 + ' GB' : 'over ' + S.g.vram / 1e9 + ' GB';
      xU.box.classList.toggle('c13-bad', !fits);
      if (!fits) { vb.className = 'w-verdict bad'; vb.textContent = S.W >= S.g.vram ? 'Does not fit: the weights alone are ' + bStr(S.W) + ' on a ' + S.g.vram / 1e9 + ' GB card. Quantize them, or take the bigger GPU.' : 'Does not fit in VRAM: the cache is the budget. At t = ' + int(t) + ' at most ' + S.maxBatch(t) + ' sequences fit beside the weights.'; }
      else if (d.bytes_kv < S.W) { vb.className = 'w-verdict comp'; vb.textContent = 'The batch dial is working: the weights are shared, each sequence adds only its cache. Doubling B here costs ' + sig(100 * (S.decode(2 * B, t).time / d.time - 1), 2) + '% more time for twice the tokens.'; }
      else { vb.className = 'w-verdict mem'; vb.textContent = 'Past the crossover: every doubling of the batch nearly doubles the step (+' + sig(100 * (S.decode(2 * B, t).time / d.time - 1), 2) + '% here); throughput can never pass bandwidth / cache per sequence = ' + sig(S.bw / (t * S.kv)) + ' tokens/s at this t.'; }
    };
    [sM, sW, sK, sG].forEach(function (c) { c.input.addEventListener('change', renderB); });
    [rB, rT].forEach(function (c) { c.input.addEventListener('input', renderB); });
    if (REDUCED) hb.classList.add('c13-still');
    renderB();
  }

  /* ======================= w-calc: the inference calculator ======================= */
  var hc = document.getElementById('w-calc');
  if (hc) {
    var PROMPTS = [128, 256, 512, 768, 896, 1024, 2048, 4096, 8192], OUTS = [1, 16, 64, 128, 256, 512, 1024];
    var EFFS = []; for (var e = 50; e <= 100; e += 1) EFFS.push(e);
    hc.innerHTML = '';
    hc.appendChild(el('h4', null, 'The inference calculator'));
    hc.appendChild(el('p', 'w-sub', 'Every step costs max(FLOPs / peak, bytes / bandwidth), plus the launch floor if you switch it on. TTFT is one prompt prefilled on its own; TPOT is the mean decode step over the output; the step bar is the last one.'));
    var pre = el('div', 'c13-btns');
    var P1 = el('button', null, 'Interview: Llama-3-8B, H100, FP16, B = 64, 2,048 + 256'); P1.type = 'button';
    var P2 = el('button', null, 'Your engine: GPT-2 small, RTX 5070, FP32, B = 1, 896 + 128'); P2.type = 'button';
    pre.appendChild(P1); pre.appendChild(P2); hc.appendChild(pre);
    var c1 = el('div', 'w-controls c13-ctr');
    var cM = select('Model', MODEL_OPTS, 'llama-3-8b'), cG = select('GPU', GPU_OPTS, 'h100'), cW = select('Weights', W_OPTS, 'fp16'), cK = select('Cache', K_OPTS, 'fp16');
    var cB = slider('Batch B', POW2, 6, int), cP = slider('Prompt Tp', PROMPTS, 6, int), cO = slider('Output Tout', OUTS, 4, int);
    var cE = slider('Efficiency', EFFS, 50, function (v) { return v === 100 ? '100% (roof)' : v + '%'; });
    [cM, cG, cW, cK, cB, cP, cO, cE].forEach(function (c) { c1.appendChild(c.label); });
    var fl = el('label', 'c13-check'), fIn = el('input'); fIn.type = 'checkbox';
    fl.appendChild(fIn); fl.appendChild(el('span', null, 'Launch floor (unfused engine: 12 kernels per layer per decode step, 14 per prefill, 3 \u00b5s each)'));
    var gl = el('label', 'c13-check'), gIn = el('input'); gIn.type = 'checkbox'; gIn.disabled = true;
    gl.appendChild(gIn); gl.appendChild(el('span', null, 'CUDA graph (0.5 \u00b5s per kernel)'));
    c1.appendChild(fl); c1.appendChild(gl);
    hc.appendChild(c1);
    var o2 = el('div', 'w-out c13-out');
    var yW = stat(o2, 'weights'), yK = stat(o2, 'cache per token'), yKe = stat(o2, 'cache at the end'), yMem = stat(o2, 'memory total'),
      yTT = stat(o2, 'TTFT'), yTP = stat(o2, 'TPOT (mean)'), yTS = stat(o2, 'tokens/s, all'), yTQ = stat(o2, 'tokens/s, per sequence'),
      yRL = stat(o2, 'request latency'), yI = stat(o2, 'intensity, FLOP/B'), yX = stat(o2, 'cache = weights at B \u00d7 t ='), yCU = stat(o2, 'compute catches up at B =');
    hc.appendChild(o2);
    var sb = el('div', 'c13-stack'); sb.setAttribute('aria-hidden', 'true');
    function stackBar(title) {
      var w = el('div', 'c13-sbar'); var h = el('div', 'c13-stitle'); var ht = el('span', null, title); var hn = el('span', 'num'); h.appendChild(ht); h.appendChild(hn); w.appendChild(h);
      function row(name) {
        var r = el('div', 'c13-srow'); r.appendChild(el('span', 'c13-sname', name));
        var tr = el('div', 'track'); var segs = [];
        r.appendChild(tr); var n = el('span', 'num'); r.appendChild(n); w.appendChild(r);
        return { row: r, track: tr, num: n, segs: segs };
      }
      var mr = row('memory'), cr = row('compute');
      ['c13-w', 'c13-k', 'c13-f'].forEach(function (c) { var s = el('div', 'seg ' + c); mr.track.appendChild(s); mr.segs.push(s); });
      ['alt', 'c13-a', 'c13-f'].forEach(function (c) { var s = el('div', 'seg ' + c); cr.track.appendChild(s); cr.segs.push(s); });
      sb.appendChild(w);
      return { head: hn, mem: mr, comp: cr };
    }
    var barP = stackBar('prefill (one prompt)'), barD = stackBar('one decode step (end of output)');
    hc.appendChild(sb);
    var key2 = el('p', 'c13-key');
    key2.innerHTML = '<span class="c13-sw alt"></span>linear FLOPs <span class="c13-sw c13-a"></span>attention FLOPs <span class="c13-sw c13-w"></span>weight bytes <span class="c13-sw c13-k"></span>cache bytes <span class="c13-sw c13-f"></span>launch floor. The two rows overlap in time: the longer one is the step, the dimmed one is hidden under it.';
    hc.appendChild(key2);
    var vc = el('div', 'w-verdict'); vc.setAttribute('aria-live', 'polite'); hc.appendChild(vc);

    var applyPreset = function (p) {
      cM.input.value = p.model; cG.input.value = p.gpu; cW.input.value = p.dtype; cK.input.value = p.kv;
      cB.set(p.batch); cP.set(p.prompt); cO.set(p.out); cE.set(100); fIn.checked = false; gIn.checked = false;
      renderC();
    };
    P1.addEventListener('click', function () { applyPreset({ model: 'llama-3-8b', gpu: 'h100', dtype: 'fp16', kv: 'fp16', batch: 64, prompt: 2048, out: 256 }); });
    P2.addEventListener('click', function () { applyPreset({ model: 'gpt2-small', gpu: 'rtx5070', dtype: 'fp32', kv: 'fp32', batch: 1, prompt: 896, out: 128 }); });

    var fillStack = function (b, r, ext) {
      var memT = r.bytes_w / ext.bw + r.bytes_kv / ext.bw, compT = r.flops_lin / ext.peak + r.flops_att / ext.peak;
      var memLit = memT >= compT, tot = r.time, sc = tot * 1.04;
      var mw = [r.bytes_w / ext.bw, r.bytes_kv / ext.bw, memLit ? r.t_floor : 0];
      var cw = [r.flops_lin / ext.peak, r.flops_att / ext.peak, memLit ? 0 : r.t_floor];
      mw.forEach(function (v, i) { b.mem.segs[i].style.width = (100 * v / sc) + '%'; });
      cw.forEach(function (v, i) { b.comp.segs[i].style.width = (100 * v / sc) + '%'; });
      b.mem.row.classList.toggle('dim', !memLit); b.comp.row.classList.toggle('dim', memLit);
      b.mem.num.textContent = memLit ? tStr(memT + r.t_floor) : tStr(memT) + ', hidden';
      b.comp.num.textContent = memLit ? tStr(compT) + ', hidden' : tStr(compT + r.t_floor);
      b.head.textContent = tStr(tot) + ' \u00b7 ' + r.bound + (r.t_floor ? ' \u00b7 floor ' + tStr(r.t_floor) : '');
    };

    var renderC = function () {
      var key = cM.input.value, m = M.MODELS[key];
      var pmax = 0; PROMPTS.forEach(function (v, i) { if (v <= m.ctx) pmax = i; });
      cP.input.max = pmax; if (+cP.input.value > pmax) cP.input.value = pmax;
      gIn.disabled = !fIn.checked; if (!fIn.checked) gIn.checked = false;
      [cB, cP, cO, cE].forEach(function (c) { c.sync(); });
      var eff = cE.get() / 100;
      var cfg = { model: key, gpu: cG.input.value, dtype: cW.input.value, kv: cK.input.value, batch: cB.get(), prompt: cP.get(), out: cO.get(),
        eff: eff, floor: fIn.checked ? M.LAUNCH_S : 0, graph: fIn.checked && gIn.checked };
      var E = M.estimate(cfg), S = E.S, B = cfg.batch, Tend = cfg.prompt + cfg.out;
      var presetA = key === 'llama-3-8b' && cfg.gpu === 'h100' && cfg.dtype === 'fp16' && cfg.kv === 'fp16' && B === 64 && cfg.prompt === 2048 && cfg.out === 256;
      var presetB = key === 'gpt2-small' && cfg.gpu === 'rtx5070' && cfg.dtype === 'fp32' && cfg.kv === 'fp32' && B === 1 && cfg.prompt === 896 && cfg.out === 128;
      P1.setAttribute('aria-pressed', String(presetA)); P2.setAttribute('aria-pressed', String(presetB));
      yW.v.textContent = bStr(E.weights_bytes); yW.s.textContent = sig(S.total / 1e9) + ' G params \u00d7 ' + S.s_w + ' B';
      yK.v.textContent = sig(E.kv_per_token / 1e3) + ' KB'; yK.s.textContent = '2 \u00b7 ' + m.L + ' \u00b7 ' + m.Hkv + ' \u00b7 ' + m.D + ' \u00b7 ' + S.s_k + ' B';
      yKe.v.textContent = bStr(E.cache_end_bytes); yKe.s.textContent = B + ' \u00d7 ' + int(Tend) + ' tokens';
      yMem.v.textContent = bStr(E.memory_bytes);
      yMem.s.textContent = (E.fits ? 'fits' : 'does not fit') + ' \u00b7 max batch ' + E.max_batch;
      yMem.box.classList.toggle('c13-bad', !E.fits);
      yTT.v.textContent = tStr(E.ttft); yTT.s.textContent = E.ttft_bound + (B > 1 ? ' \u00b7 all ' + B + ' together ' + tStr(E.prefill_batch.time) : '');
      yTP.v.textContent = tStr(E.tpot); yTP.s.textContent = E.tpot_bound;
      yTS.v.textContent = sig(E.tokens_per_s); yTS.s.textContent = 'B / TPOT';
      yTQ.v.textContent = sig(E.tokens_per_s_seq); yTQ.s.textContent = '1 / TPOT';
      yRL.v.textContent = tStr(E.request_latency); yRL.s.textContent = 'TTFT + ' + (cfg.out - 1) + ' \u00d7 TPOT';
      yI.v.textContent = sig(E.prefill_intensity) + ' / ' + sig(E.decode_intensity_end); yI.s.textContent = 'prefill / decode \u00b7 ridge ' + Math.round(E.ridge);
      var cx = E.crossovers;
      yX.v.textContent = sig(cx.slots); yX.s.textContent = 'token-slots \u00b7 B \u2248 ' + sig(cx.B_slots, 2) + ' at t = ' + int(Tend);
      yCU.v.textContent = cx.catchup_cache === null ? 'never' : sig(cx.catchup_cache);
      yCU.s.textContent = cx.catchup_cache === null ? 'at this context (no cache: ' + sig(cx.catchup_nocache) + ')' : 'no cache: ' + sig(cx.catchup_nocache);
      var ext = { bw: S.bw * S.eff, peak: S.peak * S.eff };
      fillStack(barP, E.prefill, ext); fillStack(barD, E.decode_last, ext);
      var msg, cls;
      var roof1 = S.decode(1, cfg.prompt + 1);
      if (Tend > m.ctx) { cls = 'bad'; msg = int(cfg.prompt) + ' + ' + int(cfg.out) + ' tokens is past ' + m.name + '\u2019s context of ' + int(m.ctx) + ' positions; the numbers extrapolate. Shorten the prompt or the output.'; }
      else if (!E.fits) { cls = 'bad'; msg = E.max_batch < 1 ? 'Does not fit: the weights alone are ' + bStr(S.W) + ' on a ' + S.g.vram / 1e9 + ' GB card.' : 'Does not fit: the cache is the budget. At ' + int(Tend) + ' tokens, max batch ' + E.max_batch + '.'; }
      else if (fIn.checked && roof1.t_floor > roof1.roof) { cls = 'mem'; msg = 'Overhead-bound: the launch floor (' + tStr(roof1.t_floor) + ') is longer than the step\u2019s own work at B = 1 (' + tStr(roof1.roof) + '). Fusion and graphs before kernels.'; }
      else if (E.cache_end_bytes > S.W) { cls = 'mem'; msg = 'Past the crossover: the caches (' + bStr(E.cache_end_bytes) + ') outweigh the weights (' + bStr(S.W) + '), so batching now buys little: doubling B would add ' + sig(100 * (S.decode(2 * B, Tend).time / E.decode_last.time - 1), 2) + '% to the step.'; }
      else { cls = 'comp'; msg = 'Memory-bound decode, compute-bound prefill: the normal regime. Tokens/s scales almost linearly with B up to B \u00d7 t \u2248 ' + sig(cx.slots) + ' cached tokens.'; }
      vc.className = 'w-verdict ' + cls; vc.textContent = msg;
    };
    [cM, cG, cW, cK].forEach(function (c) { c.input.addEventListener('change', renderC); });
    [cB, cP, cO, cE].forEach(function (c) { c.input.addEventListener('input', renderC); });
    fIn.addEventListener('change', renderC); gIn.addEventListener('change', renderC);
    if (REDUCED) hc.classList.add('c13-still');
    renderC();
  }
})();
