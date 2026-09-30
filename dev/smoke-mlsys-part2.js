// Headless smoke test for ML Systems Part II chapters (6-8).
// Run: cd dev && node smoke-mlsys-part2.js [shots-dir]
// Checks: no console errors, no horizontal page scroll at 375px, every widget
// renders and reacts to its controls. With a directory argument it also saves
// full-page screenshots (desktop and phone) for a visual review.
const { chromium } = require('playwright');
const path = require('path');
const BASE = 'file://' + path.resolve(__dirname, '..', 'mlsys');
const SHOTS = process.argv[2];

let pass = 0, fail = 0;
function check(name, ok) { if (ok) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name); } }

const PAGES = [
  { file: 'cap-06-neural-networks-as-a-workload.html', widgets: ['#w-census', '#w-formats'],
    async interact(page) {
      const before = await page.locator('#w-census .w-out').textContent();
      await page.locator('#w-census select').first().selectOption('64');
      check('06: census reacts to M', (await page.locator('#w-census .w-out').textContent()) !== before);
      await page.locator('#w-census select').first().selectOption('1');
      await page.locator('#w-census input[type=checkbox]').check();
      check('06: launch floor marks launch-bound kernels', /launch/.test(await page.locator('#w-census .c6-rows').textContent()));
      check('06: FP16 stalls at 32 by default', /32/.test(await page.locator('#w-formats .w-out').textContent()));
      await page.locator('#w-formats select').nth(1).selectOption('FP32');
      check('06: FP32 total does not stall', /never/.test(await page.locator('#w-formats .w-out').textContent()));
    } },
  { file: 'cap-07-matmul-tiling.html', widgets: ['#w-tilewalk', '#w-tilecalc'],
    async interact(page) {
      await page.locator('#w-tilewalk .c7-btns button', { hasText: 'phase \u25b6' }).click();
      check('07: tile walker steps to phase 2', /2 of 4/.test(await page.locator('#w-tilewalk .w-out').textContent()));
      await page.locator('#w-tilewalk .c7-cbtn').nth(0).click();
      check('07: clicking a C tile resets the phase', /1 of 4/.test(await page.locator('#w-tilewalk .w-out').textContent()));
      check('07: T=16 is shared-bound at 3.9 TF', /3\.9 TF/.test(await page.locator('#w-tilecalc .w-bars').textContent()));
      await page.locator('#w-tilecalc select').selectOption('32');
      check('07: T=32 gives 67% occupancy', /67%/.test(await page.locator('#w-tilecalc .w-out').textContent()));
      await page.locator('#w-tilecalc input[type=checkbox]').check();
      check('07: LDS.128 lifts the ceiling to 6.2 TF', /6\.2 TF/.test(await page.locator('#w-tilecalc .w-bars').textContent()));
    } },
  { file: 'cap-08-matmul-tensor-cores.html', widgets: ['#w-hier', '#w-frag'],
    async interact(page) {
      check('08: v7 preset is valid, shared not the limit', /not the limit/.test(await page.locator('#w-hier .w-out').textContent()));
      await page.locator('#w-hier .c8-btns button', { hasText: 'ch. 7 tiled' }).click();
      check('08: chapter 7 preset shows 12% shared ceiling', /12\.5% of peak/.test(await page.locator('#w-hier .w-out').textContent()));
      await page.locator('#w-hier select').nth(5).selectOption('4');
      check('08: invalid tiling is reported', /Not a valid tiling/.test(await page.locator('#w-hier .w-verdict').textContent()));
      const cover = await page.evaluate(() => ['A', 'B', 'C'].map(k => {
        const cs = [...document.querySelectorAll('#w-frag .c8-f' + k + ' .c8-fc')];
        const per = {}; cs.forEach(c => { per[c.dataset.lane] = (per[c.dataset.lane] || 0) + 1; });
        return cs.length + ':' + Object.keys(per).length + ':' + Math.min(...Object.values(per)) + '-' + Math.max(...Object.values(per));
      }).join(' '));
      check('08: fragments cover A 256 / B 128 / C 128 cells, 32 lanes, 8/4/4 each (' + cover + ')', cover === '256:32:8-8 128:32:4-4 128:32:4-4');
      await page.locator('#w-frag .c8-lane').nth(0).click();
      check('08: lane 0 holds a0 at (0,0)', /a0=\(0,0\)/.test(await page.locator('#w-frag .w-verdict').textContent()));
    } },
];

(async () => {
  const browser = await chromium.launch();
  const fs = require('fs');
  for (const P of PAGES) {
    if (!fs.existsSync(path.join(__dirname, '..', 'mlsys', P.file))) { if (!P.optional) check(P.file + ' exists', false); continue; }
    for (const vp of [{ w: 1280, h: 900, tag: 'desk' }, { w: 375, h: 800, tag: 'phone' }]) {
      const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
      const errs = [];
      page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
      page.on('pageerror', e => errs.push(e.message));
      await page.goto(BASE + '/' + P.file);
      await page.waitForTimeout(400);
      const tag = P.file.slice(4, 6) + ' ' + vp.tag;
      for (const w of P.widgets) check(`${tag}: ${w} rendered`, (await page.locator(w + ' *').count()) > 5);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(`${tag}: no horizontal page scroll (${over}px)`, over <= 0);
      if (vp.tag === 'desk' && P.interact) await P.interact(page);
      check(`${tag}: no console errors ${errs.join(' | ')}`, errs.length === 0);
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${P.file.slice(0, 6)}-${vp.tag}.png`), fullPage: true });
      await page.close();
    }
  }
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
