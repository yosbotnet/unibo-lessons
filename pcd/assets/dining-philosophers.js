// Atomic instruction model, non-fair binary/counting semaphores, no failures.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DiningPhilosophers=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const modes={naive:'Prima sinistra, poi destra',ticket:'Ticket N−1',ordered:'Ordine totale'};
 class Model {
  constructor(mode='naive',n=5){if(!Object.hasOwn(modes,mode)||!Number.isInteger(n)||n<2||n>8)throw Error('Invalid configuration');this.mode=mode;this.n=n;this.pc=Array(n).fill(0);this.owner=Array(n).fill(null);this.admitted=Array(n).fill(false);this.meals=Array(n).fill(0)}
  program(i){if(!Number.isInteger(i)||i<0||i>=this.n)throw Error('Invalid philosopher');const forks=[i,(i+1)%this.n];if(this.mode==='ordered')forks.sort((a,b)=>a-b);return [['think'],...(this.mode==='ticket'?[['ticket']]:[]),['take',forks[0]],['take',forks[1]],['eat'],['release',forks[0]],['release',forks[1]],...(this.mode==='ticket'?[['return-ticket']]:[])]}
  instruction(i){return this.program(i)[this.pc[i]]}
  enabled(i){const [op,f]=this.instruction(i);return op==='take'?this.owner[f]===null:op==='ticket'?this.admitted.filter(Boolean).length<this.n-1:true}
  runnable(){return this.pc.map((_,i)=>i).filter(i=>this.enabled(i))}
  waits(){return this.pc.flatMap((_,i)=>{const [op,f]=this.instruction(i);return op==='take'&&this.owner[f]!==null?[{from:i,to:this.owner[f],fork:f}]:[]})}
  cycles(){const next=new Map(this.waits().map(e=>[e.from,e.to])),cycles=[],known=new Set();for(let i=0;i<this.n;i++){const path=[],seen=new Map();let p=i;while(next.has(p)&&!seen.has(p)){seen.set(p,path.length);path.push(p);p=next.get(p)}if(seen.has(p)){let c=path.slice(seen.get(p));const min=Math.min(...c),k=c.indexOf(min);c=[...c.slice(k),...c.slice(0,k)];const key=c.join(',');if(!known.has(key)){known.add(key);cycles.push(c)}}}return cycles}
  step(i){if(!this.enabled(i))throw Error('Instruction blocked');const [op,f]=this.instruction(i),label=actionLabel(this,i);if(op==='take')this.owner[f]=i;else if(op==='release'){if(this.owner[f]!==i)throw Error('Release without ownership');this.owner[f]=null}else if(op==='ticket')this.admitted[i]=true;else if(op==='return-ticket')this.admitted[i]=false;else if(op==='eat'){if(this.owner[i]!==i||this.owner[(i+1)%this.n]!==i)throw Error('Eating without both forks');this.meals[i]++}this.pc[i]=(this.pc[i]+1)%this.program(i).length;return 'F'+i+': '+label}
  clone(){const m=new Model(this.mode,this.n);for(const k of ['pc','owner','admitted','meals'])m[k]=this[k].slice();return m}
  key(){return JSON.stringify([this.pc,this.owner,this.admitted])}
 }
 function actionLabel(m,i){const [op,f]=m.instruction(i);return {think:'termina think',ticket:'wait(ticket)',eat:'eat', 'return-ticket':'signal(ticket)'}[op]||(op==='take'?'wait':'signal')+'(f'+f+')'}
 function status(m){const cycles=m.cycles();if(cycles.length)return 'Deadlock: '+cycles.map(c=>[...c,c[0]].map(i=>'F'+i).join(' → ')).join('; ')+'. Nessun rilascio può spezzare questo ciclo nel modello.';return 'Nessun deadlock nello stato corrente. Istruzioni eseguibili: '+m.runnable().map(i=>'F'+i).join(', ')+'.'}
 const scenarios=[
  {id:'cycle',mode:'naive',title:'Primo tentativo: ciclo di attesa',steps:[0,1,2,3,4,0,1,2,3,4]},
  {id:'occupied',mode:'naive',title:'Cinque forchette occupate, ma nessun deadlock',steps:[0,0,0,2,2,2,4,4]},
  {id:'ticket',mode:'ticket',title:'Ticket: quattro ammessi, F3 può acquisire f4',steps:[0,1,2,3,4,0,1,2,3,0,1,2,3]},
  {id:'ordered',mode:'ordered',title:'Ordine totale: F4 attende f0 senza detenere f4',steps:[0,1,2,3,4,0,1,2,3]}
 ];
 function trace(s){const m=new Model(s.mode),rows=s.steps.map(i=>{const action=m.step(i);return {action,owners:m.owner.slice(),next:m.pc.map((_,j)=>actionLabel(m,j)),runnable:m.runnable(),cycles:m.cycles()}});return {model:m,rows}}
 function mount(selector){const host=document.querySelector(selector);if(!host)return;let model=new Model(),selected='naive',last='Stato iniziale.',focus=null;
  const el=(tag,text,parent)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(parent)parent.appendChild(e);return e};
  function button(label,key,fn,parent,disabled=false){const b=el('button',label,parent);b.type='button';b.dataset.diningAction=key;b.disabled=disabled;b.addEventListener('click',()=>{fn();focus=key;render()});return b}
  function render(){host.replaceChildren();host.dataset.diningReady='true';
   const label=el('label','Protocollo: ',host),select=el('select','',label);select.id='dining-mode';for(const [v,t]of Object.entries(modes)){const o=el('option',t,select);o.value=v}select.value=selected;select.addEventListener('change',()=>{selected=select.value;model=new Model(selected);last='Nuova esecuzione: cambiare protocollo reimposta lo stato, non recupera un deadlock.';focus='mode';render()});
   const controls=el('div','',host);controls.className='dining-controls';for(let i=0;i<model.n;i++)button('F'+i+': '+actionLabel(model,i),'step-'+i,()=>{last=model.step(i)},controls,!model.enabled(i));
   button('Reimposta','reset',()=>{model=new Model(selected);last='Stato iniziale.'},controls);
   const examples=el('div','',host);examples.className='dining-controls';for(const s of scenarios)button(s.title,'example-'+s.id,()=>{model=trace(s).model;selected=s.mode;last='Caricata una traccia eseguita: '+s.steps.length+' istruzioni.'},examples);
   const region=el('div','',host);region.className='dining-scroll';region.tabIndex=0;region.setAttribute('role','region');region.setAttribute('aria-label','Stato dei cinque filosofi — scorrimento orizzontale');
   const table=el('table','',region),head=el('tr','',el('thead','',table));for(const h of ['Filosofo','Forchette detenute','Prossima istruzione','Attesa','Pasti'])el('th',h,head).scope='col';const body=el('tbody','',table);body.dataset.diningRows='true';
   for(let i=0;i<model.n;i++){const row=el('tr','',body);el('th','F'+i,row).scope='row';const held=model.owner.flatMap((p,f)=>p===i?['f'+f]:[]),wait=model.waits().find(e=>e.from===i);for(const t of [held.join(', ')||'—',actionLabel(model,i),wait?'f'+wait.fork+' detenuta da F'+wait.to:!model.enabled(i)?'ticket esauriti':'—',String(model.meals[i])])el('td',t,row)}
   const state=el('p',status(model),host);state.setAttribute('role','status');state.tabIndex=-1;state.dataset.diningStatus='true';el('p',last,host);if(selected==='ticket')el('p','Ticket in uso: '+model.admitted.filter(Boolean).length+'/'+(model.n-1)+'.',host);
   el('p','Ogni pulsante esegue una sola istruzione atomica. I wait occupati non avanzano; si riabilitano dopo il rilascio. Il modello non impone FIFO o equità dello scheduler e non garantisce assenza di starvation.',host);
   if(focus){const target=focus==='mode'?select:host.querySelector('[data-dining-action="'+focus+'"]');(target&&!target.disabled?target:state).focus()}
  }render();
 }
 return {Model,modes,actionLabel,status,scenarios,trace,mount};
});
