const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{scenarios,trace}=require('../../ds/assets/cap-register.js');
const file=path.resolve(__dirname,'../../ds/DS-C1.html'),esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function markup(){return '<!-- BEGIN CAP TRACES -->\n'+scenarios.map(s=>`<details data-cap-trace="${s.id}"><summary>${esc(s.label)}</summary>
<p>Policy: ${s.policy==='local'?'serve the local copy':'consult G1'}. One observer action per row. “Pending” is not a completed read; a completed stale response remains part of the history after healing. Scroll horizontally when needed.</p>
<div role="region" tabindex="0" aria-label="CAP execution trace, scrollable" style="max-width:100%;overflow-x:auto">
<table style="min-width:640px;width:100%;table-layout:fixed"><caption>${esc(s.label)}</caption><thead><tr><th scope="col">Action</th><th scope="col">G1 / G2 cache</th><th scope="col">Read result</th><th scope="col">Linearizable history?</th></tr></thead><tbody>
${trace(s).map(r=>{const read=r.operations.find(o=>o.kind==='read');return `<tr><th scope="row">${r.action}</th><td>${r.values.join(' / ')}</td><td>${!read?'not invoked':read.end===null?'pending':read.result}</td><td>${r.analysis.linearizable?'yes':'no'}</td></tr>`}).join('\n')}
</tbody></table></div></details>`).join('\n')+'\n<!-- END CAP TRACES -->'}
if(require.main===module){const s=fs.readFileSync(file,'utf8'),m=s.match(/<!-- BEGIN CAP TRACES -->[\s\S]*?<!-- END CAP TRACES -->/);assert(m);if(process.argv.includes('--check')){assert.equal(m[0],markup());console.log('Six CAP traces match their operation model')}else process.stdout.write('*** Begin Patch\n*** Update File: '+file+'\n@@\n'+m[0].split('\n').map(s=>'-'+s).join('\n')+'\n'+markup().split('\n').map(s=>'+'+s).join('\n')+'\n*** End Patch\n')}
module.exports={markup};
