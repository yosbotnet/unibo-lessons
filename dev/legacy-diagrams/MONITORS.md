# Monitor structure, reentry and compilable examples

Preview: [PCD7](../../pcd/cap-07-monitor.html). Production is unchanged.

## Figures and content

`monitor-sources.cjs` defines two native SVG figures using the shared renderer,
original embedded IBM Plex Mono, ivory/cobalt/vermilion and angular connectors.
No coordinates occur in these sources. The first replaces the vague semaphore
“evolution” arrow with monitor components. The second replaces the small curved
condition-queue illustration with the signal-and-continue ownership path: wait
releases, notification makes a waiter eligible, reacquisition precedes predicate
checking. The normal-notification path is drawn; spurious wakes and interruption
are qualified in the caption, not falsely represented as guaranteed notifications.

Chapter corrections distinguish classical FIFO assumptions, Java Object wait
sets, and Condition-specific policies; immediate handoff and urgent resumption;
spurious wakes and predicates changed by intervening work; monitor exclusion and
method-wide atomicity; synchronized method flags and synchronized block bytecode.
Readers/writers no longer implies writer starvation freedom, and cascading signals
do not justify dropping the while guard in signal-and-continue code.

The semaphore pseudocode uses a private gate per waiter, with its queue protected
by the monitor. Signal-and-continue reacquires mutex after waking; signal-and-wait
passes the control baton without releasing the entry permit. This is an abstract
algorithm without timeout/cancellation, not compiled Java or an implementation of
urgent-wait. The mixed semaphore example (direct handoff followed by decrement of
an unincremented counter) is removed. The single canonical example accumulates
permits and uses while. Quiz answers restore missing safety/liveness formulas and
state the permit-counting convention explicitly.

## Canonical Java and preserved annotation UI

Four complete, downloadable sources live under `pcd/assets/examples/`:

- `SynchCell.java`: persistent latest-value cell, non-consuming reads, notifyAll
  for all existing readers, interruption propagated from wait.
- `SynchCell2.java`: same value semantics using ReentrantLock and Condition;
  one balanced acquisition and while around await. Lock acquisition in get is
  itself interruptible, unlike synchronized monitor entry.
- `MonitorBuffer.java`: circular array, positive capacity, count distinguishes
  full/empty, null rejected, cleared consumed slots and intrinsic wait/notifyAll.
- `ConditionBuffer.java`: the same circular-array protocol with separate notFull
  and notEmpty conditions, interruptible acquisition, while and finally.

`monitor-code.cjs` creates HTML from these exact files and prints small ordered
patches for apply_patch. `--check` detects drift. Full code is visible without
JavaScript. `pcd/assets/monitor-code.js` retains optional line-by-line annotation
widgets, deriving every line from that visible source rather than maintaining
different hidden code. It does not execute Java in the browser.

The rewrite fixes the void-return example, swallowed interruptions, missing
buffer initialization/checked exception declarations, unchecked constructor
capacity and retained consumed references. The original array structure remains;
it has not been replaced by a library queue to avoid testing the algorithm.

## Primary and local evidence

- PCD module 1.3 slide text: monitor definitions, cell and buffer examples,
  disciplines (slides 56–58), readers/writers, monitor/semaphore implementations.
  Lab Notes Implementing Monitors in Java: intrinsic and explicit-lock examples.
  Sources under `/home/ybc/content/exams/Programmazione Concorrente e Distribuita (PCD)/slides-text/`.
- [Object documentation](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Object.html):
  monitor ownership, notification/reacquisition, interrupts and spurious wakes.
- [Condition documentation](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/locks/Condition.html)
  and [ReentrantLock documentation](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/locks/ReentrantLock.html):
  associated locks, separate wait queues and acquisition policies.
- [JVMS §3.14](https://docs.oracle.com/javase/specs/jvms/se25/html/jvms-3.html#jvms-3.14):
  synchronized method flags versus explicit monitorenter/monitorexit blocks.

## Tests and reproducibility

```sh
node dev/legacy-diagrams/monitor-code.cjs --check
NOTES_JDK=/path/to/jdk node dev/legacy-diagrams/monitor-java-test.cjs
node dev/legacy-diagrams/monitor-browser-test.cjs
node dev/legacy-diagrams/build.cjs --check
node dev/legacy-diagrams/test.cjs
node dev/legacy-diagrams/font-test.cjs
NOTES_PREVIEW_URL=http://127.0.0.1:8787/ node dev/legacy-diagrams/browser-test.cjs
```

If java/javac/javap are on PATH, NOTES_JDK is unnecessary. The validation used
Temurin JDK 17.0.20.1+1, downloaded from the official Adoptium release, archive
SHA-256 `3808d1d15e3ec6bd5b84057fb5d84c33d8a1536a258146bcea2e603fc726e08e`.
It is isolated at `/tmp/notes-jdk-aipbDL/jdk-17.0.20.1+1`, not installed system-wide.
The download matches the checksum returned by the Adoptium API; this does not
claim independent signature verification. Tests create isolated temporary class
directories; neither the binary distribution nor generated classes are committed.

Compilation uses `-Xlint:all -Werror`. The actual Java harness performs 5,099
assertions: two waiting cell readers, notification while the notifier still owns
the monitor, a notification with the predicate still false followed by re-wait,
non-consuming reads and later writes, interruption and subsequent reuse, FIFO
wraparound at capacities 1–4, invalid capacity/null input, cleared slots, blocked
producer/consumer cancellation and wakeup, and two producers/two consumers moving
2,000 distinct items per buffer variant. A nested synchronized wait allows another
thread to enter and restores ownership before returning. javap verifies the actual
ACC_SYNCHRONIZED flag. Polling of thread states has bounded deadlines and threads
are daemonized so a failed test cannot strand the test JVM indefinitely.

These are compiled execution tests, not exhaustive JVM-schedule verification or
a fairness/performance proof. An unchanged-predicate notify is not claimed to be
an actual VM-generated spurious wakeup. Abstract Hoare/semaphore/RW pseudocode was
reviewed against its stated assumptions but is not certified by the Java harness.

Browser checks cover four HTTP views (1280/390, JS on/off), exact source/download
bytes, all annotation lines and selected explanations, tab panels, six quiz details,
image loading, keyboard scrolling, HTML5 parsing, unique IDs and stray SVG tags.
A no-JS overflow in the discipline table was found and repaired using a real
scroll region. Native SVG and chapter/code/annotation screenshots were inspected.
Shared regressions pass for 30 generated graphs and 32 embedded-font SVG assets,
18 desktop/mobile visits across nine chapters and nine no-JavaScript image-loading
visits. An initial shared-browser run terminated with a closed-page error on the
unchanged PCD16 mobile screenshot; after confirming it was terminal, a complete
rerun passed. The initial failed run is not counted as verification.
Artifacts: `/home/ybc/notes-legacy-review-artifacts/monitor-java-test.json`,
`monitor-browser-test.json`, `monitor-*.png` and `pcd-monitor-*.png`.
The full-site goal remains open; neither these tests nor source counts certify
the other chapters, runtime diagrams, or all scientific content.
