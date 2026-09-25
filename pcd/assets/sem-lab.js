// Small semaphore programs with an exhaustive checker.
// Model (slides / Ben-Ari): weak semaphores S = (V, L). wait(S): if V > 0 then V := V - 1, else the process
// blocks and joins L. signal(S): if L is empty then V := V + 1, else it unblocks an arbitrary process of L
// (V unchanged). Every listed line is one atomic step. Programs are finite: cyclic processes are unrolled
// for a fixed number of rounds. The checker explores every interleaving and every choice made by signal.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SemLab=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const A=(t,fx,bad)=>({k:'act',t,fx,bad}), W=s=>({k:'wait',s,t:`wait(${s})`}), S=s=>({k:'signal',s,t:`signal(${s})`});
 const rounds=(n,f)=>Array.from({length:n},(_,r)=>f(r+1)).flat();
 const need=(cond,msg)=>v=>cond(v)?null:msg;
 // Variables whose name starts with '#' only serve the checker and are not shown.
 const scenarios={
  free:{title:'Esercizio: nessuna sincronizzazione',goal:'b2 deve seguire a1',sems:{},vars:{'#a1':0},procs:{
   p:[A('a1',v=>{v['#a1']=1}),A('a2')],
   q:[A('b1'),A('b2',null,need(v=>v['#a1'],'b2 eseguita prima di a1')),A('b3')]}},
  event:{title:'Esercizio: semaforo evento a1Done',goal:'b2 deve seguire a1',sems:{a1Done:0},vars:{'#a1':0},procs:{
   p:[A('a1',v=>{v['#a1']=1}),S('a1Done'),A('a2')],
   q:[A('b1'),W('a1Done'),A('b2',null,need(v=>v['#a1'],'b2 eseguita prima di a1')),A('b3')]}},
  rvok:{title:'Variante: anche a2 dopo b1 (signal, poi wait)',goal:'b2 dopo a1 e a2 dopo b1',sems:{a1Done:0,b1Done:0},vars:{'#a1':0,'#b1':0},procs:{
   p:[A('a1',v=>{v['#a1']=1}),S('a1Done'),W('b1Done'),A('a2',null,need(v=>v['#b1'],'a2 eseguita prima di b1'))],
   q:[A('b1',v=>{v['#b1']=1}),S('b1Done'),W('a1Done'),A('b2',null,need(v=>v['#a1'],'b2 eseguita prima di a1')),A('b3')]}},
  rvbad:{title:'Variante sbagliata: prima wait, poi signal',goal:'b2 dopo a1 e a2 dopo b1',sems:{a1Done:0,b1Done:0},vars:{'#a1':0,'#b1':0},procs:{
   p:[A('a1',v=>{v['#a1']=1}),W('b1Done'),S('a1Done'),A('a2',null,need(v=>v['#b1'],'a2 eseguita prima di b1'))],
   q:[A('b1',v=>{v['#b1']=1}),W('a1Done'),S('b1Done'),A('b2',null,need(v=>v['#a1'],'b2 eseguita prima di a1')),A('b3')]}},
  twoone:{title:'Due processi aspettano b2, una sola signal',goal:'a2 e c2 devono seguire b2',sems:{b2Done:0},vars:{'#b2':0},procs:{
   p:[A('a1'),W('b2Done'),A('a2',null,need(v=>v['#b2'],'a2 eseguita prima di b2'))],
   q:[A('b1'),A('b2',v=>{v['#b2']=1}),S('b2Done'),A('b3')],
   r:[A('c1'),W('b2Done'),A('c2',null,need(v=>v['#b2'],'c2 eseguita prima di b2'))]}},
  cycshared:{title:'Ciclico, due signal sullo stesso semaforo (2 giri)',goal:'a2 e c2 del giro k dopo b2 del giro k',sems:{b2Done:0},vars:{'#b2':0,'#a2':0,'#c2':0},procs:{
   p:rounds(2,r=>[A(`a1 (giro ${r})`),W('b2Done'),A(`a2 (giro ${r})`,v=>{v['#a2']++},need(v=>v['#a2']<v['#b2'],`p esegue a2 del giro ${r} prima di b2 del giro ${r}: ha consumato anche il segnale destinato a r`))]),
   q:rounds(2,r=>[A(`b1 (giro ${r})`),A(`b2 (giro ${r})`,v=>{v['#b2']++}),S('b2Done'),S('b2Done')]),
   r:rounds(2,r=>[A(`c1 (giro ${r})`),W('b2Done'),A(`c2 (giro ${r})`,v=>{v['#c2']++},need(v=>v['#c2']<v['#b2'],`r esegue c2 del giro ${r} prima di b2 del giro ${r}: ha consumato anche il segnale destinato a p`))])}},
  cycsplit:{title:'Ciclico, un semaforo per ciascun processo in attesa (2 giri)',goal:'a2 e c2 del giro k dopo b2 del giro k',sems:{b2DoneP:0,b2DoneR:0},vars:{'#b2':0,'#a2':0,'#c2':0},procs:{
   p:rounds(2,r=>[A(`a1 (giro ${r})`),W('b2DoneP'),A(`a2 (giro ${r})`,v=>{v['#a2']++},need(v=>v['#a2']<v['#b2'],`a2 del giro ${r} prima di b2 del giro ${r}`))]),
   q:rounds(2,r=>[A(`b1 (giro ${r})`),A(`b2 (giro ${r})`,v=>{v['#b2']++}),S('b2DoneP'),S('b2DoneR')]),
   r:rounds(2,r=>[A(`c1 (giro ${r})`),W('b2DoneR'),A(`c2 (giro ${r})`,v=>{v['#c2']++},need(v=>v['#c2']<v['#b2'],`c2 del giro ${r} prima di b2 del giro ${r}`))])}},
  pcok:{title:'Produttore-consumatore, buffer da 1 posto',goal:'mai append su buffer pieno né take su buffer vuoto',sems:{availItems:0,availPlaces:1,mutex:1},vars:{buffer:0},procs:{
   prod:rounds(2,r=>[A(`produce e${r}`),W('availPlaces'),W('mutex'),A(`append e${r}`,v=>{v.buffer++},need(v=>v.buffer<1,'append su buffer pieno')),S('mutex'),S('availItems')]),
   cons:rounds(2,r=>[W('availItems'),W('mutex'),A('take',v=>{v.buffer--},need(v=>v.buffer>0,'take su buffer vuoto')),S('mutex'),S('availPlaces'),A('consume')])}},
  pcbad:{title:'Produttore-consumatore, wait(mutex) prima di wait(availPlaces)',goal:'mai append su buffer pieno né take su buffer vuoto',sems:{availItems:0,availPlaces:1,mutex:1},vars:{buffer:0},procs:{
   prod:rounds(2,r=>[A(`produce e${r}`),W('mutex'),W('availPlaces'),A(`append e${r}`,v=>{v.buffer++},need(v=>v.buffer<1,'append su buffer pieno')),S('mutex'),S('availItems')]),
   cons:rounds(2,r=>[W('availItems'),W('mutex'),A('take',v=>{v.buffer--},need(v=>v.buffer>0,'take su buffer vuoto')),S('mutex'),S('availPlaces'),A('consume')])}}
 };
 const names=id=>Object.keys(scenarios[id].procs);
 function init(id){const sc=scenarios[id],n=names(id);return {pc:n.map(()=>0),blk:n.map(()=>false),sv:Object.assign({},sc.sems),v:Object.assign({},sc.vars)}}
 const clone=s=>({pc:s.pc.slice(),blk:s.blk.slice(),sv:Object.assign({},s.sv),v:Object.assign({},s.v)});
 const key=s=>s.pc.join(',')+'|'+s.blk.map(Number).join('')+'|'+JSON.stringify(s.sv)+JSON.stringify(s.v);
 const prog=(id,i)=>scenarios[id].procs[names(id)[i]];
 const done=(id,s,i)=>s.pc[i]>=prog(id,i).length;
 // Processes blocked on semaphore x, i.e. the set x.L.
 const waiting=(id,s,x)=>names(id).map((_,j)=>j).filter(j=>s.blk[j]&&prog(id,j)[s.pc[j]].s===x);
 // Moves of process i: [{s,label,violation}]. A signal with several blocked processes yields one move per choice.
 function moves(id,s,i){const nm=names(id)[i];if(done(id,s,i)||s.blk[i])return [];
  const ins=prog(id,i)[s.pc[i]],n=clone(s);n.pc[i]++;
  if(ins.k==='act'){const violation=ins.bad?ins.bad(s.v):null;if(ins.fx)ins.fx(n.v);return [{s:n,label:`${nm}: ${ins.t}`,violation}]}
  if(ins.k==='wait'){if(s.sv[ins.s]>0){n.sv[ins.s]--;return [{s:n,label:`${nm}: ${ins.t} passa (${ins.s}.V = ${n.sv[ins.s]})`}]}
   const b=clone(s);b.blk[i]=true;return [{s:b,label:`${nm}: ${ins.t} si blocca`}]}
  const L=waiting(id,s,ins.s);
  if(!L.length){n.sv[ins.s]++;return [{s:n,label:`${nm}: ${ins.t}, nessuno in attesa (${ins.s}.V = ${n.sv[ins.s]})`}]}
  return L.map(j=>{const m=clone(n);m.blk[j]=false;m.pc[j]++;return {s:m,label:`${nm}: ${ins.t} sveglia ${names(id)[j]}`}})}
 const allMoves=(id,s)=>names(id).flatMap((_,i)=>moves(id,s,i));
 // Exhaustive breadth-first exploration: first property violation, first blocked (deadlock) state, terminal states.
 function check(id){const s0=init(id),seen=new Map([[key(s0),{prev:null,label:null}]]),queue=[s0];
  let violation=null,deadlock=null,finals=0;
  const path=k=>{const out=[];while(seen.get(k).prev!=null){out.unshift(seen.get(k).label);k=seen.get(k).prev}return out};
  while(queue.length){const s=queue.shift(),k=key(s),ms=allMoves(id,s);
   if(!ms.length){if(names(id).every((_,i)=>done(id,s,i)))finals++;
    else if(!deadlock)deadlock={trace:path(k),blocked:names(id).filter((_,i)=>s.blk[i])}}
   for(const m of ms){if(m.violation&&!violation)violation={msg:m.violation,trace:path(k).concat(m.label)};
    const k2=key(m.s);if(!seen.has(k2)){seen.set(k2,{prev:k,label:m.label});queue.push(m.s)}}}
  return {states:seen.size,finals,violation,deadlock}}

 function mount(sel,opts={}){const host=document.querySelector(sel);if(!host)return;
  let id=opts.start||'free',state=init(id),log=[],report=null,note='',last=null;
  const el=(tag,cls,text,parent)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;if(parent)parent.appendChild(e);return e};
  const reset=()=>{state=init(id);log=[];last=null};
  function apply(m){state=m.s;log.push(m.label);last=m;render()}
  function replay(labels){reset();for(const l of labels){const m=allMoves(id,state).find(x=>x.label===l);if(!m)break;state=m.s;log.push(l);last=m}render()}
  function render(){host.replaceChildren();host.classList.add('sml');const sc=scenarios[id];
   const top=el('div','sml-row',null,host),lab=el('label',null,'Scenario: ',top),sel=el('select',null,null,lab);
   for(const [k,a] of Object.entries(scenarios)){const o=el('option',null,a.title,sel);o.value=k}sel.value=id;
   sel.addEventListener('change',()=>{id=sel.value;reset();report=null;render();host.querySelector('select').focus()});
   el('p','sml-goal','Proprietà controllata: '+sc.goal+'.',host);
   const cols=el('div','sml-cols',null,host);
   names(id).forEach((nm,i)=>{const box=el('div','sml-proc',null,cols);el('h5',null,'Processo '+nm,box);const ol=el('ol',null,null,box);
    prog(id,i).forEach((ins,n)=>{const li=el('li',null,ins.t,ol);if(n===state.pc[i])li.className=state.blk[i]?'blocked':'on'});
    if(done(id,state,i))el('p','sml-done','terminato',box);
    const ms=moves(id,state,i);
    if(!ms.length&&!done(id,state,i)){const b=el('button',null,'Bloccato',box);b.type='button';b.disabled=true}
    ms.forEach(m=>{const b=el('button',null,ms.length>1?m.label:'Passo '+nm,box);b.type='button';b.addEventListener('click',()=>apply(m))})});
   const semLine=Object.keys(state.sv).map(x=>`${x} = (${state.sv[x]}, {${waiting(id,state,x).map(j=>names(id)[j]).join(', ')}})`);
   const varLine=Object.entries(state.v).filter(([k])=>k[0]!=='#').map(([k,v])=>k+' = '+v);
   el('p','sml-vars',semLine.concat(varLine).join('   ·   ')||'nessun semaforo',host);
   const all=allMoves(id,state),fin=names(id).every((_,i)=>done(id,state,i));
   const bad=last&&last.violation,stuck=!all.length&&!fin;
   const st=el('p','sml-status'+(bad||stuck?' bad':''),bad?'Violazione: '+last.violation+'.':stuck?'Nessun processo può avanzare, ma qualcuno è ancora bloccato: deadlock.':fin?'Tutti i processi hanno terminato.':note||'Scegli quale processo far avanzare (una riga = un passo atomico).',host);st.setAttribute('role','status');note='';
   const ctr=el('div','sml-row',null,host);
   const rs=el('button',null,'Reset',ctr);rs.type='button';rs.addEventListener('click',()=>{reset();render()});
   const ck=el('button',null,'Verifica tutti gli interleaving',ctr);ck.type='button';ck.addEventListener('click',()=>{report=check(id);render()});
   if(report){const r=el('div','sml-report',null,host);
    el('p',null,`Stati raggiungibili: ${report.states}. Stati finali in cui tutti hanno terminato: ${report.finals}.`,r);
    const line=(ok,okText,badText,trace)=>{const p=el('p',ok?'ok':'bad',ok?'✓ '+okText:'✗ '+badText,r);
     if(!ok){const b=el('button',null,'Mostra lo scenario',p);b.type='button';b.addEventListener('click',()=>{note='Scenario caricato: il registro elenca i passi che portano qui.';replay(trace)})}};
    line(!report.violation,'La proprietà vale in ogni interleaving.',report.violation?'Violazione possibile: '+report.violation.msg+'.':'',report.violation&&report.violation.trace);
    line(!report.deadlock,'Nessun deadlock: ogni esecuzione termina.',report.deadlock?'Deadlock possibile: '+report.deadlock.blocked.join(' e ')+' restano bloccati per sempre.':'',report.deadlock&&report.deadlock.trace)}
   if(log.length){const d=el('details','sml-log',null,host);d.open=true;el('summary',null,'Passi eseguiti ('+log.length+')',d);const ol=el('ol',null,null,d);log.forEach(l=>el('li',null,l,ol))}}
  render()}
 return {scenarios,names,init,moves,check,mount};
});
