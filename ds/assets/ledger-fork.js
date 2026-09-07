(function(global){
 'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x));
 const initial={Alice:40,Bob:10,Carol:4,Eve:1}; // integer half-units
 const definitions=[
  {id:'g',parent:null,work:0,proposals:[]},
  {id:'b1',parent:'g',work:1,proposals:[{from:'Alice',to:'Bob',amount:6}]},
  {id:'b2',parent:'b1',work:1,proposals:[{from:'Bob',to:'Carol',amount:2},{from:'Eve',to:'Alice',amount:4}]},
  {id:'b3a',parent:'b2',work:1,proposals:[{from:'Carol',to:'Bob',amount:1}]},
  {id:'b3b',parent:'b2',work:1,proposals:[{from:'Alice',to:'Carol',amount:4}]},
  {id:'b4',parent:'b3b',work:1,proposals:[{from:'Carol',to:'Eve',amount:2}]}
 ];
 function build(spec=definitions){
  if(!Array.isArray(spec)||!spec.length||spec.length>24)throw Error('Expected 1–24 block proposals');const blocks=[];
  for(const d of spec){if(!d||!/^[a-z][a-z0-9]*$/.test(d.id)||blocks.some(b=>b.id===d.id)||!Number.isSafeInteger(d.work)||d.work<0||!Array.isArray(d.proposals))throw Error('Invalid block');
   const parent=blocks.find(b=>b.id===d.parent);if(blocks.length===0?d.parent!==null||d.work!==0||d.proposals.length:!parent||d.work<1)throw Error('Genesis first; every child needs an earlier parent and positive work');
   const state=clone(parent?parent.state:initial),included=[],rejected=[];
   for(const t of d.proposals){if(!t||!Object.hasOwn(state,t.from)||!Object.hasOwn(state,t.to)||!Number.isSafeInteger(t.amount)||t.amount<=0)throw Error('Invalid transfer fixture');if(state[t.from]<t.amount){rejected.push({...t,reason:'insufficient funds'});continue}state[t.from]-=t.amount;state[t.to]+=t.amount;included.push(clone(t))}
   const totalWork=(parent?.totalWork||0)+d.work;if(!Number.isSafeInteger(totalWork))throw Error('Work total exceeds exact integer range');
   blocks.push({id:d.id,parent:d.parent,work:d.work,totalWork,height:parent?parent.height+1:0,state,included,rejected});
  }return blocks;
 }
 function branch(blocks,tip){const path=[];let b=blocks.find(b=>b.id===tip);if(!b)throw Error('Unknown tip');while(b){path.unshift(b.id);b=blocks.find(x=>x.id===b.parent)}return path}
 function arrivals(blocks=build()){let tip=blocks[0].id;return blocks.map((b,i)=>{const previous=tip;if(b.totalWork>blocks.find(x=>x.id===tip).totalWork)tip=b.id;const before=branch(blocks,previous),after=branch(blocks,tip);return {arrived:b.id,tip,known:blocks.slice(0,i+1).map(x=>x.id),removed:before.filter(id=>!after.includes(id)),added:after.filter(id=>!before.includes(id)),state:clone(blocks.find(x=>x.id===tip).state)}})}
 const units=x=>String(x/2),transfer=t=>`${t.from} → ${t.to}: ${units(t.amount)}`;
 function mount(selector){const host=document.querySelector(selector);if(!host)return;const blocks=build(),history=arrivals(blocks);let index=0,selected='g';const el=(tag,text,parent)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(parent)parent.appendChild(e);return e};
  function paint(focus){host.replaceChildren();host.dataset.ledgerFork='true';const s=history[index],b=blocks.find(b=>b.id===selected),path=branch(blocks,s.tip);
   const controls=el('div',undefined,host);controls.style.cssText='display:flex;gap:8px;flex-wrap:wrap';function button(id,text,disabled,action,parent=controls){const e=el('button',text,parent);e.type='button';e.id=id;e.disabled=disabled;e.style.cssText='font:inherit;padding:6px 10px;background:#FAF7EF;color:#1546B8;border:1px solid #1546B8';e.style.opacity=disabled?'.5':'1';e.onclick=()=>{action();paint(id)};return e}
   button('fork-next','Receive next block',index===history.length-1,()=>{index++;selected=history[index].arrived});button('fork-reset','Reset',false,()=>{index=0;selected='g'});
   const status=el('p',`Received ${s.arrived.toUpperCase()}. Selected tip: ${s.tip.toUpperCase()}. Active branch: ${path.map(x=>x.toUpperCase()).join(' → ')}.`,host);status.setAttribute('role','status');
   el('p',s.removed.length?`Reorganization: detach ${s.removed.join(', ').toUpperCase()}; attach ${s.added.join(', ').toUpperCase()}. Replay from the common ancestor, not from the other branch’s final balances.`:'Equal cumulative work keeps the first-seen tip in this teaching example. This tie policy is not a finality guarantee.',host);
   const chooser=el('div',undefined,host);chooser.style.cssText='display:flex;gap:8px;flex-wrap:wrap';for(const id of s.known){const e=button('fork-block-'+id,id.toUpperCase(),false,()=>{selected=id},chooser);e.setAttribute('aria-pressed',String(id===selected));e.style.background=id===selected?'#1546B8':'#FAF7EF';e.style.color=id===selected?'#FAF7EF':'#1546B8'}
   const panel=el('div',undefined,host);panel.dataset.forkDetail='true';el('h4',`${b.id.toUpperCase()} · height ${b.height} · parent ${b.parent?.toUpperCase()||'none'}`,panel);el('p',`Work: ${b.work}; cumulative: ${b.totalWork}. ${path.includes(b.id)?'On the selected branch.':'Known alternative branch; not selected.'}`,panel);
   el('p','Included transfers: '+(b.included.map(transfer).join('; ')||'none'),panel);el('p','Rejected before inclusion: '+(b.rejected.map(t=>transfer(t)+' ('+t.reason+')').join('; ')||'none'),panel);
   el('p','Balances after this block: '+Object.entries(b.state).map(([n,v])=>n+'='+units(v)).join(', ')+' units.',panel);el('p','Active-tip balances: '+Object.entries(s.state).map(([n,v])=>n+'='+units(v)).join(', ')+' units.',host).dataset.forkBalances='true';
   if(focus){const e=document.getElementById(focus);(e&&!e.disabled?e:document.getElementById('fork-reset')).focus({preventScroll:true})}
  }paint();
 }
 const api={build,branch,arrivals,units,transfer,mount};if(typeof module==='object'&&module.exports)module.exports=api;else global.LedgerFork=api;
})(typeof window==='undefined'?globalThis:window);
