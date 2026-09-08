(function(){'use strict';const host=document.getElementById('w-coin'),m=globalThis.NotesCoin;if(!host||!m)return;
 const count=host.querySelector('#cn-k'),alternative=host.querySelector('#cn-alternative');
 function draw(){const r=m.evaluate(Number(count.value),alternative.value);host.querySelector('#cn-k-v').textContent=count.value;host.querySelector('#cn-out').textContent=m.summary(r);host.querySelector('[data-coin-plot]').innerHTML=m.svg(r);host.querySelector('[data-coin-rows]').innerHTML=m.table(r.alternative);}
 count.addEventListener('input',draw);alternative.addEventListener('change',draw);draw();count.disabled=false;alternative.disabled=false;
})();
