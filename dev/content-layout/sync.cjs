// Keep the existing self-contained course bundles (including offline PWAs).
// Canonical sources above; print patches for apply_patch, never overwrite by shell.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),marker='/* BEGIN SHARED CONTENT LAYOUT */',end='/* END SHARED CONTENT LAYOUT */';
const files=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(f=>/\/assets\/lesson-kit\.(css|js)$/.test(f));
let patch='*** Begin Patch\n',changed=0;
for(const file of files){const old=fs.readFileSync(path.join(root,file),'utf8'),ext=path.extname(file),source=fs.readFileSync(path.join(__dirname,'reader'+ext),'utf8');
 const start=old.indexOf(marker),tail=old.indexOf(end),base=start<0?old:old.slice(0,start)+old.slice(tail+end.length);
 if(start>=0&&tail<start)throw Error('Broken generated block: '+file);
 const next=base.trimEnd()+'\n\n'+marker+'\n'+source.trimEnd()+'\n'+end+'\n';if(old===next)continue;changed++;
 const a=old.split('\n'),b=next.split('\n');let i=0,j=0;while(i<a.length&&a[i]===b[i])i++;while(j<a.length-i&&a[a.length-1-j]===b[b.length-1-j])j++;
 patch+='*** Update File: '+path.join(root,file)+'\n@@\n'+[...a.slice(Math.max(0,i-2),i).map(l=>' '+l),...a.slice(i,a.length-j).map(l=>'-'+l),...b.slice(i,b.length-j).map(l=>'+'+l),...a.slice(a.length-j,a.length-j+2).map(l=>' '+l)].join('\n')+'\n';
}
if(process.argv.includes('--patch'))process.stdout.write(patch+'*** End Patch\n');else{console.log(`${files.length} course bundles; ${changed} differ from shared content-layout sources.`);if(changed)process.exitCode=1}
