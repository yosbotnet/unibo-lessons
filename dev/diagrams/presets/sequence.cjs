const {assert,keys,label,measure,make,integer}=require('./common.cjs');
module.exports=spec=>{
  keys(spec,['preset','id','plate','title','participants','messages','overrides'],'sequence');
  const o=spec.overrides||{};keys(o,['participantOrder','rowGap','slant'],'overrides');
  assert(Array.isArray(spec.participants)&&spec.participants.length>=2&&spec.participants.length<=6,'Expected 2–6 participants');
  const participants=new Map();for(const p of spec.participants){keys(p,['id','label'],'participant');assert(/^[a-z][a-z0-9-]*$/.test(p.id)&&!participants.has(p.id),'Invalid/duplicate participant');label(p.label,'participant label');participants.set(p.id,p);}
  const order=o.participantOrder||[...participants.keys()];assert(Array.isArray(order)&&order.length===participants.size&&new Set(order).size===order.length&&order.every(id=>participants.has(id)),'Invalid participant order');
  const gap=o.rowGap===undefined?110:integer(o.rowGap,100,200,'rowGap'),slant=o.slant===undefined?32:integer(o.slant,0,48,'slant');
  assert(Array.isArray(spec.messages)&&spec.messages.length&&spec.messages.length<=24,'Expected messages');
  let spacing=Math.max(260,...[...participants.values()].map(p=>measure(p.label)+56));
  for(const m of spec.messages){keys(m,['from','to','label','detail','accent','dashed'],'message');assert(participants.has(m.from)&&participants.has(m.to)&&m.from!==m.to,'Unknown participant/self messages unsupported');label(m.label,'message');if(m.detail!==undefined)label(m.detail,'detail');for(const k of ['accent','dashed'])if(m[k]!==undefined)assert(typeof m[k]==='boolean','Expected boolean '+k);spacing=Math.max(spacing,(Math.max(measure(m.label),measure(m.detail||''))+56)/Math.abs(order.indexOf(m.from)-order.indexOf(m.to)));}
  const margin=Math.max(80,...[...participants.values()].map(p=>(measure(p.label)+32)/2+28)),width=Math.max(700,margin*2+spacing*(order.length-1)),height=115+gap*spec.messages.length;
  const d=make(spec,height,width,'Message sequence','Time progresses down each participant lifeline. Each arrow runs from sender to receiver. Vertical spacing is schematic, not a measured duration.');
  const x=id=>margin+order.indexOf(id)*(width-2*margin)/(order.length-1);
  for(const id of order){const p=participants.get(id),w=measure(p.label)+32,ports={};spec.messages.forEach((m,i)=>{const y=112+i*gap;ports['send'+i]=[w/2,y-30];ports['receive'+i]=[w/2,y+slant-30]});d.node(id,x(id)-w/2,30,w,38,p.label,{shape:'plain',ports});d.guide([[x(id),76],[x(id),height-22]],'rule');}
  spec.messages.forEach((m,i)=>{const y=112+i*gap,mid=(x(m.from)+x(m.to))/2,c=m.accent?'vermilion':'cobalt';d.edge(m.from+'.send'+i,m.to+'.receive'+i,[],c,m.dashed);d.label(mid,y-28,`${i+1}. ${m.label}`,c);if(m.detail)d.label(mid,y-8,m.detail,'ink');});
  d.label(width/2,18,'TIME ↓');d.semantic={kind:'sequence',order,messages:spec.messages.map((m,i)=>({...m,send:112+i*gap,receive:112+i*gap+slant}))};return d;
};
