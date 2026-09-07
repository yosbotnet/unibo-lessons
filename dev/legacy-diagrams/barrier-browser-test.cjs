const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{names}=require('./barrier-content.cjs');
const root=path.resolve(__dirname,'../..'),base='http://127.0.0.1:8787/',out='/home/ybc/notes-legacy-review-artifacts';
(async()=>{
 const html=fs.readFileSync(root+'/pcd/cap-08-java.html','utf8'),{parse}=await import('../contracts/node_modules/parse5/dist/index.js'),parseErrors=[];
 parse(html,{onParseError:e=>parseErrors.push(e)});assert.deepEqual(parseErrors,[]);
 const tested=JSON.parse(fs.readFileSync(out+'/barrier-java-test.json','utf8'));
 assert.equal(tested.runs.length,3);for(const run of tested.runs)assert.equal(run.trace.length,6);
 const b=await chromium.launch(),results=[];
 try{for(const js of [true,false])for(const width of [1280,390]){
  const p=await b.newPage({viewport:{width,height:1000},javaScriptEnabled:js}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.route(/^https?:/,r=>r.request().url().startsWith(base)?r.continue():/highlight\.min\.js/.test(r.request().url())?r.fulfill({path:root+'/dl/assets/highlight.min.js'}):r.abort());
  await p.goto(base+'pcd/cap-08-java.html');
  assert.deepEqual(await p.locator('[id]').evaluateAll(es=>es.map(e=>e.id).filter((id,i,ids)=>ids.indexOf(id)!==i)),[]);
  assert.deepEqual(await p.locator('path,circle,rect,text,tspan').evaluateAll(es=>es.filter(e=>e.namespaceURI!=='http://www.w3.org/2000/svg').map(e=>e.outerHTML)),[]);
  for(const name of names){
   const source=fs.readFileSync(root+'/pcd/assets/examples/'+name+'.java','utf8'),details=p.locator(`[data-barrier-example="${name}"]`),pre=details.locator('pre');
   await details.locator('summary').click();assert(await pre.isVisible());assert.equal(await pre.textContent(),source);
   const download=await p.request.get(base+'pcd/assets/examples/'+name+'.java');assert(download.ok());assert.equal(await download.text(),source);
   if(width===390&&await pre.evaluate(e=>e.scrollWidth>e.clientWidth)){await pre.focus();await p.keyboard.press('ArrowRight');await p.waitForTimeout(250);assert(await pre.evaluate(e=>e.scrollLeft>0));await pre.evaluate(e=>e.scrollLeft=0);}
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   if(name==='CountDownLatchMonitor')await pre.screenshot({path:out+'/barrier-latch-code-'+width+'-'+js+'.png'});
   await details.locator('summary').click();assert(!(await pre.isVisible()));
  }
  const figure=p.locator('[data-static-diagram="pcd-barrier-generations"]'),region=figure.locator('[role=region]');
  assert(await figure.locator('img').evaluate(i=>i.complete&&i.naturalWidth>0));
  const svg=await p.request.get(base+'pcd/assets/diagrams/pcd-barrier-generations.svg');assert(svg.ok());
  const labels=await p.evaluate(source=>{
   const doc=new DOMParser().parseFromString(source,'image/svg+xml');
   if(doc.querySelector('parsererror'))throw Error('Invalid trace SVG');
   return [...doc.querySelectorAll('.node text')].map(t=>t.textContent.replace(/\s/g,''));
  },await svg.text());
  const translations={'A waits in g':'A attende in g','B completes g':'B completa g g+1 diventa corrente','B waits in g+1':'B attende in g+1','A returns from g':'A ritorna da g','A completes g+1':'A completa g+1','B returns from g+1':'B ritorna da g+1'};
  assert.deepEqual(labels,tested.runs[0].trace.map(event=>translations[event].replace(/\s/g,'')),'Diagram labels follow the actual executed trace');
  await figure.screenshot({path:out+'/pcd-barrier-generations-'+width+'-'+js+'.png'});
  if(width===390&&await region.evaluate(e=>e.scrollWidth>e.clientWidth)){await region.focus();await p.keyboard.press('ArrowRight');await p.waitForTimeout(250);assert(await region.evaluate(e=>e.scrollLeft>0));}
  await p.locator('#s7 h2').scrollIntoViewIfNeeded();await p.screenshot({path:out+'/barrier-section-'+width+'-'+js+'.png'});
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
  results.push({width,js,sources:2,errors});await p.close();
 }
 fs.writeFileSync(out+'/barrier-browser-test.json',JSON.stringify(results,null,2)+'\n');console.log('Barrier/latch sources, downloads, native SVG, markup and four desktop/mobile/JS/no-JS views passed');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
