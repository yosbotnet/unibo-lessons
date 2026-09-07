const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const font=require('./font.cjs'),{palette:p}=require('./render.cjs');
const root=path.resolve(__dirname,'../..'),id='pcd-wall-reflection';
const input={width:10,height:10,radius:1,x:8,y:3,vx:5,vy:2,dt:1,drag:0};
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function geometry(){
 const s=input,wall=s.width-s.radius,t=(wall-s.x)/s.vx;
 assert(s.drag===0&&s.vx>0&&t>0&&t<s.dt);
 const afterX=wall-s.vx*(s.dt-t),afterY=s.y+s.vy*s.dt;
 assert(afterX>s.radius&&afterY>s.radius&&afterY<s.height-s.radius);
 return [s.x,s.y,wall,s.y+s.vy*t,afterX,afterY,-s.vx,s.vy];
}
function render(){
 const trace=geometry(),x=v=>32+24*v,y=v=>96+24*v;
 const s=[`<svg xmlns="http://www.w3.org/2000/svg" width="332" height="448" viewBox="0 0 332 448" role="img" data-generated-plot="${id}" data-trace="${esc(JSON.stringify(trace))}" style="background:${p.paper};font-family:${p.mono};font-size:14px">`,
 `<title>Urto elastico sul bordo destro: conserva la distanza residua</title><metadata>${esc(font.license)}</metadata><style data-embedded-font="${font.sha256}">${font.css}</style>`,
 `<defs><marker id="${id}-blue" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7Z" fill="${p.cobalt}"/></marker><marker id="${id}-red" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7Z" fill="${p.accent}"/></marker></defs>`];
 const text=(xx,yy,label,anchor='start')=>s.push(`<text x="${xx}" y="${yy}" fill="${p.ink}" text-anchor="${anchor}">${esc(label)}</text>`);
 text(20,28,'Urto sul bordo destro');text(20,52,'Centro della pallina · k = 0');
 text(x(9)-4,84,'x = 9','end');text(x(10)+4,84,'x = 10');
 s.push(`<rect x="32" y="96" width="240" height="240" fill="none" stroke="${p.rule}" stroke-width="1.5"/>`,
 `<path data-wall="right" d="M${x(input.width)} ${y(0)}V${y(input.height)}" stroke="${p.cobalt}" stroke-width="2"/>`,
 `<path d="M${x(input.width-input.radius)} ${y(0)}V${y(input.height)}" stroke="${p.rule}" stroke-dasharray="4 4"/>`,
 `<circle cx="${x(trace[2])}" cy="${y(trace[3])}" r="24" fill="none" stroke="${p.accent}" stroke-dasharray="3 3"/>`,
 `<path data-leg="before" d="M${x(trace[0])} ${y(trace[1])}L${x(trace[2])} ${y(trace[3])}" fill="none" stroke="${p.cobalt}" stroke-width="1.5" marker-end="url(#${id}-blue)"/>`,
 `<path data-leg="after" d="M${x(trace[2])} ${y(trace[3])}L${x(trace[4])} ${y(trace[5])}" fill="none" stroke="${p.accent}" stroke-width="1.5" marker-end="url(#${id}-red)"/>`);
 for(let i=0;i<3;i++)s.push(`<circle data-position="${'ABC'[i]}" cx="${x(trace[2*i])}" cy="${y(trace[2*i+1])}" r="2.5" fill="${p.ink}"/>`);
 text(x(trace[0])-18,y(trace[1])-18,'A');text(x(10)+12,y(trace[3])+4,'B');text(x(trace[4])-18,y(trace[5])+22,'C');
 text(44,318,'y cresce verso il basso');
 text(20,372,`A (${trace[0]},${trace[1]}) → B (${trace[2]},${trace[3]})`);
 text(20,397,`C (${trace[4]},${trace[5]}): v = (${trace[6]},${trace[7]})`);
 text(20,422,'Solo vₓ cambia segno.');
 return s.join('\n')+'\n</svg>\n';
}
function figure(){return `<!-- BEGIN PHYSICS PLOT -->
<figure data-static-plot="${id}" style="margin:1.6rem 0;max-width:100%">
<div tabindex="0" role="region" aria-label="Rimbalzo: scorrimento orizzontale" style="overflow-x:auto;max-width:100%;background:${p.paper};border:1px solid ${p.rule};padding:12px;box-sizing:border-box">
<img src="assets/diagrams/${id}.svg" width="332" height="448" alt="Da A a B al bordo, poi verso C: il rimbalzo cambia vx da 5 a meno 5, mentre vy rimane 2." style="display:block;width:332px;max-width:none;height:auto;margin:auto">
</div>
<figcaption>Esempio verificato: spazio 10 × 10, raggio 1, nessuno smorzamento. Il centro urta a x = 9 dopo 0,2 s; il cerchio tratteggiato rappresenta la pallina soltanto nell’istante B. Nei successivi 0,8 s prosegue verso C, senza perdere la distanza residua. Le frecce descrivono la traiettoria del centro, non vettori di forza. Un bordo verticale inverte soltanto vₓ; all’angolo possono invertirsi entrambe le componenti.</figcaption>
</figure>
<!-- END PHYSICS PLOT -->`;}
if(require.main===module){
 const file=root+'/pcd/cap-08-java.html',asset=root+'/pcd/assets/diagrams/'+id+'.svg';
 const source=fs.readFileSync(file,'utf8'),matches=source.match(/<!-- BEGIN PHYSICS PLOT -->[\s\S]*?<!-- END PHYSICS PLOT -->/g);assert.equal(matches?.length,1);
 const old=matches[0],next=figure(),svg=render();
 if(process.argv.includes('--check')){assert.equal(old,next);assert.equal(fs.readFileSync(asset,'utf8'),svg);console.log('Physics geometry, SVG and chapter in sync');}
 else{fs.writeFileSync(asset,svg);process.stdout.write('*** Begin Patch\n'+(old!==next?`*** Update File: ${file}\n@@\n`+old.split('\n').map(l=>'-'+l).join('\n')+'\n'+next.split('\n').map(l=>'+'+l).join('\n')+'\n':'')+'*** End Patch\n');}
}
module.exports={input,geometry,render,figure};
