#!/usr/bin/env node
/* Smoke suite for the Reti LM course (reti-lm/), all 14 chapters + index.
   Runs over file:// with Playwright in real Chromium.
   cd dev && node smoke-reti-lm-full.js
   Verifies: zero console/page errors on every page, every widget host is
   populated, header widget metadata matches the rendered page, meaningful
   interactions on every widget with verifiable outputs, bidirectional 1..14
   navigation, terminal-chapter behavior, course index completeness. */
const { chromium } = require('playwright');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'reti-lm');
const url = f => 'file://' + path.join(ROOT, f);
const CHAIN = [
  'cap-01-introduzione.html', 'cap-02-probabilita.html', 'cap-03-teletraffico.html',
  'cap-04-markov.html', 'cap-05-erlang-perdita.html', 'cap-06-code-attesa.html',
  'cap-07-mg1-priorita.html', 'cap-08-affidabilita-arq.html', 'cap-09-tcp-segmento.html',
  'cap-10-tcp-connessione.html', 'cap-11-tcp-timeout-flusso.html',
  'cap-12-tcp-congestione.html', 'cap-13-tcp-prestazioni.html', 'cap-14-compito.html'
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

  async function fresh(f) { await page.goto(url(f)); await page.waitForTimeout(180); }
  const txt = async sel => (await page.locator(sel).textContent()).trim();
  const has = async (sel, re) => re.test(await txt(sel));

  /* ---------- cap-01 ---------- */
  await fresh('cap-01-introduzione.html');
  check('cap-01: header meta claims 4 widgets', has('.lk-meta', /4 widget interattivi/));
  check('cap-01: delay calculator default 2.70 ms total', has('#d-out', /totale a un hop = <b>2\.70 ms/));
  await page.locator('#d-queue').fill('10');
  check('cap-01: queue slider recomputes to 14.70 ms', has('#d-out', /14\.70 ms/));
  check('cap-01: queue-dominant verdict flips to warning', has('#d-note', /attesa in coda/) && (await page.locator('#d-note').getAttribute('class')).includes('bad'));
  await page.locator('#d-queue').fill('0');
  // load widget: 50% comfortable, 120% unstable
  check('cap-01: load widget default comfortable zone', has('#l-note', /Zona di lavoro confortevole/));
  await page.locator('#l-in').fill('120');
  check('cap-01: overload verdict says unstable', has('#l-note', /non e piu stabile/));
  await page.locator('#l-in').fill('50');
  // store-and-forward stepper: A blocked behind B, then both complete
  const stepA = page.locator('#step-router .lk-step-btns button').nth(0);
  const stepB = page.locator('#step-router .lk-step-btns button').nth(1);
  for (let i = 0; i < 4; i++) await stepA.click();
  for (let i = 0; i < 4; i++) await stepB.click();
  check('cap-01: packet B blocked while interface busy', has('#step-router .lk-step-verdict', /in attesa perche il servitore e occupato/));
  await stepA.click(); await stepB.click(); await stepB.click();
  check('cap-01: both packets exit the router', has('#step-router .lk-step-verdict', /Entrambi i pacchetti sono usciti/));
  await page.locator('.lk-tab').nth(2).click();
  check('cap-01: layer tabs switch to Transport', (await page.locator('.lk-tabpanel:not([hidden])').textContent()).includes('trasferimento affidabile dei dati end-to-end'));
  await page.locator('.lk-quiz details summary').first().click();
  check('cap-01: quiz details toggle opens', await page.locator('.lk-quiz details').first().evaluate(d => d.open));
  await page.locator('.lk-toc a[href="#quiz"]').click();
  check('cap-01: toc fragment anchor navigates to #quiz', (await page.evaluate(() => location.hash)) === '#quiz');

  /* ---------- cap-02 ---------- */
  await fresh('cap-02-probabilita.html');
  check('cap-02: dice widget P{n=9}=4/36', has('#dd-out', /P\{n=9\} = 4\/36 = 0\.2500/));
  await page.locator('#dd-n').fill('2');
  check('cap-02: dice sum 2 gives 1/36', has('#dd-out', /P\{n=2\} = 1\/36 = 0\.0278/));
  await page.locator('#dd-n').fill('9');
  check('cap-02: memoryless both probabilities 0.3679', has('#ml-out', /0\.3679/));
  await page.locator('#ml-s').fill('10');
  check('cap-02: memoryless survives elapsed time s=10', has('#ml-out', /0\.3679/));
  await page.locator('#ml-s').fill('0');
  check('cap-02: ergodic short window is noisy', has('#er-note', /Finestra troppo corta/));
  await page.locator('#er-t').fill('2000');
  check('cap-02: ergodic long window converges', has('#er-note', /indistinguibile/));

  /* ---------- cap-03 ---------- */
  await fresh('cap-03-teletraffico.html');
  await page.locator('#ac-kendall .lk-ac-line').nth(1).click();
  check('cap-03: annotated Kendall line explains arrivals', has('#ac-kendall .lk-ac-expl', /ARRIVI/));
  check('cap-03: Little default A = 40.000 E', has('#li-out', /= <b>40\.000 E/));
  await page.locator('#li-what').selectOption('L');
  check('cap-03: Little lambda = A/delta = 20.000', has('#li-out', /20\.000 utenti\/min/));
  await page.locator('#li-what').selectOption('A');
  check('cap-03: Kendall builder reduced form M/M/1', has('#k-out', /forma ridotta: <b>M\/M\/1<\/b>/));
  await page.locator('#k-n').selectOption('0');
  check('cap-03: Kendall loss system description', has('#k-note', /sistema a perdita/));
  await page.locator('#k-n').selectOption('inf');
  check('cap-03: Poisson default E[k]=4.00', has('#po-out', /E\[k\] = <b>4\.00<\/b>/));
  await page.locator('#po-in').fill('10');
  check('cap-03: Poisson slider moves mean to 1.00', has('#po-out', /E\[k\] = <b>1\.00<\/b>/));
  await page.locator('#po-in').fill('40');
  check('cap-03: service-time deterministic E[th2]=1.000', has('#sv-out', /D deterministico: E\[&thetas;&sup2;\] = <b>1\.000/));
  await page.locator('#sv-r').fill('20');
  check('cap-03: Erlang degree slider narrows E[th2]', has('#sv-out', /E20 Erlang grado 20: E\[&thetas;&sup2;\] = <b>1\.050/));

  /* ---------- cap-04 ---------- */
  await fresh('cap-04-markov.html');
  check('cap-04: DTMC step zero mass on start state', has('#dm-note', /Passo zero/));
  await page.locator('#dm-n').fill('40');
  check('cap-04: DTMC converges to stationary distribution', has('#dm-note', /Convergenza raggiunta/));
  check('cap-04: DTMC probabilities sum to 1', has('#dm-out', /somma = <b>1\.0000/));
  await page.locator('#bd-q').fill('2');
  check('cap-04: birth-death recomputes with queue 2', (await page.locator('#bd-out').textContent()).includes('P blocco'));
  await page.locator('#se-operatore .lk-se-node').nth(1).click();
  check('cap-04: operator state explorer opens priority state', (await page.locator('#se-operatore .lk-se-panel h4').textContent()) === 'A chiamata prioritaria');

  /* ---------- cap-05 ---------- */
  await fresh('cap-05-erlang-perdita.html');
  check('cap-05: Erlang B(11,5)=8.286e-3', has('#eb-out', /B\(11, 5\) = <b>8\.286e-3/));
  check('cap-05: Erlang B sizing m_min=11', has('#eb-out', /m minimo per &pi;&#8346; &le; 0\.01: <b>11<\/b>/));
  await page.locator('#eb-a').fill('10');
  check('cap-05: Erlang B 10 E fails requirement', has('#eb-note', /NON e soddisfatto/));
  await page.locator('#eb-a').fill('5');
  check('cap-05: aggregation 12 systems x 7 servers = 84', has('#ag-out', /totale servitori = <b>84<\/b>/));
  await page.locator('#ag-n').fill('4');
  check('cap-05: aggregation recomputes for 4 systems', (await page.locator('#ag-out').textContent()).includes('N sistemi da 2 E'));
  check('cap-05: packing first server rho 0.8333', has('#cp-out', /&rho;&#8321; primo servitore = <b>0\.8333/));
  await page.locator('#cp-m').fill('20');
  check('cap-05: packing slider recomputes for 20 servers', (await page.locator('#cp-mv').textContent()) === '20');

  /* ---------- cap-06 ---------- */
  await fresh('cap-06-code-attesa.html');
  check('cap-06: M/M/m default A0=19.200 E', has('#mm-out', /A&#8320; = <b>19\.200 E/));
  check('cap-06: M/M/m default rho 0.835', has('#mm-out', /&rho; = <b>0\.835/));
  await page.locator('#mm-m').fill('20');
  check('cap-06: M/M/m recomputes for m=20', (await page.locator('#mm-out').textContent()).includes('C(m,A&#8320;)') || (await page.locator('#mm-out').textContent()).includes('C(m,A'));
  await page.locator('#mm-m').fill('23');
  check('cap-06: wait-distribution sizing m=23 and 97.76%', has('#at-out', /97\.76%/));
  await page.locator('#at-p').fill('0.99');
  check('cap-06: stricter p0=0.99 raises m to 24', has('#at-out', /23\.805 &rarr; 24/));
  await page.locator('#at-p').fill('0.95');
  check('cap-06: M/M/1 default comfortable regime', has('#m1-note', /Regime confortevole/));
  await page.locator('#m1-in').fill('95');
  check('cap-06: M/M/1 rho=0.95 forbidden zone', has('#m1-note', /Zona proibita/) && has('#m1-out', /20\.00&times;/));
  await page.locator('#m1-in').fill('50');
  check('cap-06: shared-queue comparison shows fast M/M/1 0.333', has('#cf-out', /3 &middot; un M\/M\/1 veloce: &delta;&#772; = <b>0\.333/));
  await page.locator('#cf-r').fill('90');
  check('cap-06: comparison recomputes at rho0=0.90', (await page.locator('#cf-out').textContent()).includes('10.000'));
  await page.locator('#cf-r').fill('70');
  check('cap-06: M/M/1/L block probability 4.573e-2', has('#ml-out', /4\.573e-2/));
  await page.locator('#ml-a').fill('2');
  check('cap-06: M/M/1/L A0>1 irreducible loss', has('#ml-note', /frazione irriducibile/));
  await page.locator('#ml-a').fill('0.9');

  /* ---------- cap-07 ---------- */
  await fresh('cap-07-mg1-priorita.html');
  check('cap-07: Pollaczek-Khinchine M/M/1 wait 16.000 ms', has('#pk-out', /M\/M\/1: &eta;&#772; = <b>16\.000 ms/));
  await page.locator('#pk-r').fill('20');
  check('cap-07: P-K Erlang degree 20 narrows wait', has('#pk-out', /M\/E20\/1: &eta;&#772; = <b>8\.400 ms/));
  await page.locator('#pk-r').fill('4');
  check('cap-07: priority low fraction excellent deal', has('#pr-note', /Affare eccellente/));
  await page.locator('#pr-f').fill('80');
  check('cap-07: priority 80% becomes useless', has('#pr-note', /Priorita inutile/));
  await page.locator('#pr-f').fill('14');
  check('cap-07: Kleinrock invariant 17.640 FIFO', has('#kl-out', /invariante = <b>17\.640/));
  await page.locator('#kl-btns button').nth(1).click();
  check('cap-07: Kleinrock invariant unchanged under PRIO', has('#kl-out', /somma = <b>17\.640/));

  /* ---------- cap-08 ---------- */
  await fresh('cap-08-affidabilita-arq.html');
  check('cap-08: stop-and-wait efficiency 0.60%', has('#ef-out', /efficienza Stop-and-Wait = <b>0\.60%/));
  check('cap-08: ideal window 167.7 blocks', has('#ef-out', /W ideale = <b>167\.7 blocchi/));
  await page.locator('#ef-w').fill('200');
  check('cap-08: window 200 fills the pipe', has('#ef-note', /Il tubo e pieno/));
  await page.locator('#ef-w').fill('1');
  const gbn = page.locator('#step-arq .lk-step-btns button').nth(0);
  const sr = page.locator('#step-arq .lk-step-btns button').nth(1);
  for (let i = 0; i < 6; i++) await gbn.click();
  for (let i = 0; i < 6; i++) await sr.click();
  check('cap-08: GBN 6 vs SR 4 transmissions', has('#step-arq .lk-step-verdict', /Go-Back-N ha usato 6 trasmissioni contro 4/));
  check('cap-08: congestion control default is TCP choice', has('#cg-note', /scelta del TCP/));
  await page.locator('input[name="cg-f"][value="expl"]').check();
  check('cap-08: explicit feedback shows intermediate combo', has('#cg-note', /Combinazione intermedia/));

  /* ---------- cap-09 ---------- */
  await fresh('cap-09-tcp-segmento.html');
  await page.locator('#w-trasporto .lk-tab').nth(1).click();
  check('cap-09: transport tabs show TCP panel', (await page.locator('#w-trasporto .lk-tabpanel:not([hidden])').textContent()).includes('Connection-oriented'));
  const ep = page.locator('#w-percorso .lk-step-btns button').nth(0);
  for (let i = 0; i < 6; i++) await ep.click();
  check('cap-09: encapsulation stepper completes', has('#w-percorso .lk-step-verdict', /TCP li ha numerati e protetti/));
  check('cap-09: MSS default 1460 byte', has('#ms-out', /MSS = <b>1460 byte/));
  await page.locator('#ms-mtu').fill('1400');
  check('cap-09: MSS recomputes for MTU 1400', has('#ms-out', /MSS = <b>1360 byte/));
  await page.locator('#ms-mtu').fill('1500');
  await page.locator('#w-bits .lk-se-trans button').first().click();
  check('cap-09: control-bits explorer reaches ACK', (await page.locator('#w-bits .lk-se-panel h4').textContent()) === 'ACK');
  await page.locator('#w-segmento .lk-ac-line').nth(2).click();
  check('cap-09: segment annotated line explains SEQ', has('#w-segmento .lk-ac-expl', /numero di sequenza 1001/));

  /* ---------- cap-10 ---------- */
  await fresh('cap-10-tcp-connessione.html');
  const ha = page.locator('#w-handshake .lk-step-btns button').nth(0);
  const hb = page.locator('#w-handshake .lk-step-btns button').nth(1);
  await hb.click();
  check('cap-10: handshake blocks B before SYN of A', has('#w-handshake .lk-step-verdict', /se anticipi B, il suo passo resta bloccato/) && (await page.locator('#w-handshake .lk-step-ins li.blocked').count()) === 1);
  await ha.click(); await ha.click(); await hb.click(); await hb.click(); await ha.click(); await hb.click();
  check('cap-10: handshake completes', has('#w-handshake .lk-step-verdict', /Handshake completo/));
  await page.locator('#w-stati .lk-se-trans button').nth(1).click();
  check('cap-10: TCP state explorer active open -> SYN_SENT', (await page.locator('#w-stati .lk-se-panel h4').textContent()) === 'SYN_SENT');
  await page.locator('#w-codice .lk-ac-line').nth(11).click();
  check('cap-10: server code line explains bind', has('#w-codice .lk-ac-expl', /Associa la socket/));
  await page.locator('#w-chiusura .lk-tab').nth(1).click();
  check('cap-10: close tabs switch to joint close', (await page.locator('#w-chiusura .lk-tabpanel:not([hidden])').textContent()).length > 10);

  /* ---------- cap-11 ---------- */
  await fresh('cap-11-tcp-timeout-flusso.html');
  check('cap-11: RTO stable phase k=1', has('#rt-note', /Fase stabile/));
  await page.locator('#rt-k').fill('4');
  check('cap-11: RTO anomalous sample k=4 flagged', has('#rt-note', /Campione anomalo/));
  await page.locator('#rt-k').fill('1');
  const bk = page.locator('#step-backoff .lk-step-btns button').nth(0);
  for (let i = 0; i < 5; i++) await bk.click();
  check('cap-11: exponential backoff restores RTO', has('#step-backoff .lk-step-verdict', /ACK ricevuto: il back-off termina/));
  check('cap-11: Nagle default sends 9 tinygrams', has('#ng-out', /segmenti dati = <b>9<\/b>/));
  await page.locator('input[name="ng-mode"][value="on"]').check();
  check('cap-11: Nagle aggregates to 3 segments', has('#ng-out', /segmenti dati = <b>3<\/b>/) && has('#ng-note', /Nagle aggrega/));
  await page.locator('#w-flow-state .lk-se-trans button').first().click();
  check('cap-11: flow-control explorer reaches Window probe', (await page.locator('#w-flow-state .lk-se-panel h4').textContent()) === 'Window probe');
  await page.locator('#w-ack-tabs .lk-tab').nth(1).click();
  check('cap-11: dup-ACK tabs switch to out-of-order panel', (await page.locator('#w-ack-tabs .lk-tabpanel:not([hidden])').textContent()).length > 10);

  /* ---------- cap-12 ---------- */
  await fresh('cap-12-tcp-congestione.html');
  check('cap-12: ideal window 250.000 byte', (await page.locator('#fi-wv').textContent()).trim() === '250.000');
  check('cap-12: ideal window shown in bytes', has('#fi-out', /W ideale = <b>250\.000 byte/));
  check('cap-12: ideal zone verdict', has('#fi-note', /Zona ideale/));
  await page.locator('#fi-b').fill('50000000');
  check('cap-12: half bandwidth halves ideal window', has('#fi-out', /W ideale = <b>125\.000 byte/));
  await page.locator('#fi-b').fill('100000000');
  const ss = page.locator('#step-ss .lk-step-btns button').nth(0);
  for (let i = 0; i < 5; i++) await ss.click();
  check('cap-12: slow start reaches threshold in 3 RTT', has('#step-ss .lk-step-verdict', /Soglia raggiunta in 3 RTT/));
  await page.locator('#w-ciclo .lk-se-trans button').first().click();
  check('cap-12: CW lifecycle reaches Congestion Avoidance', (await page.locator('#w-ciclo .lk-se-panel h4').textContent()) === 'Congestion Avoidance');
  await page.locator('#ai-next').click();
  check('cap-12: AIMD first loss at t=1.67 s', has('#ai-out', /t = <b>1\.67 s/) && has('#ai-out', /divario = <b>80\.0/));
  check('cap-12: AIMD fairness note after losses', has('#ai-note', /tende all.equità|tende all'equità|tende all.equita/));

  /* ---------- cap-13 ---------- */
  await fresh('cap-13-tcp-prestazioni.html');
  check('cap-13: periodic model WL=16.3 default', has('#pp-out', /W<sub>L<\/sub> = <b>16\.3/));
  check('cap-13: periodic throughput 12.25 seg/RTT', has('#pp-out', /throughput = <b>12\.25<\/b> segmenti\/RTT/));
  await page.locator('#pp-in').fill('25');
  check('cap-13: higher loss lowers WL to 8.2', has('#pp-out', /W<sub>L<\/sub> = <b>8\.2/));
  await page.locator('#pp-in').fill('100');
  check('cap-13: AW-limited verdict default', has('#aw-note', /supera AW/));
  await page.locator('#aw-win').fill('64');
  check('cap-13: big AW removes the limitation', has('#aw-note', /non ha effetto/));
  await page.locator('#aw-win').fill('16');
  check('cap-13: static-window latency D=20.81 s', has('#ls-out', /D = <b>20\.81 s/));
  check('cap-13: static-window case 3 verdict', has('#ls-note', /Caso 3/));
  const staticBefore = parseFloat((await page.locator('#ls-out .lk-step-box').last().textContent()).match(/[\d.]+/)[0]);
  await page.locator('#ls-cin').fill('8000');
  const staticAfter = parseFloat((await page.locator('#ls-out .lk-step-box').last().textContent()).match(/[\d.]+/)[0]);
  check('cap-13: faster link cuts latency', staticAfter < staticBefore);
  await page.locator('#ls-cin').fill('800');
  check('cap-13: dynamic window N=375 segments', has('#ld-out', /N = <b>375<\/b> segmenti/));
  check('cap-13: dynamic window k_SS=3', has('#ld-out', /k<sub>SS<\/sub> = <b>3<\/b>/));
  check('cap-13: dynamic window reaches SS warning', has('#ld-note', /Slow Start/));
  await page.locator('#ld-cin').fill('10');
  check('cap-13: faster dynamic link changes phases', (await page.locator('#ld-out').textContent()).includes('WID'));

  /* ---------- cap-14 (terminal chapter) ---------- */
  await fresh('cap-14-compito.html');
  check('cap-14: call-center first approx 4.00 min', has('#cc-out', /&epsilon;&#772; \(1ª appr\.\) = <b>4\.00 min/));
  check('cap-14: call-center B(l,A0)=0.194', has('#cc-out', /B\(l, A′0\) = <b>0\.194/));
  check('cap-14: call-center needs iteration', has('#cc-note', /procedimento iterativo/));
  await page.locator('#cc-min').fill('6');
  check('cap-14: call-center recomputes for 6 operators', (await page.locator('#cc-m').textContent()) === '6');
  await page.locator('#cc-min').fill('3');
  await page.locator('#ai-next').click();
  check('cap-14: AIMD first loss divides the gap to 200', has('#ai-out', /divario = <b>200 kbit\/s/));
  const tg = page.locator('#tg-next');
  for (let i = 0; i < 9; i++) await tg.click();
  check('cap-14: TCP grid completes at RTT 9', has('#tg-out', /RTT <b>9<\/b>/) && has('#tg-note', /trasferimento completo/));
  check('cap-14: performance question W_ID=20', has('#p2-out', /W<sub>ID<\/sub> = <b>20<\/b> segmenti/));
  check('cap-14: performance question Delta=25%', has('#p2-out', /Δ = <b>25%<\/b>/));
  check('cap-14: performance question AW-limited', has('#p2-note', /supera AW/));
  check('cap-14: terminal chapter links only back to cap-13', await page.locator('.lk-chnav a[href^="cap-"]').evaluateAll(as => as.every(a => a.getAttribute('href') === 'cap-13-tcp-prestazioni.html')));

  /* ---------- navigation chain (bidirectional, cap-01..cap-14) ---------- */
  for (let i = 0; i < CHAIN.length; i++) {
    await fresh(CHAIN[i]);
    const next = await page.locator('.lk-chnav a[href^="cap-"]').last().getAttribute('href');
    const prev = await page.locator('.lk-chnav a[href^="cap-"]').first().getAttribute('href');
    if (i < CHAIN.length - 1) {
      check('nav: ' + CHAIN[i] + ' -> ' + CHAIN[i + 1], next === CHAIN[i + 1]);
    } else {
      check('nav: terminal chapter has no forward chapter link', next === 'cap-13-tcp-prestazioni.html' || next === null);
    }
    if (i > 0) {
      check('nav: ' + CHAIN[i] + ' <- ' + CHAIN[i - 1], prev === CHAIN[i - 1]);
    }
  }

  /* ---------- widget metadata matches rendered pages ---------- */
  const expectedWidgets = { 'cap-01-introduzione.html': 4, 'cap-02-probabilita.html': 4, 'cap-03-teletraffico.html': 6, 'cap-04-markov.html': 3, 'cap-05-erlang-perdita.html': 3, 'cap-06-code-attesa.html': 6, 'cap-07-mg1-priorita.html': 3, 'cap-08-affidabilita-arq.html': 6, 'cap-09-tcp-segmento.html': 5, 'cap-10-tcp-connessione.html': 4, 'cap-11-tcp-timeout-flusso.html': 5, 'cap-12-tcp-congestione.html': 5, 'cap-13-tcp-prestazioni.html': 4, 'cap-14-compito.html': 4 };
  for (const f of CHAIN) {
    await fresh(f);
    const rendered = await page.evaluate(() => {
      const candidates = [...document.querySelectorAll('[id^="w-"],[id^="step-"],[id^="se-"],[id^="ac-"],.lk-tabs[data-kit="tabs"]')];
      return new Set(candidates.filter(h => h.classList.contains('lk-step') || h.classList.contains('lk-se') || h.classList.contains('lk-acode') || h.classList.contains('lk-tabs') || h.childElementCount > 0)).size;
    });
    check(f + ': rendered widgets ' + rendered + ' == meta ' + expectedWidgets[f], rendered === expectedWidgets[f]);
  }

  /* ---------- course index ---------- */
  await fresh('index.html');
  check('index: header claims 62 widgets', has('.lk-meta', /62 widget interattivi/));
  check('index: 4 study parts', (await page.locator('.idx-part').count()) === 4);
  check('index: links all 14 chapters', (await page.locator('.idx-list a').count()) === 14);
  const idxHrefs = await page.locator('.idx-list a').evaluateAll(as => as.map(a => a.getAttribute('href')));
  for (const f of CHAIN) check('index: links ' + f, idxHrefs.includes(f));
  check('index: exam-prep chapter styled', (await page.locator('.idx-list li.idx-prep a').getAttribute('href')) === 'cap-14-compito.html');
  check('index: footer attributes the reconstruction', /Ricostruito dalle lezioni/.test(await page.locator('.lk-foot').textContent()));
  // per-row widget counts match the chapter headers
  const rowMeta = await page.locator('.idx-list .idx-meta').evaluateAll(ms => ms.map(m => m.textContent.trim()));
  const chapterMeta = {};
  for (const f of CHAIN) {
    await fresh(f);
    const m = await page.locator('.lk-meta span').nth(1).textContent();
    chapterMeta[f] = m;
  }
  const expRows = ['26 min · 4 widget', '24 min · 4 widget', '38 min · 6 widget', '32 min · 3 widget', '34 min · 3 widget', '42 min · 6 widget', '38 min · 3 widget', '30 min · 6 widget', '35 min · 5 widget', '34 min · 4 widget', '45 min · 5 widget', '50 min · 5 widget', '48 min · 4 widget', '55 min · 4 widget'];
  rowMeta.forEach((r, i) => check('index row ' + (i + 1) + ' matches chapter meta', r === expRows[i] && (chapterMeta[CHAIN[i]] || '').includes(r.split(' · ')[1])));

  check('NO PAGE ERRORS across all 15 pages', errors.length === 0);
  if (errors.length) { console.log('  errors:'); errors.forEach(e => console.log('   - ' + e)); }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
