/* fig-pipes.js — Interlude, §2–4. One quadrant (SMSP) of an RTX 5070 SM, cycle by cycle.
   The layout follows NVIDIA's RTX Blackwell SM diagram: L0 instruction cache and warp scheduler at the back,
   the register file, then the execution pipes. In front lies a tape of 48 cycles, one row per pipe, that fills
   as the film runs. Six acts, six instruction mixes; every frame comes from one cycle-level model (below).
   Real: one issue per cycle, 32 FP32/INT32 lanes, a 4-lane SFU (16 per SM), FP64 at 2 per SM, FFMA → FFMA in
   4 cycles. Modelled: the SFU and FP64 latencies, the round-robin pick, the lanes as two 16-wide halves. */
(function () {
  'use strict';
  window.MLFilms = window.MLFilms || {};

  /* ---------- the model: one scheduler, one issue per cycle, pipes with a pace and a latency ---------- */
  // ii: cycles a warp instruction keeps a unit busy (32 threads / lanes); lat: cycles until its result can be used
  var PIPES = {
    fma: { units: 2, lanes: 16, ii: 2, lat: 4 },     // two 16-lane halves, each takes 2 cycles per warp: one FMA per cycle in total
    sfu: { units: 1, lanes: 4, ii: 8, lat: 18 },     // 4 lanes: 8 cycles per warp instruction (16 per SM per cycle)
    fp64: { units: 1, lanes: 0.5, ii: 64, lat: 72 }  // 2 per SM = half a lane per quadrant: 64 cycles per warp instruction
  };
  var OPS = { FFMA: 'fma', MUFU: 'sfu', F2F: 'fp64', DMUL: 'fp64' };
  var NC = 48;                                        // cycles per act: the length of the tape
  function simulate(m) {
    var W = m.warps, P = m.pattern, ws = [], units = {}, out = [], last = W - 1, c, k, w;
    for (k in PIPES) { units[k] = []; for (var u = 0; u < PIPES[k].units; u++) units[k].push(-1e9); }
    for (w = 0; w < W; w++) ws.push({ pc: 0, done: [] });          // done[i]: the cycle instruction i's result is usable
    for (c = 0; c < NC; c++) {
      var st = [], pick = -1, unit = -1;
      for (var j = 1; j <= W; j++) {                              // loose round robin, starting after the last warp that issued
        w = (last + j) % W;
        var x = ws[w], ins = P[x.pc % P.length], pipe = OPS[ins.op], ok = true, on = null;
        (ins.dep || []).forEach(function (d) {
          var i = x.pc + d;
          if (i >= 0 && !(x.done[i] <= c)) { ok = false; on = OPS[P[((i % P.length) + P.length) % P.length].op]; }
        });
        var free = -1;
        units[pipe].forEach(function (t0, n) { if (free < 0 && c - t0 >= PIPES[pipe].ii) free = n; });
        var s;
        if (!ok) s = on === 'sfu' ? 'short_scoreboard' : 'wait';    // MUFU results are scoreboarded; FMA latency is fixed
        else if (free < 0) s = 'math_pipe_throttle';
        else if (pick < 0) { pick = w; unit = free; s = 'selected'; }
        else s = 'not_selected';
        st[w] = s;
      }
      var rec = { st: st, issued: null, busy: {} };
      if (pick >= 0) {
        var y = ws[pick], I = P[y.pc % P.length], pp = OPS[I.op];
        units[pp][unit] = c; y.done[y.pc] = c + PIPES[pp].lat;
        rec.issued = { w: pick, op: I.op, pipe: pp, unit: unit }; y.pc++; last = pick;
      }
      for (k in PIPES) rec.busy[k] = units[k].map(function (t0) { return c - t0 < PIPES[k].ii ? c - t0 : -1; });   // cycles into its warp, or -1
      out.push(rec);
    }
    return out;
  }
  var FF = function (d) { return { op: 'FFMA', dep: d }; };
  var ACTS = [
    { title: 'One warp, one chain', warps: 1, pattern: [FF([-1])], sec: 0.3,
      say: 'Each FMA needs the result of the one before, ready 4 cycles later. One issue every 4 cycles: the lanes idle 75% of the time.' },
    { title: 'Four warps', warps: 4, pattern: [FF([-1])], sec: 0.3,
      say: 'Four warps, four chains. While one waits, another issues: an FMA every cycle, the two FP32 halves taking turns.' },
    { title: 'One warp, four chains', warps: 1, pattern: [FF([-4])], sec: 0.3,
      say: 'One warp with four independent chains does the same. Independent instructions (ILP) replace extra warps (TLP).' },
    { title: 'An exp in the loop', warps: 8, pattern: [{ op: 'FFMA', dep: [] }, { op: 'MUFU', dep: [-1] }, { op: 'FFMA', dep: [-1, -3] }], sec: 0.3,
      say: 'Scale, exp, add. The exp runs on the 4-lane SFU, 8 cycles per warp: the SFU saturates and every warp queues behind it.' },
    { title: 'One exp, seven FMAs', warps: 8, pattern: [{ op: 'MUFU', dep: [-8] }, FF([-8]), FF([-8]), FF([-8]), FF([-8]), FF([-8]), FF([-8]), FF([-8])], sec: 0.3,
      say: 'One exp per seven FMAs: the FMAs fit in the SFU’s 8-cycle shadow. Issue and SFU both run flat out; the FMAs are free.' },
    { title: 'A stray double', warps: 8, pattern: [{ op: 'F2F', dep: [-1] }, { op: 'DMUL', dep: [-1] }, { op: 'F2F', dep: [-1] }, FF([-1])], sec: 0.22,
      say: 'x * 0.5 with a float x is double math: convert, multiply, convert back. Each takes 64 cycles on half an FP64 lane.' }
  ];
  ACTS.forEach(function (a) { a.run = simulate(a); });
  var LEAD = 1.4, HOLD = 2.6;
  var t0 = 0;
  ACTS.forEach(function (a) { a.t0 = t0; a.dur = LEAD + NC * a.sec + HOLD; t0 += a.dur; });
  var TOTAL = t0;
  function actAt(t) { for (var i = ACTS.length - 1; i >= 0; i--) if (t >= ACTS[i].t0 - 1e-9) return i; return 0; }
  function clockAt(t) {                                            // which act, which cycle, how far into it (f), cycles completed (n)
    var i = actAt(t), a = ACTS[i], u = (t - a.t0 - LEAD) / a.sec;
    if (u < 0) return { a: a, i: i, c: -1, f: 0, n: 0 };
    if (u >= NC) return { a: a, i: i, c: NC - 1, f: 1, n: NC };
    var c = Math.floor(u); return { a: a, i: i, c: c, f: u - c, n: c + 1 };
  }
  function stats(a, n) {                                           // utilization over cycles 0 .. n-1
    var r = { issue: 0, fma: 0, sfu: 0, fp64: 0, st: {} };
    for (var c = 0; c < n; c++) {
      var x = a.run[c];
      if (x.issued) r.issue++;
      for (var k in PIPES) r[k] += x.busy[k].filter(function (v) { return v >= 0; }).length / PIPES[k].units;
      x.st.forEach(function (s) { if (s !== 'selected') r.st[s] = (r.st[s] || 0) + 1; });
    }
    return r;
  }

  MLFilms.pipes = function (host, opt) {
    opt = opt || {};
    var CW = 760, CH = 500;
    var S = XP.scene({ camera: { W: CW, H: CH, az: -74, el: 50 } });
    var E = XP.ease;

    /* ---------- world: x to the right, y away from you, z up ---------- */
    var X0 = -14, X1 = 14;
    S.add(XP.mesh.slab(34, 32.6, 0.4, 1.0), { pos: [0, 2.6, -1.0], mat: 'paper', layer: 0 });            // the bench mat
    S.add(XP.mesh.slab(30.4, 18.4, 0.5, 0.4), { pos: [0, 6.0, -0.6], mat: 'steel', layer: 1 });          // the quadrant
    S.add(XP.mesh.slab(30.4, 9.6, 0.3, 0.4), { pos: [0, -6.9, -0.6], mat: 'steel', layer: 1 });         // the tape's bed
    // L0 instruction cache: a strip of lines
    S.add(XP.mesh.box(27, 1.2, 0.2), { pos: [0, 13.9, 0], mat: 'mem', layer: 2 });
    var icache = [];
    for (var i = 0; i < 12; i++) icache.push(S.add(XP.mesh.box(1.9, 0.86, 0.12), { pos: [-12.1 + i * 2.2, 13.9, 0.2], mat: 'mem', layer: 3 }));
    // warp scheduler: 12 slots in two rows of six
    S.add(XP.mesh.box(27, 3.9, 0.36), { pos: [0, 10.8, 0], mat: 'steel', layer: 2 });
    function slotC(j) { return [-11.25 + (j % 6) * 4.5, 11.75 - Math.floor(j / 6) * 1.95, 0.36]; }
    var mSlot = XP.mesh.box(3.7, 1.45, 0.08), mPeg = XP.mesh.box(2.9, 0.95, 1);
    var pegs = [];
    for (var j = 0; j < 12; j++) { S.add(mSlot, { pos: slotC(j), mat: 'paper', layer: 3 }); pegs.push(S.add(mPeg, { pos: slotC(j), mat: 'work', layer: 4, show: false })); }
    // dispatch: one bar the instruction crosses, with a gate for each pipe below it
    var disp = S.add(XP.mesh.box(27, 0.62, 0.3), { pos: [0, 8.2, 0], mat: 'steel', layer: 2 });
    // register file: 64 KB in four banks of cells
    S.add(XP.mesh.box(27, 2.5, 0.2), { pos: [0, 6.2, 0], mat: 'paper', layer: 2 });
    var rf = [];
    for (var bk = 0; bk < 4; bk++) {
      S.add(XP.mesh.box(6.3, 2.1, 0.12), { pos: [-10.1 + bk * 6.73, 6.2, 0.2], mat: 'steel', layer: 3 });
      for (j = 0; j < 16; j++) rf.push(S.add(XP.mesh.box(0.62, 0.86, 0.1), { pos: [-10.1 + bk * 6.73 - 2.73 + (j % 8) * 0.78, 6.2 - 0.48 + Math.floor(j / 8) * 0.96, 0.32], mat: 'paper', layer: 4 }));
    }
    // the pipes, left to right: FP32/INT32 half a, half b, SFU, FP64; then load/store and the tensor core, idle in this figure
    var PX = { fa: [-13.3, -6.5], fb: [-6.1, 0.7], sfu: [1.2, 4.2], fp64: [4.7, 6.3], ldst: [6.8, 9.9], tc: [10.4, 13.5] }, PY = 2.2;
    function mid(k) { return (PX[k][0] + PX[k][1]) / 2; }
    Object.keys(PX).forEach(function (k) { S.add(XP.mesh.box(PX[k][1] - PX[k][0], 3.2, 0.24), { pos: [mid(k), PY, 0], mat: 'steel', layer: 2 }); });
    var mLane = XP.mesh.box(0.3, 2.3, 0.42), laneA = [], laneB = [], laneS = [];
    for (i = 0; i < 16; i++) { laneA.push(S.add(mLane, { pos: [PX.fa[0] + 0.33 + i * 0.41, PY - 0.2, 0.24], mat: 'paper', layer: 3 })); laneB.push(S.add(mLane, { pos: [PX.fb[0] + 0.33 + i * 0.41, PY - 0.2, 0.24], mat: 'paper', layer: 3 })); }
    for (i = 1; i < 4; i++) { S.add(XP.mesh.box(0.06, 2.5, 0.5), { pos: [PX.fa[0] + 0.33 + (i * 4 - 0.5) * 0.41, PY - 0.2, 0.24], mat: 'steel', layer: 3 }); S.add(XP.mesh.box(0.06, 2.5, 0.5), { pos: [PX.fb[0] + 0.33 + (i * 4 - 0.5) * 0.41, PY - 0.2, 0.24], mat: 'steel', layer: 3 }); }
    for (i = 0; i < 4; i++) laneS.push(S.add(XP.mesh.box(0.55, 2.3, 0.42), { pos: [PX.sfu[0] + 0.45 + i * 0.7, PY - 0.2, 0.24], mat: 'paper', layer: 3 }));
    var fp64 = S.add(XP.mesh.cyl(0.62, 0.55, 20), { pos: [mid('fp64'), PY - 0.2, 0.24], mat: 'paper', layer: 3 });
    for (i = 0; i < 4; i++) S.add(XP.mesh.box(0.62, 2.3, 0.36), { pos: [PX.ldst[0] + 0.42 + i * 0.75, PY - 0.2, 0.24], mat: 'paper', layer: 3 });
    for (i = 0; i < 16; i++) S.add(XP.mesh.box(0.6, 0.48, 0.26), { pos: [PX.tc[0] + 0.48 + (i % 4) * 0.72, PY - 1.0 + Math.floor(i / 4) * 0.62, 0.24], mat: 'paper', layer: 3 });
    // behind each working pipe, a rail of 32 cells: the threads of the warp instruction it is processing
    var RAILY = PY + 1.15, rails = {};
    [['fa', 'fma', 0], ['fb', 'fma', 1], ['sfu', 'sfu', 0], ['fp64', 'fp64', 0]].forEach(function (r) {
      var k = r[0], x0 = PX[k][0] + 0.15, w = PX[k][1] - PX[k][0] - 0.3, per = k === 'fp64' ? 8 : 16, rows = 32 / per;
      var cw = w / per, cells = [];
      for (var n = 0; n < 32; n++) cells.push(S.add(XP.mesh.box(cw * 0.78, 0.26, 0.12), { pos: [x0 + (n % per + 0.5) * cw, RAILY + 0.05 + Math.floor(n / per) * 0.3 - (rows - 1) * 0.15, 0.24], mat: 'paper', layer: 3 }));
      rails[k] = { pipe: r[1], unit: r[2], cells: cells };
    });
    // the instruction on its way: from the warp's slot, across dispatch, into its pipe
    var token = S.add(XP.mesh.box(1.5, 0.8, 0.5), { mat: 'subject', layer: 6, show: false });

    // the tape: one row per pipe, one cell per cycle; a ruler along the front edge
    var ROWS = [['issue', 'issue'], ['fa', 'FP32 a'], ['fb', 'FP32 b'], ['sfu', 'SFU'], ['fp64', 'FP64']];
    var TX0 = -12.6, TX1 = 14.0, TP = (TX1 - TX0) / NC;
    function rowY(r) { return -3.3 - r * 1.5; }
    function cellX(c) { return TX0 + (c + 0.5) * TP; }
    var mCell = XP.mesh.box(TP * 0.8, 1.1, 1), tape = [];
    ROWS.forEach(function (row, r) {
      S.add(XP.mesh.box(TX1 - TX0 + 0.3, 1.32, 0.12), { pos: [(TX0 + TX1) / 2, rowY(r), -0.3], mat: 'paper', layer: 2 });
      var cells = [];
      for (var c = 0; c < NC; c++) cells.push(S.add(mCell, { pos: [cellX(c), rowY(r), -0.18], mat: 'paper', scale: [1, 1, 0.08], layer: 3 }));
      tape.push(cells);
    });
    var RULY = rowY(4) - 1.15;
    S.add(XP.mesh.box(TX1 - TX0 + 0.3, 0.7, 0.1), { pos: [(TX0 + TX1) / 2, RULY, -0.3], mat: 'steel', layer: 2 });
    for (var c = 0; c <= NC; c += 4) S.add(XP.mesh.box(0.09, c % 16 ? 0.32 : 0.6, 0.06), { pos: [TX0 + c * TP, RULY + (c % 16 ? 0.17 : 0.03), -0.2], mat: 'ink', layer: 3 });
    var cursor = S.add(XP.mesh.box(0.16, 8.0, 0.08), { pos: [TX0, -6.3, -0.08], mat: 'subject', layer: 4, show: false });

    XP.fit(S.cam, [[-16.2, -16.6, -1], [16.2, -16.6, -1], [16.2, 15.2, -1], [-16.2, 15.2, -1], [0, 11, 2.6]], 14);
    var CAM0 = { zoom: S.cam.zoom, center: S.cam.center.slice() };

    /* ---------- one play for the whole film: every frame is computed from t ---------- */
    var PEG = { selected: ['workx', 1.7], not_selected: ['work', 1.05], math_pipe_throttle: ['work', 1.05], wait: ['steel', 0.5], short_scoreboard: ['mem', 0.5] };
    var tl = XP.timeline({ reset: function (S) { S.cam.zoom = CAM0.zoom; S.cam.center = CAM0.center.slice(); } });
    ACTS.forEach(function (a) { tl.at(a.t0); tl.beat(a.title, a.say, { still: a.t0 + LEAD + NC * a.sec + 0.5 }); });
    tl.at(0);
    tl.play(TOTAL, function (p, S, t) {
      var K = clockAt(t), a = K.a, x = K.c >= 0 ? a.run[K.c] : null;
      // warps: who issued, who waits, on what
      pegs.forEach(function (pg, j) {
        if (j >= a.warps) { pg.show = false; return; }
        var s = x ? x.st[j] : 'not_selected', look = PEG[s] || PEG.not_selected;
        pg.show = true; pg.mat = look[0]; pg.scale = [1, 1, look[1]]; pg.glow = s === 'selected' ? 0.35 : 0;
      });
      // the instruction token: slot → dispatch → pipe, during the first 70% of its cycle
      token.show = false; disp.glow = 0;
      if (x && x.issued && K.f < 0.85) {
        var is = x.issued, from = slotC(is.w), key = is.pipe === 'fma' ? (is.unit ? 'fb' : 'fa') : is.pipe;
        var to = [mid(key), PY - 0.2, 1.0], via = [from[0] * 0.5 + to[0] * 0.5, 8.2, 1.4], u = E.inOut(XP.clamp(K.f / 0.7, 0, 1));
        var q = u < 0.5 ? XP.v.lerp([from[0], from[1], 2.2], via, u * 2) : XP.v.lerp(via, to, (u - 0.5) * 2);
        token.show = true; token.pos = q; token.scale = [1, 1, 1];
        disp.glow = u > 0.3 && u < 0.7 ? 0.4 : 0;
      }
      // lanes and rails: what each unit is doing this cycle
      function lit(parts, on) { parts.forEach(function (l) { l.mat = on ? 'workx' : 'paper'; l.glow = on ? 0.25 : 0; }); }
      var bf = x ? x.busy : { fma: [-1, -1], sfu: [-1], fp64: [-1] };
      lit(laneA, bf.fma[0] >= 0); lit(laneB, bf.fma[1] >= 0); lit(laneS, bf.sfu[0] >= 0);
      fp64.mat = bf.fp64[0] >= 0 ? 'workx' : 'paper'; fp64.glow = bf.fp64[0] >= 0 ? 0.3 : 0;
      Object.keys(rails).forEach(function (k) {
        var R = rails[k], into = bf[R.pipe][R.unit], P = PIPES[R.pipe], done = into < 0 ? 0 : Math.min(32, (into + K.f) * P.lanes);
        R.cells.forEach(function (cl, n) { cl.mat = into < 0 ? 'paper' : n < done ? 'workx' : 'work'; });
      });
      // the tape: every completed cycle so far, and the current one
      ROWS.forEach(function (row, r) {
        tape[r].forEach(function (cl, cc) {
          var on = false;
          if (cc <= K.c) {
            var y = a.run[cc];
            on = row[0] === 'issue' ? !!y.issued : row[0] === 'fa' ? y.busy.fma[0] >= 0 : row[0] === 'fb' ? y.busy.fma[1] >= 0 : y.busy[row[0]][0] >= 0;
          }
          cl.show = on; cl.mat = 'workx'; cl.scale = [1, 1, 0.32];                  // idle cycles: the bare strip
        });
      });
      cursor.show = K.c >= 0 && K.n < NC; cursor.pos = [TX0 + (K.c + K.f) * TP, -6.3, -0.08];
    }, { at: 0, ease: XP.ease.linear });

    /* ---------- labels: the parts, short on phones ---------- */
    function labels(t) {
      var K = clockAt(t), Lb = [];
      Lb.push({ p: [14.0, 10.8, 0.4], text: 'warps · 12 slots', short: 'warps', cls: 'tag', align: 'l' });
      Lb.push({ p: [14.0, 13.9, 0.2], text: 'L0 i-cache', cls: 'dim', align: 'l', wide: true });
      Lb.push({ p: [14.0, 8.2, 0.3], text: 'dispatch', cls: 'tag', align: 'l', wide: true });
      Lb.push({ p: [14.0, 6.2, 0.3], text: 'registers', cls: 'tag', align: 'l' });
      Lb.push({ p: [-0.3 + (PX.fa[0] + PX.fb[1]) / 2 - 0.0, PY - 2.15, 0.3], text: 'FP32 / INT32 · 2 × 16 lanes', short: 'FP32 · 2×16', cls: 'tag' });
      Lb.push({ p: [mid('sfu'), PY - 2.15, 0.3], text: 'SFU · 4', short: 'SFU', cls: 'tag' });
      Lb.push({ p: [mid('fp64'), PY - 2.15, 0.3], text: 'FP64', cls: 'tag', wide: true });
      Lb.push({ p: [mid('ldst'), PY + 2.2, 0.3], text: 'LD/ST', cls: 'dim', wide: true });
      Lb.push({ p: [mid('tc'), PY + 2.2, 0.3], text: 'tensor', cls: 'dim', wide: true });
      ROWS.forEach(function (row, r) { Lb.push({ p: [TX0 - 0.4, rowY(r), 0], text: row[1], cls: 'tag', align: 'r', wide: true }); });   // phones: the caption names the rows
      Lb.push({ p: [TX1 + 0.4, RULY, 0], text: NC + ' cycles', short: NC + ' cyc', cls: 'dim', align: 'l' });
      if (K.c >= 0 && K.a.run[K.c].issued) {
        var is = K.a.run[K.c].issued;
        Lb.push({ p: [slotC(is.w)[0], slotC(is.w)[1], 2.6], text: 'warp ' + is.w + ' · ' + is.op, short: is.op, cls: 'me' });
      }
      return Lb;
    }
    function pct(x, n) { return Math.round(100 * x / Math.max(n, 1)) + '%'; }
    function readout(t) {
      var K = clockAt(t);
      if (K.n === 0) return 'cycle 0';
      var r = stats(K.a, K.n), top = Object.keys(r.st).sort(function (p, q) { return r.st[q] - r.st[p]; })[0];
      var s = 'cycle ' + K.n + ' · issue ' + pct(r.issue, K.n);    // only the pipes this act uses
      if (K.i < 3) s += ' · FP32 ' + pct(r.fma, K.n); else if (K.i < 5) s += ' · SFU ' + pct(r.sfu, K.n); else s += ' · FP64 ' + pct(r.fp64, K.n);
      return s + (top ? ' · ' + top : '');
    }

    var stills = ACTS.map(function (a) { return a.t0 + LEAD + NC * a.sec + 0.5; });
    if (opt.bare) return { scene: S, tl: tl, acts: ACTS, stats: stats, total: TOTAL };
    return XP.player(host, {
      id: opt.id || 'pipes', fig: opt.fig || 'Fig. 1', title: 'One quadrant, cycle by cycle', scene: S, tl: tl,
      labels: labels, readout: readout, stillAt: stills[1], loop: true, gl: opt.gl,
      styleAt: function () { return { a: 'ink', b: 'ink', mix: 0 }; },
      label: 'One of the four quadrants of an SM: the warp scheduler with 12 warp slots, the dispatch bar, the register file, and the pipes: two 16-lane FP32 halves, a 4-lane special function unit, a small FP64 unit, load/store and a tensor core. In front, a tape of 48 cycles with one row for issue and one per pipe. Six acts show how different instruction mixes fill the pipes.',
      keys: [['subject', 'the instruction issued this cycle'], ['work', 'a warp issuing; a lane at work; a busy cycle'], ['workpale', 'ready, but not picked or its pipe is full'],
             ['steel', 'waiting for an FMA result (fixed latency)'], ['mempale', 'waiting for an SFU result (scoreboard)'], ['paper', 'an idle lane, slot or cycle']],
      caption: opt.caption || ''
    });
  };
  MLFilms.pipesModel = { simulate: simulate, ACTS: ACTS, PIPES: PIPES, NC: NC, stats: stats };
})();
