/* fig-conveyor.js — chapter 3, §5 "Bytes in flight". One SM's share of the memory system as a
   cup conveyor. The loop takes ~500 ns: out to DRAM with an empty cup (the request), back with
   128 bytes (the data). The loop has 56 carriers, 7 KB, which is what one SM must keep in flight
   to pull its 1/48 of 672 GB/s (Little's law). Two knobs: resident warps (8 or 48) and how many
   bytes each warp has in flight per load (float, float4, 4 independent floats). */
(function () {
  'use strict';
  var host = document.getElementById('fig-conveyor');
  if (!host || !window.ISO) return;
  var I = ISO;

  /* ---------- the model (truth first) ---------- */
  var PEAK = 672, SLOTS = 56, CUP = 128;          // GB/s; carriers on the loop; bytes per cup (32 lanes x 4 B)
  var LOOP_S = 7;                                // seconds of film per ~500 ns trip
  var MODES = {
    float: { label: 'float', per: 1, group: 1, say: 'one 4-byte load per thread' },
    f4:    { label: 'float4', per: 4, group: 4, say: 'one 16-byte load per thread' },
    ilp:   { label: '4× float (ILP)', per: 4, group: 1, say: 'four independent 4-byte loads per thread' }
  };
  var WARPS = [8, 48];
  var st = { W: 8, mode: 'float', phi: 0, gauge: 0 };
  function demand() { return st.W * MODES[st.mode].per; }          // cups (128 B each) wanted in flight
  // which carriers a setting fills: evenly spaced, in groups for float4
  function pattern(W, mode) {
    var D = W * MODES[mode].per, g = MODES[mode].group, occ = [], k;
    for (k = 0; k < SLOTS; k++) occ.push(false);
    if (D >= SLOTS) { for (k = 0; k < SLOTS; k++) occ[k] = true; return occ; }
    var groups = D / g;
    for (var j = 0; j < groups; j++) { var s0 = Math.round(j * SLOTS / groups); for (k = 0; k < g; k++) occ[(s0 + k) % SLOTS] = true; }
    return occ;
  }

  /* ---------- world ---------- */
  var R = 34, YS = 90;                                   // cup path: half-width and straight half-length
  var QUART = Math.PI / 2 * R, STR = 2 * YS, LOOP = 2 * STR + 2 * Math.PI * R;
  // s in [0,1): 0 = the SM's station (leftmost point), 0.5 = DRAM's nozzle (rightmost point)
  function pathAt(u) {
    var d = ((u % 1) + 1) % 1 * LOOP, t;
    if (d < QUART) { t = -Math.PI / 2 - d / R; return [R * Math.cos(t), -YS + R * Math.sin(t)]; }
    d -= QUART;
    if (d < STR) return [-R, -YS + d];
    d -= STR;
    if (d < Math.PI * R) { t = Math.PI - d / R; return [R * Math.cos(t), YS + R * Math.sin(t)]; }
    d -= Math.PI * R;
    if (d < STR) return [R, YS - d];
    d -= STR; t = -d / R;
    return [R * Math.cos(t), -YS + R * Math.sin(t)];
  }

  var W = 640, H = 330;
  var P = I.camera(33, 30);
  var BASE = { x: -72, y: -198, w: 144, d: 396, r: 8 };
  I.fit(P, [[-72, -198, -16], [72, -198, -16], [72, 198, -16], [-72, 198, -16], [-40, -184, 36], [0, 162, 48]], W, H, 14);

  var ui = I.card(host, {
    fig: 'Fig. 3', title: 'One SM’s memory pipe, as a conveyor', W: W, H: H,
    hint: 'Turn the knobs: click them, or ← → and ↑ ↓',
    label: 'An isometric conveyor between an SM station and a DRAM cabinet. Cups leave the SM empty, are filled with 128 bytes under the DRAM nozzle and come back. Knobs set the resident warps and the load width; a gauge shows the bandwidth this pattern can reach.',
    keys: [['mem', '128 bytes of data in a cup'], ['void', 'empty cup: a request on its way'], ['work', 'raised peg: a resident warp'], ['lit', 'the gauge: bandwidth reached']]
  });
  var svg = ui.svg;
  svg.innerHTML = '<defs><filter id="iso-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter></defs>';
  var gStatic = I.el('g', {}, svg), gLive = I.el('g', {}, svg);

  /* ---------- static: base, track, wheels ---------- */
  var s = '';
  s += I.halo(P, I.ring(BASE, 6), -12, 10);
  I.corners(BASE, 18).sort(function (a, b) { return I.depth(P, [a[0], a[1], 0]) - I.depth(P, [b[0], b[1], 0]); }).forEach(function (c) {
    s += I.solid(P, I.cyl(c[0], c[1], 7, -16, 1.6, 24), { tone: 'lo' });
    s += I.solid(P, I.cyl(c[0], c[1], 5.2, -14.4, 5.4, 24), { tone: 'mid' });
  });
  s += I.solid(P, I.slab(BASE, -9, 9, 8), { tone: 'mid' });
  s += I.planTop(P, I.inset(BASE, 5), 0, 'faint', 8);
  I.corners(BASE, 10).forEach(function (c) { s += I.screw(P, c[0], c[1], 0); });
  // ruler along the near rail: one tick per carrier pitch (~9 ns of the trip), a major every 4
  var RUL = { x: 44, y: -76, w: 7, d: 152, r: 1 };
  s += I.solid(P, I.slab(RUL, 0, 0.8, 2), { tone: 'lo' });
  var pitch = LOOP / SLOTS;
  s += I.ticks(P, RUL.y + 3, RUL.y + RUL.d - 3, pitch / 2, 4, RUL.x + RUL.w, 0.8, [2.2, 4.2], 'y');
  // wheel pedestals, then rails on posts
  [-YS, YS].forEach(function (y) { s += I.solid(P, I.cyl(0, y, 11, 0, 4, 28), { tone: 'lo' }); });
  var posts = [];
  [-R, R].forEach(function (x) { [-60, -20, 20, 60].forEach(function (y) { posts.push([x, y]); }); });
  posts.sort(function (a, b) { return I.depth(P, [a[0], a[1], 0]) - I.depth(P, [b[0], b[1], 0]); }).forEach(function (q) {
    s += I.solid(P, I.cyl(q[0], q[1], 2.4, 0, 5, 16), { tone: 'lo', mat: 'steel' });
  });
  var railY = YS - Math.sqrt(37 * 37 - R * R);
  [-R, R].forEach(function (x) {
    s += I.solid(P, I.slab({ x: x - 3, y: -railY, w: 6, d: 2 * railY, r: 1 }, 5, 3, 2), { tone: 'mid', mat: 'steel' });
  });
  // the two sprocket wheels with teeth marks and hubs
  [-YS, YS].forEach(function (y) {
    s += I.solid(P, I.cyl(0, y, 37, 4, 4, 64), { tone: 'mid', inner: I.arcFront(P, 0, y, 37, 6, 'faint') });
    s += I.radialTicks(P, 0, y, 36.6, 48, 4, 8, [1.6, 3], 0, 2 * Math.PI, ['faint', 'lo']);
    s += I.ringTop(P, 0, y, 26, 8, 'faint', 48);
    s += I.solid(P, I.cyl(0, y, 7, 8, 3, 24), { tone: 'mid', mat: 'steel' });
    s += I.ringTop(P, 0, y, 3, 11, 'lo', 16);
    [0, 1, 2, 3].forEach(function (i) { var t = i * Math.PI / 2 + Math.PI / 4; s += I.dots(P, [[5 * Math.cos(t), y + 5 * Math.sin(t), 11]], 0.5, 'mid'); });
  });
  // the chain the cups ride on: one closed loop on the rails and wheel rims
  var chain = []; for (var i = 0; i <= 160; i++) { var q = pathAt(i / 160); chain.push(I.p(P, [q[0], q[1], 8.05])); }
  s += '<path class="ln lo" d="' + I.d(chain, true) + '"/>';
  // queue tray behind the SM: requests the pipe has no room for wait here
  var TRAY = { x: 45, y: -150, w: 23, d: 38, r: 2 };
  s += I.solid(P, I.slab(TRAY, 0, 2.4, 3), { tone: 'lo' });
  s += I.planTop(P, I.inset(TRAY, 2), 2.4, 'faint', 3);
  I.group(s, gStatic);

  /* ---------- live items (sorted by depth every frame they can change) ---------- */
  var items = [];
  function item(svgText, key) { var n = I.group(svgText, gLive); var it = { node: n, key: key }; items.push(it); return it; }
  function keyAt(x, y, z) { return I.depth(P, [x, y, z]); }

  // SM station: housing, warp pegs on top (rebuilt when W changes), arm and nozzle over the track
  var SM = { x: -40, y: -184, w: 80, d: 44, r: 3 };
  var smBody = item('', keyAt(0, -162, 15));
  function buildSM() {
    var t = I.solid(P, I.slab(SM, 0, 30, 4), { tone: 'mid', mat: 'work', inner: I.sideSeam(P, SM, 24, 'work', 4) });
    t += I.planTop(P, I.inset(SM, 3), 30, 'work', 4);
    var pegs = [];
    for (var r = 0; r < 6; r++) for (var c = 0; c < 8; c++) pegs.push([-30.6 + c * 8.75, -178 + r * 6.4, r * 8 + c]);
    pegs.sort(function (a, b) { return I.depth(P, [a[0], a[1], 0]) - I.depth(P, [b[0], b[1], 0]); });
    pegs.forEach(function (q) {
      var on = q[2] < st.W;
      t += I.ringTop(P, q[0], q[1], 2.3, 30, 'work', 14);
      t += I.solid(P, I.cyl(q[0], q[1], 1.6, 30, on ? 4.6 : 1.1, 14), on ? { tone: 'hi', mat: 'workx' } : { tone: 'lo', mat: 'work' });
    });
    smBody.node.innerHTML = t;
  }
  item(I.solid(P, I.box(-4, -141, 8, 20, 21, 4), { tone: 'mid', mat: 'work' }) +
       I.solid(P, I.cyl(0, -124, 3.4, 17.6, 3.4, 18), { tone: 'mid', mat: 'work' }) +
       I.arcFront(P, 0, -124, 3.4, 19.2, 'faint') +
       I.dots(P, [[0, -136, 25], [0, -130, 25]], 0.5, 'mid'), keyAt(0, -124, 26));

  // DRAM cabinet: drawers on the front, a hopper on top, a spout over the track with a gate knob
  var DR = { x: -34, y: 140, w: 68, d: 44, r: 3 };
  (function () {
    var t = I.solid(P, I.slab(DR, 0, 26, 4), { tone: 'mid', mat: 'mem', inner: I.sideSeam(P, DR, 2.5, 'mem', 4) });
    [3.5, 11, 18.5].forEach(function (z) {
      t += I.solid(P, I.box(34, 145, 1.6, 34, z, 6), { tone: 'lo', mat: 'mem' });
      t += I.solid(P, I.box(35.6, 159, 1.6, 6, z + 2.3, 1.4), { tone: 'mid', mat: 'steel' });
      t += I.dots(P, [[35.6, 147.5, z + 3], [35.6, 176.5, z + 3]], 0.45, 'mid');
    });
    t += I.planTop(P, I.inset(DR, 3), 26, 'mem', 4);
    t += I.solid(P, I.frustum(I.circle(0, 162, 9, 28), 26, I.circle(0, 162, 19, 28), 44), { tone: 'mid', mat: 'mem' });
    t += I.solid(P, I.cyl(0, 162, 20, 44, 2, 40), { tone: 'mid', mat: 'mem' });
    var lip = I.circle(0, 162, 17.4, 40).map(function (q) { return I.p(P, [q[0], q[1], 46]); });
    t += '<path class="void" d="' + I.d(lip, true) + '"/>';
    [0, 1, 2, 3, 4, 5].forEach(function (i) { var a = i * Math.PI / 3; t += I.dots(P, [[18.7 * Math.cos(a), 162 + 18.7 * Math.sin(a), 46]], 0.45, 'mid'); });
    item(t, keyAt(0, 162, 13));
  })();
  item(I.solid(P, I.box(-4, 119, 8, 21, 21, 4), { tone: 'mid', mat: 'mem' }) +
       I.solid(P, I.cyl(0, 124, 3.4, 17.6, 3.4, 18), { tone: 'mid', mat: 'mem' }) +
       I.arcFront(P, 0, 124, 3.4, 19.2, 'faint') +
       I.solid(P, I.cyl(0, 132, 2.6, 25, 3.2, 18), { tone: 'mid', inner: I.knurl(P, 0, 132, 2.6, 25.3, 27.9, 12, 'lo') }), keyAt(0, 124, 26));

  // bandwidth gauge on a pedestal, front left
  var GX = 54, GY = -172, GZ = 11, GR = 11.5, G0 = -0.75 * Math.PI, GSPAN = 1.5 * Math.PI;
  var gauge = item(I.solid(P, I.cyl(GX, GY, 8, 0, 6, 28), { tone: 'lo' }) +
    I.solid(P, I.cyl(GX, GY, 12.5, 6, 5, 56), { tone: 'hi', crease: 'lo', inner: I.knurl(P, GX, GY, 12.5, 7.2, 10.4, 40, 'faint') }) +
    I.ringTop(P, GX, GY, 11.6, GZ, 'lo', 56) +
    I.radialTicks(P, GX, GY, 11, 28, 4, GZ, [1.1, 2.4], G0, GSPAN) +
    I.solid(P, I.box(GX - 2, GY - 15.5, 4, 3.2, 7, 2.6), { tone: 'mid' }), keyAt(GX, GY, 6));
  var needle = I.el('path', { class: 'ln litl' }, gauge.node);
  var hub = I.el('g', {}, gauge.node); hub.innerHTML = I.solid(P, I.cyl(GX, GY, 1.4, GZ, 0.8, 12), { tone: 'hi', lit: true });

  // the two knobs on dial plates: resident warps and load width
  function knob(x, y, stops) {
    var t = I.solid(P, I.cyl(x, y, 10, 0, 0.9, 40), { tone: 'lo' });
    stops.forEach(function (a) { t += I.line(P, [[x + 8.2 * Math.sin(a), y - 8.2 * Math.cos(a), 0.9], [x + 10 * Math.sin(a), y - 10 * Math.cos(a), 0.9]], 'mid'); });
    t += I.solid(P, I.cyl(x, y, 6.6, 0.9, 1.4, 32), { tone: 'mid' });
    t += I.solid(P, I.cyl(x, y, 5.6, 2.3, 5, 32), { tone: 'mid', inner: I.knurl(P, x, y, 5.6, 2.6, 7, 22, 'lo') });
    var it = item(t, keyAt(x, y, 3));
    it.ptr = I.el('path', { class: 'ln hi', 'stroke-width': 0.9 }, it.node);
    it.hit = I.el('circle', { 'data-hot': '', fill: 'transparent', cx: I.p(P, [x, y, 5])[0], cy: I.p(P, [x, y, 5])[1], r: 12 * P.s }, it.node);
    it.x = x; it.y = y; it.stops = stops; it.ang = stops[0];
    return it;
  }
  var kW = knob(56, 118, [-0.6, 0.6]);
  var kM = knob(56, 160, [-0.75, 0, 0.75]);

  // cups: one per carrier; built at the origin and moved
  var cups = [];
  for (var k = 0; k < SLOTS; k++) {
    var t = I.solid(P, I.cyl(0, 0, 4.9, 8, 1.2, 20), { tone: 'lo' }) + I.solid(P, I.cyl(0, 0, 4.3, 9.2, 6.4, 24), { tone: 'mid' });
    var rim = I.circle(0, 0, 3.3, 24).map(function (q) { return I.p(P, [q[0], q[1], 15.6]); });
    t += '<path class="void" d="' + I.d(rim, true) + '"/>';
    var it = item(t, 0);
    var load = I.el('g', { class: 'm-memx' }, it.node);
    var mound = I.circle(0, 0, 3.0, 24).map(function (q) { return I.p(P, [q[0], q[1], 15.3]); });
    load.innerHTML = '<path class="f tp" d="' + I.d(mound, true) + '"/><path class="ol" d="' + I.d(mound, true) + '"/>';
    // translate is relative to the origin's screen position
    it.o = I.p(P, [0, 0, 0]);
    it.occ = false; it.load = load; it.k = k;
    cups.push(it);
  }
  // waiting cups on the tray
  var waits = [];
  for (k = 0; k < 8; k++) {
    var wx = 50.6 + (k % 2) * 11.4, wy = -144.6 + Math.floor(k / 2) * 9;
    var wt = I.solid(P, I.cyl(wx, wy, 4.2, 2.4, 6.4, 24), { tone: 'mid' });
    wt += '<path class="void" d="' + I.d(I.circle(wx, wy, 3.3, 24).map(function (q) { return I.p(P, [q[0], q[1], 8.8]); }), true) + '"/>';
    var wi = item(wt, keyAt(wx, wy, 5));
    waits.push(wi);
  }

  /* ---------- controls outside the drawing (same targets as the knobs) ---------- */
  var ctl = document.createElement('div'); ctl.className = 'iso-ctl';
  ctl.innerHTML = '<span class="grp">Warps per SM <button type="button" data-w="8">8 (17%)</button><button type="button" data-w="48">48 (100%)</button></span>' +
    '<span class="grp">Each load <button type="button" data-m="float">float</button><button type="button" data-m="f4">float4</button><button type="button" data-m="ilp">4× float (ILP)</button></span>';
  host.insertBefore(ctl, host.querySelector('.iso-keys'));

  /* ---------- live ---------- */
  var target = pattern(st.W, st.mode);
  var calm = I.still();
  function set(Wn, mode, byUser) {
    if (Wn != null) st.W = Wn;
    if (mode != null) st.mode = mode;
    target = pattern(st.W, st.mode);
    buildSM();
    if (calm) cups.forEach(function (c) { c.occ = target[c.k]; });
    if (byUser) hold();
    ctl.querySelectorAll('[data-w]').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.w === st.W)); });
    ctl.querySelectorAll('[data-m]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.m === st.mode)); });
    var D = demand(), fill = Math.min(D, SLOTS);
    ui.live.textContent = st.W + ' warps, ' + MODES[st.mode].say + ': ' + kb(D * CUP) + ' wanted in flight, ' +
      Math.round(PEAK * fill / SLOTS) + ' GB/s once the pipe settles' + (D > SLOTS ? ', and the rest of the requests wait.' : '.');
    kick();
  }
  function kb(b) { return (b / 1024).toFixed(1) + ' KB'; }
  ctl.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.w) set(+b.dataset.w, null, true); else set(null, b.dataset.m, true);
  });
  var order = ['float', 'f4', 'ilp'];
  kW.hit.addEventListener('click', function () { set(st.W === 8 ? 48 : 8, null, true); });
  kM.hit.addEventListener('click', function () { set(null, order[(order.indexOf(st.mode) + 1) % 3], true); });
  ui.stage.tabIndex = 0;
  ui.stage.setAttribute('role', 'group');
  ui.stage.setAttribute('aria-label', 'Conveyor figure. Left and right arrows set the resident warps, up and down the load width.');
  ui.stage.addEventListener('keydown', function (e) {
    var i = order.indexOf(st.mode);
    if (e.key === 'ArrowLeft') set(8, null, true);
    else if (e.key === 'ArrowRight') set(48, null, true);
    else if (e.key === 'ArrowUp') set(null, order[Math.min(2, i + 1)], true);
    else if (e.key === 'ArrowDown') set(null, order[Math.max(0, i - 1)], true);
    else return;
    e.preventDefault();
  });

  // idle tour: the five interesting settings, one every ~1.5 trips
  var TOUR = [[8, 'float'], [8, 'f4'], [8, 'ilp'], [48, 'float'], [48, 'f4']], tourAt = 0, tourI = 0, heldUntil = 0, clock = 0;
  function hold() { heldUntil = clock + 3.6; }
  ['pointerenter', 'focusin', 'pointerdown'].forEach(function (ev) { host.addEventListener(ev, function () { heldUntil = Infinity; }); });
  ['pointerleave', 'focusout'].forEach(function (ev) { host.addEventListener(ev, function () { heldUntil = clock + 3.6; }); });

  var frame = 0, last = 0, visible = false;
  function smooth(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  function draw() {
    var onBelt = 0;
    cups.forEach(function (c) {
      var u = ((c.k / SLOTS + st.phi) % 1 + 1) % 1;
      if (c.occ) onBelt++;
      var q = pathAt(u), sc = I.p(P, [q[0], q[1], 0]);
      // a cup appears just after the station (request issued) and leaves just before it
      var grow = calm ? 1 : smooth(0, 0.025, u) * (c.occ && !target[c.k] ? smooth(1, 0.975, u) : 1);
      var vis = c.occ ? grow : 0;
      c.node.style.opacity = vis.toFixed(3);
      c.node.style.display = vis < 0.01 ? 'none' : '';
      c.node.setAttribute('transform', 'translate(' + (sc[0] - c.o[0]).toFixed(2) + ' ' + (sc[1] - c.o[1]).toFixed(2) + ')');
      var filled = u >= 0.5 ? (calm ? 1 : smooth(0.5, 0.52, u) * smooth(1, 0.985, u)) : 0;
      c.load.style.opacity = filled.toFixed(3);
      c.key = I.depth(P, [q[0], q[1], 11]);
    });
    I.sortInto(gLive, items);
    var D = demand(), queued = Math.max(0, D - SLOTS);
    waits.forEach(function (w, i) { w.node.style.display = queued > 0 && i < 8 ? '' : 'none'; });
    var gbs = PEAK * onBelt / SLOTS;
    st.gauge = I.follow(st.gauge, gbs, 1 / 60, 0.4, calm);
    var a = G0 + GSPAN * st.gauge / PEAK;
    needle.setAttribute('d', I.d([I.p(P, [GX - 2.5 * Math.sin(a), GY + 2.5 * Math.cos(a), GZ + 0.4]), I.p(P, [GX + 9.6 * Math.sin(a), GY - 9.6 * Math.cos(a), GZ + 0.4])]));
    [kW, kM].forEach(function (kn) {
      var tgt = kn === kW ? kn.stops[WARPS.indexOf(st.W)] : kn.stops[order.indexOf(st.mode)];
      kn.ang = I.follow(kn.ang, tgt, 1 / 60, 0.15, calm);
      kn.ptr.setAttribute('d', I.d([I.p(P, [kn.x, kn.y, 7.05]), I.p(P, [kn.x + 4.8 * Math.sin(kn.ang), kn.y - 4.8 * Math.cos(kn.ang), 7.05])]));
    });
    ui.readout.textContent = st.W + ' warps × ' + MODES[st.mode].label + ' · ' + kb(onBelt * CUP) + ' in flight · ' + Math.round(gbs) + ' GB/s' + (queued ? ' · ' + queued + ' waiting' : '');
  }
  function tick(now) {
    var dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60; last = now;
    clock += dt;
    if (!calm && clock > heldUntil && clock - tourAt > 10.5) { tourAt = clock; tourI = (tourI + 1) % TOUR.length; set(TOUR[tourI][0], TOUR[tourI][1], false); }
    if (!calm) {
      var prev = st.phi;
      st.phi = (st.phi + dt / LOOP_S) % 1;
      // a carrier passing the station (u wraps through 0) takes the current target
      cups.forEach(function (c) {
        var u0 = ((c.k / SLOTS + prev) % 1 + 1) % 1, u1 = ((c.k / SLOTS + st.phi) % 1 + 1) % 1;
        if (u1 < u0) c.occ = target[c.k];
      });
    }
    draw();
    frame = visible && !calm ? requestAnimationFrame(tick) : 0;
  }
  function kick() { if (calm) { draw(); return; } if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } }
  new IntersectionObserver(function (es) { visible = es[es.length - 1].isIntersecting; if (visible) kick(); }, { rootMargin: '120px 0px' }).observe(ui.stage);

  // start from the settled state of the first setting, so the figure reads at once
  cups.forEach(function (c) { c.occ = target[c.k]; });
  set(8, 'float', false);
  heldUntil = 1.4;
  draw();

  var cap = document.createElement('p'); cap.className = 'iso-cap';
  cap.innerHTML = '<b>Fig. 3</b> &mdash; Little&rsquo;s law as a machine. A cup is one warp&rsquo;s request (32 lanes &times; 4 bytes = 128 B); a trip round the loop is the ~500 ns latency. The loop holds 56 cups, 7 KB, and only a full loop delivers this SM&rsquo;s share of 672 GB/s: bandwidth = bytes in flight &divide; latency. More warps (TLP) and wider or independent loads (ILP) fill it the same way. Ask for more than fits and the extra requests wait, which in a real GPU shows up as longer latency. The numbers are the ideal model: lab 2 measures the real ones.';
  host.appendChild(cap);
})();
