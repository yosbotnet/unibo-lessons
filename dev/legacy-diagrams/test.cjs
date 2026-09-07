const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createRenderer}=require('./render.cjs'),entries=require('./sources.cjs');
const root=path.resolve(__dirname,'../..'),out='/home/ybc/notes-legacy-review-artifacts';
(async()=>{
 const r=await createRenderer(),results=[];fs.mkdirSync(out,{recursive:true});
 try{
  for(const e of entries){const a=await r.render(e),b=await r.render(e);assert.equal(a.svg,b.svg,'Determinism '+e.id);
   const counts={'pcd-interleavings':[5,4],'pcd-exchange-central':[4,3],'pcd-exchange-all':[4,6],'pcd-exchange-ring':[4,4],'pcd-ricart-request':[6,5],'pcd-consensus-rounds':[9,6],'pcd-smr-order':[8,7],'pcd-raft-replication':[7,8],'ds-threat-chain':[4,3],'ds-independent-contexts':[2,1]};
   Object.assign(counts,{'pcd-chang-ring':[4,4],'pcd-chang-phases':[3,2]});
   Object.assign(counts,{'pcd-causal-dependencies':[6,6],'pcd-causal-buffer':[4,3]});
   Object.assign(counts,{'pcd-central-causal':[8,8],'pcd-central-token':[8,9]});
   Object.assign(counts,{'pcd-cut-events':[6,5],'pcd-snapshot-fifo':[7,7]});
   Object.assign(counts,{'pcd-phase-king':[10,11]});
   Object.assign(counts,{'ds-cap-policy':[6,5],'ds-cap-proof':[7,7]});
   Object.assign(counts,{'ds-pbft-normal':[8,7]});
   Object.assign(counts,{'ds-ledger-fork':[6,5],'ds-pow-trial':[5,5]});
   Object.assign(counts,{'ds-contract-outcomes':[8,9]});
   Object.assign(counts,{'ds-hash-checkpoint':[6,6]});
   Object.assign(counts,{'pcd-raft-commit':[7,7]});
   if(e.id==='pcd-raft-commit')for(const pair of ['A_B','B_C','B_W','C_W','C_D','D_E','E_F'])assert.equal(a.edges.filter(x=>x.id.startsWith(`${e.id}-L_${pair}_`)&&x.end).length,1,'Raft commit dependency '+pair);
   if(e.id==='ds-hash-checkpoint')for(const pair of ['B0_B1','B1_B2','B0_R1','R1_R2','B2_C','R2_C'])assert.equal(a.edges.filter(x=>x.id.startsWith(`${e.id}-L_${pair}_`)&&x.end).length,1,'Hash history connection '+pair);
   if(e.id==='ds-contract-outcomes')for(const pair of ['A_B','B_S','B_R','B_O','S_K','R_X','O_X','K_F','X_F'])assert.equal(a.edges.filter(x=>x.id.startsWith(`${e.id}-L_${pair}_`)&&x.end).length,1,'EVM outcome connection '+pair);
   if(e.id==='ds-ledger-fork')for(const pair of ['g_b1','b1_b2','b2_b3a','b2_b3b','b3b_b4'])assert.equal(a.edges.filter(x=>x.id.startsWith(`${e.id}-L_${pair}_`)&&x.end).length,1,'Parent-child connection '+pair);
   if(e.id==='ds-pbft-normal')for(const pair of ['A_B','B_C','C_D','D_E','E_F','F_G','G_H'])assert.equal(a.edges.filter(x=>x.id.startsWith(`${e.id}-L_${pair}_`)&&x.end).length,1,'PBFT evidence transition '+pair);
   if(e.id==='ds-cap-policy')for(const pair of ['W_R','R_A','R_C','A_X','C_Y'])assert.equal(a.edges.filter(x=>x.id.startsWith(`${e.id}-L_${pair}_`)&&x.end).length,1,'Read-policy consequence '+pair);
   if(e.id==='ds-cap-proof')for(const pair of ['P_A','P_B','A_C','B_D','C_E','D_E','E_F'])assert.equal(a.edges.filter(x=>x.id.startsWith(`${e.id}-L_${pair}_`)&&x.end).length,1,'Indistinguishability argument '+pair);
   if(e.id==='pcd-phase-king')for(const pair of ['A_B','B_C','C_D','D_E','E_F','E_G','F_H','G_H','H_I','I_A','H_J'])assert.equal(a.edges.filter(x=>x.id.startsWith(`${e.id}-L_${pair}_`)).length,1,'Phase king control-flow edge '+pair);
   if(e.id==='pcd-snapshot-fifo')for(const pair of ['P0_P1','P1_P2','P2_P3','Q0_Q1','Q1_Q2','P1_Q1','P2_Q2'])assert.equal(a.edges.filter(x=>x.id.startsWith(`${e.id}-L_${pair}_`)).length,1,'FIFO event/message edge '+pair);
   if(e.id==='pcd-central-token')for(const pair of ['R_Q','Q_D','D_W','W_D','D_T','T_C','C_L','L_B','B_D'])assert.equal(a.edges.filter(x=>x.id.startsWith(`${e.id}-L_${pair}_`)).length,1,'Token lifecycle edge '+pair);
   if(e.id==='pcd-central-causal')for(const pair of ['A_B','B_C','C_D','D_E','E_F','F_G','G_H','A_E'])assert.equal(a.edges.filter(x=>x.id.startsWith(`${e.id}-L_${pair}_`)).length,1,'Causal request edge '+pair);
   assert.deepEqual([a.nodes,a.edges.length],counts[e.id],'Complete graph '+e.id);
   if(e.id==='pcd-causal-dependencies'){
    for(const pair of ['S1_S2','S2_D2','D2_S3','S1_D1','S3_D3','D1_D3'])assert.equal(a.edges.filter(x=>x.id.startsWith(`${e.id}-L_${pair}_`)).length,1,'Exactly one edge '+pair);
    for(const label of ['m1','m2','m3'])assert.equal(a.text.filter(t=>t===label).length,1,'Exactly one message label '+label);
   }
   if(e.id==='pcd-exchange-all')for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){const edge=a.edges.find(x=>x.id.startsWith(`${e.id}-L_P${i}_P${j}_`));assert(edge?.start&&edge?.end,'Both directions for every pair')}
   const bounds=await r.page.evaluate(()=>{
    const svg=document.querySelector('svg'),v=svg.getBoundingClientRect();
    const outside=[...svg.querySelectorAll('text,.node,.flowchart-link')].filter(e=>{const b=e.getBoundingClientRect();return b.width&&b.height&&(b.left<v.left-2||b.top<v.top-2||b.right>v.right+2||b.bottom>v.bottom+2)}).map(e=>e.textContent||e.id);
    const collisions=[];const labels=[...svg.querySelectorAll('text')].filter(e=>e.textContent.trim()).map(e=>({s:e.textContent,b:e.getBoundingClientRect()}));
    for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){const a=labels[i],b=labels[j];if(Math.min(a.b.right,b.b.right)-Math.max(a.b.left,b.b.left)>1&&Math.min(a.b.bottom,b.b.bottom)-Math.max(a.b.top,b.b.top)>1)collisions.push([a.s,b.s])}
    const xml=new DOMParser().parseFromString(svg.outerHTML,'image/svg+xml');
    const invalid=[...svg.querySelectorAll('[d],[transform]')].filter(e=>/NaN|undefined|Infinity/.test((e.getAttribute('d')||'')+(e.getAttribute('transform')||''))).length;
    return {outside,collisions,xmlErrors:xml.querySelectorAll('parsererror').length,invalid};
   });
   assert.deepEqual(bounds,{outside:[],collisions:[],xmlErrors:0,invalid:0},e.id);
   await r.page.locator('svg').screenshot({path:path.join(out,e.id+'.png')});
   results.push({id:e.id,nodes:a.nodes,edges:a.edges.length,width:a.width,height:a.height,...bounds});
  }
  const types=await r.render({id:'test-edge-types',title:'Directed, undirected and bidirectional links',source:'flowchart LR\nA((A)) --- B{B}\nB <--> C[C]\nC -.-> D[D]'});
  assert.equal(types.edges.length,3);assert(!types.edges[0].start&&!types.edges[0].end);assert(types.edges[1].start&&types.edges[1].end);assert(!types.edges[2].start&&types.edges[2].end);
  const math=await r.render({id:'test-comparisons',title:'Keep formula operators',source:'flowchart LR\nA["m > N/2 + f?<br/>k ← k + 1"] --> B["a < b; a ≤ b; c ≥ d"]',requiredText:['m > N/2 + f?','k ← k + 1','a < b; a ≤ b; c ≥ d']});assert.equal(math.edges.length,1);assert(!math.svg.includes('&amp;gt;'));
  const bad=[{overrides:{fontSize:9}},{overrides:{direction:'XX'}},{overrides:{rankSpacing:0}},{source:'sequenceDiagram\nA->>B: Hi'},{source:'flowchart LR\nA[broken(label] --> B'},{requiredText:['missing formula']},{requiredText:42}];
  for(const x of bad)await assert.rejects(()=>r.render({id:'test-invalid',title:'Invalid',source:'flowchart LR\nA-->B',...x}));
  fs.writeFileSync(path.join(out,'static-test.json'),JSON.stringify({results,edgeTypes:true,invalidInputs:bad.length},null,2));
  console.log(`${results.length} diagrams: XML, bounds, text collisions, determinism; 3 edge types; ${bad.length} invalid inputs rejected`);
 }finally{await r.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
