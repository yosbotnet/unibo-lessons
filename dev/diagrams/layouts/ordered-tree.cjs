// Content-sized ordered subtrees. No course semantics or hand-placed waypoints.
const assert=require('node:assert/strict');
module.exports=function layout(root,{direction='down',siblingGap=40,levelGap=68,padding=28}={}){
  assert(['down','right'].includes(direction));
  const horizontal=direction==='right',levels=[],seen=new Set();
  function size(n,depth=0){
    assert(!seen.has(n.id),'Tree contains a duplicate/shared node: '+n.id);seen.add(n.id);
    assert(Number.isFinite(n.w)&&n.w>0&&Number.isFinite(n.h)&&n.h>0,'Invalid node size');
    n.depth=depth;n.children||=[];levels[depth]=Math.max(levels[depth]||0,horizontal?n.w:n.h);
    n.children.forEach(c=>size(c,depth+1));
    n.span=Math.max(horizontal?n.h:n.w,n.children.reduce((s,c)=>s+c.span,0)+Math.max(0,n.children.length-1)*siblingGap);
  }
  size(root);const starts=[];levels.reduce((v,n,i)=>(starts[i]=v,v+n+levelGap),padding);
  const nodes=[];
  function place(n,offset){
    const across=offset+(n.span-(horizontal?n.h:n.w))/2;
    n.x=horizontal?starts[n.depth]:across;n.y=horizontal?across:starts[n.depth];nodes.push(n);
    const total=n.children.reduce((s,c)=>s+c.span,0)+Math.max(0,n.children.length-1)*siblingGap;
    let childOffset=offset+(n.span-total)/2;
    for(const c of n.children){place(c,childOffset);childOffset+=c.span+siblingGap}
  }
  place(root,padding);
  return {nodes,width:Math.max(...nodes.map(n=>n.x+n.w))+padding,height:Math.max(...nodes.map(n=>n.y+n.h))+padding};
};
