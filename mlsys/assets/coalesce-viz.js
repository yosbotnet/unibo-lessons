/* coalesce-viz.js — which 32-byte sectors does one warp's load touch?
   Model (CUDA Best Practices Guide, CC >= 6.0): a warp's request is served by
   as many 32-byte sectors as its 32 addresses cover. Efficiency = useful bytes /
   fetched bytes. */
(function () {
  'use strict';
  var host = document.getElementById('w-coalesce');
  if (!host) return;

  // each pattern returns [byteAddress, bytesPerThread] for lane l (0..31)
  var P = {
    c1:  { label: 'a[i] — consecutive floats', f: function (l) { return [4 * l, 4]; } },
    s2:  { label: 'a[2*i] — stride 2', f: function (l) { return [8 * l, 4]; } },
    s4:  { label: 'a[4*i] — stride 4 (AoS: x of a float4 struct)', f: function (l) { return [16 * l, 4]; } },
    s8:  { label: 'a[8*i] — stride 8', f: function (l) { return [32 * l, 4]; } },
    s32: { label: 'M[i][k] — a column of a 1024-wide row-major matrix', f: function (l) { return [4096 * l, 4]; } },
    off: { label: 'a[i + 3] — consecutive, misaligned by 12 bytes', f: function (l) { return [4 * l + 12, 4]; } },
    bc:  { label: 'a[k] — the same float for every lane (uniform)', f: function () { return [0, 4]; } },
    v4:  { label: 'reinterpret_cast<float4*>(a)[i] — 16 bytes per lane', f: function (l) { return [16 * l, 16]; } },
    rnd: { label: 'a[perm[i]] — random gather within 64 KB', f: function (l) { var x = (l * 2654435761) >>> 0; return [((x >>> 8) % 16384) * 4, 4]; } }
  };

  host.innerHTML =
    '<h4>One warp, one load: which sectors move?</h4>' +
    '<p class="w-sub">Memory moves in 32-byte sectors. Pick what the 32 lanes of a warp read and count the sectors.</p>' +
    '<div class="w-controls"><label>Access pattern<select id="cz-p"></select></label></div>' +
    '<p class="cz-note">the 32 lanes of the warp (number = sector each lane lands in)</p>' +
    '<div class="cz-lanes" id="cz-lanes" aria-hidden="true"></div>' +
    '<p class="cz-note" id="cz-maplabel"></p>' +
    '<div class="cz-map" id="cz-map" aria-hidden="true"></div>' +
    '<div class="cz-legend"><span><i class="u"></i>bytes a lane asked for</span><span><i class="h"></i>fetched, unused</span><span><i class="e"></i>not fetched</span></div>' +
    '<div class="w-out">' +
      '<div class="w-stat"><span class="k">sectors touched</span><span class="v" id="cz-s"></span></div>' +
      '<div class="w-stat"><span class="k">bytes moved</span><span class="v" id="cz-b"></span></div>' +
      '<div class="w-stat"><span class="k">bytes used</span><span class="v" id="cz-u"></span></div>' +
      '<div class="w-stat"><span class="k">efficiency</span><span class="v" id="cz-e"></span></div>' +
    '</div>' +
    '<div class="w-verdict" id="cz-v" role="status" aria-live="polite"></div>';

  var sel = host.querySelector('#cz-p');
  Object.keys(P).forEach(function (k) {
    var o = document.createElement('option'); o.value = k; o.textContent = P[k].label; sel.appendChild(o);
  });
  function $(id) { return host.querySelector('#' + id); }

  function update() {
    var p = P[sel.value];
    var sectors = {}, used = {}, laneSec = [], usefulBytes = 0, distinct = {};
    for (var l = 0; l < 32; l++) {
      var r = p.f(l), a = r[0], w = r[1];
      laneSec.push(Math.floor(a / 32));
      for (var b = a; b < a + w; b++) {
        var s = Math.floor(b / 32);
        sectors[s] = true;
        used[s] = used[s] || {};
        used[s][b % 32] = true;
        if (!distinct[b]) { distinct[b] = true; usefulBytes++; }
      }
    }
    var keys = Object.keys(sectors).map(Number).sort(function (x, y) { return x - y; });
    var n = keys.length, moved = 32 * n;

    // lanes row
    var lanes = $('cz-lanes'); lanes.innerHTML = '';
    var secIndex = {}; keys.forEach(function (s, i) { secIndex[s] = i; });
    laneSec.forEach(function (s) {
      var d = document.createElement('div'); d.className = 'cz-lane'; d.textContent = secIndex[s]; lanes.appendChild(d);
    });

    // sector map: contiguous window if small, else only the touched sectors
    var lo = keys[0], hi = keys[n - 1], span = hi - lo + 1, cells;
    if (span <= 48) { cells = []; for (var s2 = lo; s2 <= hi; s2++) cells.push(s2); $('cz-maplabel').textContent = 'memory, one cell per 32-byte sector (' + span + ' contiguous sectors shown)'; }
    else { cells = keys; $('cz-maplabel').textContent = 'the ' + n + ' touched sectors (they are spread over ' + (span * 32 / 1024).toFixed(0) + ' KB, gaps not drawn)'; }
    var map = $('cz-map'); map.innerHTML = '';
    var cols = Math.min(16, cells.length);
    map.style.gridTemplateColumns = 'repeat(' + cols + ',1fr)';
    cells.forEach(function (s) {
      var d = document.createElement('div');
      d.className = 'cz-sec' + (sectors[s] ? ' hit' : '') + (sel.value === 'bc' ? ' bcast' : '');
      if (used[s]) { var u = document.createElement('div'); u.className = 'use'; u.style.width = (100 * Object.keys(used[s]).length / 32) + '%'; d.appendChild(u); }
      map.appendChild(d);
    });

    var eff = usefulBytes / moved;
    $('cz-s').textContent = n;
    $('cz-b').textContent = moved + ' B';
    if (sel.value === 'bc') {  // one word, delivered 32 times: count bytes delivered, not distinct bytes
      $('cz-u').textContent = '4 B × 32 lanes';
      $('cz-e').textContent = 'n/a';
    } else {
      $('cz-u').textContent = usefulBytes + ' B';
      $('cz-e').textContent = Math.round(100 * eff) + '%';
    }
    var v = $('cz-v');
    if (sel.value === 'bc') { v.className = 'w-verdict comp'; v.textContent = 'Broadcast: one sector, one float, delivered to all 32 lanes. Uniform addresses are cheap, never a coalescing problem.'; }
    else if (eff >= 0.99) { v.className = 'w-verdict comp'; v.textContent = 'Perfectly coalesced: every byte moved is used. ' + (moved > 128 ? 'Wider loads move more per request: fewer instructions for the same bytes.' : 'This is the pattern to aim for.'); }
    else if (eff >= 0.7) { v.className = 'w-verdict mem'; v.textContent = 'Nearly coalesced: ' + n + ' sectors instead of ' + Math.ceil(usefulBytes / 32) + '. A small, usually acceptable tax.'; }
    else { v.className = 'w-verdict bad'; v.textContent = 'Uncoalesced: ' + Math.round(100 * (1 - eff)) + '% of the bytes moved are thrown away. A memory-bound kernel with this pattern runs at ' + Math.round(100 * eff) + '% of its possible speed.'; }
  }
  sel.addEventListener('change', update);
  update();
})();
