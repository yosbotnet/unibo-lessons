/* xp-plot.js — plain 2-D charts for the explainer kit: axes (linear, log10, log2), ticks and gridlines, lines, points,
   bars, shaded bands and areas, reference lines, notes and a legend made from the same series. Colours come from the
   kit's materials (xp.css), so a chart speaks the same palette as the films.
   Charts are drawn at the container's real width: text stays at 11 px or more on a phone instead of shrinking with a
   fixed viewBox, and tick labels thin out when they would collide. Pure: P.draw(spec) redraws everything from the spec,
   so a widget keeps its state in its own params and calls draw on every change.

   var P = XP.plot(host, spec);   P.draw(spec);   P.svg (the element)   P.x(v), P.y(v) (data → px, after a draw)
   spec = {
     label: 'what the chart shows' (the accessible description; required),
     height: px, or aspect: height / width (default 0.52; at least 200 px, at most 440),
     x, y: { label, short (the label on phones, < 480 px), log: true | 10 | 2, min, max, ticks: [values], fmt(v) → text, grid (default: y yes, x no), zero (include 0) },
     series: [{ kind: 'line' | 'points' | 'bars' | 'band' | 'area', mat (default 'subject'), label (legend), dash (true or a
                pattern such as '1 3'), width (a line's px), shape ('dot' | 'sq' | 'tri' | 'ring' | 'cross': points' marker,
                or on a line, a marker at each data point), legendOnly (a key with no data, e.g. for a mark drawn by refs),
                data: [[x, y]] (band: [[x, lo, hi]]), or fn(x) → y (band: → [lo, hi]) sampled n times (default 160)
                over [from, to] (default the x domain), r (points' radius px), w (bars' width in x units), base (bars and
                areas: the baseline, default 0 or the axis floor), o (opacity) }],
     refs: [{ x | y, label, mat (default 'ink'), dash (default true) }],
     notes: [{ x, y, text, align: 'l' | 'r' | 'c', mat, dy (px) }],
     legend: true | false (default: when a series has a label),
     equal: true (one data unit is as long on both axes: circles stay round),
     message: 'text in the middle of the plot area' (e.g. 'press Run' before there is data)
   }
   XP.plot.keys(series) → the legend's HTML, for one legend under several charts (give those charts legend: false). 
   A null y (or a point off a log axis) breaks a line. */
(function () {
  'use strict';
  var XP = window.XP = window.XP || {};
  var NS = 'http://www.w3.org/2000/svg', MINFONT = 11, uid = 0;
  // material → [stroke, fill, fill opacity]: strong colours for lines, the material's light tones for areas
  var MAT = {
    subject: ['--xp-subject-s1', '--xp-subject-top', 0.32], memx: ['--xp-memx-s1', '--xp-memx-top', 0.38], mem: ['--xp-memx-s3', '--xp-mem-s2', 0.85],
    workx: ['--xp-workx-s1', '--xp-workx-top', 0.38], work: ['--xp-workx-s3', '--xp-work-s2', 0.85], gold: ['--xp-gold-s1', '--xp-gold-top', 0.6],
    ink: ['--xp-ink-s0', '--xp-ink-top', 0.22], steel: ['--xp-steel-line', '--xp-steel-s1', 0.8], paper: ['--xp-lo', '--xp-paper-s0', 0.8]
  };
  function col(mat, k) { var m = MAT[mat] || MAT.subject; return 'var(' + m[k] + ')'; }
  function esc(x) { return String(x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function f1(v) { return (Math.round(v * 10) / 10).toString(); }
  // a marker at (x, y): filled dot, square or triangle; ring and cross are strokes (two cues, never colour alone)
  function mark(shape, x, y, r, mat, op) {
    var c = col(mat, 0), o = op != null && op !== 1 ? ';opacity:' + op : '';
    if (shape === 'sq') return '<rect class="pt" style="fill:' + c + o + '" x="' + f1(x - r * 0.9) + '" y="' + f1(y - r * 0.9) + '" width="' + f1(r * 1.8) + '" height="' + f1(r * 1.8) + '"/>';
    if (shape === 'tri') return '<path class="pt" style="fill:' + c + o + '" d="M' + f1(x) + ' ' + f1(y - r * 1.25) + 'L' + f1(x + r * 1.15) + ' ' + f1(y + r * 0.8) + 'L' + f1(x - r * 1.15) + ' ' + f1(y + r * 0.8) + 'Z"/>';
    if (shape === 'ring') return '<circle class="pt-r" style="stroke:' + c + o + '" cx="' + f1(x) + '" cy="' + f1(y) + '" r="' + f1(r + 2.2) + '"/>';
    if (shape === 'cross') return '<path class="pt-r" style="stroke:' + c + o + '" d="M' + f1(x - r - 1.5) + ' ' + f1(y) + 'h' + f1(2 * r + 3) + 'M' + f1(x) + ' ' + f1(y - r - 1.5) + 'v' + f1(2 * r + 3) + '"/>';
    return '<circle class="pt" style="fill:' + c + o + '" cx="' + f1(x) + '" cy="' + f1(y) + '" r="' + r + '"/>';
  }
  function dashOf(d) { return d ? ' stroke-dasharray="' + (d === true ? '5 4' : d) + '"' : ''; }

  var ctx = null;
  function textW(s, px, mono) {                                 // a text's width, from the canvas (fonts as the page has them)
    if (!ctx) ctx = document.createElement('canvas').getContext('2d');
    ctx.font = px + 'px ' + (mono ? "'IBM Plex Mono', ui-monospace, monospace" : "Inter, 'Helvetica Neue', system-ui, sans-serif");
    return ctx.measureText(String(s)).width;
  }

  /* ---------- scales and ticks ---------- */
  function base(ax) { return ax.log === 2 ? 2 : ax.log ? 10 : 0; }
  function niceStep(span, n) {
    var raw = span / Math.max(1, n), p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;          // rounded up: never more than about n ticks
  }
  function sup(n) { return String(n).replace(/[-0-9]/g, function (c) { return '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(c)]; }); }
  function fmtNum(v, step) {
    if (v === 0) return '0';
    var a = Math.abs(v), d = step ? Math.max(0, -Math.floor(Math.log10(step) + 1e-9)) : (a >= 100 ? 0 : a >= 1 ? 2 : 4);
    var s = v.toFixed(Math.min(d, 8)); if (!step) s = s.replace(/\.?0+$/, '');
    if (a >= 1e4 && Math.abs(v - Math.round(v)) < 1e-9) s = Math.round(v).toLocaleString('en-US');
    return s.replace(/^-/, '−');
  }
  function fmtLog(v, b) {
    if (b === 2) return v >= 1 ? fmtNum(v) : '2' + sup(Math.round(Math.log2(v)));
    var e = Math.round(Math.log10(v));
    if (Math.abs(v - Math.pow(10, e)) < 1e-9 * v && (e >= 5 || e <= -4)) return '10' + sup(e);
    return fmtNum(v);
  }
  // ticks for an axis: [{ v, text }], at most n of them
  function ticksOf(ax, n) {
    var b = base(ax), lo = ax.dom[0], hi = ax.dom[1], out = [], v, k;
    if (ax.ticks) return ax.ticks.filter(function (t) { return t >= lo - 1e-12 && t <= hi + 1e-12; }).map(function (t) { return { v: t, text: ax.fmt ? ax.fmt(t) : b ? fmtLog(t, b) : fmtNum(t) }; });
    if (b) {
      var e0 = Math.ceil(Math.log(lo) / Math.log(b) - 1e-9), e1 = Math.floor(Math.log(hi) / Math.log(b) + 1e-9), every = Math.max(1, Math.ceil((e1 - e0 + 1) / n));
      for (k = e0; k <= e1; k++) if ((k - e0) % every === 0) out.push(Math.pow(b, k));
      if (b === 10 && e1 - e0 < 2) {                              // under two decades: 2× and 5× too
        out = [];
        for (k = e0 - 1; k <= e1; k++) [1, 2, 5].forEach(function (m) { var t = m * Math.pow(10, k); if (t >= lo * (1 - 1e-9) && t <= hi * (1 + 1e-9)) out.push(t); });
      }
      return out.map(function (t) { return { v: t, text: ax.fmt ? ax.fmt(t) : fmtLog(t, b) }; });
    }
    var st = niceStep(hi - lo, n);
    for (v = Math.ceil(lo / st - 1e-9) * st; v <= hi + st * 1e-9; v += st) out.push(Math.abs(v) < st * 1e-9 ? 0 : v);
    return out.map(function (t) { return { v: t, text: ax.fmt ? ax.fmt(t) : fmtNum(t, st) }; });
  }
  // the domain: given, or the data's extent (y rounded out to its ticks; log axes to whole steps)
  function domain(ax, vals, isY, n) {
    var b = base(ax), ok = vals.filter(function (v) { return v != null && isFinite(v) && (!b || v > 0); });
    var lo = ax.min != null ? ax.min : ok.length ? Math.min.apply(0, ok) : (b ? 1 : 0), hi = ax.max != null ? ax.max : ok.length ? Math.max.apply(0, ok) : (b ? 10 : 1);
    if (ax.zero && !b) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    if (hi === lo) { if (b) { lo /= 2; hi *= 2; } else { lo -= 1; hi += 1; } }
    if (isY && !b && (ax.min == null || ax.max == null)) {
      var st = niceStep(hi - lo, n);
      if (ax.min == null) lo = Math.floor(lo / st + 1e-9) * st;
      if (ax.max == null) hi = Math.ceil(hi / st - 1e-9) * st;
    }
    if (b && isY) {
      if (ax.min == null) lo = Math.pow(b, Math.floor(Math.log(lo) / Math.log(b) + 1e-9));
      if (ax.max == null) hi = Math.pow(b, Math.ceil(Math.log(hi) / Math.log(b) - 1e-9));
    }
    return [lo, hi];
  }
  function scale(ax, p0, p1) {
    var b = base(ax), f = b ? function (v) { return Math.log(v); } : function (v) { return v; }, a = f(ax.dom[0]), c = f(ax.dom[1]);
    return function (v) { return v == null || !isFinite(v) || (b && v <= 0) ? null : p0 + (f(v) - a) / (c - a) * (p1 - p0); };
  }

  // the legend's keys (also XP.plot.keys(series), for one legend shared by several charts)
  function keysHTML(list) {
    return list.filter(function (s) { return s.label; }).map(function (s) {
      var mat = s.mat || 'subject', k = s.kind || 'line', sw;
      if (k === 'band' || k === 'bars' || k === 'area') sw = '<rect x="1" y="2" width="20" height="10" rx="1.5" style="fill:' + col(mat, 1) + ';fill-opacity:' + (k === 'bars' ? 1 : (MAT[mat] || MAT.subject)[2]) + ';stroke:' + col(mat, 0) + ';stroke-width:' + (k === 'band' ? 0 : 1) + '"/>';
      else if (k === 'points') sw = mark(s.shape, 11, 7, 3.5, mat, s.o);
      else sw = '<line x1="1" x2="21" y1="7" y2="7" style="stroke:' + col(mat, 0) + ';stroke-width:' + (s.width || 2) + (s.o != null ? ';opacity:' + s.o : '') + '"' + dashOf(s.dash) + '/>' + (s.shape ? mark(s.shape, 11, 7, 3.2, mat) : '');
      return '<span><svg width="22" height="14" viewBox="0 0 22 14" aria-hidden="true">' + sw + '</svg>' + esc(s.label) + '</span>';
    }).join('');
  }

  /* ---------- the chart ---------- */
  XP.plot = function (host, spec0) {
    var id = 'xpp' + (++uid), spec = null, lastW = 0, P = { svg: null, x: null, y: null };
    host.classList.add('xp-plot');
    if (!host.closest('.xp')) host.classList.add('xp');             // the colour tokens live on .xp
    function width() { var cs = getComputedStyle(host); return Math.round(host.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)); }
    var svg = document.createElementNS(NS, 'svg'); svg.setAttribute('role', 'img'); host.appendChild(svg); P.svg = svg;
    var keys = document.createElement('div'); keys.className = 'xp-plot-keys'; host.appendChild(keys);

    // the series' points, sampling functions over the x domain
    function pointsOf(s, X) {
      if (s.data) return s.data;
      var n = s.n || 160, b = base(X), a = s.from != null ? s.from : X.dom[0], c = s.to != null ? s.to : X.dom[1], out = [];
      for (var i = 0; i <= n; i++) {
        var u = i / n, x = b ? Math.exp(Math.log(a) + (Math.log(c) - Math.log(a)) * u) : a + (c - a) * u, y = s.fn(x);
        out.push(s.kind === 'band' ? [x, y[0], y[1]] : [x, y]);
      }
      return out;
    }
    function draw(sp) {
      spec = sp || spec; if (!spec) return P;
      var W = width() || 640; lastW = W;
      var narrow = W < 480, fs = Math.max(MINFONT, narrow ? 11 : 12), fl = fs + 1;
      var H = spec.height || Math.round(Math.max(200, Math.min(440, W * (spec.aspect || (narrow ? 0.68 : 0.52)))));
      var X = Object.assign({}, spec.x || {}), Y = Object.assign({}, spec.y || {}), series, refs = spec.refs || [], notes = spec.notes || [];
      if (Y.grid == null) Y.grid = true;
      if (narrow) { if (X.short != null) X.label = X.short; if (Y.short != null) Y.label = Y.short; }
      // domains from every series and reference line (functions need the x domain first)
      var xs = [], ys = [];
      var all = spec.series || [];
      series = all.filter(function (s) { return !s.legendOnly; });
      series.forEach(function (s) { if (s.data) s.data.forEach(function (d) { xs.push(d[0]); }); else { if (s.from != null) xs.push(s.from); if (s.to != null) xs.push(s.to); } });
      refs.forEach(function (r) { if (r.x != null) xs.push(r.x); });
      X.dom = domain(X, xs, false, 6);
      var pts = series.map(function (s) { return pointsOf(s, X); });
      series.forEach(function (s, i) {
        pts[i].forEach(function (d) { ys.push(d[1]); if (s.kind === 'band') ys.push(d[2]); });
        if ((s.kind === 'bars' || s.kind === 'area') && !base(Y)) ys.push(s.base != null ? s.base : 0);
      });
      refs.forEach(function (r) { if (r.y != null) ys.push(r.y); });
      var plotH0 = H - (fs + 14) - (X.label ? fl + 8 : 0) - 10;
      Y.dom = domain(Y, ys, true, Math.max(3, Math.floor(plotH0 / (fs * 2.8))));
      // margins from the y tick labels' width
      var yt = ticksOf(Y, Math.max(3, Math.floor(plotH0 / (fs * 2.8))));
      var ml = Math.ceil(Math.max.apply(0, yt.map(function (t) { return textW(t.text, fs, true); }).concat([10]))) + 9 + (Y.label ? fl + 10 : 0);
      var mr = 14, mt = 10, mb = fs + 12 + (X.label ? fl + 10 : 0), x0 = ml, x1 = W - mr, y0 = H - mb, y1 = mt;
      if (spec.equal) {                                          // one data unit as long on both axes: shrink the longer side
        var ux = (x1 - x0) / (X.dom[1] - X.dom[0]), uy = (y0 - y1) / (Y.dom[1] - Y.dom[0]);
        if (ux > uy) x1 = x0 + (X.dom[1] - X.dom[0]) * uy; else { var h2 = (Y.dom[1] - Y.dom[0]) * ux; H -= (y0 - y1) - h2; y0 = y1 + h2; }
      }
      var sx = scale(X, x0, x1), sy = scale(Y, y0, y1); P.x = sx; P.y = sy;
      // x ticks: as many as fit, thinned so labels keep a gap
      var xt = ticksOf(X, Math.max(2, Math.floor((x1 - x0) / (fs * 5))));
      if (xt.length) {                                            // room for the last tick label's right half
        var lastW = textW(xt[xt.length - 1].text, fs, true) / 2, over = sx(xt[xt.length - 1].v) + lastW + 2 - W;
        if (over > 0) { x1 -= over; sx = scale(X, x0, x1); P.x = sx; }
      }
      var step = 1;
      for (; step < xt.length; step++) {
        var ok = true, prevR = -1e9;
        for (var i = 0; i < xt.length; i += step) { var w = textW(xt[i].text, fs, true), cx = sx(xt[i].v); if (cx - w / 2 < prevR + 8) { ok = false; break; } prevR = cx + w / 2; }
        if (ok) break;
      }
      xt = xt.filter(function (t, i) { return i % step === 0; });

      var o = [];
      o.push('<defs><clipPath id="' + id + 'c"><rect x="' + x0 + '" y="' + (y1 - 2) + '" width="' + (x1 - x0) + '" height="' + (y0 - y1 + 4) + '"/></clipPath></defs>');
      // grid
      if (Y.grid) yt.forEach(function (t) { var y = f1(sy(t.v)); o.push('<line class="g" x1="' + x0 + '" x2="' + x1 + '" y1="' + y + '" y2="' + y + '"/>'); });
      if (X.grid) xt.forEach(function (t) { var x = f1(sx(t.v)); o.push('<line class="g" x1="' + x + '" x2="' + x + '" y1="' + y1 + '" y2="' + y0 + '"/>'); });
      // series: fills first, then bars, then lines and points on top
      var body = [], marks = [];
      function path(list, k) {                                     // a polyline through list (k: the y index), broken at gaps
        var d = '', pen = false;
        list.forEach(function (q) { var x = sx(q[0]), y = sy(q[k]); if (x == null || y == null) { pen = false; return; } d += (pen ? 'L' : 'M') + f1(x) + ' ' + f1(y); pen = true; });
        return d;
      }
      var order = { band: 0, area: 1, bars: 2, line: 3, points: 4 };
      series.map(function (s, i) { return i; }).sort(function (a, b) { return (order[series[a].kind || 'line'] - order[series[b].kind || 'line']) || a - b; }).forEach(function (i) {
        var s = series[i], q = pts[i], kind = s.kind || 'line', mat = s.mat || 'subject', op = s.o != null ? s.o : 1, dash = dashOf(s.dash) + (s.width ? ' stroke-width="' + s.width + '"' : '');
        var bl = s.base != null ? s.base : base(Y) ? Y.dom[0] : Math.max(Y.dom[0], Math.min(Y.dom[1], 0));
        if (kind === 'band') {
          var top = q.filter(function (d) { return sx(d[0]) != null && sy(d[2]) != null && sy(d[1]) != null; });
          if (top.length > 1) body.push('<path class="fill" style="fill:' + col(mat, 1) + ';fill-opacity:' + (MAT[mat] || MAT.subject)[2] * op + '" d="' + path(top, 2) + top.slice().reverse().map(function (d) { return 'L' + f1(sx(d[0])) + ' ' + f1(sy(d[1])); }).join('') + 'Z"/>');
        } else if (kind === 'area') {
          var a = q.filter(function (d) { return sx(d[0]) != null && sy(d[1]) != null; });
          if (a.length > 1) {
            body.push('<path class="fill" style="fill:' + col(mat, 1) + ';fill-opacity:' + (MAT[mat] || MAT.subject)[2] * op + '" d="' + path(a, 1) + 'L' + f1(sx(a[a.length - 1][0])) + ' ' + f1(sy(bl)) + 'L' + f1(sx(a[0][0])) + ' ' + f1(sy(bl)) + 'Z"/>');
            body.push('<path class="ln" style="stroke:' + col(mat, 0) + ';opacity:' + op + '"' + dash + ' d="' + path(a, 1) + '"/>');
          }
        } else if (kind === 'bars') {
          var gap = q.length > 1 ? Math.abs(sx(q[1][0]) - sx(q[0][0])) : (x1 - x0) / 4;
          q.forEach(function (d) {
            var cx = sx(d[0]), y = sy(d[1]), yb = sy(bl); if (cx == null || y == null) return;
            var bw = s.w != null ? Math.abs(sx(d[0] + s.w / 2) - sx(d[0] - s.w / 2)) : gap * 0.62;
            body.push('<rect class="bar" style="fill:' + col(mat, 1) + ';stroke:' + col(mat, 0) + ';opacity:' + op + '" x="' + f1(cx - bw / 2) + '" y="' + f1(Math.min(y, yb)) + '" width="' + f1(bw) + '" height="' + f1(Math.abs(yb - y)) + '"/>');
          });
        } else if (kind === 'points') {
          var r = s.r || (narrow ? 3 : 3.5);
          q.forEach(function (d) { var x = sx(d[0]), y = sy(d[1]); if (x == null || y == null) return; body.push(mark(s.shape, x, y, r, mat, op)); });
        } else {
          body.push('<path class="ln" style="stroke:' + col(mat, 0) + ';opacity:' + op + '"' + dash + ' d="' + path(q, 1) + '"/>');
          if (s.shape && s.data) { var rm = s.r || (narrow ? 3 : 3.5); q.forEach(function (d) { var x = sx(d[0]), y = sy(d[1]); if (x != null && y != null) marks.push(mark(s.shape, x, y, rm, mat, op)); }); }
        }
      });
      o.push('<g clip-path="url(#' + id + 'c)">' + body.join('') + marks.join('') + '</g>');
      if (spec.message) o.push('<text class="note" style="fill:' + col('subject', 0) + '" x="' + f1((x0 + x1) / 2) + '" y="' + f1((y0 + y1) / 2) + '" text-anchor="middle" font-size="' + fl + '">' + esc(spec.message) + '</text>');
      // reference lines and their labels
      var refRows = [];                                              // vertical refs' labels: a row lower when they would collide
      refs.forEach(function (r) {
        var mat = r.mat || 'ink', st = 'stroke:' + col(mat, 0), da = r.dash === false ? '' : ' stroke-dasharray="' + (r.dash && r.dash !== true ? r.dash : '4 3') + '"';
        if (r.x != null) { var x = sx(r.x); if (x == null) return; o.push('<line class="ref" style="' + st + '"' + da + ' x1="' + f1(x) + '" x2="' + f1(x) + '" y1="' + y1 + '" y2="' + y0 + '"/>');
          if (r.label) {
            var right = x > (x0 + x1) / 2, lw = textW(r.label, fs, false) * 1.08, la = right ? x - 5 - lw : x + 5, row = 0;
            while (refRows.some(function (q) { return q[0] === row && la < q[2] + 6 && la + lw > q[1] - 6; })) row++;
            refRows.push([row, la, la + lw]);
            o.push('<text class="note" style="fill:' + col(mat, 0) + '" x="' + f1(right ? x - 5 : x + 5) + '" y="' + (y1 + fs + row * (fs + 3)) + '" text-anchor="' + (right ? 'end' : 'start') + '" font-size="' + fs + '">' + esc(r.label) + '</text>');
          } }
        else { var y = sy(r.y); if (y == null) return; o.push('<line class="ref" style="' + st + '"' + da + ' x1="' + x0 + '" x2="' + x1 + '" y1="' + f1(y) + '" y2="' + f1(y) + '"/>');
          if (r.label) o.push('<text class="note" style="fill:' + col(mat, 0) + '" x="' + (x1 - 4) + '" y="' + f1(y - 5) + '" text-anchor="end" font-size="' + fs + '">' + esc(r.label) + '</text>'); }
      });
      notes.forEach(function (n) {
        var x = sx(n.x), y = sy(n.y); if (x == null || y == null) return;
        o.push('<text class="note" style="fill:' + col(n.mat || 'ink', 0) + '" x="' + f1(x + (n.align === 'l' ? 6 : n.align === 'r' ? -6 : 0)) + '" y="' + f1(y + (n.dy != null ? n.dy : -7)) + '" text-anchor="' + (n.align === 'l' ? 'start' : n.align === 'r' ? 'end' : 'middle') + '" font-size="' + fs + '">' + esc(n.text) + '</text>');
      });
      // axes, ticks, labels
      o.push('<line class="ax" x1="' + x0 + '" x2="' + x1 + '" y1="' + y0 + '" y2="' + y0 + '"/><line class="ax" x1="' + x0 + '" x2="' + x0 + '" y1="' + y1 + '" y2="' + y0 + '"/>');
      xt.forEach(function (t) { var x = f1(sx(t.v)); o.push('<line class="tk" x1="' + x + '" x2="' + x + '" y1="' + y0 + '" y2="' + (y0 + 4) + '"/><text class="tl" x="' + x + '" y="' + (y0 + 6 + fs) + '" text-anchor="middle" font-size="' + fs + '">' + esc(t.text) + '</text>'); });
      yt.forEach(function (t) { var y = f1(sy(t.v)); o.push('<line class="tk" x1="' + (x0 - 4) + '" x2="' + x0 + '" y1="' + y + '" y2="' + y + '"/><text class="tl" x="' + (x0 - 7) + '" y="' + y + '" dy="0.35em" text-anchor="end" font-size="' + fs + '">' + esc(t.text) + '</text>'); });
      if (X.label) o.push('<text class="al" x="' + f1((x0 + x1) / 2) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="' + fl + '">' + esc(X.label) + '</text>');
      if (Y.label) o.push('<text class="al" transform="translate(' + (fl - 1) + ' ' + f1((y0 + y1) / 2) + ') rotate(-90)" text-anchor="middle" font-size="' + fl + '">' + esc(Y.label) + '</text>');
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('width', W); svg.setAttribute('height', H);
      svg.setAttribute('aria-label', spec.label || '');
      svg.innerHTML = o.join('');
      // the legend, from the series that have labels
      var leg = all.filter(function (s) { return s.label; });
      keys.hidden = spec.legend === false || !leg.length;
      keys.innerHTML = keys.hidden ? '' : keysHTML(leg);
      return P;
    }
    P.draw = draw;
    if (window.ResizeObserver) new ResizeObserver(function () { var w = width(); if (w > 0 && w !== lastW && spec) draw(); }).observe(host);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (spec) draw(); });
    return draw(spec0);
  };
  XP.plot.keys = keysHTML;
})();
