/* tile-anim.js — chapter 3, "Why reuse is the whole game": an animation of one block
   computing a 4x4 tile of C (K = 8), naive versus tiled with T = 4. Every load is a dot.
   The picture is a pure function of time t: render(t) recomputes everything from the
   schedule, so the scrubber, play and replay all go through the same path. */
(function () {
  'use strict';
  var host = document.getElementById('w-tileanim');
  if (!host) return;

  var NS = 'http://www.w3.org/2000/svg';
  var T = 4, K = 8;                       // 4x4 output tile, dot products of length 8
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function sv(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function btn(txt) { var b = el('button', null, txt); b.type = 'button'; return b; }
  function stat(parent, k) { var d = el('div', 'w-stat'); d.appendChild(el('span', 'k', k)); var v = el('span', 'v'); d.appendChild(v); parent.appendChild(d); return v; }
  function ease(u) { return u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }

  /* ---------- two layouts: wide (side by side) and tall (stacked, for phones) ---------- */
  var LAYOUT = {
    wide: { vw: 720, vh: 392,
      dram: [8, 8, 330, 376], sm: [354, 8, 358, 376],
      A: [24, 270], B: [214, 52], cs: 26, leg: [24, 70],
      sh: [370, 38, 326, 138], As: [400, 62], Bs: [552, 62], ss: 22,
      bar: 192, th: [465, 222], ts: 34 },
    tall: { vw: 400, vh: 648,
      dram: [8, 8, 384, 262], sm: [8, 280, 384, 360],
      A: [24, 150], B: [270, 52], cs: 20, leg: [24, 66],
      sh: [24, 308, 352, 132], As: [66, 332], Bs: [246, 332], ss: 22,
      bar: 454, th: [132, 480], ts: 34 }
  };
  var G;

  function cA(r, k) { return [G.A[0] + k * G.cs + G.cs / 2, G.A[1] + r * G.cs + G.cs / 2]; }
  function cB(k, c) { return [G.B[0] + c * G.cs + G.cs / 2, G.B[1] + k * G.cs + G.cs / 2]; }
  function cAs(r, c) { return [G.As[0] + c * G.ss + G.ss / 2, G.As[1] + r * G.ss + G.ss / 2]; }
  function cBs(r, c) { return [G.Bs[0] + c * G.ss + G.ss / 2, G.Bs[1] + r * G.ss + G.ss / 2]; }
  function cTh(r, c, dx) { return [G.th[0] + c * G.ts + G.ts / 2 + (dx || 0), G.th[1] + r * G.ts + G.ts / 2]; }

  /* ---------- schedules: flights (dots), FMAs, barriers, highlights, captions ---------- */
  // A flight: { t0, t1, kind: 'a'|'b', from: fn, to: fn, land: {dram:[mat,i,j]} | {slot:[mat,r,c]} | {shared:true} }
  // Positions are functions so a layout switch needs no rebuild of the schedule.
  function naive() {
    var S = { flights: [], fmas: [], bars: [], marks: [], caps: [], end: 0, code: NAIVE_CODE, pov: [] }, D = 1.5, t0 = .3;
    for (var q = 0; q < T * T; q++) S.pov.push([[0, [2], {}, 'start']]);
    S.caps.push([0, 'Naive kernel: each thread computes C[r, c] by walking k from 0 to 7, loading A[r, k] and B[k, c] straight from DRAM.']);
    for (var k = 0; k < K; k++) {
      var b = t0 + k * D;
      for (var r = 0; r < T; r++) for (var c = 0; c < T; c++) {
        var i = r * T + c, st = b + .25 * i / 15;
        (function (r, c, k) {
          S.flights.push({ t0: st, t1: st + .75, kind: 'a', from: function () { return cA(r, k); }, to: function () { return cTh(r, c, -6); }, land: { dram: ['a', r, k] }, who: [r, c] });
          S.flights.push({ t0: st, t1: st + .75, kind: 'b', from: function () { return cB(k, c); }, to: function () { return cTh(r, c, 6); }, land: { dram: ['b', k, c] }, who: [r, c] });
        })(r, c, k);
        S.fmas.push([b + 1.05, r, c]);
        S.pov[i].push([b, [4, 5], { k: k }, 'nload'], [st + .75, [6], { k: k }, 'nfma']);
      }
      S.marks.push({ t0: b, t1: b + D, aCols: [k, k + 1], bRows: [k, k + 1] });
      S.caps.push([b, 'k = ' + k + ': all 16 threads load from DRAM at once. The 4 threads of a row all ask for the same A[r, ' + k + '], the 4 threads of a column for the same B[' + k + ', c], and each request is a separate load.']);
    }
    S.end = t0 + K * D;
    S.pov.forEach(function (l) { l.push([S.end, [8], {}, 'nend']); });
    S.caps.push([S.end, 'Done. 256 DRAM loads (1,024 bytes) for 128 FMAs (256 FLOPs): 0.25 FLOPs per byte. Every element was fetched 4 times, once per thread that needed it. With bigger matrices the reuse grows but the naive kernel still fetches every element once per use.']);
    S.total = S.end + 2.5;
    return S;
  }

  function tiled() {
    var S = { flights: [], fmas: [], bars: [], marks: [], caps: [], end: 0, code: TILED_CODE, pov: [] }, P = 5.3, t0 = .3;
    for (var q = 0; q < T * T; q++) S.pov.push([[0, [3], {}, 'start']]);
    S.caps.push([0, 'Tiled kernel, T = 4: the block walks k in phases of 4. Each phase, it loads one 4×4 tile of A and one of B into shared memory, then computes from there.']);
    for (var p = 0; p < K / T; p++) {
      var pb = t0 + p * P;
      for (var r = 0; r < T; r++) for (var c = 0; c < T; c++) {
        var i = r * T + c, st = pb + .25 * i / 15;
        (function (r, c, p) {
          S.flights.push({ t0: st, t1: st + .8, kind: 'a', from: function () { return cA(r, p * T + c); }, to: function () { return cAs(r, c); }, land: { dram: ['a', r, p * T + c], slot: ['a', r, c] }, who: [r, c] });
          S.pov[r * T + c].push([st, [5, 6], { t: p }, 'tload'], [st + .8, [7], { t: p }, 'twait'], [pb + 1.2, [7], { t: p }, 'tbar1']);
          S.flights.push({ t0: st, t1: st + .8, kind: 'b', from: function () { return cB(p * T + r, c); }, to: function () { return cBs(r, c); }, land: { dram: ['b', p * T + r, c], slot: ['b', r, c] }, who: [r, c] });
        })(r, c, p);
      }
      S.marks.push({ t0: pb, t1: pb + P, aCols: [p * T, p * T + T], bRows: [p * T, p * T + T] });
      S.caps.push([pb, 'Phase ' + (p + 1) + ' of 2: thread (r, c) loads A[r, ' + (p * T) + ' + c] into As[r][c] and B[' + (p * T) + ' + r, c] into Bs[r][c]. 32 loads, and every element of the two tiles is fetched exactly once.']);
      S.bars.push([pb + 1.2, pb + 1.7, 'raw']);
      S.caps.push([pb + 1.2, '__syncthreads(): nobody reads the tiles until all 16 threads have written their part (read after write).']);
      for (var kk = 0; kk < T; kk++) {
        var kb = pb + 1.7 + kk * .8;
        for (r = 0; r < T; r++) for (c = 0; c < T; c++) {
          i = r * T + c; st = kb + .1 * i / 15;
          (function (r, c, kk) {
            S.flights.push({ t0: st, t1: st + .4, kind: 'a', from: function () { return cAs(r, kk); }, to: function () { return cTh(r, c, -6); }, land: { shared: true }, who: [r, c] });
            S.flights.push({ t0: st, t1: st + .4, kind: 'b', from: function () { return cBs(kk, c); }, to: function () { return cTh(r, c, 6); }, land: { shared: true }, who: [r, c] });
          })(r, c, kk);
          S.fmas.push([kb + .55, r, c]);
          S.pov[i].push([kb, [9], { t: p, k: kk }, 'tread']);
        }
        S.marks.push({ t0: kb, t1: kb + .8, sCol: kk });
        S.caps.push([kb, 'k = ' + (p * T + kk) + ': As[r][' + kk + '] goes to the 4 threads of row r, Bs[' + kk + '][c] to the 4 threads of column c. These are shared-memory reads: no DRAM traffic at all.']);
      }
      S.bars.push([pb + 4.9, pb + 5.3, 'war']);
      S.pov.forEach(function (l) { l.push([pb + 4.9, [10], { t: p, last: p === K / T - 1 }, 'tbar2']); });
      S.caps.push([pb + 4.9, '__syncthreads(): nobody overwrites the tiles with the next phase until all 16 threads have finished reading them (write after read).']);
    }
    S.end = t0 + (K / T) * P;
    S.pov.forEach(function (l) { l.push([S.end, [12], {}, 'tend']); });
    S.caps.push([S.end, 'Done. Same 16 outputs, 64 DRAM loads instead of 256: 1 FLOP per byte, 4× the naive kernel, because each loaded element was used by 4 threads. The gain is T: with 32×32 tiles it is 32×, 8 FLOPs per byte.']);
    S.total = S.end + 2.5;
    return S;
  }

  var NAIVE_CODE = [
    'int tx = threadIdx.x, ty = threadIdx.y;',
    'int row = blockIdx.y*4 + ty, col = blockIdx.x*4 + tx;',
    'float acc = 0.0f;',
    'for (int k = 0; k < K; ++k) {             // K = 8',
    '    float a = A[row * K + k];            // DRAM',
    '    float b = B[k * N + col];            // DRAM',
    '    acc += a * b;',
    '}',
    'C[row * N + col] = acc;'
  ];
  var TILED_CODE = [
    '__shared__ float As[4][4], Bs[4][4];',
    'int tx = threadIdx.x, ty = threadIdx.y;',
    'int row = blockIdx.y*4 + ty, col = blockIdx.x*4 + tx;',
    'float acc = 0.0f;',
    'for (int t = 0; t < K / 4; ++t) {         // 2 phases',
    '    As[ty][tx] = A[row * K + t * 4 + tx];    // DRAM',
    '    Bs[ty][tx] = B[(t * 4 + ty) * N + col];  // DRAM',
    '    __syncthreads();',
    '    for (int k = 0; k < 4; ++k)',
    '        acc += As[ty][k] * Bs[k][tx];        // shared',
    '    __syncthreads();',
    '}',
    'C[row * N + col] = acc;'
  ];
  var MODES = { naive: naive(), tiled: tiled() };
  var st = { mode: 'naive', t: 0, playing: false, last: 0, started: false, view: 'block', me: [1, 2] };

  /* ---------- DOM ---------- */
  host.innerHTML = '';
  host.appendChild(el('h4', null, 'Watch the loads: naive versus tiled'));
  host.appendChild(el('p', 'w-sub', 'One block computes a 4×4 tile of C with K = 8. Each dot is one 4-byte load: blue from A, red from B. The shade of a DRAM cell counts how many times that element was fetched.'));

  var bar = el('div', 'ta-btns');
  var bNaive = btn('Naive kernel'), bTiled = btn('Tiled kernel');
  var sep = el('span', 'ta-sep');
  var bPlay = btn('▶ Play');
  bar.appendChild(bNaive); bar.appendChild(bTiled); bar.appendChild(sep); bar.appendChild(bPlay);
  host.appendChild(bar);

  var stage = el('div', 'ta-stage');
  host.appendChild(stage);
  var scrub = el('input', 'ta-scrub');
  scrub.type = 'range'; scrub.min = 0; scrub.step = 0.01; scrub.setAttribute('aria-label', 'Animation time');
  host.appendChild(scrub);

  var tabs = el('div', 'ta-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Point of view');
  var tBlock = btn('The whole block'), tThread = btn('One thread’s view');
  [tBlock, tThread].forEach(function (b, i) { b.setAttribute('role', 'tab'); b.id = 'ta-tab-' + i; b.setAttribute('aria-controls', 'ta-pane-' + i); tabs.appendChild(b); });
  host.appendChild(tabs);

  var paneBlock = el('div', 'ta-pane'), paneThread = el('div', 'ta-pane');
  [paneBlock, paneThread].forEach(function (p, i) { p.id = 'ta-pane-' + i; p.setAttribute('role', 'tabpanel'); p.setAttribute('aria-labelledby', 'ta-tab-' + i); host.appendChild(p); });

  var out = el('div', 'w-out');
  var vLoads = stat(out, 'DRAM loads'), vShared = stat(out, 'shared-memory reads'), vFma = stat(out, 'FMAs'), vInt = stat(out, 'FLOPs per DRAM byte');
  paneBlock.appendChild(out);
  var cap = el('div', 'w-verdict ta-cap'); cap.setAttribute('aria-live', 'polite'); paneBlock.appendChild(cap);

  // thread view: pick a thread, its code with the current line lit, its variables, its story
  var pick = el('div', 'ta-pick');
  var pickL = el('label', null, 'Follow thread (ty, tx) ');
  var sel = el('select');
  for (var q = 0; q < T * T; q++) { var o = el('option', null, '(' + (q / T | 0) + ', ' + (q % T) + ')'); o.value = q; sel.appendChild(o); }
  sel.value = 1 * T + 2;
  pickL.appendChild(sel); pick.appendChild(pickL);
  pick.appendChild(el('span', 'ta-hint', 'or click a thread in the picture'));
  paneThread.appendChild(pick);
  var pov = el('div', 'ta-pov');
  var codeBox = el('pre', 'ta-code'); pov.appendChild(codeBox);
  var varsBox = el('dl', 'ta-vars'); pov.appendChild(varsBox);
  paneThread.appendChild(pov);
  var said = el('div', 'w-verdict ta-cap ta-said'); said.setAttribute('aria-live', 'polite'); paneThread.appendChild(said);
  var codeFor = null, codeLines = [];

  /* ---------- SVG, rebuilt when the layout changes ---------- */
  var N = {};       // node handles
  function build(name) {
    G = LAYOUT[name]; G.name = name;
    stage.innerHTML = '';
    var s = sv('svg', { viewBox: '0 0 ' + G.vw + ' ' + G.vh, class: 'ta-svg', role: 'img',
      'aria-label': 'Animation: the loads of a naive and a tiled matrix-multiply block, from DRAM through shared memory to 16 threads.' });
    stage.appendChild(s);

    function panel(b, title) {
      sv('rect', { x: b[0], y: b[1], width: b[2], height: b[3], rx: 4, class: 'ta-panel' }, s);
      sv('text', { x: b[0] + 12, y: b[1] + 20, class: 'ta-ptitle' }, s).textContent = title;
    }
    panel(G.dram, 'DRAM · global memory');
    panel(G.sm, 'SM · one block, 16 threads');

    // A strip (4 rows x 8 k) and B strip (8 k x 4 cols)
    N.dA = []; N.dB = [];
    sv('text', { x: G.A[0], y: G.A[1] - 8, class: 'ta-lbl' }, s).textContent = 'A[r, k]';
    sv('text', { x: G.B[0] + 2 * G.cs, y: G.B[1] - 8, class: 'ta-lbl', 'text-anchor': 'middle' }, s).textContent = 'B[k, c]';
    for (var r = 0; r < T; r++) { N.dA.push([]); for (var k = 0; k < K; k++) N.dA[r].push(cell(G.A[0] + k * G.cs, G.A[1] + r * G.cs, G.cs, 'a')); }
    for (k = 0; k < K; k++) { N.dB.push([]); for (var c = 0; c < T; c++) N.dB[k].push(cell(G.B[0] + c * G.cs, G.B[1] + k * G.cs, G.cs, 'b')); }
    function cell(x, y, w, kind) {
      var g = sv('g', {}, s);
      var rc = sv('rect', { x: x, y: y, width: w, height: w, class: 'ta-cell ' + kind }, g);
      var tx = sv('text', { x: x + w / 2, y: y + w / 2, class: 'ta-cnt' }, g);
      return { r: rc, t: tx, n: -1 };
    }
    // legend: shade = number of fetches
    sv('text', { x: G.leg[0], y: G.leg[1], class: 'ta-lbl' }, s).textContent = 'times fetched:';
    for (var n = 1; n <= 4; n++) {
      var lx = G.leg[0] + (n - 1) * 26, ly = G.leg[1] + 10;
      sv('rect', { x: lx, y: ly, width: 20, height: 20, class: 'ta-cell a n' + n }, s);
      sv('text', { x: lx + 10, y: ly + 10, class: 'ta-cnt' }, s).textContent = n;
    }
    N.hiA = sv('rect', { class: 'ta-hi', rx: 2 }, s);
    N.hiB = sv('rect', { class: 'ta-hi', rx: 2 }, s);

    // shared memory
    N.sh = sv('g', { class: 'ta-sh' }, s);
    sv('rect', { x: G.sh[0], y: G.sh[1], width: G.sh[2], height: G.sh[3], rx: 3, class: 'ta-shbox' }, N.sh);
    sv('text', { x: G.sh[0] + 10, y: G.sh[1] + 18, class: 'ta-lbl' }, N.sh).textContent = 'shared memory';
    N.shIdle = sv('text', { x: G.sh[0] + G.sh[2] - 10, y: G.sh[1] + 18, class: 'ta-lbl', 'text-anchor': 'end' }, N.sh);
    N.shIdle.textContent = 'unused by this kernel';
    sv('text', { x: G.As[0] + 2 * G.ss, y: G.As[1] + 4 * G.ss + 16, class: 'ta-lbl', 'text-anchor': 'middle' }, N.sh).textContent = 'As[4][4]';
    sv('text', { x: G.Bs[0] + 2 * G.ss, y: G.Bs[1] + 4 * G.ss + 16, class: 'ta-lbl', 'text-anchor': 'middle' }, N.sh).textContent = 'Bs[4][4]';
    N.sA = []; N.sB = [];
    for (r = 0; r < T; r++) { N.sA.push([]); N.sB.push([]); for (c = 0; c < T; c++) {
      N.sA[r].push(sv('rect', { x: G.As[0] + c * G.ss, y: G.As[1] + r * G.ss, width: G.ss, height: G.ss, class: 'ta-slot a' }, N.sh));
      N.sB[r].push(sv('rect', { x: G.Bs[0] + c * G.ss, y: G.Bs[1] + r * G.ss, width: G.ss, height: G.ss, class: 'ta-slot b' }, N.sh));
    } }
    N.hiS = sv('rect', { class: 'ta-hi', rx: 2 }, s);
    N.hiS2 = sv('rect', { class: 'ta-hi', rx: 2 }, s);

    // the barrier
    N.bar = sv('g', { class: 'ta-bar' }, s);
    sv('rect', { x: G.sm[0] + 14, y: G.bar - 11, width: G.sm[2] - 28, height: 22, rx: 3 }, N.bar);
    N.barT = sv('text', { x: G.sm[0] + G.sm[2] / 2, y: G.bar, 'text-anchor': 'middle' }, N.bar);

    // threads: one cell per output, with an accumulator bar
    sv('text', { x: G.th[0] + 2 * G.ts, y: G.th[1] + 4 * G.ts + 16, class: 'ta-lbl', 'text-anchor': 'middle' }, s).textContent = 'thread (r, c) accumulates C[r, c]';
    N.th = [];
    for (r = 0; r < T; r++) { N.th.push([]); for (c = 0; c < T; c++) {
      var x = G.th[0] + c * G.ts, y = G.th[1] + r * G.ts;
      var box = sv('rect', { x: x + 2, y: y + 2, width: G.ts - 4, height: G.ts - 4, rx: 2, class: 'ta-th' }, s);
      var acc = sv('rect', { x: x + 5, width: G.ts - 10, class: 'ta-acc' }, s);
      (function (r, c) {
        var hit = sv('rect', { x: x, y: y, width: G.ts, height: G.ts, class: 'ta-hit' }, s);
        sv('title', {}, hit).textContent = 'Follow thread (' + r + ', ' + c + ')';
        hit.addEventListener('click', function () { follow(r, c); });
      })(r, c);
      N.th[r].push({ box: box, acc: acc, x: x, y: y });
    } }

    // dot pool
    N.dots = [];
    for (var i = 0; i < 40; i++) N.dots.push(sv('circle', { r: 4, class: 'ta-pk', visibility: 'hidden' }, s));
    N.capIdx = -1;
  }

  /* ---------- one thread's story ---------- */
  function others(r, c, axis) {     // the 3 other threads of my row (axis 'row') or column
    var l = [];
    for (var j = 0; j < T; j++) if (axis === 'row' ? j !== c : j !== r) l.push(axis === 'row' ? '(' + r + ', ' + j + ')' : '(' + j + ', ' + c + ')');
    return l.slice(0, -1).join(', ') + ' and ' + l[l.length - 1];
  }
  function owner(a, b, r, c) { return a === r && b === c ? 'which I loaded myself' : 'which thread (' + a + ', ' + b + ') loaded'; }
  function story(key, v, r, c) {
    var k = v.k, p = v.t;
    switch (key) {
      case 'start': return st.mode === 'naive'
        ? 'I am thread (ty, tx) = (' + r + ', ' + c + '). My job is one output, C[' + r + ', ' + c + ']: row ' + r + ' of A times column ' + c + ' of B, 8 terms. acc starts at 0, in a register only I can see.'
        : 'I am thread (ty, tx) = (' + r + ', ' + c + '). My job is still one output, C[' + r + ', ' + c + '], but I also help my block fill two 4×4 tiles in shared memory, which all 16 of us will read.';
      case 'nload': return 'k = ' + k + '. I ask DRAM for A[' + r + ', ' + k + '] and B[' + k + ', ' + c + ']. Threads ' + others(r, c, 'row') + ' want the same A[' + r + ', ' + k + '] right now, and threads ' + others(r, c, 'col') + ' the same B[' + k + ', ' + c + ']. Each of us gets a separate copy, and I can do nothing until mine arrive.';
      case 'nfma': return 'Both values are in my registers: acc += a * b, term ' + (k + 1) + ' of 8. I used each value once and will never touch it again. ' + (k < K - 1 ? 'Next k: two more trips to DRAM.' : 'That was the last term.');
      case 'nend': return 'I store C[' + r + ', ' + c + ']. My count: 16 DRAM loads for 8 FMAs. Every other thread did the same, and 12 of my 16 loads fetched values a neighbour also fetched.';
      case 'tload': return 'Phase t = ' + p + '. I load one element of each tile, the one at my own position: A[' + r + ', ' + (p * T + c) + '] into As[' + r + '][' + c + '] and B[' + (p * T + r) + ', ' + c + '] into Bs[' + r + '][' + c + ']. I load them for the block: each will be read by 4 threads, me included.';
      case 'twait': {
        var need = c !== 0 ? 'As[' + r + '][0], which thread (' + r + ', 0) loads' : r !== 0 ? 'Bs[0][' + c + '], which thread (0, ' + c + ') loads' : 'As[0][1], which thread (0, 1) loads';
        return 'My two stores are done, so I wait at __syncthreads(). I can’t go on alone: soon I need ' + need + ', and not every thread has stored yet.';
      }
      case 'tbar1': return '__syncthreads(): all 16 threads have arrived, so both tiles are complete. Reading them is safe now.';
      case 'tread': return 'k = ' + k + ' (term ' + (p * T + k + 1) + ' of 8). I read As[' + r + '][' + k + '], ' + owner(r, k, r, c) + ', and Bs[' + k + '][' + c + '], ' + owner(k, c, r, c) + '. Both come from shared memory, no DRAM: acc += As[' + r + '][' + k + '] * Bs[' + k + '][' + c + '].';
      case 'tbar2': return '__syncthreads() again. I am done with these tiles, but others may still be reading them, so nobody overwrites them with the next phase until all 16 are done.' + (v.last ? ' (In the last phase nothing overwrites them, but the loop runs the barrier anyway.)' : '');
      case 'tend': return 'I store C[' + r + ', ' + c + ']. My count: 4 DRAM loads for 8 FMAs. Of the 16 values I multiplied, 12 came from tiles my neighbours loaded.';
    }
    return '';
  }
  function accText(n, r, c) {
    if (!n) return '0';
    var term = function (j) { return 'A[' + r + ',' + j + ']·B[' + j + ',' + c + ']'; };
    return n === 1 ? term(0) : n === 2 ? term(0) + ' + ' + term(1) : term(0) + ' + … + ' + term(n - 1);
  }
  function follow(r, c) { st.me = [r, c]; sel.value = r * T + c; setView('thread'); }
  function setView(v) { st.view = v; render(); }

  /* ---------- render(t): everything from the schedule ---------- */
  function render() {
    var S = MODES[st.mode], t = st.t;
    var TV = st.view === 'thread', mr = st.me[0], mc = st.me[1];
    var seg = null;
    S.pov[mr * T + mc].forEach(function (g) { if (t >= g[0]) seg = g; });
    var dA = [], dB = [], i, r, c, k;
    for (r = 0; r < T; r++) { dA.push([0, 0, 0, 0, 0, 0, 0, 0]); }
    for (k = 0; k < K; k++) dB.push([0, 0, 0, 0]);
    var slotA = {}, slotB = {}, loads = 0, shared = 0, dot = 0, myLoads = 0, myShared = 0;

    for (i = 0; i < S.flights.length; i++) {
      var f = S.flights[i];
      var mine = f.who[0] === mr && f.who[1] === mc;
      if (t >= f.t1) {
        var L = f.land;
        if (mine) { if (L.dram) myLoads++; if (L.shared) myShared++; }
        if (L.dram) { loads++; if (L.dram[0] === 'a') dA[L.dram[1]][L.dram[2]]++; else dB[L.dram[1]][L.dram[2]]++; }
        if (L.slot) (L.slot[0] === 'a' ? slotA : slotB)[L.slot[1] * T + L.slot[2]] = f.t1;
        if (L.shared) shared++;
      } else if (t >= f.t0 && dot < N.dots.length) {
        var u = ease((t - f.t0) / (f.t1 - f.t0)), a = f.from(), b = f.to();
        var bulge = L0(f) * Math.sin(Math.PI * u);
        var d = N.dots[dot++];
        d.setAttribute('cx', (a[0] + (b[0] - a[0]) * u).toFixed(1));
        d.setAttribute('cy', (a[1] + (b[1] - a[1]) * u - bulge).toFixed(1));
        d.setAttribute('class', 'ta-pk ' + f.kind + (TV && !mine ? ' dim' : ''));
        d.setAttribute('visibility', 'visible');
      }
    }
    for (; dot < N.dots.length; dot++) N.dots[dot].setAttribute('visibility', 'hidden');

    // DRAM heat: count of fetches per element
    for (r = 0; r < T; r++) for (k = 0; k < K; k++) paint(N.dA[r][k], dA[r][k], 'a');
    for (k = 0; k < K; k++) for (c = 0; c < T; c++) paint(N.dB[k][c], dB[k][c], 'b');
    function paint(cl, n, kind) {
      if (cl.n === n) return;
      cl.n = n;
      cl.r.setAttribute('class', 'ta-cell ' + kind + (n ? ' n' + Math.min(n, 4) : ''));
      cl.t.textContent = n ? n : '';
    }

    // shared slots: hold the last tile written; flash right after a write
    for (r = 0; r < T; r++) for (c = 0; c < T; c++) {
      var ta = slotA[r * T + c], tb = slotB[r * T + c];
      N.sA[r][c].setAttribute('class', 'ta-slot a' + (ta != null ? ' full' : '') + (ta != null && t - ta < .25 ? ' fresh' : ''));
      N.sB[r][c].setAttribute('class', 'ta-slot b' + (tb != null ? ' full' : '') + (tb != null && t - tb < .25 ? ' fresh' : ''));
      var myslot = TV && st.mode === 'tiled' && r === mr && c === mc;
      if (myslot) { N.sA[r][c].classList.add('mine'); N.sB[r][c].classList.add('mine'); }
    }
    N.sh.setAttribute('class', 'ta-sh' + (st.mode === 'naive' ? ' idle' : ''));
    N.shIdle.style.display = st.mode === 'naive' ? '' : 'none';

    // FMAs: accumulator height = FMAs done so far; outline flashes at each FMA
    var accN = {}, hot = {}, fmas = 0;
    S.fmas.forEach(function (e) {
      if (t >= e[0]) { fmas++; var key = e[1] * T + e[2]; accN[key] = (accN[key] || 0) + 1; if (t - e[0] < .28) hot[key] = 1; }
    });
    for (r = 0; r < T; r++) for (c = 0; c < T; c++) {
      var th = N.th[r][c], n = accN[r * T + c] || 0, h = (G.ts - 10) * n / K;
      th.acc.setAttribute('y', (th.y + G.ts - 5 - h).toFixed(1));
      th.acc.setAttribute('height', h.toFixed(1));
      th.box.setAttribute('class', 'ta-th' + (hot[r * T + c] ? ' hot' : '') + (TV ? (r === mr && c === mc ? ' me' : ' other') : ''));
    }

    // highlights: which part of A and B is in play, which shared row/column is being read
    var hA = null, hS = null;
    S.marks.forEach(function (m) { if (t >= m.t0 && t < m.t1) { if (m.aCols) hA = m; if (m.sCol != null) hS = m; } });
    if (TV) {
      hA = hS = null; hide(N.hiA); hide(N.hiB); hide(N.hiS); hide(N.hiS2);
      if (seg && seg[3] === 'nload') { box(N.hiA, G.A[0] + seg[2].k * G.cs, G.A[1] + mr * G.cs, G.cs, G.cs); box(N.hiB, G.B[0] + mc * G.cs, G.B[1] + seg[2].k * G.cs, G.cs, G.cs); }
      if (seg && seg[3] === 'tload') { box(N.hiA, G.A[0] + (seg[2].t * T + mc) * G.cs, G.A[1] + mr * G.cs, G.cs, G.cs); box(N.hiB, G.B[0] + mc * G.cs, G.B[1] + (seg[2].t * T + mr) * G.cs, G.cs, G.cs); }
      if (seg && seg[3] === 'tread') { box(N.hiS, G.As[0] + seg[2].k * G.ss, G.As[1] + mr * G.ss, G.ss, G.ss); box(N.hiS2, G.Bs[0] + mc * G.ss, G.Bs[1] + seg[2].k * G.ss, G.ss, G.ss); }
    } else if (hA && t < S.end) {
      box(N.hiA, G.A[0] + hA.aCols[0] * G.cs, G.A[1], (hA.aCols[1] - hA.aCols[0]) * G.cs, T * G.cs);
      box(N.hiB, G.B[0], G.B[1] + hA.bRows[0] * G.cs, T * G.cs, (hA.bRows[1] - hA.bRows[0]) * G.cs);
    } else { hide(N.hiA); hide(N.hiB); }
    if (hS && !TV) {
      box(N.hiS, G.As[0] + hS.sCol * G.ss, G.As[1], G.ss, T * G.ss);
      box(N.hiS2, G.Bs[0], G.Bs[1] + hS.sCol * G.ss, T * G.ss, G.ss);
    } else if (!TV) { hide(N.hiS); hide(N.hiS2); }
    function box(e, x, y, w, h) { e.setAttribute('x', x - 1.5); e.setAttribute('y', y - 1.5); e.setAttribute('width', w + 3); e.setAttribute('height', h + 3); e.setAttribute('visibility', 'visible'); }
    function hide(e) { e.setAttribute('visibility', 'hidden'); }

    // barrier
    var br = null;
    S.bars.forEach(function (b) { if (t >= b[0] && t < b[1]) br = b; });
    N.bar.style.opacity = br ? 1 : 0;
    if (br) N.barT.textContent = '__syncthreads(): ' + (br[2] === 'raw' ? 'writes done, reads may start' : 'reads done, writes may start');

    // numbers
    vLoads.textContent = loads;
    vShared.textContent = shared;
    vFma.textContent = fmas;
    vInt.textContent = loads ? (2 * fmas / (4 * loads)).toFixed(2) : '—';

    var ci = 0;
    for (i = 0; i < S.caps.length; i++) if (t >= S.caps[i][0]) ci = i;
    if (ci !== N.capIdx || cap.dataset.mode !== st.mode) { cap.textContent = S.caps[ci][1]; N.capIdx = ci; cap.dataset.mode = st.mode; }
    cap.className = 'w-verdict ta-cap ' + (t >= S.end ? (st.mode === 'naive' ? 'mem' : 'comp') : '');

    tBlock.setAttribute('aria-selected', String(!TV)); tThread.setAttribute('aria-selected', String(TV));
    tBlock.tabIndex = TV ? -1 : 0; tThread.tabIndex = TV ? 0 : -1;
    paneBlock.hidden = TV; paneThread.hidden = !TV;
    if (TV) {
      if (codeFor !== st.mode) {
        codeBox.innerHTML = ''; codeLines = [];
        S.code.forEach(function (line) { var sp = el('span', 'ta-ln', line); codeBox.appendChild(sp); codeLines.push(sp); });
        codeFor = st.mode;
      }
      var lit = seg ? seg[1] : [];
      codeLines.forEach(function (sp, j) { sp.className = 'ta-ln' + (lit.indexOf(j) >= 0 ? ' on' : ''); });
      var v = seg ? seg[2] : {}, myN = accN[mr * T + mc] || 0;
      var rows = [['tx, ty', mc + ', ' + mr], ['row, col', mr + ', ' + mc]];
      if (st.mode === 'tiled') rows.push(['t', v.t != null ? v.t : '—']);
      rows.push(['k', v.k != null ? v.k : '—'], ['acc', accText(myN, mr, mc)], ['terms done', myN + ' of 8'], ['my DRAM loads', myLoads], ['my shared reads', st.mode === 'tiled' ? myShared : '— (none)']);
      varsBox.innerHTML = '';
      rows.forEach(function (rw) { varsBox.appendChild(el('dt', null, rw[0])); varsBox.appendChild(el('dd', null, String(rw[1]))); });
      var txt = seg ? story(seg[3], seg[2], mr, mc).replace(/\]\[/g, ']\u2060[') : '';   // keep As[1][2] on one line
      if (said.textContent !== txt) said.textContent = txt;
    }

    scrub.max = S.total; scrub.value = t;
    bPlay.textContent = st.playing ? '❚❚ Pause' : (t >= S.total ? '↻ Replay' : '▶ Play');
    bNaive.setAttribute('aria-pressed', String(st.mode === 'naive'));
    bTiled.setAttribute('aria-pressed', String(st.mode === 'tiled'));
  }
  // DRAM trips arc higher than the short hops inside the SM
  function L0(f) { return f.land.shared ? 6 : 26; }

  /* ---------- playback ---------- */
  function frame(now) {
    if (!st.playing) return;
    var dt = Math.min(.1, (now - st.last) / 1000); st.last = now;
    st.t = Math.min(MODES[st.mode].total, st.t + dt);
    if (st.t >= MODES[st.mode].total) st.playing = false;
    render();
    if (st.playing) requestAnimationFrame(frame);
  }
  function play() {
    if (st.t >= MODES[st.mode].total) st.t = 0;
    st.playing = true; st.started = true; st.last = performance.now();
    requestAnimationFrame(frame); render();
  }
  function pause() { st.playing = false; render(); }
  function setMode(m) { st.mode = m; st.t = 0; N.capIdx = -1; if (reduced) { st.playing = false; render(); } else play(); }

  bNaive.addEventListener('click', function () { setMode('naive'); });
  bTiled.addEventListener('click', function () { setMode('tiled'); });
  bPlay.addEventListener('click', function () { st.playing ? pause() : play(); });
  tBlock.addEventListener('click', function () { setView('block'); });
  tThread.addEventListener('click', function () { setView('thread'); });
  tabs.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    var v = st.view === 'block' ? 'thread' : 'block'; setView(v); (v === 'block' ? tBlock : tThread).focus(); e.preventDefault();
  });
  sel.addEventListener('change', function () { follow(+sel.value / T | 0, +sel.value % T); });
  scrub.addEventListener('input', function () { st.playing = false; st.t = +scrub.value; render(); });

  // layout follows the widget's width
  function layoutFor() { return host.clientWidth < 540 ? 'tall' : 'wide'; }
  build(layoutFor());
  render();
  if (window.ResizeObserver) new ResizeObserver(function () { var p = layoutFor(); if (p !== G.name) { build(p); render(); } }).observe(host);

  // start once, the first time it scrolls into view (never with reduced motion)
  if (!reduced && window.IntersectionObserver) {
    var io = new IntersectionObserver(function (es) {
      if (es[0].isIntersecting && !st.started) { play(); io.disconnect(); }
    }, { threshold: .6 });
    io.observe(stage);
  }
})();
