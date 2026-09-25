// Scala mixin linearization calculator.
// Parses a few class/trait declarations and computes L(C) = C, L(Tn) +> ... +> L(T1)
// (Scala spec, 5.1.2): the parents' linearizations are concatenated right to left and only the
// LAST occurrence of each type is kept. Case classes get Product and Serializable as in Scala 3.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.Linearization=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const BUILTIN={
  Any:{kind:'class',parents:[],builtin:true},
  AnyRef:{kind:'class',parents:['Any'],builtin:true},
  Equals:{kind:'trait',parents:['Any'],builtin:true},
  Product:{kind:'trait',parents:['Any','Equals'],builtin:true},
  Serializable:{kind:'trait',parents:['AnyRef'],builtin:true}
 };
 const presets={
  cat:{title:'Cat (Odersky, Spoon, Venners)',target:'Cat',src:
`class Animal
trait Furry extends Animal
trait HasLegs extends Animal
trait FourLegged extends HasLegs
class Cat extends Animal with Furry with FourLegged`},
  tab:{title:'T, A, B, C (course code: prints TAB)',target:'C',src:
`trait T
trait A extends T
trait B extends T
class C extends A with B`},
  parser:{title:'Parser and NonEmpty',target:'NonEmptyBasicParser',src:
`abstract class Parser
class BasicParser extends Parser
trait NonEmpty extends Parser
class NonEmptyBasicParser extends BasicParser with NonEmpty`},
  lab:{title:'Lab 07: two mixins on a case class',target:'<anon>',src:
`abstract class Parser[T]
case class BasicParser(chars: Set[Char]) extends Parser[Char]
trait NonEmpty[T] extends Parser[T]
trait NotTwoConsecutive[T] extends Parser[T]
new BasicParser(chars) with NotTwoConsecutive[Char] with NonEmpty[Char]`}
 };
 function stripArgs(s){let prev;do{prev=s;s=s.replace(/\[[^\[\]]*\]/g,'').replace(/\([^()]*\)/g,'')}while(s!==prev);return s}
 function splitParents(s){return stripArgs(s).replace(/[:{].*$/,'').split(/\s+with\s+|,/).map(x=>x.trim()).filter(Boolean)}
 function parse(text){
  const types={},order=[],errors=[];
  text.split('\n').forEach((raw,i)=>{
   const line=raw.replace(/\/\/.*$/,'').trim();if(!line)return;
   let m=line.match(/^new\s+(.+)$/);
   if(m){const ps=splitParents(m[1]);if(!ps.length){errors.push(`line ${i+1}: nothing after new`);return}
    types['<anon>']={kind:'class',parents:ps,anon:true,line:i+1};order.push('<anon>');return}
   m=stripArgs(line).replace(/\s*[:{].*$/,'').match(/^(abstract\s+|case\s+|final\s+|sealed\s+)*(class|trait|object)\s+([A-Za-z_]\w*)\s*(?:extends\s+(.+))?$/);
   if(!m){errors.push(`line ${i+1}: cannot read "${line}"`);return}
   const name=m[3];if(types[name]||BUILTIN[name]){errors.push(`line ${i+1}: ${name} is declared twice`);return}
   const ps=m[4]?splitParents(m[4]):[];
   if(/\bcase\s/.test(m[1]||'')){ps.push('Product','Serializable')}
   types[name]={kind:m[2]==='trait'?'trait':'class',parents:ps,line:i+1,isCase:/\bcase\s/.test(m[1]||'')};order.push(name)});
  return {types,order,errors}
 }
 function lookup(types,n){return types[n]||BUILTIN[n]}
 // effective parents: a class/trait with no class among its parents extends AnyRef first
 function parentsOf(types,n){const t=lookup(types,n);if(!t)return [];if(n==='Any')return [];if(n==='AnyRef')return ['Any'];
  const ps=t.parents.slice();if(!ps.length)return ['AnyRef'];
  const first=lookup(types,ps[0]);if(first&&first.kind==='trait'&&ps[0]!=='Any')ps.unshift('AnyRef');return ps}
 function linearize(types,name,stack=[]){
  if(stack.includes(name))throw Error('cyclic inheritance: '+stack.concat(name).join(' → '));
  const t=lookup(types,name);if(!t)throw Error('unknown type '+name);
  const ps=parentsOf(types,name);
  ps.forEach((p,i)=>{const pt=lookup(types,p);if(!pt)throw Error(`unknown type ${p} (a parent of ${name})`);
   if(pt.kind==='class'&&i>0&&!(p==='AnyRef'||p==='Any'))throw Error(`${p} is a class: only the first parent of ${name} may be a class`);
   if(t.kind==='trait'&&pt.kind==='class'&&i>0&&p!=='AnyRef')throw Error(`${p} is a class: it must come first`)});
  const parentLins=ps.map(p=>({name:p,lin:linearize(types,p,stack.concat(name)).result}));
  const concat=[];for(let i=parentLins.length-1;i>=0;i--)for(const x of parentLins[i].lin)concat.push({name:x,from:parentLins[i].name});
  const lastIdx={};concat.forEach((c,i)=>{lastIdx[c.name]=i});
  concat.forEach((c,i)=>{c.kept=lastIdx[c.name]===i});
  const result=[name].concat(concat.filter(c=>c.kept).map(c=>c.name));
  return {result,parents:ps,parentLins,concat}
 }
 // the declared superclass: the first parent if it is a class, else that trait's superclass
 function superclassOf(types,n,seen=[]){const t=lookup(types,n);if(!t||n==='Any')return 'Any';if(n==='AnyRef')return 'Any';
  const ps=t.parents;if(!ps.length)return 'AnyRef';const f=lookup(types,ps[0]);if(!f||seen.includes(n))return 'AnyRef';
  return f.kind==='class'?ps[0]:superclassOf(types,ps[0],seen.concat(n))}
 // Scala rule: every mixed-in trait's superclass must be a superclass of the class being defined
 function checkMixins(types,name){
  const t=lookup(types,name);if(!t||t.kind!=='class')return [];
  const sup=superclassOf(types,name),supLin=linearize(types,sup).result,errs=[];
  for(const p of t.parents){const pt=lookup(types,p);if(!pt||pt.kind!=='trait')continue;
   const ts=superclassOf(types,p);if(!supLin.includes(ts))errs.push(`illegal inheritance: ${p} extends ${ts}, which is not a superclass of ${sup}`)}
  return errs
 }
 function compute(text,target){
  const {types,order,errors}=parse(text);
  if(errors.length)return {ok:false,errors,order};
  const t=target&&types[target]?target:order[order.length-1];
  try{const lin=linearize(types,t);const errs=checkMixins(types,t);
   const supers=lin.result.slice(0,-1).map((x,i)=>({in:x,next:lin.result[i+1]}));
   return {ok:errs.length===0,errors:errs,order,target:t,types,lin,supers}}
  catch(e){return {ok:false,errors:[e.message],order,target:t}}
 }
 function mount(sel,opts={}){
  const host=typeof sel==='string'?document.querySelector(sel):sel;if(!host)return;
  let presetId=opts.start&&presets[opts.start]?opts.start:'cat',src=presets[presetId].src,target=presets[presetId].target;
  const el=(tag,cls,text,parent)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;if(parent)parent.appendChild(e);return e};
  host.classList.add('llab');host.replaceChildren();
  const top=el('div','llab-row',null,host);
  const pl=el('label',null,'Example: ',top),ps=el('select',null,null,pl);
  for(const [k,p] of Object.entries(presets)){const o=el('option',null,p.title,ps);o.value=k}
  ps.value=presetId;
  const ta=el('textarea','llab-src',null,host);ta.rows=6;ta.spellcheck=false;ta.setAttribute('aria-label','Class and trait declarations, one per line');ta.value=src;
  const row=el('div','llab-row',null,host);const tl=el('label',null,'Linearize: ',row),ts=el('select',null,null,tl);
  const out=el('div','llab-out',null,host);out.setAttribute('aria-live','polite');
  function fillTargets(order){ts.replaceChildren();for(const n of order){const o=el('option',null,n,ts);o.value=n}if(order.includes(target))ts.value=target;else if(order.length){target=order[order.length-1];ts.value=target}}
  function chips(list,parent,cls){const d=el('div','llab-chain'+(cls?' '+cls:''),null,parent);list.forEach((x,i)=>{if(i)el('span','llab-arrow','→',d);el('code',null,x,d)});return d}
  function render(){
   const r=compute(ta.value,target);fillTargets(r.order||[]);out.replaceChildren();
   if(!r.lin){for(const e of r.errors)el('p','llab-err',e,out);return}
   const L=r.lin;
   el('h5',null,'1. Parents, right to left',out);
   const pp=el('p',null,null,out);pp.textContent=`${r.target} extends ${L.parents.join(' with ')}: take them as ${L.parents.slice().reverse().join(', ')}.`;
   const ul=el('ul',null,null,out);for(let i=L.parentLins.length-1;i>=0;i--){const li=el('li',null,null,ul);el('code',null,`L(${L.parentLins[i].name})`,li);li.append(' = '+L.parentLins[i].lin.join(', '))}
   el('h5',null,'2. Concatenate, keep only the last occurrence of each type',out);
   const cc=el('div','llab-concat',null,out);
   L.concat.forEach(c=>{const s=el('code',c.kept?'kept':'dropped',c.name,cc);s.title=c.kept?'kept':'dropped: it appears again further right'});
   el('h5',null,'3. Result',out);
   const res=el('p',null,null,out);res.append('L('+r.target+') = ');chips(L.result,res);
   const sp=el('p','llab-note',null,out);
   sp.textContent='A super call inside each element reaches the next one: '+r.supers.filter(s=>s.next!=='AnyRef'&&s.next!=='Any').map(s=>`super in ${s.in} → ${s.next}`).join('; ')+(r.supers.length>1?'.':'');
   for(const e of r.errors)el('p','llab-err',e,out);
  }
  ps.addEventListener('change',()=>{presetId=ps.value;ta.value=presets[presetId].src;target=presets[presetId].target;render()});
  ts.addEventListener('change',()=>{target=ts.value;render()});
  ta.addEventListener('input',()=>render());
  render();
 }
 return {parse,linearize,compute,checkMixins,presets,mount}
});
