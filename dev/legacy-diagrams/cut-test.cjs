const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {demo,graph,analyze,cases,statusLabels}=require('../../pcd/assets/consistent-cuts.js');
const {render,figure}=require('./cut-timeline.cjs'),{originalOffset,orderedHunks}=require('./build.cjs');
const root=path.resolve(__dirname,'../..'),out='/home/ybc/notes-legacy-review-artifacts';
const html=fs.readFileSync(path.join(root,'pcd/cap-16-algoritmi-distribuiti.html'),'utf8');
const copy=o=>JSON.parse(JSON.stringify(o)),key=ids=>[...ids].sort().join(',');
function permutations(a){if(!a.length)return [[]];return a.flatMap((x,i)=>permutations(a.filter((_,j)=>i!==j)).map(t=>[x,...t]))}
// Independent oracle: enumerate complete executions from the explicit five
// local/message constraints, then collect every prefix of those executions.
// Do not reuse graph(), analyze(), or their returned edges for the oracle.
const constraints=[['e1','e2'],['e2','e3'],['e4','e5'],['e5','e6'],['e2','e5']];
const events=['e1','e2','e3','e4','e5','e6'],linearizations=permutations(events).filter(p=>constraints.every(([a,b])=>p.indexOf(a)<p.indexOf(b)));
const feasible=new Set(linearizations.flatMap(p=>Array.from({length:7},(_,i)=>key(p.slice(0,i)))));
let consistent=0,invalid=0,localPrefixes=0;
for(let mask=0;mask<64;mask++){
 const subset=events.filter((_,i)=>mask&(1<<i)),s=new Set(subset);
 const localOK=[['e1','e2','e3'],['e4','e5','e6']].every(p=>p.every((id,i)=>!s.has(id)||p.slice(0,i).every(id=>s.has(id))));
 if(!localOK){assert(!feasible.has(key(subset)));continue}localPrefixes++;
 const prefixes=[subset.filter(e=>['e1','e2','e3'].includes(e)).length,subset.filter(e=>['e4','e5','e6'].includes(e)).length];
 const r=analyze(demo,prefixes);assert.equal(key(r.included),key(subset));assert.equal(r.consistent,feasible.has(key(subset)));
 const expected=s.has('e2')?(s.has('e5')?'delivered':'in-transit'):(s.has('e5')?'orphan':'not-sent');assert.equal(r.messages[0].status,expected);
 r.consistent?consistent++:invalid++;
}
assert.equal(localPrefixes,16);assert.equal(consistent,12);assert.equal(invalid,4);
assert.deepEqual(cases.map(c=>analyze(demo,c.prefixes).included),[['e1','e4','e5'],['e1','e2','e4'],['e1','e2','e4','e5']]);
assert.deepEqual(cases.map(c=>analyze(demo,c.prefixes).messages[0].status),['orphan','in-transit','delivered']);
for(const prefixes of [[],[0],[0,0,0],[-1,0],[0,4],[.5,0],[NaN,0],['1',0]])assert.throws(()=>analyze(demo,prefixes));
const bad=[];
let s=copy(demo);s.processes[1].events[0]='e1';bad.push(s);
s=copy(demo);s.processes[1].id='p1';bad.push(s);
s=copy(demo);s.processes[0].events[0]=undefined;bad.push(s);
s=copy(demo);s.processes[0].label='x'.repeat(25);bad.push(s);
s=copy(demo);s.messages[0].receive='absent';bad.push(s);
s=copy(demo);s.messages[0].receive='e3';bad.push(s);
s=copy(demo);s.messages.push({id:'another',send:'e2',receive:'e6'});bad.push(s);
s=copy(demo);s.messages.push({id:'m',send:'e3',receive:'e6'});bad.push(s);
s=copy(demo);s.messages.push({id:'cycle',send:'e6',receive:'e1'});bad.push(s);
for(const spec of bad)assert.throws(()=>graph(spec));
s=copy(demo);s.processes[0].events[0]='constructor';assert.equal(graph(s).ranks.constructor,0,'Object-prototype names are valid safe IDs');
for(const overrides of [{fontSize:9},{eventGap:119},{eventGap:241},{rowGap:100}])assert.throws(()=>render(demo,cases,overrides));
assert.throws(()=>render(demo,[cases[0],cases[0]]));
const r=render(demo,cases);assert.equal(r.svg,render(demo,cases).svg);assert.equal(r.svg,fs.readFileSync(path.join(root,'pcd/assets/diagrams/pcd-consistent-cuts.svg'),'utf8'));assert(html.includes(figure(r)));
const configs=[...html.matchAll(/LessonKit\.stateExplorer\('(#[^']+)', ([\s\S]*?)\);/g)].map(m=>({selector:m[1],config:vm.runInNewContext('('+m[2]+')',{}, {timeout:1000})}));
assert.equal(configs.length,2);let transitions=0;for(const {config} of configs){assert(config.states[config.start]);for(const st of Object.values(config.states))for(const [,to] of st.to||[]){assert(config.states[to],'Undefined explorer target '+to);transitions++}}
const singleInput=configs.find(c=>c.selector==='#se-snapshot').config;
for(const [from,to] of [['WHITE','RECEIVED_MARKER'],['RECEIVED_MARKER','TURNING_RED'],['TURNING_RED','SENDING_MARKERS'],['SENDING_MARKERS','SNAPSHOT_COMPLETE']])assert(singleInput.states[from].to.some(t=>t[1]===to),'A first marker on the only input must allow completion without another marker');
// Regress the source-order/document-order bug that previously made a valid
// two-figure patch fail. Neither operation changes the original registry.
const sources=require('./sources.cjs'),cut=sources.find(s=>s.id==='pcd-cut-events'),fifo=sources.find(s=>s.id==='pcd-snapshot-fifo');
assert(originalOffset(cut,html)<originalOffset(fifo,html));assert.equal(orderedHunks([{offset:20,text:'later'},{offset:10,text:'earlier'}]),'earlierlater');
console.log(`Cuts: ${linearizations.length} legal executions, all 64 subsets, 16 local-prefix cuts (12 valid / 4 invalid), ${bad.length+8+5} invalid input cases; ${transitions} defined conceptual transitions`);

async function browser(){
 const {chromium}=require('playwright'),b=await chromium.launch(),preview=process.env.NOTES_PREVIEW_URL||'http://127.0.0.1:8787/',results=[];fs.mkdirSync(out,{recursive:true});
 const mermaid=path.join(path.dirname(require.resolve('mermaid')),'mermaid.min.js');
 async function routes(p){await p.route(/^https?:/,q=>q.request().url().startsWith(preview)?q.continue():/mermaid.*\.js/.test(q.request().url())?q.fulfill({path:mermaid}):/highlight\.min\.js/.test(q.request().url())?q.fulfill({path:root+'/dl/assets/highlight.min.js'}):q.abort())}
 try{
  const p=await b.newPage({viewport:{width:1100,height:1200}});
  for(const [id,diagram] of [['default',r],['spacious',render(demo,cases,{eventGap:240,rowGap:200})]]){
   await p.setContent(diagram.svg);await p.evaluate(()=>document.fonts.ready);
   const checks=await p.evaluate(()=>{
    const svg=document.querySelector('svg'),vb=svg.viewBox.baseVal,labels=[...svg.querySelectorAll('text')];
    const rect=e=>{const b=e.getBBox(),m=e.getCTM();return {left:b.x+m.e,top:b.y+m.f,right:b.x+b.width+m.e,bottom:b.y+b.height+m.f}};
    // SVG screen translations include the body's margin, unlike viewBox units.
    const base=svg.getCTM();const boxes=labels.map(e=>({label:e.textContent,...rect(e)})).map(b=>({...b,left:b.left-base.e,right:b.right-base.e,top:b.top-base.f,bottom:b.bottom-base.f}));
    const outside=boxes.filter(b=>b.left<0||b.top<0||b.right>vb.width||b.bottom>vb.height),overlap=[],pathText=[];
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)overlap.push([a.label,b.label])}
    for(const path of svg.querySelectorAll('[data-message],[data-cut-line]')){const m=path.getCTM();for(let d=0;d<=path.getTotalLength();d+=1){const p=path.getPointAtLength(d),x=p.x+m.e-base.e,y=p.y+m.f-base.f;for(const box of boxes)if(x>box.left-.5&&x<box.right+.5&&y>box.top-.5&&y<box.bottom+.5)pathText.push([path.dataset.message||path.dataset.cutLine,box.label])}}
    const panels=[...svg.querySelectorAll('[data-cut]')].map(g=>({id:g.dataset.cut,events:[...g.querySelectorAll('[data-event]')].map(e=>({id:e.dataset.event,included:e.dataset.included,fill:e.getAttribute('fill'),x:+e.getAttribute('cx'),y:+e.getAttribute('cy')})),messages:[...g.querySelectorAll('[data-message]')].map(e=>({from:e.dataset.from,to:e.dataset.to,arrow:e.getAttribute('marker-end')}))}));
    const orthogonal=[...svg.querySelectorAll('[data-cut-line]')].every(e=>{const d=e.getAttribute('d');if(/[^ML\d .-]/.test(d))return false;const a=d.match(/-?\d+(?:\.\d+)?/g).map(Number);for(let i=2;i<a.length;i+=2)if(a[i]!==a[i-2]&&a[i+1]!==a[i-1])return false;return true});
    return {outside,overlap,pathText:[...new Set(pathText.map(v=>v.join(':')))],panels,orthogonal,xmlErrors:new DOMParser().parseFromString(svg.outerHTML,'image/svg+xml').querySelectorAll('parsererror').length};
   });
   assert.deepEqual(checks.outside,[],id);assert.deepEqual(checks.overlap,[],id);assert.deepEqual(checks.pathText,[],id);assert(checks.orthogonal);assert.equal(checks.xmlErrors,0);
   for(let i=0;i<3;i++){const panel=checks.panels[i],included=new Set(analyze(demo,cases[i].prefixes).included);assert.equal(panel.events.length,6);assert.deepEqual(panel.messages,[{from:'e2',to:'e5',arrow:'url(#cut-message-arrow)'}]);for(const e of panel.events){assert.equal(e.included,String(included.has(e.id)));assert.equal(e.fill,included.has(e.id)?'#1546B8':'#F3EFE3');const same=checks.panels[0].events.find(a=>a.id===e.id);assert.equal(e.x,same.x);assert.equal(e.y,same.y)}}
   await p.locator('svg').screenshot({path:path.join(out,'cuts-'+id+'.png')});results.push({id,...checks});
  }
  await p.close();
  const visits=[];
  for(const width of [1280,390]){
   const p=await b.newPage({viewport:{width,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await routes(p);await p.goto(new URL('pcd/cap-16-algoritmi-distribuiti.html#s14',preview).href);
   const h=p.locator('#cut-explorer');await p.waitForFunction(()=>document.querySelector('#cut-explorer').dataset.cutExplorer==='true');
   for(let i=0;i<=3;i++)for(let j=0;j<=3;j++){
    await h.locator('#cut-prefix-p1').selectOption(String(i));await h.locator('#cut-prefix-p2').selectOption(String(j));
    const a=analyze(demo,[i,j]);assert.equal(await h.getByRole('status').textContent(),(a.consistent?'Taglio consistente. ':'Taglio NON consistente. ')+`Inclusi: ${a.included.join(', ')||'nessuno'}.`);
    assert.equal(await h.locator('[data-cut-message]').textContent(),'Messaggio m: '+statusLabels[a.messages[0].status]+'.');assert.equal(await p.evaluate(()=>document.activeElement.id),'cut-prefix-p2');
   }
   for(const c of cases){await h.locator('#cut-case-'+c.id).click();assert.deepEqual(await h.locator('select').evaluateAll(es=>es.map(e=>+e.value)),c.prefixes);assert.equal(await p.evaluate(()=>document.activeElement.id),'cut-case-'+c.id);await h.screenshot({path:path.join(out,`cuts-widget-${c.id}-${width}.png`)})}
   const f=p.locator('[data-static-plot="pcd-consistent-cuts"]'),region=f.locator('[role=region]');assert(await f.locator('img').evaluate(i=>i.complete&&i.naturalWidth===700&&Math.abs(i.getBoundingClientRect().width-700)<1));
   await f.screenshot({path:path.join(out,`cuts-figure-${width}.png`)});
   if(width===390){await region.focus();await p.keyboard.press('ArrowRight');await p.waitForFunction(e=>e.scrollLeft>0,await region.elementHandle())}
   // These are explanatory local-state browsers, not an executable snapshot.
   // Exercise every actual transition button, including the old undefined RED.
   for(const {selector,config} of configs){const h=p.locator(selector);for(const [name,st] of Object.entries(config.states))for(let i=0;i<(st.to||[]).length;i++){
    await h.locator('.lk-se-grid').getByRole('button',{name,exact:true}).click();await h.locator('.lk-se-trans button').nth(i).click();assert.equal(await h.locator('.lk-se-cur b').textContent(),st.to[i][1]);assert.equal(await h.locator('h4').textContent(),st.to[i][1]);
   }await h.screenshot({path:path.join(out,selector.slice(1)+'-'+width+'.png')})}
   assert.deepEqual(errors,[]);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));visits.push({width,cuts:16,presets:3,transitions,errors});await p.close();
  }
  const nojs=await b.newPage({javaScriptEnabled:false,viewport:{width:390,height:1000}});await routes(nojs);await nojs.goto(new URL('pcd/cap-16-algoritmi-distribuiti.html#s14',preview).href);assert.match(await nojs.locator('#cut-explorer').textContent(),/richiede JavaScript/);assert(await nojs.locator('[data-static-plot="pcd-consistent-cuts"] img').evaluate(e=>e.complete&&e.naturalWidth===700));assert.match(await nojs.locator('[data-static-plot="pcd-consistent-cuts"] figcaption').textContent(),/G3 = \{e1,e2,e4,e5\}/);assert(await nojs.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await nojs.close();
  fs.writeFileSync(path.join(out,'cut-test.json'),JSON.stringify({linearizations:linearizations.length,subsets:64,localPrefixes,consistent,invalid,results,visits,noJavaScript:true},null,2));console.log('Native timeline geometry/text/arrow checks, all cuts and all conceptual transitions on desktop/mobile, keyboard scroll/focus and no-JavaScript fallback passed');
 }finally{await b.close()}
}
browser().catch(e=>{console.error(e);process.exitCode=1});
