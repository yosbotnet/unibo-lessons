/* ch11.js - chapter 11 widgets: the memory plan explorer and the radix-select / sampling stepper. */
(function () {
  'use strict';
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function btn(txt, cls) { var b = el('button', cls, txt); b.type = 'button'; return b; }
  function fmtMB(b) {
    var mb = b / 1e6;
    if (mb >= 1000) return (mb / 1000).toFixed(mb >= 10000 ? 1 : 2) + ' GB';
    if (mb >= 100) return mb.toFixed(0) + ' MB';
    if (mb >= 10) return mb.toFixed(1) + ' MB';
    return mb.toFixed(mb >= 1 ? 1 : 2) + ' MB';
  }
  function seg(parent, opts, cur, onPick, label) {
    var g = el('div', 'c11-seg'); g.setAttribute('role', 'group'); g.setAttribute('aria-label', label);
    var bs = opts.map(function (o) {
      var b = btn(o[1]); b.addEventListener('click', function () { onPick(o[0]); }); g.appendChild(b); return b;
    });
    parent.appendChild(g);
    return function (v) { opts.forEach(function (o, i) { bs[i].setAttribute('aria-pressed', String(o[0] === v)); }); };
  }

  /* ================= memory plan explorer ================= */
  var mh = document.getElementById('w-memory-plan');
  if (mh) {
    // GPT-2 small, FP32: the sizes engine_init computes (gpt2.cu), in bytes. 1 MB = 10^6 bytes.
    var C = 768, H = 12, L = 12, V = 50257, CARD = 12 * 1073741824;
    var WEIGHTS = 124439808 * 4, WTE = V * C * 4;
    var BS = [1, 2, 4, 8, 16, 32], TS = [128, 256, 512, 1024, 2048, 4096, 8192];
    var st = { b: 0, t: 3, attn: 'naive', cache: true, logits: 'all', be: 'cublas' };
    var PRESETS = [
      { name: 'verify (B=1, T=1024, all logits)', p: { b: 0, t: 3, attn: 'naive', cache: true, logits: 'all', be: 'cublas' } },
      { name: 'generate (B=1, T=1024)', p: { b: 0, t: 3, attn: 'naive', cache: true, logits: 'one', be: 'cublas' } },
      { name: 'batch 8', p: { b: 3, t: 3, attn: 'naive', cache: true, logits: 'one', be: 'cublas' } },
      { name: 'long context (B=1, T=4096)', p: { b: 0, t: 5, attn: 'naive', cache: true, logits: 'one', be: 'cublas' } }
    ];
    function plan(s) {
      var B = BS[s.b], T = TS[s.t], rows = B * T;
      return [
        { key: 'w', name: 'weights' + (s.be === 'own' ? ' + wteT' : ''), bytes: WEIGHTS + (s.be === 'own' ? WTE : 0), grows: 'fixed', cls: 'w' },
        { key: 'a', name: 'activations (x, ln, att, qkv, fc, last)', bytes: rows * C * 4 * (3 + 3 + 4) + B * C * 4, grows: 'B\u00b7T', cls: 'a' },
        { key: 's', name: s.attn === 'naive' ? 'attention scratch (S)' : 'attention scratch (flash)', bytes: s.attn === 'naive' ? B * H * T * T * 4 : B * H * T * 4,
          grows: s.attn === 'naive' ? 'B\u00b7T\u00b2' : 'B\u00b7T', cls: 's' },
        { key: 'c', name: 'KV cache, 12 layers', bytes: s.cache ? 2 * L * B * T * C * 4 : 0, grows: 'B\u00b7Tmax', cls: 'c' },
        { key: 'l', name: s.logits === 'all' ? 'logits, every row' : 'logits, one row per sequence', bytes: (s.logits === 'all' ? rows : B) * V * 4,
          grows: s.logits === 'all' ? 'B\u00b7T' : 'B', cls: 'l' }
      ];
    }
    mh.innerHTML = '';
    mh.appendChild(el('h4', null, 'The memory plan: one arena, five lines'));
    mh.appendChild(el('p', 'w-sub', 'Modelled from the engine\u2019s plan (engine_init) for GPT-2 small in FP32, against a 12 GB card. Pick the largest batch and context the engine must serve; the bar and the table show what one cudaMalloc has to hold. 1 MB = 10\u2076 bytes.'));
    var pre = el('div', 'c11-btns'); var pbt = [];
    PRESETS.forEach(function (P) {
      var b = btn(P.name); b.addEventListener('click', function () { st = JSON.parse(JSON.stringify(P.p)); sync(); render(); });
      pbt.push(b); pre.appendChild(b);
    });
    mh.appendChild(pre);
    var ctr = el('div', 'w-controls c11-ctr');
    function slider(label, max, key, vals) {
      var l = el('label'); var top = el('span', null, label + ' '); var out = el('output'); top.appendChild(out); l.appendChild(top);
      var r = el('input'); r.type = 'range'; r.min = 0; r.max = max; r.step = 1;
      r.addEventListener('input', function () { st[key] = +r.value; render(); });
      l.appendChild(r); ctr.appendChild(l);
      return function () { r.value = st[key]; out.textContent = vals[st[key]].toLocaleString('en-US'); r.setAttribute('aria-valuetext', vals[st[key]]); };
    }
    var syncB = slider('Largest batch Bmax', BS.length - 1, 'b', BS);
    var syncT = slider('Largest context Tmax', TS.length - 1, 't', TS);
    function choice(label, opts, key) {
      var w = el('div', 'c11-choice'); w.appendChild(el('span', 'c11-clabel', label));
      var f = seg(w, opts, st[key], function (v) { st[key] = v; render(); }, label);
      ctr.appendChild(w); return function () { f(st[key]); };
    }
    var syncA = choice('Prefill attention', [['naive', 'naive (S in DRAM)'], ['flash', 'flash (ch. 14)']], 'attn');
    var syncC = choice('KV cache', [[true, 'on'], [false, 'off']], 'cache');
    var syncL = choice('Logits', [['all', 'all rows (verify)'], ['one', 'one per sequence']], 'logits');
    var syncE = choice('Backend', [['cublas', 'cublas'], ['own', 'own (+ wteT)']], 'be');
    mh.appendChild(ctr);

    var barW = el('div', 'c11-barwrap');
    var bar = el('div', 'c11-bar'); bar.setAttribute('aria-hidden', 'true');
    var segs = {};
    ['w', 'a', 's', 'c', 'l'].forEach(function (k) { var d = el('div', 'c11-bs c11-' + k); segs[k] = d; bar.appendChild(d); });
    var cap = el('div', 'c11-cap'); bar.appendChild(cap);
    var totM = el('div', 'c11-totm'); var totL = el('span'); totM.appendChild(totL);
    barW.appendChild(totM);
    barW.appendChild(bar);
    var axis = el('div', 'c11-axis'); var ax0 = el('span', null, '0'); var ax1 = el('span'); axis.appendChild(ax0); axis.appendChild(ax1);
    barW.appendChild(axis);
    mh.appendChild(barW);
    var tw = el('div', 'c11-tablewrap');
    var tb = el('table', 'c11-table');
    tb.innerHTML = '<thead><tr><th>Buffer</th><th>Bytes</th><th>Grows with</th></tr></thead>';
    var tbody = el('tbody'); tb.appendChild(tbody); tw.appendChild(tb); mh.appendChild(tw);
    var ver = el('div', 'w-verdict'); ver.setAttribute('aria-live', 'polite'); mh.appendChild(ver);

    function sync() { syncB(); syncT(); syncA(); syncC(); syncL(); syncE(); }
    function render() {
      sync();
      PRESETS.forEach(function (P, i) {
        var same = Object.keys(P.p).every(function (k) { return P.p[k] === st[k]; });
        pbt[i].setAttribute('aria-pressed', String(same));
      });
      var lines = plan(st), tot = 0, big = lines[0];
      lines.forEach(function (x) { tot += x.bytes; if (x.bytes > big.bytes) big = x; });
      var scale = Math.max(CARD, tot);
      lines.forEach(function (x) { segs[x.key].style.width = (100 * x.bytes / scale) + '%'; });
      cap.style.left = (100 * CARD / scale) + '%';
      var tp = 100 * tot / scale;
      totM.style.left = tp + '%'; totL.textContent = 'total ' + fmtMB(tot);
      totL.style.transform = 'translateX(' + (tp < 15 ? '0' : tp > 85 ? '-100%' : '-50%') + ')';
      cap.className = 'c11-cap' + (tot > CARD ? ' over' : '');
      ax1.textContent = tot > CARD ? fmtMB(scale) + ' (the 12 GB card is the line)' : '12 GB card';
      tbody.innerHTML = '';
      lines.forEach(function (x) {
        var tr = el('tr', x === big ? 'big' : null);
        var td = el('td'); var sw = el('i', 'c11-sw c11-' + x.cls); td.appendChild(sw); td.appendChild(document.createTextNode(x.name)); tr.appendChild(td);
        tr.appendChild(el('td', 'num', x.bytes ? fmtMB(x.bytes) : '0'));
        tr.appendChild(el('td', null, x.grows));
        tbody.appendChild(tr);
      });
      var tr2 = el('tr', 'tot'); tr2.appendChild(el('td', null, 'total')); tr2.appendChild(el('td', 'num', fmtMB(tot))); tr2.appendChild(el('td', null, (100 * tot / CARD).toFixed(tot / CARD < 0.1 ? 1 : 0) + '% of 12 GB')); tbody.appendChild(tr2);
      var T = TS[st.t], msg = 'Largest line: ' + big.name + ', ' + fmtMB(big.bytes) + '. ';
      if (tot > CARD) { ver.className = 'w-verdict bad'; msg += 'Total ' + fmtMB(tot) + ': this plan does not fit in 12 GB, and the cudaMalloc in engine_init fails before the first token.'; }
      else { ver.className = 'w-verdict ' + (big.key === 'w' ? 'mem' : 'comp'); msg += 'Total ' + fmtMB(tot) + ', ' + (100 * tot / CARD).toFixed(1) + '% of the card.'; }
      if (T > 1024) msg += ' GPT-2 has 1,024 positions: beyond that this is a hypothetical model of the same width.';
      if (st.attn === 'flash') msg += ' Flash scratch is illustrative here (chapter 14 sizes it).';
      ver.textContent = msg;
    }
    render();
  }

  /* ================= radix select and sampling stepper ================= */
  var rh = document.getElementById('w-radix-select');
  if (rh) {
    var BASE = [13, 7, 12, 2, 9, 14, 5, 11];
    var keys = BASE.slice(), K = 3, steps = [], cur = 0;
    var BINS = [3, 2, 1, 0];                    // shown left to right: the walk goes from the top bin down
    function bits(v) { var s = ''; for (var i = 3; i >= 0; i--) s += (v >> i) & 1; return s; }
    function dname(d) { return ((d >> 1) & 1) + '' + (d & 1); }

    // Pure model: the list of states of a 2-pass radix select with 2-bit digits on 4-bit keys.
    function select(keys, k) {
      var out = [], prefix = 0, mask = 0, kk = k, pfx = '____';
      function snap(o) {
        o.prefix = pfx; o.kk = kk; o.hist = o.hist ? o.hist.slice() : [0, 0, 0, 0];
        o.cand = o.cand.slice(); o.counted = (o.counted || []).slice(); o.run = (o.run || [null, null, null, null]).slice();
        out.push(o);
      }
      for (var pass = 0; pass < 2; pass++) {
        var shift = pass === 0 ? 2 : 0;
        var cand = keys.map(function (v) { return (v & mask) === prefix; });
        var nc = cand.filter(Boolean).length;
        var hist = [0, 0, 0, 0], counted = keys.map(function () { return false; });
        snap({ pass: pass, shift: shift, cand: cand, hist: hist, counted: counted, phase: 'look',
          msg: 'Pass ' + (pass + 1) + ': the digit is bits ' + (shift + 1) + '\u2013' + shift + (pass === 0 ? ' (the top two)' : ' (the low two)') +
            ' of every candidate: ' + nc + ' key' + (nc > 1 ? 's' : '') + '. Rank still to find: ' + kk + '.' });
        for (var i = 0; i < keys.length; i++) {
          if (!cand[i]) continue;
          var d = (keys[i] >> shift) & 3; hist[d]++; counted[i] = true;
          snap({ pass: pass, shift: shift, cand: cand, hist: hist, counted: counted, phase: 'count', active: i, bin: d,
            msg: 'Key ' + keys[i] + ' = ' + bits(keys[i]) + ': digit ' + dname(d) + ', so atomicAdd(&hist[' + dname(d) + '], 1). Bin ' + dname(d) + ' now holds ' + hist[d] + '.' });
        }
        var run = [null, null, null, null], acc = 0, found = -1, excl = 0;
        for (var j = 0; j < 4; j++) {
          var bn = BINS[j]; excl = acc; acc += hist[bn]; run[bn] = acc;
          var hit = acc >= kk;
          snap({ pass: pass, shift: shift, cand: cand, hist: hist, counted: counted, phase: 'scan', run: run, found: hit ? bn : -1,
            msg: 'Scan from the top: ' + (j ? 'bins ' + BINS.slice(0, j + 1).map(dname).join(', ') + ' hold ' : 'bin ' + dname(bn) + ' holds ') + acc + (hit ? ' \u2265 ' : ' < ') + kk +
              (hit ? '. The ' + kk + (kk === 1 ? 'st' : kk === 2 ? 'nd' : kk === 3 ? 'rd' : 'th') + ' largest candidate has digit ' + dname(bn) + '.' : ': keep walking down.') });
          if (hit) { found = bn; break; }
        }
        prefix |= found << shift; mask |= 3 << shift; kk -= excl;
        pfx = bits(prefix).slice(0, pass === 0 ? 2 : 4) + (pass === 0 ? '__' : '');
        snap({ pass: pass, shift: shift, cand: cand, hist: hist, counted: counted, phase: 'prefix', run: run, found: found,
          msg: 'Prefix ' + pfx + '. ' + (excl ? excl + ' larger key' + (excl > 1 ? 's' : '') + ' sit in the bins above, so the rank inside bin ' + dname(found) + ' is ' + kk + '.' : 'No bin above it held anything, so the rank inside it is still ' + kk + '.') +
            (pass === 0 ? ' Next pass: only keys starting ' + pfx.slice(0, 2) + '.' : '') });
      }
      var thr = prefix;
      snap({ pass: 2, shift: 0, cand: keys.map(function () { return true; }), phase: 'done', thr: thr,
        msg: 'Threshold ' + bits(thr) + ' = ' + thr + '. Keys \u2265 ' + thr + ' are ' + keys.filter(function (v) { return v >= thr; }).sort(function (a, b) { return b - a; }).join(', ') +
          ': the top ' + k + ', no sort.' });
      return out;
    }

    rh.innerHTML = '';
    rh.appendChild(el('h4', null, 'Top-k without a sort: radix select, then the draw'));
    var tabs = el('div', 'c11-tabs'); tabs.setAttribute('role', 'tablist');
    var t1 = btn('1. select the threshold', 'c11-tab'), t2 = btn('2. sample a token', 'c11-tab');
    [t1, t2].forEach(function (t) { t.setAttribute('role', 'tab'); tabs.appendChild(t); });
    rh.appendChild(tabs);
    var p1 = el('div', 'c11-panel'), p2 = el('div', 'c11-panel');
    p1.setAttribute('role', 'tabpanel'); p2.setAttribute('role', 'tabpanel');
    rh.appendChild(p1); rh.appendChild(p2);
    function showTab(i) {
      t1.setAttribute('aria-selected', String(i === 0)); t2.setAttribute('aria-selected', String(i === 1));
      p1.hidden = i !== 0; p2.hidden = i !== 1;
    }
    t1.addEventListener('click', function () { showTab(0); });
    t2.addEventListener('click', function () { showTab(1); });

    // ---- panel 1 ----
    p1.appendChild(el('p', 'w-sub', 'The chapter\u2019s toy: 4-bit keys, 2-bit digits, two passes. Step through it (or use the arrow keys here): every candidate adds one to the bin of its digit, the scan walks the bins from the top until the count reaches k, and the bin found becomes the next two bits of the prefix.'));
    var top = el('div', 'c11-row');
    var kl = el('label', 'c11-k'); kl.appendChild(document.createTextNode('k = ')); var ks = el('select');
    for (var q = 1; q <= 8; q++) { var op = el('option', null, String(q)); op.value = q; ks.appendChild(op); }
    kl.appendChild(ks); top.appendChild(kl);
    var bRand = btn('random keys', 'c11-small'), bBase = btn('chapter\u2019s keys', 'c11-small');
    top.appendChild(bRand); top.appendChild(bBase);
    p1.appendChild(top);
    var stage = el('div', 'c11-stage'); stage.tabIndex = 0; stage.setAttribute('aria-label', 'Radix select stepper: left and right arrows step');
    var tilesD = el('div', 'c11-tiles'); stage.appendChild(tilesD);
    var meta = el('div', 'c11-meta'); stage.appendChild(meta);
    var histD = el('div', 'c11-hist'); stage.appendChild(histD);
    p1.appendChild(stage);
    p1.appendChild(el('p', 'c11-legend', 'Each +1 is an atomicAdd into a bin in shared memory: the block\u2019s private histogram. The numbers under the bins are the scan: the running count from the top bin down.'));
    var msg = el('div', 'w-verdict mem'); msg.setAttribute('aria-live', 'polite'); p1.appendChild(msg);
    var nav = el('div', 'lk-step-btns'); var bPrev = btn('\u2190 back'), bNext = btn('step \u2192'), bReset = btn('reset', 'lk-step-reset');
    nav.appendChild(bPrev); nav.appendChild(bNext); nav.appendChild(bReset); p1.appendChild(nav);

    var tiles = [], bins = {};
    function buildTiles() {
      tilesD.innerHTML = ''; tiles = [];
      keys.forEach(function (v) {
        var t = el('div', 'c11-key');
        var dec = el('span', 'dec', String(v));
        var b = bits(v), hi = el('span', 'pair hi', b.slice(0, 2)), lo = el('span', 'pair lo', b.slice(2));
        var bw = el('span', 'bin'); bw.appendChild(hi); bw.appendChild(lo);
        t.appendChild(bw); t.appendChild(dec); tilesD.appendChild(t); tiles.push({ t: t, hi: hi, lo: lo });
      });
    }
    (function buildHist() {
      BINS.forEach(function (d) {
        var c = el('div', 'c11-bincol');
        var stack = el('div', 'c11-stack'); var cnt = el('span', 'cnt');
        var lab = el('span', 'blab', 'bin ' + dname(d)); var run = el('span', 'run');
        c.appendChild(cnt); c.appendChild(stack); c.appendChild(lab); c.appendChild(run);
        histD.appendChild(c); bins[d] = { c: c, stack: stack, cnt: cnt, run: run };
      });
    })();
    function rebuild() { buildTiles(); steps = select(keys, K); cur = 0; draw(); }
    function draw() {
      var s = steps[cur];
      tiles.forEach(function (x, i) {
        var v = keys[i];
        x.t.className = 'c11-key';
        if (s.phase === 'done') {
          if (v >= s.thr) x.t.classList.add(v === s.thr ? 'thr' : 'surv'); else x.t.classList.add('out');
        } else {
          if (!s.cand[i]) x.t.classList.add('out');
          if (s.active === i) x.t.classList.add('active');
          else if (s.counted[i]) x.t.classList.add('done');
        }
        x.hi.classList.toggle('on', s.phase !== 'done' && s.pass === 0 && s.cand[i]);
        x.lo.classList.toggle('on', s.phase !== 'done' && s.pass === 1 && s.cand[i]);
      });
      BINS.forEach(function (d) {
        var B = bins[d], n = s.phase === 'done' ? 0 : s.hist[d];
        B.stack.innerHTML = '';
        for (var i = 0; i < n; i++) {
          var u = el('i', 'unit', '+1');
          if (s.phase === 'count' && s.bin === d && i === n - 1) u.classList.add('new');
          B.stack.appendChild(u);
        }
        B.cnt.textContent = s.phase === 'done' ? '' : String(n);
        B.run.textContent = s.run && s.run[d] != null && s.phase !== 'done' ? '\u03a3 ' + s.run[d] : '';
        B.c.classList.toggle('found', (s.phase === 'scan' || s.phase === 'prefix') && s.found === d);
      });
      histD.classList.toggle('dim', s.phase === 'done');
      meta.innerHTML = '';
      var m1 = el('span', null, s.phase === 'done' ? 'threshold' : 'pass ' + (s.pass + 1) + ' of 2');
      var m2 = el('span', 'pfx', 'prefix ' + (s.phase === 'done' ? bits(s.thr) + ' = ' + s.thr : s.prefix));
      var m3 = el('span', null, 'rank to find ' + s.kk);
      meta.appendChild(m1); meta.appendChild(m2); if (s.phase !== 'done') meta.appendChild(m3);
      msg.textContent = (cur + 1) + ' / ' + steps.length + ': ' + s.msg;
      msg.className = 'w-verdict ' + (s.phase === 'done' ? 'gold' : s.phase === 'count' ? 'mem' : 'comp');
      bPrev.disabled = cur === 0; bNext.disabled = cur === steps.length - 1;
    }
    function go(d) { cur = Math.max(0, Math.min(steps.length - 1, cur + d)); draw(); }
    bPrev.addEventListener('click', function () { go(-1); });
    bNext.addEventListener('click', function () { go(1); });
    bReset.addEventListener('click', function () { keys = BASE.slice(); K = 3; ks.value = 3; rebuild(); });
    bBase.addEventListener('click', function () { keys = BASE.slice(); rebuild(); });
    bRand.addEventListener('click', function () {
      var pool = []; for (var i = 0; i < 16; i++) pool.push(i);
      for (i = 15; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
      keys = pool.slice(0, 8); rebuild();
    });
    ks.addEventListener('change', function () { K = +ks.value; rebuild(); });
    stage.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { go(1); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { go(-1); e.preventDefault(); }
    });
    ks.value = K;
    rebuild();

    // ---- panel 2 ----
    // Eight surviving tokens' weights e^((x - max) / temp), four threads of two contiguous tokens each.
    var Wt = [0.42, 0.18, 1.00, 0.30, 0.55, 0.12, 0.25, 0.68];
    var TH = 4, CH = 2, wsum = [], incl = [], total = 0;
    for (var th = 0; th < TH; th++) { var sm = 0; for (var z = 0; z < CH; z++) sm += Wt[th * CH + z]; wsum.push(sm); total += sm; incl.push(total); }
    function pick(u) {
      var target = u * total, t = 0;
      while (t < TH - 1 && target >= incl[t]) t++;
      var acc = t ? incl[t - 1] : 0, tok = t * CH;
      for (var i = 0; i < CH; i++) { tok = t * CH + i; acc += Wt[tok]; if (target < acc) break; }
      return { target: target, thread: t, token: tok };
    }
    p2.appendChild(el('p', 'w-sub', 'After the select: eight surviving tokens and their weights e^((x \u2212 max)/temp), split into chunks of two, one chunk per thread (the kernel\u2019s chunks are about 50 logits). Each thread sums its chunk; an inclusive scan of those sums is the cumulative distribution; the thread whose interval holds u \u00b7 total walks its chunk to the token.'));
    var bars = el('div', 'c11-sbars');
    var barEls = [], thEls = [];
    for (th = 0; th < TH; th++) {
      var g = el('div', 'c11-sthread');
      var row = el('div', 'c11-srow');
      for (z = 0; z < CH; z++) {
        var i2 = th * CH + z, c2 = el('div', 'c11-sbar');
        var fill = el('div', 'fill'); fill.style.height = (100 * Wt[i2]) + '%';
        c2.appendChild(fill); c2.appendChild(el('span', 'tok', 'token ' + i2)); c2.appendChild(el('span', 'wv', Wt[i2].toFixed(2)));
        row.appendChild(c2); barEls.push(c2);
      }
      g.appendChild(row);
      g.appendChild(el('span', 'tl', 'thread ' + th + ': sum ' + wsum[th].toFixed(2)));
      bars.appendChild(g); thEls.push(g);
    }
    p2.appendChild(bars);
    var cdf = el('div', 'c11-cdf'); cdf.setAttribute('aria-hidden', 'true');
    var ivs = [];
    for (th = 0; th < TH; th++) {
      var iv = el('div', 'iv'); iv.style.width = (100 * wsum[th] / total) + '%';
      iv.appendChild(el('span', null, 't' + th)); cdf.appendChild(iv); ivs.push(iv);
    }
    var mark = el('div', 'mark'); cdf.appendChild(mark);
    p2.appendChild(cdf);
    var ticksD = el('div', 'c11-cdfticks');
    var t0s = el('span', null, '0'); t0s.style.left = '0%'; ticksD.appendChild(t0s);
    for (th = 0; th < TH; th++) { var ts = el('span', null, incl[th].toFixed(2)); ts.style.left = (100 * incl[th] / total) + '%'; ticksD.appendChild(ts); }
    p2.appendChild(ticksD);
    p2.appendChild(el('p', 'c11-legend', 'The ruler is the inclusive scan of the four thread sums, from 0 to the total ' + total.toFixed(2) + ': thread t owns the interval between the scan before it and its own. The gold line is the target, u \u00b7 total.'));
    var ul = el('label', 'c11-u'); var uTop = el('span', null, 'u, the host\u2019s random number in [0, 1): '); var uOut = el('output'); uTop.appendChild(uOut); ul.appendChild(uTop);
    var ur = el('input'); ur.type = 'range'; ur.min = 0; ur.max = 999; ur.step = 1; ur.value = 620; ul.appendChild(ur);
    p2.appendChild(ul);
    var sres = el('div', 'w-verdict gold'); sres.setAttribute('aria-live', 'polite'); p2.appendChild(sres);
    function draw2() {
      var u = +ur.value / 1000, r = pick(u);
      uOut.textContent = u.toFixed(3);
      mark.style.left = (100 * u) + '%';
      thEls.forEach(function (g, i) { g.classList.toggle('on', i === r.thread); });
      ivs.forEach(function (g, i) { g.classList.toggle('on', i === r.thread); });
      barEls.forEach(function (b, i) { b.classList.toggle('pick', i === r.token); });
      var before = r.thread ? incl[r.thread - 1] : 0;
      sres.textContent = 'u = ' + u.toFixed(3) + ' \u2192 target ' + r.target.toFixed(3) + ' of ' + total.toFixed(2) +
        ' \u2192 thread ' + r.thread + ' (its interval ' + before.toFixed(2) + ' to ' + incl[r.thread].toFixed(2) + ') \u2192 token ' + r.token +
        ', where the thread\u2019s running sum first passes the target.';
    }
    ur.addEventListener('input', draw2);
    draw2();
    showTab(0);
  }
})();
