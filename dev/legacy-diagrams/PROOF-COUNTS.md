# PCD9: inductive proof, schedule counts and terminology

Preview: `http://localhost:8787/pcd/cap-09-verifica.html#even-counter`,
`#schedule-counts`, `#fault-error-failure` and `#formal-history`.
This checkpoint changes explanatory content and native HTML tables, not the
existing JPF/LTL SVGs, palette, fonts or diagram renderer. No raster was needed.

## Confirmed corrections

- Fault/error/failure was reversed and conflated a human mistake with an erroneous
  system state. The chapter now distinguishes cause, state and delivered service,
  explains dormant/masked faults/errors and declares the counter-service boundary.
- Repeated claims that NASA first adopted formal methods after the 1999 Mars Polar
  Lander incident conflict with its July 1995 guidebook. The historical table uses
  dated primary evidence for NASA, Intel and AWS, without claiming first adoption
  or identifying every industrial verification with SPIN.
- The counts 70 and 34,650 were correct only under unstated restrictions. The new
  formula counts fixed finite order-preserving interleavings, not distinct states
  or equiprobable executions. Additional dependencies and control flow matter.
- Induction lacked a concrete example and confused a state predicate with its
  temporal invariant. The chapter now gives Init, Next, a strengthening Inv,
  all three obligations and an algebraic argument for an unbounded parameter.
- Quiz answers no longer generalize ArrayList's lack of synchronization to all
  Java classes or claim thread safety for arbitrary client compositions. Lock
  acquisition/release and immutable-alias caveats follow Java's documented contracts.

## Original slides and primary sources

Original local PDF: `/home/ybc/content/exams/Programmazione Concorrente e Distribuita (PCD)/[module-1.2] Modeling Concurrent Program Execution.pdf`.
The scenario tables on pp. 12 and 15 give 70 and 34,650; p. 73 contains the historical
shortcut, and p. 80 gives induction's base and step. Page 80 was rendered and
visually inspected (`original-induction-slide.png` in the artifacts directory).
The counter/SMT example is
explicitly an editorial addition, not a transcription or proof of Peterson.

- [Avizienis, Laprie, Randell and Landwehr, 2004, §2.2](https://www.landwehr.org/2004-aviz-laprie-randell.pdf): author-hosted dependability taxonomy.
- [NASA guidebook, Volume 1](https://ntrs.nasa.gov/citations/19980228002): NASA-GB-002-95/VOL1, publication July 1, 1995. The document ID's 1998 and archive acquisition date are not publication dates.
- [Intel Technology Journal, Q1 1999](https://www.intel.com/content/dam/www/public/us/en/documents/research/1999-vol03-iss-1-intel-technology-journal.pdf): O'Leary et al., *Formally Verifying IEEE Compliance of Floating-Point Hardware*. Its abstract/introduction describe Pentium Pro arithmetic verification and prior work; no assertion of first adoption in 1994 is inferred.
- [AWS authors' 2015 paper, abridged copy](https://lamport.azurewebsites.net/tla/amazon-excerpt.html): since-2011 design verification and the explicit design/implementation distinction.
- [Lamport, Specifying Systems, chapter 5](https://lamport.azurewebsites.net/tla/book-02-08-08.pdf) and [official Z3 guide](https://microsoft.github.io/z3guide/docs/logic/intro/).
- Java 17 [ArrayList](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/ArrayList.html), [synchronizedList](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/Collections.html#synchronizedList(java.util.List)), [ReentrantLock](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/locks/ReentrantLock.html), and [immutable objects tutorial](https://docs.oracle.com/javase/tutorial/essential/concurrency/immutable.html).

The author/Intel PDFs were downloaded for local text inspection to
`/tmp/notes-proof-mvqOdF/{dependability,intel1999}.pdf`. Their SHA-256 values are
`a6c1b102988b4abd5b1a1fc299cc73eeb8147b210a9e721a6111986a3fed6050` and
`65a461af7650a0945acfa72e362f39de8a93f34d9f480d850f14b3629d3a9f02`.
No original third-party PDFs were copied into the site.

## Actual solver and independent tests

`pcd/assets/examples/EvenCounter.smt2` uses mathematical integers and any even
n ≥ 0, fixed across a step. Init is x=0; Next adds 2 below n and otherwise
stutters. Safe excludes n+1; Inv strengthens it with parity and 0≤x≤n.

The actual Z3 4.13.3 invocation returns:

| Negated obligation/control | Result | Witness |
| --- | --- | --- |
| Init ∧ ¬Inv | unsat | none |
| Inv ∧ Next ∧ ¬Inv′ | unsat | none |
| Inv ∧ ¬Safe | unsat | none |
| Safe alone is not inductive | sat | n=10, x=9, x′=11 |
| Mutant adds 3 instead of 2 | sat | n=2, x=0, x′=3 |

The first witness starts in an unreachable state and does not refute the correct
program's safety. The mutant starts at Init and actually violates Safe. The three
unsat checks cover symbolic n, not a finite enumeration. We did not run TLAPS or
prove Peterson/Dekker deductively. A solver result is evidence under its arithmetic
semantics and trusted implementation, not an independently checked proof certificate.
Machine integer overflow and refinement to production code are outside this model.

Tool provenance: `apt-get download z3=4.13.3-1` from the configured Debian Trixie
repository, followed by extraction with `dpkg-deb -x` into a temporary directory.
No package was installed and apt sources/system services were not changed.

- Debian archive: 8,566,180 bytes; SHA-256 matches repository metadata:
  `4330fbffdcb23b708fa3008cde5ba00f63fe0a75bd67ac469ce16f2bd4213a1d`.
- Extracted executable: `/tmp/notes-proof-mvqOdF/extracted/usr/bin/z3`;
  SHA-256 `c28f5598836fe6312ed4b25a98525fb58e2800d4c4f8117a1daeb04e6327686c`.
- Runner requires version 4.13.3, sets solver timeout 10s and process timeout 15s,
  rejects errors, unexpected answers and mismatched witnesses. It executes the
  same `-T:10 EvenCounter.smt2` command shown in the page.

Supplementary independent JavaScript checks exercise 5,151 invariant-preserving
transitions for even n from 0 through 200. A BigInt factorial formula is compared
with recursive enumeration of every schedule for lengths [2,2], [4,4], [2,2,2],
[4,4,4], [1,3,2], yielding 6, 70, 90, 34,650, 60. A separate traversal yields nine
distinct position-pair states for the six [2,2] paths; requiring P to finish before
Q starts leaves only PPQQ. These are finite test cases, not a theorem of the
enumerator for all lengths or an arbitrary concurrent program.

Canonical `proof-results.json` records source hash, actual full solver output,
witnesses and supplementary counts. `proof-content.cjs` guards the hash and emits
absolute-path patches for source/output disclosures, evidence and count tables.
This follows the existing build-time content pipeline; it adds no browser solver,
external runtime dependency or hand-maintained duplicated source listing.

```sh
NOTES_Z3=/path/to/z3-4.13.3 node dev/legacy-diagrams/proof-count-test.cjs
node dev/legacy-diagrams/proof-content.cjs --check
node dev/legacy-diagrams/proof-browser-test.cjs
```

When deliberately changing the model, use the test runner's `--patch`, review and
apply its evidence patch, then review/apply `proof-content.cjs` output. Normal
checks fail on source/evidence/chapter drift and never rewrite the chapter.

## Rendering and remaining scope

Specialized browser checks cover 1280, 390 and 320 px, each with/without JavaScript:
HTML5 parsing, duplicate IDs, exact downloadable SMT/output, five new table layouts,
text containment in cells, recorded values, keyboard disclosures and scrolling,
all four tab groups and eight quiz answers, page overflow and runtime errors.
The initial 320px no-JS check exposed unwrapped old/new tables. Chapter-local
static scroll regions fix that without changing text size or hiding overflow;
the shared runtime enhancement is not needed to keep this chapter usable.

All six specialized views passed, as did the existing JPF/LTL four-view suites
and the formal-model source/results/trace browser regression. The quiz smoke
test now checks every paragraph of an answer rather than assuming exactly one.
The shared renderer check reports 37 in-sync figures and no stale SVGs; XML,
geometry, determinism and exact embedded-font checks pass for their scoped assets.
The broader regression passed 22 desktop/mobile page visits and 11 no-JS pages.
The full-site inventory remains 315 HTML pages and 1,001 figure elements; this
checkpoint added tables/code, not new figure elements. That inventory is not a
claim that all 315 pages or 1,001 figures have been visually/scientifically approved.

Artifacts are under `/home/ybc/notes-legacy-review-artifacts/proof-*`.
This closes the listed terminology/count/induction/history findings, not the
full-site goal. Labactivity03/Docker validation remains subject to the limits in
JPF.md. Other chapters, remaining graphs and their scientific claims still need
their own evidence-backed review. No paid image generation, publication or service
restart; production and preexisting root review files remain untouched.
