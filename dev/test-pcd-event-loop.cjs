const {Loop,scenarios}=require(require('path').join(__dirname,'..','pcd-next','assets','event-loop-lab.js'));
const assert=require('assert');
// exhaustive: every interleaving of loop steps and worker completion
function explore(id){const finals=new Map();let count=0;
 function rec(seq){const L=new Loop(id);for(const a of seq){if(a==='s')L.step();else L.complete(L.bg[0].id)}
  const acts=[];if(L.canStep())acts.push('s');if(L.bg.length)acts.push('c');
  if(!acts.length||seq.length>60){count++;const key=L.trace.join(',')+' | x='+L.vars.x+' | out='+L.out.join(',')+(L.bg.length?' | worker pending':'');finals.set(key,(finals.get(key)||0)+1);return}
  // also treat "stop here forever" as a final when only 'c' is possible (worker never completes)
  if(!L.canStep()&&L.bg.length){const key=L.trace.join(',')+' | x='+L.vars.x+' | worker mai completato';finals.set(key,(finals.get(key)||0)+1)}
  for(const a of acts)rec(seq.concat(a))}
 rec([]);return {finals,count}}
for(const id of ['callback','promise','await']){const r=explore(id);console.log(id,r.count,'runs');for(const [k,v] of r.finals)console.log('   ',k,'x',v);
 for(const k of r.finals.keys()){assert(k.startsWith('L1,L3,L2 | x=11')||k.startsWith('L1,L3 | x=1'),k)}}
for(const [id,exp] of [['var','3,3,3'],['let','0,1,2'],['micro','A,D,C,B']]){const L=new Loop(id).runAll();console.log(id,L.out.join(','),'bindings',L.bindings.map(b=>b.name+'='+b.value).join(' '),'cycles',L.cycle);assert.strictEqual(L.out.join(','),exp);assert(!L.canStep()&&!L.bg.length)}
// the worker completing before L3 still yields L1, L3, L2: complete right after asyncTask call
let L=new Loop('callback');L.step();L.step();L.complete(L.bg[0].id);assert.strictEqual(L.tasks.length,1);L.runAll();assert.deepStrictEqual(L.trace,['L1','L3','L2']);
console.log('ALL OK');
