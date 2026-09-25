// Roofline lab: three ceilings for C = A x B on a chosen GPU, as a function of the tile size T.
// Simple, explicit models (the page says so):
//   compute peak   = SMs x FP32 lanes x 2 FLOP x clock
//   DRAM ceiling   = arithmetic intensity x bandwidth, with intensity = 2T/8 FLOP per byte
//                    (each float fetched from DRAM feeds T multiply-adds; T = 1 means no reuse, no cache)
//   SMEM ceiling   = for tiled kernels: per warp and k-step, 2 shared-memory accesses (a broadcast of As,
//                    a contiguous row of Bs) feed 32 FMAs; an SM serves one 128-byte access per clock,
//                    so 16 FMA = 32 FLOP per clock per SM
(function (root, factory) { const api = factory(); if (typeof module === 'object' && module.exports) module.exports = api; else root.RooflineLab = api; })(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const GPUS = {
    t4: { name: 'Tesla T4 (free Colab)', sms: 40, lanes: 64, ghz: 1.59, bw: 320 },
    l4: { name: 'L4 (Colab)', sms: 58, lanes: 128, ghz: 2.04, bw: 300 },
    a100: { name: 'A100 40GB', sms: 108, lanes: 64, ghz: 1.41, bw: 1555 },
    a6000: { name: 'RTX A6000 (Boehm\'s worklog)', sms: 84, lanes: 128, ghz: 1.80, bw: 768 },
    r3060: { name: 'RTX 3060', sms: 28, lanes: 128, ghz: 1.78, bw: 360 },
    r3080: { name: 'RTX 3080', sms: 68, lanes: 128, ghz: 1.71, bw: 760 },
    r4070: { name: 'RTX 4070', sms: 46, lanes: 128, ghz: 2.475, bw: 504 },
    r4090: { name: 'RTX 4090', sms: 128, lanes: 128, ghz: 2.52, bw: 1008 }
  };
  const SMEM_FLOP_PER_CLK = 32;
  function model(gpu, T) {
    const peak = gpu.sms * gpu.lanes * 2 * gpu.ghz;             // GFLOP/s
    const intensity = (2 * T) / 8;                               // FLOP per DRAM byte
    const dram = intensity * gpu.bw;                             // GFLOP/s
    const smem = T > 1 ? gpu.sms * SMEM_FLOP_PER_CLK * gpu.ghz : Infinity;
    const ceilings = [['compute peak', peak], ['DRAM traffic', dram], ['shared memory', smem]].filter(([, v]) => isFinite(v));
    const [limit, value] = ceilings.reduce((a, b) => (b[1] < a[1] ? b : a));
    return { peak, intensity, dram, smem, ceilings, limit, value, pctOfPeak: value / peak };
  }

  function mount(sel) {
    const host = document.querySelector(sel); if (!host) return;
    let key = 't4', T = 1;
    const el = (tag, cls, text, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; if (parent) parent.appendChild(e); return e; };
    const fmt = (v) => (v >= 1000 ? (v / 1000).toFixed(1) + ' TFLOP/s' : Math.round(v) + ' GFLOP/s');
    function render() {
      host.replaceChildren(); host.classList.add('gl-lab');
      const bar = el('div', 'gl-row', null, host);
      const gl = el('label', null, 'GPU ', bar); const gs = el('select', null, null, gl);
      for (const [k, g] of Object.entries(GPUS)) { const o = el('option', null, g.name, gs); o.value = k; }
      gs.value = key; gs.onchange = () => { key = gs.value; render(); };
      const ts = el('div', 'gl-seg', null, bar);
      for (const t of [1, 8, 16, 32]) { const b = el('button', T === t ? 'on' : '', t === 1 ? 'no tiling' : `tile ${t}x${t}`, ts); b.type = 'button'; b.setAttribute('aria-pressed', T === t); b.onclick = () => { T = t; render(); }; }
      const g = GPUS[key], m = model(g, T);
      el('p', 'gl-cap', `${g.sms} SMs x ${g.lanes} FP32 lanes x 2 x ${g.ghz} GHz = ${fmt(m.peak)} peak · ${g.bw} GB/s memory · intensity ${m.intensity} FLOP/byte`, host);
      const chart = el('div', 'gl-bars', null, host);
      for (const [name, v] of m.ceilings) {
        const row = el('div', 'gl-barrow' + (name === m.limit ? ' gl-limit' : ''), null, chart);
        el('span', 'gl-barname', name, row);
        const track = el('span', 'gl-track', null, row); const fill = el('span', 'gl-fill', null, track);
        fill.style.width = Math.max(1.5, Math.min(100, (100 * v) / m.peak)) + '%';
        el('span', 'gl-barval', fmt(v), row);
      }
      const out = el('div', 'gl-out', null, host); out.setAttribute('role', 'status');
      el('p', 'gl-strong', `Ceiling: ${fmt(m.value)} (${(m.pctOfPeak * 100).toFixed(1)}% of peak), set by ${m.limit}.`, out);
      if (T === 1) el('p', null, 'No tiling: every multiply-add needs two fresh floats from DRAM. In reality the L2 cache catches some of the reuse, so real untiled kernels beat this line; the cache is doing tiling for you, badly. The fix is to do it on purpose.', out);
      else if (m.limit === 'shared memory') el('p', null, 'The DRAM wall has moved far away, and a new one appeared: every multiply-add still reads two numbers, now from shared memory. That is level 3.', out);
      if (key === 'a6000') el('p', 'gl-note', 'Measured by Boehm on this GPU: untiled + coalesced 1,987 GFLOP/s, tiled (32x32) 2,980 GFLOP/s, cuBLAS 23,250 GFLOP/s.', out);
    }
    render();
  }
  return { GPUS, model, mount };
});
