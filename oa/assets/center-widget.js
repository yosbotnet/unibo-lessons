(function(){
  'use strict';
  const m=globalThis.NotesCenter,input=document.getElementById('sk-skew');if(!m||!input)return;
  function draw(){const r=m.synthetic(Number(input.value));document.getElementById('sk-skew-v').textContent=r.a.toFixed(2);document.getElementById('sk-out').textContent=m.summary(r);document.querySelector('[data-center-plot]').innerHTML=m.svg(r);document.querySelector('[data-center-rows]').innerHTML=m.table(r);}
  input.addEventListener('input',draw);draw();input.disabled=false;
})();
