// Amdahl's law calculator: speedup, efficiency, asymptotic limit and the processors needed
// to get close to the limit. Pure functions are exported for node tests; mount() builds the UI.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.Amdahl=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function check(P,N){
  if(!(typeof P==='number'&&P>=0&&P<=1))throw new RangeError('P deve stare in [0,1]');
  if(N!==undefined&&!(typeof N==='number'&&N>=1))throw new RangeError('N deve essere >= 1');
 }
 // S = 1 / ((1-P) + P/N)
 function speedup(P,N){check(P,N);return 1/((1-P)+P/N)}
 // E = S / N
 function efficiency(P,N){return speedup(P,N)/N}
 // lim N->inf S = 1/(1-P); infinite when everything is parallel
 function limit(P){check(P);return P===1?Infinity:1/(1-P)}
 // smallest N with S >= frac * limit(P): from (1-P)+P/N <= (1-P)/frac  =>  N >= frac*P / ((1-frac)*(1-P))
 function processorsFor(P,frac){
  check(P);if(!(frac>0&&frac<1))throw new RangeError('frac in (0,1)');
  if(P===1)return Infinity;if(P===0)return 1;
  return Math.max(1,Math.ceil(frac*P/((1-frac)*(1-P))-1e-9));
 }
 function fmt(x,d){if(x===Infinity)return '∞';return x.toLocaleString('it-IT',{maximumFractionDigits:d,minimumFractionDigits:d})}
 function mount(sel,opts={}){
  const host=typeof document!=='undefined'&&document.querySelector(sel);if(!host)return;
  let P=opts.P??0.9,k=opts.log2N??4;
  host.classList.add('amd');
  host.innerHTML=
   '<div class="amd-row"><label>Parte parallelizzabile <var>P</var> = <output data-o="p"></output>'+
   '<input type="range" min="0" max="1" step="0.01" data-i="p"></label></div>'+
   '<div class="amd-row"><label>Processori <var>N</var> = <output data-o="n"></output>'+
   '<input type="range" min="0" max="16" step="1" data-i="n"></label></div>'+
   '<div class="amd-presets"><span>Casi limite:</span>'+
   '<button type="button" data-p="0">P = 0</button><button type="button" data-p="1">P = 1</button>'+
   '<button type="button" data-p="0.5">P = 0,5</button><button type="button" data-p="0.95">P = 0,95</button></div>'+
   '<table class="amd-out"><tbody>'+
   '<tr><th>Speedup <var>S</var></th><td data-o="s"></td></tr>'+
   '<tr><th>Efficienza <var>E</var> = <var>S</var>/<var>N</var></th><td data-o="e"></td></tr>'+
   '<tr><th>Limite con infiniti processori, 1/(1−<var>P</var>)</th><td data-o="l"></td></tr>'+
   '<tr><th>Processori per arrivare al 90% del limite</th><td data-o="n90"></td></tr>'+
   '</tbody></table><p class="amd-note" data-o="note"></p>';
  const q=s=>host.querySelector(s),ip=q('[data-i="p"]'),inN=q('[data-i="n"]');
  function render(){
   const N=2**k,S=speedup(P,N);
   ip.value=P;inN.value=k;
   q('[data-o="p"]').textContent=fmt(P,2);
   q('[data-o="n"]').textContent=N.toLocaleString('it-IT');
   q('[data-o="s"]').textContent=fmt(S,2);
   q('[data-o="e"]').textContent=fmt(efficiency(P,N),3);
   q('[data-o="l"]').textContent=fmt(limit(P),2);
   const n90=processorsFor(P,0.9);
   q('[data-o="n90"]').textContent=n90===Infinity?'nessun limite: S cresce come N':n90.toLocaleString('it-IT');
   q('[data-o="note"]').textContent=
    P===0?'Nulla è parallelizzabile: S = 1 con qualsiasi N.':
    P===1?'Tutto è parallelizzabile: S = N, speedup lineare (efficienza 1).':
    S>=0.9*limit(P)?'Siamo già vicini al limite: altri processori abbassano solo l’efficienza.':
    'Lo speedup cresce ancora con N, ma resta sotto '+fmt(limit(P),2)+'.';
  }
  ip.addEventListener('input',()=>{P=Number(ip.value);render()});
  inN.addEventListener('input',()=>{k=Number(inN.value);render()});
  host.querySelectorAll('[data-p]').forEach(b=>b.addEventListener('click',()=>{P=Number(b.dataset.p);render()}));
  render();
 }
 return {speedup,efficiency,limit,processorsFor,mount};
});
