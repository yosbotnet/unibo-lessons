// Campaign kit: progress kept in this browser (localStorage), score ladder, predictions,
// "explain it" boxes, earned mechanics. Every storage access is guarded: the page must work
// with no storage at all (private windows, blocked site data).
(function (root, factory) { const api = factory(); if (typeof module === 'object' && module.exports) module.exports = api; else root.Campaign = api; })(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const KEY = 'gpu-campaign-v1';
  // Boehm, "How to Optimize a CUDA Matmul Kernel for cuBLAS-like Performance" (RTX A6000, 4092x4092 FP32).
  const LADDER = [
    { id: 'naive', level: 1, name: 'Naive: one thread per output', pct: 1.3, gflops: 309.0 },
    { id: 'coalesced', level: 1, name: 'Coalesced memory access', pct: 8.5, gflops: 1986.5 },
    { id: 'tiled', level: 2, name: 'Shared-memory tiling', pct: 12.8, gflops: 2980.3 },
    { id: 'blocktile1d', level: 3, name: 'Several outputs per thread (1D)', pct: 36.5, gflops: 8474.7 },
    { id: 'blocktile2d', level: 4, name: 'A small tile per thread (2D)', pct: 68.7, gflops: 15971.7 },
    { id: 'vectorized', level: 5, name: 'Vectorised loads', pct: 78.4, gflops: 18237.3 },
    { id: 'autotuned', level: 5, name: 'Autotuned tile sizes', pct: 84.8, gflops: 19721.0 },
    { id: 'warptiled', level: 6, name: 'Warp tiling', pct: 93.7, gflops: 21779.3 }
  ];
  const MECHANICS = {
    grid: { name: 'Threads, blocks, grid', level: 1 },
    warp: { name: 'Warps: 32 threads in lockstep', level: 1 },
    coalescing: { name: 'Coalescing', level: 1 },
    roofline: { name: 'Arithmetic intensity & roofline', level: 2 },
    smem: { name: 'Shared memory', level: 2 },
    barrier: { name: '__syncthreads as a barrier', level: 2 },
    banks: { name: 'Shared-memory banks', level: 2 }
  };

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* storage unavailable: progress lives only in this page view */ } }
  function update(fn) { const s = load(); fn(s); save(s); return s; }

  // "gpu=Tesla T4;cublas=4213.5;naive=210.3;coalesced=1350.2;tiled=2102.9"
  function parseScore(text) {
    const out = {};
    for (const part of String(text).split(/[;\n|]/)) {
      const m = part.match(/^\s*([a-z0-9_]+)\s*[=:]\s*(.+?)\s*$/i);
      if (!m) continue;
      const k = m[1].toLowerCase(), v = m[2];
      if (k === 'gpu') out.gpu = v;
      else if (!isNaN(parseFloat(v))) out[k] = parseFloat(v);
    }
    if (!out.cublas) throw Error('the score line needs cublas=… (your GPU\'s cuBLAS speed)');
    const known = LADDER.map((r) => r.id).filter((id) => id in out);
    if (!known.length) throw Error('no kernel results found (expected naive=…, coalesced=… or tiled=…)');
    return out;
  }
  function pctOf(score, id) { return score && score[id] != null && score.cublas ? (100 * score[id]) / score.cublas : null; }

  const el = (tag, cls, text, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; if (parent) parent.appendChild(e); return e; };

  function mountLadder(sel, opts = {}) {
    const host = document.querySelector(sel); if (!host) return;
    const upTo = opts.upTo || 99;
    function render() {
      host.replaceChildren(); host.classList.add('gl-ladder');
      const score = load().score;
      el('div', 'gl-cap', score ? `Your GPU: ${score.gpu || 'unnamed'} · cuBLAS ${Math.round(score.cublas)} GFLOP/s · bars are % of cuBLAS on the same GPU` : 'Boehm\'s climb on an RTX A6000, as % of cuBLAS. Paste your notebook\'s score line below to add your own bars.', host);
      for (const r of LADDER) {
        const locked = r.level > upTo;
        const row = el('div', 'gl-rung' + (locked ? ' gl-locked' : ''), null, host);
        el('span', 'gl-rungname', (locked ? 'Level ' + r.level + ' · ' : '') + r.name, row);
        const bars = el('span', 'gl-rungbars', null, row);
        const ref = el('span', 'gl-bar gl-ref', null, bars); ref.style.width = r.pct + '%'; ref.title = `Boehm: ${r.pct}% (${r.gflops} GFLOP/s)`;
        const mine = pctOf(score, r.id);
        if (mine != null) { const b = el('span', 'gl-bar gl-mine', null, bars); b.style.width = Math.min(100, mine) + '%'; b.title = `you: ${mine.toFixed(1)}% (${Math.round(score[r.id])} GFLOP/s)`; }
        el('span', 'gl-rungval', (mine != null ? `you ${mine.toFixed(1)}% · ` : '') + `ref ${r.pct}%`, row);
      }
      if (opts.input !== false) {
        const form = el('div', 'gl-row gl-paste', null, host);
        const inp = el('input', null, null, form); inp.type = 'text'; inp.placeholder = 'paste the score line from the notebook'; inp.setAttribute('aria-label', 'score line from the notebook');
        const b = el('button', null, 'Add my score', form); b.type = 'button';
        const msg = el('p', 'gl-note', null, host); msg.setAttribute('role', 'status');
        b.onclick = () => { try { const sc = parseScore(inp.value); update((s) => { s.score = Object.assign({}, s.score && s.score.gpu === sc.gpu ? s.score : {}, sc); }); render(); } catch (e) { msg.textContent = e.message; } };
      }
    }
    render();
    return { render };
  }

  // A prediction: type a number before the reveal; the reveal compares it with the measured value.
  function mountPredict(sel, { id, question, unit, answer, source }) {
    const host = document.querySelector(sel); if (!host) return;
    function render() {
      host.replaceChildren(); host.classList.add('gl-predict');
      el('p', 'gl-strong', question, host);
      const saved = (load().predictions || {})[id];
      if (saved == null) {
        const row = el('div', 'gl-row', null, host);
        const inp = el('input', null, null, row); inp.type = 'number'; inp.step = 'any'; inp.placeholder = 'your guess'; inp.setAttribute('aria-label', question);
        el('span', null, unit, row);
        const b = el('button', null, 'Lock in my guess', row); b.type = 'button';
        b.onclick = () => { const v = parseFloat(inp.value); if (isNaN(v)) { inp.focus(); return; } update((s) => { (s.predictions = s.predictions || {})[id] = v; }); render(); };
        return;
      }
      const ratio = saved > 0 ? answer / saved : Infinity;
      const verdict = ratio > 0.8 && ratio < 1.25 ? 'Close: nice intuition.' : ratio >= 1.25 ? `Reality is ${ratio.toFixed(1)}x bigger than your guess.` : `Reality is ${(1 / ratio).toFixed(1)}x smaller than your guess.`;
      el('p', null, `You guessed ${saved} ${unit}. Measured: ${answer} ${unit}. ${verdict}`, host);
      if (source) el('p', 'gl-note', source, host);
      const again = el('button', 'gl-link', 'guess again', host); again.type = 'button';
      again.onclick = () => { update((s) => { delete (s.predictions || {})[id]; }); render(); };
    }
    render();
  }

  // Explain it to someone: free text (kept locally), then a checklist to compare against.
  function mountExplain(sel, { id, prompt, points }) {
    const host = document.querySelector(sel); if (!host) return;
    host.classList.add('gl-explain');
    el('p', 'gl-strong', prompt, host);
    const ta = el('textarea', null, null, host); ta.rows = 5; ta.setAttribute('aria-label', prompt);
    ta.value = ((load().explanations || {})[id] || {}).text || '';
    ta.oninput = () => update((s) => { const e = ((s.explanations = s.explanations || {})[id] = s.explanations[id] || {}); e.text = ta.value; });
    const d = el('details', null, null, host); el('summary', null, 'Compare with the key points', d);
    const ul = el('ul', null, null, d);
    const ticks = ((load().explanations || {})[id] || {}).ticks || {};
    points.forEach((p, i) => {
      const li = el('li', null, null, ul); const lab = el('label', null, null, li);
      const cb = el('input', null, null, lab); cb.type = 'checkbox'; cb.checked = !!ticks[i];
      cb.onchange = () => update((s) => { const e = ((s.explanations = s.explanations || {})[id] = s.explanations[id] || {}); (e.ticks = e.ticks || {})[i] = cb.checked; });
      lab.append(' ' + p);
    });
    el('p', 'gl-note', 'Tick what your explanation already said. Whatever stays unticked is what to reread.', d);
  }

  function mountComplete(sel, { level, mechanics }) {
    const host = document.querySelector(sel); if (!host) return;
    function render() {
      host.replaceChildren(); host.classList.add('gl-complete');
      const s = load(), done = (s.levels || {})[level];
      const wrap = el('div', 'gl-mechs', null, host);
      for (const m of mechanics) el('span', 'gl-mech' + (done ? ' on' : ''), MECHANICS[m].name, wrap);
      const b = el('button', null, done ? `Level ${level} complete · undo` : `Mark level ${level} complete`, host); b.type = 'button';
      b.onclick = () => { update((st) => { st.levels = st.levels || {}; if (done) delete st.levels[level]; else st.levels[level] = new Date().toISOString().slice(0, 10); }); render(); };
    }
    render();
  }

  function mountMap(sel) {
    const host = document.querySelector(sel); if (!host) return;
    const s = load(), levels = s.levels || {};
    host.querySelectorAll('[data-level]').forEach((card) => {
      const n = card.dataset.level; if (levels[n]) { card.classList.add('done'); const tag = card.querySelector('.gl-state'); if (tag) tag.textContent = 'complete · ' + levels[n]; }
    });
    const earned = Object.entries(MECHANICS).filter(([, m]) => levels[m.level]);
    const box = host.querySelector('.gl-earned');
    if (box) { box.replaceChildren(); if (!earned.length) el('span', 'gl-note', 'none yet: play level 1', box); for (const [, m] of earned) el('span', 'gl-mech on', m.name, box); }
  }

  return { KEY, LADDER, MECHANICS, parseScore, pctOf, load, save, mountLadder, mountPredict, mountExplain, mountComplete, mountMap };
});
