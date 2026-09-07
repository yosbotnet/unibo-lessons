(function(global){
  'use strict';
  // One election epoch, fixed directed ring, reliable exactly-once FIFO channels.
  // A process participates on initiation OR on receiving its first election.
  class Model {
    constructor(ids=[2,7,3,1,5,4]){
      if(!Array.isArray(ids)||ids.length<2||ids.length>12||ids.some(id=>!Number.isSafeInteger(id)||id<0)||new Set(ids).size!==ids.length)throw Error('Use 2–12 distinct nonnegative integer IDs');
      this.processes=ids.map((id,i)=>({id,next:ids[(i+1)%ids.length],awake:false,ownSent:false,leaderId:null}));
      this.messages=[];this.sent=[];this.delivered=[];this.elected=[];this.announcementReturned=false;
    }
    process(id){const p=this.processes.find(p=>p.id===id);if(!p)throw Error('Unknown process');return p}
    send(type,from,value){const m={id:this.sent.length+1,type,from,to:this.process(from).next,value};this.sent.push(m);this.messages.push(m)}
    initiate(id){
      const p=this.process(id);if(p.awake||p.leaderId!==null)throw Error('Process already participates or knows the leader');
      p.awake=true;p.ownSent=true;this.send('election',id,id);
    }
    available(){return this.messages.filter((m,i,q)=>!q.slice(0,i).some(a=>a.from===m.from))}
    deliver(id){
      const m=this.available().find(m=>m.id===id);if(!m)throw Error('Message unavailable: preserve channel FIFO');
      this.messages.splice(this.messages.findIndex(x=>x.id===id),1);const p=this.process(m.to);let result;
      if(m.type==='leader'){
        p.leaderId=m.value;
        if(p.id===m.value){this.announcementReturned=true;result='Annuncio tornato al leader: tutti informati.'}
        else{this.send('leader',p.id,m.value);result='Registra il leader e inoltra l’annuncio.'}
      }else if(p.leaderId!==null){result='Elezione già decisa: scarta candidatura residua.'}
      else if(m.value===p.id){
        if(!p.ownSent)throw Error('An unannounced candidate cannot return');
        p.leaderId=p.id;this.elected.push(p.id);this.send('leader',p.id,p.id);result='Candidatura tornata: si elegge e avvia l’annuncio.';
      }else if(m.value>p.id){p.awake=true;this.send('election',p.id,m.value);result='Inoltra il PID maggiore; partecipa senza candidarsi.'}
      else if(!p.awake){p.awake=true;p.ownSent=true;this.send('election',p.id,p.id);result='Sostituisce il PID minore con il proprio; partecipa.'}
      else{result='Già partecipe: scarta il PID minore.'}
      this.delivered.push({...m,result});this.check();return this.delivered.at(-1);
    }
    check(){
      const max=Math.max(...this.processes.map(p=>p.id));
      if(this.elected.length>1||this.elected.some(id=>id!==max)||this.processes.some(p=>p.leaderId!==null&&p.leaderId!==max))throw Error('Leader safety violated');
      if(this.announcementReturned&&this.processes.some(p=>p.leaderId!==max))throw Error('Incomplete announcement');
    }
    counts(){return {election:this.sent.filter(m=>m.type==='election').length,leader:this.sent.filter(m=>m.type==='leader').length}}
  }
  function example(){const m=new Model();m.initiate(2);while(m.messages.length)m.deliver(m.available()[0].id);return m}
  function mount(selector){
    const host=document.querySelector(selector);if(!host)return;
    let model=new Model(),focusKey;
    function el(tag,text,parent){const e=document.createElement(tag);if(text)e.textContent=text;if(parent)parent.appendChild(e);return e}
    function button(label,key,fn,parent,disabled=false){const b=el('button',label,parent);b.type='button';b.dataset.changAction=key;b.disabled=disabled;b.style.cssText='font:inherit;white-space:normal;max-width:100%;text-align:left;padding:6px 10px;background:#FAF7EF;color:'+(disabled?'#6E7068':'#1546B8')+';border:1px solid '+(disabled?'#C9C3B6':'#1546B8')+';cursor:'+(disabled?'default':'pointer');b.addEventListener('click',()=>{fn();focusKey=key;render()});return b}
    function table(headers,parent){const t=el('table','',parent);t.style.cssText='width:100%;min-width:560px';const r=el('tr','',el('thead','',t));for(const h of headers)el('th',h,r).scope='col';return el('tbody','',t)}
    function render(){
      host.replaceChildren();host.dataset.changModel='true';
      el('p','Una sola elezione, senza guasti. Scegli chi si candida e quale messaggio consegnare: puoi intercalare canali diversi, ma ogni canale conserva l’ordine FIFO.',host);
      el('p','Verso dell’anello: '+model.processes.map(p=>'P'+p.id).concat('P'+model.processes[0].id).join(' → '),host);
      const controls=el('div','',host);controls.style.cssText='display:flex;flex-wrap:wrap;gap:8px';
      for(const p of model.processes)button(`Candida P${p.id}`,'init-'+p.id,()=>model.initiate(p.id),controls,p.awake||p.leaderId!==null);
      button('Tutti insieme','all',()=>{for(const p of model.processes)model.initiate(p.id)},controls,model.sent.length>0);
      button('Reimposta','reset',()=>{model=new Model()},controls);
      const states=table(['Processo','Partecipe','Proprio PID inviato','Leader noto'],host);states.dataset.changState='true';
      for(const p of model.processes){const r=el('tr','',states);el('th','P'+p.id,r).scope='row';for(const v of [p.awake?'sì':'no',p.ownSent?'sì':'no',p.leaderId===null?'—':'P'+p.leaderId])el('td',v,r)}
      const counts=model.counts(),status=el('p',`Inviati: ${counts.election} election + ${counts.leader} leader. Consegnati: ${model.delivered.length}. In transito: ${model.messages.length}. ${model.announcementReturned?'Giro di annuncio concluso.':model.elected.length?'Leader eletto; annuncio in corso.':'Leader non ancora eletto.'}`,host);status.setAttribute('role','status');
      el('h4','Prossimi messaggi consegnabili',host);const queue=el('ul','',host);queue.dataset.changQueue='true';
      for(const m of model.available())button(`#${m.id}: P${m.from} → P${m.to} · ${m.type}(${m.value})`,'msg-'+m.id,()=>model.deliver(m.id),el('li','',queue));
      if(!model.messages.length)el('p',model.sent.length?'Nessun messaggio residuo.':'Candida almeno un processo per iniziare.',host);
      if(model.messages.length){button('Consegna il prossimo','next',()=>model.deliver(model.available()[0].id),host);el('p','Ogni clic equivale a una ricezione; eventuali inoltri aggiungono messaggi alla coda.',host)}
      if(model.delivered.length){const detail=el('details','',host);el('summary','Traccia delle ricezioni ('+model.delivered.length+')',detail);const rows=table(['# invio','Da → a','Messaggio','Effetto al ricevente'],detail);rows.dataset.changTrace='true';for(const m of model.delivered){const r=el('tr','',rows);for(const s of [String(m.id),`P${m.from} → P${m.to}`,`${m.type}(${m.value})`,m.result])el('td',s,r)}el('p',model.delivered.at(-1).result,host)}
      global.NotesContentLayout?.refresh();
      if(focusKey){(host.querySelector(`[data-chang-action="${focusKey}"]:not(:disabled)`)||host.querySelector('[data-chang-action="next"]')||host.querySelector('[data-chang-action="reset"]'))?.focus({preventScroll:true});focusKey=null}
    }
    render();return ()=>model;
  }
  const api={Model,example,mount};if(typeof module==='object'&&module.exports)module.exports=api;else global.ChangRoberts=api;
})(typeof window==='undefined'?globalThis:window);
