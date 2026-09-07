const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{names}=require('./java-basics-content.cjs');
const root=path.resolve(__dirname,'../..'),base='http://127.0.0.1:8787/',out='/home/ybc/notes-legacy-review-artifacts';
(async()=>{
 const html=fs.readFileSync(root+'/pcd/cap-08-java.html','utf8'),{parse}=await import('../contracts/node_modules/parse5/dist/index.js'),parseErrors=[];
 parse(html,{onParseError:e=>parseErrors.push(e)});assert.deepEqual(parseErrors,[]);
 assert(!/non va mai chiamato|sara minore|ottenuto &lt; 200000|Thread-safe per costruzione: tutti/.test(html));
 const b=await chromium.launch(),results=[];
 try{for(const js of [true,false])for(const width of [1280,390]){
  const p=await b.newPage({viewport:{width,height:1000},javaScriptEnabled:js}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.route(/^https?:/,r=>r.request().url().startsWith(base)?r.continue():/highlight\.min\.js/.test(r.request().url())?r.fulfill({path:root+'/dl/assets/highlight.min.js'}):r.abort());
  await p.goto(base+'pcd/cap-08-java.html');
  assert.deepEqual(await p.locator('[id]').evaluateAll(es=>es.map(e=>e.id).filter((id,i,ids)=>ids.indexOf(id)!==i)),[]);
  for(const name of names){
   const source=fs.readFileSync(root+'/pcd/assets/examples/'+name+'.java','utf8'),details=p.locator(`[data-basics-example="${name}"]`),pre=details.locator('pre');
   await details.locator('summary').click();assert(await pre.isVisible());assert.equal(await pre.textContent(),source);
   const download=await p.request.get(base+'pcd/assets/examples/'+name+'.java');assert(download.ok());assert.equal(await download.text(),source);
   if(width===390&&await pre.evaluate(e=>e.scrollWidth>e.clientWidth)){await pre.focus();await p.keyboard.press('ArrowRight');await p.waitForTimeout(250);assert(await pre.evaluate(e=>e.scrollLeft>0));await pre.evaluate(e=>e.scrollLeft=0);}
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await details.locator('summary').click();
   if(js&&name!=='LockSemanticsDemo'){
    const host=p.locator(name==='ThreadStartDemo'?'#ac-thread':'#ac-bounded'),lines=host.locator('.lk-ac-line');
    assert.deepEqual(await lines.allTextContents(),source.trimEnd().split('\n'));
    const pattern=name==='ThreadStartDemo'?/t\.run\(\)/:/min > max/;
    const i=source.trimEnd().split('\n').findIndex(line=>pattern.test(line));
    await lines.nth(i).click();assert.equal(await lines.nth(i).getAttribute('aria-pressed'),'true');
    assert.match(await host.locator('.lk-ac-expl').textContent(),name==='ThreadStartDemo'?/non avvia t/:/invariante iniziale/);
    const region=host.locator('.lk-ac-code');
    if(width===390){await region.focus();await p.keyboard.press('ArrowRight');await p.waitForTimeout(250);assert(await region.evaluate(e=>e.scrollLeft>0));await region.evaluate(e=>e.scrollLeft=0);}
    await host.screenshot({path:out+'/java-basics-'+name+'-'+width+'.png'});
   }
  }
  const f=p.locator('[data-static-diagram="pcd-thread-start"]'),region=f.locator('[role=region]');
  assert(await f.locator('img').evaluate(i=>i.complete&&i.naturalWidth>0));
  await f.screenshot({path:out+'/pcd-thread-start-'+width+'-'+js+'.png'});
  if(width===390&&await region.evaluate(e=>e.scrollWidth>e.clientWidth)){await region.focus();await p.keyboard.press('ArrowRight');await p.waitForTimeout(250);assert(await region.evaluate(e=>e.scrollLeft>0));}
  for(const id of ['s3','s5','s6']){await p.locator('#'+id+' h2').scrollIntoViewIfNeeded();await p.screenshot({path:out+'/java-basics-'+id+'-'+width+'-'+js+'.png'});}
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
  results.push({width,js,sources:3,sourceDerivedAnnotations:js?2:0,errors});await p.close();
 }
 fs.writeFileSync(out+'/java-basics-browser-test.json',JSON.stringify(results,null,2)+'\n');console.log('Java basics: exact sources/downloads/annotations, SVG, markup and four desktop/mobile/JS/no-JS views passed');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
