const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {createRenderer,palette}=require('./render.cjs'),entries=require('./sources.cjs'),hashes=require('./original-hashes.json');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'review/legacy-diagrams');
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const blocks=/<(pre|div)\b[^>]*class="mermaid"[^>]*>[\s\S]*?<\/\1>/g;
function figure(e,r){return `<!-- BEGIN STATIC DIAGRAM ${e.id} -->\n<figure data-static-diagram="${e.id}" style="margin:1.6rem 0;max-width:100%">\n<div role="region" aria-label="${esc(e.title)} — scroll horizontally if needed" tabindex="0" style="overflow-x:auto;max-width:100%;background:${palette.paper};border:1px solid ${palette.rule};padding:12px;box-sizing:border-box">\n<img src="assets/diagrams/${e.id}.svg" width="${r.width}" height="${r.height}" alt="${esc(e.title)}" style="display:block;width:${r.width}px;max-width:none;height:auto;margin:0 auto">\n</div>\n<figcaption style="margin-top:.6rem;font-size:1rem;line-height:1.6">${esc(e.caption)}</figcaption>\n</figure>\n<!-- END STATIC DIAGRAM ${e.id} -->`}
function chapter(e,r,s){
 const start=`<!-- BEGIN STATIC DIAGRAM ${e.id} -->`,end=`<!-- END STATIC DIAGRAM ${e.id} -->`;
 if(s.includes(start)){assert.equal(s.split(start).length,2);const a=s.indexOf(start),b=s.indexOf(end,a);assert(b>a);return s.slice(0,a)+figure(e,r)+s.slice(b+end.length)}
 let n=0;const next=s.replace(blocks,b=>{if(hash(b)!==hashes[e.id])return b;n++;return figure(e,r)});assert.equal(n,1,'Original block changed or absent: '+e.id);return next;
}
function patch(file,old,next){if(old===next)return '';let a=old.split('\n'),b=next.split('\n'),i=0,j=0;while(i<a.length&&a[i]===b[i])i++;while(j<a.length-i&&a.at(-j-1)===b.at(-j-1))j++;return `*** Update File: ${file}\n@@\n`+[...a.slice(Math.max(0,i-2),i).map(x=>' '+x),...a.slice(i,a.length-j).map(x=>'-'+x),...b.slice(i,b.length-j).map(x=>'+'+x),...a.slice(a.length-j,a.length-j+2).map(x=>' '+x)].join('\n')+'\n'}
async function main(){
 const renderer=await createRenderer(),files=new Map(),patches=new Map(),records=[];let diff='',assetDrift=0;
 const addPatch=(file,old,next)=>{const h=patch(file,old,next).replace(`*** Update File: ${file}\n`,'');if(h)patches.set(file,(patches.get(file)||'')+h)};
 fs.mkdirSync(out,{recursive:true});
 try{for(const e of entries){const r=await renderer.render(e),asset=path.join(root,path.dirname(e.file),'assets/diagrams',e.id+'.svg');
  records.push({...e,...r,svg:undefined});
  if(process.argv.includes('--check')){if(!fs.existsSync(asset)||fs.readFileSync(asset,'utf8')!==r.svg+'\n')assetDrift++}
  else{fs.mkdirSync(path.dirname(asset),{recursive:true});fs.writeFileSync(asset,r.svg+'\n');fs.writeFileSync(path.join(out,e.id+'.svg'),r.svg+'\n')}
  const file=path.join(root,e.file),old=files.get(file)||fs.readFileSync(file,'utf8'),next=chapter(e,r,old);addPatch(file,old,next);files.set(file,next);
 }}finally{await renderer.close()}
 for(const [file,value]of files){let next=value;if(!/class="mermaid"/.test(next))next=next.replace(/\s*<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/mermaid@[^\"]+"><\/script>/g,'');addPatch(file,value,next)}
 for(const [file,hunks]of patches)diff+=`*** Update File: ${file}\n`+hunks;
 if(process.argv.includes('--patch'))process.stdout.write('*** Begin Patch\n'+diff+'*** End Patch\n');
 else{console.log(`${entries.length} figures; ${diff?'chapter changes pending':'chapters in sync'}; ${assetDrift} stale SVGs`);if(process.argv.includes('--check')&&(diff||assetDrift))process.exitCode=1}
 if(!process.argv.includes('--check')){
  fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(records,null,2)+'\n');
  fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Reviewed legacy diagrams</title><style>body{max-width:1000px;margin:auto;padding:24px;background:${palette.paper};color:${palette.ink};font:18px/1.6 Georgia,serif}a{color:${palette.cobalt}}figure{margin:24px 0 60px}figure div{overflow:auto;border:1px solid ${palette.rule};padding:12px}img{display:block;max-width:none;margin:auto}figcaption{margin-top:12px}code{font-size:14px}</style><h1>Legacy diagrams · preview</h1><p>Native SVG generated from editable Mermaid sources. No browser renderer required. Not published.</p>`+records.map(e=>`<h2>${esc(e.title)}</h2><a href="../../${e.file}">${esc(e.file)}</a><figure><div tabindex="0" role="region" aria-label="${esc(e.title)}"><img src="${e.id}.svg" width="${e.width}" height="${e.height}" alt="${esc(e.title)}"></div><figcaption>${esc(e.caption)}</figcaption></figure>`).join('\n')+'</html>');
 }
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
module.exports={figure,chapter};
