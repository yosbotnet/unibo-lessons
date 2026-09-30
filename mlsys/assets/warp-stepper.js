/* warp-stepper.js — step one warp through an if/else and watch the active mask.
   Each issue step runs one instruction for the lanes in the mask; lanes outside
   the mask sit idle. Cost = issue steps; efficiency = active lane-slots / (32 x steps). */
(function () {
  'use strict';
  var host = document.getElementById('w-warp');
  if (!host) return;

  var CASES = {
    none:   { label: 'no branch: every thread runs path A', kind: 'ifelse', take: function () { return true; } },
    warp0:  { label: 'if (warp % 2 == 0) — this is warp 0', kind: 'ifelse', take: function () { return true; } },
    warp1:  { label: 'if (warp % 2 == 0) — this is warp 1', kind: 'ifelse', take: function () { return false; } },
    parity: { label: 'if (lane % 2 == 0)', kind: 'ifelse', take: function (l) { return l % 2 === 0; } },
    one:    { label: 'if (lane != 0)', kind: 'ifelse', take: function (l) { return l !== 0; } },
    bounds: { label: 'if (i < n), n = 1003, last warp (i = 992…1023)', kind: 'guard', take: function (l) { return 992 + l < 1003; } }
  };

  function program(kind) {
    if (kind === 'guard') return [
      { t: 'i = blockIdx.x * blockDim.x + threadIdx.x;', p: 'all' },
      { t: 'if (i < n) {', p: 'all' },
      { t: '    x = in[i];', p: 'A' },
      { t: '    x = f(x);', p: 'A' },
      { t: '    out[i] = x;', p: 'A' },
      { t: '}', p: 'none' }
    ];
    return [
      { t: 'x = in[i];', p: 'all' },
      { t: 'if (cond) {', p: 'all' },
      { t: '    x = a1(x);', p: 'A' },
      { t: '    x = a2(x);', p: 'A' },
      { t: '    x = a3(x);', p: 'A' },
      { t: '} else {', p: 'none' },
      { t: '    x = b1(x);', p: 'B' },
      { t: '    x = b2(x);', p: 'B' },
      { t: '    x = b3(x);', p: 'B' },
      { t: '}', p: 'none' },
      { t: 'out[i] = x;', p: 'all' }
    ];
  }

  host.innerHTML =
    '<h4>One warp, one branch</h4>' +
    '<p class="w-sub">Pick a condition, then step. Each step is one instruction issued for the whole warp; only the highlighted lanes do useful work.</p>' +
    '<div class="w-controls"><label>Condition<select id="ws-case"></select></label></div>' +
    '<div class="ws-grid">' +
      '<pre class="ws-code" id="ws-code" aria-label="Program"></pre>' +
      '<div><div class="ws-lanes" id="ws-lanes" role="img" aria-label="32 lanes of the warp"></div>' +
      '<div class="ws-legend"><span class="ws-k a"></span>path A <span class="ws-k b"></span>path B <span class="ws-k all"></span>both <span class="ws-k off"></span>idle (masked)</div></div>' +
    '</div>' +
    '<div class="w-out">' +
      '<div class="w-stat"><span class="k">issue steps</span><span class="v" id="ws-steps">0</span></div>' +
      '<div class="w-stat"><span class="k">active lanes now</span><span class="v" id="ws-act">–</span></div>' +
      '<div class="w-stat"><span class="k">SIMD efficiency</span><span class="v" id="ws-eff">–</span></div>' +
    '</div>' +
    '<div class="w-verdict" id="ws-msg" role="status" aria-live="polite"></div>' +
    '<div class="lk-step-btns ws-btns"><button type="button" id="ws-step">Step</button><button type="button" id="ws-run">Run to end</button><button type="button" id="ws-reset" class="lk-step-reset">Reset</button></div>';

  var sel = host.querySelector('#ws-case');
  Object.keys(CASES).forEach(function (k) {
    var o = document.createElement('option'); o.value = k; o.textContent = CASES[k].label; sel.appendChild(o);
  });
  sel.value = 'parity';

  var laneEls = [];
  var lanesBox = host.querySelector('#ws-lanes');
  for (var l = 0; l < 32; l++) {
    var d = document.createElement('span'); d.className = 'ws-lane'; d.textContent = l; lanesBox.appendChild(d); laneEls.push(d);
  }

  var state;
  function build() {
    var c = CASES[sel.value], prog = program(c.kind);
    var takeA = [], anyA = false, anyB = false;
    for (var l = 0; l < 32; l++) { takeA[l] = c.take(l); if (takeA[l]) anyA = true; else anyB = true; }
    // the issue schedule: [line index, mask array, path]
    var sched = [];
    prog.forEach(function (ln, idx) {
      if (ln.p === 'all') sched.push({ line: idx, mask: takeA.map(function () { return true; }), path: 'all' });
      else if (ln.p === 'A' && anyA) sched.push({ line: idx, mask: takeA.slice(), path: 'A' });
      else if (ln.p === 'B' && anyB) sched.push({ line: idx, mask: takeA.map(function (x) { return !x; }), path: 'B' });
    });
    state = { prog: prog, sched: sched, pos: -1, slots: 0, anyA: anyA, anyB: anyB, kind: c.kind };
    render();
  }

  function render() {
    var code = host.querySelector('#ws-code');
    var cur = state.pos >= 0 ? state.sched[state.pos] : null;
    code.innerHTML = '';
    state.prog.forEach(function (ln, idx) {
      var s = document.createElement('span');
      s.className = 'ws-line' + (cur && cur.line === idx ? ' on' : '');
      var skipped = (ln.p === 'A' && !state.anyA) || (ln.p === 'B' && !state.anyB);
      if (skipped) s.className += ' skip';
      s.textContent = ln.t + (skipped ? '   // never issued' : '');
      code.appendChild(s); code.appendChild(document.createTextNode('\n'));
    });
    laneEls.forEach(function (e, l) {
      e.className = 'ws-lane';
      if (cur) e.className += cur.mask[l] ? (cur.path === 'A' ? ' a' : cur.path === 'B' ? ' b' : ' all') : ' off';
    });
    var steps = state.pos + 1;
    host.querySelector('#ws-steps').textContent = steps;
    host.querySelector('#ws-act').textContent = cur ? cur.mask.filter(Boolean).length + ' / 32' : '–';
    host.querySelector('#ws-eff').textContent = steps ? Math.round(100 * state.slots / (32 * steps)) + '%' : '–';
    var msg = host.querySelector('#ws-msg'), done = state.pos === state.sched.length - 1;
    msg.className = 'w-verdict';
    if (!cur) msg.textContent = 'Ready: ' + state.sched.length + ' instructions will be issued for this warp.';
    else if (!done) msg.textContent = 'Issuing "' + state.prog[cur.line].t.trim() + '" for ' + cur.mask.filter(Boolean).length + ' lanes.';
    else {
      if (state.kind === 'guard') {
        var active = state.sched[state.sched.length - 1].mask.filter(Boolean).length;
        msg.className = 'w-verdict mem';
        msg.textContent = 'Done in ' + steps + ' steps. The guard is a one-sided branch: there is no second path to issue, so the ' + (32 - active) +
          ' idle lanes cost lane-slots, not extra steps. And only this one warp of the whole grid is affected.';
      } else {
        var diverged = state.anyA && state.anyB;
        msg.className = 'w-verdict ' + (diverged ? 'bad' : 'comp');
        msg.textContent = diverged
          ? 'Diverged: the warp issued BOTH paths, ' + steps + ' steps in total. Every lane waited through the path it did not take.'
          : 'No divergence: the whole warp agreed, so only one path was issued (' + steps + ' steps).';
      }
    }
    host.querySelector('#ws-step').disabled = done;
    host.querySelector('#ws-run').disabled = done;
  }

  function step() {
    if (state.pos >= state.sched.length - 1) return;
    state.pos++;
    state.slots += state.sched[state.pos].mask.filter(Boolean).length;
    render();
  }
  host.querySelector('#ws-step').addEventListener('click', step);
  host.querySelector('#ws-run').addEventListener('click', function () { while (state.pos < state.sched.length - 1) step(); });
  host.querySelector('#ws-reset').addEventListener('click', build);
  sel.addEventListener('change', build);
  build();
})();
