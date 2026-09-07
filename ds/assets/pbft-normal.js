(function(global){
 'use strict';
 const copy=x=>JSON.parse(JSON.stringify(x));
 class Model {
  constructor({f=1,faulty=[4]}={}){
   if(!Number.isInteger(f)||f<0||f>3)throw Error('Supported fault budget: 0–3');this.f=f;this.n=3*f+1;
   if(!Array.isArray(faulty)||faulty.length>f||new Set(faulty).size!==faulty.length||faulty.some(i=>!Number.isInteger(i)||i<2||i>this.n))throw Error('Only distinct backup faults within the budget');
   this.faulty=faulty.slice();this.nodes=Array.from({length:this.n},(_,i)=>({id:i+1,preprepare:false,prepares:[],commits:[],sentCommit:false,executed:false}));this.queue=[];this.events=[];this.nextId=0;this.started=false;this.replies=[];this.accepted=false;
  }
  #send(kind,from,to,digest='X',view=0,slot=1){const m={id:++this.nextId,kind,from,to,digest,view,slot};this.queue.push(m);this.events.push({type:'send',message:copy(m)});return m.id}
  start(){if(this.started)throw Error('One client request per run');this.started=true;this.#send('request',0,1)}
  // A controlled adversary can send its own votes, never impersonate a correct node.
  faultyVote({from,to,kind,digest='X',view=0,slot=1}){
   if(!this.started||!this.faulty.includes(from)||!Number.isInteger(to)||to<1||to>this.n||!['prepare','commit'].includes(kind)||!['X','Y'].includes(digest)||!Number.isInteger(view)||view<0||!Number.isInteger(slot)||slot<1)throw Error('Invalid Byzantine backup vote');
   return this.#send(kind,from,to,digest,view,slot);
  }
  add(list,id){if(!list.includes(id))list.push(id);list.sort((a,b)=>a-b)}
  advance(r){
   const prepared=r.preprepare&&r.prepares.length>=2*this.f;
   if(prepared&&!r.sentCommit){r.sentCommit=true;this.add(r.commits,r.id);this.events.push({type:'prepared',at:r.id});for(let to=1;to<=this.n;to++)if(to!==r.id)this.#send('commit',r.id,to)}
   if(prepared&&r.commits.length>=2*this.f+1&&!r.executed){r.executed=true;this.events.push({type:'execute',at:r.id,value:1});this.#send('reply',r.id,0)}
  }
  deliver(id){
   const index=this.queue.findIndex(m=>m.id===id);if(index<0)throw Error('Choose a queued message');const m=this.queue.splice(index,1)[0];this.events.push({type:'deliver',message:copy(m)});
   if(m.to===0){if(m.kind==='reply'&&m.digest==='X'&&m.view===0&&m.slot===1){this.add(this.replies,m.from);this.accepted=this.replies.length>=this.f+1}return copy(m)}
   if(this.faulty.includes(m.to)){this.events.push({type:'silent-backup',at:m.to});return copy(m)}
   const r=this.nodes[m.to-1];
   if(m.digest!=='X'||m.view!==0||m.slot!==1){this.events.push({type:'ignored-mismatch',at:m.to});return copy(m)}
   if(m.kind==='request'&&m.to===1&&!r.preprepare){r.preprepare=true;for(let to=2;to<=this.n;to++)this.#send('pre-prepare',1,to)}
   else if(m.kind==='pre-prepare'&&m.from===1&&!r.preprepare){r.preprepare=true;this.add(r.prepares,r.id);for(let to=1;to<=this.n;to++)if(to!==r.id)this.#send('prepare',r.id,to)}
   else if(m.kind==='prepare'&&m.from!==1)this.add(r.prepares,m.from);
   else if(m.kind==='commit')this.add(r.commits,m.from);
   this.advance(r);return copy(m);
  }
  snapshot(){return copy({f:this.f,n:this.n,faulty:this.faulty,started:this.started,queue:this.queue,events:this.events,replies:this.replies,accepted:this.accepted,nodes:this.nodes.map(r=>({...r,prepared:r.preprepare&&r.prepares.length>=2*this.f,committedLocal:r.preprepare&&r.prepares.length>=2*this.f&&r.commits.length>=2*this.f+1}))})}
 }
 function run(){const m=new Model();m.start();const rows=[{action:'Client sends request',...m.snapshot()}];while(m.queue.length){const q=m.deliver(m.queue[0].id);rows.push({action:`${q.kind}: ${q.from===0?'C':'R'+q.from} → ${q.to===0?'C':'R'+q.to}`,...m.snapshot()})}return rows}
 function mount(selector){const host=document.querySelector(selector);if(!host)return;let m=new Model();
  const el=(tag,text,parent)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(parent)parent.appendChild(e);return e};
  function paint(focus){host.replaceChildren();host.dataset.pbftNormal='true';
   el('p','N = 4, f = 1. R1 is an honest primary; R4 is a silent Byzantine backup. One authenticated request X increments a counter from 0 to 1, in view 0 / slot 1. Earlier slots are already executed. Select actual messages to deliver in any order.',host);
   const controls=el('div',undefined,host);controls.style.cssText='display:flex;flex-wrap:wrap;gap:8px';
   const button=(parent,id,label,disabled,fn)=>{const b=el('button',label,parent);b.id=id;b.type='button';b.disabled=disabled;b.style.cssText='font:inherit;padding:6px 10px;border:1px solid #1546B8;background:#FAF7EF;color:#1546B8';if(disabled)b.style.opacity='.55';b.onclick=()=>{fn();paint(id==='pbft-reset'?'pbft-start':m.queue.length?'pbft-message':'pbft-reset')};return b};
   button(controls,'pbft-start','Send client request',m.started,()=>m.start());button(controls,'pbft-reset','Reset',false,()=>{m=new Model()});
   const lab=el('label','Pending message',host);lab.htmlFor='pbft-message';lab.style.cssText='display:block;margin-top:1em';const select=el('select',undefined,host);select.id=lab.htmlFor;select.style.cssText='font:inherit;max-width:100%;display:block;margin:.5em 0;padding:6px;background:#FAF7EF';select.disabled=!m.queue.length;
   for(const q of m.queue){const o=el('option',`#${q.id} ${q.kind}: ${q.from===0?'C':'R'+q.from} → ${q.to===0?'C':'R'+q.to}`,select);o.value=q.id}
   if(!m.queue.length)el('option','No queued messages',select);
   button(host,'pbft-deliver','Deliver selected message',!m.queue.length,()=>m.deliver(Number(select.value)));
   const status=el('p',`${m.queue.length} messages pending. Client: ${m.accepted?'accepted result 1':'waiting'}; matching replies from ${m.replies.length?m.replies.map(i=>'R'+i).join(', '):'none'} (needs ${m.f+1}).`,host);status.setAttribute('role','status');
   el('p','Prepare lists contain backup senders only (2 required); commit lists contain any replica (3 required), including a sender’s own logged vote. Counts are local evidence, not a global phase. Scroll the table horizontally on narrow screens.',host);
   const region=el('div',undefined,host);region.style.cssText='max-width:100%;overflow-x:auto';region.tabIndex=0;region.setAttribute('role','region');region.setAttribute('aria-label','Local PBFT evidence, horizontally scrollable');const t=el('table',undefined,region);t.style.cssText='width:100%;min-width:680px;table-layout:fixed';el('caption','Replica evidence for X / view 0 / slot 1',t);const tr=el('tr',undefined,el('thead',undefined,t));for(const h of ['Replica','Proposal','Prepares','Commits','State'])el('th',h,tr).scope='col';const body=el('tbody',undefined,t);body.dataset.pbftRows='true';
   for(const r of m.snapshot().nodes){const tr=el('tr',undefined,body);el('th','R'+r.id,tr).scope='row';const silent=m.faulty.includes(r.id);for(const v of [silent?'—':r.preprepare?'X':'waiting',silent?'—':r.prepares.join(', ')||'—',silent?'—':r.commits.join(', ')||'—',silent?'silent':r.executed?'executed: 1':r.prepared?'prepared':'waiting'])el('td',v,tr)}
   el('p','This is the normal-case message model, not complete PBFT: no faulty primary, view change, checkpoint transfer or cryptographic implementation. The conceptual recovery map above describes obligations that this model does not execute.',host);
   if(focus)document.getElementById(focus)?.focus({preventScroll:true});
  }paint();
 }
 const api={Model,run,mount};if(typeof module==='object'&&module.exports)module.exports=api;else global.PbftNormal=api;
})(typeof window==='undefined'?globalThis:window);
