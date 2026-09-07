const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('../legacy-diagrams/node_modules/playwright');
const {verify,files}=require('./test.cjs');
const root=path.resolve(__dirname,'../..'),out='/home/ybc/notes-legacy-review-artifacts';
const base=process.env.NOTES_PREVIEW_URL||'http://127.0.0.1:8787/';
const mermaid=path.join(path.dirname(require.resolve('mermaid',{paths:[path.join(__dirname,'../legacy-diagrams')]})),'mermaid.min.js');
(async()=>{
 const {parse}=await import('parse5'),parseErrors=[];
 const tree=parse(fs.readFileSync(path.join(root,'ds/DS-C4.html'),'utf8'),{onParseError:e=>parseErrors.push(e),sourceCodeLocationInfo:true});
 assert.deepEqual(parseErrors,[],'HTML5 parse errors');
 // Reject the original failure class: SVG-only shapes escaping into HTML.
 const foreignErrors=[];function walk(n){if(['path','rect','circle','ellipse','tspan','text','line','polyline','polygon','g','marker','defs'].includes(n.tagName)&&n.namespaceURI!=='http://www.w3.org/2000/svg')foreignErrors.push(n.tagName);for(const c of n.childNodes||[])walk(c)}walk(tree);assert.deepEqual(foreignErrors,[]);
 const report=await verify(),browser=await chromium.launch(),results=[];
 try{for(const javaScriptEnabled of [true,false])for(const width of [1280,390]){
  const p=await browser.newPage({viewport:{width,height:1000},javaScriptEnabled}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route(/^https?:/,r=>r.request().url().startsWith(base)?r.continue():/mermaid.*\.js/.test(r.request().url())?r.fulfill({path:mermaid}):/highlight\.min\.js/.test(r.request().url())?r.fulfill({path:root+'/dl/assets/highlight.min.js'}):r.abort());
  await p.goto(new URL('ds/DS-C4.html',base).href);if(javaScriptEnabled)await p.waitForFunction(()=>[...document.querySelectorAll('.mermaid')].every(e=>e.querySelector('svg')));
  assert.equal((await p.locator('#s14 pre code').textContent()).trim(),files['Counter.sol'].trim(),'Rendered highlighted code matches compiled source');
  const rows=await p.locator('#contract-results tbody tr').evaluateAll(rs=>rs.map(r=>[...r.children].map(c=>c.textContent)));
  assert.deepEqual(rows,report.rows.map(r=>[r.label,r.status===1?'1 · success':'0 · failure',r.state,String(r.logs),r.gasUsed+' / '+r.gasLimit,r.feeWei]));
  for(const name of Object.keys(files)){const res=await p.request.get(new URL('ds/assets/examples/'+name,base).href);assert(res.ok());assert.equal(await res.text(),files[name])}
  const figure=p.locator('[data-static-diagram="ds-contract-outcomes"]');assert(await figure.isVisible());assert(await figure.locator('img').evaluate(i=>i.complete&&i.naturalWidth>0));
  assert.equal(await p.locator('#s13 svg ~ :is(text,path,rect,tspan)').count(),0);
  let tabs=0;if(javaScriptEnabled)for(const t of await p.locator('#s12 .lk-tabs,#s15 .lk-tabs').all()){
   const buttons=t.locator('.lk-tab');for(let i=0;i<await buttons.count();i++){await buttons.nth(i).click();assert(await t.locator('.lk-tabpanel').nth(i).isVisible());tabs++}
  }
  for(const id of ['s13','s14','s15'])await p.locator('#'+id).screenshot({path:path.join(out,`contracts-${id}-${width}-${javaScriptEnabled?'js':'nojs'}.png`)});
  if(width===390){for(const region of [figure.locator('[role=region]'),p.locator('#contract-results').locator('..'),p.locator('#s14 pre')]){
   assert(await region.evaluate(e=>e.scrollWidth>e.clientWidth));await region.focus();await p.keyboard.press('ArrowRight');
   await p.waitForTimeout(150);assert(await region.evaluate(e=>e.scrollLeft>0),'Keyboard-accessible horizontal content');
  }}
  const geometry=await p.evaluate(()=>{
   const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);
   return {duplicates:ids.filter((id,i)=>ids.indexOf(id)!==i),pageOverflow:document.documentElement.scrollWidth>innerWidth+1};
  });assert.deepEqual(geometry,{duplicates:[],pageOverflow:false});assert.deepEqual(errors,[]);
  results.push({width,javaScriptEnabled,tabs,codeMatches:true,tableMatches:true,downloadsMatch:true,...geometry,errors});await p.close();
 }
 fs.writeFileSync(path.join(out,'contracts-browser-test.json'),JSON.stringify(results,null,2)+'\n');console.log('4 HTTP desktop/mobile visits: compiled code, actual EVM rows, downloads, tabs, keyboard scrolling, no-JS and page bounds passed');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
