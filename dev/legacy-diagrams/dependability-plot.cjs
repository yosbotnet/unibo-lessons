// Quantitative curves use the exact same model as the teaching calculator.
const fs=require('node:fs'),path=require('node:path');
const model=require('../../ds/assets/dependability.js'),font=require('./font.cjs'),{palette:p}=require('./render.cjs');
const root=path.resolve(__dirname,'../..'),id='ds-reliability-comparison';
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function render(){
 const width=700,height=410,x=t=>72+t/5*570,y=r=>336-r*228;
 const s=[`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Equal availability, different reliability" style="background:${p.paper};font-family:${p.mono};font-size:14px" data-generated-plot="${id}">`,
 `<title>Equal long-run availability does not imply equal reliability</title><metadata>${esc(font.license)}</metadata><style data-embedded-font="${font.sha256}">${font.css}</style>`];
 const text=(xx,yy,t,anchor='start',color=p.ink)=>s.push(`<text x="${xx}" y="${yy}" text-anchor="${anchor}" fill="${color}">${esc(t)}</text>`);
 for(let i=0;i<=4;i++){const v=i/4;s.push(`<path d="M72 ${y(v)}H642" fill="none" stroke="${p.rule}" stroke-width="1"/>`);text(60,y(v)+5,`${i*25}%`,'end')}
 for(let i=0;i<=5;i++){s.push(`<path d="M${x(i)} 336v6" fill="none" stroke="${p.ink}"/>`);text(x(i),364,String(i),'middle')}
 s.push(`<path d="M72 108V336H642" fill="none" stroke="${p.ink}" stroke-width="1.5"/>`);text(72,93,'R(t)');text(357,395,'Uninterrupted operating time (hours)','middle');
 model.comparison.forEach((c,i)=>{
  const color=i?p.cobalt:p.accent,yy=30+i*27;
  s.push(`<path d="M72 ${yy-5}H100" stroke="${color}" stroke-width="2"/>`);text(112,yy,`MTTF = ${c.mttf} h; MTTR ≈ ${c.mttr.toPrecision(3)} h`);
  const points=Array.from({length:201},(_,i)=>{const t=i/40;return [x(t),y(model.reliability(c.mttf,t))]});
  s.push(`<path data-series="${c.id}" data-mttf="${c.mttf}" data-mttr="${c.mttr}" data-samples="201" d="M${points.map(pt=>pt.map(v=>v.toFixed(3)).join(' ')).join('L')}" fill="none" stroke="${color}" stroke-width="2"/>`);
 });s.push('</svg>');return s.join('\n')+'\n';
}
function figure(){const [a,b]=model.comparison;return `<!-- BEGIN DEPENDABILITY COMPARISON -->
<figure data-static-plot="${id}" style="margin:1.6rem 0;max-width:100%">
<div role="region" tabindex="0" aria-label="Reliability plot, scroll horizontally if needed" style="overflow-x:auto;max-width:100%;background:${p.paper};border:1px solid ${p.rule};padding:12px;box-sizing:border-box">
<img src="assets/diagrams/${id}.svg" width="700" height="410" alt="Both examples have 99% long-run availability, but the system with longer mean uptime has much higher reliability over five hours." style="display:block;width:700px;max-width:none;height:auto;margin:auto">
</div>
<figcaption>Two synthetic exponential-lifetime models, both with 99% long-run availability. The vermilion example has MTTF = 1 h and MTTR = 1/99 h; the cobalt example scales both durations by 100. After five uninterrupted hours, reliability is ${(model.reliability(a.mttf,5)*100).toFixed(2)}% versus ${(model.reliability(b.mttf,5)*100).toFixed(2)}%. Repair time affects availability but does not undo a failure in the reliability calculation. Scrolling preserves the graph's native text size on small screens.</figcaption>
</figure>
<!-- END DEPENDABILITY COMPARISON -->`}
if(require.main===module){
 const asset=path.join(root,'ds/assets/diagrams',id+'.svg'),file=path.join(root,'ds/DS-M1.html'),source=fs.readFileSync(file,'utf8'),old=source.match(/<!-- BEGIN DEPENDABILITY COMPARISON -->[\s\S]*?<!-- END DEPENDABILITY COMPARISON -->/)[0],next=figure(),svg=render();
 if(process.argv.includes('--check')){const ok=old===next&&fs.existsSync(asset)&&fs.readFileSync(asset,'utf8')===svg;console.log(ok?'Dependability plot and chapter in sync':'Dependability plot drift');if(!ok)process.exitCode=1}
 else{fs.writeFileSync(asset,svg);if(old!==next)process.stdout.write(`*** Begin Patch\n*** Update File: ${file}\n@@\n`+old.split('\n').map(l=>'-'+l).join('\n')+'\n'+next.split('\n').map(l=>'+'+l).join('\n')+'\n*** End Patch\n')}
}
module.exports={render,figure};
