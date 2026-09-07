# PCD8: thread launch, lock contracts and atomic bounded operations

Preview: [run/start](../../pcd/cap-08-java.html#s1),
[explicit locks](../../pcd/cap-08-java.html#s5),
[bounded counter](../../pcd/cap-08-java.html#s6).
Production remains at f0f4bde; the full-site review remains open.

## Corrections

- Thread and Runnable are in java.lang; constructing a Thread does not start it.
  The examples are explicitly Java 17 platform threads, not virtual-thread claims.
  A direct run call is legal and uses the caller; start is one-shot, join waits,
  and void return does not imply a persistent service loop. MyThread now handles
  cancellation rather than swallowing interruption and printing normal completion.
- `pcd-thread-start` has seven nodes/seven edges distinguishing direct invocation,
  first start, termination and a rejected second start. Its caption excludes a
  full JVM state machine. A verified wrappingWidth override keeps the exception
  identifier intact without reducing font size or authoring coordinates.
- Lost update is possible, not inevitable or necessarily different every run.
  The read/modify/write stepper is a teaching model, not a promise about machine
  instructions or all JVM memory behavior. Its serial and lost-update schedules
  both remain tested. Volatile alone does not make count++ atomic.
- Synchronization is relative to the same monitor; instance/static method locks,
  reentrancy, release/acquire visibility and atomic versus stale int reads are
  distinguished. Thread-safe component methods do not automatically make composed
  client operations atomic. No claim that all java.util classes lack thread safety.
- Lock variants distinguish successful ownership, interruption and timeout;
  reentrant acquisition needs matching releases, and untimed tryLock can barge
  even on a fair lock. Standard ReentrantLock is not AutoCloseable in Java 17.
- BoundedCounter validates construction and protects both checking and mutation;
  every public method need not be synchronized unless its state discipline needs
  it. inc/dec preserve the custom exception names, defined as unchecked nested
  types; tryInc/tryDec return false at limits without modifying state.
- Quiz answers distinguish Object notification from Condition-specific FIFO,
  notification from lock ownership, while guards from a complete correct protocol,
  permit assignment from method-return counting, and model checking from proving
  all real-program bugs absent. The semaphore convention links to PCD7.

## Canonical code and tests

`ThreadStartDemo.java` compares actual Thread identity, NEW after direct run,
TERMINATED after start/join, exactly two task executions and the second-start
exception. It is intentionally a two-execution demonstration, not a recommendation
to call run before start in application code.

`LockSemanticsDemo.java` holds the lock on main while another thread attempts five
acquisition variants. It waits for actual queueing where interruption is tested;
main retains ownership until the intended release. The ordinary lock case
eventually acquires with interrupt status preserved. Interruptible and timed-
interrupted cases throw with cleared status; untimed and timed-out attempts do not
acquire. It also checks reentrant hold counts and the AutoCloseable type relation.
All worker failures are captured and workers are joined; daemon mode is only a
failure guard, not the cleanup mechanism. Deadlines are not performance results.

`BoundedCounter.java` is the source for the downloadable and annotated example.
The Java test checks invalid construction, unchanged values on overflow/underflow,
two groups of twenty concurrent conditional updates (one successful increment,
then one successful decrement), a stale external get before inc, and int bounds.
This validates finite examples, not all schedulers or arbitrary counter clients.

`java-basics-test.cjs` compiles all three with `-Xlint:all -Werror`, repeats the
thread and five-lock-case demos twenty times, and verifies actual output. A
separate negative compiler fixture must fail specifically because ReentrantLock
cannot be used as an AutoCloseable resource; an arbitrary compilation error is
not accepted. The isolated Temurin JDK is 17.0.20.1, not installed system-wide.

`java-basics-content.cjs` prints ordered apply_patch hunks from the canonical files;
`--check` rejects drift. `pcd/assets/thread-basics.js` derives both annotation
widgets from the same visible/downloadable source, including constructor and
exception definitions. There is no parallel shortened buggy Java copy.

```sh
NOTES_JDK=/path/to/jdk node dev/legacy-diagrams/java-basics-test.cjs
node dev/legacy-diagrams/java-basics-content.cjs --check
node dev/legacy-diagrams/java-basics-browser-test.cjs
node dev/legacy-diagrams/executor-browser-test.cjs
node dev/legacy-diagrams/swing-browser-test.cjs
node dev/legacy-diagrams/build.cjs --check
node dev/legacy-diagrams/test.cjs
node dev/legacy-diagrams/font-test.cjs
NOTES_PREVIEW_URL=http://127.0.0.1:8787/ node dev/legacy-diagrams/browser-test.cjs
```

Browser checks use 1280/390 px with JS on/off: exact source/download/annotation
content, clickable explanations, native details, SVG loading, keyboard scroll,
HTML5 parsing, unique IDs and no document overflow. Existing PCD8 tests cover five
annotation widgets, tabs, quiz disclosure, lost-update controls and prior Swing
examples. Visual review caught the split exception identifier and verified the
corrected figure and responsive chapter. Annotations retain the existing font.

Shared renderer tests cover 33 figures, geometry, text collisions, XML,
deterministic output, edge directions and ten invalid inputs. wrappingWidth is
optional; existing sources without it retain the same generated SVGs. Values
outside 120–600 and nonnumeric overrides are rejected. Thirty-five SVG assets
contain the exact original font/license; actual rendering is checked offline.
The shared HTTP suite passes twenty desktop/mobile chapter visits and ten
no-JavaScript image-loading visits.
Artifacts live in `/home/ybc/notes-legacy-review-artifacts/`, particularly
`java-basics-test.json`, `java-basics-browser-test.json`, `pcd-thread-start*` and
`java-basics-*` screenshots. No paid generation or production writes.

## Evidence and still-open work

Local `[Lab Notes] Thread Coordination in Java - Library Support.txt`, lock slides
9–10, under `/home/ybc/content/exams/Programmazione Concorrente e Distribuita (PCD)/slides-text/`.
Primary API references:
[Thread Java 17](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/lang/Thread.html),
[ReentrantLock Java 17](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/locks/ReentrantLock.html),
[Collections synchronizedList](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/Collections.html#synchronizedList(java.util.List)).

The later [barrier/latch revision](BARRIERS.md) corrects section 7. This checkpoint
does not certify the physics example, parallel algorithms, or version-specific
StructuredTaskScope example. Those still
need executable/semantic review. In particular, the chapter's broad JDK20+ label
must not be treated as verified compatibility with all later APIs. Whole-site
inventory is 315 pages/996 figure elements, with 96 raw Mermaid blocks on 27 pages;
the original fifteen-course scope remains 208 chapters/882 figures. Counts are
not evidence of complete review. Preexisting review/index and review/report edits
are preserved unstaged.
