(function(global){
 'use strict';
 const copy=o=>JSON.parse(JSON.stringify(o)),value=v=>Number.isInteger(v)&&v>=0&&v<=99;
 function analyze(operations,initial=0){
  if(!value(initial)||!Array.isArray(operations)||operations.length>2||operations.some(o=>!o||typeof o!=='object')||new Set(operations.map(o=>o.kind)).size!==operations.length)throw Error('Expected at most one write and one read');
  for(const o of operations)if(!['write','read'].includes(o.kind)||!Number.isInteger(o.start)||o.start<1||(o.end!==null&&(!Number.isInteger(o.end)||o.end<=o.start))||(o.kind==='write'&&(!value(o.input)||o.end===null))||(o.kind==='read'&&o.end!==null&&!value(o.result)))throw Error('Invalid operation interval');
  const stamps=operations.flatMap(o=>o.end===null?[o.start]:[o.start,o.end]);if(new Set(stamps).size!==stamps.length)throw Error('Observer event numbers must be unique');
  const done=operations.filter(o=>o.end!==null),perms=done.length<2?[done]:[done,[...done].reverse()];
  const orders=perms.filter(order=>{if(order.some((o,i)=>order.slice(i+1).some(p=>p.end<o.start)))return false;let state=initial;for(const o of order){if(o.kind==='write')state=o.input;else if(o.result!==state)return false}return true}).map(p=>p.map(o=>o.kind));
  return {linearizable:orders.length>0,orders,pending:operations.filter(o=>o.end===null).map(o=>o.kind)};
 }
 class Model{
  constructor(policy='local',initial=0){if(!['local','authority'].includes(policy)||!value(initial))throw Error('Invalid register policy or initial value');this.policy=policy;this.initial=initial;this.values=[initial,initial];this.connected=true;this.operations=[];this.queue=[];this.events=[];this.clock=0;this.messageId=0}
  log(type,at,detail){this.events.push({time:++this.clock,type,at,...detail});return this.clock}
  enqueue(kind,from,to,v){const m={id:'m'+(++this.messageId),kind,from,to,value:v??null};this.queue.push(m);this.log('queued',from,{message:copy(m)});return m.id}
  setConnected(connected){if(typeof connected!=='boolean'||connected===this.connected)throw Error('Choose a different network state');this.connected=connected;this.log(connected?'heal':'partition',null,{})}
  write(v=1){if(!value(v)||this.operations.some(o=>o.kind==='write'))throw Error('One valid write per experiment');const start=this.log('write-start','G1',{value:v});this.values[0]=v;const op={kind:'write',node:'G1',input:v,start,end:this.log('write-end','G1',{value:v}),result:'OK'};this.operations.push(op);if(this.policy==='local')this.enqueue('sync','G1','G2',v);return copy(op)}
  read(){if(this.operations.some(o=>o.kind==='read'))throw Error('One read per experiment');const op={kind:'read',node:'G2',start:this.log('read-start','G2',{}),end:null,result:null};this.operations.push(op);if(this.policy==='local'){op.result=this.values[1];op.end=this.log('read-end','G2',{value:op.result})}else this.enqueue('query','G2','G1');return copy(op)}
  deliver(id){const i=this.queue.findIndex(m=>m.id===id);if(!this.connected||i<0)throw Error('Message cannot cross now');const m=this.queue.splice(i,1)[0];this.log('delivered',m.to,{message:copy(m)});if(m.kind==='sync')this.values[1]=m.value;else if(m.kind==='query')this.enqueue('reply','G1','G2',this.values[0]);else{const op=this.operations.find(o=>o.kind==='read');if(!op||op.end!==null)throw Error('Unexpected reply');op.result=m.value;op.end=this.log('read-end','G2',{value:m.value})}return copy(m)}
  get analysis(){return analyze(this.operations,this.initial)}
  observationsG2(){return this.events.filter(e=>e.at==='G2').map(({time,...e})=>{if(e.message){e=copy(e);delete e.message.id}return e})}
  snapshot(){return copy({policy:this.policy,connected:this.connected,values:this.values,operations:this.operations,queue:this.queue,events:this.events,analysis:this.analysis})}
 }
 const scenarios=[
  {id:'no-write',label:'No write: read returns the initial value',policy:'local',actions:['partition','read']},
  {id:'stale',label:'Completed write, then local read: violation persists after healing',policy:'local',actions:['partition','write','read','heal','deliver']},
  {id:'wait',label:'Authority read: pending during partition, then returns 1',policy:'authority',actions:['partition','write','read','heal','deliver','deliver']},
  {id:'read-first',label:'Local read completes before the write: returning 0 is valid',policy:'local',actions:['partition','read','write']},
  {id:'overlap-old',label:'Read overlaps the write: a delayed reply containing 0 is valid',policy:'authority',actions:['read','deliver','write','deliver']},
  {id:'overlap-new',label:'Read overlaps the write: consulting the authority later returns 1',policy:'authority',actions:['read','write','deliver','deliver']}
 ];
 function step(m,a){if(a==='partition')m.setConnected(false);else if(a==='heal')m.setConnected(true);else if(a==='write')m.write();else if(a==='read')m.read();else if(a==='deliver')m.deliver(m.queue[0]?.id);else throw Error('Unknown action');return m.snapshot()}
 function trace(s){const m=new Model(s.policy);return s.actions.map(action=>({action,...step(m,action)}))}
 function mount(selector){const host=document.querySelector(selector);if(!host)return;let m=new Model();
  const el=(tag,text,parent)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(parent)parent.appendChild(e);return e};
  function paint(focus){host.replaceChildren();host.dataset.capRegister='true';const lab=el('label','Read policy (changing it starts a fresh experiment)',host);lab.htmlFor='cap-policy';const select=el('select',undefined,host);select.id=lab.htmlFor;select.style.cssText='display:block;max-width:100%;font:inherit;background:#FAF7EF;border:1px solid #1546B8;padding:6px;margin:.5em 0';for(const [v,t]of [['local','Serve G2’s local copy'],['authority','Consult the authority at G1']]){const o=el('option',t,select);o.value=v}select.value=m.policy;select.addEventListener('change',()=>{m=new Model(select.value);paint(select.id)});
   el('p','One write at G1, one read at G2; both nodes remain alive. A broken link prevents delivery, not local computation. Queued messages can be retried/delivered after healing. The authority policy does not detect partitions: it simply waits for its reply.',host);
   const status=el('p',`Network: ${m.connected?'connected':'partitioned'}. G1 = ${m.values[0]}; G2 ${m.policy==='local'?'copy':'unused cache'} = ${m.values[1]}.`,host);status.setAttribute('role','status');
   const controls=el('div',undefined,host);controls.style.cssText='display:flex;flex-wrap:wrap;gap:8px';
   const button=(parent,id,label,disabled,fn)=>{const b=el('button',label,parent);b.id=id;b.type='button';b.disabled=disabled;b.style.cssText='font:inherit;padding:6px 10px;border:1px solid #1546B8;background:#FAF7EF;color:#1546B8';if(disabled)b.style.opacity='.55';b.addEventListener('click',()=>{fn();paint('cap-reset')});return b};
   button(controls,'cap-write','Write(1) at G1',m.operations.some(o=>o.kind==='write'),()=>m.write());button(controls,'cap-read','Read at G2',m.operations.some(o=>o.kind==='read'),()=>m.read());button(controls,'cap-network',m.connected?'Partition link':'Heal link',false,()=>m.setConnected(!m.connected));button(controls,'cap-reset','Reset',false,()=>{m=new Model(m.policy)});
   const pending=el('div',undefined,host);el('p','Pending network messages: '+m.queue.length,pending);for(const q of m.queue)button(pending,'cap-deliver-'+q.id,`Deliver ${q.id}: ${q.kind} ${q.from} → ${q.to}${q.value!==null?' ('+q.value+')':''}`,!m.connected,()=>m.deliver(q.id));
   const a=m.analysis,verdict=el('p',a.linearizable?'Completed history is linearizable.':'Completed history is NOT linearizable: no legal order preserves both real-time precedence and the returned value.',host);verdict.dataset.capVerdict='true';verdict.style.color=a.linearizable?'#1546B8':'#B83D2D';
   if(a.pending.length)el('p','Read pending. This finite pause alone is not an availability proof; if the partition prevents its messages forever, this request never completes.',host);else el('p','All invoked operations completed in this run. That is not a proof of availability for every possible execution.',host);
   el('p','Observer event numbers, not physical clocks visible to the nodes. Scroll the table horizontally on narrow screens.',host);
   const region=el('div',undefined,host);region.style.cssText='max-width:100%;overflow-x:auto';region.setAttribute('role','region');region.setAttribute('aria-label','Operation history, horizontally scrollable');region.tabIndex=0;const t=el('table',undefined,region);t.style.cssText='min-width:520px;width:100%;table-layout:fixed';el('caption','Operation history',t);const header=el('tr',undefined,el('thead',undefined,t));for(const h of ['Operation','Start','Finish','Result'])el('th',h,header).scope='col';const tbody=el('tbody',undefined,t);tbody.dataset.capOperations='true';for(const o of m.operations){const tr=el('tr',undefined,tbody);el('th',o.kind==='write'?'write(1) at G1':'read at G2',tr).scope='row';for(const v of [o.start,o.end??'pending',o.end===null?'—':o.result])el('td',String(v),tr)}
   const examples=el('div',undefined,host);examples.style.cssText='display:flex;gap:8px;flex-wrap:wrap';button(examples,'cap-witness','Run partition → write → read',false,()=>{m=new Model(m.policy);for(const a of ['partition','write','read'])step(m,a)});if(focus)document.getElementById(focus)?.focus({preventScroll:true});
  }
  paint();
 }
 const api={Model,analyze,scenarios,step,trace,mount};if(typeof module==='object'&&module.exports)module.exports=api;else global.CapRegister=api;
})(typeof window==='undefined'?globalThis:window);
