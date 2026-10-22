/* ch14.js - chapter 14: starts Fig. 3 (assets/fig-flash.js) and builds the tile-size explorer (w-tiles). */
(function () {
  'use strict';
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function stat(parent, k) { var d = el('div', 'w-stat'); d.appendChild(el('span', 'k', k)); var v = el('span', 'v'); d.appendChild(v); parent.appendChild(d); return v; }

  /* ================= Fig. 3: the animated figure ================= */
  var fh = document.getElementById('fig-flash');
  if (fh && window.MLFilms && MLFilms.flash && window.XP) {
    var cap = fh.querySelector('figcaption');
    var html = cap ? cap.innerHTML : '';
    MLFilms.flash(fh, { fig: 'Fig. 3', caption: html });
  }

  /* ================= w-tiles: the tile-size explorer ================= */
  var host = document.getElementById('w-tiles');
  if (!host) return;
  var TS = [512, 1024, 2048, 4096, 8192, 16384];
  var PEAK = 61.7, SM = 48, SMEM_BLOCK = 99 * 1024, REGS_SM = 65536, WARPS_SM = 48, BLOCKS_SM = 24, HEADS = 12;
  var PRESET = { Br: 64, Bc: 64, D: 64, st: 2, ti: 3, causal: true };
  var p = JSON.parse(JSON.stringify(PRESET));

  host.innerHTML = '';
  host.appendChild(el('h4', null, 'Tile sizes: shared memory, registers, bytes'));
  host.appendChild(el('p', 'w-sub', 'One thread block of an FA2 kernel like lab 13\u2019s: Br query rows (16 per warp), key tiles of Bc rows, head size D, K/V buffers in flight (stages). FP16 inputs and outputs, FP32 accumulators, one head, your RTX 5070. Registers are an estimate from the fragment counts of section 6.'));
  var pre = el('div', 'c14-btns'), pb = el('button', null, 'lab 13'); pb.type = 'button';
  pb.addEventListener('click', function () { p = JSON.parse(JSON.stringify(PRESET)); sync(); render(); });
  pre.appendChild(pb); host.appendChild(pre);

  var ctr = el('div', 'w-controls c14-ctr'), sels = {};
  function sel(key, label, opts, fmt) {
    var l = el('label'); l.appendChild(document.createTextNode(label));
    var s = el('select');
    opts.forEach(function (v) { var o = el('option', null, fmt ? fmt(v) : String(v)); o.value = v; s.appendChild(o); });
    s.addEventListener('change', function () { p[key] = +s.value; render(); });
    l.appendChild(s); ctr.appendChild(l); sels[key] = s;
  }
  sel('Br', 'Q tile rows Br', [16, 32, 64, 128]);
  sel('Bc', 'K/V tile rows Bc', [32, 64, 128]);
  sel('D', 'head size D', [64, 128]);
  sel('st', 'K/V stages', [1, 2, 3]);
  var tl = el('label'); tl.appendChild(document.createTextNode('sequence length T '));
  var tout = el('output'); tl.appendChild(tout);
  var tin = el('input'); tin.type = 'range'; tin.min = 0; tin.max = TS.length - 1; tin.step = 1;
  tin.setAttribute('aria-label', 'sequence length T');
  tin.addEventListener('input', function () { p.ti = +tin.value; render(); });
  tl.appendChild(tin); ctr.appendChild(tl);
  var cl = el('label', 'c14-check'), cin = el('input'); cin.type = 'checkbox';
  cin.addEventListener('change', function () { p.causal = cin.checked; render(); });
  cl.appendChild(cin); cl.appendChild(el('span', null, 'causal (skip the tiles above the diagonal)'));
  ctr.appendChild(cl);
  host.appendChild(ctr);

  var out = el('div', 'w-out');
  var vW = stat(out, 'warps / threads'), vS = stat(out, 'shared / block'), vR = stat(out, 'registers / lane'), vO = stat(out, 'occupancy');
  var vM = stat(out, 'MMAs / warp / tile'), vN = stat(out, 'tiles / Q block'), vG = stat(out, 'blocks, waves'), vF = stat(out, 'tensor time');
  host.appendChild(out);
  var barsBox = el('div', 'w-bars');
  function bar(name, cls) {
    var b = el('div', 'w-bar'); b.appendChild(el('span', null, name));
    var tr = el('span', 'track'), f = el('span', 'fill' + (cls ? ' ' + cls : '')); f.style.display = 'block'; tr.appendChild(f); b.appendChild(tr);
    var n = el('span', 'num'); b.appendChild(n); barsBox.appendChild(b); return { f: f, n: n };
  }
  var bN = bar('naive', 'bind'), bF = bar('flash, no L2', 'alt'), bL = bar('flash, L2 hits', 'alt');
  host.appendChild(el('p', 'w-sub c14-barcap', 'DRAM bytes per head. Naive: S and P in FP32, four trips (16 T\u00b2). Flash with no L2 hits: Q and O once, K and V re-read by every Q block. Flash when the re-reads hit L2: Q, K, V, O once.'));
  host.appendChild(barsBox);
  var ver = el('div', 'w-verdict'); ver.setAttribute('aria-live', 'polite'); host.appendChild(ver);

  function sync() {
    ['Br', 'Bc', 'D', 'st'].forEach(function (k) { sels[k].value = p[k]; });
    tin.value = p.ti; cin.checked = p.causal;
  }
  function kb(b) { return b >= 1024 * 1024 ? (b / 1048576).toFixed(1) + ' MB' : (b / 1024).toFixed(b % 1024 ? 1 : 0) + ' KB'; }
  function bytes(b) { return b >= 1e9 ? (b / 1e9).toFixed(2) + ' GB' : b >= 1e6 ? (b / 1e6).toFixed(b >= 1e8 ? 0 : 1) + ' MB' : (b / 1e3).toFixed(0) + ' KB'; }
  function ms(x) { return x >= 1 ? x.toFixed(2) + ' ms' : (x * 1000).toFixed(0) + ' \u00b5s'; }
  function render() {
    var T = TS[p.ti], Br = p.Br, Bc = p.Bc, D = p.D, st = p.st, causal = p.causal;
    tout.textContent = T.toLocaleString('en-US');
    pb.setAttribute('aria-pressed', String(Br === 64 && Bc === 64 && D === 64 && st === 2 && p.ti === 3 && causal));
    var warps = Br / 16, threads = 32 * warps;
    var pad = D + 8, smem = 2 * (Br * pad + st * 2 * Bc * pad);
    var regs = 4 * (Bc / 8) + 4 * (D / 8) + 4 * (D / 16) + 4 + 2 * 2 + 2 * 2 + 24;
    var rpw = Math.ceil(Math.min(regs, 255) * 32 / 256) * 256;
    var byR = Math.floor(REGS_SM / (rpw * warps)), byS = smem > SMEM_BLOCK ? 0 : Math.floor(SMEM_BLOCK / smem), byW = Math.floor(WARPS_SM / warps);
    var blocksSM = Math.min(byR, byS, byW, BLOCKS_SM), wSM = blocksSM * warps, occ = wSM / WARPS_SM;
    var mmas = (Bc / 8) * (D / 16) + (D / 8) * (Bc / 16);
    var nq = Math.ceil(T / Br), tiles = 0;
    for (var b = 0; b < nq; b++) tiles += causal ? Math.ceil(Math.min(T, (b + 1) * Br) / Bc) : Math.ceil(T / Bc);
    var perBlock = tiles / nq;
    var naive = 16 * T * T, fl = 2 * T * D * 2 + (T / Br) * (causal ? 0.5 : 1) * 2 * T * D * 2, fl2 = 4 * T * D * 2;
    var flops = 4 * T * T * D * (causal ? 0.5 : 1), tPeak = flops / (PEAK * 1e12) * 1e3;
    var grid = nq * HEADS, waves = blocksSM > 0 ? Math.ceil(grid / (SM * blocksSM)) : 0;

    vW.textContent = warps + ' / ' + threads;
    vS.textContent = kb(smem);
    vR.textContent = '~' + regs + (regs > 255 ? ' spills' : '') + ' (est.)';
    vO.textContent = blocksSM < 1 ? 'does not fit' : Math.round(100 * occ) + '% (' + blocksSM + ' blk, ' + wSM + ' warps)';
    vM.textContent = String(mmas);
    vN.textContent = (perBlock % 1 ? perBlock.toFixed(1) : String(perBlock)) + (causal ? ' avg' : '');
    vG.textContent = nq + ' \u00d7 ' + HEADS + ' = ' + grid + (waves ? ', ' + waves + ' wave' + (waves > 1 ? 's' : '') : '');
    vF.textContent = ms(tPeak) + ' at peak, ' + ms(2 * tPeak) + ' at 50%';
    var mx = naive;
    [[bN, naive], [bF, fl], [bL, fl2]].forEach(function (x) { x[0].f.style.width = Math.max(0.4, 100 * x[1] / mx).toFixed(2) + '%'; x[0].n.textContent = bytes(x[1]); });
    var ratio = naive / fl;
    var msg = [], cls = 'w-verdict comp';
    if (regs > 255) { msg.push('~' + regs + ' registers per lane: over 255, the accumulators spill to local memory'); cls = 'w-verdict bad'; }
    if (smem > SMEM_BLOCK) { msg.push(kb(smem) + ' of shared memory: over your card\u2019s 99 KB per block'); cls = 'w-verdict bad'; }
    else if (smem > 48 * 1024) msg.push(kb(smem) + ' of shared memory: above 48 KB, so it needs dynamic shared memory and cudaFuncSetAttribute (chapter 3)');
    if (warps === 1) msg.push('1 warp per block: nothing hides the latency of the loads inside a block');
    if (!msg.length) msg.push('Fits: ' + kb(smem) + ' shared, ~' + regs + ' registers, ' + blocksSM + ' blocks per SM');
    ver.className = cls;
    ver.textContent = msg.join('. ') + '. Naive moves ' + ratio.toFixed(ratio < 10 ? 1 : 0) + '\u00d7 the bytes of flash with no L2 hits, ' + Math.round(naive / fl2) + '\u00d7 with them.';
  }
  sync(); render();
})();
