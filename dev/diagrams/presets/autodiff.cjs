const {assert,circle,plain,keys,label,measure,make,num}=require('./common.cjs');
module.exports=function autodiff(spec){
  keys(spec,['preset','id','plate','title','expression','values','labels'],'autodiff');
  assert(spec.expression==='sum-product','Supported expression: sum-product, f=(x+y)z');
  keys(spec.values,['x','y','z'],'autodiff.values');
  for(const k of ['x','y','z'])assert(Number.isFinite(spec.values[k])&&Math.abs(spec.values[k])<=1e6,k+' must be finite and within ±1e6');
  const names={x:'x',y:'y',z:'z',q:'q',f:'f',...spec.labels};if(spec.labels)keys(spec.labels,['x','y','z','q','f'],'autodiff.labels');Object.values(names).forEach(s=>label(s,'variable'));
  assert(new Set(Object.values(names)).size===5,'Variable names must be distinct');
  const {x,y,z}=spec.values,q=x+y,f=q*z,n=names;
  const forward={x:`${n.x} = ${num(x)}`,y:`${n.y} = ${num(y)}`,z:`${n.z} = ${num(z)}`,out:`${n.f} = ${num(f)}`};
  const reverse={x:`∂${n.f}/∂${n.x} = ${num(z)}`,y:`∂${n.f}/∂${n.y} = ${num(z)}`,z:`∂${n.f}/∂${n.z} = ${num(q)}`,out:`∂${n.f}/∂${n.f} = 1`};
  const qLabels=[`${n.q} = ${num(q)}`,`∂${n.f}/∂${n.q} = ${num(z)}`];
  const scale=Math.max(1,...[...Object.values(forward),...Object.values(reverse)].map(s=>(measure(s)+16)/120),...qLabels.map(s=>(measure(s)+20)/155));
  const d=make(spec,440,700*scale,'Autodiff with straight angled connections and separate forward/reverse passes',`The same graph is shown twice. Forward: ${n.q}=${n.x}+${n.y}=${num(q)}, ${n.f}=${n.q}${n.z}=${num(f)}. Reverse: seed ∂${n.f}/∂${n.f}=1. The product sends ∂${n.f}/∂${n.q}=${n.z}=${num(z)} and ∂${n.f}/∂${n.z}=${n.q}=${num(q)}; the sum passes ${num(z)} to ${n.x} and ${n.y}. Circles denote primitive operators.`);
  function node(id,x,y,w,h,text,shape){const width=shape===circle?w:Math.max(w,measure(text)+16);d.node(id,(x+w/2)*scale-width/2,y,width,h,text,shape)}
  for(const [prefix,dy,rev] of [['',0,false],['rev-',220,true]]){
    const texts=rev?reverse:forward;d.label(350*scale,20+dy,rev?'REVERSE · adjoints':'FORWARD · values',rev?'vermilion':'cobalt');
    node(prefix+'x',15,45+dy,120,30,texts.x,plain);node(prefix+'y',15,165+dy,120,30,texts.y,plain);
    node(prefix+'q',225,100+dy,50,50,'+',circle);node(prefix+'z',470,40+dy,120,30,texts.z,plain);
    node(prefix+'f',435,100+dy,50,50,'×',circle);node(prefix+'out',560,110+dy,125,30,texts.out,plain);
    for(const [a,b] of [['x','q'],['y','q'],['q','f'],['z','f'],['f','out']])rev?d.connect(prefix+b,prefix+a,'vermilion',true):d.connect(prefix+a,prefix+b);
    d.label(350*scale,104+dy,qLabels[rev?1:0],rev?'vermilion':'cobalt');
  }
  d.semantic={expression:'(x+y)z',values:{x,y,z,q,f},gradients:{x:z,y:z,z:q,q:z,f:1}};return d;
};
