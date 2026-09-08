'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright'),m=require('../../oa/assets/coin-test.js'),c=require('./oa-coin-content.cjs');
const root=path.resolve(__dirname,'../..'),base='http://127.0.0.1:8787/',out='/home/ybc/notes-legacy-review-artifacts';
(async()=>{const browser=await chromium.launch(),views=[];try{
 for(const js of [true,false])for(const width of [1280,390,320]){
  const page=await browser.newPage({viewport:{width,height:1000},javaScriptEnabled:js}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route(/^https?:/,r=>r.request().url().startsWith(base)?r.continue():r.abort());await page.goto(base+c.file);
  const host=page.locator('#w-coin');assert.equal(await host.locator('#cn-k').isDisabled(),!js);assert.equal(await host.locator('#cn-alternative').isDisabled(),!js);
  assert.deepEqual(await page.locator('.coin-math').evaluateAll(es=>es.map(e=>getComputedStyle(e).textTransform)),Array(5).fill('none'));
  const cases=js?m.alternatives.flatMap(a=>Array.from({length:11},(_,k)=>({a,k}))):[{a:'two-sided',k:8}];
  for(const {a,k} of cases){if(js){await host.locator('#cn-alternative').selectOption(a);await host.locator('#cn-k').fill(String(k));}const r=m.evaluate(k,a);
   assert.equal(await host.locator('#cn-out').textContent(),m.summary(r));assert.equal(await host.locator('#cn-k-v').textContent(),String(k));
   assert.deepEqual(await host.locator('[data-coin-bar]').evaluateAll(es=>es.map(e=>e.getAttribute('data-in-pvalue')==='true')),r.included);
   const bars=await host.locator('[data-coin-bar]').evaluateAll(es=>es.map(e=>({height:Number(e.getAttribute('height')),stroke:Number(e.getAttribute('stroke-width'))})));
   bars.forEach((b,j)=>{assert(Math.abs(b.height-r.weights[j]/1024/.25*218)<1e-9);assert.equal(b.stroke,j===k?3:1);});
   assert.deepEqual(await host.locator('tbody tr').evaluateAll(es=>es.map(e=>[...e.children].map(x=>x.textContent))),m.weights(10).map((_,j)=>{const q=m.evaluate(j,a);return [String(j),(q.point/1024).toFixed(6),q.pvalue.toFixed(6),q.reject?'Reject H₀':'Do not reject H₀'];}));
   assert.deepEqual(await host.locator('svg').evaluate(e=>{const bad=[],v=e.viewBox.baseVal;for(const t of e.querySelectorAll('text')){const b=t.getBBox();if(b.x<0||b.y<0||b.x+b.width>v.width+1||b.y+b.height>v.height+1)bad.push(t.textContent);if(getComputedStyle(t).fontSize!=='14px')bad.push('Font shrunk');}return bad;}),[]);
   assert.equal(await page.evaluate(s=>new DOMParser().parseFromString(s,'image/svg+xml').querySelectorAll('parsererror').length,m.svg(r)),0);
   if([1,5,8,9].includes(k))for(const [name,sel] of [['plot','[data-coin-plot]'],['table','[data-coin-rows]']]){
    const region=host.locator(sel);await region.evaluate(e=>{e.scrollLeft=0;e.scrollIntoView({block:'start',behavior:'instant'});});await page.screenshot({path:out+'/oa-coin-'+name+'-'+a+'-'+k+'-'+width+'-'+js+'.png'});
    if(width<700){await region.focus();await page.keyboard.press('ArrowRight');for(let tries=0;tries<30&&!await region.evaluate(e=>e.scrollLeft>0);tries++)await new Promise(r=>setTimeout(r,50));assert(await region.evaluate(e=>e.scrollLeft>0));await region.evaluate(e=>{e.scrollLeft=e.scrollWidth;e.scrollIntoView({block:'start',behavior:'instant'});});await page.screenshot({path:out+'/oa-coin-'+name+'-right-'+a+'-'+k+'-'+width+'-'+js+'.png'});}
   }
  }
  const workflow=page.locator('[data-static-diagram="oa-testing-workflow"]');assert(await workflow.evaluate(e=>e.complete&&e.naturalWidth===374&&e.naturalHeight===489));await workflow.evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));await page.screenshot({path:out+'/oa-coin-workflow-'+width+'-'+js+'.png'});
  for(const sel of ['[data-coin-check]','[data-coin-power]']){const d=page.locator(sel);await d.locator('summary').click();assert(await d.locator('p').isVisible());await d.evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));await page.screenshot({path:out+'/oa-coin-'+(sel.includes('power')?'power':'check')+'-'+width+'-'+js+'.png'});}
  assert.deepEqual(await host.locator('th,td').evaluateAll(es=>{const bad=[];for(const e of es){const b=e.getBoundingClientRect(),r=document.createRange();r.selectNodeContents(e);for(const t of r.getClientRects())if(t.width&&(t.left<b.left-1||t.right>b.right+1))bad.push(e.textContent);}return bad;}),[]);
  if(js){for(const [id,value,output] of [['#hs-bins','16','#hs-out'],['#sk-skew','150','#sk-out'],['#bx-val','9000','#bx-out'],['#ci-n','100','#ci-out']]){const old=await page.locator(output).textContent();await page.locator(id).fill(value);assert.notEqual(await page.locator(output).textContent(),old);}}
  const quiz=page.locator('#quiz details').filter({has:page.locator('summary',{hasText:'re-derive it on the coin example'})});await quiz.locator('summary').click();assert((await quiz.textContent()).includes('Neither rejects at 5%'));
  assert.deepEqual(await page.locator('[id]').evaluateAll(es=>es.map(e=>e.id).filter((v,i,a)=>a.indexOf(v)!==i)),[]);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);views.push({width,js,cases:cases.length});console.log('Coin view passed',width,js,cases.length);await page.close();
 }
 const probe=await browser.newPage();await probe.setContent(fs.readFileSync(c.asset,'utf8'));
 assert.equal(await probe.locator('.node').count(),6);assert.equal(await probe.locator('.flowchart-link').count(),5);
 assert.deepEqual(await probe.locator('.node text').evaluateAll(es=>{const bad=[];for(const t of es){const b=t.getBoundingClientRect(),n=t.closest('.node').getBoundingClientRect();if(b.left<n.left-1||b.right>n.right+1||b.top<n.top-1||b.bottom>n.bottom+1)bad.push(t.textContent);}return bad;}),[]);
 await probe.close();
 }finally{await browser.close();}
 fs.writeFileSync(out+'/oa-coin-browser-test.json',JSON.stringify({views,workflow:{nodes:6,edges:5},scope:'All 33 coin outcomes/alternatives per JS viewport, static fallback, SVG/XML geometry, keyboard scrolling and adjacent widgets'},null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1;});
