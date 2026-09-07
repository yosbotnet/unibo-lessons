const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),out='/home/ybc/notes-legacy-review-artifacts';
const tool=name=>process.env.NOTES_JDK?path.join(process.env.NOTES_JDK,'bin',name):name;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'notes-barrier-classes-')),options={encoding:'utf8',timeout:60000};
execFileSync(tool('javac'),['-Xlint:all','-Werror','-d',dir,...['CyclicBarrierMonitor','CountDownLatchMonitor'].map(n=>root+'/pcd/assets/examples/'+n+'.java'),__dirname+'/BarrierLatchTest.java'],options);
const runs=[];
for(let i=0;i<3;i++){
 const result=execFileSync(tool('java'),['-ea','-cp',dir,'BarrierLatchTest'],options).trim();
 const trace=result.split('\n').filter(x=>x.startsWith('trace\t')).map(x=>x.slice(6));
 assert.deepEqual(trace,['A waits in g','B completes g','B waits in g+1','A returns from g','A completes g+1','B returns from g+1']);
 assert(result.includes('original: second round returned with only one participant'));
 runs.push({trace,checks:Number(result.match(/checks\t(\d+)/)[1])});
}
fs.writeFileSync(out+'/barrier-java-test.json',JSON.stringify({compiler:execFileSync(tool('javac'),['-version'],options).trim(),runs,classDirectory:dir},null,2)+'\n');
console.log('Three Java runs: original bug reproduced, cyclic generations, breaks/resets, late interruption and one-shot latch verified',runs.map(x=>x.checks));
