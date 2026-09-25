// node dev/test-pps-linearization.cjs — checks pps-next/assets/linearization.js
const assert=require('assert');
const L=require('../pps-next/assets/linearization.js');
const lin=(src,t)=>{const r=L.compute(src,t);if(!r.lin)throw Error(r.errors.join('; '));return r};
// 1. Odersky's Cat, checked in Scala 3.3.6 via super calls: Cat -> FourLegged -> HasLegs -> Furry -> Animal
assert.deepStrictEqual(lin(L.presets.cat.src,'Cat').lin.result,['Cat','FourLegged','HasLegs','Furry','Animal','AnyRef','Any']);
// 2. course code Traits.scala prints TAB: C -> B -> A -> T
assert.deepStrictEqual(lin(L.presets.tab.src,'C').lin.result,['C','B','A','T','AnyRef','Any']);
// 3. Parser
assert.deepStrictEqual(lin(L.presets.parser.src,'NonEmptyBasicParser').lin.result,['NonEmptyBasicParser','NonEmpty','BasicParser','Parser','AnyRef','Any']);
// 4. lab 07 with a case class (Scala 3 adds Product, Serializable after the declared parents)
assert.deepStrictEqual(lin(L.presets.lab.src,'<anon>').lin.result,['<anon>','NonEmpty','NotTwoConsecutive','BasicParser','Serializable','Product','Equals','Parser','AnyRef','Any']);
assert.deepStrictEqual(lin(L.presets.lab.src,'BasicParser').lin.result,['BasicParser','Serializable','Product','Equals','Parser','AnyRef','Any']);
// 5. Scala 3 comma syntax and trailing colon
assert.deepStrictEqual(lin('trait A\ntrait B extends A\nclass C extends B, A:','C').lin.result,['C','B','A','AnyRef','Any']);
// 6. the concatenation marks earlier duplicates as dropped
const cat=lin(L.presets.cat.src,'Cat').lin.concat;
assert.deepStrictEqual(cat.map(c=>c.name+(c.kept?'':'-')),['FourLegged','HasLegs','Animal-','AnyRef-','Any-','Furry','Animal-','AnyRef-','Any-','Animal','AnyRef','Any']);
// 7. errors: unknown type, class not first, cycle, illegal mixin
assert.match(L.compute('class C extends X','C').errors[0],/unknown type X/);
assert.match(L.compute('class A\ntrait T\nclass C extends T with A','C').errors[0],/only the first parent/);
assert.match(L.compute('trait A extends B\ntrait B extends A','A').errors[0],/cyclic/);
assert.match(L.compute('class Animal\nclass Parser\ntrait NonEmpty extends Parser\nclass X extends Animal with NonEmpty','X').errors[0],/illegal inheritance/);
assert.strictEqual(L.compute(L.presets.cat.src,'Cat').ok,true);
// 8. super chain
assert.deepStrictEqual(lin(L.presets.tab.src,'C').supers.slice(0,3),[{in:'C',next:'B'},{in:'B',next:'A'},{in:'A',next:'T'}]);
// 9. mount() against a minimal DOM stub: renders, reacts to preset and text changes
class El{constructor(t){this.tagName=t;this.children=[];this._text='';this.attrs={};this.listeners={};this.classList={add:()=>{}};this.value=''}
 appendChild(c){this.children.push(c);return c} append(...cs){for(const c of cs)this.children.push(typeof c==='string'?Object.assign(new El('#text'),{_text:c}):c)}
 replaceChildren(){this.children=[]} setAttribute(k,v){this.attrs[k]=v} addEventListener(e,f){this.listeners[e]=f}
 set textContent(v){this._text=String(v)} get textContent(){return this._text+this.children.map(c=>c.textContent).join('')}
 find(pred){if(pred(this))return this;for(const c of this.children){const r=c.find(pred);if(r)return r}return null}}
const host=new El('div');
global.document={createElement:t=>new El(t),querySelector:()=>host};
L.mount('#x',{start:'tab'});
assert.match(host.textContent,/L\(C\) = C→B→A→T→AnyRef→Any/);
const [presetSel,ta]=[host.find(e=>e.tagName==='select'),host.find(e=>e.tagName==='textarea')];
presetSel.value='cat';presetSel.listeners.change();
assert.match(host.textContent,/L\(Cat\) = Cat→FourLegged→HasLegs→Furry→Animal→AnyRef→Any/);
assert.match(host.textContent,/super in Cat → FourLegged; super in FourLegged → HasLegs/);
ta.value='class C extends X';ta.listeners.input();
assert.match(host.textContent,/unknown type X/);
console.log('linearization: all tests passed');
