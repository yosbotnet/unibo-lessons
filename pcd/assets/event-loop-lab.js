// Event loop stepper: call stack, task queue, microtask queue and background work (worker threads, timers).
// The reader advances the loop one step at a time and decides when the background worker finishes.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.EventLoopLab=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const SUB=['₀','₁','₂','₃','₄','₅'];
 // x = x + res with res = 10: the "asyncTask" of the exam question (L1, L2, L3)
 const L1={src:'x = 0                        // L1',run(L){L.vars.x=0;L.trace.push('L1');return 'x = 0'}};
 const L3={src:'x = x + 1                    // L3',run(L){L.vars.x+=1;L.trace.push('L3');return 'x = '+L.vars.x}};
 const L2=(res)=>({src:'x = x + res                  // L2 (res = '+res+')',run(L,F){L.vars.x+=res;L.trace.push('L2');return 'x = '+L.vars.x}});
 // background asyncTask whose completion resolves promise p (used by the promise and await scenarios)
 function asyncTaskPromise(L){const p=L.promise();
  L.background('asyncTask(x): calcola res = 10',()=>L.enqueueTask('completamento di asyncTask',[{src:'resolve(p, 10)       // la promise diventa fulfilled',run(L){L.resolve(p,10);return 'le reazioni registrate su p vanno nella coda dei microtask'}}]));
  return p}
 const timerTask=(label,text,read)=>[{src:text,run(L){const v=read();L.out.push(v);return 'stampa '+v}}];
 function loopScenario(perIteration){return function(L){
  const code=[perIteration
   ?{src:'let i = 0          // binding i₀ della prima iterazione',run(L){L.i=L.bind('i'+SUB[0],0);return L.i.name+' = 0'}}
   :{src:'var i = 0          // un solo binding i per tutta la funzione',run(L){L.i=L.bind('i',0);return 'i = 0'}}];
  for(let k=0;k<3;k++){
   code.push({src:'i < 3 ?',run(L){return L.i.value<3?'vero (i = '+L.i.value+'): esegue il corpo':'falso'}});
   code.push({src:'setTimeout(() => console.log(i), 0)',run(L){const b=L.i,c=L.closures.length+1;L.closures.push({n:c,b});
    L.background('timer '+c+' (0 ms)',()=>L.enqueueTask('timer '+c+': () => console.log(i)',timerTask('t'+c,'console.log(i)       // legge il binding catturato: '+b.name,()=>String(b.value))),true);
    return 'la closure '+c+' cattura il binding '+b.name+'; il timer scade subito e il suo evento entra in coda'}});
   code.push(perIteration
    ?{src:'fine iterazione: nuovo binding = copia di i, poi i++',run(L){const nb=L.bind('i'+SUB[k+1],L.i.value);const old=L.i;L.i=nb;nb.value++;return nb.name+' = '+nb.value+', mentre '+old.name+' resta '+old.value}}
    :{src:'i++',run(L){L.i.value++;return 'i = '+L.i.value+' (lo stesso binding visto da tutte le closure)'}});
  }
  code.push({src:'i < 3 ?',run(L){return 'falso (i = '+L.i.value+'): il for termina'}});
  return code}}
 const scenarios={
  callback:{title:'Callback: in che ordine vanno L1, L2, L3?',
   note:'asyncTask affida il lavoro a un thread in background e ritorna subito. Premi «Il worker finisce ora» quando vuoi, anche prima di eseguire L3: l\'evento entra in coda, ma L2 aspetta che lo stack sia vuoto. Se non lo premi mai, L2 non viene mai eseguita.',
   main:L=>[L1,
    {src:'asyncTask(x, (res) => { x = x + res })   // L2 nella callback',run(L){
     L.background('asyncTask(x): calcola res = 10',()=>L.enqueueTask('completamento di asyncTask → callback',[L2(10)]));
     return 'il compito va a un worker; la callback è registrata, non eseguita'}},
    L3]},
  promise:{title:'Promise: lo stesso codice con then',
   note:'asyncTask restituisce subito una promise pending; then registra L2 senza eseguirla. Il completamento del worker è un task che risolve la promise; la reazione di then diventa un microtask.',
   main:L=>[L1,
    {src:'p = asyncTask(x)             // promise pending',run(L){L.p=asyncTaskPromise(L);return 'p è pending'}},
    {src:'p.then((res) => { x = x + res })   // registra L2',run(L){L.then(L.p,'reazione di then (L2)',v=>L.frame('callback di then',[L2(v)]));return 'reazione registrata su p'}},
    L3]},
  await:{title:'async/await: lo stesso codice senza callback',
   note:'f parte subito, nello stesso ciclo. A «await p» f si sospende e il controllo torna al chiamante, che esegue L3. f riprende come microtask dopo che p è stata risolta.',
   main:L=>[L1,
    {src:'f()   // async function f() { res = await asyncTask(x); x = x + res }',run(L){L.stack.push(L.frame('f()',[
      {src:'p = asyncTask(x)',run(L,F){F.env.p=asyncTaskPromise(L);return 'p è pending'}},
      {src:'res = await p',run(L,F){L.stack.pop();L.then(F.env.p,'riprendi f dopo await',v=>{F.env.res=v;return F});
       return 'f si sospende (il suo stato è salvato) e il controllo torna a '+L.top().name}},
      {src:'x = x + res                  // L2',run(L,F){L.vars.x+=F.env.res;L.trace.push('L2');return 'res = '+F.env.res+', x = '+L.vars.x}}]));return 'chiamata di f: il suo corpo parte subito'}},
    L3]},
  var:{title:'var + setTimeout: che cosa stampa?',
   note:'Con var esiste un solo binding i, condiviso da tutte e tre le closure. Quando i timer vengono serviti il for è finito e i vale 3.',
   main:loopScenario(false)},
  let:{title:'let + setTimeout: che cosa stampa?',
   note:'Con let ogni iterazione ha un binding nuovo: ciascuna closure cattura il suo, che nessuno modifica più.',
   main:loopScenario(true)},
  micro:{title:'Task e microtask: A, B, C, D in che ordine?',
   note:'Una callback di setTimeout è un task; una reazione di una promise è un microtask. I microtask si eseguono appena lo stack si svuota, prima del task successivo.',
   main:L=>[
    {src:"console.log('A')",run(L){L.out.push('A');return 'stampa A'}},
    {src:"setTimeout(() => console.log('B'), 0)",run(L){L.background('timer (0 ms)',()=>L.enqueueTask('timer: () => console.log(\'B\')',timerTask('B',"console.log('B')",()=>'B')),true);return 'il timer scade subito: task in coda'}},
    {src:"Promise.resolve().then(() => console.log('C'))",run(L){const p=L.promise();L.resolve(p);L.then(p,'reazione di then: console.log(\'C\')',()=>L.frame('callback di then',timerTask('C',"console.log('C')",()=>'C')));return 'promise già risolta: la reazione va subito tra i microtask'}},
    {src:"console.log('D')",run(L){L.out.push('D');return 'stampa D'}}]}
 };
 class Loop{
  constructor(id){this.id=id;this.sc=scenarios[id];if(!this.sc)throw Error('Unknown scenario '+id);
   this.stack=[];this.tasks=[];this.micro=[];this.bg=[];this.out=[];this.log=[];this.vars={};this.bindings=[];this.closures=[];this.trace=[];this.n=0;this.cycle=1;
   this.stack.push(this.frame('script (primo task)',this.sc.main(this)));
   this.log.push('Ciclo 1: l\'event loop esegue lo script come primo task')}
  frame(name,code){return {name,code,pc:0,env:{}}}
  top(){return this.stack[this.stack.length-1]}
  bind(name,value){const b={name,value};this.bindings.push(b);return b}
  enqueueTask(label,code){this.tasks.push({label,code})}
  enqueueMicro(label,make){this.micro.push({label,make})}
  background(label,onDone,auto){const op={id:++this.n,label,onDone};if(auto)onDone();else this.bg.push(op);return op}
  complete(id){const op=this.bg.find(o=>o.id===id);if(!op)throw Error('No such background work');this.bg.splice(this.bg.indexOf(op),1);op.onDone();
   this.log.push('Il worker finisce «'+op.label+'»: il suo evento entra nella coda dei task')}
  promise(){return {state:'pending',value:undefined,reactions:[]}}
  resolve(p,v){if(p.state!=='pending')return;p.state='fulfilled';p.value=v;const r=p.reactions;p.reactions=[];r.forEach(f=>f(v))}
  then(p,label,make){const react=v=>this.enqueueMicro(label,()=>make(v));if(p.state==='pending')p.reactions.push(react);else react(p.value)}
  canStep(){return this.stack.length>0||this.micro.length>0||this.tasks.length>0}
  step(){const top=this.top();
   if(top){
    if(top.pc<top.code.length){const ins=top.code[top.pc++];const note=ins.run(this,top);this.log.push(top.name+': '+ins.src.replace(/\s+\/\/.*$/,'')+(note?' → '+note:''));return 'exec'}
    this.stack.pop();
    this.log.push(this.stack.length?top.name+' termina e restituisce il controllo a '+this.top().name
     :top.name+' termina: lo stack è vuoto'+(this.micro.length?'; prima del prossimo task si svuota la coda dei microtask':''));
    return 'pop'}
   if(this.micro.length){const m=this.micro.shift();this.stack.push(m.make());this.log.push('Microtask: '+m.label+' (stesso ciclo, prima di ogni altro task)');return 'micro'}
   if(this.tasks.length){const t=this.tasks.shift();this.cycle++;this.stack.push(this.frame(t.label,t.code));this.log.push('Ciclo '+this.cycle+': l\'event loop estrae il task «'+t.label+'»');return 'task'}
   return null}
  runAll(max=500){let k=0;while(this.canStep()&&k++<max)this.step();return this}
  status(){if(this.canStep())return this.log[this.log.length-1];
   return this.bg.length?'L\'event loop è in attesa: nessun evento in coda. Il worker di «'+this.bg[0].label+'» non ha ancora finito, e potrebbe non finire mai.'
    :'L\'event loop è in attesa: nessun evento in coda, nessun lavoro in background.'}
 }
 function mount(sel,opts={}){const host=document.querySelector(sel);if(!host)return;let id=opts.start||'callback',L=new Loop(id);
  const el=(tag,cls,text,parent)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;if(parent)parent.appendChild(e);return e};
  const btn=(label,parent,fn,disabled)=>{const b=el('button',null,label,parent);b.type='button';b.disabled=!!disabled;b.addEventListener('click',()=>{fn();render()});return b};
  const list=(parent,items)=>{if(!items.length){el('p','ell-empty','vuota',parent);return}const ol=el('ol',null,null,parent);items.forEach(t=>el('li',null,t,ol))};
  function render(){host.replaceChildren();host.classList.add('ell');
   const top=el('div','ell-row',null,host),lab=el('label',null,'Scenario: ',top),s=el('select',null,null,lab);
   for(const [k,v] of Object.entries(scenarios)){const o=el('option',null,v.title,s);o.value=k}s.value=id;
   s.addEventListener('change',()=>{id=s.value;L=new Loop(id);render();host.querySelector('select').focus()});
   el('p','ell-note',L.sc.note,host);
   const ctr=el('div','ell-row',null,host);
   btn('Passo',ctr,()=>L.step(),!L.canStep());
   btn('Fino all\'attesa',ctr,()=>L.runAll(),!L.canStep());
   for(const op of L.bg)btn('Il worker finisce ora: '+op.label,ctr,()=>L.complete(op.id));
   btn('Reset',ctr,()=>{L=new Loop(id)});
   const grid=el('div','ell-grid',null,host);
   const cs=el('div','ell-col',null,grid);el('h5',null,'Call stack',cs);
   if(!L.stack.length)el('p','ell-empty','vuoto: l\'event loop può prendere il prossimo evento',cs);
   [...L.stack].reverse().forEach((f,i)=>{const fr=el('div','ell-frame'+(i===0?' on':''),null,cs);el('p','ell-fname',f.name,fr);const ol=el('ol',null,null,fr);
    f.code.forEach((c,j)=>el('li',j<f.pc?'done':(j===f.pc&&i===0?'next':null),c.src,ol))});
   const q=el('div','ell-col',null,grid);
   el('h5',null,'Coda dei microtask',q);list(q,L.micro.map(m=>m.label));
   el('h5',null,'Coda dei task',q);list(q,L.tasks.map(t=>t.label));
   el('h5',null,'In background',q);list(q,L.bg.map(o=>o.label));
   const st=el('div','ell-state',null,host);
   if('x' in L.vars)el('p',null,'x = '+L.vars.x+(L.trace.length?'   ·   ordine eseguito: '+L.trace.join(' → '):''),st);
   if(L.bindings.length)el('p',null,'Binding: '+L.bindings.map(b=>b.name+' = '+b.value).join(', ')+(L.closures.length?'   ·   '+L.closures.map(c=>'closure '+c.n+' → '+c.b.name).join(', '):''),st);
   el('p',null,'Console: '+(L.out.join(', ')||'—'),st);
   const status=el('p','ell-status',L.status(),host);status.setAttribute('role','status');
   if(L.log.length>1){const d=el('details','ell-log',null,host);el('summary',null,'Registro ('+L.log.length+')',d);const ol=el('ol',null,null,d);L.log.forEach(l=>el('li',null,l,ol))}}
  render()}
 return {scenarios,Loop,mount};
});
