/* ch8.js — chapter 8 widgets: the tile-hierarchy explorer and the mma fragment explorer. */
(function () {
  'use strict';
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function btn(txt, cls) { var b = el('button', cls, txt); b.type = 'button'; return b; }
  function stat(parent, k) { var d = el('div', 'w-stat'); d.appendChild(el('span', 'k', k)); var v = el('span', 'v'); d.appendChild(v); parent.appendChild(d); return v; }

  /* ================= tile hierarchy explorer ================= */
  var host = document.getElementById('w-hier');
  if (host) {
    var BW = 672 * 0.88, PEAK = 30.9;
    var PRESETS = [
      { name: 'ch. 7 tiled', p: { BM: 16, BN: 16, BK: 16, WM: 2, WN: 16, RM: 1, RN: 1 } },
      { name: 'v4 1D', p: { BM: 64, BN: 64, BK: 8, WM: 8, WN: 32, RM: 8, RN: 1 } },
      { name: 'v5 / v6 2D', p: { BM: 128, BN: 128, BK: 8, WM: 16, WN: 128, RM: 8, RN: 8 } },
      { name: 'v7 warp tile', p: { BM: 128, BN: 128, BK: 16, WM: 64, WN: 64, RM: 8, RN: 16 } }
    ];
    var OPTS = { BM: [16, 32, 64, 128, 256], BN: [16, 32, 64, 128, 256], BK: [8, 16, 32],
      WM: [1, 2, 4, 8, 16, 32, 64, 128, 256], WN: [1, 2, 4, 8, 16, 32, 64, 128, 256], RM: [1, 2, 4, 8, 16], RN: [1, 2, 4, 8, 16] };
    var LABEL = { BM: 'Block tile rows BM', BN: 'Block tile cols BN', BK: 'Tile depth BK', WM: 'Warp tile rows WM', WN: 'Warp tile cols WN', RM: 'Thread tile rows', RN: 'Thread tile cols' };
    var st = JSON.parse(JSON.stringify(PRESETS[3].p));

    host.innerHTML = '';
    host.appendChild(el('h4', null, 'The tile hierarchy: block, warp, thread'));
    host.appendChild(el('p', 'w-sub', 'A block tile lives in shared memory, each warp owns a warp tile, and each thread keeps a thread tile of accumulators in registers (its outputs per step k: rows × cols). The 32 lanes of a warp must cover its warp tile exactly: 32 × rows × cols = WM × WN. FP32, your RTX 5070.'));
    var pre = el('div', 'c8-btns'); var pbtns = [];
    PRESETS.forEach(function (P, i) {
      var b = btn(P.name); b.addEventListener('click', function () { st = JSON.parse(JSON.stringify(P.p)); sync(); render(); });
      pbtns.push(b); pre.appendChild(b);
    });
    host.appendChild(pre);
    var ctr = el('div', 'w-controls c8-ctr'); var sels = {};
    Object.keys(OPTS).forEach(function (k) {
      var l = el('label'); l.appendChild(document.createTextNode(LABEL[k]));
      var s = el('select'); OPTS[k].forEach(function (v) { var o = el('option', null, String(v)); o.value = v; s.appendChild(o); });
      s.addEventListener('change', function () { st[k] = +s.value; render(); });
      l.appendChild(s); ctr.appendChild(l); sels[k] = s;
    });
    var vl = el('label', 'c8-check'); var vIn = el('input'); vIn.type = 'checkbox'; vIn.checked = true;
    vl.appendChild(vIn); vl.appendChild(el('span', null, '16-byte shared loads (LDS.128) when the thread tile allows'));
    vIn.addEventListener('change', render);
    ctr.appendChild(vl);
    host.appendChild(ctr);
    var out = el('div', 'w-out');
    var vT = stat(out, 'threads / block'), vR = stat(out, 'registers (est.)'), vS = stat(out, 'shared / block'), vO = stat(out, 'occupancy');
    var vL = stat(out, 'shared loads / FMA'), vP = stat(out, 'shared values / output / k'), vI = stat(out, 'global FLOP/B, no L2'), vC = stat(out, 'shared ceiling');
    host.appendChild(out);
    var ver = el('div', 'w-verdict'); ver.setAttribute('aria-live', 'polite'); host.appendChild(ver);

    function sync() { Object.keys(sels).forEach(function (k) { sels[k].value = st[k]; }); }
    function render() {
      var p = st;
      PRESETS.forEach(function (P, i) {
        var same = Object.keys(P.p).every(function (k) { return P.p[k] === p[k]; });
        pbtns[i].setAttribute('aria-pressed', String(same));
      });
      var errs = [];
      if (p.BM % p.WM || p.BN % p.WN) errs.push('the warp tile must divide the block tile');
      if (32 * p.RM * p.RN !== p.WM * p.WN) errs.push('32 lanes × ' + p.RM + ' × ' + p.RN + ' = ' + (32 * p.RM * p.RN) + ' outputs, but the warp tile has ' + (p.WM * p.WN));
      var warps = (p.BM / p.WM) * (p.BN / p.WN), threads = warps * 32;
      if (!errs.length && threads > 1024) errs.push(threads + ' threads per block: the limit is 1,024');
      [vT, vR, vS, vO, vL, vP, vI, vC].forEach(function (v) { v.textContent = '—'; });
      if (errs.length) { ver.className = 'w-verdict bad'; ver.textContent = 'Not a valid tiling: ' + errs.join('; ') + '.'; return; }
      var acc = p.RM * p.RN, regs = acc + p.RM + p.RN + 16;   // accumulators, operands, ~16 for indices and addresses
      var smem = (p.BM + p.BN) * p.BK * 4;
      var byThreads = Math.floor(1536 / threads), bySmem = Math.floor(102400 / (smem + 1024));
      var rpw = Math.ceil(Math.min(regs, 255) * 32 / 256) * 256, byRegs = Math.floor(65536 / (rpw * warps));
      var blocks = Math.min(byThreads, 24, bySmem, byRegs), occ = blocks * warps / 48;
      var lpf = (p.RM + p.RN) / (p.RM * p.RN);
      var vec = vIn.checked && p.RM % 4 === 0 && p.RN % 4 === 0;
      var ipf = vec ? lpf / 4 : lpf;                         // load instructions per FMA
      var sCeil = PEAK * Math.min(1, 1 / (4 * ipf));
      var inten = p.BM * p.BN / (2 * (p.BM + p.BN));
      var perOut = (p.WM + p.WN) / (p.WM * p.WN);
      vT.textContent = String(threads);
      vR.textContent = regs > 255 ? regs + ' → spills' : '~' + regs;
      vS.textContent = (smem / 1024).toFixed(smem % 1024 ? 1 : 0) + ' KB';
      vO.textContent = blocks < 1 ? 'does not fit' : Math.round(100 * occ) + '% (' + blocks + ' blk)';
      vL.textContent = lpf.toFixed(3) + (vec ? ' (' + ipf.toFixed(3) + ' instr)' : '');
      vP.textContent = perOut.toFixed(3);
      vI.textContent = inten.toFixed(1) + ' → ' + (inten * BW / 1000).toFixed(1) + ' TF';
      vC.textContent = sCeil >= PEAK ? 'not the limit' : (100 * sCeil / PEAK).toFixed(1) + '% of peak';
      var msg, cls = 'mem';
      if (blocks < 1) { msg = 'This block does not fit on an SM (registers or shared memory).'; cls = 'bad'; }
      else if (regs > 255) { msg = 'More than 255 registers per thread: the accumulators would spill to local memory in the inner loop. Shrink the thread tile.'; cls = 'bad'; }
      else if (sCeil < PEAK) msg = 'Shared memory caps this kernel at about ' + (100 * sCeil / PEAK).toFixed(1) + '% of peak: each FMA needs ' + ipf.toFixed(2) + ' shared-load instructions. Grow the thread tile.';
      else if (inten * BW / 1000 < PEAK) msg = 'Shared memory is no longer the limit. Without L2 hits the global traffic would cap the kernel at ' + (inten * BW / 1000).toFixed(1) + ' TFLOP/s; L2 catches much of it, and larger block tiles raise the ceiling. Occupancy ' + Math.round(100 * occ) + '%: ILP from ' + acc + ' independent FMAs per step does the latency hiding.';
      else { msg = 'Neither shared nor global traffic limits this tiling on paper: what is left is latency, instruction overhead and the clock. Occupancy ' + Math.round(100 * occ) + '%, ' + acc + ' accumulators per thread.'; cls = 'comp'; }
      ver.className = 'w-verdict ' + cls;
      ver.textContent = msg;
    }
    sync(); render();
  }

  /* ================= mma.m16n8k16 fragment explorer ================= */
  var fh = document.getElementById('w-frag');
  if (fh) {
    // PTX ISA, mma.m16n8k16 with .f16 A/B and .f32 C/D. groupID = lane / 4, t = lane % 4.
    function aPos(lane, i) { var g = lane >> 2, t = lane & 3; return [g + ((i & 2) ? 8 : 0), 2 * t + (i & 1) + (i >= 4 ? 8 : 0)]; }
    function bPos(lane, i) { var g = lane >> 2, t = lane & 3; return [2 * t + (i & 1) + (i >= 2 ? 8 : 0), g]; }
    function cPos(lane, i) { var g = lane >> 2, t = lane & 3; return [g + (i >= 2 ? 8 : 0), 2 * t + (i & 1)]; }
    var MATS = [
      { key: 'A', title: 'A: 16 × 16 halves (rows m, cols k)', rows: 16, cols: 16, n: 8, reg: 'a', pos: aPos },
      { key: 'B', title: 'B: 16 × 8 halves (rows k, cols n)', rows: 16, cols: 8, n: 4, reg: 'b', pos: bPos },
      { key: 'C', title: 'C / D: 16 × 8 floats (rows m, cols n)', rows: 16, cols: 8, n: 4, reg: 'c', pos: cPos }
    ];
    var lane = 5;
    fh.innerHTML = '';
    fh.appendChild(el('h4', null, 'Who holds what: the fragments of mma.m16n8k16'));
    fh.appendChild(el('p', 'w-sub', 'Every element of A, B and C lives in the registers of exactly one lane. Pick a lane: its elements light up, labelled with the fragment element that holds them (a0…a7, b0…b3, c0…c3). The small numbers are the owning lane of every element.'));
    var lanes = el('div', 'c8-lanes'); lanes.setAttribute('role', 'group'); lanes.setAttribute('aria-label', 'Lane');
    var lbtn = [];
    for (var L = 0; L < 32; L++) {
      (function (L) { var b = btn(String(L), 'c8-lane'); b.addEventListener('click', function () { lane = L; render2(); }); lbtn.push(b); lanes.appendChild(b); })(L);
    }
    fh.appendChild(lanes);
    var grids = el('div', 'c8-frags'); var cells = {};
    MATS.forEach(function (Mx) {
      var w = el('div', 'c8-fwrap c8-f' + Mx.key); w.appendChild(el('div', 'c8-ftitle', Mx.title));
      var g = el('div', 'c8-fgrid'); g.style.gridTemplateColumns = 'repeat(' + Mx.cols + ', 1fr)'; g.setAttribute('aria-hidden', 'true');
      var owner = [];
      for (var r = 0; r < Mx.rows; r++) { owner.push([]); for (var c = 0; c < Mx.cols; c++) owner[r].push(null); }
      for (var l = 0; l < 32; l++) for (var i = 0; i < Mx.n; i++) { var p = Mx.pos(l, i); owner[p[0]][p[1]] = [l, i]; }
      cells[Mx.key] = [];
      for (r = 0; r < Mx.rows; r++) for (c = 0; c < Mx.cols; c++) {
        var cell = el('span', 'c8-fc'); cell.dataset.lane = owner[r][c][0]; cell.dataset.i = owner[r][c][1];
        cell.textContent = owner[r][c][0];
        g.appendChild(cell); cells[Mx.key].push(cell);
      }
      w.appendChild(g); grids.appendChild(w);
    });
    fh.appendChild(grids);
    var info = el('div', 'w-verdict comp'); info.setAttribute('aria-live', 'polite'); fh.appendChild(info);

    function render2() {
      lbtn.forEach(function (b, i) { b.setAttribute('aria-pressed', String(i === lane)); });
      MATS.forEach(function (Mx) {
        cells[Mx.key].forEach(function (c) {
          var mine = +c.dataset.lane === lane;
          c.classList.toggle('on', mine);
          c.textContent = mine ? Mx.reg + c.dataset.i : c.dataset.lane;
        });
      });
      var g = lane >> 2, t = lane & 3;
      function list(Mx) { var s = []; for (var i = 0; i < Mx.n; i++) { var p = Mx.pos(lane, i); s.push(Mx.reg + i + '=(' + p[0] + ',' + p[1] + ')'); } return s.join(' '); }
      info.textContent = 'Lane ' + lane + ': groupID = lane / 4 = ' + g + ', threadID_in_group = lane % 4 = ' + t +
        '. A: rows ' + g + ' and ' + (g + 8) + ', cols ' + (2 * t) + '–' + (2 * t + 1) + ' and ' + (2 * t + 8) + '–' + (2 * t + 9) + ' → ' + list(MATS[0]) +
        '. B: ' + list(MATS[1]) + '. C: ' + list(MATS[2]) + '. A 4-lane group shares its rows of A and C and its column of B.';
    }
    render2();
  }
})();
