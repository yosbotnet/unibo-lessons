const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('/home/ybc/hosted/unibo-lessons/dev/node_modules/playwright');
const root=path.resolve(__dirname,'../..'),out='/home/ybc/notes-content-review-artifacts';
const {svg,space}=require('../diagrams/search-space.cjs');
assert.equal(space.total,190);assert.equal(space.goodCount,10);
assert.equal(new Set(space.points.map(p=>p.depth+','+p.trees)).size,190);
const targets=[['bigdata/cap-04-mapreduce.html','#s3'],['pm/cap-13-regole-operative.html','#w-fasi'],['dm/cap-10-hyperparameter-optimization.html','#w-space'],['asmd/index.html','.idx-list'],['dl/cap-01-introduction.html','#s9']];
(async()=>{const browser=await chromium.launch(),page=await browser.newPage(),errors=[];let scrolls=0;page.on('pageerror',e=>errors.push(e.message));await page.route(/^https?:/,r=>/highlight\.min\.js$/.test(r.request().url())?r.fulfill({path:root+'/dl/assets/highlight.min.js',contentType:'application/javascript'}):r.abort());
try{for(const width of [1280,390]){await page.setViewportSize({width,height:1000});
 for(const [file] of targets){await page.goto('file://'+path.join(root,file));await page.evaluate(()=>window.NotesContentLayout?.refresh());assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Page overflow: '+file);
  for(const region of await page.locator('.lk-content-scroll.has-overflow').all()){assert.equal(await region.getAttribute('tabindex'),'0');assert.equal(await region.getAttribute('role'),'region');assert(await region.getAttribute('aria-label'));assert(await region.evaluate(e=>{e.scrollLeft=e.scrollWidth;return e.scrollLeft>0}));scrolls++;}
 }
 await page.goto('file://'+root+'/pm/cap-13-regole-operative.html');assert.equal(await page.locator('#fs-descriptions li').count(),6);const selects=page.locator('#fs-rows select');assert.equal(await selects.count(),6);
 for(let i=0;i<6;i++)await selects.nth(i).selectOption(String((i+1)%6));await page.locator('#fs-check').click();assert.match(await page.locator('#fs-v').textContent(),/0 di 6/);
 for(let i=0;i<6;i++)await selects.nth(i).selectOption(String(i));await page.locator('#fs-check').click();assert.match(await page.locator('#fs-v').textContent(),/Tutte le fasi/);
 const descriptions=await page.locator('#fs-descriptions li').allTextContents();for(let i=0;i<6;i++)assert(descriptions[i].length>60);await page.locator('#w-fasi').screenshot({path:out+'/pm-matching-'+width+'.png'});
 await page.goto('file://'+root+'/dm/cap-10-hyperparameter-optimization.html');assert.equal(await page.locator('.hp-space tbody tr').count(),19);assert.equal(await page.locator('.hp-space button').count(),190);assert.equal(await page.locator('.hp-space button[data-good=true]').count(),10);assert.equal(await page.locator('.hp-space button[tabindex="0"]').count(),1);
 const widgetPoints=await page.locator('.hp-space button').evaluateAll(es=>es.map(e=>[+e.dataset.depth,+e.dataset.trees,e.dataset.good==='true']));const plotPoints=await page.locator('[data-generated-plot] circle').evaluateAll(es=>es.map(e=>[+e.dataset.depth,+e.dataset.trees,e.dataset.good==='true']));assert.deepEqual(widgetPoints.sort(),plotPoints.sort());assert.equal(plotPoints.length,190);
 const rows=await page.locator('.hp-space tbody tr').evaluateAll(es=>es.map(e=>+e.querySelector('th').textContent));assert.deepEqual(rows,space.estimators.toReversed());
 await page.locator('.hp-space [tabindex="0"]').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('.hp-space [aria-pressed=true]').getAttribute('aria-label'),'max_depth=5, n_estimators=12');await page.keyboard.press('ArrowUp');assert.equal(await page.locator('.hp-space [aria-pressed=true]').getAttribute('aria-label'),'max_depth=5, n_estimators=13');
 await page.locator('#w-space-region').check();assert.match(await page.locator('#w-space .lk-step-verdict').textContent(),/10 illustrative good configurations \(5\.3%\)/);assert(!(await page.locator('#w-space').textContent()).includes('&middot;'));
 await page.evaluate(()=>window.NotesContentLayout.refresh());assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Widget interaction overflow');await page.locator('#w-space').screenshot({path:out+'/dm-space-'+width+'.png'});await page.locator('[data-generated-plot]').screenshot({path:out+'/dm-plot-'+width+'.png'});
 const plotErrors=await page.locator('[data-generated-plot]').evaluate(svg=>{const v=svg.viewBox.baseVal;return {xml:!!new DOMParser().parseFromString(svg.outerHTML,'image/svg+xml').querySelector('parsererror'),outside:[...svg.querySelectorAll('text')].filter(e=>{const r=e.getBoundingClientRect(),s=svg.getBoundingClientRect();return r.left<s.left-.1||r.top<s.top-.1||r.right>s.right+.1||r.bottom>s.bottom+.1}).map(e=>e.textContent)}});assert.deepEqual(plotErrors,{xml:false,outside:[]});
 }
 // Native table semantics and existing event listeners survive wrapping/replacement.
 await page.setContent('<body class="lk"><div id="fixture"><table><tbody><tr><th scope="row">key</th><td><button id="cell">value</button></td></tr></tbody></table></div></body>');
 await page.evaluate(()=>{window.clicks=0;document.querySelector('#cell').addEventListener('click',()=>window.clicks++)});await page.addScriptTag({path:path.join(__dirname,'reader.js')});await page.locator('#cell').click();assert.equal(await page.evaluate(()=>window.clicks),1);assert.equal(await page.locator('.lk-content-scroll table th[scope=row]').count(),1);
 await page.evaluate(()=>{document.querySelector('#fixture').innerHTML='<table><tr><td>replacement</td></tr></table>';window.NotesContentLayout.refresh()});assert.equal(await page.locator('.lk-content-scroll').count(),1);assert.equal(await page.locator('.lk-content-scroll .lk-content-scroll').count(),0);
 assert.deepEqual(errors,[]);
}finally{await browser.close()}
console.log(JSON.stringify({scrolls,dmPoints:190,dmHighlighted:10,pmScores:'0/6 and 6/6',widths:[1280,390],failures:[]},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
