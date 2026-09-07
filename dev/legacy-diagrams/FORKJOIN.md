# Fork-Join: complete algorithms and dependency diagram

Preview: `http://localhost:8787/pcd/cap-08-java.html#s16`.
Production is unchanged. This revision covers the Fork-Join portion, not the
subsequent version-specific StructuredTaskScope example or the physics section.

## Corrections and sources

- Removed the claim that data topology must be unknown beforehand and that
  work-stealing occurs only at join or guarantees full utilization/speedup.
- Distinguished recursive divide-and-conquer from MapReduce and distributed
  processing. Explained scheduled fork versus direct compute, completion join,
  independent mutable ranges and normal-path versus failure cleanup.
- Replaced the incomplete sum/merge-sort fragments with three downloadable,
  compilable Java 17 sources. The merge implementation, constructors, threshold,
  validation and owned-pool lifecycle are present, not left as placeholders.
- Added a native dependency graph using the shared Mermaid adapter, original
  embedded font, palette and angular arrows. Six nodes and six directed edges;
  the scheduling edge is dashed. Left/right placement matches task names.
  No coordinates in the source, paid generation or browser Mermaid runtime.

Primary references:
[Java 17 ForkJoinPool](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/ForkJoinPool.html)
and [ForkJoinTask](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/ForkJoinTask.html).
Local slides: `/home/ybc/content/exams/Programmazione Concorrente e Distribuita (PCD)/slides-text/[Lab Notes] Task-Oriented Programming in Java.txt`,
slides 35–37. These slides motivate task hierarchies and work-stealing; the array
algorithms are editorial examples, not a verbatim copy of their word-count demo.

## Verification

```sh
NOTES_JDK=/path/to/jdk17 node dev/legacy-diagrams/forkjoin-java-test.cjs
node dev/legacy-diagrams/forkjoin-content.cjs --check
node dev/legacy-diagrams/forkjoin-browser-test.cjs
node dev/legacy-diagrams/test.cjs
node dev/legacy-diagrams/build.cjs --check
node dev/legacy-diagrams/executor-browser-test.cjs
node dev/legacy-diagrams/font-test.cjs
NOTES_PREVIEW_URL=http://127.0.0.1:8787/ node dev/legacy-diagrams/browser-test.cjs
```

Java compilation uses `-Xlint:all -Werror`; the harness uses actual pool workers
with parallelism 1, 2 and 4. 1,206 cases / 3,636 checks cover independent sequential
sum and sort oracles, empty/singleton/random/ordered/reversed/duplicate/extreme
inputs, subranges and untouched outer elements, multiple leaf thresholds,
invalid arguments, independent concurrent roots and owned-pool termination.
Threshold 1 exercises the recursive merge rather than merely Arrays.sort leaves.
The executed main prints sum 40 and `[1, 2, 3, 4, 6, 7, 8, 9]`.

Browser checks cover 1280/390 px, JavaScript enabled/disabled, HTML5 parsing,
unique IDs, no escaped SVG nodes, exact visible/downloadable canonical sources,
keyboard details/scroll and image loading. Shared tests check graph completeness,
XML, bounds, text overlap, determinism, original embedded font and chapter drift.
Existing executor tests exercise the chapter's widgets rather than assuming that
successful image loading proves widget behavior. Screenshots are inspected too.
Artifacts are under `/home/ybc/notes-legacy-review-artifacts/forkjoin-*` and
`pcd-forkjoin-dependencies-*`; these are test evidence, not public image assets.

## Limits

No timing/speedup guarantee, exhaustive scheduler proof, injected failure or
cancellation coverage. Input ownership is a caller precondition; independently
sorting overlapping ranges on the same array is not supported. The scratch
buffer is O(original array length), including when sorting a small subrange.
This is not a general structured-concurrency implementation: an exception in
right.compute can skip left.join. The main requests shutdown in finally but its
subsequent awaitTermination is reached only on the normal path. The diagram
represents successful data dependencies, not guaranteed worker scheduling.
The later [structured-concurrency revision](STRUCTURED.md) verifies the historical
JDK20 API and lifecycle example. Physics and the rest of the site's visual and
scientific review remain open.
