(function(global){
  'use strict';
  // Reliable, exactly-once messages; fixed membership; no crashes. No timeouts.
  class Model {
    constructor(n=3){
      if(!Number.isInteger(n)||n<2||n>8)throw Error('Use 2–8 processes');
      this.processes=Array.from({length:n},(_,id)=>({id,clock:0,mode:'RELEASED',request:null,replies:[],deferred:[]}));
      this.messages=[];this.serial=0;this.entries=[];this.events=[];
    }
    process(id){const p=this.processes[id];if(!p)throw Error('Unknown process');return p}
    send(type,from,to,request){const p=this.process(from);this.messages.push({id:++this.serial,type,from,to,request:[...request],clock:++p.clock})}
    request(id){
      const p=this.process(id);if(p.mode!=='RELEASED')throw Error('Process is not released');
      p.mode='REQUESTING';p.request=[++p.clock,id];p.replies=[];
      for(const q of this.processes)if(q.id!==id)this.send('REQUEST',id,q.id,p.request);
      this.events.push(`P${id+1} richiede con priorità (${p.request[0]}, ${id+1}).`);this.check();
    }
    deliver(id){
      const index=this.messages.findIndex(m=>m.id===id);if(index<0)throw Error('Message not in transit');
      const m=this.messages.splice(index,1)[0],p=this.process(m.to);p.clock=Math.max(p.clock,m.clock)+1;
      if(m.type==='REQUEST'){
        const earlier=p.request&&(m.request[0]<p.request[0]||(m.request[0]===p.request[0]&&m.request[1]<p.request[1]));
        if(p.mode==='RELEASED'||(p.mode==='REQUESTING'&&earlier))this.send('OK',p.id,m.from,m.request);
        else p.deferred.push({from:m.from,request:m.request});
      }else{
        if(p.mode!=='REQUESTING'||p.request[0]!==m.request[0]||p.request[1]!==m.request[1])throw Error('Unexpected reply');
        if(!p.replies.includes(m.from))p.replies.push(m.from);
        if(p.replies.length===this.processes.length-1){p.mode='HELD';this.entries.push(p.id)}
      }
      this.events.push(`${m.type}: P${m.from+1} → P${m.to+1} consegnato.`);this.check();
    }
    release(id){
      const p=this.process(id);if(p.mode!=='HELD')throw Error('Process is not in the critical section');
      p.clock++;p.mode='RELEASED';
      for(const d of p.deferred)this.send('OK',id,d.from,d.request);
      p.deferred=[];p.request=null;p.replies=[];
      this.events.push(`P${id+1} esce e invia gli OK differiti.`);this.check();
    }
    check(){
      if(this.processes.filter(p=>p.mode==='HELD').length>1)throw Error('Mutual exclusion violated');
      for(const p of this.processes)if(p.mode==='HELD'&&p.replies.length!==this.processes.length-1)throw Error('Missing permission');
    }
  }
  function mount(selector){
    const host=document.querySelector(selector);if(!host)return;
    let model=new Model(),focusLabel=null;
    function element(tag,text,parent){const e=document.createElement(tag);if(text)e.textContent=text;if(parent)parent.appendChild(e);return e}
    function button(label,fn,parent,disabled=false){const b=element('button',label,parent);b.type='button';b.disabled=disabled;b.style.cssText='font:inherit;max-width:100%;white-space:normal;text-align:left';b.addEventListener('click',()=>{focusLabel=label;fn();render()});return b}
    function render(){
      host.replaceChildren();host.dataset.raModel='true';
      element('p','Modello: 3 processi corretti, canali affidabili senza duplicati. Scegli richieste e ordine di consegna; gli OK non possono essere inventati.',host);
      const controls=element('div','',host);controls.style.cssText='display:flex;flex-wrap:wrap;gap:8px';
      for(const p of model.processes){button(`P${p.id+1}: richiedi CS`,()=>model.request(p.id),controls,p.mode!=='RELEASED');button(`P${p.id+1}: rilascia CS`,()=>model.release(p.id),controls,p.mode!=='HELD')}
      button('Reimposta',()=>{model=new Model()},controls);
      const table=element('table','',host);table.dataset.raState='true';const head=element('tr','',element('thead','',table));
      for(const name of ['Processo','Stato','Clock','Richiesta (ts, ID)','OK ricevuti da','Risposte differite a'])element('th',name,head).scope='col';
      const body=element('tbody','',table);
      for(const p of model.processes){const row=element('tr','',body);row.dataset.process=String(p.id+1);element('th',`P${p.id+1}`,row).scope='row';for(const s of [p.mode,String(p.clock),p.request?`(${p.request[0]}, ${p.id+1})`:'—',p.replies.map(i=>'P'+(i+1)).join(', ')||'—',p.deferred.map(d=>'P'+(d.from+1)).join(', ')||'—'])element('td',s,row)}
      element('h4','Messaggi in transito',host);
      const queue=element('ul','',host);queue.dataset.raQueue='true';
      for(const m of model.messages){const li=element('li','',queue);button(`Consegna ${m.type}: P${m.from+1} → P${m.to+1} · richiesta (${m.request[0]}, ${m.request[1]+1})`,()=>model.deliver(m.id),li)}
      if(!model.messages.length)element('p','Nessun messaggio in transito.',host);
      const status=element('p',`In CS: ${model.processes.filter(p=>p.mode==='HELD').map(p=>'P'+(p.id+1)).join(', ')||'nessuno'}. Ingressi: ${model.entries.map(i=>'P'+(i+1)).join(' → ')||'nessuno'}.`,host);status.setAttribute('role','status');
      if(model.events.length)element('p',model.events.at(-1),host);
      global.NotesContentLayout?.refresh();
      if(focusLabel){const enabled=[...host.querySelectorAll('button:not(:disabled)')];(enabled.find(b=>b.textContent===focusLabel)||host.querySelector('[data-ra-queue] button')||enabled[0])?.focus({preventScroll:true});focusLabel=null}
    }
    render();return ()=>model;
  }
  const api={Model,mount};if(typeof module==='object'&&module.exports)module.exports=api;else global.RicartAgrawala=api;
})(typeof window==='undefined'?globalThis:window);
