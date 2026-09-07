# Dining philosophers: graph, state, and progress

Preview: [PCD 6](../../pcd/cap-06-deadlock.html#s2). Production is unchanged.

## Corrections

- The first old stepper declared five forks but only three philosophers. The
  second silently gave F4 the ordered solution while labelling the run naive.
  Both diagnosed deadlock from resource occupancy. A five-fork occupied state
  can instead let F0 and F2 eat. Neither stepper is retained as a simulator.
- The old local state explorer jumped from one occupied right fork to global
  deadlock, then treated choosing tickets as recovery. Its useful local lifecycle
  remains in prose; shared state and genuine blocking now belong to one model.
- The old Mermaid diagram used indices 1–5, unlike the pseudocode/table's 0–4.
  The replacement is native SVG from the shared angular renderer. Its five
  labelled wait-for edges are obtained from the same executed deadlock trace as
  the tables. Arrows are dependencies, not fork transfers. No source coordinates.
- The table illustration retains its layout and colors, with larger 14px mono
  labels placed off the table rim. It remains inline SVG, not a raster image.
- Tickets admit N−1 contenders; they do not let four of five philosophers eat
  simultaneously. Deadlock freedom is separate from starvation freedom. A policy
  permitting cycles is distinct from a present wait-for cycle. Lock ordering
  excludes circular lock waits, not every possible event/resource deadlock.
- Java deadlock detection is distinguished from recovery, and live diagnosis
  from post-mortem inspection. Database recovery claims are scoped to a documented
  PostgreSQL example. The two Java code alternatives are static HTML tab panels,
  accessible without JavaScript, and describe possible rather than inevitable
  deadlock for opposite acquisition orders.

## Model and limits

`pcd/assets/dining-philosophers.js` exports `Model`, `scenarios`, `trace`, labels
and `mount`. The browser and Node tests use identical transition rules. Each
click executes one atomic instruction: end think, wait ticket (if enabled), wait
first fork, wait second fork, eat, signal first, signal second, return ticket.
The loop repeats. Each binary semaphore models exclusive ownership under this
well-formed protocol; this is not a complete Java Semaphore implementation.

The model has 2–8 philosophers, one instance per fork, no failures or preemption,
and non-fair permit selection. The displayed example uses five philosophers.
A pending wait at the program counter is enabled exactly when its resource is
available. It cannot advance when occupied and becomes enabled after release.
There is no FIFO queue, scheduler fairness, cancellation or time model. Changing
the protocol or selecting a fixture starts a fresh execution, not recovery.

`waits()` joins each occupied requested fork to its actual holder. `cycles()`
finds cycles in that relation; it never counts occupied forks as a verdict.
With this fixed ring/program, the reachable cyclic state blocks every philosopher.
This does not generalize a global-deadlock test to arbitrary programs where a
subset can be deadlocked while unrelated threads still run.

The four fixtures reproduce a naive deadlock, all forks occupied without deadlock,
the ticket gate and the total-order gate. Static HTML includes every executed
instruction, resource owner after the step, final pending instructions and verdict.
`dining-traces.cjs` prints an `apply_patch` patch; `--check` detects drift.

## Evidence and verification

Local slides: PCD module 1.3, slides 23–31 (problem, pseudocode and solutions),
and Lab Notes Thread Liveness (Coffman, diagnosis and ordering). Text under
`/home/ybc/content/exams/Programmazione Concorrente e Distribuita (PCD)/slides-text/`.
The slides' informal no-JVM-detection statement is qualified against the API:

- [ThreadMXBean, Java 25](https://docs.oracle.com/en/java/javase/25/docs/api/java.management/java/lang/management/ThreadMXBean.html#findDeadlockedThreads()):
  platform-thread monitor/ownable-synchronizer cycles, not virtual-thread cycles;
  troubleshooting rather than synchronization control or automatic rollback.
- [Semaphore, Java 25](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/Semaphore.html):
  optional fairness, barging without it, and no semaphore ownership enforcement.
- [PostgreSQL deadlocks](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-DEADLOCKS):
  detection and abort of an involved transaction, not a universal DBMS guarantee.

Breadth-first exploration exhausts the reachable control/resource state space
for all three protocols with N=2,3,4,5: **22,348 states and 93,332 transitions**.
Meal counters are omitted from state identity because they never affect guards
or transitions; this is not a bound on the number of meals. An independent oracle
derives ownership and enabled instructions directly from program counters and
uses transitive closure to identify cyclic participants. Every state and edge is
checked, including rejected blocked operations and exclusive ownership.
Each naive configuration has one cyclic state; neither alternative has one.

A repeatable unfair schedule permits ten F0 meals and no F4 meal while returning
to the same control/resource state each time. Repeating it indefinitely witnesses
possible starvation under this non-fair model, not under all fairness policies.
There are explicit all-forks-occupied/progress, release/unblock, protocol-change,
clone and invalid-configuration checks. These are model checks, not a verification
of JVM scheduling, arbitrary N, or production implementations.

```sh
node dev/legacy-diagrams/dining-traces.cjs --check
node dev/legacy-diagrams/dining-test.cjs
node dev/legacy-diagrams/build.cjs --check
node dev/legacy-diagrams/test.cjs
node dev/legacy-diagrams/font-test.cjs
NOTES_PREVIEW_URL=http://127.0.0.1:8787/ node dev/legacy-diagrams/browser-test.cjs
```

Browser checks cover 1280/390 px, JavaScript enabled/disabled, all four fixtures,
actual table state, enabled/disabled commands, release/unblock, reset and protocol
selection, tab panels, details, native keyboard scrolling, unique IDs, HTML5
parsing, stray SVG, table-illustration label bounds/overlaps and no page overflow.
Native graph, table illustration, widget and static trace screenshots were viewed.
An initial no-JS check timed out because its requestAnimationFrame polling was
disabled; a direct read confirmed native keyboard scroll and the test now checks
the actual scroll offset without depending on page JavaScript.

Shared regressions pass for 28 graphs, 30 embedded original-font SVG assets,
eight chapters at two widths and eight no-JavaScript image-loading visits.
Artifacts: `/home/ybc/notes-legacy-review-artifacts/dining-test.json`, `dining-*.png`,
`pcd-dining-wait*.png`, `static-test.json`, `browser-http-test.json`.
The full-site objective remains open; no other course is certified by this review.
