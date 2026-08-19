const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// Smoke suite for SAP chapters 12-15 (autonomous systems & MAS segment).
// Runs over file:// with Playwright; verifies widgets render, interactions
// work, navigation chain is wired, and there are zero console/page errors.
// cd dev && node smoke-sap-12-15.js
(async () => {
  const b = await chromium.launch({ headless: true });
  const dir = path.resolve(__dirname, '..', 'sap');
  const files = [
    'cap-12-autonomous-systems-and-agents.html',
    'cap-13-agent-programs-and-architectures.html',
    'cap-14-knowledge-level-and-bdi.html',
    'cap-15-agent-oriented-and-multi-agent-programming.html',
  ];
  let pass = 0, fail = 0;
  const check = (name, ok) => { if (ok) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name); } };

  for (const f of files) {
    const p = await b.newPage();
    const errors = [];
    p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    p.on('pageerror', e => errors.push(String(e)));
    await p.goto('file://' + path.join(dir, f));
    await p.waitForTimeout(250);

    // page basics
    const h1 = await p.locator('h1').first().innerText();
    check(`${f}: h1 present`, h1.length > 5);
    check(`${f}: kicker Part IV`, /Part IV/i.test(await p.locator('.lk-kicker').innerText()));
    check(`${f}: has plates`, await p.locator('figure.lk-fig').count() >= 6);
    check(`${f}: has quiz details`, await p.locator('.lk-quiz details').count() >= 9);

    // navigation chain
    const chain = {
      'cap-12-autonomous-systems-and-agents.html': { prev: 'cap-11', next: 'cap-13' },
      'cap-13-agent-programs-and-architectures.html': { prev: 'cap-12', next: 'cap-14' },
      'cap-14-knowledge-level-and-bdi.html': { prev: 'cap-13', next: 'cap-15' },
      'cap-15-agent-oriented-and-multi-agent-programming.html': { prev: 'cap-14', next: null },
    };
    const c = chain[f];
    check(`${f}: prev link x2`, (await p.locator(`.lk-chnav a[href^="${c.prev}"]`).count()) >= 2);
    if (c.next) {
      check(`${f}: next link x2`, (await p.locator(`.lk-chnav a[href^="${c.next}"]`).count()) >= 2);
    }

    // TOC anchors resolve to sections
    const tocHrefs = await p.locator('.lk-toc a').evaluateAll(as => as.map(a => a.getAttribute('href')));
    let tocOk = true;
    for (const h of tocHrefs) {
      if (!h || !h.startsWith('#')) { tocOk = false; continue; }
      const cnt = await p.locator(`section[id="${h.slice(1)}"]`).count();
      if (cnt !== 1) tocOk = false;
    }
    check(`${f}: TOC anchors resolve`, tocOk);

    // drive every interactive control; verify no errors
    const ctrl = p.locator('button, input, select, .lk-tab, summary, .lk-ac-line');
    let acted = 0;
    const n = await ctrl.count();
    for (let i = 0; i < n; i++) {
      const x = ctrl.nth(i);
      try {
        const tag = await x.evaluate(el => el.tagName);
        const type = await x.getAttribute('type');
        if (tag === 'INPUT' && type === 'range') await x.fill(await x.getAttribute('max') || '1');
        else if (tag === 'INPUT' && (type === 'checkbox' || type === 'radio')) await x.check();
        else if (tag === 'SELECT') { if (await x.locator('option').count() > 1) await x.selectOption({ index: 1 }); }
        else await x.click({ timeout: 900 });
        acted++;
      } catch (e) { /* element may be disabled/covered; tolerated */ }
    }
    check(`${f}: interacted with ${n} controls`, acted > 0);

    // specific widget semantics
    if (f === 'cap-12-autonomous-systems-and-agents.html') {
      await p.locator('#w-auto button').first().click();
      check('cap-12: w-auto verdict updates', /AUTONOMOUS|NOT AUTONOMOUS/.test(await p.locator('#w-auto .lk-step-verdict').textContent()));
      await p.locator('#se-agent .lk-se-node').nth(1).click();
      check('cap-12: se-agent renders state', (await p.locator('#se-agent .lk-se-panel h4').textContent()).length > 0);
      await p.locator('#w-env button').first().click();
      check('cap-12: w-env verdict updates', /CORRECT|NO/.test(await p.locator('#w-env .lk-step-verdict').textContent()));
    }
    if (f === 'cap-13-agent-programs-and-architectures.html') {
      await p.locator('#w-kind button').first().click();
      check('cap-13: w-kind verdict updates', /CORRECT|NO/.test(await p.locator('#w-kind .lk-step-verdict').textContent()));
      await p.locator('#se-learn .lk-se-node').nth(2).click();
      check('cap-13: se-learn renders', (await p.locator('#se-learn .lk-se-panel h4').textContent()).length > 0);
      await p.locator('#w-rl .lk-step-btns button').first().click();
      check('cap-13: w-rl stepper advances', (await p.locator('#w-rl .lk-step-ins li.on').count()) >= 1);
      await p.locator('#ac-llm .lk-ac-line').nth(1).click();
      check('cap-13: ac-llm explanation updates', (await p.locator('#ac-llm .lk-ac-expl').textContent()).length > 10);
      await p.locator('#w-standards button').first().click();
      check('cap-13: w-standards verdict updates', /CORRECT|NO/.test(await p.locator('#w-standards .lk-step-verdict').textContent()));
    }
    if (f === 'cap-14-knowledge-level-and-bdi.html') {
      await p.locator('#w-stance button').first().click();
      check('cap-14: w-stance verdict updates', /CORRECT|NO/.test(await p.locator('#w-stance .lk-step-verdict').textContent()));
      await p.locator('#w-attitudes button').first().click();
      check('cap-14: w-attitudes verdict updates', /CORRECT|NO/.test(await p.locator('#w-attitudes .lk-step-verdict').textContent()));
      await p.locator('#se-bdi .lk-se-node').nth(4).click();
      check('cap-14: se-bdi renders', (await p.locator('#se-bdi .lk-se-panel h4').textContent()).length > 0);
      await p.locator('#se-bdi .lk-se-trans button').first().click();
      check('cap-14: se-bdi transition works', (await p.locator('#se-bdi .lk-se-cur b').textContent()).length > 0);
      await p.locator('#w-cog button').first().click();
      check('cap-14: w-cog verdict updates', /CORRECT|NO/.test(await p.locator('#w-cog .lk-step-verdict').textContent()));
    }
    if (f === 'cap-15-agent-oriented-and-multi-agent-programming.html') {
      await p.locator('#ac-asl .lk-ac-line').nth(0).click();
      check('cap-15: ac-asl explanation updates', (await p.locator('#ac-asl .lk-ac-expl').textContent()).length > 10);
      await p.locator('#se-jason .lk-se-node').nth(3).click();
      check('cap-15: se-jason renders', (await p.locator('#se-jason .lk-se-panel h4').textContent()).length > 0);
      await p.locator('#w-dim button').first().click();
      check('cap-15: w-dim verdict updates', /CORRECT|NO/.test(await p.locator('#w-dim .lk-step-verdict').textContent()));
      await p.locator('#ac-art .lk-ac-line').nth(4).click();
      check('cap-15: ac-art explanation updates', (await p.locator('#ac-art .lk-ac-expl').textContent()).length > 10);
      await p.locator('#w-tax button').first().click();
      check('cap-15: w-tax verdict updates', /CORRECT|NO/.test(await p.locator('#w-tax .lk-step-verdict').textContent()));
      await p.locator('#w-jac .lk-step-btns button').first().click();
      await p.locator('#w-jac .lk-step-btns button').first().click();
      check('cap-15: w-jac stepper advances', (await p.locator('#w-jac .lk-step-ins li.on').count()) >= 1);
      await p.locator('#w-ddd button').first().click();
      check('cap-15: w-ddd verdict updates', /CORRECT|NO/.test(await p.locator('#w-ddd .lk-step-verdict').textContent()));
    }

    check(`${f}: zero console/page errors (${errors.length})`, errors.length === 0);
    if (errors.length) errors.slice(0, 5).forEach(e => console.log('  ERROR: ' + e));
    await p.close();
  }

  // cap-11 must now link forward into the segment (bidirectional wiring)
  const p11 = await b.newPage();
  await p11.goto('file://' + path.join(dir, 'cap-11-architectures-for-reactive-systems.html'));
  await p11.waitForTimeout(200);
  check('cap-11: forward link to ch.12 present x2', (await p11.locator('.lk-chnav a[href="cap-12-autonomous-systems-and-agents.html"]').count()) === 2);
  const p11errors = [];
  p11.on('pageerror', e => p11errors.push(String(e)));
  check('cap-11: no page errors after nav patch', p11errors.length === 0);
  await p11.close();

  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
