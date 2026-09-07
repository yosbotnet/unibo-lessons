const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),sourceFile=root+'/pcd/assets/examples/EvenCounter.smt2';
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function evidence(){const r=JSON.parse(fs.readFileSync(root+'/pcd/assets/examples/proof-results.json'));assert.equal(r.sourceSha256,crypto.createHash('sha256').update(fs.readFileSync(sourceFile)).digest('hex'));return r;}
function proof(){const r=evidence();return `<!-- BEGIN INDUCTIVE PROOF -->
<h3 id="even-counter">Un invariante vero non è necessariamente induttivo</h3>
<p>Esempio didattico su <strong>interi matematici</strong>, senza overflow: n è una costante pari non negativa, x parte da 0. Ogni passo aggiunge 2 se x &lt; n, altrimenti lascia x invariato. Vogliamo che x non diventi mai n + 1.</p>
<pre tabindex="0" role="region" aria-label="Modello del contatore pari"><code>Init:    x = 0
Next:    x′ = if x &lt; n then x + 2 else x
Safe(x): x ≠ n + 1
Inv(x):  0 ≤ x ≤ n ∧ x mod 2 = 0</code></pre>
<p><strong>Base:</strong> 0 è pari e compreso tra 0 e n. <strong>Passo:</strong> se x &lt; n, essendo entrambi pari si ha x ≤ n − 2; quindi x + 2 resta pari e non supera n. Se x ≥ n, il valore non cambia. <strong>Implicazione:</strong> x ≤ n esclude x = n + 1. Questi tre argomenti dimostrano che Safe vale in tutti gli stati raggiungibili, per ogni n ammesso.</p>
<p>Safe, da solo, non basta come ipotesi induttiva: con n = 10 lo stato x = 9 lo soddisfa, ma il passo successivo porta a 11 e lo viola. Lo stato 9 è <strong>irraggiungibile da Init</strong>; non è un controesempio alla safety del programma corretto. Il rafforzamento Inv esclude proprio stati di questo tipo.</p>
<div class="lk-content-scroll" tabindex="0" role="region" aria-label="Controesempi: scorrimento orizzontale"><table data-proof-witnesses><caption>Due controesempi con significati diversi</caption><thead><tr><th scope="col">Caso</th><th scope="col">Passo</th><th scope="col">Significato</th></tr></thead><tbody>
<tr><th scope="row">Safe non induttivo, n = 10</th><td>9 → 11</td><td>Confuta il passo induttivo per Safe; 9 non è raggiungibile.</td></tr>
<tr><th scope="row">Variante errata +3, n = 2</th><td>0 → 3</td><td>Parte da Init e viola Safe: vero errore della variante.</td></tr>
</tbody></table></div>
<h4>Obblighi controllati con Z3</h4>
<p>Il file scaricabile formula la <em>negazione</em> di ciascun obbligo: <code>unsat</code> significa che non esiste un controesempio nelle ipotesi date. n resta simbolico, non limitato a 200. I due controlli negativi restituiscono invece <code>sat</code> e i valori della tabella.</p>
<div tabindex="0" role="region" aria-label="Obblighi induttivi: scorrimento orizzontale" style="max-width:100%;overflow-x:auto"><table data-proof-obligations style="min-width:480px"><caption>Risultati effettivi, Z3 4.13.3</caption><thead><tr><th scope="col">Obbligo</th><th scope="col">Controesempio cercato</th><th scope="col">Esito</th></tr></thead><tbody>
<tr><th scope="row">Base</th><td>Init ∧ ¬Inv(x)</td><td>${r.obligations[0]}</td></tr>
<tr><th scope="row">Preservazione</th><td>Inv(x) ∧ Next ∧ ¬Inv(x′)</td><td>${r.obligations[1]}</td></tr>
<tr><th scope="row">Implicazione</th><td>Inv(x) ∧ ¬Safe(x)</td><td>${r.obligations[2]}</td></tr>
</tbody></table></div>
<details data-proof-source><summary>Sorgente SMT-LIB completo</summary>
<p><a href="assets/examples/EvenCounter.smt2" download>Scarica EvenCounter.smt2</a>. Il modello mantiene n costante e usa aritmetica intera lineare con modulo 2.</p>
<pre tabindex="0" role="region" aria-label="Sorgente SMT-LIB: scorrimento orizzontale"><code>${esc(fs.readFileSync(sourceFile,'utf8'))}</code></pre>
</details>
<p>Con Z3 4.13.3 disponibile come <code>z3</code>, eseguire nella directory del file:</p>
<pre data-proof-command tabindex="0" role="region" aria-label="Comando Z3"><code>z3 -T:10 EvenCounter.smt2</code></pre>
<details data-proof-output><summary>Output effettivo del solver</summary><pre tabindex="0" role="region" aria-label="Output Z3"><code>${esc(r.output)}
</code></pre></details>
<p><a href="assets/examples/proof-results.json" download>Esiti e hash del sorgente</a>. Un controllo indipendente esercita anche ${r.integerTransitions} transizioni con n tra 0 e 200: è un test finito supplementare, non la prova per tutti gli interi. <code>unknown</code>, timeout o un errore dello strumento non vanno interpretati come <code>unsat</code>. Questa prova riguarda il contatore, <strong>non Peterson, Dekker o un'implementazione Java</strong>; non è stata eseguita una prova TLAPS di quei protocolli. Riferimenti: <a href="https://microsoft.github.io/z3guide/docs/logic/intro/">guida ufficiale Z3</a> e <a href="https://lamport.azurewebsites.net/tla/book-02-08-08.pdf">Lamport, Specifying Systems, capitolo 5</a>.</p>
<!-- END INDUCTIVE PROOF -->`;}
function counts(){const r=evidence();return `<!-- BEGIN SCHEDULE COUNTS -->
<h3 id="schedule-counts">Contare i cammini non significa contare gli stati</h3>
<p>Supponiamo k processi con sequenze <strong>finite e fissate</strong> di n₁, …, nₖ azioni atomiche distinte, ciascuna ordinata nel proprio processo. Se ogni interleaving che rispetta questi ordini è ammissibile, il numero di cammini completi è il coefficiente multinomiale:</p>
<pre tabindex="0" role="region" aria-label="Formula del numero di interleaving"><code>(n₁ + … + nₖ)! / (n₁! · … · nₖ!)</code></pre>
<p>Si scelgono le posizioni delle azioni di ciascun processo; il loro ordine interno è già fissato. Per m processi di n azioni ciascuno, la formula diventa <code>(m · n)! / (n!)ᵐ</code>. Non è una probabilità e non assume che gli scheduler rendano tutti i cammini equiprobabili.</p>
<div class="lk-content-scroll" tabindex="0" role="region" aria-label="Conteggi degli interleaving: scorrimento orizzontale"><table data-schedule-counts><caption>Formula e enumerazione indipendente concordano</caption><thead><tr><th scope="col">Azioni per processo</th><th scope="col">Cammini</th></tr></thead><tbody>
${r.counts.map(c=>`<tr><th scope="row">${c.lengths.join(', ')}</th><td>${Number(c.count).toLocaleString('it-IT')}</td></tr>`).join('\n')}
</tbody></table></div>
<p>Con due processi di due azioni indipendenti, i ${r.independentPaths} cammini attraversano solo ${r.independentStates} stati distinti se lo stato è la coppia di posizioni (p, q), con ciascuna tra 0 e 2. Imponendo che P termini prima della prima azione di Q, rimane ${r.synchronizedPaths} cammino: PPQQ. Variabili condivise possono invece distinguere stati con le stesse posizioni. Attese, dipendenze, rami e cicli cambiano i cammini ammissibili; la formula non conta automaticamente le esecuzioni di un programma arbitrario.</p>
<p>Lo spazio degli stati può crescere come prodotto dei domini delle variabili e delle posizioni di controllo, ma non coincide con il numero degli interleaving. Le slide del modulo 1.2 introducono i conteggi 70 e 34.650; qui ne esplicitiamo le ipotesi. I cinque conteggi sono controllati anche enumerando realmente tutti gli ordini ammessi, con <a href="assets/examples/proof-results.json" download>risultati registrati</a>.</p>
<!-- END SCHEDULE COUNTS -->`;}
if(require.main===module){
 const file=root+'/pcd/cap-09-verifica.html',html=fs.readFileSync(file,'utf8'),patches=[];
 for(const [name,render] of [['SCHEDULE COUNTS',counts],['INDUCTIVE PROOF',proof]]){
  const re=new RegExp('<!-- BEGIN '+name+' -->[\\s\\S]*?<!-- END '+name+' -->','g'),found=html.match(re),next=render();assert.equal(found?.length,1);
  if(process.argv.includes('--check'))assert.equal(found[0],next);else if(found[0]!==next)patches.push('@@\n'+found[0].split('\n').map(l=>'-'+l).join('\n')+'\n'+next.split('\n').map(l=>'+'+l).join('\n'));
 }
 if(process.argv.includes('--check'))console.log('Inductive proof, canonical SMT source, output and schedule counts in sync');
 else process.stdout.write('*** Begin Patch\n'+(patches.length?'*** Update File: '+file+'\n'+patches.join('\n')+'\n':'')+'*** End Patch\n');
}
module.exports={evidence,proof,counts};
