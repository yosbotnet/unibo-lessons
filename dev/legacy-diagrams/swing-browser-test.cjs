const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{names}=require('./swing-content.cjs');
const root=path.resolve(__dirname,'../..'),base='http://127.0.0.1:8787/',out='/home/ybc/notes-legacy-review-artifacts';
(async()=>{
 const html=fs.readFileSync(root+'/pcd/cap-08-java.html','utf8'),{parse}=await import('../contracts/node_modules/parse5/dist/index.js'),parseErrors=[];
 parse(html,{onParseError:e=>parseErrors.push(e)});assert.deepEqual(parseErrors,[]);
 assert(!/setText\(\).*accoda un task/.test(html));
 const b=await chromium.launch(),results=[];
 try{for(const js of [true,false])for(const width of [1280,390]){
  const p=await b.newPage({viewport:{width,height:1000},javaScriptEnabled:js}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.route(/^https?:/,r=>r.request().url().startsWith(base)?r.continue():/highlight\.min\.js/.test(r.request().url())?r.fulfill({path:root+'/dl/assets/highlight.min.js'}):r.abort());
  await p.goto(base+'pcd/cap-08-java.html');
  assert.deepEqual(await p.locator('[id]').evaluateAll(es=>es.map(e=>e.id).filter((id,i,ids)=>ids.indexOf(id)!==i)),[]);
  for(const name of names){
   const source=fs.readFileSync(root+'/pcd/assets/examples/'+name+'.java','utf8'),details=p.locator(`[data-swing-example="${name}"]`),pre=details.locator('pre');
   await details.locator('summary').click();assert(await pre.isVisible());assert.equal(await pre.textContent(),source);
   const download=await p.request.get(base+'pcd/assets/examples/'+name+'.java');assert(download.ok());assert.equal(await download.text(),source);
   if(width===390&&await pre.evaluate(e=>e.scrollWidth>e.clientWidth)){await pre.focus();await p.keyboard.press('ArrowRight');await p.waitForTimeout(250);assert(await pre.evaluate(e=>e.scrollLeft>0));await pre.evaluate(e=>e.scrollLeft=0);}
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Expanded source page overflow');
   if(name==='StopwatchModel')await pre.screenshot({path:out+'/swing-model-'+width+'-'+js+'.png'});
   await details.locator('summary').click();assert(!(await pre.isVisible()));
  }
  if(js){
   const host=p.locator('#ac-cronobug'),lines=host.locator('.lk-ac-line');assert.equal(await lines.count(),7);
   const visible=(await p.locator('#code-cronobug').textContent()).trim().split('\n').slice(1);
   assert.deepEqual(await lines.allTextContents(),visible);
   await lines.nth(4).click();assert.match(await host.locator('.lk-ac-expl').textContent(),/Non equivale a invokeLater/);
   await lines.nth(3).click();assert.match(await host.locator('.lk-ac-expl').textContent(),/accesso breve/);
  }
  const f=p.locator('[data-static-diagram="pcd-swing-refresh"]'),region=f.locator('[role=region]');
  assert(await f.locator('img').evaluate(i=>i.complete&&i.naturalWidth>0));
  await f.screenshot({path:out+'/pcd-swing-refresh-'+width+'-'+js+'.png'});
  if(width===390&&await region.evaluate(e=>e.scrollWidth>e.clientWidth)){await region.focus();await p.keyboard.press('ArrowRight');await p.waitForTimeout(250);assert(await region.evaluate(e=>e.scrollLeft>0));}
  for(const id of ['s12','s13','s14']){await p.locator('#'+id+' h2').scrollIntoViewIfNeeded();await p.screenshot({path:out+'/swing-'+id+'-'+width+'-'+js+'.png'});}
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No page overflow');assert.deepEqual(errors,[]);
  results.push({width,js,canonicalSources:3,annotatedBugLines:js?7:0,errors});await p.close();
 }
 fs.writeFileSync(out+'/swing-browser-test.json',JSON.stringify(results,null,2)+'\n');
 console.log('Swing sources/downloads, corrected annotations, native SVG, HTML5 and four desktop/mobile/JS/no-JS views passed');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
