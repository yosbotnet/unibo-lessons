const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {Model,run}=require('../../ds/assets/pbft-normal.js'),{markup}=require('./pbft-traces.cjs');
const root=path.resolve(__dirname,'../..'),out='/home/ybc/notes-legacy-review-artifacts',html=fs.readFileSync(root+'/ds/DS-C4.html','utf8');
const uniq=xs=>[...new Set(xs)].sort((a,b)=>a-b);
// Reconstruct evidence solely from message deliveries, rather than trusting the
// model's prepared/executed flags or its local-transition events.
function check(m){const delivered=m.events.filter(e=>e.type==='deliver').map(e=>e.message);
 for(const r of m.nodes){if(m.faulty.includes(r.id)){assert(!r.executed);continue}const local=delivered.filter(q=>q.to===r.id&&q.digest==='X'&&q.view===0&&q.slot===1);
  const pp=local.some(q=>r.id===1?q.kind==='request'&&q.from===0:q.kind==='pre-prepare'&&q.from===1);
  const prepares=uniq([...local.filter(q=>q.kind==='prepare'&&q.from!==1).map(q=>q.from),...(pp&&r.id!==1?[r.id]:[])]),prepared=pp&&prepares.length>=2*m.f;
  const commits=uniq([...local.filter(q=>q.kind==='commit').map(q=>q.from),...(prepared?[r.id]:[])]),executed=prepared&&commits.length>=2*m.f+1;
  assert.equal(r.preprepare,pp);assert.deepEqual(r.prepares,prepares);assert.deepEqual(r.commits,commits);assert.equal(r.sentCommit,prepared);assert.equal(r.executed,executed);
  assert.equal(m.events.filter(e=>e.type==='execute'&&e.at===r.id).length,Number(executed));
 }
 const replies=uniq(delivered.filter(q=>q.kind==='reply'&&q.to===0).map(q=>q.from));assert.deepEqual(m.replies,replies);assert.equal(m.accepted,replies.length>=m.f+1);
 for(const e of m.events.filter(e=>e.type==='send'&&e.message.kind==='prepare'))assert.notEqual(e.message.from,1,'Primary sends no PREPARE');
}
const normal=run();assert.equal(normal.length,23);assert(normal.at(-1).accepted);assert(html.includes(markup()));
let seed=48221;const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n};let deliveries=0;
for(let trial=0;trial<1000;trial++){
 const f=trial%4,n=3*f+1,faulty=[];while(faulty.length<f){const id=2+rand(n-1);if(!faulty.includes(id))faulty.push(id)}const m=new Model({f,faulty});m.start();
 for(const from of faulty)for(let i=0;i<12;i++)m.faultyVote({from,to:1+rand(n),kind:rand(2)?'prepare':'commit',digest:rand(3)?'X':'Y',view:rand(5)?0:1,slot:rand(5)?1:2});
 while(m.queue.length){m.deliver(m.queue[rand(m.queue.length)].id);deliveries++;check(m)}assert(m.accepted);assert(m.nodes.filter(r=>!faulty.includes(r.id)).every(r=>r.executed));
}
// A receiver can collect commits before its proposal, but cannot execute yet.
const delayed=new Model();delayed.start();delayed.deliver(delayed.queue[0].id);const pp2=delayed.queue.find(q=>q.to===2&&q.kind==='pre-prepare');delayed.deliver(pp2.id);
for(const kind of ['prepare','commit'])for(let i=0;i<5;i++){const id=delayed.faultyVote({from:4,to:2,kind});delayed.deliver(id)}
assert.deepEqual(delayed.nodes[1].prepares,[2,4]);assert.deepEqual(delayed.nodes[1].commits,[2,4]);assert(!delayed.nodes[1].executed,'Repeated faulty votes never reach three identities');
const q=delayed.queue.find(q=>q.kind==='commit'&&q.to===3);delayed.deliver(q.id);assert.deepEqual(delayed.nodes[2].commits,[2]);assert(!delayed.nodes[2].preprepare&&!delayed.nodes[2].executed);check(delayed);
for(const params of [{f:4,faulty:[]},{f:1,faulty:[1]},{f:1,faulty:[2,3]},{f:2,faulty:[4,4]}])assert.throws(()=>new Model(params));
const bad=new Model();assert.throws(()=>bad.deliver(1));bad.start();assert.throws(()=>bad.start());for(const params of [{from:1,to:2,kind:'prepare'},{from:4,to:1,kind:'reply'},{from:4,to:5,kind:'commit'},{from:4,to:1,kind:'commit',digest:'Z'}])assert.throws(()=>bad.faultyVote(params));const snap=bad.snapshot();snap.queue[0].to=4;assert.equal(bad.queue[0].to,1);
let quorumPairs=0;const pop=x=>x.toString(2).replaceAll('0','').length;
for(let n=1;n<=10;n++)for(let q=1;q<=n;q++){const masks=Array.from({length:2**n},(_,i)=>i).filter(x=>pop(x)===q);let min=n;for(let i=0;i<masks.length;i++)for(let j=i;j<masks.length;j++){min=Math.min(min,pop(masks[i]&masks[j]));quorumPairs++}assert.equal(min,Math.max(0,2*q-n))}
// Explicit N=5, f=1, Q=3 counterexample: only Byzantine R3 is shared.
assert.deepEqual([1,2,3].filter(x=>[3,4,5].includes(x)),[3]);assert.equal(2*3-5,1);
// Independently evaluate the corrected printed Nakamoto approximation using a
// positive Poisson-weighted tail, then compare with the finite subtraction form.
function estimate(q,z){const r=q/(1-q),lambda=z*r;let term=Math.exp(-lambda),p=1;for(let k=0;k<=z;k++){if(k)term*=lambda/k;p-=term*(1-r**(z-k))}return p}
function positive(q,z){const r=q/(1-q),lambda=z*r;let term=Math.exp(-lambda),p=0;for(let k=0;k<300;k++){if(k)term*=lambda/k;p+=term*(k>z?1:r**(z-k))}return p}
for(const q of [.01,.1,.13,.3,.49])for(let z=1;z<=30;z++)assert(Math.abs(estimate(q,z)-positive(q,z))<1e-12);
assert(Math.abs(estimate(.1,6)-.0002428)<5e-8);assert(html.includes(estimate(.1,6).toFixed(9)));assert(html.includes(estimate(.13,6).toFixed(9)));
console.log(`PBFT: 1000 reordered schedules, ${deliveries} delivered messages with independent local-evidence oracle; duplicate/mismatched votes; ${quorumPairs} quorum-set pairs; 150 independent confirmation-formula comparisons passed`);
async function browser(){const {chromium}=require('playwright'),b=await chromium.launch(),preview='http://127.0.0.1:8787/',results=[];fs.mkdirSync(out,{recursive:true});
 async function route(p){await p.route(/^https?:/,r=>r.request().url().startsWith(preview)?r.continue():/mermaid.*\.js/.test(r.request().url())?r.fulfill({path:path.join(path.dirname(require.resolve('mermaid')),'mermaid.min.js')}):/highlight\.min\.js/.test(r.request().url())?r.fulfill({path:root+'/dl/assets/highlight.min.js'}):r.abort())}
 try{for(const width of [1280,390]){const p=await b.newPage({viewport:{width,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await route(p);await p.goto(preview+'ds/DS-C4.html#s9');await p.waitForFunction(()=>document.querySelector('#pbft-explorer').dataset.pbftNormal==='true');const h=p.locator('#pbft-explorer');
  for(const reverse of [false,true]){const m=new Model();let captured=false;m.start();await h.locator('#pbft-start').click();while(m.queue.length){const id=m.queue[reverse?m.queue.length-1:0].id;await h.locator('#pbft-message').selectOption(String(id));await h.locator('#pbft-deliver').click();m.deliver(id);const expected=m.snapshot().nodes.map(r=>['R'+r.id,...(m.faulty.includes(r.id)?['—','—','—','silent']:[r.preprepare?'X':'waiting',r.prepares.join(', ')||'—',r.commits.join(', ')||'—',r.executed?'executed: 1':r.prepared?'prepared':'waiting'])]);assert.deepEqual(await h.locator('[data-pbft-rows] tr').evaluateAll(es=>es.map(e=>[...e.children].map(c=>c.textContent))),expected);assert.equal((await h.getByRole('status').textContent()).includes('accepted result 1'),m.accepted);assert.equal(await p.evaluate(()=>document.activeElement.id),m.queue.length?'pbft-message':'pbft-reset');const correct=m.snapshot().nodes.filter(r=>!m.faulty.includes(r.id));if(!captured&&correct.some(r=>r.prepared)&&correct.some(r=>!r.prepared)){await h.screenshot({path:path.join(out,`pbft-mixed-${reverse?'reverse':'fifo'}-${width}.png`)});captured=true}}
   assert(await h.locator('#pbft-deliver').isDisabled());assert(await h.locator('th,td').evaluateAll(es=>es.every(e=>e.scrollWidth<=e.clientWidth+1)));await h.screenshot({path:path.join(out,`pbft-${reverse?'reverse':'fifo'}-${width}.png`)});await h.locator('#pbft-reset').click();assert.equal(await p.evaluate(()=>document.activeElement.id),'pbft-start');
  }
  await h.locator('#pbft-start').focus();await p.keyboard.press('Enter');assert(await h.locator('#pbft-start').isDisabled());
  const detail=p.locator('[data-pbft-trace]');await detail.locator('summary').click();assert.equal(await detail.locator('tbody tr').count(),23);assert(await detail.locator('th,td').evaluateAll(es=>es.every(e=>e.scrollWidth<=e.clientWidth+1)));
  for(const region of [h.locator('[role=region]'),detail.locator('[role=region]')])if(await region.evaluate(e=>e.scrollWidth>e.clientWidth+1)){await region.focus();await p.keyboard.press('ArrowRight');await p.waitForFunction(e=>e.scrollLeft>0,await region.elementHandle())}
  const f=p.locator('[data-static-diagram="ds-pbft-normal"]');assert(await f.locator('img').evaluate(i=>i.complete&&i.naturalWidth>0));await f.screenshot({path:path.join(out,`ds-pbft-normal-${width}.png`)});await detail.screenshot({path:path.join(out,`pbft-trace-${width}.png`)});
  let transitions=0;for(const selector of ['#smr-explorer','#bft-explorer']){const map=p.locator(selector),names=await map.locator('.lk-se-node').allTextContents();for(const name of names){await map.locator('.lk-se-node').getByText(name,{exact:true}).click();const labels=await map.locator('.lk-se-trans button').allTextContents();for(const label of labels){await map.locator('.lk-se-node').getByText(name,{exact:true}).click();await map.locator('.lk-se-trans').getByRole('button',{name:label,exact:true}).click();const target=label.split('→')[1].trim();assert.equal(await map.locator('.lk-se-cur b').textContent(),target);transitions++}}}
  for(const tabs of await p.locator('.lk-tabs').all()){const buttons=tabs.locator(':scope > .lk-tablist > .lk-tab');for(let i=0;i<await buttons.count();i++){await buttons.nth(i).click();assert(await tabs.locator(':scope > .lk-tabpanel').nth(i).isVisible())}}
  for(let repeat=0;repeat<2;repeat++){await p.locator('#validate-all-btn').click();assert.equal(await p.locator('#tx-board .tx-status.valid').count(),2);assert.equal(await p.locator('#tx-board .tx-status.invalid').count(),2);assert.match(await p.locator('#tx-log').textContent(),/Final balances: Alice=15, Bob=7, Carol=5, Eve=0.5 units/);assert.match(await p.locator('#tx-log').textContent(),/Invalid signature fixture/);await p.locator('#tx-reset-btn').click();assert.equal(await p.locator('#tx-board .tx-status.pending').count(),4)}
  await p.locator('#validate-all-btn').click();await p.locator('#s8').screenshot({path:path.join(out,`ds-transfer-${width}.png`)});await p.locator('[data-tx-trace] summary').click();const balances=await p.locator('[data-tx-trace] tbody tr').evaluateAll(es=>es.map(e=>[...e.querySelectorAll('td')].map(c=>Number(c.textContent))));assert.deepEqual(balances,[[15,10,2,.5],[15,7,5,.5],[15,7,5,.5],[15,7,5,.5]]);assert(balances.every(a=>a.reduce((x,y)=>x+y,0)===27.5));
  assert.deepEqual(errors,[]);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));results.push({width,uiSchedules:2,traceRows:23,transitions,errors});await p.close();
 }
 const p=await b.newPage({javaScriptEnabled:false,viewport:{width:390,height:1000}});await route(p);await p.goto(preview+'ds/DS-C4.html#s9');assert.match(await p.locator('#pbft-explorer').textContent(),/requires JavaScript/);await p.locator('[data-pbft-trace] summary').click();assert.equal(await p.locator('[data-pbft-trace] tbody tr').count(),23);const native=p.locator('[data-static-diagram="ds-pbft-normal"] img');assert(await native.evaluate(i=>i.complete&&i.naturalWidth>0));assert(await native.isVisible());
 await p.locator('[data-tx-trace] summary').click();assert.equal(await p.locator('[data-tx-trace] tbody tr').count(),4);assert(await p.locator('[data-tx-trace] table').isVisible());assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.close();
 fs.writeFileSync(path.join(out,'pbft-test.json'),JSON.stringify({schedules:1000,deliveries,quorumPairs,probabilityChecks:150,results,transferFixture:{valid:2,invalid:2,total:27.5,staticRows:4,repeatsPerViewport:2},noJavaScript:true},null,2));console.log('PBFT desktop/mobile: FIFO and reverse schedules, local tables/client threshold, reset/focus/keyboard, conceptual maps, tabs and 23 no-JS trace rows; transfer fixture/reset and 4 static rows passed');
 }finally{await b.close()}
}
browser().catch(e=>{console.error(e);process.exitCode=1});
