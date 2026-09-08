'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process'),c=require('./oa-density-content.cjs');
const root=path.resolve(__dirname,'../..'),dir=process.env.NOTES_OA_DENSITY_EVIDENCE,python=process.env.NOTES_OA_DENSITY_PYTHON;assert(dir&&python,'Set NOTES_OA_DENSITY_EVIDENCE and NOTES_OA_DENSITY_PYTHON');
const pins={'norm.html':'3596d32784c43caac94b8c7a01890f17aef08370fa6ff011b8bbc97ee9d50e14','fitter.html':'5b03cc7631a365b0777b0a429d2a0dcfef207ded1a89afca315949eb4868aef8','functions.html':'79e56f30ab5f4613b2a3abc33af4188187c3df28e006adf3265fec9ac9101630','fitter-pypi.json':'1a739a196f183b847c042830aadc922240d224ce1782ca83e7ced42e00dded8a','distfit-pypi.json':'d4683ea2279688f07147ee85da120c5c002008a75caa19e6c12b1bc95c620c99'};
(async()=>{for(const [name,hash] of Object.entries(pins))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(dir+'/'+name)).digest('hex'),hash);
 const slide=fs.readFileSync('/home/ybc/content/unibo-course-slides/68996-Operational Analytics/6 - Statistics_ descriptive.txt');assert.equal(crypto.createHash('sha256').update(slide).digest('hex'),'c09011b7437bb9972d69782bcad922adef16023ca08b4a9f7b9d30acbb6c929c');assert(slide.includes("'normal'"));assert(slide.includes('Cumulative Density function'));
 const oracle=JSON.parse(execFileSync(python,['-B','-c',`import json,sys,math,io,contextlib,importlib.util,importlib.metadata,hashlib
import numpy as np, scipy, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from scipy import stats,integrate
data=json.load(sys.stdin)
versions={p:importlib.metadata.version(p) for p in ['numpy','scipy','pandas','matplotlib','fitter','distfit']}
assert versions==dict(numpy='2.3.3',scipy='1.16.2',pandas='2.3.3',matplotlib='3.10.7',fitter='1.8.0',distfit='2.0.2')
spec=importlib.util.spec_from_file_location('model',data['modelPath']);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
r=data['model'];rows=np.array(r['rows']);rv=stats.norm(loc=r['mu'],scale=r['sigma'])
np.testing.assert_allclose(rows[:,1],rv.pdf(rows[:,0]),rtol=3e-15,atol=1e-15)
np.testing.assert_allclose(rows[:,2],rv.cdf(rows[:,0]),rtol=3e-15,atol=1e-15)
area,error=integrate.quad(rv.pdf,r['a'],r['b'],epsabs=1e-13)
assert math.isclose(area,r['area'],abs_tol=1e-14)
assert math.isclose(integrate.quad(rv.pdf,-np.inf,np.inf)[0],1,abs_tol=1e-12)
assert r['peak']>1 and r['pointProbability']==0
assert rv.cdf(0)-rv.cdf(0)==0
assert np.all(np.diff(rows[:,2])>0) and rows[0,2]>0 and rows[-1,2]<1
for mu in [-2,0,3]:
 for sd in [.1,.25,.5,1,2,10]:
  for z in [-10,-4,-1,0,1,4,10]:
   x=mu+z*sd
   np.testing.assert_allclose(m.normal(x,mu,sd),[stats.norm.pdf(x,mu,sd),stats.norm.cdf(x,mu,sd)],rtol=1e-13,atol=1e-15)
for args in [(0,0,0),(0,0,-1),(True,0,1),(0,0,float('inf')),(float('nan'),0,1),('0',0,1)]:
 try: m.normal(*args)
 except ValueError: pass
 else: raise AssertionError(args)
# PMF and CDF endpoint conventions, independent finite sample space.
die=stats.randint(1,7)
assert math.isclose(die.pmf(3),1/6) and die.cdf(3)==.5
assert math.isclose(die.cdf(4)-die.cdf(2),sum(die.pmf([3,4])))
results={}
for name,code in data['codes'].items():
 scope={}
 with contextlib.redirect_stdout(io.StringIO()): exec(code,scope)
 if name=='normal':
  axes=scope['axes'];assert all(len(ax.lines)==3 for ax in axes)
  for k,ax in enumerate(axes):
   for sd,line in zip([.5,1,2],ax.lines):
    np.testing.assert_array_equal(line.get_ydata(),(stats.norm.cdf if k else stats.norm.pdf)(scope['x'],loc=0,scale=sd))
  assert math.isclose(scope['rv'].pdf(0),r['peak'],abs_tol=1e-14)
  assert math.isclose(scope['rv'].cdf(.25)-scope['rv'].cdf(-.25),r['area'],abs_tol=1e-14)
  results[name]={'lines':6,'pointsPerLine':1001}
 else:
  sample=scope['data'];assert len(sample)==10000
  expected_rng=np.random.default_rng(20260908)
  expected=(stats.gamma.rvs(2,loc=1.5,scale=2,size=10000,random_state=expected_rng) if name=='fitter' else expected_rng.normal(loc=0,scale=2,size=10000))
  np.testing.assert_array_equal(sample,expected)
  density,edges=np.histogram(sample,bins=100,density=True);centers=(edges[:-1]+edges[1:])/2
  assert math.isclose(np.sum(density*np.diff(edges)),1,abs_tol=1e-14)
  scores={};params={}
  for candidate in scope['candidates']:
   dist=getattr(stats,candidate);p=dist.fit(sample);pdf=dist.pdf(centers,*p)
   expected_score=np.sum((density-pdf)**2)
   assert math.isfinite(expected_score)
   assert math.isclose(scope['scores'][candidate],expected_score,rel_tol=1e-12,abs_tol=1e-14)
   fitted=(scope['f'].fitted_param[candidate] if name=='fitter' else scope['dfit'].summary.set_index('name').loc[candidate,'params'])
   np.testing.assert_array_equal(fitted,p)
   scores[candidate]=float(expected_score);params[candidate]=list(p)
  ax=scope['ax'];assert len(ax.patches)==100 and len(ax.lines)==1
  best=min(scores,key=scores.get)
  assert best==(scope['name'] if name=='fitter' else scope['dfit'].model['name'])
  np.testing.assert_array_equal(ax.lines[0].get_ydata(),getattr(stats,best).pdf(scope['grid'],*params[best]))
  for i,bar in enumerate(ax.patches):
   assert math.isclose(bar.get_height(),density[i],abs_tol=1e-14)
  if name=='distfit':
   assert scope['dfit'].n_boots is None and scope['dfit'].stats=='RSS'
   assert best=='gamma' and scores['gamma']<scores['norm'] # normal-generated sample need not select norm
  results[name]={'scores':scores,'params':params,'best':best,'histogramBars':100,'curvePoints':501}
 plt.close('all')
import fitter.fitter as fm,distfit.distfit as dm
package_pins={}
for name,mod,expected in [('fitter',fm,'91653e61208ccd5aab14b5049b29d4a5e62866a8a86cd02f4847c715e140e0fa'),('distfit',sys.modules['distfit.distfit'],'622f3ef61f62e8fe2cd5dabc33b2c5ff2d027bfbfb733c3589cc923c67b00ee1')]:
 actual=hashlib.sha256(open(mod.__file__,'rb').read()).hexdigest();assert actual==expected;package_pins[name]=actual
print(json.dumps(dict(versions=versions,packagePins=package_pins,curvePoints=len(rows),normalCases=126,areaByQuadrature=area,quadratureError=error,examples=results)))`],{input:JSON.stringify({model:c.data,modelPath:__dirname+'/oa-density-model.py',codes:{normal:c.normalCode,fitter:c.fitterCode,distfit:c.distfitCode}}),encoding:'utf8',env:{...process.env,OPENBLAS_NUM_THREADS:'1',MPLBACKEND:'Agg'},timeout:60000,maxBuffer:2*1024*1024}));
 const {parse,parseFragment}=await import('../contracts/node_modules/parse5/dist/index.js'),html=fs.readFileSync(root+'/'+c.file,'utf8'),before=execFileSync('git',['show','1ae5c7a:'+c.file],{cwd:root,encoding:'utf8'}),errors=[];parse(html,{onParseError:e=>errors.push(e)});assert.deepEqual(errors,[]);assert.equal(c.next(before),html);assert.equal(c.next(html),html);
 for(const prev of ['frequency','coin','qq','selection','dm','box','center'])assert.equal(require('./oa-'+prev+'-content.cjs').next(html),html);
 for(let i=1;i<=14;i++){if(i===7)continue;const re=new RegExp('<section id="s'+i+'"[^>]*>[\\s\\S]*?</section>');assert.equal(html.match(re)[0],before.match(re)[0]);}
 assert.deepEqual(html.match(/<script\b[\s\S]*?<\/script>/g),before.match(/<script\b[\s\S]*?<\/script>/g));
 assert.deepEqual(html.match(/<svg\b[\s\S]*?<\/svg>/g).filter(s=>!s.includes('data-generated-plot="oa-density"')),before.match(/<svg\b[\s\S]*?<\/svg>/g));
 const fragment=parseFragment(c.section()),codes=[],svgs=[];function walk(n,inSvg=false){const svg=inSvg||n.tagName==='svg';if(n.tagName==='svg')svgs.push(n);if(svg&&n.tagName)assert.equal(n.namespaceURI,'http://www.w3.org/2000/svg');if(n.tagName==='code'&&n.attrs.some(a=>a.name==='class'&&a.value==='language-python'))codes.push(n.childNodes.map(x=>x.value||'').join(''));for(const child of n.childNodes||[])walk(child,svg);}walk(fragment);assert.equal(svgs.length,1);assert.deepEqual(codes,[c.normalCode,c.fitterCode,c.distfitCode]);assert.equal((c.svg().match(/data-density-curve=/g)||[]).length,2);assert(!c.svg().includes('<sub'));assert(!c.svg().includes('<sup'));
 fs.writeFileSync('/home/ybc/notes-legacy-review-artifacts/oa-density-test.json',JSON.stringify({pins,oracle,markup:true,scope:'Section 7 and PDF/PMF/CDF quiz only; later sampling and CI sections remain unreviewed'},null,2)+'\n');console.log(oracle);
})().catch(e=>{console.error(e);process.exitCode=1;});
