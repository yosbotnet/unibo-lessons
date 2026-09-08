(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./frequency.js'));else root.NotesBox=factory(root.NotesFrequency);})(typeof globalThis!=='undefined'?globalThis:this,function(frequency){
  'use strict';
  const roads=Object.freeze([62,64,68,70,70,74,74,76,76,78,78,80]);
  const pairs=Object.freeze([4,1,3,5,2].map((y,i)=>Object.freeze({id:'ABCDE'[i],x:i+1,y})));
  const fmt=x=>Number(x.toFixed(2)).toString();
  const esc=x=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  function summarize(values,method='linear'){
    if(!Array.isArray(values)||values.length<2||values.length>10000||!Array.from(values).every(x=>Number.isFinite(x)&&Math.abs(x)<=1e6))throw Error('Expected 2–10000 finite observations of magnitude at most 1e6');
    if(!['linear','halves'].includes(method))throw Error('Unknown quartile convention');
    const sorted=[...values].sort((a,b)=>a-b),n=sorted.length;
    const median=a=>a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2;
    const q=p=>{const h=(n-1)*p,j=Math.floor(h);return sorted[j]+(sorted[Math.ceil(h)]-sorted[j])*(h-j);};
    const q1=method==='linear'?q(.25):median(sorted.slice(0,Math.floor(n/2))),q3=method==='linear'?q(.75):median(sorted.slice(Math.ceil(n/2))),med=median(sorted),iqr=q3-q1,lower=q1-1.5*iqr,upper=q3+1.5*iqr;
    const inside=sorted.filter(x=>x>=lower&&x<=upper),outliers=values.map((value,index)=>({value,index})).filter(p=>p.value<lower||p.value>upper);
    return {values:[...values],method,n,q1,median:med,q3,iqr,lower,upper,whiskerLow:inside[0],whiskerHigh:inside.at(-1),outliers,mean:values.reduce((a,b)=>a+b,0)/n,min:sorted[0],max:sorted.at(-1)};
  }
  function traffic(value=5167){
    if(!Number.isInteger(value)||value<3000||value>9500)throw Error('Expected an integer remeasurement from 3000 to 9500');
    const values=[...frequency.data];values[30]=value;
    return {...summarize(values),remeasured:value};
  }
  const metrics=[['q1','Q1'],['median','Median'],['q3','Q3'],['iqr','IQR'],['lower','Lower fence'],['upper','Upper fence'],['whiskerLow','Lower whisker'],['whiskerHigh','Upper whisker'],['mean','Mean']];
  function table(r){return `<table data-box-summary><caption>Recomputed summary · linear-interpolated quartiles</caption><thead><tr><th scope="col">Quantity</th><th scope="col">Vehicles/day</th></tr></thead><tbody>${metrics.map(([key,name])=>`<tr data-box-stat="${key}"><th scope="row">${name}</th><td>${fmt(r[key])}</td></tr>`).join('')}<tr><th scope="row">Flagged observations</th><td>${r.outliers.length?esc(r.outliers.map(p=>`day ${p.index+1}: ${p.value}`).join('; ')):'None'}</td></tr></tbody></table>`;}
  function svg(r,kind='traffic'){
    if(!['traffic','roads'].includes(kind))throw Error('Unknown box-plot display');
    const road=kind==='roads',lo=road?55:2000,hi=road?91:10000,left=60,right=660,x=v=>left+(v-lo)/(hi-lo)*(right-left),ticks=road?[55,60,65,70,75,80,85,90]:[2000,4000,6000,8000,10000];
    if(r.values.length>40||Math.min(r.min,r.lower)<lo||Math.max(r.max,r.upper)>hi)throw Error('Dataset exceeds the reviewed display bounds');
    const id='oa-box-'+kind,seen=new Map();
    const dots=r.values.map((v,i)=>{const count=seen.get(v)||0;seen.set(v,count+1);if(count>3)throw Error('Repeated points exceed the reviewed stacking lanes');return `<circle data-box-point="${i}" cx="${x(v)}" cy="${48+count*10}" r="3.5" fill="${v<r.lower||v>r.upper?'var(--lk-vermilion)':'var(--lk-cobalt)'}"><title>Observation ${i+1}: ${v}</title></circle>`;}).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 308" style="width:700px" role="img" aria-labelledby="${id}-title" font-family="var(--lk-mono)" font-size="14" fill="var(--lk-ink)" data-box-chart="${kind}" data-generated-plot="oa-box-${kind}"><title id="${id}-title">${road?'Twelve rural-road speeds, median-of-halves quartiles; no flagged observations':'Thirty-one August counts with day 31 remeasured as '+r.remeasured+'; linear-interpolated quartiles'}. All positions use one linear horizontal scale. Dashed fences are thresholds, not observations.</title><rect width="700" height="308" fill="var(--lk-paper)"/>
<text x="24" y="24">${r.n} observations · repeated values stacked</text>${dots}
<text x="24" y="92">Box + whiskers</text>
<path data-box-whiskers="" d="M${x(r.whiskerLow)} 113V157M${x(r.whiskerLow)} 135H${x(r.q1)}M${x(r.q3)} 135H${x(r.whiskerHigh)}M${x(r.whiskerHigh)} 113V157" fill="none" stroke="var(--lk-ink)" stroke-width="1.8"/>
<rect data-box-iqr="" x="${x(r.q1)}" y="111" width="${x(r.q3)-x(r.q1)}" height="48" fill="var(--lk-cobalt)" fill-opacity=".14" stroke="var(--lk-cobalt)" stroke-width="1.8"/>
<path data-box-median="" d="M${x(r.median)} 111V159" stroke="var(--lk-vermilion)" stroke-width="2.4"/>
${r.outliers.map(p=>`<circle data-box-flier="${p.index}" cx="${x(p.value)}" cy="135" r="5" fill="var(--lk-vermilion)"><title>Flagged observation ${p.index+1}: ${p.value}</title></circle>`).join('')}
<path data-box-fences="" d="M${x(r.lower)} 102V183M${x(r.upper)} 102V183" fill="none" stroke="var(--lk-vermilion)" stroke-width="1.4" stroke-dasharray="5 4"/>
<path data-box-mean="" d="M${x(r.mean)} 176l5 5-5 5-5-5Z" fill="var(--lk-cobalt)"/><text x="${x(r.mean)+12}" y="186" fill="var(--lk-cobalt)">Mean ${fmt(r.mean)}</text>
<path d="M${left} 210H${right}" stroke="var(--lk-ink)"/>
${ticks.map(v=>`<path d="M${x(v)} 210v5" stroke="var(--lk-ink)"/><text x="${x(v)}" y="236" text-anchor="middle">${v}</text>`).join('')}
<text x="350" y="262" text-anchor="middle">${road?'Speed (km/h)':'Vehicles per day'} · linear scale</text>
<text x="24" y="291" fill="var(--lk-vermilion)">Fences: ${fmt(r.lower)} / ${fmt(r.upper)} · flagged: ${r.outliers.length}</text></svg>`;
  }
  function summary(r){const flag=r.outliers.some(p=>p.index===30);return `Day 31 = ${r.remeasured} vehicles: ${flag?'beyond the upper fence; flagged for investigation':'inside the fences; not flagged'}. Mean = ${fmt(r.mean)} (originally 4258); median = ${fmt(r.median)} (originally 4438). Q1 = ${fmt(r.q1)}; Q3 = ${fmt(r.q3)}. All quartiles and fences are recomputed; none is held fixed. Flagged observations are retained.`;}
  function correlation(rows){
    if(!Array.isArray(rows)||rows.length<2||rows.length>10000||!Array.from(rows).every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<=1e6&&Math.abs(p.y)<=1e6))throw Error('Expected finite paired numeric observations');
    const n=rows.length,mx=rows.reduce((s,p)=>s+p.x,0)/n,my=rows.reduce((s,p)=>s+p.y,0)/n;
    const xx=rows.reduce((s,p)=>s+(p.x-mx)**2,0),yy=rows.reduce((s,p)=>s+(p.y-my)**2,0);
    if(!xx||!yy)return null;
    return rows.reduce((s,p)=>s+(p.x-mx)*(p.y-my),0)/Math.sqrt(xx*yy);
  }
  function scatter(){
    const xs=[...pairs].sort((a,b)=>a.x-b.x),ys=[...pairs].sort((a,b)=>a.y-b.y);
    const wrong=xs.map((p,i)=>({id:p.id+'/'+ys[i].id,x:p.x,y:ys[i].y}));
    return {original:pairs,wrong,originalR:correlation(pairs),wrongR:correlation(wrong)};
  }
  function scatterSvg(){const r=scatter();return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 378" style="width:700px" role="img" aria-labelledby="oa-scatter-title" font-family="var(--lk-mono)" font-size="14" fill="var(--lk-ink)" data-generated-plot="oa-pairing"><title id="oa-scatter-title">Synthetic pairing counterexample. Five original points have Pearson r = 0. Sorting x and y independently creates r = 1 by changing the pairs. Both panels use identical axes.</title><rect width="700" height="378" fill="var(--lk-paper)"/>${['original','wrong'].map((key,k)=>{const left=55+k*355,right=left+240,bottom=307,top=67,x=v=>left+(v-.5)/5*240,y=v=>bottom-(v-.5)/5*240,color=k?'var(--lk-vermilion)':'var(--lk-cobalt)';return `<g data-scatter-panel="${key}"><text x="${left}" y="24" fill="${color}">${k?'SORTED SEPARATELY':'PAIRED OBSERVATIONS'}</text><text x="${left}" y="47">${k?'Artificial':'Original'} Pearson r = ${r[key+'R']}</text>${[1,2,3,4,5].map(v=>`<path d="M${x(v)} ${top}V${bottom}M${left} ${y(v)}H${right}" stroke="var(--lk-rule-soft)" stroke-width=".7"/><text x="${x(v)}" y="329" text-anchor="middle">${v}</text><text x="${left-12}" y="${y(v)+5}" text-anchor="end">${v}</text>`).join('')}<path d="M${left} ${top}V${bottom}H${right}" fill="none" stroke="var(--lk-ink)"/><text x="${left-26}" y="${top-10}">y</text><text x="${right+14}" y="329">x</text>${r[key].map((p,i)=>`<circle data-scatter-point="${key}-${i}" cx="${x(p.x)}" cy="${y(p.y)}" r="5" fill="${color}"><title>${esc(p.id)}: (${p.x}, ${p.y})</title></circle><text x="${x(p.x)+9}" y="${y(p.y)-10}" fill="${color}">${p.id}</text>`).join('')}<text x="${left}" y="364">${k?'Labels: x-source / y-source':'Labels: observation ID'}</text></g>`;}).join('')}</svg>`;}
  return {roads,pairs,summarize,traffic,table,svg,summary,correlation,scatter,scatterSvg,fmt};
});
