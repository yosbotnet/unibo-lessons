const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createRenderer}=require('./render.cjs'),entries=require('./sources.cjs');
const root=path.resolve(__dirname,'../..'),out='/home/ybc/notes-legacy-review-artifacts';
(async()=>{
 const r=await createRenderer(),results=[];fs.mkdirSync(out,{recursive:true});
 try{
  for(const e of entries){const a=await r.render(e),b=await r.render(e);assert.equal(a.svg,b.svg,'Determinism '+e.id);
   const counts={'pcd-interleavings':[5,4],'pcd-exchange-central':[4,3],'pcd-exchange-all':[4,6],'pcd-exchange-ring':[4,4],'pcd-ricart-request':[6,5],'pcd-consensus-rounds':[9,6],'pcd-smr-order':[8,7],'pcd-raft-replication':[7,8],'ds-threat-chain':[4,3],'ds-independent-contexts':[2,1]};
   Object.assign(counts,{'pcd-chang-ring':[4,4],'pcd-chang-phases':[3,2]});
   assert.deepEqual([a.nodes,a.edges.length],counts[e.id],'Complete graph '+e.id);
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
  const bad=[{overrides:{fontSize:9}},{overrides:{direction:'XX'}},{overrides:{rankSpacing:0}},{source:'sequenceDiagram\nA->>B: Hi'},{source:'flowchart LR\nA[broken(label] --> B'}];
  for(const x of bad)await assert.rejects(()=>r.render({id:'test-invalid',title:'Invalid',source:'flowchart LR\nA-->B',...x}));
  fs.writeFileSync(path.join(out,'static-test.json'),JSON.stringify({results,edgeTypes:true,invalidInputs:bad.length},null,2));
  console.log(`${results.length} diagrams: XML, bounds, text collisions, determinism; 3 edge types; ${bad.length} invalid inputs rejected`);
 }finally{await r.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
