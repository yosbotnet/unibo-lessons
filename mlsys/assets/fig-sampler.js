/* fig-sampler.js — chapter 5, §5 "Stall reasons". Nsight Compute's warp sampling as a tabulator:
   48 warps stand as pegs in the SM's four quadrants (12 each), their height showing their state
   (issuing, ready but not picked, stalled). At a fixed interval of cycles a stylus on a gantry taps
   one warp and its counter, one per reason, advances. The counts' proportions are the stall table.
   The kernels' state mixes are illustrative, not measurements. */
(function () {
  'use strict';
  var host = document.getElementById('fig-sampler');
  if (!host || !window.ISO) return;
  var I = ISO;

  /* ---------- the model ---------- */
  // counters, left to right; names are the chapter's metric suffixes
  var REASONS = ['selected', 'not_selected', 'long_scoreboard', 'lg_throttle', 'barrier', 'short_scoreboard', 'mio_throttle', 'math_pipe_throttle', 'wait'];
  // per kernel: probability a warp is ready to issue, and the mix of reasons for the ones that are not
  var KERNELS = [
    { id: 'copy', label: 'Copy at the roofline (v6)', short: 'copy v6', ready: 0.07,
      stall: { long_scoreboard: 0.82, lg_throttle: 0.07, wait: 0.06, short_scoreboard: 0.05 },
      say: 'a memory-bound copy near the DRAM ceiling: almost every warp waits for a load, the healthy signature of a memory-bound kernel' },
    { id: 'red', label: 'Reduction v1–v3', short: 'reduction v1–v3', ready: 0.12,
      stall: { barrier: 0.56, short_scoreboard: 0.2, long_scoreboard: 0.12, wait: 0.08, mio_throttle: 0.04 },
      say: 'a tree reduction with a barrier per level: warps mostly wait for each other' },
    { id: 'tr', label: 'Unpadded transpose', short: 'unpadded transpose', ready: 0.08,
      stall: { mio_throttle: 0.36, short_scoreboard: 0.3, long_scoreboard: 0.26, barrier: 0.08 },
      say: 'the shared-memory transpose without padding: bank conflicts back up the shared-memory queue' },
    { id: 'mm', label: 'Tiled matmul (Part II)', short: 'tiled matmul', ready: 0.42,
      stall: { math_pipe_throttle: 0.42, wait: 0.2, short_scoreboard: 0.15, long_scoreboard: 0.1, barrier: 0.08, mio_throttle: 0.05 },
      say: 'a well-tiled matrix multiply: the arithmetic pipes are the bottleneck, the good kind' }
  ];
  var LANES = 4, PER = 12, MAXN = 999;
  var seed = 7;
  function rnd() { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
  function pick(mix) { var r = rnd(), acc = 0; for (var k in mix) { acc += mix[k]; if (r < acc) return k; } return Object.keys(mix)[0]; }

  var st = { k: 0, fast: false, counts: [], total: 0, warps: [] };
  for (var l = 0; l < LANES; l++) for (var w = 0; w < PER; w++) st.warps.push({ lane: l, i: w, stall: null, ready: false, sel: false, h: 3, next: 0 });
  function roll(wp, now) {
    var K = KERNELS[st.k];
    wp.ready = rnd() < K.ready;
    wp.stall = wp.ready ? null : pick(K.stall);
    wp.next = now + (st.fast ? 0.05 + rnd() * 0.12 : 0.5 + rnd() * 1.4);
  }
  // each quadrant issues one ready warp; the other ready ones are "not selected"
  function choose() {
    for (var l = 0; l < LANES; l++) {
      var ready = st.warps.filter(function (x) { return x.lane === l && x.ready; });
      var cur = ready.filter(function (x) { return x.sel; })[0];
      st.warps.forEach(function (x) { if (x.lane === l) x.sel = false; });
      if (ready.length) (cur || ready[Math.floor(rnd() * ready.length)]).sel = true;
    }
  }
  function stateOf(wp) { return wp.sel ? 'selected' : wp.ready ? 'not_selected' : wp.stall; }
  function reset() { st.counts = REASONS.map(function () { return 0; }); st.total = 0; }

  /* ---------- world ---------- */
  var W = 640, H = 345;
  var P = I.camera(30, 30);
  var BASE = { x: -84, y: -112, w: 150, d: 224, r: 8 };
  var LX = [-50, -32, -14, 4], PY0 = -71.5, PSTEP = 13;       // lanes along y, 12 pegs each
  function pegXY(l, i) { return [LX[l], PY0 + i * PSTEP]; }
  var CX0 = 34, CX1 = 50, CY0 = -72, CW = 14, CGAP = 2, CZ = 20; // counter housings along y
  function cy(j) { return CY0 + j * (CW + CGAP); }
  I.fit(P, [[-84, -112, -16], [66, -112, -16], [66, 112, -16], [-84, 112, -16], [-70, 0, 31], [24, 0, 31], [-64, -100, 26], [-64, 100, 26]], W, H, 16);

  var ui = I.card(host, {
    fig: 'Fig. 3', title: 'Warp sampling, as a tabulator', W: W, H: H,
    hint: 'Knob or ← →: kernel · Space: speed',
    label: 'An isometric tabulator. Four trays hold 12 warp pegs each, the four quadrants of an SM. A stylus on a gantry taps one warp at a fixed interval, and a bank of nine counters, one per state, counts what the tapped warps were doing.',
    keys: [['lit', 'the sampling stylus'], ['raised', 'tall peg: issuing · middle: ready, not picked · low: stalled']]
  });
  var svg = ui.svg;
  svg.innerHTML = '<defs><filter id="iso-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter></defs>';
  var L0 = I.el('g', {}, svg), L1 = I.el('g', {}, svg), L2 = I.el('g', {}, svg), L3 = I.el('g', {}, svg);
  function byDepth(pts) { return pts.sort(function (a, b) { return I.depth(P, [a[0], a[1], 0]) - I.depth(P, [b[0], b[1], 0]); }); }

  /* ---------- layer 0: base, back rail, sample clock ---------- */
  var s = I.halo(P, I.ring(BASE, 6), -12, 10);
  byDepth(I.corners(BASE, 16)).forEach(function (c) {
    s += I.solid(P, I.cyl(c[0], c[1], 7, -16, 1.6, 24), { tone: 'lo' });
    s += I.solid(P, I.cyl(c[0], c[1], 5.2, -14.4, 5.4, 24), { tone: 'mid' });
  });
  s += I.solid(P, I.slab(BASE, -9, 9, 8), { tone: 'mid' });
  s += I.planTop(P, I.inset(BASE, 5), 0, 'faint', 8);
  I.corners(BASE, 10).forEach(function (c) { s += I.screw(P, c[0], c[1], 0); });
  function rail(x) {
    var t = '';
    [-92, 0, 92].forEach(function (y) { t += I.solid(P, I.cyl(x, y, 3, 0, 12, 18), { tone: 'lo' }); });
    t += I.solid(P, I.slab({ x: x - 3, y: -100, w: 6, d: 200, r: 1 }, 12, 4, 2), { tone: 'mid' });
    t += I.line(P, [[x, -97, 16], [x, 97, 16]], 'faint');
    [-100, 97].forEach(function (y) { t += I.solid(P, I.box(x - 3.5, y, 7, 3, 16, 3), { tone: 'mid' }); });
    return t;
  }
  s += rail(-64);
  I.group(s, L0);

  /* ---------- layer 1: four quadrant trays with their warp pegs ---------- */
  var pegG = [];
  s = '';
  LX.forEach(function (x, l) {
    var TR = { x: x - 7, y: -80, w: 14, d: 160, r: 2 };
    s += I.solid(P, I.slab(TR, 0, 2.6, 3), { tone: 'mid', inner: I.sideSeam(P, TR, 1.2, 'faint', 3) });
    // quadrant index engraved as 1-4 dots at the tray's far end
    for (var d = 0; d <= l; d++) s += I.dots(P, [[x - 3 + d * 2, -77, 2.6]], 0.45, 'lo');
    for (var i = 0; i < PER; i++) { var q = pegXY(l, i); s += I.ringTop(P, q[0], q[1], 4, 2.6, 'faint', 16); }
  });
  I.group(s, L1);
  // pegs: rebuilt as their heights change; painted back to front
  var pegOrder = st.warps.slice().sort(function (a, b) { var A = pegXY(a.lane, a.i), B = pegXY(b.lane, b.i); return I.depth(P, [A[0], A[1], 0]) - I.depth(P, [B[0], B[1], 0]); });
  pegOrder.forEach(function (wp) { wp.g = I.el('g', {}, L1); wp.drawn = -1; });
  function drawPeg(wp) {
    var hq = Math.round(wp.h * 4) / 4;
    if (hq === wp.drawn && wp.lit === wp.wasLit) return;
    wp.drawn = hq; wp.wasLit = wp.lit;
    var q = pegXY(wp.lane, wp.i);
    wp.g.innerHTML = I.solid(P, I.cyl(q[0], q[1], 3.1, 2.6, hq, 18), { tone: hq > 6 ? 'hi' : 'mid' }) +
      I.ringTop(P, q[0], q[1], 1.4, 2.6 + hq, hq > 6 ? 'lo' : 'faint', 12);
  }

  /* ---------- layer 2: gantry (front rail, bridge, trucks, carriage, stylus) ---------- */
  var gRail = I.group(rail(18), L2);
  var gBack = I.el('g', {}, L2), gBridge = I.el('g', {}, L2), gCar = I.el('g', {}, L2), gRod = I.el('g', {}, L2), gFront = I.el('g', {}, L2);
  // the bridge and its trucks are built at y = 0 and moved along y; the carriage at x = 0, y = 0
  gBack.innerHTML = I.solid(P, I.box(-70, -6, 12, 12, 16, 9), { tone: 'mid' }) + I.dots(P, [[-67, -3, 25], [-61, 3, 25]], 0.45, 'mid');
  gBridge.innerHTML = I.solid(P, I.box(-58, -4, 70, 8, 19, 5), { tone: 'mid', inner: I.line(P, [[-58, 4, 21.5], [12, 4, 21.5]], 'faint') });
  gFront.innerHTML = I.solid(P, I.box(12, -6, 12, 12, 16, 9), { tone: 'mid' }) + I.dots(P, [[15, -3, 25], [21, 3, 25]], 0.45, 'mid');
  gCar.innerHTML = I.solid(P, I.box(-6, -6, 12, 17, 24, 6), { tone: 'mid', inner: I.line(P, [[6, -6, 27], [6, 11, 27]], 'faint') }) +
    I.solid(P, I.cyl(0, 8, 2.6, 30, 2.4, 18), { tone: 'mid', inner: I.knurl(P, 0, 8, 2.6, 30.3, 32.1, 10, 'lo') });
  var ROD_TOP = 24;
  function rodSvg(zTip) {
    return I.solid(P, I.cyl(0, 8, 2, ROD_TOP - 2.4, 2.4, 16), { tone: 'mid' }) +
      I.solid(P, I.cyl(0, 8, 1.1, zTip + 1.6, ROD_TOP - 2.4 - zTip - 1.6, 14), { lit: true }) +
      I.solid(P, I.frustum(I.circle(0, 8, 0.35, 12), zTip, I.circle(0, 8, 1.1, 12), zTip + 1.6), { lit: true });
  }

  /* ---------- layer 3: counter bank, sample clock, kernel knob ---------- */
  s = I.solid(P, I.slab({ x: CX0 - 2, y: CY0 - 4, w: CX1 - CX0 + 4, d: 9 * CW + 8 * CGAP + 8, r: 2 }, 0, 2, 3), { tone: 'lo' });
  I.group(s, L3);
  var ctr = [];
  var ey = I.vec(P, [0, 1, 0]), ez = I.vec(P, [0, 0, -1]);
  function faceM(x, y, z) { var o = I.p(P, [x, y, z]); return 'matrix(' + [ey[0], ey[1], ez[0], ez[1], o[0], o[1]].map(function (v) { return v.toFixed(4); }).join(' ') + ')'; }
  for (var j = 0; j < REASONS.length; j++) {
    var y0 = cy(j), HP = { x: CX0, y: y0, w: CX1 - CX0, d: CW, r: 1.2 };
    var g = I.el('g', {}, L3);
    var t = I.solid(P, I.slab(HP, 2, CZ - 2, 2), { tone: 'mid', inner: I.sideSeam(P, HP, 6, 'faint', 2) });
    t += I.planTop(P, I.inset(HP, 1.6), CZ, 'faint', 2);
    // the window in the front face (face coordinates: u along +y, v down from z = 17)
    t += '<g transform="' + faceM(CX1, y0, 17) + '">' +
      '<rect class="void" x="1.6" y="0" width="10.8" height="6.4" rx="0.6"/>' +
      '<path class="ln faint" d="M5.2 0V6.4M8.8 0V6.4"/>' +
      '<text class="smp-dig" x="3.4" y="4.85">0</text><text class="smp-dig" x="7" y="4.85">0</text><text class="smp-dig" x="10.6" y="4.85">0</text>' +
      '<circle class="dt mid" cx="1.4" cy="9.6" r="0.45"/><circle class="dt mid" cx="12.6" cy="9.6" r="0.45"/>' +
      '<rect class="ln faint" x="3.2" y="11.4" width="7.6" height="1.8" rx="0.4"/></g>';
    g.innerHTML = t;
    var tap = I.el('g', {}, g);
    ctr.push({ g: g, dig: g.querySelectorAll('text'), tap: tap, y: y0 + CW / 2, hit: -9, shown: -1 });
  }
  // a reset knob on the right-hand side of the last counter
  I.group(I.solid(P, I.drum('y', [CX0 + 9, cy(8) + CW + 1.6, 12], 2.6, 3.2, 20), { tone: 'mid' }), L3);
  // sample clock: a dial whose hand makes one turn per sampling interval
  var CLX = 46, CLY = -95;
  I.group(I.solid(P, I.cyl(CLX, CLY, 9, 0, 6, 40), { tone: 'mid', inner: I.arcFront(P, CLX, CLY, 9, 3, 'faint') }) +
    I.ringTop(P, CLX, CLY, 7.6, 6, 'lo', 40) + I.radialTicks(P, CLX, CLY, 7.4, 16, 4, 6, [1, 2], 0, 2 * Math.PI), L3);
  var hand = I.el('path', { class: 'ln hi', 'stroke-width': 0.9 }, L3);
  I.group(I.solid(P, I.cyl(CLX, CLY, 1.2, 6, 0.8, 12), { tone: 'hi' }), L3);
  // kernel knob on a dial plate with four stops
  var KX = 46, KY = 95, KSTOPS = [-1.05, -0.35, 0.35, 1.05];
  s = I.solid(P, I.cyl(KX, KY, 10, 0, 0.9, 40), { tone: 'lo' });
  KSTOPS.forEach(function (a) { s += I.line(P, [[KX + 8.2 * Math.sin(a), KY - 8.2 * Math.cos(a), 0.9], [KX + 10 * Math.sin(a), KY - 10 * Math.cos(a), 0.9]], 'mid'); });
  s += I.solid(P, I.cyl(KX, KY, 6.6, 0.9, 1.4, 32), { tone: 'mid' });
  s += I.solid(P, I.cyl(KX, KY, 5.6, 2.3, 5, 32), { tone: 'mid', inner: I.knurl(P, KX, KY, 5.6, 2.6, 7, 22, 'lo') });
  var knobG = I.group(s, L3);
  var ptr = I.el('path', { class: 'ln hi', 'stroke-width': 0.9 }, knobG);
  var kc = I.p(P, [KX, KY, 5]);
  var knobHit = I.el('circle', { 'data-hot': '', fill: 'transparent', cx: kc[0], cy: kc[1], r: 12 * P.s }, knobG);

  /* ---------- controls and the histogram under the card ---------- */
  var ctl = document.createElement('div'); ctl.className = 'iso-ctl';
  ctl.innerHTML = '<span class="grp">Kernel ' + KERNELS.map(function (k, i) { return '<button type="button" data-k="' + i + '">' + k.label + '</button>'; }).join('') + '</span>' +
    '<span class="grp">Speed <button type="button" data-f="0">slow</button><button type="button" data-f="1">fast</button></span>';
  var hist = document.createElement('ol'); hist.className = 'smp-hist'; hist.setAttribute('aria-label', 'Samples per state, in counter order from left to right');
  var rows = REASONS.map(function (r) {
    var li = document.createElement('li');
    li.innerHTML = '<code>' + r + '</code><span class="bar"><i></i></span><span class="pc"></span>';
    hist.appendChild(li);
    return { bar: li.querySelector('i'), pc: li.querySelector('.pc'), li: li };
  });
  var keysEl = host.querySelector('.iso-keys');
  host.insertBefore(ctl, keysEl);
  host.insertBefore(hist, keysEl);

  /* ---------- live ---------- */
  var calm = I.still();
  var gan = { x: LX[0], y: PY0, z: 13 }, tgt = { lane: 0, i: 0 }, phase = 0, clock = 0, sampleAt = 0, lastTap = -9;
  var cur = null;          // the warp under the stylus
  function setKernel(k, byUser) {
    st.k = k; reset();
    st.warps.forEach(function (wp) { roll(wp, clock); }); choose();
    if (calm) { for (var n = 0; n < 400; n++) { st.warps.forEach(function (wp) { roll(wp, 0); }); choose(); tally(st.warps[Math.floor(rnd() * st.warps.length)]); } }
    if (byUser) hold();
    ctl.querySelectorAll('[data-k]').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.k === k)); });
    ui.live.textContent = KERNELS[k].label + ': ' + KERNELS[k].say + '.';
    sampleAt = clock + 0.3; phase = 0;
    kick();
  }
  function setFast(f, byUser) {
    st.fast = f; if (byUser) hold();
    ctl.querySelectorAll('[data-f]').forEach(function (b) { b.setAttribute('aria-pressed', String(!!+b.dataset.f === f)); });
    kick();
  }
  function tally(wp) {
    if (st.total >= MAXN) return;
    var j = REASONS.indexOf(stateOf(wp));
    st.counts[j]++; st.total++;
    ctr[j].hit = clock;
  }
  ctl.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.k != null) setKernel(+b.dataset.k, true); else setFast(b.dataset.f === '1', true);
  });
  knobHit.addEventListener('click', function () { setKernel((st.k + 1) % KERNELS.length, true); });
  ui.stage.tabIndex = 0;
  ui.stage.setAttribute('role', 'group');
  ui.stage.setAttribute('aria-label', 'Sampling figure. Left and right arrows change the kernel, Space switches between slow and fast sampling.');
  ui.stage.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') setKernel((st.k + KERNELS.length - 1) % KERNELS.length, true);
    else if (e.key === 'ArrowRight') setKernel((st.k + 1) % KERNELS.length, true);
    else if (e.key === ' ' || e.key === 'Enter') setFast(!st.fast, true);
    else return;
    e.preventDefault();
  });

  // idle tour: each kernel slowly for a few samples, then fast until the shares settle
  var heldUntil = 1.4, tourK = 0, tourAt = 0;
  function hold() { heldUntil = clock + 3.6; tourAt = clock; }
  ['pointerenter', 'focusin', 'pointerdown'].forEach(function (ev) { host.addEventListener(ev, function () { heldUntil = Infinity; }); });
  ['pointerleave', 'focusout'].forEach(function (ev) { host.addEventListener(ev, function () { heldUntil = clock + 3.6; tourAt = clock; }); });
  function tour() {
    if (calm || clock < heldUntil) return;
    var age = clock - tourAt;
    if (!st.fast && age > 6) setFast(true, false);
    if (st.fast && st.total >= 420 && age > 9) { tourAt = clock; tourK = (st.k + 1) % KERNELS.length; setFast(false, false); setKernel(tourK, false); }
  }

  function smooth(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  var PERIOD_SLOW = 1.5, PERIOD_FAST = 0.035;
  function step(dt) {
    clock += dt;
    tour();
    var changed = false;
    st.warps.forEach(function (wp) { if (clock >= wp.next) { roll(wp, clock); changed = true; } });
    if (changed) choose();
    var period = st.fast ? PERIOD_FAST : PERIOD_SLOW;
    if (clock >= sampleAt && st.total < MAXN) {
      // the sampler picks one warp; in slow mode the stylus travels there and taps
      if (phase === 0) {
        cur = st.warps[Math.floor(rnd() * st.warps.length)];
        tgt = { lane: cur.lane, i: cur.i };
        phase = 1; sampleAt = clock + (st.fast ? 0 : 0.75);
      } else {
        tally(cur); lastTap = clock; phase = 0; sampleAt = clock + (st.fast ? period : period - 0.75);
      }
    }
  }
  function draw(dt) {
    var q = pegXY(tgt.lane, tgt.i);
    var tau = st.fast ? 0.03 : 0.18;
    gan.x = I.follow(gan.x, q[0], dt, tau, calm);
    gan.y = I.follow(gan.y, q[1], dt, tau, calm);
    // pegs ease to their state heights: issuing 10, ready 6.5, stalled 3
    st.warps.forEach(function (wp) {
      var hT = wp.sel ? 10 : wp.ready ? 6.5 : 3;
      wp.h = I.follow(wp.h, hT, dt, 0.12, calm);
      wp.lit = false;
      drawPeg(wp);
    });
    // stylus: hovers 4 above the peg, dips onto it at each tap
    var under = cur || st.warps[0];
    var top = 2.6 + under.h;
    var dip = calm ? 0 : Math.max(0, 1 - Math.abs(clock - lastTap) / (st.fast ? 0.035 : 0.14));
    var zTip = top + 0.4 + 4 * (1 - dip);
    var by = I.tr(P, [0, gan.y - 8, 0]);
    [gBack, gBridge, gFront].forEach(function (g) { g.setAttribute('transform', by); });
    var cr = I.tr(P, [gan.x, gan.y - 8, 0]);
    gCar.setAttribute('transform', cr); gRod.setAttribute('transform', cr);
    gRod.innerHTML = rodSvg(Math.min(zTip, ROD_TOP - 5));
    // counters: digits, and the tappet that dips when its count advances
    ctr.forEach(function (c, j) {
      var n = st.counts[j];
      if (n !== c.shown) { var ds = ('00' + n).slice(-3); for (var q3 = 0; q3 < 3; q3++) c.dig[q3].textContent = ds[q3]; c.shown = n; }
      var d = calm ? 0 : Math.max(0, 1 - (clock - c.hit) / 0.18) * (clock >= c.hit ? 1 : 0);
      var z0 = CZ + 3.4 - 1.6 * d;
      var key = Math.round(z0 * 10);
      if (key !== c.tk) { c.tk = key; c.tap.innerHTML = I.solid(P, I.cyl((CX0 + CX1) / 2, c.y, 2.6, CZ, 0.9, 18), { tone: 'lo' }) + I.solid(P, I.cyl((CX0 + CX1) / 2, c.y, 1.6, CZ + 0.9, z0 - CZ - 0.9, 14), { tone: 'mid' }); }
    });
    // the sample clock's hand: one turn per sampling interval
    var turn = st.fast ? (clock / PERIOD_FAST) % 1 : Math.max(0, Math.min(1, 1 - (sampleAt - clock) / PERIOD_SLOW));
    if (calm) turn = 0;
    var a = turn * 2 * Math.PI;
    hand.setAttribute('d', I.d([I.p(P, [CLX, CLY, 6.05]), I.p(P, [CLX + 6.6 * Math.sin(a), CLY - 6.6 * Math.cos(a), 6.05])]));
    var ka = KSTOPS[st.k];
    st.knob = st.knob == null ? ka : I.follow(st.knob, ka, dt, 0.15, calm);
    ptr.setAttribute('d', I.d([I.p(P, [KX, KY, 7.05]), I.p(P, [KX + 4.8 * Math.sin(st.knob), KY - 4.8 * Math.cos(st.knob), 7.05])]));
    // histogram and readout
    var best = 0;
    rows.forEach(function (r, j) {
      var sh = st.total ? st.counts[j] / st.total : 0;
      r.bar.style.width = (sh * 100).toFixed(1) + '%';
      r.pc.textContent = st.total ? Math.round(sh * 100) + '%' : '–';
      if (st.counts[j] > st.counts[best]) best = j;
    });
    rows.forEach(function (r, j) { r.li.classList.toggle('top', st.total > 0 && j === best); });
    ui.readout.textContent = KERNELS[st.k].short + ' · ' + st.total + ' sample' + (st.total === 1 ? '' : 's') +
      (st.total ? ' · ' + REASONS[best] + ' ' + Math.round(100 * st.counts[best] / st.total) + '%' : '');
  }

  var frame = 0, last = 0, visible = false;
  function tick(now) {
    var dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60; last = now;
    step(dt); draw(dt);
    frame = visible && !calm ? requestAnimationFrame(tick) : 0;
  }
  function kick() { if (calm) { draw(1); return; } if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } }
  new IntersectionObserver(function (es) { visible = es[es.length - 1].isIntersecting; if (visible) kick(); }, { rootMargin: '120px 0px' }).observe(ui.stage);

  setFast(false, false);
  setKernel(0, false);
  heldUntil = 1.4;
  draw(1);

  var capEl = document.createElement('p'); capEl.className = 'iso-cap';
  capEl.innerHTML = '<b>Fig. 3</b> &mdash; Where the stall table comes from. The four trays are the SM&rsquo;s quadrants, 12 warps each: a tall peg is the warp its quadrant issues this cycle, a middle one is ready but not picked (<code>not_selected</code>), a low one is stalled. At a fixed interval of cycles the sampler taps one warp and records its state; the counters, one per state in the order of the list, add up the taps, and their shares are the shape of the table Nsight Compute shows. No single sample says much, but hundreds of them converge on where the warps spend their time. The four kernels&rsquo; state mixes are illustrative, not measurements: lab 4 gives you real ones.';
  host.appendChild(capEl);
})();
