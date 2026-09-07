const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {Model,scenarios,trace,actionLabel,status}=require('../../pcd/assets/dining-philosophers.js');
const out='/home/ybc/notes-legacy-review-artifacts',root=path.resolve(__dirname,'../..');
// Independent oracle: derive held resources and enabled instructions directly
// from program counters, without calling Model.program/enabled/waits/cycles.
function oracle(m){const owners=Array(m.n).fill(null),next=Array(m.n).fill(null),ticket=m.mode==='ticket',admitted=m.pc.map(p=>ticket&&p>=2);
 for(let i=0;i<m.n;i++){let a=i,b=(i+1)%m.n;if(m.mode==='ordered'&&a>b)[a,b]=[b,a];const p=m.pc[i]-(ticket?1:0),held=p===2?[a]:p===3||p===4?[a,b]:p===5?[b]:[];for(const f of held){assert.equal(owners[f],null,'Exclusive ownership');owners[f]=i}next[i]=p===1?a:p===2?b:null}
 const enabled=m.pc.map((p,i)=>next[i]!==null?owners[next[i]]===null:ticket&&p===1?admitted.filter(Boolean).length<m.n-1:true);
 const reach=Array.from({length:m.n},()=>Array(m.n).fill(false));for(let i=0;i<m.n;i++)if(next[i]!==null&&owners[next[i]]!==null)reach[i][owners[next[i]]]=true;
 for(let k=0;k<m.n;k++)for(let i=0;i<m.n;i++)for(let j=0;j<m.n;j++)reach[i][j]||=reach[i][k]&&reach[k][j];
 return {owners,admitted,enabled,cycleMembers:reach.flatMap((row,i)=>row[i]?[i]:[])};
}
const results=[];
for(const mode of ['naive','ticket','ordered'])for(let n=2;n<=5;n++){
 const start=new Model(mode,n),seen=new Set([start.key()]),queue=[start];let transitions=0,deadlocks=0;
 for(let index=0;index<queue.length;index++){const m=queue[index],o=oracle(m);assert.deepEqual(m.owner,o.owners);assert.deepEqual(m.admitted,o.admitted);assert.deepEqual(m.pc.map((_,i)=>m.enabled(i)),o.enabled);assert.deepEqual([...new Set(m.cycles().flat())].sort((a,b)=>a-b),o.cycleMembers);assert.equal(m.cycles().length>0,!o.enabled.some(Boolean),'For this ring, a wait cycle blocks the whole system');
  if(!o.enabled.some(Boolean))deadlocks++;
  for(let i=0;i<n;i++){const c=m.clone();if(!o.enabled[i]){assert.throws(()=>c.step(i));assert.equal(c.key(),m.key());continue}c.step(i);transitions++;if(!seen.has(c.key())){seen.add(c.key());queue.push(c)}}
 }
 assert.equal(deadlocks,mode==='naive'?1:0);results.push({mode,n,states:seen.size,transitions,deadlocks});console.log(JSON.stringify(results.at(-1)));
}
const cycle=trace(scenarios[0]).model,occupied=trace(scenarios[1]).model;assert.equal(cycle.runnable().length,0);assert(occupied.owner.every(p=>p!==null));assert.deepEqual(occupied.runnable(),[0,1,2,3]);assert.equal(occupied.cycles().length,0);occupied.step(0);assert.equal(occupied.meals[0],1);occupied.step(0);assert(occupied.enabled(4),'A released fork unblocks its waiting neighbor');
for(const mode of ['ticket','ordered']){const m=trace(scenarios.find(s=>s.mode===mode)).model;for(let i=0;i<4;i++)m.step(3);assert.equal(m.meals[3],1);assert(m.runnable().length)}
for(const spec of [['other',5],['naive',1],['ticket',2.5]])assert.throws(()=>new Model(...spec));for(const i of [-1,5,NaN,'0'])assert.throws(()=>new Model().step(i));
// Repeatable unfair schedule: F4 awaits f0 while F0 repeatedly completes meals.
const unfair=new Model('ordered');unfair.step(0);unfair.step(0);unfair.step(4);const key=unfair.key();for(let r=0;r<10;r++){for(let i=0;i<6;i++)unfair.step(0);assert.equal(unfair.key(),key)}assert.equal(unfair.meals[4],0);assert.equal(unfair.meals[0],10);
const html=fs.readFileSync(root+'/pcd/cap-06-deadlock.html','utf8');assert(html.includes(require('./dining-traces.cjs').markup()));assert(!/class="mermaid"|mermaid.*\.js/.test(html));
async function browser(){const {chromium}=require('playwright'),b=await chromium.launch(),views=[],base='http://127.0.0.1:8787/';try{
 const {parse}=await import('../contracts/node_modules/parse5/dist/index.js'),parseErrors=[];parse(html,{onParseError:e=>parseErrors.push(e)});assert.deepEqual(parseErrors,[]);
 for(const js of [true,false])for(const width of [1280,390]){const p=await b.newPage({viewport:{width,height:1000},javaScriptEnabled:js}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route(/^https?:/,r=>r.request().url().startsWith(base)?r.continue():/highlight\.min\.js/.test(r.request().url())?r.fulfill({path:root+'/dl/assets/highlight.min.js'}):r.abort());await p.goto(base+'pcd/cap-06-deadlock.html');
  assert.deepEqual(await p.locator('[id]').evaluateAll(es=>es.map(e=>e.id).filter((id,i,ids)=>ids.indexOf(id)!==i)),[]);assert(await p.locator('[data-static-diagram] img').evaluateAll(es=>es.length===1&&es.every(i=>i.complete&&i.naturalWidth>0)));
  assert.deepEqual(await p.locator('path,circle,line,text,tspan').evaluateAll(es=>es.filter(e=>e.namespaceURI!=='http://www.w3.org/2000/svg').map(e=>e.outerHTML)),[],'No leaked SVG elements');
  assert.deepEqual(await p.locator('figure svg').evaluate(svg=>{const texts=[...svg.querySelectorAll('text')],bounds=svg.getBoundingClientRect(),bad=[];for(const t of texts){const r=t.getBoundingClientRect();if(r.left<bounds.left||r.top<bounds.top||r.right>bounds.right||r.bottom>bounds.bottom)bad.push(t.textContent)}for(let i=0;i<texts.length;i++)for(let j=i+1;j<texts.length;j++){const a=texts[i].getBoundingClientRect(),b=texts[j].getBoundingClientRect();if(Math.min(a.right,b.right)>Math.max(a.left,b.left)&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top))bad.push(texts[i].textContent+'/'+texts[j].textContent)}return bad}),[],'Dining-table labels stay inside the SVG and do not overlap');
  if(!js)for(const panel of await p.locator('.lk-tabpanel').all())assert(await panel.isVisible(),'Code and prose remain visible without JavaScript');
  if(js){const h=p.locator('#dining-model');for(let round=0;round<2;round++)for(let i=0;i<5;i++)await h.locator('[data-dining-action="step-'+i+'"]').click();assert.equal(await h.getByRole('status').textContent(),status(cycle));assert(await h.getByRole('status').evaluate(e=>document.activeElement===e),'Focus moves to verdict when the last executed instruction blocks');}
  if(js){const h=p.locator('#dining-model');for(const s of scenarios){await h.locator('[data-dining-action="example-'+s.id+'"]').click();const m=trace(s).model;assert.equal(await h.getByRole('status').textContent(),status(m));assert.deepEqual(await h.locator('[data-dining-rows] tr').evaluateAll(es=>es.map(e=>[...e.children].map(c=>c.textContent))),m.pc.map((_,i)=>{const w=m.waits().find(e=>e.from===i);return ['F'+i,m.owner.flatMap((p,f)=>p===i?['f'+f]:[]).join(', ')||'—',actionLabel(m,i),w?'f'+w.fork+' detenuta da F'+w.to:!m.enabled(i)?'ticket esauriti':'—',String(m.meals[i])]}));for(let i=0;i<5;i++)assert.equal(await h.locator('[data-dining-action="step-'+i+'"]').isDisabled(),!m.enabled(i));await h.screenshot({path:out+'/dining-'+s.id+'-'+width+'.png'})}
   await h.locator('[data-dining-action="example-occupied"]').click();await h.locator('[data-dining-action="step-0"]').click();await h.locator('[data-dining-action="step-0"]').click();assert(!(await h.locator('[data-dining-action="step-4"]').isDisabled()));await h.locator('#dining-mode').selectOption('ticket');assert.equal(await p.evaluate(()=>document.activeElement.id),'dining-mode');assert.match(await h.getByRole('status').textContent(),/Nessun deadlock/);await h.locator('[data-dining-action="reset"]').click();
   for(const tabs of await p.locator('.lk-tabs').all())for(const [i,button]of (await tabs.locator('.lk-tab').all()).entries()){await button.click();assert(await tabs.locator('.lk-tabpanel').nth(i).isVisible())}
  }
  for(const s of scenarios){const d=p.locator('[data-dining-trace="'+s.id+'"]');await d.locator('summary').click();assert.equal(await d.locator('[data-dining-result]').textContent(),status(trace(s).model));assert(await d.locator('table').first().isVisible());if(s.id==='occupied')await d.screenshot({path:out+'/dining-trace-'+width+'-'+js+'.png'})}
  if(width===390){const region=p.locator('[data-dining-trace="occupied"] [role=region]').first();await region.focus();await p.keyboard.press('ArrowRight');await p.waitForTimeout(300);assert(await region.evaluate(e=>e.scrollLeft>0),'Native keyboard scroll also works with page JavaScript disabled');}
  await p.locator('figure').first().screenshot({path:out+'/dining-table-'+width+'-'+js+'.png'});await p.locator('[data-static-diagram]').screenshot({path:out+'/dining-graph-'+width+'-'+js+'.png'});
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No page overflow');assert.deepEqual(errors,[]);views.push({width,js,errors});await p.close();
 }
 fs.writeFileSync(out+'/dining-test.json',JSON.stringify({results,views,unfairCycleMeals:10},null,2)+'\n');console.log('Dining exhaustive state-space, independent ownership/enablement/cycle oracle and desktop/mobile/no-JS controls passed');
 }finally{await b.close()}}
browser().catch(e=>{console.error(e);process.exitCode=1});
