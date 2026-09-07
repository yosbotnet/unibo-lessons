const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),out='/home/ybc/notes-legacy-review-artifacts';
assert(process.env.NOTES_JDK20,'Set NOTES_JDK20 to a JDK 20 directory, not the JDK 17 used by other tests');
const tool=n=>path.join(process.env.NOTES_JDK20,'bin',n),dir=fs.mkdtempSync(path.join(os.tmpdir(),'notes-structured20-classes-'));
function run(toolName,args){const r=spawnSync(tool(toolName),args,{cwd:root,encoding:'utf8',timeout:30000});assert(!r.error,String(r.error));return r;}
const compiler=run('javac',['-version']);assert.equal(compiler.status,0);assert.match(compiler.stdout,/javac 20\./);
const source=root+'/pcd/assets/examples/StructuredFetch20.java';
const compile=run('javac',['--enable-preview','--release','20','--add-modules','jdk.incubator.concurrent','-Xlint:all,-preview','-d',dir,source,__dirname+'/StructuredScope20Test.java']);
assert.equal(compile.status,0,compile.stderr);
for(const line of compile.stderr.trim().split('\n'))assert(
 /^warning: using incubating module\(s\): jdk\.incubator\.concurrent$/.test(line)||
 /^Note: .*StructuredScope20Test\.java uses preview features of Java SE 20\.$/.test(line)||
 /^Note: Recompile with -Xlint:preview for details\.$/.test(line)||line==='1 warning',
 'Unexpected compiler diagnostic: '+line);
const flags=['--enable-preview','--add-modules','jdk.incubator.concurrent','-ea','-cp',dir];
const tested=run('java',[...flags,'StructuredScope20Test']);assert.equal(tested.status,0,tested.stderr);
const [summary,events]=tested.stdout.trim().split('\n');assert.match(summary,/checks=\d+; repetitions=10; scenarios=70/);
const example=run('java',[...flags,'StructuredFetch20']);assert.equal(example.status,0,example.stderr);
assert.equal(example.stdout.trim(),'Response[user=Ada, order=17]');
for(const result of [tested,example])assert.equal(result.stderr.trim(),'WARNING: Using incubator modules: jdk.incubator.concurrent');
const withoutPreview=run('java',['--add-modules','jdk.incubator.concurrent','-cp',dir,'StructuredFetch20']);
assert.notEqual(withoutPreview.status,0);assert.match(withoutPreview.stderr,/UnsupportedOperationException/);assert.match(withoutPreview.stderr,/preview/i);
const withoutModule=run('javac',['--release','20','-d',dir,source]);
assert.notEqual(withoutModule.status,0);assert.match(withoutModule.stderr,/jdk\.incubator\.concurrent/);assert.match(withoutModule.stderr,/not visible|does not exist/);
fs.writeFileSync(out+'/structured-java-test.json',JSON.stringify({compiler:compiler.stdout.trim(),diagnostics:compile.stderr.trim(),summary,trace:events.split(' | '),example:example.stdout.trim(),withoutPreview:withoutPreview.stderr.trim(),withoutModule:withoutModule.stderr.trim(),classDirectory:dir},null,2)+'\n');
console.log(summary+'\n'+events+'\n'+example.stdout.trim()+'\nMissing module / preview flags correctly rejected');
