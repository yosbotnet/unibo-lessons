/* ch15.js — chapter 15 widget: the decode-attention occupancy and bandwidth model. */
(function () {
  'use strict';
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function btn(txt) { var b = el('button', null, txt); b.type = 'button'; return b; }
  function stat(parent, k) { var d = el('div', 'w-stat'); d.appendChild(el('span', 'k', k)); var v = el('span', 'v'); d.appendChild(v); parent.appendChild(d); return v; }
  function fmtBytes(b) {
    if (b >= 1e9) return (b / 1e9).toFixed(2) + ' GB';
    if (b >= 1e6) return (b / 1e6).toFixed(b >= 1e8 ? 0 : 1) + ' MB';
    if (b >= 1e3) return (b / 1e3).toFixed(b >= 1e5 ? 0 : 1) + ' KB';
    return Math.round(b) + ' B';
  }
  function fmtKiB(b) { var k = b / 1024; return k >= 1024 ? (k / 1024).toFixed(k >= 10240 ? 0 : 1).replace(/\.0$/, '') + ' MB' : Math.round(k) + ' KB'; }
  function fmtUs(us) { return us >= 1000 ? (us / 1000).toFixed(2) + ' ms' : us.toFixed(us >= 100 ? 0 : 1) + ' \u00b5s'; }
  function fmtInt(n) { return Math.round(n).toLocaleString('en-US'); }

  var host = document.getElementById('w-decode');
  if (!host) return;

  /* ---- the model (chapter 15, sections 2-3; constants of the RTX 5070) ---- */
  var SMS = 48, RESIDENT = 8, SLOTS = SMS * RESIDENT;      // model: up to 8 blocks per SM resident
  var PER_BLOCK = 4 * 32 * 16 * 8;                         // 4 warps x 32 lanes x 16 B x 8 loads = 16 KB
  var NEEDED = 336 * 1024;                                 // 672 GB/s x ~500 ns (chapter 3)
  var PRACT = 590, PEAK = 672, FLOOR = 4, RIDGE = 46;      // GB/s, GB/s, us per launch, FLOP/B (FP32)
  var BPE = { FP32: 4, FP16: 2, FP8: 1 };

  function splitsAuto(B, Hkv, T) { return Math.max(1, Math.min(Math.ceil(192 / (B * Hkv)), Math.ceil(T / 256))); }

  function model(p, forceS) {
    var Hkv = p.Hq / p.g, bpe = BPE[p.dt];
    var scales = p.dt === 'FP8' ? p.T * p.B * Hkv * 2 * 4 : 0;
    var cache = p.B * Hkv * p.T * 2 * p.D * bpe + scales;
    var S = forceS != null ? forceS : (p.S === 'auto' ? splitsAuto(p.B, Hkv, p.T) : +p.S);
    var blocks = p.B * Hkv * S, chunk = Math.ceil(p.T / S);
    var conc = Math.min(blocks, SLOTS), waves = Math.ceil(blocks / SLOTS);
    var inflight = conc * PER_BLOCK;
    var stream = PRACT * Math.min(1, inflight / NEEDED);   // section 2: bandwidth = min(peak, bytes in flight / latency)
    var eff = blocks > SLOTS ? blocks / (waves * SLOTS) : 1;
    var gbs = stream * eff;
    var streamUs = cache / (gbs * 1e3);
    var partial = 2 * p.B * p.Hq * S * (p.D + 2) * 4;
    var us = streamUs + FLOOR + (S > 1 ? FLOOR + partial / (PRACT * 1e3) : 0);
    var flops = 4 * p.B * p.Hq * p.T * p.D;
    return { Hkv: Hkv, cache: cache, scales: scales, S: S, blocks: blocks, chunk: chunk, conc: conc, waves: waves,
             inflight: inflight, stream: stream, eff: eff, gbs: gbs, streamUs: streamUs, partial: partial, us: us,
             flops: flops, inten: flops / cache };
  }

  /* ---- controls ---- */
  var BS = [1, 2, 4, 8, 16, 32, 64], TS = [256, 512, 1024, 2048, 4096, 8192, 16384, 32768];
  var PRESETS = [
    { name: 'lab 14 v2 (B = 1, T = 4k, 1 split)', p: { B: 1, Hq: 12, g: 1, T: 4096, D: 64, dt: 'FP32', S: '1' } },
    { name: 'lab 14 v3 (auto)', p: { B: 1, Hq: 12, g: 1, T: 4096, D: 64, dt: 'FP32', S: 'auto' } },
    { name: 'Llama-3-8B 8k', p: { B: 1, Hq: 32, g: 4, T: 8192, D: 128, dt: 'FP16', S: 'auto' } }
  ];
  var st = JSON.parse(JSON.stringify(PRESETS[0].p));

  host.innerHTML = '';
  host.appendChild(el('h4', null, 'Decode attention: blocks, bytes in flight, bandwidth'));
  host.appendChild(el('p', 'w-sub', 'One decode step of one layer\u2019s attention on the RTX 5070 (48 SMs). Each block keeps 16 KB of loads in flight; Little\u2019s law needs 336 KB across the GPU to stream at full speed. Modelled, not measured; lab 14 measures it.'));
  var pre = el('div', 'c15-btns'); var pbtns = [];
  PRESETS.forEach(function (P) {
    var b = btn(P.name);
    b.addEventListener('click', function () { st = JSON.parse(JSON.stringify(P.p)); sync(); render(); });
    pbtns.push(b); pre.appendChild(b);
  });
  host.appendChild(pre);

  var ctr = el('div', 'w-controls c15-ctr');
  function rangeCtl(label, values, key) {
    var l = el('label'); var top = el('span', 'c15-lt'); top.appendChild(document.createTextNode(label + ' '));
    var o = el('output'); top.appendChild(o); l.appendChild(top);
    var r = el('input'); r.type = 'range'; r.min = 0; r.max = values.length - 1; r.step = 1;
    r.setAttribute('aria-label', label);
    r.addEventListener('input', function () { st[key] = values[+r.value]; render(); });
    l.appendChild(r); ctr.appendChild(l);
    return { set: function () { r.value = Math.max(0, values.indexOf(st[key])); o.textContent = fmtInt(st[key]); }, out: o };
  }
  function selCtl(label, opts, key, num) {
    var l = el('label'); l.appendChild(document.createTextNode(label));
    var s = el('select');
    opts.forEach(function (v) { var o = el('option', null, v[1]); o.value = v[0]; s.appendChild(o); });
    s.addEventListener('change', function () { st[key] = num ? +s.value : s.value; render(); });
    l.appendChild(s); ctr.appendChild(l);
    return { s: s, set: function () { s.value = String(st[key]); } };
  }
  var cB = rangeCtl('Batch B', BS, 'B');
  var cT = rangeCtl('Context T', TS, 'T');
  var cH = selCtl('Query heads', [[12, '12 (GPT-2)'], [32, '32 (Llama-3-8B)']], 'Hq', true);
  var cG = selCtl('GQA group g', [[1, '1 (MHA)'], [2, '2'], [4, '4'], [8, '8']], 'g', true);
  var cD = selCtl('Head size D', [[64, '64'], [128, '128']], 'D', true);
  var cDt = selCtl('Cache dtype', [['FP32', 'FP32'], ['FP16', 'FP16'], ['FP8', 'FP8 (E4M3 + scales)']], 'dt', false);
  var cS = selCtl('Splits S', [['auto', 'auto (the clamp)'], ['1', '1'], ['2', '2'], ['4', '4'], ['8', '8'], ['16', '16'], ['32', '32'], ['64', '64']], 'S', false);
  var ctls = [cB, cT, cH, cG, cD, cDt, cS];
  host.appendChild(ctr);

  var out = el('div', 'w-out c15-out');
  var vKv = stat(out, 'kv heads H_kv'), vCache = stat(out, 'cache read'), vS = stat(out, 'splits S / chunk'),
      vBl = stat(out, 'blocks / waves'), vConc = stat(out, 'resident blocks'), vGbs = stat(out, 'predicted GB/s'),
      vUs = stat(out, 'time'), vInt = stat(out, 'FLOP/B (ridge 46)');
  host.appendChild(out);

  var bars = el('div', 'w-bars c15-bars');
  function bar(label, cls) {
    var r = el('div', 'w-bar'); r.appendChild(el('span', 'c15-bl', label));
    var tr = el('div', 'track'); var fi = el('div', 'fill' + (cls ? ' ' + cls : '')); tr.appendChild(fi); r.appendChild(tr);
    var n = el('span', 'num'); r.appendChild(n); bars.appendChild(r);
    return { tr: tr, fi: fi, n: n };
  }
  var bF = bar('in flight', 'bind');
  var mark = el('div', 'c15-mark'); bF.tr.appendChild(mark);
  var b1 = bar('time, S = 1'), bA = bar('time, auto S', 'alt');
  host.appendChild(bars);
  var note = el('p', 'c15-note'); host.appendChild(note);
  var ver = el('div', 'w-verdict'); ver.setAttribute('aria-live', 'polite'); host.appendChild(ver);

  function sync() { ctls.forEach(function (c) { c.set(); }); }

  function render() {
    // g must divide the query heads (12 / 8 is not a head count)
    Array.prototype.forEach.call(cG.s.options, function (o) { o.disabled = st.Hq % +o.value !== 0; });
    if (st.Hq % st.g !== 0) st.g = 4;
    sync();
    PRESETS.forEach(function (P, i) {
      var same = Object.keys(P.p).every(function (k) { return String(P.p[k]) === String(st[k]); });
      pbtns[i].setAttribute('aria-pressed', String(same));
    });
    var m = model(st), m1 = model(st, 1), mA = model(st, splitsAuto(st.B, st.Hq / st.g, st.T));
    vKv.textContent = m.Hkv + (st.g > 1 ? ' (' + st.Hq + ' / ' + st.g + ')' : '');
    vCache.textContent = fmtBytes(m.cache) + (m.scales ? ' (' + fmtBytes(m.scales) + ' scales)' : '');
    vS.textContent = m.S + ' / ' + fmtInt(m.chunk) + ' keys';
    vBl.textContent = fmtInt(m.blocks) + ' / ' + m.waves;
    vConc.textContent = fmtInt(m.conc) + ' of ' + SLOTS;
    vGbs.textContent = Math.round(m.gbs) + ' (' + Math.round(100 * m.gbs / PEAK) + '% of 672)';
    vUs.textContent = fmtUs(m.us);
    vInt.textContent = (m.inten < 10 ? m.inten.toFixed(2) : m.inten.toFixed(1)) + (m.inten < RIDGE ? ': memory-bound' : ': compute');

    // in-flight bar: scale so that 336 KB sits at 60% of the track, overflow clipped
    var scale = NEEDED / 0.6;
    bF.fi.style.width = Math.min(100, 100 * m.inflight / scale) + '%';
    mark.style.left = '60%';
    bF.n.textContent = fmtKiB(m.inflight);
    var tmax = Math.max(m1.us, mA.us);
    b1.fi.style.width = (100 * m1.us / tmax) + '%'; b1.n.textContent = fmtUs(m1.us);
    bA.fi.style.width = (100 * mA.us / tmax) + '%'; bA.n.textContent = fmtUs(mA.us);
    note.textContent = 'Model: up to 8 blocks per SM resident; bandwidth = 590 GB/s \u00d7 min(1, in flight / 336 KB), times the last wave\u2019s fill; '
      + 'time = cache / bandwidth + 4 \u00b5s launch' + (m.S > 1 ? ' + 4 \u00b5s combine launch + ' + fmtBytes(m.partial) + ' of partials' : '')
      + '. FLOPs ' + (m.flops / 1e6).toFixed(m.flops >= 1e8 ? 0 : 1) + ' M. The tick on the bar is the 336 KB Little\u2019s law needs.';

    var cls, msg;
    if (m.streamUs < 2 * FLOOR) {
      cls = 'note';
      msg = 'Launch-floor-bound: the stream takes ' + fmtUs(m.streamUs) + ', less than the two launches; splitting buys little here, a CUDA graph or the single-kernel combine more.';
    } else if (m.inflight < NEEDED) {
      cls = 'bad';
      msg = 'Starved: ' + fmtInt(m.blocks) + ' blocks keep ' + fmtKiB(m.inflight) + ' in flight, ' + Math.round(100 * m.inflight / NEEDED)
        + '% of what Little\u2019s law needs. ' + (m.S < mA.S ? 'More splits (auto gives ' + mA.S + ') would fill the GPU.' : 'There is nothing left to cut: the chunks are already 256 keys.');
    } else {
      cls = 'mem';
      msg = 'Bandwidth-bound: DRAM is the limit. ' + fmtBytes(m.cache) + ' at ' + Math.round(m.gbs) + ' GB/s'
        + (m.eff < 1 ? ', with ' + Math.round(100 * (1 - m.eff)) + '% of the last wave idle' : '')
        + '. Only fewer bytes help now: a smaller dtype or a larger GQA group.';
    }
    ver.className = 'w-verdict ' + cls;
    ver.textContent = msg;
  }
  sync(); render();
})();
