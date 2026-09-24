/* spacetime.js — the course's space-time diagram instrument.
   Processes are horizontal lines, events are dots, messages are arrows (physical time runs left → right).
   From the run it derives: happens-before (causal past / future / concurrency), Lamport scalar clocks,
   vector clocks, causal histories, consistent / inconsistent cuts, and rollback-recovery lines.

   DSSpaceTime.mount(hostOrSelector, {
     processes: [{id:'a', name:'Alice'}, ...]          // id doubles as the event-name prefix
     events:    [{id:'a1', p:'a', x:1}, ...]            // x = physical position (any increasing numbers)
     messages:  [{from:'a2', to:'b2', label:'Dinner?'}]
     modes:     ['none','lamport','vector','history']   // label modes offered (first = default unless `mode`)
     mode:      'lamport',
     compare:   true,        // second click compares two events
     editable:  false,       // sandbox toolbar: internal / send / deliver / undo / reset
     cut:       false,       // cut tool: click events to move each process's frontier
     checkpoints: [{p:'a', x:1.5, name:'A0'}],  // optional: enables "crash & roll back" (domino effect)
     presets:   {'Name': {processes, events, messages, checkpoints}},  // optional preset picker
     initialCut: {procId: eventId|null},  // optional: start in cut mode with each frontier just after that event
     caption:   'text shown under the canvas'
   })
   Scalar rule used everywhere (Kshemkalyani & Singhal): receive → lc = max(lc, ts), then lc += 1.
   Returns {render, select(id), setMode(m), crash(procId), setCut({procId: eventId|null}), load(run)}.
   No dependencies. Keyboard: events are focusable buttons (Enter/Space selects). */
(function (global) {
  'use strict';
  var SVGNS = 'http://www.w3.org/2000/svg';
  function h(tag, attrs, text) {
    var e = document.createElementNS(SVGNS, tag);
    for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function btn(label, cls) { var b = el('button', cls || 'ds-btn', label); b.type = 'button'; return b; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  var uid = 0;

  function mount(host, opts) {
    host = typeof host === 'string' ? document.querySelector(host) : host;
    if (!host) return null;
    uid++;
    var modes = opts.modes || ['none', 'lamport', 'vector', 'history'];
    var MODE_NAMES = { none: 'Plain', lamport: 'Lamport', vector: 'Vector', history: 'Causal history' };
    var state = {
      mode: opts.mode || modes[0],
      sel: null, cmp: null,
      tool: 'select',           // 'select' | 'cut'
      run: null, initial: null,
      cut: null,                // {procId: thresholdX}
      recovery: null,           // {failed, steps:[...]} when showing rollback
      pending: [], history: []  // sandbox
    };

    function load(run) {
      state.run = clone(run);
      state.run.messages = state.run.messages || [];
      state.run.checkpoints = state.run.checkpoints || [];
      state.pending = [];
      state.history = [];
      state.sel = state.cmp = null;
      state.recovery = null;
      state.cut = null;
      if (opts.cut) initCut();
    }

    /* ---------------- derived structure ---------------- */
    function derive() {
      var R = state.run, P = R.processes, n = P.length;
      var pIndex = {}; P.forEach(function (p, i) { pIndex[p.id] = i; });
      var byId = {}, perProc = P.map(function () { return []; });
      R.events.forEach(function (e) { byId[e.id] = e; perProc[pIndex[e.p]].push(e); });
      perProc.forEach(function (list) { list.sort(function (a, b) { return a.x - b.x; }); });
      var sendOf = {}, recvOf = {};
      R.messages.forEach(function (m, i) { m._i = i; if (m.to) recvOf[m.to] = m; sendOf[m.from] = sendOf[m.from] || []; sendOf[m.from].push(m); });
      var info = {};
      var done = 0, guard = 0, total = R.events.length;
      perProc.forEach(function (list, pi) { list.forEach(function (e, k) { info[e.id] = { e: e, pi: pi, k: k, prev: k ? list[k - 1].id : null }; }); });
      while (done < total && guard++ < total + 5) {
        R.events.forEach(function (e) {
          var I = info[e.id]; if (I.ok) return;
          if (I.prev && !info[I.prev].ok) return;
          var m = recvOf[e.id];
          if (m && !(info[m.from] && info[m.from].ok)) return;
          var prevL = I.prev ? info[I.prev].lamport : 0;
          var prevV = I.prev ? info[I.prev].vector.slice() : P.map(function () { return 0; });
          var prevH = I.prev ? info[I.prev].hist.slice() : [];
          var lam, vec = prevV, hist = prevH, why;
          if (m) {
            var S = info[m.from];
            var mx = Math.max(prevL, S.lamport);
            lam = mx + 1;
            why = { kind: 'recv', prev: prevL, ts: S.lamport, max: mx, msg: m, vprev: prevV.slice(), vts: S.vector.slice() };
            for (var j = 0; j < n; j++) vec[j] = Math.max(vec[j], S.vector[j]);
            S.hist.forEach(function (x) { if (hist.indexOf(x) < 0) hist.push(x); });
          } else {
            lam = prevL + 1;
            why = { kind: sendOf[e.id] ? 'send' : 'internal', prev: prevL, vprev: prevV.slice(), msgs: sendOf[e.id] || [] };
          }
          vec[I.pi] += 1;
          hist.push(e.id);
          I.lamport = lam; I.vector = vec; I.hist = hist; I.why = why; I.ok = true; done++;
        });
      }
      return { P: P, n: n, pIndex: pIndex, byId: byId, perProc: perProc, info: info, sendOf: sendOf, recvOf: recvOf };
    }

    function hb(D, a, b) { return a !== b && D.info[b].hist.indexOf(a) >= 0; }
    function vlt(u, v) { var le = true, lt = false; for (var i = 0; i < u.length; i++) { if (u[i] > v[i]) le = false; if (u[i] < v[i]) lt = true; } return le && lt; }
    function vfmt(v) { return '[' + v.join(',') + ']'; }
    function hfmt(hs) { return '{' + hs.join(', ') + '}'; }
    function pathBetween(D, a, b) {
      // BFS over local-successor and message edges
      var adj = {};
      D.perProc.forEach(function (list) { list.forEach(function (e, k) { adj[e.id] = adj[e.id] || []; if (k + 1 < list.length) adj[e.id].push(list[k + 1].id); }); });
      state.run.messages.forEach(function (m) { if (m.to) adj[m.from].push(m.to); });
      var prev = {}, q = [a], seen = {}; seen[a] = 1;
      while (q.length) { var c = q.shift(); if (c === b) break; (adj[c] || []).forEach(function (nx) { if (!seen[nx]) { seen[nx] = 1; prev[nx] = c; q.push(nx); } }); }
      if (!seen[b]) return null;
      var path = [b]; while (path[0] !== a) path.unshift(prev[path[0]]);
      return path;
    }

    /* ---------------- cuts & recovery ---------------- */
    function maxX() { var m = 0; state.run.events.forEach(function (e) { if (e.x > m) m = e.x; }); return m; }
    function initCut() {
      state.cut = {};
      var mid = maxX() / 2 + 0.25;
      state.run.processes.forEach(function (p) { state.cut[p.id] = mid; });
    }
    function inCut(e) { return state.cut && e.x < state.cut[e.p]; }
    function cutReport(D) {
      var orphans = [], transit = [];
      state.run.messages.forEach(function (m) {
        if (!m.to) return;
        var s = D.byId[m.from], r = D.byId[m.to];
        var sIn = inCut(s), rIn = inCut(r);
        if (rIn && !sIn) orphans.push(m);
        if (sIn && !rIn) transit.push(m);
      });
      return { orphans: orphans, transit: transit };
    }
    function mname(m) {
      var route = m.to ? m.from + '→' + m.to : m.from + '→ ' + procName(m.target) + ', still in flight';
      return m.label ? '“' + m.label + '” (' + route + ')' : route;
    }
    function crash(pid) {
      var D = derive();
      var cps = state.run.checkpoints;
      function lastCkptBefore(p, x) {
        var best = null; cps.forEach(function (c) { if (c.p === p && c.x < x && (!best || c.x > best.x)) best = c; });
        return best;
      }
      state.cut = {};
      state.run.processes.forEach(function (p) { state.cut[p.id] = maxX() + 1; });
      var steps = [];
      var c0 = lastCkptBefore(pid, maxX() + 1);
      state.cut[pid] = c0 ? c0.x : 0;
      steps.push(procName(pid) + ' crashes and restarts from ' + (c0 ? 'checkpoint ' + c0.name : 'its initial state') + '.');
      for (var guard = 0; guard < 50; guard++) {
        var rep = cutReport(D);
        if (!rep.orphans.length) break;
        var m = rep.orphans[0], r = D.byId[m.to];
        var c = lastCkptBefore(r.p, r.x);
        state.cut[r.p] = c ? c.x : 0;
        steps.push('Message ' + mname(m) + ' would be an orphan: its receive survives but its send was undone. ' +
          procName(r.p) + ' rolls back to ' + (c ? 'checkpoint ' + c.name : 'its initial state') + '.');
      }
      var rolled = state.run.processes.filter(function (p) { return p.id !== pid && state.cut[p.id] <= maxX(); }).length;
      var toStart = state.run.processes.filter(function (p) {
        var first = D.perProc[D.pIndex[p.id]][0]; return first && state.cut[p.id] <= first.x;
      }).map(function (p) { return p.name || p.id; });
      state.recovery = { failed: pid, steps: steps, rolled: rolled, toStart: toStart };
      state.tool = 'cut';
      render();
    }
    function procName(pid) { var p = state.run.processes.filter(function (q) { return q.id === pid; })[0]; return p ? (p.name || p.id) : pid; }

    /* ---------------- sandbox ---------------- */
    function nextId(pid) {
      var c = state.run.events.filter(function (e) { return e.p === pid; }).length + 1;
      return pid + c;
    }
    function snapshot() { state.history.push(JSON.stringify({ run: state.run, pending: state.pending })); if (state.history.length > 60) state.history.shift(); }
    function addInternal(pid) { snapshot(); var id = nextId(pid); state.run.events.push({ id: id, p: pid, x: maxX() + 1 }); state.sel = id; state.cmp = null; render(); }
    function addSend(pid, to) {
      snapshot(); var id = nextId(pid);
      state.run.events.push({ id: id, p: pid, x: maxX() + 1 });
      var m = { from: id, to: null, target: to, label: 'm' + (state.run.messages.length + 1) };
      state.run.messages.push(m); state.pending.push(m.label);
      state.sel = id; state.cmp = null; render();
    }
    function deliver(label) {
      var m = state.run.messages.filter(function (x) { return x.label === label && !x.to; })[0]; if (!m) return;
      snapshot(); var id = nextId(m.target);
      state.run.events.push({ id: id, p: m.target, x: maxX() + 1 });
      m.to = id; state.pending = state.pending.filter(function (l) { return l !== label; });
      state.sel = id; state.cmp = null; render();
    }
    function undo() { if (!state.history.length) return; var s = JSON.parse(state.history.pop()); state.run = s.run; state.pending = s.pending; state.sel = state.cmp = null; render(); }

    /* ---------------- DOM skeleton ---------------- */
    host.classList.add('st');
    host.innerHTML = '';
    var top = el('div', 'ds-row');
    var seg = el('div', 'ds-seg'); seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', 'Timestamp labels');
    var modeBtns = {};
    if (modes.length > 1) {
      modes.forEach(function (m) {
        var b = el('button', null, MODE_NAMES[m] || m); b.type = 'button';
        b.addEventListener('click', function () { state.mode = m; render(); });
        modeBtns[m] = b; seg.appendChild(b);
      });
      top.appendChild(seg);
    }
    var toolSeg = null, toolBtns = {};
    if (opts.cut) {
      toolSeg = el('div', 'ds-seg'); toolSeg.setAttribute('role', 'group'); toolSeg.setAttribute('aria-label', 'Tool');
      [['select', 'Inspect events'], ['cut', 'Draw a cut']].forEach(function (t) {
        var b = el('button', null, t[1]); b.type = 'button';
        b.addEventListener('click', function () { state.tool = t[0]; state.recovery = null; if (t[0] === 'cut' && !state.cut) initCut(); render(); });
        toolBtns[t[0]] = b; toolSeg.appendChild(b);
      });
      top.appendChild(toolSeg);
    }
    var presetSel = null;
    if (opts.presets) {
      var lab = el('label', null, 'Run ');
      presetSel = el('select');
      Object.keys(opts.presets).forEach(function (k) { var o = el('option', null, k); o.value = k; presetSel.appendChild(o); });
      presetSel.addEventListener('change', function () { load(opts.presets[presetSel.value]); render(); });
      lab.appendChild(presetSel); top.appendChild(lab);
    }
    host.appendChild(top);

    var sandbox = null, sbProc, sbTarget, sbPending, sbDeliver, sbUndo;
    if (opts.editable) {
      sandbox = el('div', 'ds-row');
      var l1 = el('label', null, 'At '); sbProc = el('select'); l1.appendChild(sbProc); sandbox.appendChild(l1);
      var bi = btn('+ internal event'); bi.addEventListener('click', function () { addInternal(sbProc.value); }); sandbox.appendChild(bi);
      var l2 = el('label', null, 'send to '); sbTarget = el('select'); l2.appendChild(sbTarget); sandbox.appendChild(l2);
      var bs = btn('+ send'); bs.addEventListener('click', function () { if (sbTarget.value === sbProc.value) return; addSend(sbProc.value, sbTarget.value); }); sandbox.appendChild(bs);
      var l3 = el('label', null, 'in flight '); sbPending = el('select'); l3.appendChild(sbPending); sandbox.appendChild(l3);
      sbDeliver = btn('deliver'); sbDeliver.addEventListener('click', function () { deliver(sbPending.value); }); sandbox.appendChild(sbDeliver);
      sbUndo = btn('undo'); sbUndo.addEventListener('click', undo); sandbox.appendChild(sbUndo);
      var br = btn('clear'); br.addEventListener('click', function () {
        snapshot(); state.run.events = []; state.run.messages = []; state.pending = []; state.sel = state.cmp = null; render();
      }); sandbox.appendChild(br);
      host.appendChild(sandbox);
    }
    var ckRow = null;
    if (opts.checkpoints || (opts.presets && Object.keys(opts.presets).some(function (k) { return (opts.presets[k].checkpoints || []).length; }))) {
      ckRow = el('div', 'ds-row');
      host.appendChild(ckRow);
    }

    var canvas = el('div', 'st-canvas'); host.appendChild(canvas);
    var legend = el('div', 'st-legend');
    legend.innerHTML = '<span><i class="sel"></i>selected</span><span><i class="past"></i>causal past</span><span><i class="future"></i>causal future</span><span><i class="conc"></i>concurrent</span>';
    host.appendChild(legend);
    if (opts.caption) { var cap = el('p', 'ds-inst-howto', opts.caption); cap.style.marginTop = '.5rem'; host.appendChild(cap); }
    var readout = el('div', 'ds-readout'); readout.setAttribute('aria-live', 'polite'); host.appendChild(readout);
    var verdict = el('div', 'ds-verdict'); verdict.hidden = true; host.appendChild(verdict);

    /* ---------------- rendering ---------------- */
    function stepFor(D) {
      if (state.mode === 'vector') return Math.max(74, 22 + D.n * 15);
      if (state.mode === 'history') {
        var L = 0; for (var k in D.info) L = Math.max(L, hfmt(D.info[k].hist).length);
        return Math.max(84, Math.min(190, L * 6.1));
      }
      return 66;
    }
    function label(D, id) {
      var I = D.info[id]; if (!I || !I.ok) return '';
      if (state.mode === 'lamport') return String(I.lamport);
      if (state.mode === 'vector') return vfmt(I.vector);
      if (state.mode === 'history') return hfmt(I.hist);
      return '';
    }

    function render() {
      var D = derive();
      var R = state.run, P = D.P;
      Object.keys(modeBtns).forEach(function (m) { modeBtns[m].setAttribute('aria-pressed', String(state.mode === m)); });
      Object.keys(toolBtns).forEach(function (t) { toolBtns[t].setAttribute('aria-pressed', String(state.tool === t)); });
      if (sandbox) {
        [sbProc, sbTarget].forEach(function (s, i) {
          var keep = s.value; s.innerHTML = '';
          P.forEach(function (p, j) { var o = el('option', null, p.name || p.id); o.value = p.id; s.appendChild(o); });
          s.value = keep || (P[i] || P[0]).id;
          if (!s.value) s.value = (P[i] || P[0]).id;
        });
        sbPending.innerHTML = '';
        state.pending.forEach(function (l) {
          var m = R.messages.filter(function (x) { return x.label === l; })[0];
          var o = el('option', null, l + ': ' + m.from + ' → ' + procName(m.target)); o.value = l; sbPending.appendChild(o);
        });
        if (!state.pending.length) { var o = el('option', null, '(none)'); o.value = ''; sbPending.appendChild(o); }
        sbDeliver.disabled = !state.pending.length; sbUndo.disabled = !state.history.length;
      }
      if (ckRow) {
        ckRow.innerHTML = '';
        if ((R.checkpoints || []).length) {
          ckRow.appendChild(el('span', 'ds-muted', 'Crash a process and roll back: '));
          ckRow.lastChild.style.font = '.8rem var(--lk-utility)';
          P.forEach(function (p) { var b = btn('crash ' + (p.name || p.id)); b.addEventListener('click', function () { crash(p.id); }); ckRow.appendChild(b); });
          if (state.tool === 'cut' && !opts.cut) {
            var back = btn('back to inspecting'); back.addEventListener('click', function () { state.tool = 'select'; state.recovery = null; state.cut = null; render(); }); ckRow.appendChild(back);
          }
        }
      }

      var step = stepFor(D), left = 78, rowH = 74, topPad = 34;
      var xs = function (x) { return left + x * step; };
      var W = Math.max(560, left + (maxX() + 1.2) * step + (state.pending.length ? 40 : 0));
      var H = topPad + P.length * rowH + 6;
      var svg = h('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'group', 'aria-label': 'Space-time diagram' });
      var defs = h('defs');
      var mk = h('marker', { id: 'st-arrow-' + uid, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
      mk.appendChild(h('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'var(--lk-cobalt)' }));
      defs.appendChild(mk);
      var mk2 = h('marker', { id: 'st-arrow-v-' + uid, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
      mk2.appendChild(h('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'var(--lk-vermilion)' }));
      defs.appendChild(mk2);
      svg.appendChild(defs);
      var ys = function (pid) { return topPad + D.pIndex[pid] * rowH + 22; };

      // time arrow
      svg.appendChild(h('text', { x: W - 8, y: 14, 'text-anchor': 'end', 'font-family': 'var(--lk-mono)', 'font-size': 10, fill: 'var(--lk-ink-soft)' }, 'physical time →'));

      // process lines
      P.forEach(function (p) {
        var y = ys(p.id);
        svg.appendChild(h('line', { x1: left - 10, y1: y, x2: W - 10, y2: y, stroke: 'var(--lk-rule)', 'stroke-width': 1.4 }));
        svg.appendChild(h('text', { x: 8, y: y + 4, 'font-family': 'var(--lk-utility)', 'font-size': 13, 'font-weight': 700, fill: 'var(--lk-ink)' }, p.name || p.id));
      });

      // checkpoints
      (R.checkpoints || []).forEach(function (c) {
        var x = xs(c.x), y = ys(c.p);
        svg.appendChild(h('rect', { x: x - 5, y: y - 11, width: 10, height: 22, fill: 'var(--lk-paper-light)', stroke: 'var(--lk-forest)', 'stroke-width': 2 }));
        svg.appendChild(h('text', { x: x, y: y - 16, 'text-anchor': 'middle', 'font-family': 'var(--lk-mono)', 'font-size': 10, fill: 'var(--lk-forest)' }, c.name || ''));
      });

      // relations to selection
      var sel = state.sel && D.info[state.sel] ? state.sel : null;
      function relOf(id) {
        if (!sel) return '';
        if (id === sel) return 'sel';
        if (hb(D, id, sel)) return 'past';
        if (hb(D, sel, id)) return 'future';
        return 'conc';
      }

      // messages
      var cutRep = state.cut && state.tool === 'cut' ? cutReport(D) : null;
      R.messages.forEach(function (m) {
        var s = D.byId[m.from]; if (!s) return;
        var x1 = xs(s.x), y1 = ys(s.p);
        var bad = cutRep && cutRep.orphans.indexOf(m) >= 0;
        var transit = cutRep && cutRep.transit.indexOf(m) >= 0;
        if (m.to) {
          var r = D.byId[m.to]; var x2 = xs(r.x), y2 = ys(r.p);
          var dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy) || 1;
          var ex = x2 - dx / len * 11, ey = y2 - dy / len * 11;
          var line = h('line', { x1: x1, y1: y1, x2: ex, y2: ey, stroke: bad ? 'var(--lk-vermilion)' : 'var(--lk-cobalt)', 'stroke-width': bad || transit ? 2.4 : 1.5,
            'stroke-dasharray': transit ? '5 4' : null, 'marker-end': 'url(#' + (bad ? 'st-arrow-v-' : 'st-arrow-') + uid + ')' });
          svg.appendChild(line);
          if (m.label) {
            var mxp = (x1 + x2) / 2, myp = (y1 + y2) / 2;
            var t = h('text', { x: mxp + 6, y: myp - 4, 'font-family': 'var(--lk-mono)', 'font-size': 10, fill: bad ? 'var(--lk-vermilion)' : 'var(--lk-cobalt-dark)' }, m.label);
            svg.appendChild(t);
          }
        } else {
          var ty = ys(m.target), tx = x1 + step * 0.9;
          var dyy = ty - y1, yEnd = y1 + dyy * 0.55;
          svg.appendChild(h('line', { x1: x1, y1: y1, x2: tx, y2: yEnd, stroke: 'var(--lk-cobalt)', 'stroke-width': 1.5, 'stroke-dasharray': '3 3', 'marker-end': 'url(#st-arrow-' + uid + ')' }));
          svg.appendChild(h('text', { x: tx + 4, y: yEnd + 4, 'font-family': 'var(--lk-mono)', 'font-size': 10, fill: 'var(--lk-cobalt-dark)' }, m.label + ' in flight'));
        }
      });

      // cut line
      if (state.cut && state.tool === 'cut') {
        var pts = [];
        P.forEach(function (p) { var cx = xs(Math.min(state.cut[p.id], maxX() + 0.9)); var y = ys(p.id); pts.push(cx + ',' + (y - rowH / 2 + 4)); pts.push(cx + ',' + (y + rowH / 2 - 4)); });
        var consistent = cutRep && !cutRep.orphans.length;
        svg.appendChild(h('polyline', { points: pts.join(' '), fill: 'none', stroke: consistent ? 'var(--lk-forest)' : 'var(--lk-vermilion)', 'stroke-width': 2.2, 'stroke-dasharray': '7 4' }));
      }

      // events
      R.events.forEach(function (e) {
        var I = D.info[e.id]; var x = xs(e.x), y = ys(e.p);
        var rel = relOf(e.id);
        var g = h('g', { class: 'st-ev', tabindex: 0, role: 'button', 'aria-label': 'Event ' + e.id + (label(D, e.id) ? ', timestamp ' + label(D, e.id) : '') });
        var fill = 'var(--lk-paper-light)', stroke = 'var(--lk-cobalt)', sw = 1.8, dash = null, op = 1;
        if (rel === 'past') { fill = 'var(--lk-cobalt)'; }
        else if (rel === 'future') { fill = 'var(--lk-vermilion)'; stroke = 'var(--lk-vermilion)'; }
        else if (rel === 'conc') { stroke = 'var(--lk-rule)'; dash = '3 2'; op = .85; }
        else if (rel === 'sel') { stroke = 'var(--lk-ink)'; sw = 3.4; fill = 'var(--lk-paper)'; }
        if (state.cmp === e.id) { stroke = 'var(--lk-ink)'; sw = 3.4; }
        var outside = state.cut && state.tool === 'cut' && !inCut(e);
        if (outside) op = .38;
        g.appendChild(h('circle', { class: 'st-dot', cx: x, cy: y, r: 8.5, fill: fill, stroke: stroke, 'stroke-width': sw, 'stroke-dasharray': dash, opacity: op }));
        g.appendChild(h('text', { x: x, y: y + 23, 'text-anchor': 'middle', 'font-family': 'var(--lk-mono)', 'font-size': 10.5, fill: 'var(--lk-ink-soft)', opacity: op }, e.id));
        var lb = label(D, e.id);
        if (lb) g.appendChild(h('text', { x: x, y: y - 14, 'text-anchor': 'middle', 'font-family': 'var(--lk-mono)', 'font-size': state.mode === 'history' ? 9.5 : 11.5, 'font-weight': 600, fill: 'var(--lk-cobalt-dark)', opacity: op }, lb));
        g.addEventListener('click', function (ev) { onEvent(e.id, ev); });
        g.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onEvent(e.id, ev); } });
        svg.appendChild(g);
      });

      canvas.innerHTML = ''; canvas.appendChild(svg);
      legend.hidden = !sel || state.tool === 'cut';
      renderReadout(D, cutRep);
    }

    function onEvent(id, ev) {
      if (state.tool === 'cut') {
        var D = derive(); var e = D.byId[id]; var list = D.perProc[D.pIndex[e.p]];
        var k = list.indexOf(e);
        var nextX = k + 1 < list.length ? list[k + 1].x : e.x + 1;
        var here = (e.x + nextX) / 2;
        // clicking the event right after the frontier again moves the frontier back before it
        state.cut[e.p] = Math.abs(state.cut[e.p] - here) < 1e-9 ? (k ? (list[k - 1].x + e.x) / 2 : e.x - 0.5) : here;
        state.recovery = null;
        render(); return;
      }
      if (state.sel === id && !state.cmp) { state.sel = null; }
      else if (opts.compare !== false && state.sel && state.sel !== id && !state.cmp) { state.cmp = id; }
      else { state.sel = id; state.cmp = null; }
      render();
    }

    function renderReadout(D, cutRep) {
      verdict.hidden = true; verdict.className = 'ds-verdict';
      if (state.tool === 'cut' && state.cut) {
        var parts = [];
        if (state.recovery) {
          parts.push('<b>Rollback trace</b><ol style="margin:.3rem 0 .3rem 1.1rem;padding:0">' + state.recovery.steps.map(function (s) { return '<li style="font-size:.9rem">' + s + '</li>'; }).join('') + '</ol>');
        } else {
          parts.push('Click an event to move that process’s frontier just after it (click again to move it back). Everything left of the dashed line is inside the cut.');
        }
        if (cutRep.transit.length) parts.push('In transit across the cut (must be recorded as channel state): ' + cutRep.transit.map(mname).join(', ') + '.');
        readout.innerHTML = parts.join('<br>');
        verdict.hidden = false;
        if (cutRep.orphans.length) {
          verdict.className = 'ds-verdict bad';
          verdict.textContent = 'Inconsistent cut: ' + cutRep.orphans.map(mname).join(', ') + ' is received inside the cut but sent outside it (an effect without its cause).';
        } else {
          verdict.className = 'ds-verdict ok';
          verdict.textContent = state.recovery
            ? 'Recovery line reached: consistent. ' + (state.recovery.rolled ? (state.recovery.rolled === 1 ? 'One other process' : state.recovery.rolled + ' other processes') + ' had to roll back as well (' + (state.recovery.steps.length - 1) + ' rollback step' + (state.recovery.steps.length === 2 ? '' : 's') + ' after the crash).' : 'No other process had to roll back.') +
              (state.recovery.toStart.length ? ' ' + state.recovery.toStart.join(' and ') + (state.recovery.toStart.length > 1 ? ' are' : ' is') + ' back at the initial state: the domino effect undid all the work.' : '')
            : 'Consistent cut: no message is received inside the cut unless it was also sent inside it.';
        }
        return;
      }
      if (!state.sel || !D.info[state.sel]) {
        readout.innerHTML = state.run.events.length ? 'Select an event to see its causal past and future, and how its timestamp was computed. Then select a second event to compare the two; click the selected event again to clear.' : 'Empty run. Use the toolbar to add events and messages.';
        return;
      }
      var a = state.sel, I = D.info[a], w = I.why, n = D.n;
      var lines = [];
      var kind = w.kind === 'recv' ? 'receive of ' + mname(w.msg) : w.kind === 'send' ? 'send of ' + w.msgs.map(mname).join(', ') : 'internal event';
      lines.push('<b>' + a + '</b> on ' + procName(I.e.p) + ' — ' + kind + '.');
      if (state.mode === 'lamport' || state.mode === 'none') {
        if (w.kind === 'recv') lines.push('Lamport: <code>lc = max(' + w.prev + ', ' + w.ts + ') = ' + w.max + '</code>, then the receive is itself an event: <code>lc = ' + w.max + ' + 1 = ' + I.lamport + '</code>.');
        else lines.push('Lamport: <code>lc = ' + w.prev + ' + 1 = ' + I.lamport + '</code>' + (w.kind === 'send' ? '; this value is piggybacked on the message.' : '.'));
      }
      if (state.mode === 'vector') {
        if (w.kind === 'recv') lines.push('Vector: merge <code>max(' + vfmt(w.vprev) + ', ' + vfmt(w.vts) + ')</code>, then increment own entry → <code>' + vfmt(I.vector) + '</code>.');
        else lines.push('Vector: increment own entry of <code>' + vfmt(w.vprev) + '</code> → <code>' + vfmt(I.vector) + '</code>' + (w.kind === 'send' ? ', piggybacked as ts(m).' : '.'));
      }
      if (state.mode === 'history') lines.push('Causal history: <code>' + hfmt(I.hist) + '</code> — ' + I.hist.length + ' event(s).');
      var past = I.hist.filter(function (x) { return x !== a; });
      var fut = state.run.events.filter(function (e) { return hb(D, a, e.id); }).map(function (e) { return e.id; });
      var conc = state.run.events.filter(function (e) { return e.id !== a && !hb(D, a, e.id) && !hb(D, e.id, a); }).map(function (e) { return e.id; });
      lines.push('Past: ' + (past.length ? past.join(' ') : '—') + ' · Future: ' + (fut.length ? fut.join(' ') : '—') + ' · Concurrent: ' + (conc.length ? conc.join(' ') : '—'));
      readout.innerHTML = lines.join('<br>');

      if (state.cmp && D.info[state.cmp]) {
        var b = state.cmp, J = D.info[b];
        var rel, path = null;
        if (hb(D, a, b)) { rel = a + ' → ' + b; path = pathBetween(D, a, b); }
        else if (hb(D, b, a)) { rel = b + ' → ' + a; path = pathBetween(D, b, a); }
        else rel = a + ' ∥ ' + b + ' (concurrent: no causal path either way)';
        var la = I.lamport, lb2 = J.lamport;
        var lamTxt = 'C(' + a + ') = ' + la + ', C(' + b + ') = ' + lb2;
        var misleading = rel.indexOf('∥') >= 0 && la !== lb2;
        var vtxt = vlt(I.vector, J.vector) ? vfmt(I.vector) + ' < ' + vfmt(J.vector) : vlt(J.vector, I.vector) ? vfmt(J.vector) + ' < ' + vfmt(I.vector) : vfmt(I.vector) + ' and ' + vfmt(J.vector) + ' are incomparable';
        verdict.hidden = false;
        verdict.className = 'ds-verdict ' + (misleading ? 'bad' : 'ok');
        verdict.innerHTML = 'Relation: <b>' + rel + '</b>' + (path ? ' via ' + path.join(' → ') : '') + '<br>Scalar: ' + lamTxt +
          (misleading ? ' — the scalar values are ordered although the events are concurrent: C(a) < C(b) does not imply a → b.' : '') +
          '<br>Vector: ' + vtxt + (rel.indexOf('∥') >= 0 ? ' — incomparable vectors reveal concurrency.' : ' — vector order matches causality.');
      }
    }

    load(opts.presets ? opts.presets[Object.keys(opts.presets)[0]] : { processes: opts.processes, events: opts.events || [], messages: opts.messages || [], checkpoints: opts.checkpoints || [] });
    if (opts.select) state.sel = opts.select;
    function setCut(afterEvents) {
      // afterEvents: {procId: eventId | null}; the frontier goes just after that event (null = before the first event)
      var D = derive(); state.cut = {}; state.recovery = null; state.tool = 'cut';
      state.run.processes.forEach(function (p) {
        var list = D.perProc[D.pIndex[p.id]], id = afterEvents[p.id];
        if (id == null) { state.cut[p.id] = list.length ? list[0].x - 0.5 : 0; return; }
        var k = list.indexOf(D.byId[id]); var e = list[k];
        state.cut[p.id] = k + 1 < list.length ? (e.x + list[k + 1].x) / 2 : e.x + 0.5;
      });
      render();
    }
    if (opts.initialCut) { state.tool = 'cut'; setCut(opts.initialCut); }
    render();
    return { render: render, select: function (id) { state.sel = id; state.cmp = null; render(); }, setMode: function (m) { state.mode = m; render(); }, crash: crash, setCut: setCut,
      load: function (run) { load(run); render(); } };
  }

  global.DSSpaceTime = { mount: mount };
})(window);
