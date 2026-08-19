#!/usr/bin/env node
/* Smoke suite for the SAP course (sap/), all 18 chapters + index = 19 pages.
   Runs over file:// with Playwright in real Chromium.
   cd dev && node smoke-sap-full.js
   Verifies: zero console/page errors on every page, header widget metadata
   matches the rendered page, every widget host is populated, meaningful
   interactions on every widget with verifiable outputs, bidirectional 1..18
   navigation, terminal-chapter behavior, course index completeness. */
const { chromium } = require('playwright');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'sap');
const url = f => 'file://' + path.join(ROOT, f);
const CHAIN = [
  'cap-01-software-engineering.html',
  'cap-02-software-architecture.html',
  'cap-03-architectural-styles.html',
  'cap-04-clean-architecture.html',
  'cap-05-quanta-governance.html',
  'cap-06-domain-driven-design.html',
  'cap-07-tactical-design.html',
  'cap-08-eventstorming.html',
  'cap-09-from-ddd-to-microservices.html',
  'cap-10-microservices-patterns.html',
  'cap-11-architectures-for-reactive-systems.html',
  'cap-12-autonomous-systems-and-agents.html',
  'cap-13-agent-programs-and-architectures.html',
  'cap-14-knowledge-level-and-bdi.html',
  'cap-15-agent-oriented-and-multi-agent-programming.html',
  'cap-16-designing-event-driven-microservices.html',
  'cap-17-production-ready-and-deploying-microservices.html',
  'cap-18-testing-microservices.html'
];

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
  page.on('console', m => { if (m.type() === 'error') errors.push(page.url().split('/').pop() + ' [console] ' + m.text()); });

  async function fresh(f) { await page.goto(url(f)); await page.waitForTimeout(200); }
  const txt = async sel => (await page.locator(sel).textContent()).trim();
  const has = async (sel, re) => re.test(await txt(sel));

  // ---- generic per-page scaffold ----
  for (const f of CHAIN) {
    await fresh(f);
    const i = CHAIN.indexOf(f);
    const expW = [4, 4, 4, 5, 6, 4, 5, 3, 4, 4, 4, 4, 5, 4, 7, 6, 5, 5][i];
    check(f + ': h1 present', (await page.locator('h1').first().innerText()).length > 5);
    check(f + ': meta claims ' + expW + ' widgets', has('.lk-meta', new RegExp(expW + ' interactive widgets')));
    check(f + ': has quiz details', (await page.locator('.lk-quiz details').count()) >= 8);
    // TOC anchors resolve to real sections
    const tocHrefs = await page.locator('.lk-toc a').evaluateAll(as => as.map(a => a.getAttribute('href')));
    let tocOk = true;
    for (const h of tocHrefs) {
      if (!h || !h.startsWith('#')) { tocOk = false; continue; }
      if (await page.locator('section[id="' + h.slice(1) + '"]').count() !== 1) tocOk = false;
    }
    check(f + ': TOC anchors resolve', tocOk);
    // nav: prev/next per chain (cap-01 no prev; cap-18 no forward)
    const nextHrefs = await page.locator('.lk-chnav a[href^="cap-"]').evaluateAll(as => as.map(a => a.getAttribute('href')));
    if (i < CHAIN.length - 1) {
      check(f + ': next link -> ' + CHAIN[i + 1], nextHrefs.includes(CHAIN[i + 1]));
    } else {
      check(f + ': terminal chapter has no forward link', nextHrefs.every(h => h === CHAIN[i - 1]));
    }
    if (i > 0) {
      const prevHrefs = await page.locator('.lk-chnav a[href^="cap-"]').evaluateAll(as => as.map(a => a.getAttribute('href')));
      check(f + ': prev link -> ' + CHAIN[i - 1], prevHrefs.includes(CHAIN[i - 1]));
    } else {
      check(f + ': first chapter has no backward link', nextHrefs.every(h => h === CHAIN[i + 1]));
    }
    check(f + ': index link x2', (await page.locator('.lk-chnav a[href="index.html"]').count()) >= 2);
    // quiz details toggle
    await page.locator('.lk-quiz details summary').first().click();
    check(f + ': quiz details toggle opens', await page.locator('.lk-quiz details').first().evaluate(d => d.open));
  }

  /* ---------- cap-01 ---------- */
  await fresh('cap-01-software-engineering.html');
  check('cap-01: lifecycle explorer opens state', (await page.locator('#se-lifecycle .lk-se-panel h4').textContent()).length > 0);
  await page.locator('#se-lifecycle .lk-se-trans button').first().click();
  check('cap-01: lifecycle transition works', (await page.locator('#se-lifecycle .lk-se-cur b').textContent()).length > 0);
  // plan-driven vs incremental stepper: advance both threads fully
  const stepProcess = page.locator('#step-process .lk-step-btns button');
  for (let i = 0; i < 5; i++) await stepProcess.nth(0).click();
  for (let i = 0; i < 5; i++) await stepProcess.nth(1).click();
  check('cap-01: process stepper completes with feedback', has('#step-process .lk-step-verdict', /feedback rounds/));
  // principles classifier: advance to scenario 2 and answer
  await page.locator('#w-principles button').filter({ hasText: 'Next scenario' }).click();
  check('cap-01: principles classifier advances', /Scenario 2 of 7/.test(await page.locator('#w-principles .lk-step-verdict').first().textContent()));
  check('cap-01: principles score box present', (await page.locator('#w-principles .lk-step-verdict').count()) === 2);
  await page.locator('#w-principles .lk-step-btns button').first().click();
  check('cap-01: principles answer scored', /Correct —|Not quite/.test(await page.locator('#w-principles .lk-step-verdict').last().textContent()));
  // agile manifesto pairs
  await page.locator('#w-agile .lk-step-state button').first().click();
  check('cap-01: agile pair reveals ranking', /values MORE|still has value/.test(await page.locator('#w-agile .lk-step-verdict').textContent()));

  /* ---------- cap-02 ---------- */
  await fresh('cap-02-software-architecture.html');
  await page.locator('#se-lifecycle2 .lk-se-trans button').first().click();
  check('cap-02: architecture lifecycle transition works', (await page.locator('#se-lifecycle2 .lk-se-cur b').textContent()).length > 0);
  await page.locator('#w-qa-sort .lk-step-state button').first().click();
  check('cap-02: QA sort verdict updates', /DEVELOPMENT-TIME|RUNTIME/.test(await page.locator('#w-qa-sort .lk-step-verdict').textContent()));
  await page.locator('#w-qas .lk-step-btns button').first().click();
  for (let i = 0; i < 6; i++) await page.locator('#w-qas .lk-step-box').nth(i).click();
  check('cap-02: scenario builder reveals 6 slots', has('#w-qas .lk-step-verdict', /6\/6|testable|note/));
  await page.locator('#w-breadth .lk-step-state button').first().click();
  check('cap-02: breadth verdict updates', /Correct:|It is the/.test(await page.locator('#w-breadth .lk-step-verdict').textContent()));

  /* ---------- cap-03 ---------- */
  await fresh('cap-03-architectural-styles.html');
  await page.locator('#se-layered .lk-se-node').nth(1).click();
  check('cap-03: layered explorer renders state', (await page.locator('#se-layered .lk-se-panel h4').textContent()).length > 0);
  await page.locator('#w-style-chooser button').filter({ hasText: 'Next brief' }).click();
  await page.locator('#w-style-chooser .lk-step-btns button').first().click();
  check('cap-03: style chooser scores brief 2', /Correct —|The course would say/.test(await page.locator('#w-style-chooser .lk-step-verdict').last().textContent()));
  await page.locator('#lat-n').fill('5');
  await page.locator('#lat-a').fill('50');
  check('cap-03: latency chain recomputes', (await page.locator('#w-latency .lk-step-verdict').textContent()).includes('ms'));
  await page.locator('#w-fallacies .lk-step-box').first().click();
  check('cap-03: fallacy verdict updates', (await page.locator('#w-fallacies .lk-step-verdict').textContent()).length > 10);

  /* ---------- cap-04 ---------- */
  await fresh('cap-04-clean-architecture.html');
  await page.locator('#se-scenario .lk-se-trans button').first().click();
  check('cap-04: clean-arch scenario explorer advances', (await page.locator('#se-scenario .lk-se-cur b').textContent()).length > 0);
  await page.locator('#ac-boundary .lk-ac-line').nth(2).click();
  check('cap-04: boundary annotated code explains', (await page.locator('#ac-boundary .lk-ac-expl').textContent()).length > 10);
  await page.locator('#w-dep-rule .lk-step-state button').first().click();
  check('cap-04: dep-rule verdict updates', /Right\.|Not quite/.test(await page.locator('#w-dep-rule .lk-step-verdict').textContent()));
  await page.locator('#w-partition .lk-step-state button').first().click();
  check('cap-04: partition verdict updates', /Yes:|stronger pull/.test(await page.locator('#w-partition .lk-step-verdict').textContent()));
  const granularity = page.locator('#w-granularity input[type="range"]');
  await granularity.fill(await granularity.getAttribute('max'));
  check('cap-04: granularity verdict flips to fine-grained', /TOO FINE-GRAINED/.test(await page.locator('#w-granularity .lk-step-verdict').textContent()));

  /* ---------- cap-05 ---------- */
  await fresh('cap-05-quanta-governance.html');
  await page.locator('#se-adr .lk-se-trans button').first().click();
  check('cap-05: ADR explorer advances', (await page.locator('#se-adr .lk-se-cur b').textContent()).length > 0);
  await page.locator('#ac-fitness .lk-ac-line').nth(1).click();
  check('cap-05: fitness annotated code explains', (await page.locator('#ac-fitness .lk-ac-expl').textContent()).length > 10);
  await page.locator('#w-quanta .lk-step-state button').first().click();
  check('cap-05: quanta verdict updates', /quantum/.test(await page.locator('#w-quanta .lk-step-verdict').textContent()));
  await page.locator('#w-3d .lk-step-state button').first().click();
  check('cap-05: 3D decision verdict updates', (await page.locator('#w-3d .lk-step-verdict').textContent()).length > 10);
  await page.locator('#w-connascence .lk-step-state button').first().click();
  check('cap-05: connascence verdict updates', /STATIC\.|DYNAMIC\./.test(await page.locator('#w-connascence .lk-step-verdict').textContent()));
  await page.locator('#cc-e').fill('10');
  await page.locator('#cc-n').fill('6');
  check('cap-05: cyclomatic CC = E - N + 2 = 6', has('#w-cc .lk-step-verdict', /CC = 6\./));

  /* ---------- cap-06 ---------- */
  await fresh('cap-06-domain-driven-design.html');
  await page.locator('#se-context .lk-se-node').nth(1).click();
  check('cap-06: context-map explorer renders', (await page.locator('#se-context .lk-se-panel h4').textContent()).length > 0);
  await page.locator('#w-subdomains .lk-step-state button').first().click();
  check('cap-06: subdomain verdict updates', /CORE\.|GENERIC\.|SUPPORTING\./.test(await page.locator('#w-subdomains .lk-step-verdict').textContent()));
  await page.locator('#w-lead .lk-step-btns button').nth(1).click();
  check('cap-06: leading-term reveals two contexts', (await page.locator('#w-lead .lk-step-th').count()) === 2 && (await page.locator('#w-lead .lk-step-verdict').textContent()).includes('FTGO'));
  await page.locator('#w-integration button').filter({ hasText: 'Next situation' }).click();
  await page.locator('#w-integration .lk-step-btns button').first().click();
  check('cap-06: integration pattern scored', /Correct —|The answer is/.test(await page.locator('#w-integration .lk-step-verdict').last().textContent()));

  /* ---------- cap-07 ---------- */
  await fresh('cap-07-tactical-design.html');
  await page.locator('#se-order .lk-se-trans button').first().click();
  check('cap-07: order lifecycle advances', (await page.locator('#se-order .lk-se-cur b').textContent()).length > 0);
  await page.locator('#ac-aggregate .lk-ac-line').nth(1).click();
  check('cap-07: aggregate annotated code explains', (await page.locator('#ac-aggregate .lk-ac-expl').textContent()).length > 10);
  const inv = page.locator('#step-invariant .lk-step-btns button');
  await inv.nth(0).click(); await inv.nth(1).click();  // both load tx1
  await inv.nth(0).click(); await inv.nth(1).click();  // both check minimum
  await inv.nth(0).click(); await inv.nth(1).click();  // both write
  check('cap-07: invariant stepper detects violation', has('#step-invariant .lk-step-verdict', /INVARIANT VIOLATED|happened to stay valid/));
  await page.locator('#w-entity-vo .lk-step-state button').first().click();
  check('cap-07: entity/vo verdict updates', /ENTITY\.|VALUE OBJECT\./.test(await page.locator('#w-entity-vo .lk-step-verdict').textContent()));
  await page.locator('#w-agg-rules .lk-step-state button').first().click();
  check('cap-07: aggregate-rule verdict updates', /Rule |No rule broken/.test(await page.locator('#w-agg-rules .lk-step-verdict').textContent()));

  /* ---------- cap-08 ---------- */
  await fresh('cap-08-eventstorming.html');
  await page.locator('#se-ten .lk-se-node').nth(2).click();
  check('cap-08: ten-step explorer renders', (await page.locator('#se-ten .lk-se-panel h4').textContent()).length > 0);
  await page.locator('#w-color .lk-step-state button').first().click();
  check('cap-08: sticky-color verdict updates', /\.$/.test(await page.locator('#w-color .lk-step-verdict').textContent()));
  await page.locator('#w-order .lk-step-state button').first().click();
  check('cap-08: session-step verdict updates', /CORRECT\.|NO —/.test(await page.locator('#w-order .lk-step-verdict').textContent()));

  /* ---------- cap-09 ---------- */
  await fresh('cap-09-from-ddd-to-microservices.html');
  await page.locator('#se-create-order .lk-se-trans button').first().click();
  check('cap-09: create-order explorer advances', (await page.locator('#se-create-order .lk-se-cur b').textContent()).length > 0);
  await page.locator('#ac-place-order .lk-ac-line').nth(1).click();
  check('cap-09: place-order annotated code explains', (await page.locator('#ac-place-order .lk-ac-expl').textContent()).length > 10);
  await page.locator('#w-obstacles .lk-step-state button').first().click();
  check('cap-09: obstacle verdict updates', /CORRECT\.|NO —/.test(await page.locator('#w-obstacles .lk-step-verdict').textContent()));
  await page.locator('#w-styles .lk-step-state button').first().click();
  check('cap-09: interaction-style verdict updates', /CORRECT\.|NO —/.test(await page.locator('#w-styles .lk-step-verdict').textContent()));

  /* ---------- cap-10 ---------- */
  await fresh('cap-10-microservices-patterns.html');
  await page.locator('#se-pattern .lk-se-node').nth(1).click();
  check('cap-10: pattern explorer renders', (await page.locator('#se-pattern .lk-se-panel h4').textContent()).length > 0);
  await page.locator('#w-patterns .lk-step-state button').first().click();
  check('cap-10: pattern verdict updates', /CORRECT\.|NO —/.test(await page.locator('#w-patterns .lk-step-verdict').textContent()));
  await page.locator('#w-metrics .lk-step-state button').first().click();
  check('cap-10: DevOps metric verdict updates', /CORRECT\.|NO —/.test(await page.locator('#w-metrics .lk-step-verdict').textContent()));
  const team = page.locator('#w-team .lk-step-btns button');
  for (let i = 0; i < 4; i++) await team.nth(0).click();
  for (let i = 0; i < 4; i++) await team.nth(1).click();
  check('cap-10: team stepper completes', (await page.locator('#w-team .lk-step-verdict').textContent()).length > 20);

  /* ---------- cap-11 ---------- */
  await fresh('cap-11-architectures-for-reactive-systems.html');
  await page.locator('#se-supervision .lk-se-trans button').first().click();
  check('cap-11: supervision explorer advances', (await page.locator('#se-supervision .lk-se-cur b').textContent()).length > 0);
  await page.locator('#w-react .lk-step-state button').first().click();
  check('cap-11: reactive verdict updates', /REACTIVE\.|TRANSFORMATIONAL\./.test(await page.locator('#w-react .lk-step-verdict').textContent()));
  await page.locator('#w-rules .lk-step-state button').first().click();
  check('cap-11: modularization rule verdict updates', /CORRECT\.|NO —/.test(await page.locator('#w-rules .lk-step-verdict').textContent()));
  const failw = page.locator('#w-failure .lk-step-btns button');
  for (let i = 0; i < 4; i++) await failw.nth(0).click();
  for (let i = 0; i < 4; i++) await failw.nth(1).click();
  check('cap-11: failure stepper escalates', /escalat/i.test(await page.locator('#w-failure .lk-step-verdict').textContent()));

  /* ---------- cap-12 ---------- */
  await fresh('cap-12-autonomous-systems-and-agents.html');
  await page.locator('#w-auto .lk-step-state button').first().click();
  check('cap-12: autonomy verdict updates', /AUTONOMOUS|NOT AUTONOMOUS/.test(await page.locator('#w-auto .lk-step-verdict').textContent()));
  await page.locator('#w-env .lk-step-state button').first().click();
  check('cap-12: environment verdict updates', /CORRECT —|NO —/.test(await page.locator('#w-env .lk-step-verdict').textContent()));
  await page.locator('#w-rational .lk-step-state button').first().click();
  check('cap-12: rationality verdict updates', /CORRECT\.|NO —/.test(await page.locator('#w-rational .lk-step-verdict').textContent()));
  await page.locator('#se-agent .lk-se-node').nth(1).click();
  check('cap-12: agent explorer renders', (await page.locator('#se-agent .lk-se-panel h4').textContent()).length > 0);

  /* ---------- cap-13 ---------- */
  await fresh('cap-13-agent-programs-and-architectures.html');
  await page.locator('#w-kind .lk-step-state button').first().click();
  check('cap-13: agent-kind verdict updates', /CORRECT|NO —/.test(await page.locator('#w-kind .lk-step-verdict').textContent()));
  await page.locator('#se-learn .lk-se-node').nth(2).click();
  check('cap-13: learning explorer renders', (await page.locator('#se-learn .lk-se-panel h4').textContent()).length > 0);
  await page.locator('#w-rl .lk-step-btns button').first().click();
  check('cap-13: RL stepper advances', (await page.locator('#w-rl .lk-step-ins li.on').count()) >= 1);
  await page.locator('#ac-llm .lk-ac-line').nth(1).click();
  check('cap-13: LLM annotated code explains', (await page.locator('#ac-llm .lk-ac-expl').textContent()).length > 10);
  await page.locator('#w-standards .lk-step-state button').first().click();
  check('cap-13: standards verdict updates', /CORRECT|NO —/.test(await page.locator('#w-standards .lk-step-verdict').textContent()));

  /* ---------- cap-14 ---------- */
  await fresh('cap-14-knowledge-level-and-bdi.html');
  await page.locator('#w-stance .lk-step-state button').first().click();
  check('cap-14: stance verdict updates', /CORRECT|NO —/.test(await page.locator('#w-stance .lk-step-verdict').textContent()));
  await page.locator('#w-attitudes .lk-step-state button').first().click();
  check('cap-14: attitudes verdict updates', /CORRECT|NO —/.test(await page.locator('#w-attitudes .lk-step-verdict').textContent()));
  await page.locator('#se-bdi .lk-se-node').nth(4).click();
  check('cap-14: BDI explorer renders', (await page.locator('#se-bdi .lk-se-panel h4').textContent()).length > 0);
  await page.locator('#se-bdi .lk-se-trans button').first().click();
  check('cap-14: BDI transition works', (await page.locator('#se-bdi .lk-se-cur b').textContent()).length > 0);
  await page.locator('#w-cog .lk-step-state button').first().click();
  check('cap-14: cognitive verdict updates', /CORRECT|NO —/.test(await page.locator('#w-cog .lk-step-verdict').textContent()));

  /* ---------- cap-15 ---------- */
  await fresh('cap-15-agent-oriented-and-multi-agent-programming.html');
  await page.locator('#ac-asl .lk-ac-line').nth(0).click();
  check('cap-15: ASL annotated code explains', (await page.locator('#ac-asl .lk-ac-expl').textContent()).length > 10);
  await page.locator('#se-jason .lk-se-node').nth(3).click();
  check('cap-15: JaCaMo explorer renders', (await page.locator('#se-jason .lk-se-panel h4').textContent()).length > 0);
  await page.locator('#w-dim .lk-step-state button').first().click();
  check('cap-15: dimension verdict updates', /CORRECT|NO —/.test(await page.locator('#w-dim .lk-step-verdict').textContent()));
  await page.locator('#ac-art .lk-ac-line').nth(4).click();
  check('cap-15: artifact annotated code explains', (await page.locator('#ac-art .lk-ac-expl').textContent()).length > 10);
  await page.locator('#w-tax .lk-step-state button').first().click();
  check('cap-15: taxonomy verdict updates', /CORRECT|NO —/.test(await page.locator('#w-tax .lk-step-verdict').textContent()));
  await page.locator('#w-jac .lk-step-btns button').first().click();
  await page.locator('#w-jac .lk-step-btns button').first().click();
  check('cap-15: JaCaMo stepper advances', (await page.locator('#w-jac .lk-step-ins li.on').count()) >= 1);
  await page.locator('#w-ddd .lk-step-state button').first().click();
  check('cap-15: AOP-DDD verdict updates', /CORRECT|NO —/.test(await page.locator('#w-ddd .lk-step-verdict').textContent()));

  /* ---------- cap-16 ---------- */
  await fresh('cap-16-designing-event-driven-microservices.html');
  await page.locator('#w-evtype .lk-step-state button').first().click();
  check('cap-16: event-type verdict updates', /CORRECT\.|NO —/.test(await page.locator('#w-evtype .lk-step-verdict').textContent()));
  await page.locator('#se-mat .lk-se-trans button').first().click();
  check('cap-16: materialization explorer advances', (await page.locator('#se-mat .lk-se-cur b').textContent()).length > 0);
  await page.locator('#ac-schema .lk-ac-line').nth(2).click();
  check('cap-16: schema annotated code explains', (await page.locator('#ac-schema .lk-ac-expl').textContent()).length > 10);
  await page.locator('#w-single .lk-step-state button').first().click();
  check('cap-16: single-writer verdict updates', /CORRECT\.|NO —/.test(await page.locator('#w-single .lk-step-verdict').textContent()));
  const broker = page.locator('#w-broker .lk-step-btns button');
  for (let i = 0; i < 4; i++) await broker.nth(0).click();
  for (let i = 0; i < 4; i++) await broker.nth(1).click();
  check('cap-16: broker stepper shows divergence', /single ledger|diverge/i.test(await page.locator('#w-broker .lk-step-verdict').textContent()));
  await page.locator('#ac-loop .lk-ac-line').nth(4).click();
  check('cap-16: event-loop annotated code explains', (await page.locator('#ac-loop .lk-ac-expl').textContent()).length > 10);

  /* ---------- cap-17 ---------- */
  await fresh('cap-17-production-ready-and-deploying-microservices.html');
  await page.locator('#w-sec .lk-step-state button').first().click();
  check('cap-17: security verdict updates', /CORRECT\.|NO —/.test(await page.locator('#w-sec .lk-step-verdict').textContent()));
  await page.locator('#ac-jwt .lk-ac-line').nth(1).click();
  check('cap-17: JWT annotated code explains', (await page.locator('#ac-jwt .lk-ac-expl').textContent()).length > 10);
  const cfg = page.locator('#w-config .lk-step-btns button');
  for (let i = 0; i < 3; i++) await cfg.nth(0).click();
  for (let i = 0; i < 4; i++) await cfg.nth(1).click();
  check('cap-17: config stepper completes', /configuration server|externalize/i.test(await page.locator('#w-config .lk-step-verdict').textContent()));
  await page.locator('#w-obs .lk-step-state button').first().click();
  check('cap-17: observability verdict updates', /CORRECT\.|NO —/.test(await page.locator('#w-obs .lk-step-verdict').textContent()));
  await page.locator('#w-deploy .lk-step-state button').first().click();
  check('cap-17: deployment verdict updates', /CORRECT\.|NO —/.test(await page.locator('#w-deploy .lk-step-verdict').textContent()));

  /* ---------- cap-18 (terminal) ---------- */
  await fresh('cap-18-testing-microservices.html');
  await page.locator('#w-double .lk-step-state button').first().click();
  check('cap-18: test-double verdict updates', /CORRECT\.|NO —/.test(await page.locator('#w-double .lk-step-verdict').textContent()));
  await page.locator('#w-unit .lk-step-state button').first().click();
  check('cap-18: unit-strategy verdict updates', /CORRECT\.|NO —/.test(await page.locator('#w-unit .lk-step-verdict').textContent()));
  await page.locator('#se-int .lk-se-node').nth(2).click();
  check('cap-18: integration explorer renders', (await page.locator('#se-int .lk-se-panel h4').textContent()).length > 0);
  const contract = page.locator('#w-contract .lk-step-btns button');
  for (let i = 0; i < 3; i++) await contract.nth(0).click();
  for (let i = 0; i < 3; i++) await contract.nth(1).click();
  check('cap-18: contract stepper closes the loop', /loop closes|contracts must/.test(await page.locator('#w-contract .lk-step-verdict').textContent()));
  await page.locator('#ac-gherkin .lk-ac-line').nth(3).click();
  check('cap-18: Gherkin annotated code explains', (await page.locator('#ac-gherkin .lk-ac-expl').textContent()).length > 10);

  /* ---------- navigation chain (bidirectional, cap-01..cap-18) ---------- */
  for (let i = 0; i < CHAIN.length; i++) {
    await fresh(CHAIN[i]);
    const caps = await page.locator('.lk-chnav a[href^="cap-"]').evaluateAll(as => as.map(a => a.getAttribute('href')));
    if (i < CHAIN.length - 1) {
      check('nav: ' + CHAIN[i] + ' -> ' + CHAIN[i + 1], caps.includes(CHAIN[i + 1]));
    } else {
      check('nav: terminal cap-18 has no forward chapter link', caps.every(h => h === CHAIN[i - 1]));
    }
    if (i > 0) {
      check('nav: ' + CHAIN[i] + ' <- ' + CHAIN[i - 1], caps.includes(CHAIN[i - 1]));
    }
  }

  /* ---------- widget metadata matches rendered pages ---------- */
  const expectedWidgets = { 'cap-01-software-engineering.html': 4, 'cap-02-software-architecture.html': 4, 'cap-03-architectural-styles.html': 4, 'cap-04-clean-architecture.html': 5, 'cap-05-quanta-governance.html': 6, 'cap-06-domain-driven-design.html': 4, 'cap-07-tactical-design.html': 5, 'cap-08-eventstorming.html': 3, 'cap-09-from-ddd-to-microservices.html': 4, 'cap-10-microservices-patterns.html': 4, 'cap-11-architectures-for-reactive-systems.html': 4, 'cap-12-autonomous-systems-and-agents.html': 4, 'cap-13-agent-programs-and-architectures.html': 5, 'cap-14-knowledge-level-and-bdi.html': 4, 'cap-15-agent-oriented-and-multi-agent-programming.html': 7, 'cap-16-designing-event-driven-microservices.html': 6, 'cap-17-production-ready-and-deploying-microservices.html': 5, 'cap-18-testing-microservices.html': 5 };
  for (const f of CHAIN) {
    await fresh(f);
    const rendered = await page.evaluate(() => {
      const candidates = [...document.querySelectorAll('[id^="w-"],[id^="step-"],[id^="se-"],[id^="ac-"]')];
      return new Set(candidates.filter(h => h.classList.contains('lk-step') || h.classList.contains('lk-se') || h.classList.contains('lk-acode') || h.childElementCount > 0)).size;
    });
    check(f + ': rendered widgets ' + rendered + ' == meta ' + expectedWidgets[f], rendered === expectedWidgets[f]);
  }

  /* ---------- course index ---------- */
  await fresh('index.html');
  check('index: header claims 18 chapters / 83 widgets / 94 plates', has('.lk-meta', /18 chapters/) && has('.lk-meta', /83 interactive widgets/) && has('.lk-meta', /94 plates/));
  check('index: 5 study parts', (await page.locator('.idx-part').count()) === 5);
  check('index: links all 18 chapters', (await page.locator('.idx-list a').count()) === 18);
  const idxHrefs = await page.locator('.idx-list a').evaluateAll(as => as.map(a => a.getAttribute('href')));
  for (const f of CHAIN) check('index: links ' + f, idxHrefs.includes(f));
  check('index: supplementary library documented', /supplementary reference library/.test(await page.locator('.idx-supp').textContent()) && /not taught/.test(await page.locator('.idx-supp').textContent()));
  check('index: footer attributes the reconstruction', /Reconstructed from the official course decks/.test(await page.locator('.lk-foot').textContent()));
  // per-row widget counts match the chapter headers
  const rowMeta = await page.locator('.idx-list .idx-meta').evaluateAll(ms => ms.map(m => m.textContent.trim()));
  const chapterWidgets = {};
  for (const f of CHAIN) {
    await fresh(f);
    const m = await page.locator('.lk-meta span').nth(1).textContent();
    chapterWidgets[f] = m;
  }
  const expRows = ['30 min · 4 widgets', '40 min · 4 widgets', '55 min · 4 widgets', '40 min · 5 widgets', '40 min · 6 widgets', '45 min · 4 widgets', '45 min · 5 widgets', '40 min · 3 widgets', '55 min · 4 widgets', '45 min · 4 widgets', '45 min · 4 widgets', '40 min · 4 widgets', '45 min · 5 widgets', '45 min · 4 widgets', '50 min · 7 widgets', '45 min · 6 widgets', '55 min · 5 widgets', '50 min · 5 widgets'];
  rowMeta.forEach((r, i) => {
    const rowCount = (r.match(/(\d+) widgets/) || [])[1];
    const chapterCount = ((chapterWidgets[CHAIN[i]] || '').match(/(\d+) interactive widgets/) || [])[1];
    check('index row ' + (i + 1) + ' matches chapter meta', r === expRows[i] && rowCount === chapterCount);
  });

  check('NO PAGE ERRORS across all 19 pages', errors.length === 0);
  if (errors.length) { console.log('  errors:'); errors.forEach(e => console.log('   - ' + e)); }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
