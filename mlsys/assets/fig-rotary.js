/* fig-rotary.js — chapter 6, §6 "GPT-2 small, counted". One decode step as a rotary press.
   The plate cylinder carries the weights: it must turn once per step, and one turn reads all
   124.4M parameters from DRAM. The B sheets fed through on that turn are the B sequences of the
   batch, each getting one new token; each lane also has its own ink roller, its KV cache, which
   it reads alone. Step time = linear layers + attention, each at its roofline time, with the
   same constants as the op census below (88% of 672 GB/s, 30.9 / 61.7 TFLOPS, t = 256). */
(function () {
  'use strict';
  var host = document.getElementById('fig-rotary');
  if (!host || !window.ISO) return;
  var I = ISO;

  /* ---------- the model (truth first: the census's two big rows) ---------- */
  var PARAMS = 124439808, LIN_FLOPS = 247e6;          // §6: parameters; 170 + 77 MFLOPs per token in the linear layers and head
  var C = 768, L = 12, T_CTX = 256;                    // width, layers, context already cached (the census default)
  var BW = 672e9 * 0.88;                               // the census: 88% of 672 GB/s
  var FMT = { fp32: { label: 'FP32', bytes: 4, peak: 30.9e12 }, fp16: { label: 'FP16', bytes: 2, peak: 61.7e12 } };
  var BATCH = [1, 8, 64, 256];
  var SLOW = 1500;                                     // film seconds per real second: 1 ms of GPU time = 1.5 s here
  var LANES = 8;
  function model(B, f) {
    var F = FMT[f];
    var linMem = PARAMS * F.bytes / BW, linComp = LIN_FLOPS * B / F.peak;
    var kv = B * F.bytes * C * (2 * T_CTX + 4) * L / BW, kvComp = B * 4 * T_CTX * C * L / F.peak;
    var lin = Math.max(linMem, linComp), attn = Math.max(kv, kvComp), step = lin + attn;
    var bound = attn > lin ? 'memory-bound on the KV cache' : (linComp > linMem ? 'compute-bound' : 'memory-bound on the weights');
    return { step: step, tps: B / step, lin: lin, attn: attn, linMem: linMem, linComp: linComp, bound: bound };
  }

  /* ---------- world ---------- */
  var W = 640, H = 380;
  var P = I.camera(58, 30);
  var BASE = { x: -80, y: -150, w: 186, d: 336, r: 8 };
  var ZP = 50, RP = 20, ZI = 18, RI = 12, XF = 60;    // plate and impression cylinders, frame inner faces at x = ±60
  var NIP = 30;                                        // sheet height at the nip
  var RY = -12, RZ = 74.2, RR = 7;                       // ink rollers, tangent to the plate behind its top
  I.fit(P, [[-80, -150, -16], [106, -150, -16], [106, 186, -16], [-80, 186, -16], [-66, -50, 86], [66, 50, 86], [94, -32, 62], [-66, -48, 86]], W, H, 14);

  var ui = I.card(host, {
    fig: 'Fig. 5', title: 'One decode step, as a rotary press', W: W, H: H,
    hint: 'Turn the knobs: click them, or ← → and ↑ ↓',
    label: 'An isometric rotary press between two side frames. The plate cylinder carries the model weights and turns once per decode step; sheets fed side by side are the sequences of the batch and come out printed with one new token each. Each lane has its own small ink roller, its KV cache. Knobs set the batch size and the number format; a gauge shows tokens per second.',
    keys: [['work', 'printed sheet: one new token per sequence'], ['mempale', 'plate cylinder: all the weights, read once per turn'], ['mem', 'ink roller in use: one sequence’s own KV cache'], ['lit', 'the gauge: tokens per second']]
  });
  var svg = ui.svg;
  svg.innerHTML = '<defs><filter id="iso-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter></defs>';
  var gBase = I.el('g', {}, svg), gL0 = I.el('g', {}, svg), gL1 = I.el('g', {}, svg), gL2 = I.el('g', {}, svg), gL3 = I.el('g', {}, svg), gL4 = I.el('g', {}, svg);

  function byDepth(pts) { return pts.slice().sort(function (a, b) { return I.depth(P, [a[0], a[1], 0]) - I.depth(P, [b[0], b[1], 0]); }); }
  function laneX(i) { return -52 + 6.5 + i * 13; }
  // a circle in a plane x = const (the outer face of a gear or a boss)
  function sideCircle(x, cy, cz, r, steps) {
    var out = []; steps = steps || 40;
    for (var i = 0; i <= steps; i++) { var a = 2 * Math.PI * i / steps; out.push(I.p(P, [x, cy + r * Math.cos(a), cz + r * Math.sin(a)])); }
    return out;
  }
  // the visible half of a band round a drum lying along x
  function bandFront(x, cy, cz, r) {
    var V0 = I.view(P), pts = [];
    for (var i = 0; i <= 48; i++) {
      var a = 2 * Math.PI * i / 48;
      if (Math.cos(a) * V0[1] + Math.sin(a) * V0[2] >= 0) pts.push(I.p(P, [x, cy + r * Math.cos(a), cz + r * Math.sin(a)]));
      else if (pts.length) break;
    }
    // walk the other way round from 0 to join the visible arc into one run
    var pre = [];
    for (i = 47; i > 0; i--) { a = 2 * Math.PI * i / 48; if (Math.cos(a) * V0[1] + Math.sin(a) * V0[2] >= 0) pre.unshift(I.p(P, [x, cy + r * Math.cos(a), cz + r * Math.sin(a)])); else break; }
    return '<path class="ln faint" d="' + I.d(pre.concat(pts)) + '"/>';
  }
  function radialOnFace(x, cy, cz, r0, r1, count, phase) {
    var d = '';
    for (var i = 0; i < count; i++) {
      var a = phase + 2 * Math.PI * i / count, c = Math.cos(a), s = Math.sin(a);
      d += I.d([I.p(P, [x, cy + r0 * c, cz + r0 * s]), I.p(P, [x, cy + r1 * c, cz + r1 * s])]);
    }
    return d;
  }

  /* ---------- base ---------- */
  var s = I.halo(P, I.ring(BASE, 6), -12, 10);
  byDepth(I.corners(BASE, 18)).forEach(function (c) {
    s += I.solid(P, I.cyl(c[0], c[1], 7, -16, 1.6, 24), { tone: 'lo' });
    s += I.solid(P, I.cyl(c[0], c[1], 5.2, -14.4, 5.4, 24), { tone: 'mid' });
  });
  s += I.solid(P, I.slab(BASE, -9, 9, 8), { tone: 'mid' });
  s += I.planTop(P, I.inset(BASE, 5), 0, 'faint', 8);
  I.corners(BASE, 10).forEach(function (c) { s += I.screw(P, c[0], c[1], 0); });
  // feet of the side frames: two long shoes with screws
  [-63, 63].forEach(function (x) {
    var shoe = { x: x - 7, y: -52, w: 14, d: 104, r: 2 };
    s += I.solid(P, I.slab(shoe, 0, 3, 3), { tone: 'lo' });
    [-44, 44].forEach(function (y) { s += I.screw(P, x + (x < 0 ? -4.5 : 4.5), y, 3); });
  });
  // a ruler along the front edge of the delivery side, under the tray
  var RUL = { x: -54, y: 146, w: 108, d: 6, r: 1 };
  s += I.solid(P, I.slab(RUL, 0, 0.8, 2), { tone: 'lo' });
  s += I.ticks(P, RUL.x + 2, RUL.x + RUL.w - 2, 4.15, 5, RUL.y + RUL.d, 0.8, [2, 3.8], 'x');
  I.group(s, gBase);

  /* ---------- layer 0: the far side frame ---------- */
  var FR = function (x) { return { x: x - 3, y: -48, w: 6, d: 96, r: 3 }; };
  I.group(I.solid(P, I.slab(FR(-63), 3, 83, 4), { tone: 'mid' }), gL0);

  /* ---------- layer 1: everything between the frames, sorted ---------- */
  var items = [];
  function item(svgText, key) { var n = I.group(svgText, gL1); var it = { node: n, key: key }; items.push(it); return it; }
  function keyAt(x, y, z) { return I.depth(P, [x, y, z]); }

  // ink fountain (trough) behind the rollers
  (function () {
    var tr = { x: -56, y: -32, w: 112, d: 12, r: 2 };
    var t = I.solid(P, I.slab(tr, 69, 9, 3), { tone: 'mid', mat: 'mem' });
    var lip = I.ring(I.inset(tr, 1.6), 3).map(function (q) { return I.p(P, [q[0], q[1], 78]); });
    t += '<path class="void" d="' + I.d(lip, true) + '"/>';
    item(t, keyAt(0, -26, 60));
  })();
  // ink rollers, one per lane: built at rest, their marks turn per frame
  var rollers = [];
  for (var i = 0; i < LANES; i++) {
    var x = laneX(i);
    // two finishes: a lane in use is inked (KV cache read every turn), an idle one is bare
    var it = item('', keyAt(x, RY, RZ) - 30);
    it.inked = I.group(I.solid(P, I.drum('x', [x, RY, RZ], RR, 12, 28), { tone: 'mid', mat: 'memx' }), it.node);
    it.bare = I.group(I.solid(P, I.drum('x', [x, RY, RZ], RR, 12, 28), { tone: 'mid' }), it.node);
    it.marks = I.el('path', { class: 'ln lo' }, it.node);
    it.x = x; rollers.push(it);
  }
  // roller shaft through all lanes (seen between rollers)
  // (keyed just behind the nearest-to-the-back roller, so every roller covers it)
  item(I.solid(P, I.drum('x', [0, RY, RZ], 2, 120, 14), { tone: 'lo', mat: 'steel' }),
    Math.min.apply(null, rollers.map(function (r) { return r.key; })) - 0.5);

  // feed table on legs, with lane guides and the paper stacks
  var FEED = { x: -54, y: -140, w: 108, d: 124, r: 2 };
  (function () {
    var t = '';
    byDepth([[-50, -136], [50, -136], [-50, -20], [50, -20]]).forEach(function (q) { t += I.solid(P, I.cyl(q[0], q[1], 2.2, 3, 24, 14), { tone: 'lo' }); });
    t += I.solid(P, I.slab(FEED, 27, 3, 2), { tone: 'mid' });
    for (var g = 0; g <= LANES; g++) {
      var gx = -52 + g * 13;
      t += I.solid(P, I.box(gx - 0.5, -138, 1, 40, 30, 3.4), { tone: 'lo' });
    }
    item(t, keyAt(0, -80, 0) - 60);
  })();
  var feedStacks = item('', keyAt(0, -110, 30) - 40);

  // impression cylinder and the plate cylinder (the weights)
  item(I.solid(P, I.drum('x', [0, 0, ZI], RI, 2 * XF, 40), { tone: 'mid', mat: 'steel' }), keyAt(0, 0, ZI));
  var impMarks = I.el('path', { class: 'ln faint' }, items[items.length - 1].node);
  var plate = item(I.solid(P, I.drum('x', [0, 0, ZP], RP, 2 * XF, 56), { tone: 'hi', crease: 'lo', mat: 'mem' }), keyAt(0, 0, ZP));
  var plateMarks = I.el('g', {}, plate.node);

  // sheets in flight: an unprinted piece before the nip, a printed piece after it
  var sheetIn = item('', keyAt(0, -20, NIP) - 10);
  var sheetNip = item('', keyAt(0, 0, ZI) + 3);           // printed, still under the plate
  var sheetOut = item('', 1e4);                           // printed and clear of the plate: always on top

  // delivery tray on legs, and the delivered (printed) stacks
  var TRAY = { x: -54, y: 16, w: 108, d: 124, r: 2 };
  (function () {
    var t = '';
    byDepth([[-50, 20], [50, 20], [-50, 136], [50, 136]]).forEach(function (q) { t += I.solid(P, I.cyl(q[0], q[1], 2.2, 3, 19, 14), { tone: 'lo' }); });
    t += I.solid(P, I.slab(TRAY, 22, 3, 2), { tone: 'mid' });
    t += I.solid(P, I.box(-54, 136, 108, 4, 25, 5), { tone: 'mid' });       // back stop the sheets slide against
    item(t, keyAt(0, 0, ZI) + 1);
  })();
  var outStacks = item('', keyAt(0, 119, 26) + 30);

  /* ---------- layer 2: the near side frame, layer 3: drive on its outside ---------- */
  (function () {
    var t = I.solid(P, I.slab(FR(63), 3, 83, 4), { tone: 'mid', inner: I.sideSeam(P, FR(63), 76, 'faint', 4) });
    I.group(t, gL2);
  })();
  var drive = I.group('', gL3), gGears = I.group('', gL3), drive2 = I.group('', gL3);
  var XO = 66;                                         // outer face of the near frame
  (function () {
    var t = '';
    // bosses where the shafts come through
    t += I.solid(P, I.drum('x', [XO + 2, RY, RZ], 5, 4, 24), { tone: 'mid' });
    t += I.solid(P, I.drum('x', [XO + 2, 0, ZI], 7, 4, 28), { tone: 'mid' });
    t += I.solid(P, I.drum('x', [XO + 2, 0, ZP], 9, 4, 32), { tone: 'mid' });
    I.group(t, drive); t = '';
    // motor pedestal and motor, its pinion meshing with the plate gear
    t += I.solid(P, I.drum('x', [74, -32, ZP], 2, 4, 14), { tone: 'lo' });
    t += I.solid(P, I.slab({ x: 76, y: -43, w: 16, d: 22, r: 2 }, 0, 40, 3), { tone: 'lo', inner: I.sideSeam(P, { x: 76, y: -43, w: 16, d: 22, r: 2 }, 36, 'faint', 3) });
    [[79, -40], [89, -40], [79, -24], [89, -24]].forEach(function (q) { t += I.dots(P, [[q[0], q[1], 40]], 0.45, 'mid'); });
    t += I.solid(P, I.drum('x', [84, -32, ZP], 10, 16, 40), { tone: 'mid', inner: bandFront(80, -32, ZP, 10) });
    t += I.solid(P, I.drum('x', [93, -32, ZP], 7, 2, 32), { tone: 'lo' });
    I.group(t, drive2);
  })();
  // gears: built at rest, teeth and spokes redrawn as they turn
  function gear(cy, cz, r, x0) {
    var g = I.group(I.solid(P, I.drum('x', [x0 + 1.5, cy, cz], r, 3, 64), { tone: 'mid', mat: 'steel' }) +
      '<path class="ln faint" d="' + I.d(sideCircle(x0 + 3, cy, cz, r - 3.4, 64)) + '"/>' +
      '<path class="ln lo" d="' + I.d(sideCircle(x0 + 3, cy, cz, Math.max(2.4, r * 0.28), 32)) + '"/>', gGears);
    var teeth = I.el('path', { class: 'ln lo' }, g), spokes = I.el('path', { class: 'ln mid' }, g);
    return { teeth: teeth, spokes: spokes, cy: cy, cz: cz, r: r, x: x0 + 3 };
  }
  var gPlate = gear(0, ZP, 24, 70), gImp = gear(0, ZI, 8, 70), gPin = gear(-32, ZP, 8, 70);

  /* ---------- layer 4: front instruments, sorted ---------- */
  var front = [];
  function fitem(svgText, key) { var n = I.group(svgText, gL4); var it = { node: n, key: key }; front.push(it); return it; }
  var GX = 86, GY = 150, GZ = 11, G0 = -0.75 * Math.PI, GSPAN = 1.5 * Math.PI, GMAX = 50000;
  var gauge = fitem(I.solid(P, I.cyl(GX, GY, 8, 0, 6, 28), { tone: 'lo' }) +
    I.solid(P, I.cyl(GX, GY, 12.5, 6, 5, 56), { tone: 'hi', crease: 'lo', inner: I.knurl(P, GX, GY, 12.5, 7.2, 10.4, 40, 'faint') }) +
    I.ringTop(P, GX, GY, 11.6, GZ, 'lo', 56) +
    I.radialTicks(P, GX, GY, 11, 25, 5, GZ, [1.1, 2.4], G0, GSPAN) +
    I.solid(P, I.box(GX - 2, GY - 15.5, 4, 3.2, 7, 2.6), { tone: 'mid' }), keyAt(GX, GY, 6));
  var needle = I.el('path', { class: 'ln litl' }, gauge.node);
  I.group(I.solid(P, I.cyl(GX, GY, 1.4, GZ, 0.8, 12), { tone: 'hi', lit: true }), gauge.node);

  function knob(x, y, stops) {
    var t = I.solid(P, I.cyl(x, y, 10, 0, 0.9, 40), { tone: 'lo' });
    stops.forEach(function (a) { t += I.line(P, [[x + 8.2 * Math.sin(a), y - 8.2 * Math.cos(a), 0.9], [x + 10 * Math.sin(a), y - 10 * Math.cos(a), 0.9]], 'mid'); });
    t += I.solid(P, I.cyl(x, y, 6.6, 0.9, 1.4, 32), { tone: 'mid' });
    t += I.solid(P, I.cyl(x, y, 5.6, 2.3, 5, 32), { tone: 'mid', inner: I.knurl(P, x, y, 5.6, 2.6, 7, 22, 'lo') });
    var it = fitem(t, keyAt(x, y, 3));
    it.ptr = I.el('path', { class: 'ln hi', 'stroke-width': 0.9 }, it.node);
    var c = I.p(P, [x, y, 5]);
    it.hit = I.el('circle', { 'data-hot': '', fill: 'transparent', cx: c[0], cy: c[1], r: 12 * P.s }, it.node);
    it.x = x; it.y = y; it.stops = stops; it.ang = stops[0];
    return it;
  }
  var kB = knob(-30, 170, [-0.9, -0.3, 0.3, 0.9]);
  var kF = knob(2, 170, [-0.5, 0.5]);
  I.sortInto(gL4, front);

  /* ---------- controls outside the drawing ---------- */
  var ctl = document.createElement('div'); ctl.className = 'iso-ctl';
  ctl.innerHTML = '<span class="grp">Batch B <button type="button" data-b="1">1</button><button type="button" data-b="8">8</button><button type="button" data-b="64">64</button><button type="button" data-b="256">256</button></span>' +
    '<span class="grp">Format <button type="button" data-f="fp32">FP32</button><button type="button" data-f="fp16">FP16</button></span>';
  host.insertBefore(ctl, host.querySelector('.iso-keys'));

  /* ---------- state ---------- */
  var st = { B: 1, f: 'fp32', theta: 0, u: 0, rev: 0, gauge: 0, m: model(1, 'fp32') };
  var calm = I.still();
  var lanes = 1, thick = 0.8;

  function rebuildStacks() {
    var t = '';
    for (var i = 0; i < lanes; i++) {
      var x = laneX(i);
      for (var k = 0; k < 4; k++) t += I.solid(P, I.slab({ x: x - 5.5, y: -130, w: 11, d: 30, r: 0.6 }, 30 + k * 0.9, 0.9, 1), { tone: 'lo', crease: 'faint' });
    }
    feedStacks.node.innerHTML = t;
  }
  var shownDelivered = -1;
  function rebuildDelivered(n) {
    if (n === shownDelivered) return;
    shownDelivered = n;
    var t = '', hh = Math.min(n, 6) * thick;
    if (hh > 0) for (var i = 0; i < lanes; i++) {
      var x = laneX(i);
      t += I.solid(P, I.slab({ x: x - 5.5, y: 104, w: 11, d: 30, r: 0.6 }, 25, hh, 1), { mat: 'workx', cls: 'soft', tone: 'mid' });
    }
    outStacks.node.innerHTML = t;
  }
  function set(B, f, byUser) {
    if (B != null) st.B = B;
    if (f != null) st.f = f;
    st.m = model(st.B, st.f);
    lanes = Math.min(st.B, LANES);
    thick = 0.8 + 0.55 * Math.log2(st.B / lanes);
    rebuildStacks(); shownDelivered = -1;
    ctl.querySelectorAll('[data-b]').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.b === st.B)); });
    ctl.querySelectorAll('[data-f]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.f === st.f)); });
    var m = st.m;
    ui.live.textContent = 'Batch ' + st.B + ', ' + FMT[st.f].label + ': ' + ms(m.step) + ' per step, ' + fmtN(m.tps) + ' tokens per second, ' + m.bound + '.';
    if (byUser) hold();
    kick();
  }
  function ms(x) { return (x * 1e3).toFixed(x < 1e-3 ? 2 : 1) + ' ms'; }
  function fmtN(x) { return Math.round(x).toLocaleString('en-US'); }

  ctl.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.b) set(+b.dataset.b, null, true); else set(null, b.dataset.f, true);
  });
  kB.hit.addEventListener('click', function () { set(BATCH[(BATCH.indexOf(st.B) + 1) % BATCH.length], null, true); });
  kF.hit.addEventListener('click', function () { set(null, st.f === 'fp32' ? 'fp16' : 'fp32', true); });
  ui.stage.tabIndex = 0;
  ui.stage.setAttribute('role', 'group');
  ui.stage.setAttribute('aria-label', 'Rotary press figure. Left and right arrows change the batch size, up and down the number format.');
  ui.stage.addEventListener('keydown', function (e) {
    var i = BATCH.indexOf(st.B);
    if (e.key === 'ArrowLeft') set(BATCH[Math.max(0, i - 1)], null, true);
    else if (e.key === 'ArrowRight') set(BATCH[Math.min(BATCH.length - 1, i + 1)], null, true);
    else if (e.key === 'ArrowUp') set(null, 'fp16', true);
    else if (e.key === 'ArrowDown') set(null, 'fp32', true);
    else return;
    e.preventDefault();
  });

  var TOUR = [[1, 'fp32'], [8, 'fp32'], [64, 'fp32'], [256, 'fp32'], [1, 'fp16'], [64, 'fp16']], tourAt = 0, tourI = 0, heldUntil = 1.4, clock = 0;
  function hold() { heldUntil = clock + 3.6; }
  ['pointerenter', 'focusin', 'pointerdown'].forEach(function (ev) { host.addEventListener(ev, function () { heldUntil = Infinity; }); });
  ['pointerleave', 'focusout'].forEach(function (ev) { host.addEventListener(ev, function () { heldUntil = clock + 3.6; }); });

  /* ---------- drawing per frame ---------- */
  function smooth(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  var V = I.view(P);
  function drumMarks(cx, cy, cz, r, x0, x1, count, phase) {
    // lines along x on a drum's surface; only the side that faces the viewer, faded toward the limb
    var out = [];
    for (var i = 0; i < count; i++) {
      var a = phase + 2 * Math.PI * i / count, ny = Math.cos(a), nz = Math.sin(a);
      var f = ny * V[1] + nz * V[2];
      if (f <= 0.04) continue;
      out.push({ d: I.d([I.p(P, [x0, cy + r * ny, cz + r * nz]), I.p(P, [x1, cy + r * ny, cz + r * nz])]), o: smooth(0.04, 0.4, f) });
    }
    return out;
  }
  function sheetSlab(x, y0, y1, z, lit) {
    if (y1 - y0 < 0.4) return '';
    return I.solid(P, I.slab({ x: x - 5.5, y: y0, w: 11, d: y1 - y0, r: 0.4 }, z, thick, 1), lit ? { mat: 'workx', tone: 'mid' } : { tone: 'lo', crease: 'faint' });
  }
  function draw() {
    // plate: 10 engraved plate lines turning with the cylinder
    var pm = drumMarks(0, 0, ZP, RP + 0.05, -XF + 3, XF - 3, 10, st.theta);
    plateMarks.innerHTML = pm.map(function (m) { return '<path class="ln mem" stroke-opacity="' + m.o.toFixed(2) + '" d="' + m.d + '"/>'; }).join('');
    // impression cylinder turns the other way at the same surface speed
    impMarks.setAttribute('d', drumMarks(0, 0, ZI, RI + 0.05, -XF + 3, XF - 3, 6, -st.theta * RP / RI).map(function (m) { return m.d; }).join(''));
    // ink rollers: active lanes turn with the plate, idle ones stand still
    rollers.forEach(function (r, i) {
      var on = i < lanes;
      if (r.on !== on) { r.on = on; r.inked.style.display = on ? '' : 'none'; r.bare.style.display = on ? 'none' : ''; }
      r.marks.setAttribute('d', drumMarks(0, RY, RZ, RR + 0.05, r.x - 5.4, r.x + 5.4, 6, on ? -st.theta * RP / RR : 0.3).map(function (m) { return m.d; }).join(''));
    });
    // gears
    [[gPlate, st.theta, 30], [gImp, -st.theta * 3, 10], [gPin, -st.theta * 3, 10]].forEach(function (g) {
      var G = g[0];
      G.teeth.setAttribute('d', radialOnFace(G.x, G.cy, G.cz, G.r - 2.2, G.r - 0.2, g[2], g[1]));
      G.spokes.setAttribute('d', radialOnFace(G.x, G.cy, G.cz, Math.max(2.4, G.r * 0.28), G.r - 3.4, G.r > 10 ? 5 : 3, g[1]));
    });
    // sheets: leading edge from the feed stack (-100) to the delivery stack (134), then it lands
    var u = st.u, moving = smooth(0, 0.85, u), lead = -100 + 234 * moving, landed = u >= 0.85;
    var tin = '', tnip = '', tout = '';
    if (!landed) for (var i = 0; i < lanes; i++) {
      var x = laneX(i), y0 = lead - 30, y1 = lead;
      var zIn = 30 + Math.max(0, 3.6 * (1 - moving * 6));       // lifts off the top of the stack, then slides on the table
      tin += sheetSlab(x, y0, Math.min(y1, 0), zIn, false);
      tnip += sheetSlab(x, Math.max(y0, 0), Math.min(y1, RP), 30, true);
      var a0 = Math.max(y0, RP), mid = (a0 + y1) / 2, zOut = 25 + 5 * (1 - smooth(24, 60, mid));
      tout += sheetSlab(x, a0, y1, zOut, true);
    }
    sheetIn.node.innerHTML = tin; sheetNip.node.innerHTML = tnip; sheetOut.node.innerHTML = tout;
    rebuildDelivered((st.rev % 6) + (landed ? 1 : 0));
    I.sortInto(gL1, items);
    // gauge and knobs follow the model
    st.gauge = I.follow(st.gauge, st.m.tps, 1 / 60, 0.4, calm);
    var a = G0 + GSPAN * Math.min(1, st.gauge / GMAX);
    needle.setAttribute('d', I.d([I.p(P, [GX - 2.5 * Math.sin(a), GY + 2.5 * Math.cos(a), GZ + 0.4]), I.p(P, [GX + 9.6 * Math.sin(a), GY - 9.6 * Math.cos(a), GZ + 0.4])]));
    [kB, kF].forEach(function (kn) {
      var tgt = kn === kB ? kn.stops[BATCH.indexOf(st.B)] : kn.stops[st.f === 'fp32' ? 0 : 1];
      kn.ang = I.follow(kn.ang, tgt, 1 / 60, 0.15, calm);
      kn.ptr.setAttribute('d', I.d([I.p(P, [kn.x, kn.y, 7.05]), I.p(P, [kn.x + 4.8 * Math.sin(kn.ang), kn.y - 4.8 * Math.cos(kn.ang), 7.05])]));
    });
    var m = st.m;
    ui.readout.textContent = 'B ' + st.B + ' · ' + FMT[st.f].label + ' · ' + ms(m.step) + ' · ' + fmtN(m.tps) + ' tok/s · ' + (m.bound === 'compute-bound' ? 'compute' : m.bound === 'memory-bound on the weights' ? 'weight' : 'KV') + '\u2011bound';
  }

  var frame = 0, last = 0, visible = false;
  function tick(now) {
    var dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60; last = now;
    clock += dt;
    if (!calm && clock > heldUntil && clock - tourAt > 8) { tourAt = clock; tourI = (tourI + 1) % TOUR.length; set(TOUR[tourI][0], TOUR[tourI][1], false); }
    var period = st.m.step * SLOW;                        // film seconds per revolution
    st.u += dt / period;
    if (st.u >= 1) { st.u -= 1; st.rev++; }
    st.theta = (st.rev + st.u) * 2 * Math.PI;
    draw();
    frame = visible && !calm ? requestAnimationFrame(tick) : 0;
  }
  function kick() { if (calm) { draw(); return; } if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } }
  new IntersectionObserver(function (es) { visible = es[es.length - 1].isIntersecting; if (visible) kick(); }, { rootMargin: '120px 0px' }).observe(ui.stage);

  // still frame (reduced motion): a sheet halfway through the nip, so both halves read
  if (calm) { st.u = 0.4; st.rev = 3; st.theta = 0.6; }
  set(1, 'fp32', false);
  draw();

  var cap = document.createElement('p'); cap.className = 'iso-cap';
  cap.innerHTML = '<b>Fig. 5</b> &mdash; Decode as a printing press. The plate cylinder is the weights: every turn is one decode step, and one turn reads all 124.4M parameters from DRAM (498 MB in FP32). The sheets fed through on that turn are the B sequences of the batch (each lane carries B/8 of them), and each comes out with one new token. Batching shares the plate, so tokens per second climb almost in proportion to B, until two things stop them: each sequence&rsquo;s own ink roller, its KV cache, which is read alone and never shared, and, in the linear layers, the arithmetic. Step time here is the census&rsquo;s two big rows (linear layers and attention at t&nbsp;=&nbsp;256, 88% of 672 GB/s, 30.9 or 61.7 TFLOPS), played 1,500&times; slower than real time.';
  host.appendChild(cap);
})();
