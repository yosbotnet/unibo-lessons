(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.NotesCoin=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const alternatives=['two-sided','greater','less'];
 const labels={'two-sided':'Two-sided: θ ≠ 0.5',greater:'Upper tail: θ > 0.5',less:'Lower tail: θ < 0.5'};
 const escape=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 function weights(n){if(!Number.isInteger(n)||n<1||n>20)throw Error('Expected 1–20 independent flips');const a=[1];for(let j=1;j<=n;j++)a.push(Math.round(a[j-1]*(n-j+1)/j));return a;}
 function evaluate(k,alternative='two-sided',n=10){
  const w=weights(n);if(!Number.isInteger(k)||k<0||k>n||!alternatives.includes(alternative))throw Error('Invalid count or alternative');
  const included=w.map((v,j)=>alternative==='greater'?j>=k:alternative==='less'?j<=k:v<=w[k]);
  const numerator=w.reduce((s,v,j)=>s+(included[j]?v:0),0),denominator=2**n;
  return {n,k,alternative,weights:w,included,numerator,denominator,point:w[k],pvalue:numerator/denominator,reject:numerator*20<=denominator};
 }
 function region(alternative='two-sided',n=10){return weights(n).map((_,j)=>j).filter(j=>evaluate(j,alternative,n).reject);}
 function rates(){const rejected=region(),w=weights(10),wrong=w.map((v,j)=>({v,j})).filter(x=>x.v*20<=1024);
  return {rejected,sizeNumerator:rejected.reduce((s,j)=>s+w[j],0),sizeDenominator:1024,wrongNumerator:wrong.reduce((s,x)=>s+x.v,0),powerNumerator:rejected.reduce((s,j)=>s+w[j]*3**j,0),powerDenominator:4**10};
 }
 function summary(r){return `${labels[r.alternative]}. P(K = ${r.k}) = ${r.point}/${r.denominator} = ${(r.point/r.denominator).toFixed(6)}. p-value = ${r.numerator}/${r.denominator} = ${r.pvalue.toFixed(6)} (${(100*r.pvalue).toFixed(4)}%). At α = 0.05: ${r.reject?'reject H₀':'do not reject H₀'}.`;}
 function table(alternative){return `<table data-coin-table><caption>Exact probabilities and test decisions — ${escape(labels[alternative])}</caption><thead><tr><th scope="col">Heads <span class="coin-math">j</span></th><th scope="col"><span class="coin-math">P(K = j)</span></th><th scope="col">p-value</th><th scope="col">At <span class="coin-math">α = 0.05</span></th></tr></thead><tbody>${weights(10).map((_,j)=>{const r=evaluate(j,alternative);return `<tr data-coin-row="${j}"><th scope="row">${j}</th><td>${(r.point/r.denominator).toFixed(6)}</td><td>${r.pvalue.toFixed(6)}</td><td>${r.reject?'Reject H₀':'Do not reject H₀'}</td></tr>`;}).join('')}</tbody></table>`;}
 function svg(r){if(r.n!==10)throw Error('This course plot uses ten flips');const left=56,right=660,top=60,bottom=278,slot=(right-left)/11,bw=slot*.66,y=p=>bottom-p/.25*(bottom-top);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 350" style="width:700px" role="img" aria-labelledby="oa-coin-title" font-family="var(--lk-mono)" font-size="14" data-generated-plot="oa-coin-exact"><title id="oa-coin-title">Exact fair-coin distribution for ten independent flips. Observed ${r.k} heads. ${escape(labels[r.alternative])}. Red bars contribute to the p-value ${r.pvalue}.</title><rect width="700" height="350" fill="var(--lk-paper)"/>
<text x="16" y="24" fill="var(--lk-ink)">Probability mass (%)</text><text x="680" y="24" text-anchor="end" fill="var(--lk-vermilion)">Red sum: p = ${r.pvalue.toFixed(6)}</text>
${[0,.125,.25].map(p=>`<path d="M${left} ${y(p)}H${right}" stroke="var(--lk-rule-soft)"/><text x="45" y="${y(p)+5}" text-anchor="end" fill="var(--lk-ink)">${p*100}</text>`).join('')}
${r.weights.map((v,j)=>{const x=left+j*slot+(slot-bw)/2,height=bottom-y(v/1024);return `<rect data-coin-bar="${j}" data-in-pvalue="${r.included[j]}" x="${x}" y="${bottom-height}" width="${bw}" height="${height}" fill="var(--lk-${r.included[j]?'vermilion':'cobalt'})" fill-opacity=".55" stroke="var(--lk-${j===r.k?'ink':r.included[j]?'vermilion':'cobalt'})" stroke-width="${j===r.k?3:1}"/><text x="${left+(j+.5)*slot}" y="302" text-anchor="middle" fill="var(--lk-ink)">${j}</text>`;}).join('')}
<path d="M${left} ${top}V${bottom}H${right}" fill="none" stroke="var(--lk-ink)"/><text x="350" y="334" text-anchor="middle" fill="var(--lk-ink)">Heads K · H₀: θ = 0.5 · observed K outlined in ink</text></svg>`;
 }
 return {alternatives,labels,weights,evaluate,region,rates,summary,table,svg,escape};
});
