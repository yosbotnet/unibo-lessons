# PCD9: complete Dekker/Peterson models and real checker results

Preview: `http://localhost:8787/pcd/cap-09-verifica.html#dekker-model` and
`#peterson-model`. Production remains at `f0f4bde`.

## Confirmed defects

The first Dekker fragment showed only P and assigned/awaited the same turn value
inside the contention branch. Another declared P/Q but never instantiated them,
with an implicitly zero turn inconsistent with its 1/2 IDs. A third was only P.
The complete-looking old fragment from commit `4f26c59` was actually given to
SPIN: it fails with `no runable process`. Missing startup is not successful safety.

Peterson lacked a TLA+ module, an algorithm comment wrapper, a definition of Not,
the generated program counter and executable configuration. It used lowercase
booleans and Java highlighting. The unexecuted assertion of 146 reachable states
was presented as an algorithm fact. The theorem-looking fragment was not a proof.
Repeated JPF tabs still claimed no abstraction or unconditional exploration of
every path; these were brought into agreement with the earlier JPF correction.

## Original sources visually checked

The actual PDF is present but ignored by normal `rg --files`; use `--no-ignore`:
`/home/ybc/content/exams/Programmazione Concorrente e Distribuita (PCD)/[module-1.2] Modeling Concurrent Program Execution.pdf`.
Its 85 pages were identified with pdfinfo. Pages 77 and 84 were rendered and
visually inspected, not merely searched in extracted text. Screenshots are in
`/home/ybc/notes-legacy-review-artifacts/original-{dekker,peterson}-slide.png`.

Slide 77 gives P, a schematic Q and an init block, with IDs 1/2. The editorial
source uses two active instances and IDs 0/1, expands both processes through
me/other parameters, and preserves flag withdrawal, awaiting turn, reassertion
and handoff. A three-step in_cs observer checks critical-section overlap without
making the entry protocol atomic. Extra observer/control steps mean this is a
documented model, not byte-for-byte transcription or a universal state count.
The shipped upstream `Examples/peterson.pml` was also inspected for SPIN's
active-process/critical-counter idiom, not misidentified as Dekker's protocol.

Slide 84 supplies Peterson's seven labels and the two separate reads of flag and
turn. These are preserved, including a0/a1 and the split a3a/a3b tests. The PDF
text extraction contains cropped paper material mentioning 146 states, but that
number is not visible in the rendered slide. The page therefore attributes it to
the previous chapter text, not to a visually confirmed figure or a universal fact.
The 58-state result here is independently checked; no claim is made to reproduce
the original paper's toolchain/count or to explain its discrepancy conclusively.

Primary references inspected and linked:

- [PROMELA manual](https://spinroot.com/spin/Man/Manual.html): process startup, executability and atomic statements.
- [SPIN verifier options](https://spinroot.com/spin/Man/Pan.html): separate claims, fairness, depth/memory, full-state versus bitstate storage.
- [PlusCal C manual](https://lamport.azurewebsites.net/tla/c-manual.pdf): labels, translation and algorithm embedding.
- [Lamport's mutual-exclusion tutorial](https://lamport.azurewebsites.net/tla/tutorial/session8.html): algorithm/implementation distinction and memory-model warning.
- [TLA+ tools 1.7.4](https://github.com/tlaplus/tlaplus/releases/tag/v1.7.4).

## Toolchain, provenance and limits

Temporary tools root `/tmp/notes-formal-zU3AGZ`:

- Official `nimble-code/Spin` checkout at `090f74209025a53297990ec17deca1bd51cb92a5`;
  its shipped `Bin/spin651_linux64.gz` was decompressed, yielding SPIN 6.5.1.
  Binary SHA-256 `21bedb934fa0a70badb9b9f713b2bae8a72d3d5ec41c623cf23e9bbee51b3419`.
  SPIN itself was not rebuilt; GCC 14.2.0 compiled its generated verifier C.
- `tla2tools.jar` from official release v1.7.4, 2,274,532 bytes, PlusCal translator
  1.11/TLC 2.19 rev 5a47802. SHA-1 matches the release notes:
  `bee4a54f3ee3d4afc347c3240ec2d9e93b075104`.
  Recorded SHA-256 `936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88`.
  These are integrity/provenance records, not an independent signature check.
- Existing portable OpenJDK 11.0.32.1 at
  `/tmp/notes-jpf-mzANAh/jdk-11.0.32.1+1`; no system JVM, package or service changed.

SPIN uses full-state storage, no bitstate/hash-compact mode and no partial-order
reduction; memory is capped at 256 MB, depth 100000 except the negative bound.
Safety compilation disables claims/cycle checks but retains assertions and invalid
end-state checks. The two liveness runs select claims separately with weak process
fairness. They do not replace the safety/end-state run or promise strong fairness
for arbitrary branches. Active PID assumptions are specific to these two instances.

TLC uses one worker, fp polynomial 0, seed 1, 512 MB heap and no state constraints
or symmetry reduction. Its fingerprints are supplemented here by an independent
exact enumeration of all reachable states. That does not remove fingerprint caveats
for arbitrary larger models. The harness uses ParallelGC; the actual displayed
commands were also run without that option and emitted TLC's performance warning.
It is not suppressed or described as a semantic failure. Full upstream suites and
TLAPS theorem proving were not run.

## Canonical models and evidence

`pcd/assets/examples/` contains Dekker.pml, Peterson.tla and three Peterson .cfg
files. The PlusCal translator is run on fresh temporary copies, with `-nocfg`;
the downloadable source is the editable pre-translation module. The generated
TLA+ is inspected in the test directory, not hand-written in the repository.
`formal-results.json` records actual checker results, versions and exact hashes
of all five sources/configurations. HTML source blocks, outcomes and the mutant
trace table are generated from these records by `formal-content.cjs`.

The runner completes eleven configured scenarios:

- SPIN safety: complete, 204 stored states;
- SPIN response_p and response_q under weak process fairness: complete, 332
  stored states each (claim-product state counts);
- SPIN response_p without fairness: real acceptance-cycle counterexample;
- SPIN depth 2: zero observed errors but an explicit depth limit, inconclusive;
- SPIN mutant skipping the entry protocol: actual assertion violation;
- TLC safety and fair progress: complete, 117 generated/58 distinct states each;
- TLC progress without fairness: actual finite prefix plus stuttering forever;
- TLC mutant `turn := self`: ten reported states ending with both PCs at cs;
- TLC missing Not definition: semantic failure, no verification success.

The prior missing-startup fragment is a separate rejection control. Error trails
are replayed with actual SPIN. All TLC mutant/unfair prefix transitions are checked
against the respective independent transition relation. The independent BFS
matches the entire dumped 58-state set, not merely cardinality, and finds no
mutual-exclusion violation. TLC's dump appends `.dump` to the requested filename;
an initial harness failure exposed this and the reader was corrected accordingly.

Both displayed command blocks were executed in isolated temporary directories,
using child-only PATH aliases for the pinned tools. This adds three SPIN and three
TLC command checks; the final TLC command intentionally exits nonzero after finding
the unfair-progress counterexample. No result is inferred just from exit status.
Partial counts after counterexamples/bounds are labeled as observed, not complete.
Detailed command logs are `formal-*.log` in the artifact directory.

## Reproduce and browser verification

```sh
NOTES_SPIN=/path/to/spin651 NOTES_TLA_JAR=/path/to/tla2tools.jar NOTES_JAVA=/path/to/java11 node dev/legacy-diagrams/formal-model-test.cjs
node dev/legacy-diagrams/formal-content.cjs --check
node dev/legacy-diagrams/formal-browser-test.cjs
node dev/legacy-diagrams/jpf-browser-test.cjs
node dev/legacy-diagrams/ltl-browser-test.cjs
node dev/legacy-diagrams/build.cjs --check
NOTES_PREVIEW_URL=http://127.0.0.1:8787/ node dev/legacy-diagrams/browser-test.cjs
```

Use `formal-model-test.cjs --patch` and apply_patch only for a deliberate evidence
update; then regenerate chapter content via the patch emitted by formal-content.
No source/evidence drift is silently accepted in normal checks.

Four 1280/390 px, JS/no-JS views verify HTML5 parsing/unique IDs, exact source and
download identity, native disclosure/keyboard access, all eleven recorded outcome
rows and ten mutant states, and no page overflow. Actual sources, command blocks,
tables and mobile scrolling were visually inspected. Existing four tab groups,
eight quizzes and both JPF/LTL native diagrams pass their specialized regressions.
No new raster or additional diagram was needed: code stays code, state data uses
real HTML tables and the two existing native figures remain intact.

## Remaining work

This does not certify PCD9 or the whole site. Fault/error/failure terminology,
historical NASA/Intel claims, combinatorial examples and a more concrete inductive
proof still need review. The full-site visual/content goal remains open. Production
and the two preexisting root review files are untouched; no paid generation,
deployment or unrelated service restart occurred.
