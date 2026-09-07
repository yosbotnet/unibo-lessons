const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');
function verify(repetitions=1){
 const tool=name=>process.env.NOTES_JDK?path.join(process.env.NOTES_JDK,'bin',name):name;
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'notes-executor-classes-'));
 const options={encoding:'utf8',timeout:60000};
 const sources=['PrimeProducer','ExecutorLifecycleDemo'].map(n=>path.join(root,'pcd/assets/examples',n+'.java'));
 sources.push(path.join(__dirname,'PrimeProducerTest.java'));
 execFileSync(tool('javac'),['-Xlint:all','-Werror','-d',dir,...sources],options);
 const expected=[
  ['shutdown',false,false,false,false,0,false,false],
  ['shutdownNow',false,false,false,false,1,false,true],
  ['cancel(true)',true,true,false,false,0,false,true],
  ['cancel(false)',true,true,false,false,0,false,false]
 ].map(row=>row.map(String));
 let rows,header;
 for(let i=0;i<repetitions;i++){
  const lines=execFileSync(tool('java'),['-ea','-cp',dir,'ExecutorLifecycleDemo'],options).trim().split('\n').map(x=>x.split('\t'));
  [header,...rows]=lines;
  assert.deepEqual(header,['case','futureDone','futureCancelled','bodyExited','poolTerminated','returnedQueued','queuedFutureDone','interruptObserved']);
  assert.deepEqual(rows,expected);
 }
 const producer=execFileSync(tool('java'),['-ea','-cp',dir,'PrimeProducerTest'],options).trim();
 return {compiler:execFileSync(tool('javac'),['-version'],options).trim(),repetitions,header,rows,producer,classDirectory:dir};
}
if(require.main===module){
 const result=verify(10);
 fs.writeFileSync('/home/ybc/notes-legacy-review-artifacts/executor-java-test.json',JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));
}
module.exports={verify};
