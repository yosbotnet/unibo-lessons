const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'../..'),out='/home/ybc/notes-legacy-review-artifacts',base='http://127.0.0.1:8787/',entries=require('./transfer-sources.cjs'),m=require('../../cybersecurity/assets/fgsm-model.js'),view=require('../../cybersecurity/assets/fgsm-view.js'),font=require('./font.cjs');
function equivalent(actual,expected){if(typeof expected==='number'){assert(Number.isFinite(actual)&&Math.abs(actual-expected)<1e-12,`${actual} != ${expected}`);}else if(expected&&typeof expected==='object'){assert.deepEqual(Object.keys(actual),Object.keys(expected));for(const k of Object.keys(expected))equivalent(actual[k],expected[k]);}else assert.equal(actual,expected);}
async function noJsScreenshot(page,host,file){
 // Avoid the failing no-JS requestAnimationFrame-based locator wait, not the
 // stability requirement: compare document geometry before AND after capture.
 await host.evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));
 const geometry=()=>host.evaluate(e=>{const b=e.getBoundingClientRect();return {x:b.x+scrollX,y:b.y+scrollY,width:b.width,height:b.height,viewport:innerWidth};});
 const box=await geometry();assert(box.width>0&&box.height>0);
 for(let i=0;i<3;i++){await page.waitForTimeout(100);assert.deepEqual(await geometry(),box,'No-JS widget must be stable');}
 const clip={x:Math.floor(box.x),y:Math.floor(box.y),width:Math.ceil(box.x+box.width)-Math.floor(box.x),height:Math.ceil(box.y+box.height)-Math.floor(box.y),scale:1};
 const cdp=await page.context().newCDPSession(page);try{const {data}=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,fromSurface:true,clip});const bytes=Buffer.from(data,'base64');assert.equal(bytes.subarray(1,4).toString(),'PNG');assert.equal(bytes.readUInt32BE(16),clip.width);assert.equal(bytes.readUInt32BE(20),clip.height);assert.deepEqual(await geometry(),box,'Capture must not resize or reflow the widget');fs.writeFileSync(file,bytes);}finally{await cdp.detach();}
}
(async()=>{const b=await chromium.launch(),results=[];try{const inspector=await b.newPage();for(const e of entries)for(const js of [true,false])for(const width of [1280,390,320]){
 const p=await b.newPage({viewport:{width,height:1000},javaScriptEnabled:js,hasTouch:true}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route(/^https?:/,r=>r.request().url().startsWith(base)?r.continue():/mermaid.*\.js/.test(r.request().url())?r.fulfill({path:path.join(path.dirname(require.resolve('mermaid')),'mermaid.min.js')}):/highlight\.min\.js/.test(r.request().url())?r.fulfill({path:root+'/dl/assets/highlight.min.js'}):r.abort());
 await p.goto(base+e.file);const host=p.locator('[data-fgsm-widget]'),img=host.locator('img');
 const literature=require('../../cybersecurity/assets/fgsm-evidence.cjs'),table=p.locator('[data-fgsm-literature]');assert.equal(await table.locator('tbody tr').count(),3);
 for(const [i,r] of literature.rows.entries())assert.deepEqual(await table.locator('tbody tr').nth(i).locator('th,td').allTextContents(),[r.dataset+' / '+r.model,r.errorPercent+'%',r.meanScorePercent+'%',String(r.epsilon),r.units]);
 const tableIssues=await table.evaluate(t=>{const issues=[];for(const c of t.querySelectorAll('th,td')){const box=c.getBoundingClientRect(),walker=document.createTreeWalker(c,NodeFilter.SHOW_TEXT);let n;while(n=walker.nextNode()){if(!n.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(n);for(const r of range.getClientRects())if(r.width&&(r.left<box.left-1||r.right>box.right+1||r.top<box.top-1||r.bottom>box.bottom+1))issues.push(c.textContent);}}return issues;});assert.deepEqual(tableIssues,[]);
 const tableRegion=table.locator('..');await tableRegion.screenshot({path:out+'/fgsm-results-'+e.id+'-'+width+'-'+js+'.png'});
 if(await tableRegion.evaluate(e=>e.scrollWidth>e.clientWidth+1)){await tableRegion.focus();await p.keyboard.press('ArrowRight');await p.waitForTimeout(200);assert(await tableRegion.evaluate(e=>e.scrollLeft>0));}
 assert.equal(await (await p.request.get(base+'cybersecurity/assets/fgsm-evidence.cjs')).text(),fs.readFileSync(root+'/cybersecurity/assets/fgsm-evidence.cjs','utf8'));
 if(js)await p.waitForFunction(()=>document.querySelector('[data-fgsm-widget]').dataset.state);
 assert.match(await p.locator('#fgsm-code').textContent(),/lower, upper/);
 async function check(label){await img.evaluate(e=>e.decode());assert(await img.evaluate(e=>e.complete&&e.naturalWidth===332&&Math.abs(e.getBoundingClientRect().width-332)<1));
  const state=js?JSON.parse(await host.getAttribute('data-state')):{p:m.initial,epsilon:.08,shown:true},src=await img.getAttribute('src');
  const actual=src.startsWith('data:')?decodeURIComponent(src.slice(src.indexOf(',')+1)):await (await p.request.get(base+'cybersecurity/assets/diagrams/cyber-fgsm.svg')).text();
  assert.equal(actual,view.render(state.p,state.epsilon,state.shown,font));if(state.shown&&js)equivalent(state.attack,m.attack(state.p,state.epsilon));
  // Inspect SVG geometry separately: do not inject/remove font-bearing SVG DOM
  // into the no-JS course page whose unmodified rendering is being tested.
  const bounds=await inspector.evaluate(async svg=>{const host=document.createElement('div');host.innerHTML=svg;document.body.replaceChildren(host);await document.fonts.ready;const labels=[...host.querySelectorAll('text')].map(t=>({text:t.textContent,b:t.getBBox()})),outside=labels.filter(x=>x.b.x<0||x.b.y<0||x.b.x+x.b.width>332||x.b.y+x.b.height>426).map(x=>x.text),overlaps=[];for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){const a=labels[i].b,b=labels[j].b;if(Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>1&&Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>1)overlaps.push([labels[i].text,labels[j].text]);}return {outside,overlaps};},actual);assert.deepEqual(bounds,{outside:[],overlaps:[]});
  const xml=await p.evaluate(svg=>{const d=new DOMParser().parseFromString(svg,'image/svg+xml');return {errors:d.querySelectorAll('parsererror').length,clean:d.querySelectorAll('[data-clean]').length,candidate:d.querySelectorAll('[data-candidate]').length,budget:d.querySelectorAll('[data-budget]').length};},actual);assert.deepEqual(xml,{errors:0,clean:1,candidate:state.shown?1:0,budget:1});
  const screenshot=out+'/fgsm-'+e.id+'-'+width+'-'+js+'-'+label+'.png';
  if(js)await host.screenshot({path:screenshot});else await noJsScreenshot(p,host,screenshot);
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Page overflow '+e.file+' '+width+' JS='+js);
 }
 await check('initial');
 if(js){
  await host.locator('#aeAttackBtn').click();await check('default');assert.match(await host.locator('[role=status]').textContent(),/Prediction changed/);
  await host.locator('#aeEpsilon').fill('0');await check('zero');assert.match(await host.locator('[role=status]').textContent(),/unchanged/);
  await host.locator('#aeU').fill('0');await host.locator('#aeV').fill('0.9');await host.locator('#aeEpsilon').fill('0.08');await host.locator('#aeAttackBtn').click();await check('clipped');assert.equal(JSON.parse(await host.getAttribute('data-state')).attack.delta.u,0);
  await host.locator('#aeU').fill('0.8');await host.locator('#aeV').fill('0.9');await host.locator('#aeEpsilon').fill('0.01');await host.locator('#aeAttackBtn').click();await check('no-flip');assert.match(await host.locator('[role=status]').textContent(),/unchanged/);
  await host.locator('#aeU').fill('0.5');await host.locator('#aeV').fill('0.2');await host.locator('#aeEpsilon').fill('0.08');await host.locator('#aeAttackBtn').click();await check('zero-horizontal-gradient');assert.equal(JSON.parse(await host.getAttribute('data-state')).attack.q.u,.5);
  await host.locator('#aeV').fill('0.35');await host.locator('#aeAttackBtn').click();await check('boundary-tie');assert.equal(JSON.parse(await host.getAttribute('data-state')).attack.reference,1);
  await host.locator('#aeU').fill('2');await host.locator('#aeAttackBtn').click();assert.match(await host.locator('[role=status]').textContent(),/between 0 and 1/);
  await host.locator('#aeResetBtn').click();await check('reset');assert.equal(await host.locator('#aeAdvClass').textContent(),'—');
  await host.locator('#aeU').focus();await p.keyboard.press('ArrowUp');await p.keyboard.press('Tab');assert.equal(JSON.parse(await host.getAttribute('data-state')).p.u,.31);
  await img.scrollIntoViewIfNeeded();let rect=await img.boundingBox();await p.touchscreen.tap(rect.x+view.px(.7),rect.y+view.py(.3));const touch=JSON.parse(await host.getAttribute('data-state')).p;assert(Math.abs(touch.u-.7)<.005&&Math.abs(touch.v-.3)<.005);await check('touch');
  await img.scrollIntoViewIfNeeded();rect=await img.boundingBox();await p.mouse.move(rect.x+view.px(.5),rect.y+view.py(.5));await p.mouse.down();await p.mouse.move(rect.x+view.px(.8),rect.y+view.py(.7),{steps:4});await p.mouse.up();const drag=JSON.parse(await host.getAttribute('data-state')).p;assert(Math.abs(drag.u-.8)<.005&&Math.abs(drag.v-.7)<.005);await check('drag');
 }else {assert(await host.locator('fieldset').evaluate(e=>e.disabled));for(const control of await host.locator('input,button').all())assert(await control.isDisabled());}
 const region=img.locator('..');if(await region.evaluate(e=>e.scrollWidth>e.clientWidth+1)){await region.focus();await p.keyboard.press('ArrowRight');await p.waitForTimeout(200);assert(await region.evaluate(e=>e.scrollLeft>0));}
 assert.deepEqual(errors,[]);results.push({file:e.file,width,js,errors});await p.close();
 }
 for(const e of entries){const p=await b.newPage({viewport:{width:390,height:1000}});await p.route(/^https?:/,r=>r.request().resourceType()==='fetch'&&r.request().url().endsWith('/cyber-fgsm.svg')?r.abort():r.request().url().startsWith(base)?r.continue():/mermaid.*\.js/.test(r.request().url())?r.fulfill({path:path.join(path.dirname(require.resolve('mermaid')),'mermaid.min.js')}):/highlight\.min\.js/.test(r.request().url())?r.fulfill({path:root+'/dl/assets/highlight.min.js'}):r.abort());await p.goto(base+e.file);const h=p.locator('[data-fgsm-widget]');await p.waitForFunction(()=>document.querySelector('[data-fgsm-widget] [role=status]').textContent.includes('Interactive controls unavailable'));assert(await h.locator('#aeAttackBtn').isDisabled());await h.locator('img').evaluate(e=>e.decode());assert(await h.locator('img').evaluate(e=>e.naturalWidth===332));results.push({file:e.file,width:390,js:true,blockedInitialization:true,staticImagePreserved:true});await p.close();}
 fs.writeFileSync(out+'/fgsm-browser-test.json',JSON.stringify(results,null,2)+'\n');console.log('12 FGSM desktop/mobile JS/no-JS views plus two failed-initialization fallbacks: native SVG, exact model, numeric/keyboard/touch/drag input, zero/clipped/non-flipping steps and reset passed');
 }finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
