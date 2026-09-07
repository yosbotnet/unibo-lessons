const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),model=require('./formal-content.cjs');
const root=path.resolve(__dirname,'../..'),base='http://127.0.0.1:8787/',out='/home/ybc/notes-legacy-review-artifacts';
(async()=>{
 const html=fs.readFileSync(root+'/pcd/cap-09-verifica.html','utf8'),{parse}=await import('../contracts/node_modules/parse5/dist/index.js'),parseErrors=[];
 parse(html,{onParseError:e=>parseErrors.push(e)});assert.deepEqual(parseErrors,[]);
 assert(html.includes(model.dekker()));assert(html.includes(model.peterson()));
 const observed=JSON.parse(fs.readFileSync(out+'/formal-model-test.json'));delete observed.tempDirectory;assert.deepEqual(model.evidence(),observed);
 const browser=await chromium.launch(),results=[];
 try{for(const js of [true,false])for(const width of [1280,390]){
  const page=await browser.newPage({viewport:{width,height:1000},javaScriptEnabled:js}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route(/^https?:/,r=>r.request().url().startsWith(base)?r.continue():/highlight\.min\.js/.test(r.request().url())?r.fulfill({path:root+'/dl/assets/highlight.min.js'}):r.abort());
  await page.goto(base+'pcd/cap-09-verifica.html');
  assert.deepEqual(await page.locator('[id]').evaluateAll(es=>es.map(e=>e.id).filter((id,i,ids)=>ids.indexOf(id)!==i)),[]);
  for(const name of model.names){
   const details=page.locator(`[data-formal-source="${name}"]`),pre=details.locator('pre');
   await details.locator('summary').focus();await page.keyboard.press('Enter');assert(await pre.isVisible());
   const source=fs.readFileSync(root+'/pcd/assets/examples/'+name,'utf8');assert.equal(await pre.textContent(),source);
   const download=await page.request.get(base+'pcd/assets/examples/'+name);assert(download.ok());assert.equal(await download.text(),source);
   await pre.screenshot({path:out+'/formal-'+name+'-'+width+'-'+js+'.png'});
   if(width===390&&await pre.evaluate(e=>e.scrollWidth>e.clientWidth+1)){await pre.focus();await page.keyboard.press('ArrowRight');await page.waitForTimeout(250);assert(await pre.evaluate(e=>e.scrollLeft>0));}
   await details.locator('summary').click();assert(!(await pre.isVisible()));
  }
  const download=await page.request.get(base+'pcd/assets/examples/formal-results.json');assert(download.ok());assert.deepEqual(await download.json(),observed);
  for(const tool of ['SPIN','TLC']){
   const table=page.locator(`[data-formal-results="${tool}"]`),cases=observed.cases.filter(c=>c.tool===tool);assert.equal(await table.locator('tbody tr').count(),cases.length);
   for(const c of cases){const row=table.locator(`[data-formal-case="${c.name}"]`);assert.equal(await row.locator('th').textContent(),model.labels[c.name]);assert.deepEqual(await row.locator('td').allTextContents(),[model.outcomes[c.outcome],String(c.stored??c.distinct??'—')]);}
   await table.locator('..').screenshot({path:out+'/formal-results-'+tool+'-'+width+'-'+js+'.png'});
   if(width===390){const region=table.locator('..');await region.focus();await page.keyboard.press('ArrowRight');await page.waitForTimeout(250);assert(await region.evaluate(e=>e.scrollLeft>0));}
  }
  for(const name of ['dekker','peterson']){
   const pre=page.locator(`[data-formal-command="${name}"]`);await pre.screenshot({path:out+'/formal-commands-'+name+'-'+width+'-'+js+'.png'});
   if(width===390&&await pre.evaluate(e=>e.scrollWidth>e.clientWidth+1)){await pre.focus();await page.keyboard.press('ArrowRight');await page.waitForTimeout(250);assert(await pre.evaluate(e=>e.scrollLeft>0));}
  }
  const negative=page.locator('[data-formal-mutant]');await negative.locator('summary').focus();await page.keyboard.press('Enter');assert(await negative.locator('table').isVisible());
  const rows=negative.locator('tbody tr'),trace=observed.cases.find(c=>c.name==='peterson-mutant').trace;assert.equal(await rows.count(),trace.length);
  for(const [i,s] of trace.entries())assert.deepEqual(await rows.nth(i).locator('td').allTextContents(),[...s.pc,s.flag.map(Number).join(', '),String(s.turn)]);
  await negative.screenshot({path:out+'/formal-mutant-'+width+'-'+js+'.png'});
  if(width===390){const region=negative.locator('[role=region]');await region.focus();await page.keyboard.press('ArrowRight');await page.waitForTimeout(250);assert(await region.evaluate(e=>e.scrollLeft>0));}
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
  results.push({width,js,sources:model.names.length,cases:observed.cases.length,counterexampleStates:trace.length,errors});await page.close();
 }
 fs.writeFileSync(out+'/formal-browser-test.json',JSON.stringify(results,null,2)+'\n');console.log('Formal sources, downloads, recorded results and real mutant trace passed in four desktop/mobile JS/no-JS views');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
