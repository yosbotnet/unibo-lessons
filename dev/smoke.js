// Headless smoke suite for the macro lessons.
// Run: cd dev && npm install && node smoke.js
const { chromium } = require('playwright');
const path = require('path');
const BASE = 'file://' + path.resolve(__dirname, '..', 'macro');

let pass = 0, fail = 0;
const consoleErrors = [];
function check(name, ok) {
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name); }
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(page.url().split('/').pop() + ': ' + m.text()); });
  page.on('pageerror', e => consoleErrors.push(page.url().split('/').pop() + ': ' + e.message));

  async function go(file) { await page.goto(BASE + '/' + file); await page.waitForTimeout(350); }
  async function heroOk() {
    return page.evaluate(() => [...document.images].every(i => i.complete && i.naturalWidth > 0));
  }
  const q = i => page.locator('#quizhost .mcq').nth(i);

  // ---- Macro-01 ----
  await go('Macro-01-GDP-Prices-Inflation.html');
  check('01: hero + figures load', await heroOk());
  const nr0 = await page.locator('#nrRead').textContent();
  await page.locator('#nrBtns button').nth(1).click();
  check('01: nominal/real year switch', (await page.locator('#nrRead').textContent()) !== nr0);
  check('01: deflator trainer table rendered', (await page.locator('#trTable tr').count()) > 2);
  await page.locator('#trShow').click();
  check('01: trainer steps reveal', await page.locator('#trSteps.on').isVisible());
  check('01: rates trainer rendered', (await page.locator('#utOpts button').count()) === 4);
  await q(0).locator('.mcq-opts button').nth(0).click();
  check('01: quiz right answer scores +1', /score: 1/.test(await page.locator('#qscore').textContent()));

  // ---- Macro-02 ----
  await go('Macro-02-National-Income.html');
  check('02: hero + figures load', await heroOk());
  check('02: ladder default r=5 funds 110', /4 of 8/.test(await page.locator('#plRead').textContent()) && /€110/.test(await page.locator('#plRead').textContent()));
  await page.locator('#plR').fill('3');
  check('02: ladder r=3 funds 175', /€175/.test(await page.locator('#plRead').textContent()));
  await page.locator('#plBoom').click();
  check('02: tech boom funds all 8 at r=3', /8 of 8/.test(await page.locator('#plRead').textContent()) && /€240/.test(await page.locator('#plRead').textContent()));
  check('02: boom shows ghost staircase', await page.locator('#plSvg .stair-ghost').isVisible());
  await page.locator('#plReset').click();
  check('02: ladder reset back to 110', /€110/.test(await page.locator('#plRead').textContent()));
  check('02: how-to-read callout present', await page.locator('text=How to read any economics graph').isVisible());
  const lf0 = await page.locator('#lfRead').textContent();
  await page.locator('#lfG').fill('240');
  check('02: pantry reacts to G', (await page.locator('#lfRead').textContent()) !== lf0);
  await page.locator('#lfP3').click();
  const lfr = await page.locator('#lfRead').textContent();
  check('02: investment boom keeps I at 220, r to 6.0', /unchanged at 220/.test(lfr) && /6\.0/.test(lfr));
  await page.locator('#drillhost .mcq').first().locator('.mcq-opts button').first().click();
  check('02: drill feedback has exam words', /In exam words/.test(await page.locator('#drillhost .mcq').first().locator('.mcq-fb').textContent()));
  await q(0).locator('.mcq-opts button').nth(2).click();
  check('02: quiz right answer scores +1', /score: 1/.test(await page.locator('#qscore').textContent()));

  // ---- Macro-03 ----
  await go('Macro-03-Money-Inflation.html');
  check('03: hero + figures load', await heroOk());
  await page.locator('#moneyDrill .mcq').nth(2).locator('.mcq-opts button').nth(1).click();
  check('03: credit-card drill marks right', (await page.locator('#moneyDrill .mcq').nth(2).locator('button.right').count()) === 1);
  check('03: velocity table rendered', (await page.locator('#vtTable tr').count()) === 3);
  await page.locator('#vtOpts button').first().click();
  check('03: velocity trainer explains', /V = /.test(await page.locator('#vtRead').textContent()));
  await page.locator('#qmP3').click();
  check('03: banker preset hits 1.9%', /1\.9/.test(await page.locator('#chPi').textContent()));
  await q(0).locator('.mcq-opts button').nth(0).click();
  check('03: quiz right answer scores +1', /score: 1/.test(await page.locator('#qscore').textContent()));

  // ---- Macro-04 ----
  await go('Macro-04-Unemployment.html');
  check('04: hero + figures load', await heroOk());
  await page.locator('#tbP1').click();
  check('04: mock bathtub preset gives 14.9%', /14\.9/.test(await page.locator('#tbPread').textContent()));
  const tb0 = await page.locator('#tbRead').textContent();
  await page.locator('#tbF').fill('30');
  check('04: water level moves with f', (await page.locator('#tbRead').textContent()) !== tb0);
  await page.locator('#mwW').fill('130');
  check('04: binding wage floor shows queue of 30', /30 unemployed/.test(await page.locator('#mwRead').textContent()));
  await page.locator('#mwW').fill('80');
  check('04: non-binding floor shows zero', /unemployment = 0/.test(await page.locator('#mwRead').textContent()));
  await page.locator('#drillhost .mcq').first().locator('.mcq-opts button').first().click();
  check('04: drill feedback has exam words', /In exam words/.test(await page.locator('#drillhost .mcq').first().locator('.mcq-fb').textContent()));
  await q(0).locator('.mcq-opts button').nth(0).click();
  check('04: quiz right answer scores +1', /score: 1/.test(await page.locator('#qscore').textContent()));

  // ---- Macro-05 ----
  await go('Macro-05-IS-LM.html');
  check('05: hero + figures load', await heroOk());
  check('05: cockpit baseline Y=960 r=6.0', /960/.test(await page.locator('#cRead').textContent()) && /6\.0/.test(await page.locator('#cRead').textContent()));
  await page.locator('#p1').click();
  const c1 = await page.locator('#cRead').textContent();
  check('05: preset 1 lands on Y=1120, r held at 6.0', /1120/.test(c1) && /unchanged at 6\.0%/.test(c1));
  const mm0 = await page.locator('#mmRead').textContent();
  await page.locator('#mmM').fill('700');
  check('05: money market reacts to M', (await page.locator('#mmRead').textContent()) !== mm0);
  await page.locator('#drillhost .mcq').first().locator('.mcq-opts button').first().click();
  check('05: drill feedback has exam words', /In exam words/.test(await page.locator('#drillhost .mcq').first().locator('.mcq-fb').textContent()));
  await q(0).locator('.mcq-opts button').nth(3).click();
  check('05: quiz right answer scores +1', /score: 1/.test(await page.locator('#qscore').textContent()));

  // ---- Macro-06 ----
  await go('Macro-06-AD-AS.html');
  check('06: hero loads', await heroOk());
  await page.locator('#mxM1').click();
  check('06: M expansion dents output to 1100', /1100/.test(await page.locator('#mxRead').textContent()));
  await page.locator('#mxFF').click();
  check('06: fast-forward reaches neutrality at P=1.10', /1\.10/.test(await page.locator('#mxPread').textContent()) && /[Nn]eutrality/.test(await page.locator('#mxPread').textContent()));
  await page.locator('#mxReset').click();
  await page.locator('#mxOil').click();
  check('06: oil shock narrates stagflation', /stagflation/.test(await page.locator('#mxRead').textContent()));
  await page.locator('#mxAcc').click();
  check('06: accommodation narrates permanence', /permanent/.test(await page.locator('#mxRead').textContent()));
  check('06: accommodation restores Y=1000', /Y = <strong>1000/.test(await page.locator('#mxRead').innerHTML()));
  await page.locator('#drillhost .mcq').first().locator('.mcq-opts button').first().click();
  check('06: drill feedback has exam words', /In exam words/.test(await page.locator('#drillhost .mcq').first().locator('.mcq-fb').textContent()));
  await q(0).locator('.mcq-opts button').nth(2).click();
  check('06: quiz right answer scores +1', /score: 1/.test(await page.locator('#qscore').textContent()));

  // ---- Macro-07 ----
  await go('Macro-07-Phillips-Curve.html');
  check('07: hero loads', await heroOk());
  await page.locator('#pcU').fill('8');
  check('07: explorer narrates disinflation stance', /disinflation/.test(await page.locator('#pcRead').textContent()));
  await page.locator('#pcE').fill('5');
  check('07: ghost curve appears when Epi moves', await page.locator('#pcSvg .curve-ghost').isVisible());
  await page.locator('#dgCold').click();
  await page.locator('#dgCold').click();
  const dg = await page.locator('#dgRead').textContent();
  check('07: cold-turkey game ends with ratio 4.0', /Target reached/.test(dg) && /= 4\.0/.test(dg));
  await page.locator('#dgReset').click();
  await page.locator('#dgCred').click();
  check('07: credibility narrated', /for free/.test(await page.locator('#dgRead').textContent()));
  await q(0).locator('.mcq-opts button').nth(3).click();
  check('07: quiz right answer scores +1', /score: 1/.test(await page.locator('#qscore').textContent()));

  // ---- Exam Room ----
  await go('Macro-Exam-Room.html');
  check('exam: hero loads', await heroOk());
  await page.locator('#startBtn').click();
  await page.waitForTimeout(300);
  check('exam: 16 questions rendered', (await page.locator('#paper .mcq, #paper [id^=q]').count()) >= 16);
  check('exam: answer counter shows 0/16', /0 \/ 16/.test(await page.locator('#chipA').textContent()));
  await page.locator('#q0 button').first().click();
  check('exam: answer counter updates', /1 \/ 16/.test(await page.locator('#chipA').textContent()));
  await page.locator('#handBtn').click();
  await page.waitForTimeout(300);
  check('exam: verdict visible after grading', ((await page.locator('#verdict').textContent()) || '').trim().length > 0);

  await browser.close();
  if (consoleErrors.length) { console.log('CONSOLE ERRORS:'); consoleErrors.forEach(e => console.log('  ' + e)); }
  else console.log('CONSOLE ERRORS: none');
  console.log(fail === 0 && consoleErrors.length === 0 ? 'ALL GREEN (' + pass + ' checks)' : 'FAILURES: ' + fail);
  process.exit(fail === 0 && consoleErrors.length === 0 ? 0 : 1);
})();
