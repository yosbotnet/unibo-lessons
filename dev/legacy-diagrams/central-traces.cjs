const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {scenarios,trace}=require('../../pcd/assets/centralized-mutex.js');
const file=path.resolve(__dirname,'../../pcd/cap-16-algoritmi-distribuiti.html');
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function markup(){return '<!-- BEGIN CENTRAL TRACES -->\n'+scenarios.map(s=>`<details data-central-trace="${s.id}">
<summary>Traccia: ${esc(s.label)}</summary>
<p>Ogni riga è un'azione del client o la consegna di un messaggio. Le concessioni possono avvenire automaticamente durante una consegna a P0. I vettori hanno componenti P1, P2. Su mobile scorri la tabella orizzontalmente; con il focus nella tabella puoi usare le frecce.</p>
<div role="region" tabindex="0" aria-label="Traccia del coordinatore scorribile" style="max-width:100%;overflow-x:auto">
<table style="width:100%;min-width:820px;table-layout:fixed"><caption>${esc(s.label)}</caption>
<colgroup><col style="width:60px"><col style="width:290px"><col style="width:170px"><col style="width:140px"><col></colgroup>
<thead><tr><th scope="col">#</th><th scope="col">Azione</th><th scope="col">Token</th><th scope="col">Concesse / completate</th><th scope="col">Coda a P0</th></tr></thead>
<tbody>${trace(s).map((r,i)=>`<tr><th scope="row">${i+1}</th><td>${esc(r.action)}</td><td>${esc(r.token)}</td><td>[${r.granted}] / [${r.completed}]</td><td>${r.queue.join(', ')||'vuota'}</td></tr>`).join('\n')}</tbody></table>
</div></details>`).join('\n')+'\n<!-- END CENTRAL TRACES -->'}
if(require.main===module){const old=fs.readFileSync(file,'utf8'),m=old.match(/<!-- BEGIN CENTRAL TRACES -->[\s\S]*?<!-- END CENTRAL TRACES -->/);assert(m,'Missing trace markers');const next=markup();if(process.argv.includes('--check')){assert.equal(m[0],next,'Static/model drift');console.log('Two centralized mutex traces match the executable model')}else process.stdout.write('*** Begin Patch\n*** Update File: '+file+'\n@@\n'+m[0].split('\n').map(s=>'-'+s).join('\n')+'\n'+next.split('\n').map(s=>'+'+s).join('\n')+'\n*** End Patch\n')}
module.exports={markup};
