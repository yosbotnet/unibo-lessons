'use strict';
const inference=require('./oa-inference-content.cjs');
const center=require('./oa-center-content.cjs'),density=require('./oa-density-content.cjs');
const afterCenter=html=>inference.next(density.next(center.next(html)));
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process'),c=require('./oa-box-content.cjs'),m=require('../../oa/assets/boxplot.js');
const root=path.resolve(__dirname,'../..'),dir=process.env.NOTES_OA_BOX_EVIDENCE,python=process.env.NOTES_OA_BOX_PYTHON;assert(dir&&python,'Set NOTES_OA_BOX_EVIDENCE and NOTES_OA_BOX_PYTHON');
const pins={'boxplot.html':'8bac0a76a9fc3547aff6f661d53efbbb5087bbe73c48df63522854465bf64278','nist-scatter.html':'e5513bb13f6210b4e0a8085aa03c47000ebf5746e6d026c87be4aeb30fc650df','outliers.html':'1c7c3357e3f67b47b66efc63e884296c3f667b350feed6cd40b539c641825ba9','quantile.html':'17760a8178ca318cb564736bb29ca60b0468812695eb676ce1823784ad282923','scatter.html':'64aa66a6ce2c73d80604530c6bf1a3b19464c284b9ed8984d3a4fc36d102e54b'};
(async()=>{
 for(const [name,hash] of Object.entries(pins))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(dir+'/'+name)).digest('hex'),hash);
 const slide=fs.readFileSync('/home/ybc/content/unibo-course-slides/68996-Operational Analytics/6 - Statistics_ descriptive.txt');assert.equal(crypto.createHash('sha256').update(slide).digest('hex'),'c09011b7437bb9972d69782bcad922adef16023ca08b4a9f7b9d30acbb6c929c');assert(slide.includes(m.roads.join(', ')));assert(slide.includes("plt.scatter(df['ago1'].sort_values(),df['set1'].sort_values() )"));
 const cases=Array.from({length:6501},(_,i)=>m.traffic(i+3000)),road=m.summarize(m.roads,'halves');assert.deepEqual([road.q1,road.median,road.q3,road.iqr,road.lower,road.upper,road.whiskerLow,road.whiskerHigh],[69,74,77,8,57,89,62,80]);assert.equal(road.outliers.length,0);
 const extras=[[0,0,0,0,9],[0,1,2,3,4,5,6],[-100,0,1,2,3,4,100],[4,4],[0,1],[0,0,0,0,0],[0,1,2,3,6],[0,1,2,3,6.01]];
 const arithmetic=JSON.parse(execFileSync(python,['-B','-c',`import json,sys,math,os
os.environ['MPLBACKEND']='Agg'
os.environ['MPLCONFIGDIR']=sys.argv[1]+'/mpl-config'
import numpy as np, scipy, pandas as pd, matplotlib
import matplotlib.pyplot as plt
from matplotlib.cbook import boxplot_stats
from scipy.stats import pearsonr, norm
from fractions import Fraction as F
assert np.__version__=='2.3.3' and scipy.__version__=='1.16.2' and pd.__version__=='2.3.2' and matplotlib.__version__=='3.10.6'
data=json.load(sys.stdin)
for r in data['cases']+data['extras']:
 a=np.array(r['values']); ref=boxplot_stats(a,whis=1.5,autorange=False)[0]
 for our,key in [('q1','q1'),('median','med'),('q3','q3'),('mean','mean'),('iqr','iqr'),('whiskerLow','whislo'),('whiskerHigh','whishi')]:
  assert math.isclose(r[our],ref[key],rel_tol=1e-13,abs_tol=1e-12),(our,r,ref)
 assert sorted(p['value'] for p in r['outliers'])==sorted(ref['fliers'].tolist())
 assert r['lower']==r['q1']-1.5*r['iqr'] and r['upper']==r['q3']+1.5*r['iqr']
 # Independent rational interpolation for the three quantiles, including boundaries.
 s=sorted(F(str(x)) for x in r['values'])
 for p,key in [(F(1,4),'q1'),(F(1,2),'median'),(F(3,4),'q3')]:
  pos=(len(s)-1)*p;lo=pos.numerator//pos.denominator;hi=math.ceil(pos)
  assert math.isclose(float(s[lo]+(s[hi]-s[lo])*(pos-lo)),r[key],rel_tol=1e-13,abs_tol=1e-12)
for code in [data['roadCode'],data['scatterCode']]:
 scope={};exec(compile(code,'chapter example','exec'),scope)
 if 'speeds' in scope:
  assert (scope['q1'],scope['med'],scope['q3'])==(69,74,77)
  assert scope['fliers'].size==0
  np.testing.assert_allclose(scope['ax'].lines[0].get_xdata(),[69,69,77,77,69])
 else:
  for ax,key in zip(scope['axes'],['xy','wrong']): np.testing.assert_array_equal(ax.collections[0].get_offsets(),scope[key])
 plt.close('all')
xy=np.array([[p['x'],p['y']] for p in data['pairs']]); wrong=np.sort(xy,axis=0)
assert abs(pearsonr(xy[:,0],xy[:,1]).statistic)<1e-15
assert abs(pearsonr(wrong[:,0],wrong[:,1]).statistic-1)<1e-15
# Matplotlib uses supplied positions even for differently ordered pandas indexes.
df=pd.DataFrame({'ago1':xy[:,0], 'set1':xy[:,1]},index=['A','B','C','D','E'])
fig,ax=plt.subplots(); dots=ax.scatter(df['ago1'].sort_values(),df['set1'].sort_values())
np.testing.assert_array_equal(dots.get_offsets(),wrong)
plt.close('all')
# Joint filtering retains the original matched rows; sorting whole rows preserves pairs.
df.loc['B','ago1']=np.nan;df.loc['D','set1']=np.nan
scope={'df':df,'plt':plt};exec(data['pairingCode'],scope)
paired=scope['paired'];assert paired.index.tolist()==['A','C','E']
np.testing.assert_array_equal(plt.gca().collections[0].get_offsets(),[[1,4],[3,3],[5,2]])
assert sorted(map(tuple,paired.to_numpy()))==sorted(map(tuple,paired.sort_values('set1').to_numpy()))
plt.close('all')
assert abs(2*norm.sf(3)-0.0026997960632601866)<1e-16
print('RESULT '+json.dumps(dict(sliderCases=len(data['cases']),extraDatasets=len(data['extras']),rationalQuantiles=3*(len(data['cases'])+len(data['extras'])),executedExamples=3,matplotlib=matplotlib.__version__,numpy=np.__version__,scipy=scipy.__version__,pandas=pd.__version__)))`,dir],{cwd:root,input:JSON.stringify({cases,extras:extras.map(a=>m.summarize(a)),pairs:m.pairs,roadCode:c.roadCode,scatterCode:c.scatterCode,pairingCode:c.pairingCode}),encoding:'utf8',maxBuffer:8*1024*1024}).split('RESULT ')[1]);
 for(const r of cases){assert.equal(r.values.length,31);assert.deepEqual(r.values.slice(0,30),m.traffic().values.slice(0,30));assert.equal(r.values[30],r.remeasured);m.svg(r);assert.equal(r.mean,4258+(r.remeasured-5167)/31);}
 assert.equal(m.traffic().remeasured,5167);assert.equal(m.traffic().mean,4258);assert.equal(m.traffic(3000).median,4406);assert.equal(m.traffic(9000).median,4438);assert.equal(m.traffic(6062).outliers.length,0);assert.equal(m.traffic(6063).outliers.length,1);
 assert.deepEqual(m.summarize([0,1,2,3,6]).outliers,[]);assert.equal(m.summarize([0,1,2,3,6.01]).outliers.length,1);
 for(const a of extras){const r=m.summarize(a),rev=m.summarize([...a].reverse()),scaled=m.summarize(a.map(v=>2*v+5));for(const k of ['q1','median','q3','whiskerLow','whiskerHigh','lower','upper','mean']){assert(Math.abs(r[k]-rev[k])<1e-12);assert(Math.abs(scaled[k]-(2*r[k]+5))<1e-12);}}
 for(const v of [2999,9501,NaN,5167.5,'5167'])assert.throws(()=>m.traffic(v));
 for(const a of [[],[1],Array(3),[1,NaN],[1,Infinity],[true,1],[1,1e7]])assert.throws(()=>m.summarize(a));assert.throws(()=>m.summarize([1,2],'unknown'));assert.throws(()=>m.svg(road,'unknown'));assert.throws(()=>m.svg(m.summarize([0,1])));
 assert.equal(m.correlation(m.pairs),0);assert.equal(m.correlation([...m.pairs].reverse()),0);assert.equal(m.scatter().wrongR,1);assert.equal(m.correlation([{x:1,y:2},{x:1,y:3}]),null);assert.throws(()=>m.correlation([{x:1,y:2},{x:NaN,y:3}]));
 const {parse}=await import('../contracts/node_modules/parse5/dist/index.js'),html=fs.readFileSync(root+'/'+c.file,'utf8'),before=execFileSync('git',['show','b893dce:'+c.file],{cwd:root,encoding:'utf8'}),errors=[];parse(html,{onParseError:e=>errors.push(e)});assert.deepEqual(errors,[]);assert.equal(afterCenter(c.next(before)),html);assert.equal(c.next(html),html);
 for(const prev of ['frequency','coin','qq','selection','dm'])assert.equal(require('./oa-'+prev+'-content.cjs').next(html),html);
 for(let i=1;i<=14;i++){if(i===6)continue;const re=new RegExp('<section id="s'+i+'"[^>]*>[\\s\\S]*?</section>');assert.equal(html.match(re)[0],afterCenter(c.next(before)).match(re)[0]);}
 const unrelatedSvg=s=>s.match(/<svg\b[\s\S]*?<\/svg>/g).filter(x=>!x.includes('p82t')&&!x.includes('data-generated-plot="oa-box-')&&!x.includes('data-generated-plot="oa-pairing"'));assert.deepEqual(unrelatedSvg(html),unrelatedSvg(afterCenter(c.next(before))));
 const scripts=s=>c.stripOldWidget(s).match(/<script\b[\s\S]*?<\/script>/g).filter(x=>!x.includes('src="assets/boxplot'));assert.deepEqual(scripts(html),scripts(afterCenter(c.next(before))));
 assert(!html.includes('bx-canvas'));assert(!html.includes('the median and quartiles never move'));assert(!html.includes('Elimination rules of thumb'));assert(html.includes('step="1" value="5167" disabled'));assert.equal((html.match(/class="oa-w"/g)||[]).length,5);
 fs.writeFileSync('/home/ybc/notes-legacy-review-artifacts/oa-box-test.json',JSON.stringify({pins,arithmetic,markup:true,scope:'Section 6: paired observations, declared quartiles, all integer slider states and three Python examples; not verification of an August–September matching key'},null,2)+'\n');console.log(arithmetic);
})().catch(e=>{console.error(e);process.exitCode=1;});
