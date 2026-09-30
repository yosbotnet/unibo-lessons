/* bank-viz.js — shared-memory bank conflicts for one warp's 4-byte access.
   32 banks, 4 bytes wide; bank = (word index) mod 32. Lanes reading the SAME
   word are served together (broadcast); distinct words in the same bank are
   serialized. Passes = max over banks of distinct words requested. */
(function () {
  'use strict';
  var host = document.getElementById('w-banks');
  if (!host) return;

  var P = {
    row:  { label: 'tile[r][lane] — a row of a [32][32] tile', w: function (l) { return 5 * 32 + l; } },
    col:  { label: 'tile[lane][c] — a column of a [32][32] tile', w: function (l) { return l * 32 + 5; } },
    pad:  { label: 'tile[lane][c] — a column of a [32][33] tile (padded)', w: function (l) { return l * 33 + 5; } },
    s2:   { label: 's[2*lane] — stride 2', w: function (l) { return 2 * l; } },
    s3:   { label: 's[3*lane] — stride 3 (odd)', w: function (l) { return 3 * l; } },
    s16:  { label: 's[16*lane] — stride 16', w: function (l) { return 16 * l; } },
    bc:   { label: 's[k] — every lane the same word', w: function () { return 7; } },
    half: { label: 's[lane / 2] — pairs of lanes share a word', w: function (l) { return l >> 1; } },
    swz:  { label: 'tile[lane][c ^ lane] — XOR swizzle, [32][32], no padding', w: function (l) { return l * 32 + ((5 ^ l) & 31); } }
  };

  host.innerHTML =
    '<h4>Shared memory: 32 banks, one warp</h4>' +
    '<p class="w-sub">Each column is a bank. Each block is a distinct 4-byte word the warp asks that bank for. The tallest column sets the number of passes.</p>' +
    '<div class="w-controls"><label>Access<select id="bk-p"></select></label></div>' +
    '<div class="bk-grid" id="bk-g" aria-hidden="true"></div>' +
    '<div class="bk-axis" id="bk-ax" aria-hidden="true"></div>' +
    '<div class="w-out" style="margin-top:.8rem">' +
      '<div class="w-stat"><span class="k">passes</span><span class="v" id="bk-n"></span></div>' +
      '<div class="w-stat"><span class="k">banks used</span><span class="v" id="bk-b"></span></div>' +
      '<div class="w-stat"><span class="k">shared-memory throughput</span><span class="v" id="bk-t"></span></div>' +
    '</div>' +
    '<div class="w-verdict" id="bk-v" role="status" aria-live="polite"></div>';

  var sel = host.querySelector('#bk-p');
  Object.keys(P).forEach(function (k) {
    var o = document.createElement('option'); o.value = k; o.textContent = P[k].label; sel.appendChild(o);
  });
  var ax = host.querySelector('#bk-ax');
  for (var b = 0; b < 32; b++) { var s = document.createElement('span'); s.textContent = b; ax.appendChild(s); }
  function $(id) { return host.querySelector('#' + id); }

  function update() {
    var p = P[sel.value], words = [];
    for (var b = 0; b < 32; b++) words.push({});
    var lanesPerWord = {};
    for (var l = 0; l < 32; l++) {
      var w = p.w(l);
      words[w % 32][w] = true;
      lanesPerWord[w] = (lanesPerWord[w] || 0) + 1;
    }
    var counts = words.map(function (o) { return Object.keys(o).length; });
    var passes = Math.max.apply(null, counts);
    var used = counts.filter(function (c) { return c > 0; }).length;

    var g = $('bk-g'); g.innerHTML = '';
    counts.forEach(function (c, bank) {
      var col = document.createElement('div');
      col.className = 'bk-col' + (c === passes && passes > 1 ? ' worst' : '');
      Object.keys(words[bank]).forEach(function (w) {
        var cell = document.createElement('div');
        cell.className = 'bk-cell' + (lanesPerWord[w] > 1 ? ' bc' : '');
        col.appendChild(cell);
      });
      g.appendChild(col);
    });
    $('bk-n').textContent = passes;
    $('bk-b').textContent = used + ' / 32';
    $('bk-t').textContent = Math.round(100 / passes) + '%';
    var v = $('bk-v');
    if (passes === 1) {
      v.className = 'w-verdict comp';
      v.textContent = used < 32 ? 'Conflict-free: lanes that share a word get it by broadcast (green), so one pass serves the whole warp.' : 'Conflict-free: 32 lanes, 32 different banks, one pass.';
    } else {
      v.className = 'w-verdict bad';
      v.textContent = passes + '-way bank conflict: the hardware splits this access into ' + passes + ' passes, so this instruction runs at 1/' + passes + ' of shared-memory speed.';
    }
  }
  sel.addEventListener('change', update);
  update();
})();
