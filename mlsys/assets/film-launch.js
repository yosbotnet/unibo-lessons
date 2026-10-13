/* film-launch.js — Life of a Launch, made with the explainer kit, in shots: the chip is one scene, the inside of
   SM 10 another, and the film cuts between them with match-cut zooms (the kit's o.shots). One narrator, one clock.
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
    // each pad is SM 10's scene in miniature: L1 along the back, the spine between the block slots, lanes along the front
    var mPL1 = XP.mesh.box(3.9, 0.16, 0.07), mPSp = XP.mesh.box(0.1, 3.6, 0.05), mPLn = XP.mesh.box(1.6, 0.13, 0.06);
    for (s = 0; s < NSM; s++) {
      var pc = smC(s);
      S.add(mPL1, { pos: [pc[0], pc[1] + 1.98, 0.2], mat: 'mem', layer: 3 });
      S.add(mPSp, { pos: [pc[0], pc[1], 0.2], mat: 'steel', layer: 3 });
      S.add(mPLn, { pos: [pc[0] - 0.95, pc[1] - 1.98, 0.2], mat: 'steel', layer: 3 }); S.add(mPLn, { pos: [pc[0] + 0.95, pc[1] - 1.98, 0.2], mat: 'steel', layer: 3 });
    }
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
    var mineOn = function () { return false; };                    // shots: SM 10's inside is its own scene, the chip never opens it
    var mineOff = function (t) { return t >= C.pull + 1.2; };      // …until the camera pulls back

    function lineAt(t) {
      var ns = realAt(t), sl = slowAt(t);
      return t < C.launch ? 'CPU · host code, before the launch'
        : ns > KEND + 100 ? 'kernel done at ' + clock(KEND) + ' · copy back: ' + clock(ns)
        : 'GPU clock ' + clock(Math.max(0, ns)) + (sl > 1 ? ' · slow motion ×' + big(sl) : '');
    }

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
        if (!mineOn(t)) { lp.show = false; return; }
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
      S.state.line = lineAt(t);
      S.state.ns = ns; S.state.waiting = waiting; S.state.open = open;
    }, { at: 0, ease: E.linear });

    /* ---------- camera: spans in world units (log-interpolated), from the voice's times ---------- */
    var FRAME = { board: [[(BX0 + BX1) / 2 + 1, (BY0 + BY1) / 2, 0], 92], cpu: [[CPU[0] + 2, CPU[1], 0], 26], bus: [[-12, L2Y, 0], 40], die: [[DC[0] - 1, DC[1], 0], 56],
      sm: [[SM10[0], SM10[1], 0.4], 9.5], tile: [[SM10[0] - 0.9, SM10[1] - 1.1, 0.4], 6.5], smOpen: [[SM10[0] + 0.3, SM10[1], 0.6], 8], lanes: [[laneC(15.5)[0] - 0.2, laneC(15.5)[1], 1.2], 6],
      lanesTight: [[laneC(15.5)[0], laneC(15.5)[1], 1.3], 5.2], route: [[SM10[0] + 4, L2Y - 2, 0], 26], dieChip: [[DC[0], DC[1] + 6, 0], 62],
      smDive: [[SM10[0], SM10[1], 0.2], 5.6] };                     // smMatch1/2: computed below, from the SM scene's last frame
    var DUR = 1.1, tIn1 = act.warp - 0.25, tOut1 = C.misses - 0.15, tIn2 = C.tues - 0.35, tOut2 = C.pull - 0.1;
    var KEYS = [ // t, frame, az, el
      [0, 'cpu', -58, 34], [C.launch, 'cpu', -60, 36], [C.cross, 'bus', -62, 38], [tl.end('a3'), 'die', -64, 42],
      [C.b10, 'die', -62, 44], [C.lands, 'sm', -60, 42], [C.hello, 'tile', -58, 40], [tIn1, 'smDive', -60, 44],
      [tOut1, 'smMatch1', -62, 46], [tOut1 + DUR, 'route', -64, 46], [C.board, 'dieChip', -66, 48], [C.forever, 'dieChip', -64, 46], [tIn2, 'smDive', -60, 44],
      [tOut2, 'smMatch2', -62, 46], [tOut2 + DUR, 'sm', -62, 44], [C.every, 'die', -64, 46], [C.tail, 'die', -62, 48], [C.tells, 'board', -62, 46], [TOT - 3, 'board', -60, 44], [TOT, 'board', -58, 42]];
    function camFrom(KEYS, FRAME) { return function (t, cam) {
      var a = KEYS[0], b = KEYS[KEYS.length - 1];
      for (var n = 1; n < KEYS.length; n++) if (t <= KEYS[n][0]) { a = KEYS[n - 1]; b = KEYS[n]; break; }
      var f = E.inOut(XP.seg(t, a[0], b[0])), fa = FRAME[a[1]], fb = FRAME[b[1]];
      var span = Math.exp(L(Math.log(fa[1]), Math.log(fb[1]), f));
      // move the centre in step with the zoom, so a dive keeps its target in view
      var g = fa[1] === fb[1] ? f : XP.clamp((Math.log(fa[1]) - Math.log(span)) / (Math.log(fa[1]) - Math.log(fb[1])), 0, 1);
      cam.az = L(a[2], b[2], f); cam.el = L(a[3], b[3], f); cam.center = V.lerp(fa[0], fb[0], fa[1] > fb[1] ? Math.pow(g, 0.6) : 1 - Math.pow(1 - g, 0.6));
      cam.zoom = CW / span;
    }; }
    var cameraAt = camFrom(KEYS, FRAME);

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

    /* ---------- the score: the first cut's synthesized soundtrack, its sounds pinned to the words ----------
       A low pad that opens up when the launch reaches the GPU and darkens for the wait; a thin tone that
       climbs an octave while I wait for memory; one-shots for the moments. The player ducks it under the voice. */
    function score(K) {
      var ctx = K.ctx, tone = K.tone, noise = K.noise;
      var padF = ctx.createBiquadFilter(); padF.type = 'lowpass'; padF.frequency.value = 380; padF.Q.value = 0.7;
      var padG = ctx.createGain(); padG.gain.value = 0; padF.connect(padG); padG.connect(K.out);
      [55, 55.35, 82.4, 110.2].forEach(function (f, i) {
        var os = ctx.createOscillator(); os.type = i < 2 ? 'sawtooth' : 'triangle'; os.frequency.value = f;
        var g = ctx.createGain(); g.gain.value = i < 2 ? 0.5 : 0.25; os.connect(g); g.connect(padF); os.start();
      });
      var waitO = ctx.createOscillator(); waitO.type = 'sine'; waitO.frequency.value = 196;
      var waitG = ctx.createGain(); waitG.gain.value = 0; waitO.connect(waitG); waitG.connect(K.out); waitO.start();
      var gpu = tl.end('a3'), w0 = C.behind + 1, w1 = C.there, home = C.copy + 2.2;
      function r(t, a, b) { return XP.seg(t, a, b); }
      function cont(t) {                                          // pad level, pad brightness (lowpass Hz), wait level, wait pitch
        var pad = 0.05 * r(t, 0, 6) + 0.03 * r(t, gpu - 1, gpu + 5) - 0.03 * r(t, w0, w0 + 5) + 0.03 * r(t, w1, w1 + 4) + 0.05 * r(t, home, home + 12) - 0.13 * r(t, TOT - 4, TOT);
        var cut = 380 + 900 * r(t, gpu - 1, gpu + 9) - 700 * r(t, w0, w0 + 12) + 700 * r(t, w1, w1 + 8) + 1400 * r(t, home, home + 18);
        var wait = 0.045 * r(t, w0, w0 + 5) * (1 - r(t, w1 - 1.5, w1));
        return [Math.max(0, pad), cut, wait, 196 * Math.pow(2, XP.clamp((t - w0) / (w1 - w0), 0, 1))];
      }
      function at(t, when, mode) {
        var c = cont(t);
        [[padG.gain, c[0]], [padF.frequency, c[1]], [waitG.gain, c[2]], [waitO.frequency, c[3]]].forEach(function (q) {
          if (mode === 'set') { q[0].cancelScheduledValues(when); q[0].setValueAtTime(q[1], when); }
          else if (mode === 'ramp') q[0].linearRampToValueAtTime(q[1], when);
          else q[0].setTargetAtTime(q[1], when, 0.06);
        });
      }
      var SFX = {
        key: function (w) { noise(w, 0.04, 0.05, 3500, 0, 3); },
        thump: function (w) { tone(w, 90, 0.5, 0.35, 'sine', 45); noise(w, 0.15, 0.08, 800); },
        land: function (w) { tone(w, 220, 0.4, 0.18, 'triangle', 110); },
        blip: function (w) { tone(w, 660, 0.12, 0.06, 'square'); },
        birth: function (w) { tone(w, 523, 1.8, 0.1); tone(w + 0.12, 784, 1.8, 0.07); tone(w + 0.24, 1047, 1.8, 0.05); },
        tick: function (w) { noise(w, 0.06, 0.2, 2200, 0, 4); tone(w, 880, 0.08, 0.05, 'square'); },
        soft: function (w) { noise(w, 0.03, 0.035, 2600 + 800 * Math.random(), 0, 5); },
        zap: function (w) { tone(w, 1200, 0.35, 0.08, 'sawtooth', 300); },
        miss: function (w) { tone(w, 330, 0.25, 0.08, 'square', 247); },
        clunk: function (w) { tone(w, 70, 0.6, 0.3, 'sine', 50); noise(w, 0.3, 0.1, 400); },
        ding: function (w) { tone(w, 988, 1.4, 0.12); tone(w, 1480, 1.0, 0.05); },
        two: function (w) { tone(w, 440, 0.3, 0.08, 'triangle'); tone(w + 0.3, 466, 0.5, 0.08, 'triangle'); },
        thunk: function (w) { tone(w, 110, 0.35, 0.25, 'sine', 70); },
        chord: function (w) { [262, 330, 392].forEach(function (f) { tone(w, f, 1.6, 0.06, 'triangle'); }); },
        bell: function (w) { [880, 1320, 1760].forEach(function (f, i) { tone(w + i * 0.01, f, 2.2 - i * 0.5, 0.07 / (i + 1)); }); },
        exit: function (w) { tone(w, 660, 1.6, 0.09, 'sine', 165); },
        resolve: function (w) { [196, 247, 294, 392].forEach(function (f) { tone(w, f, 2.5, 0.06, 'triangle'); }); },
        low: function (w) { tone(w, 65, 3.5, 0.12, 'sine'); },
        final: function (w) { [131, 196, 262, 330, 392].forEach(function (f, i) { tone(w + i * 0.08, f, 7, 0.05, 'triangle'); }); }
      };
      var E = [], t, b, lastSoft = -1;
      function on(t, name) { if (t >= 0 && t < TOT) E.push([t, SFX[name]]); }
      function whoosh(t, d) { E.push([t, function (w) { noise(w, d, 0.07, 300, 2400, 0.8); }]); }
      for (t = C.cxx - 0.9; t < C.cxx + 0.4; t += 0.13) on(t, 'key');
      on(C.launch, 'thump'); whoosh(C.cross, Math.max(1, gpu - C.cross)); on(gpu, 'land');
      for (b = 0; b < 11; b++) on(tAt(A[b]), 'blip');
      on(C.hello, 'birth'); on(C.first, 'tick'); on(C.ask, 'zap'); on(C.behind, 'zap'); on(C.misses, 'miss'); on(C.board, 'clunk');
      whoosh(C.tues, 6.5);
      for (var k = Math.ceil(C.tues / 0.24); k * 0.24 < act.fork + 0.5; k++) on(k * 0.24, 'soft');   // the scheduler's gold pick, every beat
      on(C.there, 'ding'); on(C.addIt, 'tick'); on(C.disagree, 'two'); on(C.oddGo, 'thunk'); on(C.turn, 'thunk'); on(C.again, 'chord');
      on(C.store, 'bell'); on(C.exit, 'exit');
      for (b = 0; b < NB; b++) {                                  // the pull back: a click for every block that leaves, on the real clock
        t = tAt(LV[b]); if (t > C.pull && t < C.tells && t - lastSoft > 0.06) { on(t, 'soft'); lastSoft = t; }
      }
      [tIn1, tIn2].forEach(function (c) { whoosh(c - 0.35, 1.0); }); [tOut1, tOut2].forEach(function (c) { whoosh(c - 0.1, 1.2); });
      whoosh(C.tells, Math.min(6.5, C.copy - C.tells + 1)); on(home, 'resolve'); on(home, 'low'); on(C.place, 'final'); on(C.story, 'low');
      return { at: at, events: E };
    }


    /* ---------- inside SM 10: a scene of its own (shots), cut to from the chip and back ----------
       Blackwell SM, schematic: four quadrants, each a warp scheduler with 12 warp slots, a 64 KB register file,
       32 FP32/INT32 lanes, a tensor core, load/store and SFU; the 128 KB L1 / shared memory behind them. Same clocks
       as the chip: blocks land and leave on the real schedule, the request leaves at 3,076 ns and is back at 3,880. */
    var SM = XP.scene({ camera: { W: CW, H: CH, az: -60, el: 44 } });
    var QC = [[-6.3, -7, 0], [6.3, -7, 0], [-6.3, 5.2, 0], [6.3, 5.2, 0]];
    function qp(q, x, y, z) { return [QC[q][0] + x, QC[q][1] + y, z]; }
    function slotC(q, j) { return qp(q, -4.0 + (j % 6) * 1.6, 3.55 + Math.floor(j / 6) * 0.9, 0.56); }
    function laneP(i) { return qp(0, (i - 15.5) * 0.32, -4.3, 0.58); }
    // left quadrants keep their load/store on the inner (+x) side, right ones mirror, so both reach the spine
    function ix(q) { return q % 2 ? -1 : 1; }
    function qu(q, x, y, z) { return qp(q, x * ix(q), y, z); }
    var LDST = qu(0, 3.65, -1.6, 1.0), L1P = [0, 13.8, 1.0], OUT = [0, 17.6, 1.0], BLK = [0, -0.3, 0.9];
    var mAlu = XP.mesh.box(0.25, 1.3, 0.3), mSlot = XP.mesh.box(1.4, 0.7, 0.06), mSW = XP.mesh.box(1.4, 0.7, 0.34), mThr = XP.mesh.box(0.22, 0.22, 0.22);
    var mCell = XP.mesh.box(0.24, 0.76, 0.1), mMac = XP.mesh.box(0.7, 0.4, 0.22), mI0 = XP.mesh.box(0.74, 0.56, 0.1), mRib = XP.mesh.box(0.05, 1.6, 0.36);
    SM.add(XP.mesh.slab(80, 70, 0.4, 1.0), { pos: [0, 2, -1.0], mat: 'paper', layer: 0 });
    var smBase = SM.add(XP.mesh.slab(26, 30, 0.6, 0.4), { pos: [0, 1.6, -0.6], mat: 'steel', layer: 1 });   // the outline the cuts match
    // the SM's own parts: L1 data / shared memory in 32 banks, L1 instruction cache, 4 texture units, the RT core
    var smL1 = SM.add(XP.mesh.box(24.4, 2.6, 0.25), { pos: [0, 13.8, 0], mat: 'mem', layer: 2 }), l1Banks = [];
    for (i = 0; i < 32; i++) l1Banks.push(SM.add(XP.mesh.box(0.64, 2.2, 0.3), { pos: [(i - 15.5) * 0.75, 13.8, 0.25], mat: 'mem', layer: 3 }));
    SM.add(XP.mesh.box(7.4, 1.0, 0.2), { pos: [-8.6, 15.85, 0], mat: 'mem', layer: 2 });                     // L1 instruction cache
    for (i = 0; i < 8; i++) SM.add(mI0, { pos: [-11.6 + i * 0.86, 15.85, 0.2], mat: 'mem', layer: 3 });
    for (i = 0; i < 4; i++) SM.add(XP.mesh.box(1.5, 1.0, 0.45), { pos: [2.6 + i * 1.8, 15.85, 0], mat: 'paper', layer: 2 });   // texture units
    SM.add(XP.mesh.box(2.6, 1.0, 0.65), { pos: [10.9, 15.85, 0], mat: 'paper', layer: 2 });                   // RT core
    // the data path: a spine up the middle to the L1, a feeder from each quadrant's load/store
    SM.add(XP.mesh.box(0.5, 24.4, 0.3), { pos: [0, 0.3, 0], mat: 'steel', layer: 2 });
    var quadF = [], rf = [], rfCells = [], alus = [], smW = [], disp = [], icache = [];
    for (q = 0; q < 4; q++) {
      quadF.push(SM.add(XP.mesh.slab(11.6, 11.2, 0.16, 0.1), { pos: qp(q, 0, 0.6, 0), mat: 'paper', layer: 2 }));
      var fx = qu(q, 5.0, 0, 0)[0], sgn = fx < 0 ? -1 : 1;                                             // load/store's inner edge → the spine
      SM.add(XP.mesh.box(Math.abs(fx) - 0.25, 0.4, 0.3), { pos: [sgn * (Math.abs(fx) + 0.25) / 2, QC[q][1] - 1.6, 0], mat: 'steel', layer: 3 });
      // L0 instruction cache, its lines
      SM.add(XP.mesh.box(10.6, 0.8, 0.18), { pos: qp(q, 0, 5.7, 0.16), mat: 'mem', layer: 3 }); icache.push([]);
      for (j = 0; j < 12; j++) icache[q].push(SM.add(mI0, { pos: qp(q, -4.65 + j * 0.845, 5.7, 0.34), mat: 'mem', layer: 4 }));
      SM.add(XP.mesh.box(10.6, 2.3, 0.4), { pos: qp(q, 0, 4.0, 0.16), mat: 'steel', layer: 3 });           // warp scheduler, 12 slots
      disp.push(SM.add(XP.mesh.box(10.6, 0.42, 0.26), { pos: qp(q, 0, 2.5, 0.16), mat: 'steel', layer: 3 }));   // dispatch
      // register file: 64 KB in four banks of cells
      rf.push(SM.add(XP.mesh.box(10.6, 2.0, 0.2), { pos: qp(q, 0, 1.2, 0.16), mat: 'paper', layer: 3 })); rfCells.push([]);
      for (var bk = 0; bk < 4; bk++) {
        SM.add(XP.mesh.box(2.5, 1.8, 0.12), { pos: qp(q, -3.975 + bk * 2.65, 1.2, 0.36), mat: 'steel', layer: 4 });
        for (j = 0; j < 16; j++) rfCells[q].push(SM.add(mCell, { pos: qp(q, -3.975 + bk * 2.65 - 1.05 + (j % 8) * 0.3, 1.2 - 0.43 + Math.floor(j / 8) * 0.86, 0.48), mat: 'paper', layer: 5 }));
      }
      // tensor core: a grid of multiply-add tiles; SFU and load/store as their units
      SM.add(XP.mesh.box(3.6, 2.2, 0.3), { pos: qu(q, -3.5, -1.6, 0.16), mat: 'paper', layer: 3 });
      for (j = 0; j < 16; j++) SM.add(mMac, { pos: qu(q, -3.5 - 1.23 + (j % 4) * 0.82, -1.6 - 0.75 + Math.floor(j / 4) * 0.5, 0.46), mat: 'paper', layer: 4 });
      SM.add(XP.mesh.box(2.4, 2.2, 0.2), { pos: qu(q, 0.3, -1.6, 0.16), mat: 'steel', layer: 3 });
      for (j = 0; j < 4; j++) SM.add(XP.mesh.box(0.95, 0.9, 0.34), { pos: qu(q, 0.3 - 0.52 + (j % 2) * 1.04, -1.6 - 0.5 + Math.floor(j / 2) * 1.0, 0.36), mat: 'paper', layer: 4 });
      SM.add(XP.mesh.box(2.7, 2.2, 0.2), { pos: qu(q, 3.65, -1.6, 0.16), mat: 'steel', layer: 3 });
      for (j = 0; j < 4; j++) SM.add(XP.mesh.box(0.52, 1.8, 0.42), { pos: qu(q, 3.65 - 0.96 + j * 0.64, -1.6, 0.36), mat: 'paper', layer: 4 });
      // 32 lanes in a tray, ribs every eight
      SM.add(XP.mesh.box(10.8, 1.7, 0.12), { pos: qp(q, 0, -4.3, 0.16), mat: 'steel', layer: 3 });
      for (i = 0; i < 32; i++) alus.push(SM.add(mAlu, { pos: qp(q, (i - 15.5) * 0.32, -4.3, 0.28), mat: 'steel', layer: 4 }));
      for (i = 1; i < 4; i++) SM.add(mRib, { pos: qp(q, (i * 8 - 16) * 0.32, -4.3, 0.28), mat: 'steel', layer: 4 });
      for (j = 0; j < 12; j++) { SM.add(mSlot, { pos: slotC(q, j), mat: 'steel', layer: 4 }); smW.push(SM.add(mSW, { pos: slotC(q, j), mat: 'work', layer: 5, show: false })); }
    }
    var myBlk = SM.add(XP.mesh.box(3.2, 2.2, 0.8), { pos: BLK, mat: 'subject', layer: 5, show: false });
    var thr = [], smSec = [];
    for (i = 0; i < 32; i++) thr.push(SM.add(mThr, { pos: laneP(i), mat: 'work', layer: 6, show: false }));
    for (n = 0; n < 12; n++) smSec.push(SM.add(mSec, { mat: 'memx', layer: 7, show: false }));
    var tFold = tAt(R.ldB + 12), dealEnd = C.eight + 0.2 + 7 * 0.12 + 0.7;
    function away(t) { return t >= tFold && t < C.there - 0.7; }     // my warp folded back into its slot, waiting for memory
    function smRoute(lg, sx, dy) { return [[lg[0], lg[1], lg[2] + 0.3], [LDST[0] + sx * 0.6, LDST[1], LDST[2]], [sx * 0.3, LDST[1], 0.75], [sx * 0.3, 11.8, 0.75], [L1P[0] + sx, L1P[1] + dy, L1P[2]], [OUT[0] + sx, OUT[1] + dy, OUT[2]]]; }

    var smTl = XP.timeline({ reset: function (S, t) { smCamAt(t, S.cam); } });
    smTl.play(TOT, function (p, S, t) {
      var ns = realAt(t), mine = null;
      // resident warps: each of the six slots' blocks deals two warps to every scheduler
      smW.forEach(function (w) { w.show = false; w.glow = 0; w.mat = 'work'; });
      for (var pp = 0; pp < 6; pp++) {
        var sb = slotBlock(MSM + pp * NSM, ns, t); if (!sb || sb.fly < 1) continue;
        for (var ww = 0; ww < 8; ww++) {
          var q = ww % 4, jj = pp * 2 + Math.floor(ww / 4), w = smW[q * 12 + jj], me = sb.b === MB && ww === MW;
          var deal = sb.b === MB ? E.inOut(sg(t, C.eight + 0.2 + ww * 0.12, 0.7)) : 1;
          if (deal <= 0) continue;
          w.show = sb.gone < 1; w.pos = arcTo([BLK[0], BLK[1], BLK[2] + 0.4], slotC(q, jj), deal, 2.5);
          w.scale = [1, 1, Math.max(0.02, 1 - sb.gone)]; w.mat = sb.b === MB ? 'subject' : 'work';
          if (sb.b === MB && !me) w.mat = 'work';
          if (me) mine = w;
        }
      }
      var b10 = slotBlock(MSM, ns, t), dealt = sg(t, C.eight + 0.2, 7 * 0.12 + 0.7);
      myBlk.show = !!b10 && b10.b === MB && dealt < 1; myBlk.scale = [1, 1, Math.max(0.02, 1 - dealt)]; myBlk.glow = t < C.eight ? 0.5 : 0;
      if (mine) {
        if (t >= C.warp - 0.1 && !away(t)) mine.show = false;     // down on the lanes, as 32 threads
        if (away(t)) mine.mat = 'steel';
        if (t >= C.exit) mine.show = false;
      }
      quadF[0].glow = t >= C.q0 && t < C.twelve + 1 ? 0.45 : 0;
      // the schedulers: every beat each issues one ready warp, and its lanes fire
      alus.forEach(function (a) { a.glow = 0; });
      [disp, l1Banks].concat(icache, rfCells).forEach(function (g) { g.forEach(function (x) { x.glow = 0; }); });
      var issueK = Math.floor(t / 0.24), beat = (t / 0.24) % 1;
      if (t >= C.tues && t < C.there - 0.7) for (q = 0; q < 4; q++) {
        var ready = []; for (var k2 = 0; k2 < 12; k2++) { var w2 = smW[q * 12 + k2]; if (w2.show && w2 !== mine) ready.push(w2); }
        if (!ready.length) continue;
        var pick = ready[Math.floor(hash(issueK * 4 + q) * ready.length)]; pick.glow = 0.9; pick.mat = 'gold';
        disp[q].glow = 0.5 * (1 - beat); icache[q][Math.floor(hash(issueK * 4 + q + 0.5) * 12)].glow = 0.6 * (1 - beat);   // fetched, dispatched
        for (var a2 = 0; a2 < 32; a2++) alus[q * 32 + a2].glow = 0.45 * (1 - beat);
      }
      // my warp as 32 threads on quadrant 0's lanes (the same story as the chip's old close-up)
      var from = slotC(0, 1), unf1 = sg(t, C.warp - 0.1, 1.0), unf2 = sg(t, C.there - 0.7, 0.7), laneGone = sg(t, C.exit, 0.8);
      thr.forEach(function (lp, i) {
        var u = away(t) ? 0 : E.inOut(XP.clamp((t < tFold ? unf1 : unf2) * 1.6 - i * 0.02, 0, 1));
        lp.show = u > 0 && laneGone < 1; lp.pos = V.lerp([from[0], from[1], from[2] + 0.1], laneP(i), u); lp.scale = Math.max(0.02, 1 - laneGone);
        lp.mat = i === ML ? 'subject' : 'work'; lp.glow = 0;
        if (i === ML + 1 && t >= C.nb) lp.mat = 'gold';
        if (t >= C.first && t < C.ask) { lp.glow = 0.7 * Math.max(0, Math.sin(Math.PI * XP.clamp((t - C.all32 + 0.1 - i * 0.02) / 0.6, 0, 1))); alus[i].glow = lp.glow * 0.6; }
        if (ns >= R.add && ns < R.br) { lp.glow = 0.6; alus[i].glow = 0.4; }
        var odd = i % 2 === 1, z = 0;
        if (t >= C.oddT && ns < R.odd) lp.mat = odd ? 'workx' : (i === ML ? 'subject' : 'work');
        if (ns >= R.odd && ns < R.join) {
          var active = ns < R.even ? odd : !odd;
          z = active ? 0.14 : -0.12; lp.glow = active ? 0.55 : 0; alus[i].glow = active ? 0.35 : 0;
          lp.mat = active ? (i === ML ? 'subject' : (odd ? 'workx' : 'work')) : 'steel';
          if (!active) lp.scale = 0.7 * lp.scale;
        }
        if (z) { var pz = lp.pos.slice(); pz[2] += z * E.inOut(sg(t, ns < R.even ? C.oddGo : C.turn, 0.5)); lp.pos = pz; }
      });
      // sectors: a[i] and b[i] leave through load/store and L1 toward L2; they come back the same way; c[i] leaves
      smSec.forEach(function (sp) { sp.show = false; sp.glow = 0; });
      [0, 3].forEach(function (lag, r) {
        var x = ns - lag, u = -1, back = false;
        if (x >= R.ldA && x < 3092) u = (x - R.ldA) / 14; else if (x >= 3862 && x < 3880) { u = (x - 3862) / 16; back = true; }
        if (u < 0) return;
        for (var m = 0; m < 4; m++) {
          var sp = smSec[r * 4 + m], rt = smRoute(laneP(m * 8 + 3.5), (m - 1.5) * 0.45, r * 0.5);
          if (back) rt.reverse();
          sp.show = true; sp.mat = r ? 'mem' : 'memx'; sp.glow = 0.5; sp.scale = r ? 0.85 : 1; sp.pos = path(rt, E.inOut(XP.clamp(u, 0, 1)));
        }
      });
      var stU = sg(t, C.merge - 0.2, 2.6);
      if (stU > 0 && stU < 1) for (var m2 = 0; m2 < 4; m2++) { var sp2 = smSec[8 + m2]; sp2.show = true; sp2.mat = 'workx'; sp2.glow = 0.5; sp2.pos = path(smRoute(laneP(m2 * 8 + 3.5), (m2 - 1.5) * 0.45, 0), E.inOut(stU)); }
      smL1.glow = (ns >= 3083 && ns < 3092) || (ns >= 3862 && ns < 3872) || (stU > 0.45 && stU < 0.8) ? 0.4 : 0;
      l1Banks.forEach(function (b) { b.glow = smL1.glow; });
      rf[0].glow = t >= C.pool - 0.3 && t < C.pool + 1.4 ? 0.55 : 0;      // my registers go back to the pool
      var rg = rf[0].glow || (ns >= R.add && ns < R.br ? 0.35 : 0);       // …and are read for the add
      rfCells[0].forEach(function (c) { c.glow = rg; });
    }, { at: 0, ease: E.linear });

    /* its camera; the first frame after each cut in puts the SM's outline exactly where SM 10's pad was on the chip */
    var SF = { all: [[0, 1.6, 0], 44], q0: [[QC[0][0], QC[0][1] + 1.2, 0.3], 16], slots: [[QC[0][0], QC[0][1] + 3.6, 0.5], 12.5],
      lanes: [[QC[0][0], QC[0][1] - 3.6, 0.5], 13.5], nbTight: [[laneP(ML + 0.5)[0] + 0.6, laneP(ML)[1], 0.6], 6], lanesTight: [[QC[0][0], QC[0][1] - 4.1, 0.6], 12], lanesOut: [[-4, 1, 0.6], 37] };
    var SKEYS = [[0, 'm1', -60, 44], [tIn1, 'm1', -60, 44], [tIn1 + DUR, 'all', -60, 46], [C.q0, 'q0', -60, 46], [C.twelve, 'slots', -62, 48],
      [C.warp, 'lanes', -62, 38], [C.nb, 'nbTight', -60, 34], [C.first, 'lanes', -62, 38], [C.behind, 'lanesOut', -62, 44], [tOut1, 'all', -62, 46],
      [tIn2, 'm2', -60, 44], [tIn2 + DUR, 'q0', -60, 46], [C.slow, 'q0', -62, 46], [C.there - 0.8, 'lanes', -62, 38], [C.oddT, 'lanesTight', -60, 34],
      [C.again, 'lanesTight', -62, 36], [C.store, 'lanesOut', -62, 42], [C.exit, 'q0', -62, 44], [tOut2 - 0.3, 'all', -62, 46], [TOT, 'all', -62, 46]];
    var smCamAt = camFrom(SKEYS, SF);
    function camAt(f, t) { var c = XP.camera({ W: CW, H: CH }); f(t, c); return c; }
    function frameOnto(az, el, target, rect) { var c = XP.fitRect(XP.camera({ W: CW, H: CH, az: az, el: el }), target, rect); return [c.center, CW / c.zoom]; }
    SF.m1 = frameOnto(-60, 44, smBase, XP.screenRect(camAt(cameraAt, tIn1), pads[MSM]));
    SF.m2 = frameOnto(-60, 44, smBase, XP.screenRect(camAt(cameraAt, tIn2), pads[MSM]));
    FRAME.smMatch1 = frameOnto(-62, 46, pads[MSM], XP.screenRect(camAt(smCamAt, tOut1), smBase));
    FRAME.smMatch2 = frameOnto(-62, 46, pads[MSM], XP.screenRect(camAt(smCamAt, tOut2), smBase));
    // match cuts: the old frame's SM 10 rides on the new scene's SM 10 while the new camera moves, and fades
    var IN = { kind: 'zoom', dur: DUR, focus: pads[MSM], to: smBase }, OUTC = { kind: 'zoom', dur: DUR, focus: smBase, to: pads[MSM] };
    var SHOTS = [{ scene: S }, { scene: SM, tl: smTl, at: tIn1, cut: IN }, { scene: S, at: tOut1, cut: OUTC }, { scene: SM, tl: smTl, at: tIn2, cut: IN }, { scene: S, at: tOut2, cut: OUTC }];

    function smLabels(t, S) {
      var Lb = [], ns = realAt(t), span = CW / S.cam.zoom, far = span > 24, near = span <= 14;
      if (far) {
        [0, 1, 2, 3].forEach(function (q) { Lb.push({ p: qp(q, 0, -5.7, 0.2), text: 'quadrant ' + q, short: 'q' + q, cls: 'tag' + (q === 0 && t >= C.q0 ? ' me' : '') }); });
        Lb.push({ p: [-12.4, 13.8, 0.7], text: 'L1 / shared memory · 128 KB, 32 banks', short: 'L1 · shared', cls: 'tag', align: 'r' });
        Lb.push({ p: [-8.6, 15.85, 0.5], text: 'L1 instruction cache', short: 'L1 i-cache', cls: 'dim', wide: true });
        Lb.push({ p: [5.3, 15.85, 0.7], text: 'texture ×4', cls: 'dim', wide: true });
        Lb.push({ p: [10.9, 15.85, 0.9], text: 'RT core', cls: 'dim', wide: true });
        Lb.push({ p: [-13.4, 1.6, 0], text: 'SM 10', cls: 'tag', align: 'r' });
      } else if (!near) {
        // on the parts themselves, so they stay in frame however close the camera is
        Lb.push({ p: qp(0, -3.0, 5.7, 0.5), text: 'L0 instruction cache', short: 'L0 i-cache', cls: 'dim', wide: true });
        Lb.push({ p: qp(0, 2.4, 3.0, 0.6), text: t >= C.tues ? 'warp scheduler · 12 warps' : 'warp scheduler · 12 slots', short: 'scheduler', cls: 'tag' });
        Lb.push({ p: qp(0, 4.0, 2.5, 0.45), text: 'dispatch', cls: 'dim', wide: true });
        Lb.push({ p: qp(0, -3.975, 1.2, 0.75), text: 'register file · 64 KB, 4 banks', short: 'registers', cls: 'tag' });
        Lb.push({ p: qu(0, -3.5, -1.6, 0.85), text: 'tensor core', cls: 'dim', wide: true });
        Lb.push({ p: qu(0, 0.3, -1.6, 0.8), text: 'SFU', cls: 'dim', wide: true });
        Lb.push({ p: qu(0, 3.65, -1.6, 0.85), text: 'load/store', cls: 'dim', wide: true });
        if (!thr[0].show) Lb.push({ p: qp(0, 0, -5.4, 0.3), text: '32 lanes · FP32 / INT32', short: '32 lanes', cls: 'tag' });
      }
      if (myBlk.show) Lb.push({ p: [BLK[0], BLK[1] - 1.6, 1.8], text: 'block 10 · 8 warps', short: 'block 10', cls: 'me' });
      if (away(t) && t >= tIn2 && span < 26) Lb.push({ p: [slotC(0, 1)[0], slotC(0, 1)[1], 1.4], text: 'my warp · waiting', short: 'waiting', cls: 'me' });
      if (thr[0].show && span <= 16) Lb.push({ p: [laneP(ML)[0], laneP(ML)[1], 1.05], text: t >= C.first && t < C.ask ? 'i = 2,690' : '2,690 · me', short: '2,690', cls: 'me' });
      if (thr[0].show && near) {
        if (t >= C.nb) Lb.push({ p: [laneP(ML + 1)[0] + 0.15, laneP(ML + 1)[1], 0.2], text: t >= C.first && t < C.ask ? 'i = 2,691' : '2,691', cls: 'hot', align: 'l' });
        if (t >= C.lanes32 && t < C.first) { Lb.push({ p: [laneP(31)[0] + 0.2, laneP(31)[1], 0.6], text: 'lane 31', cls: 'dim', align: 'l' }); Lb.push({ p: [laneP(0)[0] - 0.2, laneP(0)[1], 0.6], text: 'lane 0', cls: 'dim', align: 'r' }); }
        var code = t < C.first ? '' : t < C.ask ? 'int i = blockIdx.x * 256 + threadIdx.x;' : t < tOut1 ? 'float x = a[i] + b[i];' : t < C.twist ? 'float x = a[i] + b[i];'
          : t < C.store ? 'if (i % 2) x *= 3.0f; else x += 1.0f;' : t < C.exit ? 'c[i] = x;' : '';
        if (code) Lb.push({ p: [laneP(15.5)[0], laneP(15.5)[1], 1.7], text: code, cls: '' });
        if (ns >= R.odd && ns < R.join) Lb.push({ p: [laneP(31)[0] + 0.25, laneP(31)[1], 0.6], text: ns < R.even ? 'odd lanes: x *= 3' : 'even lanes: x += 1', short: ns < R.even ? 'odd' : 'even', cls: 'tag', align: 'l' });
      }
      if (t >= C.ask && t < tOut1 && span < 32) Lb.push({ p: [LDST[0] + 1.6, LDST[1], LDST[2] + 0.6], text: 'a[2688 … 2719] · 4 sectors', short: '4 sectors', cls: 'hot', align: 'l' });
      if (t >= tIn2 && t < C.there - 0.7 && span < 26 && span > 9) Lb.push({ p: qp(0, 3.4, 5.7, 0.6), text: 'every cycle: one ready warp issues', short: 'one warp issues', cls: 'hot' });
      return Lb;
    }

    var stills = [C.launch + 1.5, C.hello + 0.6, C.nb + 1, C.forever, C.masked, C.lived, C.tail];
    stills.forEach(function (s, n) { if (tl.beats[n]) tl.beats[n].still = s; });
    if (opt.bare) return { scene: S, sm: SM, shots: SHOTS, tl: tl, realAt: realAt, cues: C, act: act };
    return XP.player(host, {
      id: ID, fig: opt.fig || 'Film II', title: 'Life of a Launch', scene: S, tl: tl, shots: SHOTS,
      labels: function (t, sc) { return sc === SM ? smLabels(t, sc) : labels(t, sc); },
      stillAt: C.forever, posterAt: C.forever - 1,
      styleAt: function () { return { a: 'ink', b: 'ink', mix: 0 }; },
      label: 'One kernel launch on an RTX 5070, told by thread 2,690: the CPU, the PCIe bus, the GPU die with 48 SMs, an L2 strip and six GDDR7 chips. Blocks land in the SMs’ six slots; SM 10 opens into four quadrants of warps; one warp unfolds into 32 lanes; a memory request leaves the die and comes back; the lanes diverge and rejoin.',
      readout: function (t) { return lineAt(t); },
      keys: [['subject', 'me: thread 2,690, its block and its warp'], ['work', 'a resident block, a warp, a lane'], ['gold', 'my neighbour 2,691; a warp issuing'], ['mem', 'memory: L2 and GDDR7'], ['memx', 'my request: 4 sectors'], ['steel', 'waiting, masked, or an empty slot']],
      score: opt.mute ? null : score, scoreGain: 1.4,
      caption: opt.caption || '', gl: opt.gl
    });
  };
})();
