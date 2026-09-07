(function(){'use strict';
 const m=window.NotesFGSM,v=window.NotesFGSMView,host=document.querySelector('[data-fgsm-widget]');if(!host||!m||!v)return;
 const image=host.querySelector('img'),fields=host.querySelector('fieldset'),status=host.querySelector('[role=status]');
 let p={u:m.initial.u,v:m.initial.v},epsilon=m.initial.epsilon,shown=false,font;
 const el=id=>host.querySelector('#'+id),name=x=>m.label(x)?'Class B':'Class A',fmt=n=>n.toFixed(4);
 function update(){
  const a=m.attack(p,epsilon);image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(v.render(p,epsilon,shown,font));
  image.alt=shown?`Clean (${fmt(p.u)}, ${fmt(p.v)}), candidate (${fmt(a.q.u)}, ${fmt(a.q.v)}); ${a.flipped?'prediction changed':'prediction unchanged'}.`:`Clean point (${fmt(p.u)}, ${fmt(p.v)}), ${name(p)}; no candidate displayed.`;
  el('aeU').value=p.u;el('aeV').value=p.v;el('aeEpsilon').value=epsilon;el('aeEpsilonVal').textContent=epsilon.toFixed(2);
  el('aeOrigClass').textContent=name(p);el('aeAdvClass').textContent=shown?name(a.q):'—';
  el('aeMetrics').textContent=shown?`P = (${fmt(p.u)}, ${fmt(p.v)}); Q = (${fmt(a.q.u)}, ${fmt(a.q.v)}). δ = (${fmt(a.delta.u)}, ${fmt(a.delta.v)}); ||δ||∞ = ${fmt(a.norm)} ≤ ε = ${fmt(epsilon)}. Loss: ${fmt(a.before)} → ${fmt(a.after)}.`:`P = (${fmt(p.u)}, ${fmt(p.v)}). Reference class: ${name(p)}. ε = ${fmt(epsilon)}.`;
  status.textContent=shown?(a.flipped?'Prediction changed in this toy model.':'Prediction unchanged; the candidate did not flip the reference class.'):'Choose a point and generate one step.';
  host.dataset.state=JSON.stringify({p,epsilon,shown,...(shown?{attack:a}:{})});
 }
 function input(){const u=Number(el('aeU').value),w=Number(el('aeV').value);if(el('aeU').value===''||el('aeV').value===''||!Number.isFinite(u)||!Number.isFinite(w)||u<0||u>1||w<0||w>1){status.textContent='Enter both coordinates between 0 and 1.';return false;}p={u,v:w};shown=false;update();return true;}
 fetch(image.getAttribute('src')).then(r=>{if(!r.ok)throw Error('Static plot unavailable');return r.text();}).then(svg=>{
  const xml=new DOMParser().parseFromString(svg,'image/svg+xml'),style=xml.querySelector('style[data-embedded-font]');if(!style)throw Error('Plot font unavailable');font={css:style.textContent,sha256:style.getAttribute('data-embedded-font'),license:xml.querySelector('metadata').textContent};
  el('aeAttackBtn').addEventListener('click',()=>{if(!input())return;shown=true;update();});el('aeResetBtn').addEventListener('click',()=>{p={u:m.initial.u,v:m.initial.v};epsilon=m.initial.epsilon;shown=false;update();});
  for(const id of ['aeU','aeV'])el(id).addEventListener('change',input);
  el('aeEpsilon').addEventListener('input',()=>{epsilon=Number(el('aeEpsilon').value);update();});
  // Pointer position maps the native plot, not the CSS width of an old canvas.
  image.style.touchAction='none';let dragging=false;
  const move=e=>{const rect=image.getBoundingClientRect(),x=(e.clientX-rect.left)*v.width/rect.width,y=(e.clientY-rect.top)*v.height/rect.height;p={u:Math.max(0,Math.min(1,(x-v.frame.x)/v.frame.size)),v:Math.max(0,Math.min(1,1-(y-v.frame.y)/v.frame.size))};shown=false;update();};
  image.addEventListener('pointerdown',e=>{const r=image.getBoundingClientRect(),x=(e.clientX-r.left)*v.width/r.width,y=(e.clientY-r.top)*v.height/r.height;if(x<v.frame.x||x>v.frame.x+v.frame.size||y<v.frame.y||y>v.frame.y+v.frame.size)return;e.preventDefault();dragging=true;image.setPointerCapture(e.pointerId);move(e);});
  image.addEventListener('pointermove',e=>{if(dragging)move(e);});for(const event of ['pointerup','pointercancel','lostpointercapture'])image.addEventListener(event,()=>{dragging=false;});
  fields.disabled=false;update();
 }).catch(()=>{status.textContent='Interactive controls unavailable. The static worked example below remains readable.';});
})();
