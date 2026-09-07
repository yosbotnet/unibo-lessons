const {assert,circle,plain,keys,label,integer,measure,make,sub}=require('./common.cjs');
module.exports=function neuron(spec){
  keys(spec,['preset','id','plate','title','inputs','bias','activation','output','overrides'],'neuron');
  const inputs=spec.inputs||['x₁','x₂','x₃'];assert(Array.isArray(inputs),'inputs must be an array');integer(inputs.length,1,8,'input count');inputs.forEach(s=>label(s,'input'));
  assert(new Set(inputs).size===inputs.length,'Input labels must be unique');
  if(spec.bias!==undefined)assert(typeof spec.bias==='boolean','bias must be boolean');
  const bias=spec.bias!==false,activation=label(spec.activation||'φ(a)','activation'),output=label(spec.output||'y','output');
  const o=spec.overrides||{};keys(o,['inputOrder','activationShape','rowGap'],'neuron.overrides');
  const shape=o.activationShape||'square';assert(['square','circle'].includes(shape),'activationShape must be square or circle');
  const rowGap=o.rowGap??20;integer(rowGap,20,120,'rowGap');
  const source=inputs.map((text,i)=>({id:'x'+(i+1),text,weight:'w'+sub(i+1)}));if(bias)source.push({id:'x0',text:'1',weight:'w₀'});
  const order=o.inputOrder||source.map(n=>n.id);assert(Array.isArray(order)&&order.length===source.length&&new Set(order).size===source.length&&order.every(id=>source.some(n=>n.id===id)),'inputOrder must contain every enabled input ID exactly once');
  const nodes=order.map(id=>source.find(n=>n.id===id));
  const diameter=Math.max(60,...inputs.map(s=>measure(s)+24)),pitch=diameter+rowGap;
  const inputX=40+diameter,naturalY=40+diameter/2+(nodes.length-1)*pitch/2,r=Math.max(42,nodes.length*10.5);
  const sumX=inputX+diameter/2+245,actX=sumX+r+103,actW=Math.max(70,measure(activation)+24),actH=shape==='circle'?actW:54;
  const cy=Math.max(naturalY,actH/2+20,r+20),shift=cy-naturalY;
  const outX=actX+actW+50,outW=Math.max(40,measure(output)+16),width=Math.max(700,outX+outW+20),height=Math.max(40+(nodes.length-1)*pitch+diameter+50+shift,cy+actH/2+50,cy+r+50);
  const d=make(spec,height,width,'Neuron with weighted diagonal fan-in, bias, summation and activation',`Each input contributes wᵢxᵢ to the sum.${bias?' The constant input 1 contributes w₀ (bias).':''} The sum produces a=${bias?'w₀+':''}Σᵢwᵢxᵢ; the activation produces ${output}=${activation}. Straight arrows meet the actual circle boundaries.`);
  nodes.forEach((n,i)=>d.node(n.id,inputX-diameter/2,40+i*pitch+shift,diameter,diameter,n.text,{...circle,...(n.id==='x0'?{color:'vermilion'}:{})}));
  d.node('sum',sumX-r,cy-r,r*2,r*2,'Σ',circle).node('activation',actX,cy-actH/2,actW,actH,activation,shape==='circle'?circle:{})
    .node('output',outX,cy-15,outW,30,output,plain);
  nodes.forEach((n,i)=>d.connect(n.id,'sum',n.id==='x0'?'vermilion':'cobalt').label((inputX+sumX)/2-2.5,(40+i*pitch+shift+diameter/2+cy)/2-15,n.weight,n.id==='x0'?'vermilion':'cobalt'));
  d.connect('sum','activation').connect('activation','output').label(actX-52,cy-16,'a');
  if(bias){const i=nodes.findIndex(n=>n.id==='x0');if(i===nodes.length-1)d.label(inputX,height-22,'bias','vermilion');else d.label(inputX-diameter/2-30,40+i*pitch+shift+diameter/2+5,'bias','vermilion')}
  d.label(sumX+25,height-22,'a = '+(bias?'w₀ + ':'')+'Σᵢ wᵢxᵢ');
  return d;
};
