// Optional annotated reader, derived from the visible, downloadable Java source.
(function(){
 if(typeof LessonKit==='undefined')return;
 const notes=[[/while /,'Il predicato viene rivalutato sotto il lock dopo ogni ripresa.'],[/lockInterruptibly/,'Acquisizione interrompibile, prima di entrare nel try.'],[/mutex\.lock\(/,'Acquisizione del lock esplicito.'],[/finally/,'Percorso di rilascio anche quando il corpo termina con un’eccezione.'],[/unlock/,'Rilascia questa acquisizione del lock.'],[/await\(|wait\(/,'Rilascia il lock associato durante l’attesa e lo riacquisisce prima del ritorno.'],[/notifyAll/,'Notifica tutti i waiter; non trasferisce subito il monitor.'],[/signalAll/,'Segnala tutti i waiter di questa Condition.'],[/\.signal\(/,'Segnala un waiter della condizione specifica; non cede il lock.'],[/= null/,'Elimina il riferimento all’elemento già consumato.'],[/count\+\+|count--/,'Aggiorna l’occupazione del buffer mentre il lock è detenuto.'],[/% buffer.length/,'Avanza circolarmente, con capacità validata positiva.'],[/synchronized/,'Usa lo stesso monitor intrinseco dell’istanza.']];
 for(const pre of document.querySelectorAll('[data-annotated-source]')){
  const details=document.createElement('details'),summary=document.createElement('summary'),host=document.createElement('div');summary.textContent='Leggi il codice con annotazioni';host.id=pre.id+'-annotations';details.append(summary,host);pre.after(details);
  LessonKit.annotatedCode('#'+host.id,{lang:'java',lines:pre.textContent.trimEnd().split('\n').map(line=>[line,notes.find(([pattern])=>pattern.test(line))?.[1]||''])});
  const scroll=host.querySelector('.lk-ac-code');scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','Codice annotato — scorrimento orizzontale');
 }
})();
