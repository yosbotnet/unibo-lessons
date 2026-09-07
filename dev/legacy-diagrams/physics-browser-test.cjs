const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{names}=require('./physics-content.cjs'),plot=require('./physics-plot.cjs');
const root=path.resolve(__dirname,'../..'),base='http://127.0.0.1:8787/',out='/home/ybc/notes-legacy-review-artifacts';
(async()=>{
 const html=fs.readFileSync(root+'/pcd/cap-08-java.html','utf8'),{parse}=await import('../contracts/node_modules/parse5/dist/index.js'),parseErrors=[];
 parse(html,{onParseError:e=>parseErrors.push(e)});assert.deepEqual(parseErrors,[]);
 const tested=JSON.parse(fs.readFileSync(out+'/physics-java-test.json','utf8'));
 assert.deepEqual(plot.geometry(),tested.trace);assert.equal(plot.render(),plot.render(),'Determinism');
 const b=await chromium.launch(),results=[];
 try{
  const probe=await b.newPage();await probe.setContent(plot.render());await probe.evaluate(()=>document.fonts.ready);
  const bounds=await probe.evaluate(()=>{
   const svg=document.querySelector('svg'),outer=svg.getBoundingClientRect();
   const labels=[...svg.querySelectorAll('text')].map(e=>({text:e.textContent,b:e.getBoundingClientRect()}));
   const outside=labels.filter(({b})=>b.left<outer.left||b.right>outer.right||b.top<outer.top||b.bottom>outer.bottom).map(e=>e.text);
   const overlaps=[];for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){const a=labels[i].b,b=labels[j].b;if(Math.min(a.right,b.right)>Math.max(a.left,b.left)+1&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top)+1)overlaps.push([labels[i].text,labels[j].text]);}
   return {outside,overlaps,xml:new DOMParser().parseFromString(svg.outerHTML,'image/svg+xml').querySelectorAll('parsererror').length};
  });assert.deepEqual(bounds,{outside:[],overlaps:[],xml:0});
  assert.equal(await probe.locator('[data-leg]').count(),2);assert.equal(await probe.locator('[data-position]').count(),3);
  assert.equal(await probe.locator('[data-wall="right"]').getAttribute('d'),'M272 96V336','Full-height physical wall');
  const points=await probe.locator('[data-position]').evaluateAll(es=>es.flatMap(e=>[(+e.getAttribute('cx')-32)/24,(+e.getAttribute('cy')-96)/24]));
  points.forEach((v,i)=>assert(Math.abs(v-tested.trace[i])<1e-12));
  await probe.locator('svg').screenshot({path:out+'/physics-plot-native.png'});await probe.close();
  for(const js of [true,false])for(const width of [1280,390]){
   const p=await b.newPage({viewport:{width,height:1000},javaScriptEnabled:js}),errors=[];
   p.on('pageerror',e=>errors.push(e.message));
   await p.route(/^https?:/,r=>r.request().url().startsWith(base)?r.continue():/highlight\.min\.js/.test(r.request().url())?r.fulfill({path:root+'/dl/assets/highlight.min.js'}):r.abort());
   await p.goto(base+'pcd/cap-08-java.html');
   assert.deepEqual(await p.locator('[id]').evaluateAll(es=>es.map(e=>e.id).filter((id,i,ids)=>ids.indexOf(id)!==i)),[]);
   assert.deepEqual(await p.locator('path,circle,rect,text,tspan').evaluateAll(es=>es.filter(e=>e.namespaceURI!=='http://www.w3.org/2000/svg').map(e=>e.outerHTML)),[]);
   for(const name of names){
    const source=fs.readFileSync(root+'/pcd/assets/examples/'+name+'.java','utf8'),details=p.locator(`[data-physics-example="${name}"]`),pre=details.locator('pre');
    await details.locator('summary').focus();await p.keyboard.press('Enter');assert(await pre.isVisible());assert.equal(await pre.textContent(),source);
    const download=await p.request.get(base+'pcd/assets/examples/'+name+'.java');assert(download.ok());assert.equal(await download.text(),source);
    if(width===390&&await pre.evaluate(e=>e.scrollWidth>e.clientWidth)){await pre.focus();await p.keyboard.press('ArrowRight');await p.waitForTimeout(250);assert(await pre.evaluate(e=>e.scrollLeft>0));await pre.evaluate(e=>e.scrollLeft=0);}
    await pre.screenshot({path:out+'/physics-'+name+'-'+width+'-'+js+'.png'});
    await details.locator('summary').click();assert(!(await pre.isVisible()));
   }
   const figure=p.locator('[data-static-plot="pcd-wall-reflection"]'),region=figure.locator('[role=region]');
   assert(await figure.locator('img').evaluate(i=>i.complete&&i.naturalWidth===332));
   await figure.screenshot({path:out+'/physics-figure-'+width+'-'+js+'.png'});
   if(width===390&&await region.evaluate(e=>e.scrollWidth>e.clientWidth)){await region.focus();await p.keyboard.press('ArrowRight');await p.waitForTimeout(250);assert(await region.evaluate(e=>e.scrollLeft>0));}
   await p.locator('#s15 h2').scrollIntoViewIfNeeded();await p.screenshot({path:out+'/physics-section-'+width+'-'+js+'.png'});
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
   results.push({width,js,sources:names.length,geometry:true,errors});await p.close();
  }
  fs.writeFileSync(out+'/physics-browser-test.json',JSON.stringify(results,null,2)+'\n');console.log('Physics source/downloads, geometric SVG, XML/bounds/labels and four desktop/mobile/JS/no-JS views passed');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
