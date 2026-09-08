// Exact finite-distribution teaching model. No personal data, sampling, or DP deployment library.
const assert=require('node:assert/strict');
const modes=['text','reuse','fresh','raw'];
function checkP(p){assert(Number.isFinite(p)&&p>=0.5&&p<=0.99,'p must be in [0.5, 0.99]');return p;}
function distribution(p,mode,x){checkP(p);assert(modes.includes(mode),'Unknown mechanism');assert(x===0||x===1,'Input is one bit');
 const outcomes=mode==='text'?['NO','YES']:['00','01','10','11'],probabilities=outcomes.map(()=>0),q=1-p;
 const add=(out,prob)=>{probabilities[outcomes.indexOf(out)]+=prob;};
 for(const y of [0,1]){const py=y===x?p:q;if(mode==='text')add(y?'YES':'NO',py);else if(mode==='reuse')add(''+y+y,py);else if(mode==='raw')add(''+y+x,py);else for(const z of [0,1])add(''+y+z,py*(z===x?p:q));}
 return {outcomes,probabilities};
}
// For this finite pair, singleton ratios suffice for pure DP; tests also enumerate all events.
function bound(a,b){for(const v of [a,b])assert(Array.isArray(v)&&v.length>0&&v.length<=16&&v.every(p=>Number.isFinite(p)&&p>=0&&p<=1)&&Math.abs(v.reduce((s,p)=>s+p,0)-1)<1e-12,'Expected a finite probability distribution');assert.equal(a.length,b.length);let ratio=1;for(let i=0;i<a.length;i++)for(const [u,v] of [[a[i],b[i]],[b[i],a[i]]])if(u>0)ratio=Math.max(ratio,v===0?Infinity:u/v);return {ratio,epsilon:Math.log(ratio)};}
function examples(options={}){assert(options&&typeof options==='object'&&!Array.isArray(options));for(const k of Object.keys(options))assert(k==='p','Unknown option '+k);const p=checkP(options.p===undefined?0.75:options.p);
 const labels={text:'One text release',reuse:'Reuse same result',fresh:'Two fresh releases',raw:'Append raw bit'},meaning={text:'Encode y as NO / YES.',reuse:'Release (y, y); draw y only once.',fresh:'Release (y₁, y₂); draw independently given x.',raw:'Release (y, x); the second component bypasses randomization.'};
 return modes.map(id=>{const a=distribution(p,id,0),b=distribution(p,id,1);return {id,label:labels[id],meaning:meaning[id],p,outcomes:a.outcomes,zero:a.probabilities,one:b.probabilities,...bound(a.probabilities,b.probabilities)};});
}
module.exports={distribution,bound,examples};
