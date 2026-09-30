/* ch7.js — chapter 7 widgets: the tile walker and the tile-size calculator. */
(function () {
  'use strict';
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function btn(txt, cls) { var b = el('button', cls, txt); b.type = 'button'; return b; }
  function stat(parent, k) { var d = el('div', 'w-stat'); d.appendChild(el('span', 'k', k)); var v = el('span', 'v'); d.appendChild(v); parent.appendChild(d); return v; }
  function num(x) { return x.toLocaleString('en-US'); }

  /* ================= tile walker ================= */
  var host = document.getElementById('w-tilewalk');
  if (host) {
    var N = 128;                     // M = N = K = 128
    var st = { T: 32, r: 1, c: 2, p: 0 };
    host.innerHTML = '';
    host.appendChild(el('h4', null, 'Tile walker: one block computes one tile of C'));
    host.appendChild(el('p', 'w-sub', 'M = N = K = 128. Pick the tile of C a block owns (click a cell of C), then step through its phases along K. Dark squares are the tiles loaded into shared memory in the current phase.'));

    var bar = el('div', 'c7-btns');
    var tBtns = {};
    [16, 32].forEach(function (T) {
      var b = btn('T = ' + T); b.addEventListener('click', function () { st.T = T; var n = N / T; st.r = Math.min(st.r, n - 1); st.c = Math.min(st.c, n - 1); st.p = 0; render(); });
      tBtns[T] = b; bar.appendChild(b);
    });
    bar.appendChild(el('span', 'c7-sep'));
    var prev = btn('◀ phase'), next = btn('phase ▶');
    prev.addEventListener('click', function () { if (st.p > 0) { st.p--; render(); } });
    next.addEventListener('click', function () { if (st.p < N / st.T - 1) { st.p++; render(); } });
    bar.appendChild(prev); bar.appendChild(next);
    host.appendChild(bar);

    var mats = el('div', 'c7-mats');
    function mat(label) { var w = el('div', 'c7-mat'); w.appendChild(el('div', 'c7-mlabel', label)); var g = el('div', 'c7-grid'); w.appendChild(g); mats.appendChild(w); return g; }
    var gA = mat('A [M, K]'), gB = mat('B [K, N]'), gC = mat('C [M, N] — click a tile');
    host.appendChild(mats);
    var out = el('div', 'w-out');
    var vPhase = stat(out, 'phase'), vTiled = stat(out, 'global loads, tiled'), vNaive = stat(out, 'same outputs, naive'), vReuse = stat(out, 'reads per loaded element');
    host.appendChild(out);
    var desc = el('div', 'w-verdict'); desc.setAttribute('aria-live', 'polite'); host.appendChild(desc);

    function render() {
      var T = st.T, n = N / T;
      Object.keys(tBtns).forEach(function (k) { tBtns[k].setAttribute('aria-pressed', String(+k === T)); });
      prev.disabled = st.p === 0; next.disabled = st.p === n - 1;
      [gA, gB, gC].forEach(function (g) { g.innerHTML = ''; g.style.gridTemplateColumns = 'repeat(' + n + ', 1fr)'; });
      for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) {
        var a = el('span', 'c7-cell');
        if (i === st.r) a.classList.add(j === st.p ? 'now' : (j < st.p ? 'done' : 'strip'));
        gA.appendChild(a);
        var b = el('span', 'c7-cell');
        if (j === st.c) b.classList.add(i === st.p ? 'now' : (i < st.p ? 'done' : 'strip'));
        gB.appendChild(b);
        var c = btn('', 'c7-cell c7-cbtn');
        c.setAttribute('aria-label', 'C tile row ' + i + ', column ' + j);
        if (i === st.r && j === st.c) { c.classList.add('own'); c.setAttribute('aria-pressed', 'true'); } else c.setAttribute('aria-pressed', 'false');
        (function (ii, jj) { c.addEventListener('click', function () { st.r = ii; st.c = jj; st.p = 0; render(); }); })(i, j);
        gC.appendChild(c);
      }
      var done = st.p + 1;
      vPhase.textContent = done + ' of ' + n;
      vTiled.textContent = num(2 * T * T * done);
      vNaive.textContent = num(2 * T * T * T * done);
      vReuse.textContent = T + '×';
      var r0 = st.r * T, c0 = st.c * T, k0 = st.p * T;
      desc.className = 'w-verdict comp';
      desc.textContent = 'Phase ' + done + ': the block’s ' + (T * T) + ' threads load A[' + r0 + ':' + (r0 + T) + ', ' + k0 + ':' + (k0 + T) + '] and B[' + k0 + ':' + (k0 + T) + ', ' + c0 + ':' + (c0 + T) + '], one element of each per thread, then each does ' + T + ' FMAs from shared memory. ' +
        (done === n ? 'All ' + n + ' phases done: every output of the tile has its full dot product of length ' + N + ', with ' + T + '× fewer global loads than the naive kernel.' : 'After ' + n + ' phases the tile is complete.');
    }
    render();
  }

  /* ================= tile-size calculator ================= */
  var ch = document.getElementById('w-tilecalc');
  if (ch) {
    var BW = 672 * 0.88, PEAK = 30.9;
    ch.innerHTML = '';
    ch.appendChild(el('h4', null, 'Tile size: occupancy and the three ceilings'));
    ch.appendChild(el('p', 'w-sub', 'For the tiled kernel of section 6 on your RTX 5070 (48 SMs, 1,536 threads, 24 blocks, 64K registers and 100 KB of shared memory per SM, 1 KB reserved per block).'));
    var ctr = el('div', 'w-controls');
    var tSel = el('select'); [8, 16, 32].forEach(function (t) { var o = el('option', null, t + ' × ' + t); o.value = t; if (t === 16) o.selected = true; tSel.appendChild(o); });
    var l1 = el('label'); l1.appendChild(document.createTextNode('Tile T × T (threads per block = T²)')); l1.appendChild(tSel); ctr.appendChild(l1);
    var rOut = el('output'); var rIn = el('input'); rIn.type = 'range'; rIn.min = 16; rIn.max = 128; rIn.step = 8; rIn.value = 32;
    var l2 = el('label'); l2.appendChild(document.createTextNode('Registers per thread ')); l2.appendChild(rOut); l2.appendChild(rIn); ctr.appendChild(l2);
    var mL = el('label', 'c7-check'); var mIn = el('input'); mIn.type = 'checkbox';
    mL.appendChild(mIn); mL.appendChild(el('span', null, 'Compiler merges four As loads into one LDS.128'));
    ctr.appendChild(mL);
    ch.appendChild(ctr);
    var out2 = el('div', 'w-out');
    var vBlk = stat(out2, 'blocks per SM'), vOcc = stat(out2, 'occupancy'), vSm = stat(out2, 'shared per block'), vLim = stat(out2, 'limited by');
    ch.appendChild(out2);
    var bars = el('div', 'w-bars'); ch.appendChild(bars);
    var ver = el('div', 'w-verdict'); ver.setAttribute('aria-live', 'polite'); ch.appendChild(ver);

    function bar(label, val, max, cls) {
      var r = el('div', 'w-bar'); r.appendChild(el('span', null, label));
      var tr = el('div', 'track'); var f = el('div', 'fill' + (cls ? ' ' + cls : ''));
      f.style.width = Math.max(0.5, 100 * Math.log10(1 + val) / Math.log10(1 + max)).toFixed(1) + '%';
      tr.appendChild(f); r.appendChild(tr); r.appendChild(el('span', 'num', val.toFixed(1) + ' TF')); bars.appendChild(r);
    }
    function render2() {
      var T = +tSel.value, regs = +rIn.value, merged = mIn.checked;
      rOut.textContent = regs;
      var threads = T * T, wpb = Math.ceil(threads / 32), smem = 2 * T * T * 4;
      var byThreads = Math.floor(1536 / threads), byBlocks = 24, bySmem = Math.floor(102400 / (smem + 1024));
      var regsPerWarp = Math.ceil(regs * 32 / 256) * 256, byRegs = Math.floor(65536 / (regsPerWarp * wpb));
      var lim = [['threads', byThreads], ['block slots', byBlocks], ['shared memory', bySmem], ['registers', byRegs]];
      var blocks = Math.min(byThreads, byBlocks, bySmem, byRegs);
      var limiter = lim.filter(function (x) { return x[1] === blocks; }).map(function (x) { return x[0]; }).join(', ');
      var warps = blocks * wpb, occ = warps / 48;
      vBlk.textContent = String(blocks);
      vOcc.textContent = Math.round(100 * occ) + '% (' + warps + ' warps)';
      vSm.textContent = (smem / 1024).toFixed(smem < 1024 ? 1 : 0) + ' KB';
      vLim.textContent = limiter;
      var gCeil = (T / 4) * BW / 1000, lpf = merged ? 1.25 : 2, sCeil = PEAK * Math.min(1, 1 / (4 * lpf));
            bars.innerHTML = '';
      bar('global, no L2', gCeil, PEAK, '');
      bar('shared loads', sCeil, PEAK, 'bind');
      bar('FP32 peak', PEAK, PEAK, 'alt');
      var msg;
      if (gCeil <= sCeil) msg = 'With T = ' + T + ' each element is reused only ' + T + ' times: if L2 caught nothing, global traffic would cap the kernel at ' + gCeil.toFixed(1) + ' TFLOP/s. L2 catches a lot, so the shared-memory ceiling (' + sCeil.toFixed(1) + ') is the one to plan for.';
      else msg = 'Global traffic is no longer the limit (' + gCeil.toFixed(1) + ' TFLOP/s even with no L2 hits). The shared-memory ceiling is ' + sCeil.toFixed(1) + ' TFLOP/s, ' + Math.round(100 * sCeil / PEAK) + '% of peak, and it does not move with T: only fewer loads per FMA moves it (chapter 8).';
      if (occ < 0.5) msg += ' Occupancy is only ' + Math.round(100 * occ) + '%: too few warps to hide latency well.';
      ver.className = 'w-verdict ' + (occ < 0.5 ? 'bad' : 'mem');
      ver.textContent = msg;
    }
    [tSel, rIn, mIn].forEach(function (c) { c.addEventListener('input', render2); c.addEventListener('change', render2); });
    render2();
  }
})();
