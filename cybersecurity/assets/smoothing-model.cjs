// Educational double-precision calculations, not a verified numerical certifier.
// Counts are hypothetical; this module does not run an image classifier.
const assert=require('node:assert/strict');
function counts(k,n){assert(Number.isInteger(n)&&n>=1&&n<=10000,'n must be 1..10000');assert(Number.isInteger(k)&&k>=0&&k<=n,'k must be 0..n');}
function normalCDF(z){assert(Number.isFinite(z)&&Math.abs(z)<=8);let term=z,sum=z;for(let i=1;i<400;i++){term*=z*z/(2*i+1);sum+=term;if(Math.abs(term)<1e-16*Math.abs(sum)||term===0)break;}return .5+Math.exp(-z*z/2)*sum/Math.sqrt(2*Math.PI);}
function normalQuantile(p){assert(Number.isFinite(p)&&p>=1e-6&&p<=1-1e-6,'Quantile supported for p in [1e-6,1-1e-6]');let lo=-8,hi=8;for(let i=0;i<60;i++){const mid=(lo+hi)/2;if(normalCDF(mid)<p)lo=mid;else hi=mid;}return (lo+hi)/2;}
function binomialTail(k,n,p){counts(k,n);assert(Number.isFinite(p)&&p>=0&&p<=1);if(k===0||p===1)return 1;if(p===0)return 0;
 // Log PMF recurrence, then log-sum-exp: no factorial overflow.
 let logChoose=0;for(let j=1;j<=k;j++)logChoose+=Math.log(n-j+1)-Math.log(j);
 let logTerm=logChoose+k*Math.log(p)+(n-k)*Math.log1p(-p),max=logTerm,sum=1;
 for(let j=k;j<n;j++){logTerm+=Math.log(n-j)-Math.log(j+1)+Math.log(p)-Math.log1p(-p);if(logTerm>max){sum=sum*Math.exp(max-logTerm)+1;max=logTerm;}else sum+=Math.exp(logTerm-max);}
 return Math.min(1,Math.exp(max)*sum);
}
function lowerBound(k,n,alpha){counts(k,n);assert(Number.isFinite(alpha)&&alpha>=1e-6&&alpha<=.1,'alpha must be 1e-6..0.1');if(k===0)return 0;if(k===n)return Math.exp(Math.log(alpha)/n);
 // Solve P_p[K >= k] = alpha. Returning the lower bisection endpoint does
 // not constitute a proof that floating-point evaluation is outward-rounded.
 let lo=0,hi=k/n;for(let i=0;i<60;i++){const mid=(lo+hi)/2;if(binomialTail(k,n,mid)<alpha)lo=mid;else hi=mid;}return lo;
}
function certify(selection,estimation,{sigma=.25,alpha=.001}={}){
 assert(Array.isArray(selection)&&selection.length>=2&&selection.length<=20);assert(Array.isArray(estimation)&&estimation.length===selection.length);
 for(const a of [selection,estimation]){assert(a.every(x=>Number.isInteger(x)&&x>=0));counts(0,a.reduce((s,x)=>s+x,0));}
 assert(Number.isFinite(sigma)&&sigma>0&&sigma<=10,'sigma must be positive and at most 10');
 const chosen=selection.indexOf(Math.max(...selection)),n=estimation.reduce((s,x)=>s+x,0),k=estimation[chosen],pLower=lowerBound(k,n,alpha),abstain=pLower<=.5;
 return {chosen,n,k,alpha,sigma,pLower,abstain,radius:abstain?0:sigma*normalQuantile(pLower)};
}
const examples=[
 {id:'clear',selection:[8,2],estimation:[90,10]},
 {id:'weak-majority',selection:[8,2],estimation:[60,40]},
 {id:'selection-miss',selection:[8,2],estimation:[10,90]},
 {id:'unanimous',selection:[8,2],estimation:[100,0]}
];
module.exports={normalCDF,normalQuantile,binomialTail,lowerBound,certify,examples};
