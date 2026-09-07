// Exact LTL evaluation on ONE ultimately periodic infinite trace, not model checking.
// A trace contains states 0..n-1 and an edge n-1 -> loop.
'use strict';
const assert = require('node:assert/strict');
const not = p => ['!', p], and = (p,q) => ['&',p,q], or = (p,q) => ['|',p,q];
const implies = (p,q) => ['->',p,q], F = p => ['F',p], G = p => ['G',p];
const U = (p,q) => ['U',p,q], W = (p,q) => ['W',p,q];
function evaluate(trace, formula) {
  assert(trace && Array.isArray(trace.states) && trace.states.length > 0 && trace.states.length <= 64);
  const states = trace.states, n = states.length;
  assert(Number.isInteger(trace.loop) && trace.loop >= 0 && trace.loop < n);
  for (const state of states) {
    assert(state && typeof state === 'object' && !Array.isArray(state));
    assert(Object.values(state).every(v => typeof v === 'boolean'));
  }
  const next = i => i + 1 < n ? i + 1 : trace.loop;
  function calc(f, depth = 0) {
    assert(depth <= 40, 'Formula nesting limit');
    if (typeof f === 'boolean') return states.map(() => f);
    if (typeof f === 'string') return states.map(s => {
      assert(Object.hasOwn(s,f), 'Missing proposition: ' + f); return s[f];
    });
    assert(Array.isArray(f) && ['!','&','|','->','X','F','G','U','W'].includes(f[0]), 'Unsupported formula');
    const op = f[0], unary = ['!','X','F','G'].includes(op);
    assert.equal(f.length, unary ? 2 : 3, 'Formula arity');
    const a = calc(f[1],depth+1), b = unary ? null : calc(f[2],depth+1);
    if (op === '!') return a.map(v => !v);
    if (op === '&') return a.map((v,i) => v && b[i]);
    if (op === '|') return a.map((v,i) => v || b[i]);
    if (op === '->') return a.map((v,i) => !v || b[i]);
    if (op === 'X') return a.map((_,i) => a[next(i)]);
    // Least fixed point for F/U; greatest fixed point for G/W.
    let value = states.map(() => op === 'G' || op === 'W');
    for (let round = 0; round <= n; round++) {
      const updated = value.map((_,i) => op === 'F' ? a[i] || value[next(i)]
        : op === 'G' ? a[i] && value[next(i)] : b[i] || (a[i] && value[next(i)]));
      if (updated.every((v,i) => v === value[i])) return updated;
      value = updated;
    }
    throw new Error('Fixed point did not converge');
  }
  return calc(formula);
}
const formulas = {
  until: U('p','q'), weakUntil: W('p','q'), recurrent: G(F('p')), stable: F(G('p')),
  weakFair: implies(F(G('enabled')),G(F('taken'))),
  strongFair: implies(G(F('enabled')),G(F('taken'))),
  mutex: G(not(and('p3','q3'))), response: G(implies('tryp',F('p3'))),
  bound: W(not('q3'), W('q3',W(not('q3'),'p3')))
};
formulas.everyBound = G(implies('tryp',formulas.bound));
const pq = (p,q) => ({p,q}), action = (enabled,taken) => ({enabled,taken});
const cs = (tryp,p3,q3) => ({tryp,p3,q3});
const cases = [
  {id:'until-now', group:'until', label:'Q vera già adesso', states:[pq(false,true)], loop:0},
  {id:'until-later', group:'until', label:'P fino a Q, non nello stato Q', states:[pq(true,false),pq(false,true)], loop:1},
  {id:'until-never', group:'until', label:'P sempre, Q mai', states:[pq(true,false)], loop:0},
  {id:'until-gap', group:'until', label:'P cade prima di Q', states:[pq(false,false),pq(false,true)], loop:1},
  {id:'recurring', group:'recurrence', label:'P alterna vero e falso', states:[pq(true,false),pq(false,false)], loop:0},
  {id:'stable', group:'recurrence', label:'P diventa e rimane vera', states:[pq(false,false),pq(true,false)], loop:1},
  {id:'intermittent', group:'fairness', label:'A abilitata a intermittenza, mai eseguita', states:[action(true,false),action(false,false)], loop:0},
  {id:'ignored', group:'fairness', label:'A sempre abilitata, mai eseguita', states:[action(true,false)], loop:0},
  {id:'executed', group:'fairness', label:'A eseguita a ogni riabilitazione', states:[action(true,true),action(false,false)], loop:0},
  {id:'disabled', group:'fairness', label:'A eseguita una volta, poi disabilitata', states:[action(true,true),action(false,false)], loop:1},
  {id:'one-interval', group:'bound', label:'Un intervallo Q (due passi), poi P', states:[cs(true,false,false),cs(true,false,true),cs(true,false,true),cs(true,false,false),cs(false,true,false)], loop:4},
  {id:'two-intervals', group:'bound', label:'Due intervalli Q, poi P', states:[cs(true,false,false),cs(true,false,true),cs(true,false,false),cs(true,false,true),cs(false,true,false)], loop:4},
  {id:'no-entry', group:'bound', label:'P attende, nessuno entra mai', states:[cs(true,false,false)], loop:0},
  {id:'later-request', group:'bound', label:'Richiesta successiva allo stato iniziale, due scavalchi', states:[cs(false,false,false),cs(true,false,false),cs(true,false,true),cs(true,false,false),cs(true,false,true),cs(false,true,false)], loop:5}
];
const groups = [
  {id:'until', title:'Until e weak until', fields:['p','q'], columns:[['until','P U Q'],['weakUntil','P W Q']]},
  {id:'recurrence', title:'Ricorrenza e stabilizzazione', fields:['p'], columns:[['recurrent','GF P'],['stable','FG P']]},
  {id:'fairness', title:'Fairness della singola azione A', fields:['enabled','taken'], columns:[['weakFair','WF(A)'],['strongFair','SF(A)']]},
  {id:'bound', title:'Limite agli scavalchi e progresso', fields:['tryp','p3','q3'], columns:[['everyBound','G (tryp → B1)'],['response','G (tryp → F CSp)']]}
];
// Editorial traces for the two-panel native diagram, not traces of a specific algorithm.
const diagram = {
  safety:{states:[cs(false,false,false),cs(false,true,false),cs(false,true,true)],loop:2},
  liveness:{states:[cs(true,false,false),cs(true,false,true),cs(true,false,false)],loop:1}
};
function results() {return cases.map(c => ({id:c.id, ...Object.fromEntries(groups.find(g=>g.id===c.group).columns.map(([key])=>[key,evaluate(c,formulas[key])[0]]))}));}
module.exports = {evaluate,formulas,cases,groups,diagram,results,not,and,or,implies,F,G,U,W};
if (require.main === module) console.log(JSON.stringify(results(),null,2));
