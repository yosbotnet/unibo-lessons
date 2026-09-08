'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process'),c=require('./oa-inference-content.cjs'),m=require('../../oa/assets/inference.js');
const root=path.resolve(__dirname,'../..'),dir=process.env.NOTES_OA_INFERENCE_EVIDENCE,python=process.env.NOTES_OA_INFERENCE_PYTHON;assert(dir&&python,'Set NOTES_OA_INFERENCE_EVIDENCE and NOTES_OA_INFERENCE_PYTHON');
const pins={'ci.html':'8256f450266295e68e4f47ccda9432dd17237ba5685eb8715398a9501ea6709c','t-ci.html':'6e53ea9118336a08352533b01509dd695dc80ee714c26402c218451b44431860','prediction.html':'2dec2e5e94924458eb90b66b0eba2c07939af548c0ab7677da63923d8fa94071','student.html':'d66f14f5732ad7a24701f99c03b0acc28cec6d8b0d31549c027e2460e1a2be58','clt.pdf':'218b4b16b243a8df0a1c3a97edc5e6ce46601db0c66a6ab7ce64d12e709135eb'};
(async()=>{for(const [name,hash] of Object.entries(pins))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(dir+'/'+name)).digest('hex'),hash);
 const slide=fs.readFileSync('/home/ybc/content/unibo-course-slides/68996-Operational Analytics/7 - Statistics_ inferential.txt');assert.equal(crypto.createHash('sha256').update(slide).digest('hex'),'a1bb74f95203168b0e23701a5a5718f8b951347145ca8c84a8a1efd580004493');assert(slide.includes('repeated 20 times'));assert(slide.includes('95% of data'));
 const cases=[];for(let n=5;n<=200;n++)for(let level=800;level<=999;level++){const r=m.calculate(n,level);cases.push([n,level,r.z,r.t,r.se,...r.rows.flatMap(row=>[row.half,row.lo,row.hi]),r.axisHalf]);assert(r.rows.every(row=>row.lo>=r.center-r.axisHalf&&row.hi<=r.center+r.axisHalf));assert(r.t>r.z);assert(r.rows[2].half>r.rows[1].half);}
 for(let i=0;i<cases.length;i++)for(const j of [5,8,11]){if(i%200)assert(cases[i][j]>cases[i-1][j]);if(i>=200)assert(cases[i][j]<cases[i-200][j]);}
 const cdfs=[];for(let df=4;df<=199;df++)for(const t of [-20,-8,-3,-1,0,1,3,8,20])cdfs.push([df,t,m.studentCdf(t,df)]);
 const normalCdfs=Array.from({length:801},(_,i)=>{const z=(i-400)/100;return [z,m.normalCdf(z)];});
 const oracle=JSON.parse(execFileSync(python,['-B','-c',`import json,sys,math,random,statistics,contextlib,io,importlib.util
import numpy as np, scipy
from scipy import stats,integrate
assert np.__version__=='2.3.3' and scipy.__version__=='1.16.2'
d=json.load(sys.stdin);a=np.array(d['cases']);n=a[:,0];level=a[:,1]/1000
z=stats.norm.ppf((1+level)/2);t=stats.t.ppf((1+level)/2,n-1)
err_z=np.max(abs(z-a[:,2]));err_t=np.max(abs(t-a[:,3]))
assert err_z<1e-10 and err_t<2e-9
sample=np.array(d['traffic'],dtype=float);center=sample.mean();sd=sample.std(ddof=1)
assert center==4258 and math.isclose(sd,d['sd'],abs_tol=1e-12)
se=sd/np.sqrt(n);np.testing.assert_allclose(a[:,4],se,rtol=1e-14)
for j,half in enumerate([z*se,t*se,t*sd*np.sqrt(1+1/n)]):
 np.testing.assert_allclose(a[:,5+3*j],half,rtol=3e-10,atol=1e-9)
 np.testing.assert_allclose(a[:,6+3*j],center-half,rtol=3e-10,atol=1e-7)
 np.testing.assert_allclose(a[:,7+3*j],center+half,rtol=3e-10,atol=1e-7)
for row in d['cdfs']:
 assert abs(stats.t.cdf(row[1],row[0])-row[2])<1e-13
b=np.array(d['normalCdfs']);assert np.max(abs(stats.norm.cdf(b[:,0])-b[:,1]))<1e-13
# Direct CDF coverage checks, not only inverse-vs-inverse agreement.
assert np.max(abs((2*stats.t.cdf(a[:,3],n-1)-1)-level))<1e-12
assert np.max(abs((2*stats.norm.cdf(a[:,2])-1)-level))<1e-12
model=d['model'];normal=np.array(model['normal'])
np.testing.assert_allclose(normal[:,1],stats.norm.pdf(normal[:,0]),rtol=2e-15)
for band in model['bands']:
 k=band['k'];mass=integrate.quad(stats.norm.pdf,-k,k)[0];assert abs(mass-band['mass'])<1e-14
for row in model['clt']:
 nn=row['n'];values=np.array(row['rows']);xx=1+values[:,0]/np.sqrt(nn)
 expected=stats.gamma.pdf(xx,a=nn,scale=1/nn)/np.sqrt(nn)
 np.testing.assert_allclose(values[:,1],expected,rtol=2e-13,atol=1e-14)
 assert row['se']==1/math.sqrt(nn) and row['skew']==2/math.sqrt(nn)
 assert abs(integrate.quad(lambda x: stats.gamma.pdf(x,a=nn,scale=1/nn),0,np.inf)[0]-1)<1e-10
 # Cauchy counterexample: product characteristic functions of X_i/n.
 for u in [-3,-.1,0,.1,3]: assert math.isclose(math.exp(-abs(u)/nn)**nn,math.exp(-abs(u)),rel_tol=1e-14)
scopes={}
for name,code in d['codes'].items():
 scope={}
 with contextlib.redirect_stdout(io.StringIO()): exec(code,scope)
 scopes[name]=scope
cov=scopes['coverage'];assert cov['covered']==model['covered']==18
for i,row in enumerate(model['coverage']):
 np.testing.assert_array_equal(row['sample'],cov['samples'][i])
 assert row['mean']==statistics.mean(row['sample'])
 assert row['lo']==cov['intervals'][i][0] and row['hi']==cov['intervals'][i][1]
 assert row['covers']==(row['lo']<=100<=row['hi'])
 assert 80<=row['lo']<row['hi']<=130
np.testing.assert_allclose(scopes['clt']['exact'],np.array(model['clt'][-1]['rows'])[:,1],rtol=2e-13,atol=1e-14)
r=d['default'];np.testing.assert_allclose(scopes['width']['halves'],[row['half'] for row in r['rows']],rtol=1e-10)
# Known-normal coverage event algebra: each CI covers iff |standardized mean| <= z.
for row in model['coverage']:
 zscore=(row['mean']-100)/(20/math.sqrt(10));assert row['covers']==(abs(zscore)<=stats.norm.ppf(.975))
print(json.dumps(dict(widgetCases=len(a),studentCdfCases=len(d['cdfs']),normalCdfCases=len(b),maxZError=float(err_z),maxTError=float(err_t),cltCoordinates=3*801,normalCoordinates=801,seededSamples=20,observations=200,covered=18,executedExamples=3,numpy=np.__version__,scipy=scipy.__version__)))`],{input:JSON.stringify({cases,cdfs,normalCdfs,model:c.data,traffic:require('../../oa/assets/frequency.js').data,sd:m.sd,default:m.calculate(),codes:{clt:c.cltCode,coverage:c.coverageCode,width:c.widthCode}}),encoding:'utf8',env:{...process.env,OPENBLAS_NUM_THREADS:'1'},maxBuffer:4*1024*1024,timeout:60000}));
 for(const args of [[4,950],[201,950],[31,799],[31,1000],[31,950.1],[NaN,950],['31',950]])assert.throws(()=>m.calculate(...args));for(const args of [[21,4],[0,3],[0,200],[NaN,4],[0,4.5]])assert.throws(()=>m.studentCdf(...args));assert.throws(()=>m.normalCdf(5));
 for(let level=800;level<=999;level++){let previous=Infinity;for(let n=5;n<=200;n++){const r=m.calculate(n,level);assert(r.rows[2].half<previous);previous=r.rows[2].half;}}
 const {parse,parseFragment}=await import('../contracts/node_modules/parse5/dist/index.js'),html=fs.readFileSync(root+'/'+c.file,'utf8'),before=execFileSync('git',['show','3342846:'+c.file],{cwd:root,encoding:'utf8'}),errors=[];parse(html,{onParseError:e=>errors.push(e)});assert.deepEqual(errors,[]);assert.equal(c.next(before),html);assert.equal(c.next(html),html);
 for(const prev of ['frequency','coin','qq','selection','dm','box','center','density'])assert.equal(require('./oa-'+prev+'-content.cjs').next(html),html);
 for(let i=1;i<=14;i++){if([8,9].includes(i))continue;const re=new RegExp('<section id="s'+i+'"[^>]*>[\\s\\S]*?</section>');assert.equal(html.match(re)[0],before.match(re)[0]);}
 const svg=s=>s.match(/<svg\b[\s\S]*?<\/svg>/g);assert.deepEqual(svg(html).filter(x=>!x.includes('data-generated-plot="oa-inference-')),svg(before).filter(x=>!x.includes('p83t')&&!x.includes('normal84-')&&!x.includes('normal85-')));
 const scripts=s=>c.stripOldWidget(s).match(/<script\b[\s\S]*?<\/script>/g).filter(x=>!x.includes('src="assets/inference'));assert.deepEqual(scripts(html),scripts(before));assert(!html.includes('ci-canvas'));assert.equal((html.match(/class="oa-w"/g)||[]).length,5);
 const fragment=parseFragment(c.section8()+c.section9()),codes=[];function walk(n,svg=false){svg=svg||n.tagName==='svg';if(svg&&n.tagName)assert.equal(n.namespaceURI,'http://www.w3.org/2000/svg');if(n.tagName==='code'&&n.attrs.some(a=>a.name==='class'&&a.value==='language-python'))codes.push(n.childNodes.map(x=>x.value||'').join(''));for(const ch of n.childNodes||[])walk(ch,svg);}walk(fragment);assert.deepEqual(codes,[c.cltCode,c.coverageCode,c.widthCode]);
 fs.writeFileSync('/home/ybc/notes-legacy-review-artifacts/oa-inference-test.json',JSON.stringify({pins,oracle,markup:true,scope:'Sections 8–9: conditional iid formulas and labelled synthetic illustrations; not validated inference on traffic or the full site'},null,2)+'\n');console.log(oracle);
})().catch(e=>{console.error(e);process.exitCode=1;});
