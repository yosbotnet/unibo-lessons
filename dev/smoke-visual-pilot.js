const { chromium } = require('playwright');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const cases = [
  ['sap/cap-08-eventstorming.html', 'assets/img/eventstorming-workshop.webp', 'illustrative reconstruction'],
  ['irs/cap-02-history-of-robotics.html', 'assets/img/grey-walter-tortoises.webp', 'artistic reconstruction'],
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  let passed = 0;
  const failures = [];
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    for (const [file, src, disclosure] of cases) {
      await page.goto('file://' + path.join(ROOT, file), { waitUntil: 'load' });
      const img = page.locator(`img[src="${src}"]`);
      const count = await img.count();
      if (count !== 1) failures.push(`${file} ${viewport.width}px: image count ${count}`);
      else {
        await img.scrollIntoViewIfNeeded();
        await img.evaluate(el => el.decode());
        const state = await img.evaluate(el => {
          const r = el.getBoundingClientRect();
          const fig = el.closest('figure');
          return {
            complete: el.complete,
            naturalWidth: el.naturalWidth,
            naturalHeight: el.naturalHeight,
            width: r.width,
            viewport: document.documentElement.clientWidth,
            alt: el.alt,
            caption: fig?.querySelector('figcaption')?.textContent || '',
          };
        });
        const checks = [
          [state.complete && state.naturalWidth === 1024 && state.naturalHeight === 576, 'decode/intrinsic size'],
          [state.width > 0 && state.width <= state.viewport, 'responsive bounds'],
          [state.alt.trim().length >= 40, 'descriptive alt'],
          [state.caption.toLowerCase().includes(disclosure), 'reconstruction disclosure'],
        ];
        for (const [ok, name] of checks) {
          if (ok) { passed++; console.log(`PASS ${file} ${viewport.width}px: ${name}`); }
          else failures.push(`${file} ${viewport.width}px: ${name}`);
        }
      }
    }
    if (errors.length) failures.push(`${viewport.width}px browser errors: ${errors.join(' | ')}`);
    else { passed++; console.log(`PASS ${viewport.width}px: zero page/console errors`); }
    await page.close();
  }
  await browser.close();
  if (failures.length) {
    failures.forEach(f => console.error('FAIL', f));
    console.error(`${passed} passed, ${failures.length} failed`);
    process.exit(1);
  }
  console.log(`${passed} passed, 0 failed`);
})().catch(e => { console.error(e); process.exit(1); });
