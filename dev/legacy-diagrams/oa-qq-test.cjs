'use strict';
const center=require('./oa-center-content.cjs'),density=require('./oa-density-content.cjs');
const afterCenter=html=>density.next(center.next(html));
const box=require('./oa-box-content.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process'),c=require('./oa-qq-content.cjs');
const root=path.resolve(__dirname,'../..'),dir=process.env.NOTES_OA_QQ_EVIDENCE,python=process.env.NOTES_OA_QQ_PYTHON;
assert(dir&&python,'Set NOTES_OA_QQ_EVIDENCE and NOTES_OA_QQ_PYTHON (NumPy 2.3.3 / SciPy 1.16.2)');
const pins={'nist-plot.html':'899980e16f26a403c747406ddc31d32b575f43c02db74a64d2fae4ec8e6540e1','nist-ks.html':'dacc0eb88362dffc9b2beee19ea24e20060da5365f5be1bd2e7777986a549025','statsmodels.html':'de74d5c3ad033a91b97c3302f14bdcaceb1478a87931fcabbd175a6e6b689a60','shapiro.html':'b01d67d85c8cba367ca1d381c5504b25094d9a8fb719a3532b4267d7e2be4fbe','kstest.html':'adda24bbaa0a4761243235e154ec6e878359a9519db954069edc69cea5308eed'};
(async()=>{for(const [name,hash] of Object.entries(pins))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(dir+'/'+name)).digest('hex'),hash,name);
 const slide=fs.readFileSync('/home/ybc/content/unibo-course-slides/68996-Operational Analytics/7 - Statistics_ inferential.txt');assert.equal(crypto.createHash('sha256').update(slide).digest('hex'),'a1bb74f95203168b0e23701a5a5718f8b951347145ca8c84a8a1efd580004493');assert(slide.toString().includes('Example excel, data -4 -3 0.8 1.8 3.9 6.2 6.5'));
 const oracle=JSON.parse(execFileSync(python,['-B','-c',`import importlib.util, json, math
from fractions import Fraction
import numpy as np
import scipy
from scipy.stats import norm
assert np.__version__ == '2.3.3' and scipy.__version__ == '1.16.2'
spec = importlib.util.spec_from_file_location('qq', 'dev/legacy-diagrams/oa-qq-model.py')
qq = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qq)
cases = [qq.DATA, list(reversed(qq.DATA)), [1,1,1,2,2], [-1e6,0,1e6]]
cases += [[(i*i % 19) + i/13 for i in range(n)] for n in [2,3,4,5,7,8,31,50,100,1000]]
count = 0
for values in cases:
 r = qq.analyze(values)
 x = sorted(values)
 assert [v['observed'] for v in r['rows']] == x
 mu = sum(map(lambda v: Fraction(str(v)), x)) / len(x)
 var = sum((Fraction(str(v))-mu)**2 for v in x) / len(x)
 assert math.isclose(r['mean'], float(mu), rel_tol=1e-13, abs_tol=1e-13)
 assert math.isclose(r['scale']**2, float(var), rel_tol=1e-13)
 for i,row in enumerate(r['rows'],1):
  p = (2*i-1)/(2*len(x))
  assert row['p'] == p
  assert abs(row['z']-norm.ppf(p)) < 2e-14
  assert abs(norm.cdf(row['z'])-p) < 3e-16
  assert math.isclose(row['fitted'], float(mu)+math.sqrt(float(var))*norm.ppf(p), abs_tol=1e-9)
  count += 1
 assert qq.analyze(list(reversed(values))) == r
for bad in [[], [1], [1,1], [True,2], [None,2], [float('nan'),2], [float('inf'),2], [1e7,2], [1]*1001, 'wrong']:
 try: qq.analyze(bad)
 except ValueError: pass
 else: raise AssertionError('accepted invalid input')
r = qq.analyze(qq.DATA)
assert abs(r['mean']-61/35) < 1e-14
assert abs(r['scale']**2 - float(Fraction(36231,2450))) < 1e-12
print(json.dumps(dict(datasets=len(cases),points=count,numpy=np.__version__,scipy=scipy.__version__,example=r)))`],{cwd:root,encoding:'utf8'}));
 const m=c.model();assert.deepEqual(m,oracle.example);assert.equal(m.rows.length,7);assert(Math.abs(m.sampleSD-4.1536558767978295)<1e-14);
 const {parse,parseFragment}=await import('../contracts/node_modules/parse5/dist/index.js'),before=execFileSync('git',['show','dba7547:'+c.file],{cwd:root,encoding:'utf8'}),html=fs.readFileSync(root+'/'+c.file,'utf8'),errors=[];
 parse(html,{onParseError:e=>errors.push(e)});assert.deepEqual(errors,[]);assert.equal(afterCenter(box.next(require('./oa-dm-content.cjs').next(require('./oa-selection-content.cjs').next(c.next(before))))),html);assert.equal(c.next(html),html);
 for(const previous of ['oa-coin-content','oa-frequency-content'])assert.equal(require('./'+previous+'.cjs').next(html),html);
 for(let i=1;i<=11;i++){const re=new RegExp('<section id="s'+i+'"[^>]*>[\\s\\S]*?</section>');assert.equal(html.match(re)[0],afterCenter(box.next(before)).match(re)[0]);}
 const tail=s=>{const pos=s.indexOf("/* ---- Bespoke widget: confidence intervals on the z-scale ---- */");assert(pos>=0);return s.slice(pos);};assert.equal(tail(html),tail(before));
 const section=html.match(/<section id="s13"[^>]*>[\s\S]*?<\/section>/)[0];assert(!section.includes('p88t'));assert(!section.includes('points hug'));assert(!section.includes('font-size="10'));
 const fragment=parseFragment(section),codes=[];function walk(n){if(n.tagName==='code')codes.push(n.childNodes.map(x=>x.value||'').join(''));for(const ch of n.childNodes||[])walk(ch);}walk(fragment);assert.equal(codes.length,3); // reproduction, inline line='q', runnable test example
 const coordinates=execFileSync('python3',['-c',codes[0]],{encoding:'utf8'}).trim().split('\n').map(x=>x.split(' ').map(Number));assert.deepEqual(coordinates,m.rows.map(r=>[r.i,r.observed,r.p,r.z,r.fitted]));
 assert.equal(codes[2],fs.readFileSync(__dirname+'/oa-normality-example.py','utf8').trim());const results=execFileSync(python,['-c',codes[2]],{encoding:'utf8'});assert(results.includes('Some normal distribution: statistic=0.983372, p=0.241025; Do not reject H0'));assert(results.includes('Specified N(0, 1): statistic=1, p=0; Reject H0'));assert(results.includes('Specified N(100, 20²): statistic=0.0863609, p=0.421188; Do not reject H0'));
 fs.writeFileSync('/home/ybc/notes-legacy-review-artifacts/oa-qq-test.json',JSON.stringify({pins,oracle,executedExample:results,markup:true,scope:'Q–Q coordinates, normality example and section/quiz preservation; remaining OA sections are not certified'},null,2)+'\n');console.log(oracle.datasets+' datasets / '+oracle.points+' coordinates checked against SciPy; three named-null tests, code examples, markup and adjacent content passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
