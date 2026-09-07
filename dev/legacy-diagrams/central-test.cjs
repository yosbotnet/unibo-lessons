const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {Model,scenarios,step,trace,tokenLabel}=require('../../pcd/assets/centralized-mutex.js');
const {markup}=require('./central-traces.cjs');
const root=path.resolve(__dirname,'../..'),out='/home/ybc/notes-legacy-review-artifacts';
// Independent histories of request events; never use the eligibility predicate.
function oracle(m){
 const n=m.clients.length,known=Array.from({length:n+1},()=>new Set()),deps=new Map(),sent=new Map(),granted=new Set(),completed=new Set(),exited=new Set(),receivedRequests=new Set();let held=null,location='P0';
 const vector=set=>Array.from({length:n},(_,i)=>[...set].filter(key=>key.startsWith('P'+(i+1)+'#')).length);
 for(const e of m.events){
  if(e.type==='request'){const r=e.request;deps.set(r.key,new Set(known[r.pid]));known[r.pid].add(r.key);assert.deepEqual(r.v,vector(known[r.pid]))}
  if(e.type==='send'){
   const msg=m.messages[e.id-1];sent.set(e.id,new Set(known[msg.from]));assert.deepEqual(msg.v,vector(known[msg.from]),'Message timestamp reflects its actual send history');
   if(msg.type==='TOKEN'){assert.equal(location,'P0');location='message'+e.id}
   if(msg.type==='RELEASE'){assert.equal(location,'P'+msg.from);assert(exited.has(msg.request.key));location='message'+e.id}
  }
  if(e.type==='deliver'){
   const msg=m.messages[e.id-1];for(const key of sent.get(e.id))known[msg.to].add(key);
   if(msg.type==='REQUEST')receivedRequests.add(msg.request.key);
   if(msg.type==='TOKEN'||msg.type==='RELEASE'){assert.equal(location,'message'+e.id);location='P'+msg.to}
  }
  if(e.type==='grant'){
   const r=e.request;assert.equal(location,'P0');assert(receivedRequests.has(r.key));assert(!granted.has(r.key));
   for(const key of deps.get(r.key))assert(completed.has(key),'Uncompleted causal predecessor '+key+' before '+r.key);
   granted.add(r.key);
  }
  if(e.type==='enter'){assert.equal(held,null,'At most one holder');assert(granted.has(e.request.key));assert.equal(location,'P'+e.request.pid);held=e.request.key}
  if(e.type==='exit'){assert.equal(held,e.request.key);held=null;exited.add(e.request.key)}
  if(e.type==='complete'){assert(exited.has(e.request.key));assert(!completed.has(e.request.key));completed.add(e.request.key)}
 }
 for(let i=0;i<=n;i++)assert.deepEqual(m.process(i).v,vector(known[i]));
 assert.deepEqual(m.coordinator.granted,vector(granted));assert.deepEqual(m.coordinator.completed,vector(completed));
 assert.deepEqual(new Set(m.coordinator.queue.map(r=>r.key)),new Set([...receivedRequests].filter(key=>!granted.has(key))));
 const token=m.token;assert.equal(location,token.kind==='coordinator'?'P0':token.kind==='client'?'P'+token.pid:'message'+token.message);
 assert.deepEqual(m.clients.filter(p=>p.mode==='HELD').map(p=>p.request.key),held?[held]:[]);
}
let seed=73;function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
function drain(m){let count=0;while(m.network.length||m.clients.some(p=>p.mode==='HELD')){
 const held=m.clients.find(p=>p.mode==='HELD');if(held)m.release(held.id);else m.deliver(m.network[Math.floor(random()*m.network.length)]);oracle(m);assert(++count<500);
 }assert(m.clients.every(p=>p.mode==='IDLE'));assert.equal(m.token.kind,'coordinator');assert.equal(m.coordinator.queue.length,0);assert.equal(m.entries.length,m.requests.length)}
let eventCount=0,requests=0;
for(let n=2;n<=6;n++)for(let trial=0;trial<100;trial++){
 const m=new Model(n);
 for(let action=0;action<100;action++){
  const actions=[...m.clients.filter(p=>p.mode==='IDLE').map(p=>()=>m.request(p.id)),...m.clients.filter(p=>p.mode==='HELD').map(p=>()=>m.release(p.id)),...m.network.map(id=>()=>m.deliver(id))];
  const from=1+Math.floor(random()*n),to=from%n+1;actions.push(()=>m.application(from,to));actions[Math.floor(random()*actions.length)]();oracle(m);
 }
 drain(m);eventCount+=m.events.length;requests+=m.requests.length;
 assert.equal(m.messages.filter(msg=>msg.type!=='APP').length,3*m.requests.length,'Three control transmissions per completed request');
}
for(const s of scenarios){const m=new Model();for(const a of s.steps){step(m,a);oracle(m)}assert.deepEqual(m.coordinator.completed,[1,1]);assert.deepEqual(m.entries,['P1#1','P2#1']);assert.equal(m.network.length,0)}
const causal=trace(scenarios[0]);assert.deepEqual(causal[4],{action:scenarios[0].steps[4][3],token:'a P0',granted:[0,0],completed:[0,0],queue:['P2#1']});
assert.deepEqual(causal[5].granted,[1,0]);assert.deepEqual(causal[5].completed,[0,0]);assert.equal(causal[5].token,'in viaggio P0 → P1');assert.equal(causal[7].token,'in viaggio P1 → P0');
assert.deepEqual(causal[8].granted,[1,1]);assert.deepEqual(causal[8].completed,[1,0]);
const concurrent=new Model();for(const s of scenarios[1].steps.slice(0,4))step(concurrent,s);
const queued=concurrent.coordinator.queue[0];assert(concurrent.eligible(queued));assert.equal(queued.v[0],0);assert.equal(concurrent.coordinator.granted[0],1);assert.notEqual(queued.v[0],concurrent.coordinator.granted[0]);assert.equal(concurrent.clients.filter(p=>p.mode==='HELD').length,0,'Grant in transit is not entry');
const reverse=new Model();reverse.request(1);reverse.request(2);reverse.deliver(2);drain(reverse);assert.deepEqual(reverse.entries,['P2#1','P1#1'],'No built-in P1 preference');
// Reacquisition may be requested while the previous RELEASE is still in transit.
const again=new Model();again.request(1);again.deliver(1);again.deliver(2);again.release(1);again.request(1);again.deliver(4);assert.equal(again.token.kind,'returning');assert.equal(again.entries.length,1);again.deliver(3);assert.equal(again.token.kind,'outbound');drain(again);assert.deepEqual(again.entries,['P1#1','P1#2']);
// A later receive cannot retroactively change a queued request timestamp.
assert.deepEqual(queued.v,[0,1]);
for(const n of [0,1,7,NaN,2.5])assert.throws(()=>new Model(n));const bad=new Model();assert.throws(()=>bad.request(0));assert.throws(()=>bad.request(99));assert.throws(()=>bad.release(1));assert.throws(()=>bad.application(1,1));assert.throws(()=>bad.deliver(1));bad.request(1);assert.throws(()=>bad.request(1));bad.deliver(1);assert.throws(()=>bad.deliver(1));assert.throws(()=>bad.release(1));
const chapter=fs.readFileSync(path.join(root,'pcd/cap-16-algoritmi-distribuiti.html'),'utf8');assert(chapter.includes(markup()));assert(!chapter.includes('w.v[j] == reqDone[j]'));assert(!chapter.includes("LessonKit.stepper('#step-centralized'"));
console.log(`500 executions, 50,000 mixed actions plus fair drains (${eventCount} events, ${requests} completed requests): causal-history oracle, token conservation, transit states, reentry and 3-message counts passed`);
async function browser(){
 const {chromium}=require('playwright'),b=await chromium.launch(),preview=process.env.NOTES_PREVIEW_URL||'http://127.0.0.1:8787/',results=[];
 const fixture=path.join(path.dirname(require.resolve('mermaid')),'mermaid.min.js');fs.mkdirSync(out,{recursive:true});
 try{for(const width of [1280,390]){
  const p=await b.newPage({viewport:{width,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route(/^https?:/,r=>r.request().url().startsWith(preview)?r.continue():/mermaid.*\.js/.test(r.request().url())?r.fulfill({path:fixture}):/highlight\.min\.js/.test(r.request().url())?r.fulfill({path:root+'/dl/assets/highlight.min.js'}):r.abort());
  await p.goto(new URL('pcd/cap-16-algoritmi-distribuiti.html#s5',preview).href);await p.waitForFunction(()=>[...document.querySelectorAll('.mermaid')].every(e=>e.querySelector('svg')));const h=p.locator('#step-centralized');
  for(const s of scenarios){await h.getByRole('button',{name:'Reimposta',exact:true}).click();const expected=new Model();
   for(let i=0;i<s.steps.length;i++){
    const a=s.steps[i],key=(a[0]==='deliver'?'msg-':a[0]==='application'?'app-':a[0]==='release'?'release-':'request-')+a[1];
    await h.locator(`[data-mutex-action="${key}"]`).click();step(expected,a);
    const c=expected.coordinator;assert.equal(await h.getByRole('status').textContent(),`Token: ${tokenLabel(expected)}. Concesse: [${c.granted}]. Completate: [${c.completed}]. In CS: ${expected.clients.filter(p=>p.mode==='HELD').map(p=>'P'+p.id).join(', ')||'nessuno'}.`);
    const rows=await h.locator('[data-mutex-clients] tr').evaluateAll(rows=>rows.map(r=>[...r.querySelectorAll('td')].map(e=>e.textContent)));assert.deepEqual(rows.map(r=>r.slice(0,2)),expected.clients.map(p=>[p.mode,'['+p.v+']']));
    assert.equal(await h.locator('[data-mutex-network] button').count(),expected.network.length);
    if(s.id==='causal'&&[4,5,7,8].includes(i))await h.screenshot({path:path.join(out,`central-${s.id}-step${i+1}-${width}.png`)});
   }
   assert.equal(await h.locator('[data-mutex-queue] tr').count(),0);assert.equal(await p.evaluate(()=>document.activeElement?.dataset.mutexAction),'reset');await h.screenshot({path:path.join(out,`central-${s.id}-final-${width}.png`)});
  }
  let scrolls=0;for(const d of await p.locator('[data-central-trace]').all()){
   await d.locator('summary').click();const id=await d.getAttribute('data-central-trace'),region=d.locator('[role=region]');await d.screenshot({path:path.join(out,`central-trace-${id}-${width}.png`)});
   if(await region.evaluate(e=>e.scrollWidth>e.clientWidth+1)){await region.focus();await p.keyboard.press('ArrowRight');await p.waitForFunction(e=>e.scrollLeft>0,await region.elementHandle());scrolls++}
  }
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);results.push({width,scenarios:2,actions:22,traceScrolls:scrolls,errors});await p.close();
 }
 const p=await b.newPage({javaScriptEnabled:false,viewport:{width:390,height:1000}});await p.route(/^https?:/,r=>r.request().url().startsWith(preview)?r.continue():r.abort());await p.goto(new URL('pcd/cap-16-algoritmi-distribuiti.html#s3',preview).href);assert.match(await p.locator('#step-centralized').textContent(),/richiede JavaScript/);for(const d of await p.locator('[data-central-trace]').all())await d.locator('summary').click();assert.equal(await p.locator('[data-central-trace] tbody tr').count(),22);assert(await p.locator('[data-static-diagram^="pcd-central-"] img').evaluateAll(a=>a.length===2&&a.every(i=>i.complete&&i.naturalWidth>0)));assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.close();
 fs.writeFileSync(path.join(out,'central-test.json'),JSON.stringify({executions:500,actions:50000,eventCount,requests,oracle:'independent causal histories of requests and token location',results,noJavaScript:true},null,2));console.log('Desktop/mobile real requests, APP, deliveries, release, exact states/queues, keyboard focus/scroll and no-JavaScript traces passed');
 }finally{await b.close()}
}
browser().catch(e=>{console.error(e);process.exitCode=1});
