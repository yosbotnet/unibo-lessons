// Offline test for the macro PWA.
// Serves macro/ on localhost, installs the service worker, cuts the network,
// then checks that lessons still load entirely from cache.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const PORT = 8123;
const ROOT = path.resolve(__dirname, '..', 'macro');
let pass = 0, fail = 0;
function check(name, ok) {
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name); }
}

(async () => {
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '-d', ROOT], { stdio: 'inherit' });
  server.on('error', e => { console.log('server spawn error: ' + e.message); process.exit(1); });
  const http = require('http');
  await new Promise((resolve, reject) => {
    let tries = 0;
    (function poll() {
      http.get(`http://127.0.0.1:${PORT}/index.html`, res => { res.resume(); resolve(); })
        .on('error', () => { if (++tries > 50) reject(new Error('server never came up')); else setTimeout(poll, 200); });
    })();
  });
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  try {
    // First visit, online: the service worker installs and precaches the course.
    await page.goto(`http://localhost:${PORT}/index.html`);
    await page.evaluate(() => navigator.serviceWorker.ready);
    const cached = await page.waitForFunction(async () => {
      const c = await caches.open('macro-v1');
      return (await c.keys()).length;
    }, null, { timeout: 15000 }).then(h => h.jsonValue());
    check(`precache filled (${cached} files)`, cached >= 35);

    // Cut the network. Everything below must come from the cache.
    await context.setOffline(true);

    await page.goto(`http://localhost:${PORT}/Macro-05-IS-LM.html`);
    check('offline: Macro-05 opens', /IS-LM/.test(await page.title()));
    check('offline: cockpit JS runs', /960/.test(await page.locator('#cRead').textContent()));
    check('offline: hero image served', await page.evaluate(() => {
      const i = document.querySelector('.lk-hero'); return i.complete && i.naturalWidth > 0;
    }));

    await page.goto(`http://localhost:${PORT}/Macro-07-Phillips-Curve.html`);
    check('offline: Macro-07 opens', /Phillips/.test(await page.title()));
    await page.locator('#dgCold').click();
    check('offline: disinflation game plays', /Year 1/.test(await page.locator('#dgRead').textContent()));

    await page.goto(`http://localhost:${PORT}/index.html`);
    check('offline: course index opens', (await page.locator('a[href*="Macro-02"]').count()) > 0);

    check('no page errors', errors.length === 0);
    if (errors.length) errors.forEach(e => console.log('  ERR ' + e));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fail === 0 ? 'PWA OFFLINE TEST GREEN (' + pass + ' checks)' : 'FAILURES: ' + fail);
  process.exit(fail === 0 ? 0 : 1);
})();
