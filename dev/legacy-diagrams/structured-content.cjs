const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),file=path.join(root,'pcd/cap-08-java.html');
const name='StructuredFetch20',start='<!-- BEGIN STRUCTURED CONTENT -->',end='<!-- END STRUCTURED CONTENT -->';
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function markup(){
 const source=fs.readFileSync(root+'/pcd/assets/examples/'+name+'.java','utf8');
 return `${start}\n<p><a href="assets/examples/${name}.java" download>Scarica ${name}.java</a> · esempio storico completo, solo JDK 20 con modulo incubator.</p>\n<details data-structured-example="${name}"><summary>${name}: codice completo</summary>\n<pre data-structured-source tabindex="0" role="region" aria-label="Codice Java ${name}"><code class="language-java">${esc(source)}</code></pre>\n</details>\n${end}`;
}
if(require.main===module){
 const original=fs.readFileSync(file,'utf8');assert.equal(original.split(start).length,2);assert.equal(original.split(end).length,2);
 const a=original.indexOf(start),b=original.indexOf(end,a)+end.length,old=original.slice(a,b),next=markup();
 if(process.argv.includes('--check')){assert.equal(old,next,'Structured source drift');console.log('Canonical JDK20 source in sync');}
 else process.stdout.write('*** Begin Patch\n'+(old!==next?`*** Update File: ${file}\n@@\n`+old.split('\n').map(x=>'-'+x).join('\n')+'\n'+next.split('\n').map(x=>'+'+x).join('\n')+'\n':'')+'*** End Patch\n');
}
module.exports={name,markup};
