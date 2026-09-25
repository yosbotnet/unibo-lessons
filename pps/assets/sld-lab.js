// SLD resolution stepper for small Prolog programs: real unification (with occurs check, as tuProlog 4),
// clause cloning, depth-first left-to-right search with backtracking, cut, negation as failure and a few
// built-ins. The reader expands one resolvent at a time and sees the search tree grow.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SLDLab=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
/* ---------- terms ---------- */
const V=(name,id,show)=>({t:'v',name,id,show:show||name}), A=name=>({t:'a',name}), N=(v,fl)=>({t:'n',v,fl:!!fl}), C=(f,args)=>({t:'c',f,args});
const NIL=A('[]'), cons=(h,tl)=>C('.',[h,tl]);
/* ---------- tokenizer ---------- */
const SYM='+-*/\\^<>=~:.?@#&$';
function tokenize(src){
  const toks=[];let i=0;const n=src.length;
  while(i<n){
    let ws=false;
    for(;;){ if(i<n&&/\s/.test(src[i])){i++;ws=true;continue}
      if(src[i]==='%'){while(i<n&&src[i]!=='\n')i++;ws=true;continue}
      if(src[i]==='/'&&src[i+1]==='*'){i=src.indexOf('*/',i+2);i=i<0?n:i+2;ws=true;continue}
      break }
    if(i>=n)break;
    const c=src[i],s=i;
    if(/[0-9]/.test(c)){while(/[0-9]/.test(src[i]))i++;let fl=false;
      if(src[i]==='.'&&/[0-9]/.test(src[i+1])){fl=true;i++;while(/[0-9]/.test(src[i]))i++}
      toks.push({k:'num',v:+src.slice(s,i),fl,ws});continue}
    if(/[A-Z_]/.test(c)){while(i<n&&/\w/.test(src[i]))i++;toks.push({k:'var',v:src.slice(s,i),ws});continue}
    if(/[a-z]/.test(c)){while(i<n&&/\w/.test(src[i]))i++;toks.push({k:'atom',v:src.slice(s,i),ws});continue}
    if(c==="'"){let v='';i++;while(i<n){if(src[i]==="'"){if(src[i+1]==="'"){v+="'";i+=2;continue}break}
      if(src[i]==='\\'){v+=src[i+1];i+=2;continue}v+=src[i++]}i++;toks.push({k:'atom',v,ws,q:true});continue}
    if(c==='.'&&(i+1>=n||/[\s%]/.test(src[i+1]))){i++;toks.push({k:'end',ws});continue}
    if('()[]{},|'.includes(c)){i++;toks.push({k:'p',v:c,ws});continue}
    if(c==='!'||c===';'){i++;toks.push({k:'atom',v:c,ws});continue}
    if(SYM.includes(c)){while(i<n&&SYM.includes(src[i]))i++;toks.push({k:'atom',v:src.slice(s,i),ws});continue}
    throw new Error('unexpected character '+c);
  }
  toks.push({k:'eof'});return toks;
}
/* ---------- parser (operator precedence) ---------- */
const INF={':-':[1200,'xfx'],';':[1100,'xfy'],'->':[1050,'xfy'],',':[1000,'xfy'],'=':[700,'xfx'],'\\=':[700,'xfx'],'==':[700,'xfx'],
  '\\==':[700,'xfx'],is:[700,'xfx'],'<':[700,'xfx'],'>':[700,'xfx'],'=<':[700,'xfx'],'>=':[700,'xfx'],'=:=':[700,'xfx'],'=\\=':[700,'xfx'],
  '=..':[700,'xfx'],'+':[500,'yfx'],'-':[500,'yfx'],'*':[400,'yfx'],'/':[400,'yfx'],'//':[400,'yfx'],mod:[400,'yfx']};
const PRE={'-':[200,'fy'],'\\+':[900,'fy'],':-':[1200,'fx']};
function Parser(src){this.t=tokenize(src);this.i=0;this.vars={}}
Parser.prototype={
  peek(){return this.t[this.i]},next(){return this.t[this.i++]},
  expect(k,v){const t=this.next();if(t.k!==k||(v!==undefined&&t.v!==v))throw new Error('expected '+(v||k)+(t.v?' near '+t.v:''));return t},
  mkVar(name){if(name==='_')return V('_',++Parser.ctr,'_');return this.vars[name]||(this.vars[name]=V(name,++Parser.ctr))},
  infixOp(tk){if(tk.k==='p'&&tk.v===',')return ',';if(tk.k==='atom'&&INF[tk.v])return tk.v;return null},
  startsTerm(tk){return tk.k==='num'||tk.k==='var'||tk.k==='atom'||(tk.k==='p'&&'([{'.includes(tk.v))},
  parse(max){let [left,lp]=this.primary(max);
    for(;;){const tk=this.peek(),op=this.infixOp(tk);if(!op)break;const [p,ty]=INF[op];
      const la=ty==='yfx'?p:p-1,ra=ty==='xfy'?p:p-1;if(p>max||lp>la)break;this.next();
      const right=this.parse(ra);left=C(op,[left,right]);lp=p}
    return left},
  primary(max){const tk=this.next();
    if(tk.k==='num')return [N(tk.v,tk.fl),0];
    if(tk.k==='var')return [this.mkVar(tk.v),0];
    if(tk.k==='p'&&tk.v==='('){const t=this.parse(1200);this.expect('p',')');return [t,0]}
    if(tk.k==='p'&&tk.v==='['){if(this.peek().k==='p'&&this.peek().v===']'){this.next();return [NIL,0]}
      const items=[this.parse(999)];while(this.peek().k==='p'&&this.peek().v===','){this.next();items.push(this.parse(999))}
      let tail=NIL;if(this.peek().k==='p'&&this.peek().v==='|'){this.next();tail=this.parse(999)}
      this.expect('p',']');return [items.reduceRight((acc,h)=>cons(h,acc),tail),0]}
    if(tk.k==='p'&&tk.v==='{'){const t=this.parse(1200);this.expect('p','}');return [C('{}',[t]),0]}
    if(tk.k==='atom'){const nx=this.peek();
      if(nx.k==='p'&&nx.v==='('&&!nx.ws){this.next();const args=[this.parse(999)];
        while(this.peek().k==='p'&&this.peek().v===','){this.next();args.push(this.parse(999))}
        this.expect('p',')');return [C(tk.v,args),0]}
      if(tk.v==='-'&&nx.k==='num'&&!nx.ws){this.next();return [N(-nx.v,nx.fl),0]}
      const pre=!tk.q&&PRE[tk.v];
      if(pre&&this.startsTerm(nx)&&!this.infixOp(nx)){const [p,ty]=pre;const pp=p>max?999:p;
        const arg=this.parse(ty==='fy'?pp:pp-1);return [C(tk.v,[arg]),pp]}
      return [A(tk.v),INF[tk.v]&&!tk.q?1201:0]}
    throw new Error('unexpected '+(tk.v||tk.k));
  }};
Parser.ctr=0;
const conj=t=>t.t==='c'&&t.f===','&&t.args.length===2?conj(t.args[0]).concat(conj(t.args[1])):[t];
function parseProgram(src){
  const p=new Parser(src),clauses=[];
  while(p.peek().k!=='eof'){p.vars={};const t=p.parse(1200);p.expect('end');
    if(t.t==='c'&&t.f===':-'&&t.args.length===1)continue;                 // directive: ignored
    const rule=t.t==='c'&&t.f===':-'&&t.args.length===2;
    clauses.push({head:rule?t.args[0]:t,body:rule?conj(t.args[1]):[],n:clauses.length+1})}
  return clauses;
}
function parseQuery(src){const s=src.trim().replace(/^\?-\s*/,'');const p=new Parser(/\.\s*$/.test(s)?s:s+'.');
  const t=p.parse(1200);p.expect('end');const vars=Object.keys(p.vars).map(k=>p.vars[k]);return {goals:conj(t),vars}}
/* ---------- substitutions: persistent linked bindings, flattened into a Map every 16 links ---------- */
const EMPTY={d:0,flat:new Map()};
function lookup(s,id){while(s){if(s.flat)return s.flat.get(id);if(s.k===id)return s.v;s=s.p}}
const walk=(t,s)=>{while(t.t==='v'){const b=lookup(s,t.id);if(b===undefined)break;t=b}return t};
function bind(s,v,t){const n={p:s,k:v.id,var:v,v:t,d:s.d+1,flat:null};
  if(n.d%16===0){const links=[];let x=n;while(!x.flat){links.push(x);x=x.p}
    const m=new Map(x.flat);for(let i=links.length-1;i>=0;i--)m.set(links[i].k,links[i].v);n.flat=m}
  return n}
function occurs(v,t,s){t=walk(t,s);if(t.t==='v')return t.id===v.id;if(t.t==='c')return t.args.some(a=>occurs(v,a,s));return false}
function unify(a,b,s){a=walk(a,s);b=walk(b,s);
  if(a.t==='v'&&b.t==='v'){if(a.id===b.id)return s;return a.id>b.id?bind(s,a,b):bind(s,b,a)} // the newer (clone) variable points to the older one
  if(a.t==='v')return occurs(a,b,s)?null:bind(s,a,b);
  if(b.t==='v')return occurs(b,a,s)?null:bind(s,b,a);
  if(a.t==='a')return b.t==='a'&&a.name===b.name?s:null;
  if(a.t==='n')return b.t==='n'&&a.v===b.v&&a.fl===b.fl?s:null;
  if(b.t!=='c'||a.f!==b.f||a.args.length!==b.args.length)return null;
  for(let i=0;i<a.args.length;i++){s=unify(a.args[i],b.args[i],s);if(!s)return null}return s}
const resolve=(t,s)=>{t=walk(t,s);return t.t==='c'?C(t.f,t.args.map(x=>resolve(x,s))):t};
function identical(a,b,s){a=walk(a,s);b=walk(b,s);if(a.t!==b.t)return false;if(a.t==='v')return a.id===b.id;if(a.t==='a')return a.name===b.name;
  if(a.t==='n')return a.v===b.v&&a.fl===b.fl;return a.f===b.f&&a.args.length===b.args.length&&a.args.every((x,i)=>identical(x,b.args[i],s))}
function varsOf(t,s,acc){t=walk(t,s);if(t.t==='v'){if(!acc.some(v=>v.id===t.id))acc.push(t)}else if(t.t==='c')t.args.forEach(x=>varsOf(x,s,acc));return acc}
const PRIMES=d=>d<=3?"'".repeat(d):"'"+d;
function rename(clause,depth){const m={};const r=t=>{if(t.t==='v'){if(t.name==='_')return V('_',++Parser.ctr,'_');
    return m[t.id]||(m[t.id]=V(t.name,++Parser.ctr,t.name+PRIMES(depth)))}return t.t==='c'?C(t.f,t.args.map(r)):t};
  return {head:r(clause.head),body:clause.body.map(r),n:clause.n,lib:clause.lib}}
/* ---------- printing ---------- */
const plainAtom=a=>/^[a-z]\w*$/.test(a)||a==='[]'||a==='!'||a===';'||a==='{}'||(/^[+\-*/\\^<>=~:.?@#&$]+$/.test(a));
const qa=a=>plainAtom(a)?a:"'"+a.replace(/'/g,"''")+"'";
function show(t,s,max,al){s=s||EMPTY;max=max===undefined?1200:max;t=walk(t,s);
  if(t.t==='v')return al&&al.has(t.id)?al.get(t.id):t.name==='_'?'_'+t.id:t.show;
  if(t.t==='n')return t.fl&&Number.isInteger(t.v)?t.v.toFixed(1):String(t.v);
  if(t.t==='a')return qa(t.name);
  if(t.f==='.'&&t.args.length===2){const items=[];let x=t;
    while(x.t==='c'&&x.f==='.'&&x.args.length===2){items.push(show(x.args[0],s,999,al));x=walk(x.args[1],s)}
    return '['+items.join(',')+(x.t==='a'&&x.name==='[]'?'':'|'+show(x,s,999,al))+']'}
  if(t.f==='{}'&&t.args.length===1)return '{'+show(t.args[0],s,1200,al)+'}';
  if(t.args.length===2&&INF[t.f]){const [p,ty]=INF[t.f];const l=show(t.args[0],s,ty==='yfx'?p:p-1,al),r=show(t.args[1],s,ty==='xfy'?p:p-1,al);
    const sp=p>=700||/^[a-z]/.test(t.f);const str=t.f===','?l+', '+r:sp?l+' '+t.f+' '+r:l+t.f+r;return p>max?'('+str+')':str}
  if(t.args.length===1&&PRE[t.f]&&t.f!==':-'){const str=t.f+show(t.args[0],s,PRE[t.f][0],al);return PRE[t.f][0]>max?'('+str+')':str}
  return qa(t.f)+'('+t.args.map(a=>show(a,s,999,al)).join(',')+')'}
const showGoals=(gs,s)=>gs.length?gs.map(g=>show(g.term,s,999)).join(', '):'□';
/* ---------- arithmetic ---------- */
function evalA(t,s){t=walk(t,s);
  if(t.t==='n')return t;
  if(t.t==='v')throw new Error('instantiation error: '+show(t,s)+' is unbound');
  if(t.t==='c'&&t.args.length===2){const a=evalA(t.args[0],s),b=evalA(t.args[1],s),fl=a.fl||b.fl;
    switch(t.f){case '+':return N(a.v+b.v,fl);case '-':return N(a.v-b.v,fl);case '*':return N(a.v*b.v,fl);
      case '/':{const q=a.v/b.v;return N(q,fl||!Number.isInteger(q))}case '//':return N(Math.trunc(a.v/b.v),false);
      case 'mod':return N(((a.v%b.v)+b.v)%b.v,false);case 'max':return a.v>=b.v?a:b;case 'min':return a.v<=b.v?a:b}}
  if(t.t==='c'&&t.args.length===1){const a=evalA(t.args[0],s);if(t.f==='-')return N(-a.v,a.fl);if(t.f==='abs')return N(Math.abs(a.v),a.fl)}
  throw new Error('type error: '+show(t,s)+' is not an arithmetic expression')}
const CMP={'<':(a,b)=>a<b,'>':(a,b)=>a>b,'=<':(a,b)=>a<=b,'>=':(a,b)=>a>=b,'=:=':(a,b)=>a===b,'=\\=':(a,b)=>a!==b};
/* ---------- library clauses used when the program does not define them ---------- */
const LIB='append([],L,L).\nappend([H|T],L,[H|M]) :- append(T,L,M).\nmember(X,[X|_]).\nmember(X,[_|T]) :- member(X,T).\n';
/* ---------- the search tree ---------- */
function Tree(programSrc,querySrc,opts){
  opts=opts||{};this.maxSteps=opts.maxSteps||400;
  this.program=parseProgram(programSrc);const defined=new Set(this.program.map(c=>key(c.head)));
  parseProgram(LIB).forEach(c=>{if(!defined.has(key(c.head)))this.program.push(Object.assign(c,{lib:true}))});
  const q=parseQuery(querySrc);this.qvars=q.vars.filter(v=>v.name!=='_');
  this.nodes=[];this.root=this.mk(null,q.goals.map(g=>({term:g,barrier:null})),EMPTY,null,'');this.root.barrierSelf=true;
  this.stack=[this.root];this.steps=0;this.solutions=[];this.output='';this.error=null;this.current=null;
}
function key(h){return h.t==='c'?h.f+'/'+h.args.length:h.t==='a'?h.name+'/0':'?'}
Tree.prototype={
  mk(parent,goals,subst,edge,info){const n={id:this.nodes.length,parent,goals,subst,edge,info,children:[],status:'pending',
      depth:parent?parent.depth+1:0};this.nodes.push(n);if(parent)parent.children.push(n);return n},
  done(){return !!this.error||!this.stack.some(n=>n.status==='pending')},
  // θ' of the step: the bindings added between the parent's substitution and the child's, fully resolved
  delta(parent,s){const out=[];for(let x=s;x&&x!==parent.subst;x=x.p)out.unshift(x.var.show+'/'+show(resolve(x.v,s),s,999));return out},
  answer(s){const al=new Map();this.qvars.forEach(v=>{const r=walk(v,s);if(r.t==='v'&&!al.has(r.id))al.set(r.id,v.name)});
    const parts=this.qvars.map(v=>{const r=walk(v,s);return r.t==='v'&&al.get(r.id)===v.name?null:v.name+' = '+show(r,s,699,al)}).filter(Boolean);
    return parts.length?parts.join(', '):'yes'},
  step(){ // expand the next pending node in depth-first, left-to-right order
    if(this.error)return null;
    while(this.stack.length&&this.stack[this.stack.length-1].status!=='pending')this.stack.pop();
    if(!this.stack.length)return null;
    if(this.steps>=this.maxSteps){this.error='step limit ('+this.maxSteps+') reached: the tree may be infinite';return null}
    const node=this.stack.pop();this.steps++;node.order=this.steps;this.current=node;
    if(!node.goals.length){node.status='success';node.answer=this.answer(node.subst);this.solutions.push(node.answer);return node}
    try{this.expand(node)}catch(e){node.status='error';node.info=e.message;this.error=e.message;return node}
    if(!node.children.length){if(node.status==='expanded')node.status='fail'}
    for(let i=node.children.length-1;i>=0;i--)this.stack.push(node.children[i]);
    return node},
  expand(node){
    const [g0,...rest]=node.goals,s=node.subst,g=walk(g0.term,s);node.status='expanded';
    const child=(goals,subst,edge,info)=>this.mk(node,goals,subst,edge,info);
    if(g.t==='v')throw new Error('instantiation error: goal is an unbound variable');
    if(g.t==='n')throw new Error('type error: a number is not a goal');
    const name=g.t==='a'?g.name:g.f,ar=g.t==='a'?0:g.args.length,a=g.args||[];
    const det=(ok,subst,label)=>{if(ok)child(rest,subst||s,label,'')};
    switch(name+'/'+ar){
      case 'true/0':return det(true,s,'true');
      case 'fail/0':case 'false/0':return;
      case '!/0':{child(rest,s,'!','');this.cut(node,g0.barrier);return}
      case ';/2':child([{term:a[0],barrier:g0.barrier}].concat(rest),s,';','left');
        child([{term:a[1],barrier:g0.barrier}].concat(rest),s,';','right');return;
      case ',/2':return child(conj(g).map(t=>({term:t,barrier:g0.barrier})).concat(rest),s,'call','');
      case '=/2':{const u=unify(a[0],a[1],s);return det(!!u,u,'=')}
      case '\\=/2':return det(!unify(a[0],a[1],s),s,'\\=');
      case '==/2':return det(identical(a[0],a[1],s),s,'==');
      case '\\==/2':return det(!identical(a[0],a[1],s),s,'\\==');
      case 'is/2':{const u=unify(a[0],evalA(a[1],s),s);return det(!!u,u,'is')}
      case 'var/1':return det(walk(a[0],s).t==='v',s,'var');
      case 'nonvar/1':return det(walk(a[0],s).t!=='v',s,'nonvar');
      case 'atom/1':return det(walk(a[0],s).t==='a',s,'atom');
      case 'number/1':return det(walk(a[0],s).t==='n',s,'number');
      case 'write/1':this.output+=show(a[0],s);return det(true,s,'write');
      case 'nl/0':this.output+='\n';return det(true,s,'nl');
      case 'not/1':case '\\+/1':{const sub=new Tree('',"true",{maxSteps:this.maxSteps});sub.program=this.program;
        sub.nodes=[];sub.root=sub.mk(null,[{term:a[0],barrier:null}],s,null,'');sub.stack=[sub.root];
        while(!sub.solutions.length&&!sub.done())sub.step();
        if(sub.error)throw new Error(sub.error);
        return det(!sub.solutions.length,s,'not: '+(sub.solutions.length?'goal succeeded, so not/1 fails':'goal failed, so not/1 succeeds'))}
    }
    if(CMP[name]&&ar===2){const x=evalA(a[0],s),y=evalA(a[1],s);return det(CMP[name](x.v,y.v),s,name)}
    for(const cl of this.program){if(key(cl.head)!==name+'/'+ar)continue;
      const r=rename(cl,node.depth+1),u=unify(g,r.head,s);if(!u)continue;
      child(r.body.map(t=>({term:t,barrier:node})).concat(rest),u,r.lib?'lib':'c'+r.n,'')}
  },
  // the cut prunes the pending alternatives of every node from the one whose clause introduced it down to here
  cut(node,barrier){if(!barrier)barrier=this.root;
    for(let n=node,prev=null;n;prev=n,n=n.parent){
      if(n!==node){const i=n.children.indexOf(prev);n.children.slice(i+1).forEach(c=>{if(c.status==='pending')c.status='pruned'})}
      if(n===barrier)break}},
  run(maxSol){while(!this.done()&&this.solutions.length<maxSol)this.step();return this},
  nextSolution(){const k=this.solutions.length;while(!this.done()&&this.solutions.length===k)this.step()}
};
/* summary used by the tests: the answers in order, and whether the search went on after the last one
   (tuProlog's "no" after the last answer) or ended there (no choice point left) */
function solveAll(prog,query,maxSol,maxSteps){const t=new Tree(prog,query,{maxSteps:maxSteps||20000});
  while(!t.done()&&t.solutions.length<maxSol)t.step();
  const stopped=!t.done()&&t.solutions.length>=maxSol;let trailing=null;
  if(!stopped&&!t.error){const last=t.nodes.filter(n=>n.status==='success').pop();
    trailing=!last?'no':t.nodes.some(n=>n.order>last.order)?'no':'end'}
  return {solutions:t.solutions.slice(),error:t.error,stopped,trailing}}
/* ---------- DOM ---------- */
const esc=x=>String(x).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function mount(sel,cfg){
  if(typeof document==='undefined')return;const el=document.querySelector(sel);if(!el)return;
  const presets=cfg.presets;let tree=null,cur=cfg.start||Object.keys(presets)[0];
  el.classList.add('sld');
  el.innerHTML='<div class="sld-row"><label>Example <select class="sld-pre"></select></label></div>'+
    '<p class="sld-note"></p>'+
    '<div class="sld-edit"><textarea class="sld-prog" rows="7" spellcheck="false" aria-label="Program"></textarea>'+
    '<label class="sld-q">?- <input class="sld-query" spellcheck="false" aria-label="Query"></label></div>'+
    '<div class="sld-row"><button class="sld-step">Step</button><button class="sld-next">Next solution</button>'+
    '<button class="sld-all">Run to the end</button><button class="sld-reset">Reset</button></div>'+
    '<p class="sld-status" aria-live="polite"></p><div class="sld-tree"></div>';
  const $=c=>el.querySelector(c),pre=$('.sld-pre');
  Object.keys(presets).forEach(k=>{const o=document.createElement('option');o.value=k;o.textContent=presets[k].title;pre.appendChild(o)});
  function load(k){cur=k;pre.value=k;$('.sld-prog').value=presets[k].program.trim();$('.sld-query').value=presets[k].query;
    $('.sld-note').textContent=presets[k].note||'';reset()}
  function reset(){try{tree=new Tree($('.sld-prog').value,$('.sld-query').value,{maxSteps:cfg.maxSteps||300})}
    catch(e){tree=null;$('.sld-status').textContent='Syntax error: '+e.message;$('.sld-tree').innerHTML='';return}render()}
  function nodeHtml(n){
    const cls='sld-n sld-'+n.status+(tree.current===n?' sld-cur':'');
    if(n.parent&&n.mgu===undefined)n.mgu=tree.delta(n.parent,n.subst);
    let lab=n.edge?'<span class="sld-e">'+esc(n.edge)+(n.mgu&&n.mgu.length?' {'+esc(n.mgu.join(', '))+'}':'')+'</span> ':'';
    let body=n.goals.length?esc(showGoals(n.goals,n.subst)):'□';
    let tag=n.status==='success'?' <b class="sld-ok">yes'+(n.answer!=='yes'?': '+esc(n.answer):'')+'</b>':
      n.status==='fail'?' <b class="sld-no">no</b>':n.status==='pruned'?' <i>pruned by !</i>':n.status==='pending'?' <i>pending</i>':
      n.status==='error'?' <b class="sld-no">error: '+esc(n.info)+'</b>':'';
    if(n.info&&n.status!=='error')tag+=' <i>'+esc(n.info)+'</i>';
    const kids=n.children.length?'<ul>'+n.children.map(nodeHtml).join('')+'</ul>':'';
    return '<li><span class="'+cls+'">'+lab+'<code>'+body+'</code>'+tag+'</span>'+kids+'</li>'}
  function render(){if(!tree)return;
    const st=tree.error?'Stopped: '+tree.error:tree.done()?'Search finished.':'Next: expand the first pending resolvent (depth first, left to right).';
    const sols=tree.solutions,shown=sols.length>12?esc(sols.slice(0,12).join(' ; '))+' ; … ('+sols.length+' in all)':esc(sols.join(' ; '));
    $('.sld-status').innerHTML='Steps: '+tree.steps+' · Solutions: '+(sols.length?shown:'none yet')+
      (tree.output?' · Output: <code>'+esc(tree.output.replace(/\n/g,'⏎'))+'</code>':'')+'<br>'+esc(st);
    $('.sld-tree').innerHTML='<ul>'+nodeHtml(tree.root)+'</ul>';
    ['.sld-step','.sld-next','.sld-all'].forEach(b=>$(b).disabled=tree.done())}
  pre.addEventListener('change',()=>load(pre.value));
  $('.sld-step').addEventListener('click',()=>{tree&&tree.step();render()});
  $('.sld-next').addEventListener('click',()=>{tree&&tree.nextSolution();render()});
  $('.sld-all').addEventListener('click',()=>{if(tree)while(!tree.done())tree.step();render()});
  $('.sld-reset').addEventListener('click',reset);
  $('.sld-query').addEventListener('change',reset);$('.sld-prog').addEventListener('change',reset);
  load(cur);
}
return {tokenize,parseProgram,parseQuery,unify,show,Tree,solveAll,mount};
});
