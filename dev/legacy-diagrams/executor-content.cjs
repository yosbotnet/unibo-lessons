const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),file=path.join(root,'pcd/cap-08-java.html');
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function code(name){
 const src=fs.readFileSync(path.join(root,'pcd/assets/examples',name+'.java'),'utf8');
 return `<p><a href="assets/examples/${name}.java" download>Scarica ${name}.java</a> · Java 17, sorgente completo.</p>\n<pre data-executor-source="${name}" tabindex="0" role="region" aria-label="Sorgente Java ${name}"><code class="language-java">${esc(src)}</code></pre>`;
}
function blocks(rows){
 const labels=['Operazione','Future done','Corpo uscito','Pool terminato','Interrupt osservato'];
 return {
  'PrimeProducer':code('PrimeProducer'),
  'ExecutorLifecycleDemo':`<details><summary>Codice completo dell’esperimento riproducibile</summary>\n${code('ExecutorLifecycleDemo')}\n</details>`,
  'executor-observations':`<div tabindex="0" role="region" aria-label="Osservazioni dell’esperimento executor, tabella scorrevole" style="overflow-x:auto;max-width:100%">\n<table id="executor-observations" style="min-width:640px"><caption>Prima di aprire release; Future e corpo si riferiscono al task attivo.</caption><thead><tr>${labels.map(x=>`<th scope="col">${esc(x)}</th>`).join('')}</tr></thead><tbody>\n${rows.map(row=>'<tr>'+[0,1,3,4,7].map(j=>row[j]).map((x,i)=>i===0?`<th scope="row"><code>${esc(x)}</code></th>`:`<td>${x==='true'?'sì':x==='false'?'no':esc(x)}</td>`).join('')+'</tr>').join('\n')}\n</tbody></table>\n</div>`
 };
}
function marked(id,html){return `<!-- BEGIN EXECUTOR CONTENT ${id} -->\n${html}\n<!-- END EXECUTOR CONTENT ${id} -->`;}
function main(){
 const {rows}=require('./executor-java-test.cjs').verify();
 const original=fs.readFileSync(file,'utf8');let patch='';
 for(const [id,html]of Object.entries(blocks(rows)).sort(([a],[b])=>original.indexOf(`<!-- BEGIN EXECUTOR CONTENT ${a} -->`)-original.indexOf(`<!-- BEGIN EXECUTOR CONTENT ${b} -->`))){
  const start=`<!-- BEGIN EXECUTOR CONTENT ${id} -->`,end=`<!-- END EXECUTOR CONTENT ${id} -->`;
  assert.equal(original.split(start).length,2);assert.equal(original.split(end).length,2);
  const a=original.indexOf(start),b=original.indexOf(end,a)+end.length,old=original.slice(a,b),next=marked(id,html);
  if(old!==next)patch+='@@\n'+old.split('\n').map(x=>'-'+x).join('\n')+'\n'+next.split('\n').map(x=>'+'+x).join('\n')+'\n';
 }
 if(process.argv.includes('--check')){assert.equal(patch,'','Executor content drift');console.log('Executor source and executed observations in sync');}
 else process.stdout.write('*** Begin Patch\n'+(patch?`*** Update File: ${file}\n${patch}`:'')+'*** End Patch\n');
}
if(require.main===module)main();
module.exports={blocks,marked};
