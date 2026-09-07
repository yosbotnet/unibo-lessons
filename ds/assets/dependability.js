(function(global){
  'use strict';
  const YEAR_HOURS=365*24;
  function positive(value,name){if(!Number.isFinite(value)||value<=0)throw Error(name+' must be positive and finite')}
  function metrics(mttf,mttr){
    positive(mttf,'MTTF');positive(mttr,'MTTR');
    const cycle=mttf+mttr;positive(cycle,'Cycle');
    const unavailability=mttr/cycle;
    return {cycle,availability:mttf/cycle,unavailability,nines:-Math.log10(unavailability),downtimeHours:unavailability*YEAR_HOURS};
  }
  function meetsNines(mttf,mttr,n){
    if(!Number.isInteger(n)||n<1||n>15)throw Error('Invalid nines threshold');
    return metrics(mttf,mttr).unavailability<=10**(-n)*(1+4*Number.EPSILON);
  }
  function reliability(mttf,time){
    positive(mttf,'MTTF');if(!Number.isFinite(time)||time<0)throw Error('Time must be nonnegative and finite');
    return Math.exp(-time/mttf);
  }
  // Same long-run availability, different uninterrupted lifetimes. Hours throughout.
  const comparison=Object.freeze([
    Object.freeze({id:'fast',label:'Short uptime / fast repair',mttf:1,mttr:1/99}),
    Object.freeze({id:'slow',label:'Long uptime / slow repair',mttf:100,mttr:100/99})
  ]);
  const api={YEAR_HOURS,metrics,meetsNines,reliability,comparison};
  if(typeof module==='object'&&module.exports)module.exports=api;else global.NotesDependability=api;
})(typeof window==='undefined'?globalThis:window);
