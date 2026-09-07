const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),base=root+'/pcd/assets/examples/';
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const names=['Dekker.pml','Peterson.tla','Peterson.cfg','PetersonFair.cfg','PetersonUnfair.cfg'];
function evidence(){const r=JSON.parse(fs.readFileSync(base+'formal-results.json'));for(const n of names)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(base+n)).digest('hex'),r.sourceSha256[n],n+' evidence drift');return r;}
function source(n){return `<details data-formal-source="${n}"><summary>${esc(n)} — sorgente completo</summary><p><a href="assets/examples/${n}" download>Scarica ${esc(n)}</a></p><pre tabindex="0" role="region" aria-label="${n}: scorrimento del codice"><code class="language-plaintext">${esc(fs.readFileSync(base+n,'utf8'))}</code></pre></details>`;}
function commands(id,s){return `<pre data-formal-command="${id}" tabindex="0" role="region" aria-label="${id}: comandi riproducibili"><code class="language-bash">${esc(s)}</code></pre>`;}
const labels={
 'dekker-safety':'Asserzione di mutua esclusione e stati finali',
 'dekker-fair-p':'Risposta a P, weak fairness dei processi',
 'dekker-fair-q':'Risposta a Q, weak fairness dei processi',
 'dekker-unfair':'Risposta a P, senza fairness',
 'dekker-bounded':'Asserzioni, profondità massima 2',
 'dekker-mutant':'Variante errata: protocollo di ingresso saltato',
 'peterson-safety':'TypeOK e MutualExclusion, senza fairness',
 'peterson-fair':'Invarianti e StarvationFreedom, FairSpec',
 'peterson-unfair':'StarvationFreedom, Spec senza fairness',
 'peterson-mutant':'Variante errata: a2 assegna turn := self',
 'peterson-missing-not':'Definizione di Not rimossa'
};
const outcomes={'complete-within-model':'Ricerca completa nel modello','counterexample':'Controesempio','incomplete':'Non conclusivo: limite raggiunto','tool-error':'Errore di specifica: verifica non avviata'};
function table(r,tool){return `<div tabindex="0" role="region" aria-label="Esiti ${tool}: scorrimento orizzontale" style="max-width:100%;overflow-x:auto"><table data-formal-results="${tool}" style="min-width:620px"><caption>Esiti registrati con ${tool}</caption><thead><tr><th scope="col">Controllo</th><th scope="col">Esito</th><th scope="col">Stati memorizzati o distinti osservati</th></tr></thead><tbody>${r.cases.filter(c=>c.tool===tool).map(c=>`<tr data-formal-case="${c.name}"><th scope="row">${labels[c.name]}</th><td>${outcomes[c.outcome]}</td><td>${c.stored??c.distinct??'—'}</td></tr>`).join('\n')}</tbody></table></div>`;}
function dekker(){const r=evidence();return `<!-- BEGIN DEKKER MODEL -->
<h3 id="dekker-model">Dekker: un modello PROMELA completo</h3>
<p>Il modello editoriale seguente completa l'esempio del modulo 1.2, p. 77: <code>active [2]</code> avvia due istanze, con identificatori 0 e 1 e <code>turn</code> iniziale 0. Dichiarare soltanto due <code>proctype</code> non li avvia. La versione precedente priva di <code>active</code>/<code>init</code> viene rifiutata da SPIN perché non esiste alcun processo eseguibile.</p>
<p>Le letture e scritture condivise sono passi atomici sotto <strong>consistenza sequenziale</strong>. L'intero protocollo non è racchiuso in <code>atomic</code>. Il contatore <code>in_cs</code> osserva gli ingressi: non è il lock che garantisce l'esclusione. L'asserzione deve valere con qualsiasi interleaving ammesso. Il modello non certifica una traduzione ingenua in Java o C su memoria debole.</p>
${source('Dekker.pml')}
<h4>Tre verifiche distinte</h4>
<p>Comandi provati con SPIN 6.5.1 e GCC ${r.toolchain.cc}, nella directory del file scaricato. Il primo eseguibile controlla asserzioni e stati finali non validi, senza usare claim LTL. Il secondo verifica separatamente la risposta a ciascun processo.</p>
${commands('dekker',[
 'spin -a Dekker.pml',
 'gcc -O2 -DSAFETY -DNOCLAIM -DNOREDUCE -DMEMLIM=256 \\',
 '  -o pan-safety pan.c',
 './pan-safety -m100000 -w20',
 'gcc -O2 -DNOREDUCE -DMEMLIM=256 -o pan-live pan.c',
 './pan-live -a -f -N response_p -m100000 -w20',
 './pan-live -a -f -N response_q -m100000 -w20'].join('\n'))}
<p><code>-a -f</code> cerca cicli di accettazione applicando weak fairness ai processi; non è strong fairness di ogni ramo. <code>-N</code> sceglie una proprietà: una singola esecuzione non verifica automaticamente entrambe. I run LTL non sostituiscono il controllo separato degli stati finali. Qui non si usano bitstate hashing né riduzione dell'ordine parziale; i limiti di profondità e memoria vanno comunque controllati nel report.</p>
${table(r,'SPIN')}
<p>Senza <code>-f</code>, P può restare fermo mentre Q continua: il controesempio non confuta la proprietà dichiarata sotto fairness. Con <code>-m2</code>, il report contiene zero violazioni osservate ma segnala profondità insufficiente: non è una verifica riuscita. La variante negativa sostituisce il ciclo di ingresso con <code>skip</code> e viola l'asserzione. Questi controlli negativi non sono proposti come implementazioni corrette.</p>
<p>I numeri della tabella riguardano il verificatore configurato, anche il prodotto con il claim LTL. In caso di controesempio o limite, sono conteggi parziali, non la dimensione completa del grafo. Il valore di uscita del processo non basta a interpretare il report.</p>
<p>Riferimenti: <a href="https://spinroot.com/spin/Man/Manual.html">semantica e avvio dei processi PROMELA</a>, <a href="https://spinroot.com/spin/Man/Pan.html">opzioni del verificatore SPIN</a>. <a href="assets/examples/formal-results.json" download>Scarica esiti, versioni e hash dei sorgenti</a>.</p>
<!-- END DEKKER MODEL -->`;}
function peterson(){const r=evidence(),safe=r.cases.find(c=>c.name==='peterson-safety'),mutant=r.cases.find(c=>c.name==='peterson-mutant');return `<!-- BEGIN PETERSON MODEL -->
<h3 id="peterson-model">Peterson: da PlusCal a TLA+, poi TLC</h3>
<p>Il modulo completo conserva i sette punti di controllo delle slide (a0, a1, a2, a3a, a3b, cs, a4) e definisce <code>Not(i) == 1 - i</code> per i processi 0 e 1. Le costanti booleane sono <code>TRUE</code>/<code>FALSE</code>. Ogni passo va da un'etichetta alla successiva: i test di <code>flag</code> e <code>turn</code> restano separati, senza rendere atomico l'intero protocollo.</p>
<p>Il traduttore genera <code>pc</code>, <code>Init</code>, <code>Next</code>, <code>vars</code> e <code>Spec</code>. <code>pc[i] = "cs"</code> indica che il processo i si trova in sezione critica. <code>FairSpec</code> aggiunge weak fairness a ciascuna azione di processo; <code>StarvationFreedom</code> richiede una futura visita a cs dopo ogni visita ad a1. Non è una garanzia dello scheduler o del modello di memoria di un linguaggio reale.</p>
${source('Peterson.tla')}
${source('Peterson.cfg')}
${source('PetersonFair.cfg')}
${source('PetersonUnfair.cfg')}
<h4>Traduzione e verifiche eseguite</h4>
<p>Scaricare i quattro file nella stessa directory e aggiungere <code>tla2tools.jar</code> dalla <a href="https://github.com/tlaplus/tlaplus/releases/tag/v1.7.4">release ufficiale 1.7.4</a>. Le prove usano OpenJDK 11, traduttore PlusCal 1.11 e TLC 2.19. <code>-nocfg</code> preserva le configurazioni scaricate; la traduzione modifica la copia locale di Peterson.tla. Una sola CPU di lavoro e 512 MB di heap sono sufficienti per questo piccolo modello.</p>
${commands('peterson',[
 'java -cp tla2tools.jar pcal.trans -nocfg Peterson.tla',
 'java -Xmx512m -cp tla2tools.jar tlc2.TLC -workers 1 \\',
 '  -fp 0 -seed 1 -config Peterson.cfg Peterson',
 'java -Xmx512m -cp tla2tools.jar tlc2.TLC -workers 1 \\',
 '  -fp 0 -seed 1 -config PetersonFair.cfg Peterson',
 'java -Xmx512m -cp tla2tools.jar tlc2.TLC -workers 1 \\',
 '  -fp 0 -seed 1 -config PetersonUnfair.cfg Peterson'].join('\n'))}
${table(r,'TLC')}
<p>Per il modulo scaricabile TLC trova ${safe.distinct} stati distinti (${safe.generated} generati, comprese rivisite) e svuota la coda. Un'esplorazione indipendente confronta l'intero insieme dei ${r.independentPetersonStates} stati, non solo il totale. Il “146” riportato nel precedente testo non è riprodotto da questa versione e non va presentato come una costante dell'algoritmo: conteggi e granularità dipendono dalla specifica e dagli strumenti. TLC usa fingerprint; il confronto esplicito supplementare riguarda questo piccolo grafo, non tutti i modelli possibili.</p>
<p>Con <code>Spec</code> senza fairness, TLC produce una richiesta non servita seguita da <em>stuttering</em> infinito (stato invariato). Con <code>FairSpec</code> non trova violazioni delle proprietà configurate. Eliminando la definizione di <code>Not</code>, la verifica non parte per errore semantico: non è un controesempio a Peterson.</p>
<details data-formal-mutant><summary>Controllo negativo: assegnare turn a se stessi</summary>
<p>Questa variante è <strong>volutamente errata</strong>: solo l'istruzione a2 cambia da <code>turn := Not(self)</code> a <code>turn := self</code>. Il resto rimane identico. La traccia seguente è restituita da TLC e controllata passo per passo; l'ultima riga viola MutualExclusion.</p>
<div tabindex="0" role="region" aria-label="Controesempio Peterson: scorrimento orizzontale" style="max-width:100%;overflow-x:auto"><table data-peterson-trace style="min-width:440px"><caption>Traccia reale della variante errata</caption><thead><tr><th scope="col">Stato</th><th scope="col">pc[0]</th><th scope="col">pc[1]</th><th scope="col">flag[0], flag[1]</th><th scope="col">turn</th></tr></thead><tbody>${mutant.trace.map((s,i)=>`<tr><th scope="row">${i+1}</th><td>${s.pc[0]}</td><td>${s.pc[1]}</td><td>${s.flag.map(Number).join(', ')}</td><td>${s.turn}</td></tr>`).join('\n')}</tbody></table></div>
</details>
<p>L'obiettivo matematico è <code>Spec ⇒ □MutualExclusion</code>. Scrivere un enunciato THEOREM non lo dimostra: una prova deduttiva richiede un invariante induttivo e obblighi di prova, distinti da queste esecuzioni TLC. Qui non è stata eseguita una prova con TLAPS. Il model checking esplora una configurazione; non rende finita qualsiasi specifica TLA+.</p>
<p>Fonti: modulo 1.2, pp. 83–84; <a href="https://lamport.azurewebsites.net/tla/c-manual.pdf">manuale PlusCal C</a>; <a href="https://lamport.azurewebsites.net/tla/tutorial/session8.html">tutorial sulla mutua esclusione e sui limiti delle traduzioni in codice reale</a>. <a href="assets/examples/formal-results.json" download>Esiti e tracce registrati</a>.</p>
<!-- END PETERSON MODEL -->`;}
if(require.main===module){
 const file=root+'/pcd/cap-09-verifica.html',html=fs.readFileSync(file,'utf8');
 const blocks=[
  [html.includes('<!-- BEGIN DEKKER MODEL -->')?/<!-- BEGIN DEKKER MODEL -->[\s\S]*?<!-- END DEKKER MODEL -->/g:/    <h3>SPIN e PROMELA<\/h3>[\s\S]*?(?=    <h3>Java PathFinder)/g,dekker()],
  [html.includes('<!-- BEGIN PETERSON MODEL -->')?/<!-- BEGIN PETERSON MODEL -->[\s\S]*?<!-- END PETERSON MODEL -->/g:/    <h3>TLA\+ e PlusCal<\/h3>[\s\S]*?(?=  <\/section>\s*<section id="s7")/g,peterson()]];
 const patches=[];for(const [re,next] of blocks){const found=html.match(re);assert.equal(found?.length,1);if(process.argv.includes('--check'))assert.equal(found[0],next);else if(found[0]!==next)patches.push('@@\n'+found[0].split('\n').map(l=>'-'+l).join('\n')+'\n'+next.split('\n').map(l=>'+'+l).join('\n'));}
 if(process.argv.includes('--check'))console.log('Complete formal sources, commands and actual evidence in sync');
 else process.stdout.write('*** Begin Patch\n'+(patches.length?'*** Update File: '+file+'\n'+patches.join('\n')+'\n':'')+'*** End Patch\n');
}
module.exports={names,evidence,dekker,peterson,labels,outcomes};
