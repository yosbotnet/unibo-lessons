const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{name}=require('./structured-content.cjs');
const root=path.resolve(__dirname,'../..'),base='http://127.0.0.1:8787/',out='/home/ybc/notes-legacy-review-artifacts';
(async()=>{
 const html=fs.readFileSync(root+'/pcd/cap-08-java.html','utf8'),{parse}=await import('../contracts/node_modules/parse5/dist/index.js'),parseErrors=[];
 parse(html,{onParseError:e=>parseErrors.push(e)});assert.deepEqual(parseErrors,[]);
 const tested=JSON.parse(fs.readFileSync(out+'/structured-java-test.json','utf8'));
 const source=fs.readFileSync(root+'/pcd/assets/examples/'+name+'.java','utf8');
 const b=await chromium.launch(),results=[];
 try{for(const js of [true,false])for(const width of [1280,390]){
  const p=await b.newPage({viewport:{width,height:1000},javaScriptEnabled:js}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.route(/^https?:/,r=>r.request().url().startsWith(base)?r.continue():/highlight\.min\.js/.test(r.request().url())?r.fulfill({path:root+'/dl/assets/highlight.min.js'}):r.abort());
  await p.goto(base+'pcd/cap-08-java.html');
  assert.deepEqual(await p.locator('[id]').evaluateAll(es=>es.map(e=>e.id).filter((id,i,ids)=>ids.indexOf(id)!==i)),[]);
  assert.deepEqual(await p.locator('path,circle,rect,text,tspan').evaluateAll(es=>es.filter(e=>e.namespaceURI!=='http://www.w3.org/2000/svg').map(e=>e.outerHTML)),[]);
  const details=p.locator(`[data-structured-example="${name}"]`),pre=details.locator('pre');
  await details.locator('summary').focus();await p.keyboard.press('Enter');assert(await pre.isVisible());assert.equal(await pre.textContent(),source);
  const download=await p.request.get(base+'pcd/assets/examples/'+name+'.java');assert(download.ok());assert.equal(await download.text(),source);
  if(width===390&&await pre.evaluate(e=>e.scrollWidth>e.clientWidth)){await pre.focus();await p.keyboard.press('ArrowRight');await p.waitForTimeout(250);assert(await pre.evaluate(e=>e.scrollLeft>0));await pre.evaluate(e=>e.scrollLeft=0);}
  await pre.screenshot({path:out+'/structured-code-'+width+'-'+js+'.png'});
  await details.locator('summary').click();assert(!(await pre.isVisible()));
  const commands=p.getByRole('region',{name:'Comandi per JDK 20',exact:true});
  const commandText=(await commands.textContent()).replace(/\\\n\s*/g,'');
  assert.equal(commandText,'javac --enable-preview --release 20 --add-modules jdk.incubator.concurrent StructuredFetch20.java\njava --enable-preview --add-modules jdk.incubator.concurrent StructuredFetch20');
  if(width===390&&await commands.evaluate(e=>e.scrollWidth>e.clientWidth)){await commands.focus();await p.keyboard.press('ArrowRight');await p.waitForTimeout(250);assert(await commands.evaluate(e=>e.scrollLeft>0));}
  const figure=p.locator('[data-static-diagram="pcd-structured-close"]'),region=figure.locator('[role=region]');
  assert(await figure.locator('img').evaluate(i=>i.complete&&i.naturalWidth>0));
  const svg=await p.request.get(base+'pcd/assets/diagrams/pcd-structured-close.svg');assert(svg.ok());
  const labels=await p.evaluate(source=>{
   const doc=new DOMParser().parseFromString(source,'image/svg+xml');
   if(doc.querySelector('parsererror'))throw Error('Invalid SVG');
   return [...doc.querySelectorAll('.node text')].map(t=>t.textContent.replace(/\s/g,''));
  },await svg.text());
  const translations={'child started':'Task lento avviato','sibling failed':'Altro task fallisce','join returned':'join ritorna','close begins':'close inizia Il task lento è ancora vivo','child released':'Il test rilascia il task lento','child exited':'Il task lento esce','close returned':'close ritorna'};
  assert.deepEqual(labels,tested.trace.map(e=>translations[e].replace(/\s/g,'')),'Diagram follows executed JDK20 trace');
  await figure.screenshot({path:out+'/pcd-structured-close-'+width+'-'+js+'.png'});
  if(width===390&&await region.evaluate(e=>e.scrollWidth>e.clientWidth)){await region.focus();await p.keyboard.press('ArrowRight');await p.waitForTimeout(250);assert(await region.evaluate(e=>e.scrollLeft>0));}
  await p.locator('#structured-concurrency').scrollIntoViewIfNeeded();await p.screenshot({path:out+'/structured-section-'+width+'-'+js+'.png'});
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
  results.push({width,js,source:true,trace:true,errors});await p.close();
 }
 fs.writeFileSync(out+'/structured-browser-test.json',JSON.stringify(results,null,2)+'\n');console.log('JDK20 source, trace-based SVG, markup and four desktop/mobile/JS/no-JS views passed');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
