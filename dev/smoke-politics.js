// Smoke suite for the politics course. Runs over file:// with Playwright.
// cd dev && npm install && node smoke-politics.js
const { chromium } = require('playwright');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'politics');
const url = f => 'file://' + path.join(ROOT, f);
let pass = 0, fail = 0;
function check(name, ok) {
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name); }
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(page.url().split('/').pop() + ': ' + e.message));

  async function heroOk(tag) {
    const ok = await page.evaluate(() => {
      const imgs = [...document.querySelectorAll('img')];
      return imgs.length > 0 && imgs.every(i => i.complete && i.naturalWidth > 0);
    });
    check(tag + ': all images load', ok);
  }
  async function drillQuizOk(tag, hasDrill = true) {
    if (hasDrill) {
      await page.locator('#drillhost .mcq').first().locator('.mcq-opts button').first().click();
      const fb = await page.locator('#drillhost .mcq').first().locator('.mcq-fb').textContent();
      check(tag + ': drill feedback two-layered', /In exam words/.test(fb));
    }
    await page.locator('#quizhost .mcq').first().locator('.mcq-opts button').first().click();
    const qfb = await page.locator('#quizhost .mcq').first().locator('.mcq-fb').textContent();
    check(tag + ': quiz feedback shows', /In exam words/.test(qfb));
    const chip = await page.locator('#qscore').textContent();
    check(tag + ': score chip live', /score: \d \/ 6/.test(chip));
  }

  // ---- index ----
  await page.goto(url('index.html'));
  await heroOk('index');
  check('index: 15 lesson links', (await page.locator('.idx-list a').count()) === 15);

  // ---- Poli-00 ----
  await page.goto(url('Poli-00-Start-Here.html'));
  await heroOk('00');
  await page.locator('#rb .r-block').first().click();
  check('00: rubric reveals points', /running score 2 \/ 6/.test(await page.locator('#rbTotal').textContent()));
  for (const b of await page.locator('#rb .r-block').all()) await b.click();
  check('00: rubric full marks note', /full-marks answer/.test(await page.locator('#rbTotal').textContent()));
  await page.locator('#mcheck .mcq').first().locator('.mcq-opts button').nth(1).click();
  check('00: self-check feedback', /✓/.test(await page.locator('#mcheck .mcq').first().locator('.mcq-fb').textContent()));

  // ---- Poli-01 ----
  await page.goto(url('Poli-01-Politics-and-Political-Science.html'));
  await heroOk('01');
  check('01: four lens tabs', (await page.locator('.lk-tab').count()) === 4);
  await page.locator('.lk-tab').nth(1).click();
  check('01: rational choice tab opens', /rational calculators/.test(await page.locator('.lk-tabpanel:not([hidden])').textContent()));
  await drillQuizOk('01');

  // ---- Poli-02 ----
  await page.goto(url('Poli-02-The-State.html'));
  await heroOk('02');
  await page.locator('#rkB3').click();
  check('02: Rokkan order enforced', /Floors come in order/.test(await page.locator('#rkRead').textContent()));
  for (const id of ['#rkB1', '#rkB2', '#rkB3', '#rkB4']) await page.locator(id).click();
  check('02: Rokkan completes', /modern state/.test(await page.locator('#rkRead').textContent()));
  await drillQuizOk('02');

  // ---- Poli-03 ----
  await page.goto(url('Poli-03-Democracy.html'));
  await heroOk('03');
  await page.locator('#ddP4').click();
  check('03: dimmer Norway preset', /full liberal democracy/.test(await page.locator('#ddRead').textContent()));
  await page.locator('#ddP3').click();
  check('03: plebiscitary preset', /Inclusive hegemony/.test(await page.locator('#ddRead').textContent()));
  await drillQuizOk('03');

  // ---- Poli-04 ----
  await page.goto(url('Poli-04-Autocracy.html'));
  await heroOk('04');
  await page.locator('#rsBtns button', { hasText: 'No' }).click();
  await page.locator('#rsBtns button', { hasText: 'Yes' }).click();
  await page.locator('#rsBtns button', { hasText: 'Heavily skewed' }).click();
  check('04: sorter finds competitive authoritarianism', /Competitive authoritarianism/.test(await page.locator('#rsRead').textContent()));
  await drillQuizOk('04');

  // ---- Poli-05 ----
  await page.goto(url('Poli-05-Constitutions.html'));
  await heroOk('05');
  await page.locator('#wbParl').click();
  check('05: parliamentary wiring', /no confidence/.test(await page.locator('#wireRead').textContent()));
  await page.locator('#wbSemi').click();
  check('05: semi-presidential wiring', /cohabitation/.test(await page.locator('#wireRead').textContent()));
  await drillQuizOk('05');

  // ---- Poli-06 ----
  await page.goto(url('Poli-06-Executives-Parliaments-Bureaucracies.html'));
  await heroOk('06');
  check('06: six engine tabs', (await page.locator('.lk-tab').count()) === 6);
  await drillQuizOk('06');

  // ---- Poli-07 ----
  await page.goto(url('Poli-07-Elections-and-Referendums.html'));
  await heroOk('07');
  check('07: FPTP seat bar drawn', (await page.locator('#tmF div').count()) >= 3);
  check('07: default read mentions coalition', /coalition/.test(await page.locator('#tmRead').textContent()));
  await page.locator('#tmT').evaluate(el => { el.value = '8'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  check('07: threshold deletes Green', /deleted Green/.test(await page.locator('#tmRead').textContent()));
  await drillQuizOk('07');

  // ---- Poli-08 ----
  await page.goto(url('Poli-08-Political-Attitudes-and-Behaviour.html'));
  await heroOk('08');
  await drillQuizOk('08');

  // ---- Poli-09 ----
  await page.goto(url('Poli-09-Parties-and-Pressure-Groups.html'));
  await heroOk('09');
  await drillQuizOk('09');

  // ---- Poli-10 ----
  await page.goto(url('Poli-10-Media-and-Political-Communication.html'));
  await heroOk('10');
  check('10: four age tabs', (await page.locator('.lk-tab').count()) === 4);
  await drillQuizOk('10');

  // ---- Poli-11 ----
  await page.goto(url('Poli-11-Populism.html'));
  await heroOk('11');
  await page.locator('#mx3').click();
  check('11: neoliberal mix names Milei', /Milei/.test(await page.locator('#mxRead').textContent()));
  await drillQuizOk('11');

  // ---- Poli-12 ----
  await page.goto(url('Poli-12-Globalization-and-Global-Governance.html'));
  await heroOk('12');
  await page.locator('#ld .w-btns button').last().click();
  check('12: climate lands on global rung', /planetary/.test(await page.locator('#ldRead').textContent()));
  await drillQuizOk('12');

  // ---- Poli-13 ----
  await page.goto(url('Poli-13-Political-Trust.html'));
  await heroOk('13');
  await page.locator('#ttB2').click();
  check('13: implementing line explained', /Implementing institutions/.test(await page.locator('#ttRead').textContent()));
  await drillQuizOk('13');

  // ---- Exam Room ----
  await page.goto(url('Poli-Exam-Room.html'));
  await heroOk('exam');
  await page.locator('#startBtn').click();
  check('exam: 10 MCQs unlocked', (await page.locator('#paper .mcq:not(.locked)').count()) === 10);
  check('exam: 2 open questions', (await page.locator('.oe').count()) === 2);
  await page.locator('#q0 .mcq-opts button').nth(1).click();
  check('exam: answer chip updates', /MCQ answered: 1 \/ 10/.test(await page.locator('#chipA').textContent()));
  await page.locator('#oe0 textarea').fill('Competitive authoritarianism is a civilian regime where democratic institutions exist but the field is skewed. Repression example. Cooptation example.');
  check('exam: word counter live', /\d+ words/.test(await page.locator('#oe0 .oe-count').textContent()));
  await page.locator('#handBtn').click();
  check('exam: verdict shows /30', /\/ 30/.test(await page.locator('#verdict').textContent()));
  check('exam: rubrics revealed', (await page.locator('.oe-rubric.on').count()) === 2);
  await page.locator('#rub0 input').first().check();
  check('exam: self-score updates', /Self-score: 2 \/ 6/.test(await page.locator('#oescore0').textContent()));
  check('exam: verdict recomputes with self-score', /Section B \(open questions, self-graded\): <?s?t?r?o?n?g?>?2/.test(await page.locator('#verdict').innerHTML()) || /self-graded\): 2 \/ 12|<strong>2 \/ 12<\/strong>/.test(await page.locator('#verdict').innerHTML()));

  check('no page errors anywhere', errors.length === 0);
  if (errors.length) errors.forEach(e => console.log('  ERR ' + e));

  await browser.close();
  console.log(fail === 0 ? 'POLITICS SMOKE GREEN (' + pass + ' checks)' : 'FAILURES: ' + fail);
  process.exit(fail === 0 ? 0 : 1);
})();
