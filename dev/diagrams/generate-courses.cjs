// Print an apply_patch patch, never write/publish chapters directly.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {renderPreset}=require('./presets/index.cjs'),entries=require('./sources/cross-course.cjs');
const root=path.resolve(__dirname,'../..'),files=new Map();
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
for(const {file,spec,prefix,caption} of entries){
 const d=renderPreset(spec);let count=0,source=files.get(file)||fs.readFileSync(path.join(root,file),'utf8');
 source=source.replace(/<figure\b[\s\S]*?<\/figure>/g,f=>{if(!f.includes(`<b>${prefix} ${spec.plate}</b>`))return f;count++;assert.equal((f.match(/<svg\b/g)||[]).length,1);return f.replace(/<svg\b[\s\S]*?<\/svg>/,d.svg()).replace(/<figcaption>[\s\S]*?<\/figcaption>/,`<figcaption><b>${prefix} ${spec.plate}</b> — ${esc(caption)}</figcaption>`)});assert.equal(count,1,'Unique target '+file+' '+spec.plate);files.set(file,source);
}
let patch='*** Begin Patch\n',changed=0;
for(const [file,next] of files){const old=fs.readFileSync(path.join(root,file),'utf8');if(old===next)continue;changed++;const a=old.split('\n'),b=next.split('\n');let start=0,end=0;while(start<a.length&&a[start]===b[start])start++;while(end<a.length-start&&a[a.length-1-end]===b[b.length-1-end])end++;
 patch+='*** Update File: '+path.join(root,file)+'\n@@\n'+[...a.slice(Math.max(0,start-2),start).map(l=>' '+l),...a.slice(start,a.length-end).map(l=>'-'+l),...b.slice(start,b.length-end).map(l=>'+'+l),...a.slice(a.length-end,a.length-end+2).map(l=>' '+l)].join('\n')+'\n';
}
if(process.argv.includes('--patch'))process.stdout.write(patch+'*** End Patch\n');else{console.log(`${entries.length} generated figures; ${changed} chapter files differ.`);if(changed)process.exitCode=1}
