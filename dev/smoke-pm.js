// Smoke suite for the PM course chapters 7-15. Runs over file:// with Playwright.
// cd dev && node smoke-pm.js
const { chromium } = require('playwright');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'pm');
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
  page.on('console', m => { if (m.type() === 'error') errors.push(page.url().split('/').pop() + ' [console] ' + m.text()); });

  async function fresh(f) { await page.goto(url(f)); await page.waitForTimeout(150); }

  // ---------- cap-07 (nav fix + unchanged behavior) ----------
  await fresh('cap-07-analisi-e-pos.html');
  check('cap-07: next link points to cap-08-planning-jpps', (await page.locator('.lk-chnav a[href="cap-08-planning-jpps.html"]').count()) === 2);
  check('cap-07: SMART widget verdict present', /Tutti e cinque/.test(await page.locator('#sm-v').textContent()));
  await page.locator('#dc-next').click();
  check('cap-07: POS/Charter quiz advances', /Elemento 2 di 8/.test(await page.locator('#dc-v').textContent()));
  await page.locator('#se-approv .lk-se-node').nth(1).click();
  check('cap-07: state explorer renders', (await page.locator('#se-approv .lk-se-panel h4').textContent()) !== '');

  // ---------- cap-08 ----------
  await fresh('cap-08-planning-jpps.html');
  check('cap-08: meta says 3 widgets', /3 widget/.test(await page.locator('.lk-meta').textContent()));
  await page.locator('.lk-tab').nth(1).click();
  check('cap-08: agenda working-session tab opens', /La parte di lavoro/.test(await page.locator('.lk-tabpanel:not([hidden])').textContent()));
  await page.locator('#tp-grid .pm-opt').nth(2).click();
  check('cap-08: planning-time picker responds', /2 giorni/.test(await page.locator('#tp-v').textContent()));
  // role matcher: correct assignments
  const roles = ['Facilitator', 'Technographer', 'Project champion', 'JPP consultant', 'Resource manager', 'Core project team'];
  const roleAns = ['mediatore imparziale', 'rendicontazione digitale', 'vende il progetto', 'esperienza metodologica', 'allocazione delle risorse', 'stime di durata e risorse'];
  for (let i = 0; i < roles.length; i++) {
    await page.locator('#rl-rows .pm-row').nth(i).locator('select').selectOption(roleAns[i]);
  }
  check('cap-08: role matcher all correct', /Tutti gli abbinamenti sono corretti/.test(await page.locator('#rl-v').textContent()));
  // MoSCoW classifier
  const mw = ['Must', 'Could', 'Should', "Won't", 'Must', 'Could'];
  for (let i = 0; i < mw.length; i++) {
    await page.locator('#mw-rows .pm-row').nth(i).locator('select').selectOption(mw[i]);
  }
  await page.locator('#mw-check').click();
  check('cap-08: MoSCoW classifier correct', /Classificazione corretta/.test(await page.locator('#mw-v').textContent()));
  await page.locator('.lk-quiz details summary').first().click();
  check('cap-08: quiz details toggle', await page.locator('.lk-quiz details').first().evaluate(d => d.open));

  // ---------- cap-09 ----------
  await fresh('cap-09-wbs-e-stime.html');
  check('cap-09: three-point default E=8.0', (await page.locator('#tp-e').textContent()).trim() === '8.0');
  await page.locator('#tp-p').fill('10');
  check('cap-09: three-point recomputes E=7.0', (await page.locator('#tp-e').textContent()).trim() === '7.0');
  await page.locator('#ld-n').fill('4');
  check('cap-09: resource-loading slider 4 people', (await page.locator('#ld-steps').textContent()) === '3');
  // planning poker: US-1 (3) + US-2 (5) + US-5 (1) = 9 <= 20
  await page.locator('#pk-rows .pm-card').nth(0).click();
  await page.locator('#pk-rows .pm-card').nth(1).click();
  await page.locator('#pk-rows .pm-card').nth(4).click();
  check('cap-09: sprint fits 9/20', /9 punti su 20/.test(await page.locator('#pk-v').textContent()));
  // WBS criteria widget: task1 -> 0,3,4 ; task2 -> 1,2 ; task3 -> 4,5
  const critIdx = [0, 3, 4, 7, 8, 16, 17];
  for (const idx of critIdx) await page.locator('#cr-rows .pm-crit').nth(idx).click();
  await page.locator('#cr-check').click();
  check('cap-09: criteria widget all correct', /Esatto/.test(await page.locator('#cr-v').textContent()));

  // ---------- cap-10 ----------
  await fresh('cap-10-risorse-e-costi.html');
  check('cap-10: cash flow starts at anticipo', /04\/05\/2020/.test(await page.locator('#cf-mese').textContent()));
  await page.locator('#cf-next').click();
  await page.locator('#cf-next').click();
  check('cap-10: cash flow reaches negative month', /negativo/.test(await page.locator('#cf-v').textContent()));
  await page.locator('#sk-rows .pm-row').nth(0).locator('select').selectOption('Anna');
  await page.locator('#sk-rows .pm-row').nth(1).locator('select').selectOption('Bruno');
  await page.locator('#sk-rows .pm-row').nth(2).locator('select').selectOption('Carla');
  await page.locator('#sk-check').click();
  check('cap-10: skill matrix assignment correct', /Assegnazione ottimale/.test(await page.locator('#sk-v').textContent()));
  const ct = ['A corpo', 'A consuntivo', 'A corpo'];
  for (let i = 0; i < ct.length; i++) await page.locator('#ct-rows .pm-row').nth(i).locator('select').selectOption(ct[i]);
  await page.locator('#ct-check').click();
  check('cap-10: contract choices correct', /coerenti con il corso/.test(await page.locator('#ct-v').textContent()));

  // ---------- cap-11 ----------
  await fresh('cap-11-network-e-approvazione.html');
  // CPM forward pass (4 clicks)
  for (let i = 0; i < 4; i++) await page.locator('#cp-fwd').click();
  check('cap-11: forward pass project duration 12', (await page.locator('#cp-dur').textContent()).trim() === '12 giorni');
  check('cap-11: EF D = 12', (await page.locator('#efD').textContent()) === '12');
  for (let i = 0; i < 4; i++) await page.locator('#cp-bwd').click();
  check('cap-11: LS A = 1', (await page.locator('#lsA').textContent()) === '1');
  check('cap-11: slack B = 1', (await page.locator('#cp-slack').textContent()) === '1');
  await page.locator('#cp-crit').click();
  check('cap-11: critical path A-C-D', /A → C → D/.test(await page.locator('#cp-v').textContent()));
  check('cap-11: critical nodes highlighted', (await page.locator('#ndC').evaluate(n => n.classList.contains('crit'))));
  // dependency matcher
  const dp = ['SS', 'FF', 'SF', 'FS', 'SS'];
  for (let i = 0; i < dp.length; i++) await page.locator('#dp-rows .pm-row').nth(i).locator('select').selectOption(dp[i]);
  await page.locator('#dp-check').click();
  check('cap-11: dependency matcher correct', /Tutte corrette/.test(await page.locator('#dp-v').textContent()));
  // diagram procedure steps
  for (let i = 0; i < 5; i++) await page.locator('#dg-next').click();
  check('cap-11: diagram procedure reaches step 6', /Passo 6 di 6/.test(await page.locator('#dg-v').textContent()));
  // compression techniques
  const comp = ['Sostituire FS con SS', 'Sostituire il membro del team con uno più esperto', 'Aggiungere risorse spostandole dai task non critici', 'Aggiungere risorse da altri progetti'];
  for (let i = 0; i < comp.length; i++) await page.locator('#cp-rows .pm-row').nth(i).locator('select').selectOption(comp[i]);
  await page.locator('#cp2-check').click();
  check('cap-11: compression choices correct', /Tutte corrette/.test(await page.locator('#cp2-v').textContent()));
  // management reserve stepper: 3 delays on critical thread
  const critBtn = page.locator('#w-res .lk-step-btns button').nth(0);
  await critBtn.click(); await critBtn.click(); await critBtn.click();
  check('cap-11: reserve consumed 7/10', /Riserva consumata: 7 giorni su 10/.test(await page.locator('#w-res .lk-step-verdict').textContent()));
  // proposal annotated code
  await page.locator('#w-proposta .lk-ac-line').nth(2).click();
  check('cap-11: proposal line explains Objective', /L'obiettivo/.test(await page.locator('#w-proposta .lk-ac-expl').textContent()));

  // ---------- cap-12 ----------
  await fresh('cap-12-team-e-kickoff.html');
  // Kolb style matcher
  const kolb = ['Assimilating', 'Diverging', 'Accommodating', 'Converging'];
  for (let i = 0; i < kolb.length; i++) await page.locator('#kb-rows .pm-row').nth(i).locator('select').selectOption(kolb[i]);
  await page.locator('#kb-check').click();
  check('cap-12: Kolb matcher correct', /Tutti gli stili sono corretti/.test(await page.locator('#kb-v').textContent()));
  // kick-off agenda ordering: click the 10 items in course order
  for (let i = 0; i < 10; i++) await page.locator('#ko-grid .pm-opt').nth(i).click();
  check('cap-12: kick-off agenda complete', /Agenda completa in 10 punti/.test(await page.locator('#ko-v').textContent()));
  // RASCI matcher
  const rasci = ['R', 'A', 'S', 'C', 'I'];
  for (let i = 0; i < rasci.length; i++) await page.locator('#rs-rows .pm-row').nth(i).locator('select').selectOption(rasci[i]);
  await page.locator('#rs-check').click();
  check('cap-12: RASCI matcher correct', /Tutti i ruoli sono corretti/.test(await page.locator('#rs-v').textContent()));

  // ---------- cap-13 ----------
  await fresh('cap-13-regole-operative.html');
  // Couger stepper: 6 clicks to reach verification
  for (let i = 0; i < 6; i++) await page.locator('#cg-next').click();
  check('cap-13: Couger reaches verification', /Fase 7 di 7/.test(await page.locator('#cg-v').textContent()));
  // decision-making styles
  const styles = ['Directive', 'Participative / Collaborative', 'Consultative'];
  for (let i = 0; i < styles.length; i++) await page.locator('#st-rows .pm-row').nth(i).locator('select').selectOption(styles[i]);
  await page.locator('#st-check').click();
  check('cap-13: decision styles correct', /Tutti gli stili sono corretti/.test(await page.locator('#st-v').textContent()));
  // Wysocki phases: each row maps to its own description index
  for (let i = 0; i < 6; i++) await page.locator('#fs-rows .pm-row').nth(i).locator('select').selectOption(String(i));
  await page.locator('#fs-check').click();
  check('cap-13: Wysocki phases matched', /Tutte le fasi sono abbinate/.test(await page.locator('#fs-v').textContent()));
  // meeting tabs
  await page.locator('.lk-tab').nth(1).click();
  check('cap-13: meeting during-tab opens', /durata della riunione/.test(await page.locator('.lk-tabpanel:not([hidden])').textContent()));

  // ---------- cap-14 ----------
  await fresh('cap-14-riunioni-e-scope.html');
  // daily status matcher
  const ds = [
    'Sono in schedula',
    'Sono in ritardo di x ore, ma prevedo di rientrare in schedula entro y giorni',
    'Sono in ritardo di x ore e ho bisogno di aiuto per recuperare',
    'Sono in anticipo di x ore e posso aiutare chi ha bisogno'
  ];
  for (let i = 0; i < ds.length; i++) await page.locator('#ds-rows .pm-row').nth(i).locator('select').selectOption(ds[i]);
  await page.locator('#ds-check').click();
  check('cap-14: daily status matcher correct', /Tutti gli stati sono corretti/.test(await page.locator('#ds-v').textContent()));
  // scope change process stepper
  for (let i = 0; i < 5; i++) await page.locator('#sc-next').click();
  check('cap-14: scope change reaches approval', /approvata per l'implementazione/.test(await page.locator('#sc-v').textContent()));
  // impact statement questions
  const imp = [
    'Come impatterà il cambiamento sui costi?',
    'Come impatterà il cambiamento sulla schedula del progetto?',
    'Come impatterà il cambiamento sulla qualità della soluzione?',
    'Come impatterà il cambiamento sull\'allocazione delle risorse?'
  ];
  for (let i = 0; i < imp.length; i++) await page.locator('#im-rows .pm-row').nth(i).locator('select').selectOption(imp[i]);
  await page.locator('#im-check').click();
  check('cap-14: impact questions correct', /Tutte le domande sono corrette/.test(await page.locator('#im-v').textContent()));
  // possible outcomes
  const esiti = [
    'Applicabile entro le risorse e i tempi previsti',
    'Applicabile, ma richiederà un\'estensione della schedula',
    'Applicabile entro la schedula prevista, ma sono richieste ulteriori risorse',
    'Non applicabile senza modifiche sostanziali del progetto'
  ];
  for (let i = 0; i < esiti.length; i++) await page.locator('#es-rows .pm-row').nth(i).locator('select').selectOption(esiti[i]);
  await page.locator('#es-check').click();
  check('cap-14: outcomes coherent', /Tutti gli esiti sono coerenti/.test(await page.locator('#es-v').textContent()));

  // ---------- cap-15 ----------
  await fresh('cap-15-comunicazioni-e-work-package.html');
  // communication type matcher
  const comms = ['One-to-one', 'One-to-one', 'Elettronica', 'Elettronica', 'Scritta', 'Scritta'];
  for (let i = 0; i < comms.length; i++) await page.locator('#cm-rows .pm-row').nth(i).locator('select').selectOption(comms[i]);
  await page.locator('#cm-check').click();
  check('cap-15: communication types correct', /Tutte le classificazioni sono corrette/.test(await page.locator('#cm-v').textContent()));
  // resource criticality responses
  const rr = ['Utilizzare gli «slack» disponibili', 'Far slittare la data di fine del progetto', 'Ricorrere allo straordinario', 'Utilizzare gli «slack» disponibili'];
  for (let i = 0; i < rr.length; i++) await page.locator('#rr-rows .pm-row').nth(i).locator('select').selectOption(rr[i]);
  await page.locator('#rr-check').click();
  check('cap-15: resource responses correct', /Tutte le risposte sono corrette/.test(await page.locator('#rr-v').textContent()));
  // work package matcher
  const wp = ['Sì', 'Sì', 'Sì', 'No', 'Sì', 'Sì'];
  for (let i = 0; i < wp.length; i++) await page.locator('#wp-rows .pm-row').nth(i).locator('select').selectOption(wp[i]);
  await page.locator('#wp-check').click();
  check('cap-15: work package matcher correct', /Tutte le risposte sono corrette/.test(await page.locator('#wp-v').textContent()));

  // ---------- nav chain integrity ----------
  const chain = ['cap-07-analisi-e-pos.html', 'cap-08-planning-jpps.html', 'cap-09-wbs-e-stime.html', 'cap-10-risorse-e-costi.html', 'cap-11-network-e-approvazione.html', 'cap-12-team-e-kickoff.html', 'cap-13-regole-operative.html', 'cap-14-riunioni-e-scope.html', 'cap-15-comunicazioni-e-work-package.html'];
  for (let i = 0; i < chain.length; i++) {
    await fresh(chain[i]);
    const next = await page.locator('.lk-chnav a[href^="cap-"]').last().getAttribute('href');
    if (i < chain.length - 1) {
      check('nav: ' + chain[i] + ' -> ' + chain[i + 1], next === chain[i + 1]);
    } else {
      check('nav: last chapter has no forward link', await page.locator('.lk-chnav a[href^="cap-16-"]').count() === 0);
    }
  }

  check('NO PAGE ERRORS across all chapters', errors.length === 0);
  if (errors.length) { console.log('  errors:'); errors.forEach(e => console.log('   - ' + e)); }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
