/* xp-canvas.js — the flat renderer: the SVG renderer's drawing, done straight onto a 2D canvas.
   The player's fallback when WebGL is missing or the viewer picks it (xp-time.js uses it when this file is loaded;
   without it, the fallback is SVG). Same faces, tones, creases, hull outline, glow and painter's order as XP.partSVG,
   but nothing is kept: no markup, no DOM nodes, no style or layout per shape. Each frame clears and draws again.
   SVG stays the renderer for still figures (crisp at any zoom, printable); for anything that moves this is
   3-17x cheaper (references/perf-log.md, 2026-10-13/14).
   Stroke widths match the SVG's non-scaling strokes (CSS px), colours come from the same CSS variables.
   It caches what rarely changes: per mesh, its unique corners and which faces share each edge;
   per part, its normals and tones (until its scale changes) and its outline corners (until the camera
   turns or the scale changes). A frame projects corners, picks visible faces and creases, and draws.
   Options: merge (default true: fewer, bigger draw calls), software (a CPU canvas: an experiment, off; faster than
   Firefox's accelerated canvas on light frames, 2x slower on heavy ones with glow on the work PC).
   Usage: var R = XP.canvasRenderer(canvas, S, { pixelRatio: 2 }); R.render(); R.setScene(S2); R.setScale(1.5);   */
(function () {
  'use strict';
  var XP = window.XP;
  var LINE_OL = { steel: 1, subject: 1, mem: 1, memx: 1, work: 1, workx: 1, ink: 1, gold: 1 };   // materials whose outline uses --xp-<m>-line
  var LINE_CR = { subject: 1, mem: 1, memx: 1, work: 1, workx: 1, gold: 1 };                    // and whose creases do
  var GLOW = { mem: '#B83D2D', memx: '#B83D2D', work: '#1F5A49', workx: '#1F5A49', gold: '#B8862D' };
  var TONES = { tp: 'top', s0: 's0', s1: 's1', s2: 's2', s3: 's3' };

  // per mesh: unique corners, faces as corner indices, and the faces around each edge shared by two or more
  var topo = {};
  function topoOf(mesh) {
    var T = topo[mesh.id]; if (T) return T;
    var idx = {}, v = [], faces = [], edges = {}, list = [];
    function vi(q) { var k = q[0] + ',' + q[1] + ',' + q[2]; if (idx[k] == null) { idx[k] = v.length / 3; v.push(q[0], q[1], q[2]); } return idx[k]; }
    mesh.faces.forEach(function (f, fi) {
      var c = f.p.map(vi); faces.push({ c: c, n: f.n });
      for (var j = 0; j < c.length; j++) {
        var a = c[j], b = c[(j + 1) % c.length], k = a < b ? a + '|' + b : b + '|' + a;
        if (!edges[k]) { edges[k] = { a: a, b: b, f: [] }; list.push(edges[k]); }
        edges[k].f.push(fi);
      }
    });
    return (topo[mesh.id] = { v: new Float64Array(v), n: v.length / 3, faces: faces, edges: list.filter(function (e) { return e.f.length > 1; }) });
  }

  XP.canvasRenderer = function (canvas, S, o) {
    o = o || {};
    // o.software: willReadFrequently asks the browser for a CPU canvas inside the page, with no GPU-process replay
    // merge (default): one fill per tone per part instead of a fill and a seam stroke per face, 38% fewer draw calls;
    // o.merge: false draws per face (the look is the same to the eye; ~2-9% of pixels shift on anti-aliased edges)
    var g = canvas.getContext('2d', { alpha: false, willReadFrequently: !!o.software }), ratio = o.pixelRatio || 1, pal = {}, css = null, merge = o.merge !== false;
    var P = new Float64Array(2 * 256);                     // projected corners of the part being drawn (grown on demand)
    var fill = null, stroke = null, lw = -1;               // canvas state, set only when it changes: colour strings are parsed on every set
    function cv(n, d) { css = css || getComputedStyle(canvas); return css.getPropertyValue(n).trim() || d; }   // --xp-* inherit from .xp or :root
    function col(key, n, d) { return pal[key] || (pal[key] = cv(n, d)); }
    function face(m, t) { return col(m + t, '--xp-' + m + '-' + TONES[t], '#E0DCD0'); }
    function olCol(p) { return LINE_OL[p.mat] ? col(p.mat + '-line', '--xp-' + p.mat + '-line', '#4A4B44') : col(p.tone || 'mid', '--xp-' + (p.tone || 'mid'), '#4A4B44'); }
    function crCol(p) { return LINE_CR[p.mat] ? col(p.mat + '-line', '--xp-' + p.mat + '-line', '#4A4B44') : col('faint', '--xp-faint', '#BDB7A9'); }
    function glowCol(p) { return GLOW[p.mat] || col('glow', '--xp-glow', '#1546B8'); }
    function setFill(c) { if (c !== fill) g.fillStyle = fill = c; }
    function setStroke(c) { if (c !== stroke) g.strokeStyle = stroke = c; }
    function setLW(w) { if (w !== lw) g.lineWidth = lw = w; }
    function resize() {
      var w = canvas.clientWidth || S.cam.W, h = canvas.clientHeight || S.cam.H;
      canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio); fill = stroke = null; lw = -1;   // resizing resets the context
    }
    // per part, until its scale, rotation (or mesh) changes: world normals and tones
    function shapeOf(p, T, s) {
      var c = p._cv, rot = p.rot || 0;
      if (c && c.T === T && c.s0 === s[0] && c.s1 === s[1] && c.s2 === s[2] && c.rot === rot) return c;
      var F = T.faces.length, n = new Float64Array(3 * F), tone = [], cs = XP.rotOf(p);
      for (var i = 0; i < F; i++) {
        var m = T.faces[i].n, x = m[0] / (s[0] || 1e-6), y = m[1] / (s[1] || 1e-6), z = m[2] / (s[2] || 1e-6), l = Math.hypot(x, y, z) || 1;
        n[3 * i] = (cs[0] * x - cs[1] * y) / l; n[3 * i + 1] = (cs[1] * x + cs[0] * y) / l; n[3 * i + 2] = z / l;
        tone.push(XP.toneOf([n[3 * i], n[3 * i + 1], n[3 * i + 2]]));
      }
      return (p._cv = { T: T, s0: s[0], s1: s[1], s2: s[2], rot: rot, cs: cs, n: n, tone: tone, lim: p.mesh.round ? 0.5 : 0.8, vis: new Uint8Array(F), hull: null, az: 0, el: 0 });
    }
    // the outline: convex hull of all projected corners. Panning, zooming and moving keep the same corners; turning the
    // camera or the part doesn't (a new rot makes a new shapeOf, so a fresh hull).
    function hullOf(c, T, az, el) {
      if (c.hull && c.az === az && c.el === el) return c.hull;
      var ids = [], i;
      for (i = 0; i < T.n; i++) ids.push(i);
      c.az = az; c.el = el;
      if (ids.length < 3) return (c.hull = ids);
      ids.sort(function (a, b) { return P[2 * a] - P[2 * b] || P[2 * a + 1] - P[2 * b + 1]; });
      function cr(o, a, b) { return (P[2 * a] - P[2 * o]) * (P[2 * b + 1] - P[2 * o + 1]) - (P[2 * a + 1] - P[2 * o + 1]) * (P[2 * b] - P[2 * o]); }
      var lo = [], up = [];
      for (i = 0; i < ids.length; i++) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], ids[i]) <= 0) lo.pop(); lo.push(ids[i]); }
      for (i = ids.length - 1; i >= 0; i--) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], ids[i]) <= 0) up.pop(); up.push(ids[i]); }
      up.pop(); lo.pop();
      return (c.hull = lo.concat(up));
    }
    function sub(ix) {                                     // one closed subpath of the current path
      g.moveTo(P[2 * ix[0]], P[2 * ix[0] + 1]);
      for (var i = 1; i < ix.length; i++) g.lineTo(P[2 * ix[i]], P[2 * ix[i] + 1]);
      g.closePath();
    }
    function ring(ix) {
      g.beginPath(); g.moveTo(P[2 * ix[0]], P[2 * ix[0] + 1]);
      for (var i = 1; i < ix.length; i++) g.lineTo(P[2 * ix[i]], P[2 * ix[i] + 1]);
      g.closePath();
    }
    var live = [];
    function render() {
      if (canvas.clientWidth && Math.round(canvas.clientWidth * ratio) !== canvas.width) resize();
      var C = S.cam, B = XP.basis(C), k = canvas.width / C.W, px = canvas.width / (canvas.clientWidth || C.W) / k;   // px: one CSS px in viewBox units
      var r = B.r, dn = B.dn, d = B.d, z = C.zoom, cx = C.center[0], cy = C.center[1], cz = C.center[2], W2 = C.W / 2, H2 = C.H / 2;
      g.setTransform(1, 0, 0, 1, 0, 0); setFill(col('card', '--xp-card', '#FAF7EF')); g.fillRect(0, 0, canvas.width, canvas.height);
      g.setTransform(k, 0, 0, k, 0, 0); g.lineJoin = 'round'; g.lineCap = 'round';
      live.length = 0;
      var parts = S.parts, i, j, p, s;
      for (i = 0; i < parts.length; i++) {
        p = parts[i]; s = typeof p.scale === 'number' ? [p.scale, p.scale, p.scale] : p.scale;
        if (!(p.show && p.mat !== 'none' && s[0] > 1e-4 && s[1] > 1e-4 && s[2] > 1e-4)) continue;
        var mc = p.rot ? XP.partCenter(p) : null;
        if (!mc) { mc = p.mesh.c; mc = [mc[0] * s[0] + p.pos[0], mc[1] * s[1] + p.pos[1], mc[2] * s[2] + p.pos[2]]; }
        p._cvs = s; p._cvd = (p.layer || 0) * 1e6 + d[0] * mc[0] + d[1] * mc[1] + d[2] * mc[2];
        live.push(p);
      }
      live.sort(function (a, b) { return a._cvd - b._cvd; });
      for (i = 0; i < live.length; i++) {
        p = live[i]; s = p._cvs;
        var T = topoOf(p.mesh), c = shapeOf(p, T, s), V = T.v, t = p.pos, glow = p.glow > 0.02;
        if (P.length < 2 * T.n) P = new Float64Array(4 * T.n);
        var rc = c.cs[0], rs = c.cs[1];
        for (j = 0; j < T.n; j++) {
          var lx = V[3 * j] * s[0], ly = V[3 * j + 1] * s[1];
          var x = rc * lx - rs * ly + t[0] - cx, y = rs * lx + rc * ly + t[1] - cy, w = V[3 * j + 2] * s[2] + t[2] - cz;
          P[2 * j] = W2 + (r[0] * x + r[1] * y + r[2] * w) * z;
          P[2 * j + 1] = H2 + (dn[0] * x + dn[1] * y + dn[2] * w) * z;
        }
        var hull = hullOf(c, T, C.az, C.el);
        if (glow && hull.length > 2) {   // the SVG's drop-shadow: the silhouette's blurred shadow, under the part
          ring(hull); g.shadowColor = glowCol(p); g.shadowBlur = p.glow * 10 * k; setFill(glowCol(p)); g.fill();   // SVG filter px are viewBox units; canvas blur is 2 sigma, drop-shadow 1 sigma
          g.shadowBlur = 0; g.shadowColor = 'transparent';
        }
        setLW(0.35 * px);
        var F = T.faces, n = c.n, vis = c.vis, first = -1;
        for (j = 0; j < F.length; j++) {
          vis[j] = n[3 * j] * d[0] + n[3 * j + 1] * d[1] + n[3 * j + 2] * d[2] > 1e-4 ? 1 : 0;
          if (!vis[j]) continue;
          if (first < 0) first = j;
          if (merge) continue;
          var tc = face(p.mat, c.tone[j]);
          ring(F[j].c); setFill(tc); setStroke(tc); g.fill(); g.stroke();
        }
        if (merge && first >= 0) {
          // every visible face in the first tone, as one path: the other tones land on it, so the seams between
          // faces show a face colour rather than the paper (the job the per-face strokes did). Then one path per other tone.
          var t0 = c.tone[first], done = '|' + t0;
          g.beginPath(); for (j = first; j < F.length; j++) if (vis[j]) sub(F[j].c);
          setFill(face(p.mat, t0)); g.fill();
          for (j = first; j < F.length; j++) {
            var tj = c.tone[j];
            if (!vis[j] || done.indexOf('|' + tj) >= 0) continue;
            done += '|' + tj; g.beginPath();
            for (var m2 = j; m2 < F.length; m2++) if (vis[m2] && c.tone[m2] === tj) sub(F[m2].c);
            setFill(face(p.mat, tj)); g.fill();
          }
        }
        // creases: edges with exactly two visible faces around them that meet at an angle (as the SVG counts)
        var E = T.edges, any = false;
        for (j = 0; j < E.length; j++) {
          var e = E[j], a = -1, b = -1, m;
          for (m = 0; m < e.f.length; m++) if (vis[e.f[m]]) { if (a < 0) a = e.f[m]; else if (b < 0) b = e.f[m]; else { b = -1; break; } }
          if (a < 0 || b < 0 || n[3 * a] * n[3 * b] + n[3 * a + 1] * n[3 * b + 1] + n[3 * a + 2] * n[3 * b + 2] >= c.lim) continue;
          if (!any) { g.beginPath(); any = true; }
          g.moveTo(P[2 * e.a], P[2 * e.a + 1]); g.lineTo(P[2 * e.b], P[2 * e.b + 1]);
        }
        if (any) { setStroke(crCol(p)); setLW(0.45 * px); g.stroke(); }
        if (hull.length > 1) { ring(hull); setStroke(glow && !LINE_OL[p.mat] ? glowCol(p) : olCol(p)); setLW((glow ? 1.2 : 0.7) * px); g.stroke(); }   // as the SVG's CSS cascade: a material line beats the glow colour
      }
    }
    resize();
    return {
      kind: 'canvas2d', render: render, resize: resize, ctx: g,
      setScene: function (s) { S = s; },
      setScale: function (x) { ratio = x; resize(); },
      repalette: function () { pal = {}; css = null; fill = stroke = null; }
    };
  };
})();
