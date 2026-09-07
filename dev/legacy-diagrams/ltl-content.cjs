const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const m=require('../../pcd/assets/ltl-traces.cjs'),font=require('./font.cjs'),{palette:p}=require('./render.cjs');
const root=path.resolve(__dirname,'../..'),id='pcd-temporal-counterexamples',width=332,height=444;
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function render(){
 const out=[`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" style="background:${p.paper};font-family:${p.mono};font-size:14px">`,
 '<title>Controesempio di safety finito e di liveness infinito</title>',`<metadata>${esc(font.license)}</metadata><style data-embedded-font="${font.sha256}">${font.css}</style>`,
 `<defs><marker id="${id}-arrow" markerWidth="7" markerHeight="7" refX="7" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7Z" fill="${p.accent}"/></marker></defs>`];
 const text=(x,y,t,color=p.ink,anchor='start')=>out.push(`<text x="${x}" y="${y}" fill="${color}" text-anchor="${anchor}">${esc(t)}</text>`);
 const line=(key,d)=>out.push(`<path data-transition="${key}" d="${d}" fill="none" stroke="${p.accent}" stroke-width="1.5" marker-end="url(#${id}-arrow)"/>`);
 const x=[54,166,278];
 text(16,28,'Safety: prefisso finito');text(16,54,'G ¬(p3 ∧ q3)',p.cobalt);
 text(16,190,'s2 basta a confutare G ¬(p3 ∧ q3).');
 out.push(`<path d="M16 206H316" stroke="${p.rule}"/>`);
 text(16,234,'Liveness: ciclo infinito');text(16,258,'G (tryp → F p3)',p.cobalt);
 for(const [name,y,prefix] of [['safety',104,'s'],['liveness',320,'r']]){
  const t=m.diagram[name];out.push(`<g data-trace="${name}" data-loop="${t.loop}">`);
  line(prefix+'0-'+prefix+'1',`M${x[0]+18} ${y}H${x[1]-18}`);
  line(prefix+'1-'+prefix+'2',`M${x[1]+18} ${y}H${x[2]-18}`);
  if(name==='liveness')line('r2-r1',`M${x[2]} ${y-18}V280H${x[t.loop]}V${y-18}`);
  t.states.forEach((s,i)=>{
   const color=name==='safety'&&s.p3&&s.q3?p.accent:p.cobalt;
   out.push(`<circle data-state="${prefix+i}" data-values="${esc(JSON.stringify(s))}" cx="${x[i]}" cy="${y}" r="18" fill="${p.panel}" stroke="${color}" stroke-width="1.5"/>`);
   text(x[i],y+5,prefix+i,color,'middle');
   const fields=name==='safety'?['p3','q3']:['tryp','p3','q3'];
   fields.forEach((key,j)=>text(x[i],y+40+20*j,`${key}=${Number(s[key])}`,p.ink,'middle'));
  });out.push('</g>');
 }
 text(16,428,'r1 → r2 → r1, ripetuto per sempre.');
 return out.join('\n')+'\n</svg>\n';
}
function figure(){return `<!-- BEGIN LTL PLOT -->
<figure data-static-plot="${id}" style="margin:1.6rem 0;max-width:100%">
<div tabindex="0" role="region" aria-label="Tracce temporali: scorrimento orizzontale" style="overflow-x:auto;max-width:100%;background:${p.paper};border:1px solid ${p.rule};padding:12px;box-sizing:border-box">
<img src="assets/diagrams/${id}.svg" width="${width}" height="${height}" alt="In alto s0, s1, s2: in s2 P e Q sono entrambi in CS. In basso r0, r1, r2 e ritorno a r1: P richiede ma non entra mai, mentre Q alterna ingresso e uscita." style="display:block;width:${width}px;max-width:none;height:auto;margin:auto">
</div>
<figcaption><b>Fig. 1 — Due controesempi, non due esecuzioni dello stesso algoritmo.</b> In alto il prefisso raggiunge p3 = q3 = 1: qualsiasi continuazione conserva la violazione già avvenuta. In basso p3 resta 0 mentre tryp resta 1: il ritorno r2 → r1 specifica un ciclo ripetuto all'infinito, non una semplice attesa osservata per pochi secondi. Questa traccia rispetta la mutua esclusione ma viola la risposta eventuale a P. Le frecce rappresentano passi astratti, non durate; non si assumono condizioni di fairness. Un ciclo è un controesempio solo se realizza la violazione della proprietà sotto le ipotesi ammesse. Gli stati sono definiti e controllati nello stesso <a href="assets/ltl-traces.cjs" download>modello delle tracce</a>.</figcaption>
</figure>
<!-- END LTL PLOT -->`;}
function markup(){
 const out=['<!-- BEGIN LTL EVIDENCE -->','<h3 id="ltl-traces">Tracce infinite descritte in modo finito</h3>',
 '<p>Gli esempi editoriali seguenti sono tracce <em>a lasso</em>: si visitano gli stati numerati da 0 in poi, poi dall’ultimo si torna allo stato indicato, ripetendo il ciclo per sempre. 1 significa vero, 0 falso. Gli esiti valutano la formula nello stato 0 della singola traccia: non costituiscono una verifica di tutti i comportamenti di un programma.</p>',
 '<p><a href="assets/ltl-traces.cjs" download>Scarica valutatore, formule e tracce</a>. Con Node.js: <code>node ltl-traces.cjs</code> stampa gli esiti. Nessuna libreria aggiuntiva; la pagina non esegue questo codice e le tabelle restano disponibili senza JavaScript.</p>'];
 for(const g of m.groups){
  out.push(`<h4>${esc(g.title)}</h4><div tabindex="0" role="region" aria-label="${esc(g.title)}: scorrimento orizzontale" style="max-width:100%;overflow-x:auto"><table data-ltl-group="${g.id}" style="min-width:620px"><caption>Valutazioni e ciclo: ordine dei valori ${g.fields.map(esc).join(', ')}</caption><thead><tr><th scope="col">Traccia</th><th scope="col">Stati 0, 1, …</th><th scope="col">Ritorno a</th>${g.columns.map(([,label])=>`<th scope="col">${esc(label)}</th>`).join('')}</tr></thead><tbody>`);
  for(const c of m.cases.filter(c=>c.group===g.id))out.push(`<tr data-ltl-case="${c.id}"><th scope="row">${esc(c.label)}</th><td>${c.states.map((s,i)=>`<span style="white-space:nowrap">${i}: (${g.fields.map(k=>Number(s[k])).join(',')})</span>`).join('<br>')}</td><td>${c.loop}</td>${g.columns.map(([key])=>`<td data-formula="${key}">${m.evaluate(c,m.formulas[key])[0]?'Vera':'Falsa'}</td>`).join('')}</tr>`);
  out.push('</tbody></table></div>');
 }
 out.push('<p>Nei casi di fairness, <code>taken</code> descrive il passo uscente dallo stato ed è vera solo quando <code>enabled</code> è vera. Nei casi di scavalco <code>p3</code>/<code>q3</code> sono CSp/CSq. Il conteggio riguarda intervalli contigui di Q, non il numero di stati con q3 vera. Gli esempi con due scavalchi fanno poi entrare P: mostrano che progresso e limite agli scavalchi sono requisiti separati.</p>','<!-- END LTL EVIDENCE -->');
 return out.join('\n');
}
if(require.main===module){
 const file=root+'/pcd/cap-09-verifica.html',asset=root+'/pcd/assets/diagrams/'+id+'.svg',source=fs.readFileSync(file,'utf8');
 const blocks=[[/<!-- BEGIN LTL EVIDENCE -->[\s\S]*?<!-- END LTL EVIDENCE -->/g,markup()],
 [source.includes('<!-- BEGIN LTL PLOT -->')?/<!-- BEGIN LTL PLOT -->[\s\S]*?<!-- END LTL PLOT -->/g:/<figure class="lk-fig" role="img" aria-label="Grafo degli stati esplorato da un model checker[^]*?<\/figure>/g,figure()]];
 const patches=[];for(const [pattern,next] of blocks){const found=source.match(pattern);assert.equal(found?.length,1);if(process.argv.includes('--check'))assert.equal(found[0],next);else if(found[0]!==next)patches.push('@@\n'+found[0].split('\n').map(s=>'-'+s).join('\n')+'\n'+next.split('\n').map(s=>'+'+s).join('\n'));}
 if(process.argv.includes('--check')){assert.equal(fs.readFileSync(asset,'utf8'),render());console.log('LTL tables, trace geometry, SVG and chapter in sync');}
 else{fs.writeFileSync(asset,render());process.stdout.write('*** Begin Patch\n'+(patches.length?'*** Update File: '+file+'\n'+patches.join('\n')+'\n':'')+'*** End Patch\n');}
}
module.exports={id,width,height,render,figure,markup};
