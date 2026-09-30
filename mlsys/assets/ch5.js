/* ch5.js — chapter 5 widgets: the reduction stepper and the stall-reason explorer. */
(function () {
  'use strict';
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  /* ---------------- reduction stepper ----------------
     One 256-thread block, 8 warps x 32 lanes, 8 levels of the tree.
     For each version and level: which threads add, and which shared-memory
     word they write (to count bank conflicts on that access). */
  var host = document.getElementById('w-reduce');
  if (host) {
    var BLOCK = 256, LEVELS = 8;
    var VERSIONS = {
      v1: { label: 'v1 interleaved', active: function (t, L) { var s = 1 << L; return t % (2 * s) === 0; }, addr: function (t) { return t; },
            code: 'if (tid % (2*stride) == 0) s[tid] += s[tid + stride];', stride: function (L) { return 1 << L; } },
      v2: { label: 'v2 compact index', active: function (t, L) { var s = 1 << L; return 2 * s * t < BLOCK; }, addr: function (t, L) { return 2 * (1 << L) * t; },
            code: 'idx = 2*stride*tid; if (idx < 256) s[idx] += s[idx + stride];', stride: function (L) { return 1 << L; } },
      v3: { label: 'v3 sequential', active: function (t, L) { return t < (BLOCK >> (L + 1)); }, addr: function (t) { return t; },
            code: 'if (tid < stride) s[tid] += s[tid + stride];', stride: function (L) { return BLOCK >> (L + 1); } }
    };
    var state = { v: 'v1', L: 0 };

    host.innerHTML = '';
    host.appendChild(el('h4', null, 'Reduction stepper: one block of 256 threads'));
    host.appendChild(el('p', 'w-sub', 'Pick a version and step through the 8 levels of the tree. Each row is a warp, each cell a lane. The compiler predicates all three versions, so every warp issues every level’s instructions: what differs is which lanes are switched on, and so how much shared-memory traffic each level causes. Red lanes share a bank with another active lane of their warp.'));

    var btns = el('div', 'rd-btns');
    var vbtn = {};
    Object.keys(VERSIONS).forEach(function (k) {
      var b = el('button', null, VERSIONS[k].label); b.type = 'button';
      b.addEventListener('click', function () { state.v = k; render(); });
      vbtn[k] = b; btns.appendChild(b);
    });
    btns.appendChild(el('span', 'rd-sep'));
    var prev = el('button', null, '◀ level'); prev.type = 'button';
    var next = el('button', null, 'level ▶'); next.type = 'button';
    prev.addEventListener('click', function () { if (state.L > 0) { state.L--; render(); } });
    next.addEventListener('click', function () { if (state.L < LEVELS - 1) { state.L++; render(); } });
    btns.appendChild(prev); btns.appendChild(next);
    host.appendChild(btns);

    var code = el('pre'); code.style.margin = '.2rem 0 .5rem'; code.style.fontSize = '.78rem';
    host.appendChild(code);
    var legend = el('div', 'rd-legend');
    legend.innerHTML = '<span><i class="on"></i>adds this level</span><span><i class="cf"></i>adds, bank conflict</span><span><i class="off"></i>predicated off</span>';
    host.appendChild(legend);

    var grid = el('div', 'rd-grid'); grid.setAttribute('aria-hidden', 'true');
    var cells = [], tags = [];
    for (var w = 0; w < 8; w++) {
      grid.appendChild(el('span', 'rd-wlabel', 'warp ' + w));
      var lanes = el('div', 'rd-lanes'); cells.push([]);
      for (var l = 0; l < 32; l++) { var c = el('span', 'rd-lane'); lanes.appendChild(c); cells[w].push(c); }
      grid.appendChild(lanes);
      var tg = el('span', 'rd-tag'); grid.appendChild(tg); tags.push(tg);
    }
    host.appendChild(grid);

    var out = el('div', 'w-out');
    function stat(k) { var d = el('div', 'w-stat'); d.appendChild(el('span', 'k', k)); var v = el('span', 'v'); d.appendChild(v); out.appendChild(d); return v; }
    var sLevel = stat('level · stride'), sAct = stat('lanes adding'), sWarps = stat('warps sending smem loads'),
        sBank = stat('worst bank conflict'), sWave = stat('smem load passes, this level'), sTot = stat('smem load passes, all levels');
    host.appendChild(out);
    var verdict = el('div', 'w-verdict'); verdict.setAttribute('role', 'status'); verdict.setAttribute('aria-live', 'polite');
    host.appendChild(verdict);

    // Per level: which lanes add, how many warps have at least one such lane
    // (only those send a shared-memory request: an instruction with every lane
    // predicated off touches no memory), the worst bank conflict, and the
    // number of shared-memory passes ("wavefronts") for the level's two loads.
    function levelInfo(V, L) {
      var warps = [], sending = 0, active = 0, worst = 1, waves = 0;
      for (var w = 0; w < 8; w++) {
        var lanes = [], n = 0, banks = {};
        for (var l = 0; l < 32; l++) {
          var t = w * 32 + l, on = V.active(t, L);
          lanes.push(on);
          if (on) { n++; var b = V.addr(t, L) % 32; banks[b] = (banks[b] || 0) + 1; }
        }
        var deg = 1; Object.keys(banks).forEach(function (b) { if (banks[b] > deg) deg = banks[b]; });
        if (n) { sending++; waves += 2 * deg; if (deg > worst) worst = deg; }
        active += n;
        warps.push({ lanes: lanes, n: n, banks: banks });
      }
      return { warps: warps, sending: sending, active: active, worst: worst, waves: waves };
    }
    function totalWaves(V) { var s = 0; for (var L = 0; L < LEVELS; L++) s += levelInfo(V, L).waves; return s; }

    function render() {
      var V = VERSIONS[state.v], L = state.L, info = levelInfo(V, L), tot = totalWaves(V);
      Object.keys(vbtn).forEach(function (k) { vbtn[k].setAttribute('aria-pressed', k === state.v ? 'true' : 'false'); });
      prev.disabled = L === 0; next.disabled = L === LEVELS - 1;
      code.textContent = V.code;
      info.warps.forEach(function (wi, w) {
        wi.lanes.forEach(function (on, l) {
          var t = w * 32 + l, cls = 'rd-lane';
          if (on) cls += (wi.banks[V.addr(t, L) % 32] > 1 ? ' cf' : ' on');
          cells[w][l].className = cls;
        });
        var tag = tags[w];
        if (!wi.n) { tag.textContent = 'all off'; tag.className = 'rd-tag'; }
        else if (wi.n === 32) { tag.textContent = '32/32'; tag.className = 'rd-tag full'; }
        else { tag.textContent = wi.n + '/32'; tag.className = 'rd-tag div'; }
      });
      sLevel.textContent = (L + 1) + ' · ' + V.stride(L);
      sAct.textContent = info.active;
      sWarps.textContent = info.sending + ' of 8';
      sBank.textContent = info.worst === 1 ? 'none' : info.worst + '-way';
      sWave.textContent = info.waves;
      sTot.textContent = tot + ' per block';
      var msg;
      if (state.v === 'v1') msg = 'The ' + info.active + ' adding lanes are spread over ' + info.sending + ' warps, and every one of those warps sends its own nearly-empty shared-memory request. Over the whole tree: ' + tot + ' passes per block, against 24 when the same work is packed (v3).';
      else if (state.v === 'v2') msg = info.worst > 1 ? 'Packed: only ' + info.sending + (info.sending > 1 ? ' warps send' : ' warp sends') + ' requests. But lane t touches word ' + (2 * V.stride(L)) + '·t, so neighbours share banks: ' + (info.worst === 8 ? 'an ' : 'a ') + info.worst + '-way conflict, and each request takes ' + info.worst + ' passes. Total: ' + tot + ' passes per block, the same as v1 for a different reason.' : 'One lane left: no conflict possible.';
      else msg = 'Packed and conflict-free: ' + info.sending + (info.sending > 1 ? ' warps send' : ' warp sends') + ' one-pass requests, the rest are predicated off entirely. ' + tot + ' passes per block, the minimum for this tree.';
      verdict.className = 'w-verdict ' + (state.v === 'v3' ? 'comp' : 'mem');
      verdict.textContent = msg;
    }
    render();
  }

  /* ---------------- stall-reason explorer ---------------- */
  var sh = document.getElementById('w-stalls');
  if (sh) {
    var R = [
      { k: 'long_scoreboard', what: 'The warp needs the result of a global (or local) memory load that has not come back yet.',
        cause: 'Waiting on DRAM or L2. Normal, and dominant, in any memory-bound kernel. Also the signature of register spills (local memory).',
        fix: 'If DRAM throughput is already near the ceiling: nothing, you are done. If not: more bytes in flight (wider loads, more independent loads per thread, more warps), better coalescing.',
        where: 'v6 and CUB in lab 4: the stall you want to see when the kernel is at the roofline.' },
      { k: 'barrier', what: 'The warp reached __syncthreads() and waits for the other warps of its block.',
        cause: 'Many barriers with little work between them, or unequal work so some warps arrive late.',
        fix: 'Fewer barriers (do more work per level, finish with warp shuffles), balance work across warps.',
        where: 'v1–v3: eight barriers for every 256 elements. v4 and v5 cut them.' },
      { k: 'short_scoreboard', what: 'The warp waits for a shared-memory access (or a special-function instruction like sin/exp) to finish.',
        cause: 'Heavy shared-memory traffic; made much worse by bank conflicts, which turn one access into many passes.',
        fix: 'Remove bank conflicts (padding, swizzle), keep hot values in registers, use shuffles instead of shared memory.',
        where: 'v2 (conflicts) and the unpadded transpose.' },
      { k: 'mio_throttle', what: 'The queue feeding shared memory and other "memory input/output" instructions is full.',
        cause: 'Too many shared-memory instructions in flight, often amplified by conflicts.',
        fix: 'Fewer, wider shared-memory accesses; remove conflicts.',
        where: 'The unpadded transpose: every column read is 32 passes.' },
      { k: 'lg_throttle', what: 'The queue for local/global memory instructions is full.',
        cause: 'A flood of small global loads, or local-memory traffic from spills.',
        fix: 'Wider loads (float4: one instruction instead of four), remove spills.',
        where: 'Scalar-load kernels; v6 uses 16-byte loads partly to avoid it.' },
      { k: 'math_pipe_throttle', what: 'The arithmetic unit the warp needs (FMA, tensor, ALU…) is busy with other warps.',
        cause: 'Compute-bound code, or all warps hammering the same pipe.',
        fix: 'This is the good kind of bottleneck: reduce FLOPs, use a faster pipe (tensor cores, lower precision), or balance the instruction mix.',
        where: 'Part II matmuls, once they are tiled well.' },
      { k: 'wait', what: 'A fixed-latency dependency: the next instruction needs the result of the previous arithmetic op, a few cycles away.',
        cause: 'Long chains of dependent instructions with few warps to switch to.',
        fix: 'More independent work per thread (ILP), or more warps.',
        where: 'Tight arithmetic loops; small in lab 4.' },
      { k: 'branch_resolving', what: 'The warp waits for a branch target to be computed and its program counter updated.',
        cause: 'Lots of branches, especially divergent ones.',
        fix: 'Uniform conditions, fewer branches, let the compiler predicate short ones.',
        where: 'Kernels with long divergent branches. Lab 4’s trees compile to predicated code, so you will see little of it there.' },
      { k: 'no_instruction', what: 'The warp has no instruction fetched yet: instruction-cache miss or it was not picked to fetch.',
        cause: 'Very short kernels (less than a wave of work), or huge unrolled code.',
        fix: 'Give the kernel more work, or shrink the code.',
        where: 'The tiny kernels of the launch-gap demo.' },
      { k: 'not_selected', what: 'Not a stall: the warp was ready, but the scheduler issued a different ready warp this cycle.',
        cause: 'Plenty of ready warps. A sign of healthy latency hiding.',
        fix: 'Nothing. If it is large you may even afford fewer warps (more registers per thread).',
        where: 'Any kernel with more warps than it needs.' },
      { k: 'drain', what: 'The warp has exited and waits for its outstanding stores to complete.',
        cause: 'Many writes at the very end of a kernel.',
        fix: 'Make the final stores coalesced; usually minor.',
        where: 'Copy and transpose kernels, a little.' }
    ];
    sh.innerHTML = '';
    sh.appendChild(el('h4', null, 'Stall reasons, decoded'));
    sh.appendChild(el('p', 'w-sub', 'Nsight Compute samples each warp and records why it did not issue. Pick a reason (the names match the metric suffixes, e.g. smsp__average_warps_issue_stalled_barrier_per_issue_active).'));
    var g = el('div', 'st-grid'); g.setAttribute('role', 'group'); g.setAttribute('aria-label', 'Stall reasons');
    var panel = el('div', 'st-panel'); panel.setAttribute('aria-live', 'polite');
    var bs = [];
    R.forEach(function (r, i) {
      var b = el('button', null, r.k); b.type = 'button'; b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () { show(i); });
      bs.push(b); g.appendChild(b);
    });
    sh.appendChild(g); sh.appendChild(panel);
    function show(i) {
      var r = R[i];
      bs.forEach(function (b, j) { b.setAttribute('aria-pressed', i === j ? 'true' : 'false'); });
      panel.innerHTML = '';
      panel.appendChild(el('h4', null, 'stalled_' + r.k));
      var dl = el('dl');
      [['waiting for', r.what], ['usual cause', r.cause], ['what to try', r.fix], ['in this course', r.where]].forEach(function (p) {
        dl.appendChild(el('dt', null, p[0])); dl.appendChild(el('dd', null, p[1]));
      });
      panel.appendChild(dl);
    }
    show(0);
  }
})();
