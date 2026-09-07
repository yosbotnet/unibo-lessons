const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),bin=process.env.NOTES_JDK?path.join(process.env.NOTES_JDK,'bin'):'',tool=name=>bin?path.join(bin,name):name;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'notes-monitor-classes-')),names=require('./monitor-code.cjs').names;
const sources=names.map(n=>root+'/pcd/assets/examples/'+n+'.java');sources.push(__dirname+'/MonitorExamplesTest.java');
const options={encoding:'utf8',timeout:60000};
execFileSync(tool('javac'),['-Xlint:all','-Werror','-d',dir,...sources],options);
const result=execFileSync(tool('java'),['-ea','-cp',dir,'MonitorExamplesTest'],options);
const bytecode=execFileSync(tool('javap'),['-v','-p','-classpath',dir,'SynchCell'],options);if(!bytecode.includes('ACC_SYNCHRONIZED'))throw Error('Missing synchronized method flag');
fs.writeFileSync('/home/ybc/notes-legacy-review-artifacts/monitor-java-test.json',JSON.stringify({compiler:execFileSync(tool('javac'),['-version'],options).trim(),result:result.trim(),classDirectory:dir,sourceFiles:sources,synchronizedMethodFlag:true},null,2)+'\n');console.log(result.trim());
