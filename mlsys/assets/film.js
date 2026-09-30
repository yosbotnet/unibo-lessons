/* film.js — "Life of a launch": the CUDA execution model as a scrubbable film.
   Every scene is a pure function of its local time t (seconds), so the
   player can seek anywhere: build(g) creates the SVG once when the scene is
   entered, draw(state, t) positions everything for time t.
   Numbers follow the RTX 5070 (sm_120): 48 SMs, 1,536 threads per SM. */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var svg = document.getElementById('film-svg');
  if (!svg) return;

  /* ------------------------------------------------------------ helpers */
  var C = {
    paper: 'var(--lk-paper)', light: 'var(--lk-paper-light)', ink: 'var(--lk-ink)',
    soft: 'var(--lk-ink-soft)', cob: 'var(--lk-cobalt)', cobd: 'var(--lk-cobalt-dark)',
    ver: 'var(--lk-vermilion)', forest: 'var(--lk-forest)', rule: 'var(--lk-rule)',
    rules: 'var(--lk-rule-soft)', hl: 'var(--lk-hl)', ok: 'var(--lk-okbg)', warn: 'var(--lk-warnbg)'
  };
  var TINT = [C.hl, C.ok, C.warn, C.light];
  var F = { mono: 'var(--lk-mono)', serif: 'var(--lk-font)', disp: 'var(--lk-display)', ui: 'var(--lk-utility)' };

  function el(tag, a, p) {
    var e = document.createElementNS(NS, tag);
    if (a) for (var k in a) e.setAttribute(k, a[k]);
    if (p) p.appendChild(e);
    return e;
  }
  function tx(p, x, y, s, o) {
    o = o || {};
    var e = el('text', {
      x: x, y: y, 'font-size': o.size || 18, fill: o.fill || C.ink,
      'text-anchor': o.anchor || 'start', 'font-family': o.family || F.mono,
      'font-weight': o.weight || 400
    }, p);
    e.style.whiteSpace = 'pre';
    if (o.ls) e.setAttribute('letter-spacing', o.ls);
    if (o.italic) e.setAttribute('font-style', 'italic');
    e.textContent = s;
    return e;
  }
  function clamp(x, a, b) { a = a == null ? 0 : a; b = b == null ? 1 : b; return Math.max(a, Math.min(b, x)); }
  function ease(u) { u = clamp(u); return u * u * (3 - 2 * u); }
  function seg(t, a, b) { return ease((t - a) / (b - a)); }
  function lin(t, a, b) { return clamp((t - a) / (b - a)); }
  function lerp(a, b, u) { return a + (b - a) * u; }
  function op(e, v) { e.setAttribute('opacity', v <= 0 ? 0 : v >= 1 ? 1 : v.toFixed(3)); }
  function vis(e, on) { e.style.display = on ? '' : 'none'; }
  function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function fmt(n) { return n.toLocaleString('en-US'); }
  function typed(full, u) { return full.slice(0, Math.round(full.length * clamp(u))); }

  /* ------------------------------------------------------------ scenes */
  var scenes = [];

  /* 0 · Title --------------------------------------------------------- */
  scenes.push({
    plate: null, title: 'Title', dur: 9,
    cues: [[0, 'A film in eight scenes: one kernel launch on your RTX 5070, followed from a line of C++ on the CPU down to a single lane of a single warp, and back. Press play, or use the scene buttons to jump.']],
    build: function (g) {
      var s = {};
      s.rule1 = el('line', { x1: 240, y1: 232, x2: 1040, y2: 232, stroke: C.cob, 'stroke-width': 1.5 }, g);
      s.kick = tx(g, 640, 214, 'ML SYSTEMS & GPU PERFORMANCE · PART I · FILM', { size: 16, anchor: 'middle', fill: C.ver, family: F.ui, weight: 700, ls: 3 });
      s.title = tx(g, 640, 330, 'LIFE OF A LAUNCH', { size: 104, anchor: 'middle', fill: C.cob, family: F.disp, weight: 700 });
      s.sub = tx(g, 640, 392, 'The CUDA execution model, followed through one thread', { size: 30, anchor: 'middle', family: F.serif, italic: true });
      s.meta = tx(g, 640, 450, 'RTX 5070 · 48 SMs · compute capability 12.0', { size: 18, anchor: 'middle', fill: C.soft });
      s.dots = [];
      for (var l = 0; l < 32; l++) {
        s.dots.push(el('circle', { cx: 392 + l * 16, cy: 540, r: l === 2 ? 7 : 5, fill: l === 2 ? C.ver : C.cob }, g));
      }
      s.star = tx(g, 640, 590, 'starring lane 2 of warp 4 of block 10', { size: 18, anchor: 'middle', fill: C.ver });
      s.rule2 = el('line', { x1: 240, y1: 620, x2: 1040, y2: 620, stroke: C.cob, 'stroke-width': 1.5 }, g);
      return s;
    },
    draw: function (s, t) {
      op(s.kick, seg(t, 0.2, 1.2)); op(s.rule1, seg(t, 0, 1)); op(s.rule2, seg(t, 0, 1));
      op(s.title, seg(t, 0.6, 2)); op(s.sub, seg(t, 1.6, 3)); op(s.meta, seg(t, 2.4, 3.6));
      s.dots.forEach(function (d, l) { op(d, seg(t, 3.4 + l * 0.06, 3.8 + l * 0.06)); });
      op(s.star, seg(t, 5.8, 6.8));
    }
  });

  /* 1 · The launch ---------------------------------------------------- */
  scenes.push({
    plate: ['I', 'THE LAUNCH'], title: 'Launch', dur: 28,
    cues: [
      [0, 'It starts on the CPU, the <em>host</em>. The inputs are copied into the GPU&rsquo;s memory once; from then on they live in VRAM.'],
      [6, 'Then the launch: <code>vecadd&lt;&lt;&lt;1024, 256&gt;&gt;&gt;</code> asks for 1,024 blocks of 256 threads. That is 262,144 threads, one per element.'],
      [10, 'The launch doesn&rsquo;t run anything on the CPU. It drops a request into the GPU&rsquo;s queue and returns within microseconds, and the CPU is free to prepare the next batch.'],
      [16, 'Only asking for the result waits: the copy back blocks until the kernel has finished. Then the answer crosses the bus.'],
      [23, 'Everything in the rest of this film happens inside that green bar.']
    ],
    build: function (g) {
      var s = {};
      el('rect', { x: 60, y: 110, width: 520, height: 480, rx: 4, fill: C.light, stroke: C.cob, 'stroke-width': 2 }, g);
      tx(g, 84, 148, 'CPU · host', { size: 22, weight: 700, fill: C.cobd });
      var L = ['cudaMemcpy(d_a, a, bytes, H2D);', 'vecadd<<<1024, 256>>>(d_a, d_b, d_c, n);',
               'prepare_next_batch();', 'cudaMemcpy(c, d_c, bytes, D2H);'];
      s.lines = L.map(function (full, k) { return { full: full, e: tx(g, 108, 214 + k * 58, '', { size: 18 }) }; });
      s.cursor = el('path', { d: 'M0 -8 L12 0 L0 8 Z', fill: C.ver }, g);
      s.statusBox = el('rect', { x: 84, y: 520, width: 472, height: 46, rx: 3, fill: C.paper, stroke: C.rules }, g);
      s.status = tx(g, 100, 550, '', { size: 18, weight: 700 });

      el('rect', { x: 760, y: 110, width: 460, height: 480, rx: 4, fill: C.light, stroke: C.forest, 'stroke-width': 2 }, g);
      tx(g, 784, 148, 'GPU · device', { size: 22, weight: 700, fill: C.forest });
      el('rect', { x: 784, y: 170, width: 412, height: 56, fill: C.paper, stroke: C.rule, 'stroke-dasharray': '5 4' }, g);
      tx(g, 796, 204, 'work queue', { size: 15, fill: C.soft });
      el('rect', { x: 784, y: 250, width: 412, height: 140, fill: C.paper, stroke: C.forest }, g);
      tx(g, 800, 282, '48 SMs', { size: 17, weight: 700, fill: C.forest });
      s.gstat = tx(g, 800, 316, 'idle', { size: 17 });
      el('rect', { x: 800, y: 340, width: 380, height: 22, fill: C.light, stroke: C.rules }, g);
      s.bar = el('rect', { x: 800, y: 340, width: 0, height: 22, fill: C.forest }, g);
      s.barLbl = tx(g, 990, 380, '', { size: 14, anchor: 'middle', fill: C.soft });
      el('rect', { x: 784, y: 414, width: 412, height: 150, fill: C.paper, stroke: C.cob }, g);
      tx(g, 800, 444, 'VRAM · 12 GB · 672 GB/s', { size: 16, weight: 700, fill: C.cobd });
      s.va = [['a', 810], ['b', 910], ['c', 1010]].map(function (p) {
        var gg = el('g', {}, g);
        el('rect', { x: p[1], y: 470, width: 80, height: 60, fill: C.hl, stroke: C.cob }, gg);
        tx(gg, p[1] + 40, 508, p[0], { size: 24, anchor: 'middle', weight: 700, fill: C.cobd });
        return gg;
      });

      el('line', { x1: 580, y1: 350, x2: 760, y2: 350, stroke: C.rule, 'stroke-width': 8 }, g);
      tx(g, 670, 392, 'PCIe 5.0 ×16', { size: 14, anchor: 'middle', fill: C.soft });
      tx(g, 670, 410, '≈ 64 GB/s', { size: 14, anchor: 'middle', fill: C.soft });
      s.pkt = el('g', {}, g);
      el('rect', { x: -38, y: -15, width: 76, height: 30, rx: 3, fill: C.cob }, s.pkt);
      s.pktT = tx(s.pkt, 0, 6, 'a, b', { size: 15, anchor: 'middle', fill: C.paper, weight: 700 });
      s.launch = el('g', {}, g);
      el('rect', { x: -86, y: -17, width: 172, height: 34, rx: 3, fill: C.paper, stroke: C.ver, 'stroke-width': 2 }, s.launch);
      tx(s.launch, 0, 6, 'vecadd · 1024×256', { size: 15, anchor: 'middle', fill: C.ver, weight: 700 });
      return s;
    },
    draw: function (s, t) {
      var spans = [[0.5, 3], [6, 9], [10.2, 11.6], [15, 17]];
      s.lines.forEach(function (l, k) { l.e.textContent = typed(l.full, lin(t, spans[k][0], spans[k][1])); });
      var line = t < 6 ? 0 : t < 10 ? 1 : t < 15 ? 2 : 3;
      s.cursor.setAttribute('transform', 'translate(88 ' + (208 + line * 58) + ')');

      var st, col;
      if (t < 4) { st = 'copying inputs → GPU'; col = C.cob; }
      else if (t < 6) { st = ''; col = C.ink; }
      else if (t < 10) { st = 'launching…'; col = C.cob; }
      else if (t < 17) { st = 'FREE · preparing the next batch'; col = C.forest; }
      else if (t < 21.8) { st = 'WAITING for the GPU'; col = C.ver; }
      else { st = 'result received ✓'; col = C.forest; }
      s.status.textContent = st; s.status.setAttribute('fill', col);
      s.statusBox.setAttribute('fill', t >= 17 && t < 21.8 ? C.warn : C.paper);

      // data in, t 1 .. 3.6
      var inU = lin(t, 1, 3.6), outU = lin(t, 19.3, 21.8);
      function busPath(u, x2, y2) {           // CPU edge -> bus -> VRAM slot
        if (u < 0.6) return [lerp(540, 770, u / 0.6), 350];
        var v = (u - 0.6) / 0.4; return [lerp(770, x2, v), lerp(350, y2, v)];
      }
      var P = null;
      if (t >= 1 && t < 3.6) { s.pktT.textContent = 'a, b'; P = busPath(ease(inU), 900, 500); }
      else if (t >= 19.3 && t < 21.8) { s.pktT.textContent = 'c'; P = busPath(1 - ease(outU), 1050, 500); }
      vis(s.pkt, !!P);
      if (P) s.pkt.setAttribute('transform', 'translate(' + P[0].toFixed(1) + ' ' + P[1].toFixed(1) + ')');
      op(s.va[0], seg(t, 3.4, 3.9)); op(s.va[1], seg(t, 3.4, 3.9)); op(s.va[2], seg(t, 18.6, 19.2));

      // launch packet: to the queue, then into the SMs
      if (t < 9) vis(s.launch, 0);
      else {
        vis(s.launch, 1);
        var x, y, u1 = seg(t, 9, 10), u2 = seg(t, 10.3, 10.9);
        x = lerp(560, 990, u1); y = lerp(300, 198, u1);
        y = lerp(y, 290, u2);
        s.launch.setAttribute('transform', 'translate(' + x + ' ' + y + ')');
        op(s.launch, 1 - seg(t, 10.7, 11));
      }
      var run = lin(t, 10.9, 19);
      s.bar.setAttribute('width', (380 * run).toFixed(1));
      s.gstat.textContent = t < 10.9 ? 'idle' : t < 19 ? 'running vecadd' : 'done ✓';
      s.barLbl.textContent = t < 10.9 ? '' : t < 19 ? fmt(Math.floor(1024 * run)) + ' / 1,024 blocks' : '1,024 / 1,024 blocks';
    }
  });

  /* 2 · The grid ------------------------------------------------------ */
  var PROT = { block: 10, tid: 130, warp: 4, lane: 2, i: 2690 };
  scenes.push({
    plate: ['II', 'THE GRID, THE BLOCK, THE WARP'], title: 'Grid', dur: 44,
    cues: [
      [0, 'The grid: 1,024 blocks, all the same shape. The hardware promises nothing about the order they will run in.'],
      [6, 'Zoom into block 10. It holds 256 threads, numbered by <code>threadIdx.x</code> from 0 to 255. The same numbers are reused in every block.'],
      [18, 'The hardware cuts the block into <strong>warps</strong>: consecutive runs of 32 threads, so eight warps here. You never declare them, and the size is always 32.'],
      [26, 'Meet our thread: block 10, <code>threadIdx.x</code> 130. That is warp 130 / 32 = 4, lane 130 % 32 = 2, and element 10 × 256 + 130 = 2,690 of the array.'],
      [35, 'Its 31 warp-mates share its <code>blockIdx</code> and its warp number, and differ in <code>threadIdx</code>, lane and element. (A 2D block is flattened x-first before the cut.)']
    ],
    build: function (g) {
      var s = { cells: [], dots: [], bands: [], wl: [], il: [], cuts: [] };
      tx(g, 80, 118, 'grid · gridDim.x = 1,024 blocks (32 per row here)', { size: 16, fill: C.soft });
      for (var b = 0; b < 1024; b++) {
        var cx = 80 + (b % 32) * 14, cy = 130 + Math.floor(b / 32) * 14;
        s.cells.push(el('rect', { x: cx, y: cy, width: 12, height: 12, fill: C.hl, stroke: C.cob, 'stroke-width': 0.6 }, g));
      }
      s.z1 = el('line', { x1: 232, y1: 130, x2: 650, y2: 150, stroke: C.ver, 'stroke-width': 1, 'stroke-dasharray': '4 3' }, g);
      s.z2 = el('line', { x1: 232, y1: 142, x2: 650, y2: 640, stroke: C.ver, 'stroke-width': 1, 'stroke-dasharray': '4 3' }, g);
      s.panel = el('rect', { x: 650, y: 150, width: 580, height: 490, rx: 3, fill: C.light, stroke: C.ver, 'stroke-width': 1.5 }, g);
      s.plab = tx(g, 670, 184, 'block 10 · 256 threads · threadIdx.x = 0 … 255', { size: 16, weight: 700, fill: C.cobd });
      for (var w = 0; w < 8; w++) {
        s.bands.push(el('rect', { x: 680, y: 0, width: 522, height: 22, rx: 2, fill: TINT[w % 4], stroke: C.cob, 'stroke-width': 0 }, g));
        s.wl.push(tx(g, 1204, 0, 'w' + w, { size: 14, weight: 700, fill: C.cobd }));
        s.il.push(tx(g, 676, 0, String(w * 32), { size: 12, anchor: 'end', fill: C.soft }));
        if (w) s.cuts.push(el('line', { x1: 670, x2: 1226, y1: 0, y2: 0, stroke: C.ver, 'stroke-width': 1.3, 'stroke-dasharray': '6 4' }, g));
      }
      for (var k = 0; k < 256; k++) s.dots.push(el('circle', { cx: 694 + (k % 32) * 16, cy: 0, r: 5, fill: C.cob }, g));
      s.cbox = el('rect', { x: 80, y: 596, width: 540, height: 84, rx: 3, fill: C.paper, stroke: C.ver, 'stroke-width': 1.5 }, g);
      s.c1 = tx(g, 96, 628, '', { size: 16 }); s.c2 = tx(g, 96, 660, '', { size: 16 });
      return s;
    },
    draw: function (s, t) {
      var cut = seg(t, 18, 21);
      function rowY(r) { return 212 + r * lerp(22, 52, cut); }
      s.cells.forEach(function (c, b) {
        op(c, seg(t, 0.2 + b / 1024 * 3.5, 0.6 + b / 1024 * 3.5));
        c.setAttribute('fill', b === PROT.block && t >= 5 ? C.ver : C.hl);
      });
      var z = seg(t, 6, 7.5);
      op(s.z1, z); op(s.z2, z); op(s.panel, z); op(s.plab, seg(t, 7, 8));
      s.dots.forEach(function (d, k) {
        var r = Math.floor(k / 32);
        d.setAttribute('cy', rowY(r).toFixed(1));
        op(d, seg(t, 10 + k / 256 * 5, 10.3 + k / 256 * 5));
        var me = k === PROT.tid && t >= 26;
        d.setAttribute('r', me ? 9 : 5);
        d.setAttribute('fill', me ? C.ver : C.cob);
      });
      var hiW = t >= 35;
      s.bands.forEach(function (b, w) {
        b.setAttribute('y', (rowY(w) - 11).toFixed(1));
        op(b, seg(t, 19, 21));
        b.setAttribute('stroke-width', hiW && w === PROT.warp ? 2.5 : 0);
      });
      s.wl.forEach(function (l, w) { l.setAttribute('y', (rowY(w) + 5).toFixed(1)); op(l, seg(t, 20, 22)); });
      s.il.forEach(function (l, w) { l.setAttribute('y', (rowY(w) + 4).toFixed(1)); op(l, seg(t, 10 + w * 32 / 256 * 5, 10.4 + w * 32 / 256 * 5)); });
      s.cuts.forEach(function (c, i) {
        var y = ((rowY(i) + rowY(i + 1)) / 2).toFixed(1);
        c.setAttribute('y1', y); c.setAttribute('y2', y);
        op(c, seg(t, 18, 19) * (1 - seg(t, 24, 25)));
      });
      op(s.cbox, seg(t, 26, 27)); op(s.c1, seg(t, 26.5, 27.5)); op(s.c2, seg(t, 27, 28));
      if (t < 35) {
        s.c1.textContent = 'thread 2,690 = blockIdx 10 × 256 + threadIdx 130';
        s.c2.textContent = 'warp = 130 / 32 = 4     lane = 130 % 32 = 2';
      } else {
        s.c1.textContent = 'same for all of warp 4: blockIdx.x = 10, warp 4';
        s.c2.textContent = 'per lane: threadIdx.x 128…159, i 2,688…2,719';
      }
    }
  });

  /* 3 · Placing blocks on SMs ---------------------------------------- */
  // Each SM fits 6 blocks of 256 threads (1,536-thread limit). Slot s of 288
  // is SM s % 48, position floor(s / 48). A slot is refilled 0.4 s after its
  // block finishes, so waves drift apart just as they do on real hardware.
  var DIST = (function () {
    var A = [], L = [];
    for (var b = 0; b < 1024; b++) {
      var sl = b % 288;
      A[b] = b < 288 ? 4 + (sl / 288) * 3 : L[b - 288] + 0.4;
      L[b] = A[b] + 5.6 + 1.6 * hash(b);
    }
    var last = [];
    for (var sl2 = 0; sl2 < 288; sl2++) { var bb = sl2; while (bb + 288 < 1024) bb += 288; last[sl2] = L[bb]; }
    return { A: A, L: L, last: last, end: Math.max.apply(null, L) };
  })();
  function smXY(sm) { return [382 + (sm % 8) * 106, 130 + Math.floor(sm / 8) * 82]; }
  function slotXY(sl) {
    var sm = sl % 48, p = Math.floor(sl / 48), xy = smXY(sm);
    return [xy[0] + 12 + (p % 3) * 26, xy[1] + 22 + Math.floor(p / 3) * 26];
  }
  var MOUTH = [330, 318];
  function buildDie(g) {
    var s = { blocks: [], pile: [], idle: [] };
    tx(g, 382, 118, 'GPU · 48 SMs · 6 block slots each for this kernel', { size: 16, fill: C.soft });
    for (var sm = 0; sm < 48; sm++) {
      var xy = smXY(sm);
      el('rect', { x: xy[0], y: xy[1], width: 98, height: 74, rx: 3, fill: C.light, stroke: sm === 10 ? C.ver : C.forest, 'stroke-width': sm === 10 ? 2 : 1.2 }, g);
      tx(g, xy[0] + 5, xy[1] + 14, 'SM ' + sm, { size: 10, fill: C.soft });
    }
    for (var sl = 0; sl < 288; sl++) {
      var p = slotXY(sl);
      el('rect', { x: p[0], y: p[1], width: 22, height: 22, fill: 'none', stroke: C.rules }, g);
      s.idle.push(el('rect', { x: p[0] + 1, y: p[1] + 1, width: 20, height: 20, fill: 'none', stroke: C.ver, 'stroke-width': 1.4, 'stroke-dasharray': '3 2' }, g));
    }
    el('rect', { x: 60, y: 130, width: 270, height: 376, rx: 3, fill: C.light, stroke: C.rule, 'stroke-dasharray': '6 4' }, g);
    tx(g, 76, 118, 'queue of waiting blocks', { size: 16, fill: C.soft });
    for (var k = 0; k < 140; k++) {
      s.pile.push(el('rect', { x: 76 + (k % 10) * 24, y: 146 + Math.floor(k / 10) * 24, width: 20, height: 20, fill: C.hl, stroke: C.cob, 'stroke-width': 0.8 }, g));
    }
    s.more = tx(g, 195, 496, '', { size: 14, anchor: 'middle', fill: C.soft });
    s.cW = tx(g, 60, 552, '', { size: 18 }); s.cR = tx(g, 60, 582, '', { size: 18 }); s.cD = tx(g, 60, 612, '', { size: 18 });
    for (var b = 0; b < 1024; b++) {
      s.blocks.push(el('rect', { width: 22, height: 22, fill: b === PROT.block ? C.ver : C.cob, opacity: 0 }, g));
    }
    return s;
  }
  function drawDie(s, t) {
    var waiting = 0, resident = 0, done = 0;
    for (var b = 0; b < 1024; b++) {
      var e = s.blocks[b], A = DIST.A[b], L = DIST.L[b];
      if (t < A - 1) { waiting++; vis(e, 0); continue; }
      vis(e, 1);
      var p = slotXY(b % 288);
      if (t < A) {
        var u = ease(t - (A - 1));
        e.setAttribute('x', lerp(MOUTH[0], p[0], u).toFixed(1)); e.setAttribute('y', lerp(MOUTH[1], p[1], u).toFixed(1));
        op(e, 0.4 + 0.6 * u); resident++;
      } else if (t < L) {
        e.setAttribute('x', p[0]); e.setAttribute('y', p[1]); op(e, b === PROT.block ? 1 : 0.8); resident++;
      } else if (t < L + 0.5) {
        e.setAttribute('x', p[0]); e.setAttribute('y', p[1]); op(e, 0.8 * (1 - (t - L) / 0.5)); done++;
      } else { vis(e, 0); done++; }
    }
    s.pile.forEach(function (e, k) { vis(e, k < waiting); });
    s.more.textContent = waiting > 140 ? '+ ' + fmt(waiting - 140) + ' more' : '';
    s.cW.textContent = 'waiting   ' + fmt(waiting);
    s.cR.textContent = 'resident  ' + fmt(resident);
    s.cD.textContent = 'finished  ' + fmt(done);
    s.cR.setAttribute('fill', C.cobd);
    var anyBusy = t < DIST.end;
    s.idle.forEach(function (e, sl) { vis(e, anyBusy && t > DIST.last[sl] + 0.5); });
  }
  scenes.push({
    plate: ['III', 'PLACE: BLOCKS ONTO SMs'], title: 'Place', dur: 50,
    cues: [
      [0, 'Now the GPU: 48 streaming multiprocessors. A distributor hands out whole blocks, each to exactly one SM, as long as that SM has room.'],
      [5, '&ldquo;Room&rdquo; means four budgets: thread slots, block slots, registers, shared memory. For this kernel thread slots run out first: 6 blocks × 256 threads = 1,536, the SM&rsquo;s maximum.'],
      [12, '48 SMs × 6 = 288 blocks resident at once. Block 10 lands on SM 10. The other 736 wait.'],
      [18, 'Whenever a block finishes, its slot is refilled from the queue. Nobody waits for anybody: blocks are independent, so the order doesn&rsquo;t matter.'],
      [30, 'The last wave is partial: 160 blocks for 288 slots. The dashed slots are the <em>tail</em>, idle while the rest finish. Launch many more blocks than fit, and the tail becomes a small fraction.'],
      [42, 'On a 170-SM GPU the same binary would hold 1,020 blocks at once and finish in about one wave. That&rsquo;s transparent scalability, and it only works because blocks never wait for each other.']
    ],
    build: function (g) { var s = buildDie(g); s.note = el('g', {}, g);
      el('rect', { x: 400, y: 560, width: 810, height: 80, rx: 3, fill: C.paper, stroke: C.cob, 'stroke-width': 1.5 }, s.note);
      tx(s.note, 420, 594, 'Same kernel, 170 SMs × 6 slots = 1,020 blocks resident:', { size: 18 });
      tx(s.note, 420, 624, '1,024 blocks ≈ 1 wave instead of 3.6. No code change.', { size: 18, fill: C.cobd, weight: 700 });
      return s; },
    draw: function (s, t) { drawDie(s, t); op(s.note, seg(t, 42.5, 43.5)); }
  });

  /* 4 · Inside the SM ------------------------------------------------- */
  var SM10 = [10, 58, 106, 154, 202, 250];         // blocks resident on SM 10 in wave 0
  function qRow(q, r) { return { j: Math.floor(r / 2), w: q + 4 * (r % 2) }; }
  scenes.push({
    plate: ['IV', 'INSIDE SM 10'], title: 'SM', dur: 34,
    cues: [
      [0, 'Inside SM 10: four quadrants, each with its own warp scheduler, a quarter of the register file and 32 lanes. All four share 128 KB of L1 cache and shared memory.'],
      [3, 'As each block arrives, its eight warps are dealt round-robin to the four schedulers: warps 0 and 4 to quadrant 0, warps 1 and 5 to quadrant 1, and so on.'],
      [14, 'Six blocks later: 48 warps, 12 per scheduler. Look at the budgets. Threads are full, while registers and shared memory are mostly free. The tightest budget sets the occupancy.'],
      [26, 'Our warp, block 10&rsquo;s warp 4, lives in quadrant 0. Its registers stay in that quadrant&rsquo;s register file for its whole life, which is why switching to it costs nothing.']
    ],
    build: function (g) {
      var s = { rows: [], gauges: [] };
      el('rect', { x: 48, y: 100, width: 852, height: 540, rx: 4, fill: C.paper, stroke: C.ver, 'stroke-width': 2 }, g);
      for (var q = 0; q < 4; q++) {
        var x0 = 64 + q * 208;
        el('rect', { x: x0, y: 116, width: 196, height: 404, rx: 3, fill: C.light, stroke: C.cob }, g);
        el('rect', { x: x0 + 8, y: 124, width: 180, height: 32, fill: C.hl }, g);
        tx(g, x0 + 98, 146, 'scheduler Q' + q, { size: 15, anchor: 'middle', weight: 700, fill: C.cobd });
        for (var r = 0; r < 12; r++) {
          var y = 166 + r * 25, m = qRow(q, r);
          var row = el('g', {}, g);
          var rect = el('rect', { x: x0 + 8, y: y, width: 180, height: 21, rx: 2, fill: TINT[m.j % 4], stroke: C.rules }, row);
          tx(row, x0 + 16, y + 15, 'b' + SM10[m.j] + ' · w' + m.w, { size: 13 });
          s.rows.push({ g: row, rect: rect, j: m.j, w: m.w, q: q, r: r });
          el('rect', { x: x0 + 8, y: y, width: 180, height: 21, rx: 2, fill: 'none', stroke: C.rules, 'stroke-dasharray': '2 3' }, g);
        }
        for (var l = 0; l < 32; l++) el('rect', { x: x0 + 10 + l * 5.6, y: 474, width: 4, height: 18, fill: C.forest }, g);
        tx(g, x0 + 98, 510, '32 lanes · 64 KB registers', { size: 12, anchor: 'middle', fill: C.soft });
      }
      el('rect', { x: 64, y: 540, width: 820, height: 80, fill: C.light, stroke: C.cob, 'stroke-dasharray': '6 4' }, g);
      tx(g, 474, 586, 'L1 cache / shared memory · 128 KB · shared by all four quadrants', { size: 16, anchor: 'middle' });
      tx(g, 930, 130, 'SM 10 budgets', { size: 20, weight: 700, fill: C.cobd });
      var G = [['warps', 8, 48, ''], ['threads', 256, 1536, ''], ['blocks', 1, 24, ''], ['registers', 3072, 65536, ''], ['shared mem', 1, 100, ' KB']];
      G.forEach(function (d, k) {
        var y = 160 + k * 88;
        var lbl = tx(g, 930, y + 16, d[0], { size: 16, weight: 700 });
        el('rect', { x: 930, y: y + 26, width: 290, height: 18, fill: C.light, stroke: C.rules }, g);
        var bar = el('rect', { x: 930, y: y + 26, width: 0, height: 18, fill: C.cob }, g);
        var val = tx(g, 930, y + 66, '', { size: 14, fill: C.soft });
        s.gauges.push({ d: d, bar: bar, val: val, lbl: lbl });
      });
      s.limit = tx(g, 1220, 176 + 88, '← binding', { size: 14, anchor: 'end', fill: C.ver, weight: 700 });
      return s;
    },
    draw: function (s, t) {
      var arrived = 0;
      SM10.forEach(function (b, j) { if (t >= 2 + j * 1.8 + 0.8) arrived = j + 1; });
      s.rows.forEach(function (r) {
        var a = 2 + r.j * 1.8 + r.w * 0.09;
        op(r.g, seg(t, a, a + 0.35));
        var me = SM10[r.j] === PROT.block && r.w === PROT.warp && t >= 26;
        r.rect.setAttribute('stroke', me ? C.ver : C.rules);
        r.rect.setAttribute('stroke-width', me ? 3 : 1);
      });
      var full = t >= 14;
      s.gauges.forEach(function (g, k) {
        var used = g.d[1] * arrived, frac = used / g.d[2];
        g.bar.setAttribute('width', (290 * frac).toFixed(1));
        var bind = full && (k === 0 || k === 1);
        g.bar.setAttribute('fill', bind ? C.ver : C.cob);
        g.val.textContent = fmt(used) + g.d[3] + ' of ' + fmt(g.d[2]) + g.d[3] + '  (' + Math.round(frac * 100) + '%)';
      });
      op(s.limit, seg(t, 14, 15));
    }
  });

  /* 5 · The scheduler ------------------------------------------------- */
  // A tiny cycle-level model of one quadrant. Each warp loops 4 times over
  // LD a, LD b, ADD (needs both loads), ST (needs the add). Loads take 18
  // cycles (really several hundred), the add 4. Each cycle the scheduler
  // issues from the ready warp that issued least recently.
  function simulate(nw, cycles) {
    var LAT = { L: 18, A: 4 }, PROG = ['L', 'L', 'A', 'S'], ITER = 4;
    var W = [], grid = [], busy = 0;
    for (var w = 0; w < nw; w++) { W.push({ pc: 0, ra: 0, rb: 0, rs: 0, last: -1 - w }); grid.push([]); }
    for (var c = 0; c < cycles; c++) {
      var best = -1;
      for (w = 0; w < nw; w++) {
        var s = W[w];
        if (s.pc >= PROG.length * ITER) { grid[w][c] = 'D'; continue; }
        var op_ = PROG[s.pc % 4], ready = op_ === 'L' ? true : op_ === 'A' ? c >= s.ra && c >= s.rb : c >= s.rs;
        grid[w][c] = ready ? 'R' : 'W';
        if (ready && (best < 0 || W[w].last < W[best].last)) best = w;
      }
      if (best >= 0) {
        var S = W[best], o = PROG[S.pc % 4];
        if (o === 'L') { if (S.pc % 4 === 0) S.ra = c + LAT.L; else S.rb = c + LAT.L; }
        if (o === 'A') S.rs = c + LAT.A;
        grid[best][c] = 'I' + o; S.pc++; S.last = c; busy++;
      }
    }
    return { grid: grid, busy: busy };
  }
  var LABELS = []; for (var r0 = 0; r0 < 12; r0++) { var m0 = qRow(0, r0); LABELS.push('b' + SM10[m0.j] + '·w' + m0.w); }
  function buildTimeline(g, nw, cycles, y0, pitch) {
    var sim = simulate(nw, cycles), s = { cells: [], issue: [], sim: sim, nw: nw };
    for (var w = 0; w < nw; w++) {
      var mine = LABELS[w] === 'b10·w4';
      tx(g, 186, y0 + w * pitch + 17, LABELS[w], { size: 14, anchor: 'end', fill: mine ? C.ver : C.ink, weight: mine ? 700 : 400 });
      s.cells.push([]);
      for (var c = 0; c < cycles; c++) {
        var k = sim.grid[w][c], x = 200 + c * 14, y = y0 + w * pitch;
        if (k === 'D') { s.cells[w].push(null); continue; }
        var fill = k[0] === 'I' ? C.cob : k === 'W' ? C.warn : C.paper;
        var cg = el('g', {}, g);
        el('rect', { x: x, y: y, width: 12, height: 24, fill: fill, stroke: k === 'R' ? C.rules : 'none' }, cg);
        if (k[0] === 'I') tx(cg, x + 6, y + 16, k[1], { size: 10, anchor: 'middle', fill: C.paper, weight: 700 });
        s.cells[w].push(cg);
      }
    }
    var iy = y0 + nw * pitch + 22;
    tx(g, 186, iy + 17, 'issue slot', { size: 14, anchor: 'end', weight: 700 });
    for (var c2 = 0; c2 < cycles; c2++) {
      var any = false; for (var w2 = 0; w2 < nw; w2++) if (sim.grid[w2][c2][0] === 'I') any = true;
      s.issue.push(el('rect', { x: 200 + c2 * 14, y: iy, width: 12, height: 24, fill: any ? C.forest : C.paper, stroke: any ? 'none' : C.ver, 'stroke-width': 1.3 }, g));
    }
    s.util = tx(g, 200, iy + 58, '', { size: 18, weight: 700 });
    return s;
  }
  function drawTimeline(s, n, total) {
    for (var w = 0; w < s.nw; w++) for (var c = 0; c < total; c++) { var e = s.cells[w][c]; if (e) vis(e, c < n); }
    var busy = 0;
    s.issue.forEach(function (e, c) { vis(e, c < n); if (c < n && e.getAttribute('fill') === C.forest) busy++; });
    s.util.textContent = n ? 'issue slot busy ' + busy + ' of ' + n + ' cycles  (' + Math.round(100 * busy / n) + '%)' : '';
    s.util.setAttribute('fill', n && busy / n < 0.6 ? C.ver : C.forest);
  }
  scenes.push({
    plate: ['V', 'SCHEDULE: HIDING LATENCY'], title: 'Schedule', dur: 50,
    cues: [
      [0, 'One scheduler, quadrant 0, with its 12 warps. Time runs left to right in clock cycles. Each cycle the scheduler issues one instruction from one warp whose inputs are ready.'],
      [7, 'A load sends its warp into waiting (red): memory takes hundreds of cycles, shortened here to 18. The scheduler doesn&rsquo;t wait with it. It issues from someone else.'],
      [16, 'With twelve warps, the issue slot along the bottom is busy almost every cycle. The latency is still there, but it is hidden.'],
      [25, 'Now the same scheduler with only 2 warps resident, as if registers or shared memory had cut occupancy.'],
      [33, 'Gaps: cycles where both warps are waiting and nothing can issue. These are <em>stalls</em>. The latency is the same, but there is far less work in flight to cover it.'],
      [42, 'Little&rsquo;s law again: to hide a latency you need enough independent work in flight. You get it from more warps (occupancy) or from more independent instructions per warp (ILP).']
    ],
    build: function (g) {
      var s = {};
      var leg = el('g', {}, g);
      [[C.cob, 'issued (L load · A add · S store)'], [C.warn, 'waiting on its inputs'], [C.paper, 'ready, not picked']].forEach(function (d, k) {
        el('rect', { x: 200 + k * 330, y: 98, width: 16, height: 16, fill: d[0], stroke: C.rules }, leg);
        tx(leg, 222 + k * 330, 112, d[1], { size: 14, fill: C.soft });
      });
      s.a = el('g', {}, g); s.b = el('g', {}, g);
      s.ta = buildTimeline(s.a, 12, 70, 130, 32);
      s.tb = buildTimeline(s.b, 2, 70, 250, 64);
      s.stallNote = tx(s.b, 200, 510, 'each red outline is a stall: both warps waiting, the slot wasted', { size: 16, fill: C.ver });
      s.lat = tx(g, 1180, 690, 'latency shortened: 18 cycles here, several hundred on your card', { size: 13, anchor: 'end', fill: C.soft });
      return s;
    },
    draw: function (s, t) {
      var A = t < 24.5;
      op(s.a, A ? 1 - seg(t, 23.5, 24.5) : 0); vis(s.a, A);
      op(s.b, A ? 0 : seg(t, 24.5, 25.5)); vis(s.b, !A);
      drawTimeline(s.ta, Math.floor(70 * lin(t, 2, 22)), 70);
      drawTimeline(s.tb, Math.floor(70 * lin(t, 27, 45)), 70);
      op(s.stallNote, seg(t, 33, 34));
    }
  });

  /* 6 · SIMT and divergence ------------------------------------------- */
  var CODE = ['i = blockIdx.x*256 + threadIdx.x;', 'x = a[i] + b[i];', '', '    x = x * 3.0f;      // path A', 'else', '    x = x + 1.0f;      // path B', 'c[i] = x;'];
  var VARIANTS = [
    { t0: 1, cond: 'if (i % 2 == 1)', take: function (l) { return (2688 + l) % 2 === 1; }, note: 'lanes disagree → both paths' },
    { t0: 26, cond: 'if (blockIdx.x % 2 == 1)', take: function () { return false; }, note: 'all lanes agree → path A skipped' },
    { t0: 38, cond: 'if (lane == 0)', take: function (l) { return l === 0; }, note: 'one dissenter → both paths' }
  ];
  function steps(v) {
    var any = false, all = true;
    for (var l = 0; l < 32; l++) { var k = v.take(l); any = any || k; all = all && k; }
    var S = [[0, null], [1, null], [2, 'cond']];
    if (any) S.push([3, 'yes']);
    if (!all) S.push([5, 'no']);
    S.push([6, null]);
    return S;
  }
  scenes.push({
    plate: ['VI', 'ISSUE: ONE INSTRUCTION, 32 LANES'], title: 'Issue', dur: 50,
    cues: [
      [0, 'Zoom into our warp: 32 lanes, one instruction at a time. The first two lines are the same instruction for every lane on different data. That is SIMT.'],
      [8, 'Now a branch that depends on <code>i</code>: odd and even lanes disagree. The warp can&rsquo;t split, so it runs path A with the even lanes switched off&hellip;'],
      [14, '&hellip;then path B with the odd lanes off, then reconverges. The warp paid for both paths, and our lane 2 sat idle through path A.'],
      [26, 'Branch on <code>blockIdx</code> instead: all 32 lanes agree and path A is skipped entirely. Branches are cheap. What costs is disagreement inside a warp.'],
      [38, 'One dissenting lane is enough. <code>if (lane == 0)</code> costs both paths, exactly like the 50/50 split. What matters is whether the warp disagrees, not how many lanes do.']
    ],
    build: function (g) {
      var s = { code: [], rows: [] };
      tx(g, 470, 118, 'lanes of warp 4 (block 10)', { size: 15, fill: C.soft });
      for (var l = 0; l < 32; l++) {
        if (l % 4 === 0 || l === 2) tx(g, 481 + l * 23, 148, String(l), { size: 12, anchor: 'middle', fill: l === 2 ? C.ver : C.soft, weight: l === 2 ? 700 : 400 });
      }
      el('path', { d: 'M527 156 L533 166 L521 166 Z', fill: C.ver }, g);
      s.hl = el('rect', { x: 52, y: 0, width: 1170, height: 44, fill: C.hl, opacity: 0 }, g);
      for (var k = 0; k < 7; k++) {
        var y = 200 + k * 62;
        s.code.push(tx(g, 64, y + 6, CODE[k], { size: 16 }));
        var cells = [];
        for (var l2 = 0; l2 < 32; l2++) { var cr = el('rect', { x: 470 + l2 * 23, y: y - 16, width: 20, height: 30, rx: 2, fill: C.paper, stroke: C.rules }, g); if (k === 4) vis(cr, 0); cells.push(cr); }
        s.rows.push(cells);
      }
      s.skip = tx(g, 840, 392 - 6 + 62 * 0, '', { size: 15, anchor: 'middle', fill: C.soft });
      s.note = tx(g, 64, 660, '', { size: 18, weight: 700 });
      s.count = tx(g, 1210, 660, '', { size: 18, anchor: 'end', weight: 700 });
      return s;
    },
    draw: function (s, t) {
      var v = VARIANTS[t < 26 ? 0 : t < 38 ? 1 : 2], S = steps(v);
      s.code[2].textContent = v.cond;
      var lt = t - v.t0, per = v === VARIANTS[0] ? 3.2 : 1.8;
      var n = Math.max(0, Math.min(S.length, Math.floor(lt / per) + 1));
      if (lt < 0) n = 0;
      s.rows.forEach(function (cells, k) {
        var st = null;
        for (var i = 0; i < n; i++) if (S[i][0] === k) st = S[i][1] || 'all';
        cells.forEach(function (c, l) {
          var fill = C.paper, stroke = C.rules;
          if (st === 'all') fill = C.cob;
          else if (st === 'cond') fill = v.take(l) ? C.cob : C.hl;
          else if (st === 'yes') fill = v.take(l) ? C.cob : C.warn;
          else if (st === 'no') fill = v.take(l) ? C.warn : C.cob;
          if (l === 2 && st) { stroke = C.ver; }
          c.setAttribute('fill', fill); c.setAttribute('stroke', stroke);
          c.setAttribute('stroke-width', l === 2 && st ? 2.5 : 1);
        });
      });
      var cur = n > 0 ? S[n - 1][0] : -1;
      if (cur >= 0) { s.hl.setAttribute('y', 200 + cur * 62 - 22); op(s.hl, 1); } else op(s.hl, 0);
      var skipped = S.every(function (x) { return x[0] !== 3; });
      s.skip.setAttribute('y', 200 + 3 * 62 + 6);
      s.skip.textContent = skipped && n >= 4 ? 'not issued: no lane takes path A' : '';
      s.note.textContent = n >= 4 ? v.note : '';
      s.note.setAttribute('fill', v === VARIANTS[1] ? C.forest : C.ver);
      s.count.textContent = n ? 'instructions issued: ' + n : '';
    }
  });

  /* 7 · Fetch: sectors and banks --------------------------------------- */
  function laneX(l) { return 150 + l * 31; }
  scenes.push({
    plate: ['VII', 'FETCH: SECTORS AND BANKS'], title: 'Fetch', dur: 56,
    cues: [
      [0, 'Our warp reaches <code>a[i]</code>: 32 lanes, 32 addresses. But memory doesn&rsquo;t deliver floats. It delivers 32-byte <em>sectors</em>, 8 floats each.'],
      [6, 'Consecutive lanes, consecutive floats: 128 bytes in 4 sectors. Four trips to L2 and DRAM serve the whole warp. This is a <em>coalesced</em> access.'],
      [18, 'Now read with a stride of 32 floats, like walking down a column. Each lane lands in its own sector, so that is 32 trips, and 7/8 of every sector is thrown away.'],
      [28, 'Same instruction, same useful data, 8× the traffic. Nothing in the source warns you. Only the pattern of addresses across the warp decides.'],
      [36, 'Shared memory has its own rule: 32 banks, 4 bytes wide. Reading a column of a 32-wide tile sends all 32 lanes to bank 0, which means 32 passes, one after another.'],
      [48, 'Pad each row to 33 floats and the column spreads across all 32 banks: one pass. Chapter 3 is this, in detail.']
    ],
    build: function (g) {
      var s = { lanes: [], A: el('g', {}, g), B: el('g', {}, g), Cc: el('g', {}, g) };
      tx(g, 150, 124, 'warp 4 · lanes 0 … 31', { size: 15, fill: C.soft });
      for (var l = 0; l < 32; l++) s.lanes.push(el('circle', { cx: laneX(l), cy: 160, r: l === 2 ? 9 : 7, fill: l === 2 ? C.ver : C.cob }, g));
      s.code = tx(g, 1130, 124, '', { size: 16, anchor: 'end', weight: 700, fill: C.cobd });

      // A: coalesced. 64 floats a[2672..2735] = sectors of 8; the warp uses a[2688..2719].
      s.aArrows = []; s.aSec = []; s.aPk = [];
      tx(s.A, 150, 390, 'a[2672] …', { size: 13, fill: C.soft });
      for (var k = 0; k < 8; k++) {
        s.aSec.push(el('rect', { x: 150 + k * 124, y: 400, width: 120, height: 40, fill: C.paper, stroke: C.cob, 'stroke-width': 1.5 }, s.A));
        for (var f = 1; f < 8; f++) el('line', { x1: 150 + k * 124 + f * 15, y1: 400, x2: 150 + k * 124 + f * 15, y2: 440, stroke: C.rules }, s.A);
      }
      for (l = 0; l < 32; l++) {
        var e = 16 + l, ex = 150 + Math.floor(e / 8) * 124 + (e % 8) * 15 + 7.5;
        s.aArrows.push(el('line', { x1: laneX(l), y1: 170, x2: ex, y2: 398, stroke: l === 2 ? C.ver : C.cob, 'stroke-width': l === 2 ? 1.8 : 0.9 }, s.A));
      }
      for (k = 0; k < 4; k++) s.aPk.push(el('rect', { width: 34, height: 18, rx: 2, fill: C.forest }, s.A));
      s.dram = el('g', {}, g);
      el('rect', { x: 400, y: 580, width: 480, height: 60, rx: 3, fill: C.light, stroke: C.cob }, s.dram);
      tx(s.dram, 640, 617, 'L2 cache · DRAM', { size: 18, anchor: 'middle', weight: 700, fill: C.cobd });
      s.aTxt = tx(s.A, 150, 500, '', { size: 18, weight: 700, fill: C.forest });

      // B: strided. 32 sectors, one float used in each.
      s.bArrows = []; s.bPk = [];
      for (k = 0; k < 32; k++) {
        el('rect', { x: laneX(k) - 13, y: 400, width: 26, height: 40, fill: C.paper, stroke: C.cob }, s.B);
        el('rect', { x: laneX(k) - 13, y: 400, width: 26 / 8 * 1, height: 40, fill: C.cob }, s.B);
        s.bArrows.push(el('line', { x1: laneX(k), y1: 170, x2: laneX(k) - 11, y2: 398, stroke: k === 2 ? C.ver : C.cob, 'stroke-width': k === 2 ? 1.8 : 0.9 }, s.B));
        s.bPk.push(el('rect', { width: 14, height: 14, rx: 2, fill: C.ver }, s.B));
      }
      tx(s.B, 150, 390, 'one sector per lane, 1 float of 8 used', { size: 13, fill: C.soft });
      s.bTxt = tx(s.B, 150, 500, '', { size: 18, weight: 700, fill: C.ver });

      // C: shared-memory banks
      s.banks = []; s.cSq = [];
      for (k = 0; k < 32; k++) {
        s.banks.push(el('rect', { x: laneX(k) - 13, y: 340, width: 26, height: 210, fill: C.light, stroke: C.rules }, s.Cc));
        if (k % 4 === 0) tx(s.Cc, laneX(k), 572, String(k), { size: 12, anchor: 'middle', fill: C.soft });
      }
      tx(s.Cc, 150, 330, 'shared memory · 32 banks × 4 bytes', { size: 13, fill: C.soft });
      tx(s.Cc, 150, 600, 'bank', { size: 12, fill: C.soft });
      for (l = 0; l < 32; l++) s.cSq.push(el('rect', { width: 20, height: 5.5, fill: l === 2 ? C.ver : C.cob }, s.Cc));
      s.cTxt = tx(s.Cc, 150, 660, '', { size: 18, weight: 700 });
      return s;
    },
    draw: function (s, t) {
      var mode = t < 17 ? 'A' : t < 35 ? 'B' : 'C';
      vis(s.A, mode === 'A'); vis(s.B, mode === 'B'); vis(s.Cc, mode === 'C'); vis(s.dram, mode !== 'C');
      if (mode === 'A') {
        s.code.textContent = 'x = a[i];      i = 2688 + lane';
        s.aArrows.forEach(function (a, l) { op(a, seg(t, 2 + l * 0.05, 2.4 + l * 0.05)); });
        s.aSec.forEach(function (r, k) { r.setAttribute('fill', t >= 6 && k >= 2 && k <= 5 ? C.hl : C.paper); r.setAttribute('stroke-width', t >= 6 && k >= 2 && k <= 5 ? 3 : 1.5); });
        s.aPk.forEach(function (p, k) {
          var cx = 150 + (k + 2) * 124 + 43, down = seg(t, 8, 10.5), up = seg(t, 11, 13.5);
          var y = t < 11 ? lerp(446, 560, down) : lerp(560, 446, up);
          vis(p, t >= 8 && t < 13.5); p.setAttribute('x', cx); p.setAttribute('y', y.toFixed(1));
        });
        s.aTxt.textContent = t >= 6 ? '4 sectors · 128 B fetched · 128 B used · 100% efficient' : '';
      } else if (mode === 'B') {
        s.code.textContent = 'x = a[i * 32];     a column, stride 128 B';
        s.bArrows.forEach(function (a, l) { op(a, seg(t, 18 + l * 0.05, 18.4 + l * 0.05)); });
        s.bPk.forEach(function (p, k) {
          var down = seg(t, 22 + k * 0.03, 24.5 + k * 0.03), up = seg(t, 25 + k * 0.03, 27.5 + k * 0.03);
          var y = t < 25 ? lerp(446, 560, down) : lerp(560, 446, up);
          vis(p, t >= 22 && t < 27.6); p.setAttribute('x', laneX(k) - 7); p.setAttribute('y', y.toFixed(1));
        });
        s.bTxt.textContent = t >= 21 ? '32 sectors · 1,024 B fetched · 128 B used · 12.5% efficient' : '';
      } else {
        var padded = t >= 47;
        s.code.textContent = padded ? 'x = tile[lane][0];   rows of 33 floats' : 'x = tile[lane][0];   rows of 32 floats';
        var u = padded ? seg(t, 48, 50) : seg(t, 37, 39.5);
        var passes = padded ? 1 : Math.max(1, Math.min(32, Math.floor(lin(t, 40, 46) * 32)));
        s.cSq.forEach(function (q, l) {
          var bank = padded ? l % 32 : 0, stackY = padded ? 540 : 540 - l * 6.4;
          q.setAttribute('x', lerp(laneX(l) - 10, laneX(bank) - 10, u).toFixed(1));
          q.setAttribute('y', lerp(172, stackY, u).toFixed(1));
          var served = padded ? t >= 51 : l < passes && t >= 40;
          q.setAttribute('fill', served ? C.forest : l === 2 ? C.ver : C.cob);
        });
        s.banks.forEach(function (b, k) { b.setAttribute('fill', !padded && k === 0 && t >= 39.5 ? C.warn : C.light); });
        s.cTxt.textContent = padded ? (t >= 50 ? 'bank = (33 · lane) % 32 = lane  →  1 pass' : '')
                                    : (t >= 39.5 ? 'bank = (32 · lane) % 32 = 0  →  pass ' + passes + ' of 32' : '');
        s.cTxt.setAttribute('fill', padded ? C.forest : C.ver);
      }
    }
  });

  /* 8 · Done: five moves ---------------------------------------------- */
  scenes.push({
    plate: ['VIII', 'DONE'], title: 'Done', dur: 32,
    cues: [
      [0, 'Back out to the GPU. The last blocks finish wherever they landed, the queue is empty, and the GPU signals completion.'],
      [7, 'On the host, the waiting copy returns with the result: 262,144 sums from 1,024 independent blocks.'],
      [12, 'Everything a kernel does is one of five moves. Learn to see them, and every performance problem in this course has a name.']
    ],
    build: function (g) {
      var s = {};
      s.die = el('g', {}, g); s.dieS = buildDie(s.die);
      s.card = el('g', {}, g);
      tx(s.card, 640, 150, 'FIVE MOVES', { size: 64, anchor: 'middle', fill: C.cob, family: F.disp, weight: 700 });
      var M = [['PLACE', 'whole blocks onto SMs, as the budgets allow', 'occupancy'],
               ['CUT', 'every block into warps of 32, x first', 'warp shape, partial warps'],
               ['SCHEDULE', 'one ready warp per scheduler per cycle', 'latency hiding'],
               ['ISSUE', 'one instruction for 32 lanes; disagreement pays twice', 'divergence'],
               ['FETCH', 'sectors from global memory, banks in shared memory', 'coalescing, bank conflicts']];
      s.rows = M.map(function (m, k) {
        var gg = el('g', {}, s.card), y = 230 + k * 84;
        el('line', { x1: 150, y1: y - 44, x2: 1130, y2: y - 44, stroke: C.rules }, gg);
        tx(gg, 170, y, m[0], { size: 40, fill: C.ver, family: F.disp, weight: 700 });
        tx(gg, 420, y - 8, m[1], { size: 22, family: F.serif });
        tx(gg, 420, y + 20, m[2], { size: 15, fill: C.soft });
        return gg;
      });
      s.coda = tx(s.card, 640, 650, 'Chapter 2 is the text version of this film. Chapter 3 zooms into FETCH.', { size: 18, anchor: 'middle', fill: C.soft, family: F.serif, italic: true });
      s.done = el('g', {}, g);
      el('rect', { x: 460, y: 300, width: 360, height: 90, rx: 4, fill: C.paper, stroke: C.forest, 'stroke-width': 2 }, s.done);
      tx(s.done, 640, 338, 'kernel complete', { size: 26, anchor: 'middle', fill: C.forest, weight: 700 });
      tx(s.done, 640, 372, 'cudaMemcpy returns · c is on the host', { size: 16, anchor: 'middle' });
      return s;
    },
    draw: function (s, t) {
      drawDie(s.dieS, DIST.end - 4 + Math.min(t, 6));
      op(s.die, 1 - seg(t, 6, 7.5)); vis(s.die, t < 7.5);
      op(s.done, seg(t, 6.5, 7.5) * (1 - seg(t, 11, 12))); vis(s.done, t > 6.4 && t < 12);
      op(s.card, seg(t, 12, 13)); vis(s.card, t >= 12);
      s.rows.forEach(function (r, k) { op(r, seg(t, 13 + k * 1.6, 14 + k * 1.6)); });
      op(s.coda, seg(t, 22, 23));
    }
  });

  /* ------------------------------------------------------------ player */
  var starts = [], total = 0;
  scenes.forEach(function (s) { starts.push(total); total += s.dur; });
  var layer = el('g', {}, svg), plateG = el('g', {}, svg);
  var T = 0, playing = false, speed = 1, last = null, cur = -1, state = null, capI = -1;

  var $play = document.getElementById('film-play'), $seek = document.getElementById('film-seek'),
      $time = document.getElementById('film-time'), $cap = document.getElementById('film-caption'),
      $speed = document.getElementById('film-speed'), $scenes = document.getElementById('film-scenes'),
      $big = document.getElementById('film-big'), $marks = document.getElementById('film-marks');

  function mmss(x) { x = Math.floor(x); return Math.floor(x / 60) + ':' + ('0' + (x % 60)).slice(-2); }
  function sceneAt(t) { for (var i = scenes.length - 1; i >= 0; i--) if (t >= starts[i]) return i; return 0; }

  function drawPlate(sc) {
    while (plateG.firstChild) plateG.removeChild(plateG.firstChild);
    el('rect', { x: 16, y: 16, width: 1248, height: 688, fill: 'none', stroke: C.rule, 'stroke-width': 1.5 }, plateG);
    el('rect', { x: 24, y: 24, width: 1232, height: 672, fill: 'none', stroke: C.rules, 'stroke-width': 1 }, plateG);
    if (sc.plate) {
      el('rect', { x: 40, y: 44, width: 10, height: 26, fill: C.ver }, plateG);
      tx(plateG, 60, 66, 'PLATE ' + sc.plate[0] + ' · ' + sc.plate[1], { size: 24, family: F.disp, weight: 700, fill: C.cobd, ls: 1 });
      tx(plateG, 1240, 66, 'LIFE OF A LAUNCH', { size: 14, anchor: 'end', fill: C.soft, family: F.ui, weight: 600, ls: 2 });
      el('line', { x1: 40, y1: 82, x2: 1240, y2: 82, stroke: C.rule }, plateG);
    }
  }

  function setTime(t) {
    T = clamp(t, 0, total - 0.001);
    var i = sceneAt(T);
    if (i !== cur) {
      while (layer.firstChild) layer.removeChild(layer.firstChild);
      state = scenes[i].build(layer); cur = i; capI = -1; drawPlate(scenes[i]);
      svg.setAttribute('aria-label', 'Film, scene ' + i + ': ' + scenes[i].title);
      [].forEach.call($scenes.children, function (b, k) { b.setAttribute('aria-current', k === i ? 'true' : 'false'); });
    }
    var lt = T - starts[i];
    // poster: while paused at 0:00, show the title card fully drawn
    scenes[i].draw(state, i === 0 && !playing && T < 0.05 ? 8 : lt);
    var cues = scenes[i].cues, ci = 0;
    for (var k = 0; k < cues.length; k++) if (lt >= cues[k][0]) ci = k;
    if (ci !== capI) { capI = ci; $cap.innerHTML = cues[ci][1]; }
    if (T > 0.05) vis($big, 0);
    $seek.value = T.toFixed(1);
    $time.textContent = mmss(T) + ' / ' + mmss(total);
  }
  function setPlaying(p) {
    playing = p;
    $play.textContent = p ? '❚❚ Pause' : (T >= total - 0.01 ? '↺ Replay' : '▶ Play');
    $play.setAttribute('aria-pressed', p ? 'true' : 'false');
    vis($big, !p && T < 0.05);
    if (p) { last = null; setTime(T); requestAnimationFrame(tick); }
  }
  function tick(ts) {
    if (!playing) return;
    if (last != null) {
      var nt = T + (ts - last) / 1000 * speed;
      if (nt >= total - 0.001) { setTime(total - 0.001); setPlaying(false); $play.textContent = '↺ Replay'; return; }
      setTime(nt);
    }
    last = ts;
    requestAnimationFrame(tick);
  }
  function toggle() {
    if (!playing && T >= total - 0.01) setTime(0);
    setPlaying(!playing);
  }

  $seek.max = total; $seek.step = 0.1;
  scenes.forEach(function (sc, i) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'film-chip';
    b.textContent = i ? i + ' · ' + sc.title : sc.title;
    b.addEventListener('click', function () { setTime(starts[i] + 0.01); });
    $scenes.appendChild(b);
    if (i) { var m = document.createElement('span'); m.className = 'film-mark'; m.style.left = (100 * starts[i] / total) + '%'; $marks.appendChild(m); }
  });
  $play.addEventListener('click', toggle);
  $big.addEventListener('click', toggle);
  $seek.addEventListener('input', function () { setTime(+$seek.value); });
  $speed.addEventListener('change', function () { speed = +$speed.value; });
  document.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (e.key === ' ' || e.key === 'k') { e.preventDefault(); toggle(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); setTime(starts[Math.min(scenes.length - 1, sceneAt(T) + 1)] + 0.01); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); var i = sceneAt(T); setTime(starts[T - starts[i] < 1.5 ? Math.max(0, i - 1) : i] + 0.01); }
    else if (e.key === 'l') setTime(T + 5);
    else if (e.key === 'j') setTime(T - 5);
  });
  // deep link: film-execution-model.html#scene-3
  var m = /scene-(\d+)/.exec(location.hash);
  setTime(m ? starts[Math.min(scenes.length - 1, +m[1])] + 0.01 : 0);
  setPlaying(false);
  window.LaunchFilm = { setTime: setTime, total: total, starts: starts, play: function () { setPlaying(true); } };
})();
