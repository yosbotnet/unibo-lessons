'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const c=require('./security-tools-content.cjs'),root=path.resolve(__dirname,'../..'),base='http://127.0.0.1:8787/',out='/home/ybc/notes-legacy-review-artifacts';
(async()=>{
 const browser=await chromium.launch(),views=[];
 try{for(const entry of require('./transfer-sources.cjs'))for(const js of [true,false])for(const width of [1280,390,320]){
  const page=await browser.newPage({viewport:{width,height:1000},javaScriptEnabled:js}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route(/^https?:/,r=>r.request().url().startsWith(base)?r.continue():/mermaid.*\.js/.test(r.request().url())?r.fulfill({path:path.join(path.dirname(require.resolve('mermaid')),'mermaid.min.js')}):/highlight\.min\.js/.test(r.request().url())?r.fulfill({path:root+'/dl/assets/highlight.min.js'}):r.abort());
  await page.goto(base+entry.file);
  await page.locator('.lk-toc a[href="#security-resources"]').click();assert.equal(new URL(page.url()).hash,'#security-resources');
  const host=page.locator('#security-resources');assert(await host.isVisible());
  const referenceFont=await page.locator('[data-notice-duties] td').first().evaluate(e=>({size:getComputedStyle(e).fontSize,family:getComputedStyle(e).fontFamily}));
  for(const [id,rows] of [['models',c.models],['agents',c.agents]]){
   const table=host.locator('[data-security-tools="'+id+'"]');
   assert.deepEqual(await table.locator('tbody tr').evaluateAll(es=>es.map(e=>({name:e.querySelector('a').textContent,description:e.children[1].textContent,limit:e.children[2].textContent}))),rows.map(({name,description,limit})=>({name,description,limit})));
   assert.deepEqual(await table.evaluate((t,reference)=>{
    const errors=[];for(const cell of t.querySelectorAll('th,td')){
     const box=cell.getBoundingClientRect(),walker=document.createTreeWalker(cell,NodeFilter.SHOW_TEXT);let n;
     const style=getComputedStyle(cell);
     if(style.fontSize!==reference.size||style.fontFamily!==reference.family)errors.push('Font differs from existing chapter tables');
     while(n=walker.nextNode())if(n.textContent.trim()){const r=document.createRange();r.selectNodeContents(n);for(const b of r.getClientRects())if(b.width&&(b.left<box.left-1||b.right>box.right+1||b.top<box.top-1||b.bottom>box.bottom+1))errors.push(n.textContent);}
    }return errors;
   },referenceFont),[]);
   await table.evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));
   await page.screenshot({path:out+'/security-tools-'+id+'-'+entry.id+'-'+width+'-'+js+'.png'});
   const region=table.locator('..');
   if(width===1280)assert(await region.evaluate(e=>e.scrollWidth<=e.clientWidth+1));
   else{
    assert(await region.evaluate(e=>e.scrollWidth>e.clientWidth));await region.focus();await page.keyboard.press('ArrowRight');await page.waitForTimeout(200);assert(await region.evaluate(e=>e.scrollLeft>0));
    await region.evaluate(e=>e.scrollLeft=e.scrollWidth);await page.screenshot({path:out+'/security-tools-'+id+'-right-'+entry.id+'-'+width+'-'+js+'.png'});
    assert(await region.evaluate(e=>Math.abs(e.scrollWidth-e.clientWidth-e.scrollLeft)<2));
   }
  }
  for(const url of Object.values(c.sources))assert(await host.locator('a[href="'+url+'"]').count());
  const check=host.locator('[data-security-tools-check]');await check.locator('summary').click();assert(await check.locator('p').isVisible());
  await check.evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));await page.screenshot({path:out+'/security-tools-check-'+entry.id+'-'+width+'-'+js+'.png'});
  await check.locator('a[href="#agent-enforcement"]').click();assert.equal(new URL(page.url()).hash,'#agent-enforcement');
  const fgsm=page.locator('[data-fgsm-widget]');
  if(js){await fgsm.locator('#aeAttackBtn').click();assert.match(await fgsm.locator('[role=status]').textContent(),/Prediction changed/);await fgsm.locator('#aeResetBtn').click();assert.equal(await fgsm.locator('#aeAdvClass').textContent(),'—');
   const tabs=page.locator('#governance-implications .lk-tabs');await tabs.locator('.lk-tab').nth(2).click();assert.equal(await tabs.locator('.lk-tab').nth(2).getAttribute('aria-selected'),'true');
   const agent=page.locator('#react-flow');await agent.locator('select').selectOption('returned-instruction');await agent.locator('[data-agent-next]').click();assert.equal(await agent.getAttribute('data-step'),'1');
  }else{assert(await fgsm.locator('fieldset').evaluate(e=>e.disabled));for(const panel of await page.locator('#governance-implications .lk-tabpanel').all())assert(await panel.isVisible());}
  assert.deepEqual(await page.locator('[id]').evaluateAll(es=>es.map(e=>e.id).filter((id,i,ids)=>ids.indexOf(id)!==i)),[]);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
  views.push({file:entry.file,width,js,referenceFont});console.log('Security tools view passed',entry.id,width,js);await page.close();
 }}finally{await browser.close();}
 fs.writeFileSync(out+'/security-tools-browser-test.json',JSON.stringify({views,resourceRows:8,tables:2,scope:'Exact text, table layout, mobile keyboard scrolling, links, native details and adjacent widget smoke checks'},null,2)+'\n');
 console.log('Eight resource rows and 12 desktop/mobile JS/no-JS views passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
