// Critical-section attempts for two processes, with an exhaustive checker.
// Model: each numbered line is one atomic step; await/while-skip block while their condition is false;
// a process may stay in its NCS forever; the checker assumes weak fairness per process.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CSAttempts=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const P=0,Q=1,NAME=['p','q'];
 // Instruction kinds: ncs, cs, set(v,val), await(cond), branch(cond,then,else), goto(t), tas.
 // Conditions and values are functions of (vars, me, other); want[me] is 'want'+NAME[me], turn uses 1 for p and 2 for q.
 const W=i=>'want'+NAME[i], T=i=>i+1;
 const algos={
  a1:{title:'1° tentativo — turn',vars:{turn:1},prog:(i,j)=>[
   {k:'ncs',t:'NCS'},
   {k:'await',t:`await turn = ${T(i)}`,c:v=>v.turn===T(i)},
   {k:'cs',t:'CS'},
   {k:'set',t:`turn := ${T(j)}`,v:'turn',x:()=>T(j)}]},
  a2:{title:'2° tentativo — test poi set',vars:{wantp:false,wantq:false},prog:(i,j)=>[
   {k:'ncs',t:'NCS'},
   {k:'await',t:`while ${W(j)} skip`,c:v=>!v[W(j)]},
   {k:'set',t:`${W(i)} := true`,v:W(i),x:()=>true},
   {k:'cs',t:'CS'},
   {k:'set',t:`${W(i)} := false`,v:W(i),x:()=>false}]},
  a3:{title:'3° tentativo — set poi await',vars:{wantp:false,wantq:false},prog:(i,j)=>[
   {k:'ncs',t:'NCS'},
   {k:'set',t:`${W(i)} := true`,v:W(i),x:()=>true},
   {k:'await',t:`await ${W(j)} = false`,c:v=>!v[W(j)]},
   {k:'cs',t:'CS'},
   {k:'set',t:`${W(i)} := false`,v:W(i),x:()=>false}]},
  a4:{title:'4° tentativo — rinuncia',vars:{wantp:false,wantq:false},prog:(i,j)=>[
   {k:'ncs',t:'NCS'},
   {k:'set',t:`${W(i)} := true`,v:W(i),x:()=>true},
   {k:'branch',t:`while ${W(j)}`,c:v=>v[W(j)],then:3,else:5},
   {k:'set',t:`  ${W(i)} := false`,v:W(i),x:()=>false},
   {k:'set',t:`  ${W(i)} := true`,v:W(i),x:()=>true,next:2},
   {k:'cs',t:'CS'},
   {k:'set',t:`${W(i)} := false`,v:W(i),x:()=>false}]},
  dekker:{title:'Dekker',vars:{wantp:false,wantq:false,turn:1},prog:(i,j)=>[
   {k:'ncs',t:'NCS'},
   {k:'set',t:`${W(i)} := true`,v:W(i),x:()=>true},
   {k:'branch',t:`while ${W(j)}`,c:v=>v[W(j)],then:3,else:7},
   {k:'branch',t:`  if turn = ${T(j)}`,c:v=>v.turn===T(j),then:4,else:2},
   {k:'set',t:`    ${W(i)} := false`,v:W(i),x:()=>false},
   {k:'await',t:`    await turn = ${T(i)}`,c:v=>v.turn===T(i)},
   {k:'set',t:`    ${W(i)} := true`,v:W(i),x:()=>true,next:2},
   {k:'cs',t:'CS'},
   {k:'set',t:`turn := ${T(j)}`,v:'turn',x:()=>T(j)},
   {k:'set',t:`${W(i)} := false`,v:W(i),x:()=>false}]},
  peterson:{title:'Peterson',vars:{wantp:false,wantq:false,turn:1},prog:(i,j)=>[
   {k:'ncs',t:'NCS'},
   {k:'set',t:`${W(i)} := true`,v:W(i),x:()=>true},
   {k:'set',t:`turn := ${T(j)}`,v:'turn',x:()=>T(j)},
   {k:'await',t:`await not ${W(j)} or turn = ${T(i)}`,c:v=>!v[W(j)]||v.turn===T(i)},
   {k:'cs',t:'CS'},
   {k:'set',t:`${W(i)} := false`,v:W(i),x:()=>false}]},
  tas:{title:'Lock con test-and-set',vars:{lock:0},prog:()=>[
   {k:'ncs',t:'NCS'},
   {k:'tas',t:'repeat test-and-set(lock, r) until r = 0'},
   {k:'cs',t:'CS'},
   {k:'set',t:'lock := 0',v:'lock',x:()=>0}]}
 };
 function program(id,i){const a=algos[id];return a.prog(i,1-i)}
 function init(id){return {pc:[0,0],v:Object.assign({},algos[id].vars)}}
 const key=s=>s.pc.join(',')+'|'+JSON.stringify(s.v);
 const clone=s=>({pc:s.pc.slice(),v:Object.assign({},s.v)});
 const norm=(prog,pc)=>pc%prog.length;
 function enabled(id,s,i){const ins=program(id,i)[s.pc[i]];return ins.k!=='await'||ins.c(s.v)}
 // Successors of process i: [{state,label,idle}] — the NCS also offers an idle self-loop.
 function moves(id,s,i){const prog=program(id,i),ins=prog[s.pc[i]],out=[];
  if(ins.k==='ncs')out.push({s:clone(s),label:NAME[i]+': resta in NCS',idle:true});
  if(!enabled(id,s,i))return out;
  const n=clone(s);let next=s.pc[i]+1,label=NAME[i]+': '+ins.t.trim();
  if(ins.k==='set'){n.v[ins.v]=ins.x(s.v);if(ins.next!=null)next=ins.next}
  else if(ins.k==='branch'){const b=ins.c(s.v);next=b?ins.then:ins.else;label+=b?' (vero)':' (falso)'}
  else if(ins.k==='tas'){if(s.v.lock===0){n.v.lock=1}else{next=s.pc[i];label+=' → r = 1, riprova'}if(next!==s.pc[i])label+=' → r = 0'}
  else if(ins.k==='ncs')label=NAME[i]+': esce dalla NCS';
  n.pc[i]=norm(prog,next);out.push({s:n,label,idle:false});return out}
 function region(id,i,pc){const prog=program(id,i),cs=prog.findIndex(x=>x.k==='cs');return prog[pc].k==='ncs'?'ncs':pc<cs?'entry':pc===cs?'cs':'exit'}
 // Exhaustive exploration: reachable states, mutual exclusion, deadlock, fair starvation cycles.
 function check(id){const s0=init(id),seen=new Map([[key(s0),{s:s0,prev:null,label:null}]]),queue=[s0],edges=new Map();
  while(queue.length){const s=queue.shift(),k=key(s),es=[];
   for(const i of [P,Q])for(const m of moves(id,s,i)){const k2=key(m.s);es.push({to:k2,i,idle:m.idle,label:m.label});if(!seen.has(k2)){seen.set(k2,{s:m.s,prev:k,label:m.label});queue.push(m.s)}}
   edges.set(k,es)}
  const path=k=>{const out=[];while(seen.get(k).prev!=null){out.unshift(seen.get(k).label);k=seen.get(k).prev}return out};
  let mutex=null,deadlock=null;
  for(const [k,{s}] of seen){
   if(!mutex&&region(id,P,s.pc[P])==='cs'&&region(id,Q,s.pc[Q])==='cs')mutex={trace:path(k)};
   if(!deadlock&&edges.get(k).every(e=>e.idle)&&[P,Q].some(i=>region(id,i,s.pc[i])!=='ncs'))deadlock={trace:path(k)}}
  const starve=[P,Q].map(i=>fairCycle(id,i,seen,edges,path)).find(Boolean)||null;
  return {states:seen.size,mutex,deadlock,starvation:starve}}
 // A fair cycle in which process i stays in its entry protocol forever: an SCC of the entry-region
 // subgraph where every process either moves, is blocked somewhere, or idles in its NCS.
 function fairCycle(id,i,seen,edges,path){
  const inR=k=>region(id,i,seen.get(k).s.pc[i])==='entry',nodes=[...seen.keys()].filter(inR);
  const adj=k=>edges.get(k).filter(e=>inR(e.to));
  let idx=0;const index=new Map(),low=new Map(),stack=[],on=new Set(),sccs=[];
  function strong(v){index.set(v,idx);low.set(v,idx);idx++;stack.push(v);on.add(v);
   for(const e of adj(v)){if(!index.has(e.to)){strong(e.to);low.set(v,Math.min(low.get(v),low.get(e.to)))}else if(on.has(e.to))low.set(v,Math.min(low.get(v),index.get(e.to)))}
   if(low.get(v)===index.get(v)){const c=[];let w;do{w=stack.pop();on.delete(w);c.push(w)}while(w!==v);sccs.push(c)}}
  for(const v of nodes)if(!index.has(v))strong(v);
  for(const c of sccs){const set=new Set(c),inner=c.flatMap(k=>adj(k).filter(e=>set.has(e.to)).map(e=>({from:k,...e})));
   if(!inner.length)continue;
   const fair=[P,Q].every(m=>inner.some(e=>e.i===m&&!e.idle)||c.some(k=>{const s=seen.get(k).s;return !enabled(id,s,m)||region(id,m,s.pc[m])==='ncs'}));
   if(!fair)continue;
   return {who:NAME[i],trace:path(c[0]),cycle:lasso(c[0],set,inner,id,seen)}}
  return null}
 // Build a cycle from start through every inner edge's process witnesses, back to start.
 function lasso(start,set,inner,id,seen){const want=[],labels=[];
  for(const m of [P,Q]){const e=inner.find(x=>x.i===m&&!x.idle);if(e)want.push(e)}
  let at=start;const bfs=(from,goal)=>{const prev=new Map([[from,null]]),q=[from];while(q.length){const k=q.shift();if(goal(k))break;for(const e of inner.filter(x=>x.from===k))if(!prev.has(e.to)){prev.set(e.to,e);q.push(e.to)}}
   let k=[...prev.keys()].find(goal);if(k==null)return null;const seq=[];while(prev.get(k)){seq.unshift(prev.get(k));k=prev.get(k).from}return seq};
  for(const e of want){const seq=bfs(at,k=>k===e.from)||[];seq.forEach(x=>labels.push(x.label));labels.push(e.label);at=e.to}
  const back=bfs(at,k=>k===start)||[];back.forEach(x=>labels.push(x.label));
  if(!labels.length){const self=inner.find(x=>x.from===start&&x.to===start);if(self)labels.push(self.label)}
  return labels}

 function mount(sel,opts={}){const host=document.querySelector(sel);if(!host)return;
  let id=opts.start||'a1',state=init(id),log=[],report=null,note='';
  const el=(tag,cls,text,parent)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;if(parent)parent.appendChild(e);return e};
  function run(i){const m=moves(id,state,i).find(x=>!x.idle);if(!m)return;state=m.s;log.push(m.label);render()}
  function replay(labels){state=init(id);log=[];for(const l of labels){const m=[P,Q].flatMap(i=>moves(id,state,i)).find(x=>x.label===l);if(!m)break;if(!m.idle)state=m.s;log.push(l)}render()}
  function render(){host.replaceChildren();host.classList.add('csa');
   const top=el('div','csa-row',null,host),lab=el('label',null,'Algoritmo: ',top),sel=el('select',null,null,lab);
   for(const [k,a] of Object.entries(algos)){const o=el('option',null,a.title,sel);o.value=k}sel.value=id;
   sel.addEventListener('change',()=>{id=sel.value;state=init(id);log=[];report=null;render();host.querySelector('select').focus()});
   const cols=el('div','csa-cols',null,host);
   for(const i of [P,Q]){const box=el('div','csa-proc',null,cols);el('h5',null,'Processo '+NAME[i],box);const ol=el('ol',null,null,box);
    program(id,i).forEach((ins,n)=>{const li=el('li',null,ins.t,ol);if(n===state.pc[i])li.className=enabled(id,state,i)?'on':'blocked'});
    const b=el('button',null,'Passo '+NAME[i],box);b.type='button';b.disabled=!enabled(id,state,i);b.addEventListener('click',()=>run(i))}
   const vars=el('p','csa-vars',null,host);vars.textContent=Object.entries(state.v).map(([k,v])=>k+' = '+v).join('   ·   ');
   const both=[P,Q].every(i=>region(id,i,state.pc[i])==='cs'),stuck=[P,Q].every(i=>!enabled(id,state,i));
   const st=el('p','csa-status'+(both||stuck?' bad':''),both?'Entrambi in CS: mutua esclusione violata.':stuck?'Nessuno dei due può avanzare: deadlock.':note||'Scegli quale processo far avanzare (una riga = un passo atomico).',host);st.setAttribute('role','status');note='';
   const ctr=el('div','csa-row',null,host);
   const rs=el('button',null,'Reset',ctr);rs.type='button';rs.addEventListener('click',()=>{state=init(id);log=[];render()});
   const ck=el('button',null,'Verifica tutti gli interleaving',ctr);ck.type='button';ck.addEventListener('click',()=>{report=check(id);render()});
   if(report){const r=el('div','csa-report',null,host);
    el('p',null,`Stati raggiungibili: ${report.states}.`,r);
    const line=(ok,okText,badText,trace,extra)=>{const p=el('p',ok?'ok':'bad',ok?'✓ '+okText:'✗ '+badText,r);
     if(!ok){const b=el('button',null,'Mostra lo scenario',p);b.type='button';b.addEventListener('click',()=>{note=extra?`Scenario caricato: gli ultimi ${extra.length} passi del registro formano un ciclo che riporta allo stesso stato e può ripetersi all'infinito.`:'Scenario caricato: il registro elenca i passi che portano qui.';replay(trace.concat(extra||[]))})}};
    line(!report.mutex,'Mutua esclusione: nessuno stato con entrambi in CS.','Mutua esclusione violata: esiste uno stato con entrambi in CS.',report.mutex&&report.mutex.trace);
    line(!report.deadlock,'Nessun deadlock.','Deadlock: si raggiunge uno stato in cui chi vuole entrare non può più muoversi.',report.deadlock&&report.deadlock.trace);
    const s=report.starvation;
    if(report.deadlock&&!s)el('p',null,'Starvation: il deadlock basta già a bloccare per sempre chi vuole entrare.',r);
    else line(!s,'Nessuna starvation (con scheduler debolmente equo).',s?`Starvation: esiste un'esecuzione equa in cui ${s.who} vuole entrare e non entra mai. Il ciclo si ripete all'infinito.`:'',s&&s.trace,s&&s.cycle)}
   if(log.length){const d=el('details','csa-log',null,host);d.open=true;el('summary',null,'Passi eseguiti ('+log.length+')',d);const ol=el('ol',null,null,d);log.forEach(l=>el('li',null,l,ol))}}
  render()}
 return {algos,program,init,moves,check,mount};
});
