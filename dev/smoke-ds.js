// Smoke test for the Distributed Systems course (concept-first rework).
// Usage: node dev/smoke-ds.js [course_dir]   (default: ds)
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const dir = path.resolve(__dirname, '..', process.argv[2] || 'ds');
const REQUIRED = {
  'ch-01-distribution.html': ['contexts', 'definitions', 'goals', 'transparency', 'fallacies', 'sorts'],
  'ch-02-time.html': ['physical', 'causality', 'logical', 'scalar', 'vector', 'coordination'],
  'ch-03-space.html': ['space', 'spatial-computing', 'mobility', 'resources'],
  'ch-04-failure-recovery.html': ['dependability', 'attributes', 'faults', 'global-state', 'snapshots', 'checkpointing', 'logging'],
  'ch-05-replication-consistency.html': ['replication', 'data-centric', 'client-centric', 'cap', 'base'],
  'ch-06-consensus.html': ['problem', 'flp', 'paxos'],
  'ch-07-ledgers.html': ['middleware', 'smr', 'blockchain', 'pow', 'smart-contracts'],
  'ch-08-modelling.html': ['architectures', 'styles', 'process-algebra', 'semantics'],
  'ch-09-kubernetes.html': ['containers', 'objects', 'control-loop', 'scaling'],
};
const BANNED = [/examiner will ask/i, /exam tip/i, /\bwait\s*[—-]\s/i, /let me (re-?check|think)/i, /as of \d{1,2} \w+ 20\d\d/i,
  /earlier wording/i, /the former .* claim/i, /original slides .* shorthand/i, /\bTODO\b/, /lorem ipsum/i];

(async () => {
  const pages = fs.readdirSync(dir).filter(f => f.endsWith('.html')).sort();
  const failures = [];
  const ids = {};
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
        const text = document.body.innerText;
        const idsHere = [...document.querySelectorAll('[id]')].map(e => e.id);
        const links = [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')).filter(h => !/^(https?:|mailto:)/.test(h));
        const escapes = [];
        document.querySelectorAll('figure svg').forEach(svg => {
          const v = svg.viewBox && svg.viewBox.baseVal; if (!v || !v.width) return;
          svg.querySelectorAll('text').forEach(t => {
            const r = t.getBBox();
            if (r.width && (r.x < v.x - 2 || r.y < v.y - 2 || r.x + r.width > v.x + v.width + 2 || r.y + r.height > v.y + v.height + 2)) escapes.push(t.textContent.trim().slice(0, 40));
          });
        });
        const svgBlocks = [...document.querySelectorAll('svg')].map(s => s.textContent.length).reduce((a, b) => a + b, 0);
        const words = text.split(/\s+/).filter(Boolean).length;
        return { text, idsHere, links, escapes, words, h1: (document.querySelector('h1') || {}).textContent || '',
          navs: document.querySelectorAll('nav.lk-chnav').length, oral: !!document.querySelector('#oral'),
          coverage: !!document.querySelector('details.ds-coverage'), spine: !!document.querySelector('.ds-spine') };
      });
      ids[name] = new Set(info.idsHere);
      if (!info.h1.trim()) failures.push(`${name}: no h1`);
      BANNED.forEach(re => { if (re.test(info.text)) failures.push(`${name}: banned phrase ${re}`); });
      info.escapes.forEach(t => failures.push(`${name}: SVG text escapes viewBox: "${t}"`));
      if (name.startsWith('ch-')) {
        if (info.navs !== 2) failures.push(`${name}: expected 2 chapter navs, got ${info.navs}`);
        if (!info.oral) failures.push(`${name}: missing #oral`);
        if (!info.coverage) failures.push(`${name}: missing slide coverage table`);
        if (!info.spine) failures.push(`${name}: missing .ds-spine`);
        (REQUIRED[name] || []).forEach(id => { if (!ids[name].has(id)) failures.push(`${name}: missing required id #${id}`); });
      }
      page.__links = info.links;
      ids[name].links = info.links;
      console.log(`${name.padEnd(38)} ${String(info.words).padStart(6)} words`);
      await page.close();
    }
  }
  // link check across pages
  for (const name of pages) {
    for (const href of ids[name].links || []) {
      const [file, hash] = href.split('#');
      const target = file ? file : name;
      if (file && !fs.existsSync(path.join(dir, file))) { failures.push(`${name}: broken link ${href}`); continue; }
      if (hash && target.endsWith('.html') && ids[target] && !ids[target].has(hash)) failures.push(`${name}: missing anchor ${href}`);
    }
  }
  for (const f of Object.keys(REQUIRED)) if (!pages.includes(f)) failures.push(`missing chapter ${f}`);
  await browser.close();
  if (failures.length) { console.log('\nFAILURES (' + failures.length + '):\n' + failures.join('\n')); process.exit(1); }
  console.log('\nOK: ' + pages.length + ' pages');
})();
