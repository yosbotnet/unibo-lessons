const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{names}=require('./forkjoin-content.cjs');
const root=path.resolve(__dirname,'../..'),base='http://127.0.0.1:8787/',out='/home/ybc/notes-legacy-review-artifacts';
(async()=>{
 const html=fs.readFileSync(root+'/pcd/cap-08-java.html','utf8'),{parse}=await import('../contracts/node_modules/parse5/dist/index.js'),parseErrors=[];
 parse(html,{onParseError:e=>parseErrors.push(e)});assert.deepEqual(parseErrors,[]);
 const b=await chromium.launch(),results=[];
 try{for(const js of [true,false])for(const width of [1280,390]){
  const p=await b.newPage({viewport:{width,height:1000},javaScriptEnabled:js}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.route(/^https?:/,r=>r.request().url().startsWith(base)?r.continue():/highlight\.min\.js/.test(r.request().url())?r.fulfill({path:root+'/dl/assets/highlight.min.js'}):r.abort());
  await p.goto(base+'pcd/cap-08-java.html');
  assert.deepEqual(await p.locator('[id]').evaluateAll(es=>es.map(e=>e.id).filter((id,i,ids)=>ids.indexOf(id)!==i)),[]);
  assert.deepEqual(await p.locator('path,circle,rect,text,tspan').evaluateAll(es=>es.filter(e=>e.namespaceURI!=='http://www.w3.org/2000/svg').map(e=>e.outerHTML)),[]);
  for(const name of names){
   const source=fs.readFileSync(root+'/pcd/assets/examples/'+name+'.java','utf8'),details=p.locator(`[data-forkjoin-example="${name}"]`),pre=details.locator('pre');
   await details.locator('summary').focus();await p.keyboard.press('Enter');assert(await pre.isVisible());assert.equal(await pre.textContent(),source);
   const download=await p.request.get(base+'pcd/assets/examples/'+name+'.java');assert(download.ok());assert.equal(await download.text(),source);
   if(width===390&&await pre.evaluate(e=>e.scrollWidth>e.clientWidth)){await pre.focus();await p.keyboard.press('ArrowRight');await p.waitForTimeout(250);assert(await pre.evaluate(e=>e.scrollLeft>0));await pre.evaluate(e=>e.scrollLeft=0);}
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await pre.screenshot({path:out+'/forkjoin-'+name+'-'+width+'-'+js+'.png'});
   await details.locator('summary').click();assert(!(await pre.isVisible()));
  }
  const figure=p.locator('[data-static-diagram="pcd-forkjoin-dependencies"]'),region=figure.locator('[role=region]');
  assert(await figure.locator('img').evaluate(i=>i.complete&&i.naturalWidth>0));
  await figure.screenshot({path:out+'/pcd-forkjoin-dependencies-'+width+'-'+js+'.png'});
  if(width===390&&await region.evaluate(e=>e.scrollWidth>e.clientWidth)){await region.focus();await p.keyboard.press('ArrowRight');await p.waitForTimeout(250);assert(await region.evaluate(e=>e.scrollLeft>0));}
  await p.locator('#s16 h2').scrollIntoViewIfNeeded();await p.screenshot({path:out+'/forkjoin-section-'+width+'-'+js+'.png'});
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
  results.push({width,js,sources:names.length,errors});await p.close();
 }
 fs.writeFileSync(out+'/forkjoin-browser-test.json',JSON.stringify(results,null,2)+'\n');console.log('Fork-Join sources, downloads, native SVG, markup and four desktop/mobile/JS/no-JS views passed');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
