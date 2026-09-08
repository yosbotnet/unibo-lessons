'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const c=require('./clinical-reading-content.cjs'),root=path.resolve(__dirname,'../..'),dir=process.env.NOTES_CLINICAL_READING_EVIDENCE;
assert(dir,'Set NOTES_CLINICAL_READING_EVIDENCE to the reviewed evidence directory');
const pins={
 'kim.html':'0bfa06187b47abfc908844c65dc8fb6f57d335f0189acbc5267db6477e073330',
 'magnini-search.json':'95dc064b18081d386f6b950fb821c93c32af3620ee17c119dd0789470fbe64be',
 'griewing.html':'55b1f2e045f71d72a075ba28631e18517bef148a3b6384cea5d20470f8e2a1a0',
 'aguzzi.html':'7e324f771bac3aace9f993a3c38add65e72e934f84305c53c6bb0ba4dfa98581'
};
(async()=>{
 const {parse}=await import('../contracts/node_modules/parse5/dist/index.js');
 const text=n=>n.nodeName==='#text'?n.value:['script','style'].includes(n.nodeName)?'':(n.childNodes||[]).map(text).join(' '),evidence={};
 for(const [file,hash] of Object.entries(pins)){const bytes=fs.readFileSync(dir+'/'+file);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),hash,file);evidence[file]=(file.endsWith('.html')?text(parse(bytes.toString())):JSON.parse(bytes.toString())).replace(/\s+/g,' ');}
 for(const [file,phrases] of Object.entries({
  'kim.html':['Meerkat-7B and Meerkat-8B','six exam datasets','particularly regarding dosage','unsafe, or biased responses'],
  'magnini-search.json':['10.1016/j.ibmed.2024.100197','Gemini Pro 1.5','intent recognition','judge'],
  'griewing.html':['20 fictional patient profiles','100 binary treatment recommendations','does not offer clinical validation'],
  'aguzzi.html':['Only 21 items','no end-users (patients) participated','All data, prompts, and evaluations are in Italian','absence of significance']
 }))for(const phrase of phrases)assert(evidence[file].includes(phrase),file+': '+phrase);
 assert.equal(c.papers.length,4);assert.equal(c.papers.filter(p=>p.access.startsWith('Full article:')).length,3);
 const magnini=c.papers.find(p=>p.id==='magnini');assert(magnini.access.includes('full text not obtained'));assert(magnini.limit.includes('sample size'));
 assert(c.papers.find(p=>p.id==='griewing').finding.includes('100 binary decisions are 20 × 5'));assert.equal(20*5,100);
 const scripts=s=>[...s.matchAll(/<script\b[\s\S]*?<\/script>/g)].map(m=>m[0]);
 for(const entry of require('./transfer-sources.cjs')){
  const html=fs.readFileSync(root+'/'+entry.file,'utf8'),before=execFileSync('git',['show','e03e336:'+entry.file],{cwd:root,encoding:'utf8'}),errors=[];
  parse(html,{onParseError:e=>errors.push(e)});assert.deepEqual(errors,[]);
  assert.equal(require('./threat-content.cjs').next(entry,c.next(entry,before)),html,'Only reviewed clinical and threat/navigation content may change');assert.equal(c.next(entry,html),html);
  assert.deepEqual(scripts(html),scripts(before));
  assert.equal(require('./security-tools-content.cjs').next(entry,html),html);
  const regulation=require('./regulation-content.cjs');assert.equal(regulation.next(entry,html,regulation.dimensions()),html);
  assert.equal(html.match(/<div id="security-resources"[\s\S]*?<!-- END SECURITY RESOURCES -->/)[0],before.match(/<div id="security-resources"[\s\S]*?<!-- END SECURITY RESOURCES -->/)[0]);
  for(const token of ['data-kit="tabs"','data-fgsm','data-agent-case=','<figure'])assert.equal(html.split(token).length,before.split(token).length,token);
  for(const marker of ['id="clinical-evidence"','href="#clinical-evidence"','data-clinical-check','data-reading-leads'])assert.equal(html.split(marker).length,2,marker);
  for(const p of c.papers){assert.equal(html.split('data-clinical-paper="'+p.id+'"').length,2);assert(html.includes('href="'+p.url+'"'));}
  assert(!html.includes('SLMs in Clinical Deployments'));assert(!html.includes('first four papers and their study limitations have not yet'));
  assert(html.includes('Aguzzi et al. (2026)'));assert(html.includes('paper’s full text and run-level artifacts were not obtained'));
 }
 fs.writeFileSync('/home/ybc/notes-legacy-review-artifacts/clinical-reading-test.json',JSON.stringify({pins,chapters:2,papers:4,fullArticleReviews:3,abstractOnly:'Magnini 2025',unchangedScripts:true,markup:true,idempotence:true,scope:'Bibliographic identification and scoped source review; no clinical recommendation or experiment reproduction'},null,2)+'\n');
 console.log('Three full-article captures, one indexed abstract capture, four entries, unchanged scripts and adjacent generators passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
