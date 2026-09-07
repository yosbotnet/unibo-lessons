const {assert,plain,keys,integer,measure,make}=require('./common.cjs');
module.exports=function inception(spec){
  keys(spec,['preset','id','plate','title','input','branches'],'inception');
  keys(spec.input,['height','width','channels'],'inception.input');
  const {height:H,width:W,channels:C}=spec.input;for(const [name,v] of Object.entries(spec.input))integer(v,1,65536,name);
  assert(Array.isArray(spec.branches),'branches must be an array');integer(spec.branches.length,2,6,'branch count');
  const branches=spec.branches.map(branch=>{
    assert(Array.isArray(branch),'branch must contain operations');integer(branch.length,1,4,'branch depth');let channels=C;
    return branch.map(op=>{
      keys(op,['kind','kernel','channels','reduction'],'operation');assert(['conv','pool'].includes(op.kind),'operation kind must be conv or pool');integer(op.kernel,1,11,'kernel');assert(op.kernel%2===1,'Only odd same-padding kernels are supported');
      const previousChannels=channels;
      if(op.kind==='conv')channels=integer(op.channels,1,65536,'channels');else assert(op.channels===undefined,'Pooling preserves channels; omit channels');
      if(op.reduction!==undefined)assert(typeof op.reduction==='boolean'&&op.kind==='conv'&&op.kernel===1,'reduction applies only to 1×1 convolution');
      if(op.reduction)assert(channels<previousChannels,'A reduction must decrease channels');
      const text=op.kind==='pool'?`${op.kernel}×${op.kernel} max pool`:`${op.kernel}×${op.kernel} ${op.reduction?'reduction':'conv'}`;
      return {...op,channels,lines:text+'|'+channels+' channels'};
    });
  });
  const depth=Math.max(...branches.map(b=>b.length)),column=Math.max(140,...branches.flat().flatMap(op=>op.lines.split('|').map(s=>measure(s)+16)));
  const width=50+branches.length*column+(branches.length-1)*30,inputY=155+125*depth,height=inputY+80;
  const total=branches.reduce((n,b)=>n+b.at(-1).channels,0),inputText=`${H}×${W}×${C}`,outputText=`${H}×${W}×${total}`;
  const textWidth=Math.max(250,measure(inputText)+16,measure(outputText)+16);
  const desc=branches.map(b=>b.map(op=>op.kind==='pool'?`${op.kernel}×${op.kernel} max pool (${op.channels} channels)`:`${op.kernel}×${op.kernel}→${op.channels}`).join(' then ')).join('; ');
  const d=make(spec,height,width,'Inception module with channel dimensions and separate concatenation entries',`Input ${inputText}. Branches: ${desc}. Stride 1 and suitable padding preserve ${H}×${W} in every path. Concatenation gives ${branches.map(b=>b.at(-1).channels).join('+')}=${total} channels, not a sum of feature values.`);
  const centers=branches.map((_,i)=>25+column/2+i*(column+30));
  d.node('input',(width-textWidth)/2,inputY,textWidth,40,inputText,plain)
    .node('concat',35,60,width-70,45,'CONCATENATE CHANNELS',{ports:Object.fromEntries(centers.map((x,i)=>['p'+i,[x-35,45]]))})
    .node('output',(width-textWidth)/2,5,textWidth,35,outputText,plain);
  branches.forEach((branch,i)=>{
    const x=centers[i],last=branch.length-1;
    // Final operation first keeps the original deterministic SVG draw order.
    const final=branch[last];d.node('b'+i,x-column/2,165,column,58,final.lines,final.reduction?{color:'vermilion'}:{});
    for(let j=last-1;j>=0;j--){const op=branch[j],id=j===last-1?'r'+i:`r${i}_${j}`,next=j===last-1?'b'+i:(j+1===last-1?'r'+i:`r${i}_${j+1}`);
      d.node(id,x-column/2,165+125*(last-j),column,58,op.lines,op.reduction?{color:'vermilion'}:{});
      // Wire the input before intermediate links, matching the default plate.
      if(j===0)d.edge('input.N',id+'.S',[[width/2,inputY-25],[x,inputY-25]]);
      d.edge(id+'.N',next+'.S');
    }
    if(last===0)d.edge('input.N','b'+i+'.S',[[width/2,inputY-25],[x,inputY-25]]);
    d.edge('b'+i+'.N','concat.p'+i);
  });
  d.edge('concat.N','output.S').label(width/2,height-13,branches.map(b=>b.at(-1).channels).join(' + ')+` = ${total} output channels`,'ink-soft');
  d.junctions=[...centers.slice(1,-1),width/2].map(x=>[x,inputY-25]);
  d.semantic={input:{height:H,width:W,channels:C},output:{height:H,width:W,channels:total},branches};return d;
};
