// Smoke test for the PCD course (concept-first rewrite).
// Usage: node dev/smoke-pcd.js [course_dir] [page-filter]   (default: pcd). One browser, pages checked one at a time.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const dir = path.resolve(__dirname, '..', process.argv[2] || 'pcd');
const only = process.argv[3] ? new RegExp(process.argv[3]) : null;
const BANNED = [/il professore/i, /il docente/i, /\bprof\. ricci\b/i, /nota del redattore/i, /idea chiave/i, /\bTODO\b/, /lorem ipsum/i,
  /\bpiu\b/, /\bperche\b/, /\bpuo\b/, /\bcioe\b/, /\bcosi\b/, /\bgia\b/, /\bpoiche\b/, /\bfinche\b/, /\bsara\b/, /\b[Ee]' /, /\bQual e'/];

(async () => {
  const pages = fs.readdirSync(dir).filter(f => f.endsWith('.html') && (!only || only.test(f))).sort();
  const failures = [], ids = {}, links = {};
  const browser = await chromium.launch({ headless: true });
  for (const name of pages) {
    for (const width of [1280, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', e => errors.push('page: ' + e.message));
      page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
      await page.goto('file://' + path.join(dir, name), { waitUntil: 'load' });
      await page.waitForTimeout(250);
      errors.forEach(e => failures.push(`${name}@${width}: ${e}`));
      if (width === 390) {
        const over = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
        if (over > 1) failures.push(`${name}@390: page scrolls horizontally by ${over}px`);
        await page.close();
        continue;
      }
      const info = await page.evaluate(() => {
        document.querySelectorAll('details').forEach(d => d.open = true);
        const text = document.body.innerText;
        const escapes = [];
        document.querySelectorAll('svg').forEach(svg => {
          const v = svg.viewBox && svg.viewBox.baseVal; if (!v || !v.width) return;
          const box = svg.getBoundingClientRect(); if (!box.width) return;
          svg.querySelectorAll('text').forEach(t => {
            const r = t.getBoundingClientRect();
            if (r.width && (r.left < box.left - 2 || r.top < box.top - 2 || r.right > box.right + 2 || r.bottom > box.bottom + 2)) escapes.push(t.textContent.trim().slice(0, 40));
          });
        });
        const clone = document.body.cloneNode(true);
        clone.querySelectorAll('pre, #quiz, script, style, nav, .lk-toc, footer, .lk-coverage').forEach(e => e.remove());
        return { text, escapes, prose: clone.innerText.split(/\s+/).filter(Boolean).length,
          ids: [...document.querySelectorAll('[id]')].map(e => e.id),
          links: [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')).filter(h => !/^(https?:|mailto:)/.test(h)),
          h1: (document.querySelector('h1') || {}).textContent || '', navs: document.querySelectorAll('nav.lk-chnav').length,
          quiz: !!document.querySelector('#quiz'), coverage: !!document.querySelector('details.lk-coverage'),
          summary: /Il capitolo in un paragrafo/.test(text) };
      });
      ids[name] = new Set(info.ids); links[name] = info.links;
      if (!info.h1.trim()) failures.push(`${name}: no h1`);
      BANNED.forEach(re => { const m = info.text.match(re); if (m) failures.push(`${name}: banned/unaccented "${m[0]}" (${re})`); });
      info.escapes.forEach(t => failures.push(`${name}: SVG text escapes viewBox: "${t}"`));
      if (name.startsWith('cap-')) {
        if (info.navs !== 2) failures.push(`${name}: expected 2 chapter navs, got ${info.navs}`);
        if (!info.quiz) failures.push(`${name}: missing #quiz`);
        if (!info.coverage) failures.push(`${name}: missing coverage block`);
        if (!info.summary) failures.push(`${name}: missing "Il capitolo in un paragrafo"`);
      }
      console.log(`${name.padEnd(36)} prose ${String(info.prose).padStart(6)}`);
      await page.close();
    }
  }
  await browser.close();
  for (const name of pages) for (const href of links[name] || []) {
    const [file, hash] = href.split('#');
    const target = file || name;
    if (file && !fs.existsSync(path.join(dir, file))) { failures.push(`${name}: broken link ${href}`); continue; }
    if (hash && ids[target] && !ids[target].has(hash)) failures.push(`${name}: missing anchor ${href}`);
  }
  if (failures.length) { console.log('\nFAILURES (' + failures.length + '):\n' + failures.join('\n')); process.exit(1); }
  console.log('\nOK: ' + pages.length + ' pages');
})();
