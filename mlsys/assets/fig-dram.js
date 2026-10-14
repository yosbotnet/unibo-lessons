/* fig-dram.js — Interlude, §7. Below the L2: one GDDR7 chip of an RTX 5070, opened.
   Real: six 32-bit controllers, six 2 GB GDDR7 chips, four independent 8-bit channels per chip (24 in all),
   28 Gbps per pin, so one 32-byte burst every 1.14 ns per channel and 672 GB/s in total; a bank must ACTIVATE a row
   into its row buffer before a READ, and PRECHARGE it before opening another.
   Modelled (illustrative, not measured): 16 banks per channel as in GDDR6, the timings below, the controller
   (oldest-first, reads before posted writes, writes drained in batches), the L2 slice count. */
(function () {
  'use strict';
  window.MLFilms = window.MLFilms || {};

  /* ---------- the model: one channel, time in burst slots of 1.14 ns ---------- */
  // RCD: activate → read; RP: precharge → activate; RAS: activate → precharge; FAW: at most 4 activates in this
  // window; RRD: activate → activate; WTR / RTW: bus turnaround, write → read and read → write. ROW: bursts per row (2 KB).
  var T = { RCD: 10, RP: 10, RAS: 24, FAW: 18, RRD: 2, WTR: 6, RTW: 3, BANKS: 16, ROW: 64 };
  var NC = 96, WARM = 40, NS = 32 / 28;                     // the tape shows 96 slots after a 40-slot warm-up; ns per slot
  function rng(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function requests(kind, n, seed) {                         // the order in which 32-byte sectors arrive from the L2
    var R = rng(seed), q = [], i, k;
    if (kind === 'seq') for (i = 0; i < n; i++) { var c = Math.floor(i / T.ROW) + seed; q.push({ bank: c % T.BANKS, row: Math.floor(c / T.BANKS), w: 0 }); }
    if (kind === 'chunk') for (i = 0; i < n;) { var b = Math.floor(R() * T.BANKS), r = Math.floor(R() * 4096), L = arguments[3]; for (k = 0; k < L; k++, i++) q.push({ bank: b, row: r, w: 0 }); }
    if (kind === 'copy') for (i = 0; i < n; i++) { var j = Math.floor(i / 2) + seed * 64, cc = Math.floor(j / T.ROW); q.push({ bank: (cc % 8) + (i % 2 ? 8 : 0), row: Math.floor(cc / 8), w: i % 2 }); }
    return q;
  }
  function simulate(q, n, opt) {
    opt = opt || {}; var RQ = 16, WQ = opt.wq || 48, HI = opt.hi || 40, LO = opt.lo || 8;
    var banks = [], out = [], acts = [], i, c, lastWr = -99, lastRd = -99, rq = [], wq = [], next = 0, drain = false, r, B;
    for (i = 0; i < T.BANKS; i++) banks.push({ row: -1, actAt: -99, pre: -99 });
    for (c = 0; c < n; c++) {
      while (next < q.length && (q[next].w ? wq.length < WQ : rq.length < RQ)) { (q[next].w ? wq : rq).push(q[next]); next++; }
      if (!drain && (wq.length >= HI || (!rq.length && wq.length))) drain = true;
      if (drain && ((wq.length <= LO && rq.length) || !wq.length)) drain = false;
      var vis = drain ? wq : rq, rec = { act: -1, pre: -1, col: null };
      for (i = 0; i < vis.length; i++) {                     // a READ or WRITE: the oldest request whose row is open
        r = vis[i]; B = banks[r.bank];
        if (B.row !== r.row || c < B.actAt + T.RCD) continue;
        if (r.w ? c < lastRd + T.RTW : c < lastWr + T.WTR) break;
        rec.col = { bank: r.bank, w: r.w }; vis.splice(i, 1);
        if (r.w) lastWr = c + 1; else lastRd = c + 1;
        break;
      }
      for (i = 0; i < vis.length; i++) {                     // an ACTIVATE or PRECHARGE for the oldest request still waiting on its row
        r = vis[i]; B = banks[r.bank];
        if (B.row === r.row) continue;
        if (B.row >= 0) {
          if (c >= B.actAt + T.RAS && !vis.some(function (o) { return o.bank === r.bank && o.row === B.row; })) { B.row = -1; B.pre = c; rec.pre = r.bank; break; }
          continue;
        }
        if (c < B.pre + T.RP || (acts.length && c < acts[acts.length - 1] + T.RRD) || (acts.length >= 4 && c < acts[acts.length - 4] + T.FAW)) continue;
        B.row = r.row; B.actAt = c; acts.push(c); rec.act = r.bank; break;
      }
      rec.rows = banks.map(function (b) { return b.row; });
      rec.ready = banks.map(function (b) { return b.row >= 0 && c >= b.actAt + T.RCD; });
      out.push(rec);
    }
    return out.slice(WARM);
  }
  var ACTS = [
    { title: 'Streaming read', kind: ['seq'],
      say: 'Consecutive sectors share a row. One ACTIVATE opens 2 KB, then 64 bursts stream out of the row buffer back to back.' },
    { title: 'Random 32 bytes', kind: ['chunk', 1],
      say: 'Every sector in a different row: each burst pays an ACTIVATE and a PRECHARGE. Only four ACTIVATEs fit in any 20 ns: the bus idles.' },
    { title: 'Random 128 bytes', kind: ['chunk', 4],
      say: 'Four sectors per row opened: four bursts for each ACTIVATE. Better, still far from streaming.' },
    { title: 'Random 2 KB', kind: ['chunk', 64],
      say: 'Whole rows, in random order: 64 bursts per ACTIVATE, and the bus is as busy as a stream. Random is fine when the unit is large.' },
    { title: 'Read and write', kind: ['copy'],
      say: 'A copy. Turning the bus around costs idle cycles, so the controller holds writes back and sends them in batches.' }
  ];
  ACTS.forEach(function (a) {
    a.ch = [0, 1, 2, 3].map(function (ch) { return simulate(requests(a.kind[0], 4000, 7 + ch * 13, a.kind[1]), WARM + NC); });
    a.sec = 0.12;
  });
  var LEAD = 1.4, HOLD = 2.8, t0 = 0;
  ACTS.forEach(function (a) { a.t0 = t0; a.dur = LEAD + NC * a.sec + HOLD; t0 += a.dur; });
  var TOTAL = t0;
  function actAt(t) { for (var i = ACTS.length - 1; i >= 0; i--) if (t >= ACTS[i].t0 - 1e-9) return i; return 0; }
  function clockAt(t) {
    var i = actAt(t), a = ACTS[i], u = (t - a.t0 - LEAD) / a.sec;
    if (u < 0) return { a: a, i: i, c: -1, f: 0, n: 0 };
    if (u >= NC) return { a: a, i: i, c: NC - 1, f: 1, n: NC };
    var c = Math.floor(u); return { a: a, i: i, c: c, f: u - c, n: c + 1 };
  }
  function stats(run, n) {
    var r = { data: 0, act: 0, pre: 0, wr: 0 };
    for (var c = 0; c < n; c++) { var x = run[c]; if (x.col) { r.data++; if (x.col.w) r.wr++; } if (x.act >= 0) r.act++; if (x.pre >= 0) r.pre++; }
    return r;
  }

  MLFilms.dram = function (host, opt) {
    opt = opt || {};
    var S = XP.scene({ camera: { W: 760, H: 500, az: -74, el: 50 } });
    var E = XP.ease;

    /* ---------- the path from the L2, at the back ---------- */
    S.add(XP.mesh.slab(34, 30.2, 0.4, 1.0), { pos: [0, 3.2, -1.0], mat: 'paper', layer: 0 });
    S.add(XP.mesh.slab(30.4, 7.6, 0.4, 0.4), { pos: [0, 14.1, -0.6], mat: 'steel', layer: 1 });
    S.add(XP.mesh.box(27, 1.3, 0.24), { pos: [0, 16.6, 0], mat: 'paper', layer: 2 });                       // L2, in slices
    var slices = [];
    for (var i = 0; i < 16; i++) slices.push(S.add(XP.mesh.box(1.4, 0.95, 0.18), { pos: [-12.6 + i * 1.68, 16.6, 0.24], mat: 'paper', layer: 3 }));
    S.add(XP.mesh.box(27, 0.9, 0.2), { pos: [0, 15.1, 0], mat: 'steel', layer: 2 });                         // crossbar
    for (i = 0; i < 27; i++) S.add(XP.mesh.box(0.08, 0.7, 0.08), { pos: [-13 + i, 15.1, 0.2], mat: 'ink', layer: 3 });
    var ctrls = [], chips = [];
    for (i = 0; i < 6; i++) {
      var x = -11.25 + i * 4.5;
      ctrls.push(S.add(XP.mesh.box(3.6, 1.3, 0.5), { pos: [x, 13.5, 0], mat: i ? 'steel' : 'mem', layer: 2 }));      // memory controller, 32 bit
      for (var p = 0; p < 4; p++) S.add(XP.mesh.box(0.22, 1.0, 0.1), { pos: [x - 0.9 + p * 0.6, 12.35, 0], mat: 'ink', layer: 2 });   // four 8-bit links
      chips.push(S.add(XP.mesh.box(3.0, 1.9, 0.45), { pos: [x, 10.9, 0], mat: i ? 'paper' : 'mem', layer: 2 }));    // the GDDR7 chip
      for (p = 0; p < 4; p++) S.add(XP.mesh.box(0.6, 1.4, 0.06), { pos: [x - 1.05 + p * 0.7, 10.9, 0.45], mat: i ? 'steel' : 'memx', layer: 3 });
    }
    // chip 0, opened: its four channels
    S.add(XP.mesh.box(0.3, 1.0, 0.1), { pos: [-11.25, 9.4, -0.3], mat: 'mem', layer: 2 });
    S.add(XP.mesh.slab(30.4, 10.6, 0.4, 0.5), { pos: [0, 3.6, -0.6], mat: 'paper', layer: 1 });
    var CX = [-10.5, -3.5, 3.5, 10.5], BW = 1.5, BD = 2.0, banks = [], pads = [];
    function bankC(ch, b) { return [CX[ch] - 2.55 + (b >> 2) * 1.7, 1.75 + (b & 3) * 2.15, 0]; }
    var mBase = XP.mesh.box(BW, BD, 0.18), mRow = XP.mesh.box(1.22, 0.2, 0.14), mBuf = XP.mesh.box(1.22, 0.34, 0.22);
    for (var ch = 0; ch < 4; ch++) {
      S.add(XP.mesh.slab(6.7, 9.8, 0.24, 0.3), { pos: [CX[ch], 3.9, -0.3], mat: 'steel', layer: 2 });
      var bs = [];
      for (var b = 0; b < 16; b++) {
        var c0 = bankC(ch, b), rows = [];
        S.add(mBase, { pos: c0, mat: 'steel', layer: 3 });
        for (var k = 0; k < 4; k++) rows.push(S.add(mRow, { pos: [c0[0], c0[1] + 0.7 - k * 0.32, 0.18], mat: 'paper', layer: 4 }));   // rows, back to front
        var buf = S.add(mBuf, { pos: [c0[0], c0[1] - 0.68, 0.18], mat: 'paper', layer: 4 });                                           // row buffer
        bs.push({ rows: rows, buf: buf });
      }
      banks.push(bs);
      var pd = [];
      for (p = 0; p < 8; p++) pd.push(S.add(XP.mesh.box(0.5, 0.42, 0.2), { pos: [CX[ch] - 2.45 + p * 0.7, -0.75, -0.06], mat: 'paper', layer: 3 }));   // 8 data pins
      pads.push(pd);
    }
    var token = S.add(XP.mesh.box(0.9, 0.5, 0.4), { mat: 'subject', layer: 6, show: false });

    /* ---------- the tape: channel A's commands and data bus ---------- */
    var ROWS = [['act', 'activate'], ['pre', 'precharge'], ['data', 'data bus']];
    var TX0 = -12.6, TX1 = 14.0, TP = (TX1 - TX0) / NC;
    function rowY(r) { return -3.9 - r * 1.5; }
    S.add(XP.mesh.slab(30.4, 6.8, 0.3, 0.4), { pos: [0, -5.9, -0.6], mat: 'steel', layer: 1 });
    var mCell = XP.mesh.box(TP * 0.8, 1.1, 1), tape = [];
    ROWS.forEach(function (row, r) {
      S.add(XP.mesh.box(TX1 - TX0 + 0.3, 1.32, 0.12), { pos: [(TX0 + TX1) / 2, rowY(r), -0.3], mat: 'paper', layer: 2 });
      var cells = [];
      for (var c = 0; c < NC; c++) cells.push(S.add(mCell, { pos: [TX0 + (c + 0.5) * TP, rowY(r), -0.18], scale: [1, 1, 0.3], layer: 3, show: false }));
      tape.push(cells);
    });
    var RULY = rowY(2) - 1.15;
    S.add(XP.mesh.box(TX1 - TX0 + 0.3, 0.7, 0.1), { pos: [(TX0 + TX1) / 2, RULY, -0.3], mat: 'steel', layer: 2 });
    for (var c = 0; c <= NC; c += 4) S.add(XP.mesh.box(0.09, c % 16 ? 0.32 : 0.6, 0.06), { pos: [TX0 + c * TP, RULY + (c % 16 ? 0.17 : 0.03), -0.2], mat: 'ink', layer: 3 });
    var cursor = S.add(XP.mesh.box(0.16, 5.4, 0.08), { pos: [TX0, -5.4, -0.08], mat: 'subject', layer: 4, show: false });

    XP.fit(S.cam, [[-16.2, -10.3, -1], [16.2, -10.3, -1], [16.2, 18.4, -1], [-16.2, 18.4, -1]], 14);
    var CAM0 = { zoom: S.cam.zoom, center: S.cam.center.slice() };

    var tl = XP.timeline({ reset: function (S) { S.cam.zoom = CAM0.zoom; S.cam.center = CAM0.center.slice(); } });
    var stills = ACTS.map(function (a) { return a.t0 + LEAD + NC * a.sec + 0.5; });
    ACTS.forEach(function (a, n) { tl.at(a.t0); tl.beat(a.title, a.say, { still: stills[n] }); });
    tl.at(0);
    tl.play(TOTAL, function (pp, S, t) {
      var K = clockAt(t), a = K.a;
      for (var ch = 0; ch < 4; ch++) {
        var run = a.ch[ch], x = K.c >= 0 ? run[K.c] : run[0];
        banks[ch].forEach(function (B, b) {
          var row = x.rows[b], open = row >= 0, act = K.c >= 0 && x.act === b, pre = K.c >= 0 && x.pre === b, col = K.c >= 0 && x.col && x.col.bank === b;
          B.rows.forEach(function (rp, k) {
            var hit = open && (row & 3) === k;
            rp.mat = hit ? (x.ready[b] ? 'work' : 'memx') : 'paper'; rp.scale = [1, 1, hit ? 1.8 : 1];
          });
          B.buf.mat = col ? 'workx' : pre ? 'mem' : !open ? 'paper' : x.ready[b] ? 'work' : 'mem';
          B.buf.glow = col ? 0.35 : act || pre ? 0.25 : 0;
        });
        var on = K.c >= 0 && !!x.col;
        pads[ch].forEach(function (pd) { pd.mat = on ? (x.col.w ? 'work' : 'workx') : 'paper'; });
      }
      // channel A's burst on its way: row buffer → pins
      var xa = K.c >= 0 ? a.ch[0][K.c] : null;
      token.show = false;
      if (xa && xa.col && K.f < 0.9) {
        var from = bankC(0, xa.col.bank), u = E.inOut(XP.clamp(K.f / 0.8, 0, 1)), w = xa.col.w;
        var A = [from[0], from[1] - 0.68, 0.9], Z = [CX[0], -0.75, 0.6];
        token.show = true; token.pos = w ? XP.v.lerp(Z, A, u) : XP.v.lerp(A, Z, u); token.mat = 'subject';
      }
      // the tape
      tape.forEach(function (cells, r) {
        cells.forEach(function (cl, cc) {
          var y = cc <= K.c ? a.ch[0][cc] : null, on = false, mat = 'workx', h = 0.3;
          if (y) {
            if (r === 0) { on = y.act >= 0; mat = 'memx'; }
            else if (r === 1) { on = y.pre >= 0; mat = 'mem'; }
            else if (y.col) { on = true; mat = y.col.w ? 'work' : 'workx'; h = y.col.w ? 0.18 : 0.3; }
          }
          cl.show = on; cl.mat = mat; cl.scale = [1, 1, h];
        });
      });
      cursor.show = K.c >= 0 && K.n < NC; cursor.pos = [TX0 + (K.c + K.f) * TP, -5.4, -0.08];
      // the six chips in the back row light while the act runs
      chips.forEach(function (cp, n) { if (n) cp.mat = K.c >= 0 ? 'work' : 'paper'; });
    }, { at: 0, ease: XP.ease.linear });

    function labels(t) {
      var K = clockAt(t), L = [];
      L.push({ p: [13.8, 16.6, 0.3], text: 'L2', cls: 'tag', align: 'l' });
      L.push({ p: [13.8, 15.1, 0.2], text: 'crossbar', cls: 'dim', align: 'l', wide: true });
      L.push({ p: [13.6, 13.5, 0.4], text: '6 × 32 bit', cls: 'tag', align: 'l', wide: true });
      L.push({ p: [13.6, 10.9, 0.4], text: 'GDDR7', cls: 'tag', align: 'l', wide: true });
      L.push({ p: [CX[0], -1.6, 0], text: 'channel A · 8 pins', short: 'channel A', cls: 'tag' });
      ROWS.forEach(function (row, r) { L.push({ p: [TX0 - 0.4, rowY(r), 0], text: row[1], cls: 'tag', align: 'r', wide: true }); });
      L.push({ p: [TX1 + 0.4, RULY, 0], text: Math.round(NC * NS) + ' ns', cls: 'dim', align: 'l' });
      return L;
    }
    function readout(t) {
      var K = clockAt(t);
      if (K.n === 0) return '0 ns';
      var r = stats(K.a.ch[0], K.n), u = r.data / K.n;
      return Math.round(K.n * NS) + ' ns · bus ' + Math.round(100 * u) + '% · ' + r.act + ' ACT · ≈ ' + Math.round(672 * u) + ' of 672 GB/s';
    }

    if (opt.bare) return { scene: S, tl: tl, acts: ACTS, stats: stats, total: TOTAL };
    return XP.player(host, {
      id: opt.id || 'dram', fig: opt.fig || 'Fig. 2', title: 'Below the L2', scene: S, tl: tl,
      labels: labels, readout: readout, stillAt: stills[1], loop: true, gl: opt.gl,
      styleAt: function () { return { a: 'ink', b: 'ink', mix: 0 }; },
      label: 'The memory path of an RTX 5070: L2 slices, a crossbar, six 32-bit memory controllers and six GDDR7 chips. One chip is opened into four 8-bit channels of 16 banks each; every bank has rows and a row buffer. In front, a tape of channel A: activates, precharges and the data bus over 110 nanoseconds. Five acts show streaming, random 32-byte, random 128-byte, random 2-kilobyte and mixed read-write traffic.',
      keys: [['subject', 'a 32-byte burst crossing the pins'], ['mem', 'ACTIVATE: a row opening (the cost)'], ['mempale', 'a row still opening; PRECHARGE'],
             ['work', 'a read burst (tall); the row being read'], ['workpale', 'an open row, ready; a write burst (short)'], ['paper', 'a closed bank; an idle slot']],
      caption: opt.caption || ''
    });
  };
  MLFilms.dramModel = { simulate: simulate, requests: requests, ACTS: ACTS, T: T, NC: NC, stats: stats };
})();
