const {assert,circle,plain,keys,label,measure,make}=require('./common.cjs');
module.exports=function gru(spec){
  keys(spec,['preset','id','plate','title','labels','layout','updateConvention'],'gru');
  if(spec.labels)keys(spec.labels,['previous','input','reset','update','candidate','output'],'gru.labels');
  const n={previous:'hₜ₋₁',input:'xₜ',reset:'rₜ',update:'uₜ',candidate:'h̃ₜ',output:'hₜ',...spec.labels};Object.values(n).forEach(s=>label(s,'GRU label'));
  assert(new Set(Object.values(n)).size===6,'GRU signal labels must be distinct');
  const layout=spec.layout||'split',convention=spec.updateConvention||'retain';assert(['split','stacked'].includes(layout),'layout must be split or stacked');assert(['retain','candidate'].includes(convention),'updateConvention must be retain or candidate');
  const retain=convention==='retain'?n.update:'1−'+n.update,replace=convention==='retain'?'1−'+n.update:n.update;
  const specs=[
    ['h',10,116,65,30,n.previous,plain],['r',86,55,70,30,n.reset,{...plain,color:'vermilion'}],
    ['reset',105,115,32,32,'×',circle],['candidate',190,105,80,52,'tanh',{}],
    ['input',20,225,60,30,n.input,plain],['candidate-out',285,116,50,30,n.candidate,plain],
    ['old',365,88,70,30,n.previous,plain],['u',453,40,70,30,retain,{...plain,color:'vermilion'}],
    ['retain',470,85,36,36,'×',circle],['mix-candidate',365,235,80,30,n.candidate,plain],
    ['complement',453,180,70,30,replace,{...plain,color:'vermilion'}],['new',470,232,36,36,'×',circle],
    ['sum',585,155,40,40,'+',circle],['output',640,160,55,30,n.output,plain]
  ];
  const scale=Math.max(1,...specs.filter(s=>s[6]!==circle).map(s=>(measure(s[5])+8)/s[3]));
  const equation=`${n.output} = ${retain===n.update?retain:'(1 − '+n.update+')'} ⊙ ${n.previous} + ${replace===n.update?replace:'(1 − '+n.update+')'} ⊙ ${n.candidate}`;
  const caption=`${layout==='split'?'Left':'First'}: ${n.candidate}=tanh(Wₕ(${n.reset}⊙${n.previous})+Uₕ${n.input}); the tanh block includes this affine transformation. ${layout==='split'?'Right':'Second'} reuses that same candidate: ${n.output}=${retain===n.update?retain:'(1−'+n.update+')'}⊙${n.previous}+${replace===n.update?replace:'(1−'+n.update+')'}⊙${n.candidate}. Gates are computed from both inputs: ${n.reset}=σ(Wᵣ${n.previous}+Uᵣ${n.input}), ${n.update}=σ(Wᵤ${n.previous}+Uᵤ${n.input}). Their shared-input wiring is factored into these definitions. × means elementwise product; ${n.output} is also the output.`;
  const width=Math.max((layout==='split'?700:350)*scale,measure(equation)+40),height=layout==='split'?340:640;
  const d=make(spec,height,width,'GRU in two readable stages: reset/candidate and update/mix',caption);
  d.label(160*scale,25,'RESET / CANDIDATE').label((layout==='split'?525:175)*scale,layout==='split'?25:325,'UPDATE / MIX');
  specs.forEach(([id,x,y,w,h,text,shape],i)=>{
    const right=i>=6,localX=layout==='stacked'&&right?x-350:x,width=shape===circle?w:Math.max(w,measure(text)+8);
    d.node(id,(localX+w/2)*scale-width/2,y+(layout==='stacked'&&right?300:0),width,h,text,shape);
  });
  d.connect('h','reset').connect('r','reset','vermilion').connect('reset','candidate')
    .edge('input.E','candidate.S',[[230*scale,240]]).connect('candidate','candidate-out')
    .connect('old','retain').connect('u','retain','vermilion').connect('mix-candidate','new')
    .connect('complement','new','vermilion').connect('retain','sum').connect('new','sum').connect('sum','output')
    .label(width/2,height-19,equation);
  d.semantic={labels:n,updateConvention:convention,weights:{previous:retain,candidate:replace}};return d;
};
