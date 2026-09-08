const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process'),c=require('./agent-content.cjs');
const root=path.resolve(__dirname,'../..'),out='/home/ybc/notes-legacy-review-artifacts',dir=process.env.NOTES_AGENT_EVIDENCE;
assert(dir,'Set NOTES_AGENT_EVIDENCE to the reviewed PDF directory');
const pins={react:'f285b0971ae4a790e402fb93966bed3adde2cf0a04977d08b2b40d6ab0cace69',camel:'c3719f6ce73eecf45e3764debef8a3d8ff8c9233b37d128c558b694ec3790cc7'},evidence={};
for(const [name,sha] of Object.entries(pins)){const p=path.join(dir,name+'.pdf');assert.equal(crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),sha);evidence[name]=execFileSync('pdftotext',['-raw',p,'-'],{encoding:'utf8',maxBuffer:6e6}).replace(/\s+/g,' ');}
assert.match(evidence.react,/finish\[answer\]/);assert.match(evidence.react,/thought-action-observation steps/);assert.match(evidence.react,/Wikipedia web API/);
assert.match(evidence.camel,/Explicit non-goals of CaMeL/);assert.match(evidence.camel,/We assume that the user prompt is trusted/);assert.match(evidence.camel,/enforce security policies based on capabilities/);
let policies=0,allowed=0;for(const actor of ['A','B'])for(const owner of ['A','B'])for(const destination of ['record-store','search','reply'])for(const data of ['public','record']){
 const expected=data==='public'?destination!=='record-store':actor===owner&&destination!=='search',call={actor,owner,destination,data},before=JSON.stringify(call),result=c.model.decide(Object.freeze(call));assert.equal(result.allow,expected,JSON.stringify(call));assert.equal(JSON.stringify(call),before);assert(result.reason.length>0);policies++;allowed+=Number(result.allow);
}assert.equal(policies,24);assert.equal(allowed,12);
const valid={actor:'A',owner:'A',destination:'reply',data:'record'},invalid=[null,[],{},'call',42,{...valid,actor:'C'},{...valid,owner:''},{...valid,destination:'shell'},{...valid,data:'secret'},{...valid,extra:true},...Object.keys(valid).map(k=>Object.fromEntries(Object.entries(valid).filter(([key])=>key!==k)))];
for(const x of invalid)assert.throws(()=>c.model.decide(x),TypeError);assert.throws(()=>c.model.run('unknown'),TypeError);
const states={own:['Request','Proposal','Check','Dispatch','Observation','Proposal','Check','Dispatch','Finished'],denied:['Request','Proposal','Check','Blocked'],injected:['Request','Proposal','Check','Dispatch','Observation','Proposal','Check','Blocked']};
const expected={'own-local':[states.own,1,1,'finished'],'other-local':[states.denied,0,0,'blocked'],'public-search':[states.own,1,1,'finished'],'private-search':[states.denied,0,0,'blocked'],'returned-instruction':[states.injected,1,0,'blocked']};
const ids={Request:'Q',Proposal:'P',Check:'G',Dispatch:'T',Observation:'O',Finished:'F',Blocked:'B'},edges=['Q_P','P_G','G_B','G_T','T_O','O_P','T_F'];let transitions=0;
for(const [id,[sequence,calls,replies,outcome]] of Object.entries(expected)){const r=c.model.run(id);assert.deepEqual(r.trace.map(x=>x.state),sequence);assert.equal(r.toolCalls,calls);assert.equal(r.replies,replies);assert.equal(r.outcome,outcome);
 for(let i=1;i<r.trace.length;i++){const previous=r.trace[i-1],step=r.trace[i];assert(edges.includes(ids[previous.state]+'_'+ids[step.state]));if(step.state==='Dispatch')assert.match(previous.detail,/^ALLOW:/);if(step.state==='Blocked')assert.match(previous.detail,/^DENY:/);transitions++;}
 assert.equal(r.trace.filter(x=>x.state==='Dispatch').length,calls+replies);
}
const mutated=c.model.scenarios();mutated[0].proposals[0].actor='B';assert.equal(c.model.run('own-local').outcome,'finished');const r=c.model.run('own-local');r.trace.length=0;assert.equal(c.model.run('own-local').trace.length,9);
(async()=>{const {parse}=await import('../contracts/node_modules/parse5/dist/index.js');for(const e of require('./transfer-sources.cjs')){const html=fs.readFileSync(root+'/'+e.file,'utf8'),errors=[];parse(html,{onParseError:e=>errors.push(e)});assert.deepEqual(errors,[]);assert.equal(c.next(e,html,c.dimensions()),html);
 const before=execFileSync('git',['show','1d39c20:'+e.file],{cwd:root,encoding:'utf8'});const dp=s=>s.match(/<!-- BEGIN DIFFERENTIAL PRIVACY -->[\s\S]*?<!-- END DIFFERENTIAL PRIVACY -->/)[0];assert.equal(dp(html),dp(before),'Preserve complete DP block');
 for(const wrong of ['LessonKit.stateExplorer(\'#react-flow\'','privacy is structurally guaranteed','<strong>4 safe tools</strong>','The agent has 4 safe tools','never sent to the cloud during normal operation'])assert(!html.includes(wrong),wrong);
 for(const file of ['agent-policy-model.js','agent-policy-widget.js'])assert.equal(html.split('src="../cybersecurity/assets/'+file+'"').length,2);
 for(const id of Object.keys(expected))assert.equal(html.split('data-agent-case="'+id+'"').length,2);
 assert.match(html,/Client-side controls only teach the example/);assert.match(html,/Both tool operations and final replies pass through the gate/);
}
fs.writeFileSync(out+'/agent-test.json',JSON.stringify({pins,policies,allowed,denied:policies-allowed,invalid:invalid.length+1,scenarios:5,transitions,markup:true,dpPreserved:true,idempotence:true,scope:'Invented deterministic policy; no LLM experiment or production security guarantee'},null,2)+'\n');console.log(`${policies} policies, ${invalid.length+1} rejected inputs, 5 exact traces/${transitions} graph transitions, two pinned sources, valid markup and preserved DP passed`);})().catch(e=>{console.error(e);process.exitCode=1;});
