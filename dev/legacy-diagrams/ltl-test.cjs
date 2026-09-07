const assert=require('node:assert/strict'),fs=require('node:fs');
const m=require('../../pcd/assets/ltl-traces.cjs');
// Independent semantics: enumerate the distinct future positions, no fixed points.
function oracle(t,f,i=0) {
 if(typeof f==='boolean')return f;if(typeof f==='string')return t.states[i][f];
 const [op,a,b]=f,n=t.states.length,next=j=>j+1<n?j+1:t.loop;
 if(op==='!')return !oracle(t,a,i);
 if(op==='&')return oracle(t,a,i)&&oracle(t,b,i);
 if(op==='|')return oracle(t,a,i)||oracle(t,b,i);
 if(op==='->')return !oracle(t,a,i)||oracle(t,b,i);
 if(op==='X')return oracle(t,a,next(i));
 const positions=[],seen=new Set();for(let j=i;!seen.has(j);j=next(j)){positions.push(j);seen.add(j);}
 if(op==='F')return positions.some(j=>oracle(t,a,j));
 if(op==='G')return positions.every(j=>oracle(t,a,j));
 for(const j of positions){if(oracle(t,b,j))return true;if(!oracle(t,a,j))return false;}
 assert(op==='U'||op==='W');return op==='W';
}
// Independent domain oracle: count distinct Q-in-CS intervals before P's first CS.
function atMostOne(t,i) {
 let count=0,previousQ=false;const seen=new Set();
 for(let j=i;;j=j+1<t.states.length?j+1:t.loop){
  const s=t.states[j];if(s.p3)return true;
  const key=[j,count,previousQ].join(':');if(seen.has(key))return true;seen.add(key);
  if(s.q3&&!previousQ)count++;if(count>1)return false;previousQ=s.q3;
 }
}
const {F,G,U,W,not,implies}=m;
const formulaList=[U('p','q'),W('p','q'),F('p'),G('p'),['X','p'],G(F('p')),F(G('p')),G(implies('p',F('q'))),U(F('p'),G('q')),W(U('p','q'),not('p'))];
let traces=0,checks=0;
for(let n=1;n<=4;n++)for(let bits=0;bits<4**n;bits++)for(let loop=0;loop<n;loop++){
 const states=Array.from({length:n},(_,i)=>({p:!!((bits>>(2*i))&1),q:!!((bits>>(2*i))&2)})),t={states,loop};traces++;
 for(const f of formulaList){const actual=m.evaluate(t,f);for(let i=0;i<n;i++){assert.equal(actual[i],oracle(t,f,i));checks++;}}
 assert.deepEqual(m.evaluate(t,W('p','q')),m.evaluate(t,m.or(U('p','q'),G('p'))));
 assert.deepEqual(m.evaluate(t,not(G('p'))),m.evaluate(t,F(not('p'))));
}
let boundTraces=0;
for(let n=1;n<=4;n++)for(let bits=0;bits<8**n;bits++)for(let loop=0;loop<n;loop++){
 const states=Array.from({length:n},(_,i)=>({tryp:!!((bits>>(3*i))&1),p3:!!((bits>>(3*i))&2),q3:!!((bits>>(3*i))&4)})),t={states,loop};
 const actual=m.evaluate(t,m.formulas.bound);for(let i=0;i<n;i++){assert.equal(actual[i],atMostOne(t,i));checks++;}
 assert.equal(m.evaluate(t,m.formulas.everyBound)[0],states.every((s,i)=>!s.tryp||atMostOne(t,i)));boundTraces++;
}
const expected=[
 ['until-now',true,true],['until-later',true,true],['until-never',false,true],['until-gap',false,false],
 ['recurring',true,false],['stable',true,true],['intermittent',true,false],['ignored',false,false],
 ['executed',true,true],['disabled',true,true],['one-interval',true,true],['two-intervals',false,true],
 ['no-entry',true,false],['later-request',false,true]
];
for(const [i,c] of m.cases.entries()){
 const values=m.groups.find(g=>g.id===c.group).columns.map(([key])=>m.evaluate(c,m.formulas[key])[0]);
 assert.deepEqual([c.id,...values],expected[i]);
 if(c.group==='fairness')assert(c.states.every(s=>!s.taken||s.enabled));
}
const later=m.cases.find(c=>c.id==='later-request');
let fairnessTraces=0;
for(let n=1;n<=5;n++)for(let code=0;code<3**n;code++)for(let loop=0;loop<n;loop++){
 const states=Array.from({length:n},(_,i)=>{const digit=Math.floor(code/3**i)%3;return {enabled:digit!==0,taken:digit===2};}),t={states,loop},cycle=states.slice(loop);
 const takenForever=cycle.some(s=>s.taken);
 assert.equal(m.evaluate(t,m.formulas.weakFair)[0],!cycle.every(s=>s.enabled)||takenForever);
 assert.equal(m.evaluate(t,m.formulas.strongFair)[0],!cycle.some(s=>s.enabled)||takenForever);
 fairnessTraces++;
}
assert(m.evaluate(later,implies('tryp',m.formulas.bound))[0],'Old unscoped implication misses the later request');
assert(!m.evaluate(later,m.formulas.everyBound)[0]);
assert(!m.evaluate(m.diagram.safety,m.formulas.mutex)[0]);
assert(m.evaluate(m.diagram.liveness,m.formulas.mutex)[0]);
assert(!m.evaluate(m.diagram.liveness,m.formulas.response)[0]);
// Any sampled finite waiting prefix can still be repaired by a later response.
for(let n=1;n<=32;n++){
 const prefix=Array.from({length:n},()=>({tryp:true,p3:false,q3:false}));
 assert(!m.evaluate({states:prefix,loop:n-1},m.formulas.response)[0]);
 const repaired=[...prefix,{tryp:false,p3:true,q3:false}];assert(m.evaluate({states:repaired,loop:n},m.formulas.response)[0]);
 // But a finite mutual-exclusion violation cannot be undone by a safe suffix.
 const bad=[...m.diagram.safety.states,...repaired];assert(!m.evaluate({states:bad,loop:bad.length-1},m.formulas.mutex)[0]);
}
for(const bad of [{states:[],loop:0},{states:[{p:true}],loop:1},{states:[{p:1}],loop:0},{states:[{p:true}],loop:-1}])assert.throws(()=>m.evaluate(bad,'p'));
for(const f of ['missing',['Y','p'],['F','p','p'],['U','p'],null])assert.throws(()=>m.evaluate({states:[{p:true}],loop:0},f));
const report={traces,boundTraces,fairnessTraces,positionChecks:checks,editorialCases:m.results(),finitePrefixLengths:32,negativeInputs:9};
fs.writeFileSync('/home/ybc/notes-legacy-review-artifacts/ltl-test.json',JSON.stringify(report,null,2)+'\n');
console.log(`${traces} temporal lassos, ${boundTraces} overtaking lassos, ${fairnessTraces} action lassos, ${checks} position checks, 14 editorial cases and finite-prefix controls passed`);
