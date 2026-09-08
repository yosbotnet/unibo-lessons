'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const c=require('./oa-coin-content.cjs'),m=require('../../oa/assets/coin-test.js'),root=path.resolve(__dirname,'../..'),dir=process.env.NOTES_OA_COIN_EVIDENCE;
assert(dir,'Set NOTES_OA_COIN_EVIDENCE to the reviewed primary-source directory');
const pins={'asa.pdf':'5327785901ea402c063458e9d061b131a2f4a81c8a6d46fd9e217238b61f8ca9','nist.html':'d9bb150b6d7888998b8a57e5745519c9261eb10ffb2f4a150b094edc74e085d4','scipy.html':'0f161b5a7127b6616c8ba13fe39bbe73ac73abfe2633e2c5e93626bb39bfa5cb','binomtest.py':'df89f663e6232a210d23b24b831957411fd6830920ce937039b926f1885aa552'};
(async()=>{const {parse,parseFragment}=await import('../contracts/node_modules/parse5/dist/index.js');
 for(const [file,hash] of Object.entries(pins))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(dir+'/'+file)).digest('hex'),hash,file);
 const asa=execFileSync('pdftotext',['-layout',dir+'/asa.pdf','-'],{encoding:'utf8'}).replace(/\s+/g,' ');assert(asa.includes('do not measure the probability that the studied hypothesis is true'));assert(asa.includes('does not measure the size of an effect'));
 const slide=fs.readFileSync('/home/ybc/content/unibo-course-slides/68996-Operational Analytics/7 - Statistics_ inferential.txt');assert.equal(crypto.createHash('sha256').update(slide).digest('hex'),'a1bb74f95203168b0e23701a5a5718f8b951347145ca8c84a8a1efd580004493');
 const oracle=JSON.parse(execFileSync('python3',['-c',`import json,math
rows=[]
for n in range(1,21):
 for k in range(n+1):
  w=[math.comb(n,j) for j in range(n+1)]
  for alternative in ['two-sided','greater','less']:
   chosen=[j for j in range(n+1) if (abs(2*j-n)>=abs(2*k-n) if alternative=='two-sided' else j>=k if alternative=='greater' else j<=k)]
   rows.append([n,k,alternative,w[k],sum(w[j] for j in chosen),chosen])
print(json.dumps(rows))`],{encoding:'utf8',maxBuffer:2e6}));
 for(const [n,k,a,point,numerator,chosen] of oracle){const r=m.evaluate(k,a,n);assert.equal(r.point,point);assert.equal(r.numerator,numerator);assert.deepEqual(r.included.map((yes,j)=>yes?j:-1).filter(j=>j>=0),chosen);assert.equal(r.reject,numerator*20<=2**n);assert(r.pvalue>=0&&r.pvalue<=1);}
 const tossCounts=Array(11).fill(0);for(let mask=0;mask<1024;mask++){let heads=0;for(let i=0;i<10;i++)heads+=(mask>>i)&1;tossCounts[heads]++;}assert.deepEqual(tossCounts,m.weights(10));
 for(const a of m.alternatives)for(let n=1;n<=20;n++){const w=m.weights(n),size=m.region(a,n).reduce((s,j)=>s+w[j],0);assert(size*20<=2**n,'Actual level');}
 assert.deepEqual(m.rates(),{rejected:[0,1,9,10],sizeNumerator:22,sizeDenominator:1024,wrongNumerator:112,powerNumerator:255910,powerDenominator:1048576});
 assert.equal(m.evaluate(8).pvalue,.109375);assert.equal(m.evaluate(8,'greater').pvalue,.0546875);assert.equal(m.evaluate(8,'less').pvalue,.9892578125);assert(!m.evaluate(8).reject);assert(m.evaluate(9).reject);
 for(const args of [[-1], [11], [2,'unknown'], [1,'two-sided',0], [1.5], [NaN], [1,'greater',21]])assert.throws(()=>m.evaluate(...args));assert.throws(()=>m.svg(m.evaluate(1,'less',5)));
 for(const a of m.alternatives){const errors=[];parseFragment(m.table(a),{onParseError:e=>errors.push(e)});assert.deepEqual(errors,[]);assert(!m.svg(m.evaluate(8,a)).includes('θ < 0.5'));}
 const before=execFileSync('git',['show','0de08d7:'+c.file],{cwd:root,encoding:'utf8'}),html=fs.readFileSync(root+'/'+c.file,'utf8'),errors=[];parse(html,{onParseError:e=>errors.push(e)});assert.deepEqual(errors,[]);
 assert.equal(require('./oa-selection-content.cjs').next(require('./oa-qq-content.cjs').next(c.next(before))),html,'Only the reviewed coin, Q–Q and test-selection transformations change the chapter');assert.equal(c.next(html),html);assert.equal(require('./oa-frequency-content.cjs').next(html),html);
 for(const i of [1,2,3,4,5,6,7,8,9,14]){const re=new RegExp('<section id="s'+i+'"[^>]*>[\\s\\S]*?</section>');assert.equal(html.match(re)[0],before.match(re)[0]);}
 const adjacent=s=>s.slice(s.indexOf('/* ---- Bespoke widget: mean vs median under skewness ---- */')).split('/* ---- Bespoke widget: is the coin rigged? ---- */')[0].split('</script>')[0];assert.equal(adjacent(html),adjacent(before));
 assert(!html.includes('cn-canvas'));assert(!html.includes('coin looks rigged'));assert(!html.includes('C(10,k)/2&#8310;'));
 fs.writeFileSync('/home/ybc/notes-legacy-review-artifacts/oa-coin-test.json',JSON.stringify({pins,oracleCases:oracle.length,enumeratedTossSequences:1024,rates:m.rates(),markup:true,scope:'Exact fair-binomial inference, source traceability and preservation; not a validation of all OA inference content'},null,2)+'\n');console.log(oracle.length+' exact oracle cases, 1024 sequences, Type I/power arithmetic, markup and preserved adjacent content passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
