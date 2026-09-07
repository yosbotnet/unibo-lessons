const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),model=require('./proof-content.cjs');
const root=path.resolve(__dirname,'../..'),base='http://127.0.0.1:8787/',out='/home/ybc/notes-legacy-review-artifacts';
(async()=>{
 const html=fs.readFileSync(root+'/pcd/cap-09-verifica.html','utf8'),{parse}=await import('../contracts/node_modules/parse5/dist/index.js'),parseErrors=[];
 parse(html,{onParseError:e=>parseErrors.push(e)});assert.deepEqual(parseErrors,[]);
 assert(html.includes(model.proof()));assert(html.includes(model.counts()));
 assert(!/un fault e la manifestazione|NASA dopo|sbLocco|in qualsiasi contesto|certificare l'assenza/.test(html));
 const observed=JSON.parse(fs.readFileSync(out+'/proof-count-test.json'));assert.deepEqual(model.evidence(),observed);
 const browser=await chromium.launch(),results=[];
 try{for(const js of [true,false])for(const width of [1280,390,320]){
  const page=await browser.newPage({viewport:{width,height:1000},javaScriptEnabled:js}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route(/^https?:/,r=>r.request().url().startsWith(base)?r.continue():/highlight\.min\.js/.test(r.request().url())?r.fulfill({path:root+'/dl/assets/highlight.min.js'}):r.abort());
  await page.goto(base+'pcd/cap-09-verifica.html');
  assert.deepEqual(await page.locator('[id]').evaluateAll(es=>es.map(e=>e.id).filter((id,i,ids)=>ids.indexOf(id)!==i)),[]);
  for(const type of ['source','output']){
   const details=page.locator(`[data-proof-${type}]`),pre=details.locator('pre');await details.locator('summary').focus();await page.keyboard.press('Enter');assert(await pre.isVisible());
   assert.equal(await pre.textContent(),type==='source'?fs.readFileSync(root+'/pcd/assets/examples/EvenCounter.smt2','utf8'):observed.output+'\n');
   await pre.screenshot({path:out+'/proof-'+type+'-'+width+'-'+js+'.png'});
   if(await pre.evaluate(e=>e.scrollWidth>e.clientWidth+1)){await pre.focus();await page.keyboard.press('ArrowRight');await page.waitForTimeout(150);assert(await pre.evaluate(e=>e.scrollLeft>0));}
   await details.locator('summary').click();assert(!(await pre.isVisible()));
  }
  for(const name of ['EvenCounter.smt2','proof-results.json']){const r=await page.request.get(base+'pcd/assets/examples/'+name);assert(r.ok());assert.equal(await r.text(),fs.readFileSync(root+'/pcd/assets/examples/'+name,'utf8'));}
  assert.equal(await page.locator('[data-proof-command]').textContent(),'z3 -T:10 EvenCounter.smt2');
  assert.deepEqual(await page.locator('[data-proof-obligations] tbody td:last-child').allTextContents(),observed.obligations);
  assert.deepEqual(await page.locator('[data-proof-witnesses] tbody td:first-of-type').allTextContents(),['9 → 11','0 → 3']);
  const countRows=page.locator('[data-schedule-counts] tbody tr');assert.equal(await countRows.count(),observed.counts.length);
  for(const [i,c] of observed.counts.entries()){assert.equal(await countRows.nth(i).locator('th').textContent(),c.lengths.join(', '));assert.equal(await countRows.nth(i).locator('td').textContent(),Number(c.count).toLocaleString('it-IT'));}
  for(const selector of ['[data-fault-taxonomy]','[data-formal-history]','[data-schedule-counts]','[data-proof-witnesses]','[data-proof-obligations]']){
   const table=page.locator(selector);
   const problems=await table.evaluate(t=>{const issues=[];for(const cell of t.querySelectorAll('td,th')){
    const box=cell.getBoundingClientRect(),walker=document.createTreeWalker(cell,NodeFilter.SHOW_TEXT);let n;
    while((n=walker.nextNode())){if(!n.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(n);for(const r of range.getClientRects())if(r.width>0&&(r.left<box.left-1||r.right>box.right+1||r.top<box.top-1||r.bottom>box.bottom+1))issues.push(cell.textContent);}
   }return issues;});assert.deepEqual(problems,[],selector+' text outside its cell');
   await (selector==='[data-proof-obligations]'?table.locator('..'):table).screenshot({path:out+'/proof-table-'+selector.slice(6,-1)+'-'+width+'-'+js+'.png'});
  }
  const region=page.locator('[data-proof-obligations]').locator('..');if(await region.evaluate(e=>e.scrollWidth>e.clientWidth+1)){await region.focus();await page.keyboard.press('ArrowRight');await page.waitForTimeout(150);assert(await region.evaluate(e=>e.scrollLeft>0));}
  await page.locator('#s5').screenshot({path:out+'/proof-section-'+width+'-'+js+'.png'});
  for(const table of await page.locator('table').all())if(await table.isVisible()){
   const owner=table.locator('..');
   assert.equal(await owner.evaluate(e=>getComputedStyle(e).overflowX),'auto');
   if(await owner.evaluate(e=>e.scrollWidth>e.clientWidth+1)){
    assert.equal(await owner.getAttribute('role'),'region');
    await owner.evaluate(e=>e.scrollLeft=0);await owner.focus();await page.keyboard.press('ArrowRight');await page.waitForTimeout(150);assert(await owner.evaluate(e=>e.scrollLeft>0));
   }
  }
  const groups=page.locator('[data-kit=tabs]');assert.equal(await groups.count(),4);
  for(const group of await groups.all())for(const [i,tab] of (await group.locator('.lk-tab').all()).entries()){
   if(js)await tab.click();assert(await group.locator('.lk-tabpanel').nth(i).isVisible());
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Page overflow: ${width}px, JS=${js}`);
  }
  const quiz=page.locator('.lk-quiz details');assert.equal(await quiz.count(),8);
  for(const detail of await quiz.all()){await detail.locator('summary').focus();await page.keyboard.press('Enter');for(const p of await detail.locator('p').all())assert(await p.isVisible());assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await detail.locator('summary').click();}
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
  results.push({width,js,tables:5,sourceDownloads:2,tabGroups:4,quizzes:8,errors});await page.close();
 }
 fs.writeFileSync(out+'/proof-browser-test.json',JSON.stringify(results,null,2)+'\n');console.log('Proof content and downloads, five table layouts, four tab groups and eight quizzes passed in six desktop/mobile JS/no-JS views');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
