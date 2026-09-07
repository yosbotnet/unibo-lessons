const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{names}=require('./jpf-content.cjs');
const root=path.resolve(__dirname,'../..'),base='http://127.0.0.1:8787/',out='/home/ybc/notes-legacy-review-artifacts';
(async()=>{
 const html=fs.readFileSync(root+'/pcd/cap-09-verifica.html','utf8'),{parse}=await import('../contracts/node_modules/parse5/dist/index.js'),parseErrors=[];
 parse(html,{onParseError:e=>parseErrors.push(e)});assert.deepEqual(parseErrors,[]);
 const observed=JSON.parse(fs.readFileSync(out+'/jpf-java-test.json','utf8'));
 const recorded=JSON.parse(fs.readFileSync(root+'/pcd/assets/examples/jpf-results.json','utf8'));assert.deepEqual(recorded.cases,observed.cases);
 assert(!html.includes('mermaid.initialize'));assert(!html.includes('mermaid.min.js'));
 const browser=await chromium.launch(),results=[];
 try{for(const js of [true,false])for(const width of [1280,390]){
  const page=await browser.newPage({viewport:{width,height:1000},javaScriptEnabled:js}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route(/^https?:/,r=>r.request().url().startsWith(base)?r.continue():/highlight\.min\.js/.test(r.request().url())?r.fulfill({path:root+'/dl/assets/highlight.min.js'}):r.abort());
  await page.goto(base+'pcd/cap-09-verifica.html');
  assert.deepEqual(await page.locator('[id]').evaluateAll(es=>es.map(e=>e.id).filter((id,i,ids)=>ids.indexOf(id)!==i)),[]);
  assert.deepEqual(await page.locator('path,circle,rect,text,tspan').evaluateAll(es=>es.filter(e=>e.namespaceURI!=='http://www.w3.org/2000/svg').map(e=>e.outerHTML)),[]);
  for(const name of names){
   const source=fs.readFileSync(root+'/pcd/assets/examples/'+name,'utf8'),details=page.locator(`[data-jpf-example="${name}"]`),pre=details.locator('pre');
   await details.locator('summary').focus();await page.keyboard.press('Enter');assert(await pre.isVisible());assert.equal(await pre.textContent(),source);
   const download=await page.request.get(base+'pcd/assets/examples/'+name);assert(download.ok());assert.equal(await download.text(),source);
   await pre.screenshot({path:out+'/jpf-'+name+'-'+width+'-'+js+'.png'});
   await details.locator('summary').click();assert(!(await pre.isVisible()));
  }
  for(const c of observed.cases){const cells=await page.locator(`[data-jpf-case="${c.name}"] td`).allTextContents();assert.equal(+cells[1],c.violations);assert.equal(+cells[2],c.constraints);assert(cells[3].includes(c.outcome==='counterexample'?'Controesempio':c.outcome==='incomplete'?'Non conclusivo':'Ricerca completa'));}
  const evidence=await page.request.get(base+'pcd/assets/examples/jpf-results.json');assert(evidence.ok());assert.deepEqual(await evidence.json(),recorded);
  const figure=page.locator('[data-static-diagram="pcd-jpf-outcomes"]');assert(await figure.locator('img').evaluate(i=>i.complete&&i.naturalWidth>0));
  if(width===1280)assert(await figure.locator('[role=region]').evaluate(e=>e.scrollWidth<=e.clientWidth),'Full diagram visible in desktop column');
  await figure.screenshot({path:out+'/pcd-jpf-outcomes-'+width+'-'+js+'.png'});
  await page.locator('[data-jpf-results]').locator('..').screenshot({path:out+'/jpf-results-'+width+'-'+js+'.png'});
  if(width===390){for(const region of [figure.locator('[role=region]'),page.getByRole('region',{name:'Esiti JPF: scorrimento orizzontale',exact:true})]){
   if(await region.evaluate(e=>e.scrollWidth>e.clientWidth+1)){await region.focus();await page.keyboard.press('ArrowRight');await page.waitForTimeout(250);assert(await region.evaluate(e=>e.scrollLeft>0));}
  }}
  const tabs=page.locator('.lk-tabs');assert.equal(await tabs.count(),4);
  for(let i=0;i<await tabs.count();i++){
   const tab=tabs.nth(i),buttons=tab.locator('.lk-tab'),panels=tab.locator('.lk-tabpanel');
   for(let j=0;j<await buttons.count();j++){
    if(js){await buttons.nth(j).click();assert(await panels.nth(j).isVisible());}
    else assert(await panels.nth(j).isVisible(),'Tab content remains available without JS');
   }
  }
  const quiz=page.locator('.lk-quiz details');assert.equal(await quiz.count(),8);
  for(let i=0;i<await quiz.count();i++){await quiz.nth(i).locator('summary').click();assert(await quiz.nth(i).locator('p').isVisible());}
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
  await page.locator('#s1 h2').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/jpf-definitions-'+width+'-'+js+'.png'});
  results.push({width,js,sources:names.length,cases:observed.cases.length,tabs:4,quiz:8,errors});await page.close();
 }
 fs.writeFileSync(out+'/jpf-browser-test.json',JSON.stringify(results,null,2)+'\n');console.log('JPF code/config/results, markup, native SVG, four tab groups and eight quiz items passed in four views');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
