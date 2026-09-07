const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {advance,append,upToDate,scenario}=require('./raft-commit.cjs'),{markup}=require('./raft-commit-traces.cjs');
const root=path.resolve(__dirname,'../..'),out='/home/ybc/notes-legacy-review-artifacts';
const entry=term=>({term,command:'term '+term});
const input={term:4,log:[1,2,4].map(entry),leader:'S1',matches:{S1:3,S2:2,S3:2,S4:1,S5:0},commitIndex:1};
assert.equal(advance(input).commitIndex,1);assert.equal(advance({...input,matches:{...input.matches,S2:3,S3:3}}).commitIndex,3);
function tuples(n,max,prefix=[]){if(!n)return [prefix];return Array.from({length:max+1},(_,v)=>tuples(n-1,max,[...prefix,v])).flat()}
function logs(n,min=1,prefix=[]){if(!n)return [prefix];return Array.from({length:4-min},(_,v)=>logs(n-1,min+v,[...prefix,min+v])).flat()}
let checks=0;
for(let length=0;length<=4;length++)for(const terms of logs(length))for(let term=Math.max(1,terms.at(-1)||1);term<=4;term++)for(let n=1;n<=5;n++)for(const values of tuples(n-1,length))for(let ci=0;ci<=length;ci++){
 const indexes=[length,...values],matches=Object.fromEntries(indexes.map((v,i)=>['S'+(i+1),v])),q=Math.floor(n/2)+1;
 // Independent oracle: the quorum order statistic gives the largest replicated
 // prefix. Scan backward within that prefix for a current-term entry.
 const bound=[...indexes].sort((a,b)=>b-a)[q-1];let expected=ci;
 for(let k=bound;k>ci;k--)if(terms[k-1]===term){expected=k;break}
 const r=advance({term,log:terms.map(entry),leader:'S1',matches,commitIndex:ci});assert.equal(r.commitIndex,expected);assert.equal(r.quorum,q);assert.deepEqual(r.newlyCommitted,Array.from({length:expected-ci},(_,i)=>ci+i+1));checks++;
}
let voteChecks=0;for(const a of [[],[1],[1,2],[1,2,2],[1,3]])for(const b of [[],[1],[1,2],[1,2,2],[1,3]]){
 const expected=(a.at(-1)||0)>(b.at(-1)||0)||((a.at(-1)||0)===(b.at(-1)||0)&&a.length>=b.length);assert.equal(upToDate(a.map(entry),b.map(entry)),expected);voteChecks++;
}
const state={term:3,log:[1,2,3].map(entry),commitIndex:1};const rpc={term:4,prevIndex:1,prevTerm:1,entries:[],leaderCommit:3};
let r=append(state,rpc);assert(r.success);assert.deepEqual(r.state.log,state.log);assert.equal(r.state.commitIndex,1,'Heartbeat only proves the matched prefix');
r=append(state,{...rpc,prevIndex:3,prevTerm:3});assert.equal(r.state.commitIndex,3);
r=append(state,{...rpc,prevIndex:2,prevTerm:1});assert(!r.success);assert.equal(r.state.term,4);assert.deepEqual(r.state.log,state.log);assert.equal(r.state.commitIndex,1);
r=append(state,{...rpc,term:2});assert(!r.success);assert.deepEqual(r.state,state);
r=append(state,{...rpc,entries:[entry(4)]});assert(r.success);assert.deepEqual(r.state.log,[1,4].map(entry));assert.equal(r.state.commitIndex,2);
assert.deepEqual(append(r.state,{...rpc,entries:[entry(4)]}).state,r.state,'Duplicate successful RPC is idempotent');
assert.deepEqual(state,{term:3,log:[1,2,3].map(entry),commitIndex:1},'No input mutation');
assert.throws(()=>append({...state,commitIndex:2},{...rpc,entries:[entry(4)]}),/committed/);
assert.throws(()=>append(state,{...rpc,prevIndex:2,prevTerm:2,entries:[{term:3,command:'different'}]}),/different commands/);
const bad=[{matches:{S2:3}},{matches:{S1:2}},{matches:{S1:3,S2:4}},{commitIndex:4},{term:2},{log:[2,1].map(entry)},{matches:[]},{term:NaN}];for(const fields of bad)assert.throws(()=>advance({...input,...fields}));
const s=scenario();assert.deepEqual(s.states.map(v=>v.result.commitIndex),[1,3]);assert.deepEqual(s.states[1].result.newlyCommitted,[2,3]);assert.deepEqual(s.overwrite.eligibleByLogBefore,['S2','S3','S4','S5']);assert.deepEqual(s.eligibleByLogAfter,['S4','S5']);assert.deepEqual(s.overwrite.logs.slice(1).map(xs=>xs.map(x=>x.term)),[[1,3],[1,3],[1,3],[1,3]]);
const html=fs.readFileSync(root+'/pcd/cap-16-algoritmi-distribuiti.html','utf8');assert(html.includes(markup()));assert(!/class="mermaid"|mermaid.*\.js/.test(html));
async function browser(){const {chromium}=require('playwright'),b=await chromium.launch(),results=[],base='http://127.0.0.1:8787/';try{
 const {parse}=await import('../contracts/node_modules/parse5/dist/index.js'),errors=[];parse(html,{onParseError:e=>errors.push(e)});assert.deepEqual(errors,[],'HTML5 parser');
 for(const js of [true,false])for(const width of [1280,390]){const p=await b.newPage({viewport:{width,height:1000},javaScriptEnabled:js}),errors=[],requests=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push(r.url()));
  await p.route(/^https?:/,r=>r.request().url().startsWith(base)?r.continue():/highlight\.min\.js/.test(r.request().url())?r.fulfill({path:root+'/dl/assets/highlight.min.js'}):r.abort());await p.goto(base+'pcd/cap-16-algoritmi-distribuiti.html#s20');
  assert(!requests.some(u=>/mermaid/i.test(u)));assert(await p.locator('[data-static-diagram="pcd-raft-commit"] img').evaluate(i=>i.complete&&i.naturalWidth>0));
  assert.deepEqual(await p.locator('[id]').evaluateAll(es=>es.map(e=>e.id).filter((id,i,ids)=>ids.indexOf(id)!==i)),[],'Unique chapter IDs');
  assert.deepEqual(await p.locator('path,circle,rect,ellipse,polygon,polyline,line,text,tspan').evaluateAll(es=>es.filter(e=>e.namespaceURI!=='http://www.w3.org/2000/svg').map(e=>e.outerHTML)),[],'No SVG elements parsed as HTML');
  assert.deepEqual(await p.locator('[data-raft-result]').allTextContents(),['Maggioranza: 3. commitIndex: 1 → 1. Nuovi indici impegnati: nessuno.','Maggioranza: 3. commitIndex: 1 → 3. Nuovi indici impegnati: 2, 3.']);
  const detail=p.locator('[data-raft-overwrite]');await detail.locator('summary').click();assert(await detail.locator('table').isVisible());
  for(const name of ['old-majority','current-majority'])await p.locator(`[data-raft-case="${name}"]`).screenshot({path:path.join(out,`raft-${name}-${width}-${js?'js':'nojs'}.png`)});
  await detail.screenshot({path:path.join(out,`raft-overwrite-${width}-${js?'js':'nojs'}.png`)});
  let tabs=0;if(js)for(const t of await p.locator('#s20 .lk-tabs').all()){const buttons=await t.locator('.lk-tab').all(),panels=await t.locator('.lk-tabpanel').all();assert.equal(buttons.length,panels.length);for(const [i,button]of buttons.entries()){await button.click();for(const [j,panel]of panels.entries())assert.equal(await panel.isVisible(),i===j,'Tab selects exactly its corresponding panel');tabs++}}
  if(width===390)for(const region of [p.locator('[data-static-diagram="pcd-raft-commit"] [role=region]'),p.locator('[data-raft-case="old-majority"] [role=region]').first()]){if(await region.evaluate(e=>e.scrollWidth>e.clientWidth)){await region.focus();await p.keyboard.press('ArrowRight');await p.waitForTimeout(150);assert(await region.evaluate(e=>e.scrollLeft>0))}}
  assert.deepEqual(errors,[]);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));results.push({width,js,tabs,errors});await p.close();
 }
 fs.writeFileSync(out+'/raft-commit-test.json',JSON.stringify({checks,voteChecks,appendChecks:9,invalidInputs:bad.length,results},null,2)+'\n');console.log(`${checks} commit states checked against quorum order-statistic oracle; ${voteChecks} freshness comparisons; follower conflict/heartbeat/stale RPC checks; desktop/mobile and no-JS passed`);
 }finally{await b.close()}}
browser().catch(e=>{console.error(e);process.exitCode=1});
