const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {example}=require('../../pcd/assets/chang-roberts.js');
const file=path.resolve(__dirname,'../../pcd/cap-16-algoritmi-distribuiti.html');
function markup(){
 const m=example();assert.deepEqual(m.counts(),{election:7,leader:6});
 return `<!-- BEGIN CHANG TRACE -->
<details id="chang-static-trace">
<summary>Traccia completa: P2 unico iniziatore, 7 election + 6 leader</summary>
<p>Ogni riga è una trasmissione consegnata; gli invii successivi derivano dall'effetto al ricevente. La riga 7 è il ritorno della candidatura, la riga 8 è il primo annuncio. Non sono messaggi simultanei.</p>
<p class="small">Su schermi stretti, scorri la tabella orizzontalmente per leggere gli effetti; con la tastiera usa le frecce quando la tabella ha il focus.</p>
<div role="region" aria-label="Traccia Chang–Roberts, scorribile orizzontalmente" tabindex="0" style="overflow-x:auto;max-width:100%">
<table style="width:100%;min-width:640px;table-layout:fixed"><caption>Un'elezione completa sull'anello P2 → P7 → P3 → P1 → P5 → P4 → P2</caption>
<colgroup><col style="width:80px"><col style="width:100px"><col style="width:150px"><col></colgroup>
<thead><tr><th scope="col"># invio</th><th scope="col">Da → a</th><th scope="col">Messaggio</th><th scope="col">Effetto al ricevente</th></tr></thead>
<tbody>${m.delivered.map(e=>`<tr><th scope="row">${e.id}</th><td>P${e.from} → P${e.to}</td><td>${e.type}(${e.value})</td><td>${e.result}</td></tr>`).join('\n')}</tbody></table>
</div></details>
<!-- END CHANG TRACE -->`;
}
if(require.main===module){const old=fs.readFileSync(file,'utf8'),match=old.match(/<!-- BEGIN CHANG TRACE -->[\s\S]*?<!-- END CHANG TRACE -->/);assert(match,'Trace markers missing');const next=markup();if(process.argv.includes('--check')){assert.equal(match[0],next,'Static trace/model drift');console.log('13-message static trace matches the executable model')}else{process.stdout.write('*** Begin Patch\n*** Update File: '+file+'\n@@\n'+match[0].split('\n').map(s=>'-'+s).join('\n')+'\n'+next.split('\n').map(s=>'+'+s).join('\n')+'\n*** End Patch\n')}}
module.exports={markup};
