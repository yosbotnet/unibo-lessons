(function(global){
 'use strict';
 // Fixed membership; no failures; reliable, exactly-once messages; non-FIFO allowed.
 // Request counters, not Lamport clocks. Every message propagates causal knowledge.
 class Model {
  constructor(n=2){
   if(!Number.isInteger(n)||n<2||n>6)throw Error('Use 2–6 clients');
   this.clients=Array.from({length:n},(_,i)=>({id:i+1,v:Array(n).fill(0),mode:'IDLE',request:null}));
   this.coordinator={id:0,v:Array(n).fill(0),queue:[],granted:Array(n).fill(0),completed:Array(n).fill(0)};
   this.token={kind:'coordinator'};this.messages=[];this.network=[];this.requests=[];this.events=[];this.entries=[];
  }
  process(id){if(!Number.isInteger(id)||id<0||id>this.clients.length)throw Error('Unknown process');return id===0?this.coordinator:this.clients[id-1]}
  client(id){const p=this.process(id);if(id===0)throw Error('Coordinator is not a client');return p}
  send(type,from,to,request=null){
   const m={id:this.messages.length+1,type,from,to,v:this.process(from).v.slice(),request};this.process(to);
   this.messages.push(m);this.network.push(m.id);this.events.push({type:'send',id:m.id});return m;
  }
  request(id){
   const p=this.client(id);if(p.mode!=='IDLE')throw Error('One outstanding acquisition per client');
   p.v[id-1]++;const r={pid:id,seq:p.v[id-1],key:`P${id}#${p.v[id-1]}`,v:p.v.slice()};
   p.mode='WAITING';p.request=r;this.requests.push(r);this.events.push({type:'request',request:r});this.send('REQUEST',id,0,r);this.check();
  }
  application(from,to){this.client(from);this.client(to);if(from===to)throw Error('Use a different destination');this.send('APP',from,to);this.check()}
  eligible(r){const g=this.coordinator.granted;return r.v[r.pid-1]===g[r.pid-1]+1&&r.v.every((v,j)=>j===r.pid-1||v<=g[j])}
  checkRequests(){
   if(this.token.kind!=='coordinator')return;
   const c=this.coordinator,index=c.queue.findIndex(r=>this.eligible(r));if(index<0)return;
   const r=c.queue.splice(index,1)[0];c.granted[r.pid-1]++;this.events.push({type:'grant',request:r});
   const m=this.send('TOKEN',0,r.pid,r);this.token={kind:'outbound',pid:r.pid,key:r.key,message:m.id};
  }
  release(id){
   const p=this.client(id);if(p.mode!=='HELD'||this.token.kind!=='client'||this.token.pid!==id)throw Error('Client does not hold the token');
   const r=p.request;p.mode='IDLE';p.request=null;this.events.push({type:'exit',request:r});
   const m=this.send('RELEASE',id,0,r);this.token={kind:'returning',pid:id,key:r.key,message:m.id};this.check();
  }
  deliver(id){
   const index=this.network.indexOf(id);if(index<0)throw Error('Message not in transit');
   this.network.splice(index,1);const m=this.messages[id-1],p=this.process(m.to);
   p.v=p.v.map((v,i)=>Math.max(v,m.v[i]));this.events.push({type:'deliver',id});
   if(m.type==='REQUEST'){this.coordinator.queue.push(m.request);this.checkRequests()}
   else if(m.type==='TOKEN'){
    if(this.token.kind!=='outbound'||this.token.message!==id||p.mode!=='WAITING'||p.request.key!==m.request.key)throw Error('Unexpected grant');
    this.token={kind:'client',pid:p.id,key:m.request.key};p.mode='HELD';this.entries.push(m.request.key);this.events.push({type:'enter',request:m.request});
   }else if(m.type==='RELEASE'){
    if(this.token.kind!=='returning'||this.token.message!==id)throw Error('Unexpected token return');
    const c=this.coordinator;if(c.completed[m.from-1]+1!==m.request.seq)throw Error('Out-of-order completion');
    c.completed[m.from-1]++;this.token={kind:'coordinator'};this.events.push({type:'complete',request:m.request});this.checkRequests();
   }
   this.check();
  }
  check(){
   const held=this.clients.filter(p=>p.mode==='HELD'),moving=this.network.map(id=>this.messages[id-1]).filter(m=>m.type==='TOKEN'||m.type==='RELEASE');
   if(held.length>1)throw Error('Mutual exclusion violated');
   if(this.token.kind==='client'){if(held.length!==1||held[0].id!==this.token.pid||moving.length)throw Error('Token ownership violated')}
   else if(held.length)throw Error('Entered without receiving the token');
   if(['outbound','returning'].includes(this.token.kind)){if(moving.length!==1||moving[0].id!==this.token.message)throw Error('Token conservation violated')}
   else if(moving.length)throw Error('Duplicate token');
   const c=this.coordinator;let outstanding=0;for(let i=0;i<this.clients.length;i++){const delta=c.granted[i]-c.completed[i];if(delta<0||delta>1)throw Error('Invalid grant/completion counts');outstanding+=delta}
   if(outstanding!==(this.token.kind==='coordinator'?0:1))throw Error('Wrong outstanding grant count');
  }
 }
 const scenarios=[
  {id:'causal',label:'La richiesta successiva arriva prima',steps:[
   ['request',1,null,'P1 invia REQUEST [1,0], che resta in rete.'],
   ['application',1,2,'P1 invia a P2 un messaggio APP con [1,0].'],
   ['deliver',2,null,'P2 apprende la richiesta di P1 dal messaggio APP.'],
   ['request',2,null,'P2 invia REQUEST [1,1], causalmente successiva.'],
   ['deliver',3,null,'P0 riceve prima [1,1]: dipendenza da P1 non soddisfatta, token ancora a P0.'],
   ['deliver',1,null,'Arriva [1,0]: P0 concede P1 e invia TOKEN; non è ancora un ingresso in CS.'],
   ['deliver',4,null,'P1 riceve TOKEN ed entra in CS.'],
   ['release',1,null,'P1 esce e invia RELEASE. Il token è in viaggio verso P0.'],
   ['deliver',5,null,'P0 riceve RELEASE: completa P1 e concede P2, inviando TOKEN.'],
   ['deliver',6,null,'P2 riceve TOKEN ed entra in CS.'],
   ['release',2,null,'P2 esce e restituisce il token.'],
   ['deliver',7,null,'P0 riceve RELEASE: entrambe le richieste sono completate.']
  ]},
  {id:'concurrent',label:'Richieste concorrenti: perché serve ≤',steps:[
   ['request',1,null,'P1 invia REQUEST [1,0].'],['request',2,null,'P2 invia REQUEST [0,1] senza conoscere P1.'],
   ['deliver',1,null,'P0 concede P1 e invia TOKEN.'],['deliver',2,null,'P0 accoda [0,1]: è eligible, ma il token è già in viaggio verso P1.'],
   ['deliver',3,null,'P1 riceve TOKEN ed entra in CS.'],['release',1,null,'P1 esce e invia RELEASE.'],
   ['deliver',4,null,'P0 riacquisisce il token: 0 ≤ 1 permette di concedere P2; 0 == 1 lo bloccherebbe.'],
   ['deliver',5,null,'P2 riceve TOKEN ed entra in CS.'],['release',2,null,'P2 esce e invia RELEASE.'],['deliver',6,null,'Il token torna a P0: due cicli completi, sei messaggi di controllo.']
  ]}
 ];
 function step(m,s){if(!['request','application','deliver','release'].includes(s[0]))throw Error('Unknown action');m[s[0]](s[1],s[2])}
 function tokenLabel(m){const t=m.token;return t.kind==='coordinator'?'a P0':t.kind==='client'?`a P${t.pid} (in CS)`:t.kind==='outbound'?`in viaggio P0 → P${t.pid}`:`in viaggio P${t.pid} → P0`}
 function trace(s){const m=new Model();return s.steps.map(a=>{step(m,a);return {action:a[3],token:tokenLabel(m),granted:m.coordinator.granted.slice(),completed:m.coordinator.completed.slice(),queue:m.coordinator.queue.map(r=>r.key)}})}
 function mount(selector){
  const host=document.querySelector(selector);if(!host)return;let model=new Model(),focusKey;
  function el(tag,text,parent){const e=document.createElement(tag);if(text)e.textContent=text;if(parent)parent.appendChild(e);return e}
  function button(label,key,fn,parent,disabled=false){const b=el('button',label,parent);b.type='button';b.dataset.mutexAction=key;b.disabled=disabled;b.style.cssText='font:inherit;white-space:normal;max-width:100%;padding:6px 10px;text-align:left;background:#FAF7EF;color:'+(disabled?'#6E7068':'#1546B8')+';border:1px solid '+(disabled?'#C9C3B6':'#1546B8');b.addEventListener('click',()=>{fn();focusKey=key;render()});return b}
  function table(headers,parent,min=560){const t=el('table','',parent);t.style.cssText=`width:100%;min-width:${min}px`;const r=el('tr','',el('thead','',t));for(const h of headers)el('th',h,r).scope='col';return el('tbody','',t)}
  function render(){
   host.replaceChildren();host.dataset.mutexModel='true';
   el('p','Due client, un coordinatore corretto, canali affidabili senza duplicati. Scegli richieste, messaggi applicativi e ordine di consegna. APP propaga conoscenza delle richieste, non è un permesso.',host);
   const controls=el('div','',host);controls.style.cssText='display:flex;flex-wrap:wrap;gap:8px';
   for(const p of model.clients){button(`P${p.id}: richiedi CS`,'request-'+p.id,()=>model.request(p.id),controls,p.mode!=='IDLE');button(`P${p.id}: esci e restituisci`,'release-'+p.id,()=>model.release(p.id),controls,p.mode!=='HELD');button(`APP P${p.id} → P${3-p.id}`,'app-'+p.id,()=>model.application(p.id,3-p.id),controls)}
   button('Reimposta','reset',()=>{model=new Model()},controls);
   const rows=table(['Client','Stato','Vettore noto','Richiesta corrente'],host);rows.dataset.mutexClients='true';
   for(const p of model.clients){const r=el('tr','',rows);el('th','P'+p.id,r).scope='row';for(const s of [p.mode,'['+p.v.join(',')+']',p.request?`${p.request.key} [${p.request.v.join(',')}]`:'—'])el('td',s,r)}
   const c=model.coordinator,status=el('p',`Token: ${tokenLabel(model)}. Concesse: [${c.granted}]. Completate: [${c.completed}]. In CS: ${model.clients.filter(p=>p.mode==='HELD').map(p=>'P'+p.id).join(', ')||'nessuno'}.`,host);status.setAttribute('role','status');
   el('h4','Coda del coordinatore',host);const queue=table(['Richiesta','Vettore','Eligible','Token disponibile'],host);queue.dataset.mutexQueue='true';
   for(const r of c.queue){const tr=el('tr','',queue);for(const s of [r.key,'['+r.v+']',model.eligible(r)?'sì':'no',model.token.kind==='coordinator'?'sì':'no'])el('td',s,tr)}
   if(!c.queue.length)el('p','Nessuna richiesta accodata a P0.',host);
   el('h4','Messaggi in transito',host);const network=el('ul','',host);network.dataset.mutexNetwork='true';
   for(const id of model.network){const m=model.messages[id-1];button(`#${id} ${m.type}: P${m.from} → P${m.to} · [${m.v}]`,'msg-'+id,()=>model.deliver(id),el('li','',network))}
   if(!model.network.length)el('p','Nessun messaggio in rete.',host);
   el('p','Ingressi effettivi: '+(model.entries.join(' → ')||'nessuno')+'. Ogni TOKEN o RELEASE in transito porta l’unico permesso: P0 non può concederne un altro.',host);
   global.NotesContentLayout?.refresh();if(focusKey){(host.querySelector(`[data-mutex-action="${focusKey}"]:not(:disabled)`)||host.querySelector('[data-mutex-network] button')||host.querySelector('[data-mutex-action="reset"]'))?.focus({preventScroll:true});focusKey=null}
  }
  render();return ()=>model;
 }
 const api={Model,scenarios,step,trace,tokenLabel,mount};if(typeof module==='object'&&module.exports)module.exports=api;else global.CentralizedMutex=api;
})(typeof window==='undefined'?globalThis:window);
