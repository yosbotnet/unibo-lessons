// Exact two-point distribution chosen for teaching, not an image experiment.
const assert=require('node:assert/strict');
const defaults=Object.freeze({eta:.1,epsilon:.2});
function setup(options={}){assert(options&&typeof options==='object'&&!Array.isArray(options),'Options must be an object');assert(Object.keys(options).every(k=>k==='eta'||k==='epsilon'),'Unknown option');const {eta=defaults.eta,epsilon=defaults.epsilon}=options;assert(Number.isFinite(eta)&&eta>=.02&&eta<=.4);assert(Number.isFinite(epsilon)&&epsilon>=0&&epsilon<=.8);return {eta,epsilon};}
function point(x){assert(x&&Number.isFinite(x.u)&&Number.isFinite(x.v));return x;}
function feature(kind,x,eta){point(x);assert(kind==='u'||kind==='v');assert(Number.isFinite(eta)&&eta>0);return kind==='u'?x.u:x.v/eta;}
const sign=z=>z>=0?1:-1;
function evaluate(options){const {eta,epsilon}=setup(options),records=[-1,1].map(y=>{const p={u:y,v:eta*y},q={u:(1-epsilon)*y,v:(eta-epsilon)*y};return {y,p,q,delta:{u:-epsilon*y,v:-epsilon*y},norm:epsilon,truthBefore:sign(p.u),truthAfter:sign(q.u)};});
 const features=['u','v'].map(kind=>({kind,cleanCorrelation:1,worstCorrelation:kind==='u'?1-epsilon:1-epsilon/eta,cleanPredictions:records.map(r=>sign(feature(kind,r.p,eta))),candidatePredictions:records.map(r=>sign(feature(kind,r.q,eta)))}));
 return {eta,epsilon,records,features};
}
// For a linear score, the minimum signed score over the L∞ box is analytic.
function minimumSignedScore(weights,bias,x,y,epsilon){point(x);assert(weights&&Number.isFinite(weights.u)&&Number.isFinite(weights.v)&&Number.isFinite(bias));assert(y===-1||y===1);assert(Number.isFinite(epsilon)&&epsilon>=0);const bound=y*(weights.u*x.u+weights.v*x.v+bias)-epsilon*(Math.abs(weights.u)+Math.abs(weights.v));assert(Number.isFinite(bound),'Score overflow');return bound;}
module.exports={defaults,setup,feature,sign,evaluate,minimumSignedScore};
