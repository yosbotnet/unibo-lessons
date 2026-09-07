const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),m=require('../../pcd/assets/ltl-traces.cjs'),plot=require('./ltl-content.cjs');
const root=path.resolve(__dirname,'../..'),out='/home/ybc/notes-legacy-review-artifacts',base='http://127.0.0.1:8787/';
(async()=>{
 const html=fs.readFileSync(root+'/pcd/cap-09-verifica.html','utf8'),{parse}=await import('../contracts/node_modules/parse5/dist/index.js'),parseErrors=[];
 parse(html,{onParseError:e=>parseErrors.push(e)});assert.deepEqual(parseErrors,[]);
 assert(html.includes(plot.markup()));assert(html.includes(plot.figure()));
 assert.deepEqual(JSON.parse(fs.readFileSync(out+'/ltl-test.json')).editorialCases,m.results());
 const svg=plot.render();assert.equal(svg,plot.render());
 const browser=await chromium.launch(),results=[];
 try{
  const probe=await browser.newPage();await probe.setContent(svg);await probe.evaluate(()=>document.fonts.ready);
  const layout=await probe.evaluate(()=>{
   const s=document.querySelector('svg'),outer=s.getBoundingClientRect(),texts=[...s.querySelectorAll('text')].map(e=>({text:e.textContent,b:e.getBoundingClientRect()})),overlaps=[];
   for(let i=0;i<texts.length;i++)for(let j=i+1;j<texts.length;j++){const a=texts[i].b,b=texts[j].b;if(Math.min(a.right,b.right)>Math.max(a.left,b.left)+1&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top)+1)overlaps.push([texts[i].text,texts[j].text]);}
   return {xml:new DOMParser().parseFromString(s.outerHTML,'image/svg+xml').querySelectorAll('parsererror').length,overlaps,outside:texts.filter(({b})=>b.left<outer.left||b.right>outer.right||b.top<outer.top||b.bottom>outer.bottom).map(t=>t.text)};
  });assert.deepEqual(layout,{xml:0,overlaps:[],outside:[]});
  for(const [name,t] of Object.entries(m.diagram)){
   const group=probe.locator(`[data-trace="${name}"]`);assert.equal(+(await group.getAttribute('data-loop')),t.loop);
   assert.deepEqual(await group.locator('[data-state]').evaluateAll(es=>es.map(e=>JSON.parse(e.dataset.values))),t.states);
   const labels=await group.locator('text').allTextContents();for(const s of t.states)for(const key of name==='safety'?['p3','q3']:['tryp','p3','q3'])assert(labels.includes(`${key}=${Number(s[key])}`));
  }
  const paths=await probe.locator('[data-transition]').evaluateAll(es=>Object.fromEntries(es.map(e=>[e.dataset.transition,e.getAttribute('d')])));
  assert.deepEqual(paths,{'s0-s1':'M72 104H148','s1-s2':'M184 104H260','r0-r1':'M72 320H148','r1-r2':'M184 320H260','r2-r1':'M278 302V280H166V302'});
  assert.equal(await probe.locator('[marker-end]').count(),5);
  await probe.locator('svg').screenshot({path:out+'/ltl-native.png'});await probe.close();
  for(const js of [true,false])for(const width of [1280,390]){
   const page=await browser.newPage({viewport:{width,height:1000},javaScriptEnabled:js}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route(/^https?:/,r=>r.request().url().startsWith(base)?r.continue():/highlight\.min\.js/.test(r.request().url())?r.fulfill({path:root+'/dl/assets/highlight.min.js'}):r.abort());
   await page.goto(base+'pcd/cap-09-verifica.html');
   const download=await page.request.get(base+'pcd/assets/ltl-traces.cjs');assert(download.ok());assert.equal(await download.text(),fs.readFileSync(root+'/pcd/assets/ltl-traces.cjs','utf8'));
   for(const g of m.groups){
    const table=page.locator(`[data-ltl-group="${g.id}"]`),cs=m.cases.filter(c=>c.group===g.id);assert.equal(await table.locator('tbody tr').count(),cs.length);
    for(const c of cs){
     const row=table.locator(`[data-ltl-case="${c.id}"]`),cells=row.locator('td');
     assert.deepEqual(await cells.nth(0).locator('span').allTextContents(),c.states.map((s,i)=>`${i}: (${g.fields.map(k=>Number(s[k])).join(',')})`));assert.equal(await cells.nth(1).textContent(),String(c.loop));
     for(const [key] of g.columns)assert.equal(await row.locator(`[data-formula="${key}"]`).textContent(),m.evaluate(c,m.formulas[key])[0]?'Vera':'Falsa');
    }
    await table.locator('..').screenshot({path:out+'/ltl-table-'+g.id+'-'+width+'-'+js+'.png'});
    if(width===390){const region=table.locator('..');await region.focus();await page.keyboard.press('ArrowRight');await page.waitForTimeout(250);assert(await region.evaluate(e=>e.scrollLeft>0));}
   }
   const figure=page.locator(`[data-static-plot="${plot.id}"]`);assert(await figure.locator('img').evaluate(i=>i.complete&&i.naturalWidth===332&&i.getBoundingClientRect().width===332));
   await figure.screenshot({path:out+'/ltl-figure-'+width+'-'+js+'.png'});
   const region=figure.locator('[role=region]');if(await region.evaluate(e=>e.scrollWidth>e.clientWidth+1)){await region.focus();await page.keyboard.press('ArrowRight');await page.waitForTimeout(250);assert(await region.evaluate(e=>e.scrollLeft>0));}
   for(const id of ['s2','s3']){await page.locator('#'+id+' h2').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/ltl-'+id+'-'+width+'-'+js+'.png'});}
   const tabs=page.locator('#s2 .lk-tabs');
   for(let i=0;i<3;i++){
    if(js)await tabs.locator('.lk-tab').nth(i).click();
    const panel=tabs.locator('.lk-tabpanel').nth(i);assert(await panel.isVisible());
    await panel.screenshot({path:out+'/ltl-definition-'+i+'-'+width+'-'+js+'.png'});
   }
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
   results.push({width,js,cases:m.cases.length,tables:m.groups.length,diagramStates:6,diagramEdges:5,errors});await page.close();
  }
  fs.writeFileSync(out+'/ltl-browser-test.json',JSON.stringify(results,null,2)+'\n');console.log('LTL exact tables/download, six states/five edges, XML/geometry and four desktop/mobile JS/no-JS views passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
