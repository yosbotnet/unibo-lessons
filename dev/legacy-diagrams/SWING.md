# PCD8: GUI responsiveness, state ownership and complete examples

Preview: [blocked EDT](../../pcd/cap-08-java.html#s12),
[worker-to-view publication](../../pcd/cap-08-java.html#s13),
[keyboard and timer](../../pcd/cap-08-java.html#s14).
This is a preview revision, not a whole-site completion or production deployment.

## Confirmed defects and scope of the correction

The chapter and annotated-code widget claimed setText queues the entire operation
to the EDT. The quiz repeated this. Real JLabel and JTextField tests show that the
state changes during the call on the EDT, before the enclosing event returns;
normal painting can remain deferred. A loop inside the listener prevents later
events from being served. Adding sleep does not make an EDT listener responsive.

The text also prohibited all controller/model work on the EDT. Local slides
explicitly distinguish short tasks from long ones and include EDT-confined Swing
models. The transcript's stronger wording is qualified rather than copied as a
universal rule. The loop fragment alone establishes unresponsiveness, not a data
race without additional incompatible concurrent accesses.

The purported complete solution lacked several declarations, synchronization,
repeat-Start handling, shutdown and checked-interruption handling. Its deferred
callback read live model state instead of a captured result. The keyboard example
constructed Swing on main and relied on a frame KeyListener, without a focus
strategy. These are replaced by complete, downloadable editorial examples, clearly
distinguished from the unavailable original lab Java source.

## Canonical examples

`StopwatchModel.java` is a short synchronized monitor with an immutable Snapshot.
Elapsed time uses nanoTime differences, not refresh counts. Start is idempotent
with respect to timing, Stop preserves elapsed time, and Reset preserves running
state while zeroing time. Each command increments the version to invalidate an
already queued refresh, including a repeated Start/Stop command. The injected
clock is a testable monotonic nanosecond source, not a wall-clock date.

`ConcurrentStopwatch.java` retains an active component but uses only one scheduled
worker for refresh. UI commands execute short model operations on the EDT. The
worker captures an immutable snapshot after a brief monitor access and posts a
callback outside the lock. The EDT rejects obsolete versions or callbacks after
close. An AtomicBoolean limits pending refreshes to one queued callback (a callback
already executing is no longer queued). This avoids unbounded accumulation of
periodic GUI updates, not arbitrary event-queue overload. Closing the actual
application window stops the sampler; awaitClosed explicitly rejects EDT callers.
Long computation and blocking I/O remain outside these deliberately short locks.

`SketchCounter.java` is an explicitly alternative architecture: a small model,
Swing Timer callbacks and actions are all EDT-confined. It counts delivered ticks,
not elapsed seconds. Buttons and window-level I/R key bindings invoke the same
actions; closing stops the timer and invalidates queued actions. This is not
presented as the original active-agent Sketch2 source or as a design for expensive
computation. It is independently compilable without the stopwatch files.

The seven-node/six-edge `pcd-swing-refresh` SVG uses `swing-sources.cjs` and the
shared angular renderer. No coordinates or bend points are authored. Its edges
follow the periodic publication path; the caption separately explains direct
command-driven updates. It preserves the original embedded font, ivory, cobalt
and vermilion. Native scroll, not font reduction, handles narrow screens.

## Verification and reproduction

```sh
NOTES_JDK=/path/to/jdk node dev/legacy-diagrams/swing-java-test.cjs
node dev/legacy-diagrams/swing-content.cjs --check
node dev/legacy-diagrams/swing-browser-test.cjs
node dev/legacy-diagrams/executor-browser-test.cjs
node dev/legacy-diagrams/build.cjs --check
node dev/legacy-diagrams/test.cjs
node dev/legacy-diagrams/font-test.cjs
NOTES_PREVIEW_URL=http://127.0.0.1:8787/ node dev/legacy-diagrams/browser-test.cjs
```

Java compilation uses `-Xlint:all -Werror` with isolated Temurin 17.0.20.1; no system
JDK installation. Each headless and Xvfb run performs 10,000 seeded model actions
with an independent elapsed-time oracle, including repeated starts/stops/resets;
an additional test crosses signed nanoTime wrap. More than 30,000 assertions per
run include actual EDT dispatch, JLabel/JTextField mutation, callback deferral,
monitor snapshots, stale-reset rejection, off-EDT control rejection, termination,
real scheduled refreshes and real Swing Timer delivery.

A counting EventQueue observes exactly one InvocationEvent posted for 1,000
refresh requests while the EDT is deliberately held by a bounded test latch.
This checks actual coalescing rather than inferring it merely from the final
display value. The latch is always released; this is test instrumentation, not
an application pattern. The stale callback is then discarded after Reset.

Under a temporary Xvfb display, Robot sends physical I/R keys with focus on a
button. Real Swing controls are tested and captured. Both actual main methods
also launch their windows, receive WINDOW_CLOSING and release their resources.
The Xvfb process exits with the test; no persistent site or other service changes.
The captured native-window image is a test artifact, not an AI image or site asset.

Four HTTP browser views (1280/390, JS on/off) verify HTML5, duplicate IDs, exact
canonical code/downloads, details visibility, keyboard scrolling, native SVG,
annotation/source equality and corrected explanations. The executor chapter suite
also passes all five annotations, tabs, quizzes and both serial/lost-update
stepper schedules. Visual inspection covers the native diagram, responsive chapter
screenshots and actual Java windows. The tests do not prove arbitrary scheduling
or certify unchanged scientific material by clicking its widgets.

Shared regressions: 32 native graphs pass XML, geometry, labels, deterministic
output and edge tests; 34 assets contain the exact original embedded font/license,
with actual font rasterization verified offline.
The shared HTTP suite also passes twenty desktop/mobile chapter visits and ten
no-JavaScript native-image loading visits.

Artifact directory:
`/home/ybc/notes-legacy-review-artifacts/`, especially `swing-java-test.json`,
`swing-browser-test.json`, `swing-java-windows.png`, `pcd-swing-refresh*`, `swing-s*`.

## Evidence and remaining work

Local `[Lab Notes] GUI Frameworks and Concurrency.txt`, slides 5–12, and the
`PCD-2026-03-20.md` transcript under
`/home/ybc/content/exams/Programmazione Concorrente e Distribuita (PCD)/`.
The original lab Java source was not found locally; the examples are editorial
reconstructions with explicit architecture differences, not attributed originals.
Primary API references:
[EDT tutorial](https://docs.oracle.com/javase/tutorial/uiswing/concurrency/dispatch.html),
[SwingUtilities Java 17](https://docs.oracle.com/en/java/javase/17/docs/api/java.desktop/javax/swing/SwingUtilities.html),
[Swing Timer Java 17](https://docs.oracle.com/en/java/javase/17/docs/api/java.desktop/javax/swing/Timer.html),
[key bindings tutorial](https://docs.oracle.com/javase/tutorial/uiswing/misc/keybinding.html).

The later [Java basics revision](JAVA-BASICS.md) handles introductory thread/lock
claims, BoundedCounter and several quiz absolutes. The chapter's physics example,
structured-concurrency/Fork-Join material still require review; the later
[barrier/latch revision](BARRIERS.md) handles section 7. At this Swing checkpoint the site-wide
inventory: 315 tracked HTML pages and 995 figure elements; 96 raw Mermaid blocks
remain across 27 pages. The original fifteen-course scope remains 208 chapters
and 882 figures. Counts and passing local tests are not a full-site certificate.
Production remains at f0f4bde and preexisting root review/report edits are preserved.
