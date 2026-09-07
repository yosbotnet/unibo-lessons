const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {spawnSync,execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),out='/home/ybc/notes-legacy-review-artifacts',revision='ee18da511fb59b8f19a23dd1240fbcc234afc420';
const core=process.env.NOTES_JPF_CORE,jdk=process.env.NOTES_JDK11;
assert(core&&jdk,'Set NOTES_JPF_CORE (built pinned checkout) and NOTES_JDK11');
assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:core,encoding:'utf8'}).trim(),revision);
const tool=n=>path.join(jdk,'bin',n),dir=fs.mkdtempSync(path.join(os.tmpdir(),'notes-jpf-evidence-'));
const jar=path.join(core,'build/jpf.jar'),source=root+'/pcd/assets/examples/JpfCounter.java',config=root+'/pcd/assets/examples/jpf-counter.jpf';
const version=execFileSync(tool('javac'),['-version'],{encoding:'utf8'}).trim();assert.match(version,/javac 11\./);
execFileSync(tool('javac'),['-Xlint:all','-Werror','-cp',jar,'-d',dir,source,__dirname+'/JpfEvidence.java'],{encoding:'utf8',timeout:30000});
fs.writeFileSync(dir+'/site.properties','# Isolated verification: no user extensions.\n');
const cases=[];
// Exercise the documented RunJPF.jar entry point too, not just the host listener.
for(const options of [[],['+target.args=safe'],['+search.depth_limit=1']]){
 const r=spawnSync(tool('java'),['-Xmx512m','-jar',path.join(core,'build/RunJPF.jar'),config,'+classpath='+dir,'+site='+dir+'/site.properties',...options],{cwd:root,encoding:'utf8',timeout:30000});
 assert(!r.error,String(r.error));assert.equal(r.status,0,r.stderr);
 const log=r.stdout+r.stderr;
 if(options.length===0)assert.match(log,/AssertionError: Lost update: value=1/);
 else{assert.match(log,/no errors detected/);if(options[0].includes('depth_limit'))assert.match(log,/depth limit reached/);}
}
for(const [name,options,expected] of [
 ['unsafe',['+target.args=unsafe'],'counterexample'],
 ['safe',['+target.args=safe'],'complete-within-model'],
 ['bounded',['+target.args=unsafe','+search.depth_limit=1'],'incomplete'],
 ['invalid-target',['+target=NoSuchNotesTarget'],'incomplete'],
 ['upstream-match-depth-bug',['+search.match_depth=true'],'tool-error']
]){
 const args=['-Xmx512m','-cp',jar+path.delimiter+dir,'JpfEvidence',config,'+classpath='+dir,'+site='+dir+'/site.properties',...options];
 const r=spawnSync(tool('java'),args,{cwd:root,encoding:'utf8',timeout:30000});assert(!r.error,String(r.error));
 const log=r.stdout+r.stderr;fs.writeFileSync(out+'/jpf-'+name+'.log',log);
 const match=r.stdout.match(/NOTES_EVIDENCE ([^\n]+)/);assert(match,log);const line=match[1],outcome=line.split(' ')[0];assert.equal(outcome,expected,log);
 const field=key=>line.match(new RegExp(key+'=([^ ]+)'))?.[1];
 if(name==='upstream-match-depth-bug'){assert.notEqual(r.status,0);assert.match(log,/ArrayIndexOutOfBoundsException/);continue;}
 const record={name,outcome,started:field('started')==='true',finished:field('finished')==='true',constraints:+field('constraints'),violations:+field('violations')};
 if(name==='unsafe'){assert.equal(record.violations,1);assert.match(log,/AssertionError: Lost update: value=1/);assert.match(log,/trace #1/);}
 if(name==='safe'){assert(record.started&&record.finished);assert.equal(record.constraints,0);assert.equal(record.violations,0);}
 if(name==='bounded'){assert(record.started&&record.finished);assert(record.constraints>0);assert.equal(record.violations,0);assert.match(log,/no errors detected/);assert.match(log,/depth limit reached/);}
 if(name==='invalid-target'){assert(!record.started);assert.equal(record.violations,0);assert.match(log,/NoSuchNotesTarget/);}
 cases.push(record);
}
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const evidence={revision,jdk:version,sourceSha256:sha(source),configSha256:sha(config),cases};
const file=root+'/pcd/assets/examples/jpf-results.json',next=JSON.stringify(evidence,null,2)+'\n';
fs.writeFileSync(out+'/jpf-java-test.json',JSON.stringify({...evidence,classDirectory:dir,upstreamMatchDepthBug:true},null,2)+'\n');
if(process.argv.includes('--patch')){
 const old=fs.readFileSync(file,'utf8');
 process.stdout.write('*** Begin Patch\n'+(old!==next?`*** Update File: ${file}\n@@\n`+old.trimEnd().split('\n').map(l=>'-'+l).join('\n')+'\n'+next.trimEnd().split('\n').map(l=>'+'+l).join('\n')+'\n':'')+'*** End Patch\n');
}else{assert.equal(fs.readFileSync(file,'utf8'),next,'Regenerate checked evidence with --patch');console.log('Real JPF: counterexample, complete, constrained and invalid target; upstream tool failure reproduced');}
