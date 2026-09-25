// Interleaving lab: the programs of module 1.2 as sequences of atomic actions.
// Explores every interleaving: reachable states (tuples as in the slides), scenarios, final values, cycles.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.InterleavingLab=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 // An instruction: {t: text, run(v, l) -> next pc | undefined (= pc + 1)}. v = shared variables, l = locals of the process.
 const printer=(name,k)=>Array.from({length:k},(_,i)=>({t:`print("${name}${i+1}")`,run(){}}));
 const presets={
  assign:{title:'Due assegnamenti (primo esempio)',vars:{n:0},locals:[{k1:1},{k2:2}],order:['n','k1','k2'],procs:[
   [{t:'n := k1',run(v,l){v.n=l.k1}}],
   [{t:'n := k2',run(v,l){v.n=l.k2}}]]},
  print22:{title:'print: 2 processi × 2 azioni',vars:{},locals:[{},{}],order:[],procs:[printer('p',2),printer('q',2)]},
  print23:{title:'print: 2 processi × 3 azioni',vars:{},locals:[{},{}],order:[],procs:[printer('p',3),printer('q',3)]},
  print32:{title:'print: 3 processi × 2 azioni',vars:{},locals:[{},{},{}],order:[],procs:[printer('p',2),printer('q',2),printer('r',2)]},
  incAtomic:{title:'Incremento atomico',vars:{n:0},locals:[{},{}],order:['n'],procs:[
   [{t:'n := n + 1',run(v){v.n++}}],[{t:'n := n + 1',run(v){v.n++}}]]},
  incTmp:{title:'Incremento non atomico (tmp)',vars:{n:0},locals:[{tmp:0},{tmp:0}],order:['n','tmp'],procs:[0,1].map(()=>[
   {t:'tmp := n',run(v,l){l.tmp=v.n}},{t:'n := tmp + 1',run(v,l){v.n=l.tmp+1}}])},
  incReg:{title:'Incremento su macchina a registri',vars:{n:0},locals:[{R1:0},{R1:0}],order:['n','R1'],procs:[0,1].map(()=>[
   {t:'load R1, n',run(v,l){l.R1=v.n}},{t:'add R1, #1',run(v,l){l.R1++}},{t:'store n, R1',run(v,l){v.n=l.R1}}])},
  incStack:{title:'Incremento su macchina a stack',vars:{n:0},locals:[{st:[]},{st:[]}],order:['n','st'],procs:[0,1].map(()=>[
   {t:'push n',run(v,l){l.st.push(v.n)}},{t:'push #1',run(v,l){l.st.push(1)}},
   {t:'add',run(v,l){l.st.push(l.st.pop()+l.st.pop())}},{t:'pop n',run(v,l){v.n=l.st.pop()}}])},
  cyclic:{title:'Processi ciclici',vars:{n:1},locals:[{},{}],order:['n'],procs:[
   [{t:'while (n < 1)',run(v){return v.n<1?1:2}},{t:'  n := n + 1',run(v){v.n++;return 0}}],
   [{t:'while (n >= 0)',run(v){return v.n>=0?1:2}},{t:'  n := n - 1',run(v){v.n--;return 0}}]]}
 };
 const NAMES=['p','q','r'];
 const copy=x=>JSON.parse(JSON.stringify(x));
 function init(id){const a=presets[id];return {pc:a.procs.map(()=>0),v:copy(a.vars),l:copy(a.locals)}}
 const key=s=>JSON.stringify(s);
 const done=(id,s,i)=>s.pc[i]>=presets[id].procs[i].length;
 function step(id,s,i){const n=copy(s),r=presets[id].procs[i][s.pc[i]].run(n.v,n.l[i]);n.pc[i]=r===undefined?s.pc[i]+1:r;return n}
 const label=(id,i,pc)=>pc>=presets[id].procs[i].length?'-':NAMES[i]+(pc+1);
 // The state tuple written as in the slides: control pointers, shared variables, then locals process by process.
 function tuple(id,s){const a=presets[id],parts=s.pc.map((pc,i)=>label(id,i,pc));
  const val=x=>Array.isArray(x)?'['+x.join(' ')+']':String(x);
  for(const k of a.order)if(k in s.v)parts.push(val(s.v[k]));
  for(const k of a.order)s.l.forEach(l=>{if(k in l)parts.push(val(l[k]))});
  return '<'+parts.join(',')+'>'}
 function analyse(id){const s0=init(id),seen=new Map([[key(s0),s0]]),adj=new Map(),queue=[s0];
  while(queue.length){const s=queue.shift(),out=[];
   s.pc.forEach((_,i)=>{if(done(id,s,i))return;const n=step(id,s,i),k=key(n);out.push({to:k,i});if(!seen.has(k)){seen.set(k,n);queue.push(n)}});
   adj.set(key(s),out)}
  // Cycle detection (iterative DFS colouring) and scenario counting on the DAG.
  const colour=new Map();let cycle=null;
  for(const start of seen.keys()){if(colour.has(start)||cycle)continue;const stack=[[start,0]];colour.set(start,1);
   while(stack.length&&!cycle){const top=stack[stack.length-1],es=adj.get(top[0]);
    if(top[1]<es.length){const e=es[top[1]++],c=colour.get(e.to);if(c===1){cycle=e.to;break}if(!c){colour.set(e.to,1);stack.push([e.to,0])}}
    else{colour.set(top[0],2);stack.pop()}}}
  const finals=[...seen.values()].filter(s=>s.pc.every((_,i)=>done(id,s,i)));
  const res={states:seen.size,edges:[...adj.values()].reduce((a,e)=>a+e.length,0),finals:finals.map(s=>tuple(id,s)),cyclic:!!cycle,scenarios:null,outcomes:null};
  if(!cycle){const memo=new Map();const count=k=>{if(memo.has(k))return memo.get(k);const es=adj.get(k);const c=es.length?es.reduce((a,e)=>a+count(e.to),0):1;memo.set(k,c);return c};
   res.scenarios=count(key(s0));
   if('n' in presets[id].vars){const by=new Map(),walk=new Map();
    const dist=k=>{if(walk.has(k))return walk.get(k);const es=adj.get(k),m=new Map();
     if(!es.length)m.set(seen.get(k).v.n,1);else for(const e of es)for(const [x,c] of dist(e.to))m.set(x,(m.get(x)||0)+c);walk.set(k,m);return m};
    for(const [x,c] of dist(key(s0)))by.set(x,c);res.outcomes=[...by.entries()].sort((a,b)=>b[0]-a[0])}}
  return res}

 function mount(sel,opts={}){const host=document.querySelector(sel);if(!host)return;
  let id=opts.start||'incTmp',state=init(id),log=[],report=null;
  const el=(tag,cls,text,parent)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;if(parent)parent.appendChild(e);return e};
  function render(){host.replaceChildren();host.classList.add('ilab');
   const top=el('div','ilab-row',null,host),lab=el('label',null,'Programma: ',top),s=el('select',null,null,lab);
   for(const [k,a] of Object.entries(presets)){const o=el('option',null,a.title,s);o.value=k}s.value=id;
   s.addEventListener('change',()=>{id=s.value;state=init(id);log=[];report=null;render();host.querySelector('select').focus()});
   const cols=el('div','ilab-cols',null,host),a=presets[id];
   a.procs.forEach((prog,i)=>{const box=el('div','ilab-proc',null,cols);el('h5',null,'Processo '+NAMES[i],box);const ol=el('ol',null,null,box);
    prog.forEach((ins,n)=>{const li=el('li',null,ins.t,ol);if(n===state.pc[i])li.className='on'});
    const b=el('button',null,done(id,state,i)?NAMES[i]+' ha finito':'Esegui '+label(id,i,state.pc[i]),box);b.type='button';b.disabled=done(id,state,i);
    b.addEventListener('click',()=>{log.push(label(id,i,state.pc[i]));state=step(id,state,i);render()})});
   el('p','ilab-state','Stato: '+tuple(id,state),host);
   el('p','ilab-scen','Scenario: '+(log.length?log.join(' '):'(vuoto)'),host);
   const ctr=el('div','ilab-row',null,host);
   const rs=el('button',null,'Reset',ctr);rs.type='button';rs.addEventListener('click',()=>{state=init(id);log=[];render()});
   const an=el('button',null,'Esplora tutti gli interleaving',ctr);an.type='button';an.addEventListener('click',()=>{report=analyse(id);render()});
   if(report){const r=el('div','ilab-report',null,host);r.setAttribute('role','status');
    el('p',null,`Stati raggiungibili: ${report.states} · transizioni: ${report.edges}.`,r);
    if(report.cyclic)el('p','bad','Il diagramma contiene cicli: esistono scenari infiniti, quindi il programma può non terminare.',r);
    else{el('p',null,`Scenari (cammini dallo stato iniziale a uno finale): ${report.scenarios}.`,r);
     if(report.outcomes&&report.outcomes.length>1)el('p','bad','Valore finale di n: '+report.outcomes.map(([x,c])=>`n = ${x} in ${c===1?'uno scenario':c+' scenari'}`).join(' · ')+'.',r);
     else if(report.outcomes)el('p','ok',`In tutti gli scenari n finale = ${report.outcomes[0][0]}.`,r)}
    el('p',null,'Stati finali: '+report.finals.join('  '),r)}}
  render()}
 return {presets,init,step,tuple,analyse,mount};
});
