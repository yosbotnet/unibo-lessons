const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..'),file='pcd/cap-08-java.html',out='/home/ybc/notes-legacy-review-artifacts',base='http://127.0.0.1:8787/';
(async()=>{
 const html=fs.readFileSync(root+'/'+file,'utf8'),{parse}=await import('../contracts/node_modules/parse5/dist/index.js'),parseErrors=[];
 parse(html,{onParseError:e=>parseErrors.push(e)});assert.deepEqual(parseErrors,[]);assert(!/mermaid/.test(html));
 const {rows}=JSON.parse(fs.readFileSync(out+'/executor-java-test.json','utf8'));
 const b=await chromium.launch(),results=[];
 try{for(const js of [true,false])for(const width of [1280,390]){
  const p=await b.newPage({viewport:{width,height:1000},javaScriptEnabled:js}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.route(/^https?:/,r=>r.request().url().startsWith(base)?r.continue():/highlight\.min\.js/.test(r.request().url())?r.fulfill({path:root+'/dl/assets/highlight.min.js'}):r.abort());
  await p.goto(base+file);
  assert.deepEqual(await p.locator('[id]').evaluateAll(es=>es.map(e=>e.id).filter((id,i,ids)=>ids.indexOf(id)!==i)),[]);
  assert.deepEqual(await p.locator('path,circle,rect,text,tspan').evaluateAll(es=>es.filter(e=>e.namespaceURI!=='http://www.w3.org/2000/svg').map(e=>e.outerHTML)),[]);
  for(const name of ['PrimeProducer','ExecutorLifecycleDemo']){
   const source=fs.readFileSync(root+'/pcd/assets/examples/'+name+'.java','utf8'),pre=p.locator(`[data-executor-source="${name}"]`);
   if(name==='ExecutorLifecycleDemo')await p.locator('details').filter({has:pre}).locator('summary').click();
   assert.equal(await pre.textContent(),source);
   const download=await p.request.get(base+'pcd/assets/examples/'+name+'.java');assert(download.ok());assert.equal(await download.text(),source);
   if(width===390&&await pre.evaluate(e=>e.scrollWidth>e.clientWidth)){await pre.focus();await p.keyboard.press('ArrowRight');await p.waitForTimeout(250);assert(await pre.evaluate(e=>e.scrollLeft>0));}
   if(name==='PrimeProducer'){await pre.evaluate(e=>e.scrollLeft=0);await pre.screenshot({path:out+'/executor-primes-'+width+'-'+js+'.png'});}
   if(name==='ExecutorLifecycleDemo')await p.locator('details').filter({has:pre}).locator('summary').click();
  }
  const table=p.locator('#executor-observations');
  assert.deepEqual(await table.locator('tbody tr').evaluateAll(es=>es.map(e=>[...e.children].map(c=>c.textContent))),rows.map(r=>[0,1,3,4,7].map(j=>r[j]).map(x=>x==='true'?'sì':x==='false'?'no':x)));
  if(width===1280)assert(await table.evaluate(e=>e.scrollWidth<=e.parentElement.clientWidth),'Observation table fits desktop');
  const tableRegion=table.locator('..');await tableRegion.screenshot({path:out+'/executor-observations-'+width+'-'+js+'.png'});
  if(width===390){await tableRegion.focus();await p.keyboard.press('ArrowRight');await p.waitForTimeout(250);assert(await tableRegion.evaluate(e=>e.scrollLeft>0));}
  const existingTables=p.locator('table:not(#executor-observations)');assert.equal(await existingTables.count(),3);
  for(const [i,t]of (await existingTables.all()).entries()){
   const region=t.locator('..');assert.equal(await region.getAttribute('role'),'region');assert.equal(await region.getAttribute('tabindex'),'0');
   await region.screenshot({path:out+'/executor-table-'+i+'-'+width+'-'+js+'.png'});
   if(width===390&&await region.evaluate(e=>e.scrollWidth>e.clientWidth)){await region.focus();await p.keyboard.press('ArrowRight');await p.waitForTimeout(250);assert(await region.evaluate(e=>e.scrollLeft>0));}
  }
  let tabs=0;for(const t of await p.locator('.lk-tabs').all()){
   const panels=await t.locator('.lk-tabpanel').all();
   if(js)for(const [i,button]of (await t.locator('.lk-tab').all()).entries()){await button.click();for(const [j,panel]of panels.entries())assert.equal(await panel.isVisible(),i===j);tabs++}
   else for(const panel of panels)assert(await panel.isVisible());
  }
  let annotations=0;
  if(js){
   for(const host of await p.locator('.lk-acode').all()){
    const line=host.locator('.lk-ac-line').first();await line.click();assert.equal(await line.getAttribute('aria-pressed'),'true');assert((await host.locator('.lk-ac-expl').textContent()).trim().length>0);annotations++;
   }
   assert.equal(annotations,5,'All five existing annotated-code widgets initialized');
   assert(tabs>0,'Existing tab widgets initialized');
   const step=p.locator('.lk-step');assert.equal(await step.count(),1);
   const buttons=step.locator('.lk-step-btns button');
   // Serial schedule: both increments by P, then both by Q.
   for(const process of [0,1])for(let i=0;i<6;i++)await buttons.nth(process).click();
   assert.match(await step.locator('.lk-step-verdict').textContent(),/nessun lost update.*4/);
   await step.getByRole('button',{name:'Reset',exact:true}).click();
   // Both first reads precede either first write: one update is lost.
   for(const process of [0,1,0,0,1,1,0,0,0,1,1,1])await buttons.nth(process).click();
   assert.match(await step.locator('.lk-step-verdict').textContent(),/Lost update! count = 3/);
   await step.getByRole('button',{name:'Reset',exact:true}).click();
  }
  for(const d of await p.locator('.lk-quiz details').all()){await d.locator('summary').click();for(const paragraph of await d.locator('p').all())assert(await paragraph.isVisible());}
  const figure=p.locator('[data-static-diagram="pcd-executor-types"]');
  assert(await figure.locator('img').evaluate(i=>i.complete&&i.naturalWidth===478));
  await figure.screenshot({path:out+'/pcd-executor-types-'+width+'-'+js+'.png'});
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`No page overflow: ${width}px, JS ${js}`);assert.deepEqual(errors,[]);
  results.push({width,js,tabs,annotations,sourceDownloads:2,observations:4,errors});await p.close();
 }
 fs.writeFileSync(out+'/executor-browser-test.json',JSON.stringify(results,null,2)+'\n');
 console.log('Executor sources, observed rows, widgets, HTML5 and four desktop/mobile/JS/no-JS views passed');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
