'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process'),c=require('./security-tools-content.cjs');
const root=path.resolve(__dirname,'../..'),dir=process.env.NOTES_SECURITY_TOOLS_EVIDENCE;
assert(dir,'Set NOTES_SECURITY_TOOLS_EVIDENCE to the reviewed source directory');
const pins={
 'cleverhans.md':'5173868c34b096e0b3550cf1c299b83ee198a806b58cb0fce84938a2eac0c485',
 'foolbox.rst':'2e762dae7dfb0a82fc06c12bc2c3a6374eee287227fbad4693540740f47148c4',
 'robustbench.md':'286b0d01ad0c584e15a7de7621d1de33f907e546e8fd6baa451985218f0cc6be',
 'art.md':'f52dcc8a660d1978baa2a61934dc474bb30f2edf036e0a5652867698dd569ca4',
 'agentdojo.md':'d8c6460ecce9bbf59ed300fbc74b4440188f74cd147a7611836270be49e7660e',
 'agentdojo.html':'7b6e97faaedcf0e1b5f3635b92a0da33afbe8529699d54a5c44ad58ce2fa8b02',
 'camel.html':'b5cd7970e905f1504439c3eddb3855ab18d951d10bf806ec2f5f3baa02ca8a51',
 'progent.html':'1c29c9c403bf517786dfbdedde030662c012dd038e2fa450305d0f32b2159f52',
 'agentleak.html':'d2c08b255577d94487d06ecc7aec14df8555ae64acbc5761c21e3a4fa8f40319'
};
(async()=>{
 const {parse}=await import('../contracts/node_modules/parse5/dist/index.js');
 const texts=n=>n.nodeName==='#text'?n.value:['script','style'].includes(n.nodeName)?'':(n.childNodes||[]).map(texts).join(' ');
 const evidence={};for(const [file,hash] of Object.entries(pins)){
  const bytes=fs.readFileSync(dir+'/'+file);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),hash,file);
  evidence[file]=(file.endsWith('.html')?texts(parse(bytes.toString())):bytes.toString()).replace(/\s+/g,' ');
 }
 for(const [file,phrases] of Object.entries({
  'cleverhans.md':['JAX, PyTorch, and TF2','v4.0.0'],
  'foolbox.rst':['EagerPy','decision-based'],
  'robustbench.md':['Model Zoo','adaptive attacks'],
  'art.md':['LF AI & Data','Evasion, Poisoning, Extraction, and Inference'],
  'agentdojo.html':['mutations in the environment state','Benign Utility','Targeted Attack Success Rate'],
  'camel.html':['Explicit non-goals','user prompt is trusted'],
  'progent.html':['does not handle attacks that target text outputs','sacrifice security guarantees'],
  'agentleak.html':['2602.11510v3','Channel coverage scope','C1 (final output), C2 (inter-agent messages), and C5 (shared memory)']
 }))for(const p of phrases)assert(evidence[file].includes(p),file+': '+p);
 const scripts=s=>[...s.matchAll(/<script\b[\s\S]*?<\/script>/g)].map(m=>m[0]);
 for(const entry of require('./transfer-sources.cjs')){
  const html=fs.readFileSync(root+'/'+entry.file,'utf8'),before=execFileSync('git',['show','22049f9:'+entry.file],{cwd:root,encoding:'utf8'}),errors=[];
  parse(html,{onParseError:e=>errors.push(e)});assert.deepEqual(errors,[]);
  assert.equal(require('./clinical-reading-content.cjs').next(entry,c.next(entry,before)),html,'Only reviewed resource/clinical sections and TOC may change');assert.equal(c.next(entry,html),html);
  assert.deepEqual(scripts(html),scripts(before));
  assert.equal(require('./regulation-content.cjs').next(entry,html,require('./regulation-content.cjs').dimensions()),html,'Regulation generator preserves resources');
  for(const token of ['data-kit="tabs"','data-fgsm','data-agent-case=','<figure'])assert.equal(html.split(token).length,before.split(token).length,token);
  assert.equal(html.split('id="security-resources"').length,2);assert.equal(html.split('href="#security-resources"').length,2);
  for(const r of [...c.models,...c.agents])assert.equal(html.split('data-tool="'+r.id+'"').length,2);
  for(const url of Object.values(c.sources))assert(html.includes('href="'+url+'"'));
  for(const bad of ['TensorFlow library for adversarial attacks and defenses',"Google's CaMeL: defeating prompt injections by design"])assert(!html.includes(bad));
  assert.equal(html.match(/<div id="clinical-evidence"[\s\S]*?<!-- END CLINICAL EVIDENCE -->/)[0],require('./clinical-reading-content.cjs').content());
 }
 assert.equal(c.models.length,4);assert.equal(c.agents.length,4);
 fs.writeFileSync('/home/ybc/notes-legacy-review-artifacts/security-tools-test.json',JSON.stringify({pins,chapters:2,resourceRows:8,markup:true,unchangedScripts:true,idempotence:true,scope:'Source traceability and content integrity, not execution of external libraries or benchmark reproduction'},null,2)+'\n');
 console.log('Nine primary-source captures, eight resource rows, two chapters, unchanged scripts and generator compatibility passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
