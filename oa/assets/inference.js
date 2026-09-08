(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./frequency.js'),require('./boxplot.js'));else root.NotesInference=factory(root.NotesFrequency,root.NotesBox);})(typeof globalThis!=='undefined'?globalThis:this,function(frequency,box){
  'use strict';
  // Deliberately scoped to this widget, not a general statistical library.
  // Normal central integral by its convergent power series on 0 <= z <= 4.
  function normalCdf(z){
    if(!Number.isFinite(z)||Math.abs(z)>4)throw Error('Expected z in [-4,4]');
    let term=z,sum=z;
    for(let k=1;k<=100;k++){term*=-z*z/(2*k);const add=term/(2*k+1);sum+=add;if(Math.abs(add)<1e-17)return .5+sum/Math.sqrt(2*Math.PI);}
    throw Error('Normal integral did not converge');
  }
  // With theta=atan(t/sqrt(df)), integrate cos(theta)^(df-1).
  // I_m = sin(theta)*cos(theta)^(m-1)/m + (m-1)*I_(m-2)/m.
  function studentCdf(t,df){
    if(!Number.isFinite(t)||Math.abs(t)>20||!Number.isInteger(df)||df<4||df>199)throw Error('Expected |t| <= 20 and integer df 4..199');
    const theta=Math.atan(t/Math.sqrt(df)),sin=Math.sin(theta),cos=Math.cos(theta);
    let integral=df%2?theta:sin,coefficient=df%2?1/Math.PI:.5;
    if(df%2){for(let j=1;j<=(df-1)/2;j++)coefficient*=j/(j-.5);}else{for(let j=1;j<df/2;j++)coefficient*=(j+.5)/j;}
    for(let m=df%2?2:3;m<=df-1;m+=2)integral=sin*Math.pow(cos,m-1)/m+(m-1)/m*integral;
    return .5+coefficient*integral;
  }
  function critical(level,df=null){
    if(!Number.isInteger(level)||level<800||level>999)throw Error('Expected confidence level in tenths of a percent, 800..999');
    const target=(1+level/1000)/2,cdf=df===null?normalCdf:t=>studentCdf(t,df);
    let lo=0,hi=df===null?4:20;
    if(cdf(hi)<target)throw Error('Critical value not bracketed');
    for(let i=0;i<52;i++){const mid=(lo+hi)/2;if(cdf(mid)<target)lo=mid;else hi=mid;}
    return (lo+hi)/2;
  }
  const source=box.summarize(frequency.data),center=source.mean,sd=Math.sqrt(frequency.data.reduce((s,v)=>s+(v-center)**2,0)/(frequency.data.length-1));
  const fmt=v=>v.toFixed(2),escape=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  function calculate(n=31,level=950){
    if(!Number.isInteger(n)||n<5||n>200)throw Error('Expected n 5..200');
    const z=critical(level),t=critical(level,n-1),se=sd/Math.sqrt(n),predictionScale=sd*Math.sqrt(1+1/n);
    const rows=[{id:'z',name:'Mean CI · known σ scenario',formula:'z × σ/√n',critical:z,scale:se},{id:'t',name:'Mean CI · estimated s scenario',formula:'t × s/√n',critical:t,scale:se},{id:'prediction',name:'One future value · estimated s',formula:'t × s√(1+1/n)',critical:t,scale:predictionScale}].map(r=>({...r,half:r.critical*r.scale,lo:center-r.critical*r.scale,hi:center+r.critical*r.scale}));
    return {n,level,z,t,se,center,sd,rows,axisHalf:Math.ceil(rows[2].half/1000)*1000};
  }
  function summary(r){return `Hypothetical fixed summaries: center ${fmt(center)}, spread ${fmt(sd)}, n = ${r.n}; level ${(r.level/10).toFixed(1)}%. z = ${r.z.toFixed(6)}; t(${r.n-1}) = ${r.t.toFixed(6)}. Changing n does not add traffic observations or validate independent normal sampling.`;}
  function table(r){return `<table data-inference-values><caption>Conditional formulas evaluated at the fixed hypothetical summaries</caption><thead><tr><th scope="col">Target / assumption</th><th scope="col">Critical value</th><th scope="col">Half-width</th><th scope="col">Lower</th><th scope="col">Upper</th></tr></thead><tbody>${r.rows.map(row=>`<tr data-inference-row="${row.id}"><th scope="row">${row.name}<br><code>${row.formula}</code></th><td>${row.critical.toFixed(6)}</td><td>${fmt(row.half)}</td><td>${fmt(row.lo)}</td><td>${fmt(row.hi)}</td></tr>`).join('')}</tbody></table>`;}
  const x=(v,r)=>350+(v-r.center)/r.axisHalf*290;
  function svg(r){return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 388" style="width:700px" role="img" aria-labelledby="oa-inference-width-title" font-family="var(--lk-mono)" font-size="14" fill="var(--lk-ink)" data-generated-plot="oa-inference-width"><title id="oa-inference-width-title">Hypothetical interval widths at n ${r.n} and level ${r.level/10} percent. Fixed center ${fmt(center)} and spread ${fmt(sd)}. z mean CI, t mean CI and t prediction interval differ. Numeric axis changes to include every endpoint.</title><rect width="700" height="388" fill="var(--lk-paper)"/><text x="24" y="26">Hypothetical widths · fixed center and spread</text><path d="M350 58V289" stroke="var(--lk-ink-soft)" stroke-dasharray="3 4"/>${r.rows.map((row,i)=>{const y=99+80*i,color=i===2?'var(--lk-vermilion)':'var(--lk-cobalt)';return `<text x="24" y="${y-28}" fill="${color}">${escape(row.name)}</text><path data-inference-interval="${row.id}" d="M${x(row.lo,r)} ${y-6}V${y+6}M${x(row.lo,r)} ${y}H${x(row.hi,r)}M${x(row.hi,r)} ${y-6}V${y+6}" fill="none" stroke="${color}" stroke-width="2"/><circle cx="350" cy="${y}" r="4" fill="${color}"/>`;}).join('')}<path d="M60 300H640" stroke="var(--lk-ink)"/>${[-1,-.5,0,.5,1].map(k=>{const value=center+k*r.axisHalf,px=x(value,r);return `<path d="M${px} 300v6" stroke="var(--lk-ink)"/><text x="${px}" y="330" text-anchor="middle">${fmt(value)}</text>`;}).join('')}<text x="350" y="366" text-anchor="middle">Value · axis range changes · exact endpoints in table</text></svg>`;}
  return {normalCdf,studentCdf,critical,source,center,sd,calculate,summary,table,svg,x};
});
