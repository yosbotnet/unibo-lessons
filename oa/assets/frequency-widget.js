(function(){
  'use strict';
  const host=document.getElementById('w-hist'),model=globalThis.NotesFrequency;if(!host||!model)return;
  const bins=host.querySelector('#hs-bins'),mode=host.querySelector('#hs-mode');
  function draw(){const r=model.example(Number(bins.value),mode.value);
    host.querySelector('#hs-bins-v').textContent=bins.value;
    host.querySelector('[data-frequency-plot]').innerHTML=model.svg(r);
    host.querySelector('[data-frequency-rows]').innerHTML=model.table(r);
    host.querySelector('#hs-out').textContent=model.summary(r);
  }
  bins.addEventListener('input',draw);mode.addEventListener('change',draw);
  draw();bins.disabled=false;mode.disabled=false;
})();
