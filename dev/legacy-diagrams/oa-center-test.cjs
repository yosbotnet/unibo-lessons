'use strict';
const inference=require('./oa-inference-content.cjs');
const density=require('./oa-density-content.cjs');
const afterDensity=html=>inference.next(density.next(html));
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process'),c=require('./oa-center-content.cjs'),m=require('../../oa/assets/center.js');
const root=path.resolve(__dirname,'../..'),dir=process.env.NOTES_OA_CENTER_EVIDENCE,python=process.env.NOTES_OA_CENTER_PYTHON;assert(dir&&python,'Set NOTES_OA_CENTER_EVIDENCE and NOTES_OA_CENTER_PYTHON');
const pins={'location.html':'adf75a38b7a66f92913781f8c25a070f499bdd78bd7c46633c0f1bdfb83c5f20','mode.html':'c8ecf15aa733c57d62853cb8763054b44ef3184577cde9b8624e4283ddefb312','pandas-std.html':'a2193b95d01f6fd11e80090deb4fa08dee57ae862eb8d2be14bdb0f30670d396','quantile.html':'17760a8178ca318cb564736bb29ca60b0468812695eb676ce1823784ad282923','variance.html':'1b64e87b04b881b95c882d9aefd4aa0ef88de887240a4cce7055f74fe3089ef9','variation.html':'5135a1595722721cd5ec71572edf268b9975ffb9077a73c0bcc2d1dba933b631','cv.html':'f98dac5de84a81c473a0bc02552d62c2bc2a28e8d4310839125c48b75190a0b0','excel.html':'fd01daddc38c97a79c739d6846be990b966bffc40b5a2c0aad8eeed26dde7376'};
(async()=>{for(const [name,hash] of Object.entries(pins))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(dir+'/'+name)).digest('hex'),hash);
 const slide=fs.readFileSync('/home/ybc/content/unibo-course-slides/68996-Operational Analytics/6 - Statistics_ descriptive.txt');assert.equal(crypto.createHash('sha256').update(slide).digest('hex'),'c09011b7437bb9972d69782bcad922adef16023ca08b4a9f7b9d30acbb6c929c');for(const values of [m.speeds,m.hotels])assert(slide.includes(values.join(', ')));assert(slide.includes('If average=median=mode then the data are called symmetric.'));assert(slide.includes('stats.variation(npa)'));
 const cases=Array.from({length:101},(_,i)=>m.synthetic(i*5-250)),speeds=m.summarize(m.speeds),hotels=m.summarize(m.hotels);
 const oracle=JSON.parse(execFileSync(python,['-B','-c',`import json,sys,math,itertools,contextlib,io
from fractions import Fraction as F
import numpy as np,pandas as pd,scipy
from scipy import stats
assert np.__version__=='2.3.3' and scipy.__version__=='1.16.2' and pd.__version__=='2.3.2'
data=json.load(sys.stdin)
for r in data['cases']:
 a=r['a'];u=(np.arange(121)-60)/60
 x=100+60*u if a==0 else 100+60*np.expm1(a*u)/a
 np.testing.assert_allclose(r['values'],x,rtol=1e-14,atol=1e-12)
 assert len(np.unique(x))==121 and np.median(x)==100
 assert math.isclose(r['mean'],x.mean(),rel_tol=1e-14,abs_tol=1e-12)
 counts,edges=np.histogram(x,bins=np.linspace(x.min(),x.max(),15))
 np.testing.assert_array_equal(counts,r['hist']['counts'])
 np.testing.assert_allclose(edges,r['hist']['edges'],atol=1e-12)
 assert r['modalBins']==(np.flatnonzero(counts==counts.max())+1).tolist()
 assert r['maxCount']==1 and len(r['modes'])==121
for r in [data['speeds'],data['hotels']]:
 x=list(map(F,r['values']));mean=sum(x)/len(x);ss=sum((v-mean)**2 for v in x)
 assert math.isclose(float(mean),r['mean'],rel_tol=1e-14)
 assert math.isclose(float(ss),r['ss'],rel_tol=1e-14)
 for i,v in enumerate(x):
  # Subtracting a rounded binary mean introduces ~1.9e-14 absolute error here.
  assert math.isclose(float(v-mean),r['deviations'][i],rel_tol=1e-14,abs_tol=1e-12)
  assert math.isclose(float((v-mean)**2),r['squares'][i],rel_tol=1e-14,abs_tol=1e-12)
 for d in [0,1]:
  assert math.isclose(float(ss/(len(x)-d)),r['variance'+str(d)],rel_tol=1e-14)
  assert math.isclose(100*stats.variation(r['values'],ddof=d),r['cv'+str(d)],rel_tol=1e-14)
 assert r['modes']==pd.Series(r['values']).mode().tolist()
x=list(map(F,data['speeds']['values']));assert sum(x)==960
assert sum((v-sum(x)/7)**2 for v in x)==F(16134,7)
assert round(data['speeds']['sd0'],2)==18.15
scope={}
with contextlib.redirect_stdout(io.StringIO()): exec(data['numericCode'],scope)
assert scope['ss']==data['speeds']['ss']
assert scope['stats'].variation(scope['x'])!=scope['stats'].variation(scope['x'],ddof=1)
assert np.allclose(pd.Series(scope['x']).quantile([.25,.5,.75],interpolation='linear'),[124,132,148.5])
assert stats.mode([-2,-2,-1,1,2,2]).count==2 # one mode returned despite the tie
with contextlib.redirect_stdout(io.StringIO()): exec(data['syntheticCode'],scope)
np.testing.assert_array_equal(scope['counts'],data['cases'][80]['hist']['counts']) # a=1.5
# Exact finite-population enumeration: iid draws with replacement, n=3.
population=list(map(F,[-2,1,4]));mu=F(1);var=F(6);vn=[];s2=[];known=[]
for draw in itertools.product(population,repeat=3):
 mean=sum(draw)/3;ss=sum((v-mean)**2 for v in draw)
 vn.append(ss/3);s2.append(ss/2);known.append(sum((v-mu)**2 for v in draw)/3)
assert sum(vn)/27==4 and sum(s2)/27==var and sum(known)/27==var
assert sum(math.sqrt(v) for v in s2)/27 < math.sqrt(var)
print(json.dumps(dict(sliderCases=len(data['cases']),coordinates=121*len(data['cases']),bins=14*len(data['cases']),exactSourceRows=13,enumeratedSamples=27,numpy=np.__version__,scipy=scipy.__version__,pandas=pd.__version__,executedPythonExamples=2)))`],{input:JSON.stringify({cases,speeds,hotels,syntheticCode:c.syntheticCode,numericCode:c.numericCode}),encoding:'utf8',maxBuffer:8*1024*1024}));
 for(const r of cases){assert.equal(r.n,121);assert.equal(r.median,100);assert.equal(r.maxCount,1);assert.equal(r.modes.length,121);assert.equal(r.hist.counts.reduce((a,b)=>a+b,0),121);assert.equal(r.hist.excluded,0);const reverse=m.synthetic(-r.setting);assert(Math.abs(r.mean+reverse.mean-200)<1e-12);r.values.forEach((v,i)=>assert(Math.abs(v+reverse.values[120-i]-200)<1e-12));}
 assert.equal(speeds.sd0.toFixed(2),'18.15');assert.equal(speeds.cv0.toFixed(2),'13.23');assert.equal(speeds.cv1.toFixed(2),'14.29');
 for(const values of [m.speeds,m.hotels,m.asymmetric,m.bimodal]){const r=m.summarize(values),twice=m.summarize(values.map(v=>v*2)),shift=m.summarize(values.map(v=>v+100));assert(Math.abs(twice.sd1-2*r.sd1)<1e-12);assert(Math.abs(shift.variance1-r.variance1)<1e-12);if(r.cv1!==null){assert(Math.abs(twice.cv1-r.cv1)<1e-12);assert.notEqual(shift.cv1,r.cv1);}}
 const a=m.summarize(m.asymmetric),b=m.summarize(m.bimodal);assert.deepEqual([a.mean,a.median,...a.modes],[0,0,0]);assert.notDeepEqual([...m.asymmetric].sort((a,b)=>a-b),m.asymmetric.map(v=>-v).sort((a,b)=>a-b));assert.deepEqual([...m.bimodal],m.bimodal.map(v=>-v).reverse());assert.deepEqual(b.modes,[-2,2]);assert.equal(a.cv0,null);
 for(const value of [1,-251,251,NaN,'0',Infinity])assert.throws(()=>m.synthetic(value));for(const values of [[],[1],Array(3),[1,NaN],[1,Infinity],[true,2]])assert.throws(()=>m.summarize(values));
 const {parse,parseFragment}=await import('../contracts/node_modules/parse5/dist/index.js'),html=fs.readFileSync(root+'/'+c.file,'utf8'),before=execFileSync('git',['show','b958bb4:'+c.file],{cwd:root,encoding:'utf8'}),errors=[];parse(html,{onParseError:e=>errors.push(e)});assert.deepEqual(errors,[]);assert.equal(afterDensity(c.next(before)),html);assert.equal(c.next(html),html);
 for(const prev of ['frequency','coin','qq','selection','dm','box'])assert.equal(require('./oa-'+prev+'-content.cjs').next(html),html);
 for(let i=1;i<=14;i++){if([3,4,5].includes(i))continue;const re=new RegExp('<section id="s'+i+'"[^>]*>[\\s\\S]*?</section>');assert.equal(html.match(re)[0],afterDensity(before).match(re)[0]);}
 assert.deepEqual(html.match(/<svg\b[\s\S]*?<\/svg>/g).filter(x=>!x.includes('data-generated-plot="oa-center"')&&!x.includes('data-generated-plot="oa-symmetry"')),afterDensity(before).match(/<svg\b[\s\S]*?<\/svg>/g));
 const scripts=s=>c.stripOldWidget(s).match(/<script\b[\s\S]*?<\/script>/g).filter(x=>!x.includes('src="assets/center'));assert.deepEqual(scripts(html),scripts(inference.next(c.stripOldWidget(before))));
 const fragment=parseFragment(c.section3()+c.section4()+c.section5()),codes=[];function walk(n){if(n.tagName==='code'&&n.attrs.some(a=>a.name==='class'&&a.value==='language-python'))codes.push(n.childNodes.map(x=>x.value||'').join(''));for(const ch of n.childNodes||[])walk(ch);}walk(fragment);assert.equal(codes.length,3);assert.equal(codes[0],c.syntheticCode);assert.equal(codes[2],c.numericCode);
 assert(!html.includes('sk-canvas'));assert.equal((html.match(/class="oa-w"/g)||[]).length,5);assert(!html.includes('if average = median = mode then'));assert(c.section5().includes('centers on μ, not on x̄'));
 fs.writeFileSync('/home/ybc/notes-legacy-review-artifacts/oa-center-test.json',JSON.stringify({pins,oracle,markup:true,scope:'Sections 3–5, synthetic counterexamples and model-based variance identities; no certification of subsequent inference sections'},null,2)+'\n');console.log(oracle);
})().catch(e=>{console.error(e);process.exitCode=1;});
