// A hash-linked record format, not Bitcoin, a signature scheme or consensus.
const crypto=require('node:crypto');
const zero='0'.repeat(64),domain='notes-hash-chain-v1';
const payloads=['Open record log','Alice->Bob: 1 unit','Bob->Carol: 1 unit'];
const sha=text=>crypto.createHash('sha256').update(text,'utf8').digest('hex');
function text(value){if(typeof value!=='string'||!value.isWellFormed()||value.length>200)throw Error('Payload must be well-formed text of at most 200 UTF-16 units');return value}
function serialize(r){
 if(!r||!Number.isSafeInteger(r.index)||r.index<0||!/^[a-f0-9]{64}$/.test(r.previous))throw Error('Invalid record format');
 return JSON.stringify([domain,r.index,r.previous,text(r.payload)]);
}
function build(values=payloads){
 if(!Array.isArray(values)||values.length<1||values.length>32)throw Error('Use 1–32 records');
 const records=[];for(const [index,payload]of values.entries()){
  const r={index,previous:records.at(-1)?.digest||zero,payload:text(payload)};
  records.push({...r,digest:sha(serialize(r))});
 }return records;
}
function change(records,index,payload){
 if(!Number.isInteger(index)||index<0||index>=records.length)throw Error('Unknown record');
 const copy=structuredClone(records);copy[index].payload=text(payload);return copy;
}
function checkpoint(records){if(!records.length)throw Error('Empty history');return {length:records.length,head:records.at(-1).digest}}
function inspect(records,anchor){
 if(!Array.isArray(records)||records.length<1||records.length>32)throw Error('Use 1–32 records');
 if(anchor&&(!Number.isSafeInteger(anchor.length)||anchor.length<1||!/^[a-f0-9]{64}$/.test(anchor.head)))throw Error('Invalid checkpoint');
 const rows=records.map((r,i)=>({index:r.index,input:serialize(r),computed:sha(serialize(r)),stored:r.digest,indexOK:r.index===i}));
 for(const [i,row]of rows.entries()){
  row.hashOK=records[i].digest===row.computed;
  row.linkOK=records[i].previous===(i?rows[i-1].computed:zero);
 }
 const coherent=rows.every(r=>r.indexOK&&r.hashOK&&r.linkOK),head=rows.at(-1).computed;
 const headMatches=anchor?head===anchor.head:null,lengthMatches=anchor?records.length===anchor.length:null;
 return {rows,coherent,head,headMatches,lengthMatches,accepted:anchor?coherent&&headMatches&&lengthMatches:coherent};
}
function evidence(){
 const original=build(),anchor=checkpoint(original),edited=change(original,1,'Alice->Bob: 9 units');
 const rebuilt=build(edited.map(r=>r.payload));
 return {domain,encoding:'UTF-8 JSON array; no trailing newline',anchor,scenarios:[
  {id:'original',title:'Original records',records:original},
  {id:'edited',title:'Edit B1 only; retain stored hashes and links',records:edited},
  {id:'rebuilt',title:'Edit B1 and recompute the suffix',records:rebuilt}
 ].map(s=>({...s,result:inspect(s.records,anchor)}))};
}
module.exports={zero,domain,payloads,sha,serialize,build,change,checkpoint,inspect,evidence};
