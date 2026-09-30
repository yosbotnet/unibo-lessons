/* film2.js — "Life of a Launch II". One world, one continuous camera, one narrator.
   The whole machine (CPU, PCIe, die, SMs, L2, GDDR7) is drawn once; a camera
   flies through it by animating the SVG viewBox. Everything on screen is a
   pure function of film time t, which maps to REAL GPU time through a
   piecewise "slow motion" curve, so the world stays consistent wherever the
   camera looks. Sound is synthesized with WebAudio (live, or offline for the
   MP4 export). Numbers are the RTX 5070's (sm_120). */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var svg = document.getElementById('f2-svg');
  if (!svg) return;

  /* ============================================================ helpers */
  var C = {
    paper: 'var(--lk-paper)', light: 'var(--lk-paper-light)', ink: 'var(--lk-ink)',
    soft: 'var(--lk-ink-soft)', cob: 'var(--lk-cobalt)', cobd: 'var(--lk-cobalt-dark)',
    ver: 'var(--lk-vermilion)', forest: 'var(--lk-forest)', rule: 'var(--lk-rule)',
    rules: 'var(--lk-rule-soft)', hl: 'var(--lk-hl)', ok: 'var(--lk-okbg)', warn: 'var(--lk-warnbg)'
  };
  var F = { mono: 'var(--lk-mono)', serif: 'var(--lk-font)', disp: 'var(--lk-display)', ui: 'var(--lk-utility)' };
  function el(tag, a, p) {
    var e = document.createElementNS(NS, tag);
    if (a) for (var k in a) e.setAttribute(k, a[k]);
    if (p) p.appendChild(e);
    return e;
  }
  function tx(p, x, y, s, o) {
    o = o || {};
    var e = el('text', { x: x, y: y, 'font-size': o.size || 18, fill: o.fill || C.ink,
      'text-anchor': o.anchor || 'start', 'font-family': o.family || F.mono, 'font-weight': o.weight || 400 }, p);
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
  function op(e, v) { e.setAttribute('opacity', v <= 0.001 ? 0 : v >= 1 ? 1 : v.toFixed(3)); }
  function vis(e, on) { e.style.display = on ? '' : 'none'; }
  function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
  function between(t, a, b) { return t >= a && t < b; }

  /* ============================================================ real time */
  // Blocks, in REAL nanoseconds after the launch call. First wave: one block
  // every 1.4 ns into slots 0..287 (slot s = SM s % 48, position s / 48).
  // A block lives ~1.4-1.75 us (memory-bound, loaded latency); its slot is
  // refilled 25 ns after it leaves.
  var DIST = (function () {
    var A = [], L = [];
    for (var b = 0; b < 1024; b++) {
      A[b] = b < 288 ? 3050 + b * 1.4 : L[b - 288] + 25;
      L[b] = A[b] + 1400 + 350 * hash(b);
    }
    return { A: A, L: L, end: Math.max.apply(null, L) };
  })();
  var KEND = DIST.end;                       // kernel finishes (ns)
  var SM10 = [10, 58, 106, 154, 202, 250];   // blocks on SM 10 in wave 0
  // Our warp (block 10, warp 4), in real ns:
  var W = { first: 3080, ld: 3090, back: 3890, add: 3894, br: 3896, rec: 3904, st: 3910, exit: 3920 };

  // Film time -> real ns. Piecewise linear; the slope is the slow-motion factor.
  var CLOCK = [
    [20, 0], [36, 3000], [40, 3050], [46, 3064], [62, 3072], [82, 3078], [112, 3088], [113, 3090],
    [172, 3890], [180, 3894], [186, 3896], [208, 3904], [215, 3910], [224, 3920],
    [240, 4150], [268, KEND], [275, KEND + 800], [400, KEND + 800]
  ];
  function realAt(t) {
    if (t <= CLOCK[0][0]) return 0;
    for (var i = 1; i < CLOCK.length; i++) {
      if (t <= CLOCK[i][0]) {
        var a = CLOCK[i - 1], b = CLOCK[i];
        return lerp(a[1], b[1], (t - a[0]) / (b[0] - a[0]));
      }
    }
    return CLOCK[CLOCK.length - 1][1];
  }
  function slowmoAt(t) {
    for (var i = 1; i < CLOCK.length; i++) {
      if (t <= CLOCK[i][0]) {
        var a = CLOCK[i - 1], b = CLOCK[i], dr = (b[1] - a[1]) * 1e-9;
        return dr > 0 ? (b[0] - a[0]) / dr : 0;
      }
    }
    return 0;
  }
  // film time at which real time r happens (inverse of realAt, for sync)
  function filmAt(r) {
    for (var i = 1; i < CLOCK.length; i++) {
      var a = CLOCK[i - 1], b = CLOCK[i];
      if (r <= b[1] && b[1] > a[1]) return lerp(a[0], b[0], (r - a[1]) / (b[1] - a[1]));
    }
    return CLOCK[CLOCK.length - 1][0];
  }

  /* ============================================================ geometry */
  var CPU = { x: 120, y: 820, w: 1000, h: 1060 };
  var BOARD = { x: 1740, y: 170, w: 2960, h: 2360 };
  var DIE = { x: 2150, y: 555, w: 2150, h: 1590 };
  var GIGA = { x: 2170, y: 1262, w: 186, h: 176 };
  var L2 = { x: 2370, y: 1262, w: 1910, h: 176 };
  function smRect(sm) {
    var col = sm % 8, row = Math.floor(sm / 8);
    return { x: 2370 + col * 238, y: row < 3 ? 590 + row * 220 : 1450 + (row - 3) * 220, w: 226, h: 208 };
  }
  function slotXY(sl) { var r = smRect(sl % 48), p = Math.floor(sl / 48); return [r.x + 8 + p * 36, r.y + 34]; }
  var S10 = smRect(10);
  var Q0 = { x: S10.x + 5, y: S10.y + 76, s: 0.106 };      // quadrant 0 local 1000x560 -> world
  function q0(lx, ly) { return [Q0.x + lx * Q0.s, Q0.y + ly * Q0.s]; }
  function laneLocal(l) { return [35 + l * 30.5, 510]; }
  var CHIPS = [[2560, 250], [3225, 250], [3890, 250], [2560, 2230], [3225, 2230], [3890, 2230]];

  // Memory request paths (world): lane 2 -> out of SM 10 -> L2 -> a column gap -> MC -> chip
  function pathA(k) { var L = q0.apply(null, laneLocal(2 + k * 8)); return [L, [2958, L[1] + 4], [2958, 1020], [2958, 1330], [3316, 1330], [3316, 590], [3225, 470], [3225, 385]]; }
  function pathB(k) { var L = q0.apply(null, laneLocal(3 + k * 8)); return [L, [2962, L[1] + 6], [2962, 1020], [2962, 1350], [4030, 1350], [4030, 590], [3890, 470], [3890, 385]]; }
  function along(pts, u) {
    var len = 0, d = [];
    for (var i = 1; i < pts.length; i++) { var l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); d.push(l); len += l; }
    var want = clamp(u) * len;
    for (i = 1; i < pts.length; i++) {
      if (want <= d[i - 1] || i === pts.length - 1) {
        var f = d[i - 1] ? clamp(want / d[i - 1]) : 1;
        return [lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)];
      }
      want -= d[i - 1];
    }
    return pts[pts.length - 1];
  }
  // a request goes out, sits in DRAM, comes back (film times)
  function trip(pts, t, go, arrive, leave, back) {
    if (t < go || t >= back) return null;
    if (t < arrive) return along(pts, ease((t - go) / (arrive - go)));
    if (t < leave) return pts[pts.length - 1];
    return along(pts, 1 - ease((t - leave) / (back - leave)));
  }

  /* ============================================================ the world */
  var world = el('g', {}, svg);
  var R = {};                                   // dynamic references

  (function build() {
    var g = world;
    // --- host
    el('rect', { x: CPU.x, y: CPU.y, width: CPU.w, height: CPU.h, rx: 10, fill: C.light, stroke: C.cob, 'stroke-width': 4 }, g);
    tx(g, CPU.x + 40, CPU.y + 66, 'HOST · CPU', { size: 40, family: F.disp, weight: 700, fill: C.cobd, ls: 2 });
    el('rect', { x: CPU.x + 40, y: CPU.y + 96, width: CPU.w - 80, height: 880, rx: 6, fill: C.paper, stroke: C.rules, 'stroke-width': 2 }, g);
    var code = [
      ['__global__ void mix(const float* a, const float* b,', C.ink],
      ['                    float* c, int n) {', C.ink],
      ['    int i = blockIdx.x * blockDim.x + threadIdx.x;', C.ink],
      ['    if (i >= n) return;', C.ink],
      ['    float x = a[i] + b[i];', C.ink],
      ['    if (i % 2) x = x * 3.0f;   // odd threads', C.ink],
      ['    else       x = x + 1.0f;   // even threads', C.ink],
      ['    c[i] = x;', C.ink],
      ['}', C.ink],
      ['', C.ink],
      ['// host', C.soft]
    ];
    code.forEach(function (c, k) { tx(g, CPU.x + 70, CPU.y + 160 + k * 40, c[0], { size: 25, fill: c[1] }); });
    R.launchLine = tx(g, CPU.x + 70, CPU.y + 160 + 11 * 40, '', { size: 25, fill: C.cobd, weight: 700 });
    R.copyLine = tx(g, CPU.x + 70, CPU.y + 160 + 12 * 40, '', { size: 25 });
    R.cpuStatus = tx(g, CPU.x + CPU.w - 40, CPU.y + 66, '', { size: 24, weight: 700, anchor: 'end' });
    R.cursor = el('rect', { width: 14, height: 30, fill: C.ver }, g);

    // --- PCIe
    for (var k = 0; k < 8; k++) el('line', { x1: CPU.x + CPU.w, y1: 1310 + k * 11, x2: BOARD.x, y2: 1310 + k * 11, stroke: C.rule, 'stroke-width': 3, opacity: 0.8 }, g);
    tx(g, 1430, 1290, 'PCIe 5.0 ×16 · ≈ 64 GB/s', { size: 26, anchor: 'middle', fill: C.soft });

    // --- board, chips, die
    el('rect', { x: BOARD.x, y: BOARD.y, width: BOARD.w, height: BOARD.h, rx: 18, fill: C.light, stroke: C.forest, 'stroke-width': 5 }, g);
    tx(g, BOARD.x + 40, BOARD.y + 60, 'RTX 5070 · 12 GB GDDR7 · 672 GB/s', { size: 34, family: F.disp, weight: 700, fill: C.forest, ls: 2 });
    CHIPS.forEach(function (c, i) {
      el('rect', { x: c[0] - 190, y: c[1] - 20, width: 380, height: 240, rx: 6, fill: C.paper, stroke: C.cob, 'stroke-width': 3 }, g);
      for (var r = 0; r < 6; r++) el('line', { x1: c[0] - 170, y1: c[1] + 20 + r * 30, x2: c[0] + 170, y2: c[1] + 20 + r * 30, stroke: C.rules, 'stroke-width': 1.5 }, g);
      tx(g, c[0], c[1] + 210, 'GDDR7 · 2 GB', { size: 22, anchor: 'middle', fill: C.cobd, weight: 700 });
      var top = c[1] < 1000;
      el('line', { x1: c[0], y1: top ? c[1] + 220 : c[1] - 20, x2: c[0], y2: top ? DIE.y : DIE.y + DIE.h, stroke: C.cob, 'stroke-width': 6, opacity: 0.5 }, g);
    });
    el('rect', { x: DIE.x, y: DIE.y, width: DIE.w, height: DIE.h, rx: 8, fill: C.paper, stroke: C.cob, 'stroke-width': 6 }, g);
    tx(g, DIE.x + 10, DIE.y - 18, 'GB205 die · 48 SMs · 48 MB L2', { size: 28, fill: C.cobd, weight: 700 });
    el('rect', { x: L2.x, y: L2.y, width: L2.w, height: L2.h, rx: 4, fill: C.hl, stroke: C.cob, 'stroke-width': 3, 'stroke-dasharray': '14 8' }, g);
    tx(g, L2.x + L2.w / 2, L2.y + 104, 'L2 CACHE · 48 MB · shared by all 48 SMs', { size: 40, anchor: 'middle', family: F.disp, weight: 700, fill: C.cobd, ls: 3 });
    el('rect', { x: GIGA.x, y: GIGA.y, width: GIGA.w, height: GIGA.h, rx: 4, fill: C.warn, stroke: C.ver, 'stroke-width': 3 }, g);
    tx(g, GIGA.x + GIGA.w / 2, GIGA.y + 70, 'BLOCK', { size: 30, anchor: 'middle', family: F.disp, weight: 700, fill: C.ver });
    tx(g, GIGA.x + GIGA.w / 2, GIGA.y + 106, 'DISPATCH', { size: 30, anchor: 'middle', family: F.disp, weight: 700, fill: C.ver });
    R.queueTxt = tx(g, GIGA.x + GIGA.w / 2, GIGA.y + 148, '', { size: 18, anchor: 'middle', fill: C.ver });

    // --- SMs
    for (var sm = 0; sm < 48; sm++) {
      var r = smRect(sm), me = sm === 10;
      el('rect', { x: r.x, y: r.y, width: r.w, height: r.h, rx: 5, fill: C.light, stroke: me ? C.ver : C.forest, 'stroke-width': me ? 5 : 2.5 }, g);
      tx(g, r.x + 8, r.y + 24, 'SM ' + sm, { size: 20, fill: me ? C.ver : C.forest, weight: 700 });
      for (var p = 0; p < 6; p++) el('rect', { x: r.x + 8 + p * 36, y: r.y + 34, width: 30, height: 30, fill: 'none', stroke: C.rules, 'stroke-width': 1.5 }, g);
      if (!me) for (var q = 0; q < 4; q++) {
        el('rect', { x: r.x + 5 + (q % 2) * 110, y: r.y + 76 + Math.floor(q / 2) * 64, width: 106, height: 60, rx: 2, fill: C.paper, stroke: C.rules, 'stroke-width': 1.5 }, g);
      }
    }

    // --- SM 10 in detail: quadrants 1..3 simplified, quadrant 0 fully
    R.qrows = [];
    for (var qq = 1; qq < 4; qq++) {
      var ox = S10.x + 5 + (qq % 2) * 110, oy = S10.y + 76 + Math.floor(qq / 2) * 64;
      el('rect', { x: ox, y: oy, width: 106, height: 60, rx: 2, fill: C.paper, stroke: C.cob, 'stroke-width': 1 }, g);
      tx(g, ox + 4, oy + 7, 'quadrant ' + qq, { size: 4.5, fill: C.cobd, weight: 700 });
      for (var rr = 0; rr < 12; rr++) {
        var j = Math.floor(rr / 2), w = qq + 4 * (rr % 2);
        var row = el('rect', { x: ox + 4, y: oy + 10 + rr * 4, width: 60, height: 3.2, fill: j === 0 ? C.warn : C.hl }, g);
        R.qrows.push({ e: row, block: SM10[j] });
      }
    }
    var QG = el('g', { transform: 'translate(' + Q0.x + ' ' + Q0.y + ') scale(' + Q0.s + ')' }, g);
    R.QG = QG;
    el('rect', { x: 0, y: 0, width: 1000, height: 560, rx: 12, fill: C.paper, stroke: C.cob, 'stroke-width': 6 }, QG);
    tx(QG, 20, 40, 'QUADRANT 0 · WARP SCHEDULER', { size: 30, family: F.disp, weight: 700, fill: C.cobd, ls: 2 });
    el('rect', { x: 20, y: 56, width: 960, height: 50, rx: 6, fill: C.hl, stroke: C.cob, 'stroke-width': 2 }, QG);
    R.sched = tx(QG, 36, 89, '', { size: 21, weight: 700, fill: C.cobd });
    R.rows = [];
    for (var r2 = 0; r2 < 12; r2++) {
      var jj = Math.floor(r2 / 2), ww = 4 * (r2 % 2), y2 = 124 + r2 * 26;
      var rg = el('g', {}, QG);
      var rect = el('rect', { x: 20, y: y2, width: 580, height: 22, rx: 3, fill: C.light, stroke: C.rules, 'stroke-width': 1.5 }, rg);
      var mine = SM10[jj] === 10 && ww === 4;
      tx(rg, 32, y2 + 17, 'block ' + SM10[jj] + ' · warp ' + ww, { size: 16, fill: mine ? C.ver : C.ink, weight: mine ? 700 : 400 });
      var st = tx(rg, 588, y2 + 17, '', { size: 15, anchor: 'end', fill: C.soft });
      R.rows.push({ g: rg, rect: rect, st: st, block: SM10[jj], mine: mine, label: 'block ' + SM10[jj] + ' · warp ' + ww });
    }
    el('rect', { x: 620, y: 124, width: 360, height: 308, rx: 6, fill: C.light, stroke: C.rules, 'stroke-width': 2 }, QG);
    tx(QG, 800, 160, 'REGISTER FILE · 64 KB', { size: 20, anchor: 'middle', weight: 700, fill: C.cobd });
    for (var rb = 0; rb < 12; rb++) el('rect', { x: 640, y: 176 + rb * 20, width: 320, height: 16, fill: C.paper, stroke: C.rules }, QG);
    R.regMine = el('rect', { x: 640, y: 196, width: 320, height: 16, fill: C.ver, opacity: 0 }, QG);
    tx(QG, 800, 426, 'every warp keeps its registers here', { size: 15, anchor: 'middle', fill: C.soft });
    R.banner = tx(QG, 20, 466, '', { size: 21, weight: 700, fill: C.cobd });
    R.lanes = [];
    for (var l = 0; l < 32; l++) {
      var LL = laneLocal(l);
      var ring = el('circle', { cx: LL[0], cy: LL[1], r: 14, fill: 'none', stroke: C.ver, 'stroke-width': 2, opacity: 0 }, QG);
      var dot = el('circle', { cx: LL[0], cy: LL[1], r: l === 2 ? 11 : 9.5, fill: C.paper, stroke: l === 2 ? C.ver : C.cob, 'stroke-width': l === 2 ? 3.5 : 2 }, QG);
      var num = tx(QG, LL[0], LL[1] - 20, String(2688 + l), { size: 7.5, anchor: 'middle', fill: l === 2 ? C.ver : C.soft, weight: l === 2 ? 700 : 400 });
      R.lanes.push({ dot: dot, ring: ring, num: num });
    }
    tx(QG, 980, 556, 'WARP 4 OF BLOCK 10 · 32 LANES, ONE INSTRUCTION AT A TIME', { size: 11, anchor: 'end', fill: C.soft, ls: 1 });
    R.me = tx(QG, 96, 535, '▲ me', { size: 8, anchor: 'middle', fill: C.ver, weight: 700 });
    R.nb = tx(QG, 127, 535, '▲ 2,691', { size: 7, anchor: 'middle', fill: C.cobd, weight: 700 });
    R.mask = tx(QG, 96, 546, '', { size: 7, anchor: 'middle', fill: C.ver, weight: 700 });

    // --- blocks (drawn above the SM boxes)
    R.blocks = [];
    for (var b = 0; b < 1024; b++) R.blocks.push(el('rect', { width: 30, height: 30, rx: 2, fill: b === 10 ? C.ver : C.cob }, g));

    // --- labels along the memory path
    R.l2miss = tx(g, 2990, 1320, 'L2: miss → out to DRAM', { size: 16, fill: C.ver, weight: 700 });
    R.dramNote = tx(g, 3225, 330, '', { size: 22, anchor: 'middle', fill: C.ver, weight: 700 });
    R.dramGlow = el('rect', { x: 3035, y: 230, width: 380, height: 240, rx: 6, fill: C.warn, opacity: 0 }, g);

    // --- packets
    function pkt(fill, w, h) { var e = el('rect', { width: w, height: h, rx: 1, fill: fill }, g); vis(e, 0); return e; }
    R.pa = [0, 1, 2, 3].map(function () { return pkt(C.ver, 7, 4); });
    R.pb = [0, 1, 2, 3].map(function () { return pkt(C.cob, 7, 4); });
    R.ps = [0, 1, 2, 3].map(function () { return pkt(C.forest, 7, 4); });
    R.launch = el('g', {}, g);
    el('rect', { x: -150, y: -26, width: 300, height: 52, rx: 6, fill: C.paper, stroke: C.ver, 'stroke-width': 4 }, R.launch);
    tx(R.launch, 0, 9, 'mix<<<1024, 256>>>', { size: 24, anchor: 'middle', fill: C.ver, weight: 700 });
    R.done = el('g', {}, g);
    el('rect', { x: -110, y: -26, width: 220, height: 52, rx: 6, fill: C.paper, stroke: C.forest, 'stroke-width': 4 }, R.done);
    tx(R.done, 0, 9, 'kernel done ✓', { size: 24, anchor: 'middle', fill: C.forest, weight: 700 });
  })();

  /* ============================================================ camera */
  // [t, cx, cy, w]; smooth between keys. Follows blend in and out.
  var CAM = [
    [0, 620, 1260, 1300], [12, 620, 1260, 1250], [18, 640, 1280, 1180], [27, 640, 1280, 1200],
    [29.5, 1150, 1350, 1500], [36, 2250, 1350, 1500],
    [39, 3225, 1350, 2500], [47, 3225, 1350, 2500], [55, 2959, 914, 700], [63, 2959, 914, 300],
    [73, 2904, 929, 150], [84, 2904, 929, 150], [93, 2872, 939, 36], [104, 2872, 939, 36],
    [112, 2880, 939, 64], [113, 2890, 950, 160],
    [135, 3225, 420, 520], [138, 3225, 420, 520], [147, 2904, 929, 150], [166, 2904, 929, 150],
    [171, 2874, 939, 56], [178, 2870, 939, 38], [213, 2870, 939, 38], [218, 2880, 939, 64],
    [226, 2880, 939, 64], [233, 2959, 914, 320], [241, 3225, 1350, 2500], [264, 3225, 1350, 2500],
    [272, 2400, 1350, 4700], [300, 2400, 1350, 4800]
  ];
  var FOLLOW = [
    { t0: 114, t1: 135.5, fn: function (t) { var p = trip(pathA(0), t, 113, 135, 150, 172) || [3225, 385]; return [p[0], p[1], lerp(150, 520, lin(t, 114, 128))]; } }
  ];
  function camAt(t) {
    var i = 1; while (i < CAM.length - 1 && t > CAM[i][0]) i++;
    var a = CAM[i - 1], b = CAM[i], u = ease((t - a[0]) / (b[0] - a[0] || 1));
    if (t <= CAM[0][0]) u = 0;
    var c = [lerp(a[1], b[1], u), lerp(a[2], b[2], u), lerp(a[3], b[3], u)];
    FOLLOW.forEach(function (f) {
      if (t < f.t0 - 0.01 || t > f.t1) return;
      var w = ease((t - f.t0) / 1.2) * ease((f.t1 - t) / 1.2), p = f.fn(t);
      c = [lerp(c[0], p[0], w), lerp(c[1], p[1], w), lerp(c[2], p[2], w)];
    });
    return c;
  }
  function setCam(c) {
    var w = c[2], h = w * 9 / 16;
    svg.setAttribute('viewBox', (c[0] - w / 2).toFixed(2) + ' ' + (c[1] - h / 2).toFixed(2) + ' ' + w.toFixed(2) + ' ' + h.toFixed(2));
  }

  /* ============================================================ script */
  // Narration: the thread speaks.
  var SUBS = [
    [12, 'Before I exist, I&rsquo;m a line of C++. Somebody wants 262,144 numbers mixed, and they want them now.'],
    [19, '<code>mix&lt;&lt;&lt;1024, 256&gt;&gt;&gt;</code>. One call, and the CPU gets on with its life. It never waits for us.'],
    [28, 'The request crosses the bus. Three microseconds: slow, by our standards. Then it reaches the GPU&rsquo;s front door.'],
    [37, 'The GPU is 48 small processors called SMs. A dispatcher hands out <strong>blocks</strong> of 256 threads, always whole, to whichever SM has room.'],
    [46, 'Block 10 is one of the first. It lands on SM 10. Six blocks fit on an SM for this kernel; 288 across the chip. The rest wait their turn.'],
    [56, 'A block is the unit that lives on one SM. Everything inside it can share memory and wait for each other. And inside block 10, I&rsquo;m about to start.'],
    [66, 'Hello. I&rsquo;m thread 2,690.'],
    [73, 'SM 10 has four schedulers. Mine is quadrant 0. It can juggle twelve warps; right now it has two, and one of them is mine. More blocks are still landing.'],
    [84, 'A <strong>warp</strong> is 32 of us, welded together: one instruction, 32 lanes, same moment. We never take a step alone.'],
    [93, 'This is my neighbour, 2,691. Same warp, same instructions, every cycle of our lives.'],
    [100, 'Instruction one: work out who I am. <code>i = 10 × 256 + 130</code>. All 32 of us compute it at once, each with our own numbers.'],
    [106, 'Instruction two: am I inside the array? Everyone is. Nobody leaves early.'],
    [112, 'Then: <code>a[i]</code>. We ask memory for 32 consecutive floats. That&rsquo;s just four 32-byte sectors, one request for the whole warp.'],
    [116, 'And right behind it, <code>b[i]</code>. We don&rsquo;t wait for the first answer to ask the second question.'],
    [121, 'The request misses in L2 and has to leave the chip entirely, out to a GDDR7 chip on the board.'],
    [131, 'With the whole chip hammering memory, the round trip takes about 800 nanoseconds. That&rsquo;s two thousand clock cycles.'],
    [139, 'For me, this is forever.'],
    [145, 'For the SM, it&rsquo;s Tuesday. Five more blocks have landed. My scheduler has eleven other warps, and every cycle it runs whichever one is ready.'],
    [156, 'That&rsquo;s the whole trick. The GPU doesn&rsquo;t make memory fast. It makes waiting cheap: nobody waits for the slow thing.'],
    [166, '&hellip;'],
    [172, 'There. <code>a[2690]</code> and <code>b[2690]</code>, two thousand cycles later.'],
    [179, 'Add them. One cycle of real work.'],
    [185, 'Then the twist: <code>if (i % 2)</code>. Odd threads multiply by three, even threads add one. I&rsquo;m even. 2,691 is odd. For the first time in our lives, we disagree.'],
    [192, 'A warp can&rsquo;t split in two. So the odd lanes go first, and I&rsquo;m switched off: <em>masked</em>, watching my own warp do work I don&rsquo;t need.'],
    [200, 'Then it&rsquo;s my turn, and 2,691 waits for me. The warp pays for both paths.'],
    [208, 'And then we&rsquo;re one again.'],
    [214, '<code>c[i] = x</code>. Our 32 stores merge into four sectors. We don&rsquo;t wait for them to land: stores are fire-and-forget.'],
    [221, 'And I exit. My registers go back to the pool. I lived for about 860 nanoseconds.'],
    [229, 'Pull back, and I&rsquo;m gone. Block 10 finishes a little later, and block 298 moves into its slot before the registers are cold.'],
    [242, 'Everywhere, the same story: blocks land, warps wait, schedulers juggle, blocks leave. Three and a half waves of it.'],
    [255, 'The last wave is ragged. Some SMs finish early and sit idle. That&rsquo;s the tail.'],
    [266, 'Then the GPU tells the CPU, which has been waiting on exactly one line: the copy back.'],
    [276, '']
  ];
  var LOC = [
    [0, ''], [12, 'HOST · CPU'], [29, 'PCIe 5.0 ×16'], [37, 'GPU · GB205 DIE'], [56, 'SM 10'], [70, 'SM 10 · QUADRANT 0'],
    [91, 'WARP 4 · LANES 0–5'], [113, 'REQUEST · a[2688 … 2719]'], [120, 'L2 CACHE · MISS'], [123.5, 'ON-CHIP NETWORK'], [129.5, 'OFF THE DIE · GDDR7'],
    [140, 'SM 10 · QUADRANT 0'], [169, 'WARP 4 · LANES 0–5'], [229, 'SM 10'], [238, 'GPU · GB205 DIE'], [268, 'THE MACHINE'], [276, '']
  ];
  var ACTS = [[0, 'Cold open'], [12, 'I · The call'], [37, 'II · Birth'], [70, 'III · The warp'], [112, 'IV · The wait'],
              [179, 'V · The fork'], [213, 'VI · Exit'], [229, 'VII · Pull back'], [276, 'Epilogue']];
  var TOTAL = 306;

  /* ============================================================ draw */
  var CODE_LAUNCH = 'mix<<<1024, 256>>>(d_a, d_b, d_c, n);';
  var CODE_COPY = 'cudaMemcpy(c, d_c, bytes, D2H);';
  var qStateCache = '';

  function laneState(t, l) {
    // returns [fill, stroke-width-boost, ringOpacity]
    var odd = (2688 + l) % 2 === 1, flash = function (a, b) { return between(t, a, b); };
    if (t >= 224.5) return ['none', 0];
    if (flash(100, 101.2) || flash(106, 107.2) || flash(112.5, 113.6) || flash(115.5, 116.6) || flash(179, 180.2) || flash(214, 215.2)) return [C.cob, 1];
    if (between(t, 116.6, 172)) return [C.hl, 0, 0.35 + 0.35 * Math.sin((t - 116) * 2.2 + l * 0.2)];
    if (flash(172, 174)) return [C.forest, 1];
    if (between(t, 185, 191)) return [odd ? C.cob : C.hl, 0];
    if (between(t, 191, 200)) return odd ? [C.cob, 1] : [C.warn, 0];
    if (between(t, 200, 208)) return odd ? [C.warn, 0] : [C.cob, 1];
    if (flash(208, 210)) return [C.forest, 0];
    return [C.paper, 0];
  }
  function bannerAt(t) {
    if (t < 99) return '';
    if (t < 105) return '▶ i = blockIdx.x * blockDim.x + threadIdx.x';
    if (t < 111) return '▶ if (i >= n) return;      all 32 inside: nobody leaves';
    if (t < 115) return '▶ LD a[i]      4 sectors, one request';
    if (t < 117) return '▶ LD b[i]      second request in flight';
    if (t < 172) return '… waiting on a[i], b[i]      ' + fmt((realAt(t) - W.ld) * 2.512) + ' cycles';
    if (t < 179) return '✓ data arrived';
    if (t < 185) return '▶ x = a[i] + b[i]';
    if (t < 191) return '▶ if (i % 2)      odd lanes: true · even lanes: false';
    if (t < 200) return '▶ x = x * 3.0f      odd lanes only · even lanes masked';
    if (t < 208) return '▶ x = x + 1.0f      even lanes only · odd lanes masked';
    if (t < 214) return '◆ reconverged: all 32 lanes together';
    if (t < 221) return '▶ ST c[i]      4 sectors · fire and forget';
    if (t < 229) return '■ EXIT';
    return '';
  }

  function draw(t) {
    var real = realAt(t);
    setCam(camAt(t));

    // ---- host
    R.launchLine.textContent = CODE_LAUNCH.slice(0, Math.round(CODE_LAUNCH.length * lin(t, 15, 19)));
    R.copyLine.textContent = CODE_COPY.slice(0, Math.round(CODE_COPY.length * lin(t, 23, 25.5)));
    var cy = t < 23 ? 11 : 12, cl = t < 23 ? R.launchLine : R.copyLine;
    var cw = (cl.textContent.length) * 15.05;
    R.cursor.setAttribute('x', (CPU.x + 72 + cw).toFixed(1)); R.cursor.setAttribute('y', CPU.y + 160 + cy * 40 - 24);
    op(R.cursor, t < 26 && Math.floor(t * 2.5) % 2 === 0 ? 1 : 0);
    var cs = '', cc = C.ink;
    if (t >= 19 && t < 25.5) { cs = 'launch returned in µs · CPU free'; cc = C.forest; }
    else if (t >= 25.5 && t < 274) { cs = 'waiting for the GPU…'; cc = C.ver; }
    else if (t >= 274) { cs = 'copy returned · result on the host ✓'; cc = C.forest; }
    R.cpuStatus.textContent = cs; R.cpuStatus.setAttribute('fill', cc);

    // launch packet: CPU -> dispatch
    var lu = lin(t, 28.8, 36);
    vis(R.launch, t >= 28.8 && t < 37.5);
    R.launch.setAttribute('transform', 'translate(' + lerp(CPU.x + CPU.w - 60, GIGA.x + GIGA.w / 2, ease(lu)).toFixed(1) + ' ' + lerp(1350, GIGA.y + 30, ease(lin(t, 34.5, 36))).toFixed(1) + ')');
    op(R.launch, 1 - lin(t, 36.6, 37.5));
    var du = lin(t, 268, 274);
    vis(R.done, t >= 268 && t < 275.5);
    R.done.setAttribute('transform', 'translate(' + lerp(GIGA.x + GIGA.w / 2, CPU.x + CPU.w - 60, ease(du)).toFixed(1) + ' ' + lerp(GIGA.y + 30, 1350, ease(lin(t, 268, 269.5))).toFixed(1) + ')');
    op(R.done, 1 - lin(t, 274.6, 275.5));

    // ---- blocks follow REAL time
    var waiting = 0, doneN = 0;
    for (var b = 0; b < 1024; b++) {
      var e = R.blocks[b], A = DIST.A[b], L = DIST.L[b];
      if (real < A - 4) { if (real > 2900) waiting++; vis(e, 0); continue; }
      if (real >= L + 6) { doneN++; vis(e, 0); continue; }
      vis(e, 1);
      var p = slotXY(b % 288);
      if (real < A) {
        var u = ease((real - (A - 4)) / 4);
        e.setAttribute('x', lerp(GIGA.x + 80, p[0], u).toFixed(1)); e.setAttribute('y', lerp(GIGA.y + 70, p[1], u).toFixed(1));
        op(e, 0.5 + 0.5 * u);
      } else {
        e.setAttribute('x', p[0]); e.setAttribute('y', p[1]);
        op(e, real < L ? (b === 10 ? 1 : 0.85) : 0.85 * (1 - (real - L) / 6));
        if (real >= L) doneN++;
      }
    }
    R.queueTxt.textContent = real > 2900 && real < KEND ? fmt(waiting) + ' waiting' : '';

    // ---- SM 10 quadrants follow real time too
    R.qrows.forEach(function (q) { op(q.e, real >= DIST.A[q.block] + 2 ? 1 : 0.08); });
    var avail = [];
    R.rows.forEach(function (r, i) {
      var here = real >= DIST.A[r.block] + 2 && real < DIST.L[r.block];
      op(r.g, here ? 1 : 0.12);
      var s = '', fill = C.light, sw = 1.5, stroke = C.rules;
      if (r.mine) {
        if (real < W.first) s = 'ready';
        else if (real < W.ld + 1) s = 'issuing';
        else if (real < W.back) s = 'WAITING · ' + fmt((real - W.ld) * 2.512) + ' cycles';
        else if (real < W.exit) s = 'issuing';
        else s = 'exited';
        stroke = C.ver; sw = 4; fill = real >= W.ld + 1 && real < W.back ? C.warn : C.light;
      } else if (here) { s = 'ready'; avail.push(i); }
      r.st.textContent = s; r.rect.setAttribute('fill', fill); r.rect.setAttribute('stroke', stroke); r.rect.setAttribute('stroke-width', sw);
    });
    var pick = -1, what = '';
    if (between(real, W.ld + 1, W.back - 1) && avail.length) {
      pick = avail[Math.floor(hash(Math.floor(t * 6)) * avail.length)];
      what = 'issuing: ' + R.rows[pick].label + '   · really a new pick every cycle';
      var pr = R.rows[pick];
      pr.rect.setAttribute('fill', C.cob); pr.st.textContent = 'issuing'; pr.st.setAttribute('fill', C.paper);
    }
    R.rows.forEach(function (r, i) { if (i !== pick) r.st.setAttribute('fill', r.mine ? C.ver : C.soft); });
    if (!what) {
      if (real < W.first) what = 'two warps resident · more blocks landing';
      else if (real <= W.ld + 1 || between(real, W.back - 1, W.exit)) what = 'issuing: block 10 · warp 4   ← us';
      else what = 'warp 4 has exited · 11 warps left';
    }
    R.sched.textContent = what;
    op(R.regMine, real >= W.first && real < W.exit ? 0.35 : 0);

    // ---- our lanes
    R.lanes.forEach(function (L2_, l) {
      var s = laneState(t, l);
      L2_.dot.setAttribute('fill', s[0]);
      L2_.dot.setAttribute('stroke-dasharray', t >= 224.5 ? '3 3' : '');
      op(L2_.ring, s[2] || 0);
    });
    R.banner.textContent = bannerAt(t);
    op(R.me, seg(t, 66, 67)); op(R.nb, seg(t, 93, 94));
    R.mask.textContent = between(t, 191, 200) ? 'masked' : '';
    R.mask.setAttribute('x', between(t, 200, 208) ? 127 : 96);
    if (between(t, 200, 208)) R.mask.textContent = 'masked';

    // ---- memory requests
    var pw = clamp(camAt(t)[2] * 0.0125, 1.4, 9), ph = pw * 0.6;
    [R.pa, R.pb, R.ps].forEach(function (arr) { arr.forEach(function (e) { e.setAttribute('width', pw.toFixed(2)); e.setAttribute('height', ph.toFixed(2)); }); });
    for (var k = 0; k < 4; k++) {
      var pa = trip(pathA(k), t, 113 + k * 0.15, 135 + k * 0.2, 150, 172), pb = trip(pathB(k), t, 116 + k * 0.15, 137 + k * 0.2, 152, 172.6);
      vis(R.pa[k], !!pa); if (pa) { R.pa[k].setAttribute('x', (pa[0] - pw / 2).toFixed(2)); R.pa[k].setAttribute('y', (pa[1] - ph / 2).toFixed(2)); }
      vis(R.pb[k], !!pb); if (pb) { R.pb[k].setAttribute('x', (pb[0] - pw / 2).toFixed(2)); R.pb[k].setAttribute('y', (pb[1] - ph / 2).toFixed(2)); }
      var ps = trip(pathA(k), t, 215 + k * 0.1, 224, 1e9, 1e9);
      vis(R.ps[k], !!ps && t < 223.5); if (ps) { R.ps[k].setAttribute('x', (ps[0] - pw / 2).toFixed(2)); R.ps[k].setAttribute('y', (ps[1] - ph / 2).toFixed(2)); }
    }
    op(R.l2miss, seg(t, 119, 120.5) * (1 - seg(t, 138, 140)));
    op(R.dramGlow, seg(t, 134.5, 136) * (1 - seg(t, 150, 152)) * 0.45);
    R.dramNote.textContent = between(t, 134.5, 152) ? 'row opened · 128 bytes read' : '';

    // ---- world fade for the epilogue
    op(world, 1 - 0.85 * seg(t, 276, 282));
  }

  /* ============================================================ HUD */
  var $ = function (id) { return document.getElementById(id); };
  var HUD = { loc: $('f2-loc'), clock: $('f2-clock'), slow: $('f2-slow'), sub: $('f2-sub'), card: $('f2-card'),
              title: $('f2-title'), badge: $('f2-badge'), big: $('f2-bigtext'), end: $('f2-end'), prog: $('f2-prog') };
  var subI = -2, locI = -2;
  var BIG = [
    [0.8, 6, 'Every kernel is a story told 262,144 times at once.'],
    [5.6, 9.2, 'This is one of them.'],
    [277, 283, 'Nobody will remember thread 2,690.'],
    [283, 289, 'That&rsquo;s the design.'],
    [289, 295, 'A GPU is fast precisely because<br>no single thread matters.']
  ];
  function sig2(x) { if (x <= 0) return '—'; var p = Math.pow(10, Math.floor(Math.log10(x)) - 1); return fmt(Math.round(x / p) * p); }
  function hud(t) {
    var i, real = realAt(t), poster = !playing && t < 0.05;
    var si = -1; for (i = 0; i < SUBS.length; i++) if (t >= SUBS[i][0]) si = i;
    if (si !== subI) { subI = si; HUD.sub.innerHTML = si >= 0 ? SUBS[si][1] : ''; HUD.sub.style.visibility = si >= 0 && SUBS[si][1] ? 'visible' : 'hidden'; }
    var li = -1; for (i = 0; i < LOC.length; i++) if (t >= LOC[i][0]) li = i;
    if (li !== locI) { locI = li; HUD.loc.textContent = li >= 0 ? LOC[li][1] : ''; }
    var showClock = t >= 12 && t < 276;
    HUD.clock.parentNode.style.opacity = showClock ? 1 : 0;
    if (t < 20) { HUD.clock.textContent = 'real time  —'; HUD.slow.textContent = 'before the launch'; }
    else {
      HUD.clock.textContent = 'real time  ' + (real < 1000 ? real.toFixed(1) + ' ns' : (real / 1000).toFixed(3) + ' µs');
      HUD.slow.textContent = 'slow motion ×' + sig2(slowmoAt(t));
    }
    var card = seg(t, 66.5, 68) * (1 - seg(t, 83, 84.5));
    var badge = seg(t, 84, 85.5) * (1 - seg(t, 228, 229.5));
    if (HUD.badge) { HUD.badge.style.opacity = badge.toFixed(3); HUD.badge.style.visibility = badge > 0.01 ? 'visible' : 'hidden'; }
    HUD.card.style.opacity = card.toFixed(3); HUD.card.style.visibility = card > 0.01 ? 'visible' : 'hidden';
    var bt = '', bo = 0;
    BIG.forEach(function (b) { if (t >= b[0] && t < b[1]) { bt = b[2]; bo = seg(t, b[0], b[0] + 0.9) * (1 - seg(t, b[1] - 0.7, b[1])); } });
    if (poster) { bt = ''; bo = 0; }
    if (HUD.big.innerHTML !== bt) HUD.big.innerHTML = bt;
    HUD.big.style.opacity = bo.toFixed(3);
    var tt = seg(t, 9.4, 10.6) * (1 - seg(t, 11.6, 12.6));
    if (poster) tt = 1;                            // paused at 0:00: the title card is the poster
    HUD.title.style.opacity = tt.toFixed(3);
    var en = seg(t, 295, 296.5);
    HUD.end.style.opacity = en.toFixed(3); HUD.end.style.visibility = en > 0.01 ? 'visible' : 'hidden';
    // cold open veil
    $('f2-veil').style.opacity = (1 - seg(t, 10.5, 12.5)) * 0.97 + 0.97 * seg(t, 276, 279);
    // progress of the kernel (during the pull back)
    var pr = between(t, 238, 276);
    HUD.prog.style.opacity = pr ? 1 : 0;
    if (pr) {
      var d = 0; for (var b = 0; b < 1024; b++) if (real >= DIST.L[b]) d++;
      HUD.prog.textContent = 'blocks finished  ' + fmt(d) + ' / 1,024';
    }
  }

  /* ============================================================ sound */
  // Everything is synthesized. build(ctx) makes the graph; ev() schedules
  // one-shot events at an absolute ctx time; cont(t) gives continuous targets.
  var EVENTS = (function () {
    var E = [];
    for (var t = 15.1; t < 19; t += 0.13) E.push([t, 'key']);
    for (t = 23.1; t < 25.5; t += 0.13) E.push([t, 'key']);
    E.push([19.2, 'thump'], [28.8, 'whoosh7'], [36.2, 'land']);
    for (var b = 0; b < 11; b++) E.push([filmAt(DIST.A[b]), 'blip']);
    E.push([66, 'birth'], [100, 'tick'], [106, 'tick'], [112.5, 'zap'], [115.5, 'zap'], [120, 'miss'], [135, 'clunk'],
           [150, 'whoosh7'], [172, 'ding'], [179, 'tick'], [185, 'two'], [191, 'thunk'], [200, 'thunk'], [208, 'chord'],
           [214, 'bell'], [221, 'exit'], [266, 'whoosh7'], [274, 'resolve'], [277, 'low'], [289, 'low'], [295, 'final']);
    for (t = 145; t < 166; t += 0.125) E.push([t, 'soft']);
    for (t = 241; t < 266; t += 0.09) E.push([t + 0.04 * hash(t * 10), 'soft']);
    E.sort(function (a, b) { return a[0] - b[0]; });
    return E;
  })();
  function cont(t) {
    // pad level, pad brightness (lowpass Hz), wait-tone level, wait-tone pitch
    var pad = 0.05 * seg(t, 0, 8) + 0.03 * seg(t, 36, 42) - 0.03 * seg(t, 112, 118) + 0.03 * seg(t, 172, 176) + 0.05 * seg(t, 276, 290) - 0.1 * seg(t, 302, 306);
    var cut = 380 + 900 * seg(t, 36, 46) - 700 * seg(t, 112, 125) + 700 * seg(t, 172, 180) + 1400 * seg(t, 276, 296);
    var wait = 0.045 * seg(t, 116.5, 122) * (1 - seg(t, 171, 172.5));
    var pitch = 196 * Math.pow(2, lin(t, 116, 172) * 1.0);
    return [Math.max(0, pad), cut, wait, pitch];
  }
  function buildAudio(ctx) {
    var master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
    var comp = ctx.createDynamicsCompressor(); comp.connect(master);
    var padF = ctx.createBiquadFilter(); padF.type = 'lowpass'; padF.frequency.value = 400; padF.Q.value = 0.7;
    var padG = ctx.createGain(); padG.gain.value = 0; padF.connect(padG); padG.connect(comp);
    [55, 55.35, 82.4, 110.2].forEach(function (f, i) {
      var o = ctx.createOscillator(); o.type = i < 2 ? 'sawtooth' : 'triangle'; o.frequency.value = f;
      var g = ctx.createGain(); g.gain.value = i < 2 ? 0.5 : 0.25; o.connect(g); g.connect(padF); o.start();
    });
    var waitO = ctx.createOscillator(); waitO.type = 'sine'; waitO.frequency.value = 196;
    var waitG = ctx.createGain(); waitG.gain.value = 0; waitO.connect(waitG); waitG.connect(comp); waitO.start();
    var noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), nd = noiseBuf.getChannelData(0);
    for (var i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    return { ctx: ctx, out: comp, padF: padF, padG: padG, waitO: waitO, waitG: waitG, noise: noiseBuf };
  }
  function tone(A, when, f, dur, vol, type, f2) {
    var o = A.ctx.createOscillator(), g = A.ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, when);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, when + dur);
    g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(vol, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g); g.connect(A.out); o.start(when); o.stop(when + dur + 0.05);
  }
  function noise(A, when, dur, vol, f0, f1, q) {
    var s = A.ctx.createBufferSource(); s.buffer = A.noise;
    var bp = A.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q || 1.2;
    bp.frequency.setValueAtTime(f0, when); if (f1) bp.frequency.exponentialRampToValueAtTime(f1, when + dur);
    var g = A.ctx.createGain(); g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(vol, when + Math.min(0.05, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    s.connect(bp); bp.connect(g); g.connect(A.out); s.start(when); s.stop(when + dur + 0.05);
  }
  function ev(A, type, when) {
    switch (type) {
      case 'key': noise(A, when, 0.04, 0.05, 3500, 0, 3); break;
      case 'thump': tone(A, when, 90, 0.5, 0.35, 'sine', 45); noise(A, when, 0.15, 0.08, 800); break;
      case 'whoosh7': noise(A, when, 6.5, 0.07, 300, 2400, 0.8); break;
      case 'land': tone(A, when, 220, 0.4, 0.18, 'triangle', 110); break;
      case 'blip': tone(A, when, 660, 0.12, 0.06, 'square'); break;
      case 'birth': tone(A, when, 523, 1.8, 0.1); tone(A, when + 0.12, 784, 1.8, 0.07); tone(A, when + 0.24, 1047, 1.8, 0.05); break;
      case 'tick': noise(A, when, 0.06, 0.2, 2200, 0, 4); tone(A, when, 880, 0.08, 0.05, 'square'); break;
      case 'soft': noise(A, when, 0.03, 0.035, 2600 + 800 * Math.random(), 0, 5); break;
      case 'zap': tone(A, when, 1200, 0.35, 0.08, 'sawtooth', 300); break;
      case 'miss': tone(A, when, 330, 0.25, 0.08, 'square', 247); break;
      case 'clunk': tone(A, when, 70, 0.6, 0.3, 'sine', 50); noise(A, when, 0.3, 0.1, 400); break;
      case 'ding': tone(A, when, 988, 1.4, 0.12); tone(A, when, 1480, 1.0, 0.05); break;
      case 'two': tone(A, when, 440, 0.3, 0.08, 'triangle'); tone(A, when + 0.3, 466, 0.5, 0.08, 'triangle'); break;
      case 'thunk': tone(A, when, 110, 0.35, 0.25, 'sine', 70); break;
      case 'chord': [262, 330, 392].forEach(function (f) { tone(A, when, f, 1.6, 0.06, 'triangle'); }); break;
      case 'bell': [880, 1320, 1760].forEach(function (f, i) { tone(A, when + i * 0.01, f, 2.2 - i * 0.5, 0.07 / (i + 1)); }); break;
      case 'exit': tone(A, when, 660, 1.6, 0.09, 'sine', 165); break;
      case 'resolve': [196, 247, 294, 392].forEach(function (f) { tone(A, when, f, 2.5, 0.06, 'triangle'); }); break;
      case 'low': tone(A, when, 65, 3.5, 0.12, 'sine'); break;
      case 'final': [131, 196, 262, 330, 392].forEach(function (f, i) { tone(A, when + i * 0.08, f, 7, 0.05, 'triangle'); }); break;
    }
  }
  function setCont(A, t, when, instant) {
    var c = cont(t);
    if (instant) {
      A.padG.gain.setValueAtTime(c[0], when); A.padF.frequency.setValueAtTime(c[1], when);
      A.waitG.gain.setValueAtTime(c[2], when); A.waitO.frequency.setValueAtTime(c[3], when);
    } else {
      A.padG.gain.linearRampToValueAtTime(c[0], when); A.padF.frequency.linearRampToValueAtTime(c[1], when);
      A.waitG.gain.linearRampToValueAtTime(c[2], when); A.waitO.frequency.linearRampToValueAtTime(c[3], when);
    }
  }
  var live = null, soundOn = false;
  function ensureAudio() {
    if (live) { if (live.ctx.state === 'suspended') live.ctx.resume(); return live; }
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    live = buildAudio(new AC()); return live;
  }
  function audioFrame(t0, t1) {
    if (!soundOn || !live || !playing) return;
    var now = live.ctx.currentTime, c = cont(t1);
    live.padG.gain.setTargetAtTime(c[0], now, 0.06); live.padF.frequency.setTargetAtTime(c[1], now, 0.06);
    live.waitG.gain.setTargetAtTime(c[2], now, 0.06); live.waitO.frequency.setTargetAtTime(c[3], now, 0.06);
    if (t1 <= t0 || t1 - t0 > 0.5) return;
    EVENTS.forEach(function (e) { if (e[0] > t0 && e[0] <= t1) ev(live, e[1], now + 0.01); });
  }
  function silence() { if (live) { var n = live.ctx.currentTime; live.padG.gain.setTargetAtTime(0, n, 0.05); live.waitG.gain.setTargetAtTime(0, n, 0.05); } }

  // Offline render for the MP4 export: mono 16-bit WAV, base64.
  function renderAudio(sr) {
    sr = sr || 32000;
    var ctx = new OfflineAudioContext(1, Math.ceil(TOTAL * sr), sr), A = buildAudio(ctx);
    setCont(A, 0, 0, true);
    for (var t = 0.05; t <= TOTAL; t += 0.05) setCont(A, t, t, false);
    EVENTS.forEach(function (e) { ev(A, e[1], e[0]); });
    return ctx.startRendering().then(function (buf) {
      var d = buf.getChannelData(0), n = d.length, ab = new ArrayBuffer(44 + n * 2), v = new DataView(ab);
      function str(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
      str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
      v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true);
      v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 2, true);
      for (var i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 32767, true);
      var bytes = new Uint8Array(ab), bin = '', CH = 0x8000;
      for (i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
      return btoa(bin);
    });
  }

  /* ============================================================ player */
  var T = 0, playing = false, speed = 1, last = null;
  var $play = $('f2-play'), $seek = $('f2-seek'), $time = $('f2-time'), $speed = $('f2-speed'),
      $acts = $('f2-acts'), $big = $('f2-big'), $snd = $('f2-sound'), $fs = $('f2-fs'), $stage = $('f2-stage');
  function mmss(x) { x = Math.floor(x); return Math.floor(x / 60) + ':' + ('0' + (x % 60)).slice(-2); }
  function setTime(t, fromTick) {
    var prev = T;
    T = clamp(t, 0, TOTAL);
    draw(T); hud(T);
    if ($seek) $seek.value = T.toFixed(1);
    if ($time) $time.textContent = mmss(T) + ' / ' + mmss(TOTAL);
    if ($acts) {
      var ai = 0; ACTS.forEach(function (a, i) { if (T >= a[0]) ai = i; });
      [].forEach.call($acts.children, function (b, i) { b.setAttribute('aria-current', i === ai ? 'true' : 'false'); });
    }
    if (T > 0.05 && $big) vis($big, 0);
    audioFrame(fromTick ? prev : T, T);
  }
  function setPlaying(p) {
    playing = p;
    if ($play) { $play.textContent = p ? '❚❚ Pause' : (T >= TOTAL - 0.05 ? '↺ Replay' : '▶ Play'); $play.setAttribute('aria-pressed', p ? 'true' : 'false'); }
    if (p) { last = null; hud(T); requestAnimationFrame(tick); } else { silence(); hud(T); }
  }
  function tick(ts) {
    if (!playing) return;
    if (last != null) {
      var nt = T + (ts - last) / 1000 * speed;
      if (nt >= TOTAL) { setTime(TOTAL, true); setPlaying(false); return; }
      setTime(nt, true);
    }
    last = ts; requestAnimationFrame(tick);
  }
  function toggle() { if (!playing && T >= TOTAL - 0.05) setTime(0); if (soundOn) ensureAudio(); setPlaying(!playing); }

  if ($seek) {
    $seek.max = TOTAL; $seek.step = 0.1;
    ACTS.forEach(function (a, i) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'film-chip'; b.textContent = a[1];
      b.addEventListener('click', function () { setTime(a[0] + 0.01); }); $acts.appendChild(b);
    });
    $play.addEventListener('click', toggle); $big.addEventListener('click', toggle);
    $seek.addEventListener('input', function () { setTime(+$seek.value); });
    $speed.addEventListener('change', function () { speed = +$speed.value; });
    $snd.addEventListener('click', function () {
      soundOn = !soundOn;
      $snd.textContent = soundOn ? '♪ Sound on' : '♪ Sound off';
      $snd.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
      if (soundOn) { var A = ensureAudio(); if (A) setCont(A, T, A.ctx.currentTime, true); } else silence();
    });
    $fs.addEventListener('click', function () {
      if (document.fullscreenElement) document.exitFullscreen();
      else if ($stage.requestFullscreen) $stage.requestFullscreen();
    });
    // On the standalone film page the keys always drive the film. Embedded in a
    // chapter they only do while the film has focus, so the page still scrolls.
    var filmBox = document.getElementById('film'), standalone = document.body.classList.contains('film-page');
    $stage.tabIndex = 0;
    $stage.addEventListener('click', function (e) { if (e.target === $stage || e.target.tagName !== 'BUTTON') $stage.focus({ preventScroll: true }); });
    document.addEventListener('keydown', function (e) {
      var tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (tag === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;   // the button's own click handles it
      if (!standalone && !(filmBox && filmBox.contains(document.activeElement))) return;
      if (e.key === ' ' || e.key === 'k') { e.preventDefault(); toggle(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); var n = ACTS.filter(function (a) { return a[0] > T + 0.5; })[0]; if (n) setTime(n[0] + 0.01); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); var pv = ACTS.filter(function (a) { return a[0] < T - 1.5; }).pop(); setTime(pv ? pv[0] + 0.01 : 0); }
      else if (e.key === 'l') setTime(T + 5); else if (e.key === 'j') setTime(T - 5);
      else if (e.key === 'f') $fs.click(); else if (e.key === 'm') $snd.click();
    });
  }
  var stats = $('f2-stats');
  if (stats) {
    var realTot = KEND + 800, story = 275 - 20;
    stats.innerHTML = '<b>' + (realTot / 1000).toFixed(1) + ' µs</b> of real GPU time, told in <b>' + mmss(story) + '</b> of film' +
      '<br>average slow motion <b>×' + sig2(story / (realTot * 1e-9)) + '</b> &nbsp;·&nbsp; thread 2,690 lived <b>' + fmt(W.exit - DIST.A[10]) + ' ns</b>';
  }
  var m = /t=(\d+(\.\d+)?)/.exec(location.hash);
  setTime(m ? +m[1] : 0);
  setPlaying(false);
  window.Film2 = { setTime: function (t) { setTime(t); }, total: TOTAL, renderAudio: renderAudio, acts: ACTS };
})();
