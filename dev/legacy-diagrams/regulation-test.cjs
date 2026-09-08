'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const c=require('./regulation-content.cjs'),root=path.resolve(__dirname,'../..');
const dir=process.env.NOTES_REGULATION_EVIDENCE;
assert(dir,'Set NOTES_REGULATION_EVIDENCE to the reviewed official-source directory');
const pins={
  'gdpr.pdf':'bd84e63f5b622b739a83389afc3b30d240f792bb88d8eb03a816c9a82b0c2499',
  'ec-grounds.html':'1577b7f20f8a15c370907682dc9d8631f645260fc6de6b7ae3cd4677e0195f26',
  'ec-scope.html':'a9d2c1be381147e5dbf90bae18f8de32c8f63b485d233301da385c020019a4bb',
  'edpb-breach.html':'f1c138d68afa886027ac607056a260175741a4b62753261d12eb3e588e428e13',
  'hhs-web.json':'a70816e1e08bdd142f1cf236c771f196a526cd317c97543fefdbb506a12c5676',
  'hhs-privacy-web.json':'759c8d9ac206f8af56d1164010f38b581f024f9056284e00426e8eb018c2a200',
  'hhs-delay-web.json':'47b708cba6eca57a4316707c2e397cd93ce83f414d62f8279c2616d863cc491c'
};
for(const [file,hash] of Object.entries(pins))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(dir+'/'+file)).digest('hex'),hash);
const law=execFileSync('pdftotext',['-layout',dir+'/gdpr.pdf','-'],{encoding:'utf8',maxBuffer:5e6}).replace(/\s+/g,' ');
for(const phrase of ['Territorial scope','without undue delay','72 hours after having become aware','likely to result in a high risk','professional secrecy','defence of legal claims'])assert(law.includes(phrase),phrase);
const hhs=JSON.parse(fs.readFileSync(dir+'/hhs-web.json','utf8'));
for(const phrase of ['does not meet the definition of a covered entity or business associate','low probability','actually acquired or viewed','60 days','unsecured protected health information'])assert(hhs.includes(phrase),phrase);
const privacy=JSON.parse(fs.readFileSync(dir+'/hhs-privacy-web.json','utf8'));
assert(privacy.includes('annual adjustments'));
assert(privacy.includes('not imposed'));
assert(privacy.includes('disclosure to or a request by a health care provider for treatment'));
const delay=JSON.parse(fs.readFileSync(dir+'/hhs-delay-web.json','utf8'));
assert(delay.includes('164.412'));assert(delay.includes('law enforcement official'));
(async()=>{
  const {parse}=await import('../contracts/node_modules/parse5/dist/index.js');
  const texts=node=>node.nodeName==='#text'?node.value:['script','style'].includes(node.nodeName)?'':(node.childNodes||[]).map(texts).join(' ');
  const ec=texts(parse(fs.readFileSync(dir+'/ec-grounds.html','utf8'))).replace(/\s+/g,' ');
  assert(ec.includes('explicit consent'));assert(ec.includes('preventive or occupational medicine'));
  const scope=texts(parse(fs.readFileSync(dir+'/ec-scope.html','utf8'))).replace(/\s+/g,' ');
  assert(scope.includes('established outside the EU'));assert(scope.includes('monitoring the behaviour'));
  const edpb=texts(parse(fs.readFileSync(dir+'/edpb-breach.html','utf8'))).replace(/\s+/g,' ');
  assert(edpb.includes('confidentiality, integrity or availability'));assert(edpb.includes('in several steps'));
  for(const entry of require('./transfer-sources.cjs')){
    const html=fs.readFileSync(root+'/'+entry.file,'utf8'),errors=[];
    parse(html,{onParseError:e=>errors.push(e)});assert.deepEqual(errors,[]);
    assert.equal(c.next(entry,html,c.dimensions()),html);
    const old=execFileSync('git',['show','8cb8832:'+entry.file],{cwd:root,encoding:'utf8'});
    const scripts=s=>[...s.matchAll(/<script\b[\s\S]*?<\/script>/g)].map(m=>m[0]);
    assert.deepEqual(scripts(html),scripts(old));
    for(const token of ['data-kit="tabs"','data-fgsm','data-agent-case='])assert.equal(html.split(token).length,old.split(token).length,token);
    for(const wrong of ['Requires explicit consent, data minimization','all PII is sensitive','every leak in this half is a','the attack surface scales with','frameworks must be <strong>updated</strong>'])assert(!html.toLowerCase().includes(wrong.toLowerCase()),wrong);
    for(const url of Object.values(c.sources))assert(html.includes('href="'+url+'"'));
    for(const marker of ['data-legal-definitions','data-notice-duties','data-security-conclusion','id="regulation-scope"','id="governance-implications"'])assert.equal(html.split(marker).length,2,marker);
    assert(html.includes('not a compliance determination'));
    assert(html.includes('Explicit consent is one route, not the only one'));
    assert(html.includes('HIPAA reporting to the Secretary'));
    if(!entry.file.startsWith('cybersecurity-reworked/')){
      assert(html.includes('data-reading-leads'));assert(!html.includes('demonstrate sufficient performance for medical chatbots'));
      for(const label of ['Kim et al. (2025)','Magnini et al. (2025)','Griewing et al. (2024)','Aguzzi et al. (2025)','AgentDojo','CleverHans','Foolbox','RobustBench'])assert(html.includes(label),'Preserve reading lead '+label);
    }
  }
  assert.equal(c.definitions.length,3);assert.equal(c.notices.length,5);
  assert.deepEqual(c.dimensions(),{width:732,height:161});
  fs.writeFileSync('/home/ybc/notes-legacy-review-artifacts/regulation-test.json',JSON.stringify({pins,chapters:2,definitions:3,notices:5,scriptsUnchanged:true,markup:true,idempotence:true,scope:'Educational overview; no automated legal finding or notification'},null,2)+'\n');
  console.log('Seven official-source captures, two chapters, 3 definitions/5 notice distinctions, unchanged scripts and markup passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
