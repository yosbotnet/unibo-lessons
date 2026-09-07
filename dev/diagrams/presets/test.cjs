const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {renderPreset}=require('./index.cjs'),cases=require('./cases.cjs'),hashes=require('./approved-svg-hashes.json');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'/home/ybc/hosted/unibo-lessons/dev/node_modules/playwright');
const root=path.resolve(__dirname,'../../..'),out=path.join(root,'review/presets');
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function overlap(a,b){return a.x<b.x+b.w-.1&&a.x+a.w>b.x+.1&&a.y<b.y+b.h-.1&&a.y+a.h>b.y+.1}
function crosses(a,b,n){let lo=0,hi=1;for(const [p,q] of [[-(b[0]-a[0]),a[0]-n.x-1],[b[0]-a[0],n.x+n.w-1-a[0]],[-(b[1]-a[1]),a[1]-n.y-1],[b[1]-a[1],n.y+n.h-1-a[1]]]){if(p===0){if(q<0)return false}else{const r=q/p;if(p<0)lo=Math.max(lo,r);else hi=Math.min(hi,r);if(lo>hi)return false}}return true}
const diagrams=cases.map(spec=>{const d=renderPreset(spec);assert.equal(d.svg(),renderPreset(spec).svg(),'Determinism '+spec.id);if(hashes[spec.id])assert.equal(crypto.createHash('sha256').update(d.svg()).digest('hex'),hashes[spec.id],'Approved SVG changed: '+spec.id);
 const nodes=[...d.nodes.values()];for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++)assert(!overlap(nodes[i],nodes[j]),spec.id+' node overlap');
 for(const e of d.edges){const points=[d.port(e.from),...e.via,d.port(e.to)];for(const n of nodes){if([e.from.split('.')[0],e.to.split('.')[0]].includes(n.id))continue;for(let i=1;i<points.length;i++)assert(!crosses(points[i-1],points[i],n),spec.id+' edge crosses '+n.id)}}
 if(spec.preset==='autodiff'){const {x,y,z}=spec.values;assert.equal(d.semantic.values.f,(x+y)*z);assert.deepEqual(d.semantic.gradients,{x:z,y:z,z:x+y,q:z,f:1})}
 if(spec.preset==='inception')assert.equal(d.semantic.output.channels,d.semantic.branches.reduce((n,b)=>n+b.at(-1).channels,0));
 if(spec.preset==='gru'){assert.deepEqual(d.nodes.get('candidate-out').lines,d.nodes.get('mix-candidate').lines);assert.equal(d.semantic.weights.previous,(spec.updateConvention||'retain')==='retain'?(spec.labels?.update||'uₜ'):'1−'+(spec.labels?.update||'uₜ'))}
 return d;
});
const original=cases[1];
for(const change of [{overrides:{x:100}},{inputs:[]},{inputs:['a','a']},{bias:'yes'},{overrides:{inputOrder:['x0']}},{overrides:{activationShape:'triangle'}},{overrides:{rowGap:-1}}])assert.throws(()=>renderPreset({...original,...change}));
assert.throws(()=>renderPreset({...cases[0],expression:'arbitrary-code'}));assert.throws(()=>renderPreset({...cases[0],values:{x:NaN,y:1,z:1}}));
assert.throws(()=>renderPreset({...cases[2],branches:[[{kind:'pool',kernel:2}],[{kind:'conv',kernel:1,channels:1}]]}));
assert.throws(()=>renderPreset({...cases[3],layout:'unknown'}));
const flipped=renderPreset({...cases[3],updateConvention:'candidate'});assert(flipped.caption.includes('(1−uₜ)⊙hₜ₋₁+uₜ⊙h̃ₜ'),'Complement is parenthesized in the alternate convention');
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1600,height:1100}}),css=fs.readFileSync(path.join(root,'dl/assets/lesson-kit.css'),'utf8');
 try{for(let i=0;i<diagrams.length;i++){
  const d=diagrams[i];await page.setContent('<style>'+css+'body{background:var(--lk-paper)}</style>'+d.svg());
  const errors=await page.evaluate(()=>{
   const svg=document.querySelector('svg'),errors=[],vb=svg.viewBox.baseVal;
   if(new DOMParser().parseFromString(svg.outerHTML,'image/svg+xml').querySelector('parsererror'))errors.push('XML');
   if(svg.querySelector('foreignObject,script'))errors.push('Non-native SVG');
   const texts=[...svg.querySelectorAll('text')].map(t=>({t,b:t.getBBox()}));
   for(const {t,b} of texts){if(b.x<0||b.y<0||b.x+b.width>vb.width+.1||b.y+b.height>vb.height+.1)errors.push('Text outside viewBox: '+t.textContent);const g=t.closest('[data-node]'),shape=g?.querySelector('rect,circle');if(shape){const n=shape.getBBox();if(b.x<n.x-.1||b.y<n.y-.1||b.x+b.width>n.x+n.width+.1||b.y+b.height>n.y+n.height+.1)errors.push('Text outside shape: '+t.textContent)}}
   for(let i=0;i<texts.length;i++)for(let j=i+1;j<texts.length;j++){const a=texts[i].b,b=texts[j].b;if(Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>1&&Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>1)errors.push('Text overlap')}
   for(const p of svg.querySelectorAll('[data-from]')){if(/[CQAS]/i.test(p.getAttribute('d')))errors.push('Curved edge');const id=p.getAttribute('marker-end')?.match(/#([^)]*)/)[1];if(!id||!svg.querySelector('#'+CSS.escape(id)))errors.push('Marker missing')}
   return errors;
  });assert.deepEqual(errors,[],d.id);await page.locator('svg').screenshot({path:path.join(out,d.id+'.png')});
 }
 const cards=diagrams.map((d,i)=>`<section><h2>${escape(d.id)}</h2><div class="pair"><pre>${escape(JSON.stringify(cases[i],null,2))}</pre><figure class="lk-fig"><div class="figure-diagram" tabindex="0">${d.svg()}</div><figcaption>${escape(d.caption)}</figcaption></figure></div></section>`).join('\n');
 fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reusable editorial presets</title><link rel="stylesheet" href="../../dl/assets/lesson-kit.css"><link rel="stylesheet" href="../../assets/course-figures.css"><style>body{background:var(--lk-paper);color:var(--lk-ink);font:17px/1.6 var(--lk-font);margin:24px}h1,h2{font-family:var(--lk-display)}main{max-width:1600px;margin:auto}.pair{display:grid;grid-template-columns:minmax(200px,1fr) minmax(0,3fr);gap:24px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.5 var(--lk-mono)}figure{min-width:0;margin:0!important}section{border-top:1px solid var(--lk-rule-soft);padding:24px 0}a{color:var(--lk-cobalt)}@media(max-width:850px){body{margin:16px}.pair{grid-template-columns:minmax(0,1fr)}}</style><main><h1>REUSABLE EDITORIAL PRESETS</h1><p>Four preset families. Content and supported overrides only: no per-diagram coordinates. The four course examples preserve the approved SVGs exactly. The remaining examples test layout and semantic variations.</p><p>Wide diagrams scroll without reducing text size. Autodiff currently supports only f=(x+y)z; Inception uses stride 1 and same padding.</p>${cards}</main></html>`);
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.goto('file://'+path.join(out,'index.html'));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Preview page overflow');await page.screenshot({path:path.join(out,'gallery-'+width+'.png')});if(width===390)for(const region of await page.locator('.figure-diagram').all())assert(await region.evaluate(e=>{e.scrollLeft=e.scrollWidth;return e.scrollWidth<=e.clientWidth||e.scrollLeft>0}),'Mobile scroll failed')}
 }finally{await browser.close()}
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({cases:cases.length,approvedSvgMatches:4,invalidInputsRejected:11,failures:[],checks:['determinism','approved SVG byte hashes','node/edge geometry','formula and channel semantics','XML and markers','rendered text bounds and overlaps','desktop/mobile preview and scroll']},null,2));
 console.log(`PASS: ${cases.length} preset cases, four identical approved SVGs, invalid input rejection, rendered geometry and desktop/mobile preview.`);
})().catch(e=>{console.error(e);process.exitCode=1});
