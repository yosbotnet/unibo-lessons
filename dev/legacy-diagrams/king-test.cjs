const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {Model,scenarios,trace}=require('../../pcd/assets/phase-king.js'),{markup}=require('./king-traces.cjs');
const root=path.resolve(__dirname,'../..'),out='/home/ybc/notes-legacy-review-artifacts';
const copy=o=>JSON.parse(JSON.stringify(o));
const bits=(n,mask)=>Array.from({length:n},(_,i)=>(mask>>i)&1);
const messages=(pid,targets,mask)=>Object.fromEntries(targets.map((to,i)=>[pid+':'+to,(mask>>i)&1]));
// Independent round oracle: reconstruct each receiver's vector from the
// sender's old preference or the explicit adversarial message schedule.
function oracle(inputs,f,faulty,actions){
 let values=inputs.slice(),pending=null;const n=values.length,correct=values.map((_,i)=>i+1).filter(i=>!faulty.includes(i)),records=[];
 const recv=(from,to,normal,overrides)=>faulty.includes(from)?(overrides[from+':'+to]??0):normal;
 for(let round=0;round<2*(f+1);round++){
  const king=Math.floor(round/2)+1,a=actions[round]||{},rows=[];
  if(round%2===0){pending={};for(const pid of correct){const vector=values.map((v,i)=>recv(i+1,pid,v,a)),zeros=vector.filter(v=>v===0).length,candidate=zeros>=n-zeros?0:1;pending[pid]={vector,majority:candidate,multiplicity:candidate===0?zeros:n-zeros};rows.push({pid,...pending[pid],kingValue:null,keep:null,before:values[pid-1],after:null})}}
  else{for(const pid of correct){const q=pending[pid],kingValue=recv(king,pid,pending[king]?.majority,a),keep=2*q.multiplicity>n+2*f;rows.push({pid,...q,kingValue,keep,before:values[pid-1],after:keep?q.majority:kingValue})}for(const r of rows)values[r.pid-1]=r.after}
  records.push(rows);
 }
 return {records,values:correct.map(i=>values[i-1]),correct};
}
function runChecked(spec,actions,full=true){const m=new Model(spec);for(const a of actions)m.next(a);const correct=m.correct,result=correct.map(i=>m.decisions[i-1]);assert(m.complete);assert.equal(new Set(result).size,1,'Agreement under N > 4f');const initial=correct.map(i=>spec.inputs[i-1]);if(new Set(initial).size===1)assert.equal(result[0],initial[0],'Strong correct-input validity');assert(result.every(v=>v===0||v===1));if(full){const o=oracle(spec.inputs,spec.f,spec.faulty,actions);for(let i=0;i<m.history.length;i++)assert.deepEqual(m.history[i].rows.filter(r=>correct.includes(r.pid)).map(({tie,...r})=>r),o.records[i]);assert.deepEqual(result,o.values)}return m}
for(const s of scenarios){const m=trace(s),o=oracle(s.inputs,s.f,s.faulty,s.actions);for(let i=0;i<4;i++)assert.deepEqual(m.history[i].rows.filter(r=>m.correct.includes(r.pid)).map(({tie,...r})=>r),o.records[i]);assert.deepEqual(m.correct.map(i=>m.decisions[i-1]),o.values)}
assert.deepEqual(trace(scenarios[0]).correct.map(i=>trace(scenarios[0]).decisions[i-1]),[1,1,1,1]);
assert.deepEqual(trace(scenarios[1]).correct.map(i=>trace(scenarios[1]).decisions[i-1]),[0,0,0,0]);
assert.deepEqual(trace(scenarios[2]).correct.map(i=>trace(scenarios[2]).decisions[i-1]),[0,1,1]);
assert(trace(scenarios[2]).history[3].rows.filter(r=>r.pid!==2).every(r=>r.multiplicity===3&&!r.keep),'Equality with threshold must not preserve the old value');
const invalid=[{inputs:[0]},{inputs:[0,2],f:0},{inputs:[0,1],f:-1},{inputs:[0,1],f:2},{inputs:[0,1],f:0,faulty:[1]},{inputs:[0,1,0,1,0],f:1,faulty:[1,1]},{inputs:[0,1,0,1],f:1},{inputs:[0,1,0,1,0],f:1,faulty:[6]}];
for(const s of invalid)assert.throws(()=>new Model(s));
const reject=new Model(scenarios[0]);for(const a of [null,[],{'1:3':0},{'2:9':0},{'2:3':2},{'2:3':'0'},{'oops':0}]){assert.throws(()=>reject.next(a));assert.equal(reject.round,0)}
const returned=reject.next({'2:1':null});returned.rows[0].vector[0]=99;assert.notEqual(reject.history[0].rows[0].vector[0],99);assert.throws(()=>reject.next({'2:1':0}),'Only the current king sends in round 2');
while(!reject.complete)reject.next();assert.throws(()=>reject.next());
let exhaustive=0;
// Exhaust all N=5 binary inputs of correct processes, one Byzantine identity,
// all first-round equivocations in both phases, and every equivocation by a
// Byzantine king. Omissions map to 0, so binary assignments cover their effects.
for(let faulty=1;faulty<=5;faulty++){
 const correct=[1,2,3,4,5].filter(i=>i!==faulty),kingMasks=faulty<=2?16:1;
 for(let input=0;input<16;input++)for(let a=0;a<16;a++)for(let b=0;b<16;b++)for(let k=0;k<kingMasks;k++){
  const inputs=Array(5).fill(0);correct.forEach((pid,i)=>inputs[pid-1]=(input>>i)&1);
  const actions=[messages(faulty,correct,a),faulty===1?messages(faulty,correct,k):{},messages(faulty,correct,b),faulty===2?messages(faulty,correct,k):{}];
  runChecked({inputs,f:1,faulty:[faulty]},actions,false);exhaustive++;
 }
 console.log(`Exhaustive N=5: Byzantine P${faulty} completed (${exhaustive} executions)`);
}
for(let mask=0;mask<32;mask++)runChecked({inputs:bits(5,mask),f:1,faulty:[]},[{},{},{},{}]);
let seed=881239;const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n};
let randomRounds=0;for(let i=0;i<1000;i++){
 const n=2+rand(8),f=rand(Math.floor((n-1)/4)+1),faulty=[];while(faulty.length<f){const pid=1+rand(n);if(!faulty.includes(pid))faulty.push(pid)}const inputs=Array.from({length:n},()=>rand(2)),actions=[];
 for(let r=0;r<2*(f+1);r++){const action={};for(const pid of faulty)if(r%2===0||pid===Math.floor(r/2)+1)for(let to=1;to<=n;to++){const v=rand(3);action[pid+':'+to]=v===2?null:v}actions.push(action)}
 runChecked({inputs,f,faulty},actions);randomRounds+=actions.length;
}
assert.equal(exhaustive,143360);assert(fs.readFileSync(path.join(root,'pcd/cap-16-algoritmi-distribuiti.html'),'utf8').includes(markup()));
console.log(`Phase king: ${exhaustive} exhaustive one-fault executions, 32 fault-free inputs, 1000 seeded executions (${randomRounds} rounds) with independent vector/threshold oracle; exact N=4 counterexample passed`);

async function browser(){const {chromium}=require('playwright'),b=await chromium.launch(),preview=process.env.NOTES_PREVIEW_URL||'http://127.0.0.1:8787/',results=[];fs.mkdirSync(out,{recursive:true});const mermaid=path.join(path.dirname(require.resolve('mermaid')),'mermaid.min.js');
 async function route(p){await p.route(/^https?:/,r=>r.request().url().startsWith(preview)?r.continue():/mermaid.*\.js/.test(r.request().url())?r.fulfill({path:mermaid}):/highlight\.min\.js/.test(r.request().url())?r.fulfill({path:root+'/dl/assets/highlight.min.js'}):r.abort())}
 try{for(const width of [1280,390]){
  const p=await b.newPage({viewport:{width,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await route(p);await p.goto(new URL('pcd/cap-16-algoritmi-distribuiti.html#s19',preview).href);await p.waitForFunction(()=>document.querySelector('#phase-king').dataset.phaseKing==='true');const h=p.locator('#phase-king');
  for(const s of scenarios){await h.locator('#king-scenario').selectOption(s.id);assert.equal(await p.evaluate(()=>document.activeElement.id),'king-scenario');const m=trace(s);
   for(let round=0;round<4;round++){
    await h.locator('#king-next').click();const rows=await h.locator('[data-king-rows] tr').evaluateAll(es=>es.map(e=>[...e.children].map(c=>c.textContent)));
    assert.deepEqual(rows,m.history[round].rows.filter(r=>m.correct.includes(r.pid)).map(r=>['P'+r.pid,'['+r.vector+']',r.majority+' / '+r.multiplicity,String(r.kingValue??'∅'),r.keep===null?'attendi':r.keep?'mantieni':'adotta king',String(r.after??r.before)]));
    assert.match(await h.getByRole('status').textContent(),new RegExp(`Round ${round+1}/4`));assert.equal(await p.evaluate(()=>document.activeElement.id),round===3?'king-reset':'king-next');
    assert(await h.locator('td,th').evaluateAll(es=>es.every(e=>e.scrollWidth<=e.clientWidth+1)),'Cell text remains inside its column');
    if(width===1280)assert(await h.locator('[role=region]').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'All state columns fit on desktop');
    if(round===3||s.id==='converge'&&round===0)await h.screenshot({path:path.join(out,`king-${s.id}-round${round+1}-${width}.png`)});
   }
   assert(await h.locator('#king-next').isDisabled());assert.match(await h.locator('[data-king-decisions]').textContent(),s.id==='outside'?/DISACCORDO/:/Accordo/);await h.locator('#king-reset').click();assert.equal(await h.locator('[data-king-rows]').count(),0);assert(!(await h.locator('#king-next').isDisabled()));
  }
  let rows=0,scrolls=0;for(const d of await p.locator('[data-king-trace]').all()){await d.locator('summary').click();rows+=await d.locator('tbody tr').count();const region=d.locator('[role=region]');if(await region.evaluate(e=>e.scrollWidth>e.clientWidth+1)){await region.focus();await p.keyboard.press('ArrowRight');await p.waitForFunction(e=>e.scrollLeft>0,await region.elementHandle());scrolls++}await d.screenshot({path:path.join(out,`king-trace-${await d.getAttribute('data-king-trace')}-${width}.png`)})}
  assert.equal(rows,22);assert(await p.locator('[data-king-trace] td,[data-king-trace] th').evaluateAll(es=>es.every(e=>e.scrollWidth<=e.clientWidth+1)),'Static trace columns contain their text');const figure=p.locator('[data-static-diagram="pcd-phase-king"]');assert(await figure.locator('img').evaluate(i=>i.complete&&i.naturalWidth>0&&Math.abs(i.getBoundingClientRect().width-i.naturalWidth)<1));await figure.screenshot({path:path.join(out,`king-figure-${width}.png`)});
  assert.deepEqual(errors,[]);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));results.push({width,scenarios:3,rounds:12,traceRows:rows,scrolls,errors});await p.close();
 }
 const nojs=await b.newPage({javaScriptEnabled:false,viewport:{width:390,height:1000}});await route(nojs);await nojs.goto(new URL('pcd/cap-16-algoritmi-distribuiti.html#s19',preview).href);assert.match(await nojs.locator('#phase-king').textContent(),/richiede JavaScript/);for(const d of await nojs.locator('[data-king-trace]').all())await d.locator('summary').click();assert.equal(await nojs.locator('[data-king-trace] tbody tr').count(),22);assert(await nojs.locator('[data-static-diagram="pcd-phase-king"] img').evaluate(i=>i.complete&&i.naturalWidth>0));assert(await nojs.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await nojs.close();
 fs.writeFileSync(path.join(out,'king-test.json'),JSON.stringify({exhaustive,faultFreeInputs:32,randomExecutions:1000,randomRounds,oracle:'independent receiver vectors and integer threshold test',counterexample:[0,1,1],results,noJavaScript:true},null,2));console.log('Desktop/mobile phase-king controls, all vectors/counts/decisions, focus, keyboard-scroll and 22 static rows without JavaScript passed');
 }finally{await b.close()}
}
browser().catch(e=>{console.error(e);process.exitCode=1});
