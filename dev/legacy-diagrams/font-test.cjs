const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {createRenderer}=require('./render.cjs'),font=require('./font.cjs'),sources=require('./sources.cjs');
const root=path.resolve(__dirname,'../..'),out='/home/ybc/notes-legacy-review-artifacts';
async function platformFonts(page){await page.evaluate(()=>document.fonts.ready);await page.screenshot();const cdp=await page.context().newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');const {root}=await cdp.send('DOM.getDocument');const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector:'.node text tspan tspan'});const result=await cdp.send('CSS.getPlatformFontsForNode',{nodeId});await cdp.detach();return result.fonts}
(async()=>{const r=await createRenderer();try{
 const probe=await r.render({id:'font-probe',title:'Original font',source:'flowchart LR\nA["Font probe: ABCxyz012"] --> B["Connect"]'});
 const actual=await platformFonts(r.page);assert(actual.some(f=>f.familyName==='IBM Plex Mono'&&f.isCustomFont&&f.glyphCount>0),JSON.stringify(actual));
 const context=await r.page.context().browser().newContext(),isolated=await context.newPage(),requests=[];await isolated.route(/^https?:/,q=>{requests.push(q.request().url());return q.abort()});
 const old=execFileSync('git',['show','d97c7f7:pcd/assets/diagrams/pcd-interleavings.svg'],{cwd:root,encoding:'utf8'});
 await isolated.setContent(old);const before=await platformFonts(isolated);assert(!before.some(f=>f.familyName==='IBM Plex Mono'));
 await isolated.setContent('<!doctype html><body></body>');
 const pixels=await isolated.evaluate(async svg=>{
  async function render(source){const img=new Image();img.src='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(source)));await img.decode();const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);return {data:ctx.getImageData(0,0,c.width,c.height).data,width:c.width,height:c.height}}
  const a=await render(svg),b=await render(svg.replace(/<style data-embedded-font="[^"]+">[\s\S]*?<\/style>/,''));let changed=0;for(let i=0;i<a.data.length;i+=4)if(a.data[i]!==b.data[i]||a.data[i+1]!==b.data[i+1]||a.data[i+2]!==b.data[i+2])changed++;return {changed,width:a.width,height:a.height};
 },probe.svg);
 assert(pixels.changed>100,'Embedded font must affect actual <img> rasterization');assert.deepEqual(requests,[],'No external font requests');
 const assets=[...sources.map(e=>path.join(path.dirname(e.file),'assets/diagrams',e.id+'.svg')),'ds/assets/diagrams/ds-reliability-comparison.svg','pcd/assets/diagrams/pcd-consistent-cuts.svg','pcd/assets/diagrams/pcd-wall-reflection.svg','pcd/assets/diagrams/pcd-temporal-counterexamples.svg','cybersecurity/assets/diagrams/cyber-fgsm.svg'];
 assets.push(...require('./robustness-sources.cjs').map(e=>'cybersecurity/assets/diagrams/'+e.id+'.svg'),'cybersecurity/assets/diagrams/cyber-feature-sensitivity.svg');
 let files=0;for(const asset of assets){const svg=fs.readFileSync(path.join(root,asset),'utf8');const bytes=Buffer.from(svg.match(/data:font\/woff2;base64,([A-Za-z0-9+/=]+)/)[1],'base64');assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),font.sha256);assert(svg.includes('SIL OPEN FONT LICENSE Version 1.1'));files++}
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'font-test.json'),JSON.stringify({before,actual,pixels,externalRequests:requests.length,files,fontSha256:font.sha256,fontBytes:font.byteLength},null,2));console.log(`Actual IBM Plex Mono glyphs verified; ${pixels.changed} image pixels differ from fallback; ${files} SVGs contain the exact font and license; no font network requests`);
 await isolated.close();
 }finally{await r.close()}})().catch(e=>{console.error(e);process.exitCode=1});
