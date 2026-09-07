(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./fgsm-model.js'):root.NotesFGSM);if(typeof module==='object'&&module.exports)module.exports=api;else root.NotesFGSMView=api;})(typeof globalThis!=='undefined'?globalThis:this,function(m){
 'use strict';
 const width=332,height=426,frame={x:44,y:66,size:260};
 const palette={paper:'#F3EFE3',panel:'#FAF7EF',blue:'#1546B8',red:'#B83D2D',ink:'#171813',rule:'#C9C3B6'};
 const px=u=>frame.x+u*frame.size,py=v=>frame.y+(1-v)*frame.size;
 const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
 function render(p,epsilon,show,font){m.point(p);const a=m.attack(p,epsilon),c=palette,t=(x,y,s,anchor='start')=>`<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${c.ink}">${esc(s)}</text>`;
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="332" height="426" viewBox="0 0 332 426" role="img" data-fgsm-plot="true" style="background:${c.paper};font-family:'IBM Plex Mono',monospace;font-size:14px"><title>FGSM on an explicit two-coordinate classifier</title><metadata>${esc(font.license)}</metadata><style data-embedded-font="${font.sha256}">${font.css}</style><defs><marker id="fgsm-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6Z" fill="${c.red}"/></marker></defs>`;
  svg+=t(16,25,'Toy classifier · L∞ FGSM')+t(16,48,'B above curve; A below');
  svg+=`<rect x="44" y="66" width="260" height="260" fill="${c.panel}" stroke="${c.rule}"/>`;
  svg+=`<path d="M44 66H304V${py(.55)}Q${px(.5)} ${py(.15)} 44 ${py(.55)}Z" fill="${c.blue}" fill-opacity=".07"/>`;
  for(const n of [0,.5,1]){svg+=`<path d="M${px(n)} 66V326M44 ${py(n)}H304" fill="none" stroke="${c.rule}" stroke-width="1"/>`+t(px(n),350,String(n),'middle')+t(34,py(n)+5,String(n),'end');}
  svg+=t(175,373,'u','middle')+t(16,104,'v');
  svg+=`<path data-boundary="true" d="M44 ${py(.55)}Q${px(.5)} ${py(.15)} 304 ${py(.55)}" fill="none" stroke="${c.blue}" stroke-width="2"/>`;
  const lo={u:Math.max(0,p.u-epsilon),v:Math.max(0,p.v-epsilon)},hi={u:Math.min(1,p.u+epsilon),v:Math.min(1,p.v+epsilon)};
  svg+=`<rect data-budget="true" x="${px(lo.u)}" y="${py(hi.v)}" width="${(hi.u-lo.u)*260}" height="${(hi.v-lo.v)*260}" fill="none" stroke="${c.red}" stroke-dasharray="4 3"/>`;
  if(show){const dx=px(a.q.u)-px(p.u),dy=py(a.q.v)-py(p.v),len=Math.hypot(dx,dy);
   if(len>18)svg+=`<path data-step="true" d="M${px(p.u)+7*dx/len} ${py(p.v)+7*dy/len}L${px(a.q.u)-8*dx/len} ${py(a.q.v)-8*dy/len}" stroke="${c.red}" stroke-width="1.5" marker-end="url(#fgsm-arrow)"/>`;
   else if(len>0)svg+=`<path data-step="true" d="M${px(p.u)} ${py(p.v)}L${px(a.q.u)} ${py(a.q.v)}" stroke="${c.red}" stroke-width="1.5"/>`;
   svg+=`<rect data-candidate="true" x="${px(a.q.u)-6}" y="${py(a.q.v)-6}" width="12" height="12" fill="none" stroke="${c.red}" stroke-width="2"/>`;
  }
  svg+=`<circle data-clean="true" cx="${px(p.u)}" cy="${py(p.v)}" r="4.5" fill="${c.blue}"/>`;
  svg+=`<circle cx="22" cy="395" r="4.5" fill="${c.blue}"/>`+t(34,400,'P: clean')+`<rect x="171" y="389" width="12" height="12" fill="none" stroke="${c.red}" stroke-width="2"/>`+t(192,400,'Q: candidate');
  return svg+'</svg>\n';
 }
 return {render,width,height,frame,px,py,palette};
});
