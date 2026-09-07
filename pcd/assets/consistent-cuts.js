(function(global){
 'use strict';
 const demo={processes:[{id:'p1',label:'P1',events:['e1','e2','e3']},{id:'p2',label:'P2',events:['e4','e5','e6']}],messages:[{id:'m',send:'e2',receive:'e5'}]};
 const validId=id=>typeof id==='string'&&/^[a-z][a-z0-9-]{0,31}$/.test(id);
 function graph(spec){
  if(!spec||!Array.isArray(spec.processes)||spec.processes.length<2||spec.processes.length>6||!Array.isArray(spec.messages))throw Error('Expected 2–6 processes and messages');
  const nodes=new Map(),ids=new Set(),edges=[],messageIds=new Set(),used=new Set();
  for(const p of spec.processes){
   if(!p||!validId(p.id)||ids.has(p.id)||typeof p.label!=='string'||!p.label.trim()||p.label.length>24||!Array.isArray(p.events)||!p.events.length||p.events.length>8)throw Error('Invalid process');ids.add(p.id);
   p.events.forEach((id,i)=>{if(!validId(id)||nodes.has(id))throw Error('Invalid event ID');nodes.set(id,{id,process:p.id,index:i});if(i)edges.push([p.events[i-1],id])});
  }
  for(const m of spec.messages){
   if(!m||!validId(m.id)||messageIds.has(m.id)||!nodes.has(m.send)||!nodes.has(m.receive)||nodes.get(m.send).process===nodes.get(m.receive).process||used.has(m.send)||used.has(m.receive))throw Error('Invalid message endpoints');
   messageIds.add(m.id);used.add(m.send);used.add(m.receive);edges.push([m.send,m.receive]);
  }
  const ranks=Object.create(null),order=[];while(order.length<nodes.size){const ready=[...nodes.keys()].filter(id=>ranks[id]===undefined&&edges.filter(e=>e[1]===id).every(e=>ranks[e[0]]!==undefined));if(!ready.length)throw Error('Causal cycle');for(const id of ready){ranks[id]=Math.max(0,...edges.filter(e=>e[1]===id).map(e=>ranks[e[0]]+1));order.push(id)}}
  return {nodes,edges,ranks,order};
 }
 function analyze(spec,prefixes){
  const g=graph(spec);if(!Array.isArray(prefixes)||prefixes.length!==spec.processes.length)throw Error('One prefix per process');
  const included=[];spec.processes.forEach((p,i)=>{const k=prefixes[i];if(!Number.isInteger(k)||k<0||k>p.events.length)throw Error('Invalid prefix length');included.push(...p.events.slice(0,k))});const set=new Set(included);
  const messages=spec.messages.map(m=>({...m,status:set.has(m.send)?(set.has(m.receive)?'delivered':'in-transit'):(set.has(m.receive)?'orphan':'not-sent')}));
  return {prefixes:prefixes.slice(),included,consistent:messages.every(m=>m.status!=='orphan'),messages,violations:messages.filter(m=>m.status==='orphan').map(m=>m.id),inTransit:messages.filter(m=>m.status==='in-transit').map(m=>m.id),edges:g.edges};
 }
 const cases=[{id:'g1',label:'G1 · non consistente',prefixes:[1,2]},{id:'g2',label:'G2 · consistente, m in transito',prefixes:[2,1]},{id:'g3',label:'G3 · consistente, m già ricevuto',prefixes:[2,2]}];
 const statusLabels={'orphan':'ricezione inclusa, invio escluso: impossibile','in-transit':'in transito nel canale P1 → P2','delivered':'già ricevuto; canale vuoto','not-sent':'non ancora inviato; canale vuoto'};
 function mount(selector){
  const host=document.querySelector(selector);if(!host)return;const prefixes=[2,1];
  function el(tag,text,parent){const e=document.createElement(tag);if(text)e.textContent=text;if(parent)parent.appendChild(e);return e}
  function render(focus){
   host.replaceChildren();host.dataset.cutExplorer='true';el('p','Scegli quanti eventi includere dall’inizio di ogni processo. Nessun evento locale può essere saltato; 0 indica lo stato iniziale.',host);
   const controls=el('div','',host);controls.style.cssText='display:flex;flex-wrap:wrap;gap:16px';
   demo.processes.forEach((p,i)=>{const group=el('div','',controls),lab=el('label',p.label+' · eventi inclusi',group);lab.htmlFor='cut-prefix-'+p.id;const s=el('select','',group);s.id=lab.htmlFor;s.style.cssText='display:block;font:inherit;max-width:100%;background:#FAF7EF;border:1px solid #1546B8;padding:6px';for(let k=0;k<=p.events.length;k++){const o=el('option',k===0?'0 · nessuno':`${k} · ${p.events.slice(0,k).join(', ')}`,s);o.value=String(k)}s.value=String(prefixes[i]);s.addEventListener('change',()=>{prefixes[i]=Number(s.value);render(s.id)})});
   const r=analyze(demo,prefixes),status=el('p',(r.consistent?'Taglio consistente. ':'Taglio NON consistente. ')+`Inclusi: ${r.included.join(', ')||'nessuno'}.`,host);status.setAttribute('role','status');status.style.color=r.consistent?'#1546B8':'#B83D2D';
   el('p','Messaggio m: '+statusLabels[r.messages[0].status]+'.',host).dataset.cutMessage='true';
   if(!r.consistent)el('p','e5 è nel taglio, ma la sua causa e2 no. Non si può correggere chiamando m “in transito”: manca proprio l’invio.',host);
   const presets=el('div','',host);presets.style.cssText='display:flex;flex-wrap:wrap;gap:8px';for(const c of cases){const b=el('button',c.id.toUpperCase(),presets);b.type='button';b.id='cut-case-'+c.id;b.style.cssText='font:inherit;padding:6px 10px;background:#FAF7EF;border:1px solid #1546B8;color:#1546B8';b.addEventListener('click',()=>{prefixes.splice(0,2,...c.prefixes);render(b.id)})}
   if(focus)document.getElementById(focus)?.focus({preventScroll:true});
  }
  render();
 }
 const api={demo,graph,analyze,cases,statusLabels,mount};if(typeof module==='object'&&module.exports)module.exports=api;else global.ConsistentCuts=api;
})(typeof window==='undefined'?globalThis:window);
