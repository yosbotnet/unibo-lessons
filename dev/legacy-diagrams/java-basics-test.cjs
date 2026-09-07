const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {execFileSync,spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),out='/home/ybc/notes-legacy-review-artifacts';
const tool=name=>process.env.NOTES_JDK?path.join(process.env.NOTES_JDK,'bin',name):name;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'notes-basics-classes-')),options={encoding:'utf8',timeout:60000};
const sources=['ThreadStartDemo','LockSemanticsDemo','BoundedCounter'].map(n=>root+'/pcd/assets/examples/'+n+'.java');
sources.push(__dirname+'/BoundedCounterTest.java');
execFileSync(tool('javac'),['-Xlint:all','-Werror','-d',dir,...sources],options);
const negative=spawnSync(tool('javac'),['-XDrawDiagnostics','-d',dir,__dirname+'/ReentrantResourceMustFail.java'],options);
assert.equal(negative.status,1);assert.match(negative.stderr,/compiler.err.prob.found.req.*try.not.applicable.to.type.*ReentrantLock.*AutoCloseable/);
let thread,lock;
for(let run=0;run<20;run++){
 thread=execFileSync(tool('java'),['-ea','-cp',dir,'ThreadStartDemo'],options).trim();
 assert.equal(thread,'run: caller thread; t is NEW\nstart + join: worker thread; t is TERMINATED; executions = 2\nsecond start: IllegalThreadStateException');
 lock=execFileSync(tool('java'),['-ea','-cp',dir,'LockSemanticsDemo'],options).trim();
 assert.equal(lock,'method\tacquired\tInterruptedException\tinterruptStatus\nlock\ttrue\tfalse\ttrue\ninterruptible\tfalse\ttrue\tfalse\ntry\tfalse\tfalse\tfalse\ntimeout\tfalse\tfalse\tfalse\ntimed-interrupt\tfalse\ttrue\tfalse');
}
const bounded=execFileSync(tool('java'),['-ea','-cp',dir,'BoundedCounterTest'],options).trim();
fs.writeFileSync(out+'/java-basics-test.json',JSON.stringify({compiler:execFileSync(tool('javac'),['-version'],options).trim(),runs:20,thread,lock,bounded,negativeDiagnostic:negative.stderr.trim(),classDirectory:dir},null,2)+'\n');
console.log('20 direct/start/join runs, 100 lock scenarios, reentrancy and negative AutoCloseable compilation passed');
console.log(bounded);
