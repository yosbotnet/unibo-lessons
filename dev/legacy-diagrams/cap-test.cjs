const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {Model,analyze,scenarios,step,trace}=require('../../ds/assets/cap-register.js'),{markup}=require('./cap-traces.cjs');
const root=path.resolve(__dirname,'../..'),out='/home/ybc/notes-legacy-review-artifacts',html=fs.readFileSync(root+'/ds/DS-C1.html','utf8');
// Independent single-write interval oracle, not the implementation's permutation search.
function oracle(ops,initial=0){const w=ops.find(o=>o.kind==='write'),r=ops.find(o=>o.kind==='read');if(!r||r.end===null)return true;if(!w||r.end<w.start)return r.result===initial;if(w.end<r.start)return r.result===w.input;return r.result===initial||r.result===w.input}
let intervals=0;
for(let ws=1;ws<=8;ws++)for(let we=ws+1;we<=8;we++)for(let rs=1;rs<=8;rs++)for(let re=rs+1;re<=8;re++){
 if(new Set([ws,we,rs,re]).size!==4)continue;
 for(const initial of [0,4])for(const input of [1,4])for(const result of [0,1,4,9]){
  const ops=[{kind:'write',start:ws,end:we,input},{kind:'read',start:rs,end:re,result}];assert.equal(analyze(ops,initial).linearizable,oracle(ops,initial));assert.equal(analyze([...ops].reverse(),initial).linearizable,oracle(ops,initial));intervals++;
 }
}
const finals=scenarios.map(s=>trace(s).at(-1));assert.deepEqual(finals.map(s=>s.analysis.linearizable),[true,false,true,true,true,true]);assert.deepEqual(finals.map(s=>s.operations.find(o=>o.kind==='read').result),[0,0,1,0,0,1]);
const stale=trace(scenarios[1]);assert(stale.slice(2).every(s=>!s.analysis.linearizable));assert.deepEqual(stale.at(-1).values,[1,1]);
const waiting=trace(scenarios[2]);assert(waiting.slice(2,5).every(s=>s.analysis.pending.includes('read')));
const e0=new Model(),e1=new Model();for(const m of [e0,e1])m.setConnected(false);e1.write();e0.read();e1.read();assert.deepEqual(e0.observationsG2(),e1.observationsG2());
let prefixes=0,violations=0;
// Every permitted action prefix with at most four network changes, one write,
// one read and actual message deliveries (both policies, all orderings).
function visit(policy,actions,changes){const m=new Model(policy);for(const a of actions)step(m,a);prefixes++;assert.equal(m.analysis.linearizable,oracle(m.operations));if(policy==='authority')assert(m.analysis.linearizable);else if(!m.analysis.linearizable)violations++;
 const clocks=m.events.map(e=>e.time);assert.equal(new Set(clocks).size,clocks.length);assert(m.operations.every(o=>o.end===null||o.end>o.start));
 const next=[];if(!m.operations.some(o=>o.kind==='write'))next.push('write');if(!m.operations.some(o=>o.kind==='read'))next.push('read');if(changes<4)next.push(m.connected?'partition':'heal');if(m.connected&&m.queue.length)next.push('deliver');
 for(const a of next)visit(policy,[...actions,a],changes+(['partition','heal'].includes(a)?1:0));
}
for(const p of ['local','authority'])visit(p,[],0);assert(violations>0);
for(const args of [['bad'],['local',-1],['authority',100]])assert.throws(()=>new Model(...args));
for(const ops of [[null],[{kind:'read',start:1,end:1,result:0}],[{kind:'write',start:1,end:null,input:1}],[{kind:'write',start:1,end:3,input:1},{kind:'read',start:3,end:4,result:1}]])assert.throws(()=>analyze(ops));
const reject=new Model();assert.throws(()=>reject.setConnected(true));assert.throws(()=>reject.write(100));assert.throws(()=>reject.deliver('m1'));const returned=reject.write();returned.input=42;assert.equal(reject.operations[0].input,1);assert.throws(()=>reject.write());reject.setConnected(false);const before=reject.snapshot();assert.throws(()=>reject.deliver('m1'));assert.deepEqual(reject.snapshot(),before);reject.setConnected(true);reject.deliver('m1');assert.throws(()=>reject.deliver('m1'));reject.read();assert.throws(()=>reject.read());
assert(html.includes(markup()));let config;vm.runInNewContext(html.match(/<script>\s*CapRegister[\s\S]*?<\/script>/)[0].replace(/^<script>|<\/script>$/g,''),{CapRegister:{mount(){}},LessonKit:{stateExplorer:(sel,c)=>{config=c}}});for(const s of Object.values(config.states))for(const [,target]of s.to)assert(config.states[target]);
console.log(`CAP: ${intervals} interval/value cases (both input orders), ${prefixes} action prefixes; ${violations} local-policy violating prefixes; six exact traces and indistinguishable G2 observations passed`);
async function browser(){const {chromium}=require('playwright'),b=await chromium.launch(),preview=process.env.NOTES_PREVIEW_URL||'http://127.0.0.1:8787/',results=[];fs.mkdirSync(out,{recursive:true});const mermaid=path.join(path.dirname(require.resolve('mermaid')),'mermaid.min.js');
 async function route(p){await p.route(/^https?:/,r=>r.request().url().startsWith(preview)?r.continue():/mermaid.*\.js/.test(r.request().url())?r.fulfill({path:mermaid}):/highlight\.min\.js/.test(r.request().url())?r.fulfill({path:root+'/dl/assets/highlight.min.js'}):r.abort())}
 try{for(const width of [1280,390]){
  const p=await b.newPage({viewport:{width,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await route(p);await p.goto(new URL('ds/DS-C1.html',preview).href);await p.waitForFunction(()=>document.querySelector('#cap-register').dataset.capRegister==='true');const h=p.locator('#cap-register');
  for(const s of scenarios){await h.locator('#cap-policy').selectOption(s.policy);assert.equal(await p.evaluate(()=>document.activeElement.id),'cap-policy');const expected=trace(s);
   for(let i=0;i<s.actions.length;i++){
    const action=s.actions[i],id=action==='deliver'?'#cap-deliver-'+expected[i-1].queue[0].id:'#cap-'+(['heal','partition'].includes(action)?'network':action);await h.locator(id).click();assert.equal(await p.evaluate(()=>document.activeElement.id),'cap-reset');const state=expected[i];
    assert.equal((await h.locator('[data-cap-verdict]').textContent()).includes('NOT linearizable'),!state.analysis.linearizable);
    assert.deepEqual(await h.locator('[data-cap-operations] tr').evaluateAll(es=>es.map(e=>[...e.children].map(c=>c.textContent))),state.operations.map(o=>[o.kind==='write'?'write(1) at G1':'read at G2',String(o.start),String(o.end??'pending'),o.end===null?'—':String(o.result)]));
    for(const q of state.queue)assert.equal(await h.locator('#cap-deliver-'+q.id).isDisabled(),!state.connected);
    if(state.analysis.pending.length){assert.match(await h.textContent(),/finite pause alone is not an availability proof/);if(s.id==='wait'&&i===2)await h.screenshot({path:path.join(out,`cap-pending-${width}.png`)})}
   }
   assert(await h.locator('th,td').evaluateAll(es=>es.every(e=>e.scrollWidth<=e.clientWidth+1)));
   await h.screenshot({path:path.join(out,`cap-${s.id}-${width}.png`)});await h.locator('#cap-reset').click();assert.equal(await h.locator('[data-cap-operations] tr').count(),0);
  }
  await h.locator('#cap-policy').selectOption('local');await h.locator('#cap-witness').focus();await p.keyboard.press('Enter');assert.match(await h.locator('[data-cap-verdict]').textContent(),/NOT linearizable/);
  let scrolls=0;async function scroll(region){if(await region.evaluate(e=>e.scrollWidth>e.clientWidth+1)){await region.focus();await p.keyboard.press('ArrowRight');await p.waitForFunction(e=>e.scrollLeft>0,await region.elementHandle());scrolls++}}
  await scroll(h.locator('[role=region]'));let rows=0;for(const d of await p.locator('[data-cap-trace]').all()){await d.locator('summary').click();rows+=await d.locator('tbody tr').count();await scroll(d.locator('[role=region]'));await d.screenshot({path:path.join(out,`cap-trace-${await d.getAttribute('data-cap-trace')}-${width}.png`)})}assert.equal(rows,24);assert(await p.locator('[data-cap-trace] th,[data-cap-trace] td').evaluateAll(es=>es.every(e=>e.scrollWidth<=e.clientWidth+1)));
  for(const id of ['ds-cap-policy','ds-cap-proof']){const f=p.locator(`[data-static-diagram="${id}"]`);assert(await f.locator('img').evaluate(i=>i.complete&&i.naturalWidth>0));await f.screenshot({path:path.join(out,`${id}-${width}.png`)})}
  const explorer=p.locator('#cap-tradeoff');let transitions=0;
  const transition=label=>explorer.locator('.lk-se-trans').getByRole('button',{name:new RegExp('^'+label+' → ')}).click();
  for(const branch of ['Preserve linearizability','Serve independently']){await transition('Communication unavailable or suspected');await transition(branch);await transition('Communication restored');await transition(branch==='Preserve linearizability'?'Protocol ready':'Recovery obligations met');transitions+=4}
  await transition('Communication unavailable or suspected');await transition('Communication restored');transitions+=2;
  assert.deepEqual(errors,[]);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));results.push({width,scenarios:6,traceRows:rows,scrolls,transitions,errors});await p.close();
 }
 const nojs=await b.newPage({javaScriptEnabled:false,viewport:{width:390,height:1000}});await route(nojs);await nojs.goto(new URL('ds/DS-C1.html',preview).href);assert.match(await nojs.locator('#cap-register').textContent(),/JavaScript/);for(const d of await nojs.locator('[data-cap-trace]').all())await d.locator('summary').click();assert.equal(await nojs.locator('[data-cap-trace] tbody tr').count(),24);for(const i of await nojs.locator('[data-static-diagram] img').all())assert(await i.evaluate(i=>i.complete&&i.naturalWidth>0));assert(await nojs.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await nojs.close();
 fs.writeFileSync(path.join(out,'cap-test.json'),JSON.stringify({intervals,ordersPerCase:2,prefixes,violations,results,noJavaScript:true},null,2));console.log('CAP desktop/mobile: six interactive traces, exact operation rows, delivery restrictions, keyboard/focus/scroll, all policy-map transitions and 24 no-JS trace rows passed');
 }finally{await b.close()}
}
browser().catch(e=>{console.error(e);process.exitCode=1});
