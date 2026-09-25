// Exchanging values lab: N processes learn global min and max over channels.
// Three topologies from the slides (centralised, symmetric, ring), channels with a chosen capacity
// (0 = synchronous, unbuffered). Runs step by step (each process does at most one operation per step)
// and checks every interleaving for executions that block forever.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ExchangeLab=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const VALUES=[7,3,9,1,5,8,4,6];
 const upd=(s,x)=>{if(x<s.smallest)s.smallest=x;if(x>s.largest)s.largest=x};
 const snd=(ch,f)=>({k:'send',ch,f}), rcv=(ch,f)=>({k:'recv',ch,f});
 const pair=s=>[s.smallest,s.largest];
 const setPair=(s,p)=>{s.smallest=p[0];s.largest=p[1]};
 const strategies={
  central:{title:'Centralizzata (coordinatore P0)',
   build(n){const ps=[];
    const c=[];for(let i=1;i<n;i++)c.push(rcv('values',(s,x)=>upd(s,x)));for(let i=1;i<n;i++)c.push(snd('results['+i+']',pair));ps.push(c);
    for(let i=1;i<n;i++)ps.push([snd('values',s=>s.v),rcv('results['+i+']',setPair)]);return ps}},
  symmetric:{title:'Simmetrica (tutti a tutti)',
   build(n){const ps=[];for(let i=0;i<n;i++){const p=[];for(let j=0;j<n;j++)if(j!==i)p.push(snd('values['+j+']',s=>s.v));
    for(let k=1;k<n;k++)p.push(rcv('values['+i+']',(s,x)=>upd(s,x)));ps.push(p)}return ps}},
  ring:{title:'Ad anello (due giri)',
   build(n,o){const ps=[];const p0=[snd('values[1]',pair),rcv('values[0]',setPair),snd('values[1]',pair)];
    if(o.lastRecv)p0.push(rcv('values[0]',setPair));ps.push(p0);
    for(let i=1;i<n;i++){const nx='values['+((i+1)%n)+']',me='values['+i+']';
     ps.push([rcv(me,(s,p)=>{setPair(s,p);upd(s,s.v)}),snd(nx,pair),rcv(me,setPair),snd(nx,pair)])}return ps}}
 };
 const opText=op=>op.k==='send'?'send '+op.ch:'receive '+op.ch;
 function channelsOf(progs){const set=new Set();progs.forEach(p=>p.forEach(op=>set.add(op.ch)));return [...set]}

 // Exhaustive exploration over (program counters, buffer occupancy). Message contents do not affect blocking.
 function explore(progs,cap,limit=400000){
  const chs=channelsOf(progs),ci=Object.fromEntries(chs.map((c,i)=>[c,i])),n=progs.length;
  const start={pc:progs.map(()=>0),cnt:chs.map(()=>0)};const key=s=>s.pc.join(',')+'|'+s.cnt.join(',');
  const seen=new Set([key(start)]),stack=[start];let complete=false,blocked=null,states=0,truncated=false;
  while(stack.length){const s=stack.pop();states++;if(states>limit){truncated=true;break}
   const next=[];
   for(let i=0;i<n;i++){const op=progs[i][s.pc[i]];if(!op)continue;const c=ci[op.ch];
    if(cap===0){if(op.k!=='send')continue;
     for(let j=0;j<n;j++){if(j===i)continue;const o=progs[j][s.pc[j]];if(o&&o.k==='recv'&&o.ch===op.ch){const t={pc:s.pc.slice(),cnt:s.cnt};t.pc[i]++;t.pc[j]++;next.push(t)}}}
    else if(op.k==='send'?s.cnt[c]<cap:s.cnt[c]>0){const t={pc:s.pc.slice(),cnt:s.cnt.slice()};t.pc[i]++;t.cnt[c]+=op.k==='send'?1:-1;next.push(t)}}
   if(!next.length){if(s.pc.every((p,i)=>p===progs[i].length))complete=true;else if(!blocked)blocked=s.pc.map((p,i)=>progs[i][p]?'P'+i+' fermo su '+opText(progs[i][p]):null).filter(Boolean)}
   for(const t of next){const k=key(t);if(!seen.has(k)){seen.add(k);stack.push(t)}}}
  return {complete,blocked,states,truncated}}

 class Run{
  constructor(id,n,cap,opts={}){this.id=id;this.n=n;this.cap=cap;this.opts=opts;this.progs=strategies[id].build(n,opts);
   this.pc=this.progs.map(()=>0);this.st=this.progs.map((_,i)=>({v:VALUES[i],smallest:VALUES[i],largest:VALUES[i]}));
   this.buf=Object.fromEntries(channelsOf(this.progs).map(c=>[c,[]]));this.steps=0;this.msgs=0;this.maxPar=0;this.ops=this.progs.map(()=>0);this.log=[]}
  done(i){return this.pc[i]>=this.progs[i].length}
  finished(){return this.progs.every((_,i)=>this.done(i))}
  // One parallel step: every process performs at most one operation.
  step(){const moved=new Set(),ev=[];const next=i=>this.done(i)?null:this.progs[i][this.pc[i]];
   const fire=(i,payload)=>{const op=next(i);this.pc[i]++;this.ops[i]++;moved.add(i);if(op.k==='send')this.msgs++;else op.f(this.st[i],payload)};
   const show=x=>Array.isArray(x)?'('+x.join(',')+')':String(x);
   if(this.cap===0){for(let i=0;i<this.n;i++){const op=next(i);if(!op||op.k!=='send'||moved.has(i))continue;
     for(let j=0;j<this.n;j++){const o=next(j);if(j!==i&&!moved.has(j)&&o&&o.k==='recv'&&o.ch===op.ch){const x=op.f(this.st[i]);fire(i);fire(j,x);ev.push('P'+i+' → P'+j+' su '+op.ch+': '+show(x));break}}}}
   else{for(let i=0;i<this.n;i++){const op=next(i);if(op&&op.k==='recv'&&this.buf[op.ch].length){const x=this.buf[op.ch].shift();fire(i,x);ev.push('P'+i+' riceve '+show(x)+' da '+op.ch)}}
    for(let i=0;i<this.n;i++){const op=next(i);if(op&&op.k==='send'&&!moved.has(i)&&this.buf[op.ch].length<this.cap){const x=op.f(this.st[i]);this.buf[op.ch].push(x);fire(i);ev.push('P'+i+' deposita '+show(x)+' in '+op.ch)}}}
   if(!moved.size){this.stuck=!this.finished();return false}this.steps++;this.maxPar=Math.max(this.maxPar,moved.size);this.log.push('passo '+this.steps+': '+ev.join('; '));return true}
  runAll(max=1000){while(!this.finished()&&max-->0&&this.step());}
  blockedOn(){return this.progs.map((p,i)=>this.done(i)?null:'P'+i+' fermo su '+opText(p[this.pc[i]])).filter(Boolean)}
 }

 function mount(sel,opts={}){const host=document.querySelector(sel);if(!host)return;
  let id=opts.start||'symmetric',n=opts.n||4,cap=opts.cap!=null?opts.cap:0,lastRecv=false,run,check=null;
  const reset=()=>{run=new Run(id,n,cap,{lastRecv});check=null};reset();
  const el=(tag,cls,text,parent)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;if(parent)parent.appendChild(e);return e};
  const btn=(label,parent,fn,disabled)=>{const b=el('button',null,label,parent);b.type='button';b.disabled=!!disabled;b.addEventListener('click',()=>{fn();render()});return b};
  const select=(label,parent,options,value,onChange)=>{const l=el('label',null,label+' ',parent),s=el('select',null,null,l);
   for(const [v,t] of options){const o=el('option',null,t,s);o.value=String(v)}s.value=String(value);s.addEventListener('change',()=>{onChange(s.value);reset();render()});return s};
  function render(){host.replaceChildren();host.classList.add('xlab');
   const r1=el('div','xlab-row',null,host);
   select('Soluzione:',r1,Object.entries(strategies).map(([k,v])=>[k,v.title]),id,v=>{id=v});
   select('N:',r1,[3,4,5].map(x=>[x,String(x)]),n,v=>{n=+v});
   select('Capacità dei canali:',r1,[0,1,2,3,4,5].map(x=>[x,x===0?'0 (sincroni)':String(x)]),cap,v=>{cap=+v});
   if(id==='ring'){const l=el('label',null,null,r1),c=el('input',null,null,l);c.type='checkbox';c.checked=lastRecv;l.append(' P0 riceve anche l\'ultimo messaggio');c.addEventListener('change',()=>{lastRecv=c.checked;reset();render()})}
   const grid=el('div','xlab-procs',null,host);
   run.progs.forEach((p,i)=>{const box=el('div','xlab-proc',null,grid);el('h5',null,'P'+i+(id==='central'&&i===0?' · coordinatore':'')+' · v = '+run.st[i].v,box);
    el('p',null,'min, max: '+run.st[i].smallest+', '+run.st[i].largest,box);
    el('p',null,run.done(i)?'terminato':'prossima: '+opText(p[run.pc[i]]),box)});
   if(cap>0){const b=Object.entries(run.buf).filter(([,q])=>q.length).map(([c,q])=>c+' ['+q.map(x=>Array.isArray(x)?'('+x+')':x).join(', ')+']');el('p','xlab-buf','Buffer: '+(b.join(' · ')||'tutti vuoti'),host)}
   const r2=el('div','xlab-row',null,host);
   btn('Esegui un passo',r2,()=>run.step(),run.finished());btn('Esegui fino alla fine',r2,()=>run.runAll(),run.finished());
   btn('Verifica tutti gli interleaving',r2,()=>{check=explore(run.progs,cap)});btn('Reset',r2,reset);
   const st=el('p','xlab-status',null,host);st.setAttribute('role','status');
   st.textContent='Messaggi inviati: '+run.msgs+' · passi: '+run.steps+' · operazioni del processo più carico: '+Math.max(...run.ops)+' · massimo di processi che avanzano nello stesso passo: '+run.maxPar+(run.finished()?' · terminato':'');
   if(run.stuck)el('p','xlab-bad','Nessuno può più muoversi: '+run.blockedOn().join('; ')+'.',host);
   const nst=k=>k+(k===1?' stato':' stati');
   if(check){const p=el('p',check.complete&&!check.blocked?'xlab-ok':'xlab-bad',null,host);
    p.textContent=check.truncated?'Troppi stati: verifica interrotta.':check.blocked&&!check.complete?'Si blocca in ogni interleaving ('+nst(check.states)+'). Esempio: '+check.blocked.join('; ')+'.':
     check.blocked?'Alcuni interleaving terminano, altri si bloccano ('+nst(check.states)+'). Esempio di blocco: '+check.blocked.join('; ')+'.':'Termina in ogni interleaving ('+nst(check.states)+' esplorati).'}
   if(run.log.length){const d=el('details','xlab-log',null,host);el('summary',null,'Registro ('+run.log.length+' passi)',d);const ol=el('ol',null,null,d);run.log.forEach(l=>el('li',null,l,ol))}}
  render()}
 return {strategies,explore,Run,mount,VALUES};
});
