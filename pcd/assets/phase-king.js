(function(global){
 'use strict';
 const copy=o=>JSON.parse(JSON.stringify(o)),bit=v=>v===0||v===1;
 class Model{
  constructor({inputs,f,faulty=[],allowUnsafe=false}){
   if(!Array.isArray(inputs)||inputs.length<2||inputs.length>9||!inputs.every(bit))throw Error('Expected 2–9 binary inputs');
   const n=inputs.length;if(!Number.isInteger(f)||f<0||f>=n||!Array.isArray(faulty)||faulty.length>f||new Set(faulty).size!==faulty.length||faulty.some(i=>!Number.isInteger(i)||i<1||i>n)||typeof allowUnsafe!=='boolean')throw Error('Invalid fault budget or identities');
   if(n<=4*f&&!allowUnsafe)throw Error('This two-round phase king requires N > 4f');
   this.n=n;this.f=f;this.inputs=inputs.slice();this.values=inputs.slice();this.faulty=faulty.slice();this.guaranteed=n>4*f;this.round=0;this.history=[];this.decisions=Array(n).fill(null);this.views=null;
  }
  get complete(){return this.round===2*(this.f+1)}
  get correct(){return this.values.map((_,i)=>i+1).filter(i=>!this.faulty.includes(i))}
  next(overrides={}){
   if(this.complete)throw Error('All rounds completed');if(!overrides||typeof overrides!=='object'||Array.isArray(overrides))throw Error('Expected Byzantine message overrides');
   const phase=Math.floor(this.round/2)+1,king=phase,kind=this.round%2===0?'exchange':'king';
   // Keys identify the actual sender and receiver. Correct senders cannot be
   // impersonated; null denotes omission and is normalized to the agreed bit 0.
   for(const [key,v] of Object.entries(overrides)){const match=key.match(/^([1-9]):([1-9])$/);if(!match||+match[1]>this.n||+match[2]>this.n||!this.faulty.includes(+match[1])||(kind==='king'&&+match[1]!==king)||(!bit(v)&&v!==null))throw Error('Invalid Byzantine message override')}
   const messages=[];
   const receive=(from,to,normal)=>{const raw=this.faulty.includes(from)?(Object.hasOwn(overrides,from+':'+to)?overrides[from+':'+to]:null):normal;messages.push({from,to,raw,value:raw===null?0:raw,local:from===to});return raw===null?0:raw};
   let rows;
   if(kind==='exchange'){
    this.views=this.values.map((_,i)=>{const vector=this.values.map((v,j)=>receive(j+1,i+1,v)),ones=vector.filter(v=>v===1).length,majority=ones>this.n/2?1:0;return {pid:i+1,vector,majority,multiplicity:vector.filter(v=>v===majority).length,tie:ones===this.n/2}});
    rows=this.views.map(v=>({...v,kingValue:null,keep:null,before:this.values[v.pid-1],after:null}));
   }else{
    rows=this.views.map(v=>{const kingValue=receive(king,v.pid,this.views[king-1].majority),keep=v.multiplicity>this.n/2+this.f;return {...v,kingValue,keep,before:this.values[v.pid-1],after:keep?v.majority:kingValue}});
    this.values=rows.map(r=>r.after);
   }
   this.round++;if(this.complete)for(const pid of this.correct)this.decisions[pid-1]=this.values[pid-1];
   const record={round:this.round,phase,king,kind,threshold:this.n/2+this.f,rows:copy(rows),messages:copy(messages),values:this.values.slice(),decisions:this.decisions.slice()};this.history.push(record);return copy(record);
  }
 }
 const scenarios=[
  {id:'preserve',label:'N = 5: un king bizantino non rompe l’accordo',inputs:[1,0,1,1,1],f:1,faulty:[2],actions:[{'2:1':0,'2:3':0,'2:4':0,'2:5':0},{},{'2:1':0,'2:3':0,'2:4':0,'2:5':0},{'2:1':0,'2:3':1,'2:4':0,'2:5':1}],caption:'P2 è bizantino e king della seconda fase. I quattro corretti iniziano a 1, contano almeno 4 copie e mantengono 1 perché 4 > 3,5, anche quando P2 invia king-value contraddittori.'},
  {id:'converge',label:'N = 5: il king corretto risolve il disaccordo',inputs:[0,1,1,1,0],f:1,faulty:[2],actions:[{'2:1':0,'2:3':1,'2:4':1,'2:5':0},{},{'2:1':1,'2:3':1,'2:4':1,'2:5':1},{'2:1':1,'2:3':0,'2:4':1,'2:5':0}],caption:'I corretti iniziano divisi. Nessuno supera 3,5 nella prima fase: tutti adottano 0 dal king corretto P1. Nella seconda fase le quattro copie di 0 preservano l’accordo contro P2.'},
  {id:'outside',label:'N = 4: controesempio fuori dalla garanzia',inputs:[1,0,1,1],f:1,faulty:[2],allowUnsafe:true,actions:[{'2:1':0,'2:3':0,'2:4':0},{},{'2:1':0,'2:3':0,'2:4':0},{'2:1':0,'2:3':1,'2:4':1}],caption:'N = 4 soddisfa 3f+1, ma non N > 4f. Il king corretto P1 lascia tutti a 1 nella prima fase; nella seconda le sole 3 copie non superano la soglia 3. Il king bizantino P2 fa decidere 0 a P1 e 1 a P3/P4: accordo e validità forte falliscono.'}
 ];
 function trace(s){const m=new Model(s);for(const a of s.actions)m.next(a);return m}
 function mount(selector){
  const host=document.querySelector(selector);if(!host)return;let selected=scenarios[0],model=new Model(selected);
  function el(tag,text,parent){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(parent)parent.appendChild(e);return e}
  function paint(focus){
   host.replaceChildren();host.dataset.phaseKing='true';const label=el('label','Esecuzione sincrona a round',host);label.htmlFor='king-scenario';const select=el('select',undefined,host);select.id=label.htmlFor;select.style.cssText='display:block;max-width:100%;font:inherit;margin:.5em 0;padding:6px;background:#FAF7EF;border:1px solid #1546B8';
   for(const s of scenarios){const o=el('option',s.label,select);o.value=s.id}select.value=selected.id;select.addEventListener('change',()=>{selected=scenarios.find(s=>s.id===select.value);model=new Model(selected);paint(select.id)});
   el('p',selected.caption,host);const scope=el('p',`N = ${model.n}; f = ${model.f}; bizantino: P2; king P1 poi P2. Soglia stretta: > ${model.n/2+model.f}. `+(model.guaranteed?'N > 4f: ipotesi della variante soddisfatte.':'ATTENZIONE: fuori dalla garanzia della variante, solo controesempio.'),host);scope.style.color=model.guaranteed?'#1546B8':'#B83D2D';
   const toolbar=el('div',undefined,host);toolbar.style.cssText='display:flex;gap:8px;flex-wrap:wrap';for(const [id,text,action] of [['king-next','Prossimo round',()=>model.next(selected.actions[model.round])],['king-reset','Reimposta',()=>{model=new Model(selected)}]]){const b=el('button',text,toolbar);b.id=id;b.type='button';b.style.cssText='font:inherit;padding:6px 10px;background:#FAF7EF;border:1px solid #1546B8;color:#1546B8';b.disabled=id==='king-next'&&model.complete;b.addEventListener('click',()=>{action();paint(model.complete?'king-reset':id)})}
   const last=model.history.at(-1),status=el('p',last?`Round ${model.round}/${2*(model.f+1)} · fase ${last.phase} · ${last.kind==='exchange'?'scambio delle preferenze':'proposta del king P'+last.king}.`:'Round 0: nessun messaggio ancora scambiato.',host);status.setAttribute('role','status');
   if(last){
    el('p',last.kind==='exchange'?'Le preferenze non cambiano ancora: ogni corretto calcola candidato e molteplicità dal proprio vettore.':'Ogni corretto conserva il candidato soltanto se supera la soglia; altrimenti adotta il bit del king.',host);
    el('p','Scorri la tabella orizzontalmente su schermi stretti.',host).className='small';const region=el('div',undefined,host);region.setAttribute('role','region');region.setAttribute('aria-label','Stati dei processi corretti, scorribili');region.tabIndex=0;region.style.cssText='max-width:100%;overflow-x:auto';
    const t=el('table',undefined,region);t.style.cssText='min-width:720px;width:100%;table-layout:fixed';el('caption','Ogni riga è il destinatario; V ha colonne P1…PN. ∅ indica che il secondo round non è ancora avvenuto.',t);const tr=el('tr',undefined,el('thead',undefined,t));for(const title of ['Processo','V ricevuto','Candidato / copie','King-value','Regola','Preferenza'])el('th',title,tr).scope='col';const body=el('tbody',undefined,t);body.dataset.kingRows='true';
    for(const row of last.rows.filter(r=>model.correct.includes(r.pid))){const tr=el('tr',undefined,body);tr.dataset.kingPid=String(row.pid);el('th','P'+row.pid,tr).scope='row';for(const text of ['['+row.vector+']',row.majority+' / '+row.multiplicity,row.kingValue??'∅',row.keep===null?'attendi':row.keep?'mantieni':'adotta king',row.after??row.before])el('td',String(text),tr)}
   }
   if(model.complete){const values=model.correct.map(pid=>model.decisions[pid-1]),same=new Set(values).size===1;const p=el('p','Decisioni dei corretti: '+model.correct.map(pid=>'P'+pid+' = '+model.decisions[pid-1]).join('; ')+'. '+(same?'Accordo in questa esecuzione.':'DISACCORDO: questa variante non tollera questi parametri.'),host);p.dataset.kingDecisions='true';p.style.color=same?'#1546B8':'#B83D2D'}
   if(focus)document.getElementById(focus)?.focus({preventScroll:true});
  }
  paint();
 }
 const api={Model,scenarios,trace,mount};if(typeof module==='object'&&module.exports)module.exports=api;else global.PhaseKing=api;
})(typeof window==='undefined'?globalThis:window);
