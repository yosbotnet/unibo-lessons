const {assert,keys,label,measure,make,integer}=require('./common.cjs');
const layout=require('../layouts/ordered-tree.cjs');
module.exports=spec=>{
  keys(spec,['preset','id','plate','title','root','tables','references','overrides'],'relational-schema');
  const o=spec.overrides||{};keys(o,['tableOrder','levelGap'],'overrides');
  assert(Array.isArray(spec.tables)&&spec.tables.length>=2&&spec.tables.length<=16,'Expected 2–16 tables');
  assert(Array.isArray(spec.references),'Expected references');
  const tables=new Map();
  for(const t of spec.tables){keys(t,['id','name','fields'],'table');assert(/^[a-z][a-z0-9-]*$/.test(t.id)&&!tables.has(t.id),'Invalid/duplicate table id');label(t.name,'table name');assert(Array.isArray(t.fields)&&t.fields.length&&t.fields.length<=16,'Expected fields');const names=new Set();
    for(const f of t.fields){keys(f,['name','key'],'field');label(f.name,'field name');assert(!names.has(f.name),'Duplicate field');names.add(f.name);assert([undefined,'PK','FK','PK/FK'].includes(f.key),'Unknown key type');}
    const lines=[t.name,...t.fields.map(f=>(f.key?f.key+'  ':'')+f.name)];tables.set(t.id,{...t,lines,w:Math.max(...lines.map(measure))+28,h:lines.length*30+4,children:[]});
  }
  assert(tables.has(spec.root),'Unknown root table');const parents=new Map(),usedFields=new Set();
  for(const r of spec.references){keys(r,['from','field','to','target'],'reference');const a=tables.get(r.from),b=tables.get(r.to);assert(a&&b&&a!==b,'Unknown/self table reference');const f=a.fields.find(f=>f.name===r.field),g=b.fields.find(f=>f.name===r.target);assert(f?.key?.includes('FK')&&g?.key==='PK','Reference must connect FK to PK');assert(!usedFields.has(r.from+'.'+r.field),'Duplicate foreign key reference');usedFields.add(r.from+'.'+r.field);assert(!parents.has(r.to)&&r.to!==spec.root,'Shared dimensions/cycles unsupported by tree schema layout');parents.set(r.to,r.from);a.children.push(b);}
  for(const t of tables.values())for(const f of t.fields)if(f.key?.includes('FK'))assert(usedFields.has(t.id+'.'+f.name),'Foreign key without reference');
  if(o.tableOrder!==undefined){assert(Array.isArray(o.tableOrder)&&new Set(o.tableOrder).size===tables.size&&o.tableOrder.every(id=>tables.has(id)),'tableOrder must contain each table exactly once');}
  for(const t of tables.values())t.children.sort((a,b)=>o.tableOrder?o.tableOrder.indexOf(a.id)-o.tableOrder.indexOf(b.id):spec.references.findIndex(r=>r.to===a.id)-spec.references.findIndex(r=>r.to===b.id));
  const result=layout(tables.get(spec.root),{direction:'right',siblingGap:44,padding:24,levelGap:o.levelGap===undefined?100:integer(o.levelGap,100,240,'levelGap')});
  assert(result.nodes.length===tables.size,'Disconnected/cyclic schema');
  const d=make(spec,result.height+32,Math.max(700,result.width),'Relational schema with explicit foreign-key joins','Each arrow connects a foreign-key field to the referenced primary key (N:1). PK/FK marks a foreign key that is also part of the composite primary key. The arrangement shows join paths, not the physical storage order.');
  const offset=(d.width-result.width)/2;
  for(const t of result.nodes){const ports={};t.fields.forEach((f,i)=>{ports['field'+i+'E']=[t.w,47+i*30];ports['field'+i+'W']=[0,47+i*30]});d.node(t.id,t.x+offset,t.y+32,t.w,t.h,t.lines.join('|'),{shape:'record',ports,color:t.id===spec.root?'vermilion':'cobalt'});}
  // Distinct channels, ordered by destination, keep parallel FK routes apart.
  for(const t of result.nodes){const refs=spec.references.filter(r=>r.from===t.id).sort((a,b)=>tables.get(a.to).y-tables.get(b.to).y);refs.forEach((r,i)=>{const a=t.fields.findIndex(f=>f.name===r.field),target=tables.get(r.to),b=target.fields.findIndex(f=>f.name===r.target),from=t.id+'.field'+a+'E',to=r.to+'.field'+b+'W',p=d.port(from),q=d.port(to),x=p[0]+(q[0]-p[0])*(i+1)/(refs.length+1);d.edge(from,to,[[x,p[1]],[x,q[1]]]);});}
  d.label(d.width/2,20,'FK → PK · N:1');d.semantic={kind:'relational-schema',references:spec.references};return d;
};
