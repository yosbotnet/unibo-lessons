// Space-time lab: the reader builds a distributed run (internal, send, receive events) and the lab computes
// Lamport clocks, vector clocks and the happened-before relation from the graph, so the three can be compared.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ClockLab=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const MAX_EVENTS=16;
 class Run{
  constructor(procs=['P','Q','R']){
   if(!Array.isArray(procs)||procs.length<2||procs.length>4)throw Error('Use 2–4 processes');
   this.procs=procs.slice();this.events=[];this.msgs=[];
  }
  idx(p){const i=typeof p==='number'?p:this.procs.indexOf(p);if(i<0||i>=this.procs.length)throw Error('Unknown process');return i}
  last(i){for(let k=this.events.length-1;k>=0;k--)if(this.events[k].p===i)return this.events[k];return null}
  full(){return this.events.length>=MAX_EVENTS}
  push(i,kind,msg,note){
   if(this.full())throw Error('Too many events');
   const prev=this.last(i),n=this.procs.length;
   let L=prev?prev.L:0,V=prev?prev.V.slice():Array(n).fill(0);
   if(kind==='recv'){L=Math.max(L,msg.L);V=V.map((x,k)=>Math.max(x,msg.V[k]))}
   L+=1;V[i]+=1;                                  // one tick per event, after the max on receive
   const local=this.events.filter(e=>e.p===i).length+1;
   const e={id:this.events.length,p:i,name:this.procs[i]+local,kind,L,V,msg:msg?msg.id:null,note:note||''};
   this.events.push(e);return e;
  }
  internal(p,note){return this.push(this.idx(p),'int',null,note)}
  send(p,q,note){
   const i=this.idx(p),j=this.idx(q);if(i===j)throw Error('Send to another process');
   const m={id:this.msgs.length,name:'m'+(this.msgs.length+1),from:i,to:j,send:null,recv:null,L:0,V:null};
   const e=this.push(i,'send',null,note);m.send=e.id;m.L=e.L;m.V=e.V.slice();e.msg=m.id;this.msgs.push(m);return e;
  }
  inTransit(){return this.msgs.filter(m=>m.recv===null)}
  receive(mid,note){
   const m=this.msgs[mid];if(!m||m.recv!==null)throw Error('Message not in transit');
   const e=this.push(m.to,'recv',m,note);m.recv=e.id;return e;
  }
  undo(){const e=this.events.pop();if(!e)return;
   if(e.kind==='send')this.msgs.pop();else if(e.kind==='recv')this.msgs[e.msg].recv=null}
  // Direct successors in the happened-before graph: next local event, and send -> matching receive.
  succ(id){const e=this.events[id],out=[];
   const next=this.events.find(x=>x.p===e.p&&x.id>id);if(next)out.push(next.id);
   if(e.kind==='send'){const m=this.msgs[e.msg];if(m.recv!==null)out.push(m.recv)}
   return out}
  path(a,b){ // a shortest chain a -> ... -> b, or null
   if(a===b)return null;const prev=new Map([[a,-1]]),q=[a];
   while(q.length){const x=q.shift();for(const y of this.succ(x))if(!prev.has(y)){prev.set(y,x);if(y===b){const p=[b];let z=x;while(z!==-1){p.unshift(z);z=prev.get(z)}return p}q.push(y)}}
   return null}
  hb(a,b){return this.path(a,b)!==null}
  static vcLess(v,w){let strict=false;for(let k=0;k<v.length;k++){if(v[k]>w[k])return false;if(v[k]<w[k])strict=true}return strict}
  compare(a,b){
   const A=this.events[a],B=this.events[b];
   const rel=a===b?'same':this.hb(a,b)?'before':this.hb(b,a)?'after':'concurrent';
   const vc=Run.vcLess(A.V,B.V)?'before':Run.vcLess(B.V,A.V)?'after':a===b?'same':'concurrent';
   const lamport=A.L<B.L?'less':A.L>B.L?'greater':'equal';
   return {rel,vc,lamport,path:rel==='before'?this.path(a,b):rel==='after'?this.path(b,a):null};
  }
 }
 const presets={
  lezione:{title:'La lezione: P invia A a Q',
   note:'Il programma della lezione. P: A := 1, send(A), print ok. Q: print, receive, print R. Confronta Q1 con P3, poi P3 con Q3.',
   procs:['P','Q'],build(r){r.internal('P','A := 1');r.internal('Q','print "ready"');r.send('P','Q','send(A)');r.internal('P','print "ok"');r.receive(0,'receive(R)');r.internal('Q','print R')},pick:['Q1','P3']},
  tre:{title:'Tre processi: catena e concorrenza',
   note:'La conoscenza viaggia con i messaggi: R conosce P1 solo attraverso Q. Confronta P1 con R3, poi P3 con R2.',
   procs:['P','Q','R'],build(r){r.internal('P');r.send('P','Q');r.internal('R');r.receive(0);r.send('Q','R');r.internal('P');r.receive(1);r.send('P','R');r.internal('R');r.receive(2)},pick:['P1','R3']},
  vuoto:{title:'Costruisci tu (3 processi)',note:'Aggiungi eventi interni, invii e ricezioni, poi confronta due eventi qualsiasi.',procs:['P','Q','R'],build(){},pick:[]}
 };
 function load(id){const s=presets[id];const r=new Run(s.procs);s.build(r);return r}
 const vs=v=>'['+v.join(',')+']';
 function verdict(r,a,b){
  if(a==null||b==null)return 'Scegli due eventi.';
  const A=r.events[a],B=r.events[b];if(a===b)return 'È lo stesso evento.';
  const c=r.compare(a,b);let s='';
  if(c.rel==='before')s=`${A.name} → ${B.name}: catena ${c.path.map(i=>r.events[i].name).join(' → ')}.`;
  else if(c.rel==='after')s=`${B.name} → ${A.name}: catena ${c.path.map(i=>r.events[i].name).join(' → ')}.`;
  else s=`${A.name} ∥ ${B.name}: nessuna catena di eventi locali e messaggi li collega, in nessuna direzione. Sono concorrenti.`;
  s+=` Vettori: ${vs(A.V)} e ${vs(B.V)} → `+(c.vc==='before'?`V(${A.name}) < V(${B.name}).`:c.vc==='after'?`V(${B.name}) < V(${A.name}).`:'non confrontabili.');
  s+=` Lamport: ${A.L} e ${B.L}.`;
  if(c.rel==='concurrent'&&c.lamport!=='equal'){const lo=c.lamport==='less'?A:B,hi=c.lamport==='less'?B:A;s+=` Il clock di Lamport di ${lo.name} è minore, eppure ${lo.name} non è avvenuto prima di ${hi.name}: dal solo numero non si può dedurre la causalità.`}
  return s;
 }
 function mount(sel,opts={}){
  const host=document.querySelector(sel);if(!host)return;let id=opts.start||'lezione',run=load(id),sel2=[],from=0;
  const pickByName=n=>{const e=run.events.find(x=>x.name===n);return e?e.id:null};
  const initPick=()=>{sel2=(presets[id].pick||[]).map(pickByName).filter(x=>x!=null)};initPick();
  const SVGNS='http://www.w3.org/2000/svg';
  const el=(tag,cls,text,parent)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;if(parent)parent.appendChild(e);return e};
  const sv=(tag,attrs,parent,text)=>{const e=document.createElementNS(SVGNS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(text!=null)e.textContent=text;if(parent)parent.appendChild(e);return e};
  const btn=(label,parent,fn,disabled)=>{const b=el('button',null,label,parent);b.type='button';b.disabled=!!disabled;b.addEventListener('click',()=>{fn();render()});return b};
  function select(evId){if(sel2.includes(evId))sel2=sel2.filter(x=>x!==evId);else{sel2.push(evId);if(sel2.length>2)sel2.shift()}}
  function diagram(parent){
   const n=run.procs.length,colW=110,left=50,top=36,rowH=34,rows=Math.max(run.events.length,3)+1,W=left*2+colW*(n-1),H=top+rows*rowH;
   const svg=sv('svg',{viewBox:`0 0 ${W} ${H}`,width:W,role:'img','aria-label':'Diagramma spazio-tempo: una colonna per processo, il tempo scorre verso il basso'},parent);
   svg.style.cssText='max-width:100%;height:auto;display:block;margin:.5rem auto';
   const x=i=>left+i*colW,y=e=>top+(e.id+1)*rowH;
   sv('defs',{},svg).innerHTML='<marker id="clab-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#B83D2D"/></marker>';
   run.procs.forEach((p,i)=>{sv('line',{x1:x(i),y1:top,x2:x(i),y2:H-8,stroke:'#6E7068','stroke-width':1.2},svg);sv('text',{x:x(i),y:top-14,'text-anchor':'middle','font-family':'sans-serif','font-size':14,'font-weight':'bold',fill:'#1546B8'},svg,p)});
   for(const m of run.msgs){const s=run.events[m.send];
    if(m.recv!==null){const r=run.events[m.recv];sv('line',{x1:x(s.p),y1:y(s),x2:x(r.p),y2:y(r),stroke:'#B83D2D','stroke-width':1.5,'marker-end':'url(#clab-arr)'},svg);
     sv('text',{x:(x(s.p)+x(r.p))/2,y:(y(s)+y(r))/2-5,'text-anchor':'middle','font-family':'sans-serif','font-size':11,fill:'#B83D2D'},svg,m.name)}
    else{const yy=H-14;sv('line',{x1:x(s.p),y1:y(s),x2:x(m.to),y2:yy,stroke:'#B83D2D','stroke-width':1.3,'stroke-dasharray':'4 3'},svg);
     sv('text',{x:x(m.to)+(m.to>s.p?-6:6),y:yy-4,'text-anchor':m.to>s.p?'end':'start','font-family':'sans-serif','font-size':11,fill:'#B83D2D'},svg,m.name+' in viaggio')}}
   for(const e of run.events){const on=sel2.includes(e.id);
    const g=sv('g',{tabindex:0,role:'button','aria-label':'Seleziona '+e.name,style:'cursor:pointer'},svg);
    sv('circle',{cx:x(e.p),cy:y(e),r:on?8:6,fill:on?'#B83D2D':e.kind==='int'?'#FAF7EF':'#1546B8',stroke:'#1546B8','stroke-width':1.5},g);
    const right=e.p<n-1||n===1;sv('text',{x:x(e.p)+(right?12:-12),y:y(e)+4,'text-anchor':right?'start':'end','font-family':'sans-serif','font-size':12,fill:'#1B1C18'},g,e.name);
    const act=()=>{select(e.id);render()};g.addEventListener('click',act);g.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();act()}})}
  }
  function render(){
   host.replaceChildren();host.classList.add('clab');
   const top=el('div','clab-row',null,host),lab=el('label',null,'Esecuzione: ',top),s=el('select',null,null,lab);
   for(const [k,v] of Object.entries(presets)){const o=el('option',null,v.title,s);o.value=k}s.value=id;
   s.addEventListener('change',()=>{id=s.value;run=load(id);initPick();render();host.querySelector('select').focus()});
   el('p','clab-note',presets[id].note,host);
   const ctl=el('div','clab-row',null,host);
   const fl=el('label',null,'Processo: ',ctl),fs=el('select',null,null,fl);run.procs.forEach((p,i)=>{const o=el('option',null,p,fs);o.value=i});fs.value=from;
   fs.addEventListener('change',()=>{from=+fs.value;render()});
   btn('Evento interno',ctl,()=>run.internal(from),run.full());
   run.procs.forEach((p,i)=>{if(i!==from)btn('Invia a '+p,ctl,()=>run.send(from,i),run.full())});
   const tr=run.inTransit();
   if(tr.length){const r2=el('div','clab-row',null,host);el('span',null,'Consegna: ',r2);for(const m of tr)btn(`${m.name} (${run.procs[m.from]} → ${run.procs[m.to]})`,r2,()=>run.receive(m.id),run.full())}
   const r3=el('div','clab-row',null,host);
   btn('Annulla ultimo evento',r3,()=>{const gone=run.events.length-1;run.undo();sel2=sel2.filter(x=>x!==gone)},!run.events.length);
   btn('Reset',r3,()=>{run=load(id);initPick()});
   if(run.full())el('p','clab-note','Limite di '+MAX_EVENTS+' eventi raggiunto.',host);
   diagram(host);
   const t=el('table','clab-table',null,host),hd=el('tr',null,null,el('thead',null,null,t));
   for(const h of ['Evento','Tipo','Lamport','Vettore'])el('th',null,h,hd).scope='col';
   const tb=el('tbody',null,null,t);
   for(const e of run.events){const r=el('tr',sel2.includes(e.id)?'on':null,null,tb);el('th',null,e.name,r).scope='row';
    const m=e.msg!=null?run.msgs[e.msg].name:'';el('td',null,(e.kind==='int'?'interno':e.kind==='send'?'send '+m:'receive '+m)+(e.note?' · '+e.note:''),r);el('td',null,String(e.L),r);el('td',null,vs(e.V),r)}
   const out=el('p','clab-out',verdict(run,sel2[0],sel2[1]),host);out.setAttribute('role','status');
   el('p','clab-hint','Tocca due eventi nel diagramma per confrontarli.',host);
  }
  render();
 }
 return {Run,presets,load,verdict,mount,MAX_EVENTS};
});
