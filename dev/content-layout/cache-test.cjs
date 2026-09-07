const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
(async()=>{for(const [file,prefix] of [['dl/sw-v2.js','dl-'],['macro/sw.js','macro-'],['politics/sw.js','politics-']]){
 const code=fs.readFileSync(path.resolve(__dirname,'../..',file),'utf8'),current=code.match(/(?:const|var) CACHE = '([^']+)'/)[1],handlers={},deleted=[];
 const foreign=['unrelated-user-cache',...['dl-','macro-','politics-'].filter(p=>p!==prefix).map(p=>p+'keep')];
 const self={addEventListener:(name,fn)=>handlers[name]=fn,clients:{claim:()=>Promise.resolve()}};
 vm.runInNewContext(code,{self,caches:{keys:async()=>[current,prefix+'obsolete',...foreign],delete:async k=>{deleted.push(k);return true}},Promise});
 let work;handlers.activate({waitUntil:p=>work=p});await work;assert.deepEqual(deleted,[prefix+'obsolete'],file+' must leave other caches alone');
 console.log('PASS cache ownership: '+file);
}})().catch(e=>{console.error(e);process.exitCode=1});
