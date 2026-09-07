const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),file=path.join(root,'pcd/cap-08-java.html');
const names=['StopwatchModel','ConcurrentStopwatch','SketchCounter'];
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function markup(name){
 assert(names.includes(name));
 const src=fs.readFileSync(path.join(root,'pcd/assets/examples',name+'.java'),'utf8');
 return `<!-- BEGIN SWING CONTENT ${name} -->\n<p><a href="assets/examples/${name}.java" download>Scarica ${name}.java</a> · Java 17.</p>\n<details data-swing-example="${name}"><summary>${name}: sorgente completo verificato</summary>\n<pre data-swing-source="${name}" tabindex="0" role="region" aria-label="Sorgente Java ${name}"><code class="language-java">${esc(src)}</code></pre>\n</details>\n<!-- END SWING CONTENT ${name} -->`;
}
function main(){
 const original=fs.readFileSync(file,'utf8');let patch='';
 for(const name of names){
  const start=`<!-- BEGIN SWING CONTENT ${name} -->`,end=`<!-- END SWING CONTENT ${name} -->`;
  assert.equal(original.split(start).length,2);assert.equal(original.split(end).length,2);
  const a=original.indexOf(start),b=original.indexOf(end,a)+end.length,old=original.slice(a,b),next=markup(name);
  if(old!==next)patch+='@@\n'+old.split('\n').map(x=>'-'+x).join('\n')+'\n'+next.split('\n').map(x=>'+'+x).join('\n')+'\n';
 }
 if(process.argv.includes('--check')){assert.equal(patch,'','Swing source drift');console.log('Three canonical Swing sources match visible chapter code');}
 else process.stdout.write('*** Begin Patch\n'+(patch?`*** Update File: ${file}\n${patch}`:'')+'*** End Patch\n');
}
if(require.main===module)main();
module.exports={names,markup};
