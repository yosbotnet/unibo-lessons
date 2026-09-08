(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.NotesFrequency=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const data=Object.freeze([5012,4948,5077,4960,5010,4170,2916,4442,4301,4931,4533,4438,3707,2794,3148,4086,4355,4272,4389,3546,2827,4505,4598,4646,4406,4586,3801,2845,4919,4663,5167]);
  function valuesOK(values){if(!Array.isArray(values)||!values.length||!Array.from(values).every(Number.isFinite))throw Error('Expected nonempty finite numeric data');}
  function edgesFor(values,bins,mode){
    valuesOK(values);if(!Number.isInteger(bins)||bins<2||bins>64)throw Error('Expected 2–64 bins');
    if(!['scipy','numpy'].includes(mode))throw Error('Unknown range convention');
    const min=Math.min(...values),max=Math.max(...values);if(min===max)throw Error('Use explicit edges for a constant dataset');
    const pad=mode==='scipy'?(max-min)/(2*(bins-1)):0,lo=min-pad,hi=max+pad;
    return Array.from({length:bins+1},(_,i)=>i===bins?hi:lo+i*(hi-lo)/bins);
  }
  function histogram(values,edges){
    valuesOK(values);if(!Array.isArray(edges)||edges.length<2||!Array.from(edges).every((x,i)=>Number.isFinite(x)&&(!i||x>edges[i-1])))throw Error('Expected finite increasing edges');
    const counts=Array(edges.length-1).fill(0);let excluded=0;
    for(const x of values){let index=-1;for(let i=0;i<counts.length;i++)if(x>=edges[i]&&(x<edges[i+1]||(i===counts.length-1&&x===edges[i+1]))){index=i;break;}
      if(index<0)excluded++;else counts[index]++;
    }
    let total=0;const rows=counts.map((count,i)=>{total+=count;return {lo:edges[i],hi:edges[i+1],count,cumulativeCount:total,relative:count/values.length,cumulative:total/values.length};});
    const mean=values.reduce((a,b)=>a+b,0)/values.length;
    return {n:values.length,edges:[...edges],counts,rows,excluded,mean,sampleStd:values.length>1?Math.sqrt(values.reduce((a,x)=>a+(x-mean)**2,0)/(values.length-1)):null};
  }
  function example(bins=10,mode='scipy'){return {...histogram(data,edgesFor(data,bins,mode)),mode};}
  const fmt=x=>Number(x.toFixed(2)).toString();
  function table(r){return `<table data-frequency-table><caption>Counts and proportions — ${r.counts.length} bins</caption><thead><tr><th scope="col">Interval</th><th scope="col">Days</th><th scope="col">Relative</th><th scope="col">Cumulative</th></tr></thead><tbody>${r.rows.map((row,i)=>`<tr data-bin="${i}"><th scope="row">[${fmt(row.lo)}, ${fmt(row.hi)}${i===r.rows.length-1?']':')'}</th><td>${row.count}</td><td>${row.relative.toFixed(4)}</td><td>${row.cumulative.toFixed(4)}</td></tr>`).join('')}</tbody><tfoot><tr><th scope="row">Included total</th><td>${r.n-r.excluded}</td><td>${((r.n-r.excluded)/r.n).toFixed(4)}</td><td>${((r.n-r.excluded)/r.n).toFixed(4)}</td></tr></tfoot></table>`;}
  function svg(r){
    // The course chart has 5–16 equal-width bins; the model also supports explicit edges.
    const left=64,right=664,top=54,bottom=278,width=700,height=354;
    const lo=r.edges[0],hi=r.edges.at(-1),max=Math.max(...r.counts,1),x=v=>left+(v-lo)/(hi-lo)*(right-left),y=v=>bottom-v/max*(bottom-top);
    const ticks=[0,Math.ceil(max/2),max].filter((v,i,a)=>a.indexOf(v)===i);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="width:700px" role="img" aria-labelledby="oa-frequency-title" font-family="var(--lk-mono)" font-size="14" data-frequency-chart data-generated-plot="oa-frequency"><title id="oa-frequency-title">Histogram of 31 August daily vehicle counts; ${r.counts.length} bins, ${r.mode==='scipy'?'expanded SciPy-style':'observed min–max'} range. Exact counts are in the following table.</title><rect width="700" height="354" fill="var(--lk-paper)"/>
${ticks.map(v=>`<path d="M${left} ${y(v)}H${right}" stroke="var(--lk-rule-soft)"/><text x="52" y="${y(v)+5}" text-anchor="end" fill="var(--lk-ink)">${v}</text>`).join('')}
${r.rows.map((row,i)=>`<rect data-bin="${i}" x="${x(row.lo)}" y="${y(row.count)}" width="${x(row.hi)-x(row.lo)}" height="${bottom-y(row.count)}" fill="var(--lk-cobalt)" fill-opacity=".22" stroke="var(--lk-cobalt)" stroke-width="1"/><text x="${(x(row.lo)+x(row.hi))/2}" y="${y(row.count)-8}" text-anchor="middle" fill="var(--lk-ink)">${row.count}</text>`).join('')}
<path d="M${left} ${top}V${bottom}H${right}" fill="none" stroke="var(--lk-ink)"/>
<path d="M${x(r.mean)} ${top}V${bottom}" stroke="var(--lk-vermilion)" stroke-width="2" stroke-dasharray="5 4"/><text x="664" y="25" text-anchor="end" fill="var(--lk-vermilion)">Mean ${r.mean.toFixed(2)} vehicles/day</text><text x="16" y="25" fill="var(--lk-ink)">Days</text>
${[0,.5,1].map(t=>{const v=lo+t*(hi-lo);return `<path d="M${x(v)} ${bottom}v6" stroke="var(--lk-ink)"/><text x="${x(v)}" y="306" text-anchor="middle" fill="var(--lk-ink)">${fmt(v)}</text>`;}).join('')}
<text x="350" y="339" text-anchor="middle" fill="var(--lk-ink)">Vehicles per day · equal-width numeric intervals</text></svg>`;
  }
  function summary(r){return `${r.n} observations; ${r.counts.length} bins; ${r.mode==='scipy'?'SciPy-style expanded':'NumPy-style min–max'} range. Mean = ${r.mean.toFixed(2)}; sample standard deviation (n−1) = ${r.sampleStd.toFixed(2)}. Included = ${r.n-r.excluded}; excluded = ${r.excluded}.`;}
  return {data,edgesFor,histogram,example,table,svg,summary};
});
