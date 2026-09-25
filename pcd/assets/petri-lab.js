// Petri-net token game with exhaustive analysis of the reachability set.
// A net: places {id,x,y,label,tokens}, transitions {id,x,y,label}, arcs [from,to,weight?,via?].
// Firing rule of module 1.5: t is enabled when every input place p holds at least w(p,t) tokens;
// firing removes w(p,t) from each input place and adds w(t,p) to each output place.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PetriLab=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const P=(id,x,y,label,tokens=0,lp='r')=>({id,x,y,label,tokens,lp}), T=(id,x,y,label,lp='r')=>({id,x,y,label,lp});
 const nets={
  sync:{title:'Esercizio: b2 sempre dopo a1',W:480,H:380,
   note:'P esegue a1, a2; Q esegue b1, b2, b3. «→a1» è lo stato di P prima di a1. S è il semaforo evento: a1 lo segnala, b2 lo attende.',
   places:[P('P0',110,40,'→a1',1,'l'),P('P1',110,140,'→a2',0,'l'),P('P2',110,240,'fine P',0,'l'),
    P('Q0',370,40,'→b1',1),P('Q1',370,140,'→b2'),P('Q2',370,240,'→b3'),P('Q3',370,340,'fine Q'),P('S',240,140,'S',0,'b')],
   trans:[T('a1',110,90,'a1','l'),T('a2',110,190,'a2','l'),T('b1',370,90,'b1'),T('b2',370,190,'b2'),T('b3',370,290,'b3')],
   arcs:[['P0','a1'],['a1','P1'],['P1','a2'],['a2','P2'],['Q0','b1'],['b1','Q1'],['Q1','b2'],['b2','Q2'],['Q2','b3'],['b3','Q3'],['a1','S'],['S','b2']],
   final:m=>['P0','P1','Q0','Q1','Q2'].every(p=>m[p]===0),
   badFire:{text:'b2 scatta sempre dopo a1',test:(m,t)=>t==='b2'&&m.P0>0}},
  mutex:{title:'Sezione critica con un semaforo',W:480,H:290,
   note:'Ogni token in NCS è un processo. S è il permesso: entrare lo consuma, uscire lo restituisce.',
   places:[P('Np',120,50,'NCS p',1),P('Cp',120,190,'CS p'),P('Nq',360,50,'NCS q',1,'l'),P('Cq',360,190,'CS q',0,'l'),P('S',240,120,'S',1,'b')],
   trans:[T('entraP',120,120,'entra p','l'),T('esceP',120,260,'esce p','l'),T('entraQ',360,120,'entra q'),T('esceQ',360,260,'esce q')],
   arcs:[['Np','entraP'],['entraP','Cp'],['Cp','esceP'],['esceP','Np',1,[[120,282],[25,282],[25,50]]],
    ['Nq','entraQ'],['entraQ','Cq'],['Cq','esceQ'],['esceQ','Nq',1,[[360,282],[455,282],[455,50]]],
    ['S','entraP'],['S','entraQ'],['esceP','S'],['esceQ','S']],
   badMark:{text:'mai due processi in CS',test:m=>m.Cp+m.Cq>1}},
  prodcons:{title:'Produttore e consumatore, buffer di 2 posti',W:480,H:290,
   note:'liberi e item rappresentano il buffer: put consuma un posto libero e crea un item, get fa il contrario.',
   places:[P('Pr',100,50,'prod. pronto',1),P('Ph',100,190,'ha un item'),P('Cr',380,50,'cons. pronto',1,'l'),P('Ch',380,190,'ha un item',0,'l'),
    P('free',240,50,'liberi',2,'b'),P('items',240,200,'item',0,'b')],
   trans:[T('produce',100,120,'produce'),T('put',100,260,'put','l'),T('get',380,120,'get'),T('consume',380,260,'consume','l')],
   arcs:[['Pr','produce'],['produce','Ph'],['Ph','put'],['put','Pr',1,[[100,282],[25,282],[25,50]]],
    ['Cr','get'],['get','Ch'],['Ch','consume'],['consume','Cr',1,[[380,282],[455,282],[455,50]]],
    ['free','put'],['put','items'],['items','get'],['get','free']],
   badMark:{text:'liberi + item resta uguale alla capienza',test:(m,m0)=>m.free+m.items!==m0.free+m0.items}},
  rw:{title:'Lettori e scrittore, arco di peso 3',W:480,H:290,
   note:'3 lettori e 1 scrittore. Un lettore prende 1 permesso, lo scrittore li prende tutti e 3.',
   places:[P('Ri',120,50,'lettori',3),P('Rr',120,190,'leggono'),P('Wi',360,50,'scrittore',1,'l'),P('Ww',360,190,'scrive',0,'l'),P('perm',240,120,'permessi',3,'b')],
   trans:[T('startR',120,120,'inizio L','l'),T('endR',120,260,'fine L','l'),T('startW',360,120,'inizio S'),T('endW',360,260,'fine S')],
   arcs:[['Ri','startR'],['startR','Rr'],['Rr','endR'],['endR','Ri',1,[[120,282],[25,282],[25,50]]],
    ['Wi','startW'],['startW','Ww'],['Ww','endW'],['endW','Wi',1,[[360,282],[455,282],[455,50]]],
    ['perm','startR'],['endR','perm'],['perm','startW',3],['endW','perm',3]],
   badMark:{text:'mai lettori e scrittore insieme',test:m=>(m.Ww>0&&m.Rr>0)||m.Ww>1}},
  locks:{title:'Due lock presi in ordine opposto',W:480,H:330,
   note:'p prende A poi B, q prende B poi A (p1: p ha A; q1: q ha B). signal restituisce entrambi i lock.',
   places:[P('P0',130,40,'p0',1),P('P1',130,140,'p1',0,'l'),P('P2',130,240,'p2',0,'l'),
    P('Q0',350,40,'q0',1,'l'),P('Q1',350,140,'q1'),P('Q2',350,240,'q2'),P('A',240,115,'A',1,'t'),P('B',240,165,'B',1,'b')],
   trans:[T('pA',130,90,'p wait A','l'),T('pB',130,190,'p wait B','l'),T('pRel',130,290,'p signal','l'),
    T('qB',350,90,'q wait B'),T('qA',350,190,'q wait A'),T('qRel',350,290,'q signal')],
   arcs:[['P0','pA'],['pA','P1'],['P1','pB'],['pB','P2'],['P2','pRel'],['pRel','P0',1,[[130,312],[25,312],[25,40]]],
    ['Q0','qB'],['qB','Q1'],['Q1','qA'],['qA','Q2'],['Q2','qRel'],['qRel','Q0',1,[[350,312],[455,312],[455,40]]],
    ['A','pA'],['B','pB'],['B','qB'],['A','qA'],['pRel','A'],['pRel','B'],['qRel','A'],['qRel','B']]}
 };
 const initial=net=>Object.fromEntries(net.places.map(p=>[p.id,p.tokens]));
 const ins=(net,t)=>net.arcs.filter(a=>a[1]===t).map(a=>[a[0],a[2]||1]);
 const outs=(net,t)=>net.arcs.filter(a=>a[0]===t).map(a=>[a[1],a[2]||1]);
 const enabled=(net,m,t)=>ins(net,t).every(([p,w])=>m[p]>=w);
 function fire(net,m,t){if(!enabled(net,m,t))return null;const n=Object.assign({},m);
  for(const [p,w] of ins(net,t))n[p]-=w;for(const [p,w] of outs(net,t))n[p]+=w;return n}
 const key=(net,m)=>net.places.map(p=>m[p.id]).join(',');
 // Incidence matrix D = D+ − D−: one row per transition, one column per place (as in the slides).
 function matrices(net){const row=(t,f)=>net.places.map(p=>{const a=net.arcs.find(x=>f(x,t,p.id));return a?(a[2]||1):0});
  const minus=net.trans.map(t=>row(t.id,(a,t,p)=>a[0]===p&&a[1]===t)),plus=net.trans.map(t=>row(t.id,(a,t,p)=>a[0]===t&&a[1]===p));
  return {minus,plus,D:plus.map((r,i)=>r.map((x,j)=>x-minus[i][j]))}}
 function analyse(net,m0,limit=20000){const k0=key(net,m0),seen=new Map([[k0,{m:m0,prev:null,t:null}]]),queue=[k0],edges=new Map();
  let truncated=false;
  while(queue.length){const k=queue.shift(),m=seen.get(k).m,es=[];
   for(const t of net.trans){const n=fire(net,m,t.id);if(!n)continue;const k2=key(net,n);es.push({t:t.id,to:k2});
    if(!seen.has(k2)){if(seen.size>=limit){truncated=true;continue}seen.set(k2,{m:n,prev:k,t:t.id});queue.push(k2)}}
   edges.set(k,es)}
  const path=k=>{const out=[];while(seen.get(k).prev!=null){out.unshift(seen.get(k).t);k=seen.get(k).prev}return out};
  const all=[...seen.keys()];
  const bound=Math.max(...all.map(k=>Math.max(...net.places.map(p=>seen.get(k).m[p.id]))));
  const total=m=>net.places.reduce((a,p)=>a+m[p.id],0);
  const conservative=all.every(k=>total(seen.get(k).m)===total(m0));
  const stops=all.filter(k=>edges.get(k).length===0),isFinal=k=>!!net.final&&net.final(seen.get(k).m);
  const dead=stops.filter(k=>!isFinal(k)),ends=stops.filter(isFinal);
  // Liveness: t is live if it can become enabled again from every reachable marking (backward closure).
  const back=new Map(all.map(k=>[k,[]]));for(const [k,es] of edges)for(const e of es)if(back.has(e.to))back.get(e.to).push(k);
  const status=net.trans.map(t=>{const start=all.filter(k=>enabled(net,seen.get(k).m,t.id));
   if(!start.length)return {t:t.id,kind:'dead'};const reach=new Set(start),q=[...start];
   while(q.length){for(const p of back.get(q.pop()))if(!reach.has(p)){reach.add(p);q.push(p)}}
   return {t:t.id,kind:reach.size===all.length?'live':'fireable'}});
  let violation=null;
  if(net.badMark){const k=all.find(k=>net.badMark.test(seen.get(k).m,m0));if(k)violation={trace:path(k)}}
  if(net.badFire)for(const k of all){const e=edges.get(k).find(e=>net.badFire.test(seen.get(k).m,e.t));if(e){violation={trace:path(k).concat(e.t)};break}}
  return {markings:all.length,truncated,bound,conservative,deadlocks:dead.length,deadTrace:dead.length?path(dead[0]):null,
   deadMarking:dead.length?seen.get(dead[0]).m:null,ends:ends.length,status,violation}}

 // ---------- rendering ----------
 const NS='http://www.w3.org/2000/svg',R=15,TW=34,TH=9;
 function svgEl(tag,attrs,parent){const e=document.createElementNS(NS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);if(parent)parent.appendChild(e);return e}
 function trim(from,to,node){const dx=to[0]-from[0],dy=to[1]-from[1],len=Math.hypot(dx,dy)||1;
  if(node.kind==='p')return [to[0]-dx/len*R,to[1]-dy/len*R];
  const s=Math.min(dx?TW/2/Math.abs(dx):Infinity,dy?TH/2/Math.abs(dy):Infinity);return [to[0]-dx*s,to[1]-dy*s]}
 function draw(net,m,svg,onFire){svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${net.W} ${net.H}`);
  const node=id=>{const p=net.places.find(x=>x.id===id);if(p)return Object.assign({kind:'p'},p);return Object.assign({kind:'t'},net.trans.find(x=>x.id===id))};
  const defs=svgEl('defs',{},svg),mk=svgEl('marker',{id:'pl-arrow',viewBox:'0 0 10 10',refX:'9',refY:'5',markerWidth:'7',markerHeight:'7',orient:'auto'},defs);
  svgEl('path',{d:'M0,0 L10,5 L0,10 z',fill:'#45463F'},mk);
  for(const [a,b,w,via] of net.arcs){const A=node(a),B=node(b),pts=[[A.x,A.y],...(via||[]),[B.x,B.y]];
   pts[0]=trim(pts[1],pts[0],A);pts[pts.length-1]=trim(pts[pts.length-2],pts[pts.length-1],B);
   svgEl('polyline',{points:pts.map(p=>p.join(',')).join(' '),fill:'none',stroke:'#45463F','stroke-width':'1.4','marker-end':'url(#pl-arrow)'},svg);
   if(w>1){const [x1,y1]=pts[pts.length-2],[x2,y2]=pts[pts.length-1];const t=svgEl('text',{x:(x1+x2)/2+6,y:(y1+y2)/2-5,'font-size':'14','font-family':'IBM Plex Mono,monospace',fill:'#B83D2D','font-weight':'bold'},svg);t.textContent=w}}
  const lab=(n,dx)=>{const pos={r:[dx,5,'start'],l:[-dx,5,'end'],b:[0,dx+14,'middle'],t:[0,-dx-6,'middle']}[n.lp];
   const t=svgEl('text',{x:n.x+pos[0],y:n.y+pos[1],'text-anchor':pos[2],'font-size':'13','font-family':'IBM Plex Mono,monospace',fill:'#171813'},svg);t.textContent=n.label};
  for(const p of net.places){svgEl('circle',{cx:p.x,cy:p.y,r:R,fill:'#FAF7EF',stroke:'#1546B8','stroke-width':'1.6'},svg);lab(p,R+5);
   const k=m[p.id],dots=[[0,0]],two=[[-5,0],[5,0]],three=[[-5,-4],[5,-4],[0,5]],four=[[-5,-5],[5,-5],[-5,5],[5,5]];
   if(k>0&&k<=4)for(const [dx,dy] of [null,dots,two,three,four][k])svgEl('circle',{cx:p.x+dx,cy:p.y+dy,r:3.6,fill:'#171813'},svg);
   else if(k>4){const t=svgEl('text',{x:p.x,y:p.y+5,'text-anchor':'middle','font-size':'14','font-family':'IBM Plex Mono,monospace'},svg);t.textContent=k}}
  for(const t of net.trans){const on=enabled(net,m,t.id),g=svgEl('g',{},svg);
   svgEl('rect',{x:t.x-TW/2,y:t.y-TH/2,width:TW,height:TH,fill:on?'#1546B8':'#C9C3B6',stroke:on?'#10368E':'#6E7068'},g);
   if(on){g.setAttribute('role','button');g.setAttribute('tabindex','0');g.setAttribute('aria-label','Scatta '+t.label);g.style.cursor='pointer';
    g.addEventListener('click',()=>onFire(t.id));g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onFire(t.id)}})}
   lab(t,TW/2+6)}}

 function mount(sel,opts={}){const host=document.querySelector(sel);if(!host)return;
  let id=opts.start||'sync',m0=initial(nets[id]),m=Object.assign({},m0),log=[],report=null,note='';
  const el=(tag,cls,text,parent)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;if(parent)parent.appendChild(e);return e};
  const label=t=>nets[id].trans.find(x=>x.id===t).label;
  function go(t){const n=fire(nets[id],m,t);if(!n)return;m=n;log.push(label(t));render()}
  function replay(seq,msg){m=Object.assign({},m0);log=[];for(const t of seq){m=fire(nets[id],m,t);log.push(label(t))}note=msg;render()}
  function render(){const net=nets[id];host.replaceChildren();host.classList.add('plab');
   const top=el('div','plab-row',null,host),l=el('label',null,'Rete: ',top),s=el('select',null,null,l);
   for(const [k,n] of Object.entries(nets)){const o=el('option',null,n.title,s);o.value=k}s.value=id;
   s.addEventListener('change',()=>{id=s.value;m0=initial(nets[id]);m=Object.assign({},m0);log=[];report=null;render();host.querySelector('select').focus()});
   el('p','plab-note',net.note,host);
   const svg=svgEl('svg',{role:'img','aria-label':'Rete di Petri: '+net.title,width:net.W},host);draw(net,m,svg,go);
   el('p','plab-mark','μ = ('+net.places.map(p=>p.label+' '+m[p.id]).join(', ')+')',host);
   const en=net.trans.filter(t=>enabled(net,m,t.id)),row=el('div','plab-row',null,host);
   for(const t of en){const b=el('button',null,'Scatta '+t.label,row);b.type='button';b.addEventListener('click',()=>go(t.id))}
   const st=el('p','plab-status',null,host);st.setAttribute('role','status');
   if(!en.length){const fin=net.final&&net.final(m);st.textContent=fin?'Nessuna transizione abilitata: tutti i processi hanno finito.':'Nessuna transizione abilitata e i processi non hanno finito: deadlock.';if(!fin)st.classList.add('bad')}
   else st.textContent=note||(en.length>1?`${en.length} transizioni abilitate: la scelta è non deterministica.`:'Una sola transizione abilitata.');note='';
   const ctr=el('div','plab-row',null,host);
   const rs=el('button',null,'Reset',ctr);rs.type='button';rs.addEventListener('click',()=>{m=Object.assign({},m0);log=[];render()});
   const rnd=el('button',null,'Scatto a caso',ctr);rnd.type='button';rnd.disabled=!en.length;rnd.addEventListener('click',()=>go(en[Math.floor(Math.random()*en.length)].id));
   const an=el('button',null,'Analizza tutte le marcature raggiungibili',ctr);an.type='button';an.addEventListener('click',()=>{report=analyse(net,m0);render()});
   const ed=el('details','plab-edit',null,host);el('summary',null,'Cambia la marcatura iniziale',ed);const erow=el('div','plab-row',null,ed);
   for(const p of net.places){const lb=el('label',null,p.label+' ',erow),inp=el('input',null,null,lb);inp.type='number';inp.min='0';inp.max='9';inp.value=m0[p.id];
    inp.addEventListener('change',()=>{m0[p.id]=Math.max(0,Math.min(9,parseInt(inp.value,10)||0));m=Object.assign({},m0);log=[];report=null;render()})}
   const mx=el('details','plab-matrix',null,host);el('summary',null,'Matrice di incidenza D = D⁺ − D⁻',mx);
   const tb=el('table',null,null,mx),hr=el('tr',null,null,el('thead',null,null,tb));el('th',null,'',hr);net.places.forEach(p=>el('th',null,p.label,hr));
   const body=el('tbody',null,null,tb),D=matrices(net).D;net.trans.forEach((t,i)=>{const tr=el('tr',null,null,body);el('th',null,t.label,tr);D[i].forEach(x=>el('td',null,x>0?'+'+x:String(x),tr))});
   el('p',null,'Scattare t somma alla marcatura la riga di t: μ′ = μ + e_t · D.',mx);
   if(report){const r=el('div','plab-report',null,host);
    el('p',null,`Marcature raggiungibili: ${report.markings}${report.truncated?' (esplorazione interrotta: rete forse illimitata)':''}.`,r);
    el('p',null,`Limitatezza: al massimo ${report.bound} token in un posto, quindi la rete è ${report.bound}-limitata${report.bound===1?' (safe)':''}. ${report.conservative?'È conservativa: il numero totale di token non cambia.':'Non è conservativa: il numero totale di token cambia.'}`,r);
    const lv=report.status,names=k=>lv.filter(x=>x.kind===k).map(x=>label(x.t)).join(', ');
    if(lv.every(x=>x.kind==='live'))el('p','ok','Tutte le transizioni sono vive: da ogni marcatura raggiungibile ognuna può ancora scattare.',r);
    else{if(names('dead'))el('p','bad','Transizioni morte (non scattano mai): '+names('dead')+'.',r);
     if(names('fireable'))el('p',null,'Transizioni che possono scattare ma non sono vive: '+names('fireable')+'.',r);
     if(names('live'))el('p',null,'Transizioni vive: '+names('live')+'.',r)}
    if(report.ends)el('p','ok','Marcature finali in cui tutti hanno finito: '+report.ends+'.',r);
    const line=(bad,text,trace,msg)=>{const p=el('p',bad?'bad':'ok',(bad?'✗ ':'✓ ')+text,r);if(bad){const b=el('button',null,'Mostra lo scenario',p);b.type='button';b.addEventListener('click',()=>replay(trace,msg))}};
    line(report.deadlocks>0,report.deadlocks?`Deadlock: ${report.deadlocks===1?'una marcatura':report.deadlocks+' marcature'} senza transizioni abilitate.`:'Nessun deadlock.',report.deadTrace,'Scenario caricato: la sequenza nel registro porta al deadlock.');
    const inv=net.badMark||net.badFire;if(inv)line(!!report.violation,report.violation?'Proprietà violata: '+inv.text+'.':'Vale in ogni esecuzione: '+inv.text+'.',report.violation&&report.violation.trace,'Scenario caricato: l’ultimo scatto del registro viola la proprietà.')}
   if(log.length){const d=el('details','plab-log',null,host);d.open=true;el('summary',null,'Sequenza di scatti ('+log.length+')',d);const ol=el('ol',null,null,d);log.forEach(x=>el('li',null,x,ol))}}
  render()}
 return {nets,initial,enabled,fire,matrices,analyse,mount};
});
