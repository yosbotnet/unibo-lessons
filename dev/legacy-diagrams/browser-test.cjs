const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),entries=require('./sources.cjs');
const root=path.resolve(__dirname,'../..'),out='/home/ybc/notes-legacy-review-artifacts';
const preview=process.env.NOTES_PREVIEW_URL,url=file=>preview?new URL(file,preview).href:'file://'+path.join(root,file);
const fixture=path.join(path.dirname(require.resolve('mermaid')),'mermaid.min.js');
async function show(e){await e.evaluate(e=>{const panels=[];for(let p=e.parentElement;p;p=p.parentElement)if(p.matches('.lk-tabpanel'))panels.unshift(p);for(const p of panels){const t=p.closest('.lk-tabs'),panels=[...t.querySelectorAll('.lk-tabpanel')].filter(x=>x.closest('.lk-tabs')===t),buttons=[...t.querySelectorAll('.lk-tab')].filter(x=>x.closest('.lk-tabs')===t);buttons[panels.indexOf(p)].click()}for(let p=e.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true})}
(async()=>{
 const b=await chromium.launch(),results=[];let current=null;
 try{for(const width of [1280,390])for(const file of [...new Set([...entries.map(e=>e.file),'ds/DS-C4.html'])]){
  current={file,width};console.log(`Checking ${file} at ${width}px`);
  const p=await b.newPage({viewport:{width,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route(/^https?:/,r=>preview&&r.request().url().startsWith(preview)?r.continue():/mermaid.*\.js/.test(r.request().url())?r.fulfill({path:fixture}):/highlight\.min\.js/.test(r.request().url())?r.fulfill({path:root+'/dl/assets/highlight.min.js'}):r.abort());
  await p.goto(url(file));await p.waitForFunction(()=>[...document.querySelectorAll('.mermaid')].every(e=>e.querySelector('svg')));
  assert.equal(await p.locator('.error-icon,.error-text').count(),0,file);
  let scrolls=0;
  for(const e of entries.filter(e=>e.file===file)){
   current.figure=e.id;
   const f=p.locator(`[data-static-diagram="${e.id}"]`);await show(f);
   const status=await f.evaluate(f=>{const img=f.querySelector('img'),v=f.querySelector('[role=region]');return {loaded:img.complete&&img.naturalWidth>0,native:Math.abs(img.getBoundingClientRect().width-img.naturalWidth)<1,scroll:v.scrollWidth>v.clientWidth+1,pageOverflow:document.documentElement.scrollWidth>innerWidth+1}});
   assert(status.loaded&&status.native&&!status.pageOverflow,`${e.id} @ ${width}: ${JSON.stringify(status)}`);
   if(status.scroll){const v=f.locator('[role=region]');await v.focus();await p.keyboard.press('ArrowRight');await p.waitForFunction(el=>el.scrollLeft>0,await v.elementHandle(),{timeout:3000});scrolls++}
   await f.screenshot({path:path.join(out,e.id+'-'+width+'.png')});
  }
  // All tab widgets still switch their panels after replacing diagram children.
  let tabs=0;for(const t of await p.locator('.lk-tabs').all()){const buttons=t.locator(':scope > .lk-tablist > .lk-tab');for(let i=0;i<await buttons.count();i++){await buttons.nth(i).click();assert(await t.locator(':scope > .lk-tabpanel').nth(i).isVisible());tabs++}}
  if(file==='pcd/cap-16-algoritmi-distribuiti.html'){
   const host=p.locator('#step-ricart');await host.getByRole('button',{name:'P1: richiedi CS',exact:true}).click();await host.getByRole('button',{name:'P3: richiedi CS',exact:true}).click();
   for(let i=0;i<20&&await host.locator('[data-ra-queue] button').count();i++)await host.locator('[data-ra-queue] button').last().click();
   assert.match(await host.getByRole('status').textContent(),/In CS: P1\./);assert(await host.getByRole('button',{name:'P3: rilascia CS',exact:true}).isDisabled());
   await host.getByRole('button',{name:'P1: rilascia CS',exact:true}).click();while(await host.locator('[data-ra-queue] button').count())await host.locator('[data-ra-queue] button').first().click();
   assert.match(await host.getByRole('status').textContent(),/In CS: P3\./);await host.screenshot({path:path.join(out,'ricart-widget-'+width+'.png')});
   await host.getByRole('button',{name:'Reimposta',exact:true}).click();assert.match(await host.getByRole('status').textContent(),/Ingressi: nessuno/);
   for(let i=0;i<10;i++){assert(await p.locator('#ra-next').isVisible());await p.locator('#ra-next').click()}assert(!(await p.locator('#ra-next').count()));await p.locator('#ra-reset').click();assert(await p.locator('#ra-next').isVisible());
  }
  if(file==='ds/DS-M1.html'){await p.locator('#mttf-slider').fill('1000');await p.locator('#mttr-slider').fill('10');assert.equal(await p.locator('#mtbf-out').textContent(),'1010.0');assert.equal(await p.locator('#avail-out').textContent(),'99.010')}
  if(file==='ds/DS-C4.html'){assert(await p.locator('#smr-explorer button').count());await p.locator('#smr-explorer button').first().click()}
  assert.deepEqual(errors,[],file);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),file+' page overflow');
  results.push({file,width,figures:entries.filter(e=>e.file===file).length,tabs,scrolls,errors});await p.close();
 }
 // No JavaScript is needed to load the native images, even in initially hidden tabs.
 const p=await b.newPage({javaScriptEnabled:false});await p.route(/^https?:/,r=>preview&&r.request().url().startsWith(preview)?r.continue():r.abort());
 for(const file of new Set(entries.map(e=>e.file))){await p.goto(url(file));assert(await p.locator('[data-static-diagram] img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0)))}
 await p.close();fs.writeFileSync(path.join(out,preview?'browser-http-test.json':'browser-test.json'),JSON.stringify(results,null,2));console.log(`${results.length} desktop/mobile page visits; native images, horizontal keyboard scroll, tabs and affected widgets; ${new Set(entries.map(e=>e.file)).size} pages with JS disabled passed`);
 }catch(error){fs.writeFileSync(path.join(out,'browser-failure.json'),JSON.stringify({current,completed:results,error:String(error)},null,2));throw error}finally{await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
