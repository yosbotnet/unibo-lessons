// Full-course smoke suite for Business Intelligence (69012): 16 chapters + index.
// Runs over file:// with Playwright.  cd dev && node smoke-bi-full.js
const { chromium } = require('playwright');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'bi');
const url = f => 'file://' + path.join(ROOT, f);
let pass = 0, fail = 0;
function check(name, ok) {
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name); }
}

const CHAIN = [
  'cap-01-business-intelligence.html',
  'cap-02-data-warehousing.html',
  'cap-03-architetture.html',
  'cap-04-modello-multidimensionale.html',
  'cap-05-ciclo-di-vita.html',
  'cap-06-sorgenti-requisiti.html',
  'cap-07-dfm.html',
  'cap-08-dfm-avanzato.html',
  'cap-09-progettazione-concettuale.html',
  'cap-10-carico-lavoro-volume-dati.html',
  'cap-11-progettazione-logica.html',
  'cap-12-viste-materializzate-scenari-temporali.html',
  'cap-13-progettazione-fisica-etl-indici.html',
  'cap-14-interrogazione-olap-power-bi.html',
  'cap-15-modulo-2-tpc-d-indyco-builder.html',
  'cap-16-power-bi-connessione-setup.html',
];

// Per-chapter meta expectations (widgets, tavole) from the validated index.
const META = {
  'cap-01-business-intelligence.html': [2, 3],
  'cap-02-data-warehousing.html': [3, 3],
  'cap-03-architetture.html': [3, 3],
  'cap-04-modello-multidimensionale.html': [3, 4],
  'cap-05-ciclo-di-vita.html': [3, 3],
  'cap-06-sorgenti-requisiti.html': [3, 3],
  'cap-07-dfm.html': [3, 3],
  'cap-08-dfm-avanzato.html': [3, 4],
  'cap-09-progettazione-concettuale.html': [5, 7],
  'cap-10-carico-lavoro-volume-dati.html': [4, 5],
  'cap-11-progettazione-logica.html': [6, 9],
  'cap-12-viste-materializzate-scenari-temporali.html': [6, 9],
  'cap-13-progettazione-fisica-etl-indici.html': [6, 11],
  'cap-14-interrogazione-olap-power-bi.html': [6, 7],
  'cap-15-modulo-2-tpc-d-indyco-builder.html': [5, 8],
  'cap-16-power-bi-connessione-setup.html': [6, 7],
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(page.url().split('/').pop() + ': ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(page.url().split('/').pop() + ' [console] ' + m.text()); });

  async function fresh(f) { await page.goto(url(f)); await page.waitForTimeout(200); }

  // ---------- every chapter: meta, widget hosts, tabs, quiz, nav ----------
  for (const f of CHAIN) {
    await fresh(f);
    const [w, t] = META[f];
    const meta = await page.locator('.lk-meta').textContent();
    check(f + ': meta ' + w + ' widget / ' + t + ' tavole',
      meta.includes(w + ' widget interattivi') && meta.includes(t + ' tavole'));
    // widget hosts render (LessonKit steppers/stateExplorers/annotatedCode populate)
    const stepHosts = await page.locator('.lk-step').count();
    const seHosts = await page.locator('.lk-se').count();
    const acHosts = await page.locator('.lk-acode, .lk-acode-host').count();
    check(f + ': interactive hosts present (' + stepHosts + '/' + seHosts + '/' + acHosts + ')',
      stepHosts + seHosts + acHosts >= w);
    check(f + ': has header and footer nav', (await page.locator('.lk-chnav').count()) >= 2);
    check(f + ': has quiz section', (await page.locator('#quiz').count()) === 1);
    check(f + ': has data-src on sections', (await page.locator('section[data-src]').count()) >= 3);
    check(f + ': source attribution in footer', (await page.locator('.lk-foot code').count()) >= 1);
  }

  // ---------- cap-01 ----------
  await fresh('cap-01-business-intelligence.html');
  await page.locator('#se-piramide .lk-se-node').nth(1).click();
  check('cap-01: state explorer advances', (await page.locator('#se-piramide .lk-se-panel h4').textContent()) === 'Reportistica');
  await page.locator('.lk-tab').nth(2).click();
  check('cap-01: tab 3 (Decisione) opens', /DECISIONE|Decisione/.test(await page.locator('.lk-tabpanel:not([hidden])').textContent()));
  await page.locator('#w-piramide-quiz .lk-step-btns button').first().click();
  check('cap-01: piramide quiz verdict shown', /Corretto|No/.test(await page.locator('#w-piramide-quiz .lk-step-verdict').textContent()));

  // ---------- cap-02 ----------
  await fresh('cap-02-data-warehousing.html');
  await page.locator('#ac-olap .lk-ac-line').nth(1).click();
  check('cap-02: annotated code line explains', (await page.locator('#ac-olap .lk-ac-expl').textContent()).length > 10);
  await page.locator('#se-dw-caratteristiche .lk-se-node').nth(0).click();
  check('cap-02: DW state explorer renders title', (await page.locator('#se-dw-caratteristiche .lk-se-panel h4').textContent()) !== '');
  await page.locator('#w-oltp-olap .lk-step-btns button').first().click();
  check('cap-02: OLTP/OLAP widget responds', /Corretto|No, è/.test(await page.locator('#w-oltp-olap .lk-step-verdict').textContent()));

  // ---------- cap-03 ----------
  await fresh('cap-03-architetture.html');
  await page.locator('.lk-tabs').first().locator('.lk-tab').nth(1).click();
  check('cap-03: architettura tab 2 opens', /Due livelli/.test(await page.locator('.lk-tabs').first().locator('.lk-tabpanel:not([hidden])').textContent()));
  await page.locator('#w-arch .lk-step-btns button').first().click();
  check('cap-03: arch widget verdict', /Corretto|No/.test(await page.locator('#w-arch .lk-step-verdict').textContent()));
  await page.locator('#se-etl .lk-se-node').nth(1).click();
  check('cap-03: ETL state explorer renders', (await page.locator('#se-etl .lk-se-panel h4').textContent()) !== '');

  // ---------- cap-04 (footer attribution fix) ----------
  await fresh('cap-04-modello-multidimensionale.html');
  const foot4 = await page.locator('.lk-foot').textContent();
  check('cap-04: footer no longer cites 4 OLAP querying', !foot4.includes('OLAP querying'));
  check('cap-04: footer keeps DW intro source', foot4.includes('Introduzione ai sistemi di data warehousing'));
  await page.locator('#ac-rollup .lk-ac-line').nth(1).click();
  check('cap-04: roll-up annotated code', (await page.locator('#ac-rollup .lk-ac-expl').textContent()).length > 10);
  await page.locator('#se-sessione .lk-se-node').nth(1).click();
  check('cap-04: sessione state explorer', (await page.locator('#se-sessione .lk-se-panel h4').textContent()) !== '');
  const cuboBefore = await page.locator('#w-cubo .lk-step-verdict').textContent();
  await page.locator('#w-cubo .lk-step-btns button').first().click();
  const cuboAfter = await page.locator('#w-cubo .lk-step-verdict').textContent();
  check('cap-04: cubo operation simulator updates', cuboAfter !== cuboBefore && /ROLL-UP/.test(cuboAfter));

  // ---------- cap-05 ----------
  await fresh('cap-05-ciclo-di-vita.html');
  await page.locator('#se-fasi .lk-se-node').nth(1).click();
  check('cap-05: fasi state explorer', (await page.locator('#se-fasi .lk-se-panel h4').textContent()) !== '');
  await page.locator('#w-approccio .lk-step-btns button').first().click();
  await page.locator('#w-fase .lk-step-btns button').first().click();
  check('cap-05: approach+fase widgets respond',
    /Corretto|No/.test(await page.locator('#w-approccio .lk-step-verdict').textContent()) &&
    /Corretto|No/.test(await page.locator('#w-fase .lk-step-verdict').textContent()));

  // ---------- cap-06 ----------
  await fresh('cap-06-sorgenti-requisiti.html');
  await page.locator('#se-riconciliazione .lk-se-node').nth(1).click();
  check('cap-06: riconciliazione state explorer', (await page.locator('#se-riconciliazione .lk-se-panel h4').textContent()) !== '');
  await page.locator('#w-intervista .lk-step-btns button').first().click();
  await page.locator('#w-glossario .lk-step-btns button').first().click();
  check('cap-06: intervista+glossario widgets',
    /Corretto|No/.test(await page.locator('#w-intervista .lk-step-verdict').textContent()) &&
    (await page.locator('#w-glossario .lk-step-verdict').textContent()).length > 20 &&
    /ok/.test(await page.locator('#w-glossario .lk-step-verdict').getAttribute('class')));

  // ---------- cap-07 ----------
  await fresh('cap-07-dfm.html');
  await page.locator('#se-dfm .lk-se-node').nth(1).click();
  check('cap-07: DFM state explorer', (await page.locator('#se-dfm .lk-se-panel h4').textContent()) !== '');
  await page.locator('#w-classifica .lk-step-btns button').first().click();
  await page.locator('#w-additivita .lk-step-btns button').first().click();
  check('cap-07: classifica+additivita widgets',
    /Corretto|No/.test(await page.locator('#w-classifica .lk-step-verdict').textContent()) &&
    /Corretto|No/.test(await page.locator('#w-additivita .lk-step-verdict').textContent()));

  // ---------- cap-08 ----------
  await fresh('cap-08-dfm-avanzato.html');
  await page.locator('#se-costrutti .lk-se-node').nth(1).click();
  check('cap-08: costrutti state explorer', (await page.locator('#se-costrutti .lk-se-panel h4').textContent()) !== '');
  await page.locator('#w-multiplo .lk-step-btns button').first().click();
  await page.locator('#w-costrutto .lk-step-btns button').first().click();
  check('cap-08: multiplo+costrutto widgets',
    /PESATA|DI IMPATTO/.test(await page.locator('#w-multiplo .lk-step-verdict').textContent()) &&
    /Corretto|No/.test(await page.locator('#w-costrutto .lk-step-verdict').textContent()));

  // ---------- cap-09 ----------
  await fresh('cap-09-progettazione-concettuale.html');
  await page.locator('#st-inventario .lk-step-btns button').first().click();
  check('cap-09: inventario stepper advances', /done/.test(await page.locator('#st-inventario .lk-step-ins li').first().getAttribute('class')));
  await page.locator('#se-passi .lk-se-node').nth(1).click();
  check('cap-09: passi state explorer', (await page.locator('#se-passi .lk-se-panel h4').textContent()) !== '');
  await page.locator('#ac-misure .lk-ac-line').nth(1).click();
  check('cap-09: misure annotated code', (await page.locator('#ac-misure .lk-ac-expl').textContent()).length > 10);

  // ---------- cap-10 ----------
  await fresh('cap-10-carico-lavoro-volume-dati.html');
  const volBtn = page.locator('#st-vol .lk-step-btns button').first();
  await volBtn.click();
  check('cap-10: st-vol stepper advances', /done/.test(await page.locator('#st-vol .lk-step-ins li').first().getAttribute('class')));
  await page.locator('#ac-spec .lk-ac-line').nth(1).click();
  check('cap-10: spec annotated code', (await page.locator('#ac-spec .lk-ac-expl').textContent()).length > 10);
  await page.locator('#w-spec .lk-step-btns button').first().click();
  check('cap-10: spec widget verdict', /Corretto|No/.test(await page.locator('#w-spec .lk-step-verdict').textContent()));

  // ---------- cap-11 ----------
  await fresh('cap-11-progettazione-logica.html');
  const occBtn = page.locator('#st-occupazione .lk-step-btns button').first();
  await occBtn.click();
  check('cap-11: occupazione stepper advances', /done/.test(await page.locator('#st-occupazione .lk-step-ins li').first().getAttribute('class')));
  await page.locator('#ac-stella .lk-ac-line').nth(1).click();
  check('cap-11: stella annotated code', (await page.locator('#ac-stella .lk-ac-expl').textContent()).length > 10);
  await page.locator('#ac-snowflake .lk-ac-line').nth(1).click();
  check('cap-11: snowflake annotated code', (await page.locator('#ac-snowflake .lk-ac-expl').textContent()).length > 10);
  await page.locator('#w-traduzione .lk-step-btns button').first().click();
  check('cap-11: traduzione widget verdict', /Corretto|No/.test(await page.locator('#w-traduzione .lk-step-verdict').textContent()));

  // ---------- cap-12 ----------
  await fresh('cap-12-viste-materializzate-scenari-temporali.html');
  const scenBtn = page.locator('#st-scenari .lk-step-btns button').first();
  await scenBtn.click();
  check('cap-12: scenari stepper advances', /done/.test(await page.locator('#st-scenari .lk-step-ins li').first().getAttribute('class')));
  await page.locator('#ac-tipo3 .lk-ac-line').nth(1).click();
  check('cap-12: tipo3 annotated code', (await page.locator('#ac-tipo3 .lk-ac-expl').textContent()).length > 10);
  for (const id of ['w-op', 'w-schemi', 'w-viste-mat', 'w-framm']) {
    await page.locator('#' + id + ' .lk-step-btns button').first().click();
    check('cap-12: ' + id + ' widget verdict', /Corretto|No/.test(await page.locator('#' + id + ' .lk-step-verdict').textContent()));
  }

  // ---------- cap-13 ----------
  await fresh('cap-13-progettazione-fisica-etl-indici.html');
  const etlBtn = page.locator('#st-etl .lk-step-btns button').first();
  await etlBtn.click();
  check('cap-13: ETL stepper advances', /done/.test(await page.locator('#st-etl .lk-step-ins li').first().getAttribute('class')));
  for (const id of ['w-tecniche', 'w-caricamento', 'w-pulizia', 'w-bitmap', 'w-indici']) {
    await page.locator('#' + id + ' .lk-step-btns button').first().click();
    check('cap-13: ' + id + ' widget verdict', /Corretto|No/.test(await page.locator('#' + id + ' .lk-step-verdict').textContent()));
  }

  // ---------- cap-14 ----------
  await fresh('cap-14-interrogazione-olap-power-bi.html');
  const drillBtn = page.locator('#st-drill .lk-step-btns button').first();
  await drillBtn.click();
  check('cap-14: drill stepper advances', /done/.test(await page.locator('#st-drill .lk-step-ins li').first().getAttribute('class')));
  await page.locator('#ac-sql .lk-ac-line').nth(1).click();
  check('cap-14: SQL annotated code', (await page.locator('#ac-sql .lk-ac-expl').textContent()).length > 10);
  for (const id of ['w-elementi', 'w-misure', 'w-slice', 'w-vis']) {
    await page.locator('#' + id + '-dom .lk-step-btns button').first().click();
    check('cap-14: ' + id + ' widget verdict', /Corretto|No/.test(await page.locator('#' + id + '-dom .lk-step-verdict').textContent()));
  }

  // ---------- cap-15 ----------
  await fresh('cap-15-modulo-2-tpc-d-indyco-builder.html');
  const progBtn = page.locator('#st-progettazione .lk-step-btns button').first();
  await progBtn.click();
  check('cap-15: progettazione stepper advances', /done/.test(await page.locator('#st-progettazione .lk-step-ins li').first().getAttribute('class')));
  for (const id of ['w-cubo', 'w-legenda', 'w-logica', 'w-schema']) {
    await page.locator('#' + id + '-dom .lk-step-btns button').first().click();
    check('cap-15: ' + id + ' widget verdict', /Corretto|No/.test(await page.locator('#' + id + '-dom .lk-step-verdict').textContent()));
  }

  // ---------- cap-16 (stepper host fix) ----------
  await fresh('cap-16-power-bi-connessione-setup.html');
  check('cap-16: st-connessione host present', (await page.locator('#st-connessione').count()) === 1);
  check('cap-16: st-connessione renders stepper UI', (await page.locator('#st-connessione .lk-step-btns button').count()) >= 2);
  const connBtn = page.locator('#st-connessione .lk-step-btns button').first();
  await connBtn.click();
  check('cap-16: st-connessione advances', /done/.test(await page.locator('#st-connessione .lk-step-ins li').first().getAttribute('class')));
  await page.locator('#ac-related .lk-ac-line').nth(1).click();
  check('cap-16: RELATED annotated code', (await page.locator('#ac-related .lk-ac-expl').textContent()).length > 10);
  for (const id of ['w-relazioni', 'w-direzione', 'w-setup', 'w-esercizio1']) {
    await page.locator('#' + id + '-dom .lk-step-btns button').first().click();
    check('cap-16: ' + id + ' widget verdict', /Corretto|No/.test(await page.locator('#' + id + '-dom .lk-step-verdict').textContent()));
  }

  // ---------- nav chain integrity (bidirectional, cap-01..cap-16) ----------
  for (let i = 0; i < CHAIN.length; i++) {
    await fresh(CHAIN[i]);
    if (i < CHAIN.length - 1) {
      const next = await page.locator('.lk-chnav a[href^="cap-"]').last().getAttribute('href');
      check('nav: ' + CHAIN[i] + ' -> ' + CHAIN[i + 1], next === CHAIN[i + 1]);
    } else {
      check('nav: cap-16 terminal has no forward link',
        (await page.locator('.lk-chnav a[href^="cap-17"]').count()) === 0);
    }
    if (i > 0) {
      const prev = await page.locator('.lk-chnav a[href^="cap-"]').first().getAttribute('href');
      check('nav: ' + CHAIN[i] + ' <- ' + CHAIN[i - 1], prev === CHAIN[i - 1]);
    }
    check('nav: ' + CHAIN[i] + ' links index', (await page.locator('.lk-chnav a[href="index.html"]').count()) >= 2);
  }

  // ---------- course index ----------
  await fresh('index.html');
  check('index: hero roadmap plate present', (await page.locator('.idx-hero svg').count()) === 1);
  check('index: links all 16 chapters', (await page.locator('.idx-list a').count()) === 16);
  const idxHrefs = await page.locator('.idx-list a').evaluateAll(as => as.map(a => a.getAttribute('href')));
  for (const f of CHAIN) {
    check('index: links ' + f, idxHrefs.includes(f));
  }
  const idxMeta = await page.locator('.lk-meta').textContent();
  check('index: meta totals 16/67/89', idxMeta.includes('16 capitoli') && idxMeta.includes('67 widget') && idxMeta.includes('89 tavole'));
  const idxFoot = await page.locator('.lk-foot').textContent();
  check('index: corpus exhaustion documented', /esaurisce integralmente/.test(idxFoot));
  check('index: exam archives classified as supplementary', /materiale supplementare/.test(idxFoot) && /24/.test(idxFoot));

  check('NO PAGE ERRORS across all 17 pages', errors.length === 0);
  if (errors.length) { console.log('  errors:'); errors.forEach(e => console.log('   - ' + e)); }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
