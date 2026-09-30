/* block-layout.js — how a block is cut into warps.
   Pick a block shape; cells are coloured by warp (the hardware flattens
   x fastest, then y, and cuts every 32 threads). Click a thread to see its
   IDs, and see what its warp does to memory when it stores
   out[row * 1024 + col] (floats, row-major), with x mapped to the column
   (the right way) or to the row (swapped). */
(function () {
  'use strict';
  var host = document.getElementById('w-blocklayout');
  if (!host) return;

  var SHAPES = [
    [32, 8], [16, 16], [8, 32], [4, 64], [64, 4], [24, 4], [100, 1]
  ];
  var TINTS = ['var(--lk-hl)', 'var(--lk-okbg)', 'var(--lk-warnbg)', 'var(--lk-paper)'];
  var WIDTH = 1024; // image width in elements, for the memory readout

  host.innerHTML =
    '<h4>Block layout explorer</h4>' +
    '<p class="w-sub">Colours are warps. The hardware numbers threads x-first, then y, and cuts every 32. Click any thread.</p>' +
    '<div class="w-controls">' +
      '<label>Block shape (blockDim.x × blockDim.y)<select id="bl-shape"></select></label>' +
      '<label>threadIdx.x indexes<select id="bl-map"><option value="col">the column (x → col)</option><option value="row">the row (x → row, swapped)</option></select></label>' +
    '</div>' +
    '<div id="bl-grid" class="bl-grid" role="grid" aria-label="Threads of one block, coloured by warp"></div>' +
    '<div class="w-out" style="margin-top:.8rem">' +
      '<div class="w-stat"><span class="k">threadIdx (x, y)</span><span class="v" id="bl-t"></span></div>' +
      '<div class="w-stat"><span class="k">linear tid</span><span class="v" id="bl-tid"></span></div>' +
      '<div class="w-stat"><span class="k">warp · lane</span><span class="v" id="bl-wl"></span></div>' +
      '<div class="w-stat"><span class="k">writes out[row][col]</span><span class="v" id="bl-rc"></span></div>' +
    '</div>' +
    '<div class="w-verdict" id="bl-v" role="status" aria-live="polite"></div>';

  var sel = host.querySelector('#bl-shape');
  SHAPES.forEach(function (s, i) {
    var o = document.createElement('option');
    var n = s[0] * s[1];
    o.value = i; o.textContent = s[0] + ' × ' + s[1] + '  (' + n + ' threads)';
    sel.appendChild(o);
  });
  var mapSel = host.querySelector('#bl-map');
  var grid = host.querySelector('#bl-grid');
  var selected = 0;

  function $(id) { return host.querySelector('#' + id); }

  // (x, y) of a thread -> (row, col) it writes, for block (0, 0)
  function rowcol(x, y, map) { return map === 'col' ? [y, x] : [x, y]; }

  function render() {
    var s = SHAPES[+sel.value], Bx = s[0], By = s[1], n = Bx * By;
    if (selected >= n) selected = 0;
    var avail = Math.max(200, (host.clientWidth || 640) - 44);
    var cell = Math.max(5, Math.min(18, Math.floor(avail / Bx) - 1, Math.floor(400 / By)));
    grid.style.gridTemplateColumns = 'repeat(' + Bx + ', ' + cell + 'px)';
    grid.innerHTML = '';
    for (var t = 0; t < n; t++) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'bl-cell';
      b.style.width = cell + 'px'; b.style.height = cell + 'px';
      var w = Math.floor(t / 32);
      b.style.background = TINTS[w % TINTS.length];
      b.setAttribute('aria-label', 'thread x ' + (t % Bx) + ', y ' + Math.floor(t / Bx) + ', warp ' + w);
      if (t % 32 === 0 && cell >= 12) b.textContent = 'w' + w;
      (function (tt) { b.addEventListener('click', function () { selected = tt; show(); }); })(t);
      grid.appendChild(b);
    }
    show();
  }

  function show() {
    var s = SHAPES[+sel.value], Bx = s[0], By = s[1], n = Bx * By, map = mapSel.value;
    var x = selected % Bx, y = Math.floor(selected / Bx);
    var w = Math.floor(selected / 32), lane = selected % 32;
    var cells = grid.children;
    for (var i = 0; i < cells.length; i++) {
      var inWarp = Math.floor(i / 32) === w;
      cells[i].classList.toggle('bl-warp', inWarp);
      cells[i].classList.toggle('bl-sel', i === selected);
      cells[i].setAttribute('aria-pressed', i === selected ? 'true' : 'false');
    }
    var rc = rowcol(x, y, map);
    $('bl-t').textContent = '(' + x + ', ' + y + ')';
    $('bl-tid').textContent = selected + ' = ' + x + ' + ' + y + '·' + Bx;
    $('bl-wl').textContent = w + ' · ' + lane;
    $('bl-rc').textContent = '[' + rc[0] + '][' + rc[1] + ']';

    // what this warp's store touches
    var first = w * 32, last = Math.min(first + 32, n), active = last - first;
    var rows = {}, sectors = {};
    for (var t = first; t < last; t++) {
      var p = rowcol(t % Bx, Math.floor(t / Bx), map);
      rows[p[0]] = 1;
      sectors[Math.floor(((p[0] * WIDTH + p[1]) * 4) / 32)] = 1;
    }
    var nRows = Object.keys(rows).length, nSec = Object.keys(sectors).length;
    var ideal = Math.ceil(active * 4 / 32);
    var warps = Math.ceil(n / 32), idle = warps * 32 - n;
    var v = $('bl-v');
    var msg = 'Warp ' + w + ': ' + active + ' active lane' + (active === 1 ? '' : 's') +
      ', spans ' + nRows + ' row' + (nRows === 1 ? '' : 's') + ' of the image, touches ' + nSec +
      ' memory sector' + (nSec === 1 ? '' : 's') + ' of 32 bytes (ideal: ' + ideal + '). ' +
      'This block = ' + warps + ' warp' + (warps === 1 ? '' : 's') +
      (idle ? ', with ' + idle + ' lanes of the last one idle.' : ', none partial.');
    v.textContent = msg;
    v.className = 'w-verdict ' + (nSec <= ideal ? 'comp' : nSec <= 2 * ideal ? 'mem' : 'bad');
  }

  sel.addEventListener('change', function () { selected = 0; render(); });
  window.addEventListener('resize', function () { render(); });
  mapSel.addEventListener('change', show);
  render();
})();
