/* chess-board.js — renders .cb elements as inline SVG boards in the ybc.sh "technical plate" style
   (same look as Chessboard Studio's YBC preset: paper + hatched pale-blue squares, cobalt pieces, vermilion coordinates).
   Chess pieces by Cburnett, via Lichess; recolored. CC BY-SA 3.0 https://creativecommons.org/licenses/by-sa/3.0/
   data-fen="<FEN>"                         static position
   data-fens="f0|f1|…" data-sans="e4|e5|…"  steppable line (fens has one more entry than sans)
   data-arrows="e2e4,g1f3"  data-marks="f7,h5"   optional annotations (static boards,
   or per-step with ';' separators matching data-fens). data-flip="1" shows Black's side.
   Variations: child <span class="cb-branch" data-name data-from="<trunk ply where it leaves>" data-fens data-sans>
   (its fens[0] is the trunk position at that ply); the trunk is named with data-name on the .cb itself.
   data-puzzle="question": try-it-first mode (start position + question only, until "Show solution"). */
(function () {
  var PIECES = {"bB": "<g fill=\"none\" fill-rule=\"evenodd\" stroke=\"#000\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"><g fill=\"#000\" stroke-linecap=\"butt\"><path d=\"M9 36c3.4-1 10.1.4 13.5-2 3.4 2.4 10.1 1 13.5 2 0 0 1.6.5 3 2-.7 1-1.6 1-3 .5-3.4-1-10.1.5-13.5-1-3.4 1.5-10.1 0-13.5 1-1.4.5-2.3.5-3-.5 1.4-2 3-2 3-2z\"/><path d=\"M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z\"/><path d=\"M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z\"/></g><path stroke=\"#ececec\" stroke-linejoin=\"miter\" d=\"M17.5 26h10M15 30h15m-7.5-14.5v5M20 18h5\"/></g>", "bK": "<g fill=\"none\" fill-rule=\"evenodd\" stroke=\"#000\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"><path stroke-linejoin=\"miter\" d=\"M22.5 11.6V6\"/><path fill=\"#000\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" d=\"M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5\"/><path fill=\"#000\" d=\"M11.5 37a22.3 22.3 0 0 0 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10 5 10z\"/><path stroke-linejoin=\"miter\" d=\"M20 8h5\"/><path stroke=\"#ececec\" d=\"M32 29.5s8.5-4 6-9.7C34.1 14 25 18 22.5 24.6v2.1-2.1C20 18 9.9 14 7 19.9c-2.5 5.6 4.8 9 4.8 9\"/><path stroke=\"#ececec\" d=\"M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0\"/></g>", "bN": "<g fill=\"none\" fill-rule=\"evenodd\" stroke=\"#000\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"><path fill=\"#000\" d=\"M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21\"/><path fill=\"#000\" d=\"M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.04-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-1-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-2 2.5-3c1 0 1 3 1 3\"/><path fill=\"#ececec\" stroke=\"#ececec\" d=\"M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0m5.43-9.75a.5 1.5 30 1 1-.86-.5.5 1.5 30 1 1 .86.5\"/><path fill=\"#ececec\" stroke=\"none\" d=\"m24.55 10.4-.45 1.45.5.15c3.15 1 5.65 2.49 7.9 6.75S35.75 29.06 35.25 39l-.05.5h2.25l.05-.5c.5-10.06-.88-16.85-3.25-21.34s-5.79-6.64-9.19-7.16z\"/></g>", "bP": "<path stroke=\"#000\" stroke-linecap=\"round\" stroke-width=\"1.5\" d=\"M22.5 9a4 4 0 0 0-3.22 6.38 6.48 6.48 0 0 0-.87 10.65c-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47a6.46 6.46 0 0 0-.87-10.65A4.01 4.01 0 0 0 22.5 9z\"/>", "bQ": "<g fill-rule=\"evenodd\" stroke=\"#000\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"><g stroke=\"none\"><circle cx=\"6\" cy=\"12\" r=\"2.75\"/><circle cx=\"14\" cy=\"9\" r=\"2.75\"/><circle cx=\"22.5\" cy=\"8\" r=\"2.75\"/><circle cx=\"31\" cy=\"9\" r=\"2.75\"/><circle cx=\"39\" cy=\"12\" r=\"2.75\"/></g><path stroke-linecap=\"butt\" d=\"M9 26c8.5-1.5 21-1.5 27 0l2.5-12.5L31 25l-.3-14.1-5.2 13.6-3-14.5-3 14.5-5.2-13.6L14 25 6.5 13.5z\"/><path stroke-linecap=\"butt\" d=\"M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z\"/><path fill=\"none\" stroke-linecap=\"butt\" d=\"M11 38.5a35 35 1 0 0 23 0\"/><path fill=\"none\" stroke=\"#ececec\" d=\"M11 29a35 35 1 0 1 23 0m-21.5 2.5h20m-21 3a35 35 1 0 0 22 0m-23 3a35 35 1 0 0 24 0\"/></g>", "bR": "<g fill-rule=\"evenodd\" stroke=\"#000\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"><path stroke-linecap=\"butt\" d=\"M9 39h27v-3H9zm3.5-7 1.5-2.5h17l1.5 2.5zm-.5 4v-4h21v4z\"/><path stroke-linecap=\"butt\" stroke-linejoin=\"miter\" d=\"M14 29.5v-13h17v13z\"/><path stroke-linecap=\"butt\" d=\"M14 16.5 11 14h23l-3 2.5zM11 14V9h4v2h5V9h5v2h5V9h4v5z\"/><path fill=\"none\" stroke=\"#ececec\" stroke-linejoin=\"miter\" stroke-width=\"1\" d=\"M12 35.5h21m-20-4h19m-18-2h17m-17-13h17M11 14h23\"/></g>", "wB": "<g fill=\"none\" fill-rule=\"evenodd\" stroke=\"#000\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"><g fill=\"#fff\" stroke-linecap=\"butt\"><path d=\"M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.35.49-2.32.47-3-.5 1.35-1.94 3-2 3-2z\"/><path d=\"M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z\"/><path d=\"M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z\"/></g><path stroke-linejoin=\"miter\" d=\"M17.5 26h10M15 30h15m-7.5-14.5v5M20 18h5\"/></g>", "wK": "<g fill=\"none\" fill-rule=\"evenodd\" stroke=\"#000\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"><path stroke-linejoin=\"miter\" d=\"M22.5 11.63V6M20 8h5\"/><path fill=\"#fff\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" d=\"M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5\"/><path fill=\"#fff\" d=\"M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10 5 10z\"/><path d=\"M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0\"/></g>", "wN": "<g fill=\"none\" fill-rule=\"evenodd\" stroke=\"#000\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"><path fill=\"#fff\" d=\"M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21\"/><path fill=\"#fff\" d=\"M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3\"/><path fill=\"#000\" d=\"M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0m5.433-9.75a.5 1.5 30 1 1-.866-.5.5 1.5 30 1 1 .866.5\"/></g>", "wP": "<path fill=\"#fff\" stroke=\"#000\" stroke-linecap=\"round\" stroke-width=\"1.5\" d=\"M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z\"/>", "wQ": "<g fill=\"#fff\" fill-rule=\"evenodd\" stroke=\"#000\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"><path d=\"M8 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0m16.5-4.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0M41 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0M16 8.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0M33 9a2 2 0 1 1-4 0 2 2 0 1 1 4 0\"/><path stroke-linecap=\"butt\" d=\"M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11V11l-5.5 13.5-3-15-3 15-5.5-14V25L7 14z\"/><path stroke-linecap=\"butt\" d=\"M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z\"/><path fill=\"none\" d=\"M11.5 30c3.5-1 18.5-1 22 0M12 33.5c6-1 15-1 21 0\"/></g>", "wR": "<g fill=\"#fff\" fill-rule=\"evenodd\" stroke=\"#000\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"><path stroke-linecap=\"butt\" d=\"M9 39h27v-3H9zm3-3v-4h21v4zm-1-22V9h4v2h5V9h5v2h5V9h4v5\"/><path d=\"m34 14-3 3H14l-3-3\"/><path stroke-linecap=\"butt\" stroke-linejoin=\"miter\" d=\"M31 17v12.5H14V17\"/><path d=\"m31 29.5 1.5 2.5h-20l1.5-2.5\"/><path fill=\"none\" stroke-linejoin=\"miter\" d=\"M11 14h23\"/></g>"};
  var C = { light: '#f3efe3', dark: '#dbe1e9', white: '#faf7ef', black: '#1546b8', label: '#b83d2d', rule: '#c9c3b6', arrow: '#b83d2d', mark: '#b83d2d' };
  var S = 80, M = 30, T = 8 * S + 2 * M, uid = 0;
  function piece(p) {
    var white = p === p.toUpperCase(), svg = PIECES[(white ? 'w' : 'b') + p.toUpperCase()];
    if (!white) svg = svg.split('stroke="#000"').join('stroke="' + C.white + '"');
    svg = svg.split('#fff').join(C.white).split('#ececec').join(C.white).split('#000').join(C.black);
    return '<g fill="' + (white ? C.white : C.black) + '">' + svg + '</g>';
  }
  function xy(sq, flip) { var f = sq.charCodeAt(0) - 97, r = +sq[1] - 1; return flip ? [M + (7 - f) * S, M + r * S] : [M + f * S, M + (7 - r) * S]; }
  function markup(fen, arrows, marks, flip) {
    var id = 'cbh' + (++uid), t = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + T + ' ' + T + '" class="cb-svg" role="img" aria-label="Chess position ' + fen + '">' +
      '<defs><pattern id="' + id + '" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 7L7 0" stroke="#1546b8" stroke-width=".45" opacity=".2"/></pattern></defs>' +
      '<rect width="' + T + '" height="' + T + '" fill="' + C.light + '"/>';
    for (var r = 0; r < 8; r++) for (var f = 0; f < 8; f++) {
      var x = M + f * S, y = M + r * S, dark = (r + f) % 2;
      t += '<rect x="' + x + '" y="' + y + '" width="80" height="80" fill="' + (dark ? C.dark : C.light) + '"/>';
      if (dark) t += '<rect x="' + x + '" y="' + y + '" width="80" height="80" fill="url(#' + id + ')"/>';
      t += '<rect x="' + x + '" y="' + y + '" width="80" height="80" fill="none" stroke="' + C.rule + '" stroke-width=".5"/>';
    }
    (marks || []).forEach(function (sq) { var p = xy(sq, flip); t += '<rect x="' + p[0] + '" y="' + p[1] + '" width="80" height="80" fill="' + C.mark + '" opacity=".22"/><rect x="' + (p[0] + 2) + '" y="' + (p[1] + 2) + '" width="76" height="76" fill="none" stroke="' + C.mark + '" stroke-width="3"/>'; });
    fen.split(' ')[0].split('/').forEach(function (row, ri) {
      var fi = 0; row.split('').forEach(function (c) {
        if (/\d/.test(c)) { fi += +c; return; }
        var p = xy('abcdefgh'[fi] + (8 - ri), flip);
        t += '<svg x="' + (p[0] + 4) + '" y="' + (p[1] + 4) + '" width="72" height="72" viewBox="0 0 45 45">' + piece(c) + '</svg>'; fi++;
      });
    });
    (arrows || []).forEach(function (a) {
      var p = xy(a.slice(0, 2), flip), q = xy(a.slice(2, 4), flip), x = p[0] + 40, y = p[1] + 40, X = q[0] + 40, Y = q[1] + 40,
        dx = X - x, dy = Y - y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
      t += '<g opacity=".82"><path d="M' + x + ' ' + y + 'L' + (X - ux * 17) + ' ' + (Y - uy * 17) + '" stroke="' + C.arrow + '" stroke-width="10" stroke-linecap="round"/>' +
        '<path d="M' + X + ' ' + Y + 'L' + (X - ux * 28 - uy * 15) + ' ' + (Y - uy * 28 + ux * 15) + 'L' + (X - ux * 28 + uy * 15) + ' ' + (Y - uy * 28 - ux * 15) + 'Z" fill="' + C.arrow + '"/></g>';
    });
    t += '<rect x="' + M + '" y="' + M + '" width="640" height="640" fill="none" stroke="' + C.label + '" stroke-width="1"/>';
    t += '<g fill="' + C.label + '" font-family="\'IBM Plex Mono\',\'Courier New\',monospace" font-size="17" font-weight="600" text-anchor="middle">';
    for (var i = 0; i < 8; i++) {
      var fl = (flip ? 'HGFEDCBA' : 'ABCDEFGH')[i], rk = flip ? i + 1 : 8 - i;
      t += '<text x="' + (M + i * S + 40) + '" y="' + (T - 9) + '">' + fl + '</text><text x="' + (M + i * S + 40) + '" y="21">' + fl + '</text>' +
        '<text x="15" y="' + (M + i * S + 46) + '">' + rk + '</text><text x="' + (T - 15) + '" y="' + (M + i * S + 46) + '">' + rk + '</text>';
    }
    return t + '</g></svg>';
  }
  function draw(host, fen, arrows, marks, flip) {
    var box = host.querySelector('.cb-board'); if (!box) { box = document.createElement('div'); box.className = 'cb-board'; host.insertBefore(box, host.firstChild); }
    var hid = host.dataset.puzzle && host._revealed !== true;
    box.innerHTML = markup(fen, hid ? [] : arrows, hid ? [] : marks, flip); if (host._setFen) host._setFen(fen);
  }
  function list(s) { return s ? s.split(',').map(function (x) { return x.trim(); }).filter(Boolean) : []; }
  function init(host) {
    var flip = host.dataset.flip === '1';
    if (!host.dataset.fens) { var sd = function () { draw(host, host.dataset.fen, list(host.dataset.arrows), list(host.dataset.marks), flip); }; host._reveal = function () { host._revealed = true; sd(); }; sd(); return; }
    function line(el) { return { name: el.dataset.name || 'Main line', from: +(el.dataset.from || 0), fens: el.dataset.fens.split('|'), sans: (el.dataset.sans || '').split('|'),
      arr: (el.dataset.arrows || '').split(';'), mks: (el.dataset.marks || '').split(';') }; }
    var trunk = line(host), lines = [trunk], cur = 0, i = 0;
    Array.prototype.forEach.call(host.querySelectorAll('.cb-branch'), function (el) { lines.push(line(el)); });
    trunk.from = trunk.fens.length - 1;
    // a branch's own arrays start at the trunk position `from`; step k>from maps to branch index k-from
    function at(k) { var L = lines[cur]; if (cur === 0 || k <= L.from) return { fen: trunk.fens[k], san: trunk.sans[k - 1], arr: trunk.arr[k], mks: trunk.mks[k] };
      var j = k - L.from; return { fen: L.fens[j], san: L.sans[j - 1], arr: L.arr[j], mks: L.mks[j] }; }
    function len() { var L = lines[cur]; return cur === 0 ? trunk.fens.length - 1 : L.from + L.fens.length - 1; }
    var chips = [];
    if (lines.length > 1) {
      var row = document.createElement('div'); row.className = 'cb-lines'; row.setAttribute('role', 'group'); row.setAttribute('aria-label', 'Variations');
      lines.forEach(function (L, n) { var c = document.createElement('button'); c.type = 'button'; c.className = 'cb-chip'; c.textContent = L.name;
        c.onclick = function () { if (n === cur) return;
          var fa = cur === 0 ? Infinity : lines[cur].from, fb = n === 0 ? Infinity : L.from, shared = Math.min(fa, fb);
          cur = n; if (i >= shared) { i = shared; if (i < len()) i++; } show(); };
        chips.push(c); row.appendChild(c); });
      host.appendChild(row);
    }
    var bar = document.createElement('div'); bar.className = 'cb-bar';
    var prev = document.createElement('button'), next = document.createElement('button'), lab = document.createElement('span');
    prev.type = next.type = 'button'; prev.textContent = '← Back'; next.textContent = 'Next →'; lab.className = 'cb-label'; lab.setAttribute('aria-live', 'polite');
    bar.appendChild(prev); bar.appendChild(lab); bar.appendChild(next); host.appendChild(bar);
    function show() {
      var p = at(i); draw(host, p.fen, list(p.arr), list(p.mks), flip);
      var txt = 'Start';
      if (i > 0) { var ply = i + (trunk.fens[0].split(' ')[1] === 'b' ? 1 : 0), n = Math.ceil(ply / 2); txt = n + (ply % 2 ? '. ' : '… ') + p.san; }
      lab.textContent = txt + '  (' + i + '/' + len() + ')';
      prev.disabled = i === 0; next.disabled = i === len();
      chips.forEach(function (c, n) { c.setAttribute('aria-pressed', n === cur ? 'true' : 'false');
        // a line "forks here" when the shown position is where it leaves the current one
        var f = n === 0 ? (cur === 0 ? -1 : lines[cur].from) : (cur === 0 || cur === n ? lines[n].from : Math.min(lines[n].from, lines[cur].from));
        c.classList.toggle('cb-fork', n !== cur && f === i); });
    }
    host._reveal = function () { host._revealed = true; show(); };
    prev.onclick = function () { if (i > 0) { i--; show(); } };
    next.onclick = function () { if (i < len()) { i++; show(); } };
    show();
  }
  function lichess(host) {
    if (host.dataset.illus) return;
    var a = document.createElement('a'); a.className = 'cb-ext'; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Analyse / practise this position on Lichess ↗';
    host._setFen = function (fen) { a.href = 'https://lichess.org/analysis/standard/' + fen.replace(/ /g, '_') + (host.dataset.flip === '1' ? '?color=black' : ''); };
    host.appendChild(a);
  }
  // Try-it-first: data-puzzle="question". Shows only the start position and the question; the moves, annotations,
  // variations, Lichess link and the caption (which gives the answer) stay hidden until "Show solution".
  function puzzle(host) {
    var fig = host.closest('figure'), cap = fig && fig.querySelector('figcaption'), num = cap && cap.querySelector('b');
    var box = document.createElement('div'); box.className = 'cb-q';
    var q = document.createElement('p'); q.innerHTML = (num ? '<b>' + num.textContent + '</b> — ' : '') + '<span class="cb-q-tag">Your turn</span> '; q.appendChild(document.createTextNode(host.dataset.puzzle));
    var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'cb-reveal'; btn.textContent = 'Show solution';
    box.appendChild(q); box.appendChild(btn); host.appendChild(box);
    host.classList.add('cb-hidden'); if (cap) cap.hidden = true;
    btn.onclick = function () { host.classList.remove('cb-hidden'); if (cap) cap.hidden = false; btn.remove(); q.querySelector('.cb-q-tag').textContent = 'Question'; if (host._reveal) host._reveal(); };
  }
  function boot() { Array.prototype.forEach.call(document.querySelectorAll('.cb'), function (host) { lichess(host); init(host); if (host.dataset.puzzle) puzzle(host); }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
