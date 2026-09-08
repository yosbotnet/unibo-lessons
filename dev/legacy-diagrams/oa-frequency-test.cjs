'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const c=require('./oa-frequency-content.cjs'),m=require('../../oa/assets/frequency.js'),root=path.resolve(__dirname,'../..'),dir=process.env.NOTES_OA_FREQUENCY_EVIDENCE;
assert(dir,'Set NOTES_OA_FREQUENCY_EVIDENCE to the reviewed documentation directory');
const slide='/home/ybc/content/unibo-course-slides/68996-Operational Analytics/6 - Statistics_ descriptive.txt';
const pins={'scipy.html':'1aa6aafbc120f1e34bed569df946a1ae99d4fc24d159619b54d503611c05724b','numpy.html':'67de1c8442ce5a93dc28cba4a7ffe295b1d57ee46c43c2236bd3f00ff9e09098','nist.html':'2e139933b1e922677fc361119fbb0107d3f1832674b2b375f5c0702696a83bca','sampling.html':'79f69a1ef3c4363f74afd55b9d1362f7bcee717b8bfd6b4e5f41f1dec3c55ee9'};
(async()=>{
 const {parse}=await import('../contracts/node_modules/parse5/dist/index.js');
 for(const [file,hash] of Object.entries(pins))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(dir+'/'+file)).digest('hex'),hash);
 const source=fs.readFileSync(slide);assert.equal(crypto.createHash('sha256').update(source).digest('hex'),'c09011b7437bb9972d69782bcad922adef16023ca08b4a9f7b9d30acbb6c929c');
 const traffic=source.toString().split('Example – traffic counts')[1].split('Relative frequency table')[0];
 const values=[...traffic.matchAll(/^\s+(\d{4})\s+\d{4}\s+/gm)].map(r=>Number(r[1]));assert.deepEqual(values,m.data,'Actual slide column, not printed frequency cells');
 const expected={scipy:[4,1,0,2,1,2,8,5,6,2],numpy:[4,1,0,2,1,2,7,6,1,7]};
 const printed=source.toString().split('Relative frequency table')[1].split('Vittorio Maniezzo')[0];
 const printedRows=[...printed.matchAll(/^\s+\d{4}-\d{4}\s+(\d+)\s+([\d.]+)\s+([\d.]+)/gm)];assert.equal(printedRows.length,10);
 assert.deepEqual(printedRows.map(r=>Number(r[1])),expected.numpy);
 assert.deepEqual(printedRows.map(r=>r[2]),m.example().rows.map(r=>r.relative.toFixed(2)));
 assert.deepEqual(printedRows.map(r=>r[3]),m.example().rows.map(r=>r.cumulative.toFixed(2)));
 // Independent exact-rational oracle, not the JS bin-index implementation.
 const oracle=JSON.parse(execFileSync('python3',['-c',`import json,sys
from fractions import Fraction as F
data=json.load(sys.stdin)
result=[]
for mode in ['scipy','numpy']:
 for k in range(5,17):
  lo,hi=F(min(data)),F(max(data))
  pad=(hi-lo)/(2*(k-1)) if mode=='scipy' else F(0)
  edges=[lo-pad+i*(hi-lo+2*pad)/k for i in range(k+1)]
  counts=[sum(edges[i]<=x and (x<edges[i+1] or i==k-1 and x==edges[i+1]) for x in data) for i in range(k)]
  result.append(dict(mode=mode,k=k,edges=[float(x) for x in edges],counts=counts))
print(json.dumps(result))`],{input:JSON.stringify(m.data),encoding:'utf8'}));
 for(const o of oracle){const r=m.example(o.k,o.mode);assert.deepEqual(r.counts,o.counts);r.edges.forEach((x,i)=>assert(Math.abs(x-o.edges[i])<1e-9));assert.equal(r.counts.reduce((a,b)=>a+b,0),31);assert.equal(r.excluded,0);assert.equal(r.rows.at(-1).cumulative,1);assert.equal(r.mean,4258);
  assert.deepEqual(m.histogram([...m.data].reverse(),r.edges).counts,r.counts);
  const transformed=m.data.map(x=>2*x+11);assert.deepEqual(m.histogram(transformed,m.edgesFor(transformed,o.k,o.mode)).counts,r.counts);
 }
 for(const mode of ['scipy','numpy'])assert.deepEqual(m.example(10,mode).counts,expected[mode]);
 const bounds=m.histogram([-1,0,.5,1,1.5,2,3],[0,1,2]);assert.deepEqual(bounds.counts,[2,3]);assert.equal(bounds.excluded,2);assert.equal(bounds.rows.at(-1).cumulative,5/7);
 assert.deepEqual(m.histogram([1,1,1],[0,1,2]).counts,[0,3]);
 for(const args of [[[],[0,1]],[[NaN],[0,1]],[[1],[0,0]],[[1],[2,1]],[[1],[0,Infinity]]])assert.throws(()=>m.histogram(...args));
 assert.throws(()=>m.histogram(Array(2),[0,1]));assert.throws(()=>m.histogram([0],[0,,1]));
 for(const args of [[m.data,1,'numpy'],[m.data,10,'other'],[[1,1],10,'numpy']])assert.throws(()=>m.edgesFor(...args));
 const before=execFileSync('git',['show','a80f149:'+c.file],{cwd:root,encoding:'utf8'}),html=fs.readFileSync(root+'/'+c.file,'utf8'),errors=[];
 const previousTable=before.match(/<section id="s2"[^>]*>[\s\S]*?<\/section>/)[0];assert.equal([...previousTable.matchAll(/<tr><td>[^<]+<\/td><td>(\d+)<\/td>/g)].reduce((sum,r)=>sum+Number(r[1]),0),32);
 parse(html,{onParseError:e=>errors.push(e)});assert.deepEqual(errors,[]);assert.equal(require('./oa-selection-content.cjs').next(require('./oa-qq-content.cjs').next(require('./oa-coin-content.cjs').next(c.next(before)))),html);assert.equal(c.next(html),html);
 const svg=s=>[...s.matchAll(/<svg\b[\s\S]*?<\/svg>/g)].map(x=>x[0]);const existing=svg(before),now=svg(html);assert.equal(existing.length,8);assert.deepEqual(now.filter(x=>!x.includes('data-frequency-chart')&&!x.includes('oa-coin-exact')&&!x.includes('oa-normal-qq')),existing.filter(x=>!x.includes('p86t')&&!x.includes('p87t')&&!x.includes('p88t')));
 const tail=s=>s.slice(s.indexOf('/* ---- Bespoke widget: mean vs median under skewness ---- */')).split('/* ---- Bespoke widget: is the coin rigged? ---- */')[0].split('</script>')[0];assert.equal(tail(html),tail(before),'Unrevised adjacent widget code remains byte-identical');
 for(let i=3;i<=14;i++){if([10,11,12,13].includes(i))continue;const re=new RegExp('<section id="s'+i+'"[^>]*>[\\s\\S]*?</section>'),old=before.match(re)[0];assert.equal(html.match(re)[0],old);}
 assert.equal((html.match(/data-frequency-chart/g)||[]).length,1);assert.equal((html.match(/data-frequency-table/g)||[]).length,1);
 assert.equal((html.match(/class="oa-w"/g)||[]).length,5);assert(html.includes('<span>5 interactive widgets</span>'));
 fs.writeFileSync('/home/ybc/notes-legacy-review-artifacts/oa-frequency-test.json',JSON.stringify({pins,slideSha256:crypto.createHash('sha256').update(source).digest('hex'),oracleCases:oracle.length,expected,markup:true,existingSVGsUnchanged:5,subsequentRevisions:['oa-coin-content.cjs','oa-qq-content.cjs','oa-selection-content.cjs'],scope:'Exact arithmetic and documented bin conventions; this histogram suite uses a stdlib oracle, not a NumPy/SciPy runtime'},null,2)+'\n');
 console.log('31 source observations, 24 rational cases, boundary/invalid tests, five unchanged SVGs and explicit coin/Q–Q/selection compatibility passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
