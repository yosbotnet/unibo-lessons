// Offline test for the politics PWA.
// Serves politics/ on localhost, installs the service worker, cuts the network,
// then checks that lessons still load entirely from cache.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const PORT = 8124;
const ROOT = path.resolve(__dirname, '..', 'politics');
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
      const c = await caches.open('politics-v1');
      return (await c.keys()).length;
    }, null, { timeout: 20000 }).then(h => h.jsonValue());
    check(`precache filled (${cached} files)`, cached >= 39);

    // Cut the network. Everything below must come from the cache.
    await context.setOffline(true);

    await page.goto(`http://localhost:${PORT}/Poli-03-Democracy.html`);
    check('offline: Poli-03 opens', /Democracy/.test(await page.title()));
    await page.locator('#ddP4').click();
    check('offline: dimmer JS runs', /full liberal democracy/.test(await page.locator('#ddRead').textContent()));
    check('offline: hero image served', await page.evaluate(() => {
      const i = document.querySelector('.lk-hero'); return i.complete && i.naturalWidth > 0;
    }));

    await page.goto(`http://localhost:${PORT}/Poli-07-Elections-and-Referendums.html`);
    check('offline: Poli-07 opens', /Translation Machine/.test(await page.title()));
    await page.locator('#tmT').evaluate(el => { el.value = '8'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    check('offline: seat machine plays', /deleted Green/.test(await page.locator('#tmRead').textContent()));

    await page.goto(`http://localhost:${PORT}/index.html`);
    check('offline: course index opens', (await page.locator('a[href*="Poli-02"]').count()) > 0);

    check('no page errors', errors.length === 0);
    if (errors.length) errors.forEach(e => console.log('  ERR ' + e));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fail === 0 ? 'POLITICS PWA OFFLINE TEST GREEN (' + pass + ' checks)' : 'FAILURES: ' + fail);
  process.exit(fail === 0 ? 0 : 1);
})();
