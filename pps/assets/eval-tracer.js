// Evaluation-order tracer: runs def f(a: A, dummy: A) = <body> under call-by-value, call-by-name and call-by-need,
// with arguments that print, return a value or never return, and lists every evaluation step side by side.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.EvalTracer=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const ARGS={
  '10':{prints:[],value:10},'20':{prints:[],value:20},
  '{println("e1"); 10}':{prints:['e1'],value:10},'{println("e2"); 20}':{prints:['e2'],value:20},
  'loop(20)':{prints:[],value:null}};
 const BODIES=['(a, a)','(a, dummy)','a + a','if a > 5 then a else dummy','0'];
 const PARAMS=['a','dummy'];
 // ---- parser: expr := if expr then expr else expr | cmp ; cmp := add [(>|<|==) add] ; add := mul {(+|-) mul} ; mul := atom {* atom}
 function tokenize(s){const toks=[],re=/\s*(\d+|[A-Za-z_]\w*|==|[()+\-*<>,])/y;let m,i=0;s=s.trim();
  while(i<s.length){re.lastIndex=i;m=re.exec(s);if(!m)throw Error('unexpected "'+s.slice(i).trim()[0]+'"');toks.push(m[1]);i=re.lastIndex;while(i<s.length&&/\s/.test(s[i]))i++}
  return toks}
 function parse(src){const t=tokenize(src);let p=0;const peek=()=>t[p],eat=x=>{if(x!=null&&t[p]!==x)throw Error('expected '+x+(t[p]?' but found '+t[p]:' at the end'));return t[p++]};
  function expr(){if(peek()==='if'){eat('if');const c=expr();eat('then');const a=expr();eat('else');return{k:'if',c,a,b:expr()}}return cmp()}
  function cmp(){const l=add();if(['>','<','=='].includes(peek())){const op=eat();return{k:'op',op,l,r:add()}}return l}
  function add(){let l=mul();while(peek()==='+'||peek()==='-'){const op=eat();l={k:'op',op,l,r:mul()}}return l}
  function mul(){let l=atom();while(peek()==='*'){eat();l={k:'op',op:'*',l,r:atom()}}return l}
  function atom(){const x=peek();if(x==null)throw Error('unexpected end of the body');
   if(/^\d+$/.test(x)){eat();return{k:'num',v:+x}}
   if(x==='('){eat('(');const e=expr();if(peek()===','){eat(',');const e2=expr();eat(')');return{k:'tup',l:e,r:e2}}eat(')');return e}
   if(PARAMS.includes(x)){eat();return{k:'par',n:x}}
   throw Error('unknown name "'+x+'" (use a, dummy, numbers, + - * > < ==, if/then/else, pairs)')}
  const e=expr();if(p<t.length)throw Error('unexpected "'+t[p]+'"');return e}
 const show=v=>Array.isArray(v)?'('+v.map(show).join(',')+')':String(v);
 class Diverge extends Error{}
 // strategy: 'value' | 'name' | 'need'
 function trace(strategy,body,argSrc){const ast=typeof body==='string'?parse(body):body;
  const steps=[],out=[],uses={a:0,dummy:0},evals={a:0,dummy:0},cache={};
  function evalArg(n,why){const src=argSrc[n],d=ARGS[src];evals[n]++;
   if(d.value==null){steps.push(why+'evaluate '+n+' = '+src+': it never returns');throw new Diverge()}
   for(const p of d.prints)out.push(p);
   steps.push(why+'evaluate '+n+' = '+src+(d.prints.length?': prints '+d.prints.join(' ')+',':':')+' gives '+d.value);return d.value}
  function lookup(n){uses[n]++;
   if(strategy==='value')return cache[n];
   if(strategy==='need'&&n in cache){steps.push('use of '+n+': already evaluated, reuse '+cache[n]);return cache[n]}
   const v=evalArg(n,'use of '+n+' ('+(uses[n]===1?'first':'again')+'): ');if(strategy==='need')cache[n]=v;return v}
  function ev(e){switch(e.k){
   case 'num':return e.v;
   case 'par':return lookup(e.n);
   case 'tup':{const l=ev(e.l);return[l,ev(e.r)]}
   case 'if':{const c=ev(e.c);steps.push('condition is '+c+': take the '+(c?'then':'else')+' branch');return c?ev(e.a):ev(e.b)}
   case 'op':{const l=ev(e.l),r=ev(e.r);return e.op==='+'?l+r:e.op==='-'?l-r:e.op==='*'?l*r:e.op==='>'?l>r:e.op==='<'?l<r:l===r}}}
  let result=null,diverged=false;
  try{
   if(strategy==='value'){for(const n of PARAMS)cache[n]=evalArg(n,'before the call: ');steps.push('enter the body with a = '+cache.a+', dummy = '+cache.dummy)}
   else steps.push('call: a and dummy are passed unevaluated'+(strategy==='need'?' (each will be evaluated at most once)':''));
   result=show(ev(ast));steps.push('result '+result);out.push(result)}
  catch(e){if(!(e instanceof Diverge))throw e;diverged=true;steps.push('the call never returns: println is never reached')}
  return{steps,out,result,diverged,evals}}
 function mount(sel,opts={}){const host=document.querySelector(sel);if(!host)return;
  let st={body:opts.body||'(a, a)',a:opts.a||'{println("e1"); 10}',dummy:opts.dummy||'{println("e2"); 20}'};
  const el=(tag,cls,text,parent)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;if(parent)parent.appendChild(e);return e};
  host.classList.add('etr');host.replaceChildren();
  const code=el('p','etr-code',null,host);
  const row=el('div','etr-row',null,host);
  const lb=el('label',null,'body: ',row),inp=el('input',null,null,lb);inp.value=st.body;inp.setAttribute('list',host.id+'-bodies');inp.spellcheck=false;
  const dl=el('datalist',null,null,host);dl.id=host.id+'-bodies';for(const b of BODIES)el('option',null,null,dl).value=b;
  const row2=el('div','etr-row',null,host);
  const sels={};for(const n of PARAMS){const l=el('label',null,n+' = ',row2),s=el('select',null,null,l);for(const k of Object.keys(ARGS)){const o=el('option',null,k,s);o.value=k}s.value=st[n];sels[n]=s;
   s.addEventListener('change',()=>{st[n]=s.value;render()})}
  inp.addEventListener('input',()=>{st.body=inp.value;render()});
  const err=el('p','etr-err',null,host),grid=el('div','etr-grid',null,host);
  const NAMES={value:'call-by-value  (a: A)',name:'call-by-name  (a: => A)',need:'call-by-need  (lazy val v = a)'};
  function render(){code.textContent='println(f('+st.a+', '+st.dummy+'))   where   def f[A](a: A, dummy: A) = '+st.body;grid.replaceChildren();err.textContent='';
   let ast;try{ast=parse(st.body)}catch(e){err.textContent='Cannot read the body: '+e.message;return}
   for(const s of ['value','name','need']){const r=trace(s,ast,st),col=el('div','etr-col',null,grid);el('h5',null,NAMES[s],col);
    const ol=el('ol',null,null,col);for(const x of r.steps)el('li',null,x,ol);
    el('p','etr-out','console: '+(r.out.length?r.out.join('  '):'(nothing)')+(r.diverged?'  … and it hangs':''),col);
    el('p','etr-count','a evaluated '+r.evals.a+'×, dummy '+r.evals.dummy+'×',col)}}
  render()}
 return{parse,trace,mount,ARGS,BODIES}});
