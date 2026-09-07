const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),file=path.join(root,'pcd/cap-08-java.html');
const names=['CyclicBarrierMonitor','CountDownLatchMonitor'];
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function markup(name){
 assert(names.includes(name));const source=fs.readFileSync(root+'/pcd/assets/examples/'+name+'.java','utf8');
 return `<!-- BEGIN BARRIER CONTENT ${name} -->\n<p><a href="assets/examples/${name}.java" download>Scarica ${name}.java</a> · esempio editoriale Java 17.</p>\n<details data-barrier-example="${name}"><summary>${name}: implementazione completa</summary>\n<pre data-barrier-source="${name}" tabindex="0" role="region" aria-label="Codice Java ${name}"><code class="language-java">${esc(source)}</code></pre>\n</details>\n<!-- END BARRIER CONTENT ${name} -->`;
}
if(require.main===module){
 const original=fs.readFileSync(file,'utf8');let patch='';
 for(const name of names){const start=`<!-- BEGIN BARRIER CONTENT ${name} -->`,end=`<!-- END BARRIER CONTENT ${name} -->`;
  assert.equal(original.split(start).length,2);assert.equal(original.split(end).length,2);
  const a=original.indexOf(start),b=original.indexOf(end,a)+end.length,old=original.slice(a,b),next=markup(name);
  if(old!==next)patch+='@@\n'+old.split('\n').map(x=>'-'+x).join('\n')+'\n'+next.split('\n').map(x=>'+'+x).join('\n')+'\n';
 }
 if(process.argv.includes('--check')){assert.equal(patch,'','Barrier/latch source drift');console.log('Two canonical barrier/latch sources in sync');}
 else process.stdout.write('*** Begin Patch\n'+(patch?`*** Update File: ${file}\n${patch}`:'')+'*** End Patch\n');
}
module.exports={names,markup};
