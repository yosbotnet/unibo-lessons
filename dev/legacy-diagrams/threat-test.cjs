'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const c=require('./threat-content.cjs'),m=require('../../cybersecurity/assets/transfer-evidence.cjs'),root=path.resolve(__dirname,'../..'),dir=process.env.NOTES_THREAT_EVIDENCE;
assert(dir,'Set NOTES_THREAT_EVIDENCE to the reviewed PDF directory');
const pins={
 'nist.pdf':'4811fb6ad73f9c9121843ab77e029b5adc6f2c86d33c2fc5b2099ef133847646',
 'papernot.pdf':'419a0e682c93778368e86fb202496dbf62b31e2f4b1461889a6920b963ecd0bc',
 'boundary.pdf':'46304f9dd00b8e39d93292d53432b4d048c6e27fc04b9043089c5fb8feda1fc2'
};
(async()=>{
 const {parse}=await import('../contracts/node_modules/parse5/dist/index.js');
 const evidence={};for(const [file,hash] of Object.entries(pins)){
  const bytes=fs.readFileSync(dir+'/'+file);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),hash,file);
  evidence[file]=execFileSync('pdftotext',['-layout',dir+'/'+file,'-'],{encoding:'utf8',maxBuffer:3e6,stdio:['ignore','pipe','pipe']}).replace(/\s+/g,' ');
 }
 for(const [file,phrases] of Object.entries({
  'nist.pdf':['2.1.4. Attacker Knowledge','including the training data','full knowledge of the model architecture and parameters','Score-based attacks','Decision-based attacks'],
  'papernot.pdf':['arXiv:1602.02697v4','19 Mar 2017','observe labels','labeled by the target DNN'],
  'boundary.pdf':['arXiv:1712.04248v2','16 Feb 2018','does not rely on substitute models','solely rely on the final decision']
 }))for(const p of phrases)assert(evidence[file].includes(p),file+': '+p);
 let cases=0;for(const classes of [2,3,4])for(let y=0;y<classes;y++)for(let target=0;target<classes;target++)if(target!==y)for(let prediction=0;prediction<classes;prediction++){
  const r=m.classify({y,target,cleanA:y,cleanB:y,advA:target,advB:prediction});
  assert.equal(r.targeted,prediction===target);assert.equal(r.untargeted,prediction!==y);assert(!r.targeted||r.untargeted);
  if(classes===2)assert.equal(r.targeted,r.untargeted);cases++;
 }
 const blocks=(s,tag)=>[...s.matchAll(new RegExp('<'+tag+'\\b[\\s\\S]*?</'+tag+'>','g'))].map(m=>m[0]);
 for(const entry of require('./transfer-sources.cjs')){
  const html=fs.readFileSync(root+'/'+entry.file,'utf8'),before=execFileSync('git',['show','49018f0:'+entry.file],{cwd:root,encoding:'utf8'}),errors=[];
  parse(html,{onParseError:e=>errors.push(e)});assert.deepEqual(errors,[]);
  assert.equal(c.next(entry,before),html,'Only section 3, overview and five early TOC labels change');assert.equal(c.next(entry,html),html);
  for(const tag of ['script','style','figure'])assert.deepEqual(blocks(html,tag),blocks(before,tag),tag+' unchanged');
  for(const id of ['s1','s2','s4','s5','s6','s7','s8']){const re=new RegExp('<section id="'+id+'">[\\s\\S]*?</section>');assert.equal(html.match(re)[0],before.match(re)[0],id);}
  assert.equal(html.match(/<section id="s3">[\s\S]*?<\/section>/)[0],c.section());
  assert.equal((c.section().match(/<th scope="row">/g)||[]).length,6);
  for(const bad of ['this maps to insider vs outsider','More dangerous','More capability means a stronger attack','three, all individually recoverable'])assert(!html.includes(bad),bad);
  for(const mod of ['clinical-reading','security-tools','transfer','feature'])assert.equal(require('./'+mod+'-content.cjs').next(entry,html),html,mod+' idempotent');
  const injection=require('./injection-content.cjs');assert.equal(injection.next(entry,html,injection.dimensions()),html);
  const regulation=require('./regulation-content.cjs');assert.equal(regulation.next(entry,html,regulation.dimensions()),html);
 }
 fs.writeFileSync('/home/ybc/notes-legacy-review-artifacts/threat-test.json',JSON.stringify({pins,chapters:2,labelCases:cases,unchangedScriptsStylesFigures:true,markup:true,idempotence:true,scope:'Scoped source review and deterministic label semantics, not a model attack or deployment security certification'},null,2)+'\n');
 console.log('Three pinned source PDFs, '+cases+' label cases, two chapters, unchanged scripts/styles/figures and adjacent generators passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
