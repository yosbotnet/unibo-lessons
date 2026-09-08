const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const entries=require('./transfer-sources.cjs'),m=require('./transfer-content.cjs'),root=path.resolve(__dirname,'../..'),out='/home/ybc/notes-legacy-review-artifacts',base='http://127.0.0.1:8787/';
(async()=>{
 const {parse}=await import('../contracts/node_modules/parse5/dist/index.js');for(const e of entries){const html=fs.readFileSync(root+'/'+e.file,'utf8'),errors=[];parse(html,{onParseError:e=>errors.push(e)});assert.deepEqual(errors,[]);assert.equal(m.next(e,html),html);}
 const browser=await chromium.launch(),results=[];
 try{for(const e of entries)for(const js of [true,false])for(const width of [1280,390]){
  const p=await browser.newPage({viewport:{width,height:1000},javaScriptEnabled:js}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route(/^https?:/,r=>r.request().url().startsWith(base)?r.continue():/mermaid.*\.js/.test(r.request().url())?r.fulfill({path:path.join(path.dirname(require.resolve('mermaid')),'mermaid.min.js')}):/highlight\.min\.js/.test(r.request().url())?r.fulfill({path:root+'/dl/assets/highlight.min.js'}):r.abort());
  await p.goto(base+e.file);if(js)await p.waitForFunction(()=>[...document.querySelectorAll('.mermaid')].every(e=>e.querySelector('svg')));
  assert.equal(await p.locator('.error-icon,.error-text').count(),0);
  assert.deepEqual(await p.locator('[id]').evaluateAll(es=>es.map(e=>e.id).filter((id,i,ids)=>ids.indexOf(id)!==i)),[]);
  const fig=p.locator(`[data-static-diagram="${e.id}"]`),img=fig.locator('img');assert(await img.evaluate(e=>e.complete&&e.naturalWidth>0&&Math.abs(e.naturalWidth-e.getBoundingClientRect().width)<1));
  await fig.screenshot({path:out+'/'+e.id+'-'+width+'-'+js+'.png'});
  const region=fig.locator('[role=region]');if(await region.evaluate(e=>e.scrollWidth>e.clientWidth+1)){await region.focus();await p.keyboard.press('ArrowRight');await p.waitForTimeout(200);assert(await region.evaluate(e=>e.scrollLeft>0));}
  const rows=p.locator('[data-transfer-literature] tbody tr');assert.equal(await rows.count(),5);for(const [i,r] of m.model.literature.rows.entries())assert.deepEqual(await rows.nth(i).locator('th,td').allTextContents(),[r.heldOut,r.matchingPercent+'%',r.rmsd.toFixed(2)]);
  assert.equal(await p.locator('[data-transfer-examples] tbody tr').count(),5);
  for(const table of await p.locator('[data-transfer-examples],[data-transfer-literature],[data-attack-comparison]').all()){
   const issues=await table.evaluate(t=>{const out=[];for(const cell of t.querySelectorAll('td,th')){const box=cell.getBoundingClientRect(),walker=document.createTreeWalker(cell,NodeFilter.SHOW_TEXT);let node;while((node=walker.nextNode())){if(!node.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(node);for(const r of range.getClientRects())if(r.width&&(r.left<box.left-1||r.right>box.right+1||r.top<box.top-1||r.bottom>box.bottom+1))out.push(cell.textContent);}}return out;});assert.deepEqual(issues,[],'Text must remain inside its table cell');
  }
  assert.match(await p.locator('#s6').textContent(),/2\/4 \(50.0%\)/);assert.match(await p.locator('#s6').textContent(),/1\/3 \(33.3%\)/);
  for(const name of ['transfer-examples','transfer-literature','attack-comparison']){const table=p.locator(`[data-${name}]`),owner=table.locator('..');await owner.screenshot({path:out+'/'+e.id+'-'+name+'-'+width+'-'+js+'.png'});if(await owner.evaluate(e=>e.scrollWidth>e.clientWidth+1)){await owner.focus();await p.keyboard.press('ArrowRight');await p.waitForTimeout(200);assert(await owner.evaluate(e=>e.scrollLeft>0));}}
  const source=await p.request.get(base+'cybersecurity/assets/transfer-evidence.cjs');assert.equal(await source.text(),fs.readFileSync(root+'/cybersecurity/assets/transfer-evidence.cjs','utf8'));
  if(js){for(const t of await p.locator('.lk-tabs').all())for(const [i,button] of (await t.locator(':scope > .lk-tablist > .lk-tab').all()).entries()){await button.click();assert(await t.locator(':scope > .lk-tabpanel').nth(i).isVisible());}
   await p.locator('#aeAttackBtn').click();assert.notEqual(await p.locator('#aeAdvClass').textContent(),'—');await p.locator('#aeResetBtn').click();assert.equal(await p.locator('#aeAdvClass').textContent(),'—');
   const explorer=p.locator('#react-flow');assert.equal(await explorer.locator('[data-agent-live] h4').textContent(),'Request');await explorer.locator('[data-agent-next]').click();assert.equal(await explorer.locator('[data-agent-live] h4').textContent(),'Proposal');await explorer.locator('[data-agent-reset]').click();assert.equal(await explorer.locator('[data-agent-live] h4').textContent(),'Request');
  }
  for(const detail of await p.locator('#quiz details').all()){await detail.locator('summary').click();for(const paragraph of await detail.locator('p').all())assert(await paragraph.isVisible());}
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Page overflow '+e.file+' '+width+' JS='+js);assert.deepEqual(errors,[]);
  results.push({file:e.file,width,js,errors});await p.close();
 }
 fs.writeFileSync(out+'/transfer-browser-test.json',JSON.stringify(results,null,2)+'\n');console.log('Eight desktop/mobile JS/no-JS transfer views, downloads, tables, native diagrams and existing widget smoke checks passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
