// Optional annotations read the same source that is displayed and downloaded.
(function(){
 if(typeof LessonKit==='undefined')return;
 const notes=[[/t\.run\(\)/,'Chiamata diretta sul thread chiamante: non avvia t.'],[/t\.start\(\)/,'Avvia t soltanto la prima volta; un secondo start genera IllegalThreadStateException.'],[/t\.join\(\)/,'Attende la terminazione; non riavvia t e può essere interrotto.'],[/executedBy/,'Registra o confronta l’identità del thread che esegue il task.'],[/executions/,'Conta le due esecuzioni intenzionali: chiamata diretta e avvio.'],[/synchronized/,'Protegge l’intera operazione sullo stesso monitor dell’istanza.'],[/val >= max|val <= min/,'Controlla il limite sotto il lock, prima della modifica.'],[/min > max/,'Valida l’invariante iniziale, prima di condividere il contatore.'],[/val\+\+|val--/,'Modifica protetta: controllo e aggiornamento restano nella stessa operazione.']];
 for(const [name,id]of [['ThreadStartDemo','ac-thread'],['BoundedCounter','ac-bounded']]){
  const pre=document.querySelector('[data-basics-source="'+name+'"]');
  if(!pre)continue;
  LessonKit.annotatedCode('#'+id,{lang:'java',lines:pre.textContent.trimEnd().split('\n').map(line=>[line,notes.find(([pattern])=>pattern.test(line))?.[1]||'Parte del sorgente canonico '+name+'.'])});
  const scroll=document.querySelector('#'+id+' .lk-ac-code');
  scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','Codice annotato '+name+' — scorrimento orizzontale');
 }
})();
