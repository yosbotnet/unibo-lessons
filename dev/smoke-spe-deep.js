/* SPE deep interaction test v2 — selectors match lesson-kit.js DOM output:
   annotatedCode -> .lk-acode (.lk-ac-line buttons, .lk-ac-expl text)
   stateExplorer -> .lk-se (.lk-se-grid, .lk-se-panel, .lk-se-node, .lk-se-cur)
   stepper       -> .lk-step (.lk-step-th, .lk-step-ins, .lk-step-btns, .lk-step-verdict) */
const { chromium } = require('playwright');
const path = require('path');
const BASE = '/home/ybc/hosted/unibo-lessons/spe';

(async () => {
  const browser = await chromium.launch();
  const fail = [], ok = [];
  async function check(page, cond, msg) {
    (await cond ? ok : fail).push(`${page}: ${msg}`);
  }

  // cap-02: stateExplorer traversal
  {
    const ctx = await browser.newContext(); const pg = await ctx.newPage();
    await pg.goto('file://' + path.join(BASE, 'cap-02-domain-driven-design.html'), { waitUntil: 'load' });
    const seCount = await pg.locator('.lk-se').count();
    await check('cap-02', seCount >= 1, `state explorer widgets (${seCount})`);
    const se = pg.locator('.lk-se').first();
    await check('cap-02', await se.locator('.lk-se-panel').count() === 1, 'state explorer panel present');
    const cur = (await se.locator('.lk-se-cur b').textContent()) || '';
    await check('cap-02', cur.length > 0, `current state shown: "${cur}"`);
    const nodeBtns = await se.locator('.lk-se-node').count();
    await check('cap-02', nodeBtns >= 3, `state nodes rendered (${nodeBtns})`);
    // click a different node
    if (nodeBtns > 1) {
      await se.locator('.lk-se-node').nth(1).click(); await pg.waitForTimeout(60);
      const title = (await se.locator('.lk-se-panel h4').textContent()) || '';
      await check('cap-02', title.length > 0 && title !== cur, `node click updates panel ("${title}")`);
    }
    await ctx.close();
  }

  // cap-03: annotatedCode
  {
    const ctx = await browser.newContext(); const pg = await ctx.newPage();
    await pg.goto('file://' + path.join(BASE, 'cap-03-building-blocks.html'), { waitUntil: 'load' });
    const ac = await pg.locator('.lk-acode').count();
    await check('cap-03', ac >= 1, `annotated code widgets (${ac})`);
    const first = pg.locator('.lk-acode').first();
    const lines = await first.locator('.lk-ac-line').count();
    await check('cap-03', lines >= 5, `code lines rendered (${lines})`);
    const expl0 = (await first.locator('.lk-ac-expl').textContent()) || '';
    await first.locator('.lk-ac-line').nth(Math.min(2, lines - 1)).click(); await pg.waitForTimeout(60);
    const expl1 = (await first.locator('.lk-ac-expl').textContent()) || '';
    await check('cap-03', expl1 !== expl0, 'clicking a line changes the explanation');
    const pressed = await first.locator('.lk-ac-line[aria-pressed="true"]').count();
    await check('cap-03', pressed === 1, 'exactly one line aria-pressed');
    await ctx.close();
  }

  // cap-04: stepper
  {
    const ctx = await browser.newContext(); const pg = await ctx.newPage();
    await pg.goto('file://' + path.join(BASE, 'cap-04-contexts-and-architecture.html'), { waitUntil: 'load' });
    const st = await pg.locator('.lk-step').count();
    await check('cap-04', st >= 3, `stepper widgets incl. bespoke (${st})`);
    // the real LessonKit.stepper is #step-cqrs; bespoke widgets share the class
    const real = pg.locator('#step-cqrs');
    await check('cap-04', await real.count() === 1, 'LessonKit.stepper #step-cqrs present');
    const threads = await real.locator('.lk-step-th').count();
    await check('cap-04', threads >= 2, `stepper threads (${threads})`);
    const btns = await real.locator('.lk-step-btns button').count();
    await check('cap-04', btns >= 3, `step buttons incl. reset (${btns})`);
    const verdict0 = (await real.locator('.lk-step-verdict').textContent()) || '';
    // writer: create + store Variation(+40) -> commandsDB=1, pending=1
    await real.locator('.lk-step-btns button').first().click(); await pg.waitForTimeout(50);
    await real.locator('.lk-step-btns button').first().click(); await pg.waitForTimeout(50);
    // reader: query (stale: 0 of 1 reified)
    await real.locator('.lk-step-btns button').nth(2).click(); await pg.waitForTimeout(60);
    const verdict1 = (await real.locator('.lk-step-verdict').textContent()) || '';
    const verdictBad = await real.locator('.lk-step-verdict.bad').count();
    const done = await real.locator('.lk-step-ins li.on, .lk-step-ins li.done').count();
    await check('cap-04', done >= 2, `advancing marks instruction (${done})`);
    await check('cap-04', verdict1 !== verdict0 && verdictBad === 1, `stale-snapshot verdict triggers (bad=${verdictBad}, "${verdict1.slice(0,60)}")`);
    await ctx.close();
  }

  // cap-05: annotatedCode
  {
    const ctx = await browser.newContext(); const pg = await ctx.newPage();
    await pg.goto('file://' + path.join(BASE, 'cap-05-model-driven-development.html'), { waitUntil: 'load' });
    const ac = await pg.locator('.lk-acode').count();
    await check('cap-05', ac >= 1, `annotated code widgets (${ac})`);
    const lines = await pg.locator('.lk-acode').first().locator('.lk-ac-line').count();
    await check('cap-05', lines >= 3, `code lines rendered (${lines})`);
    await ctx.close();
  }

  // cap-01: stateExplorer + bespoke widgets (validated with correct selectors)
  {
    const ctx = await browser.newContext(); const pg = await ctx.newPage();
    await pg.goto('file://' + path.join(BASE, 'cap-01-course-and-process.html'), { waitUntil: 'load' });
    const seCount = await pg.locator('.lk-se').count();
    await check('cap-01', seCount === 1, `state explorer widgets (${seCount})`);
    const sel = pg.locator('#target-check select');
    await sel.nth(1).selectOption({ label: 'Kotlin/Native (native binary)' }); await pg.waitForTimeout(60);
    const verdict = await pg.locator('#target-check .lk-step-verdict').textContent();
    await check('cap-01', /different/i.test(verdict), 'target-check verdict correct');
    await ctx.close();
  }

  await browser.close();
  console.log('--- DEEP INTERACTION RESULTS v2 ---');
  ok.forEach(m => console.log('  OK  ' + m));
  fail.forEach(m => console.log('  FAIL ' + m));
  console.log(fail.length === 0 ? '\nALL DEEP CHECKS PASS' : `\n${fail.length} DEEP CHECKS FAILED`);
  process.exit(fail.length ? 1 : 0);
})();
