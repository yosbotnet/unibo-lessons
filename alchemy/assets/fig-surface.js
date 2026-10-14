/* fig-surface.js — Unit 1, §2. The loss surface over learning rate and batch size, as a field of runs.
   Each column is one finished training run; its height is how far its final loss sits above the best run.
   ILLUSTRATIVE model, anchored to CS 312's measured d8 numbers (see Alchemy.loss below); not measured. */
(function () {
  'use strict';
  var Alchemy = window.Alchemy = window.Alchemy || {};

  /* ---------- the model (shared with u1.js) ----------
     loss(X, lr, B) = Lbest(X) + K·log2(lr / lr*(X, B))² + KB·log2(B / 64)²
     - K = 0.01 per octave², the course's own rule of thumb for "how much does a factor-of-2 LR error cost".
     - lr*(X, 64) = 0.0074·(X/4)^-0.73: fitted so that lr 0.03 costs +0.023 at d4, +0.056 at d6 and +0.122 at d16
       over lr 0.003, the gaps CS 312 measured (quiz 1, Q7) — given K. Gives 0.0045 at d8, 0.0027 at d16.
     - lr* grows as sqrt(B) (a common rule for Adam), and batch 64 is optimal at d8's 614M tokens (Step Law's fit
       gives about 60 sequences there); KB = 0.003 per octave² is a guess.
     - Lbest(X) = 2.647 + 3.35·X^-1.2: chosen so that the default recipe (lr 0.003, batch 64) gives 2.926 at d8 and
       L(d9) − L(d4) = −0.41, both measured. */
  var K = 0.01, KB = 0.003;
  function lrStar(X, B) { return 0.0074 * Math.pow(X / 4, -0.73) * Math.sqrt((B || 64) / 64); }
  function lbest(X) { return 2.647 + 3.35 * Math.pow(X, -1.2); }
  function loss(X, lr, B) {
    B = B || 64;
    var a = Math.log2(lr / lrStar(X, B)), b = Math.log2(B / 64);
    return lbest(X) + K * a * a + KB * b * b;
  }
  Alchemy.loss = { loss: loss, lrStar: lrStar, lbest: lbest, K: K, KB: KB };

  var LRS = [0.000375, 0.00075, 0.0015, 0.003, 0.006, 0.012, 0.024, 0.048];
  var BS = [16, 32, 64, 128, 256, 512];
  function fmtLR(v) { return v >= 0.01 ? v.toFixed(3).replace(/0$/, '') : v >= 0.001 ? v.toFixed(4).replace(/0$/, '') : v.toFixed(5).replace(/0+$/, ''); }
  function grid(X) {                                   // losses on the grid, the best per batch, the best overall
    var L = BS.map(function (B) { return LRS.map(function (lr) { return loss(X, lr, B); }); });
    var rowBest = L.map(function (row) { var j = 0; row.forEach(function (v, k) { if (v < row[j]) j = k; }); return j; });
    var bi = 0, bj = rowBest[0];
    L.forEach(function (row, i) { if (row[rowBest[i]] < L[bi][bj]) { bi = i; bj = rowBest[i]; } });
    return { L: L, rowBest: rowBest, best: [bi, bj], min: L[bi][bj] };
  }
  var G8 = grid(8), G16 = grid(16);
  Alchemy.surface = { LRS: LRS, BS: BS, G8: G8, G16: G16, fmtLR: fmtLR };

  Alchemy.figSurface = function (host, opt) {
    opt = opt || {};
    var S = XP.scene({ camera: { W: 760, H: 500, az: -62, el: 44 } });
    var E = XP.ease, P = 2.5, NX = LRS.length, NY = BS.length;
    var X0 = -(NX - 1) * P / 2, Y0 = -(NY - 1) * P / 2;
    function cx(j) { return X0 + j * P; }
    function cy(i) { return Y0 + i * P; }
    function hOf(ex) { return 0.4 + Math.min(7.2, 32 * ex); }        // height: 0.4 floor + 32 units per unit of loss excess (capped at +0.225)

    /* ---------- ground: a base, a tile per run, rulers along two edges ---------- */
    var W = NX * P + 2.6, D = NY * P + 2.6;
    S.add(XP.mesh.slab(W + 3.2, D + 3.2, 0.5, 1.2), { pos: [0, 0, -1.0], mat: 'paper', layer: 0 });
    S.add(XP.mesh.slab(W, D, 0.35, 0.8), { pos: [0, 0, -0.55], mat: 'steel', layer: 1 });
    var mTile = XP.mesh.slab(P * 0.86, P * 0.86, 0.14, 0.18);
    for (var i = 0; i < NY; i++) for (var j = 0; j < NX; j++) S.add(mTile, { pos: [cx(j), cy(i), -0.2], mat: 'paper', layer: 2 });
    // the learning-rate ruler (front edge) and the batch ruler (left edge): a tick per grid line, a major per octave pair
    var RY = Y0 - P / 2 - 1.05, RX = X0 - P / 2 - 1.05;
    S.add(XP.mesh.box(NX * P, 0.8, 0.14), { pos: [0, RY, -0.5], mat: 'paper', layer: 2 });
    S.add(XP.mesh.box(0.8, NY * P, 0.14), { pos: [RX, 0, -0.5], mat: 'paper', layer: 2 });
    for (j = 0; j < NX; j++) S.add(XP.mesh.box(0.1, j % 2 ? 0.34 : 0.6, 0.06), { pos: [cx(j), RY + (j % 2 ? 0.13 : 0), -0.36], mat: 'ink', layer: 3 });
    for (i = 0; i < NY; i++) S.add(XP.mesh.box(i % 2 ? 0.34 : 0.6, 0.1, 0.06), { pos: [RX + (i % 2 ? 0.13 : 0), cy(i), -0.36], mat: 'ink', layer: 3 });
    for (j = 0; j < NX - 1; j++) S.add(XP.mesh.box(0.06, 0.2, 0.05), { pos: [cx(j) + P / 2, RY + 0.2, -0.36], mat: 'ink', layer: 3 });

    /* ---------- the runs: one column each, with a cap so the top reads as a level ---------- */
    var mCol = XP.mesh.slab(P * 0.62, P * 0.62, 1, 0.12), mCap = XP.mesh.slab(P * 0.7, P * 0.7, 0.14, 0.16);
    var cols = [], caps = [];
    for (i = 0; i < NY; i++) {
      cols.push([]); caps.push([]);
      for (j = 0; j < NX; j++) {
        cols[i].push(S.add(mCol, { pos: [cx(j), cy(i), -0.06], mat: 'steel', scale: [1, 1, 0.01], layer: 3, show: false }));
        caps[i].push(S.add(mCap, { pos: [cx(j), cy(i), 0], mat: 'paper', layer: 4, show: false }));
      }
    }
    XP.fit(S.cam, [[X0 - P - 1.6, Y0 - P - 1.6, -1], [-X0 + P, Y0 - P - 1.6, -1], [-X0 + P, -Y0 + P, -1], [X0 - P - 1.6, -Y0 + P, -1], [X0, Y0, 8], [-X0, Y0, 8], [X0, -Y0, 8], [-X0, -Y0, 8], [-X0 + P, Y0 - P - 9, -1]], 26);

    /* ---------- the film: four acts, every frame computed from t ---------- */
    var B64 = BS.indexOf(64), J8 = G8.rowBest[B64];              // d8's best rate at batch 64: the rate we later borrow
    var ACTS = [
      { t0: 0, title: 'One sweep', say: 'Eight runs at batch 64, one learning rate each. Final loss is roughly a parabola in log learning rate: too low and the model learns too little, too high and training is unstable.' },
      { t0: 10, title: 'Every batch size', say: 'The same sweep at six batch sizes. The best rate (blue) moves with the batch: the valley runs diagonally.' },
      { t0: 21, title: 'A borrowed rate', say: 'Use batch 64’s best rate everywhere and compare batch sizes along that one column (red). The borrowed rate adds its own cost on top of the batch’s, and you cannot tell the two apart.' },
      { t0: 31, title: 'A bigger model', say: 'Grow the model from d8 to d16. The valley slides toward smaller rates, so d8’s best rate (red) is now a step up the wall, about 0.01 worse than d16’s own best.' }
    ];
    var TOTAL = 42;
    function actAt(t) { for (var k = ACTS.length - 1; k >= 0; k--) if (t >= ACTS[k].t0 - 1e-9) return k; return 0; }
    function morphAt(t) { return E.inOut(XP.seg(t, 32, 35)); }      // d8 → d16
    function heightAt(i, j, t) {
      var m = morphAt(t), ex8 = G8.L[i][j] - G8.min, ex16 = G16.L[i][j] - G16.min;
      return hOf(ex8 + (ex16 - ex8) * m);
    }
    function riseAt(i, j, t) {                                    // 0..1: how far this run has "finished"
      if (i === B64) return E.out(XP.seg(t, 0.6 + j * 0.75, 1.3 + j * 0.75));
      var k = [32, 128, 16, 256, 512].indexOf(BS[i]);
      return E.out(XP.seg(t, 10.6 + k * 1.1 + j * 0.06, 11.4 + k * 1.1 + j * 0.06));
    }
    var tl = XP.timeline({ reset: function (S) {
      cols.forEach(function (r) { r.forEach(function (c) { c.show = false; c.mat = 'steel'; c.glow = 0; c.scale = [1, 1, 0.01]; }); });
      caps.forEach(function (r) { r.forEach(function (c) { c.show = false; c.mat = 'paper'; c.glow = 0; }); });
    } });
    ACTS.forEach(function (a, k) { tl.at(a.t0); tl.beat(a.title, a.say, { still: (ACTS[k + 1] ? ACTS[k + 1].t0 : TOTAL) - 1.2 }); });
    tl.at(0);
    tl.play(TOTAL, function (p, S, t) {
      var act = actAt(t), m = morphAt(t), G = m < 0.5 ? G8 : G16;
      for (var i = 0; i < NY; i++) for (var j = 0; j < NX; j++) {
        var u = riseAt(i, j, t);
        if (u <= 0) continue;
        var h = heightAt(i, j, t) * u, c = cols[i][j], cp = caps[i][j];
        c.show = true; c.scale = [1, 1, h]; cp.show = true; cp.pos = [cx(j), cy(i), h - 0.06];
        var isRowBest = G.rowBest[i] === j, isBest = G.best[0] === i && G.best[1] === j;
        var mat = 'steel', cap = 'paper', glow = 0;
        if (act === 0 && i === B64 && u >= 1 && t > 7.2 && j === J8) { mat = 'gold'; cap = 'gold'; glow = 0.35; }
        if (act >= 1 && t > 16.2 && isRowBest) { mat = 'subject'; cap = 'subject'; }
        if (act >= 1 && t > 16.2 && isBest) { mat = 'gold'; cap = 'gold'; glow = 0.35; }
        if (act === 2 && j === J8 && !isRowBest && t > 22) { mat = 'mem'; cap = 'memx'; glow = 0.15; }
        if (act === 3 && i === B64 && j === J8 && !isRowBest && t > 34) { mat = 'mem'; cap = 'memx'; glow = 0.2; }
        c.mat = mat; cp.mat = cap; c.glow = glow; cp.glow = glow;
      }
    }, { at: 0, ease: XP.ease.linear });

    /* ---------- labels and readout ---------- */
    function labels(t) {
      var Lb = [], act = actAt(t), m = morphAt(t), G = m < 0.5 ? G8 : G16;
      LRS.forEach(function (lr, j) { Lb.push({ p: [cx(j), RY - 0.9, -0.4], text: fmtLR(lr), cls: 'dim', wide: j % 2 === 1 }); });
      BS.forEach(function (B, i) { Lb.push({ p: [RX - 0.8, cy(i), -0.4], text: String(B), cls: 'dim', align: 'r' }); });
      Lb.push({ p: [cx(NX - 1) + 2.4, RY, -0.4], text: 'learning rate', short: 'lr', cls: 'tag', align: 'l' });
      Lb.push({ p: [RX - 0.9, cy(NY - 1) + 2.8, -0.4], text: 'batch (sequences)', short: 'batch', cls: 'tag', align: 'r' });
      if (act === 0 && t > 7.2) Lb.push({ p: [cx(J8), cy(B64), hOf(G8.L[B64][J8] - G8.min) + 1.2], text: 'best at batch 64', short: 'best', cls: 'me' });
      if (act === 3 && t > 34) Lb.push({ p: [cx(J8), cy(B64), heightAt(B64, J8, t) + 3.4], text: 'd8’s best rate', short: 'd8 best', cls: 'hot' });
      return Lb;
    }
    function readout(t) {
      var act = actAt(t), m = morphAt(t), X = m < 0.5 ? 8 : 16, G = X === 8 ? G8 : G16;
      if (act === 0) {
        var n = 0; for (var j = 0; j < NX; j++) if (riseAt(B64, j, t) >= 1) n++;
        return 'd8 · batch 64 · ' + n + ' of 8 runs' + (t > 7.2 ? ' · best lr ' + fmtLR(LRS[J8]) + ' · loss ' + G8.L[B64][J8].toFixed(3) : '');
      }
      if (act === 1) return 'd8 · best lr ' + fmtLR(LRS[G8.rowBest[0]]) + ' at batch 16 → ' + fmtLR(LRS[G8.rowBest[NY - 1]]) + ' at batch 512';
      if (act === 2) {
        var i5 = NY - 1, own = G8.L[i5][G8.rowBest[i5]], bor = G8.L[i5][J8];
        return 'batch 512 vs 64 · at lr ' + fmtLR(LRS[J8]) + ': +' + (bor - G8.L[B64][J8]).toFixed(3) + ' · each tuned: +' + (own - G8.L[B64][J8]).toFixed(3);
      }
      return (X === 8 ? 'd8' : 'd16') + ' · batch 64 · best lr ' + fmtLR(LRS[G.rowBest[B64]]) + (X === 16 ? ' · lr ' + fmtLR(LRS[J8]) + ' costs +' + (G16.L[B64][J8] - G16.L[B64][G16.rowBest[B64]]).toFixed(3) : '');
    }

    return XP.player(host, {
      id: opt.id || 'surface', fig: opt.fig || 'Fig. 1', title: 'A field of runs: learning rate × batch size', scene: S, tl: tl,
      labels: labels, readout: readout, stillAt: ACTS[1].t0 + 9, loop: true, gl: false,
      label: 'A grid of 48 columns on a base. Left to right, eight learning rates from 0.0004 to 0.048, each twice the previous; front to back, six batch sizes from 16 to 512. Each column is one training run, and its height is how far the run’s final loss sits above the best run. Four acts: one sweep at batch 64; the full grid, where the best rate for each batch lies on a diagonal valley; one rate borrowed for every batch; and the same grid for a model eight times larger, where the valley moves to smaller rates.',
      keys: [['steel', 'one finished run · height = loss above the best run'], ['subject', 'the best rate for that batch size'], ['gold', 'the best run in the grid'],
             ['mem', 'a run at a borrowed rate: the extra loss is the rate’s, not the batch’s'], ['paper', 'the floor: one tile per run']],
      caption: opt.caption || ''
    });
  };
})();
