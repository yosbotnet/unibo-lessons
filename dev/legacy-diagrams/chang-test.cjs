const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {Model,example}=require('../../pcd/assets/chang-roberts.js');
const {markup}=require('./chang-trace.cjs');
const root=path.resolve(__dirname,'../..'),out='/home/ybc/notes-legacy-review-artifacts';
let seed=41;function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
function finish(m){let steps=0;while(m.messages.length){const q=m.available();m.deliver(q[Math.floor(random()*q.length)].id);assert(++steps<200)}assert.deepEqual(m.elected,[Math.max(...m.processes.map(p=>p.id))]);assert(m.announcementReturned);assert(m.processes.every(p=>p.leaderId===m.elected[0]));assert.equal(m.sent.length,m.delivered.length);assert.equal(m.counts().leader,m.processes.length)}
function* permutations(a){if(!a.length){yield [];return}for(let i=0;i<a.length;i++)for(const p of permutations(a.filter((_,j)=>j!==i)))yield [a[i],...p]}
let scenarios=0,single=0;
for(let n=2;n<=6;n++)for(const ids of permutations(Array.from({length:n},(_,i)=>i+1)))for(let mask=1;mask<(1<<n);mask++){
 const m=new Model(ids);for(let i=0;i<n;i++)if(mask&(1<<i))m.initiate(ids[i]);finish(m);scenarios++;
 assert(m.counts().election<=n*(n+1)/2);
 if((mask&(mask-1))===0){assert(m.counts().election<=2*n-1);single++}
}
for(let n=2;n<=12;n++){
 const ids=Array.from({length:n},(_,i)=>n-i),m=new Model(ids);for(const id of ids)m.initiate(id);finish(m);assert.equal(m.counts().election,n*(n+1)/2);
 const one=new Model(ids);one.initiate(n-1);finish(one);assert.equal(one.sent.length,3*n-1);
}
// Initiations may happen later, but never after local participation or decision.
for(let i=0;i<1000;i++){
 const m=new Model();m.initiate(2);
 for(let step=0;step<100&&m.messages.length;step++){
  const sleeping=m.processes.filter(p=>!p.awake&&p.leaderId===null);
  if(sleeping.length&&random()<.3)m.initiate(sleeping[Math.floor(random()*sleeping.length)].id);
  else{const q=m.available();m.deliver(q[Math.floor(random()*q.length)].id)}
 }
 finish(m);
}
const demo=example();assert.deepEqual(demo.counts(),{election:7,leader:6});
assert.deepEqual(demo.delivered.map(m=>[m.from,m.to,m.type,m.value]),[
 [2,7,'election',2],[7,3,'election',7],[3,1,'election',7],[1,5,'election',7],[5,4,'election',7],[4,2,'election',7],[2,7,'election',7],
 [7,3,'leader',7],[3,1,'leader',7],[1,5,'leader',7],[5,4,'leader',7],[4,2,'leader',7],[2,7,'leader',7]
]);
for(const ids of [[],[1],[1,1],[NaN,2],[-1,2],Array.from({length:13},(_,i)=>i)])assert.throws(()=>new Model(ids));
const zero=new Model([0,1]);zero.initiate(0);finish(zero);
const bad=new Model();assert.throws(()=>bad.initiate(999));assert.throws(()=>bad.deliver(1));bad.initiate(2);assert.throws(()=>bad.initiate(2));
const fifo=new Model([3,2,1]);fifo.initiate(2);fifo.initiate(3);fifo.deliver(2);assert.deepEqual(fifo.messages.map(m=>m.id),[1,3]);assert.throws(()=>fifo.deliver(3));
// Receiving a greater ID marks participation and prevents a spurious candidature.
const forward=new Model([1,3,2]);forward.initiate(3);forward.deliver(1);assert(forward.process(2).awake);assert(!forward.process(2).ownSent);assert.throws(()=>forward.initiate(2));
const chapter=fs.readFileSync(path.join(root,'pcd/cap-16-algoritmi-distribuiti.html'),'utf8');assert(chapter.includes(markup()));
fs.mkdirSync(out,{recursive:true});
console.log(`${scenarios} ring/initiator combinations (random FIFO channel interleavings), ${single} single-initiator bounds, 1000 late-initiation scenarios, exact worst cases N=2…12, 13-message trace and invalid actions passed`);

async function browser(){
 const {chromium}=require('playwright'),b=await chromium.launch(),results=[],preview=process.env.NOTES_PREVIEW_URL||'http://127.0.0.1:8787/';
 const fixture=path.join(path.dirname(require.resolve('mermaid')),'mermaid.min.js');
 try{for(const width of [1280,390]){
  const p=await b.newPage({viewport:{width,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route(/^https?:/,r=>r.request().url().startsWith(preview)?r.continue():/mermaid.*\.js/.test(r.request().url())?r.fulfill({path:fixture}):/highlight\.min\.js/.test(r.request().url())?r.fulfill({path:root+'/dl/assets/highlight.min.js'}):r.abort());
  await p.goto(new URL('pcd/cap-16-algoritmi-distribuiti.html#s9',preview).href);
  await p.waitForFunction(()=>[...document.querySelectorAll('.mermaid')].every(e=>e.querySelector('svg')));
  const h=p.locator('#se-chang');await h.getByRole('button',{name:'Candida P2',exact:true}).click();
  for(let i=0;i<13;i++){assert(await h.getByRole('button',{name:'Consegna il prossimo',exact:true}).isVisible());await h.getByRole('button',{name:'Consegna il prossimo',exact:true}).click();if(i===6)assert.match(await h.getByRole('status').textContent(),/Leader eletto; annuncio in corso/)}
  assert.match(await h.getByRole('status').textContent(),/7 election \+ 6 leader\. Consegnati: 13\. In transito: 0\. Giro di annuncio concluso/);
  assert.deepEqual(await h.locator('[data-chang-state] tr td:last-child').allTextContents(),Array(6).fill('P7'));
  assert.equal(await h.locator('[data-chang-trace] tr').count(),13);
  assert.equal(await p.evaluate(()=>document.activeElement?.dataset.changAction),'reset','Keyboard focus survives final delivery');
  await h.screenshot({path:path.join(out,`chang-widget-${width}.png`)});
  await p.locator('#chang-static-trace summary').click();assert.equal(await p.locator('#chang-static-trace tbody tr').count(),13);
  await p.locator('#chang-static-trace').screenshot({path:path.join(out,`chang-static-trace-${width}.png`)});
  const region=p.locator('#chang-static-trace [role=region]');
  if(await region.evaluate(e=>e.scrollWidth>e.clientWidth+1)){await region.focus();await p.keyboard.press('ArrowRight');await p.waitForFunction(e=>e.scrollLeft>0,await region.elementHandle());await region.evaluate(e=>e.scrollLeft=e.scrollWidth)}
  await p.locator('#chang-static-trace').screenshot({path:path.join(out,`chang-static-trace-end-${width}.png`)});
  await h.getByRole('button',{name:'Reimposta',exact:true}).click();await h.getByRole('button',{name:'Tutti insieme',exact:true}).click();
  let received=0;while(await h.locator('[data-chang-queue] button').count()){await h.locator('[data-chang-queue] button').last().click();assert(++received<100)}
  assert.match(await h.getByRole('status').textContent(),/Giro di annuncio concluso/);
  assert.deepEqual(await h.locator('[data-chang-state] tr td:last-child').allTextContents(),Array(6).fill('P7'));
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);results.push({width,singleDeliveries:13,concurrentDeliveries:received,errors});await p.close();
 }
 const p=await b.newPage({javaScriptEnabled:false,viewport:{width:390,height:1000}});await p.route(/^https?:/,r=>r.request().url().startsWith(preview)?r.continue():r.abort());await p.goto(new URL('pcd/cap-16-algoritmi-distribuiti.html#s9',preview).href);
 assert.match(await p.locator('#se-chang').textContent(),/richiede JavaScript/);await p.locator('#chang-static-trace summary').click();assert.equal(await p.locator('#chang-static-trace tbody tr').count(),13);assert(await p.locator('[data-static-diagram^="pcd-chang-"] img').evaluateAll(a=>a.length===2&&a.every(i=>i.complete&&i.naturalWidth>0)));assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.close();
 fs.writeFileSync(path.join(out,'chang-test.json'),JSON.stringify({scenarios,singleInitiators:single,lateInitiations:1000,exactWorstCases:'N=2…12',results,noJavaScript:true},null,2));console.log('Desktop/mobile actual widget interactions and JavaScript-disabled static trace/images passed');
 }finally{await b.close()}
}
browser().catch(e=>{console.error(e);process.exitCode=1});
