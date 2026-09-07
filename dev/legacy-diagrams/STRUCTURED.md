# Structured concurrency: historical JDK 20 and real lifecycle evidence

Preview: `http://localhost:8787/pcd/cap-08-java.html#structured-concurrency`.
Production remains unchanged. No paid image generation or service changes.

## Scope and corrections

The original fragment matched the JDK 20 slide API but was incorrectly labeled
introduced in JDK 20 / usable on 20+. It lacked imports, response type, callees,
entry point and module/preview flags. Its join comment and orphan-task claim
conflated cancelled futures, join return and actual thread termination.

The chapter now explicitly teaches the historical **JDK 20 incubator** version:
`jdk.incubator.concurrent.StructuredTaskScope`, Future/resultNow. First incubation
was JDK 19; JDK 21 changed package and fork result type to Subtask in a preview API.
This is not an attempted cross-version compatibility shim or advice to deploy a
historical JDK. The downloadable `StructuredFetch20.java` is a complete canonical
program, with injectable local Callables so success and real failures can be tested.

Prose distinguishes shutdown, join, failure propagation and close; cooperative
cancellation is essential. close waits for contained threads even when interrupted,
and returns with interrupted status restored. A joinUntil timeout is not a hard
deadline for method exit. Independently launched threads/executor work, shared
state safety and reversal of external side effects are not automatically managed.

One native shared-renderer figure follows a real controlled failure trace. Seven
nodes/six arrows; the close-wait point is vermilion. It fits the 390 px mobile view
without shrinking fonts. No per-node coordinates, external fonts or runtime Mermaid.

## Reproduce

```sh
NOTES_JDK20=/path/to/jdk20 node dev/legacy-diagrams/structured-java-test.cjs
node dev/legacy-diagrams/structured-content.cjs --check
node dev/legacy-diagrams/structured-browser-test.cjs
node dev/legacy-diagrams/test.cjs
node dev/legacy-diagrams/build.cjs --check
node dev/legacy-diagrams/executor-browser-test.cjs
node dev/legacy-diagrams/font-test.cjs
NOTES_PREVIEW_URL=http://127.0.0.1:8787/ node dev/legacy-diagrams/browser-test.cjs
```

Compiler/runtime: Temurin 20.0.2+9, portable under
`/tmp/notes-jdk20-TZiVf8/jdk-20.0.2+9`; no system installation or production use.
Downloaded from the Adoptium API's release URL. Archive SHA-256
`3d91842e9c172967ac397076523249d05a82ead51b0006838f5f0315ad52222c`
matches the API checksum; this is not an independently verified signature.

Compilation enables the incubator module and preview. The harness allows only
the known incubator warning and two preview notes; other diagnostics fail.
It does not claim warning-free compilation. Negative checks reject missing
module during compilation and missing preview at runtime. The normal main prints
`Response[user=Ada, order=17]` without network requests.

Ten repetitions / 70 scenarios / 290 checks cover:

- canonical handle success, two actual virtual threads and child termination;
- failure on either side, original cause and cooperative sibling interruption;
- owner interruption and cleanup before that interruption reaches its caller;
- the canonical handle held in real close until a stubborn child is released;
- a direct API experiment in which join has returned and the slow Future is
  done/cancelled while its code is still active; close waits, then restores the
  owner's interrupted status after child exit;
- an expired joinUntil deadline, followed by the same controlled close wait.

Latches establish the interesting order. A bounded stack inspection confirms the
owner is inside the actual JDK close implementation before releasing the child;
mere absence of a completion message is not used as proof. Test finally blocks
release held children; subprocess deadlines and daemon test owners guard failures.
The observed failure trace is checked exactly and compared to SVG labels in the
browser. This is a finite controlled execution, not an exhaustive scheduler proof,
timing benchmark, general cancellation framework or proof of bounded cleanup time.

Browser checks cover 1280/390 px, JS on/off, HTML5 parsing, duplicate IDs, stray SVG
elements, exact code/download identity, module/preview command text, keyboard
details/scroll, native image and trace labels. Existing PCD8 widget regression is
separate. Native figure, chapter and source screenshots are visually inspected.
Artifacts: `/home/ybc/notes-legacy-review-artifacts/structured-*` and
`pcd-structured-close-*`.

## Sources and remaining work

Local slides `[Lab Notes] Task-Oriented Programming in Java.txt`, slides 38–40,
under `/home/ybc/content/exams/Programmazione Concorrente e Distribuita (PCD)/slides-text/`.

- [JDK 20 StructuredTaskScope](https://docs.oracle.com/en/java/javase/20/docs/api/jdk.incubator.concurrent/jdk/incubator/concurrent/StructuredTaskScope.html)
- [JDK 20 ShutdownOnFailure](https://docs.oracle.com/en/java/javase/20/docs/api/jdk.incubator.concurrent/jdk/incubator/concurrent/StructuredTaskScope.ShutdownOnFailure.html)
- [JDK 21 preview API](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/StructuredTaskScope.html)
- [JDK 20 release notes, second incubation](https://www.oracle.com/java/technologies/javase/20-relnote-issues.html)

No certification of later JDK revisions, custom scope policies, scoped-value
inheritance, nested-scope misuse, arbitrary external services or third-party
cancellation behavior. The physics section and the full-site visual/content
review remain open. Preexisting root review/index and review/report edits are
preserved and unstaged.
