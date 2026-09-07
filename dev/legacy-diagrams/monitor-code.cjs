const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),file=root+'/pcd/cap-07-monitor.html';
const names=['SynchCell','SynchCell2','MonitorBuffer','ConditionBuffer'];
const descriptions={SynchCell:'Il dato resta disponibile dopo get. notifyAll permette a tutti i lettori in attesa di rivalutare available; get propaga l’interruzione.',SynchCell2:'La stessa cella persistente con un solo lock esplicito. lockInterruptibly precede try: finally viene eseguito solo dopo l’acquisizione riuscita.',MonitorBuffer:'Array circolare con capacità positiva e tutti gli slot utilizzabili grazie a count. get libera il riferimento nello slot consumato. Il wait set è condiviso da produttori e consumatori.',ConditionBuffer:'Stesso array circolare, con notFull per i produttori e notEmpty per i consumatori. Le signal sono selettive; while e finally restano necessari. Il lock predefinito non promette equità.'};
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function markup(name){const source=fs.readFileSync(root+'/pcd/assets/examples/'+name+'.java','utf8');return `<div class="monitor-example" data-monitor-example="${name}"><p>${descriptions[name]} <a href="assets/examples/${name}.java" download>Scarica ${name}.java</a>.</p><pre id="code-${name}" data-annotated-source tabindex="0" role="region" aria-label="Codice ${name} — scorrimento orizzontale"><code class="language-java">${esc(source)}</code></pre></div>`}
function main(){
 const old=fs.readFileSync(file,'utf8'),changes=[];
 for(const name of names){const a='<!-- BEGIN MONITOR CODE '+name+' -->',b='<!-- END MONITOR CODE '+name+' -->';assert.equal(old.split(a).length,2);assert.equal(old.split(b).length,2);const start=old.indexOf(a),end=old.indexOf(b);assert(end>start);const before=old.slice(start,end).trimEnd(),after=a+'\n'+markup(name);if(before!==after)changes.push({start,before,after,end:b})}
 if(process.argv.includes('--check')){assert.equal(changes.length,0,'Java source/chapter drift');console.log('Four downloadable Java examples match chapter bytes');return}
 if(changes.length)console.log('*** Begin Patch\n*** Update File: '+file+'\n'+changes.sort((a,b)=>a.start-b.start).map(c=>'@@\n'+c.before.split('\n').map(l=>'-'+l).join('\n')+'\n'+c.after.split('\n').map(l=>'+'+l).join('\n')+'\n '+c.end).join('\n')+'\n*** End Patch');
}
if(require.main===module)main();module.exports={names,markup};
