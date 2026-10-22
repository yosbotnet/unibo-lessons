/* ch12.js - chapter 12 widgets: the tile-over-a-ragged-edge explorer (w-tile) and
   "who decides what" (w-who), CUDA's t3 next to the Triton matmul. */
(function () {
  'use strict';
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function btn(txt) { var b = el('button', null, txt); b.type = 'button'; return b; }
  function stat(parent, k) { var d = el('div', 'w-stat'); d.appendChild(el('span', 'k', k)); var v = el('span', 'v'); d.appendChild(v); parent.appendChild(d); return v; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function btnRow(parent, label, opts, onPick) {
    var row = el('div', 'c12-row'); row.appendChild(el('span', 'c12-lab', label));
    var g = el('div', 'c12-btns'); g.setAttribute('role', 'group'); g.setAttribute('aria-label', label);
    var bs = opts.map(function (o) { var b = btn(String(o)); b.addEventListener('click', function () { onPick(o); }); g.appendChild(b); return b; });
    row.appendChild(g); parent.appendChild(row);
    return function (cur) { bs.forEach(function (b, i) { b.setAttribute('aria-pressed', String(opts[i] === cur)); }); };
  }

  /* ================= w-tile: a tile over a ragged edge ================= */
  var th = document.getElementById('w-tile');
  if (th) {
    var LPW = 4;                                   // toy warp: 4 lanes (the card's have 32)
    var TINT = [0.95, 0.7, 0.5, 0.32];             // cobalt opacity by lane
    var st = { n: 50, B: 16, W: 1, pid: 0 };
    th.innerHTML = '';
    th.appendChild(el('h4', null, 'A tile over a ragged edge'));
    th.appendChild(el('p', 'w-sub', 'The array x has n floats; the grid has cdiv(n, BLOCK) programs, and program pid loads x[pid \u00b7 BLOCK ...] as one tile. Inside the tile, each element is held by one thread (a blocked layout: runs of 4 consecutive elements, one 16-byte load each). Toy: warps of 4 lanes; your card\u2019s are 32. BLOCK 32 with one toy warp is the chapter\u2019s 1,024 elements over 4 warps in miniature: 8 elements per thread, two groups of 4.'));
    var ctr = el('div', 'w-controls');
    function slider(label, min, max, val) {
      var l = el('label'); l.appendChild(document.createTextNode(label + ' '));
      var o = el('output'); l.appendChild(o);
      var r = el('input'); r.type = 'range'; r.min = min; r.max = max; r.step = 1; r.value = val;
      l.appendChild(r); ctr.appendChild(l); return { r: r, o: o };
    }
    var sN = slider('n (array length)', 1, 64, st.n);
    var sP = slider('pid (which program)', 0, 3, st.pid);
    th.appendChild(ctr);
    var setB = btnRow(th, 'BLOCK', [8, 16, 32, 64], function (v) { st.B = v; render(); });
    var setW = btnRow(th, 'num_warps', [1, 2, 4], function (v) { st.W = v; render(); });
    var wrap = el('div'); th.appendChild(wrap);
    var key = el('div', 'c12-key');
    key.innerHTML = '<span><i class="lanes"></i>the 4 lanes of a toy warp (label = thread)</span>' +
      '<span><i class="mask"></i>masked lane (index &ge; n): no load issued</span>' +
      '<span><i class="past"></i>past the end of x: in the tile, not in memory</span><span><i class="end"></i>the end of x</span>';
    th.appendChild(key);
    var out = el('div', 'w-out');
    var vP = stat(out, 'programs'), vE = stat(out, 'elements / thread'), vL = stat(out, 'loads / thread'),
      vM = stat(out, 'masked lanes, this program'), vX = stat(out, 'wasted lanes, whole grid');
    th.appendChild(out);
    var ver = el('div', 'w-verdict'); ver.setAttribute('aria-live', 'polite'); th.appendChild(ver);

    sN.r.addEventListener('input', function () { st.n = +sN.r.value; render(); });
    sP.r.addEventListener('input', function () { st.pid = +sP.r.value; render(); });
    var lastW = 0;
    window.addEventListener('resize', function () { if (Math.abs(wrap.clientWidth - lastW) > 8) render(); });

    function model() {
      var n = st.n, B = st.B, T = st.W * LPW, P = Math.ceil(n / B);
      var pid = Math.min(st.pid, P - 1);
      var ept = B / T, vec = ept >= 4;
      function owner(j) { return ept < 1 ? j : (vec ? Math.floor(j / 4) % T : Math.floor(j / ept)); }
      var masked = Math.max(0, Math.min(B, pid * B + B - n));
      return { n: n, B: B, T: T, W: st.W, P: P, pid: pid, ept: ept, vec: vec, owner: owner, masked: masked,
        waste: (P * B - n) / (P * B) };
    }

    function render() {
      var m = model();
      st.pid = m.pid;
      sP.r.max = m.P - 1; sP.r.value = m.pid;
      sN.o.textContent = m.n; sP.o.textContent = m.pid + ' of ' + m.P;
      setB(st.B); setW(st.W);
      var W = Math.max(280, wrap.clientWidth || 600); lastW = W;
      var total = m.P * m.B, s = '';
      // ---- overview: the whole grid over the array
      var ox = 4, ow = W - 8, cw = ow / total, oy = 22, oh = 14;
      s += '<text x="' + ox + '" y="13" font-size="11" fill="var(--lk-ink-soft)">x: ' + m.n + ' floats, ' + m.P + ' program' + (m.P > 1 ? 's' : '') + ' of BLOCK ' + m.B + '</text>';
      for (var i = 0; i < total; i++) {
        var inMem = i < m.n, cur = Math.floor(i / m.B) === m.pid;
        s += '<rect x="' + (ox + i * cw).toFixed(2) + '" y="' + oy + '" width="' + cw.toFixed(2) + '" height="' + oh + '" fill="' +
          (cur ? 'var(--lk-cobalt)' : (inMem ? 'var(--lk-paper)' : 'none')) + '"' + (cur ? ' fill-opacity="' + (inMem ? 0.55 : 0.12) + '"' : '') +
          ' stroke="var(--lk-rule' + (inMem ? '-soft' : '') + ')" stroke-width="0.6"' + (inMem ? '' : ' stroke-dasharray="2 2"') + '/>';
      }
      for (var p = 1; p < m.P; p++) s += '<line x1="' + (ox + p * m.B * cw).toFixed(2) + '" y1="' + (oy - 3) + '" x2="' + (ox + p * m.B * cw).toFixed(2) + '" y2="' + (oy + oh + 3) + '" stroke="var(--lk-ink-soft)" stroke-width="1.2"/>';
      var ex = ox + m.n * cw;
      s += '<line x1="' + ex.toFixed(2) + '" y1="' + (oy - 5) + '" x2="' + ex.toFixed(2) + '" y2="' + (oy + oh + 5) + '" stroke="var(--lk-ink)" stroke-width="2"/>';
      // ---- zoom: the current program's tile, rows of up to 16 cells
      var R = Math.min(W < 560 ? 8 : 16, m.B), gap = m.vec ? 3 : 0, left = 52;
      var cs = Math.max(16, Math.min(36, Math.floor((W - left - 6 - gap * (R / 4 - 1)) / R)));
      var rows = Math.ceil(m.B / R), zy = oy + oh + 30, rh = cs + 8;
      var bx0 = ox + m.pid * m.B * cw, bx1 = bx0 + m.B * cw, zw = R * cs + gap * Math.max(0, R / 4 - 1);
      // connector from the current program in the overview to the zoomed tile
      s += '<path d="M' + bx0.toFixed(1) + ' ' + (oy + oh) + 'L' + left + ' ' + (zy - 4) + 'M' + bx1.toFixed(1) + ' ' + (oy + oh) + 'L' + (left + zw) + ' ' + (zy - 4) + '" stroke="var(--lk-cobalt)" stroke-width="1" fill="none" opacity=".6"/>';
      s += '<line x1="' + left + '" y1="' + (zy - 4) + '" x2="' + (left + zw) + '" y2="' + (zy - 4) + '" stroke="var(--lk-cobalt)" stroke-width="2"/>';
      var fs = cs >= 26 ? 11 : 10;
      for (var j = 0; j < m.B; j++) {
        var r = Math.floor(j / R), c = j % R, idx = m.pid * m.B + j;
        var x = left + c * cs + Math.floor(c / 4) * gap, y = zy + r * rh;
        var t = m.owner(j), lane = t % LPW, msk = idx >= m.n;
        if (c === 0) s += '<text x="' + (left - 6) + '" y="' + (y + cs / 2 + 4) + '" font-size="11" text-anchor="end" fill="var(--lk-ink-soft)">x[' + idx + ']</text>';
        if (msk) {
          s += '<rect x="' + (x + 0.5) + '" y="' + (y + 0.5) + '" width="' + (cs - 1) + '" height="' + (cs - 1) + '" fill="url(#c12-hatch)" stroke="var(--lk-vermilion)" stroke-dasharray="3 2"/>';
          s += '<text x="' + (x + cs / 2) + '" y="' + (y + cs / 2 + 4) + '" font-size="' + fs + '" text-anchor="middle" fill="var(--lk-vermilion)" font-weight="700">t' + t + '</text>';
        } else {
          s += '<rect x="' + (x + 0.5) + '" y="' + (y + 0.5) + '" width="' + (cs - 1) + '" height="' + (cs - 1) + '" fill="var(--lk-cobalt)" fill-opacity="' + TINT[lane] + '" stroke="var(--lk-cobalt-dark)" stroke-width="0.6"/>';
          s += '<text x="' + (x + cs / 2) + '" y="' + (y + cs / 2 + 4) + '" font-size="' + fs + '" text-anchor="middle" fill="' + (lane < 2 ? 'var(--lk-paper-light)' : 'var(--lk-ink)') + '">t' + t + '</text>';
        }
        if (idx === m.n && idx > m.pid * m.B) s += '<line x1="' + (x - gap / 2 - 0.5) + '" y1="' + (y - 3) + '" x2="' + (x - gap / 2 - 0.5) + '" y2="' + (y + cs + 3) + '" stroke="var(--lk-ink)" stroke-width="2"/>';
      }
      // ---- thread legend: who exists, grouped by warp; idle lanes grey
      var ly = zy + rows * rh + 8, chip = Math.max(18, Math.min(30, Math.floor((W - 8) / (m.T + m.W)))), lx = 4;
      for (var w = 0; w < m.W; w++) {
        for (var l = 0; l < LPW; l++) {
          var tt = w * LPW + l, idle = m.ept < 1 && tt >= m.B;
          s += '<rect x="' + (lx + 0.5) + '" y="' + (ly + 0.5) + '" width="' + (chip - 1) + '" height="16" rx="2" fill="' + (idle ? 'var(--lk-paper)' : 'var(--lk-cobalt)') + '" fill-opacity="' + (idle ? 1 : TINT[l]) + '" stroke="' + (idle ? 'var(--lk-rule-soft)' : 'var(--lk-cobalt-dark)') + '" stroke-width="0.6"/>';
          s += '<text x="' + (lx + chip / 2) + '" y="' + (ly + 12) + '" font-size="10" text-anchor="middle" fill="' + (idle ? 'var(--lk-rule)' : (l < 2 ? 'var(--lk-paper-light)' : 'var(--lk-ink)')) + '">t' + tt + '</text>';
          lx += chip;
        }
        s += '<text x="' + (lx - LPW * chip / 2) + '" y="' + (ly + 30) + '" font-size="10" text-anchor="middle" fill="var(--lk-ink-soft)">warp ' + w + '</text>';
        lx += chip;
      }
      var H = ly + 36;
      var label = 'Program ' + m.pid + ' of ' + m.P + ' covers x[' + (m.pid * m.B) + '..' + (m.pid * m.B + m.B - 1) + '] with ' + m.T + ' threads; ' +
        m.masked + ' of its ' + m.B + ' lanes are masked because the array ends at ' + m.n + '.';
      wrap.innerHTML = '<svg class="c12-strip" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(label) + '" xmlns="http://www.w3.org/2000/svg">' +
        '<defs><pattern id="c12-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="var(--lk-warnbg)"/><line x1="0" y1="0" x2="0" y2="5" stroke="var(--lk-vermilion)" stroke-width="1.4" opacity=".55"/></pattern></defs>' +
        s + '</svg>';
      // ---- readouts
      vP.textContent = String(m.P);
      if (m.ept < 1) { vE.textContent = '1 (' + (m.T - m.B) + ' idle)'; vL.textContent = '1 \u00d7 4 B'; }
      else if (m.vec) { vE.textContent = String(m.ept); vL.textContent = (m.ept / 4) + ' \u00d7 16 B'; }
      else { vE.textContent = String(m.ept); vL.textContent = m.ept + ' \u00d7 4 B'; }
      vM.textContent = m.masked + ' of ' + m.B;
      vX.textContent = (100 * m.waste).toFixed(1) + '%';
      var msg, cls;
      if (m.ept < 1) { cls = 'bad'; msg = 'BLOCK too small for these warps: idle lanes. ' + m.T + ' threads for a ' + m.B + '-element tile leaves ' + (m.T - m.B) + ' lanes with nothing to hold.'; }
      else if (m.B >= 2 * m.n) { cls = 'bad'; msg = 'Most of every program is masked: a tile much larger than the array pays for lanes that do nothing (section 3\u2019s softmax edge).'; }
      else if (m.pid === m.P - 1 && m.masked > 0) { cls = 'comp'; msg = 'Masked lanes issue nothing: the mask is a predicate on the load, not a branch. Here ' + m.masked + ' of ' + m.B + ' lanes are off; every other program of the grid is full.'; }
      else { cls = 'mem'; msg = 'Program ' + m.pid + ' is full: all ' + m.B + ' lanes load. ' + (m.vec ? 'Each thread issues ' + (m.ept / 4) + ' 16-byte load' + (m.ept > 4 ? 's' : '') + ' (4 consecutive floats each). ' : 'Fewer than 4 elements per thread: no 16-byte loads, ' + m.ept + ' scalar ones. ') + (m.masked > 0 || m.n % m.B ? 'Move pid to the last program to see the mask.' : 'n is a multiple of BLOCK: no program is masked.'); }
      ver.className = 'w-verdict ' + cls; ver.textContent = msg;
    }
    render();
  }

  /* ================= w-who: who decides what ================= */
  var wh = document.getElementById('w-who');
  if (wh) {
    var CUDA = [
      '// lab 7, hgemm.cu, t3 (abridged): FP16 in, FP32 accumulate',
      'constexpr int HBM = 128, HBN = 128, HBK = 32;      // block tile',
      'constexpr int HWM = 64, HWN = 32;                  // warp tile: 2 x 4 warps',
      'constexpr int APAD = HBK + 8, BPAD = HBN + 8;      // padded rows: no bank conflicts',
      '__global__ void hgemm_wmma_async(const half* A, const half* B, float* C, int M, int N, int K) {',
      '  __shared__ __align__(32) half As[2][HBM][APAD];   // two buffers of each tile',
      '  __shared__ __align__(32) half Bs[2][HBK][BPAD];',
      '  const int tid = threadIdx.x, warp = tid / 32;',
      '  const int wr = warp / (HBN / HWN), wc = warp % (HBN / HWN);   // my warp tile',
      '  const int row0 = blockIdx.y * HBM, col0 = blockIdx.x * HBN;   // my block tile',
      '  wmma::fragment<wmma::accumulator, 16, 16, 16, float> acc[4][2];',
      '  /* fill_fragment(acc[i][j], 0.0f) for every i, j */',
      '  load_tiles(A, B, As[0], Bs[0], row0, col0, 0, N, K, tid);   // prologue: tile 0',
      '  __pipeline_commit();',
      '  for (int t = 0; t < K / HBK; ++t) {',
      '    if (t + 1 < K / HBK)                               // prefetch tile t + 1',
      '      load_tiles(A, B, As[(t + 1) & 1], Bs[(t + 1) & 1], row0, col0, (t + 1) * HBK, N, K, tid);',
      '    __pipeline_commit();',
      '    __pipeline_wait_prior(1);                          // my copies of tile t landed',
      '    __syncthreads();                                   // ...and everyone else\u2019s',
      '    for (int kk = 0; kk < HBK; kk += 16) {',
      '      wmma::fragment<wmma::matrix_a, 16, 16, 16, half, wmma::row_major> a[4];',
      '      wmma::fragment<wmma::matrix_b, 16, 16, 16, half, wmma::row_major> b[2];',
      '      for (int i = 0; i < 4; ++i) wmma::load_matrix_sync(a[i], &As[t & 1][wr * HWM + i * 16][kk], APAD);',
      '      for (int j = 0; j < 2; ++j) wmma::load_matrix_sync(b[j], &Bs[t & 1][kk][wc * HWN + j * 16], BPAD);',
      '      /* for every i, j: */ wmma::mma_sync(acc[i][j], a[i], b[j], acc[i][j]);',
      '    }',
      '    __syncthreads();                                   // buffer t & 1 is free again',
      '  }',
      '  /* for every i, j: */ wmma::store_matrix_sync(C + (row0 + wr * HWM + i * 16) * N + col0 + wc * HWN + j * 16, acc[i][j], N, wmma::mem_row_major);',
      '  // t3 stores plain FP32; bias + GELU at this point is lab 8\u2019s epilogue (on v7)',
      '}',
      '// load_tiles: the 256 threads copy 16-byte vectors (8 halves) of each tile',
      'for (int v = tid; v < HBM * HBK / 8; v += HNT) {     // 512 vectors of A',
      '  int r = v / (HBK / 8), c = (v % (HBK / 8)) * 8;   // which row, which 8 halves',
      '  __pipeline_memcpy_async(&As[r][c], A + (size_t)(row0 + r) * K + k0 + c, 16);',
      '}   /* ... and the same for the 512 vectors of B */',
      'hgemm_wmma_async<<<dim3(N / HBN, M / HBM), HNT>>>(A, B, C, M, N, K);   // HNT = 256 threads'
    ];
    var TRI = [
      "configs = [triton.Config({'BLOCK_M': 128, 'BLOCK_N': 128, 'BLOCK_K': 32, 'GROUP_M': 8},",
      '                         num_warps=4, num_stages=3), ...]',
      "@triton.autotune(configs=configs, key=['M', 'N', 'K'])",
      '@triton.jit',
      'def matmul_kernel(a_ptr, b_ptr, c_ptr, M, N, K,',
      '                  stride_am, stride_ak, stride_bk, stride_bn, stride_cm, stride_cn,',
      '                  BLOCK_M: tl.constexpr, BLOCK_N: tl.constexpr, BLOCK_K: tl.constexpr,',
      '                  GROUP_M: tl.constexpr):',
      '    pid = tl.program_id(0)',
      '    num_pid_m = tl.cdiv(M, BLOCK_M)',
      '    num_pid_n = tl.cdiv(N, BLOCK_N)',
      '    num_in_group = GROUP_M * num_pid_n',
      '    group = pid // num_in_group',
      '    first_m = group * GROUP_M',
      '    group_m = min(num_pid_m - first_m, GROUP_M)',
      '    pid_m = first_m + (pid % num_in_group) % group_m',
      '    pid_n = (pid % num_in_group) // group_m',
      '    offs_m = (pid_m * BLOCK_M + tl.arange(0, BLOCK_M)) % M',
      '    offs_n = (pid_n * BLOCK_N + tl.arange(0, BLOCK_N)) % N',
      '    offs_k = tl.arange(0, BLOCK_K)',
      '    a_ptrs = a_ptr + offs_m[:, None] * stride_am + offs_k[None, :] * stride_ak',
      '    b_ptrs = b_ptr + offs_k[:, None] * stride_bk + offs_n[None, :] * stride_bn',
      '    acc = tl.zeros((BLOCK_M, BLOCK_N), dtype=tl.float32)',
      '    for k in range(0, tl.cdiv(K, BLOCK_K)):',
      '        a = tl.load(a_ptrs, mask=offs_k[None, :] < K - k * BLOCK_K, other=0.0)',
      '        b = tl.load(b_ptrs, mask=offs_k[:, None] < K - k * BLOCK_K, other=0.0)',
      '        acc = tl.dot(a, b, acc)',
      '        a_ptrs += BLOCK_K * stride_ak',
      '        b_ptrs += BLOCK_K * stride_bk',
      '    offs_cm = pid_m * BLOCK_M + tl.arange(0, BLOCK_M)',
      '    offs_cn = pid_n * BLOCK_N + tl.arange(0, BLOCK_N)',
      '    c_ptrs = c_ptr + offs_cm[:, None] * stride_cm + offs_cn[None, :] * stride_cn',
      '    tl.store(c_ptrs, acc.to(tl.float16), mask=(offs_cm[:, None] < M) & (offs_cn[None, :] < N))',
      '',
      "grid = lambda META: (triton.cdiv(M, META['BLOCK_M']) * triton.cdiv(N, META['BLOCK_N']), )",
      'matmul_kernel[grid](a, b, c, M, N, K, *strides)'
    ];
    function range(a, b) { var r = []; for (var i = a; i <= b; i++) r.push(i); return r; }
    // line numbers are 1-based, as shown in the panes
    var DEC = [
      { k: 'tiles', name: 'Tile sizes', cuda: [2, 6, 7], you: [1, 7, 8].concat(range(18, 22)), comp: [],
        note: 'Yours in both. CUDA: three constants and the shared arrays they size. Triton: a Config entry and three constexpr parameters, plus the pointer tiles they shape, so the autotuner can try other sizes without a rewrite.' },
      { k: 'warps', name: 'Warps per block', cuda: [3, 8, 9, 38], you: [2], comp: [],
        note: 'Yours in both. CUDA: 256 threads at the launch and the arithmetic that gives each warp its 64 \u00d7 32 tile. Triton: num_warps=4, and the warp tile is implied (BLOCK_M \u00d7 BLOCK_N split over the warps).' },
      { k: 'stages', name: 'Pipeline depth', cuda: [6, 7, 13, 14, 16, 17, 18, 19, 20, 28], you: [2], comp: [],
        badge: 'compiler: the pipeline pass writes the cp.async ring and its barriers',
        note: 'You choose the depth in both. In CUDA you also write the machinery: two buffers, prologue, prefetch, commit, wait, two barriers. In Triton you write num_stages=3 and the pipeline pass builds a 3-deep ring.' },
      { k: 'grid', name: 'Grid order', cuda: [10, 38], you: range(9, 17).concat([35]), comp: [],
        note: 'Yours in both. t3 launches a 2-D grid in plain row-major order; the Triton kernel renumbers a 1-D grid into GROUP_M-tall groups (figure 1): nine lines of integer arithmetic.' },
      { k: 'kloop', name: 'K loop', cuda: [15, 21, 27, 29], you: [24, 28, 29], comp: [],
        note: 'Yours in both: the loop over K in steps of the tile depth. CUDA has two levels (tiles of 32, then steps of 16 for WMMA); in Triton the inner level is inside tl.dot.' },
      { k: 'epi', name: 'Epilogue fusion', cuda: [30, 31], you: range(30, 33), comp: [],
        note: 'Yours in both: what happens to the accumulator before the store. t3 stores plain FP32; in Triton section 6\u2019s bias and GELU go just before tl.store, on the FP32 accumulator tile.' },
      { k: 'map', name: 'Thread\u2194element mapping', cuda: [8, 33, 34, 35, 36, 37], you: [], comp: [25, 26, 33],
        badge: 'compiler: blocked layouts (coalesce pass) decide which thread moves which bytes',
        note: 'CUDA: you say which thread copies which 16 bytes. Triton: no line says it. The loads and the store are of whole tiles (gold); the coalesce pass gives each a blocked layout (figure 3) and the vector width follows.' },
      { k: 'frag', name: 'Shared memory + fragments', cuda: [4, 6, 7, 11, 12, 22, 23, 24, 25, 26], you: [], comp: [27],
        badge: 'compiler: swizzled shared layout, ldmatrix, mma.sync (accelerate-matmul pass)',
        note: 'CUDA: padded shared arrays, fragment types, load_matrix_sync, mma_sync. Triton: one call, tl.dot (gold); the compiler stages both tiles through a swizzled shared layout and lowers the product to ldmatrix and mma.sync (figure 2).' }
    ];
    var cur = 'tiles';
    wh.innerHTML = '';
    wh.appendChild(el('h4', null, 'Who decides what: the same matmul in CUDA and in Triton'));
    wh.appendChild(el('p', 'w-sub', 'Left, lab 7\u2019s hgemm t3, abridged; right, section 5\u2019s kernel. Pick a decision from section 1\u2019s table: cobalt lines are the ones you write for it; gold lines are Triton lines whose details the compiler decides. The tenth row of section 1\u2019s table has no lines in either pane: it is what neither language shows you here.'));
    var bar = el('div', 'c12-btns'); bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'Decision');
    var bmap = {};
    DEC.concat([{ k: 'all', name: 'All' }]).forEach(function (d) {
      var b = btn(d.name); b.addEventListener('click', function () { cur = d.k; draw(); }); bar.appendChild(b); bmap[d.k] = b;
    });
    wh.appendChild(bar);
    var key2 = el('div', 'c12-key');
    key2.innerHTML = '<span><i class="you"></i>you write it</span><span><i class="comp"></i>you write the call; the compiler decides how</span>';
    wh.appendChild(key2);
    var panes = el('div', 'c12-panes');
    function pane(title, lines) {
      var p = el('div', 'c12-pane'); var t = el('div', 'c12-ptitle'); t.appendChild(el('span', null, title));
      var badge = el('span', 'c12-badge'); t.appendChild(badge); p.appendChild(t);
      // a div, not pre > code: highlight.js would re-highlight a pre > code and flatten the lines
      var pre = el('div', 'c12-code'); pre.setAttribute('tabindex', '0'); pre.setAttribute('role', 'region');
      pre.setAttribute('aria-label', title + ' source'); var code = pre; var spans = [];
      lines.forEach(function (ln, i) {
        var s = el('span', 'ln'); s.innerHTML = '<span class="no">' + (i + 1) + '</span>' + esc(ln); code.appendChild(s); spans.push(s);
      });
      p.appendChild(pre); panes.appendChild(p);
      return { spans: spans, badge: badge, box: pre };
    }
    var PC = pane('CUDA \u00b7 lab 7 t3 (' + CUDA.length + ' lines)', CUDA);
    var PT = pane('Triton \u00b7 section 5 (' + TRI.filter(function (s) { return s; }).length + ' lines)', TRI);
    wh.appendChild(panes);
    var out2 = el('div', 'w-out');
    var vC = stat(out2, 'CUDA lines, yours'), vTy = stat(out2, 'Triton lines, yours'), vTc = stat(out2, 'Triton lines, compiler decides');
    wh.appendChild(out2);
    var ver2 = el('div', 'w-verdict'); ver2.setAttribute('aria-live', 'polite'); wh.appendChild(ver2);

    function uniq(a) { var o = {}; a.forEach(function (x) { o[x] = 1; }); return Object.keys(o).map(Number); }
    function draw() {
      Object.keys(bmap).forEach(function (k) { bmap[k].setAttribute('aria-pressed', String(k === cur)); });
      var cl, yl, gl, badges = [], note;
      if (cur === 'all') {
        cl = uniq([].concat.apply([], DEC.map(function (d) { return d.cuda; })));
        yl = uniq([].concat.apply([], DEC.map(function (d) { return d.you; })));
        gl = uniq([].concat.apply([], DEC.map(function (d) { return d.comp; })));
        DEC.forEach(function (d) { if (d.badge) badges.push(d.badge.replace(/^compiler: /, '')); });
        note = 'All eight decisions: in CUDA every one of them is lines you wrote. In Triton the first six are still yours, in fewer lines; the last two have no lines of their own, and with the pipeline machinery they are what the compiler writes: ' + badges.join('; ') + '.';
        PT.badge.textContent = 'compiler: layouts, staging, fragments, pipeline';
      } else {
        var d = DEC.filter(function (x) { return x.k === cur; })[0];
        cl = d.cuda; yl = d.you; gl = d.comp; note = d.note;
        PT.badge.textContent = d.badge || '';
      }
      yl = yl.filter(function (n) { return gl.indexOf(n) < 0; });
      PT.badge.classList.toggle('on', !!PT.badge.textContent);
      PC.spans.forEach(function (s, i) { s.className = 'ln' + (cl.indexOf(i + 1) >= 0 ? ' you' : ''); });
      PT.spans.forEach(function (s, i) { var n = i + 1; s.className = 'ln' + (gl.indexOf(n) >= 0 ? ' comp' : (yl.indexOf(n) >= 0 ? ' you' : '')); });
      [PC, PT].forEach(function (P) {             // bring the first lit line into view inside its pane
        var first = P.spans.filter(function (x) { return x.className !== 'ln'; })[0];
        if (first && P.box.scrollHeight > P.box.clientHeight) P.box.scrollTop = Math.max(0, first.offsetTop - 16);
      });
      vC.textContent = cl.length + ' of ' + CUDA.length;
      vTy.textContent = yl.length + ' of ' + TRI.filter(function (s) { return s; }).length;
      vTc.textContent = String(gl.length);
      ver2.className = 'w-verdict ' + (gl.length || PT.badge.textContent ? 'gold' : 'mem');
      ver2.textContent = note;
    }
    draw();
  }
})();
