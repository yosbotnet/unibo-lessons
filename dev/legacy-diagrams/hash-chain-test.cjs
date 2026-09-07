const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {build,change,checkpoint,inspect,evidence,sha,serialize,zero}=require('./hash-chain.cjs');
const {markup,hashes}=require('./hash-chain-traces.cjs');
const root=path.resolve(__dirname,'../..'),out='/home/ybc/notes-legacy-review-artifacts';
const html=fs.readFileSync(path.join(root,'ds/DS-C4.html'),'utf8');
assert(html.includes(markup()));assert(html.includes(hashes()));assert(!/class="mermaid"|mermaid(?:\.min)?\.js/.test(html));
assert.equal(sha(''),'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
assert.equal(sha('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
assert.notEqual(sha('abc'),sha('abc\n'));assert.notEqual(sha('é'),sha('e\u0301'),'No hidden Unicode normalization');
const fixture=evidence();assert.deepEqual(fixture.scenarios.map(s=>[s.result.coherent,s.result.headMatches,s.result.accepted]),[[true,true,true],[false,true,false],[true,false,false]]);
assert.equal(fixture.scenarios[1].result.rows[1].hashOK,false);assert.equal(fixture.scenarios[1].result.rows[2].linkOK,false);
assert.equal(fixture.scenarios[2].records[0].digest,fixture.scenarios[0].records[0].digest);
assert.notEqual(fixture.scenarios[2].records[1].digest,fixture.scenarios[0].records[1].digest);
let cases=0;const independentInputs=fixture.scenarios.flatMap(s=>s.result.rows.map(r=>({input:r.input,digest:r.computed})));
for(const input of ['Alice->Bob: 1 $','Allce->Bob: 1 $','Alice->bob: 2 $'])independentInputs.push({input,digest:sha(input)});
for(let n=1;n<=16;n++){
 const original=build(Array.from({length:n},(_,i)=>`Record ${i}: é → 雨 ${n}`)),anchor=checkpoint(original),snapshot=JSON.stringify(original);
 assert(inspect(original,anchor).accepted);
 for(let i=0;i<n;i++){
  const edited=change(original,i,`Changed ${i} ${n}`),rewritten=build(edited.map(r=>r.payload));
  assert(!inspect(edited,anchor).accepted);assert(!inspect(edited).coherent);
  assert(inspect(rewritten).coherent);assert(!inspect(rewritten,anchor).accepted);
  assert(inspect(rewritten,checkpoint(rewritten)).accepted,'Replacing the trusted checkpoint removes the original comparison');
  for(let j=0;j<i;j++)assert.deepEqual(rewritten[j],original[j]);
  for(let j=i;j<n;j++)assert.notEqual(rewritten[j].digest,original[j].digest);
  independentInputs.push(...rewritten.map(r=>({input:serialize(r),digest:r.digest})));cases++;
 }
 for(let i=0;i<n;i++){
  for(const field of ['previous','digest']){const tampered=structuredClone(original);tampered[i][field]=field==='previous'&&i===0?'f'.repeat(64):zero;assert(!inspect(tampered,anchor).accepted);cases++}
  const wrongIndex=structuredClone(original);wrongIndex[i].index=n+1;assert(!inspect(wrongIndex,anchor).accepted);cases++;
 }
 if(n>1){assert(!inspect(original.slice(0,-1),anchor).accepted);assert(inspect(original.slice(0,-1)).coherent,'A truncated valid prefix still passes an unanchored check');const reordered=structuredClone(original);[reordered[0],reordered[1]]=[reordered[1],reordered[0]];assert(!inspect(reordered,anchor).accepted);cases+=2}
 assert(!inspect(build([...original.map(r=>r.payload),'appended']),anchor).accepted,'Full-history checkpoint is not a prefix-extension policy');cases++;
 assert.equal(JSON.stringify(original),snapshot,'Operations do not mutate supplied history');
}
for(const value of [null,[],Array(33).fill('x'),[1],['x'.repeat(201)],['\ud800']])assert.throws(()=>build(value));
assert.throws(()=>serialize({index:-1,previous:zero,payload:'x'}));assert.throws(()=>serialize({index:0,previous:'bad',payload:'x'}));assert.throws(()=>change(build(),9,'x'));assert.throws(()=>inspect(build(),{length:0,head:zero}));
async function browser(){
 const {chromium}=require('playwright'),b=await chromium.launch(),results=[];
 const base=process.env.NOTES_PREVIEW_URL||'http://127.0.0.1:8787/';
 try{
  const p=await b.newPage();await p.route(/^https?:/,r=>r.request().url().startsWith(base)?r.continue():r.abort());await p.goto(base+'ds/DS-C4.html');
  const unique=[...new Map(independentInputs.map(r=>[r.input,r])).values()];
  const verified=await p.evaluate(async rows=>{
   for(const r of rows){const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(r.input))),v=>v.toString(16).padStart(2,'0')).join('');if(actual!==r.digest)throw Error('Independent SHA-256 mismatch')}
   return rows.length;
  },unique);await p.close();
  for(const javaScriptEnabled of [true,false])for(const width of [1280,390]){
   const p=await b.newPage({viewport:{width,height:1000},javaScriptEnabled}),errors=[],requests=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push(r.url()));
   await p.route(/^https?:/,r=>r.request().url().startsWith(base)?r.continue():/highlight\.min\.js/.test(r.request().url())?r.fulfill({path:root+'/dl/assets/highlight.min.js'}):r.abort());
   await p.goto(base+'ds/DS-C4.html');assert(!requests.some(u=>/mermaid/.test(u)),'No runtime Mermaid');
   assert(await p.locator('[data-static-diagram="ds-hash-checkpoint"] img').evaluate(i=>i.complete&&i.naturalWidth>0));
   const response=await p.request.get(base+'ds/assets/examples/hash-chain.json');assert(response.ok());assert.deepEqual(await response.json(),fixture);
   for(const s of fixture.scenarios){
    const detail=p.locator(`[data-hash-case="${s.id}"]`);await detail.locator('summary').click();assert(await detail.locator('table').isVisible());
    const rows=await detail.locator('tbody tr').evaluateAll(rs=>rs.map(r=>[...r.querySelectorAll('code')].map(c=>c.textContent)));
    assert.deepEqual(rows,s.records.map((r,i)=>['B'+i+': '+r.payload,r.digest,s.result.rows[i].computed]));
    if(width===390){const region=detail.locator('[role=region]');await region.focus();await p.keyboard.press('ArrowRight');await p.waitForTimeout(150);assert(await region.evaluate(e=>e.scrollLeft>0));await region.evaluate(e=>e.scrollLeft=0)}
    await detail.screenshot({path:path.join(out,`hash-chain-${s.id}-${width}-${javaScriptEnabled?'js':'nojs'}.png`)});
    await detail.locator('summary').click();assert(!(await detail.locator('table').isVisible()));
   }
   for(const id of ['s2','s3','s4'])await p.locator('#'+id).screenshot({path:path.join(out,`hash-${id}-${width}-${javaScriptEnabled?'js':'nojs'}.png`)});
   if(width===390)for(const region of [p.locator('[data-static-diagram="ds-hash-checkpoint"] [role=region]'),p.locator('#dlt-platforms').locator('..')]){assert(await region.evaluate(e=>e.scrollWidth>e.clientWidth));await region.focus();await p.keyboard.press('ArrowRight');await p.waitForTimeout(150);assert(await region.evaluate(e=>e.scrollLeft>0))}
   assert.deepEqual(errors,[]);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No page overflow, including no-JS tables');
   results.push({width,javaScriptEnabled,details:3,nativeImage:true,downloadMatches:true,errors});await p.close();
  }
  fs.writeFileSync(path.join(out,'hash-chain-test.json'),JSON.stringify({cases,independentWebCryptoDigests:verified,knownVectors:2,scenarios:3,results},null,2)+'\n');console.log(`${cases} history mutations/checkpoint cases; ${verified} independent browser SHA-256 comparisons; 4 desktop/mobile/no-JS visits with all 3 full histories passed`);
 }finally{await b.close()}
}
browser().catch(e=>{console.error(e);process.exitCode=1});
