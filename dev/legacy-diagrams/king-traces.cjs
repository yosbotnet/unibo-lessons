const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {scenarios,trace}=require('../../pcd/assets/phase-king.js');
const file=path.resolve(__dirname,'../../pcd/cap-16-algoritmi-distribuiti.html');
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function markup(){return '<!-- BEGIN KING TRACES -->\n'+scenarios.map(s=>{const m=trace(s);return `<details data-king-trace="${s.id}">
<summary>${esc(s.label)}</summary><p>${esc(s.caption)}</p>
<p>Una riga per processo corretto e fase: V è il vettore ricevuto nel primo round, poi arriva il king-value nel secondo. «Bit / copie» indica il candidato locale e la sua molteplicità; «nuovo bit» è la preferenza dopo la scelta. Le colonne di V sono P1…PN; il proprio voto è incluso. Su mobile scorri orizzontalmente.</p>
<div role="region" tabindex="0" aria-label="Traccia phase king scorribile" style="max-width:100%;overflow-x:auto">
<table style="min-width:735px;width:100%;table-layout:fixed"><caption>${esc(s.label)} · soglia stretta > ${m.n/2+m.f}</caption>
<thead><tr><th scope="col">Fase / king</th><th scope="col">Processo</th><th scope="col">V</th><th scope="col">Bit / copie</th><th scope="col">King-value</th><th scope="col">Regola</th><th scope="col">Nuovo bit</th></tr></thead>
<tbody>${m.history.filter(h=>h.kind==='king').flatMap(h=>h.rows.filter(r=>m.correct.includes(r.pid)).map(r=>`<tr><th scope="row">${h.phase} / P${h.king}</th><td>P${r.pid}</td><td>[${r.vector}]</td><td>${r.majority} / ${r.multiplicity}</td><td>${r.kingValue}</td><td>${r.keep?'mantieni':'adotta king'}</td><td>${r.after}</td></tr>`)).join('\n')}</tbody></table>
</div></details>`}).join('\n')+'\n<!-- END KING TRACES -->'}
if(require.main===module){const s=fs.readFileSync(file,'utf8'),m=s.match(/<!-- BEGIN KING TRACES -->[\s\S]*?<!-- END KING TRACES -->/);assert(m);if(process.argv.includes('--check')){assert.equal(m[0],markup());console.log('Three phase-king traces match their round model')}else process.stdout.write('*** Begin Patch\n*** Update File: '+file+'\n@@\n'+m[0].split('\n').map(s=>'-'+s).join('\n')+'\n'+markup().split('\n').map(s=>'+'+s).join('\n')+'\n*** End Patch\n')}
module.exports={markup};
