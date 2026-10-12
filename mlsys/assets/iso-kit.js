/* iso-kit.js — a small isometric drawing kit for the course's "anatomy" figures:
   one camera, convex solids shaded in four tones by facing plus a lighter top,
   lines on faces, depth-sorted items, and the card around the figure.
   World units are about 1 px; x and y on the floor, z up. Exposes window.ISO. */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var ISO = {};

  /* ---------- camera ---------- */
  // azimuth a: the floor direction toward the viewer is [cos a, sin a]; elevation e above the floor.
  ISO.camera = function (az, el) {
    var a = az * Math.PI / 180, e = (el == null ? 30 : el) * Math.PI / 180;
    return { ca: Math.cos(a), sa: Math.sin(a), ce: Math.cos(e), se: Math.sin(e), s: 1, ox: 0, oy: 0 };
  };
  function raw(P, q) { return [-q[0] * P.sa + q[1] * P.ca, (q[0] * P.ca + q[1] * P.sa) * P.se - q[2] * P.ce]; }
  ISO.p = function (P, q) { var r = raw(P, q); return [P.ox + r[0] * P.s, P.oy + r[1] * P.s]; };
  ISO.depth = function (P, q) { return (q[0] * P.ca + q[1] * P.sa) * P.ce + q[2] * P.se; };   // larger = nearer
  ISO.view = function (P) { return [P.ca * P.ce, P.sa * P.ce, P.se]; };
  // a screen-space vector for a world offset (for translate transforms)
  ISO.vec = function (P, d) { var r = raw(P, d); return [r[0] * P.s, r[1] * P.s]; };
  ISO.tr = function (P, d) { var v = ISO.vec(P, d); return 'translate(' + v[0].toFixed(2) + ' ' + v[1].toFixed(2) + ')'; };
  ISO.fit = function (P, pts, W, H, pad) {
    var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    pts.forEach(function (q) { var r = raw(P, q); x0 = Math.min(x0, r[0]); x1 = Math.max(x1, r[0]); y0 = Math.min(y0, r[1]); y1 = Math.max(y1, r[1]); });
    P.s = Math.min((W - 2 * pad) / (x1 - x0), (H - 2 * pad) / (y1 - y0));
    P.ox = W / 2 - (x0 + x1) / 2 * P.s; P.oy = H / 2 - (y0 + y1) / 2 * P.s;
    return P;
  };

  /* ---------- small vector helpers ---------- */
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function unit(a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function f1(n) { return Math.round(n * 10) / 10; }
  ISO.d = function (pts, closed) {
    var s = '';
    for (var i = 0; i < pts.length; i++) s += (i ? 'L' : 'M') + f1(pts[i][0]) + ' ' + f1(pts[i][1]);
    return s + (closed ? 'Z' : '');
  };
  function hull(pts) {
    var p = pts.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    if (p.length < 3) return p;
    function cr(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    var lo = [], up = [], i;
    for (i = 0; i < p.length; i++) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p[i]) <= 0) lo.pop(); lo.push(p[i]); }
    for (i = p.length - 1; i >= 0; i--) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p[i]) <= 0) up.pop(); up.push(p[i]); }
    up.pop(); lo.pop();
    return lo.concat(up);
  }
  ISO.hull = hull;

  /* ---------- floor outlines ---------- */
  // rounded rectangle {x, y, w, d, r}, counter-clockwise seen from above
  ISO.ring = function (pl, steps) {
    steps = steps || 4;
    var r = Math.min(pl.r || 0, pl.w / 2, pl.d / 2), out = [];
    var cs = [[pl.x + pl.w - r, pl.y + r, -90], [pl.x + pl.w - r, pl.y + pl.d - r, 0], [pl.x + r, pl.y + pl.d - r, 90], [pl.x + r, pl.y + r, 180]];
    cs.forEach(function (c) {
      if (r <= 0) { out.push([c[0], c[1]]); return; }
      for (var i = 0; i <= steps; i++) { var t = (c[2] + 90 * i / steps) * Math.PI / 180; out.push([c[0] + r * Math.cos(t), c[1] + r * Math.sin(t)]); }
    });
    return out;
  };
  ISO.circle = function (cx, cy, r, steps) {
    var out = []; steps = steps || 32;
    for (var i = 0; i < steps; i++) { var t = 2 * Math.PI * i / steps; out.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); }
    return out;
  };
  ISO.inset = function (pl, by) { return { x: pl.x + by, y: pl.y + by, w: pl.w - 2 * by, d: pl.d - 2 * by, r: Math.max(0, (pl.r || 0) - by) }; };
  ISO.corners = function (pl, by) { return [[pl.x + by, pl.y + by], [pl.x + pl.w - by, pl.y + by], [pl.x + pl.w - by, pl.y + pl.d - by], [pl.x + by, pl.y + pl.d - by]]; };

  /* ---------- solids: convex polyhedra as face lists ---------- */
  // a vertical prism over a convex floor ring
  ISO.prism = function (ring, z, h) {
    var n = ring.length, faces = [], top = [], i;
    for (i = 0; i < n; i++) {
      var a = ring[i], b = ring[(i + 1) % n];
      faces.push([[a[0], a[1], z], [b[0], b[1], z], [b[0], b[1], z + h], [a[0], a[1], z + h]]);
      top.push([a[0], a[1], z + h]);
    }
    faces.push(top);
    faces.push(ring.map(function (p) { return [p[0], p[1], z]; }).reverse());
    return mk(faces);
  };
  ISO.slab = function (pl, z, h, steps) { return ISO.prism(ISO.ring(pl, steps), z, h); };
  ISO.box = function (x, y, w, d, z, h) { return ISO.slab({ x: x, y: y, w: w, d: d, r: 0 }, z, h); };
  ISO.cyl = function (cx, cy, r, z, h, steps) { var s = ISO.prism(ISO.circle(cx, cy, r, steps || 28), z, h); s.round = true; return s; };
  // a frustum (tapered prism): ring0 at z0 scaled to ring1 at z1 about the same centre
  ISO.frustum = function (ring0, z0, ring1, z1) {
    var n = ring0.length, faces = [], i;
    for (i = 0; i < n; i++) {
      var j = (i + 1) % n;
      faces.push([[ring0[i][0], ring0[i][1], z0], [ring0[j][0], ring0[j][1], z0], [ring1[j][0], ring1[j][1], z1], [ring1[i][0], ring1[i][1], z1]]);
    }
    faces.push(ring1.map(function (p) { return [p[0], p[1], z1]; }));
    faces.push(ring0.map(function (p) { return [p[0], p[1], z0]; }).reverse());
    return mk(faces);
  };
  // a cylinder lying along x or y (rollers, drums, axles)
  ISO.drum = function (axis, c, r, len, steps) {
    steps = steps || 28;
    var ring = [], i, faces = [];
    for (i = 0; i < steps; i++) {
      var t = 2 * Math.PI * i / steps, u = r * Math.cos(t), v = r * Math.sin(t);
      ring.push(axis === 'x' ? [0, u, v] : [u, 0, v]);
    }
    var ax = axis === 'x' ? [len / 2, 0, 0] : [0, len / 2, 0];
    var A = ring.map(function (q) { return [c[0] + q[0] - ax[0], c[1] + q[1] - ax[1], c[2] + q[2] - ax[2]]; });
    var B = ring.map(function (q) { return [c[0] + q[0] + ax[0], c[1] + q[1] + ax[1], c[2] + q[2] + ax[2]]; });
    for (i = 0; i < steps; i++) { var j = (i + 1) % steps; faces.push([A[i], A[j], B[j], B[i]]); }
    faces.push(B.slice()); faces.push(A.slice().reverse());
    var s = mk(faces); s.round = true; return s;
  };
  function mk(faces) {
    var all = [], cen = [0, 0, 0];
    faces.forEach(function (f) { f.forEach(function (q) { all.push(q); cen[0] += q[0]; cen[1] += q[1]; cen[2] += q[2]; }); });
    cen = [cen[0] / all.length, cen[1] / all.length, cen[2] / all.length];
    var F = faces.map(function (f) {
      var n = [0, 0, 0];
      for (var i = 0; i < f.length; i++) { var a = f[i], b = f[(i + 1) % f.length]; n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); }
      n = unit(n);
      // make normals point outward
      var fc = f.reduce(function (s, q) { return [s[0] + q[0] / f.length, s[1] + q[1] / f.length, s[2] + q[2] / f.length]; }, [0, 0, 0]);
      if (dot(n, sub(fc, cen)) < 0) n = [-n[0], -n[1], -n[2]];
      return { pts: f, n: n };
    });
    return { faces: F, verts: all, c: cen };
  }

  /* ---------- rendering ---------- */
  // light comes from the left and a little behind, so the two visible sides read differently
  var LIGHT = unit([-0.35, 0.55, 0.9]);
  function toneOf(n, P) {
    if (n[2] > 0.72) return 'tp';
    var l = dot(n, LIGHT);           // -1 .. 1
    var k = Math.max(0, Math.min(3, Math.floor((l + 0.75) / 1.5 * 4)));
    return 's' + k;
  }
  // solid → SVG string. opts: tone (outline: hi|mid|lo), lit, crease (default faint), bevel, cls
  ISO.solid = function (P, S, o) {
    o = o || {};
    var V = ISO.view(P), vis = [], out = '', i, j;
    S.faces.forEach(function (f) { if (dot(f.n, V) > 1e-4) vis.push(f); });
    var cls = 'iso-sol' + (o.lit ? ' lit' : '') + (o.cls ? ' ' + o.cls : '');
    out += '<g class="' + cls + '">';
    vis.forEach(function (f) {
      var t = toneOf(f.n, P);
      out += '<path class="f ' + t + '" d="' + ISO.d(f.pts.map(function (q) { return ISO.p(P, q); }), true) + '"/>';
    });
    // creases: edges shared by two visible faces whose normals differ enough
    var cr = [];
    var key = function (q) { return f1(q[0]) + ',' + f1(q[1]) + ',' + f1(q[2]); };
    var edges = {};
    vis.forEach(function (f, fi) {
      for (j = 0; j < f.pts.length; j++) {
        var a = f.pts[j], b = f.pts[(j + 1) % f.pts.length], k1 = key(a), k2 = key(b);
        var k = k1 < k2 ? k1 + '|' + k2 : k2 + '|' + k1;
        (edges[k] = edges[k] || { a: a, b: b, f: [] }).f.push(f);
      }
    });
    var lim = S.round ? 0.5 : 0.8;   // on round bodies only real edges (top rim), not every facet
    for (var k in edges) {
      var e = edges[k];
      if (e.f.length === 2 && dot(e.f[0].n, e.f[1].n) < lim) cr.push(ISO.d([ISO.p(P, e.a), ISO.p(P, e.b)]));
    }
    if (cr.length) out += '<path class="cr ' + (o.crease || 'faint') + '" d="' + cr.join('') + '"/>';
    if (o.inner) out += o.inner;
    var h = hull(S.verts.map(function (q) { return ISO.p(P, q); }));
    out += '<path class="ol ' + (o.tone || 'mid') + '" d="' + ISO.d(h, true) + '"/>';
    return out + '</g>';
  };
  ISO.halo = function (P, ring, z, grow) {
    var g = grow || 6;
    var pts = [];
    ring.forEach(function (q) { pts.push(ISO.p(P, [q[0], q[1], z])); });
    var h = hull(pts), c = h.reduce(function (s, q) { return [s[0] + q[0] / h.length, s[1] + q[1] / h.length]; }, [0, 0]);
    h = h.map(function (q) { var dx = q[0] - c[0], dy = q[1] - c[1], l = Math.hypot(dx, dy) || 1; return [q[0] + dx / l * g, q[1] + dy / l * g * 0.6 + g * 0.5]; });
    return '<path class="iso-halo" d="' + ISO.d(h, true) + '"/>';
  };

  /* ---------- lines on faces ---------- */
  ISO.line = function (P, pts3, tone, extra) {
    return '<path class="ln ' + (tone || 'lo') + '"' + (extra || '') + ' d="' + ISO.d(pts3.map(function (q) { return ISO.p(P, q); })) + '"/>';
  };
  ISO.ringTop = function (P, cx, cy, r, z, tone, steps) {
    var pts = ISO.circle(cx, cy, r, steps || 36).map(function (q) { return ISO.p(P, [q[0], q[1], z]); });
    return '<path class="ln ' + (tone || 'lo') + '" d="' + ISO.d(pts, true) + '"/>';
  };
  ISO.planTop = function (P, pl, z, tone, steps) {
    return '<path class="ln ' + (tone || 'faint') + '" d="' + ISO.d(ISO.ring(pl, steps).map(function (q) { return ISO.p(P, [q[0], q[1], z]); }), true) + '"/>';
  };
  // the visible front half of a horizontal circle on a cylinder's side (a seam or band)
  ISO.arcFront = function (P, cx, cy, r, z, tone) {
    var a0 = Math.atan2(P.sa, P.ca), pts = [];
    for (var i = 0; i <= 24; i++) { var t = a0 - Math.PI / 2 + Math.PI * i / 24; pts.push(ISO.p(P, [cx + r * Math.cos(t), cy + r * Math.sin(t), z])); }
    return '<path class="ln ' + (tone || 'faint') + '" d="' + ISO.d(pts) + '"/>';
  };
  // a seam on a box: the visible near part of its rounded plan at height z, ending on the silhouette edges
  ISO.sideSeam = function (P, pl, z, tone, steps) {
    var ring = ISO.ring(pl, steps || 4), n = ring.length, vis = [], i;
    for (i = 0; i < n; i++) { var a = ring[i], b = ring[(i + 1) % n]; vis.push((b[1] - a[1]) * P.ca + (a[0] - b[0]) * P.sa > 1e-6); }
    var st = vis.indexOf(false); if (st < 0) st = 0;
    var runs = [], cur = null;
    for (var k = 1; k <= n; k++) {
      i = (st + k) % n;
      if (vis[i]) { if (!cur) cur = [ring[i]]; cur.push(ring[(i + 1) % n]); }
      else if (cur) { runs.push(cur); cur = null; }
    }
    if (cur) runs.push(cur);
    return '<path class="ln ' + (tone || 'faint') + '" d="' + runs.map(function (r) { return ISO.d(r.map(function (q) { return ISO.p(P, [q[0], q[1], z]); })); }).join('') + '"/>';
  };
  // vertical knurl lines on the visible half of a cylinder
  ISO.knurl = function (P, cx, cy, r, z0, z1, count, tone) {
    var a0 = Math.atan2(P.sa, P.ca), d = '';
    for (var i = 1; i < count; i++) {
      var t = a0 - Math.PI / 2 + Math.PI * i / count;
      var x = cx + r * Math.cos(t), y = cy + r * Math.sin(t);
      d += ISO.d([ISO.p(P, [x, y, z0]), ISO.p(P, [x, y, z1])]);
    }
    return '<path class="ln ' + (tone || 'lo') + '" d="' + d + '"/>';
  };
  ISO.dots = function (P, pts3, size, tone) {
    return pts3.map(function (q) { var s = ISO.p(P, q); return '<circle class="dt ' + (tone || 'mid') + '" cx="' + f1(s[0]) + '" cy="' + f1(s[1]) + '" r="' + (size || 0.5) + '"/>'; }).join('');
  };
  // a screw: a faint ring and a centre dot, on a top face
  ISO.screw = function (P, x, y, z) { return ISO.ringTop(P, x, y, 1.6, z, 'faint', 14) + ISO.dots(P, [[x, y, z]], 0.55, 'mid'); };
  // ruler ticks along a top-face edge running in +y (or +x): grow from the edge toward -x (or -y)
  ISO.ticks = function (P, from, to, step, every, edge, z, len, axis) {
    var mi = '', ma = '', n = 0;
    for (var v = from; v <= to + 1e-6; v += step, n++) {
      var major = n % every === 0, L = major ? len[1] : len[0];
      var a = axis === 'x' ? [v, edge, z] : [edge, v, z], b = axis === 'x' ? [v, edge - L, z] : [edge - L, v, z];
      var s = ISO.d([ISO.p(P, a), ISO.p(P, b)]);
      if (major) ma += s; else mi += s;
    }
    return '<path class="ln lo" d="' + mi + '"/><path class="ln mid" d="' + ma + '"/>';
  };
  ISO.radialTicks = function (P, cx, cy, r, count, every, z, len, from, span, tones) {
    var mi = '', ma = '';
    for (var i = 0; i <= count; i++) {
      var t = from + span * i / count, major = i % every === 0, L = major ? len[1] : len[0];
      var s = ISO.d([ISO.p(P, [cx + r * Math.sin(t), cy - r * Math.cos(t), z]), ISO.p(P, [cx + (r - L) * Math.sin(t), cy - (r - L) * Math.cos(t), z])]);
      if (major) ma += s; else mi += s;
    }
    return '<path class="ln ' + ((tones && tones[0]) || 'lo') + '" d="' + mi + '"/><path class="ln ' + ((tones && tones[1]) || 'mid') + '" d="' + ma + '"/>';
  };
  // a label plate: a thin slab, an inset outline, three rule lines that stand for printed text, two screws
  ISO.labelPlate = function (P, pl, z) {
    var s = ISO.solid(P, ISO.slab(pl, z, 0.8, 2), { tone: 'lo' });
    var t = z + 0.8, ins = ISO.inset(pl, 1.4);
    s += ISO.planTop(P, ins, t, 'faint', 2);
    var x0 = pl.x + 3, w = pl.w - 6, yc = pl.y + pl.d / 2;
    [[-0.28, 0.9], [0, 0.65], [0.28, 0.45]].forEach(function (r) {
      var yy = yc + r[0] * pl.d;
      s += '<path class="ln lo" data-free d="' + ISO.d([ISO.p(P, [x0, yy, t]), ISO.p(P, [x0 + w * r[1], yy, t])]) + '"/>';
    });
    return s;
  };

  /* ---------- items with depth, for painter's order ---------- */
  // items: [{ key, svg | node }]; build static ones into <g> nodes once, reorder only when needed
  ISO.el = function (tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  ISO.group = function (svgText, parent) {
    var g = document.createElementNS(NS, 'g');
    g.innerHTML = svgText;
    if (parent) parent.appendChild(g);
    return g;
  };
  ISO.sortInto = function (parent, items) {
    var sorted = items.slice().sort(function (a, b) { return a.key - b.key; });
    var same = sorted.length === parent.childNodes.length && sorted.every(function (it, i) { return parent.childNodes[i] === it.node; });
    if (same) return;
    var frag = document.createDocumentFragment();
    sorted.forEach(function (it) { frag.appendChild(it.node); });
    parent.appendChild(frag);
  };

  /* ---------- motion helpers ---------- */
  ISO.follow = function (x, t, dt, tau, calm) { return calm ? t : x + (t - x) * (1 - Math.exp(-dt / tau)); };
  ISO.still = function () { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); };

  /* ---------- the card ---------- */
  // builds: .iso-card > [corner labels] + .iso-stage(svg) ; returns handles
  ISO.card = function (host, o) {
    host.classList.add('iso');
    host.innerHTML = '';
    var card = document.createElement('div'); card.className = 'iso-card';
    card.innerHTML = '<div class="iso-fig">' + o.fig + '</div><div class="iso-title">' + o.title + '</div>' +
      '<div class="iso-stage"></div><div class="iso-hint">' + o.hint + '</div><div class="iso-readout" aria-hidden="true"></div>';
    host.appendChild(card);
    var stage = card.querySelector('.iso-stage');
    var svg = ISO.el('svg', { viewBox: '0 0 ' + o.W + ' ' + o.H, role: 'img', 'aria-label': o.label, class: 'iso-svg' }, stage);
    var legend = null;
    if (o.keys) {
      legend = document.createElement('div'); legend.className = 'iso-keys';
      legend.innerHTML = o.keys.map(function (k) { return '<span><i class="k-' + k[0] + '"></i>' + k[1] + '</span>'; }).join('');
      host.appendChild(legend);
    }
    var live = document.createElement('div'); live.className = 'iso-sr'; live.setAttribute('aria-live', 'polite'); host.appendChild(live);
    return { card: card, stage: stage, svg: svg, readout: card.querySelector('.iso-readout'), live: live };
  };

  window.ISO = ISO;
})();
