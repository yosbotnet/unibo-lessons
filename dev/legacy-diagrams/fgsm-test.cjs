const assert=require('node:assert/strict'),fs=require('node:fs'),m=require('../../cybersecurity/assets/fgsm-model.js');
const out='/home/ybc/notes-legacy-review-artifacts';let gradients=0,steps=0;
function close(a,b,t=1e-8){assert(Math.abs(a-b)<t,`${a} != ${b}`);}
const oracleLoss=(u,v,y)=>{const z=8*v-2.8-6.4*(u-.5)**2,p=1/(1+Math.exp(-z));return -y*Math.log(p)-(1-y)*Math.log1p(-p);};
for(let i=1;i<40;i++)for(let j=1;j<40;j++)for(const y of [0,1]){
 const p={u:i/40,v:j/40},g=m.gradient(p,y),h=1e-5;
 close(m.loss(p,y),oracleLoss(p.u,p.v,y));
 close(g.u,(oracleLoss(p.u+h,p.v,y)-oracleLoss(p.u-h,p.v,y))/(2*h),1e-7);
 close(g.v,(oracleLoss(p.u,p.v+h,y)-oracleLoss(p.u,p.v-h,y))/(2*h),1e-7);gradients++;
}
for(let i=0;i<=40;i++)for(let j=0;j<=40;j++)for(const epsilon of [0,.01,.08,.25,1]){
 const p={u:i/40,v:j/40},a=m.attack(p,epsilon),reference=p.v>=.55-.8*p.u+.8*p.u*p.u?1:0;
 // Avoid alternative rounding conventions exactly on the quadratic boundary.
 if(Math.abs(p.v-m.boundary(p.u))>1e-12)assert.equal(a.reference,reference);
 assert(Number.isFinite(a.q.u)&&Number.isFinite(a.q.v)&&a.q.u>=0&&a.q.u<=1&&a.q.v>=0&&a.q.v<=1);
 assert(a.norm<=epsilon+1e-15);close(a.norm,Math.max(Math.abs(a.q.u-p.u),Math.abs(a.q.v-p.v)));
 if(epsilon===0){assert.deepEqual(a.q,p);assert.equal(a.flipped,false);}
 if(p.u===.5)assert.equal(a.q.u,.5);
 assert.deepEqual(p,{u:i/40,v:j/40});steps++;
}
const a=m.attack(m.initial,.08);close(a.q.u,.22);close(a.q.v,.35);assert(a.flipped);assert(a.after>a.before);
assert(!m.attack({u:.8,v:.9},.01).flipped);
const clipped=m.attack({u:0,v:.9},.08);assert.equal(clipped.q.u,0);assert.equal(clipped.delta.u,0);
const stationaryU=m.attack({u:.5,v:.9},.1),better={u:.4,v:.8};assert(m.loss(better,1)>stationaryU.after);
for(let i=0;i<=1000;i++){const t=i/1000,bezier=.55*(1-t)**2+2*.15*t*(1-t)+.55*t*t;close(bezier,m.boundary(t));}
// Every corner of the un-clipped L∞ box has no greater linearized gain.
for(const p of [{u:.3,v:.43},{u:.5,v:.9},{u:.49,v:.2}]){const g=m.gradient(p,m.label(p)),eps=.08,best=eps*(Math.abs(g.u)+Math.abs(g.v));for(const x of [-eps,eps])for(const y of [-eps,eps])assert(x*g.u+y*g.v<=best+1e-14);}
for(const p of [null,{}, {u:NaN,v:0},{u:-.1,v:0},{u:0,v:1.1}])assert.throws(()=>m.attack(p,.1));for(const e of [-1,NaN,Infinity,1.1])assert.throws(()=>m.attack(m.initial,e));assert.throws(()=>m.gradient(m.initial,2));
fs.writeFileSync(out+'/fgsm-test.json',JSON.stringify({gradients,steps,invalidInputs:10,default:a,clipped,nonOptimal:{fgsm:stationaryU.after,better:m.loss(better,1)},scope:'Toy classifier and FGSM step, not neural-network or semantic robustness'},null,2)+'\n');
console.log(`${gradients} finite-difference gradients; ${steps} constrained steps; clipping, zero steps, failures and nonlinear non-optimality passed`);
