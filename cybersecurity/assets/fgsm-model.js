(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.NotesFGSM=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const initial={u:0.30,v:0.43,epsilon:0.08};
 function point(x){if(!x||![x.u,x.v].every(n=>Number.isFinite(n)&&n>=0&&n<=1))throw new Error('Coordinates must be in [0,1]');return x;}
 function boundary(u){if(!Number.isFinite(u)||u<0||u>1)throw new Error('u must be in [0,1]');return .35+.8*(u-.5)**2;}
 function probability(x){point(x);return 1/(1+Math.exp(-8*(x.v-boundary(x.u))));}
 function label(x){return x.v>=boundary(point(x).u)?1:0;}
 function loss(x,y){if(y!==0&&y!==1)throw new Error('Reference class must be 0 or 1');const z=8*(point(x).v-boundary(x.u));return Math.max(z,0)+Math.log1p(Math.exp(-Math.abs(z)))-y*z;}
 function gradient(x,y){loss(x,y);const k=8*(probability(x)-y);return {u:k*(-1.6*(x.u-.5))||0,v:k};}
 function attack(x,epsilon,y=label(x)){
  point(x);if(!Number.isFinite(epsilon)||epsilon<0||epsilon>1)throw new Error('epsilon must be in [0,1]');
  const g=gradient(x,y),clip=n=>Math.max(0,Math.min(1,n));
  const q={u:clip(x.u+epsilon*Math.sign(g.u)),v:clip(x.v+epsilon*Math.sign(g.v))};
  return {p:{u:x.u,v:x.v},q,epsilon,reference:y,gradient:g,delta:{u:q.u-x.u,v:q.v-x.v},norm:Math.max(Math.abs(q.u-x.u),Math.abs(q.v-x.v)),before:loss(x,y),after:loss(q,y),flipped:label(q)!==y};
 }
 return {initial,point,boundary,probability,label,loss,gradient,attack};
});
