'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright'),m=require('../../oa/assets/frequency.js');
const root=path.resolve(__dirname,'../..'),base='http://127.0.0.1:8787/',out='/home/ybc/notes-legacy-review-artifacts';
(async()=>{const browser=await chromium.launch(),views=[];
 try{for(const js of [true,false])for(const width of [1280,390,320]){
  const page=await browser.newPage({viewport:{width,height:1000},javaScriptEnabled:js}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  // Block highlighting too: its absence must not stop any chapter widget.
  await page.route(/^https?:/,r=>r.request().url().startsWith(base)?r.continue():r.abort());await page.goto(base+'oa/cap-08-statistics.html');
  const host=page.locator('#w-hist');assert.equal(await host.locator('#hs-bins').isDisabled(),!js);assert.equal(await host.locator('#hs-mode').isDisabled(),!js);
  const cases=js?['scipy','numpy'].flatMap(mode=>[5,10,16].map(k=>({mode,k}))):[{mode:'scipy',k:10}];
  for(const {mode,k} of cases){if(js){await host.locator('#hs-mode').selectOption(mode);await host.locator('#hs-bins').fill(String(k));}
   const r=m.example(k,mode);assert.equal(await host.locator('#hs-out').textContent(),m.summary(r));
   assert.deepEqual(await host.locator('tbody tr').evaluateAll(rows=>rows.map(row=>Number(row.children[1].textContent))),r.counts);
   const heights=await host.locator('rect[data-bin]').evaluateAll(es=>es.map(e=>Number(e.getAttribute('height'))));assert.equal(heights.length,r.counts.length);
   heights.forEach((height,i)=>assert(Math.abs(height-r.counts[i]/Math.max(...r.counts)*224)<1e-9,'Bar height follows count scale'));
   assert.deepEqual(await host.locator('svg').evaluate(e=>{const b=e.viewBox.baseVal,bad=[];for(const t of e.querySelectorAll('text')){const r=t.getBBox();if(r.x<0||r.x+r.width>b.width+1||r.y<0||r.y+r.height>b.height+1)bad.push(t.textContent);if(getComputedStyle(t).fontSize!=='14px')bad.push('Changed font');}return bad;}),[]);
   assert.deepEqual(await host.locator('th,td').evaluateAll(es=>{const bad=[];for(const e of es){const box=e.getBoundingClientRect(),r=document.createRange();r.selectNodeContents(e);for(const t of r.getClientRects())if(t.width&&(t.left<box.left-1||t.right>box.right+1))bad.push(e.textContent);}return bad;}),[]);
   for(const [name,sel] of [['chart','[data-frequency-plot]'],['table','[data-frequency-rows]']]){const region=host.locator(sel);await region.evaluate(e=>{e.scrollLeft=0;e.scrollIntoView({block:'start',behavior:'instant'});});await page.screenshot({path:out+'/oa-frequency-'+name+'-'+mode+'-'+k+'-'+width+'-'+js+'.png'});
    if(width<700){await region.focus();await page.keyboard.press('ArrowRight');for(let n=0;n<30&&!await region.evaluate(e=>e.scrollLeft>0);n++)await new Promise(r=>setTimeout(r,50));assert(await region.evaluate(e=>e.scrollLeft>0));await region.evaluate(e=>{e.scrollLeft=e.scrollWidth;e.scrollIntoView({block:'start',behavior:'instant'});});await page.screenshot({path:out+'/oa-frequency-'+name+'-right-'+mode+'-'+k+'-'+width+'-'+js+'.png'});}
   }
  }
  await page.locator('#s1 figure').evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));await page.screenshot({path:out+'/oa-frequency-taxonomy-'+width+'-'+js+'.png'});
  for(const region of await page.locator('[data-oa-native-table]').all()){await region.evaluate(e=>{e.scrollLeft=e.scrollWidth;e.scrollIntoView({block:'start',behavior:'instant'});});await page.screenshot({path:out+'/oa-frequency-legacy-'+await region.getAttribute('data-oa-native-table')+'-'+width+'-'+js+'.png'});}
  assert.equal(await page.locator('#s1 svg rect').count(),7);assert.equal(await page.locator('#s1 svg path[marker-end]').count(),6);
  if(js)for(const [input,output,value] of [['#sk-skew','#sk-out','150'],['#bx-val','#bx-out','9000'],['#ci-n','#ci-out','100'],['#cn-k','#cn-out','5']]){const old=await page.locator(output).textContent();await page.locator(input).fill(value);assert.notEqual(await page.locator(output).textContent(),old,input);}
  const quiz=page.locator('#quiz details').filter({has:page.locator('summary',{hasText:'What is a frequency distribution'})});await quiz.locator('summary').click();assert((await quiz.textContent()).includes('including discrete counts'));
  assert.deepEqual(await page.locator('[id]').evaluateAll(es=>es.map(e=>e.id).filter((v,i,a)=>a.indexOf(v)!==i)),[]);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
  views.push({width,js,cases});console.log('OA histogram passed',width,js,cases.length,'settings');await page.close();
 }}finally{await browser.close();}
 fs.writeFileSync(out+'/oa-frequency-browser-test.json',JSON.stringify({views,scope:'Chart/table agreement, SVG text bounds, mobile scroll, static no-JS fallback and adjacent widget smoke checks; not validation of all chapter statistics'},null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1;});
