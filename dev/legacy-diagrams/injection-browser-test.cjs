'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const {createRenderer} = require('./render.cjs');
const c = require('./injection-content.cjs');
const root = path.resolve(__dirname, '../..');
const out = '/home/ybc/notes-legacy-review-artifacts';
const base = 'http://127.0.0.1:8787/';
async function route(page) {
  await page.route(/^https?:/, request => {
    const url = request.request().url();
    if (url.startsWith(base)) return request.continue();
    if (/mermaid.*\.js/.test(url)) return request.fulfill({path:path.join(path.dirname(require.resolve('mermaid')), 'mermaid.min.js')});
    if (/highlight\.min\.js/.test(url)) return request.fulfill({path:root + '/dl/assets/highlight.min.js'});
    return request.abort();
  });
}
async function shot(page, locator, name) {
  await locator.evaluate(element => element.scrollIntoView({block:'start', behavior:'instant'}));
  await page.screenshot({path:out + '/' + name + '.png'});
}
async function promptScroll(page, scope) {
  for (const pre of await scope.locator('pre').all()) {
    if (!await pre.isVisible()) continue;
    if (await pre.evaluate(e => e.scrollWidth > e.clientWidth + 1)) {
      await pre.focus();
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(200);
      assert(await pre.evaluate(e => e.scrollLeft > 0), 'Prompt example must be keyboard-scrollable');
    }
  }
}
async function tableBounds(table) {
  return table.evaluate(table => {
    const bad = [];
    for (const cell of table.querySelectorAll('th,td')) {
      const box = cell.getBoundingClientRect();
      const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
      let node;
      while (node = walker.nextNode()) {
        if (!node.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const r of range.getClientRects()) if (r.width && (r.left < box.left-1 || r.right > box.right+1 || r.top < box.top-1 || r.bottom > box.bottom+1)) bad.push(cell.textContent);
      }
    }
    return bad;
  });
}
(async () => {
  const renderer = await createRenderer();
  const variants = [];
  try {
    for (const [name, overrides] of [['default',{}], ['spacious',{nodeSpacing:60,rankSpacing:70}], ['vertical',{direction:'TB'}]]) {
      const r = await renderer.render({...c.diagram, overrides:{...c.diagram.overrides,...overrides}});
      assert.equal(r.nodes, 6);
      assert.equal(r.edges.length, 5);
      for (const pair of ['A_M','U_M','D_M','V_M','M_P']) assert(r.edges.some(edge => edge.id.includes('_' + pair + '_')), pair);
      assert(r.edges.every(edge => edge.end && !/[CQAST]/i.test(edge.d)));
      if (name === 'default') {
        assert.equal(fs.readFileSync(c.asset, 'utf8'), r.svg + '\n');
        assert(r.width + 26 <= 800, 'Default figure fits desktop column');
      }
      const issues = await renderer.page.evaluate(() => {
        const svg = document.querySelector('svg');
        const box = svg.getBoundingClientRect();
        const labels = [...svg.querySelectorAll('text')].map(e => ({text:e.textContent, box:e.getBoundingClientRect()}));
        const outside = labels.filter(({box:b}) => b.left < box.left-1 || b.right > box.right+1 || b.top < box.top-1 || b.bottom > box.bottom+1).map(e=>e.text);
        const overlaps = [];
        for (let i=0;i<labels.length;i++) for (let j=i+1;j<labels.length;j++) {
          const a=labels[i].box,b=labels[j].box;
          if (Math.min(a.right,b.right)-Math.max(a.left,b.left)>1 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1) overlaps.push([labels[i].text,labels[j].text]);
        }
        const missingMarkers = [...svg.querySelectorAll('[marker-end]')].filter(e => !svg.querySelector(e.getAttribute('marker-end').match(/#([^)]*)/)[0])).length;
        const nodes = [...svg.querySelectorAll('.node')].map(e => ({id:e.id.match(/-flowchart-(\w+)-/)[1],box:e.getBoundingClientRect()}));
        const crossings = [];
        for (const edge of svg.querySelectorAll('.flowchart-link')) {
          const [,from,to] = edge.id.match(/-L_(\w+)_(\w+)_/);
          const matrix = edge.getScreenCTM();
          for (let length=0;length<=edge.getTotalLength();length+=1) {
            const local = edge.getPointAtLength(length);
            const p = new DOMPoint(local.x,local.y).matrixTransform(matrix);
            for (const node of nodes) if (node.id!==from && node.id!==to && p.x>node.box.left+1 && p.x<node.box.right-1 && p.y>node.box.top+1 && p.y<node.box.bottom-1) crossings.push([from,to,node.id]);
          }
        }
        return {outside,overlaps,missingMarkers,crossings,foreign:svg.querySelectorAll('foreignObject,sub,sup').length,xml:new DOMParser().parseFromString(svg.outerHTML,'image/svg+xml').querySelectorAll('parsererror').length};
      });
      assert.deepEqual(issues, {outside:[],overlaps:[],missingMarkers:0,crossings:[],foreign:0,xml:0});
      await renderer.page.locator('svg').screenshot({path:out + '/injection-diagram-' + name + '.png'});
      variants.push({name,width:r.width,height:r.height});
    }
  } finally { await renderer.close(); }
  const browser = await chromium.launch();
  const views = [];
  try {
    for (const entry of require('./transfer-sources.cjs')) for (const js of [true,false]) for (const width of [1280,390,320]) {
      const page = await browser.newPage({viewport:{width,height:1000},javaScriptEnabled:js});
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await route(page);
      await page.goto(base + entry.file);
      const injection = page.locator('#injection-channels');
      const alignment = page.locator('#alignment-scope');
      const figure = injection.locator('figure');
      await figure.locator('img').evaluate(e => e.decode());
      assert(await figure.locator('img').evaluate(e => e.naturalWidth === 738 && Math.abs(e.getBoundingClientRect().width-e.naturalWidth)<1));
      await shot(page, figure, 'injection-figure-' + entry.id + '-' + width + '-' + js);
      for (const [name, rows] of [['injection-taxonomy',c.channels], ['injection-outcomes',c.outcomes]]) {
        const table = injection.locator('[data-' + name + ']');
        assert.deepEqual(await table.locator('tbody tr').evaluateAll(rows => rows.map(row => [...row.querySelectorAll('th,td')].map(cell => cell.textContent))), rows);
        assert.deepEqual(await tableBounds(table), []);
        await shot(page, table, name + '-' + entry.id + '-' + width + '-' + js);
        if (width < 500) assert(await table.evaluate(e => e.getBoundingClientRect().width >= 640));
        const owner = table.locator('..');
        if (await owner.evaluate(e => e.scrollWidth > e.clientWidth + 1)) {
          await owner.evaluate(e => e.scrollLeft = e.scrollWidth);
          await shot(page, owner, name + '-right-' + entry.id + '-' + width + '-' + js);
          await owner.evaluate(e => e.scrollLeft = 0);
        }
      }
      for (const region of await injection.locator('[role=region]').all()) {
        if (await region.evaluate(e => e.scrollWidth>e.clientWidth+1)) {
          await region.focus();
          await page.keyboard.press('ArrowRight');
          await page.waitForTimeout(200);
          assert(await region.evaluate(e => e.scrollLeft>0));
        }
      }
      const tabs = alignment.locator('.lk-tabs');
      if (js) for (const [i,button] of (await tabs.locator('.lk-tab').all()).entries()) {
        await button.click();
        assert.equal(await button.getAttribute('aria-selected'), 'true');
        assert(await tabs.locator('.lk-tabpanel').nth(i).isVisible());
        await shot(page,tabs,'alignment-tab-' + i + '-' + entry.id + '-' + width);
        await promptScroll(page,tabs.locator('.lk-tabpanel').nth(i));
      }
      else for (const panel of await tabs.locator('.lk-tabpanel').all()) assert(await panel.isVisible());
      if (!js) await promptScroll(page,alignment);
      for (const name of ['alignment','injection']) {
        const check = page.locator('[data-' + name + '-check]');
        await check.locator('summary').click();
        assert(await check.locator('p').isVisible());
      }
      // Adjacent widget smoke check; these scripts are unchanged byte-for-byte.
      const fgsm = page.locator('[data-fgsm-widget]');
      if (js) {
        await fgsm.locator('#aeAttackBtn').click();
        assert.match(await fgsm.locator('[role=status]').textContent(), /Prediction changed/);
        await fgsm.locator('#aeResetBtn').click();
        assert.equal(await fgsm.locator('#aeAdvClass').textContent(), '—');
        const agent = page.locator('#react-flow');
        await agent.locator('select').selectOption('returned-instruction');
        await agent.locator('[data-agent-next]').click();
        assert.equal(await agent.getAttribute('data-step'), '1');
      } else assert(await fgsm.locator('fieldset').evaluate(e=>e.disabled));
      for (const href of Object.values(c.sources)) assert(await page.locator('a[href="' + href + '"]').count());
      assert.deepEqual(await page.locator('[id]').evaluateAll(es=>es.map(e=>e.id).filter((id,i,ids)=>ids.indexOf(id)!==i)),[]);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1), entry.id+' overflow at '+width);
      assert.deepEqual(errors,[]);
      views.push({file:entry.file,width,js});
      console.log('Injection view passed',entry.id,width,js);
      await page.close();
    }
  } finally { await browser.close(); }
  fs.writeFileSync(out + '/injection-browser-test.json',JSON.stringify({variants,views,nodes:6,edges:5,scope:'Geometry, exact taxonomy/outcomes, font-size preservation, tabs, static checks and adjacent widget smoke tests'},null,2)+'\n');
  console.log('Three native diagram layouts and 12 desktop/mobile JS/no-JS views passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
