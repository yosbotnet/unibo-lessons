# PCD9 temporal semantics and native counterexample traces

Preview: `http://localhost:8787/pcd/cap-09-verifica.html#s2` (definitions),
`#ltl-traces` (executable examples) and `#s4` (replacement figure).
Production is unchanged at `f0f4bde`.

## Confirmed defects and changes

- Safety was defined only as a predicate true in every state; liveness only as a
  predicate eventually true once. The chapter now defines bad finite prefixes
  and extendibility, distinguishes invariant examples from the general class,
  and allows mixed properties. Global deadlock and valid termination are scoped.
- The LTL introduction incorrectly required every formula at every state.
  Single-trace position semantics now precedes universal model satisfaction.
  G/F include the current state; U requires P strictly before Q, not at Q.
  W permits Q never occurring only if P persists. GF and FG are distinguished.
- Action fairness explicitly relates enabled/taken with recurring obligations,
  preserves the slides' separate scheduler terminology, and neither guarantees
  impossible steps nor certifies a real scheduler. The same-action SF/WF
  distinction is not conflated with fairness of a thread as a whole.
- The current-position bounded-overtaking formula lacked global scope for later
  requests. B0/B1 factor its nested W expression into legible formulas. The exact
  convention counts continuous Q-in-CS intervals, including one already active
  at the request; it is not an event-only count. A bound does not force P to enter.
- Replaced the anonymous state-space sketch with six named states/five angular
  edges: a finite mutual-exclusion violation and a liveness-violating infinite
  cycle that preserves mutual exclusion. Both are editorial examples, not actual
  traces of Dekker, Peterson or a particular implementation. The top panel shows
  only the finite bad prefix; its final-state repetition is used internally to
  evaluate the invariant, not an additional visible transition.
- Matching summary/quiz claims were corrected. The tool comparison no longer
  claims that JPF eliminates modeling abstractions.

## Sources actually inspected

Local original slide extraction:
`/home/ybc/content/exams/Programmazione Concorrente e Distribuita (PCD)/slides-text/[module-1.2] Modeling Concurrent Program Execution.txt`.
Pages 28–32 give the introductory examples and scheduling terminology. Pages
66–72 distinguish current/all-position progress, define U with k < j, and state
the interval-based nested-W formula. The extraction contains a NUL byte; use
`rg -a` when searching it. The corresponding March transcript inspected is badly
corrupted and was not used to adjudicate formulas or to invent quotations.

Primary references linked in the chapter:

- [Alpern and Schneider, Defining Liveness](https://www.cs.cornell.edu/fbs/publications/DefLiveness.pdf), definitions and mixed properties.
- [Lamport, Specifying Systems](https://lamport.azurewebsites.net/tla/book-02-08-08.pdf), chapter 8, action fairness and its scope.
- [SPIN LTL reference](https://spinroot.com/spin/Man/ltl.html), operator syntax and the special next-operator build/reduction constraints.

## Reproduction and evidence

```sh
node dev/legacy-diagrams/ltl-test.cjs
node dev/legacy-diagrams/ltl-content.cjs --check
node dev/legacy-diagrams/ltl-browser-test.cjs
node dev/legacy-diagrams/jpf-browser-test.cjs
node dev/legacy-diagrams/font-test.cjs
node dev/legacy-diagrams/build.cjs --check
NOTES_PREVIEW_URL=http://127.0.0.1:8787/ node dev/legacy-diagrams/browser-test.cjs
```

Canonical downloadable `pcd/assets/ltl-traces.cjs` evaluates one ultimately
periodic infinite trace with a validated loop index. Least/greatest fixed points
implement F/U and G/W. It supports explicit ASTs, not arbitrary text parsing,
all system behaviors, fairness inference or finite-trace LTL. Missing atoms,
nonboolean valuations, unsupported operators/arity and invalid loop indices fail.
Limits are 64 represented states and formula nesting depth 40.

An independently structured test enumerates distinct future positions instead of
computing fixed points. All 1,252 two-atom lassos through length 4 are checked at
every position against ten formulas, including nested temporal operators and X.
All 18,056 three-atom lassos through length 4 are checked against a separate
Q-interval counter, including every request position. This deliberately includes
arbitrary proposition valuations, not only runs of a mutual-exclusion algorithm.
There are 117,808 position comparisons. All 1,641 valid enabled/taken lassos through
length 5 are checked against a loop-occurrence oracle for WF/SF.

Fourteen published cases have manually specified expected pairs and generated
truth tables, including false-until/true-weak-until, recurring/not-stabilizing,
WF/not-SF, one interval spanning two states, two scavalchi with eventual admission,
no scavalchi without admission and a request occurring after the initial state.
Thirty-two finite waiting-prefix lengths have both perpetually waiting and later
admitted extensions; safe extensions never undo the observed bad safety prefix.
Nine invalid-input controls are exercised. Counts are test coverage, not proofs
that the evaluator implements every conceivable formalism.

The figure and HTML tables are generated from these canonical states; no raster,
paid service or hand-edited generated SVG is involved. Browser tests verify exact
values, loop destinations, five complete arrows, six states, XML, text bounds and
overlaps, native image size, downloads and keyboard scrolling. Four 1280/390 px
JS/no-JS views pass; the preexisting four tab groups and eight quizzes also pass.
The actual native figure, desktop/mobile figure and tables were visually inspected.
Shared font tests now cover 41 assets with the exact original font/license.

## Remaining work

This completes this temporal-definitions/illustrative-trace checkpoint, not PCD9
or the full site. PROMELA/PlusCal models and their actual state counts were
subsequently corrected and executed in the [formal-model checkpoint](FORMAL-MODELS.md).
Fault/error/failure terminology, combinatorial counts, inductive-proof
examples and historical application claims remain open. No paid generation or
production publication; preexisting root review/index/report edits are preserved.
