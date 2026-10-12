/* fig-launch.js — chapter 2, §10, beside the film "Life of a Launch". The same launch, acted out on
   the hardware itself: a bench with a slice of motherboard (the CPU, a PCIe slot), a riser cable, and
   an RTX 5070 board with its cooler off. The GB205 die is drawn about five times too large so its 48
   SMs show: six block slots each, four scheduler lamps, the L2 down the middle, six memory controllers
   wired to six GDDR7 chips. Everything moves from the film's own real-time model (film2.js). */
(function () {
  'use strict';
  var host = document.getElementById('fig-launch');
  if (!host || !window.ISO) return;
  var I = ISO;

  /* ---------- the model: the film's numbers, in real nanoseconds after the call ---------- */
  function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  var NB = 1024, SLOTS = 288, A = [], L = [], b;
  // first wave: one block every 1.4 ns into slots 0..287; a block lives 1.4–1.75 µs; its slot is refilled 25 ns later
  for (b = 0; b < NB; b++) { A[b] = b < SLOTS ? 3050 + b * 1.4 : L[b - SLOTS] + 25; L[b] = A[b] + 1400 + 350 * hash(b); }
  var KEND = Math.max.apply(null, L);
  var ME = 10;                                              // block 10, warp 4, thread 2,690
  var W = { ld: 3090, back: 3890, add: 3894, br: 3896, rec: 3904, st: 3910, exit: 3920 };
  // figure seconds → real ns, piecewise linear; the slope is the slow motion
  var CLOCK = [[0, 0], [1.5, 0], [6.5, 3000], [7.5, 3050], [12, 3080], [14, W.ld], [24, W.back], [26.5, W.br],
               [29.5, W.rec], [32, W.exit], [36, L[ME] + 60], [44, KEND], [48, KEND + 800], [52, KEND + 800]];
  var TOTAL = 52;
  function realAt(t) {
    for (var i = 1; i < CLOCK.length; i++) if (t <= CLOCK[i][0]) {
      var a = CLOCK[i - 1], c = CLOCK[i]; return a[1] + (c[1] - a[1]) * (t - a[0]) / (c[0] - a[0]);
    }
    return CLOCK[CLOCK.length - 1][1];
  }
  function nsPerSecond(t) {
    for (var i = 1; i < CLOCK.length; i++) if (t < CLOCK[i][0]) return (CLOCK[i][1] - CLOCK[i - 1][1]) / (CLOCK[i][0] - CLOCK[i - 1][0]);
    return 0;
  }
  // which block holds slot s at real time r (or -1)
  function inSlot(s, r) {
    var cur = -1;
    for (var k = s; k < NB; k += SLOTS) { if (A[k] <= r) cur = k; else break; }
    return cur >= 0 && r < L[cur] ? cur : -1;
  }
  var ACTS = [
    [0, 'I · The call', 'The CPU calls <code>mix&lt;&lt;&lt;1024, 256&gt;&gt;&gt;</code> and gets on with its life. The launch crosses PCIe to the GPU&rsquo;s front door, the dispatcher next to the PCIe interface: about 3 µs.', 4.2],
    [7.5, 'II · Birth', 'The dispatcher hands out blocks of 256 threads, always whole, to whichever SM has room. Six fit on an SM for this kernel: 288 across the chip. Block 10, with thread 2,690 in it, lands on SM 10.', 12.5],
    [14, 'III · The wait', 'Warp 4 asks for <code>a[i]</code>, then <code>b[i]</code> right behind it. Both miss in L2 and leave the die for a GDDR7 chip: about 800 ns. Meanwhile the rest of the first wave lands, and the schedulers keep issuing whichever warps are ready.', 19.5],
    [24, 'IV · Fork and exit', 'The data is back: add, run both sides of the divergent branch, send the store off without waiting for it, exit. When all of block 10 is done, its slot is freed and block 298 moves in.', 34.5],
    [36, 'V · Pull back', 'The same everywhere: blocks land, warps wait, blocks leave. 1,024 blocks in about 3.6 waves, and the last wave is ragged: some SMs finish early and sit idle.', 41.5],
    [44, 'VI · Done', 'The GPU tells the CPU the kernel is finished. The CPU has been waiting on one line: the copy back.', 46.5]
  ];
  function actAt(t) { var a = 0; for (var i = 0; i < ACTS.length; i++) if (t >= ACTS[i][0]) a = i; return a; }

  /* ---------- camera and card ---------- */
  var Wd = 760, H = 480;
  var MAT = { x: -205, y: -142, w: 274, d: 276, r: 6 };
  var P = I.camera(18, 38);
  var fitPts = [];
  I.corners(MAT, 0).forEach(function (c) { fitPts.push([c[0], c[1], -3], [c[0], c[1], 0]); });
  fitPts.push([-190, -112, 20], [-182, 20, 24], [-55, -127, 32], [55, -127, 32]);
  I.fit(P, fitPts, Wd, H, 14);

  var ui = I.card(host, {
    fig: 'Fig. 7', title: 'Life of a launch, on the hardware', W: Wd, H: H,
    hint: 'Space: play · ← →: acts · point at an SM',
    label: 'An isometric bench: a slice of motherboard with the CPU and a PCIe slot, a riser cable, and an RTX 5070 board with its cooler removed. The GPU die shows 48 SMs, each with six block slots and four scheduler lamps, the L2 cache in the middle and six memory controllers wired to six GDDR7 chips. The launch of mix<<<1024, 256>>> plays out on it.',
    keys: [['lit', 'thread 2,690: its launch, its block, its requests'], ['work', 'a resident block; lit lamp: a scheduler issuing'], ['mempale', 'memory: L2, controllers, GDDR7'], ['mem', 'other warps’ memory traffic']]
  });
  var svg = ui.svg;
  svg.innerHTML = '<defs><filter id="iso-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter></defs>';
  var gCam = I.el('g', {}, svg);
  var gStatic = I.el('g', {}, gCam), gLive = I.el('g', {}, gCam), gTop = I.el('g', {}, gCam), gHit = I.el('g', {}, gCam);

  /* ---------- static: painted by layer (what sits on what), then by depth inside a layer ---------- */
  var items = [];
  function add(layer, q, svgText) { items.push({ k: layer * 1e4 + I.depth(P, q), s: svgText }); }
  function cen(pl, z) { return [pl.x + pl.w / 2, pl.y + pl.d / 2, z || 0]; }
  function slab(layer, pl, z, h, o, steps) { add(layer, cen(pl, z), I.solid(P, I.slab(pl, z, h, steps || 2), o || {})); }
  function topLine(pts, z, tone) { return I.line(P, pts.map(function (q) { return [q[0], q[1], z]; }), tone); }

  // the bench mat: a grid, an inset groove, corner screws, a label plate
  (function () {
    var s = I.halo(P, I.ring(MAT, 6), -3, 12);
    var inner = '', g = I.inset(MAT, 7), v;
    for (v = g.x + 20; v < g.x + g.w - 4; v += 20) inner += topLine([[v, g.y], [v, g.y + g.d]], 0, 'faint');
    for (v = g.y + 20; v < g.y + g.d - 4; v += 20) inner += topLine([[g.x, v], [g.x + g.w, v]], 0, 'faint');
    inner += I.planTop(P, g, 0, 'faint', 4);
    inner += I.sideSeam(P, MAT, -1.5, 'faint', 6);
    s += I.solid(P, I.slab(MAT, -3, 3, 6), { tone: 'lo', inner: inner });
    add(-1, [0, 0, -10], s);
    I.corners(MAT, 4).forEach(function (c) { add(0.5, [c[0], c[1], 0], I.screw(P, c[0], c[1], 0)); });
    add(0.5, [60, -113, 0], I.labelPlate(P, { x: 57.5, y: -130, w: 7.5, d: 34, r: 1 }, 0));
  })();

  /* motherboard slice: x -192..-96, y -112..38 */
  var MB = { x: -192, y: -112, w: 96, d: 202, r: 2 }, MBZ = 3.6;
  [[-188, -108], [-188, 86], [-100, -108], [-100, 86]].forEach(function (c) {
    add(1, [c[0], c[1], 0], I.solid(P, I.cyl(c[0], c[1], 2.6, 0, 2, 16), { tone: 'lo' }));
  });
  slab(1, MB, 2, 1.6, { tone: 'mid', inner: I.sideSeam(P, MB, 2.8, 'faint', 4) });
  (function () {
    var s = '';
    [[-188, -108], [-188, 86], [-100, -108], [-100, 86]].forEach(function (c) { s += I.screw(P, c[0], c[1], MBZ); });
    for (var y = -74; y <= -46; y += 4) s += topLine([[-132, y], [-112.5, y]], MBZ, 'lo');       // CPU → slot lanes
    for (var y2 = -36; y2 <= 4; y2 += 5) s += topLine([[-131, y2], [-131, y2 + 2.6]], MBZ, 'faint');
    s += I.planTop(P, { x: -176, y: -84, w: 48, d: 48, r: 1 }, MBZ, 'faint', 2);                  // socket keep-out
    add(1.5, [-150, -60, MBZ], s);
  })();
  // CPU: socket frame, substrate, heat spreader
  slab(2, { x: -172, y: -80, w: 40, d: 40, r: 1 }, MBZ, 1.6, { mat: 'steel', tone: 'mid' });
  slab(3, { x: -169, y: -77, w: 34, d: 34, r: 0.6 }, MBZ + 1.6, 1, { tone: 'mid' });
  slab(4, { x: -165, y: -73, w: 26, d: 26, r: 1.6 }, MBZ + 2.6, 2.6, { mat: 'steel', tone: 'hi',
    inner: I.planTop(P, { x: -162, y: -70, w: 20, d: 20, r: 1 }, MBZ + 5.2, 'faint', 3) + I.ringTop(P, -162.5, -70.5, 0.8, MBZ + 5.2, 'lo', 10) });
  add(3.5, [-170, -40, MBZ], topLine([[-172, -36], [-150, -36]], MBZ + 1.6, 'lo'));               // retention lever
  // VRM: chokes and capacitors beside the socket
  for (var k = 0; k < 4; k++) {
    var cy = -84 + k * 10;
    slab(2, { x: -190, y: cy, w: 7, d: 7, r: 0.8 }, MBZ, 5.4, { tone: 'mid', inner: I.planTop(P, { x: -189, y: cy + 1, w: 5, d: 5, r: 0.5 }, MBZ + 5.4, 'faint', 2) });
    add(2, [-179, cy + 3.5, MBZ], I.solid(P, I.cyl(-179, cy + 3.5, 1.7, MBZ, 5, 16), { mat: 'steel', tone: 'mid', inner: I.ringTop(P, -179, cy + 3.5, 0.9, MBZ + 5, 'faint', 12) }));
  }
  // chipset heatsink with fins
  slab(2, { x: -152, y: -108, w: 18, d: 18, r: 0.8 }, MBZ, 1.4, { mat: 'steel', tone: 'mid' });
  for (k = 0; k < 6; k++) slab(3, { x: -151 + k * 3, y: -107, w: 1, d: 16, r: 0 }, MBZ + 1.4, 5.6, { mat: 'steel', tone: 'mid' });
  // rear I/O shroud
  slab(2, { x: -191, y: -111, w: 40, d: 12, r: 1.5 }, MBZ, 14, { tone: 'mid', inner: I.sideSeam(P, { x: -191, y: -111, w: 40, d: 12, r: 1.5 }, MBZ + 9, 'faint', 3) });
  // DIMM slots and two DIMMs standing in them
  [8, 20].forEach(function (y0) {
    slab(2, { x: -188, y: y0, w: 72, d: 4, r: 0.4 }, MBZ, 3, { tone: 'mid', inner: topLine([[-187, y0 + 2], [-117, y0 + 2]], MBZ + 3, 'lo') });
    var dimm = '';
    for (var c = 0; c < 8; c++) {
      var x0 = -181 + c * 7.6;
      dimm += I.solid(P, I.box(x0, y0 + 2.6, 5.6, 0.6, MBZ + 7.5, 6.5), { tone: 'lo' });
    }
    var face = topLine([[-184, y0 + 2.6], [-120, y0 + 2.6]], MBZ + 4.4, 'lo');
    add(3, [-152, y0 + 2, MBZ + 3], I.solid(P, I.box(-185, y0 + 1.4, 66, 1.2, MBZ + 3, 16), { tone: 'mid', inner: face }) + dimm);
    slab(3, { x: -190, y: y0 - 0.4, w: 3, d: 4.8, r: 0.3 }, MBZ + 3, 4, { tone: 'lo' });
    slab(3, { x: -117, y: y0 - 0.4, w: 3, d: 4.8, r: 0.3 }, MBZ + 3, 4, { tone: 'lo' });
  });
  // the PCIe x16 slot, and the riser's plug sitting in it
  slab(2, { x: -112, y: -91, w: 8, d: 96, r: 0.6 }, MBZ, 6, { tone: 'mid', inner: topLine([[-108, -89], [-108, 3]], MBZ + 6, 'lo') });
  slab(2, { x: -112, y: 5, w: 8, d: 4, r: 0.6 }, MBZ, 7, { tone: 'lo' });
  var RZ = MBZ + 6;
  slab(3, { x: -113, y: -88, w: 10, d: 90, r: 0.8 }, RZ, 4.6, { mat: 'steel', tone: 'mid',
    inner: I.sideSeam(P, { x: -113, y: -88, w: 10, d: 90, r: 0.8 }, RZ + 2.3, 'faint', 2) + I.screw(P, -108, -84, RZ + 4.6) + I.screw(P, -108, -2, RZ + 4.6) });
  // the riser ribbon: two sloped pieces of flat cable, ridged along its length
  function ribbon(a, bq, layer) {
    var inner = '', th = 0.8;
    for (var yy = -83; yy <= -3; yy += 4) inner += I.line(P, [[a[0], yy, a[2] + th], [bq[0], yy, bq[2] + th]], 'faint');
    add(layer, [(a[0] + bq[0]) / 2, -43, (a[2] + bq[2]) / 2], I.solid(P, I.plate(a, bq, 84, th), { tone: 'mid', inner: inner }));
  }
  ribbon([-103, -43, 11.6], [-84, -43, 4.4], 4);
  ribbon([-84, -43, 4.4], [-68, -43, 6.6], 4);

  // an M.2 SSD lying flat, held by one screw, and the 24-pin power connector at the board's edge
  (function () {
    var m2 = { x: -186, y: 40, w: 62, d: 14, r: 0.8 };
    slab(2, { x: -124, y: 44, w: 3.4, d: 6, r: 0.4 }, MBZ, 1.6, { tone: 'lo' });
    slab(3, m2, MBZ + 0.6, 0.8, { tone: 'mid', inner: I.screw(P, -183, 47, MBZ + 1.4) });
    slab(4, { x: -176, y: 42.5, w: 10, d: 9, r: 0.3 }, MBZ + 1.4, 0.9, { tone: 'lo', inner: I.dots(P, [[-174.6, 44, MBZ + 2.3]], 0.45, 'mid') });
    slab(4, { x: -162, y: 42, w: 14, d: 10, r: 0.3 }, MBZ + 1.4, 0.9, { mat: 'mem', tone: 'mid' });
    slab(4, { x: -145, y: 42, w: 14, d: 10, r: 0.3 }, MBZ + 1.4, 0.9, { mat: 'mem', tone: 'mid' });
    var pins = [];
    for (var i = 0; i < 2; i++) for (var j = 0; j < 12; j++) pins.push([-108.3 + i * 4, 58.6 + j * 2.4, MBZ + 9]);
    var pc = { x: -111, y: 56, w: 10, d: 31, r: 0.8 };
    slab(3, pc, MBZ, 9, { tone: 'mid', inner: I.dots(P, pins, 0.55, 'hi') + I.sideSeam(P, pc, MBZ + 4.5, 'faint', 2) });
    var cs = '';
    for (var y = 44; y <= 84; y += 4) cs += topLine([[-120, y], [-114, y]], MBZ, 'faint');
    add(1.5, [-117, 64, MBZ], cs + I.planTop(P, { x: -190, y: 38, w: 70, d: 18, r: 1 }, MBZ, 'faint', 2));
  })();

  /* the graphics card: PCB x -55..55, y -125..125, on standoffs */
  var PCB = { x: -55, y: -125, w: 110, d: 250, r: 2 }, PZ = 9.6;
  [[-50, -119], [-50, 119], [50, -119], [50, 119]].forEach(function (c) {
    add(1, [c[0], c[1], 0], I.solid(P, I.cyl(c[0], c[1], 2.8, 0, 8, 18), { mat: 'steel', tone: 'mid' }));
  });
  slab(5, PCB, 8, 1.6, { tone: 'mid', inner: I.sideSeam(P, PCB, 8.8, 'faint', 4) });
  (function () {
    var s = '';
    [[-50, -119], [-50, 119], [50, -119], [50, 119]].forEach(function (c) { s += I.screw(P, c[0], c[1], PZ); });
    [[-49, -57], [-49, 57], [49, -57], [49, 57]].forEach(function (c) {                       // cooler mounting holes
      s += I.ringTop(P, c[0], c[1], 2.4, PZ, 'lo', 18) + I.ringTop(P, c[0], c[1], 1.2, PZ, 'faint', 12);
    });
    for (var y = -82; y <= -4; y += 2.6) s += topLine([[-53.5, y], [-50, y]], PZ, 'lo');       // gold fingers (the visible ends)
    for (var y3 = -78; y3 <= -10; y3 += 6) s += topLine([[-49, y3], [-44.5, y3 + 4]], PZ, 'faint'); // PCIe lanes to the package
    // memory traces: substrate edge → each GDDR7 chip
    [-30, 0, 30].forEach(function (cx) {
      [-1, 1].forEach(function (sg) {
        for (var o = -4; o <= 4; o += 2) s += I.line(P, [[cx + o, sg * 52.5, PZ], [cx + o, sg * 60, PZ]], 'mem');
      });
    });
    // small parts' footprints
    s += I.planTop(P, { x: -40, y: -110, w: 80, d: 22, r: 1 }, PZ, 'faint', 2);
    add(5.5, [0, 0, PZ], s);
  })();
  // card-side riser connector, wrapping the card's edge
  slab(6, { x: -68, y: -90, w: 14, d: 94, r: 1 }, 4, 7.6, { mat: 'steel', tone: 'mid',
    inner: I.sideSeam(P, { x: -68, y: -90, w: 14, d: 94, r: 1 }, 7.8, 'faint', 2) + topLine([[-60, -88], [-60, 2]], 11.6, 'lo') });
  // the I/O bracket at the end, and the four display connectors behind it
  slab(6, { x: -52, y: -128, w: 106, d: 2.6, r: 0.4 }, 0.5, 31, { mat: 'steel', tone: 'mid',
    inner: I.screw(P, 48, -125.4, 31.5) + topLine([[-50, -125.4], [52, -125.4]], 31.5, 'faint') });
  [-38, -17, 4, 25].forEach(function (x0, i) {
    var pl = { x: x0, y: -124, w: i === 3 ? 13 : 15, d: 12, r: 0.8 };
    slab(6, pl, PZ, 6.4, { mat: 'steel', tone: 'mid', inner: I.sideSeam(P, pl, PZ + 3.2, 'faint', 2) });
  });
  // small chips: BIOS, the PWM controller, a fan header, a status LED
  slab(6, { x: -36, y: -106, w: 9, d: 7, r: 0.3 }, PZ, 1.1, { tone: 'lo', inner: I.dots(P, [[-34.6, -104.6, PZ + 1.1]], 0.5, 'mid') });
  slab(6, { x: -20, y: -106, w: 11, d: 11, r: 0.3 }, PZ, 1.2, { tone: 'lo', inner: I.dots(P, [[-18.6, -104.6, PZ + 1.2]], 0.5, 'mid') });
  slab(6, { x: 0, y: -104, w: 6, d: 12, r: 0.4 }, PZ, 4, { tone: 'mid', inner: I.dots(P, [[3, -102, PZ + 4], [3, -98.7, PZ + 4], [3, -95.3, PZ + 4], [3, -92, PZ + 4]], 0.55, 'hi') });
  add(6, [24, -98, PZ], I.solid(P, I.box(22, -100, 3, 2, PZ, 1.2), { mat: 'workx', tone: 'mid' }));
  slab(6, { x: 30, y: -108, w: 16, d: 9, r: 0.5 }, PZ, 1.2, { tone: 'lo' });
  // label sticker
  add(6, [8, 112, PZ], I.labelPlate(P, { x: 30, y: 82, w: 18, d: 30, r: 1 }, PZ));
  // power stage: two rows of chokes, a row of capacitors, the 12V-2x6 connector
  [-44, -30, -16, -2, 12].forEach(function (x0) {
    [86, 98].forEach(function (y0) {
      slab(6, { x: x0, y: y0, w: 9, d: 9, r: 0.8 }, PZ, 6.4, { tone: 'mid', inner: I.planTop(P, { x: x0 + 1.2, y: y0 + 1.2, w: 6.6, d: 6.6, r: 0.6 }, PZ + 6.4, 'faint', 2) });
    });
    add(6, [x0 + 4.5, 113, PZ], I.solid(P, I.cyl(x0 + 4.5, 113, 2.6, PZ, 7, 18), { mat: 'steel', tone: 'mid',
      inner: I.ringTop(P, x0 + 4.5, 113, 1.4, PZ + 7, 'faint', 14) + I.arcFront(P, x0 + 4.5, 113, 2.6, PZ + 5.6, 'faint') }));
  });
  (function () {
    var pl = { x: 33, y: 100, w: 12, d: 22, r: 1 }, pins = [];
    for (var i = 0; i < 2; i++) for (var j = 0; j < 6; j++) pins.push([35.5 + i * 7, 102.8 + j * 3.3, PZ + 9]);
    slab(6, pl, PZ, 9, { tone: 'mid', inner: I.dots(P, pins, 0.75, 'hi') + I.sideSeam(P, pl, PZ + 4, 'faint', 2) });
  })();
  // six GDDR7 chips, 2 GB each: a 192-bit bus
  var CHIPS = [];
  [-30, 0, 30].forEach(function (cx) {
    [-1, 1].forEach(function (sg) {
      var pl = { x: cx - 7, y: sg > 0 ? 60 : -72, w: 14, d: 12, r: 0.6 };
      CHIPS.push({ x: cx, y: sg * 66 });
      slab(6, pl, PZ, 1.2, { mat: 'mem', tone: 'mid', inner: I.planTop(P, I.inset(pl, 1.2), PZ + 1.2, 'faint', 2) + I.ringTop(P, pl.x + 2, pl.y + 2, 0.6, PZ + 1.2, 'mem', 10) });
    });
  });
  // the package: substrate with its capacitor field, then the die
  var SUB = { x: -44, y: -52, w: 88, d: 104, r: 2 }, SZ = PZ + 1.2;
  slab(6, SUB, PZ, 1.2, { tone: 'mid' });
  (function () {
    var caps = [];
    for (var y = -48; y <= 48; y += 3) { caps.push([-40.5, y, SZ], [40.5, y, SZ]); }
    for (var x = -32; x <= 32; x += 4) { if (Math.abs(x) > 10) { caps.push([x, -48.5, SZ], [x, 48.5, SZ]); } }
    var s = I.dots(P, caps, 0.6, 'lo');
    [-24, 0, 24].forEach(function (cx) {
      [-1, 1].forEach(function (sg) { for (var o = -4; o <= 4; o += 2) s += I.line(P, [[cx + o, sg * 45, SZ], [cx + o, sg * 52, SZ]], 'mem'); });
    });
    add(6.5, [0, 0, SZ], s);
  })();
  var DIE = { x: -36, y: -45, w: 72, d: 90, r: 0.5 }, DZ = SZ + 1.2;
  slab(7, DIE, SZ, 1.2, { mat: 'steel', tone: 'hi', inner: I.planTop(P, I.inset(DIE, 0.8), DZ, 'faint', 2) });
  // on the die: PCIe interface and the dispatcher at the far edge, L2 down the middle, memory controllers at the ends
  var GIGA = { x: -35, y: -10, w: 4, d: 20, r: 0.3 }, PHY = { x: -35, y: -40, w: 3.4, d: 24, r: 0.3 };
  slab(7.5, PHY, DZ, 0.6, { mat: 'steel', tone: 'mid', inner: (function () { var s = ''; for (var y = -38; y <= -18; y += 2.5) s += topLine([[-34.4, y], [-32.2, y]], DZ + 0.6, 'faint'); return s; })() });
  slab(7.5, GIGA, DZ, 0.9, { tone: 'hi', inner: I.planTop(P, I.inset(GIGA, 0.7), DZ + 0.9, 'lo', 2) });
  [{ x: -3, y: -38.4, w: 6, d: 37.6, r: 0.3 }, { x: -3, y: 0.8, w: 6, d: 37, r: 0.3 }].forEach(function (pl) {
    var inner = '';
    for (var y = pl.y + 2.4; y < pl.y + pl.d - 1; y += 2.4) inner += topLine([[pl.x + 0.5, y], [pl.x + pl.w - 0.5, y]], DZ + 0.6, 'mem');
    inner += topLine([[0, pl.y + 0.5], [0, pl.y + pl.d - 0.5]], DZ + 0.6, 'mem');
    slab(7.5, pl, DZ, 0.6, { mat: 'mem', tone: 'mid', inner: inner });
  });
  [-24, 0, 24].forEach(function (cx) {
    [-1, 1].forEach(function (sg) {
      var pl = { x: cx - 7, y: sg > 0 ? 40.6 : -44.2, w: 14, d: 3.6, r: 0.3 };
      slab(7.5, pl, DZ, 0.6, { mat: 'mem', tone: 'mid', inner: topLine([[cx - 5.5, pl.y + 1.8], [cx + 5.5, pl.y + 1.8]], DZ + 0.6, 'mem') });
    });
  });
  slab(7.5, { x: 31, y: -30, w: 4, d: 26, r: 0.3 }, DZ, 0.6, { tone: 'mid' });                // display engine
  slab(7.5, { x: 31, y: 4, w: 4, d: 26, r: 0.3 }, DZ, 0.6, { tone: 'mid' });                  // media engines

  // the 48 SMs: 24 on each side of the L2, 3 rows × 8; six block slots and four scheduler lamps each
  var TZ = DZ + 1.2;
  function tileOf(s) {
    var half = s < 24 ? 0 : 1, m = s % 24, row = Math.floor(m / 8), col = m % 8;
    return { x: half ? 4 + row * 9 : -30 + row * 9, y: -38.4 + col * 9.6, w: 8, d: 9, r: 0.4 };
  }
  function slotAt(s, p) { var t = tileOf(s); return [t.x + 0.8 + Math.floor(p / 3) * 3.1, t.y + 0.9 + (p % 3) * 2.75]; }
  for (var sm = 0; sm < 48; sm++) {
    var tl = tileOf(sm), inner = '';
    for (var p = 0; p < 6; p++) { var q = slotAt(sm, p); inner += I.planTop(P, { x: q[0], y: q[1], w: 2.3, d: 2.2, r: 0.2 }, TZ, 'faint', 1); }
    inner += topLine([[tl.x + 6.7, tl.y + 0.6], [tl.x + 6.7, tl.y + 8.4]], TZ, 'faint');
    slab(8, tl, DZ, 1.2, { mat: 'work', tone: 'mid', inner: inner });
  }
  items.sort(function (a, c) { return a.k - c.k; });
  I.group(items.map(function (it) { return it.s; }).join(''), gStatic);

  /* ---------- live parts ---------- */
  // block pegs: one per slot, coloured by who is in it
  var pegs = [];
  for (var s2 = 0; s2 < SLOTS; s2++) {
    var smi = s2 % 48, pos = Math.floor(s2 / 48), at = slotAt(smi, pos);
    var g = I.group(I.solid(P, I.box(at[0] + 0.1, at[1] + 0.1, 2.1, 2.0, TZ, 1.3), { mat: 'workx', tone: 'mid' }), null);
    pegs.push({ s: s2, node: g, sol: g.firstChild, key: I.depth(P, [at[0], at[1], TZ]), who: -2, dz: -1, op: -1 });
  }
  pegs.sort(function (a, c) { return a.key - c.key; }).forEach(function (pg) { gLive.appendChild(pg.node); });
  // scheduler lamps: four per SM
  var lamps = [];
  for (sm = 0; sm < 48; sm++) {
    var tt = tileOf(sm);
    for (var qd = 0; qd < 4; qd++) {
      var lp = I.p(P, [tt.x + 7.35, tt.y + 1.3 + qd * 2.15, TZ]);
      lamps.push({ sm: sm, q: qd, on: null, node: I.el('circle', { cx: lp[0].toFixed(1), cy: lp[1].toFixed(1), r: 0.95, class: 'dt lo' }, gLive) });
    }
  }
  // SM 10 rim, the L2 miss mark, the waiting mark on the GDDR7 chip
  var T10 = tileOf(10);
  var rim10 = I.group(I.planTop(P, I.inset(T10, -0.5), TZ, 'litl', 1), gLive);
  var CH = { x: -7, y: -72, w: 14, d: 12, r: 0.6 };                         // the chip that holds a[2690]
  var missMark = I.group(I.planTop(P, { x: -3.6, y: -17.6, w: 7.2, d: 6, r: 0.4 }, DZ + 0.6, 'meml', 1), gLive);
  var chipMark = I.group(I.planTop(P, I.inset(CH, -1), PZ + 1.2, 'meml', 2), gLive);
  // background memory traffic: dots running along each chip's traces
  var traffic = [];
  [-30, 0, 30].forEach(function (cx, ci) {
    [-1, 1].forEach(function (sg) {
      for (var n = 0; n < 3; n++) {
        traffic.push({ cx: cx, sg: sg, n: n, off: hash(ci * 7 + n + (sg > 0 ? 3 : 0)), node: I.el('circle', { r: 1.15, class: 'dt mem' }, gTop) });
      }
    });
  });
  // packets: our launch, our block in flight, our two loads, our store, the completion
  function packet(mat) {
    var o = mat ? { mat: mat, tone: 'mid' } : { lit: true, tone: 'mid' };
    return I.group(I.solid(P, I.box(-1.5, -1.5, 3, 3, 0, 1.8), o), gTop);
  }
  var pkLaunch = packet(), pkBlock = packet(), pkA = packet(), pkB = packet(), pkSt = packet(), pkDone = packet();
  function route(pts) {
    var acc = [0];
    for (var i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]));
    return { pts: pts, acc: acc, len: acc[acc.length - 1] };
  }
  function along(R, u) {
    var d = Math.max(0, Math.min(1, u)) * R.len, i = 1;
    while (i < R.acc.length - 1 && R.acc[i] < d) i++;
    var a = R.pts[i - 1], c = R.pts[i], f = (d - R.acc[i - 1]) / ((R.acc[i] - R.acc[i - 1]) || 1);
    return [a[0] + (c[0] - a[0]) * f, a[1] + (c[1] - a[1]) * f, a[2] + (c[2] - a[2]) * f];
  }
  var HOSTR = route([[-151, -60, MBZ + 5.4], [-151, -60, MBZ + 5.4], [-133, -60, MBZ + 0.4], [-114.5, -60, MBZ + 0.4], [-114.5, -60, RZ + 5], [-104, -60, RZ + 5],
                     [-103, -60, 12.6], [-84, -60, 5.4], [-69, -60, 7.4], [-67, -60, 12.2], [-55, -60, 12.2], [-51, -60, PZ + 0.4], [-44.5, -40, SZ + 0.4],
                     [-36.5, -28, DZ + 0.4], [-33.3, -28, DZ + 0.8], [-33.3, -1.5, DZ + 1.1]]);
  var c10 = [T10.x + 4, T10.y + 4.5];
  var MEMR = route([[c10[0], c10[1], TZ + 0.3], [-3.5, c10[1], DZ + 0.8], [-1.5, c10[1], DZ + 0.8], [-1.5, -40, DZ + 0.8], [-1.5, -42.4, DZ + 0.8],
                    [-1.5, -46, SZ + 0.3], [-1.5, -53, PZ + 0.3], [-1.5, -60, PZ + 0.3], [-1.5, -66, PZ + 1.4]]);
  var GIGAP = [-33.3, -1.5, DZ + 1.1];
  // where along MEMR the packet is, as a function of real time (staged split of the ~800 ns, as in the film)
  var MEMT = [[W.ld, 0], [W.ld + 10, 0.2], [W.ld + 35, 0.2], [W.ld + 60, 0.55], [W.ld + 95, 1], [W.back - 190, 1], [W.back - 130, 0.55], [W.back - 40, 0.2], [W.back, 0]];
  function memU(r) {
    if (r < MEMT[0][0] || r > MEMT[MEMT.length - 1][0]) return -1;
    for (var i = 1; i < MEMT.length; i++) if (r <= MEMT[i][0]) {
      var a = MEMT[i - 1], c = MEMT[i]; return a[1] + (c[1] - a[1]) * (r - a[0]) / (c[0] - a[0]);
    }
    return -1;
  }
  function place(node, q, show) {
    node.style.display = show ? '' : 'none';
    if (show) node.setAttribute('transform', I.tr(P, q));
  }

  // hover targets: one per SM, to read its slots
  var hoverSM = -1;
  for (sm = 0; sm < 48; sm++) {
    var tq = tileOf(sm), hp = I.hull([[tq.x, tq.y], [tq.x + tq.w, tq.y], [tq.x + tq.w, tq.y + tq.d], [tq.x, tq.y + tq.d]].map(function (c) { return I.p(P, [c[0], c[1], TZ]); }));
    var hit = I.el('path', { d: I.d(hp, true), fill: 'transparent', 'data-hot': '', 'data-sm': sm }, gHit);
    hit.addEventListener('pointerenter', function () { hoverSM = +this.getAttribute('data-sm'); draw(); });
    hit.addEventListener('pointerleave', function () { hoverSM = -1; draw(); });
  }

  /* ---------- camera: the bench, or close on the package (a 2D zoom: the projection is orthographic) ---------- */
  var BENCH = { z: 1, c: [Wd / 2, H / 2] };
  var DIEV = (function () {
    var a = I.p(P, [-50, -80, PZ]), c = I.p(P, [50, 80, PZ]), m = I.p(P, [0, 0, PZ]);
    var z = 0.86 * Math.min(0.94 * Wd / Math.abs(c[0] - a[0] + 0.0001), 1.02 * H / Math.abs(c[1] - a[1] + 0.0001));
    return { z: Math.max(1, z), c: [m[0], m[1] - 6] };
  })();
  var cam = { k: 0, mode: 'auto' };
  var CAMK = [0, 1, 1, 1, 0, 0];                    // per act: 0 bench, 1 die
  function camTarget() { return cam.mode === 'bench' ? 0 : cam.mode === 'die' ? 1 : CAMK[actAt(T)]; }
  function applyCam() {
    var k = cam.k, z = BENCH.z + (DIEV.z - BENCH.z) * k;
    var cx = BENCH.c[0] + (DIEV.c[0] - BENCH.c[0]) * k, cy = BENCH.c[1] + (DIEV.c[1] - BENCH.c[1]) * k;
    gCam.setAttribute('transform', 'translate(' + (Wd / 2).toFixed(1) + ' ' + (H / 2).toFixed(1) + ') scale(' + z.toFixed(4) + ') translate(' + (-cx).toFixed(2) + ' ' + (-cy).toFixed(2) + ')');
  }

  /* ---------- the act line and the controls, under the card ---------- */
  var actP = document.createElement('p'); actP.className = 'iso-act';
  host.insertBefore(actP, host.querySelector('.iso-keys'));
  var ctl = document.createElement('div'); ctl.className = 'iso-ctl';
  ctl.innerHTML = '<span class="grp"><button type="button" data-play>Pause</button></span><span class="grp">' +
    ACTS.map(function (a, i) { return '<button type="button" data-act="' + i + '">' + a[1].replace(/^[IVX]+ · /, '') + '</button>'; }).join('') + '</span>' +
    '<span class="grp">Camera <button type="button" data-cam="auto">Follow</button><button type="button" data-cam="bench">Bench</button><button type="button" data-cam="die">Die</button></span>';
  host.insertBefore(ctl, host.querySelector('.iso-keys'));
  var playBtn = ctl.querySelector('[data-play]');

  /* ---------- drawing a moment ---------- */
  var calm = I.still();
  var T = 0, playing = !calm, lastAct = -1;
  function smooth(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
  function fmtT(r) { return r < 1000 ? Math.round(r) + ' ns' : (r / 1000).toFixed(3) + ' µs'; }
  function slowWords(t) {
    var v = nsPerSecond(t);
    if (!(v > 0)) return '';
    var f = 1e9 / v;
    return f >= 1e9 ? '×' + (f / 1e9).toFixed(1) + 'B slow-mo' : '×' + Math.round(f / 1e6) + 'M slow-mo';
  }
  function draw() {
    var r = realAt(T), resident = 0, done = 0, perSM = [], i;
    for (i = 0; i < 48; i++) perSM.push([]);
    for (i = 0; i < NB; i++) { if (L[i] <= r) done++; else if (A[i] <= r) resident++; }
    pegs.forEach(function (pg) {
      var who = inSlot(pg.s, r), dz = 0, op = 1;
      if (who >= 0) {
        perSM[pg.s % 48].push(who);
        var land = smooth((r - A[who]) / 5);
        dz = (1 - land) * 7; op = land * smooth((L[who] - r) / 8 + 0.2);
        if (who === ME) { var fl = smooth((r - (A[ME] - 12)) / 12); dz = 0; op = fl >= 1 ? 1 : 0; }
      } else op = 0;
      if (who !== pg.who) { pg.who = who; pg.sol.setAttribute('class', who === ME ? 'iso-sol lit' : 'iso-sol m-workx'); }
      if (Math.abs(op - pg.op) > 0.01) { pg.op = op; pg.node.style.opacity = op.toFixed(2); pg.node.style.display = op < 0.02 ? 'none' : ''; }
      if (Math.abs(dz - pg.dz) > 0.02) { pg.dz = dz; pg.node.setAttribute('transform', I.tr(P, [0, 0, dz])); }
    });
    var tick6 = Math.floor(T * 7);
    lamps.forEach(function (lm) {
      var n = perSM[lm.sm].length;
      var on = n > 0 && hash(lm.sm * 4 + lm.q + tick6 * 13.7) < 0.18 + 0.1 * n;
      if (on !== lm.on) { lm.on = on; lm.node.setAttribute('class', on ? 'dt work' : 'dt lo'); }
    });
    // our block's flight from the dispatcher, our loads, our store
    var f = (r - (A[ME] - 12)) / 12;
    if (f > 0 && f < 1) {
      var s10 = slotAt(10, 0), e = smooth(f);
      place(pkBlock, [GIGAP[0] + (s10[0] + 1.1 - GIGAP[0]) * e, GIGAP[1] + (s10[1] + 1 - GIGAP[1]) * e, TZ + 6 * Math.sin(Math.PI * e)], true);
    } else place(pkBlock, null, false);
    var ua = memU(r), ub = memU(r - 4);
    place(pkA, ua >= 0 ? along(MEMR, ua) : null, ua >= 0);
    place(pkB, ub >= 0 && r - 4 >= W.ld ? along(MEMR, ub) : null, ub >= 0 && r - 4 >= W.ld);
    var us = (r - W.st) / 30;
    place(pkSt, us >= 0 && us < 1 ? along(route([[c10[0], c10[1], TZ + 0.3], [-3.5, c10[1], DZ + 0.8], [-1.5, c10[1], DZ + 0.8]]), smooth(us)) : null, us >= 0 && us < 1);
    pkSt.style.opacity = us >= 0 && us < 1 ? (1 - smooth((us - 0.7) / 0.3)).toFixed(2) : '1';
    var ul = r / 3000;
    place(pkLaunch, r > 0 && r <= 3050 ? along(HOSTR, smooth(Math.min(1, ul))) : null, T >= 1.5 && r <= 3050);
    var ud = (r - KEND) / 800;
    place(pkDone, ud > 0 && ud < 1.001 ? along(HOSTR, 1 - smooth(ud)) : null, ud > 0 && T < TOTAL - 1.5);
    rim10.style.display = A[ME] <= r && r < L[ME] ? '' : 'none';
    missMark.style.display = r >= W.ld + 10 && r < W.ld + 35 ? '' : 'none';
    chipMark.style.display = r >= W.ld + 95 && r < W.back - 190 ? '' : 'none';
    // other warps' memory traffic: denser the more blocks are resident
    var dens = resident / SLOTS;
    traffic.forEach(function (d) {
      var show = dens > 0.02 && d.n < Math.ceil(dens * 3);
      d.node.style.display = show ? '' : 'none';
      if (!show) return;
      var u = (T * 0.45 + d.off) % 1, out = (d.n % 2) === 0, y = out ? 52.5 + 8 * u : 60 - 8 * u;
      var sp = I.p(P, [d.cx + (d.n - 1) * 2.5, d.sg * y, PZ + 0.5]);
      d.node.setAttribute('cx', sp[0].toFixed(1)); d.node.setAttribute('cy', sp[1].toFixed(1));
    });
    // readout
    if (hoverSM >= 0) {
      var list = perSM[hoverSM].slice().sort(function (a, c) { return a - c; });
      ui.readout.textContent = 'SM ' + hoverSM + ' · ' + (list.length ? list.length + ' block' + (list.length > 1 ? 's' : '') + ': ' + list.join(', ') : 'idle') + ' · ' + fmtT(r);
    } else {
      var sw = slowWords(T);
      ui.readout.textContent = fmtT(r) + (sw ? ' · ' + sw : '') + ' · ' + resident + ' resident · ' + done.toLocaleString('en-US') + '/1,024 done';
    }
    var ai = actAt(T);
    if (ai !== lastAct) {
      lastAct = ai;
      actP.innerHTML = '<b>' + ACTS[ai][1] + '.</b> ' + ACTS[ai][2];
      ui.live.textContent = ACTS[ai][1] + '. ' + actP.textContent.replace(/^[^.]*\.\s*/, '');
      ctl.querySelectorAll('[data-act]').forEach(function (bt) { bt.setAttribute('aria-pressed', String(+bt.dataset.act === ai)); });
    }
  }

  /* ---------- time, controls, keys ---------- */
  function setPlaying(on) { playing = on && !calm; playBtn.textContent = playing ? 'Pause' : 'Play'; playBtn.setAttribute('aria-pressed', String(playing)); kick(); }
  function setCam(m) {
    cam.mode = m;
    ctl.querySelectorAll('[data-cam]').forEach(function (bt) { bt.setAttribute('aria-pressed', String(bt.dataset.cam === m)); });
    if (calm) { cam.k = camTarget(); applyCam(); } else kick();
  }
  function goAct(i) { i = (i + ACTS.length) % ACTS.length; T = calm ? ACTS[i][3] : ACTS[i][0] + 0.01; if (calm) { cam.k = camTarget(); applyCam(); } draw(); kick(); }
  ctl.addEventListener('click', function (e) {
    var bt = e.target.closest('button'); if (!bt) return;
    if (bt.hasAttribute('data-play')) setPlaying(!playing);
    else if (bt.dataset.cam) setCam(bt.dataset.cam);
    else goAct(+bt.dataset.act);
  });
  ui.stage.tabIndex = 0;
  ui.stage.setAttribute('role', 'group');
  ui.stage.setAttribute('aria-label', 'Launch figure. Space plays or pauses, left and right arrows jump between the six acts.');
  ui.stage.addEventListener('keydown', function (e) {
    if (e.key === ' ' || e.key === 'k') setPlaying(!playing);
    else if (e.key === 'ArrowRight') goAct(actAt(T) + 1);
    else if (e.key === 'ArrowLeft') goAct(actAt(T) - (T - ACTS[actAt(T)][0] > 1.5 ? 0 : 1));
    else if (e.key === 'Home') goAct(0);
    else return;
    e.preventDefault();
  });
  if (calm) playBtn.disabled = true;

  var frame = 0, last = 0, visible = false;
  function tick(now) {
    var dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60; last = now;
    if (playing) { T += dt; if (T >= TOTAL) T = 0; }
    var kt = camTarget();
    cam.k = Math.abs(kt - cam.k) < 0.002 ? kt : cam.k + (kt - cam.k) * (1 - Math.exp(-dt / 0.55));
    applyCam();
    draw();
    frame = visible && (playing || cam.k !== kt) ? requestAnimationFrame(tick) : 0;
  }
  function kick() { if (!frame && visible && (playing || cam.k !== camTarget())) { last = 0; frame = requestAnimationFrame(tick); } }
  new IntersectionObserver(function (es) { visible = es[es.length - 1].isIntersecting; if (visible) kick(); }, { rootMargin: '120px 0px' }).observe(ui.stage);

  if (calm) T = ACTS[2][3];
  setPlaying(!calm);
  setCam('auto');
  cam.k = camTarget(); applyCam();
  draw();
  window.FigLaunch = { at: function (t, m) { T = t; if (m) cam.mode = m; setPlaying(false); cam.k = camTarget(); applyCam(); draw(); }, total: TOTAL };

  var cap = document.createElement('p'); cap.className = 'iso-cap';
  cap.innerHTML = '<b>Fig. 7</b> &mdash; The film&rsquo;s launch on the real parts. The motherboard slice holds the CPU, the RTX 5070 lies on the bench with its cooler off, wired to the PCIe x16 slot by a riser cable, and its six GDDR7 chips sit around the package: 12 GB on a 192-bit bus. ' +
    'It runs on the film&rsquo;s numbers: 48 SMs, six blocks per SM, 288 resident, 1,024 blocks in about 3.6 waves, and the clock is real GPU time. <b>Not to scale:</b> the die is drawn about five times too large so its SMs show, and its floorplan is simplified to a grid; the real GB205 groups its SMs into GPCs. ' +
    'As in the film, the exact nanosecond timings, which chip holds <code>a[2690]</code>, the route a request takes and when each scheduler lamp lights are staged, not measured.';
  host.appendChild(cap);
})();
