/* fig-flash.js - chapter 14, Fig. 3. One Q tile held still while K/V tiles stream past it.
   Toy sizes: T = 16 queries and keys, D = 4, Br = Bc = 4, causal. The followed Q block is rows 8-11:
   it runs key tiles 0 and 1 fully, tile 2 on the diagonal, and skips tile 3. Every number on screen comes
   from model() below: section 3's merge in double precision (exact), the byte formulas of section 4,
   the causal skip rule of section 8. Illustrative: the Q, K, V values (fixed, chosen so that row 8's max
   rises twice) and the pace. */
(function () {
  'use strict';
  window.MLFilms = window.MLFilms || {};

  /* ---------- the model ---------- */
  var T = 16, D = 4, BR = 4, BC = 4, FB = 2;                       // FB: the followed block (rows 8-11)
  var Q = [[-0.5, -2, -2, -0.5], [0.5, -0.5, -0.5, 1], [0.5, 1.5, 0.5, -1], [0, -1.5, -1.5, 0.5], [2, -0.5, 0, -1.5], [-1.5, 2, -2, 0], [-2, -2, 0.5, -1], [0.5, 1, 0.5, -0.5],
           [0.5, -2, -1, 1], [-2, 1, 0.5, -2], [-2, -0.5, 0.5, 0.5], [0, 0, -0.5, -0.5], [0.5, -2, -1, 0], [2, -0.5, -0.5, -2], [0, -1.5, -0.5, -1], [1, 1.5, -2, 1.5]];
  var K = [[1.5, 0.5, -0.5, 0.5], [-1, 1, 2, 1], [1.5, 1, 0.5, -1.5], [2, -1.5, 1, -2], [0.5, 0, -2, -1.5], [1, -1, 2, -2], [-1, -0.5, -0.5, 1.5], [-0.5, -1, -1.5, -1],
           [-1.5, -1.5, -1.5, 1], [2, 0, -2, 2], [-0.5, 0.5, -1, 0], [1, 0.5, -1.5, -1], [0, -1, -1, 2], [0, -2, -2, 0], [1, -1, 2, 2], [-1, 1.5, -1, -1.5]];
  var V = [[-1.5, 0, -1.5, -0.5], [-2, 0, -2, 2], [1.5, 0.5, 0.5, -1], [1.5, 1, 1.5, -0.5], [1, -1, -2, -2], [-0.5, 1.5, -2, 1], [1.5, 2, 2, 0.5], [-2, 0.5, 0.5, -2],
           [0.5, 0.5, -2, 2], [-0.5, -1, 2, 1.5], [1.5, 2, 1, -1], [1, 0, 0.5, 1], [-1, 1, -2, 1.5], [0.5, 1.5, 0, 1.5], [-1.5, 1.5, 2, 1], [-2, -1, 0.5, 0]];
  function score(i, j) { var s = 0; for (var d = 0; d < D; d++) s += Q[i][d] * K[j][d]; return s / Math.sqrt(D); }
  // one Q block's loop: for each tile j <= block, the state of every row before and after, and the alpha applied
  function runBlock(b) {
    var rows = [], steps = [];
    for (var r = 0; r < BR; r++) rows.push({ m: -Infinity, l: 0, O: [0, 0, 0, 0] });
    for (var j = 0; j <= b; j++) {
      var st = { j: j, rows: [] };
      rows.forEach(function (R, r) {
        var i = b * BR + r, s = [], mt = -Infinity;
        for (var c = 0; c < BC; c++) { var k = j * BC + c; s.push(k <= i ? score(i, k) : null); if (k <= i) mt = Math.max(mt, s[c]); }
        var mn = Math.max(R.m, mt), alpha = R.m === -Infinity ? 0 : Math.exp(R.m - mn);
        var before = { m: R.m, l: R.l, O: R.O.slice() }, l = alpha * R.l, O = R.O.map(function (x) { return alpha * x; });
        var mid = { m: mn, l: l, O: O.slice() };
        for (c = 0; c < BC; c++) if (s[c] !== null) { var p = Math.exp(s[c] - mn); l += p; for (var d = 0; d < D; d++) O[d] += p * V[j * BC + c][d]; }
        R.m = mn; R.l = l; R.O = O;
        st.rows.push({ i: i, s: s, mt: mt, alpha: alpha, rises: before.m !== -Infinity && mt > before.m, before: before, mid: mid, after: { m: mn, l: l, O: O.slice() } });
      });
      steps.push(st);
    }
    return { steps: steps, final: rows.map(function (R) { return { m: R.m, l: R.l, O: R.O.map(function (x) { return x / R.l; }) }; }) };
  }
  function direct(i) {                                               // the plain softmax of row i, for the check
    var s = [], m = -Infinity, sum = 0, O = [0, 0, 0, 0];
    for (var k = 0; k <= i; k++) { s.push(score(i, k)); m = Math.max(m, s[k]); }
    s.forEach(function (x, k) { var p = Math.exp(x - m); sum += p; for (var d = 0; d < D; d++) O[d] += p * V[k][d]; });
    return O.map(function (x) { return x / sum; });
  }
  var RUN = runBlock(FB), ALL = [0, 1, 2, 3].map(runBlock);
  // bytes to DRAM, FP32. naive: S written, read, P written, read (16 per score). flash: Q and O once per block,
  // K and V once per tile a block processes (the count if nothing hit L2).
  var NAIVE = 16 * T * T, QO = 4 * BR * D, KV = 2 * 4 * BC * D;
  function big() {                                                  // the same formulas at T = 4,096, D = 64, Br = Bc = 64
    var t = 4096, d = 64, nb = t / 64, tiles = nb * (nb + 1) / 2;
    return { naive: 16 * t * t, qo: 2 * t * d * 4, kv: tiles * 2 * 4 * 64 * d, l2: 4 * t * d * 4 };
  }
  var BIG = big();

  /* ---------- the clock: acts and the phases of one tile step ---------- */
  var ACT = [
    { t: 0, title: 'The square', say: 'Naive attention writes all 256 scores to DRAM, reads them back, writes P, reads P: 16 bytes per score.' },
    { t: 8, title: 'One tile', say: 'Rows 8-11 stay in the tray. K/V tile 0 slides in; 16 scores appear on chip; each row gets its max, sum and output.' },
    { t: 16, title: 'A bigger max', say: 'Tile 1 raises the max of some rows. Their sum and output shrink by alpha first, then the tile is added. The others do not move.' },
    { t: 26, title: 'The diagonal', say: 'Tile 2 straddles the diagonal: keys after a row are masked and add nothing. Row 8 sees only key 8.' },
    { t: 34, title: 'Divide once', say: 'Tile 3 is above the diagonal: never loaded. Each output is divided by its sum once, and equals the plain softmax.' },
    { t: 40, title: 'All blocks at once', say: 'Four Q blocks run in parallel, each its own loop. Tiles above the diagonal never move. The score matrix was never written.' }
  ];
  var TOTAL = 50;
  // tile step j of the followed block: slide in, scores, max, rescale, add, slide back
  var STEP = [
    { a: 9.6, B: 11.6, C: 12.4, D: 13.0, E: 13.1, F: 14.4, G: 15.9 },
    { a: 16.0, B: 18.0, C: 18.8, D: 19.8, E: 21.6, F: 23.4, G: 24.9 },
    { a: 26.0, B: 28.0, C: 28.8, D: 29.6, E: 31.0, F: 32.2, G: 33.7 }
  ];
  var DIV0 = 35.0, DIV1 = 36.5, A6 = 40, A6S = 42, A6P = 1.6;
  var seg = XP.seg, E = XP.ease;
  // the displayed state of row r of the followed block at time t
  function rowState(r, t) {
    var S = { m: -Infinity, l: 0, O: [0, 0, 0, 0], shrink: 0, cur: -1, phase: '' };
    for (var j = 0; j < STEP.length; j++) {
      var P = STEP[j], st = RUN.steps[j].rows[r];
      if (t < P.C) { if (t >= P.a) S.cur = j; break; }
      S.cur = t < P.G ? j : -1;
      var um = E.inOut(seg(t, P.C, P.D)), us = E.inOut(seg(t, P.D, P.D + Math.min(1.2, P.E - P.D))), ua = E.inOut(seg(t, P.E, P.F - 0.2));
      var m0 = st.before.m === -Infinity ? Math.min(st.after.m, -1.5) : st.before.m;
      S.m = t < P.C ? st.before.m : m0 + (st.after.m - m0) * um;
      var l = st.before.l + (st.mid.l - st.before.l) * us, O = st.before.O.map(function (x, d) { return x + (st.mid.O[d] - x) * us; });
      l += (st.after.l - st.mid.l) * ua; O = O.map(function (x, d) { return x + (st.after.O[d] - st.mid.O[d]) * ua; });
      S.l = l; S.O = O;
      S.shrink = (st.alpha < 1 && st.before.l > 0 && t >= P.D && t < P.E + 0.2) ? 1 : 0;
      S.phase = t < P.D ? 'max' : t < P.E ? 'rescale' : t < P.F ? 'add' : 'done';
    }
    S.final = E.inOut(seg(t, DIV0, DIV1));
    if (S.final > 0) { var f = RUN.final[r]; S.Ofin = S.O.map(function (x, d) { return x + (f.O[d] - x) * S.final; }); }
    return S;
  }
  function flashBytes(t) {
    if (t < 8) return 0;
    if (t >= A6) {
      var b = 4 * QO, s;
      for (s = 0; s < 4; s++) b += KV * (4 - s) * XP.clamp((t - (A6S + s * A6P)) / (A6P * 0.6), 0, 1);
      return b;
    }
    var n = t >= 9.6 ? QO : 0;
    STEP.forEach(function (P) { if (t >= P.B) n += KV; });
    if (t >= DIV1) n += QO;
    return n;
  }
  function naiveBytes(t) {
    if (t >= 8) return NAIVE;
    var q = NAIVE / 4;
    return q * (XP.clamp(t / 2.5, 0, 1) + XP.clamp((t - 2.5) / 1, 0, 1) + XP.clamp((t - 3.5) / 2.5, 0, 1) + XP.clamp((t - 6) / 1, 0, 1));
  }
  function fmtB(b) { return b >= 1e9 ? (b / 1e9).toFixed(2) + ' GB' : b >= 1e6 ? Math.round(b / 1e6) + ' MB' : Math.round(b).toLocaleString('en-US') + ' B'; }
  function f2(x) { return x === -Infinity ? '-inf' : (Math.abs(x) < 0.005 ? 0 : x).toFixed(2); }

  MLFilms.flash = function (host, opt) {
    opt = opt || {};
    var CW = 760, CH = 560;
    var S = XP.scene({ camera: { W: CW, H: CH, az: -90, el: 56 } });

    /* ---------- world: x to the right (keys), y away from you, z up ---------- */
    var CS = 0.7, FX = 4, FY = 20.2;                                 // floor: column k at x = FX + (k + 0.5) CS, row r at y = FY - (r + 0.5) CS
    function fx(k) { return FX + (k + 0.5) * CS; }
    function fy(r) { return FY - (r + 0.5) * CS; }
    S.add(XP.mesh.slab(37.4, 32.6, 0.4, 1.0), { pos: [-1.2, 6.3, -0.9], mat: 'paper', layer: 0 });             // the bench
    S.add(XP.mesh.slab(16 * CS + 0.8, 16 * CS + 0.8, 0.5, 0.4), { pos: [FX + 8 * CS, FY - 8 * CS, -0.5], mat: 'mem', layer: 1 });   // DRAM: where S would live
    var mCell = XP.mesh.box(0.6, 0.6, 0.12), cells = [];
    for (var r = 0; r < T; r++) { cells.push([]); for (var k = 0; k < T; k++) cells[r].push(S.add(mCell, { pos: [fx(k), fy(r), 0], mat: k > r ? 'steel' : 'paper', layer: 2 })); }
    for (r = 0; r <= 4; r++) {                                       // tile boundaries: thin ribs every 4 cells
      S.add(XP.mesh.box(16 * CS + 0.1, 0.05, 0.1), { pos: [FX + 8 * CS, FY - r * 4 * CS, 0.02], mat: 'steel', layer: 3, scale: [1, 1, 0.5] });
      S.add(XP.mesh.box(0.05, 16 * CS + 0.1, 0.1), { pos: [FX + r * 4 * CS, FY - 8 * CS, 0.02], mat: 'steel', layer: 3, scale: [1, 1, 0.5] });
    }
    // the diagonal mark: a row of small dots along it
    for (r = 0; r < T; r++) S.add(XP.mesh.cyl(0.06, 0.16, 8), { pos: [fx(r) + 0.3, fy(r) - 0.3, 0.02], mat: 'ink', layer: 3 });
    // tile glow frames: four edges per (block, tile), shown while that tile is computed
    function frame(b, j) {
      var x0 = FX + j * 4 * CS, y0 = FY - b * 4 * CS, w = 4 * CS, parts = [];
      parts.push(S.add(XP.mesh.box(w, 0.14, 0.2), { pos: [x0 + w / 2, y0 - 0.07, 0.06], mat: 'subject', layer: 4, show: false }));
      parts.push(S.add(XP.mesh.box(w, 0.14, 0.2), { pos: [x0 + w / 2, y0 - w + 0.07, 0.06], mat: 'subject', layer: 4, show: false }));
      parts.push(S.add(XP.mesh.box(0.14, w, 0.2), { pos: [x0 + 0.07, y0 - w / 2, 0.06], mat: 'subject', layer: 4, show: false }));
      parts.push(S.add(XP.mesh.box(0.14, w, 0.2), { pos: [x0 + w - 0.07, y0 - w / 2, 0.06], mat: 'subject', layer: 4, show: false }));
      return parts;
    }
    var frames = [0, 1, 2, 3].map(function (j) { return frame(FB, j); });
    // act 6: small trays on the floor's left edge, one per Q block
    var mini = [0, 1, 2, 3].map(function (b) { return S.add(XP.mesh.slab(0.6, 4 * CS - 0.2, 0.5, 0.2), { pos: [FX - 0.75, FY - (b * 4 + 2) * CS, -0.3], mat: 'subject', layer: 3, show: false }); });

    // the L2 shelf, where the K/V tiles wait, each under the key columns it holds
    var SHY = 6.4;
    S.add(XP.mesh.slab(16 * CS + 1.2, 3.0, 0.5, 0.4), { pos: [FX + 8 * CS, SHY, -0.5], mat: 'steel', layer: 1 });
    for (k = 0; k < 4; k++) S.add(XP.mesh.box(4 * CS - 0.3, 0.1, 0.08), { pos: [FX + (k * 4 + 2) * CS, SHY - 1.32, 0], mat: 'ink', layer: 2, scale: [1, 1, 0.5] });
    // the rail in front, at the tray's rows
    var RY = -1.45;
    S.add(XP.mesh.slab(16.6, 1.5, 0.3, 0.3), { pos: [7.7, RY, -0.5], mat: 'steel', layer: 1 });
    for (k = 0; k < 17; k++) S.add(XP.mesh.box(0.06, 1.1, 0.06), { pos: [-0.4 + k * 0.96, RY, -0.2], mat: 'ink', layer: 2, scale: [1, 1, 0.5] });

    // K/V tile slabs: a K plate (4 keys x 4 dims engraved) with its V plate behind it
    var mPlate = XP.mesh.slab(2.6, 1.2, 0.35, 0.15), mEng = XP.mesh.box(0.5, 0.2, 0.06);
    var slabs = [0, 1, 2, 3].map(function (j) {
      var kp = S.add(mPlate, { mat: 'steel', layer: 5 }), vp = S.add(mPlate, { mat: 'steel', layer: 5 }), eng = [];
      for (var c = 0; c < 4; c++) for (var d = 0; d < 2; d++) eng.push({ part: S.add(mEng, { mat: 'ink', layer: 6, scale: [1, 1, 0.6] }), dx: -0.96 + c * 0.64, dy: -0.25 + d * 0.5 });
      return { k: kp, v: vp, eng: eng, home: [FX + (j * 4 + 2) * CS, SHY] };
    });
    function placeSlab(sl, x, y, z, mat, glow) {
      sl.k.pos = [x, y - 0.68, z]; sl.v.pos = [x, y + 0.68, z];
      sl.k.mat = sl.v.mat = mat; sl.k.glow = sl.v.glow = glow;
      sl.eng.forEach(function (e, n) { var onV = n % 2; e.part.pos = [x + e.dx, y + (onV ? 0.68 : -0.68) + (e.dy + 0.25) * 0.6 - 0.15, z + 0.35]; });
    }

    // the tray: per row, left to right: output strip O~ (4), sum column l, max dial m, the row's q (4), its 4 scores
    var TY = [0.8, -0.7, -2.2, -3.7];                         // rows 8, 9, 10, 11 (row 8 farthest back)
    var X = { O: -15.2, l: -11.55, m: -10.15, q: -8.15, s: -3.55 };
    S.add(XP.mesh.slab(16.6, 6.6, 0.45, 0.4), { pos: [-8.35, -1.45, -0.45], mat: 'subject', layer: 2 });
    S.add(XP.mesh.box(16.1, 6.1, 0.12), { pos: [-8.35, -1.45, 0], mat: 'paper', layer: 3 });
    for (r = 0; r < 3; r++) S.add(XP.mesh.box(16.0, 0.07, 0.08), { pos: [-8.35, (TY[r] + TY[r + 1]) / 2, 0.12], mat: 'subject', layer: 4 });   // row ribs
    var mSmall = XP.mesh.box(0.8, 0.8, 1), qcells = [], scells = [], ocells = [], sums = [], dials = [], needles = [];
    var mDial = XP.mesh.cyl(0.5, 0.12, 24), mNeedle = XP.mesh.needle(0.44, 0.14, 0.05, 0.08), mTick = XP.mesh.box(0.05, 0.14, 0.06);
    function dialAngle(m) { var u = XP.clamp((m + 2) / 6, 0, 1); return 210 - u * 240; }   // m from -2 (left) to 4 (right)
    for (r = 0; r < 4; r++) {
      var y = TY[r], i = 8 + r;
      qcells.push([]); scells.push([]); ocells.push([]);
      for (var d = 0; d < 4; d++) {
        var qv = Q[i][d];
        qcells[r].push(S.add(mSmall, { pos: [X.q + d * 0.92, y, 0.12], mat: 'subject', layer: 5, scale: [1, 1, 0.1 + 0.08 * Math.abs(qv)] }));
        scells[r].push(S.add(mSmall, { pos: [X.s + d * 0.92, y, 0.12], mat: 'work', layer: 5, scale: [1, 1, 0.1], show: false }));
        ocells[r].push(S.add(mSmall, { pos: [X.O + d * 0.92, y, 0.12], mat: 'workx', layer: 5, scale: [1, 1, 0.05] }));
      }
      S.add(XP.mesh.box(0.62, 0.16, 1.4), { pos: [X.l, y + 0.36, 0.12], mat: 'steel', layer: 4 });                  // the column's back plate
      sums.push(S.add(XP.mesh.box(0.5, 0.42, 1), { pos: [X.l, y, 0.12], mat: 'workx', layer: 5, scale: [1, 1, 0.02] }));
      dials.push(S.add(mDial, { pos: [X.m, y, 0.12], mat: 'paper', layer: 5 }));
      for (var tk = 0; tk <= 6; tk++) {
        var a = dialAngle(-2 + tk) * Math.PI / 180;
        S.add(mTick, { pos: [X.m + Math.cos(a) * 0.4, y + Math.sin(a) * 0.4, 0.24], mat: 'ink', layer: 6, rot: dialAngle(-2 + tk) + 90 });
      }
      needles.push(S.add(mNeedle, { pos: [X.m, y, 0.26], mat: 'subject', layer: 7, rot: dialAngle(-2) }));
    }
    // the byte counters: two bars in front, naive (vermilion) and flash (forest), end caps at the naive total
    var BX0 = -15, BL = 16.5, BY = [18.4, 17.0];
    S.add(XP.mesh.slab(BL + 2.6, 3.2, 0.3, 0.4), { pos: [BX0 + BL / 2, 17.7, -0.5], mat: 'steel', layer: 1 });
    var mBar = XP.mesh.box(1, 0.8, 0.5);
    var bars = [S.add(mBar, { pos: [BX0, BY[0], 0], mat: 'memx', layer: 3 }), S.add(mBar, { pos: [BX0, BY[1], 0], mat: 'workx', layer: 3 })];
    BY.forEach(function (yy) {
      S.add(XP.mesh.box(0.12, 1.0, 0.7), { pos: [BX0 - 0.06, yy, 0], mat: 'ink', layer: 4 });
      S.add(XP.mesh.box(0.12, 1.0, 0.7), { pos: [BX0 + BL + 0.06, yy, 0], mat: 'ink', layer: 4 });
      for (var q = 1; q < 4; q++) S.add(XP.mesh.box(0.05, 0.3, 0.08), { pos: [BX0 + q * BL / 4, yy - 0.62, 0], mat: 'ink', layer: 4 });
    });

    XP.fit(S.cam, [[-20, -11.4, -1], [16.6, -11.4, -1], [16.6, 22.6, -1], [-20, 22.6, -1], [-11.5, 0.6, 2.8]], 14);
    var CAM0 = { zoom: S.cam.zoom, center: S.cam.center.slice() };

    /* ---------- one play for the whole film: every frame is computed from t ---------- */
    var tl = XP.timeline({ reset: function (S) { S.cam.zoom = CAM0.zoom; S.cam.center = CAM0.center.slice(); } });
    var STILL = [6.5, 14.0, 20.4, 31.6, 37.5, 48];
    ACT.forEach(function (a, n) { tl.at(a.t); tl.beat(a.title, a.say, { still: STILL[n] }); });
    tl.at(0);
    tl.play(TOTAL, function (p, S, t) {
      // camera: a small pull-back for the last act
      var pb = E.inOut(seg(t, A6, A6 + 1.5)) * (1 - E.inOut(seg(t, TOTAL - 0.8, TOTAL)));
      S.cam.zoom = CAM0.zoom * (1 - 0.06 * pb);
      // floor: act 1 writes S then P; afterwards a ghost, except in act 6
      for (var r = 0; r < T; r++) for (var k = 0; k < T; k++) {
        var cl = cells[r][k], ghost = k > r ? 'steel' : 'paper', n = r * T + k, mat = ghost, glow = 0, h = 1;
        if (t < 8) {
          var fS = (t / 2.5) * T * T, fP = ((t - 3.5) / 2.5) * T * T;
          if (n < fS) mat = 'mem';
          if (n < fP) mat = 'memx';
          if ((t > 2.5 && t < 3.5) || (t > 6 && t < 7)) glow = 0.35 * Math.sin(Math.PI * ((t > 6 ? t - 6 : t - 2.5)));
          if (t > 7.4) mat = (n / (T * T) < (t - 7.4) / 0.6) ? ghost : mat;
        } else if (t >= A6) {
          var b = Math.floor(r / 4), j = Math.floor(k / 4), on = j <= b && t >= A6S + j * A6P;
          if (on) { mat = k <= r ? 'work' : 'steel'; h = k <= r ? 1.8 : 0.5; }
        }
        cl.mat = mat; cl.glow = glow; cl.scale = [1, 1, h];
      }
      // tile frames on the floor while the followed block computes tile j
      frames.forEach(function (fr, j) {
        var P = STEP[j], on = !!P && t >= P.B && t < P.F;
        fr.forEach(function (e) { e.show = on; e.glow = on ? 0.3 : 0; });
      });
      mini.forEach(function (m) { m.show = t >= A6 + 0.6; });
      // slabs: home on the shelf, slide in along the rail, back to the shelf
      slabs.forEach(function (sl, j) {
        var P = STEP[j], x = sl.home[0], y = sl.home[1], z = 0, mat = 'steel', glow = 0;
        if (P && t >= P.a) {
          var stop = 1.5, done = t >= P.G;
          if (!done) {
            var u1 = E.inOut(seg(t, P.a, P.a + 0.7)), u2 = E.inOut(seg(t, P.a + 0.5, P.B)), u3 = E.inOut(seg(t, P.F, P.G));
            var xx = x + (stop - x) * u2, yy = y + (RY - y) * u1;
            if (t >= P.F) { xx = stop + (x - stop) * u3; yy = RY + (y - RY) * Math.min(1, u3 * 1.4); }
            x = xx; y = yy; z = 0.9 * Math.sin(Math.PI * Math.min(u1, 1 - u3) * 0.5) + 0.2; glow = t >= P.B && t < P.F ? 0.35 : 0.12;
          } else mat = 'paper';
        }
        if (t >= A6) {                                                // act 6: tiles of every block slide down their column briefly
          var s0 = A6S + j * A6P, u = seg(t, s0, s0 + A6P * 0.9);
          if (u > 0 && u < 1) { glow = 0.3; z = 0.9 * Math.sin(Math.PI * u); y = SHY + 0.2 * Math.sin(Math.PI * u); mat = 'steel'; }
          else mat = t >= s0 + A6P * 0.9 ? 'paper' : 'steel';
        }
        if (t >= 34 && t < A6 && j === 3) glow = 0;
        placeSlab(sl, x, y, z, mat, glow);
      });
      // the tray: scores of the current tile, and each row's gauges
      var ST = [0, 1, 2, 3].map(function (r) { return rowState(r, t); });
      var Omax = 2.2;
      for (r = 0; r < 4; r++) {
        var R = ST[r], cur = R.cur, step = cur >= 0 ? RUN.steps[cur].rows[r] : null;
        for (var c = 0; c < 4; c++) {
          var sc = scells[r][c], P2 = cur >= 0 ? STEP[cur] : null;
          if (step && t >= P2.B && t < P2.F + 0.4) {
            var u = E.out(seg(t, P2.B + c * 0.08, P2.B + 0.5 + c * 0.08)), sv = step.s[c];
            sc.show = u > 0;
            if (sv === null) { sc.mat = 'steel'; sc.scale = [1, 1, 0.06]; }
            else { sc.mat = t >= P2.E && t < P2.F ? 'work' : 'workx'; sc.scale = [1, 1, Math.max(0.06, (0.12 + 0.1 * (sv + 2.5)) * u)]; }
            sc.glow = (sv !== null && sv === step.mt && t >= P2.C && t < P2.D + 0.3) ? 0.45 : 0;
          } else sc.show = false;
        }
        var O = R.final > 0 ? R.Ofin : R.O, gold = R.shrink || (R.final > 0 && R.final < 1) || (t >= DIV0 - 0.2 && t < DIV1 + 0.6);
        var den = R.final > 0 ? 1 + (Math.max(R.l, 1) - 1) * 0 : 1;
        ocells[r].forEach(function (oc, d) {
          var v = O[d] / den;
          oc.scale = [1, 1, Math.max(0.05, Math.min(1.1, Math.abs(v) / Omax * 0.9))];
          oc.mat = gold ? 'gold' : Math.abs(v) < 1e-9 ? 'paper' : v >= 0 ? 'workx' : 'work'; oc.glow = gold ? 0.35 : 0;
        });
        sums[r].scale = [1, 1, Math.max(0.02, R.l * 0.32)];
        sums[r].mat = R.shrink ? 'gold' : R.l > 0 ? 'workx' : 'paper'; sums[r].glow = R.shrink ? 0.35 : 0;
        needles[r].rot = dialAngle(R.m === -Infinity ? -2 : R.m);
        dials[r].glow = (cur >= 0 && STEP[cur] && t >= STEP[cur].C && t < STEP[cur].D && RUN.steps[cur].rows[r].rises) ? 0.45 : 0;
        dials[r].mat = dials[r].glow ? 'gold' : 'paper';
      }
      // byte counters
      var nb = naiveBytes(t), fb = flashBytes(t);
      bars[0].scale = [Math.max(0.02, BL * nb / NAIVE), 1, 1]; bars[0].pos = [BX0 + BL * nb / NAIVE / 2, BY[0], 0];
      bars[1].scale = [Math.max(0.02, BL * fb / NAIVE), 1, 1]; bars[1].pos = [BX0 + BL * fb / NAIVE / 2, BY[1], 0];
    }, { at: 0, ease: E.linear });

    /* ---------- labels ---------- */
    function labels(t) {
      var Lb = [];
      Lb.push({ p: [FX - 1.4, FY - 8 * CS, 0], text: 'scores S, 16 \u00d7 16: not written after act 1', short: 'S: not written', cls: 'dim', align: 'r' });
      Lb.push({ p: [FX - 0.9, SHY, 0], text: 'L2: K/V tiles', short: 'K/V', cls: 'tag', align: 'r' });
      Lb.push({ p: [X.q + 1.4, 1.5, 0.3], text: 'q (D = 4)', short: 'q', cls: 'word' });
      Lb.push({ p: [X.s + 1.4, 1.5, 0.3], text: 'scores', short: 's', cls: 'word' });
      Lb.push({ p: [X.m, 1.5, 0.3], text: 'm', cls: 'word' });
      Lb.push({ p: [X.l, 1.5, 1.7], text: 'l', cls: 'word' });
      Lb.push({ p: [X.O + 1.4, 1.5, 0.3], text: '\u00d5', cls: 'word' });
      for (var r = 0; r < 4; r++) Lb.push({ p: [-16.8, TY[r], 0], text: 'row ' + (8 + r), short: String(8 + r), cls: r === 0 ? 'me' : 'dim', align: 'r' });
      Lb.push({ p: [BX0 - 0.4, BY[0], 0], text: 'naive', cls: 'tag', align: 'r' });
      Lb.push({ p: [BX0 - 0.4, BY[1], 0], text: 'flash', cls: 'tag', align: 'r' });
      Lb.push({ p: [BX0 + BL / 2, BY[0] + 1.2, 0], text: 'bytes to DRAM so far', short: 'bytes', cls: 'tag' });
      if (t >= 8 && t < A6) {
        for (var j = 0; j < STEP.length; j++) {
          var P = STEP[j];
          if (t >= P.a && t < P.G) {
            Lb.push({ p: [t < P.B ? slabs[j].home[0] : 1.5, t < P.B ? SHY - 2.3 : RY - 1.4, 0.6], text: 'K/V tile ' + j, short: 'tile ' + j, cls: 'me' });
          }
        }
        if (t >= 34) Lb.push({ p: [slabs[3].home[0], SHY - 2.3, 0.6], align: 'r', text: 'tile 3: skipped (keys 12-15 > row 11)', short: 'skipped', cls: 'hot' });
      }
      return Lb;
    }
    // the readout chip (short), and the full numbers in a panel under the card
    var panel = document.createElement('div');
    panel.className = 'c14-flashro';
    panel.setAttribute('aria-live', 'off');
    function readout(t) {
      var R = rowState(0, t), cur = R.cur, ro;
      if (t < 8) ro = 'naive \u00b7 16 bytes per score \u00b7 ' + fmtB(naiveBytes(t));
      else if (t >= A6) ro = 'all 4 blocks \u00b7 flash ' + fmtB(flashBytes(t)) + ' vs naive ' + fmtB(NAIVE);
      else {
        var j = cur >= 0 ? cur : -1, st = j >= 0 ? RUN.steps[j].rows[0] : null;
        ro = 'row 8 \u00b7 m ' + f2(R.m) + ' \u00b7 l ' + f2(R.l) + (st && t >= STEP[j].D && st.before.l > 0 ? ' \u00b7 \u03b1 ' + st.alpha.toFixed(3) : '');
        if (t >= DIV0) ro = 'row 8 \u00b7 O = \u00d5 / l \u00b7 l = ' + f2(RUN.final[0].l);
      }
      panel.innerHTML = panelHtml(t, R);
      return ro;
    }
    function vec(a) { return '[' + a.map(function (x) { return f2(x); }).join(', ') + ']'; }
    function panelHtml(t, R) {
      var h = '';
      if (t < 8) h += '<div><b>naive</b>: S written, read, P written, read: 4 &times; 4 bytes &times; 256 scores = ' + fmtB(NAIVE) + ' at T = 16.</div>';
      else if (t < DIV0) {
        var j = R.cur, st = j >= 0 ? RUN.steps[j].rows[0] : null;
        if (st && t >= STEP[j].D) {
          h += '<div><b>row 8, tile ' + j + '</b>: m ' + f2(st.before.m) + ' &rarr; ' + f2(st.after.m) +
            (st.before.l > 0 ? ', &alpha; = e<sup>' + f2(st.before.m) + ' &minus; ' + f2(st.after.m) + '</sup> = ' + st.alpha.toFixed(3) : ', nothing to rescale yet') + '</div>';
          h += '<div>l ' + f2(st.before.l) + ' &rarr; ' + f2(st.mid.l) + ' (&times; &alpha;) &rarr; ' + f2(st.after.l) + ' (+ tile)</div>';
          h += '<div>&Otilde; ' + vec(st.before.O) + ' &rarr; ' + vec(st.after.O) + '</div>';
        } else h += '<div><b>row 8</b>: m ' + f2(R.m) + ', l ' + f2(R.l) + ', &Otilde; ' + vec(R.O) + '</div>';
      } else {
        h += '<div><b>row 8</b>: O = &Otilde; / l = ' + vec(RUN.final[0].O) + '</div>';
        h += '<div>plain softmax of row 8, keys 0&ndash;8: ' + vec(direct(8)) + ' (equal to 4 decimals: ' + (Math.max.apply(null, direct(8).map(function (x, d) { return Math.abs(x - RUN.final[0].O[d]); })) < 5e-5 ? 'yes' : 'no') + ')</div>';
      }
      h += '<div class="b"><span class="n">naive ' + fmtB(naiveBytes(t)) + '</span> &middot; <span class="f">flash ' + fmtB(flashBytes(t)) + '</span> to DRAM so far (T = 16, FP32; flash counts every K/V tile as if nothing hit L2)</div>';
      h += '<div class="b">same formulas at T = 4,096, D = 64, B<sub>r</sub> = B<sub>c</sub> = 64: naive ' + fmtB(BIG.naive) + ' per head; flash ' + fmtB(BIG.qo) + ' for Q, O + ' + fmtB(BIG.kv) + ' of K/V re-reads if nothing hit L2, ' + fmtB(BIG.l2) + ' if they all hit</div>';
      return h;
    }

    if (opt.bare) return { scene: S, tl: tl, model: { run: RUN, all: ALL, direct: direct, naiveBytes: naiveBytes, flashBytes: flashBytes, big: BIG } };
    var film = XP.player(host, {
      id: opt.id || 'flash', fig: opt.fig || 'Fig. 3', title: 'A Q tile, K/V tiles streaming past', scene: S, tl: tl,
      labels: labels, readout: readout, stillAt: STILL[2], loop: true, gl: false,
      label: 'An animated figure. A 16 by 16 grid of cells, the score matrix, lies at the back. In front, a cobalt tray holds query rows 8 to 11, each with its four q values, four score cells, a dial for the running max, a column for the running sum and four cells for the unnormalized output. K/V tiles wait on a shelf and slide in along a rail one at a time. Two bars at the front count bytes to DRAM: naive and flash.',
      keys: [['subject', 'the Q tile (rows 8\u201311) and its rows'], ['steel', 'K/V tiles; masked scores'], ['work', 'scores computed on chip; row sum l; output \u00d5'],
             ['gold', 'a gauge rescaled by \u03b1, or the final divide'], ['mem', 'bytes to DRAM: the naive bar; S and P written'], ['paper', 'the score matrix never written; a tile already used']],
      caption: opt.caption || ''
    });
    host.appendChild(panel);
    return film;
  };
  MLFilms.flashModel = { runBlock: runBlock, direct: direct, T: T };
})();
