// λ-calculus reducer: parses a λ-term that may use the deck's definitions (T, F, Not, And, Or, 0-9, inc, add, Y),
// reduces it in normal order (leftmost-outermost) and in applicative order (leftmost-innermost), side by side,
// with capture-avoiding substitution, and names the normal form when it is a known boolean or numeral.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LambdaLab=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const DEF_SRC={T:'λx.λy.x',F:'λx.λy.y',Not:'λx.x F T',And:'λx.λy.x y F',Or:'λx.λy.x T y',
  inc:'λn.λs.λz.s (n s z)',add:'λn.λm.λs.λz.n s (m s z)',Y:'λg.(λx.g (x x)) (λx.g (x x))'};
 for(let i=0;i<10;i++){let b='z';for(let k=0;k<i;k++)b='s ('+b+')';DEF_SRC[String(i)]='λs.λz.'+b}
 const V=n=>({t:'var',n}),L=(v,b)=>({t:'lam',v,b}),A=(f,a)=>({t:'app',f,a}),D=n=>({t:'def',n});
 // ---- parser
 function tokenize(s){const out=[],re=/\s*(λ|\\|\.|\(|\)|[A-Za-z0-9_']+)/y;let i=0;
  while(i<s.length){if(/\s/.test(s[i])){i++;continue}re.lastIndex=i;const m=re.exec(s);if(!m)throw Error('unexpected "'+s[i]+'"');out.push(m[1]==='\\'?'λ':m[1]);i=re.lastIndex}return out}
 function parse(src){const t=tokenize(src);let p=0;const peek=()=>t[p];
  function term(){if(peek()==='λ'){p++;const v=t[p++];if(!v||!/^[A-Za-z_]/.test(v))throw Error('a variable must follow λ');if(v in DEF_SRC)throw Error('"'+v+'" is a definition name, choose another variable');
    if(t[p++]!=='.')throw Error('expected "." after λ'+v);return L(v,term())}
   let f=atom();if(!f)throw Error(peek()?'unexpected "'+peek()+'"':'unexpected end');
   while(p<t.length&&peek()!==')'){if(peek()==='λ'){f=A(f,term());break}const a=atom();if(!a)throw Error('unexpected "'+peek()+'"');f=A(f,a)}return f}
  function atom(){const x=peek();if(x==null||x===')'||x==='.')return null;
   if(x==='('){p++;const e=term();if(t[p++]!==')')throw Error('missing ")"');return e}
   if(x==='λ')return term();p++;if(x in DEF_SRC)return D(x);if(/^\d/.test(x))throw Error('only the numerals 0 to 9 are defined');return V(x)}
  if(!t.length)throw Error('empty term');const e=term();if(p<t.length)throw Error('unexpected "'+t[p]+'"');return e}
 const DEFS={};for(const k of Object.keys(DEF_SRC))DEFS[k]=parse(DEF_SRC[k]);
 // ---- printing
 function show(e){switch(e.t){case 'var':case 'def':return e.n;case 'lam':return 'λ'+e.v+'.'+show(e.b);
  case 'app':{const f=e.f.t==='lam'?'('+show(e.f)+')':show(e.f),a=e.a.t==='app'||e.a.t==='lam'?'('+show(e.a)+')':show(e.a);return f+' '+a}}}
 // ---- substitution
 function fv(e,acc=new Set()){if(e.t==='var')acc.add(e.n);else if(e.t==='lam'){const s=fv(e.b);s.delete(e.v);s.forEach(x=>acc.add(x))}else if(e.t==='app'){fv(e.f,acc);fv(e.a,acc)}return acc}
 function fresh(v,avoid){let n=v+"'";while(avoid.has(n))n+="'";return n}
 function subst(e,x,s){switch(e.t){case 'var':return e.n===x?s:e;case 'def':return e;case 'app':return A(subst(e.f,x,s),subst(e.a,x,s));
  case 'lam':{if(e.v===x)return e;const fs=fv(s);if(fs.has(e.v)&&fv(e.b).has(x)){const nv=fresh(e.v,new Set([...fs,...fv(e.b)]));return L(nv,subst(subst(e.b,e.v,V(nv)),x,s))}return L(e.v,subst(e.b,x,s))}}}
 // a definition is "normal" if its body contains no redex: then its name can stand for it in a result
 function hasRedex(e){switch(e.t){case 'var':return false;case 'def':return !NORMAL[e.n];case 'lam':return hasRedex(e.b);case 'app':return e.f.t==='lam'||e.f.t==='def'||hasRedex(e.f)||hasRedex(e.a)}}
 const NORMAL={};for(const k of Object.keys(DEFS))NORMAL[k]=true;for(const k of Object.keys(DEFS))NORMAL[k]=!hasRedex(DEFS[k]);
 // one step; returns {term, kind:'beta'|'delta', what} or null in normal form
 function step(e,order){switch(e.t){
  case 'var':return null;
  case 'def':return NORMAL[e.n]?null:{term:DEFS[e.n],kind:'delta',what:'unfold '+e.n};
  case 'lam':{const r=step(e.b,order);return r&&{term:L(e.v,r.term),kind:r.kind,what:r.what}}
  case 'app':{
   if(e.f.t==='def')return{term:A(DEFS[e.f.n],e.a),kind:'delta',what:'unfold '+e.f.n};
   if(order==='normal'&&e.f.t==='lam')return beta(e);
   let r=step(e.f,order);if(r)return{term:A(r.term,e.a),kind:r.kind,what:r.what};
   r=step(e.a,order);if(r)return{term:A(e.f,r.term),kind:r.kind,what:r.what};
   return e.f.t==='lam'?beta(e):null}}}
 function beta(e){return{term:subst(e.f.b,e.f.v,e.a),kind:'beta',what:'pass '+show(e.a)+' for '+e.f.v}}
 // ---- naming the result: de Bruijn form after expanding all definitions
 function expand(e){switch(e.t){case 'var':return e;case 'def':return expand(DEFS[e.n]);case 'lam':return L(e.v,expand(e.b));case 'app':return A(expand(e.f),expand(e.a))}}
 function db(e,env=[]){switch(e.t){case 'var':{const i=env.lastIndexOf(e.n);return i<0?e.n:'#'+(env.length-1-i)}case 'lam':return 'λ'+db(e.b,env.concat(e.v));case 'app':return '('+db(e.f,env)+' '+db(e.a,env)+')'}}
 const KNOWN={};for(const k of ['T','F','0','1','2','3','4','5','6','7','8','9'])if(!(db(DEFS[k]) in KNOWN))KNOWN[db(DEFS[k])]=k;
 function churchNumber(e){e=expand(e);if(e.t!=='lam'||e.b.t!=='lam')return null;const s=e.v,z=e.b.v;if(s===z)return null;let n=0,c=e.b.b;
  while(c.t==='app'&&c.f.t==='var'&&c.f.n===s){n++;c=c.a}return c.t==='var'&&c.n===z?n:null}
 function nameOf(e){const k=KNOWN[db(expand(e))];if(k==='F')return 'F, which is also the numeral 0 up to renaming';if(k)return /\d/.test(k)?'the numeral '+k:k;const n=churchNumber(e);return n!=null?'the numeral '+n:null}
 function reduce(src,order,maxSteps=60,maxLen=320){let e=typeof src==='string'?parse(src):src;const steps=[];
  for(let i=0;i<maxSteps;i++){const r=step(e,order);if(!r)return{steps,normal:e,name:nameOf(e),status:'normal'};e=r.term;const s=show(e);steps.push({kind:r.kind,what:r.what,term:s});
   if(s.length>maxLen)return{steps,normal:null,status:'growing'}}
  return{steps,normal:null,status:step(e,order)?'limit':'normal',name:null}}
 const PRESETS=['And (Not F) T','Not T','Or F T','T x (T x y)','add (inc 1) (inc 2)','T x Y','Y x','(λx.x x) (λx.x x)'];
 function mount(sel,opts={}){const host=document.querySelector(sel);if(!host)return;
  const el=(tag,cls,text,parent)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;if(parent)parent.appendChild(e);return e};
  host.classList.add('llab');host.replaceChildren();
  const defs=el('p','llab-defs',null,host);defs.textContent='Definitions: '+['T','F','Not','And','Or','inc','add','Y'].map(k=>k+' := '+DEF_SRC[k]).join('   ')+'   0 := λs.λz.z, 1 := λs.λz.s z, … 9';
  const row=el('div','llab-row',null,host),lab=el('label',null,'term: ',row),inp=el('input',null,null,lab);inp.value=opts.start||PRESETS[0];inp.spellcheck=false;
  const pr=el('div','llab-row',null,host);for(const p of PRESETS){const b=el('button',null,p,pr);b.type='button';b.addEventListener('click',()=>{inp.value=p;render()})}
  const err=el('p','llab-err',null,host),grid=el('div','llab-grid',null,host);
  inp.addEventListener('input',render);
  const TITLE={normal:'normal order (leftmost-outermost)',applicative:'applicative order (leftmost-innermost)'};
  function render(){grid.replaceChildren();err.textContent='';let t;try{t=parse(inp.value)}catch(e){err.textContent='Cannot read the term: '+e.message;return}
   for(const o of ['normal','applicative']){const r=reduce(t,o),col=el('div','llab-col',null,grid);el('h5',null,TITLE[o],col);
    const ol=el('ol',null,null,col);el('li','llab-start',show(t),ol);for(const s of r.steps){const li=el('li',null,null,ol);el('span','llab-op',s.kind==='beta'?'→ ':'≡ ',li);li.appendChild(document.createTextNode(s.term));li.title=s.what}
    const res=el('p','llab-res',null,col);
    if(r.status==='normal')res.textContent='normal form after '+r.steps.filter(s=>s.kind==='beta').length+' β-steps: '+show(r.normal)+(r.name?'  ('+r.name+')':'');
    else res.textContent='stopped after '+r.steps.length+' steps: '+(r.status==='growing'?'the term keeps growing':'still reducible')+', no normal form reached'}}
  render()}
 return{parse,show,step,reduce,nameOf,subst,DEF_SRC,PRESETS,mount}});
