/* fig-press.js — chapter 4, §1 "One chart, two limits". The roofline as a press line.
   A magazine (DRAM) feeds blanks (bytes) onto a conveyor at a fixed top rate (bandwidth);
   each blank needs a number of strokes (FLOPs per byte, set by the knob); the press has a
   top stroke rate (peak FLOP/s). Attainable = min(P, I x beta). Below the ridge the ram
   waits between blanks; above it the conveyor crawls and the magazine waits. */
(function () {
  'use strict';
  var host = document.getElementById('fig-press');
  if (!host || !window.ISO) return;
  var I = ISO;

  /* ---------- the model (the chapter's numbers, FP32 cores) ---------- */
  var PEAK = 30.9, BW = 672, RIDGE = PEAK * 1000 / BW;          // TFLOP/s, GB/s, FLOP/B (= 46)
  var KERNELS = [
    { name: 'vecadd', I: 0.083, say: 'vector add, 1 FLOP per 12 bytes' },
    { name: 'naive matmul', I: 0.25, say: 'naive matmul, nothing reused' },
    { name: 'tiled 16×16', I: 4, say: 'matmul with 16 by 16 shared-memory tiles' },
    { name: 'tiled 32×32', I: 8, say: 'matmul with 32 by 32 shared-memory tiles' },
    { name: 'register-tiled', I: 32, say: 'matmul with register tiles' },
    { name: 'matmul limit', I: 683, say: 'the matmul at its algorithmic intensity, 683' }
  ];
  var S_RIDGE = 4;            // strokes per blank at the ridge: one blank's worth of FLOPs
  var T_BLANK = 1.25;         // seconds of film per blank at full feed (672 GB/s)
  function attain(k) { return Math.min(PEAK, KERNELS[k].I * BW / 1000); }
  function rates(k) {
    var s = S_RIDGE * KERNELS[k].I / RIDGE;                    // strokes each blank needs
    return { s: s, feed: Math.min(1, S_RIDGE / s), press: Math.min(1, s / S_RIDGE) };   // fractions of the two top rates
  }
  var st = { k: 3, feed: 1, press: 0, bp: 0, strokes: 0, fly: 0, flyRate: 0 };

  /* ---------- world ---------- */
  var W = 640, H = 340;
  var P = I.camera(33, 30);
  var BASE = { x: -62, y: -206, w: 130, d: 384, r: 8 };
  var BY0 = -176, BY1 = 122, BZ = 20, PITCH = 24, PY = 40;     // belt ends, belt top, blank pitch, press centre line
  I.fit(P, [[-62, -206, -16], [68, -206, -16], [68, 178, -16], [-62, 178, -16], [-18, -186, 56], [0, 40, 101], [0, 63, 95]], W, H, 12);

  var ui = I.card(host, {
    fig: 'Fig. 2', title: 'The roofline as a press line', W: W, H: H,
    hint: 'Turn the knob: click it, or ← →',
    label: 'An isometric press line. A magazine feeds blanks onto a conveyor that runs into a stamping press. A knob sets how many strokes each blank needs; two gauges show how busy the feed and the press are.',
    keys: [['lit', 'the ram: the arithmetic units'], ['mempale', 'a blank: bytes from DRAM'], ['workpale', 'the press, and blanks it has stamped'], ['mem', 'feed gauge: memory busy'], ['work', 'press gauge: arithmetic busy']]
  });
  var svg = ui.svg;
  svg.innerHTML = '<defs><filter id="iso-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter></defs>';
  var gBack = I.el('g', {}, svg), gBlanks = I.el('g', {}, svg), gRail = I.el('g', {}, svg), gLive = I.el('g', {}, svg);
  function byDepth(pts) { return pts.sort(function (a, b) { return I.depth(P, [a[0], a[1], 0]) - I.depth(P, [b[0], b[1], 0]); }); }

  /* ---------- static, back layer: base, bolster, legs, belt ---------- */
  var s = '';
  s += I.halo(P, I.ring(BASE, 6), -12, 10);
  byDepth(I.corners(BASE, 18)).forEach(function (c) {
    s += I.solid(P, I.cyl(c[0], c[1], 7, -16, 1.6, 24), { tone: 'lo' });
    s += I.solid(P, I.cyl(c[0], c[1], 5.2, -14.4, 5.4, 24), { tone: 'mid' });
  });
  s += I.solid(P, I.slab(BASE, -9, 9, 8), { tone: 'mid' });
  s += I.planTop(P, I.inset(BASE, 5), 0, 'faint', 8);
  I.corners(BASE, 10).forEach(function (c) { s += I.screw(P, c[0], c[1], 0); });
  // ruler on the front strip, between the feed gauge and the press gauge
  var RUL = { x: 44, y: -114, w: 7, d: 86, r: 1 };
  s += I.solid(P, I.slab(RUL, 0, 0.8, 2), { tone: 'lo' });
  s += I.ticks(P, RUL.y + 3, RUL.y + RUL.d - 3, 4, 5, RUL.x + RUL.w, 0.8, [2.2, 4.2], 'y');
  // press bolster with its hold-down screws
  var BOL = { x: -34, y: 22, w: 68, d: 36, r: 2 };
  s += I.solid(P, I.slab(BOL, 0, 12, 3), { tone: 'mid', mat: 'work', inner: I.sideSeam(P, BOL, 3, 'work', 3) });
  [[-30, 26], [30, 26], [-30, 54], [30, 54]].forEach(function (c) { s += I.screw(P, c[0], c[1], 12); });
  // legs under both belt rails (not under the bolster), back rail, belt, rollers
  var legs = [];
  [-16.5, 16.5].forEach(function (x) { [-150, -84, -18, 86].forEach(function (y) { legs.push([x, y]); }); });
  byDepth(legs).forEach(function (q) {
    s += I.solid(P, I.cyl(q[0], q[1], 3.2, 0, 1.2, 16), { tone: 'lo' });
    s += I.solid(P, I.cyl(q[0], q[1], 2, 1.2, 10.8, 16), { tone: 'lo', mat: 'steel' });
  });
  // the press's back column stands behind the belt, so it is drawn before the back rail
  s += I.solid(P, I.cyl(-26, PY, 6.4, 12, 3, 24), { tone: 'mid', mat: 'steel' });
  s += I.solid(P, I.cyl(-26, PY, 4.2, 15, 59, 24), { tone: 'mid', mat: 'steel', inner: I.arcFront(P, -26, PY, 4.2, 20, 'faint') });
  s += I.solid(P, I.drum('x', [0, BY0, 16], 4.5, 34, 28), { tone: 'mid', mat: 'steel' });
  s += I.solid(P, I.slab({ x: -18, y: BY0, w: 3, d: BY1 - BY0, r: 0.6 }, 12, 9.5, 2), { tone: 'mid', mat: 'steel' });
  s += I.solid(P, I.box(-15, BY0, 30, BY1 - BY0, 17.6, 2.4), { tone: 'lo', mat: 'mem' });
  I.group(s, gBack);
  var slats = I.el('path', { class: 'ln mem' }, gBack);

  /* ---------- blanks on the belt: a pool, placed by belt position ---------- */
  function blankSvg(stamped) {
    var t = I.solid(P, I.slab({ x: -9, y: -8, w: 18, d: 16, r: 1.2 }, BZ, 2.6, 2), { tone: 'mid', cls: 'soft', mat: 'mem' });
    return t;
  }
  var blanks = [];
  for (var i = 0; i < 16; i++) {
    var g = I.group(blankSvg(), gBlanks);
    var mark = I.el('g', {}, g);
    mark.innerHTML = I.ringTop(P, 0, 0, 4.2, BZ + 2.6, 'workl', 24) + I.ringTop(P, 0, 0, 2.2, BZ + 2.6, 'work', 18);
    blanks.push({ node: g, mark: mark, key: 0 });
  }
  var O = I.p(P, [0, 0, 0]);

  /* ---------- front rail (in front of every blank), front roller ---------- */
  I.group(I.solid(P, I.slab({ x: 15, y: BY0, w: 3, d: BY1 - BY0, r: 0.6 }, 12, 9.5, 2), { tone: 'mid', mat: 'steel' }) +
    I.dots(P, [-160, -100, -40, 100].map(function (y) { return [18, y, 16.75]; }), 0.45, 'mid') +
    I.solid(P, I.drum('x', [0, BY1, 16], 4.5, 34, 28), { tone: 'mid', mat: 'steel' }), gRail);

  /* ---------- live items, sorted by depth ---------- */
  var items = [];
  function item(svgText, key) { var n = I.group(svgText, gLive); var it = { node: n, key: key }; items.push(it); return it; }
  function keyAt(x, y, z) { return I.depth(P, [x, y, z]); }

  // the magazine over the belt's start: back posts, the stack, front posts, cap
  (function () {
    var t = '', MY = -172;
    [[-16.5, MY - 12], [-16.5, MY + 12]].forEach(function (q) { t += I.solid(P, I.cyl(q[0], q[1], 1.6, 21.5, 33, 14), { tone: 'mid', mat: 'steel' }); });
    for (var j = 0; j < 9; j++) t += I.solid(P, I.slab({ x: -9, y: MY - 8, w: 18, d: 16, r: 1.2 }, 24 + j * 3.1, 2.6, 2), { tone: 'mid', cls: 'soft', mat: 'mem' });
    [[16.5, MY - 12], [16.5, MY + 12]].forEach(function (q) { t += I.solid(P, I.cyl(q[0], q[1], 1.6, 21.5, 33, 14), { tone: 'mid', mat: 'steel' }); });
    var cap = { x: -19, y: MY - 15, w: 38, d: 30, r: 2 };
    t += I.solid(P, I.slab(cap, 54.5, 2.4, 3), { tone: 'mid', mat: 'steel' });
    t += '<path class="void" d="' + I.d(I.ring({ x: -10.5, y: MY - 9.5, w: 21, d: 19, r: 1.5 }, 2).map(function (q) { return I.p(P, [q[0], q[1], 56.9]); }), true) + '"/>';
    [[-16.5, MY - 12], [16.5, MY - 12], [-16.5, MY + 12], [16.5, MY + 12]].forEach(function (q) { t += I.dots(P, [[q[0], q[1], 56.9]], 0.5, 'mid'); });
    item(t, keyAt(0, MY, 40));
  })();

  // press: back column, ram (+ rod), front column, crown, motor, flywheel
  var ram = item('', 0);
  var RAM_UP = 46, RAM_DOWN = BZ + 2.6 + 2.6;   // the punch (2.4 tall) just meets the blank
  function ramSvg(z) {
    var t = I.solid(P, I.cyl(0, PY, 3, z + 14, 74 - z - 14, 18), { tone: 'mid', mat: 'steel' });
    t += I.solid(P, I.box(-21.6, PY - 4, 2, 8, z + 3, 8), { tone: 'mid' });
    t += I.solid(P, I.cyl(0, PY, 5, z - 2.4, 2.4, 24), { lit: true, tone: 'hi' });
    t += I.solid(P, I.slab({ x: -20, y: PY - 10, w: 40, d: 20, r: 1.5 }, z, 14, 3), { lit: true, tone: 'hi', inner: I.sideSeam(P, { x: -20, y: PY - 10, w: 40, d: 20, r: 1.5 }, z + 4, 'faint', 3) });
    t += I.solid(P, I.box(19.6, PY - 4, 2, 8, z + 3, 8), { tone: 'mid' });
    return t;
  }
  item(I.solid(P, I.cyl(26, PY, 6.4, 12, 3, 24), { tone: 'mid', mat: 'steel' }) +
       I.solid(P, I.cyl(26, PY, 4.2, 12, 62, 24), { tone: 'mid', mat: 'steel', inner: I.arcFront(P, 26, PY, 4.2, 20, 'faint') }), keyAt(26, PY, 43));
  (function () {
    var CR = { x: -34, y: 24, w: 68, d: 32, r: 3 };
    var t = I.solid(P, I.slab(CR, 74, 14, 4), { tone: 'mid', mat: 'work', inner: I.sideSeam(P, CR, 78, 'work', 4) });
    t += I.planTop(P, I.inset(CR, 3), 88, 'work', 4);
    [[-30, 28], [30, 28], [-30, 52], [30, 52]].forEach(function (c) { t += I.screw(P, c[0], c[1], 88); });
    item(t, keyAt(0, PY, 81));
    var MO = { x: -16, y: 30, w: 26, d: 20, r: 4 };
    var m = I.solid(P, I.slab(MO, 88, 13, 6), { tone: 'mid', mat: 'work', inner: I.sideSeam(P, MO, 91, 'faint', 6) + I.sideSeam(P, MO, 94, 'faint', 6) + I.sideSeam(P, MO, 97, 'faint', 6) });
    m += I.solid(P, I.drum('x', [12.5, 40, 94.5], 4.2, 5, 24), { tone: 'mid' });
    m += I.planTop(P, I.inset(MO, 3), 101, 'faint', 6);
    item(m, keyAt(0, 40, 95));
  })();
  // flywheel on the crown's front face: rim and hub fixed, spokes turn
  // the flywheel turns on the crown's downstream face (axis along y), clear of the ram
  var FY = 60.5, FZ = 81, FR = 13, FF = FY + 2.25;
  var fly = item(I.solid(P, I.drum('y', [0, 58, FZ], 4, 4, 20), { tone: 'mid' }) +
    I.solid(P, I.drum('y', [0, FY, FZ], FR, 4.5, 48), { tone: 'mid' }) +
    '<path class="ln faint" d="' + I.d(I.circle(0, 0, FR - 2.6, 48).map(function (q) { return I.p(P, [q[0], FF, FZ + q[1]]); }), true) + '"/>', keyAt(0, FY, FZ));
  var spokes = I.el('path', { class: 'ln lo' }, fly.node);
  var flyHub = I.el('g', {}, fly.node);
  flyHub.innerHTML = I.solid(P, I.drum('y', [0, FF + 0.7, FZ], 3.4, 1.4, 20), { tone: 'mid' });

  // output bin at the far end, with a few finished blanks inside
  (function () {
    var BIN = { x: -24, y: 130, w: 48, d: 40, r: 3 };
    var t = I.solid(P, I.slab(BIN, 0, 5, 4), { tone: 'mid', inner: I.sideSeam(P, BIN, 1.6, 'faint', 4) });
    t += I.planTop(P, I.inset(BIN, 3), 5, 'faint', 3);
    [[-9.6, 141, 5], [9.6, 141, 3], [-9.6, 160, 2], [9.6, 160, 4]].sort(function (a, b) { return I.depth(P, [a[0], a[1], 0]) - I.depth(P, [b[0], b[1], 0]); }).forEach(function (q) {
      for (var j = 0; j < q[2]; j++) t += I.solid(P, I.slab({ x: q[0] - 9, y: q[1] - 8, w: 18, d: 16, r: 1.2 }, 5 + j * 2.7, 2.6, 2), { tone: 'mid', cls: 'soft', mat: 'work' });
      var top = 5 + q[2] * 2.7 - 0.1;
      t += I.ringTop(P, q[0], q[1], 4.2, top, 'work', 24) + I.ringTop(P, q[0], q[1], 2.2, top, 'work', 18);
    });
    item(t, keyAt(0, 150, 7));
  })();

  // gauges: feed (left, by the magazine) and press (by the press)
  var G0 = -0.75 * Math.PI, GSPAN = 1.5 * Math.PI, GZ = 11;
  function gauge(x, y, kind) {
    var it = item(I.solid(P, I.cyl(x, y, 8, 0, 6, 28), { tone: 'lo' }) +
      I.solid(P, I.cyl(x, y, 12.5, 6, 5, 56), { tone: 'hi', crease: 'lo', inner: I.knurl(P, x, y, 12.5, 7.2, 10.4, 40, 'faint') }) +
      I.ringTop(P, x, y, 11.6, GZ, 'lo', 56) +
      I.radialTicks(P, x, y, 11, 20, 5, GZ, [1.1, 2.4], G0, GSPAN) +
      I.solid(P, I.box(x - 2, y - 15.5, 4, 3.2, 7, 2.6), { tone: 'mid' }), keyAt(x, y, 6));
    it.needle = I.el('path', { class: 'ln ' + kind + 'l' }, it.node);
    I.group(I.solid(P, I.cyl(x, y, 1.4, GZ, 0.8, 12), { tone: 'hi', mat: kind + 'x' }), it.node);
    it.x = x; it.y = y; it.v = 0;
    return it;
  }
  var gFeed = gauge(52, -146, 'mem'), gPress = gauge(52, -6, 'work');

  // the intensity knob, six stops on a dial plate
  var STOPS = KERNELS.map(function (_, j) { return -2.1 + 4.2 * j / (KERNELS.length - 1); });
  var knob = (function (x, y) {
    var t = I.solid(P, I.cyl(x, y, 11, 0, 0.9, 44), { tone: 'lo' });
    STOPS.forEach(function (a) { t += I.line(P, [[x + 9 * Math.sin(a), y - 9 * Math.cos(a), 0.9], [x + 11 * Math.sin(a), y - 11 * Math.cos(a), 0.9]], 'mid'); });
    t += I.solid(P, I.cyl(x, y, 7, 0.9, 1.4, 32), { tone: 'mid' });
    t += I.solid(P, I.cyl(x, y, 6, 2.3, 5.4, 32), { tone: 'mid', inner: I.knurl(P, x, y, 6, 2.6, 7.4, 22, 'lo') });
    var it = item(t, keyAt(x, y, 3));
    it.ptr = I.el('path', { class: 'ln hi', 'stroke-width': 0.9 }, it.node);
    var c = I.p(P, [x, y, 5]);
    it.hit = I.el('circle', { 'data-hot': '', fill: 'transparent', cx: c[0], cy: c[1], r: 13 * P.s }, it.node);
    it.x = x; it.y = y; it.ang = STOPS[st.k];
    return it;
  })(52, 96);
  // label plate in front of the bin
  (function () {
    // label plate along the front strip; its rule lines (printed text) run along y
    var pl = { x: 47, y: 126, w: 14, d: 40, r: 1 }, t = I.solid(P, I.slab(pl, 0, 0.8, 2), { tone: 'lo' });
    t += I.planTop(P, I.inset(pl, 1.4), 0.8, 'faint', 2);
    [[-0.26, 0.85], [0, 0.6], [0.26, 0.4]].forEach(function (r) {
      var x = pl.x + pl.w / 2 + r[0] * pl.w;
      t += '<path class="ln lo" data-free d="' + I.d([I.p(P, [x, pl.y + 4, 0.8]), I.p(P, [x, pl.y + 4 + (pl.d - 8) * r[1], 0.8])]) + '"/>';
    });
    t += I.dots(P, [[pl.x + pl.w / 2, pl.y + 2.2, 0.8], [pl.x + pl.w / 2, pl.y + pl.d - 2.2, 0.8]], 0.45, 'mid');
    I.group(t, gBack);
  })();

  /* ---------- controls outside the drawing ---------- */
  var ctl = document.createElement('div'); ctl.className = 'iso-ctl';
  ctl.innerHTML = '<span class="grp">Kernel ' + KERNELS.map(function (k, j) {
    return '<button type="button" data-k="' + j + '">' + k.name + ' <span style="opacity:.7">(' + k.I + ')</span></button>';
  }).join('') + '</span>';
  host.insertBefore(ctl, host.querySelector('.iso-keys'));

  /* ---------- live ---------- */
  var calm = I.still();
  function fmtT(x) { return x >= 10 ? x.toFixed(1) : x >= 1 ? x.toFixed(2) : x.toFixed(3); }
  function set(k, byUser) {
    st.k = k;
    if (byUser) hold();
    ctl.querySelectorAll('[data-k]').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.k === k)); });
    var K = KERNELS[k], r = rates(k), a = attain(k);
    ui.live.textContent = K.say + ': ' + K.I + ' FLOPs per byte, at most ' + fmtT(a) + ' TFLOP/s, ' +
      (K.I < RIDGE ? 'memory-bound: the press is busy ' + Math.round(r.press * 100) + '% of the time.' : 'compute-bound: the feed runs at ' + Math.round(r.feed * 100) + '% of 672 GB/s.');
    kick();
  }
  ctl.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) set(+b.dataset.k, true); });
  knob.hit.addEventListener('click', function () { set((st.k + 1) % KERNELS.length, true); });
  ui.stage.tabIndex = 0;
  ui.stage.setAttribute('role', 'group');
  ui.stage.setAttribute('aria-label', 'Press line figure. Left and right arrows step the kernel, Home and End go to the extremes.');
  ui.stage.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') set(Math.max(0, st.k - 1), true);
    else if (e.key === 'ArrowRight') set(Math.min(KERNELS.length - 1, st.k + 1), true);
    else if (e.key === 'Home') set(0, true);
    else if (e.key === 'End') set(KERNELS.length - 1, true);
    else return;
    e.preventDefault();
  });

  var TOUR = [0, 1, 2, 3, 4, 5], tourI = 3, tourAt = 0, heldUntil = 1.4, clock = 0;
  function hold() { heldUntil = clock + 3.6; }
  ['pointerenter', 'focusin', 'pointerdown'].forEach(function (ev) { host.addEventListener(ev, function () { heldUntil = Infinity; }); });
  ['pointerleave', 'focusout'].forEach(function (ev) { host.addEventListener(ev, function () { heldUntil = clock + 3.6; }); });

  // the ram's height over one stroke (u in 0..1): down fast, a short dwell, up
  function stroke(u) {
    if (u <= 0 || u >= 1) return 0;
    if (u < 0.35) { var a = u / 0.35; return a * a; }
    if (u < 0.5) return 1;
    var b = (u - 0.5) / 0.5; return 1 - b * (2 - b);
  }
  var frame = 0, last = 0, visible = false;
  function draw(dt) {
    var r = rates(st.k), TS = T_BLANK / S_RIDGE;                  // seconds per stroke at full rate
    // feed and press rates ease to the new kernel, like a clutch taking up
    st.feed = I.follow(st.feed, r.feed, dt, 0.35, calm);
    st.press = I.follow(st.press, r.press, dt, 0.35, calm);
    if (!calm) {
      st.bp += dt * st.feed / T_BLANK;                          // belt position, in blanks
      st.strokes += dt * st.press * S_RIDGE / T_BLANK;           // strokes done
      st.flyRate = I.follow(st.flyRate, 0.4 + 2.6 * st.press, dt, 0.8, calm);
      st.fly += dt * st.flyRate;
    }
    // ram: each stroke takes TS; strokes are spaced 1/rate apart, so at full rate they run back to back
    var rate = st.press * S_RIDGE / T_BLANK, z = RAM_UP;
    if (!calm && rate > 1e-6) {
      var since = (st.strokes % 1) / rate;                       // seconds since the last stroke began
      if (r.s < 1) {
        // fewer strokes than blanks: strike blank n_k = ceil(k / s) as it reaches the die
        var kk = Math.floor(Math.floor(st.bp) * r.s + 1e-9);
        since = kk > 0 ? (st.bp - Math.ceil(kk / r.s - 1e-9)) * T_BLANK / Math.max(st.feed, 1e-3) : 1e9;
      }
      z = RAM_UP - (RAM_UP - RAM_DOWN) * stroke(since / TS);
    }
    ram.node.innerHTML = ramSvg(z);
    ram.key = keyAt(0, PY, z + 7);
    // blanks: blank n sits at the press when bp = n; it is stamped there if this kernel strikes it
    var sNow = r.s, n0 = Math.floor(st.bp) - 5;
    blanks.forEach(function (b, i) {
      var n = n0 + i, y = PY + (st.bp - n) * PITCH, z0 = 0, op = 1;
      if (y < BY0 + 2) { b.node.style.display = 'none'; return; }
      if (y > BY1 - 4) { var f = (y - (BY1 - 4)) / 14; z0 = -6 * f * f; op = Math.max(0, 1 - f); }
      b.node.style.display = op < 0.02 ? 'none' : '';
      b.node.style.opacity = op.toFixed(2);
      var sc = I.p(P, [0, y, z0]);
      b.node.setAttribute('transform', 'translate(' + (sc[0] - O[0]).toFixed(2) + ' ' + (sc[1] - O[1]).toFixed(2) + ')');
      var hit = sNow >= 1 || Math.floor(n * sNow + 1e-9) > Math.floor((n - 1) * sNow + 1e-9);
      b.mark.style.display = hit && st.bp > n + 0.12 ? '' : 'none';
    });
    // the belt's slats move with it
    var d = '', off = ((st.bp * PITCH) % 8 + 8) % 8;
    for (var yy = BY0 + off; yy < BY1; yy += 8) d += I.d([I.p(P, [-15, yy, BZ]), I.p(P, [15, yy, BZ])]);
    slats.setAttribute('d', d);
    // flywheel spokes on its front face
    var sp = '';
    for (var j = 0; j < 5; j++) {
      var a = st.fly + j * 2 * Math.PI / 5;
      sp += I.d([I.p(P, [3.4 * Math.sin(a), FF, FZ + 3.4 * Math.cos(a)]), I.p(P, [(FR - 2.6) * Math.sin(a), FF, FZ + (FR - 2.6) * Math.cos(a)])]);
    }
    spokes.setAttribute('d', sp);
    I.sortInto(gLive, items);
    // gauges read the two utilisations; the knob turns to its stop
    [[gFeed, st.feed], [gPress, st.press]].forEach(function (g) {
      var a = G0 + GSPAN * g[1];
      g[0].needle.setAttribute('d', I.d([I.p(P, [g[0].x - 2.5 * Math.sin(a), g[0].y + 2.5 * Math.cos(a), GZ + 0.4]), I.p(P, [g[0].x + 9.6 * Math.sin(a), g[0].y - 9.6 * Math.cos(a), GZ + 0.4])]));
    });
    knob.ang = I.follow(knob.ang, STOPS[st.k], dt, 0.15, calm);
    knob.ptr.setAttribute('d', I.d([I.p(P, [knob.x, knob.y, 7.75]), I.p(P, [knob.x + 5.2 * Math.sin(knob.ang), knob.y - 5.2 * Math.cos(knob.ang), 7.75])]));
    // readout from the moving parts: achieved = press rate x peak
    var K = KERNELS[st.k], pr = Math.abs(st.press - r.press) < 0.004 ? r.press : st.press, achieved = pr * PEAK;
    ui.readout.textContent = K.name + ' · ' + K.I + ' FLOP/B · ' + fmtT(achieved) + ' TFLOP/s · ' + (K.I < RIDGE ? 'memory-bound' : 'compute-bound');
  }
  function tick(now) {
    var dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60; last = now;
    clock += dt;
    if (!calm && clock > heldUntil && clock - tourAt > 7.5) { tourAt = clock; tourI = (tourI + 1) % TOUR.length; set(TOUR[tourI], false); }
    draw(dt);
    frame = visible && !calm ? requestAnimationFrame(tick) : 0;
  }
  function kick() { if (calm) { draw(1); return; } if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } }
  new IntersectionObserver(function (es) { visible = es[es.length - 1].isIntersecting; if (visible) kick(); }, { rootMargin: '120px 0px' }).observe(ui.stage);

  var r0 = rates(st.k); st.feed = r0.feed; st.press = r0.press; st.flyRate = 0.4 + 2.6 * r0.press; st.bp = 0.6;
  set(st.k, false);
  draw(0);

  var cap = document.createElement('p'); cap.className = 'iso-cap';
  cap.innerHTML = '<b>Fig. 2</b> &mdash; The same min( P, I &times; &beta; ) as a machine. The magazine feeds at most one blank per beat (672 GB/s); the press strikes at most four times per beat (30.9 TFLOP/s on the FP32 cores); the knob sets how many strokes a blank needs, in proportion to its FLOPs per byte. Below the ridge at 46 the belt runs flat out and the ram waits between blanks; past it the ram never stops and the belt crawls. The gauges show both utilisations, and only at the ridge are both full. Intensities are the algorithmic ones from this chapter; the throughputs are ceilings, not measurements.';
  host.appendChild(cap);
})();
