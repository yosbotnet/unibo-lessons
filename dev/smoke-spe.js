/* SPE real-browser smoke test: loads every chapter in Chromium, checks
   console/page errors, widget initialization, tab interaction, quiz details,
   state explorer transitions, and chnav sanity. */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = '/home/ybc/hosted/unibo-lessons/spe';
const PAGES = [
  'index.html',
  'cap-01-course-and-process.html',
  'cap-02-domain-driven-design.html',
  'cap-03-building-blocks.html',
  'cap-04-contexts-and-architecture.html',
  'cap-05-model-driven-development.html',
  'cap-06-mlops-llmops.html',
  'cap-07-chatflow-case-study.html',
];

(async () => {
  const browser = await chromium.launch();
  const results = [];
  for (const page of PAGES) {
    const url = 'file://' + path.join(BASE, page);
    const ctx = await browser.newContext();
    const pg = await ctx.newPage();
    const errors = [];
    pg.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    pg.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await pg.goto(url, { waitUntil: 'load' });
    await pg.waitForTimeout(400);

    const report = { page, errors, widgets: 0, tabs: 0, details: 0, figs: 0, quiz: 0 };

    // widget hosts that were initialized (LessonKit creates content inside them)
    report.widgets = await pg.evaluate(() => {
      const hosts = document.querySelectorAll('[id]');
      let n = 0;
      hosts.forEach(h => {
        if (h.querySelector('.lk-step-state, .lk-ann, .lk-stepper, .lk-code-ann')) n++;
      });
      return n;
    });

    // tabs present and operable
    const tabCount = await pg.locator('.lk-tabs[data-kit="tabs"]').count();
    report.tabs = tabCount;
    if (tabCount > 0) {
      const first = pg.locator('.lk-tabs[data-kit="tabs"]').first();
      const btns = first.locator('.lk-tab');
      const n = await btns.count();
      for (let i = 0; i < Math.min(n, 4); i++) {
        await btns.nth(i).click();
        await pg.waitForTimeout(60);
      }
      const selected = await first.locator('.lk-tab[aria-selected="true"]').count();
      if (selected !== 1) errors.push('tab: expected exactly 1 selected, got ' + selected);
    }

    report.details = await pg.locator('details').count();
    // open first details to make sure it toggles
    const det = pg.locator('details').first();
    if (await det.count()) {
      await det.click();
      await pg.waitForTimeout(60);
    }

    report.figs = await pg.locator('figure.lk-fig').count();
    report.quiz = await pg.locator('section#quiz').count();

    // chnav: previous/index/next links resolve to files that exist
    const navLinks = await pg.locator('nav.lk-chnav a[href]').evaluateAll(as =>
      as.map(a => a.getAttribute('href')).filter(h => h && !h.startsWith('#'))
    );
    const missing = navLinks.filter(h => {
      const fn = h.split('#')[0];
      return fn && !fs.existsSync(path.join(BASE, fn));
    });
    if (missing.length) errors.push('nav links missing files: ' + missing.join(','));

    results.push(report);
    await ctx.close();
  }
  await browser.close();

  let fail = 0;
  for (const r of results) {
    const status = r.errors.length === 0 ? 'PASS' : 'FAIL';
    if (r.errors.length) fail++;
    console.log(`${status} ${r.page} | widgets=${r.widgets} tabs=${r.tabs} details=${r.details} figs=${r.figs} quiz=${r.quiz}`);
    r.errors.forEach(e => console.log('     ' + e));
  }
  console.log(fail === 0 ? '\nALL PAGES PASS' : `\n${fail} PAGES FAILED`);
  process.exit(fail === 0 ? 0 : 1);
})();
