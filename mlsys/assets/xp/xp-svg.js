/* xp-svg.js — the default renderer: draws an XP.scene as crisp SVG. Four side tones by facing plus a
   lighter top, creases where faces meet at an angle, a hull outline, painter's order by depth.
   It is the fallback for xp-gl.js, so it reads the same parts and the same camera.
   Colours come from xp.css (--xp-<material>-top/s0..s3/line), so a site restyles it with CSS. */
(function () {
  'use strict';
  var XP = window.XP;
  var NS = 'http://www.w3.org/2000/svg';
  function f1(n) { return Math.round(n * 10) / 10; }
  function d(pts, closed) { var s = ''; for (var i = 0; i < pts.length; i++) s += (i ? 'L' : 'M') + f1(pts[i][0]) + ' ' + f1(pts[i][1]); return s + (closed ? 'Z' : ''); }
  XP.pathD = d;
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
  XP.hull = hull;

  // one part → SVG markup (faces, creases, outline) for camera C with basis B
  XP.partSVG = function (C, B, part) {
    var faces = XP.partFaces(part), vis = [], out = '', j;
    faces.forEach(function (f) { if (XP.v.dot(f.n, B.d) > 1e-4) vis.push(f); });
    vis.forEach(function (f) {
      out += '<path class="f ' + XP.toneOf(f.n) + '" d="' + d(f.p.map(function (q) { return XP.project(C, q, B); }), true) + '"/>';
    });
    var edges = {}, key = function (q) { return f1(q[0]) + ',' + f1(q[1]) + ',' + f1(q[2]); };
    vis.forEach(function (f) {
      for (j = 0; j < f.p.length; j++) {
        var a = f.p[j], b = f.p[(j + 1) % f.p.length], k1 = key(a), k2 = key(b), k = k1 < k2 ? k1 + '|' + k2 : k2 + '|' + k1;
        (edges[k] = edges[k] || { a: a, b: b, f: [] }).f.push(f);
      }
    });
    var lim = part.mesh.round ? 0.5 : 0.8, cr = '';
    for (var k in edges) { var e = edges[k]; if (e.f.length === 2 && XP.v.dot(e.f[0].n, e.f[1].n) < lim) cr += d([XP.project(C, e.a, B), XP.project(C, e.b, B)]); }
    if (cr) out += '<path class="cr" d="' + cr + '"/>';
    var verts = [];
    faces.forEach(function (f) { f.p.forEach(function (q) { verts.push(XP.project(C, q, B)); }); });
    out += '<path class="ol ' + (part.tone || 'mid') + '" d="' + d(hull(verts), true) + '"/>';
    return out;
  };

  /* XP.svgRenderer(svg, scene) → { render(), el }
     Each part gets its own <g>; it is rebuilt only when its camera, position, scale, material or glow
     changed, and the groups are reordered only when the depth order changed. */
  XP.svgRenderer = function (svg, S, o) {
    o = o || {};
    svg.setAttribute('viewBox', '0 0 ' + S.cam.W + ' ' + S.cam.H);
    svg.classList.add('xp-svg');
    var world = document.createElementNS(NS, 'g');
    svg.appendChild(world);
    var order = [];
    function render() {
      var C = S.cam, B = XP.basis(C);
      var ck = C.az.toFixed(3) + ',' + C.el.toFixed(3) + ',' + C.zoom.toFixed(4) + ',' + C.center.map(function (v) { return v.toFixed(3); }).join(',');
      var live = [];
      S.parts.forEach(function (p) {
        if (!p._g) { p._g = document.createElementNS(NS, 'g'); }
        if (!p.show) { if (p._g.parentNode) p._g.style.display = 'none'; return; }
        var sc = typeof p.scale === 'number' ? [p.scale, p.scale, p.scale] : p.scale;
        if (sc[0] <= 1e-4 || sc[1] <= 1e-4 || sc[2] <= 1e-4) { if (p._g.parentNode) p._g.style.display = 'none'; return; }
        var key = ck + '|' + p.pos.map(function (v) { return v.toFixed(3); }).join(',') + '|' + sc.map(function (v) { return v.toFixed(3); }).join(',') + '|' + p.mesh.id;
        if (key !== p._key) { p._key = key; p._g.innerHTML = XP.partSVG(C, B, p); }
        var cls = 'xp-sol m-' + p.mat + (p.glow > 0.02 ? ' glow' : '');
        if (cls !== p._cls) { p._cls = cls; p._g.setAttribute('class', cls); }
        var go = p.glow > 0.02 ? p.glow.toFixed(2) : '';
        if (go !== p._go) { p._go = go; p._g.style.setProperty('--glow', go || '0'); }
        p._g.style.display = '';
        p._depth = (p.layer || 0) * 1e6 + XP.depth(C, XP.partCenter(p), B);
        live.push(p);
      });
      live.sort(function (a, b) { return a._depth - b._depth; });
      var same = live.length === order.length && live.every(function (p, i) { return order[i] === p; });
      if (!same) {
        var frag = document.createDocumentFragment();
        live.forEach(function (p) { frag.appendChild(p._g); });
        world.appendChild(frag);
        order = live;
      }
    }
    return { render: render, el: svg, kind: 'svg' };
  };
})();
