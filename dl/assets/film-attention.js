/* film-attention.js — Film 10.1: one word through one attention layer, narrated by "terrible".
   The sentence of § 2 stands as six vectors in a row. First the bare dot products of § 2 (with the
   embeddings of the widget above: they pick the words that look like terrible, not the ones that change
   it), then learned queries, keys and values (§ 5), softmax, the blend of values, several heads (§ 6),
   and finally every word at once: the N × N grid that is softmax(QKᵀ/√dₖ).
   Bare-attention numbers are computed from the widget's embeddings; the learned scores, the heads and
   the verdict are illustrative values chosen to show what a trained layer can learn. */
(function () {
  'use strict';
  window.DLFilms = window.DLFilms || {};
  DLFilms.attention = function (host, opt) {
    opt = opt || {};
    var ID = opt.id || 'attention';
    var W = ['This', 'restaurant', 'was', 'not', 'too', 'terrible'], N = 6, ME = 5, NOT = 3, TOO = 4, RES = 1;
    var S = XP.scene({ camera: { W: 760, H: 470, az: 12, el: 32 } });

    /* ---------- the truth model ---------- */
    var emb = { This: [0.9, 0.1], restaurant: [0.95, 0.35], was: [0.55, 0.9], not: [0.1, 0.6], too: [0.15, 0.35], terrible: [0.8, 0.7] };
    function softmax(a) { var m = Math.max.apply(null, a), e = a.map(function (v) { return Math.exp(v - m); }), s = e.reduce(function (x, y) { return x + y; }, 0); return e.map(function (v) { return v / s; }); }
    var q0 = emb.terrible;
    var bare = W.map(function (w) { return (q0[0] * emb[w][0] + q0[1] * emb[w][1]) / Math.SQRT2; });   // x·x/√d, d = 2 (§ 2)
    var bareW = softmax(bare);
    var learned = [0.1, 0.9, 0.3, 2.4, 2.0, 1.2], learnedW = softmax(learned);                          // illustrative q·k/√dₖ
    var HEADS = [['negation', [0, 0.2, 0.3, 3.0, 0.8, 1.4]], ['degree', [0, 0.1, 0.2, 1.0, 2.9, 1.3]], ['about', [0.9, 2.8, 0.9, 0.1, 0.2, 1.0]]]
      .map(function (h) { return { name: h[0], w: softmax(h[1]) }; });
    var ROWS = [ME, 0, 1, 2, 3, 4];                                // grid rows: queries, mine first (nearest the words)
    var GRID = ROWS.map(function (r) {                             // illustrative attention rows for the other words
      if (r === ME) return learnedW;
      return softmax(W.map(function (w, j) { return (j === r ? 1.3 : 0) + 1.6 * XP.hash(r * 13 + j * 7 + 3); }));
    });
    var VERDICT = { alone: -0.8, mixed: 0.3 };
    function pct(x) { return Math.round(x * 100) + '%'; }

    /* ---------- world: six words in a row along y, the layer's work in front of them (+x, toward you) ---------- */
    var DY = 2.2, D = 6, PX = 1.75, HX = 1.3;                   // word spacing, vector length, pillar row, row spacing
    function wy(i) { return i * DY; }
    var mCell = XP.mesh.box(0.62, 0.62, 0.56), mThin = XP.mesh.box(0.4, 0.4, 0.4), mBar = XP.mesh.box(0.58, 0.58, 1), mBarT = XP.mesh.box(0.44, 0.44, 1), mSeg = XP.mesh.box(0.78, 0.78, 1), mPkt = XP.mesh.box(0.3, 0.3, 0.3);
    var YOUT = wy(ME) + 1.9, GY0 = YOUT + 1.9, GY1 = GY0 + 3.2;    // my output column; the verdict gauge
    var FX0 = -1.6, FX1 = PX + 5 * HX + 1.0, FY0 = -2.6, FY1 = GY1 + 1.2;
    S.add(XP.mesh.slab(FX1 - FX0, FY1 - FY0, 0.45, 0.3), { pos: [(FX0 + FX1) / 2, (FY0 + FY1) / 2, -0.45], mat: 'paper', layer: 0 });
    var gauge = {
      track: S.add(XP.mesh.slab(0.7, GY1 - GY0, 0.22, 0.12), { pos: [0.4, (GY0 + GY1) / 2, 0], mat: 'paper', layer: 1 }),
      neg: S.add(XP.mesh.box(0.7, 0.36, 0.5), { pos: [0.4, GY0 + 0.18, 0], mat: 'mem', layer: 1 }),
      pos: S.add(XP.mesh.box(0.7, 0.36, 0.5), { pos: [0.4, GY1 - 0.18, 0], mat: 'work', layer: 1 }),
      mid: S.add(XP.mesh.box(0.7, 0.1, 0.32), { pos: [0.4, (GY0 + GY1) / 2, 0], mat: 'steel', layer: 1 }),
      needle: S.add(XP.mesh.cyl(0.3, 0.9, 16), { pos: [0.4, (GY0 + GY1) / 2, 0.22], mat: 'ink', layer: 2 })
    };
    function hv(i, c, seed) { return 0.45 + 0.55 * XP.hash(i * 31 + c * 7 + seed); }      // illustrative vector entries
    var tok = W.map(function (w, i) {
      var t = { raw: [], q: [], k: [], v: [], bar: null, head: [], grid: [] };
      for (var c = 0; c < D; c++) {
        t.raw.push(S.add(mCell, { pos: [0, wy(i), c * 0.6], mat: 'steel', layer: 1, show: false }));
        t.q.push(S.add(mThin, { pos: [0, wy(i) - 0.55, c * 0.46], mat: 'gold', layer: 1, show: false }));
        t.k.push(S.add(mThin, { pos: [0, wy(i), c * 0.46], mat: 'mem', layer: 1, show: false }));
        t.v.push(S.add(mThin, { pos: [0, wy(i) + 0.55, c * 0.46], mat: 'work', layer: 1, show: false }));
      }
      t.bar = S.add(mBar, { pos: [PX, wy(i), 0], mat: 'ink', layer: 1, show: false });
      for (var h = 0; h < 3; h++) t.head.push(S.add(mBarT, { pos: [PX + h * HX, wy(i), 0], mat: 'ink', layer: 1, show: false }));
      for (var r = 0; r < N; r++) t.grid.push(S.add(mBarT, { pos: [PX + r * HX, wy(i), 0], mat: 'ink', layer: 1, show: false }));
      return t;
    });
    var seg = [], hout = [], pk = [];
    for (var j = 0; j < N; j++) seg.push(S.add(mSeg, { pos: [PX, YOUT, 0], mat: 'work', layer: 2, show: false }));
    for (var h = 0; h < 3; h++) hout.push(S.add(mSeg, { pos: [PX + h * HX, YOUT, 0], mat: 'workx', layer: 2, show: false }));
    for (var q = 0; q < 24; q++) pk.push(S.add(mPkt, { mat: 'subject', layer: 3, show: false }));

    /* ---------- helpers ---------- */
    function sg(t, a, d) { return XP.seg(t, a, a + d); }
    var E = XP.ease, pkI = 0;
    function packet(mat) { var p = pk[(pkI++) % pk.length]; p.mat = mat; return p; }
    function fly(p, a, b, u, arc, size) {
      if (u <= 0 || u >= 1) { p.show = false; return; }
      var m = XP.v.lerp(a, b, u); m[2] += Math.sin(Math.PI * u) * arc;
      p.show = true; p.pos = m; p.scale = (size || 1) * (0.6 + 0.4 * Math.sin(Math.PI * u));
    }
    function col(cells, f, mat, glow) { cells.forEach(function (c, n) { var d = XP.seg(f, n * 0.1, n * 0.1 + 0.5); c.show = d > 0; c.scale = E.back(d); if (mat) c.mat = mat; c.glow = glow || 0; }); }
    function bar(b, h, mat, glow) { b.show = h > 0.01; b.scale = [1, 1, Math.max(0.01, h)]; b.mat = mat || 'ink'; b.glow = glow || 0; }
    function topOf(i, which) { return which === 'q' ? [0, wy(i) - 0.55, D * 0.46 + 0.1] : which === 'k' ? [0, wy(i), D * 0.46 + 0.1] : which === 'v' ? [0, wy(i) + 0.55, D * 0.46 + 0.1] : [0, wy(i), D * 0.6 + 0.1]; }
    function needle(v) { gauge.needle.pos = [0.4, (GY0 + GY1) / 2 + v * (GY1 - GY0) / 2 * 0.86, 0.22]; }

    /* ---------- timeline: the voice is the spine ---------- */
    var tl = XP.timeline({ voice: (XP.VOICE || {})[ID], reset: function (S, t) {
      pkI = 0;
      tok.forEach(function (k) {
        [k.raw, k.q, k.k, k.v].forEach(function (cs) { cs.forEach(function (c) { c.show = false; c.scale = 1; c.glow = 0; }); });
        [k.bar].concat(k.head, k.grid).forEach(function (b) { b.show = false; b.glow = 0; });
      });
      seg.concat(hout).forEach(function (s) { s.show = false; s.glow = 0; });
      pk.forEach(function (p) { p.show = false; });
      [gauge.track, gauge.neg, gauge.pos, gauge.mid, gauge.needle].forEach(function (g) { g.show = false; g.scale = 1; });
      needle(0);
      S.state = { line: '', labels: [], v: 0 };
      cameraAt(t, S.cam);
    } });
    var cue = tl.cue, act = {};

    // I · the sentence: six vectors; I would make the review negative
    act.words = tl.cursor;
    tl.beat('Six words, six vectors', '').wait(0.5);
    tl.say('a1', 'This restaurant was not too terrible. Six words, and each one is a vector: a short column of numbers.');
    tl.say('a2', "I'm the last one, terrible. Read on my own, I'd tell the classifier this review is bad.");
    tl.say('a3', 'But the words in front of me change what I mean. Not too terrible is almost a compliment.', { gap: 0.6 });
    var cA = { w: W.map(function (w) { return cue('a1', w); }), me: cue('a2', 'terrible'), cls: cue('a2', 'classifier'), bad: cue('a2', 'bad'), not: cue('a3', 'Not'), too: cue('a3', 'too') };
    tl.play(tl.cursor - act.words, function (p, S, t) {
      tok.forEach(function (k, i) {
        var f = sg(t, cA.w[i] - 0.1, 0.9), me = i === ME && t >= cA.me;
        col(k.raw, f, me ? 'subject' : 'steel', me ? 0.5 : 0);
        var bump = i === NOT ? sg(t, cA.not, 0.6) : i === TOO ? sg(t, cA.too, 0.6) : 0;
        k.raw.forEach(function (c, n) { var m = hv(i, n, 1) * (1 + 0.25 * Math.sin(Math.PI * bump)); if (c.show) c.scale = [m * c.scale, m * c.scale, c.scale]; });
      });
      var g = sg(t, cA.cls - 0.2, 0.8);
      [gauge.track, gauge.neg, gauge.pos, gauge.mid, gauge.needle].forEach(function (x) { x.show = g > 0; x.scale = E.back(g); });
      S.state.v = VERDICT.alone * E.inOut(sg(t, cA.bad, 1.0));
      S.state.line = t < cA.cls ? 'x(word) ∈ ℝᵈ · six words' : 'classifier on terrible alone → ' + (S.state.v < -0.3 ? 'negative' : '…');
    }, { at: act.words, ease: E.linear });

    // II · bare self-attention (§ 2): dot products find look-alikes, not modifiers
    act.bare = tl.cursor;
    tl.beat('Who looks like me?', '');
    tl.say('b1', 'So I compare myself with every word. The simplest way is a dot product between my vector and theirs.');
    tl.say('b2', 'A softmax turns those scores into weights that add up to one.');
    tl.say('b3', 'And look who I listen to: myself, was, and restaurant. Words that look like me, not words that change me.');
    tl.say('b4', "Plain dot products can't learn which words matter. So attention adds three learned projections.", { gap: 0.8 });
    var cB = { cmp: cue('b1', 'compare'), soft: cue('b2', 'softmax'), look: cue('b3', 'look'), change: cue('b3', 'change'), three: cue('b4', 'three') };
    tl.play(tl.cursor - act.bare, function (p, S, t) {
      var mw = sg(t, cB.soft, 1.0), gone = sg(t, cB.three, 0.8), top = [ME, 2, 1];
      tok.forEach(function (k, i) {
        var arrive = cB.cmp + 0.2 + i * 0.3;
        fly(packet('subject'), topOf(ME), topOf(i), sg(t, arrive - 0.8, 0.8), 1.6);
        var h = E.back(sg(t, arrive, 0.5)) * XP.lerp(bare[i] * 3, bareW[i] * 12, E.inOut(mw)) * (1 - E.inOut(gone));
        var hot = t >= cB.look && t < cB.three && top.indexOf(i) >= 0;
        bar(k.bar, h, hot ? 'gold' : 'ink', hot ? 0.5 : 0);
        if (t >= cB.change && t < cB.three && (i === NOT || i === TOO)) k.raw.forEach(function (c) { c.mat = 'memx'; });
      });
      S.state.line = t < cB.soft ? 'score(terrible, j) = x·xⱼ / √d' : 'weights: not ' + pct(bareW[NOT]) + ' · too ' + pct(bareW[TOO]) + ' · terrible ' + pct(bareW[ME]);
    }, { at: act.bare, ease: E.linear });

    // III · queries, keys, values (§ 5)
    act.qkv = tl.cursor;
    tl.beat('Query, key, value', '');
    tl.say('c1', 'Every word now plays three roles. A query: the question it asks. A key: what it can answer. And a value: what it passes on.');
    tl.say('c2', 'My query asks: who changes my meaning? And the keys of not and too answer loudly.', { gap: 0.5 });
    var cC = { q: cue('c1', 'query'), k: cue('c1', 'key'), v: cue('c1', 'value'), asks: cue('c2', 'asks'), not: cue('c2', 'not'), too: cue('c2', 'too') };
    tl.play(tl.cursor - act.qkv, function (p, S, t) {
      var fade = sg(t, cC.q - 0.2, 0.8);
      tok.forEach(function (k, i) {
        if (fade > 0) k.raw.forEach(function (c) { var s = 1 - E.inOut(fade); c.scale = s; c.show = s > 0.02; });
        col(k.q, sg(t, cC.q, 0.9), i === ME ? 'subject' : 'gold', i === ME ? 0.5 : 0);
        col(k.k, sg(t, cC.k, 0.9), 'mem');
        col(k.v, sg(t, cC.v, 0.9), 'work');
        [[k.q, 2], [k.k, 3], [k.v, 4]].forEach(function (z) { z[0].forEach(function (c, n) { if (c.show) { var m = hv(i, n, z[1]); c.scale = [m * c.scale, m * c.scale, c.scale]; } }); });
        var arrive = cC.asks + 0.3 + i * 0.22;
        fly(packet('subject'), topOf(ME, 'q'), topOf(i, 'k'), sg(t, arrive - 0.8, 0.8), 1.4);
        var lit = t < act.heads && ((i === NOT && t >= cC.not) || (i === TOO && t >= cC.too));
        if (lit) k.k.forEach(function (c) { c.mat = 'memx'; c.glow = 0.7; });
        bar(k.bar, E.back(sg(t, arrive, 0.5)) * learned[i] * 1.2, 'ink', 0);
      });
      S.state.line = t < cC.asks ? 'qᵢ = W_q xᵢ · kᵢ = W_k xᵢ · vᵢ = W_v xᵢ' : 'score = q_terrible · kⱼ / √dₖ · not ' + learned[NOT].toFixed(1) + ' · too ' + learned[TOO].toFixed(1);
    }, { at: act.qkv, ease: E.linear });

    // IV · softmax, then the blend of values; the verdict moves
    act.mix = tl.cursor;
    tl.beat('Weigh, then blend', '');
    tl.say('d1', 'Softmax again, and now the weights make sense. Forty-one percent not, twenty-eight percent too.');
    tl.say('d2', 'Each word sends me its value, scaled by its weight, and I add them all up.');
    tl.say('d3', 'This is my new self: still terrible, but softened by not and too. Now the classifier reads the review as fine.', { gap: 1.0 });
    var cD = { soft: cue('d1', 'Softmax'), sends: cue('d2', 'sends'), fine: cue('d3', 'fine'), self: cue('d3', 'self') };
    var order = [0, 1, 2, 3, 4, 5].sort(function (a, b) { return learnedW[b] - learnedW[a]; });
    tl.play(tl.cursor - act.mix, function (p, S, t) {
      var mw = E.inOut(sg(t, cD.soft, 1.0)), z = 0;
      tok.forEach(function (k, i) { bar(k.bar, XP.lerp(learned[i] * 1.2, learnedW[i] * 7, mw), 'ink', (i === NOT || i === TOO) && mw > 0.5 ? 0.35 : 0); });
      order.forEach(function (i, n) {
        var go = cD.sends + 0.2 + n * 0.45, land = sg(t, go + 0.75, 0.35), h = learnedW[i] * 3.6;
        fly(packet('workx'), topOf(i, 'v'), [PX, YOUT, z + h / 2], sg(t, go, 0.8), 1.8, 0.6 + 2.2 * learnedW[i]);
        var s = seg[n]; s.show = land > 0; s.pos = [PX, YOUT, z]; s.scale = [1, 1, Math.max(0.01, h * E.out(land))];
        s.mat = i === NOT || i === TOO ? 'workx' : i === ME ? 'subject' : 'work'; s.glow = t >= cD.self && (i === NOT || i === TOO) ? 0.4 : 0;
        z += h * E.out(land);
      });
      S.state.v = XP.lerp(VERDICT.alone, VERDICT.mixed, E.inOut(sg(t, cD.fine - 0.3, 1.2)));
      S.state.line = 'y_terrible = Σⱼ ωⱼ vⱼ · not ' + pct(learnedW[NOT]) + ' · too ' + pct(learnedW[TOO]) + ' · terrible ' + pct(learnedW[ME]) + ' · restaurant ' + pct(learnedW[RES]);
    }, { at: act.mix, ease: E.linear });

    // V · several heads (§ 6), concatenated and mixed by W_O
    act.heads = tl.cursor;
    tl.beat('Many heads, many questions', '');
    tl.say('e1', "One question isn't enough. So each layer asks several at once, each with its own projections. We call them heads.");
    tl.say('e2', 'One head looks for negation, and finds not. Another looks for degree, and finds too. A third asks what I describe, and finds restaurant.');
    tl.say('e3', 'Their answers are glued together, and one more matrix mixes them into a single output.', { gap: 1.0 });
    var cE = { sev: cue('e1', 'several'), hit: [cue('e2', 'negation'), cue('e2', 'degree'), cue('e2', 'describe')], glue: cue('e3', 'glued'), single: cue('e3', 'single') };
    var HIT = [NOT, TOO, RES];
    tl.play(tl.cursor - act.heads, function (p, S, t) {
      var g = sg(t, cE.sev - 0.2, 1.2), merge = E.inOut(sg(t, cE.glue, 1.4)), one = E.inOut(sg(t, cE.single, 0.9));
      seg.forEach(function (s) { var sc = s.scale; s.scale = [sc[0] * (1 - g), sc[1] * (1 - g), sc[2]]; if (g >= 1) s.show = false; });
      tok.forEach(function (k, i) {
        k.bar.show = false;
        HEADS.forEach(function (hd, h) {
          var rise = h === 0 ? 1 : E.back(sg(t, cE.sev + h * 0.35, 0.7)), hot = t >= cE.hit[h] && i === HIT[h];
          var w0 = h === 0 ? XP.lerp(learnedW[i], hd.w[i], E.inOut(g)) : hd.w[i];
          bar(k.head[h], rise * w0 * 7 * (1 - E.inOut(sg(t, cE.glue, 0.8))), hot ? 'gold' : 'ink', hot ? 0.6 : 0);
        });
      });
      hout.forEach(function (o, h) {
        var a = sg(t, cE.glue - 0.3, 0.6);
        o.show = a > 0; o.pos = [PX + XP.lerp(h * HX, HX, merge), YOUT, 0];
        o.scale = [1 - 0.55 * one, 1 - 0.55 * one + (h === 1 ? 0.55 * one : 0), 1.1 * E.back(a) * (h === 1 ? 1 + 1.6 * one : 1 - one)];
        o.mat = one > 0.5 ? 'subject' : 'workx'; if (one > 0.98 && h !== 1) o.show = false;
      });
      S.state.line = t < cE.glue ? 'h = 3 heads, each with its own W_q, W_k, W_v' : 'o_terrible = W_O [y¹ ‖ y² ‖ y³]';
      S.state.v = VERDICT.mixed;
    }, { at: act.heads, ease: E.linear });

    // VI · every word at once: the N × N grid is softmax(QKᵀ/√dₖ)
    act.grid = tl.cursor;
    tl.beat('Everyone at once', '');
    tl.say('f1', "And I'm not special. Every word asks its own question, all at the same time.");
    tl.say('f2', 'Six queries against six keys make a six by six grid of weights. That grid is one matrix multiply, Q times K transposed, then a softmax on each row.');
    tl.say('f3', 'So attention is how a word borrows meaning from its neighbours. Ask a question, weigh every answer, and blend what you hear.', { gap: 2.4 });
    var cF = { every: cue('f1', 'Every'), grid: cue('f2', 'grid'), mult: cue('f2', 'multiply'), ask: cue('f3', 'Ask'), weigh: cue('f3', 'weigh'), blend: cue('f3', 'blend') };
    tl.play(tl.cursor - act.grid, function (p, S, t) {
      var wave = t - cF.mult;
      tok.forEach(function (k, j) {
        k.head.forEach(function (b) { b.show = false; });
        ROWS.forEach(function (r, n) {
          var rise = n === 0 ? 1 : E.back(sg(t, cF.every + 0.2 + n * 0.35, 0.7));
          var pulse = XP.seg(wave, (n + j) * 0.08, (n + j) * 0.08 + 0.6), w = GRID[n][j];
          var mine = n === 0, hot = mine && t >= cF.weigh;
          bar(k.grid[n], rise * w * 7 * (1 + 0.25 * Math.sin(Math.PI * pulse)), hot ? 'gold' : (mine ? 'ink' : 'steel'), hot ? 0.45 : 0);
        });
        k.q.forEach(function (c) { c.glow = j === ME && t >= cF.ask && t < cF.weigh + 0.3 ? 0.8 : (t >= cF.every && t < cF.grid ? 0.35 : 0); });
      });
      hout[1].glow = t >= cF.blend ? 0.6 : 0;
      S.state.line = t < cF.grid ? 'every query, every key' : 'A = softmax(QKᵀ / √dₖ) · 6 × 6 · each row sums to 1';
      S.state.v = VERDICT.mixed;
    }, { at: act.grid, ease: E.linear });

    /* ---------- camera, from the times the voice produced ---------- */
    var base = XP.camera({ W: 760, H: 470, az: 12, el: 32 }), ext = [];
    [FX0, PX + 1.2].forEach(function (x) { [FY0 + 0.6, FY1 - 0.4].forEach(function (y) { [0, D * 0.6 + 0.3].forEach(function (z) { ext.push([x, y, z]); }); }); });
    XP.fit(base, ext, 14);
    var Z0 = base.zoom, C0 = base.center, TOT = tl.duration;
    var F_GRID = [PX + 2.2 * HX, (FY0 + FY1) / 2, 0.6], CR = [-0.4, C0[1] + 0.7, 1.9];   // CR: the row, framed close
    var KEYS = [ // t, az, el, zoom ×, center
      [0, 8, 26, 1.06, CR], [act.bare, 11, 30, 1.05, CR], [act.qkv, 14, 31, 1.06, CR], [act.mix, 12, 31, 1.05, CR], [cD.fine + 1, 14, 33, 1.04, CR],
      [act.heads + 1.5, 12, 34, 0.98, XP.v.lerp(CR, F_GRID, 0.35)], [act.grid, 12, 36, 0.92, XP.v.lerp(CR, F_GRID, 0.5)], [act.grid + 1.5, 16, 44, 0.74, F_GRID], [TOT - 3, 12, 40, 0.76, F_GRID], [TOT, 10, 36, 0.8, F_GRID]];
    function cameraAt(t, cam) {
      var a = KEYS[0], b = KEYS[KEYS.length - 1];
      for (var n = 1; n < KEYS.length; n++) if (t <= KEYS[n][0]) { a = KEYS[n - 1]; b = KEYS[n]; break; }
      var f = E.inOut(XP.seg(t, a[0], b[0])), L = XP.lerp;
      cam.az = L(a[1], b[1], f); cam.el = L(a[2], b[2], f); cam.zoom = Z0 * L(a[3], b[3], f); cam.center = XP.v.lerp(a[4], b[4], f);
    }
    // the needle follows the verdict every frame (after all acts ran)
    tl.play(TOT, function (p, S) { needle(S.state.v); }, { at: 0, ease: E.linear });

    /* ---------- styles: calm ink, with pencil (a toned-down sketch) for the naive first try ---------- */
    var SCHED = [[0, 'ink'], [act.bare, 'pencil'], [act.qkv, 'ink']];
    function styleAt(t) {
      var i = 0; for (var n = 0; n < SCHED.length; n++) if (t >= SCHED[n][0]) i = n;
      var prev = i > 0 ? SCHED[i - 1][1] : SCHED[0][1], cur = SCHED[i][1], w = i > 0 ? XP.seg(t, SCHED[i][0], SCHED[i][0] + 0.9) : 1;
      return { a: prev, b: cur, mix: E.inOut(w), wipe: 0.35 };
    }
    [cA.bad + 1.2, cB.change + 0.8, cC.too + 0.8, cD.fine + 1, cE.hit[2] + 1, cF.weigh + 0.5].forEach(function (s, n) { if (tl.beats[n]) tl.beats[n].still = s; });

    /* ---------- labels: every mark is named ---------- */
    function labels(t, S) {
      var L = [];
      tok.forEach(function (k, i) {
        if (!k.raw[0].show && !k.q[0].show) return;
        L.push({ p: [0.9, wy(i), -0.35], text: W[i], short: i === RES ? 'rest.' : null, cls: 'word' + (i === ME ? ' me' : (k.raw[0].mat === 'memx' ? ' hot' : '')) });
        var b = k.bar.show ? k.bar : null;
        if (b && b.scale[2] > 0.3) {
          var val = t < cB.soft && t < act.qkv ? bare[i].toFixed(2) : t >= act.bare && t < act.qkv ? pct(bareW[i]) : t < cD.soft ? learned[i].toFixed(1) : pct(learnedW[i]);
          L.push({ p: [PX, wy(i), b.scale[2] + 0.4], text: val, cls: b.mat === 'gold' ? 'hot' : '' });
        }
        if (k.head[0].show && t < cE.glue) HEADS.forEach(function (hd, h) { if (i === HIT[h] && t >= cE.hit[h]) L.push({ p: [PX + h * HX, wy(i), k.head[h].scale[2] + 0.4], text: pct(hd.w[i]), cls: 'hot' }); });
      });
      if (tok[0].q[0].show && t < act.mix) { L.push({ p: [0, wy(0) - 0.55, D * 0.46 + 0.55], text: 'q', cls: 'tag' }); L.push({ p: [0, wy(0), D * 0.46 + 0.55], text: 'k', cls: 'tag' }); L.push({ p: [0, wy(0) + 0.55, D * 0.46 + 0.55], text: 'v', cls: 'tag' }); }
      if (seg[0].show) L.push({ p: [PX, YOUT, -0.35], text: 'y(terrible)', short: 'y', cls: 'me' });
      if (tok[0].head[0].show && t < cE.glue) HEADS.forEach(function (hd, h) { L.push({ p: [PX + h * HX, wy(ME) + 0.75, 0.1], text: 'head ' + (h + 1) + ': ' + hd.name, cls: 'tag', align: 'l', wide: true }); });
      if (hout[1].show) L.push({ p: [PX + HX, YOUT, -0.35], text: t >= cE.single ? 'output' : 'concat', cls: 'me' });
      if (tok[0].grid[1].show) ROWS.forEach(function (r, n) { L.push({ p: [PX + n * HX, -1.6, 0], text: 'q: ' + W[r], cls: 'tag' + (n === 0 ? ' me' : ''), align: 'r', wide: true }); });
      if (gauge.track.show && t < act.heads) { L.push({ p: [0.4, GY0, -0.45], text: 'negative', short: '−', cls: 'dim' }); L.push({ p: [0.4, GY1, -0.45], text: 'positive', short: '+', cls: 'dim' }); }
      return L;
    }

    if (opt.bare) return { scene: S, tl: tl, styleAt: styleAt };
    return XP.player(host, {
      id: ID, fig: opt.fig || 'Film 10.1', title: 'One word, one attention layer', scene: S, tl: tl, styleAt: styleAt, labels: labels,
      stillAt: cD.fine + 1, posterAt: cD.fine + 1,
      label: 'Six word vectors in a row, This restaurant was not too terrible. In front of them, bars show how much the word terrible attends to each word; its new vector is built from the others’ values, and a gauge shows the classifier’s verdict.',
      readout: function (t, S) { return S.state.line; },
      keys: [['subject', 'me: terrible, my query and my output'], ['steel', 'a word vector x (later: other words\u2019 weights)'], ['gold', 'a query q'], ['mempale', 'a key k'], ['workpale', 'a value v'], ['ink', 'an attention score or weight']],
      caption: opt.caption || '', gl: opt.gl
    });
  };
})();
