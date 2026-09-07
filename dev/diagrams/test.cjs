const assert=require('node:assert/strict'),diagrams=require('./dl.cjs');
const get=plate=>diagrams.find(d=>d.plate===plate);
function edge(plate,a,b){assert(get(plate).edges.some(e=>e.from.split('.')[0]===a&&e.to.split('.')[0]===b),plate+': missing '+a+' → '+b)}
function crosses(a,b,n){let lo=0,hi=1;for(const [p,q]of [[-(b[0]-a[0]),a[0]-n.x-2],[b[0]-a[0],n.x+n.w-2-a[0]],[-(b[1]-a[1]),a[1]-n.y-2],[b[1]-a[1],n.y+n.h-2-a[1]]]){if(p===0){if(q<0)return false}else{const r=q/p;if(p<0)lo=Math.max(lo,r);else hi=Math.min(hi,r);if(lo>hi)return false}}return true}
let edges=0;for(const d of diagrams){d.validate();for(const e of d.edges){edges++;const pts=[d.port(e.from),...e.via,d.port(e.to)];for(const n of d.nodes.values()){if([e.from.split('.')[0],e.to.split('.')[0]].includes(n.id))continue;for(let i=1;i<pts.length;i++)assert(!crosses(pts[i-1],pts[i],n),d.plate+': '+e.from+' → '+e.to+' crosses node '+n.id)}}}
edge('1.1','optimizer','model');assert(!get('1.1').edges.some(e=>e.from.startsWith('optimizer.')&&e.to.startsWith('data.')));
const m=get('2.2'),A=m.nodes.get('A').matrix,B=m.nodes.get('B').matrix,C=m.nodes.get('C').matrix;assert.deepEqual(A.map(row=>B[0].map((_,j)=>row.reduce((s,a,k)=>s+a*B[k][j],0))),C);
assert.deepEqual(m.port('A.rowE'),[190,145]);assert.deepEqual(m.port('B.colS'),[315,220]);assert.deepEqual(m.port('C.cellS'),[567.5,170]);
assert.equal((-2+5)*-4,-12);assert.deepEqual([-4,-4,-2+5],[-4,-4,3]);for(const [a,b]of [['f','q'],['f','z'],['q','x'],['q','y']])edge('2.4','rev-'+a,'rev-'+b);
for(let i=0;i<4;i++)edge('3.1','x'+i,'sum');edge('3.1','sum','activation');
for(let i=0;i<4;i++)edge('7.3','b'+i,'concat');
for(const [a,b]of [['r','reset'],['h','reset'],['reset','candidate'],['input','candidate'],['candidate','candidate-out'],['complement','new'],['mix-candidate','new'],['u','retain'],['old','retain'],['new','sum'],['retain','sum'],['sum','output']])edge('8.4',a,b);
assert.deepEqual(get('8.4').nodes.get('candidate-out').lines,get('8.4').nodes.get('mix-candidate').lines,'Same candidate reused in second panel');
for(const eq of ['rₜ=σ(Wᵣhₜ₋₁+Uᵣxₜ)','uₜ=σ(Wᵤhₜ₋₁+Uᵤxₜ)','h̃ₜ=tanh(Wₕ(rₜ⊙hₜ₋₁)+Uₕxₜ)'])assert(get('8.4').caption.includes(eq),'Factored GRU definition missing');
assert.deepEqual([0,1,2,3].map(i=>get('7.3').nodes.get('b'+i).lines[1]),['64 channels','128 channels','32 channels','32 channels']);
assert.equal(64+128+32+32,256);assert.equal(get('7.3').nodes.get('r1').lines[1],'96 channels');assert.equal(get('7.3').nodes.get('r2').lines[1],'16 channels');
assert.equal(new Set([0,1,2,3].map(i=>get('7.3').port('concat.p'+i).join(','))).size,4,'Distinct concat entry points');
for(const plate of ['2.4','3.1'])for(const e of get(plate).edges){assert.equal(e.via.length,0,'Direct straight edge');for(const ref of [e.from,e.to]){const n=get(plate).nodes.get(ref.split('.')[0]),p=get(plate).port(ref);if(n.shape==='circle')assert(Math.abs(Math.hypot(p[0]-n.x-n.w/2,p[1]-n.y-n.h/2)-n.w/2)<1e-8,'Arrow clipped to circle')}}
for(let i=0;i<3;i++){for(let prefix of ['f','b']){edge('8.5','x'+i,prefix+i);edge('8.5',prefix+i,'o'+i)}if(i){edge('8.5','f'+(i-1),'f'+i);edge('8.5','b'+i,'b'+(i-1))}}
for(const id of ['q','f','rev-q','rev-f'])assert.equal(get('2.4').nodes.get(id).shape,'circle');
for(const id of ['reset','retain','new','sum'])assert.equal(get('8.4').nodes.get(id).shape,'circle');
for(let i=0;i<3;i++)for(const prefix of ['f','b'])assert.equal(get('8.5').nodes.get(prefix+i).shape,'circle');
assert(!get('8.5').edges.some(e=>/^f\d/.test(e.from)&&/^b\d/.test(e.to)||/^b\d/.test(e.from)&&/^f\d/.test(e.to)),'No recurrence between bidirectional chains');
for(const [a,b]of [['Q','score'],['K','score'],['score','softmax'],['softmax','mix'],['V','mix'],['mix','O']])edge('10.2',a,b);
for(let i=0;i<3;i++){edge('10.3','x'+i,'add'+i);edge('10.3','p'+i,'add'+i);edge('10.4','X','h'+i);edge('10.4','h'+i,'concat')}
console.log('PASS: '+diagrams.length+' diagrams, '+edges+' port-connected edges; no edge crosses an unrelated node; semantic invariants and matrix values verified.');
