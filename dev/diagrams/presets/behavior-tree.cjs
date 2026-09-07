const {assert,keys,label,measure,make,integer}=require('./common.cjs');
const layout=require('../layouts/ordered-tree.cjs');
module.exports=spec=>{
  keys(spec,['preset','id','plate','title','tree','overrides'],'behavior-tree');
  const o=spec.overrides||{};keys(o,['siblingGap','levelGap'],'overrides');
  const siblingGap=o.siblingGap===undefined?28:integer(o.siblingGap,28,160,'siblingGap');
  const levelGap=o.levelGap===undefined?68:integer(o.levelGap,48,180,'levelGap');
  let count=0;
  function convert(n){
    keys(n,['id','kind','label','children'],'tree node');assert(++count<=64,'Tree too large');
    assert(typeof n.id==='string'&&/^[a-z][a-z0-9-]*$/.test(n.id),'Invalid tree node id');
    assert(['root','sequence','fallback','action','condition'].includes(n.kind),'Unsupported BT node kind');
    assert(n.children===undefined||Array.isArray(n.children),'children must be an array');const children=n.children||[];
    if(['action','condition'].includes(n.kind))assert(!children.length,'Execution nodes must be leaves');
    else assert(children.length>0,'Control nodes need children');
    if(n.kind==='root')assert(n===spec.tree&&children.length===1,'Root must have exactly one child');
    if(['sequence','fallback'].includes(n.kind))assert(n.label===undefined,'Control nodes use canonical glyphs; put prose in captions');
    const text=['sequence','fallback'].includes(n.kind)?(n.kind==='sequence'?'→':'?'):label(n.kind==='root'?(n.label||'ROOT'):n.label,'node label');
    const shape=['sequence','fallback'].includes(n.kind)?'circle':n.kind==='condition'?'ellipse':undefined;
    const lines=[];for(const word of text.split(/\s+/)){if(lines.length&&(lines.at(-1)+' '+word).length<=12)lines[lines.length-1]+=' '+word;else lines.push(word)}
    return {id:n.id,kind:n.kind,text:lines.join('|'),shape,w:shape==='circle'?42:Math.max(86,Math.max(...lines.map(measure))+(shape==='ellipse'?32:20)),h:shape==='circle'?42:Math.max(42,lines.length*21+(shape==='ellipse'?30:20)),children:children.map(convert)};
  }
  const tree=convert(spec.tree),result=layout(tree,{siblingGap,levelGap});
  const d=make(spec,result.height+32,Math.max(700,result.width),'Ordered behavior tree','Children are visited from left to right. → is Sequence; ? is Fallback. Rectangles are actions and ellipses are conditions. A control node stops according to its return-status rule; the arrows show tick propagation, not unconditional execution of every child.');
  const offset=(d.width-result.width)/2;
  for(const n of result.nodes)d.node(n.id,n.x+offset,n.y+32,n.w,n.h,n.text,{shape:n.shape});
  for(const n of result.nodes)for(const c of n.children){const a=d.port(n.id+'.S'),b=d.port(c.id+'.N'),mid=(a[1]+b[1])/2;d.edge(n.id+'.S',c.id+'.N',[[a[0],mid],[b[0],mid]]);}
  d.label(d.width/2,20,'TICK ↓ · CHILD ORDER: LEFT → RIGHT');
  d.semantic={kind:'behavior-tree',children:Object.fromEntries(result.nodes.map(n=>[n.id,n.children.map(c=>c.id)]))};return d;
};
