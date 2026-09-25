// Miniature actor runtime: asynchronous send, per-pair FIFO delivery, mailbox, macro-step handlers, stash.
// The reader chooses which in-flight message is delivered and which actor runs its next macro-step.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ActorLab=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const fmt=m=>m.type+(m.show!=null?'('+m.show+')':'');
 const scenarios={
  proattivo:{title:'Proattività: stampa con self-send e stop',
   note:'Printer stampa 1…5 mandandosi un messaggio per ogni numero. Invia stop quando vuoi: arriva tra due macro-step, mai durante uno.',
   actors:{Main:{},Printer:{i:0,stopped:false}},
   start:[['Main','Printer',{type:'start',end:5,show:'end=5'}]],
   extra:[{label:'Main: invia stop',once:true,send:['Main','Printer',{type:'stop'}]}],
   behavior:{Printer(m,c){const s=c.state;
    if(m.type==='start')c.send('Printer',{type:'print',i:1,end:m.end,show:'1'});
    else if(m.type==='print'){if(s.stopped)return c.say('ignora print('+m.i+'): è stato fermato');s.i=m.i;c.out(String(m.i));if(m.i<m.end)c.send('Printer',{type:'print',i:m.i+1,end:m.end,show:String(m.i+1)})}
    else if(m.type==='stop'){s.stopped=true}}}},
  sincos:{title:'Spaghetti asincrono: sin(x) · cos(y)',
   note:'Calc non può aspettare le risposte dentro un handler: invia due richieste e combina i risultati in handler separati, nell\'ordine in cui arrivano.',
   actors:{Main:{},Calc:{sin:null,cos:null},Sin:{},Cos:{}},
   start:[['Main','Calc',{type:'compute',x:30,y:60,show:'x=30°, y=60°'}]],
   behavior:{
    Calc(m,c){const s=c.state;
     if(m.type==='compute'){c.send('Sin',{type:'sin',v:m.x,replyTo:'Calc',show:m.x+'°'});c.send('Cos',{type:'cos',v:m.y,replyTo:'Calc',show:m.y+'°'})}
     else{s[m.type==='sinResult'?'sin':'cos']=m.v;if(s.sin!=null&&s.cos!=null)c.out('sin·cos = '+(s.sin*s.cos).toFixed(2));else c.say('in attesa dell\'altro risultato')}},
    Sin(m,c){c.send(m.replyTo,{type:'sinResult',v:+Math.sin(m.v*Math.PI/180).toFixed(4),show:Math.sin(m.v*Math.PI/180).toFixed(2)})},
    Cos(m,c){c.send(m.replyTo,{type:'cosResult',v:+Math.cos(m.v*Math.PI/180).toFixed(4),show:Math.cos(m.v*Math.PI/180).toFixed(2)})}}},
  stash:{title:'Stash: scritture che arrivano prima di open',
   note:'File accetta write solo dopo open. Consegna prima le write: finiscono nello stash e tornano in mailbox con unstashAll quando arriva open.',
   actors:{Writer:{},Opener:{},File:{open:false,content:''}},
   start:[['Writer','File',{type:'write',x:'a',show:'"a"'}],['Writer','File',{type:'write',x:'b',show:'"b"'}],['Opener','File',{type:'open'}]],
   behavior:{File(m,c){const s=c.state;
    if(!s.open){if(m.type==='open'){s.open=true;c.unstashAll()}else c.stash()}
    else if(m.type==='write'){s.content+=m.x;c.out('contenuto: "'+s.content+'"')}}}},
  ordine:{title:'Ordinamento: FIFO per coppia, non causale',
   note:'A invia m1 a B e m2 a C; C, ricevuto m2, invia m3 a B. m3 è causato da m2, eppure B può ricevere m3 prima di m1.',
   actors:{A:{},B:{got:''},C:{}},
   start:[['A','B',{type:'m1'}],['A','C',{type:'m2'}]],
   behavior:{C(m,c){c.send('B',{type:'m3'})},B(m,c){c.state.got+=(c.state.got?', ':'')+m.type;c.out('B ha elaborato: '+c.state.got)}}}
 };
 class System{
  constructor(id){const sc=scenarios[id];this.id=id;this.sc=sc;this.actors={};this.transit=[];this.log=[];this.out=[];this.n=0;this.used=new Set();
   for(const [k,v] of Object.entries(sc.actors))this.actors[k]={state:JSON.parse(JSON.stringify(v)),mailbox:[],stash:[]};
   for(const [f,t,m] of sc.start)this.send(f,t,m)}
  send(from,to,msg){this.transit.push({id:++this.n,from,to,msg:Object.assign({},msg)})}
  deliverable(item){return this.transit.find(x=>x.from===item.from&&x.to===item.to)===item}
  deliver(id){const item=this.transit.find(x=>x.id===id);if(!item||!this.deliverable(item))throw Error('Not deliverable');
   this.transit.splice(this.transit.indexOf(item),1);this.actors[item.to].mailbox.push(item);this.log.push(`consegna ${item.from} → ${item.to}: ${fmt(item.msg)}`)}
  canRun(a){return this.actors[a].mailbox.length>0&&!!this.sc.behavior[a]}
  run(a){const act=this.actors[a];if(!this.canRun(a))throw Error('Nothing to run');const item=act.mailbox.shift(),notes=[],sys=this;let stashed=false;
   const ctx={state:act.state,self:a,send(to,m){sys.send(a,to,m);notes.push('send → '+to+': '+fmt(m))},out(t){sys.out.push(a+': '+t);notes.push('stampa «'+t+'»')},say(t){notes.push(t)},
    stash(){stashed=true;act.stash.push(item);notes.push('stash')},unstashAll(){if(act.stash.length){notes.push('unstashAll ('+act.stash.length+')');act.mailbox.unshift(...act.stash);act.stash=[]}}};
   this.sc.behavior[a](item.msg,ctx);
   this.log.push(`${a} esegue ${fmt(item.msg)}`+(notes.length?' → '+notes.join('; '):''));return stashed}
  extra(i){const e=this.sc.extra[i];if(e.once&&this.used.has(i))return;this.used.add(i);this.send(...e.send);this.log.push(e.label)}
  actions(){const out=[];for(const t of this.transit)if(this.deliverable(t))out.push(()=>this.deliver(t.id));for(const a of Object.keys(this.actors))if(this.canRun(a))out.push(()=>this.run(a));return out}
 }
 function mount(sel,opts={}){const host=document.querySelector(sel);if(!host)return;let id=opts.start||'proattivo',sys=new System(id);
  const el=(tag,cls,text,parent)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;if(parent)parent.appendChild(e);return e};
  const btn=(label,parent,fn,disabled)=>{const b=el('button',null,label,parent);b.type='button';b.disabled=!!disabled;b.addEventListener('click',()=>{fn();render()});return b};
  function render(){host.replaceChildren();host.classList.add('alab');
   const top=el('div','alab-row',null,host),lab=el('label',null,'Scenario: ',top),s=el('select',null,null,lab);
   for(const [k,v] of Object.entries(scenarios)){const o=el('option',null,v.title,s);o.value=k}s.value=id;
   s.addEventListener('change',()=>{id=s.value;sys=new System(id);render();host.querySelector('select').focus()});
   el('p','alab-note',sys.sc.note,host);
   const net=el('div','alab-net',null,host);el('h5',null,'Messaggi in viaggio',net);
   if(!sys.transit.length)el('p','alab-empty','nessuno',net);
   for(const t of sys.transit){const ok=sys.deliverable(t);const b=btn(`${t.from} → ${t.to}: ${fmt(t.msg)}`,net,()=>sys.deliver(t.id),!ok);b.title=ok?'Consegna alla mailbox':'Prima deve arrivare il messaggio precedente della stessa coppia mittente → destinatario'}
   const grid=el('div','alab-actors',null,host);
   for(const [a,act] of Object.entries(sys.actors)){if(!sys.sc.behavior[a])continue;const box=el('div','alab-actor',null,grid);el('h5',null,a,box);
    const st=Object.entries(act.state).map(([k,v])=>k+' = '+JSON.stringify(v)).join(', ');if(st)el('p','alab-state',st,box);
    el('p','alab-mb','mailbox: '+(act.mailbox.map(x=>fmt(x.msg)).join(', ')||'vuota'),box);
    if(act.stash.length)el('p','alab-mb','stash: '+act.stash.map(x=>fmt(x.msg)).join(', '),box);
    btn('Esegui un macro-step',box,()=>sys.run(a),!sys.canRun(a))}
   const ctr=el('div','alab-row',null,host);
   (sys.sc.extra||[]).forEach((e,i)=>btn(e.label,ctr,()=>sys.extra(i),e.once&&sys.used.has(i)));
   btn('Passo a caso',ctr,()=>{const a=sys.actions();if(a.length)a[Math.floor(Math.random()*a.length)]()},!sys.actions().length);
   btn('Reset',ctr,()=>{sys=new System(id)});
   const out=el('p','alab-out','Output: '+(sys.out.join(' · ')||'—'),host);out.setAttribute('role','status');
   if(sys.log.length){const d=el('details','alab-log',null,host);d.open=true;el('summary',null,'Registro ('+sys.log.length+')',d);const ol=el('ol',null,null,d);sys.log.forEach(l=>el('li',null,l,ol))}}
  render()}
 return {scenarios,System,mount};
});
