// A native event-timeline renderer, not a flowchart layout or an AI raster.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {graph,analyze,demo,cases}=require('../../pcd/assets/consistent-cuts.js'),font=require('./font.cjs'),{palette:p}=require('./render.cjs');
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function render(spec,views,overrides={}){
 for(const k of Object.keys(overrides))assert(['eventGap','rowGap'].includes(k),'Unknown timeline override');
 const requestedGap=overrides.eventGap??150,rowGap=overrides.rowGap??140;assert(Number.isInteger(requestedGap)&&requestedGap>=120&&requestedGap<=240);assert(Number.isInteger(rowGap)&&rowGap>=120&&rowGap<=200);
 const g=graph(spec);assert(Array.isArray(views)&&views.length>=1&&views.length<=6);for(const v of views){assert(typeof v.label==='string'&&v.label.length<=60);assert(/^[a-z][a-z0-9-]*$/.test(v.id))}assert(new Set(views.map(v=>v.id)).size===views.length);
 const labelWidth=Math.max(...[...g.nodes.keys()].map(s=>s.length*9),...spec.messages.map(m=>(m.id.length+9)*9));
 const eventGap=Math.max(requestedGap,labelWidth+24),left=Math.max(100,54+Math.max(...spec.processes.map(p=>p.label.length))*9);
 const width=Math.max(700,left+Math.max(...Object.values(g.ranks))*eventGap+Math.max(80,labelWidth/2+24),Math.max(...views.map(v=>v.label.length))*9+48),panelHeight=178+rowGap*(spec.processes.length-1),height=panelHeight*views.length+64;
 const x=id=>left+g.ranks[id]*eventGap,y=i=>100+i*rowGap;
 const out=[`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Confronto di tagli sugli stessi eventi" style="background:${p.paper};font-family:'IBM Plex Mono';font-size:14px">`,
 '<title>Tagli consistenti: stessi eventi, prefissi diversi</title>',`<metadata id="cut-font-license">${esc(font.license)}</metadata><style data-embedded-font="${font.sha256}">${font.css}</style>`,
 `<defs><marker id="cut-message-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z" fill="${p.cobalt}"/></marker></defs>`];
 function text(x,y,s,color=p.ink,anchor='start'){out.push(`<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${color}" font-size="14">${esc(s)}</text>`)}
 views.forEach((view,vi)=>{const r=analyze(spec,view.prefixes),included=new Set(r.included),offset=vi*panelHeight,color=r.consistent?p.cobalt:p.accent;
  out.push(`<g data-cut="${view.id}" data-consistent="${r.consistent}" transform="translate(0 ${offset})">`);text(24,28,view.label,color);
  const positions=Object.create(null);spec.processes.forEach((proc,i)=>{text(24,y(i)+5,proc.label,p.cobalt);out.push(`<path d="M${left-24} ${y(i)}H${width-30}" stroke="${p.rule}" fill="none"/>`);proc.events.forEach(id=>positions[id]=[x(id),y(i)])});
  for(const m of spec.messages){const [sx,sy]=positions[m.send],[tx,ty]=positions[m.receive],dx=tx-sx,dy=ty-sy,len=Math.hypot(dx,dy);out.push(`<path data-message="${m.id}" data-from="${m.send}" data-to="${m.receive}" d="M${sx+6*dx/len} ${sy+6*dy/len}L${tx-6*dx/len} ${ty-6*dy/len}" fill="none" stroke="${p.cobalt}" stroke-width="1.5" marker-end="url(#cut-message-arrow)"/>`);text((sx+tx)/2+32,(sy+ty)/2-8,m.id,p.cobalt)}
  spec.processes.forEach((proc,i)=>proc.events.forEach(id=>{const [cx,cy]=positions[id];out.push(`<circle data-event="${id}" data-included="${included.has(id)}" cx="${cx}" cy="${cy}" r="6" fill="${included.has(id)?p.cobalt:p.paper}" stroke="${p.cobalt}" stroke-width="1.5"/>`);text(cx,cy-18,id,p.ink,'middle');const m=spec.messages.find(m=>m.send===id||m.receive===id);if(m){const sending=m.send===id,other=positions[sending?m.receive:m.send];text(cx,cy+(other[1]>cy?-38:25),(sending?'send(':'receive(')+m.id+')',p.ink,'middle')}}));
  const bounds=spec.processes.map((proc,i)=>{const k=view.prefixes[i];return k===0?x(proc.events[0])-32:k===proc.events.length?x(proc.events.at(-1))+32:(x(proc.events[k-1])+x(proc.events[k]))/2});
  const points=[[bounds[0],50],[bounds[0],y(0)]];for(let i=1;i<bounds.length;i++){const bend=y(i-1)+42;points.push([bounds[i-1],bend],[bounds[i],bend],[bounds[i],y(i)])}points.push([bounds.at(-1),y(bounds.length-1)+43]);
  out.push(`<path data-cut-line="${view.id}" d="M${points.map(v=>v.join(' ')).join('L')}" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="6 5"/>`);
  out.push('</g>');if(vi<views.length-1)out.push(`<path d="M24 ${(vi+1)*panelHeight}H${width-24}" stroke="${p.rule}"/>`);
 });
 text(24,height-37,'Punti pieni: inclusi · punti vuoti: esclusi');text(24,height-17,'Tratteggio: confine del prefisso · tempo schematico →');out.push('</svg>');return {svg:out.join('\n')+'\n',width,height,panels:views.map(v=>({id:v.id,...analyze(spec,v.prefixes)}))};
}
const root=path.resolve(__dirname,'../..'),file=path.join(root,'pcd/cap-16-algoritmi-distribuiti.html'),asset=path.join(root,'pcd/assets/diagrams/pcd-consistent-cuts.svg');
function figure(r){return `<!-- BEGIN CUT COMPARISON -->
<figure data-static-plot="pcd-consistent-cuts" style="max-width:100%;margin:1.6rem 0">
<p class="small">Su schermi stretti, scorri la tavola orizzontalmente per confrontare gli stessi eventi nei tre pannelli.</p>
<div role="region" tabindex="0" aria-label="Confronto dei tagli, scorribile orizzontalmente" style="max-width:100%;overflow-x:auto;background:${p.paper};border:1px solid ${p.rule};padding:12px;box-sizing:border-box">
<img src="assets/diagrams/pcd-consistent-cuts.svg" width="${r.width}" height="${r.height}" alt="G1 include e5 senza e2; G2 include e2 senza e5; G3 include entrambi" style="display:block;width:${r.width}px;max-width:none;height:auto;margin:auto">
</div>
<figcaption>Stessi eventi e stessa freccia m nei tre pannelli. G1 = {e1,e4,e5} è inconsistente: manca l'invio e2. G2 = {e1,e2,e4} è consistente con m nel canale. G3 = {e1,e2,e4,e5} è consistente con m già ricevuto e canale vuoto. Le distanze sono schematiche, non tempi fisici; il tratteggio seleziona prefissi e non è un messaggio.</figcaption>
</figure>
<!-- END CUT COMPARISON -->`}
if(require.main===module){const r=render(demo,cases),old=fs.readFileSync(file,'utf8'),m=old.match(/<!-- BEGIN CUT COMPARISON -->[\s\S]*?<!-- END CUT COMPARISON -->/);assert(m,'Missing comparison markers');if(process.argv.includes('--check')){assert.equal(fs.readFileSync(asset,'utf8'),r.svg);assert.equal(m[0],figure(r));console.log('Three cut panels and chapter markup match the model')}else{fs.mkdirSync(path.dirname(asset),{recursive:true});fs.writeFileSync(asset,r.svg);fs.writeFileSync(path.join(root,'review/legacy-diagrams/pcd-consistent-cuts.svg'),r.svg);process.stdout.write('*** Begin Patch\n*** Update File: '+file+'\n@@\n'+m[0].split('\n').map(s=>'-'+s).join('\n')+'\n'+figure(r).split('\n').map(s=>'+'+s).join('\n')+'\n*** End Patch\n')}}
module.exports={render,figure};
