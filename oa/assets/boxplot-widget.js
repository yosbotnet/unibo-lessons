(function(){
  'use strict';
  const m=globalThis.NotesBox,input=document.getElementById('bx-val');if(!m||!input)return;
  function draw(){const r=m.traffic(Number(input.value));document.getElementById('bx-val-v').textContent=input.value;document.getElementById('bx-out').textContent=m.summary(r);document.querySelector('[data-box-plot]').innerHTML=m.svg(r);document.querySelector('[data-box-rows]').innerHTML=m.table(r);}
  input.addEventListener('input',draw);draw();input.disabled=false;
})();
