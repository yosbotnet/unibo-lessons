# PCD8: executor types and cancellation

Preview: [types and producer](../../pcd/cap-08-java.html#s10),
[cancellation experiment](../../pcd/cap-08-java.html#s11).
Production is unchanged; this checkpoint is not a whole-chapter or site approval.

## Figure and content

`executor-sources.cjs` uses the existing build-time adapter, not hand-positioned
SVG. Four nodes and three explicitly directed edges preserve the hierarchy:
ScheduledExecutorService → ExecutorService → Executor (`extends`); the dashed
Executors → ExecutorService edge means creation of implementations, not inheritance.
Required-text assertions protect literal `Callable<T>` and `Future<T>` labels.
Original embedded IBM Plex Mono, ivory, cobalt/vermilion, angular routes and native
mobile scroll are retained. The chapter no longer loads Mermaid at runtime.

The PrimeProducer slide transcription never updated `p`, so it repeatedly queued
2. The canonical Java source updates it, requires a non-null final queue, exits
on interruptible put cancellation and leaves previously queued values intact.
The PrimeGenerator helper requests cancellation in finally and joins before
returning a result; its prose explicitly limits what happens if the caller is
interrupted or a next-prime computation takes time. It does not promise one-second
termination. The Callable example now requests owned-pool shutdown in finally.

Executor shutdown now includes already accepted queued tasks; awaitTermination
does not initiate shutdown, and timeout/interruption are distinguished from
successful termination. Volatile visibility is not bounded cancellation latency;
interruptible waiting differs from acquiring an intrinsic monitor. Poison pills
require an explicit producer/consumer protocol.

## Actual Java experiment, not an animation with predetermined results

`pcd/assets/examples/ExecutorLifecycleDemo.java` uses a ThreadPoolExecutor with one
worker, an active latch-held Callable and a queued FutureTask. The driver checks:

- orderly shutdown rejects new submissions but preserves the queued task;
- shutdownNow interrupts the active task and returns the queued FutureTask without
  marking that particular Future cancelled or done;
- cancel(true) and cancel(false) succeed for the concrete running FutureTask;
  both make get throw CancellationException, only the former interrupts the body;
- in all four held observations, the body has not exited and the pool has not
  terminated; a timed awaitTermination returns false;
- releasing the latch permits exit and termination; accepted queued work runs
  except in the shutdownNow case, where its Future is explicitly cancelled.

The active task deliberately catches interruption and waits again to make these
states observable. This is clearly labelled as an experiment, not recommended
application code. Latches coordinate observations; timing is not presented as a
performance result. Cleanup opens the latch, cancels outstanding Futures and waits
for the executor. Daemon workers prevent a failed test from stranding the JVM.
Successful running cancellation is not asserted for all Future implementations.

`executor-java-test.cjs` compiles both downloadable sources and PrimeProducerTest
with `javac -Xlint:all -Werror`, executes the four cases ten times and compares
each output field to the expected API/implementation behavior. PrimeProducerTest
runs twenty real-thread cases: 2–31 in order, full-queue blocking, interrupt,
join, retained 37 and no insertion of 41; null construction is also rejected.
These finite tests are not an exhaustive scheduler proof.

`executor-content.cjs` compiles/runs the experiment to derive the static table.
It embeds the complete source files (demo in native details) and prints ordered
patches for apply_patch; `--check` rejects divergence. The browser test checks
displayed code and HTTP downloads byte-for-byte against those files and checks
every displayed observation against the recorded execution. No paid generation,
new browser simulation, service restart or production write is involved.

## Checks and artifacts

Verified using isolated Temurin JDK 17.0.20.1, no system Java installation:

```sh
NOTES_JDK=/path/to/jdk node dev/legacy-diagrams/executor-java-test.cjs
NOTES_JDK=/path/to/jdk node dev/legacy-diagrams/executor-content.cjs --check
node dev/legacy-diagrams/executor-browser-test.cjs
node dev/legacy-diagrams/build.cjs --check
node dev/legacy-diagrams/test.cjs
node dev/legacy-diagrams/font-test.cjs
NOTES_PREVIEW_URL=http://127.0.0.1:8787/ node dev/legacy-diagrams/browser-test.cjs
```

The chapter test covers 1280/390 px with and without JavaScript, HTML5 parse
errors, duplicate IDs, escaped SVG elements, exact sources/downloads, observations,
native image loading, code/table keyboard scroll, all five existing annotated-code
widgets, tabs, quiz disclosure, and serial/lost-update stepper schedules. It does
not certify the scientific correctness of the untouched annotations.

Visual inspection found three existing tables overflowed the page on mobile when
JavaScript was disabled. Static, labelled keyboard-scroll regions fix them without
shrinking text or hiding overflow. The new five-column table fits desktop; extra
queue/cancellation fields remain in the executable output and nearby explanation.

Shared regression: 31 SVGs pass XML, geometry, text collision, deterministic output
and edge checks; 33 assets contain the exact original font and license; actual
font rasterization is checked with network disabled. Twenty desktop/mobile visits
over ten chapters and ten no-JS native-image loading visits pass.
Reports/screenshots: `/home/ybc/notes-legacy-review-artifacts/executor-*`,
`pcd-executor-types*`, `static-test.json`, `font-test.json`, `browser-http-test.json`.

## Sources and remaining work

Local `[Lab Notes] Task-Oriented Programming in Java.txt`, slides 23–31, under
`/home/ybc/content/exams/Programmazione Concorrente e Distribuita (PCD)/slides-text/`.
The slide source repeats the missing prime update; it is not silently treated as
authoritative executable code. API evidence checked against Java 17:
[ExecutorService](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/ExecutorService.html),
[Future](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/Future.html),
[Thread](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/lang/Thread.html).

The subsequent [Swing revision](SWING.md) handles sections 12–14, including their
EDT claims, partial GUI examples, annotations and related quiz answer.
The later [Java basics revision](JAVA-BASICS.md) corrects the thread/lock
introduction, bounded counter and several quiz absolutes; the later
[barrier/latch revision](BARRIERS.md) handles section 7. The later
[Fork-Join revision](FORKJOIN.md) completes sum and merge sort. Physics and
version-specific structured-concurrency material remain outside these
checkpoints; passing widget clicks do not certify them.
At this executor checkpoint the inventory was 315 pages/994 figure elements, with 96 raw Mermaid
blocks remaining across 27 pages; neither count establishes content correctness.
