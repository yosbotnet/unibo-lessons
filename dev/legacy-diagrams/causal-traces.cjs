const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {scenarios,trace}=require('../../pcd/assets/causal-order.js');
const file=path.resolve(__dirname,'../../pcd/cap-16-algoritmi-distribuiti.html');
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function markup(){return '<!-- BEGIN CAUSAL TRACES -->\n'+scenarios.map(s=>`<details data-causal-trace="${s.id}">
<summary>Traccia: ${esc(s.label)}</summary>
<p>Una riga per invio o arrivo dalla rete. Le consegne possono essere zero, una o più; il vettore è la colonna di P3 dopo il passo, nell'ordine dei mittenti P1, P2, P3. Su schermi stretti scorri orizzontalmente; usa le frecce dopo aver dato il focus alla tabella.</p>
<div role="region" aria-label="Traccia causale scorribile" tabindex="0" style="max-width:100%;overflow-x:auto">
<table style="width:100%;min-width:800px;table-layout:fixed"><caption>${esc(s.label)} · modello punto-punto senza guasti</caption>
<colgroup><col style="width:60px"><col style="width:290px"><col style="width:170px"><col style="width:160px"><col></colgroup>
<thead><tr><th scope="col">#</th><th scope="col">Azione</th><th scope="col">Consegne nel passo</th><th scope="col">M₃[*,3]</th><th scope="col">Buffer P3</th></tr></thead>
<tbody>${trace(s).map((r,i)=>`<tr><th scope="row">${i+1}</th><td>${esc(r.action)}</td><td>${r.deliveries.join('; ')||'nessuna'}</td><td>[${r.column.join(',')}]</td><td>${r.buffer.join(', ')||'vuoto'}</td></tr>`).join('\n')}</tbody></table>
</div></details>`).join('\n')+'\n<!-- END CAUSAL TRACES -->'}
if(require.main===module){const old=fs.readFileSync(file,'utf8'),m=old.match(/<!-- BEGIN CAUSAL TRACES -->[\s\S]*?<!-- END CAUSAL TRACES -->/);assert(m,'Missing trace markers');const next=markup();if(process.argv.includes('--check')){assert.equal(m[0],next,'Static/model drift');console.log('Four causal traces match the executable model')}else{process.stdout.write('*** Begin Patch\n*** Update File: '+file+'\n@@\n'+m[0].split('\n').map(s=>'-'+s).join('\n')+'\n'+next.split('\n').map(s=>'+'+s).join('\n')+'\n*** End Patch\n')}}
module.exports={markup};
