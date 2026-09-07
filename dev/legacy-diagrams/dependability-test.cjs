const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),model=require('../../ds/assets/dependability.js'),plot=require('./dependability-plot.cjs');
const root=path.resolve(__dirname,'../..'),out='/home/ybc/notes-legacy-review-artifacts';
function near(a,b){assert(Math.abs(a-b)<1e-10,`${a} != ${b}`)}
near(model.metrics(720,4).nines,Math.log10(181));near(model.metrics(720,4).downtimeHours,8760/181);
near(model.metrics(600,2).availability,600/602);near(model.reliability(600,1800),Math.exp(-3));
for(let n=2;n<=6;n++){const up=10**n-1;assert(model.meetsNines(up,1,n));assert(!model.meetsNines(up-.1,1,n))}
assert.equal(model.metrics(990,1).nines.toFixed(2),'3.00');assert(!model.meetsNines(990,1,3));
for(const c of model.comparison){near(model.metrics(c.mttf,c.mttr).availability,.99);near(model.reliability(c.mttf,0),1)}
for(const [a,b]of [[0,1],[-1,1],[1,0],[NaN,1],[Infinity,1]])assert.throws(()=>model.metrics(a,b));
assert.throws(()=>model.reliability(1,-1));assert.throws(()=>model.meetsNines(1,1,2.5));
(async()=>{const browser=await chromium.launch(),records=[];fs.mkdirSync(out,{recursive:true});
 try{for(const width of [1280,390]){
  const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route(/^https?:/,r=>r.request().url().startsWith('http://127.0.0.1:8787/')?r.continue():/highlight\.min\.js/.test(r.request().url())?r.fulfill({path:root+'/dl/assets/highlight.min.js'}):r.abort());
  await page.goto('http://127.0.0.1:8787/ds/DS-M1.html');
  for(const [up,down]of [[720,4],[990,1],[999,1],[4999.5,.5],[.5,720],[8760,.05]]){
   await page.locator('#mttf-slider').fill(String(up));await page.locator('#mttr-slider').fill(String(down));const m=model.metrics(up,down);
   assert.equal(await page.locator('#avail-out').textContent(),(m.availability*100).toFixed(3));assert.equal(await page.locator('#nines-out').textContent(),m.nines.toFixed(2));assert.equal(await page.locator('#down-out').textContent(),m.downtimeHours.toFixed(2));
   for(let n=2;n<=6;n++)assert.equal(await page.locator(`[data-n="${n}"]`).evaluate(e=>e.classList.contains('on')),model.meetsNines(up,down,n));
  }
  const f=page.locator('[data-static-plot="ds-reliability-comparison"]');assert(await f.locator('img').evaluate(e=>e.complete&&e.naturalWidth===700));
  await f.screenshot({path:path.join(out,'dependability-plot-'+width+'.png')});
  if(width===390){const v=f.locator('[role=region]');await v.focus();await page.keyboard.press('ArrowRight');await page.waitForFunction(e=>e.scrollLeft>0,await v.elementHandle())}
  await page.locator('#mttf-slider').fill('990');await page.locator('#mttr-slider').fill('1');await page.locator('#nines-calc').screenshot({path:path.join(out,'dependability-calc-'+width+'.png')});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);records.push({width,widgetCases:6,errors});await page.close();
 }
 const page=await browser.newPage();await page.route(/^https?:/,r=>r.abort());await page.setContent(plot.render());await page.evaluate(()=>document.fonts.ready);
 const check=await page.evaluate(()=>{
  const svg=document.querySelector('svg'),v=svg.getBoundingClientRect();const outside=[...svg.querySelectorAll('text,path')].filter(e=>{const b=e.getBoundingClientRect();return b.left<v.left-1||b.top<v.top-1||b.right>v.right+1||b.bottom>v.bottom+1}).map(e=>e.outerHTML.slice(0,150));
  const xml=new DOMParser().parseFromString(svg.outerHTML,'image/svg+xml');return {outside,xml:xml.querySelectorAll('parsererror').length,series:[...svg.querySelectorAll('[data-series]')].map(e=>({id:e.dataset.series,points:e.getAttribute('d').slice(1).split('L').map(s=>s.split(' ').map(Number))}))};
 });assert.deepEqual(check.outside,[]);assert.equal(check.xml,0);
 for(const s of check.series){const c=model.comparison.find(c=>c.id===s.id);assert.equal(s.points.length,201);s.points.forEach(([x,y],i)=>{assert(Math.abs(x-(72+(i/40)/5*570))<=.00051);assert(Math.abs(y-(336-model.reliability(c.mttf,i/40)*228))<=.00051)})}
 await page.locator('svg').screenshot({path:path.join(out,'dependability-plot-native.png')});await page.close();
 const nojs=await browser.newPage({javaScriptEnabled:false});await nojs.route(/^https?:/,r=>r.abort());await nojs.goto('file://'+root+'/ds/DS-M1.html');assert.equal(await nojs.locator('#nines-out').textContent(),'2.26');assert.equal(await nojs.locator('#down-out').textContent(),'48.40');assert(await nojs.locator('#mttf-slider').isDisabled());assert(await nojs.locator('#mttr-slider').isDisabled());assert(await nojs.locator('[data-static-plot] img').evaluate(e=>e.complete&&e.naturalWidth===700));await nojs.close();
 fs.writeFileSync(path.join(out,'dependability-test.json'),JSON.stringify({records,samples:402,model:true,noJavaScript:true},null,2));console.log('Dependability model, exact nines thresholds, 402 curve samples, 12 browser cases and no-JS fallback passed');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
