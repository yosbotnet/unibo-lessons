const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),out='/home/ybc/notes-legacy-review-artifacts';
const source=root+'/pcd/assets/examples/EvenCounter.smt2',solver=process.env.NOTES_Z3;
assert(solver,'Set NOTES_Z3 to the local Z3 binary');
const v=spawnSync(solver,['--version'],{encoding:'utf8'});assert.equal(v.status,0);assert.match(v.stdout,/Z3 version 4\.13\.3/);
const r=spawnSync(solver,['-T:10',source],{encoding:'utf8',timeout:15000});assert(!r.error);assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(r.stderr,'');
const output=r.stdout.trim();fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+'/proof-z3.log',output+'\n');
assert.deepEqual(output.split('\n').filter(l=>/^(un)?sat$/.test(l)),['unsat','unsat','unsat','sat','sat']);
assert.match(output,/safe-is-not-inductive\nsat\n\(\(n 10\)\s*\(x 9\)\s*\(xp 11\)\)/);
assert.match(output,/mutant-plus-three\nsat\n\(\(n 2\)\s*\(x 0\)\s*\(xp 3\)\)/);
let transitions=0;
for(let n=0;n<=200;n+=2){
 const inv=x=>x>=0&&x<=n&&x%2===0,safe=x=>x!==n+1,next=x=>x<n?x+2:x;
 assert(inv(0));for(let x=-2;x<=n+4;x++)if(inv(x)){assert(inv(next(x)));assert(safe(x));transitions++;}
 for(let x=0;x<=n;x+=2)assert(safe(x));
}
function fact(n){let r=1n;for(let i=2n;i<=BigInt(n);i++)r*=i;return r;}
function multinomial(lengths){return fact(lengths.reduce((a,b)=>a+b,0))/lengths.reduce((a,b)=>a*fact(b),1n);}
// Separate recursion actually enumerates each order-preserving schedule.
function enumerate(lengths){let count=0n;const left=[...lengths];function visit(){if(left.every(n=>n===0)){count++;return;}for(let i=0;i<left.length;i++)if(left[i]){left[i]--;visit();left[i]++;}}visit();return count;}
const counts=[[2,2],[4,4],[2,2,2],[4,4,4],[1,3,2]].map(lengths=>{const count=multinomial(lengths);assert.equal(enumerate(lengths),count);return {lengths,count:String(count)};});
assert.deepEqual(counts.map(r=>r.count),['6','70','90','34650','60']);
// Distinct paths versus merged states: two ordered independent actions each.
const positions=new Set();function visit(p,q){positions.add(`${p},${q}`);if(p<2)visit(p+1,q);if(q<2)visit(p,q+1);}visit(0,0);assert.equal(positions.size,9);
// Additional synchronization P's final step before Q's first: only PPQQ remains.
let synchronized=0;function ordered(s,p,q){if(p===2&&q===2){synchronized++;assert.equal(s,'PPQQ');return;}if(p<2)ordered(s+'P',p+1,q);if(q<2&&p===2)ordered(s+'Q',p,q+1);}ordered('',0,0);assert.equal(synchronized,1);
const report={solver:v.stdout.trim(),sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),output,obligations:['unsat','unsat','unsat'],nonInductiveWitness:{n:10,x:9,xp:11},mutantWitness:{n:2,x:0,xp:3},integerTransitions:transitions,counts,independentPaths:6,independentStates:9,synchronizedPaths:1};
fs.writeFileSync(out+'/proof-count-test.json',JSON.stringify(report,null,2)+'\n');
const canonical=root+'/pcd/assets/examples/proof-results.json',serialized=JSON.stringify(report,null,2)+'\n';
if(process.argv.includes('--patch')){
 const previous=fs.existsSync(canonical)?fs.readFileSync(canonical,'utf8'):null;
 process.stdout.write('*** Begin Patch\n'+(previous===serialized?'':(previous===null?'*** Add File: ':'*** Update File: ')+canonical+'\n'+(previous===null?'':'@@\n'+previous.trimEnd().split('\n').map(l=>'-'+l).join('\n')+'\n')+serialized.trimEnd().split('\n').map(l=>'+'+l).join('\n')+'\n')+'*** End Patch\n');
}else{
 assert.deepEqual(JSON.parse(fs.readFileSync(canonical)),report,'Recorded evidence is stale; rerun --patch and review');
 console.log('Z3: three unbounded obligations and two witnesses; '+transitions+' finite transition controls; five enumerated schedule counts and paths/states distinction passed');
}
