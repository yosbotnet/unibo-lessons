'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const c=require('./clinical-reading-content.cjs'),root=path.resolve(__dirname,'../..'),base='http://127.0.0.1:8787/',out='/home/ybc/notes-legacy-review-artifacts';
(async()=>{
 const browser=await chromium.launch(),views=[];
 try{for(const entry of require('./transfer-sources.cjs'))for(const js of [true,false])for(const width of [1280,390,320]){
  const page=await browser.newPage({viewport:{width,height:1000},javaScriptEnabled:js}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route(/^https?:/,r=>r.request().url().startsWith(base)?r.continue():/mermaid.*\.js/.test(r.request().url())?r.fulfill({path:path.join(path.dirname(require.resolve('mermaid')),'mermaid.min.js')}):/highlight\.min\.js/.test(r.request().url())?r.fulfill({path:root+'/dl/assets/highlight.min.js'}):r.abort());
  await page.goto(base+entry.file);await page.locator('.lk-toc a[href="#clinical-evidence"]').click();assert.equal(new URL(page.url()).hash,'#clinical-evidence');
  const host=page.locator('#clinical-evidence');assert(await host.isVisible());
  const ref=await page.locator('#regulation-scope > p').first().evaluate(e=>({size:getComputedStyle(e).fontSize,family:getComputedStyle(e).fontFamily}));
  for(const paper of c.papers){
   const article=host.locator('[data-clinical-paper="'+paper.id+'"]');assert.equal(await article.locator('h4').textContent(),paper.name);
   assert.equal(await article.locator('cite').textContent(),paper.title);assert.equal(await article.locator('a').getAttribute('href'),paper.url);
   assert.deepEqual(await article.locator('p').evaluateAll(es=>es.slice(1).map(e=>e.textContent)),['Evaluation. '+paper.method,'Reading the result. '+paper.finding,'Limits. '+paper.limit]);
   assert((await article.textContent()).includes(paper.access));
   assert.deepEqual(await article.evaluate((e,reference)=>{
    const bad=[];for(const p of e.querySelectorAll('p')){const s=getComputedStyle(p);if(s.fontSize!==reference.size||s.fontFamily!==reference.family)bad.push('Changed typography');}
    const w=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let n;
    while(n=w.nextNode())if(n.textContent.trim()){const r=document.createRange();r.selectNodeContents(n);for(const b of r.getClientRects())if(b.width&&(b.left<0||b.right>innerWidth+1))bad.push(n.textContent);}
    return bad;
   },ref),[]);
   await article.evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));await page.screenshot({path:out+'/clinical-reading-'+paper.id+'-'+entry.id+'-'+width+'-'+js+'.png'});
  }
  const check=host.locator('[data-clinical-check]');await check.locator('summary').click();assert(await check.locator('p').isVisible());
  await check.evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));await page.screenshot({path:out+'/clinical-reading-check-'+entry.id+'-'+width+'-'+js+'.png'});
  for(const target of ['healthcare-evaluation','agent-enforcement','regulation-scope']){await host.locator('a[href="#'+target+'"]').click();assert.equal(new URL(page.url()).hash,'#'+target);assert(await page.locator('#'+target).isVisible());}
  const fgsm=page.locator('[data-fgsm-widget]');
  if(js){await fgsm.locator('#aeAttackBtn').click();assert.match(await fgsm.locator('[role=status]').textContent(),/Prediction changed/);await fgsm.locator('#aeResetBtn').click();assert.equal(await fgsm.locator('#aeAdvClass').textContent(),'—');
   const tabs=page.locator('#governance-implications .lk-tabs');await tabs.locator('.lk-tab').nth(2).click();assert.equal(await tabs.locator('.lk-tab').nth(2).getAttribute('aria-selected'),'true');
   const agent=page.locator('#react-flow');await agent.locator('select').selectOption('returned-instruction');await agent.locator('[data-agent-next]').click();assert.equal(await agent.getAttribute('data-step'),'1');
  }else{assert(await fgsm.locator('fieldset').evaluate(e=>e.disabled));for(const p of await page.locator('#governance-implications .lk-tabpanel').all())assert(await p.isVisible());}
  assert.deepEqual(await page.locator('[id]').evaluateAll(es=>es.map(e=>e.id).filter((id,i,ids)=>ids.indexOf(id)!==i)),[]);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
  views.push({file:entry.file,width,js,font:ref});console.log('Clinical reading view passed',entry.id,width,js);await page.close();
 }}finally{await browser.close();}
 fs.writeFileSync(out+'/clinical-reading-browser-test.json',JSON.stringify({views,papers:4,scope:'Exact content, links, original typography, mobile wrapping, native details and adjacent widget smoke tests'},null,2)+'\n');
 console.log('Four clinical reading entries and 12 desktop/mobile JS/no-JS views passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
