'use strict';
const center=require('./oa-center-content.cjs'),density=require('./oa-density-content.cjs');
const afterCenter=html=>density.next(center.next(html));
const box=require('./oa-box-content.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process'),c=require('./oa-dm-content.cjs');
const root=path.resolve(__dirname,'../..'),dir=process.env.NOTES_OA_DM_EVIDENCE,python=process.env.NOTES_OA_DM_PYTHON;assert(dir&&python,'Set NOTES_OA_DM_EVIDENCE and pinned NumPy/SciPy/pandas Python');
const pins={'dm_test.py':'eaab208d0eb407fcc89c2f94ba8ba3fb5bd84040ad6f8075e7d35d4d3d0e8612','forecast.html':'6d9779e545a3bac4adf4e7dd6168db048cef2354ab7cd63fb38a5bd1e32fb9c3','cd.html':'0bb6e03256a945300e32eb831faee30b84302b617cc1ab268bc7017570977a0c','retrospective.pdf':'b61da48094d19d544bf13957b85b1da8b63c557e69cdbfe8db5cdf39a25efc3a'};
(async()=>{for(const [name,hash] of Object.entries(pins))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(dir+'/'+name)).digest('hex'),hash);
 const slide=fs.readFileSync('/home/ybc/content/unibo-course-slides/68996-Operational Analytics/7 - Statistics_ inferential.txt');assert.equal(crypto.createHash('sha256').update(slide).digest('hex'),'a1bb74f95203168b0e23701a5a5718f8b951347145ca8c84a8a1efd580004493');const text=slide.toString();
 const m=c.model(),lists=[...text.matchAll(/MLP = \[([^\]]+)\]/g)].map(x=>JSON.parse('['+x[1]+']'));assert.deepEqual(lists,[m.mlpList,m.mlpCode]);assert.deepEqual(m.mlpCode,m.mlpList.slice(1).concat(m.mlpList[0]));
 const captures=execFileSync('pdftotext',['-layout',dir+'/retrospective.pdf','-'],{encoding:'utf8'});assert(captures.includes('September 7, 2012'));assert(captures.includes('loss differential'));assert(captures.includes('serially correlated'));
 const arithmetic=JSON.parse(execFileSync(python,['-B','-c',`import importlib.util,json,math,sys
from fractions import Fraction as F
import numpy, scipy, pandas
from scipy.stats import ttest_1samp, t
assert numpy.__version__ == '2.3.3' and scipy.__version__ == '1.16.2' and pandas.__version__ == '2.3.2'
def load(name,path):
 s=importlib.util.spec_from_file_location(name,path); m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
ours=load('ours','dev/legacy-diagrams/oa-dm-model.py')
original=load('original',sys.argv[1]+'/dm_test.py')
for values in [ours.MLP_LIST,ours.MLP_CODE]:
 result=ours.calculate(ours.ACTUAL,values,ours.LSTM)
 original_result=original.dm_test(ours.ACTUAL,values,ours.LSTM,h=1,crit='MSE')
 assert math.isclose(result['statistic'],original_result.DM,rel_tol=1e-13)
 assert math.isclose(result['pvalue'],original_result.p_value,rel_tol=1e-13)
 a=list(map(lambda v:F(str(v)),ours.ACTUAL)); x=list(map(lambda v:F(str(v)),values)); y=list(map(lambda v:F(str(v)),ours.LSTM))
 d=[(v-p)**2-(v-q)**2 for v,p,q in zip(a,x,y)]; mu=sum(d)/12; gamma=sum((v-mu)**2 for v in d)/12
 assert math.isclose(result['mean'],float(mu),rel_tol=1e-13)
 assert math.isclose(result['gamma0'],float(gamma),rel_tol=1e-13)
 for expected,actual in zip(d,result['differences']): assert math.isclose(float(expected),actual,rel_tol=1e-12)
 assert math.isclose(result['statistic'],ttest_1samp(result['differences'],0).statistic,rel_tol=1e-13)
 swapped=ours.calculate(ours.ACTUAL,ours.LSTM,values)
 assert math.isclose(swapped['statistic'],-result['statistic'],rel_tol=1e-13) and math.isclose(swapped['pvalue'],result['pvalue'],rel_tol=1e-13)
 scaled=ours.calculate([2*v for v in ours.ACTUAL],[2*v for v in values],[2*v for v in ours.LSTM])
 assert math.isclose(scaled['statistic'],result['statistic'],rel_tol=1e-13)
 assert result['statistic'] > result['critical'] and result['pvalue'] < .05
for bad in [[], [1]*12, [True]*12, [float('nan')]*12, [float('inf')]*12, [1e7]*12]:
 try: ours.calculate(bad,[1]*12,[1]*12)
 except ValueError: pass
 else: raise AssertionError('Invalid or zero-variance case accepted')
assert abs(t.ppf(.975,11)-2.200985160082949)<1e-12
print(json.dumps(dict(model=ours.example(),sourceImplementationCompared=True,fractionalLossesChecked=24,swapAndScaleInvariance=True,numpy=numpy.__version__,scipy=scipy.__version__,pandas=pandas.__version__)))`,dir],{cwd:root,encoding:'utf8'}));assert.deepEqual(arithmetic.model,m,'Regenerate oa-dm-values.json from the Python model, not by hand');
 const {parse,parseFragment}=await import('../contracts/node_modules/parse5/dist/index.js'),html=fs.readFileSync(root+'/'+c.file,'utf8'),before=execFileSync('git',['show','e93df47:'+c.file],{cwd:root,encoding:'utf8'}),errors=[];parse(html,{onParseError:e=>errors.push(e)});assert.deepEqual(errors,[]);assert.equal(afterCenter(box.next(c.next(before))),html);assert.equal(c.next(html),html);
 for(const previous of ['oa-frequency-content','oa-coin-content','oa-qq-content','oa-selection-content'])assert.equal(require('./'+previous+'.cjs').next(html),html);
 for(let i=1;i<=13;i++){const re=new RegExp('<section id="s'+i+'"[^>]*>[\\s\\S]*?</section>');assert.equal(html.match(re)[0],afterCenter(box.next(before)).match(re)[0]);}
 assert.deepEqual(html.match(/<svg\b[\s\S]*?<\/svg>/g).filter(x=>!x.includes('oa-dm-alignment')),afterCenter(box.next(before)).match(/<svg\b[\s\S]*?<\/svg>/g));assert.deepEqual(html.match(/<script\b[\s\S]*?<\/script>/g),afterCenter(box.next(before)).match(/<script\b[\s\S]*?<\/script>/g));
 const section=html.match(/<section id="s14"[^>]*>[\s\S]*?<\/section>/)[0],fragment=parseFragment(section),codes=[];function walk(n){if(n.tagName==='code')codes.push(n.childNodes.map(x=>x.value||'').join(''));for(const ch of n.childNodes||[])walk(ch);}walk(fragment);assert.equal(codes.length,1);assert.equal(codes[0],fs.readFileSync(__dirname+'/oa-dm-model.py','utf8').trim());assert.deepEqual(JSON.parse(execFileSync(python,['-B','-c',codes[0]],{encoding:'utf8'})),m);
 for(const phrase of ['not ±1.96','do not identify which alignment is correct','not equivalence','lag zero','out-of-sample','not an exact finite-sample guarantee'])assert(section.includes(phrase),phrase);
 fs.writeFileSync('/home/ybc/notes-legacy-review-artifacts/oa-dm-test.json',JSON.stringify({pins,arithmetic,markup:true,scope:'Arithmetic reproduction of both printed orders, not verification of temporal alignment or out-of-sample provenance'},null,2)+'\n');console.log('Both slide orderings match pinned implementation; 24 exact-rational losses, model/embedded-code reproduction, markup and preserved sections passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
