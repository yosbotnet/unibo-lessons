const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'/home/ybc/hosted/unibo-lessons/dev/node_modules/playwright');
const {renderPreset}=require('./presets/index.cjs'),entries=require('./sources/cross-course.cjs');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'review/cross-course');
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const clone=x=>structuredClone(x),cases=entries.map(e=>e.spec);
const tree=clone(cases[1]);tree.id='test-tree-extra';tree.tree.children[0].children.push({id:'report',kind:'action',label:'report obstacle position'});tree.overrides={siblingGap:64};cases.push(tree);
const reversed=clone(cases[0]);reversed.id='test-tree-reversed';reversed.tree.children[0].children.reverse();cases.push(reversed);
const schema=clone(cases[3]);schema.id='test-schema-long';schema.tables[2].fields.push({name:'Descrizione estesa del prodotto'});cases.push(schema);
cases.push({preset:'sequence',id:'test-three-participants',participants:[{id:'client',label:'Client'},{id:'api',label:'API'},{id:'db',label:'Database'}],messages:[{from:'client',to:'api',label:'Request',detail:'GET /items'},{from:'api',to:'db',label:'Query'},{from:'db',to:'api',label:'Rows',dashed:true},{from:'api',to:'client',label:'Response',accent:true,dashed:true}]});
const swapped=clone(cases[4]);swapped.id='test-reordered-participants';swapped.overrides={participantOrder:['b','a'],slant:0,rowGap:140};cases.push(swapped);
const diagrams=cases.map(spec=>{const d=renderPreset(spec);assert.equal(d.svg(),renderPreset(spec).svg());return d});
assert.deepEqual(diagrams[0].semantic.children.sequence,['find','pick','place']);
assert.deepEqual(diagrams[6].semantic.children.sequence,['place','pick','find']);
assert.equal(diagrams[3].edges.length,5);assert(diagrams[3].edges.some(e=>e.from.startsWith('prodotti.')&&e.to.startsWith('tipi.')));assert(!diagrams[3].edges.some(e=>e.from.startsWith('vendite.')&&e.to.startsWith('tipi.')));
assert.equal(diagrams[2].nodes.get('vendite').lines.filter(s=>s.startsWith('PK/FK')).length,3);
assert.deepEqual(diagrams[4].semantic.messages.map(m=>[m.from,m.to]),[['a','b'],['b','a'],['a','b']]);
let rejected=0;
function rejects(spec,change){const s=clone(spec);change(s);assert.throws(()=>renderPreset(s));rejected++}
rejects(cases[0],s=>s.tree.children[0].children[0].children=[{id:'illegal',kind:'action',label:'Illegal'}]);
rejects(cases[0],s=>s.tree.children[0].children[1].id='find');
rejects(cases[0],s=>s.tree.children=[]);
rejects(cases[0],s=>s.overrides={fontSize:9});
rejects(cases[2],s=>s.references[0].target='Mese');
rejects(cases[2],s=>s.references[0].field='missing');
rejects(cases[2],s=>s.references.pop());
rejects(cases[3],s=>s.references[3].from='vendite');
rejects(cases[4],s=>s.messages[0].to='missing');
rejects(cases[4],s=>s.messages[0].to='a');
rejects(cases[4],s=>s.overrides={participantOrder:['a','a']});
rejects(cases[4],s=>s.overrides={rowGap:10});
function overlaps(a,b){return Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>.1&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>.1}
function intersects(a,b,n){let lo=0,hi=1;for(const [p,q] of [[a[0]-b[0],a[0]-n.x-1],[b[0]-a[0],n.x+n.w-1-a[0]],[a[1]-b[1],a[1]-n.y-1],[b[1]-a[1],n.y+n.h-1-a[1]]]){if(!p){if(q<0)return false}else{const r=q/p;if(p<0)lo=Math.max(lo,r);else hi=Math.min(hi,r);if(lo>hi)return false}}return true}
for(const d of diagrams){const nodes=[...d.nodes.values()];for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++)assert(!overlaps(nodes[i],nodes[j]),d.id+' overlapping nodes');for(const e of d.edges){const points=[d.port(e.from),...e.via,d.port(e.to)];for(const n of nodes)if(![e.from.split('.')[0],e.to.split('.')[0]].includes(n.id))for(let i=1;i<points.length;i++)assert(!intersects(points[i-1],points[i],n),d.id+' edge crosses '+n.id)}}
(async()=>{fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1500,height:1000}}),css=fs.readFileSync(path.join(root,'dl/assets/lesson-kit.css'),'utf8');
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route(/^https?:/,r=>/highlight\.min\.js$/.test(r.request().url())?r.fulfill({path:path.join(root,'dl/assets/highlight.min.js'),contentType:'application/javascript'}):r.abort());
 try{
 for(const d of diagrams){await page.setContent('<style>'+css+'body{margin:0;background:var(--lk-paper)}</style>'+d.svg());
 const issues=await page.evaluate(()=>{const svg=document.querySelector('svg'),v=svg.viewBox.baseVal,issues=[];if(new DOMParser().parseFromString(svg.outerHTML,'image/svg+xml').querySelector('parsererror'))issues.push('XML');const texts=[...svg.querySelectorAll('text')].map(t=>({t,b:t.getBBox()}));for(const {t,b} of texts){if(b.x<0||b.y<0||b.x+b.width>v.width||b.y+b.height>v.height)issues.push('Text outside SVG: '+t.textContent);const shape=t.closest('[data-node]')?.querySelector('rect,circle,ellipse');if(shape){const s=shape.getBBox();if(b.x<s.x||b.y<s.y||b.x+b.width>s.x+s.width||b.y+b.height>s.y+s.height)issues.push('Text outside node: '+t.textContent)}}for(let i=0;i<texts.length;i++)for(let j=i+1;j<texts.length;j++){const a=texts[i].b,b=texts[j].b;if(Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>1&&Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>1)issues.push('Text overlap')}
 for(const p of svg.querySelectorAll('[data-from]')){if(/[CQAS]/i.test(p.getAttribute('d')))issues.push('Curved path');const id=p.getAttribute('marker-end')?.match(/#([^)]*)/)[1];if(!svg.querySelector('#'+CSS.escape(id)))issues.push('Missing marker');}return issues});assert.deepEqual(issues,[],d.id);await page.locator('svg').screenshot({path:path.join(out,d.id+'.png')});}
 const cards=diagrams.map((d,i)=>`<section><h2>${esc(d.id)}</h2>${entries[i]?`<p><a href="../../${entries[i].file}">Chapter · ${entries[i].prefix} ${d.plate}</a></p>`:''}<div class="pair"><details><summary>Content specification (no coordinates)</summary><pre>${esc(JSON.stringify(cases[i],null,2))}</pre></details><figure class="lk-fig"><div class="figure-diagram" tabindex="0" role="region" aria-label="Scrollable diagram">${d.svg()}</div><figcaption>${esc(entries[i]?.caption||d.caption)}</figcaption></figure></div></section>`).join('\n');
 fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Editorial diagrams beyond DL</title><link rel="stylesheet" href="../../dl/assets/lesson-kit.css"><link rel="stylesheet" href="../../assets/course-figures.css"><style>body{background:var(--lk-paper);color:var(--lk-ink);font:17px/1.6 var(--lk-font);margin:24px}main{max-width:1400px;margin:auto}h1,h2{font-family:var(--lk-display)}section{padding:24px 0;border-top:1px solid var(--lk-rule-soft)}figure{margin:16px 0!important;min-width:0}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.6 var(--lk-mono)}a{color:var(--lk-cobalt)}</style><main><h1>EDITORIAL DIAGRAMS BEYOND DL</h1><p>Five course figures and five layout variations. Shared ivory/cobalt/vermilion style; ordered-tree, field-to-field relational schema and message-sequence semantics. No paid generation or production deployment.</p>${cards}</main></html>`);
 for(const width of [1280,390]){await page.setViewportSize({width,height:1000});await page.goto('file://'+path.join(out,'index.html'));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Gallery page overflow');await page.screenshot({path:path.join(out,'gallery-'+width+'.png')});for(const el of await page.locator('.figure-diagram').all())assert(await el.evaluate(e=>{e.scrollLeft=e.scrollWidth;return e.scrollWidth<=e.clientWidth||e.scrollLeft>0}),'Scroll failed');
  for(const entry of entries){await page.goto('file://'+path.join(root,entry.file));const svg=page.locator(`[data-generated-diagram="${entry.spec.id}"]`);assert.equal(await svg.count(),1,'Generated figure in chapter');assert.equal(await page.evaluate(()=>[...document.querySelectorAll('figure text,figure path,figure rect,figure circle,figure ellipse,figure g')].filter(e=>e.namespaceURI!=='http://www.w3.org/2000/svg').length),0,'Escaped SVG');
   const visual=await svg.evaluate(el=>{const svgBox=el.viewBox.baseVal;return {font:getComputedStyle(el.querySelector('text')).fontFamily,fill:getComputedStyle(el.querySelector('text')).fill,overflow:[...el.querySelectorAll('text')].filter(t=>{const b=t.getBBox();return b.x<0||b.y<0||b.x+b.width>svgBox.width||b.y+b.height>svgBox.height}).map(t=>t.textContent)}});assert.deepEqual(visual.overflow,[],entry.spec.id+' chapter text overflow');assert(visual.font.includes('IBM Plex Mono'),'Course font changed');
   const figure=svg.locator('xpath=ancestor::figure');await figure.screenshot({path:path.join(out,entry.spec.id+'-chapter-'+width+'.png')});if(width===1280)assert(await svg.evaluate(el=>{const e=el.closest('.figure-diagram');return e.scrollWidth<=e.clientWidth+1}),'Course diagram must fit desktop column');if(width===390)assert(await svg.evaluate(el=>{const e=el.closest('.figure-diagram');e.scrollLeft=e.scrollWidth;return e.scrollWidth<=e.clientWidth||e.scrollLeft>0}),'Chapter scroll');
  }
 }
 // SVG style blocks are document-global. Removing one must not restyle other plates.
 for(const file of new Set(entries.map(e=>e.file))){const changed=entries.filter(e=>e.file===file).map(e=>e.prefix+' '+e.spec.plate),snapshots=[];for(const base of ['/home/ybc/hosted/unibo-lessons',root]){await page.goto('file://'+path.join(base,file));snapshots.push(await page.evaluate(changed=>[...document.querySelectorAll('figure')].filter(f=>!changed.includes(f.querySelector('figcaption b')?.textContent)).map(f=>[...f.querySelectorAll('svg text,svg path,svg rect,svg circle')].map(e=>{const s=getComputedStyle(e);return [e.tagName,e.textContent,s.fill,s.stroke,s.strokeWidth,s.fontFamily,s.fontSize,s.fontWeight]})),changed))}assert.deepEqual(snapshots[1],snapshots[0],'Unchanged figure styles: '+file)}
 assert.deepEqual(errors,[]);
 }finally{await browser.close()}
 const report={cases:cases.length,invalidInputsRejected:rejected,failures:[],checks:['source slide comparison recorded in README','deterministic layout','ordered children','field-to-field PK/FK references','sequence sender/receiver order','node overlap and edge-node intersections','native SVG XML and markers','rendered text bounds and overlaps','desktop/mobile gallery and scroll']};fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
