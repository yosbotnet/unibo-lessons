'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{chromium}=require('playwright');
const c=require('./threat-content.cjs'),root=path.resolve(__dirname,'../..'),base='http://127.0.0.1:8787/',out='/home/ybc/notes-legacy-review-artifacts';
(async()=>{
 const browser=await chromium.launch(),views=[];
 try{for(const entry of require('./transfer-sources.cjs'))for(const js of [true,false])for(const width of [1280,390,320]){
  console.log('Checking threat view',entry.id,width,js);
  const page=await browser.newPage({viewport:{width,height:1000},javaScriptEnabled:js}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route(/^https?:/,r=>r.request().url().startsWith(base)?r.continue():/mermaid.*\.js/.test(r.request().url())?r.fulfill({path:path.join(path.dirname(require.resolve('mermaid')),'mermaid.min.js')}):/highlight\.min\.js/.test(r.request().url())?r.fulfill({path:root+'/dl/assets/highlight.min.js'}):r.abort());
  await page.goto(base+entry.file);await page.evaluate(()=>document.fonts.ready);
  // Capture viewport slices: the mobile overview can exceed the viewport height.
  // Keep its real layout and typography; do not resize or hide overflowing text.
  await page.locator('.lk-overview').evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));
  await page.screenshot({path:out+'/threat-overview-'+entry.id+'-'+width+'-'+js+'.png'});
  await page.locator('.lk-overview').evaluate(e=>e.scrollIntoView({block:'end',behavior:'instant'}));
  await page.screenshot({path:out+'/threat-overview-end-'+entry.id+'-'+width+'-'+js+'.png'});
  for(const id of ['s3','s4','s5','s6','s7']){
   const a=page.locator('.lk-toc a[href="#'+id+'"]');assert.equal(await a.textContent(),(await page.locator('#'+id+' h2').textContent()).replace(/^\d+\. /,''));
   await a.click();assert.equal(new URL(page.url()).hash,'#'+id);
  }
  const host=page.locator('#s3'),ref=await page.locator('#regulation-scope table td').first().evaluate(e=>({size:getComputedStyle(e).fontSize,family:getComputedStyle(e).fontFamily}));
  for(const [id,rows] of [['knowledge',c.knowledge],['methods',c.methods]]){
   const region=host.locator('[data-threat-table="'+id+'"]');
   assert.deepEqual(await region.locator('tbody tr').evaluateAll(es=>es.map(e=>[...e.children].map(c=>c.textContent))),rows);
   assert.deepEqual(await region.locator('td').first().evaluate(e=>({size:getComputedStyle(e).fontSize,family:getComputedStyle(e).fontFamily})),ref);
   assert.deepEqual(await region.locator('th,td,caption').evaluateAll(es=>{
    const bad=[];for(const e of es){const box=e.getBoundingClientRect(),w=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let n;
     while(n=w.nextNode())if(n.textContent.trim()){const r=document.createRange();r.selectNodeContents(n);for(const b of r.getClientRects())if(b.width&&(b.left<box.left-1||b.right>box.right+1||b.top<box.top-1||b.bottom>box.bottom+1))bad.push(n.textContent);}
    }return bad;
   }),[]);
   await region.evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));await page.screenshot({path:out+'/threat-'+id+'-'+entry.id+'-'+width+'-'+js+'.png'});
   if(width<700){await region.focus();await page.keyboard.press('ArrowRight');
    // Poll from Node: requestAnimationFrame polling can stall with page JS disabled.
    for(let tries=0;tries<30&&!await region.evaluate(e=>e.scrollLeft>0);tries++)await new Promise(resolve=>setTimeout(resolve,100));
    assert(await region.evaluate(e=>document.activeElement===e&&e.scrollLeft>0),'Keyboard scroll must move the focused region');
    await region.evaluate(e=>{e.scrollLeft=e.scrollWidth;e.scrollIntoView({block:'start',behavior:'instant'});});
    assert(await region.evaluate(e=>{const b=e.getBoundingClientRect();return e.scrollLeft>0&&b.top>=-1&&b.top<innerHeight&&b.bottom>0;}));
    await page.screenshot({path:out+'/threat-'+id+'-right-'+entry.id+'-'+width+'-'+js+'.png'});await region.evaluate(e=>{e.scrollLeft=0;});
   }
  }
  const check=host.locator('[data-threat-check]');await check.locator('summary').click();assert(await check.locator('p').isVisible());
  assert.equal(await check.locator('li').count(),3);await check.evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));await page.screenshot({path:out+'/threat-check-'+entry.id+'-'+width+'-'+js+'.png'});
  assert.deepEqual(await host.evaluate(e=>{
   const bad=[],w=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode())if(n.textContent.trim()&&!n.parentElement.closest('[data-threat-table]')){
    const r=document.createRange();r.selectNodeContents(n);for(const b of r.getClientRects())if(b.width&&(b.left<0||b.right>innerWidth+1))bad.push(n.textContent);
   }return bad;
  }),[]);
  for(const a of await host.locator('a[href^="#"]').all()){const target=await a.getAttribute('href');await a.click();assert.equal(new URL(page.url()).hash,target);assert.equal(await page.locator(target).count(),1);}
  const fgsm=page.locator('[data-fgsm-widget]');if(js){
   await fgsm.locator('#aeAttackBtn').click();assert.match(await fgsm.locator('[role=status]').textContent(),/Prediction changed/);await fgsm.locator('#aeResetBtn').click();assert.equal(await fgsm.locator('#aeAdvClass').textContent(),'—');
   const agent=page.locator('#react-flow');await agent.locator('select').selectOption('returned-instruction');await agent.locator('[data-agent-next]').click();assert.equal(await agent.getAttribute('data-step'),'1');
   const tabs=page.locator('#governance-implications .lk-tabs');await tabs.locator('.lk-tab').nth(2).click();assert.equal(await tabs.locator('.lk-tab').nth(2).getAttribute('aria-selected'),'true');
  }else{assert(await fgsm.locator('fieldset').evaluate(e=>e.disabled));for(const panel of await page.locator('#governance-implications .lk-tabpanel').all())assert(await panel.isVisible());}
  assert.deepEqual(await page.locator('[id]').evaluateAll(es=>es.map(e=>e.id).filter((id,i,ids)=>ids.indexOf(id)!==i)),[]);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
  views.push({file:entry.file,width,js,font:ref});console.log('Threat view passed',entry.id,width,js);await page.close();
 }}finally{await browser.close();}
 fs.writeFileSync(out+'/threat-browser-test.json',JSON.stringify({testSha256:crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),views,scope:'Native table geometry and horizontal access, unchanged typography, TOC/local links, details and adjacent widget smoke checks'},null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1;});
