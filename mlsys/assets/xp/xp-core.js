/* xp-core.js — the explainer kit's core: one orthographic camera, solid meshes, and a scene that
   both renderers read (xp-svg.js draws it as crisp SVG, xp-gl.js draws it with style shaders).
   World units: x and y on the floor, z up. Exposes window.XP. No dependencies, no build step. */
(function () {
  'use strict';
  var XP = window.XP = window.XP || {};

  /* ---------- vectors ---------- */
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function unit(a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  XP.v = { sub: sub, dot: dot, unit: unit, lerp: function (a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; } };

  /* ---------- camera ----------
     az: the floor direction toward the viewer is [cos az, sin az]; el: degrees above the floor.
     right = (-sin az, cos az, 0); down (screen y) = (cos az·sin el, sin az·sin el, -cos el);
     toward viewer = (cos az·cos el, sin az·cos el, sin el). Larger depth = nearer.            */
  XP.camera = function (o) {
    o = o || {};
    return { az: o.az == null ? 33 : o.az, el: o.el == null ? 30 : o.el, zoom: o.zoom || 1, center: o.center || [0, 0, 0], W: o.W || 760, H: o.H || 440 };
  };
  XP.basis = function (C) {
    var a = C.az * Math.PI / 180, e = C.el * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), ce = Math.cos(e), se = Math.sin(e);
    return { r: [-sa, ca, 0], dn: [ca * se, sa * se, -ce], d: [ca * ce, sa * ce, se] };
  };
  // world point → viewBox point (px). B is an optional precomputed basis.
  XP.project = function (C, p, B) {
    B = B || XP.basis(C);
    var q = sub(p, C.center);
    return [C.W / 2 + dot(B.r, q) * C.zoom, C.H / 2 + dot(B.dn, q) * C.zoom];
  };
  XP.depth = function (C, p, B) { B = B || XP.basis(C); return dot(B.d, p); };
  // fit a list of world points into the viewBox with a pad (px); sets zoom and center
  XP.fit = function (C, pts, pad) {
    var B = XP.basis(C), x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    pts.forEach(function (p) { var x = dot(B.r, p), y = dot(B.dn, p); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
    pad = pad == null ? 20 : pad;
    C.zoom = Math.min((C.W - 2 * pad) / (x1 - x0 || 1), (C.H - 2 * pad) / (y1 - y0 || 1));
    // the center is any world point whose screen position is the box middle: solve along r and dn
    var mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    C.center = [B.r[0] * mx + B.dn[0] * my, B.r[1] * mx + B.dn[1] * my, B.r[2] * mx + B.dn[2] * my];
    return C;
  };
  // the light: from the left, a little behind and above, so the two visible sides read differently
  XP.LIGHT = unit([-0.35, 0.55, 0.9]);

  /* ---------- meshes: convex solids as faces with outward normals, in local coordinates ---------- */
  function mk(faces, round) {
    var all = [], c = [0, 0, 0];
    faces.forEach(function (f) { f.forEach(function (q) { all.push(q); c[0] += q[0]; c[1] += q[1]; c[2] += q[2]; }); });
    c = [c[0] / all.length, c[1] / all.length, c[2] / all.length];
    var F = faces.map(function (f) {
      var n = [0, 0, 0];
      for (var i = 0; i < f.length; i++) { var a = f[i], b = f[(i + 1) % f.length]; n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); }
      n = unit(n);
      var fc = f.reduce(function (s, q) { return [s[0] + q[0] / f.length, s[1] + q[1] / f.length, s[2] + q[2] / f.length]; }, [0, 0, 0]);
      if (dot(n, sub(fc, c)) < 0) n = [-n[0], -n[1], -n[2]];
      return { p: f, n: n };
    });
    var lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    all.forEach(function (q) { for (var k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], q[k]); hi[k] = Math.max(hi[k], q[k]); } });
    return { faces: F, verts: all, c: c, lo: lo, hi: hi, round: !!round, id: ++meshId };
  }
  var meshId = 0;
  XP.mesh = {};
  // a ring (floor polygon, counter-clockwise) extruded from z0 by h
  XP.mesh.prism = function (ring, z0, h, round) {
    var n = ring.length, faces = [], top = [], i;
    for (i = 0; i < n; i++) {
      var a = ring[i], b = ring[(i + 1) % n];
      faces.push([[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z0 + h], [a[0], a[1], z0 + h]]);
      top.push([a[0], a[1], z0 + h]);
    }
    faces.push(top);
    faces.push(ring.map(function (p) { return [p[0], p[1], z0]; }).reverse());
    return mk(faces, round);
  };
  // rounded rectangle centred on the origin
  XP.ring = function (w, d, r, steps) {
    steps = steps || 4; r = Math.min(r || 0, w / 2, d / 2);
    var out = [], hw = w / 2, hd = d / 2;
    [[hw - r, -hd + r, -90], [hw - r, hd - r, 0], [-hw + r, hd - r, 90], [-hw + r, -hd + r, 180]].forEach(function (c) {
      if (r <= 0) { out.push([c[0] + (c[2] === -90 || c[2] === 0 ? r : -r), c[1]]); return; }
      for (var i = 0; i <= steps; i++) { var t = (c[2] + 90 * i / steps) * Math.PI / 180; out.push([c[0] + r * Math.cos(t), c[1] + r * Math.sin(t)]); }
    });
    if (r <= 0) out = [[hw, -hd], [hw, hd], [-hw, hd], [-hw, -hd]];
    return out;
  };
  XP.circle = function (r, steps) {
    var out = []; steps = steps || 28;
    for (var i = 0; i < steps; i++) { var t = 2 * Math.PI * i / steps; out.push([r * Math.cos(t), r * Math.sin(t)]); }
    return out;
  };
  // a box w × d × h standing on the origin (centred in x and y, from z = 0 up)
  XP.mesh.box = function (w, d, h) { return XP.mesh.prism(XP.ring(w, d, 0), 0, h); };
  XP.mesh.slab = function (w, d, h, r, steps) { return XP.mesh.prism(XP.ring(w, d, r, steps), 0, h, r > 0); };
  XP.mesh.cyl = function (r, h, steps) { return XP.mesh.prism(XP.circle(r, steps), 0, h, true); };
  XP.mesh.frustum = function (r0, r1, h, steps) {
    steps = steps || 28;
    var a = XP.circle(r0, steps), b = XP.circle(r1, steps), faces = [];
    for (var i = 0; i < steps; i++) { var j = (i + 1) % steps; faces.push([[a[i][0], a[i][1], 0], [a[j][0], a[j][1], 0], [b[j][0], b[j][1], h], [b[i][0], b[i][1], h]]); }
    faces.push(b.map(function (p) { return [p[0], p[1], h]; }));
    faces.push(a.map(function (p) { return [p[0], p[1], 0]; }).reverse());
    return mk(faces, true);
  };
  // a cylinder lying along x or y, centred on the origin
  XP.mesh.drum = function (axis, r, len, steps) {
    steps = steps || 28;
    var A = [], Bv = [], faces = [], i;
    for (i = 0; i < steps; i++) {
      var t = 2 * Math.PI * i / steps, u = r * Math.cos(t), v = r * Math.sin(t);
      A.push(axis === 'x' ? [-len / 2, u, v] : [u, -len / 2, v]);
      Bv.push(axis === 'x' ? [len / 2, u, v] : [u, len / 2, v]);
    }
    for (i = 0; i < steps; i++) { var j = (i + 1) % steps; faces.push([A[i], A[j], Bv[j], Bv[i]]); }
    faces.push(Bv.slice()); faces.push(A.slice().reverse());
    return mk(faces, true);
  };
  // any convex six-sided solid from bottom and top quads (same winding)
  XP.mesh.hexa = function (b, t) {
    var faces = [b.slice().reverse(), t.slice()];
    for (var i = 0; i < 4; i++) { var j = (i + 1) % 4; faces.push([b[i], b[j], t[j], t[i]]); }
    return mk(faces);
  };
  XP.mesh.fromFaces = mk;

  /* ---------- materials: semantic names, coloured by the renderer's style or the site palette ----------
     paper: neutral bodies · steel: structure · subject: the one thing to watch (lit) ·
     mem / memx: memory, bytes, cost (pale / strong) · work / workx: compute, useful output ·
     ink: dark details · gold: a second highlight, for a reveal or a reward                    */
  XP.MATS = ['none', 'paper', 'steel', 'subject', 'mem', 'memx', 'work', 'workx', 'ink', 'gold'];
  XP.matIndex = function (m) { var i = XP.MATS.indexOf(m); return i < 0 ? 1 : i; };

  /* ---------- scene ----------
     A part: { mesh, mat, pos [x,y,z], scale [sx,sy,sz] (or a number), show (bool), glow 0..1, layer, id }.
     Renderers read parts every frame; animations write pos / scale / show / glow / mat.     */
  XP.scene = function (o) {
    o = o || {};
    var S = { parts: [], cam: XP.camera(o.camera), bg: o.bg || null, rev: 0 };
    S.add = function (mesh, p) {
      p = p || {};
      var part = { mesh: mesh, mat: p.mat || 'paper', pos: p.pos || [0, 0, 0], scale: p.scale == null ? [1, 1, 1] : p.scale, show: p.show !== false,
        glow: p.glow || 0, layer: p.layer || 0, id: p.id || ('p' + S.parts.length), tone: p.tone || 'mid', tag: p.tag || null };
      S.parts.push(part);
      return part;
    };
    S.find = function (tag) { return S.parts.filter(function (p) { return p.tag === tag; }); };
    return S;
  };
  // world-space faces of a part (scale, then translate); normals follow the inverse scale
  XP.partFaces = function (part) {
    var s = typeof part.scale === 'number' ? [part.scale, part.scale, part.scale] : part.scale, t = part.pos;
    return part.mesh.faces.map(function (f) {
      return { p: f.p.map(function (q) { return [q[0] * s[0] + t[0], q[1] * s[1] + t[1], q[2] * s[2] + t[2]]; }),
               n: unit([f.n[0] / (s[0] || 1e-6), f.n[1] / (s[1] || 1e-6), f.n[2] / (s[2] || 1e-6)]) };
    });
  };
  XP.partCenter = function (part) {
    var s = typeof part.scale === 'number' ? [part.scale, part.scale, part.scale] : part.scale, c = part.mesh.c, t = part.pos;
    return [c[0] * s[0] + t[0], c[1] * s[1] + t[1], c[2] * s[2] + t[2]];
  };
  // four side tones by facing plus a lighter top: 'tp' or 's0'..'s3' (s0 darkest)
  XP.toneOf = function (n) {
    if (n[2] > 0.72) return 'tp';
    var l = dot(n, XP.LIGHT);
    return 's' + Math.max(0, Math.min(3, Math.floor((l + 0.75) / 1.5 * 4)));
  };

  /* ---------- easing and small helpers for animations ---------- */
  XP.ease = {
    linear: function (x) { return x; },
    smooth: function (x) { return x * x * (3 - 2 * x); },
    inOut: function (x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; },
    out: function (x) { return 1 - Math.pow(1 - x, 3); },
    in: function (x) { return x * x * x; },
    back: function (x) { var c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); },
    spring: function (x) { return 1 - Math.cos(x * Math.PI * 4.5) * Math.exp(-x * 6); }
  };
  XP.clamp = function (x, a, b) { return Math.max(a == null ? 0 : a, Math.min(b == null ? 1 : b, x)); };
  XP.seg = function (t, a, b) { return XP.clamp((t - a) / (b - a)); };          // 0..1 progress of t through [a, b]
  XP.lerp = function (a, b, t) { return a + (b - a) * t; };
  XP.still = function () { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); };
  XP.hash = function (n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
})();
