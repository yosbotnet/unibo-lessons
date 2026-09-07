const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),file=root+'/pcd/cap-09-verifica.html';
const names=['JpfCounter.java','jpf-counter.jpf'],start='<!-- BEGIN JPF EVIDENCE -->',end='<!-- END JPF EVIDENCE -->';
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function markup(){
 const evidence=JSON.parse(fs.readFileSync(root+'/pcd/assets/examples/jpf-results.json','utf8'));
 const sources=names.map(name=>fs.readFileSync(root+'/pcd/assets/examples/'+name,'utf8'));
 const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
 assert.equal(sha(sources[0]),evidence.sourceSha256);assert.equal(sha(sources[1]),evidence.configSha256);
 const labels={unsafe:'Incremento non protetto',safe:'Incremento sincronizzato',bounded:'Non protetto, profondità 1','invalid-target':'Classe target assente'};
 const verdict={'counterexample':'Controesempio: valore finale 1','complete-within-model':'Ricerca completa nel modello configurato',incomplete:'Non conclusivo'};
 return start+'\n'+names.map((name,i)=>`<p><a href="assets/examples/${name}" download>Scarica ${name}</a></p>\n<details data-jpf-example="${name}"><summary>${name}: sorgente completo</summary>\n<pre data-jpf-source="${name}" tabindex="0" role="region" aria-label="Sorgente ${name}"><code class="language-${i?'properties':'java'}">${esc(sources[i])}</code></pre>\n</details>`).join('\n')+`
<p>Esiti osservati con JPF <code>${evidence.revision.slice(0,12)}</code> e <code>${esc(evidence.jdk)}</code>. Il file <a href="assets/examples/jpf-results.json" download>jpf-results.json</a> registra configurazione, hash dei sorgenti e notifiche della ricerca.</p>
<div tabindex="0" role="region" aria-label="Esiti JPF: scorrimento orizzontale" style="overflow-x:auto;max-width:100%">
<table data-jpf-results style="min-width:620px"><caption>Stesso programma, esiti da distinguere</caption><thead><tr><th>Variante</th><th>Violazioni</th><th>Vincoli raggiunti</th><th>Interpretazione</th></tr></thead><tbody>
${evidence.cases.map(c=>`<tr data-jpf-case="${c.name}"><td>${labels[c.name]}</td><td>${c.violations}</td><td>${c.constraints}</td><td>${verdict[c.outcome]}${!c.started?': ricerca non avviata':''}</td></tr>`).join('\n')}
</tbody></table></div>
`+end;
}
if(require.main===module){const source=fs.readFileSync(file,'utf8'),matches=source.match(/<!-- BEGIN JPF EVIDENCE -->[\s\S]*?<!-- END JPF EVIDENCE -->/g);assert.equal(matches?.length,1);const old=matches[0],next=markup();
 if(process.argv.includes('--check')){assert.equal(old,next,'JPF content/evidence drift');console.log('Canonical JPF code, configuration and observed results in sync');}
 else process.stdout.write('*** Begin Patch\n'+(old!==next?`*** Update File: ${file}\n@@\n`+old.split('\n').map(l=>'-'+l).join('\n')+'\n'+next.split('\n').map(l=>'+'+l).join('\n')+'\n':'')+'*** End Patch\n');
}
module.exports={names,markup};
