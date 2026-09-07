const assert=require('node:assert/strict'),fs=require('node:fs'),{spawnSync}=require('node:child_process'),m=require('../../cybersecurity/assets/smoothing-model.cjs');
const close=(a,b,t=2e-10)=>assert(Math.abs(a-b)<t,`${a} != ${b}`);
const crypto=require('node:crypto'),pdf=process.env.NOTES_COHEN_PDF,core=process.env.NOTES_SMOOTHING_CORE;
assert(pdf&&core,'Set NOTES_COHEN_PDF and NOTES_SMOOTHING_CORE to the reviewed primary sources');
const pdfHash=crypto.createHash('sha256').update(fs.readFileSync(pdf)).digest('hex'),coreHash=crypto.createHash('sha256').update(fs.readFileSync(core)).digest('hex');
assert.equal(pdfHash,'409715d2ae1cd52d39b0a78ed1227edbdaa575be76dd40ab66b9869e97de4551');assert.equal(coreHash,'194857134fbcf4770a3d1823b5902123b391a1cc828298d6e3b8a0a7f67fb4d6');
const paperText=spawnSync('pdftotext',['-layout',pdf,'-'],{encoding:'utf8',timeout:15000,maxBuffer:2e6});assert.equal(paperText.status,0);assert.match(paperText.stdout,/Theorem 1 holds regardless of how the base classifier/);assert.match(paperText.stdout,/100,000 samples for estimation/);assert.match(paperText.stdout,/one-sided/);
const source=fs.readFileSync(core,'utf8');for(const text of ['self._sample_noise(x, n0, batch_size)','self._sample_noise(x, n, batch_size)','counts_estimation[cAHat]','* self.sigma','alpha=2 * alpha, method="beta"'])assert(source.includes(text));
const cases=[];for(const n of [1,2,5,10,30,100,200])for(const k of [...new Set([0,1,Math.floor(n/2),n-1,n])])for(const alpha of [.001,.01,.1])cases.push({k,n,alpha});
const quantiles=[1e-6,.0001,.001,.1,.25,.5,.75,.9,.999,.9999,1-1e-6];
// Independent oracle: Python's exact-integer combinations and NormalDist,
// no shared recurrence, normal series or third-party numeric dependency.
const py=spawnSync('python3',['-c',`import sys,json,math,statistics
d=json.load(sys.stdin)
def tail(k,n,p):
    return math.fsum(math.comb(n,j)*p**j*(1-p)**(n-j) for j in range(k,n+1))
def bound(c):
    k,n,a=c['k'],c['n'],c['alpha']
    if k==0:return 0.0
    lo,hi=0.0,1.0
    for _ in range(70):
        mid=(lo+hi)/2
        if tail(k,n,mid)<a:lo=mid
        else:hi=mid
    return (lo+hi)/2
print(json.dumps({'bounds':[bound(c) for c in d['cases']], 'quantiles':[statistics.NormalDist().inv_cdf(p) for p in d['quantiles']]}))`],{input:JSON.stringify({cases,quantiles}),encoding:'utf8',timeout:30000});assert.equal(py.status,0,py.stderr);const oracle=JSON.parse(py.stdout);
for(const [i,c] of cases.entries())close(m.lowerBound(c.k,c.n,c.alpha),oracle.bounds[i]);for(const [i,p] of quantiles.entries())close(m.normalQuantile(p),oracle.quantiles[i]);
let coverageChecks=0;for(let n=1;n<=30;n++)for(const alpha of [.001,.01,.1])for(const p of [.1,.25,.5,.75,.9]){let bad=0;for(let k=0;k<=n;k++)if(m.lowerBound(k,n,alpha)>p+1e-12){let choose=1;for(let j=1;j<=k;j++)choose*= (n-j+1)/j;bad+=choose*p**k*(1-p)**(n-k);}assert(bad<=alpha+1e-10);coverageChecks++;}
const outcomes=m.examples.map(e=>m.certify(e.selection,e.estimation));assert.deepEqual(outcomes.map(x=>x.abstain),[false,true,true,false]);assert.equal(outcomes[2].chosen,0);assert.equal(outcomes[2].k,10);assert(outcomes[3].pLower<1&&Number.isFinite(outcomes[3].radius));
assert.equal(m.certify([1,1],[9,1]).chosen,0,'Selection tie rule is first index');
const multiclass=m.certify([2,8,0],[5,90,5]);assert.equal(multiclass.chosen,1);assert.equal(multiclass.k,90);close(multiclass.radius,outcomes[0].radius);
assert(m.certify([5,0],[5,0],{alpha:.03125}).abstain,'Exact pLower = 0.5 gives no positive radius');
close(m.certify([8,2],[90,10],{sigma:.5}).radius,2*outcomes[0].radius);assert(m.lowerBound(90,100,.001)<m.lowerBound(90,100,.01));
for(const n of [1000,10000]){close(m.lowerBound(n,n,.001),Math.pow(.001,1/n));const p=m.lowerBound(n-1,n,.001);close(p**n+n*(1-p)*p**(n-1),.001,1e-9);}
let invalid=0;for(const f of [()=>m.lowerBound(-1,100,.001),()=>m.lowerBound(101,100,.001),()=>m.lowerBound(1.5,100,.001),()=>m.lowerBound(1,0,.001),()=>m.lowerBound(1,10001,.001),()=>m.lowerBound(1,10,0),()=>m.lowerBound(1,10,.2),()=>m.normalQuantile(1),()=>m.certify([0,0],[1,2]),()=>m.certify([1,2],[1]),()=>m.certify([1,2],[NaN,2]),()=>m.certify([1,2],[1,2],{sigma:0}),()=>m.certify([1,2],[1,2],{sigma:Infinity})]){assert.throws(f);invalid++;}
const unchanged=JSON.stringify(m.examples);m.examples.forEach(e=>m.certify(e.selection,e.estimation));assert.equal(JSON.stringify(m.examples),unchanged);
fs.writeFileSync('/home/ybc/notes-legacy-review-artifacts/smoothing-test.json',JSON.stringify({pdfHash,coreHash,independentBounds:cases.length,independentQuantiles:quantiles.length,coverageChecks,invalid,outcomes,scope:'Count calculations and finite coverage grid, not a proof of arbitrary-model robustness or verified floating-point arithmetic'},null,2)+'\n');
console.log(`${cases.length} independent binomial bounds, ${quantiles.length} normal quantiles, ${coverageChecks} coverage checks, ${invalid} invalid inputs; certificate/abstention fixtures passed`);
