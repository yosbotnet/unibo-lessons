const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const m=require('../../cybersecurity/assets/transfer-evidence.cjs'),out='/home/ybc/notes-legacy-review-artifacts';
const wanted={eligible:{n:4,targeted:2,untargeted:3},sourceSuccessful:{n:3,targeted:1,untargeted:2},excluded:1};
assert.deepEqual(m.evaluate(m.examples),wanted);
const rows=[];
for(let y=0;y<3;y++)for(let target=0;target<3;target++)if(target!==y)
 for(let cleanA=0;cleanA<3;cleanA++)for(let cleanB=0;cleanB<3;cleanB++)for(let advA=0;advA<3;advA++)for(let advB=0;advB<3;advB++)rows.push({y,target,cleanA,cleanB,advA,advB});
let pairChecks=0;
function oracle(rs){const result={eligible:{n:0,targeted:0,untargeted:0},sourceSuccessful:{n:0,targeted:0,untargeted:0},excluded:0};
 for(const x of rs){if(x.cleanA!==x.y||x.cleanB!==x.y){result.excluded++;continue;}const buckets=[result.eligible];if(x.advA===x.target)buckets.push(result.sourceSuccessful);for(const b of buckets){b.n++;switch(x.advB){case x.target:b.targeted++;b.untargeted++;break;case x.y:break;default:b.untargeted++;}}}return result;}
for(const a of rows){const c=m.classify(a);assert(!c.targeted||c.untargeted);assert.deepEqual(m.evaluate([a]),oracle([a]));for(const b of rows){assert.deepEqual(m.evaluate([a,b]),oracle([a,b]));pairChecks++;}}
let permutations=0;function permute(prefix,left){if(!left.length){assert.deepEqual(m.evaluate(prefix),wanted);permutations++;return;}left.forEach((x,i)=>permute([...prefix,x],left.filter((_,j)=>j!==i)));}permute([],m.examples);
assert.deepEqual(m.evaluate([]),{eligible:{n:0,targeted:0,untargeted:0},sourceSuccessful:{n:0,targeted:0,untargeted:0},excluded:0});
for(const x of [null,{}, {...m.examples[0],target:0},{...m.examples[0],advB:NaN},{...m.examples[0],cleanA:-1},{...m.examples[0],advA:0.5}])assert.throws(()=>m.classify(x));assert.throws(()=>m.evaluate({}));
const paper=process.env.NOTES_LIU_PDF;assert(paper,'Set NOTES_LIU_PDF to the inspected arXiv v3 PDF');
const pdf=fs.readFileSync(paper),r=spawnSync('pdftotext',['-layout',paper,'-'],{encoding:'utf8',timeout:15000,maxBuffer:2e6});assert.equal(r.status,0);assert(!r.error);
for(const [i,entry] of m.literature.rows.entries()){
 const line=r.stdout.split('\n').find(l=>new RegExp('^\\s*-'+entry.heldOut+'\\s+30\\.|^\\s*-'+entry.heldOut+'\\s+(?:31\\.13|29\\.70)').test(l));assert(line,entry.heldOut);
 const cells=line.trim().split(/\s+/);assert.equal(Number(cells[1]),entry.rmsd);assert.equal(Number(cells[i+2].replace('%','')),entry.matchingPercent);
}
const evidence={records:rows.length,pairChecks,permutations,invalidInputs:7,example:wanted,paperSha256:crypto.createHash('sha256').update(pdf).digest('hex'),literatureRows:m.literature.rows,scope:'Metric semantics and transcription only; neural-network attacks were not rerun'};
fs.writeFileSync(out+'/transfer-test.json',JSON.stringify(evidence,null,2)+'\n');console.log(`${rows.length} records, ${pairChecks} pairs, ${permutations} permutations, seven invalid inputs; five literature values match original PDF`);
