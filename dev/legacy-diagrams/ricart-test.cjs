const assert=require('node:assert/strict');
const {Model}=require('../../pcd/assets/ricart-agrawala.js');
function rng(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}}
function drain(m,random){while(m.messages.length)m.deliver(m.messages[Math.floor(random()*m.messages.length)].id)}
let events=0;
for(let seed=1;seed<=500;seed++){
 const m=new Model(),random=rng(seed);m.request(2);m.request(0);m.request(1);
 for(let winner=0;winner<3;winner++){
  drain(m,random);assert.deepEqual(m.processes.filter(p=>p.mode==='HELD').map(p=>p.id),[winner]);
  assert.deepEqual(new Set(m.processes[winner].replies),new Set([0,1,2].filter(i=>i!==winner)));
  m.release(winner);
 }
 assert.deepEqual(m.entries,[0,1,2]);assert.equal(m.messages.length,0);events+=m.events.length;
 // Subsequent arbitrary requests, deliveries, and releases; preserve clocks and safety.
 for(let step=0;step<100;step++){
  const actions=[...m.messages.map(x=>()=>m.deliver(x.id)),...m.processes.filter(p=>p.mode==='HELD').map(p=>()=>m.release(p.id)),...m.processes.filter(p=>p.mode==='RELEASED').map(p=>()=>m.request(p.id))];
  const clocks=m.processes.map(p=>p.clock);actions[Math.floor(random()*actions.length)]();
  assert(m.processes.filter(p=>p.mode==='HELD').length<=1);
  m.processes.forEach((p,i)=>assert(p.clock>=clocks[i]));
 }
 // Stop adding requests; fair delivery plus releases must drain all outstanding work.
 for(let i=0;i<4;i++){drain(m,random);for(const p of m.processes)if(p.mode==='HELD')m.release(p.id)}
 assert(m.processes.every(p=>p.mode==='RELEASED'));assert.equal(m.messages.length,0);
}
const stalled=new Model();stalled.request(0);assert.equal(stalled.processes[0].mode,'REQUESTING');assert.throws(()=>stalled.release(0));assert.throws(()=>stalled.deliver(999));assert.throws(()=>stalled.request(0));
for(const n of [2,4,8]){const m=new Model(n);for(let i=0;i<n;i++)m.request(i);for(let i=0;i<n;i++){drain(m,rng(i+1));assert.equal(m.processes[i].mode,'HELD');m.release(i)}assert.deepEqual(m.entries,Array.from({length:n},(_,i)=>i))}
console.log(`500 reordered simultaneous-request scenarios (${events} events), 50,000 mixed actions, fair-drain liveness and invalid actions passed`);
