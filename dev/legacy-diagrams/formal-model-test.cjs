const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),out='/home/ybc/notes-legacy-review-artifacts';
const spin=process.env.NOTES_SPIN,jar=process.env.NOTES_TLA_JAR,java=process.env.NOTES_JAVA;
assert(spin&&jar&&java,'Set NOTES_SPIN, NOTES_TLA_JAR and NOTES_JAVA to the pinned local tools');
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const spinHash=hash(fs.readFileSync(spin)),jarHash=hash(fs.readFileSync(jar));
assert.equal(spinHash,'21bedb934fa0a70badb9b9f713b2bae8a72d3d5ec41c623cf23e9bbee51b3419');
assert.equal(jarHash,'936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'notes-formal-check-'));
function run(name,cmd,args,cwd=tmp){
 const r=spawnSync(cmd,args,{cwd,encoding:'utf8',timeout:45000,maxBuffer:8e6});
 const output=(r.stdout||'')+(r.stderr||'');fs.writeFileSync(path.join(out,'formal-'+name+'.log'),output);
 assert(!r.error,`${name}: ${r.error}`);assert.equal(r.signal,null,`${name}: terminated`);
 return {status:r.status,output};
}
function ok(r){assert.equal(r.status,0,r.output);return r.output;}
const names=['Dekker.pml','Peterson.tla','Peterson.cfg','PetersonFair.cfg','PetersonUnfair.cfg'];
const sources=Object.fromEntries(names.map(n=>[n,fs.readFileSync(root+'/pcd/assets/examples/'+n,'utf8')]));
const cases=[];
const toolchain={spin:ok(run('spin-version',spin,['-V'])).trim(),spinSha256:spinHash,tlaJarSha256:jarHash,java:run('java-version',java,['-version']).output.trim().split('\n')[0],cc:ok(run('gcc-version','gcc',['-dumpfullversion'])).trim()};
assert(toolchain.spin.includes('6.5.1'));
function spinBuild(name,source){
 const dir=path.join(tmp,name);fs.mkdirSync(dir);fs.writeFileSync(dir+'/Dekker.pml',source);
 ok(run(name+'-generate',spin,['-a','Dekker.pml'],dir));
 ok(run(name+'-compile-safety','gcc',['-O2','-DSAFETY','-DNOCLAIM','-DNOREDUCE','-DMEMLIM=256','-o','pan-safety','pan.c'],dir));
 ok(run(name+'-compile-live','gcc',['-O2','-DNOREDUCE','-DMEMLIM=256','-o','pan-live','pan.c'],dir));return dir;
}
function spinRun(name,dir,exe,args,expected){
 const r=run(name,dir+'/'+exe,args,dir);assert.equal(r.status,0,r.output);
 const match=r.output.match(/depth reached (\d+), errors: (\d+)/);assert(match,r.output);
 const constrained=/max search depth too small|out of memory|VECTORSZ too small/.test(r.output);
 const outcome=constrained?'incomplete':+match[2]>0?'counterexample':/Search not completed/.test(r.output)?'incomplete':'complete-within-model';
 assert.equal(outcome,expected,r.output);
 if(expected==='complete-within-model')assert(r.output.includes('Full statespace search'));
 if(expected==='counterexample'){
  const replay=run(name+'-replay',spin,['-t','-p','-g','-l','Dekker.pml'],dir);assert.equal(replay.status,0,replay.output);
  assert(/START OF CYCLE|assertion violated/.test(replay.output),replay.output);
 }
 const row={name,tool:'SPIN',outcome,errors:+match[2],depth:+match[1],stored:+r.output.match(/(\d+) states, stored/)[1]};cases.push(row);return row;
}
const d=spinBuild('dekker',sources['Dekker.pml']);
spinRun('dekker-safety',d,'pan-safety',['-m100000','-w20'],'complete-within-model');
for(const who of ['p','q'])spinRun('dekker-fair-'+who,d,'pan-live',['-a','-f','-N','response_'+who,'-m100000','-w20'],'complete-within-model');
spinRun('dekker-unfair',d,'pan-live',['-a','-N','response_p','-m100000','-w20'],'counterexample');
spinRun('dekker-bounded',d,'pan-safety',['-m2','-w20'],'incomplete');
// Negative mutation: skip the entry protocol, preserving the critical-section observer.
const brokenDekker=sources['Dekker.pml'].replace(/        do\n        :: want\[other\][\s\S]*?        od;/,'        skip;');assert.notEqual(brokenDekker,sources['Dekker.pml']);
const md=spinBuild('dekker-mutant',brokenDekker);
spinRun('dekker-mutant',md,'pan-safety',['-m100000','-w20'],'counterexample');
// Recover the exact old complete-looking fragment to demonstrate missing startup.
const previous=ok(run('previous-chapter','git',['show','4f26c59:pcd/cap-09-verifica.html'],root));
const old=previous.match(/\/\* Dekker's algorithm in PROMELA \(esempio dalle slide\) \*\/[\s\S]*?<\/code>/)[0].replace(/<\/code>$/,'');
const od=path.join(tmp,'old-dekker');fs.mkdirSync(od);fs.writeFileSync(od+'/Old.pml',old);
const rejected=run('dekker-missing-startup',spin,['-a','Old.pml'],od);assert(/no runable process/.test(rejected.output),rejected.output);

const jvm=['-Xmx512m','-XX:+UseParallelGC','-cp',jar];
function prepareTla(name,source){
 const dir=path.join(tmp,name);fs.mkdirSync(dir);fs.writeFileSync(dir+'/Peterson.tla',source);
 for(const n of names.filter(n=>n.endsWith('.cfg')))fs.writeFileSync(dir+'/'+n,sources[n]);
 const translated=run(name+'-translate',java,[...jvm,'pcal.trans','-nocfg', 'Peterson.tla'],dir);ok(translated);assert(translated.output.includes('Translation completed.'));
 const tla=fs.readFileSync(dir+'/Peterson.tla','utf8');assert(tla.includes('Spec == Init /\\ [][Next]_vars'));return dir;
}
function stateRecords(text){
 const result=[];
 for(const b of text.split(/^State \d+:/m).slice(1)){
  const flag=b.match(/flag = \(0 :> (TRUE|FALSE) @@ 1 :> (TRUE|FALSE)\)/),pc=b.match(/pc = \(0 :> "([^"]+)" @@ 1 :> "([^"]+)"\)/),turn=b.match(/turn = ([01])/);
  if(flag&&pc&&turn)result.push({flag:[flag[1]==='TRUE',flag[2]==='TRUE'],turn:+turn[1],pc:[pc[1],pc[2]]});
 }
 return result;
}
function tlcRun(name,dir,config,expected,extra=[]){
 const r=run(name,java,[...jvm,'tlc2.TLC','-workers','1','-fp','0','-seed','1','-config',config,...extra,'Peterson'],dir);
 const count=r.output.match(/(\d+) states generated, (\d+) distinct states found, (\d+) states left on queue/);
 const good=r.output.includes('Model checking completed. No error has been found.');
 const bad=/Error: (Temporal properties were violated|Invariant MutualExclusion is violated)/.test(r.output);
 const outcome=good&&r.status===0&&count&&+count[3]===0?'complete-within-model':bad?'counterexample':'tool-error';assert.equal(outcome,expected,r.output);
 if(expected==='counterexample')assert(r.status!==0);
 if(expected==='tool-error')assert(/Unknown operator: `Not'/.test(r.output),r.output);
 const row={name,tool:'TLC',outcome,...(count?{generated:+count[1],distinct:+count[2],queued:+count[3]}:{})};
 if(bad){row.trace=stateRecords(r.output);assert(row.trace.length>1);row.stuttering=/State \d+: Stuttering/.test(r.output);}
 cases.push(row);return row;
}
const pd=prepareTla('peterson',sources['Peterson.tla']);
const safety=tlcRun('peterson-safety',pd,'Peterson.cfg','complete-within-model',['-dump','states.txt']);
tlcRun('peterson-fair',pd,'PetersonFair.cfg','complete-within-model');
const unfair=tlcRun('peterson-unfair',pd,'PetersonUnfair.cfg','counterexample');assert(unfair.stuttering);
const pm=prepareTla('peterson-mutant',sources['Peterson.tla'].replace('a2: turn := Not(self);','a2: turn := self;'));
const mutant=tlcRun('peterson-mutant',pm,'Peterson.cfg','counterexample');assert(mutant.trace.at(-1).pc.every(p=>p==='cs'));
const pn=prepareTla('peterson-missing-not',sources['Peterson.tla'].replace('Not(i) == 1 - i',''));
tlcRun('peterson-missing-not',pn,'Peterson.cfg','tool-error');
// Independent BFS of the explicit seven-label transition relation.
const initial={flag:[false,false],turn:0,pc:['a0','a0']},queue=[initial],key=s=>JSON.stringify(s),seen=new Set([key(initial)]);
function next(s,i,mutated=false){const t=JSON.parse(key(s)),other=1-i;switch(t.pc[i]){
 case 'a0':t.pc[i]='a1';break;case 'a1':t.flag[i]=true;t.pc[i]='a2';break;
 case 'a2':t.turn=mutated?i:other;t.pc[i]='a3a';break;case 'a3a':t.pc[i]=t.flag[other]?'a3b':'cs';break;
 case 'a3b':t.pc[i]=t.turn===other?'a3a':'cs';break;case 'cs':t.pc[i]='a4';break;
 case 'a4':t.flag[i]=false;t.pc[i]='a0';break;default:throw Error('Unknown PC');}return t;}
for(let j=0;j<queue.length;j++)for(let i=0;i<2;i++){const t=next(queue[j],i),k=key(t);if(!seen.has(k)){seen.add(k);queue.push(t);}}
assert.equal(queue.length,safety.distinct);assert(queue.every(s=>!s.pc.every(pc=>pc==='cs')));
const dumped=stateRecords(fs.readFileSync(pd+'/states.txt.dump','utf8'));assert.equal(dumped.length,queue.length);
assert.deepEqual(dumped.map(key).sort(),[...seen].sort(),'Exact TLC state set, not only a count');
for(let i=1;i<unfair.trace.length;i++)assert([0,1].some(p=>key(next(unfair.trace[i-1],p))===key(unfair.trace[i])),'Reported unfair steps must belong to Next');
for(let i=1;i<mutant.trace.length;i++)assert([0,1].some(p=>key(next(mutant.trace[i-1],p,true))===key(mutant.trace[i])),'Reported mutant steps must belong to its changed Next');
assert(unfair.trace.at(-1).pc.some(pc=>['a1','a2','a3a','a3b'].includes(pc)));
const report={toolchain,sourceSha256:Object.fromEntries(names.map(n=>[n,hash(sources[n])])),cases,missingStartupRejected:true,independentPetersonStates:queue.length};
fs.writeFileSync(out+'/formal-model-test.json',JSON.stringify({...report,tempDirectory:tmp},null,2)+'\n');
const target=root+'/pcd/assets/examples/formal-results.json',json=JSON.stringify(report,null,2)+'\n';
if(process.argv.includes('--patch')){
 const old=fs.readFileSync(target,'utf8');process.stdout.write('*** Begin Patch\n*** Update File: '+target+'\n@@\n'+old.trimEnd().split('\n').map(l=>'-'+l).join('\n')+'\n'+json.trimEnd().split('\n').map(l=>'+'+l).join('\n')+'\n*** End Patch\n');
}else{
 assert.equal(fs.readFileSync(target,'utf8'),json);
 // Execute the actual displayed commands in an isolated directory with only
 // the selected tool aliases added to the child PATH. The checked page is ours.
 const page=fs.readFileSync(root+'/pcd/cap-09-verifica.html','utf8');
 const bin=path.join(tmp,'bin');fs.mkdirSync(bin);fs.symlinkSync(spin,bin+'/spin');fs.symlinkSync(java,bin+'/java');
 for(const name of ['dekker','peterson']){
  const dir=path.join(tmp,'documented-'+name);fs.mkdirSync(dir);
  for(const n of names)fs.writeFileSync(dir+'/'+n,sources[n]);fs.symlinkSync(jar,dir+'/tla2tools.jar');
  const encoded=page.match(new RegExp('<pre data-formal-command="'+name+'"[^>]*><code[^>]*>([\\s\\S]*?)</code>'))?.[1];assert(encoded);
  const command=encoded.replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"').replaceAll('&amp;','&');
  const r=spawnSync('/bin/sh',['-eu','-c',command],{cwd:dir,env:{...process.env,PATH:bin+':'+process.env.PATH},encoding:'utf8',timeout:45000,maxBuffer:8e6});
  const output=(r.stdout||'')+(r.stderr||'');fs.writeFileSync(out+'/formal-documented-'+name+'.log',output);assert(!r.error);assert.equal(r.signal,null);
  if(name==='dekker'){assert.equal(r.status,0,output);assert.equal((output.match(/errors: 0/g)||[]).length,3);assert(!/Search not completed|max search depth too small/.test(output));}
  else {assert(r.status!==0,'Final documented run intentionally finds unfair liveness counterexample');assert.equal((output.match(/Model checking completed. No error has been found./g)||[]).length,2);assert(output.includes('Temporal properties were violated'));}
 }
 console.log(`Real SPIN/TLC: ${cases.length} checks, missing startup rejected, exact ${queue.length}-state TLC/BFS agreement; both documented command blocks passed`);
}
