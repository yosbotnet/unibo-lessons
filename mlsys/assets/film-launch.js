/* film-launch.js — Life of a Launch, remade with the explainer kit: one 3D world, one camera, one narrator.
   Thread 2,690 of mix<<<1024, 256>>> tells its own life: the call on the CPU, the trip over PCIe, its block
   landing on SM 10, its warp, a load that leaves the chip for a GDDR7 chip and comes back, a divergent
   branch, a store, its exit, and the waves of blocks that follow until the copy back.
   Everything is a pure function of film time t. Film time maps to REAL GPU time (ns) through a piecewise-linear
   curve pinned to the narration's words, and blocks land and leave on the old film's schedule in real time,
   so the world stays consistent wherever the camera looks. Numbers are the RTX 5070's (sm_120); timings are
   plausible for a memory-bound kernel, not measured (see the caption). */
(function () {
  'use strict';
  window.MLFilms = window.MLFilms || {};
  MLFilms.launch = function (host, opt) {
    opt = opt || {};
    var ID = opt.id || 'launch';
    var CW = 760, CH = 428;
    var S = XP.scene({ camera: { W: CW, H: CH, az: -62, el: 38 } });
    var E = XP.ease, L = XP.lerp, V = XP.v;
    function sg(t, a, d) { return XP.seg(t, a, a + d); }
    function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
    function fmt(n) { return Math.round(n).toLocaleString('en-US'); }

    /* ---------- real time: the block schedule (ns after the launch call) ----------
       First wave: one block every 1.4 ns into slots 0..287 (slot s = SM s % 48, position s / 48). A block lives
       1.4–1.75 µs (memory-bound, loaded latency); its slot is refilled 25 ns after it leaves. */
    var NB = 1024, SLOTS = 288, NSM = 48, A = [], LV = [];
    for (var b = 0; b < NB; b++) { A[b] = b < SLOTS ? 3050 + b * 1.4 : LV[b - SLOTS] + 25; LV[b] = A[b] + 1400 + 350 * hash(b); }
    var KEND = Math.max.apply(null, LV);
    var MB = 10, MW = 4, ML = 2, MSM = 10;                         // me: block 10, warp 4, lane 2, on SM 10
    // my life, in ns: born when block 10 lands; two loads; 800 ns away; add, branch, store, exit
    var R = { born: A[MB], idx: 3070, ldA: 3076, ldB: 3079, back: 3880, add: 3882, br: 3884, odd: 3888, even: 3894, join: 3900, st: 3905, exit: 3925 };
    // the request's route (staged): lanes → L2 (miss) → off the die → a GDDR7 chip → back
    var ROUTE = [[3076, 'lanes'], [3090, 'l2'], [3110, 'l2'], [3190, 'edge'], [3250, 'chip'], [3620, 'chip'], [3680, 'edge'], [3790, 'l2'], [3862, 'sm'], [3878, 'lanes']];

    /* ---------- world: x to the right, y away from you, z up ---------- */
    var P = 4.8, PAD = 4.2, L2H = 2.6, COLS = 8, ROWS = 6;
    function smC(s) { var c = s % COLS, r = Math.floor(s / COLS); return [c * P + P / 2, r * P + P / 2 + (r >= 3 ? L2H : 0), 0]; }
    var DW = COLS * P, DH = ROWS * P + L2H, L2Y = 3 * P + L2H / 2, DC = [DW / 2, DH / 2, 0];
    var CPU = [-30, L2Y, -0.6], RAIL0 = -25, RAIL1 = -0.9, FE = [-5.2, L2Y - 5, -0.6];
    var CHIPS = [[6, -6.6], [DW / 2, -6.6], [DW - 6, -6.6], [6, DH + 6.6], [DW / 2, DH + 6.6], [DW - 6, DH + 6.6]], MCHIP = 4;
    var BX0 = -40, BX1 = DW + 5, BY0 = -12, BY1 = DH + 12;
    function tileC(s, p) { var c = smC(s); return [c[0] - 0.95 + (p % 2) * 1.9, c[1] - 1.3 + Math.floor(p / 2) * 1.3, 0.2]; }
    function quadC(q) { var c = smC(MSM); return [c[0] - 1.02 + (q % 2) * 2.04, c[1] - 1.02 + Math.floor(q / 2) * 2.04, 0.2]; }
    function warpC(q, j) { var c = quadC(q); return [c[0] - 0.52 + (j % 3) * 0.52, c[1] - 0.66 + Math.floor(j / 3) * 0.44, 0.26]; }
    var LP = 0.135, LZ = 1.5;
    function laneC(i) { var c = quadC(0); return [c[0] + 0.9 + (i - 15.5) * LP, c[1] - 0.2, LZ]; }

    var mTile = XP.mesh.box(1.7, 1.15, 0.5), mGhost = XP.mesh.box(1.7, 1.15, 0.07), mWarp = XP.mesh.box(0.4, 0.34, 0.3),
      mLane = XP.mesh.box(0.105, 0.105, 0.13), mSec = XP.mesh.box(0.26, 0.26, 0.26), mPkt = XP.mesh.box(0.9, 0.9, 0.9);
    S.add(XP.mesh.slab(BX1 - BX0, BY1 - BY0, 0.4, 1.0), { pos: [(BX0 + BX1) / 2, (BY0 + BY1) / 2, -1.0], mat: 'paper', layer: 0 });
    S.add(XP.mesh.slab(DW + 1.6, DH + 1.6, 0.6, 0.3), { pos: [DC[0], DC[1], -0.6], mat: 'steel', layer: 1 });
    var l2 = S.add(XP.mesh.box(DW - 0.6, L2H - 0.5, 0.32), { pos: [DC[0], L2Y, 0], mat: 'mem', layer: 2 });
    var cpu = S.add(XP.mesh.slab(9, 9, 0.9, 0.4), { pos: CPU, mat: 'steel', layer: 1 });
    S.add(XP.mesh.slab(5.4, 5.4, 0.5, 0.3), { pos: [CPU[0], CPU[1], 0.3], mat: 'paper', layer: 2 });
    S.add(XP.mesh.box(RAIL1 - RAIL0, 1.1, 0.22), { pos: [(RAIL0 + RAIL1) / 2, L2Y, -0.6], mat: 'steel', layer: 1 });
    var chips = CHIPS.map(function (c) { return S.add(XP.mesh.slab(5, 3.4, 0.8, 0.2), { pos: [c[0], c[1], -0.6], mat: 'mem', layer: 1 }); });
    var pads = [], ghosts = [], tiles = [];
    for (var s = 0; s < NSM; s++) pads.push(S.add(XP.mesh.slab(PAD, PAD, 0.2, 0.15), { pos: smC(s), mat: 'paper', layer: 2 }));
    for (var k = 0; k < SLOTS; k++) {
      ghosts.push(S.add(mGhost, { pos: tileC(k % NSM, Math.floor(k / NSM)), mat: 'steel', layer: 3, show: false }));
      tiles.push(S.add(mTile, { pos: tileC(k % NSM, Math.floor(k / NSM)), mat: 'work', layer: 4, show: false }));
    }
    var fe = S.add(XP.mesh.box(2.6, 2.0, 1), { pos: FE, mat: 'steel', layer: 2, show: false });
    // SM 10, opened: four quadrants of twelve warp slots
    var quads = [0, 1, 2, 3].map(function (q) { return S.add(XP.mesh.slab(1.9, 1.9, 0.06, 0.1), { pos: quadC(q), mat: 'steel', layer: 3, show: false }); });
    var warps = [];
    for (var q = 0; q < 4; q++) for (var j = 0; j < 12; j++) warps.push(S.add(mWarp, { pos: warpC(q, j), mat: 'work', layer: 5, show: false }));
    function warpPart(q, j) { return warps[q * 12 + j]; }
    var lanes = [];
    for (var i = 0; i < 32; i++) lanes.push(S.add(mLane, { pos: laneC(i), mat: 'work', layer: 6, show: false }));
    var secs = [];
    for (var n = 0; n < 12; n++) secs.push(S.add(mSec, { mat: 'memx', layer: 7, show: false }));
    var pk = [];
    for (n = 0; n < 8; n++) pk.push(S.add(mPkt, { mat: 'gold', layer: 7, show: false }));

    /* ---------- the narration ---------- */
    var tl = XP.timeline({ voice: (XP.VOICE || {})[ID], reset: function (S, t) { S.state = { line: '' }; cameraAt(t, S.cam); } });
    var cue = tl.cue, act = {};
    act.call = tl.cursor;
    tl.beat('The call', '').wait(0.6);
    tl.say('a1', "Before I exist, I'm a line of C++. Somebody wants 262,144 numbers mixed, and they want them now.");
    tl.say('a2', 'One call launches the kernel: 1,024 blocks of 256 threads. And the CPU gets on with its life. It never waits for us.');
    tl.say('a3', 'The launch crosses the PCIe bus to the GPU. That takes about three microseconds. By our standards, an age.', { gap: 0.6 });
    act.birth = tl.cursor;
    tl.beat('Birth', '');
    tl.say('b1', 'The GPU is 48 small processors, called SMs. A dispatcher hands out blocks, always whole, to whichever SM has room.');
    tl.say('b2', "Six blocks fit on one SM for this kernel. That's 288 at once across the chip. The other 736 wait their turn.");
    tl.say('b3', "Block 10 is one of the first. It lands on SM 10. And inside it, I'm about to start.", { gap: 0.5 });
    tl.say('b4', "Hello. I'm thread 2,690.", { gap: 1.0 });
    act.warp = tl.cursor;
    tl.beat('The warp', '');
    tl.say('c1', 'My block is eight warps. The SM deals them to its four schedulers, two each. Mine is quadrant zero.');
    tl.say('c2', 'Each scheduler can hold twelve warps. Right now mine has two, and more blocks are still landing.');
    tl.say('c3', 'A warp is 32 of us, welded together. One instruction, 32 lanes, the same moment. We never take a step alone.');
    tl.say('c4', 'This is my neighbour, 2,691. Same warp, same instructions, every cycle of our lives.', { gap: 0.6 });
    act.wait = tl.cursor;
    tl.beat('The wait', '');
    tl.say('d1', 'First instruction: work out who I am. Block 10 times 256, plus 130. All 32 of us do it at once, each with our own numbers.');
    tl.say('d2', 'Then we ask memory for a of i. 32 floats side by side: just four 32-byte sectors, one request for the whole warp.');
    tl.say('d3', "And right behind it, b of i. We don't wait for the first answer to ask the second question.");
    tl.say('d4', 'The request misses in L2, and has to leave the chip, out to a GDDR7 memory chip on the board.');
    tl.say('d5', "With the whole chip hammering memory, the round trip takes about 800 nanoseconds. That's two thousand clock cycles. For me, this is forever.", { gap: 1.2 });
    tl.say('d6', "For the SM, it's Tuesday. Five more blocks have landed. My scheduler has eleven other warps, and every cycle it issues one that's ready.");
    tl.say('d7', "That's the whole trick. The GPU doesn't make memory fast. It makes waiting cheap. Nobody waits for the slow thing.", { gap: 1.4 });
    act.fork = tl.cursor;
    tl.beat('The fork', '');
    tl.say('e1', 'There. a and b, two thousand cycles later. Add them: one cycle of real work.');
    tl.say('e2', "Then the twist. Odd threads multiply by three, even threads add one. I'm even. 2,691 is odd. For the first time in our lives, we disagree.");
    tl.say('e3', "A warp can't split in two. So the odd lanes go first, and I'm switched off, masked, watching my own warp do work I don't need.");
    tl.say('e4', "Then it's my turn, and 2,691 waits for me. The warp pays for both paths. And then we're one again.", { gap: 0.6 });
    act.exit = tl.cursor;
    tl.beat('Exit', '');
    tl.say('f1', "We store c of i. Our 32 stores merge into four sectors, and we don't wait for them to land.");
    tl.say('f2', 'And I exit. My registers go back to the pool. I lived for about 860 nanoseconds.', { gap: 1.0 });
    act.pull = tl.cursor;
    tl.beat('Pull back', '');
    tl.say('g1', "Pull back, and I'm gone. Block 10 finishes a little later, and block 298 moves into its slot.");
    tl.say('g2', 'Everywhere, the same story. Blocks land, warps wait, schedulers juggle, blocks leave. Three and a half waves of it.');
    tl.say('g3', "The last wave is ragged. Some SMs finish early and sit idle. That's the tail.", { gap: 0.6 });
    tl.say('g4', 'Then the GPU tells the CPU, which has been waiting on exactly one line: the copy back.');
    tl.say('g5', 'Place, cut, schedule, issue, fetch. Every kernel you write is this story, told 262,144 times, about seventy thousand at a time.', { gap: 2.6 });
    var TOT = tl.duration;

    var C = {
      cxx: cue('a1', 'C++.'), launch: cue('a2', 'launches'), cpuOn: cue('a2', 'CPU'), cross: cue('a3', 'crosses'), age: cue('a3', 'age.'),
      sms: cue('b1', 'SMs.'), disp: cue('b1', 'dispatcher'), whole: cue('b1', 'whole,'), six: cue('b2', 'Six'), all: cue('b2', '288'), wait: cue('b2', '736'),
      b10: cue('b3', 'Block'), lands: cue('b3', 'lands'), inside: cue('b3', 'inside'), hello: cue('b4', 'Hello.'),
      eight: cue('c1', 'eight'), deals: cue('c1', 'deals'), q0: cue('c1', 'quadrant'), twelve: cue('c2', 'twelve'), two: cue('c2', 'two,'), warp: cue('c3', 'warp'), lanes32: cue('c3', 'lanes,'), alone: cue('c3', 'alone.'), nb: cue('c4', 'neighbour,'),
      first: cue('d1', 'First'), all32: cue('d1', 'All'), ask: cue('d2', 'ask'), sectors: cue('d2', 'sectors,'), behind: cue('d3', 'behind'), misses: cue('d4', 'misses'), leave: cue('d4', 'leave'), board: cue('d4', 'board.'),
      hammer: cue('d5', 'hammering'), cycles: cue('d5', 'cycles.'), forever: cue('d5', 'forever.'), tues: cue('d6', 'Tuesday.'), five: cue('d6', 'Five'), eleven: cue('d6', 'eleven'), issues: cue('d6', 'issues'),
      trick: cue('d7', 'trick.'), cheap: cue('d7', 'cheap.'), slow: cue('d7', 'slow'),
      there: cue('e1', 'There.'), addIt: cue('e1', 'Add'), twist: cue('e2', 'twist.'), oddT: cue('e2', 'Odd'), evenT: cue('e2', 'even', 1), even: cue('e2', 'even', 2), disagree: cue('e2', 'disagree.'),
      split: cue('e3', 'split'), oddGo: cue('e3', 'odd'), masked: cue('e3', 'masked,'), turn: cue('e4', 'turn,'), both: cue('e4', 'both'), again: cue('e4', 'again.'),
      store: cue('f1', 'store'), merge: cue('f1', 'merge'), land: cue('f1', 'land.'), exit: cue('f2', 'exit.'), pool: cue('f2', 'pool.'), lived: cue('f2', 'lived'),
      pull: cue('g1', 'Pull'), fin: cue('g1', 'finishes'), b298: cue('g1', '298'), every: cue('g2', 'Everywhere,'), waves: cue('g2', 'waves'), ragged: cue('g3', 'ragged.'), idle: cue('g3', 'idle.'), tail: cue('g3', 'tail.'),
      tells: cue('g4', 'tells'), copy: cue('g4', 'copy'), place: cue('g5', 'Place,'), story: cue('g5', 'story,')
    };

    /* ---------- film time → real GPU time, pinned to the words ---------- */
    var RK = [
      [C.launch, 0], [C.cross, 300], [tl.end('a3'), 3000],
      [C.disp, 3044], [C.lands, R.born], [C.hello, R.born + 2], [act.warp, 3066], [C.alone, 3068], [act.wait, 3069],
      [C.first, R.idx], [C.ask, R.ldA], [C.behind, R.ldB], [C.misses, 3090], [C.leave, 3112], [C.board, 3250],
      [C.forever, 3500], [C.tues, 3540], [C.issues, 3640], [C.trick, 3740], [act.fork - 0.4, R.back - 2], [C.there, R.back],
      [C.addIt, R.add], [C.twist, R.br], [C.oddGo, R.odd], [C.turn, R.even], [C.again, R.join], [C.store, R.st], [C.exit, R.exit],
      [C.pull, R.exit + 30], [C.fin, LV[MB]], [C.b298, A[MB + SLOTS] + 4], [C.every, LV[MB] + 300], [C.ragged, KEND - 1200], [C.tail, KEND - 40], [C.tells, KEND + 200],
      [C.copy, KEND + 3000], [tl.end('g4'), KEND + 46000]
    ];
    function realAt(t) {
      if (t <= RK[0][0]) return t - RK[0][0] < 0 ? -1 : 0;
      for (var n = 1; n < RK.length; n++) if (t <= RK[n][0]) return L(RK[n - 1][1], RK[n][1], (t - RK[n - 1][0]) / Math.max(RK[n][0] - RK[n - 1][0], 1e-6));
      return RK[RK.length - 1][1];
    }
    function tAt(ns) {                                             // the inverse: when does real time ns happen on screen
      if (ns <= RK[0][1]) return RK[0][0];
      for (var n = 1; n < RK.length; n++) if (ns <= RK[n][1]) return L(RK[n - 1][0], RK[n][0], (ns - RK[n - 1][1]) / Math.max(RK[n][1] - RK[n - 1][1], 1e-9));
      return RK[RK.length - 1][0] + (ns - RK[RK.length - 1][1]) * 1e-9;
    }
    function slowAt(t) { var d = (realAt(t + 0.05) - realAt(t - 0.05)) / 0.1; return d > 0 ? 1e9 / d : 0; }   // film seconds per real second
    function big(x) {
      if (x >= 1e9) return (x / 1e9).toFixed(x >= 1e10 ? 0 : 1) + ' billion';
      if (x >= 1e6) return (x / 1e6).toFixed(x >= 1e7 ? 0 : 1) + ' million';
      return fmt(x);
    }
    function clock(ns) { return ns < 1000 ? fmt(ns) + ' ns' : (ns / 1000).toFixed(ns < 1e4 ? 3 : 1) + ' µs'; }

    /* ---------- helpers ---------- */
    var FLY = 0.45;
    function arcTo(a, b, u, h) { var m = V.lerp(a, b, u); m[2] += Math.sin(Math.PI * u) * h; return m; }
    function path(pts, u) {                                         // a polyline, evenly by length
      var len = [0], tot = 0;
      for (var n = 1; n < pts.length; n++) { tot += Math.hypot(pts[n][0] - pts[n - 1][0], pts[n][1] - pts[n - 1][1], pts[n][2] - pts[n - 1][2]); len.push(tot); }
      var d = XP.clamp(u, 0, 1) * tot;
      for (n = 1; n < pts.length; n++) if (d <= len[n]) return V.lerp(pts[n - 1], pts[n], (d - len[n - 1]) / Math.max(len[n] - len[n - 1], 1e-6));
      return pts[pts.length - 1].slice();
    }
    var SM10 = smC(MSM), MC = CHIPS[MCHIP];
    var WAY = { lanes: laneC(15.5), sm: [SM10[0], SM10[1] + 2.4, 0.9], l2: [SM10[0] + 1.5, L2Y, 0.9], edge: [MC[0], DH + 0.6, 0.9], chip: [MC[0], MC[1], 0.7] };
    function routeAt(ns, lag) {                                    // where the request is at real time ns (lag: b[i] is 3 ns behind)
      ns -= lag;
      if (ns < ROUTE[0][0] || ns > ROUTE[ROUTE.length - 1][0]) return null;
      for (var n = 1; n < ROUTE.length; n++) if (ns <= ROUTE[n][0]) {
        var a = ROUTE[n - 1], b = ROUTE[n], u = (ns - a[0]) / Math.max(b[0] - a[0], 1e-6);
        var pa = WAY[a[1]], pb = WAY[b[1]];
        if (a[1] === 'l2' && b[1] === 'edge') return path([pa, [MC[0], L2Y, 0.9], pb], u);       // along L2, then out
        if (a[1] === 'edge' && b[1] === 'l2') return path([pa, [MC[0], L2Y, 0.9], pb], u);
        return V.lerp(pa, pb, u);
      }
      return null;
    }
    function smOf(b) { return (b % SLOTS) % NSM; }
    function slotBlock(k, ns, t) {                                  // which block occupies slot k now (or is flying in), and how
      for (var g = 0; g < 4; g++) {
        var bb = k + g * SLOTS; if (bb >= NB) break;
        var ta = tAt(A[bb]), tl2 = tAt(LV[bb]);
        if (t >= ta - FLY && t < tl2 + 0.3) return { b: bb, fly: XP.clamp((t - (ta - FLY)) / FLY, 0, 1), gone: XP.clamp((t - tl2) / 0.3, 0, 1) };
      }
      return null;
    }
    var mineOn = function (t) { return t >= C.eight + 0.2; };            // SM 10 is drawn opened from "eight warps" on…
    var mineOff = function (t) { return t >= C.pull + 1.2; };      // …until the camera pulls back

    /* ---------- one play for the whole world: every frame is computed from t and real time ---------- */
    tl.play(TOT, function (p, S, t) {
      var ns = realAt(t), open = mineOn(t) && !mineOff(t), feTop = [FE[0], FE[1], 1.2];
      // the front end's queue of waiting blocks
      var waiting = 0; for (var bb = 0; bb < NB; bb++) if (A[bb] > ns) waiting++;
      var feOn = sg(t, tl.end('a3') - 0.4, 0.6);
      fe.show = feOn > 0; fe.scale = [1, 1, Math.max(0.05, (0.3 + 4.2 * waiting / NB) * E.back(feOn))];
      fe.glow = t >= C.disp && t < C.whole + 1 ? 0.5 : 0;
      // ghost slots: six per SM, from "Six blocks fit"
      var gh = sg(t, C.six - 0.2, 1.0);
      ghosts.forEach(function (g, k) { g.show = gh > 0; g.scale = [1, 1, E.back(XP.clamp(gh * 1.4 - (k % 6) * 0.06, 0, 1))]; g.glow = t >= C.six && t < C.all + 0.8 ? 0.35 : 0; });
      // blocks in their slots, on the real schedule
      tiles.forEach(function (tp, k) {
        var sb = slotBlock(k, ns, t), sm = k % NSM;
        if (!sb || (open && sm === MSM)) { tp.show = false; return; }
        var home = tileC(sm, Math.floor(k / NSM)), mine = sb.b === MB || sb.b === MB + SLOTS;
        tp.show = true; tp.mat = sb.b === MB ? 'subject' : 'work'; tp.glow = sb.b === MB && t >= C.b10 && t < C.eight ? 0.6 : 0;
        if (sb.fly < 1) { tp.pos = arcTo(feTop, home, E.inOut(sb.fly), 3.5); tp.scale = 0.5 + 0.5 * sb.fly; }
        else { tp.pos = home; tp.scale = [1, 1, Math.max(0.02, 1 - sb.gone)]; }
        if (sb.b === MB + SLOTS && t >= C.b298 && t < C.every) tp.glow = 0.5;
      });
      // SM 10 opened: quadrants and the warps of its resident blocks
      var qo = open ? sg(t, C.eight + 0.2, 0.8) * (1 - sg(t, C.pull + 0.4, 0.8)) : 0;
      quads.forEach(function (qp, q) { qp.show = qo > 0; qp.scale = [qo, qo, 1]; qp.glow = q === 0 && t >= C.q0 && t < C.twelve + 1 ? 0.5 : 0; });
      var issueK = Math.floor(t / 0.24), readyQ0 = [];
      warps.forEach(function (w) { w.show = false; w.glow = 0; });
      for (var pp = 0; pp < 6 && open; pp++) {
        var sb2 = slotBlock(MSM + pp * NSM, ns, t);
        if (!sb2) continue;
        var src = tileC(MSM, pp);
        for (var ww = 0; ww < 8; ww++) {
          var q = ww % 4, jj = pp * 2 + Math.floor(ww / 4), wp = warpPart(q, jj), me = sb2.b === MB && ww === MW;
          var deal = sb2.b === MB ? E.inOut(sg(t, C.eight + 0.2 + ww * 0.12, 0.7)) : E.inOut(sb2.fly);
          if (deal <= 0) continue;
          wp.show = sb2.gone < 1; wp.pos = arcTo(sb2.b === MB ? src : [src[0], src[1], 3], warpC(q, jj), deal, 1.2);
          wp.scale = [1, 1, Math.max(0.02, 1 - sb2.gone)];
          wp.mat = me ? 'subject' : (sb2.b === MB ? 'work' : 'work');
          if (q === 0 && !me) readyQ0.push(wp);
          if (me && ns >= R.ldA && ns < R.back) { wp.mat = 'steel'; wp.glow = 0; }
          if (me && t >= C.warp && t < C.exit + 0.6) wp.show = false;   // my warp is up there, as 32 lanes
          if (me && t >= C.exit + 0.6) wp.show = false;
        }
      }
      // the scheduler: one ready warp issues each beat (staged order)
      if (readyQ0.length && t >= C.tues && t < act.fork + 0.5) { var pick = readyQ0[Math.floor(hash(issueK) * readyQ0.length)]; pick.glow = 0.9; pick.mat = 'gold'; }
      // my warp, unfolded into 32 lanes
      var lane0 = sg(t, C.warp - 0.1, 1.0), laneGone = sg(t, C.exit, 0.8);
      lanes.forEach(function (lp, i) {
        var u = E.inOut(XP.clamp(lane0 * 1.6 - i * 0.02, 0, 1)), from = warpC(0, 1);
        lp.show = u > 0 && laneGone < 1; lp.pos = V.lerp([from[0], from[1], from[2] + 0.15], laneC(i), u); lp.scale = Math.max(0.02, 1 - laneGone);
        lp.mat = i === ML ? 'subject' : 'work'; lp.glow = 0;
        if (i === ML + 1 && t >= C.nb) lp.mat = 'gold';
        if (t >= C.first && t < C.ask) lp.glow = 0.7 * Math.max(0, Math.sin(Math.PI * XP.clamp((t - C.all32 + 0.1 - i * 0.02) / 0.6, 0, 1)));
        if (ns >= R.ldA && ns < R.back) { lp.mat = i === ML ? 'subject' : 'steel'; if (i === ML + 1 && t >= C.nb) lp.mat = 'gold'; }
        if (ns >= R.add && ns < R.br) lp.glow = 0.6;
        // the fork: odd lanes first, then even; the masked half sinks
        var odd = i % 2 === 1, z = 0;
        if (t >= C.oddT && ns < R.odd) lp.mat = odd ? 'workx' : (i === ML ? 'subject' : 'work');
        if (ns >= R.odd && ns < R.join) {
          var active = ns < R.even ? odd : !odd;
          z = active ? 0.12 : -0.18; lp.glow = active ? 0.55 : 0;
          lp.mat = active ? (i === ML ? 'subject' : (odd ? 'workx' : 'work')) : 'steel';
          if (!active) lp.scale = 0.7 * lp.scale;
        }
        if (z) { var pz = lp.pos.slice(); pz[2] += z * E.inOut(sg(t, ns < R.even ? C.oddGo : C.turn, 0.5)); lp.pos = pz; }
      });
      // sectors: a[i] and b[i] go out and come back as four 32-byte sectors each; c[i] leaves as four
      secs.forEach(function (sp, n) { sp.show = false; sp.glow = 0; });
      [0, 3].forEach(function (lag, r) {
        var pos = routeAt(ns, lag);
        if (!pos) return;
        for (var m = 0; m < 4; m++) {
          var sp = secs[r * 4 + m], spread = (m - 1.5) * 0.3, out = ns - lag < 3250;
          sp.show = true; sp.mat = r === 0 ? 'memx' : 'mem'; sp.pos = [pos[0] + spread, pos[1] + (r ? 0.32 : 0), pos[2]];
          if (ns - lag < 3090) { var u0 = XP.clamp((ns - lag - ROUTE[0][0]) / 14, 0, 1), fromL = laneC(m * 8 + 3.5); sp.pos = V.lerp(fromL, sp.pos, E.inOut(u0)); }
          if (ns - lag > 3862) { var u1 = XP.clamp((ns - lag - 3862) / 16, 0, 1), toL = laneC(m * 8 + 3.5); sp.pos = V.lerp(sp.pos, toL, E.inOut(u1)); }
          sp.glow = out ? 0.4 : 0.6; sp.scale = r === 1 ? 0.85 : 1;
        }
      });
      var stU = sg(t, C.merge - 0.2, 2.6);
      if (stU > 0 && stU < 1) for (var m2 = 0; m2 < 4; m2++) { var sp2 = secs[8 + m2]; sp2.show = true; sp2.mat = 'workx'; sp2.glow = 0.5; sp2.pos = path([laneC(m2 * 8 + 3.5), [SM10[0] + (m2 - 1.5) * 0.3, SM10[1] + 2.4, 0.9], [SM10[0] + 1.5 + (m2 - 1.5) * 0.3, L2Y, 0.9]], E.inOut(stU)); }
      // L2 and the memory chip light up as the request passes
      l2.mat = (ns >= 3088 && ns < 3112) ? 'memx' : 'mem'; l2.glow = (ns >= 3088 && ns < 3112) ? 0.6 : 0;
      chips.forEach(function (c, n) { c.mat = n === MCHIP && ns >= 3245 && ns < 3630 ? 'memx' : 'mem'; c.glow = n === MCHIP && ns >= 3245 && ns < 3630 ? 0.45 : 0; });
      // packets on the bus: the launch out, the result back
      pk.forEach(function (x) { x.show = false; });
      var lu = (ns >= 0 && t >= C.launch) ? XP.clamp(ns / 3000, 0, 1) : 0;
      if (t >= C.launch && lu < 1) { pk[0].show = true; pk[0].mat = 'gold'; pk[0].glow = 0.6; pk[0].pos = [L(RAIL0, RAIL1, E.inOut(lu)), L2Y, -0.3]; }
      for (var c2 = 0; c2 < 6; c2++) {
        var cu = sg(t, C.copy - 0.3 + c2 * 0.35, 2.4);
        if (cu > 0 && cu < 1) { var x = pk[1 + c2]; x.show = true; x.mat = 'memx'; x.glow = 0.4; x.scale = 0.7; x.pos = [L(RAIL1, RAIL0, cu), L2Y, -0.3]; }
      }
      cpu.glow = (t >= C.cxx - 0.5 && t < C.launch + 0.8) || (t >= C.copy + 2.2 && t < TOT) ? 0.45 : 0;
      // the readout: the real clock, and how slow the film is running
      var sl = slowAt(t);
      S.state.line = t < C.launch ? 'CPU · host code, before the launch'
        : ns > KEND + 100 ? 'kernel done at ' + clock(KEND) + ' · copy back: ' + clock(ns)
        : 'GPU clock ' + clock(Math.max(0, ns)) + (sl > 1 ? ' · slow motion ×' + big(sl) : '');
      S.state.ns = ns; S.state.waiting = waiting; S.state.open = open;
    }, { at: 0, ease: E.linear });

    /* ---------- camera: spans in world units (log-interpolated), from the voice's times ---------- */
    var FRAME = { board: [[(BX0 + BX1) / 2 + 1, (BY0 + BY1) / 2, 0], 92], cpu: [[CPU[0] + 2, CPU[1], 0], 26], bus: [[-12, L2Y, 0], 40], die: [[DC[0] - 1, DC[1], 0], 56],
      sm: [[SM10[0], SM10[1], 0.4], 9.5], tile: [[SM10[0] - 0.9, SM10[1] - 1.1, 0.4], 6.5], smOpen: [[SM10[0] + 0.3, SM10[1], 0.6], 8], lanes: [[laneC(15.5)[0] - 0.2, laneC(15.5)[1], 1.2], 6],
      lanesTight: [[laneC(15.5)[0], laneC(15.5)[1], 1.3], 5.2], route: [[SM10[0] + 4, L2Y - 2, 0], 26], dieChip: [[DC[0], DC[1] + 6, 0], 62] };
    var KEYS = [ // t, frame, az, el
      [0, 'cpu', -58, 34], [C.launch, 'cpu', -60, 36], [C.cross, 'bus', -62, 38], [tl.end('a3'), 'die', -64, 42],
      [C.b10, 'die', -62, 44], [C.lands, 'sm', -60, 42], [C.hello, 'tile', -58, 40], [C.eight, 'smOpen', -60, 44], [C.twelve, 'smOpen', -62, 46],
      [C.warp, 'lanes', -62, 34], [C.nb, 'lanesTight', -60, 32], [C.first, 'lanes', -62, 34], [C.behind, 'lanes', -62, 38],
      [C.misses, 'route', -64, 46], [C.board, 'dieChip', -66, 48], [C.forever, 'dieChip', -64, 46], [C.tues, 'smOpen', -60, 44], [C.slow, 'smOpen', -62, 44],
      [C.there, 'lanes', -62, 34], [C.oddT, 'lanesTight', -60, 30], [C.again, 'lanesTight', -62, 32], [C.store, 'lanes', -62, 36], [C.exit, 'smOpen', -62, 42],
      [C.pull, 'sm', -62, 44], [C.every, 'die', -64, 46], [C.tail, 'die', -62, 48], [C.tells, 'board', -62, 46], [TOT - 3, 'board', -60, 44], [TOT, 'board', -58, 42]];
    function cameraAt(t, cam) {
      var a = KEYS[0], b = KEYS[KEYS.length - 1];
      for (var n = 1; n < KEYS.length; n++) if (t <= KEYS[n][0]) { a = KEYS[n - 1]; b = KEYS[n]; break; }
      var f = E.inOut(XP.seg(t, a[0], b[0])), fa = FRAME[a[1]], fb = FRAME[b[1]];
      var span = Math.exp(L(Math.log(fa[1]), Math.log(fb[1]), f));
      // move the centre in step with the zoom, so a dive keeps its target in view
      var g = fa[1] === fb[1] ? f : XP.clamp((Math.log(fa[1]) - Math.log(span)) / (Math.log(fa[1]) - Math.log(fb[1])), 0, 1);
      cam.az = L(a[2], b[2], f); cam.el = L(a[3], b[3], f); cam.center = V.lerp(fa[0], fb[0], fa[1] > fb[1] ? Math.pow(g, 0.6) : 1 - Math.pow(1 - g, 0.6));
      cam.zoom = CW / span;
    }

    /* ---------- labels: name what is on screen, nothing more ---------- */
    function labels(t, S) {
      var Lb = [], ns = S.state.ns, open = S.state.open, cam = S.cam, span = CW / cam.zoom;
      var far = span > 30, mid = span <= 30 && span > 7.5, near = span <= 7.5;
      if (span > 18 && t < act.wait) { Lb.push({ p: [CPU[0], CPU[1] - 5.6, 0], text: 'CPU', cls: 'word' }); }
      if (t >= C.cxx - 0.3 && t < tl.end('a3')) Lb.push({ p: [CPU[0], CPU[1] + 1.2, 1.6], text: 'mix<<<1024, 256>>>(a, b, c, n);', short: 'mix<<<1024, 256>>>', cls: t >= C.launch ? 'me' : '' });
      if (t >= C.cross - 0.5 && t < C.sms) Lb.push({ p: [(RAIL0 + RAIL1) / 2, L2Y - 1.4, -0.3], text: 'PCIe 5.0 ×16', cls: 'tag' });
      if (far && t >= tl.end('a3') - 0.5 && t < C.copy + 4) Lb.push({ p: [FE[0] + 1.6, FE[1], -0.2], align: 'l', text: S.state.waiting ? fmt(S.state.waiting) + ' blocks waiting' : 'queue empty', short: fmt(S.state.waiting), cls: S.state.waiting ? '' : 'dim' });
      if (far && t >= C.sms - 0.3 && t < C.b10) Lb.push({ p: [DC[0], -1.6, 0], text: '48 SMs · GB205', cls: 'tag' });
      if (far && ((t >= C.misses && t < C.tues) || (t >= C.every && t < C.tells))) Lb.push({ p: [DW + 0.6, L2Y, 0.4], text: 'L2', cls: 'tag', align: 'l' });
      if (far && t >= C.leave - 0.5 && t < C.tues) Lb.push({ p: [MC[0] + 2.8, MC[1], 0.3], text: 'GDDR7', cls: 'tag', align: 'l' });
      if ((mid || far) && t >= C.b10 - 0.2 && t < C.pull + 3) Lb.push({ p: [SM10[0] - PAD / 2 - 0.2, SM10[1], 0.2], text: 'SM 10', cls: 'tag', align: 'r' });
      if (t >= C.lands && t < C.eight && span < 14) Lb.push({ p: tileC(MSM, 0).map(function (v, n) { return n === 2 ? 0.9 : v; }), text: 'block 10', cls: 'me' });
      if (t >= C.hello && t < C.eight + 0.6) Lb.push({ p: [SM10[0] + 0.4, SM10[1] - 2.5, 0.3], text: 'thread 2,690 · threadIdx 130 · warp 4 · lane 2', short: 'thread 2,690', cls: 'me', align: 'l' });
      if (open && (mid || near) && t < C.warp + 1) [0, 1, 2, 3].forEach(function (q) { Lb.push({ p: [quadC(q)[0], quadC(q)[1] - 1.05, 0.25], text: 'quadrant ' + q, short: 'q' + q, cls: 'tag' + (q === 0 && t >= C.q0 ? ' me' : '') }); });
      if (open && t >= C.tues && t < act.fork) Lb.push({ p: [quadC(0)[0], quadC(0)[1] - 1.05, 0.25], text: 'quadrant 0 · 12 warps', short: 'q0', cls: 'tag' });
      var waitingNow = S.state.ns >= R.ldA && S.state.ns < R.back;
      if (lanes[0].show && span <= 14) Lb.push({ p: [laneC(ML)[0], laneC(ML)[1], LZ + 0.42], text: t >= C.first && t < C.ask ? 'i = 2,690' : waitingNow ? '2,690 · waiting' : '2,690 · me', short: '2,690', cls: 'me' });
      if (lanes[0].show && near) {
        if (t >= C.nb) Lb.push({ p: [laneC(ML + 1)[0] + 0.15, laneC(ML + 1)[1], laneC(ML + 1)[2] - 0.35], text: t >= C.first && t < C.ask ? 'i = 2,691' : '2,691', cls: 'hot', align: 'l' });
        if (t >= C.lanes32 && t < C.first) Lb.push({ p: [laneC(31)[0] + 0.15, laneC(31)[1], LZ], text: 'lane 31', cls: 'dim', align: 'l' });
        if (t >= C.lanes32 && t < C.first) Lb.push({ p: [laneC(0)[0] - 0.15, laneC(0)[1], LZ], text: 'lane 0', cls: 'dim', align: 'r' });
        var code = t < C.first ? '' : t < C.ask ? 'int i = blockIdx.x * 256 + threadIdx.x;' : t < C.misses ? 'float x = a[i] + b[i];' : t < C.there ? '' : t < C.twist ? 'float x = a[i] + b[i];'
          : t < C.store ? 'if (i % 2) x *= 3.0f; else x += 1.0f;' : t < C.exit ? 'c[i] = x;' : '';
        if (code) Lb.push({ p: [laneC(15.5)[0], laneC(15.5)[1], LZ + 0.75], text: code, cls: '', wide: false });
        if (ns >= R.odd && ns < R.join) Lb.push({ p: [laneC(31)[0] + 0.2, laneC(31)[1], LZ], text: ns < R.even ? 'odd lanes: x *= 3' : 'even lanes: x += 1', short: ns < R.even ? 'odd' : 'even', cls: 'tag', align: 'l' });
      }
      if (t >= C.ask && t < C.misses && near) Lb.push({ p: [laneC(15.5)[0], laneC(15.5)[1] + 0.6, LZ + 1.2], text: 'a[2688 … 2719] · 4 sectors', short: '4 sectors', cls: 'hot' });
      if (t >= C.misses && t < C.leave + 1.5 && !near) Lb.push({ p: [SM10[0] + 1.5, L2Y, 1.2], text: 'L2 miss', cls: 'hot' });
      if (t >= C.ragged && t < C.tells && far) for (var s2 = 16; s2 < NSM; s2 += 9) Lb.push({ p: [smC(s2)[0], smC(s2)[1], 0.6], text: 'idle', cls: 'dim' });
      if (t >= C.tells && t < TOT) Lb.push({ p: [CPU[0], CPU[1] + 1.2, 1.6], text: t < C.copy ? 'cudaMemcpy(h_c, c, …)  waiting' : 'cudaMemcpy(h_c, c, …)  ✓', short: 'cudaMemcpy', cls: t >= C.copy + 2.2 ? 'ok' : 'me' });
      if (t >= C.place) Lb.push({ p: [DC[0], DH + 2.2, 0], text: 'place · cut · schedule · issue · fetch', short: 'place · cut · schedule · issue · fetch', cls: 'tag' });
      return Lb;
    }

    var stills = [C.launch + 1.5, C.hello + 0.6, C.nb + 1, C.forever, C.masked, C.lived, C.tail];
    stills.forEach(function (s, n) { if (tl.beats[n]) tl.beats[n].still = s; });
    if (opt.bare) return { scene: S, tl: tl, realAt: realAt };
    return XP.player(host, {
      id: ID, fig: opt.fig || 'Film II', title: 'Life of a Launch', scene: S, tl: tl, labels: labels,
      stillAt: C.forever, posterAt: C.forever - 1,
      styleAt: function () { return { a: 'ink', b: 'ink', mix: 0 }; },
      label: 'One kernel launch on an RTX 5070, told by thread 2,690: the CPU, the PCIe bus, the GPU die with 48 SMs, an L2 strip and six GDDR7 chips. Blocks land in the SMs’ six slots; SM 10 opens into four quadrants of warps; one warp unfolds into 32 lanes; a memory request leaves the die and comes back; the lanes diverge and rejoin.',
      readout: function (t, S) { return S.state.line; },
      keys: [['subject', 'me: thread 2,690, its block and its warp'], ['work', 'a resident block, a warp, a lane'], ['gold', 'my neighbour 2,691; a warp issuing'], ['mem', 'memory: L2 and GDDR7'], ['memx', 'my request: 4 sectors'], ['steel', 'waiting, masked, or an empty slot']],
      caption: opt.caption || '', gl: opt.gl
    });
  };
})();
