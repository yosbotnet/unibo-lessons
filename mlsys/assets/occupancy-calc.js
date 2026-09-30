/* occupancy-calc.js — how many blocks of a kernel fit on one SM, and which
   resource runs out first. Rules follow NVIDIA's occupancy calculator:
   registers are allocated per warp in units of 256 and each of the SM's four
   quadrants owns a quarter of the register file; shared memory is allocated in
   128-byte units plus 1 KB reserved by CUDA per block. The CUDA occupancy API
   (printed by lab 1) is the authority if the two ever disagree. */
(function () {
  'use strict';
  var host = document.getElementById('w-occ');
  if (!host) return;

  var ARCH = {
    cc120: { name: 'CC 12.0 · RTX 5070', threads: 1536, warps: 48, blocks: 24, regs: 65536, smem: 100 * 1024, smemBlock: 99 * 1024 },
    cc90:  { name: 'CC 9.0 · H100', threads: 2048, warps: 64, blocks: 32, regs: 65536, smem: 228 * 1024, smemBlock: 227 * 1024 }
  };

  host.innerHTML =
    '<h4>Occupancy calculator</h4>' +
    '<p class="w-sub">Three numbers describe a kernel\'s appetite. Four limits decide how many of its blocks an SM can hold.</p>' +
    '<div class="w-controls">' +
      '<label>GPU<select id="oc-arch"><option value="cc120">CC 12.0 · RTX 5070</option><option value="cc90">CC 9.0 · H100</option></select></label>' +
      '<label>Threads per block: <output id="oc-t-out"></output><input id="oc-t" type="range" min="1" max="32" step="1" value="8"></label>' +
      '<label>Registers per thread: <output id="oc-r-out"></output><input id="oc-r" type="range" min="16" max="255" step="1" value="32"></label>' +
      '<label>Shared memory per block: <output id="oc-s-out"></output><input id="oc-s" type="range" min="0" max="99" step="1" value="0"></label>' +
    '</div>' +
    '<div class="w-bars" id="oc-bars"></div>' +
    '<div class="w-out" style="margin-top:.8rem">' +
      '<div class="w-stat"><span class="k">blocks per SM</span><span class="v" id="oc-b"></span></div>' +
      '<div class="w-stat"><span class="k">warps per SM</span><span class="v" id="oc-w"></span></div>' +
      '<div class="w-stat"><span class="k">threads per SM</span><span class="v" id="oc-th"></span></div>' +
      '<div class="w-stat"><span class="k">occupancy</span><span class="v" id="oc-o"></span></div>' +
    '</div>' +
    '<div class="w-verdict" id="oc-v" role="status" aria-live="polite"></div>';

  function $(id) { return host.querySelector('#' + id); }
  var LIMITS = [['slots', 'block slots'], ['threads', 'thread slots'], ['regs', 'registers'], ['smem', 'shared memory']];
  var bars = $('oc-bars');
  LIMITS.forEach(function (L) {
    var row = document.createElement('div'); row.className = 'w-bar';
    row.innerHTML = '<span>' + L[1] + '</span><div class="track"><div class="fill" id="oc-f-' + L[0] + '"></div></div><span class="num" id="oc-n-' + L[0] + '"></span>';
    bars.appendChild(row);
  });

  function update() {
    var A = ARCH[$('oc-arch').value];
    var threads = 32 * +$('oc-t').value;
    var regs = +$('oc-r').value;
    var smemKB = Math.min(+$('oc-s').value, A.smemBlock / 1024);
    var smem = smemKB * 1024;
    var warpsPerBlock = threads / 32;

    var bySlots = A.blocks;
    var byThreads = Math.floor(A.warps / warpsPerBlock);
    var regsPerWarp = Math.ceil(regs * 32 / 256) * 256;
    var warpsByRegs = 4 * Math.floor((A.regs / 4) / regsPerWarp);  // each quadrant owns 1/4 of the file
    var byRegs = Math.floor(warpsByRegs / warpsPerBlock);
    var smemPerBlock = Math.ceil(smem / 128) * 128 + 1024;
    var bySmem = Math.floor(A.smem / smemPerBlock);

    var lim = { slots: bySlots, threads: byThreads, regs: byRegs, smem: bySmem };
    var blocks = Math.min(bySlots, byThreads, byRegs, bySmem);
    var binding = LIMITS.filter(function (L) { return lim[L[0]] === blocks; }).map(function (L) { return L[1]; });
    var maxShown = Math.max(1, Math.min(A.blocks, Math.max(bySlots, byThreads, byRegs, bySmem)));
    LIMITS.forEach(function (L) {
      var v = lim[L[0]], f = $('oc-f-' + L[0]);
      f.style.width = Math.min(100, 100 * v / maxShown) + '%';
      f.className = 'fill' + (v === blocks ? ' bind' : '');
      $('oc-n-' + L[0]).textContent = v > 99 ? '≥ 99' : v + ' blk';
    });

    var warps = blocks * warpsPerBlock, occ = warps / A.warps;
    $('oc-t-out').textContent = threads;
    $('oc-r-out').textContent = regs;
    $('oc-s-out').textContent = smemKB + ' KB';
    $('oc-b').textContent = blocks;
    $('oc-w').textContent = warps + ' / ' + A.warps;
    $('oc-th').textContent = warps * 32;
    $('oc-o').textContent = Math.round(100 * occ) + '%';
    var v = $('oc-v');
    if (blocks === 0) {
      v.className = 'w-verdict bad';
      v.textContent = 'The kernel cannot launch: one block needs more ' + binding.join(' and ') + ' than an SM has.';
    } else {
      v.className = 'w-verdict ' + (occ >= 0.99 ? 'comp' : occ >= 0.5 ? 'mem' : 'bad');
      v.textContent = 'Limited by ' + binding.join(' and ') + '. ' +
        (regsPerWarp !== regs * 32 ? 'Registers are allocated per warp in units of 256: ' + regs + ' × 32 = ' + regs * 32 + ' is rounded up to ' + regsPerWarp + '. ' : '') +
        (occ >= 0.99 ? 'Full occupancy.' : 'The SM holds ' + warps + ' of its ' + A.warps + ' possible warps.');
    }
  }
  ['oc-arch', 'oc-t', 'oc-r', 'oc-s'].forEach(function (id) {
    $(id).addEventListener('input', update); $(id).addEventListener('change', update);
  });
  update();
})();
