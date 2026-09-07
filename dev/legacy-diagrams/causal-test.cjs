const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {Model,scenarios,step,trace}=require('../../pcd/assets/causal-order.js');
const {markup}=require('./causal-traces.cjs');
const root=path.resolve(__dirname,'../..'),out='/home/ybc/notes-legacy-review-artifacts';
// Independent oracle: causal histories of send events, not matrix comparisons.
function oracle(m){
 const past=m.processes.map(()=>new Set()),done=m.processes.map(()=>new Set()),deps=new Map(),arrived=new Set();
 for(const e of m.events){const msg=m.messages[e.id-1];
  if(e.type==='send'){deps.set(e.id,new Set(past[msg.from]));past[msg.from].add(e.id)}
  if(e.type==='arrival'){assert(!arrived.has(e.id));arrived.add(e.id)}
  if(e.type==='deliver'){
   assert(arrived.has(e.id),'No delivery before arrival');assert(!done[msg.to].has(e.id),'No duplicate delivery');
   for(const id of deps.get(e.id))if(m.messages[id-1].to===msg.to)assert(done[msg.to].has(id),'Missing causal predecessor '+id+' before '+e.id);
   done[msg.to].add(e.id);past[msg.to].add(e.id);for(const id of deps.get(e.id))past[msg.to].add(id);
  }
 }
 for(const p of m.processes){
  assert.deepEqual(new Set(p.delivered),done[p.id]);
  for(const q of m.processes)assert.equal(p.matrix[q.id][p.id],p.delivered.filter(id=>m.messages[id-1].from===q.id).length,'Local incoming column is actual deliveries');
  for(const id of p.buffer){const expected=[...deps.get(id)].filter(d=>m.messages[d-1].to===p.id).every(d=>done[p.id].has(d));assert(!expected,'An eligible message was left buffered')}
 }
 return {past,done,deps};
}
let seed=101;function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
let events=0;
for(let n=2;n<=8;n++)for(let trial=0;trial<150;trial++){
 const m=new Model(n);
 for(let action=0;action<70;action++){
  if(!m.network.length||random()<.57){const from=Math.floor(random()*n);let to=Math.floor(random()*(n-1));if(to>=from)to++;m.send(from,to)}
  else m.arrive(m.network[Math.floor(random()*m.network.length)]);
  oracle(m);
 }
 while(m.network.length){m.arrive(m.network[Math.floor(random()*m.network.length)]);oracle(m)}
 assert(m.processes.every(p=>p.buffer.length===0),'Fair delivery must drain all dependencies');assert.equal(m.processes.reduce((sum,p)=>sum+p.delivered.length,0),m.messages.length);events+=m.events.length;
}
for(const s of scenarios){const m=new Model();for(const a of s.steps){step(m,a);oracle(m)}assert(m.processes.every(p=>p.buffer.length===0));assert.equal(m.network.length,0)}
assert.deepEqual(trace(scenarios[0]).map(r=>[r.column,r.buffer,r.deliveries]),[
 [[0,0,0],[],[]],[[0,0,0],[],[]],[[0,0,0],[],['m2 → P2']],[[0,0,0],[],[]],[[0,0,0],['m3'],[]],[[1,1,0],[],['m1 → P3','m3 → P3']]
]);
const overtaking=new Model();for(const s of scenarios[0].steps)step(overtaking,s);
assert.deepEqual(overtaking.messages[2].stamp.map(row=>row[2]),[1,1,0],'m3 carries the missing dependency');
assert.deepEqual(overtaking.events.filter(e=>e.type==='deliver'&&overtaking.messages[e.id-1].to===2).map(e=>[e.id,e.column]),[[1,[1,0,0]],[3,[1,1,0]]],'Both intermediate diagram columns match actual delivery events');
// The erroneous equality fails even with two independent messages and no loss.
const concurrent=new Model();concurrent.send(0,2);concurrent.send(1,2);concurrent.arrive(1);const second=concurrent.messages[1];
assert(concurrent.eligible(second));assert.notEqual(second.stamp[0][2],concurrent.process(2).matrix[0][2]);concurrent.arrive(2);assert.deepEqual(concurrent.process(2).delivered,[1,2]);
assert.deepEqual(trace(scenarios[3]).at(-1).deliveries,['m2 → P3']);
const early=new Model();for(const s of scenarios[3].steps)step(early,s);assert.deepEqual(early.process(2).delivered,[3,2]);
const detached=new Model();detached.send(0,2);detached.send(0,2);assert.equal(detached.messages[0].stamp[0][2],1,'Timestamps are immutable snapshots');
for(const n of [0,1,9,NaN,2.5])assert.throws(()=>new Model(n));const bad=new Model();assert.throws(()=>bad.send(0,0));assert.throws(()=>bad.send(-1,1));assert.throws(()=>bad.arrive(1));bad.send(0,1);bad.arrive(1);assert.throws(()=>bad.arrive(1));
// Order-only examples: causal does not imply total and total does not imply causal.
const total=orders=>orders.every(order=>JSON.stringify(order)===JSON.stringify(orders[0]));
const causal=(orders,edges)=>orders.every(order=>edges.every(([a,b])=>order.indexOf(a)<order.indexOf(b)));
assert(causal([['a','b'],['b','a']],[]));assert(!total([['a','b'],['b','a']]));assert(total([['y','x'],['y','x']]));assert(!causal([['y','x'],['y','x']],[['x','y']]));
const chapter=fs.readFileSync(path.join(root,'pcd/cap-16-algoritmi-distribuiti.html'),'utf8');assert(chapter.includes(markup()));assert(!chapter.includes("m'[k,i] == m[k,i]"));
console.log(`1050 randomized executions, 73,500 actions plus network drains (${events} events), independent causal-history oracle, four exact traces, non-FIFO safety/liveness and equality counterexample passed`);
async function browser(){
 const {chromium}=require('playwright'),b=await chromium.launch(),preview=process.env.NOTES_PREVIEW_URL||'http://127.0.0.1:8787/',results=[];
 const fixture=path.join(path.dirname(require.resolve('mermaid')),'mermaid.min.js');fs.mkdirSync(out,{recursive:true});
 try{for(const width of [1280,390]){
  const p=await b.newPage({viewport:{width,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route(/^https?:/,r=>r.request().url().startsWith(preview)?r.continue():/mermaid.*\.js/.test(r.request().url())?r.fulfill({path:fixture}):/highlight\.min\.js/.test(r.request().url())?r.fulfill({path:root+'/dl/assets/highlight.min.js'}):r.abort());
  await p.goto(new URL('pcd/cap-16-algoritmi-distribuiti.html#s12',preview).href);await p.waitForFunction(()=>[...document.querySelectorAll('.mermaid')].every(e=>e.querySelector('svg')));
  const h=p.locator('#causal-explorer');
  for(let i=0;i<scenarios.length;i++){
   await h.locator('select').selectOption(String(i));const expected=trace(scenarios[i]);
   for(let k=0;k<expected.length;k++){
    await h.getByRole('button',{name:'Passo successivo',exact:true}).click();
    const actual=await h.locator('[data-causal-process="3"] tbody tr').evaluateAll(rows=>rows.map(r=>Number(r.querySelector('td:last-child').textContent)));
    assert.deepEqual(actual,expected[k].column);assert.equal(await h.locator('[data-causal-process="3"] [data-causal-buffer]').textContent(),'Buffer: '+(expected[k].buffer.join(', ')||'vuoto'));
    if(i===0&&k===4)await h.screenshot({path:path.join(out,`causal-buffer-widget-${width}.png`)});
   }
   assert(await h.getByRole('button',{name:'Passo successivo',exact:true}).isDisabled());assert.equal(await p.evaluate(()=>document.activeElement.id),'causal-reset');
   await h.screenshot({path:path.join(out,`causal-${scenarios[i].id}-${width}.png`)});
   await h.getByRole('button',{name:'Reimposta',exact:true}).click();assert.match(await h.getByRole('status').textContent(),/^Passo 0\//);
  }
  let scrolls=0;for(const detail of await p.locator('[data-causal-trace]').all()){
   await detail.locator('summary').click();const region=detail.locator('[role=region]');
   const id=await detail.getAttribute('data-causal-trace');
   await detail.screenshot({path:path.join(out,`causal-trace-${id}-${width}.png`)});
   if(await region.evaluate(e=>e.scrollWidth>e.clientWidth+1)){await region.focus();await p.keyboard.press('ArrowRight');await p.waitForFunction(e=>e.scrollLeft>0,await region.elementHandle());scrolls++;await region.evaluate(e=>e.scrollLeft=e.scrollWidth);await detail.screenshot({path:path.join(out,`causal-trace-end-${id}-${width}.png`)})}
  }
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);results.push({width,scenarios:4,steps:20,traceScrolls:scrolls,errors});await p.close();
 }
 const p=await b.newPage({javaScriptEnabled:false,viewport:{width:390,height:1000}});await p.route(/^https?:/,r=>r.request().url().startsWith(preview)?r.continue():r.abort());await p.goto(new URL('pcd/cap-16-algoritmi-distribuiti.html#s11',preview).href);assert.match(await p.locator('#causal-explorer').textContent(),/richiedono JavaScript/);
 for(const d of await p.locator('[data-causal-trace]').all())await d.locator('summary').click();assert.equal(await p.locator('[data-causal-trace] tbody tr').count(),20);assert(await p.locator('[data-static-diagram^="pcd-causal-"] img').evaluateAll(a=>a.length===2&&a.every(i=>i.complete&&i.naturalWidth>0)));assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.close();
 fs.writeFileSync(path.join(out,'causal-test.json'),JSON.stringify({randomExecutions:1050,actions:73500,events,oracle:'independent send-event causal histories',scenarios:4,results,noJavaScript:true},null,2));console.log('Four scenarios on desktop/mobile, all matrix columns, buffer transitions, keyboard focus/scroll and no-JavaScript traces passed');
 }finally{await b.close()}
}
browser().catch(e=>{console.error(e);process.exitCode=1});
