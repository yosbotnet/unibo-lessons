# PCD8: actual cyclic generations and one-shot latch semantics

Preview: [section 7](../../pcd/cap-08-java.html#s7). Production remains unchanged.

## Original failure and correction

The old CyclicBarrierMonitor increments nArrived forever. After its first two-party
round, a lone new arrival returns immediately: a real Java regression fixture
reproduces this exact defect, not merely a static warning.

The canonical `CyclicBarrierMonitor.java` retains intrinsic synchronization but
tracks an object per generation. Each waiter keeps its own generation reference.
The last arrival replaces the current generation, resets remaining arrivals and
notifies waiters; a fast new-round arrival cannot erase old-round completion.
Constructor parties must be positive; await returns a unique arrival index.

The example explicitly implements a teaching subset, not the entire JDK API:
untimed await, broken-generation state and reset, without timeout or barrier
actions. Interruption of a still-active generation breaks it, notifies peers and
throws InterruptedException with cleared status. Peers/new callers fail with
BrokenBarrierException. If completion wins before a late interruption is handled,
the old await may return normally with the interrupt flag preserved; the fresh
generation is not accidentally broken. Reset invalidates existing waiters before
creating a fresh generation; participant recovery needs external coordination.
Monitor entry itself is not interruptible, unlike an explicit interruptible lock.

`CountDownLatchMonitor.java` validates nonnegative initial count, supports zero as
already open, never decrements below zero, and does not consume a count on await.
An interrupted waiter neither decrements nor breaks the latch for others. Entry
interruption is checked even when already open. Both classes use loops rather
than treating notification as satisfaction of the relevant condition.

Prose now distinguishes arrivals from identities, successful barrier completion
from exceptional departure, reusability from one-shot opening, notification from
simultaneous execution, and application success from blindly counting down. It
also distinguishes Object.notifyAll on a Condition's intrinsic monitor from
Condition.signalAll on the associated lock's wait queue.

## Diagram and executable evidence

The six-node/five-edge native `pcd-barrier-generations` SVG uses the shared renderer
with original font, ivory/cobalt/vermilion and straight routes. It portrays one
controlled scheduling, not all possible event orders or a message-passing graph:

1. A waits in g.
2. B completes g, publishing the new generation.
3. B waits in g+1 before A can reacquire the monitor.
4. A returns from g despite a nonzero new-round count.
5. A completes g+1.
6. B returns from g+1.

The test forces B's fast reentry by retaining an outer synchronized block around
both of B's await calls. Java wait releases all nested holds, allowing A to resume
when B waits again. Trace records are written under the same monitor and their
order is checked exactly. The browser additionally checks every SVG node label,
in order, against translations of the actual recorded trace.

`BarrierLatchTest.java` runs 200 generations for each of 1, 2, 3 and 5 participants,
checking no early successful return, unique arrival indices and published state
after the barrier. Generation-specific data avoids next-round overwrite ambiguity.
It covers interruption of one waiter and failure of its peer, persistent broken
state, reset of a waiting generation, successful reuse after reset, late interrupt
after completed generation, and pre-interrupted single-party entry.

Latch tests include two waiters, notification without opening, partial countdown,
all-waiter release at zero, 100 additional countdown/await operations while open,
interruption without changing count, open-but-pre-interrupted await and negative
construction. An explicit notification with a false condition is not claimed to
be an actual JVM-generated spurious wake.

The Java runner compiles with `-Xlint:all -Werror` on isolated Temurin 17.0.20.1 and
repeats the suite three times: over 14,000 assertions per run and 2,400 normal
generations across the repeated participant groups. These finite checks are not
an exhaustive scheduler proof or complete JDK compatibility certificate. Test
threads have bounded joins, failure capture and cleanup; daemon status is only a
failure guard. The original-bug fixture is not deployed as working example code.

## Reproduction and browser verification

```sh
NOTES_JDK=/path/to/jdk node dev/legacy-diagrams/barrier-java-test.cjs
node dev/legacy-diagrams/barrier-content.cjs --check
node dev/legacy-diagrams/barrier-browser-test.cjs
node dev/legacy-diagrams/executor-browser-test.cjs
node dev/legacy-diagrams/build.cjs --check
node dev/legacy-diagrams/test.cjs
node dev/legacy-diagrams/font-test.cjs
NOTES_PREVIEW_URL=http://127.0.0.1:8787/ node dev/legacy-diagrams/browser-test.cjs
```

`barrier-content.cjs` prints ordered patches from canonical source files. Code is
available through native details and download links without JavaScript. Four HTTP
views at 1280/390 with JS on/off verify byte-identical code/downloads, image and
trace labels, details, keyboard scrolling, HTML5 parsing, unique IDs, no escaped
SVG elements and no document overflow. Existing PCD8 widget tests verify tabs,
five annotations, quiz disclosure, and serial/lost-update stepper schedules.
Native figure, mobile chapter and source screenshots were visually inspected.

Shared regression: 34 SVGs pass geometry, labels, XML, deterministic rendering and
edge tests; 36 assets retain the exact embedded original font/license. Reports
from the shared HTTP suite also confirm twenty desktop/mobile page visits and
ten no-JavaScript image-loading visits. Current inventory: 315 tracked pages,
997 figure elements, and separately 96 raw Mermaid blocks across 27 pages.
Reports and screenshots: `/home/ybc/notes-legacy-review-artifacts/barrier-*`,
`pcd-barrier-generations*`, `static-test.json`, `font-test.json` and
`browser-http-test.json`. No image generation, paid call or production publication.

## Sources and remaining scope

Local `[Lab Notes] Thread Coordination in Java - Library Support.txt`, slides 13–15,
under `/home/ybc/content/exams/Programmazione Concorrente e Distribuita (PCD)/slides-text/`.
API references:
[CyclicBarrier Java 17](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/CyclicBarrier.html),
[CountDownLatch Java 17](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/CountDownLatch.html).

The later [Fork-Join revision](FORKJOIN.md) completes and tests the sum and merge
sort examples. Physics and version-specific structured concurrency remain open.
Site-wide inventory and earlier checkpoints do not prove all figures/content are
correct. The original fifteen-course scope remains 208 chapters and 882 figures;
the broader goal still covers all courses. Preexisting review/index and review/report
changes remain preserved and unstaged.
