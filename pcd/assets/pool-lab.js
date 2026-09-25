// Fixed thread pool with tasks that print "a", wait on a barrier, then print "b".
// Model: a FIFO work queue and T worker threads. Each step lets one runnable worker do one action,
// chosen round-robin. A worker blocked on the barrier keeps its thread: the task is suspended
// together with the physical thread that runs it (the point of exam question 121).
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PoolLab=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 // mode: 'none' (no wait), 'all' (one-shot barrier for all tasks: every b after every a), 'cyclic' (CyclicBarrier with k parties)
 function create(cfg){
  const threads=clamp(cfg.threads,1,100),tasks=clamp(cfg.tasks,1,100),mode=cfg.mode||'all';
  const parties=mode==='all'?tasks:mode==='cyclic'?clamp(cfg.parties||threads,1,100):0;
  return {cfg:{threads,tasks,mode,parties},queue:Array.from({length:tasks},(_,i)=>i),
   workers:Array.from({length:threads},(_,i)=>({id:i,task:null,pc:'take'})),
   barrier:{count:0,gen:0,open:false},out:[],done:0,last:-1,steps:0};
 }
 function clamp(n,lo,hi){n=Math.floor(Number(n));return Number.isFinite(n)?Math.min(hi,Math.max(lo,n)):lo}
 function runnable(s,w){return w.pc!=='wait'&&!(w.pc==='take'&&s.queue.length===0)}
 // One action of the next runnable worker; returns a description, or null if nobody can move.
 function step(s){
  const n=s.workers.length;let w=null;
  for(let k=1;k<=n;k++){const c=s.workers[(s.last+k)%n];if(runnable(s,c)){w=c;break}}
  if(!w)return null;
  s.last=w.id;s.steps++;const W='W'+(w.id+1);
  switch(w.pc){
   case 'take':w.task=s.queue.shift();w.pc='a';return `${W} prende il task ${w.task}`;
   case 'a':s.out.push('a'+w.task);w.pc=s.cfg.mode==='none'?'b':'arrive';return `${W} esegue a${w.task}`;
   case 'arrive':return arrive(s,w,W);
   case 'b':{const t=w.task;s.out.push('b'+t);s.done++;w.task=null;w.pc='take';return `${W} esegue b${t} e torna libero`}
  }
 }
 function arrive(s,w,W){
  const b=s.barrier,k=s.cfg.parties;
  if(s.cfg.mode==='all'){
   b.count++;
   if(b.count>=k){if(!b.open){b.open=true;release(s)}w.pc='b';return `${W} arriva alla barriera (${Math.min(b.count,k)}/${k}): la barriera si apre`}
   w.pc='wait';w.gen=0;return `${W} arriva alla barriera (${b.count}/${k}) e si sospende: il suo thread resta occupato`;
  }
  b.count++;
  if(b.count===k){b.count=0;const g=b.gen;b.gen++;release(s,g);w.pc='b';return `${W} completa il gruppo ${g+1} della barriera ciclica (${k}/${k})`}
  w.pc='wait';w.gen=b.gen;return `${W} arriva alla barriera ciclica (${b.count}/${k}) e si sospende`;
 }
 function release(s,g){for(const x of s.workers)if(x.pc==='wait'&&(g===undefined||x.gen===g))x.pc='b'}
 function run(s,max){let e;for(let i=0;i<(max||100000)&&(e=step(s))!==null;i++);return status(s)}
 function status(s){
  const blocked=s.workers.filter(w=>w.pc==='wait').length;
  const moving=s.workers.some(w=>runnable(s,w));
  const a=s.out.filter(x=>x[0]==='a').length,b=s.out.length-a;
  return {completed:s.done===s.cfg.tasks,stuck:!moving&&s.done<s.cfg.tasks,blocked,queued:s.queue.length,a,b,done:s.done};
 }

 // ---- DOM ----
 function el(tag,cls,text,parent){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;if(parent)parent.appendChild(e);return e}
 const PRESETS=[
  {label:'Domanda d’esame: 4 thread, 100 task',cfg:{threads:4,tasks:100,mode:'all'}},
  {label:'«Barare»: 100 thread per 100 task',cfg:{threads:100,tasks:100,mode:'all'}},
  {label:'Senza attesa: la specifica originale',cfg:{threads:4,tasks:100,mode:'none'}},
  {label:'CyclicBarrier da 4 su 4 thread',cfg:{threads:4,tasks:100,mode:'cyclic',parties:4}},
  {label:'CyclicBarrier da 5 su 4 thread',cfg:{threads:4,tasks:100,mode:'cyclic',parties:5}}];
 function mount(sel,opts){
  const host=typeof sel==='string'?document.querySelector(sel):sel;if(!host)return;
  host.classList.add('plab');
  let cfg=Object.assign({},PRESETS[0].cfg,opts&&opts.cfg),s=create(cfg),msg='',log=[];
  function reset(c){cfg=c;s=create(cfg);msg='';log=[];render()}
  function act(fn){fn();render()}
  function render(){
   host.textContent='';
   const pr=el('div','plab-row',null,host);el('span','plab-lbl','Scenari:',pr);
   PRESETS.forEach(p=>{const b=el('button',null,p.label,pr);b.type='button';b.addEventListener('click',()=>reset(Object.assign({},p.cfg)))});
   const f=el('div','plab-row',null,host);
   const num=(label,key,max)=>{const l=el('label',null,label+' ',f);const i=el('input',null,null,l);i.type='number';i.min=1;i.max=max;i.value=key==='parties'?s.cfg.parties||4:s.cfg[key];
    i.addEventListener('change',()=>reset(Object.assign({},cfg,{[key]:clamp(i.value,1,max)})));return l};
   num('thread nel pool','threads',100);num('task','tasks',100);
   const ml=el('label',null,'attesa dopo a: ',f);const m=el('select',null,null,ml);
   [['none','nessuna'],['all','barriera per tutti i task'],['cyclic','CyclicBarrier con k parti']].forEach(([v,t])=>{const o=el('option',null,t,m);o.value=v});m.value=s.cfg.mode;
   m.addEventListener('change',()=>reset(Object.assign({},cfg,{mode:m.value})));
   if(s.cfg.mode==='cyclic')num('k','parties',100);
   const c=el('div','plab-row',null,host);
   const b1=el('button',null,'Un passo',c);b1.type='button';
   const b2=el('button',null,'Esegui fino alla fine',c);b2.type='button';
   const b3=el('button',null,'Reset',c);b3.type='button';
   const st0=status(s);b1.disabled=b2.disabled=st0.completed||st0.stuck;
   b1.addEventListener('click',()=>act(()=>{const e=step(s);if(e){log.push(e);if(log.length>60)log.shift()}}));
   b2.addEventListener('click',()=>act(()=>{const before=s.steps;run(s);log.push(`… ${s.steps-before} passi eseguiti in blocco`)}));
   b3.addEventListener('click',()=>reset(cfg));
   const q=el('p','plab-q',null,host);
   q.textContent=`Coda dei task: ${s.queue.length}${s.queue.length?' in attesa ('+s.queue.slice(0,8).join(', ')+(s.queue.length>8?', …':'')+')':''} · completati: ${s.done}/${s.cfg.tasks}`+(s.cfg.mode==='all'?` · barriera: ${Math.min(s.barrier.count,s.cfg.parties)}/${s.cfg.parties}`:s.cfg.mode==='cyclic'?` · barriera ciclica: ${s.barrier.count}/${s.cfg.parties} nel gruppo corrente`:'');
   const ws=el('div','plab-workers',null,host);
   s.workers.forEach(w=>{const d=el('div','plab-w'+(w.pc==='wait'?' wait':runnable(s,w)?'':' idle'),null,ws);
    d.textContent=`W${w.id+1}: `+(w.pc==='take'?(s.queue.length?'libero':'libero, coda vuota'):w.pc==='wait'?`bloccato (task ${w.task})`:`task ${w.task} → ${w.pc==='arrive'?'barriera':w.pc}`)});
   const o=el('p','plab-out',null,host);const out=s.out;
   o.textContent='Output: '+(out.length?(out.length>48?'… '+out.slice(-48).join(' '):out.join(' ')):'(ancora nulla)');
   const st=status(s);
   const v=el('p','plab-status'+(st.stuck?' bad':st.completed?' ok':''),null,host);v.setAttribute('role','status');
   v.textContent=st.completed?`Completato: ${st.a} stampe di a e ${st.b} di b.`:
    st.stuck?(st.queued?`Deadlock: ${st.blocked} thread su ${s.cfg.threads} sono sospesi sulla barriera e ${st.queued} task restano in coda senza un thread che li esegua. Stampate ${st.a} a e ${st.b} b; il programma non termina.`:
     `Bloccato: ${st.blocked} task aspettano alla barriera, ma non esistono altri task che possano completarne il gruppo (servono ${s.cfg.parties} arrivi). Stampate ${st.a} a e ${st.b} b.`):
    `In corso: ${st.a} a e ${st.b} b stampate.`;
   if(log.length){const d=el('details','plab-log',null,host);d.open=true;el('summary',null,'Ultimi passi',d);const ol=el('ol',null,null,d);log.forEach(t=>el('li',null,t,ol))}
  }
  render();
 }
 return {create,step,run,status,mount,PRESETS};
});
