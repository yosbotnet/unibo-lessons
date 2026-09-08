// Invented deterministic corridor: no neural-network training or Atari experiment.
const assert=require('node:assert/strict');
function observation(s){assert(Number.isInteger(s)&&s>=0&&s<=2);return (s+2)/4;}
function probability(o){assert(Number.isFinite(o)&&o>=0&&o<=1);return 1/(1+Math.exp(-4*(o-.5)));}
function action(o){return probability(o)>=.5?'R':'L';}
function loss(o,y){assert(y===0||y===1);probability(o);const z=4*(o-.5);return Math.log1p(Math.exp(z))-y*z;}
function perturb(o,epsilon){assert(Number.isFinite(epsilon)&&epsilon>=0&&epsilon<=1);const reference=action(o)==='R'?1:0,gradient=4*(probability(o)-reference),q=Math.max(0,Math.min(1,o+epsilon*Math.sign(gradient)));return {o,q,reference,gradient,delta:q-o,epsilon};}
function step(s,a){observation(s);assert(s!==2,'Terminal state cannot earn another reward');assert(a==='L'||a==='R');const next=Math.max(0,Math.min(2,s+(a==='R'?1:-1)));return {next,reward:next===2?1:0,terminal:next===2};}
function rollout(options={}){assert(options&&typeof options==='object'&&!Array.isArray(options));assert(Object.keys(options).every(k=>['horizon','epsilon','gamma'].includes(k)));const {horizon=2,epsilon=0,gamma=1}=options;assert(Number.isInteger(horizon)&&horizon>=1&&horizon<=8);assert(Number.isFinite(gamma)&&gamma>=0&&gamma<=1);perturb(.75,epsilon);let s=1,total=0;const trace=[];for(let t=0;t<horizon&&s!==2;t++){const o=observation(s),attack=perturb(o,t===0?epsilon:0),a=action(attack.q),transition=step(s,a);trace.push({t,s,o,seen:attack.q,delta:attack.delta,a,...transition});total+=gamma**t*transition.reward;s=transition.next;}return {horizon,epsilon,gamma,trace,total,terminal:s===2,finalState:s};}
function examples(options={}){assert(options&&typeof options==='object'&&!Array.isArray(options));assert(Object.keys(options).every(k=>k==='epsilon'||k==='gamma'));const {epsilon=.4,gamma=1}=options;return [{id:'clean',label:'clean · H=2',...rollout({horizon:2,gamma})},{id:'short',label:'attack · H=2',...rollout({horizon:2,epsilon,gamma})},{id:'long',label:'attack · H=3',...rollout({horizon:3,epsilon,gamma})}];}
module.exports={observation,probability,action,loss,perturb,step,rollout,examples};
