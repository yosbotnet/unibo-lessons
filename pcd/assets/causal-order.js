(function(global){
 'use strict';
 const copy=m=>m.map(row=>row.slice());
 // Point-to-point, fixed membership, reliable exactly-once non-FIFO delivery.
 // Matrix is send counts known through application events, not network arrival.
 class Model {
  constructor(n=3){
   if(!Number.isInteger(n)||n<2||n>8)throw Error('Use 2–8 processes');
   this.processes=Array.from({length:n},(_,id)=>({id,matrix:Array.from({length:n},()=>Array(n).fill(0)),buffer:[],delivered:[]}));
   this.messages=[];this.network=[];this.events=[];
  }
  process(id){const p=this.processes[id];if(!Number.isInteger(id)||!p)throw Error('Unknown process');return p}
  send(from,to){
   const p=this.process(from);this.process(to);if(from===to)throw Error('Only inter-process sends');
   p.matrix[from][to]++;const m={id:this.messages.length+1,from,to,stamp:copy(p.matrix)};
   this.messages.push(m);this.network.push(m.id);this.events.push({type:'send',id:m.id});return m.id;
  }
  eligible(m){const p=this.process(m.to);return m.stamp[m.from][m.to]===p.matrix[m.from][m.to]+1&&p.matrix.every((row,k)=>k===m.from||m.stamp[k][m.to]<=row[m.to])}
  arrive(id){
   const index=this.network.indexOf(id);if(index<0)throw Error('Message is not in the network');
   this.network.splice(index,1);const m=this.messages[id-1],p=this.process(m.to);p.buffer.push(id);this.events.push({type:'arrival',id});
   // A newly eligible buffered message may enable another; drain to a fixed point.
   let at;while((at=p.buffer.findIndex(id=>this.eligible(this.messages[id-1])))!==-1){
    const next=this.messages[p.buffer.splice(at,1)[0]-1];
    p.matrix=p.matrix.map((row,i)=>row.map((v,j)=>Math.max(v,next.stamp[i][j])));
    p.delivered.push(next.id);this.events.push({type:'deliver',id:next.id,column:p.matrix.map(row=>row[p.id])});
   }
  }
 }
 const scenarios=[
  {id:'overtake',label:'Sorpasso causale: m3 aspetta m1',steps:[
   ['send',0,2,'P1 invia m1 a P3.'],['send',0,1,'P1 invia m2 a P2, dopo m1.'],['arrival',2,null,'m2 arriva a P2 e viene consegnato.'],['send',1,2,'P2 invia m3 a P3, dopo la consegna di m2.'],['arrival',3,null,'m3 arriva a P3: manca m1, quindi resta nel buffer.'],['arrival',1,null,'m1 arriva: P3 consegna m1, poi sblocca e consegna m3.']
  ]},
  {id:'concurrent',label:'Concorrenza: il confronto corretto',steps:[
   ['send',0,2,'P1 invia m1 a P3.'],['send',1,2,'P2 invia m2 a P3 senza conoscere m1: gli invii sono concorrenti.'],['arrival',1,null,'P3 consegna m1: la propria colonna è [1,0,0].'],['arrival',2,null,'P3 consegna m2: 0 ≤ 1 per la riga P1. L’uguaglianza 0 == 1 lo bloccherebbe ingiustamente.']
  ]},
  {id:'fifo',label:'Stesso mittente: ripristina FIFO',steps:[
   ['send',0,2,'P1 invia m1 a P3.'],['send',0,2,'P1 invia m2 a P3 dopo m1.'],['arrival',2,null,'m2 arriva per primo: numero 2, ma P3 attende 1.'],['arrival',1,null,'Arriva m1: P3 consegna m1 e poi m2.']
  ]},
  {id:'early-bridge',label:'Un collegamento troppo presto non crea causalità',steps:[
   ['send',0,1,'P1 invia m1 a P2.'],['arrival',1,null,'P2 riceve e consegna m1.'],['send',0,2,'P1 invia m2 a P3 solo dopo questo collegamento.'],['send',1,2,'P2 invia m3 a P3 senza conoscere m2: m2 e m3 sono concorrenti.'],['arrival',3,null,'P3 può consegnare m3 subito; non deve aspettare m2.'],['arrival',2,null,'P3 consegna m2. Nessun vincolo causale è violato.']
  ]}
 ];
 function step(m,s){if(s[0]==='send')m.send(s[1],s[2]);else if(s[0]==='arrival')m.arrive(s[1]);else throw Error('Unknown step')}
 function trace(scenario){const m=new Model();return scenario.steps.map(s=>{const start=m.events.length;step(m,s);const p=m.process(2);return {action:s[3],deliveries:m.events.slice(start).filter(e=>e.type==='deliver').map(e=>'m'+e.id+' → P'+(m.messages[e.id-1].to+1)),column:p.matrix.map(row=>row[2]),buffer:p.buffer.map(id=>'m'+id)}})}
 function mount(selector){
  const host=document.querySelector(selector);if(!host)return;let selected=0,index=0,model=new Model();
  function el(tag,text,parent){const e=document.createElement(tag);if(text)e.textContent=text;if(parent)parent.appendChild(e);return e}
  function render(focus){
   host.replaceChildren();host.dataset.causalModel='true';
   const lab=el('label','Esempio da esplorare',host);lab.htmlFor='causal-scenario';const select=el('select','',host);select.id='causal-scenario';select.style.cssText='display:block;max-width:100%;font:inherit;margin:8px 0';
   scenarios.forEach((s,i)=>{const o=el('option',s.label,select);o.value=String(i)});select.value=String(selected);select.addEventListener('change',()=>{selected=Number(select.value);index=0;model=new Model();render('causal-scenario')});
   const controls=el('div','',host);controls.style.cssText='display:flex;flex-wrap:wrap;gap:8px';
   function button(id,label,fn,disabled){const b=el('button',label,controls);b.id=id;b.type='button';b.disabled=!!disabled;b.style.cssText='font:inherit;white-space:normal;padding:6px 10px;background:#FAF7EF;color:#1546B8;border:1px solid #1546B8';b.addEventListener('click',()=>{fn();render(id==='causal-next'&&index===scenarios[selected].steps.length?'causal-reset':id)});return b}
   const s=scenarios[selected];button('causal-next','Passo successivo',()=>{step(model,s.steps[index++])},index===s.steps.length);button('causal-reset','Reimposta',()=>{index=0;model=new Model()});
   const status=el('p',`Passo ${index}/${s.steps.length}. `+(index?s.steps[index-1][3]:'Ogni passo è un invio o un arrivo dalla rete; le consegne eligible seguono automaticamente.'),host);status.setAttribute('role','status');
   el('p','In rete: '+(model.network.map(id=>{const m=model.messages[id-1];return `m${id}: P${m.from+1} → P${m.to+1}`}).join('; ')||'nessuno'),host);
   const panels=el('div','',host);panels.style.cssText='display:flex;flex-wrap:wrap;gap:16px';
   for(const p of model.processes){const panel=el('div','',panels);panel.dataset.causalProcess=String(p.id+1);panel.style.cssText='flex:1 1 210px;min-width:0;max-width:100%';el('h4','P'+(p.id+1),panel);el('p','Consegne: '+(p.delivered.map(id=>'m'+id).join(' → ')||'nessuna'),panel).dataset.causalDeliveries='true';el('p','Buffer: '+(p.buffer.map(id=>'m'+id).join(', ')||'vuoto'),panel).dataset.causalBuffer='true';
    const t=el('table','',panel);el('caption',`M${p.id+1} · righe: mittenti; colonne: destinatari`,t);const r=el('tr','',el('thead','',t));for(const label of ['Da / a','P1','P2','P3'])el('th',label,r).scope='col';const body=el('tbody','',t);p.matrix.forEach((row,i)=>{const r=el('tr','',body);el('th','P'+(i+1),r).scope='row';for(const v of row)el('td',String(v),r)});
   }
   el('p','Le matrici cambiano all’invio o alla consegna applicativa, non per il semplice arrivo di un messaggio bloccato. Il buffer non impone ordine ai messaggi concorrenti.',host);
   global.NotesContentLayout?.refresh();if(focus)document.getElementById(focus)?.focus({preventScroll:true});
  }
  render();return ()=>model;
 }
 const api={Model,scenarios,step,trace,mount};if(typeof module==='object'&&module.exports)module.exports=api;else global.CausalOrder=api;
})(typeof window==='undefined'?globalThis:window);
