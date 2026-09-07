const model=require('../../cybersecurity/assets/feature-model.cjs'),font=require('./font.cjs'),{palette:p}=require('./render.cjs');
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function render(options){const m=model.evaluate(options),scale=100,uMax=1+m.epsilon+.3,vMax=Math.max(.6,m.eta+m.epsilon+.1),plotW=2*uMax*scale,plotH=2*vMax*scale,panelW=Math.max(380,plotW+80),width=2*panelW,height=plotH+200;
 const frame={x:48,y:86,w:plotW,h:plotH},px=u=>frame.x+(u+uMax)*scale,py=v=>frame.y+(vMax-v)*scale,color=y=>y===1?p.cobalt:p.accent;
 const t=(x,y,s,fill=p.ink,anchor='start')=>`<text x="${x}" y="${y}" fill="${fill}" text-anchor="${anchor}">${esc(s)}</text>`;
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" style="background:${p.paper};font-family:'IBM Plex Mono',monospace;font-size:14px"><title>Same data and perturbations, different feature sensitivity</title><metadata>${esc(font.license)}</metadata><style data-embedded-font="${font.sha256}">${font.css}</style><defs><marker id="feature-step-arrow" viewBox="0 0 8 8" refX="8" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L8 4L0 8Z" fill="${p.ink}"/></marker></defs>`;
 svg+=t(16,26,'Same inputs · same perturbations · different classifiers');
 m.features.forEach((f,i)=>{const bottom=frame.y+plotH;svg+=`<g data-feature="${f.kind}" transform="translate(${i*panelW} 0)">`+t(16,61,f.kind==='u'?'Classifier sign(u)':'Classifier sign(v/η)');
 svg+=`<rect x="${frame.x}" y="${frame.y}" width="${plotW}" height="${plotH}" fill="${p.panel}" stroke="${p.rule}"/>`;
 svg+=f.kind==='u'?`<rect x="${px(0)}" y="${frame.y}" width="${plotW/2}" height="${plotH}" fill="${p.cobalt}" fill-opacity=".06"/>`:`<rect x="${frame.x}" y="${frame.y}" width="${plotW}" height="${plotH/2}" fill="${p.cobalt}" fill-opacity=".06"/>`;
 for(const u of [-1,0,1]){svg+=`<path d="M${px(u)} ${frame.y}V${bottom}" stroke="${p.rule}"/>`+t(px(u),bottom+23,u,p.ink,'middle');}
 for(const v of [-.4,0,.4]){svg+=`<path d="M${frame.x} ${py(v)}H${frame.x+plotW}" stroke="${p.rule}"/>`+t(39,py(v)+5,v,p.ink,'end');}
 svg+=t(frame.x+plotW/2,bottom+45,'u',p.ink,'middle')+t(16,frame.y,'v');
 svg+=`<path data-decision-boundary="${f.kind}" d="${f.kind==='u'?`M${px(0)} ${frame.y}V${bottom}`:`M${frame.x} ${py(0)}H${frame.x+plotW}`}" fill="none" stroke="${p.cobalt}" stroke-width="2"/>`;
 m.records.forEach((r,j)=>{const cx=px(r.p.u),cy=py(r.p.v),qx=px(r.q.u),qy=py(r.q.v),dx=qx-cx,dy=qy-cy,len=Math.hypot(dx,dy);
 svg+=`<rect data-budget="${r.y}" x="${cx-m.epsilon*scale}" y="${cy-m.epsilon*scale}" width="${2*m.epsilon*scale}" height="${2*m.epsilon*scale}" fill="none" stroke="${p.rule}" stroke-dasharray="4 3"/>`;
 if(len>18){const end=6*len/Math.max(Math.abs(dx),Math.abs(dy));svg+=`<path data-step="${r.y}" d="M${cx+5*dx/len} ${cy+5*dy/len}L${qx-end*dx/len} ${qy-end*dy/len}" fill="none" stroke="${p.ink}" stroke-width="1.3" marker-end="url(#feature-step-arrow)"/>`;}
 else if(len>0)svg+=`<path data-step="${r.y}" d="M${cx} ${cy}L${qx} ${qy}" fill="none" stroke="${p.ink}" stroke-width="1.3"/>`;
 svg+=`<rect data-candidate="${r.y}" data-prediction="${f.candidatePredictions[j]}" x="${qx-5}" y="${qy-5}" width="10" height="10" fill="none" stroke="${color(f.candidatePredictions[j])}" stroke-width="2"/><circle data-clean="${r.y}" data-prediction="${f.cleanPredictions[j]}" cx="${cx}" cy="${cy}" r="3.5" fill="${color(f.cleanPredictions[j])}"/>`;
 });
 const correct=f.candidatePredictions.filter((y,j)=>y===m.records[j].y).length;
 svg+=t(16,bottom+70,`Candidate correct: ${correct}/2`,correct===2?p.cobalt:p.accent)+'</g>';
 });
 svg+=t(16,height-24,'Circle: clean · square: candidate · blue: +1 · vermilion: −1');return {svg:svg+'</svg>\n',width,height,frame,panelW,scale,px,py,model:m};
}
module.exports={render};
