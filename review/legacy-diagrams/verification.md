# Legacy diagrams and dependability — 7 September 2026

Preview only. Production remains at `f0f4bde`.

## Latest addition: PCD8 executor types and observable cancellation

Preview: [types and producer](../../pcd/cap-08-java.html#s10),
[executable cancellation comparison](../../pcd/cap-08-java.html#s11).

One native SVG replaces the ambiguous hierarchy and restores generic type labels;
no runtime Mermaid remains in this chapter. The prime producer now updates the
prime instead of emitting 2 forever. Downloadable Java sources and the comparison
table share canonical code/real execution, distinguishing cancelled Future,
task-body exit and executor termination. Shutdown, interruption, visibility and
poison-pill prose are corrected; three no-JS mobile table overflows are repaired.

Verified warning-free Java 17 compilation, 40 controlled executor scenarios and
20 producer/queue cancellation runs, four desktop/mobile/JS/no-JS chapter views,
exact code/downloads/table, five annotation widgets, quiz, tabs and lost-update
stepper. Native graph and chapter screenshots were visually inspected. Shared
regressions pass for 31 diagrams, 33 font assets, 20 desktop/mobile page visits
and ten no-JS image-loading visits. [Evidence and open issues](../../dev/legacy-diagrams/EXECUTORS.md).

Current inventory: 315 pages/994 figure elements, separately 96 raw Mermaid blocks
in 27 pages. The original 208-chapter/882-figure scope is unchanged. Further PCD8
content review and the full-site review remain open. Production and preexisting
root review/report edits are untouched.

## Latest addition: PCD7 monitors and compilable examples

Preview: [figures](../../pcd/cap-07-monitor.html#s2),
[intrinsic monitor examples](../../pcd/cap-07-monitor.html#s6),
[explicit-lock examples](../../pcd/cap-07-monitor.html#s8).

Two shared-renderer native SVGs distinguish components from ownership transitions.
The old curved queue-to-active arrow no longer implies automatic lock transfer
under signal-and-continue. Font and ivory/cobalt/vermilion are preserved.
Four downloadable Java classes replace incomplete or misleading embedded snippets;
the circular array remains. Static code and optional line annotations share one
source. The chapter no longer needs Mermaid in the reader's browser.

Verified compilation with warnings treated as errors on an isolated JDK 17,
plus 5,099 Java assertions covering FIFO, producer/consumer contention, two-reader
wakeup, interruption, reuse, nested monitor release/reentry and correct method
bytecode flags. Four desktop/mobile JS/no-JS views verify exact source/downloads,
annotations, tabs, quiz, markup and native SVG. A no-JS discipline-table overflow
was fixed with keyboard-scrollable HTML, not smaller text or hidden content.
All 30 shared native graphs and 32 embedded original-font assets pass their tests.
The shared browser suite also passes 18 visits across nine chapters at both widths,
plus nine no-JavaScript image-loading checks (complete rerun after a closed-page
failure in an unchanged PCD16 screenshot).
[Evidence and remaining verification limits](../../dev/legacy-diagrams/MONITORS.md).

Current static inventory: 315 pages/993 figure elements; separately, 97 raw
Mermaid blocks remain in 28 pages. The original 15-course scope is still
208 chapters/882 figures. These counts do not certify completeness. Production
and preexisting review/report edits remain untouched.

## Latest addition: PCD6 dining philosophers and deadlock scope

Preview: [executable model](../../pcd/cap-06-deadlock.html#s2),
[native wait-for graph and four traces](../../pcd/cap-06-deadlock.html#s3).

The original table illustration keeps its structure with larger mono labels off
the rim. The generated five-node/five-edge graph now uses consistent 0–4 indices
and actual resource-holder dependencies. The three-philosopher/five-fork stepper,
the falsely naive stepper with an already-reversed F4, and the local-state shortcut
to global deadlock have been replaced by one executable shared-state model.
All-forks-occupied is demonstrated both with and without deadlock.

Verified 22,348 reachable control/resource states and 93,332 transitions over
three protocols with N=2–5. Independent program-counter ownership/enablement and
transitive-closure cycle checks agree with the model. Each naive configuration
has a deadlock state; neither ticket nor ordered configuration does. No fairness
guarantee is inferred: a repeatable unfair schedule can starve a philosopher.

Four HTTP desktop/mobile/JS/no-JS views pass exact fixture-state, controls, tabs,
details, keyboard-scroll, parser, unique-ID, stray-SVG and overflow checks.
Native and chapter/widget/table screenshots were visually reviewed. Shared
regressions pass: 28 graphs, 30 original-font assets, 16 desktop/mobile page visits
and eight no-JS image-loading visits. [Evidence and limits](../../dev/legacy-diagrams/DINING.md).

Text now distinguishes ticket admission from simultaneous meals, potential from
actual circular waits, deadlock from starvation, and JVM live detection from
automatic recovery. The static Java examples remain readable without JavaScript.
The broad site review remains open; production and preexisting report edits are
untouched by this checkpoint.

Current source counts: 315 HTML pages and 992 figure elements. Separately, 98 raw
Mermaid blocks remain across 29 pages. The original fifteen-course scope still has
208 chapters/882 figures. Counts do not establish visual or scientific approval.

## Latest addition: PCD16 Raft commit and conflicting log prefixes

Preview: [section 20](../../pcd/cap-16-algoritmi-distribuiti.html#s20).

Replaced the last raw Mermaid block in the chapter with a seven-node/seven-edge
native SVG from the shared angular renderer. The current-term commit guard is
explicit. Figure-8-style log examples are generated as actual HTML tables from
bounded executable rules; the overwrite and safe-commit outcomes are alternatives,
not a single animation. The chapter distinguishes commit, application and reply,
corrects Paxos/Raft scope and historical claims, and removes the now-obsolete
Mermaid initialization so subsequent widgets keep running.

Verified 181,066 commit states against an independent quorum-order-statistic
oracle, 25 freshness comparisons, heartbeat/conflict/stale-term/idempotence cases
and invalid inputs. The chapter passes HTML5 parsing, unique-ID and stray-SVG
checks at 1280/390 px with JavaScript on and off. Exact results, detail controls,
all five section-20 tabs, native image loading and keyboard scrolling pass.
Native and chapter/table screenshots were inspected against the paper's Figure 8.
These bounded checks are not a complete protocol implementation or formal proof.

Shared regressions: 27 diagrams pass XML, geometry, text and deterministic-render
checks; 29 SVGs retain the actual original font/license; seven pages pass at both
widths, with tab/widget checks and no-JS image loading. Build and generated tables
have no drift. [Sources and detailed limits](../../dev/legacy-diagrams/RAFT-COMMIT.md).
Consistent-cut and Phase-King model/browser regressions also pass. The 20-case DL
preset suite retains all four approved SVGs byte-for-byte.

The source inventory is now 315 HTML pages/991 figure elements; the original
fifteen-course scope remains 208 chapters/882 figures. A current source count
finds 99 remaining raw Mermaid blocks across 30 pages. That count is not a new
visual audit or a claim that every remaining block is defective. Other graphs,
runtime widgets and scientific content remain in scope. Production was not changed.

## Latest addition: DS-C4 foundations and actual hash-chain evidence

Preview: [platform/architecture qualifications](../../ds/DS-C4.html#s2),
[real string hashes](../../ds/DS-C4.html#s3),
[native chain comparison and full traces](../../ds/DS-C4.html#s4).

The six-node/six-edge diagram comes from the shared angular renderer and real
SHA-256 results. It contrasts an original history with a coherent rewrite; HTML
tables additionally expose an edit-only history whose final hash still matches
but whose internal checks fail. All full JSON inputs and digests are downloadable.
The trusted checkpoint is explicitly an assumption, not security provided by
hosting two files on the same server. The former fabricated hash labels and
unconditional “immutable sequence” claim are gone. DS-C4 no longer loads Mermaid.

Verified:

- 590 mutation/checkpoint cases across 1–16 records, plus invalid inputs and two
  known SHA-256 vectors; 944 independent Chromium Web Crypto digest comparisons,
  including the actual displayed examples. These do not prove cryptographic
  hardness or constitute a consensus/security implementation.
- Desktop/mobile with and without JavaScript: full tables and all three detail
  controls, exact JSON download, image loading and keyboard scrolling. Narrow
  digest columns and no-JS table overflow found during review were corrected.
- Shared renderer: 26 figures, complete edges, XML, bounds, text collisions and
  determinism; 28 assets carry the exact original IBM Plex Mono font/license.
- General browser checks: seven pages at both widths plus no-JS image loading.
  Existing PBFT/ledger/PoW regressions pass; contract example/results remain
  synchronized and the complete chapter passes HTML5 parsing/duplicate-ID checks.

Sections 1–4, 5, 7 and quiz 1–2 now scope middleware guarantees, identity and
permissioned membership; distinguish timestamps from external event times;
correct the ITU architecture order; and date the IOTA example while separating
Hedera consensus from Block Streams. Local slide text and the actual architecture
PDF figure were compared with primary sources. [Evidence, scripts and limits](../../dev/legacy-diagrams/HASH-CHAIN.md).

The static inventory now counts 315 HTML pages and 990 figures; the original
fifteen-course scope stays 208 chapters/882 figures. Counts do not certify review.
Other courses, runtime diagrams and scientific content remain in scope.

A fresh remaining-runtime scan (`REPORT_NAME=audit-after-hash node
dev/legacy-diagrams/audit.cjs`) checked 100 Mermaid diagrams across 31 pages at
1280/390 px: no parser/render errors, invalid geometry or page-overflow flags.
These are in DS, PCD, PPS and the two cybersecurity versions. Passing this scan
does not approve their notation, scientific content, text placement or styling;
its screenshots are evidence for subsequent visual review, not automatic permission
to convert all of them. DS-C4 is no longer among those runtime-rendered pages.

## Latest addition: DS-C4 smart-contract execution and failure scope

Preview: [outcome diagram](../../ds/DS-C4.html#s13),
[compiled example and actual results](../../ds/DS-C4.html#s14),
[corrected constraints](../../ds/DS-C4.html#s15).

One shared-generator SVG separates success, top-level REVERT and out-of-gas,
storage/log retention or rollback, and the nonce/fee effects that remain. All
eight nodes and nine connections are checked, with original embedded font and
ivory/cobalt/vermilion palette. Native and chapter screenshots were inspected.
Measured values remain in a real HTML table, not tiny SVG labels.

The exact downloadable Counter source compiles on pinned Solidity 0.8.36/Cancun.
Five signed transactions execute in an offline EthereumJS VM: zero increments,
three increments from another caller, partial work followed by out-of-gas, child
REVERT propagated, and child REVERT caught. Checks cover state, event contents,
caller identity, nonce, charged gas, fee recipient component and rollback. A
wrong-nonce transaction is rejected without a fee or execution. Observational
getter probes leave no state changes. This is not a security audit or live-chain
deployment. Compiler dependency audit: zero reported vulnerabilities after the
documented tmp override.

Additional verified evidence:

- HTML5 parsing without errors; no duplicate IDs or escaped SVG shape elements.
- Exact rendered source, downloaded source bytes and five EVM-derived table rows.
- Four HTTP views: 1280/390 px, with and without JS; code, figure and table remain
  readable and keyboard-scrollable; all nine relevant tabs switch correctly.
- Shared renderer: 25 diagrams pass XML, text bounds/collisions, determinism and
  edge completeness; 27 SVG assets carry the exact original font and license.
- General HTTP smoke: 14 desktop/mobile visits across seven pages plus no-JS
  image loading; chapter widgets and tabs continue to work.
- Ledger/PoW regression: 8,586 independent SHA-256 comparisons, fork transitions,
  stop/reset/difficulty handling and no-JS traces. PBFT regression: 1,000 reordered
  schedules/74,000 messages, quorum checks and both desktop/mobile widgets.
- DL regression: 20 preset cases, four approved SVGs still byte-identical.
- Source/asset drift checks and `git diff --check` pass.

The generation taxonomy is explicitly informal; broad claims about immutable
behavior, impossible privacy/randomness, universal sequential implementation and
trustworthy sensor data have been replaced with scoped explanations. The code
and gas sections distinguish historical slide notation from the tested fixture.
[Detailed sources and limits](../../dev/contracts/README.md).

Open: DS-C4 earlier identity/membership and hash/timestamp claims, platform examples,
quiz 1–2 and the remaining runtime hash-chain diagram. The full site is still not
certified; inventory is 315 HTML pages and 989 figure elements, excluding runtime
figures from that static count. Original fifteen-course scope remains 208/882.

## Latest addition: DS-C4 fork structure and actual toy hash trials

Preview: [fork diagram and arrivals](../../ds/DS-C4.html#s7),
[hash-trial diagram and experiment](../../ds/DS-C4.html#s10).

Two native SVGs replace the unconnected chain cards and misleading mining-progress
presentation. The fork's edges and selected/stale branch are generated from the
same parent-linked ledger used by the UI and static trace. The second diagram
shows a hash trial, target check, retry and successful link without suggesting
percentage progress. Both preserve the ivory/cobalt/vermilion style and original
embedded font. Native and desktop/mobile images were visually inspected.

The ledger excludes the invalid Eve transfer before constructing B2, then derives
both fork states from B2 independently. Receiving B3B at equal work retains B3A
in this example; receiving B4 detaches B3A and attaches B3B/B4. Final balances are
15, 7, 4, 1.5, conserving 27.5 toy units. Block labels are no longer fake hashes.
All discovered blocks have keyboard-operable inspection buttons with a visible
selected state. The inspected block and active tip have separately labelled
balances. The full final tree is distinguished from partial arrival states.

The hashing experiment computes SHA-256 over each displayed UTF-8 JSON input.
Four toy miners receive 7/6/5/2 of each 20 serial attempts; this is a work allocation,
not parallel timing or a guarantee about the winners. Failed trials never fill
a bar. Successful digests link the next toy block. Stop/Reset/difficulty changes
retire pending work safely; a 50,000-trial cap and crypto errors are explicit.
The section clearly separates this experiment from actual Bitcoin mining.

Verified:

- Every branch replay, rejected transfer, supply invariant, equal-work tie and
  exact detach/attach set; an abstract unequal-work fixture selects work over
  height. Invalid block/transfer input is rejected.
- 8,586 real trials at 4/8/12 toy difficulty bits, checked with an independent
  Node SHA-256 implementation: exact serialized inputs, unique nonce candidates,
  target decisions, next-parent digests and per-miner counts. Target boundary
  tests cover bits 1–12. Concurrent model steps are rejected and snapshots isolate
  in-flight work.
- Desktop/mobile: all six arrivals and all known-block controls, one-hash and
  five-block operations, exact browser digests/counters, Stop→start and Reset
  during in-flight work, difficulty changes, keyboard activation/focus/scroll.
  The default five-block fixture takes 101 recorded trials.
- A separate injected nonwinning digest reaches the exact 50,000-trial cap and
  reports an unfinished batch. An injected crypto rejection releases controls
  and reports its error. Neither injected test is counted as actual SHA-256 work.
- Six arrival rows, six block details and 44 actual hash-trace rows remain available
  without JavaScript. Native images are visible without JS, not merely downloaded.
- 24 native diagrams pass XML, geometry, bounds, text collision, exact graph counts,
  determinism and invalid-input checks; every fork parent edge is checked.
  26 assets contain the original font and license. Generated chapter/assets and
  both traces pass drift checks.
- Fourteen HTTP desktop/mobile visits and seven no-JS figure pages pass. The PBFT
  1,000-schedule suite and transfer fixture also pass after retiring the old scripts.
- All 20 DL preset cases pass; the four approved original SVGs remain byte-identical.

The initial trace-generator invocation caught a syntax typo before generation;
it was corrected and the generator/rerun succeeded. No failed run is counted as
passing. Source/slide evidence and limitations are in the
[adapter README](../../dev/legacy-diagrams/README.md).
Detailed evidence is `ledger-test.json`, `static-test.json`, `font-test.json`,
`browser-http-test.json`, `pbft-test.json` and the corresponding `fork-*`, `pow-*`,
`ledger-*`, `ds-ledger-fork*` and `ds-pow-trial*` screenshots in
`/home/ybc/notes-legacy-review-artifacts/`.

The inventory now counts 315 pages and 988 figure elements; counts do not establish
approval. DS-C4's smart-contract/platform generalizations and the broader site's
visual/semantic review remain open. Production and preexisting review-file edits
are untouched.

## Previous addition: DS-C4 PBFT evidence and consensus explanations

Preview: [PBFT diagram and message model](../../ds/DS-C4.html#s9),
[quorum assumptions](../../ds/DS-C4.html#s6),
[transfer fixture](../../ds/DS-C4.html#s8),
[corrected confirmation calculation](../../ds/DS-C4.html#s11).

The old PBFT widget advanced every replica through scripted phases and used the
wrong PREPARE threshold. Its replacement delivers real queued messages and shows
separate local proposal, prepare and commit evidence. The native SVG distinguishes
the thresholds and execution prerequisites. Two conceptual state explorers, the
quorum derivation and related quiz answers were corrected alongside the model.
FLP is no longer an unconditional ban on successful asynchronous consensus.

Verified in this checkpoint:

- 1,000 reordered normal-case schedules across f=0–3 / N=3f+1, with 74,000 message
  deliveries. An independent oracle reconstructs local evidence from deliveries
  and checks prepared, execute and client-acceptance conditions after every step.
  Faulty backup votes include duplicates and wrong digest/view/slot. The explicit
  premature-commit case cannot execute without the required local evidence.
- 126,489 certificate-subset pairs over 1–10 replica identities verify the exact
  intersection lower bound. The N=5/f=1/Q=3 counterexample is distinguished from
  the N=4/f=1/Q=3 PBFT configuration.
- FIFO and reverse-queue UI schedules at 1280 and 390 px: exact local table cells,
  client acceptance threshold, pending messages, reset, keyboard activation and
  focus. Both conceptual maps' transitions and all chapter tabs are exercised.
- 23 model-generated PBFT trace rows and the native image remain available without
  JavaScript. Native and desktop/mobile screenshots were visually inspected,
  including a mixed state where one correct replica is prepared and others wait.
  Long labels and excessive initial vertical gaps were corrected without reducing
  the font; the final flowchart fits mobile width at native size.
- 22 static diagrams pass XML, geometry, text collision/bounds, expected nodes and
  edges, determinism and invalid-input tests. Chapter/asset and PBFT-trace drift
  checks pass. Font checks cover 24 native assets with the exact original font.
- 14 desktop/mobile HTTP visits pass; seven figure-bearing pages load images with
  JavaScript disabled. These broad checks exercise selected affected widgets,
  not every scientific or interactive claim in every chapter.
- The 20-case DL preset suite passes; its four approved SVGs remain byte-identical.
- Nakamoto approximation: 150 finite-form versus positive-tail comparisons pass.
  Printed z=6 values for q=.10 and q=.13 match the formula. The old ratio and
  99.999% confidence claim were incorrect; model assumptions and counting
  conventions are now explicit, with primary-source links.
- The transfer widget now completes without its out-of-scope-variable error.
  Two valid transfers and two rejected fixtures produce A=15, B=7, C=5, E=.5;
  repeated validation/reset is deterministic and the four static rows conserve
  the initial 27.5-unit total. The example no longer claims users may mint ETH.

Evidence: `pbft-test.json`, `static-test.json`, `font-test.json`,
`browser-http-test.json`, `pbft-*.png`, `ds-pbft-normal*.png` and
`ds-transfer-*.png` under `/home/ybc/notes-legacy-review-artifacts/`.
Implementation bounds, primary papers and original-slide comparisons are in the
[adapter README](../../dev/legacy-diagrams/README.md).

This does not complete DS-C4: its legacy mining animation is explicitly marked
unrepaired; the chain visualization has inconsistent balances and lacks useful
branch links; block-format assumptions and smart-contract claims remain to review.
The new PBFT model covers the normal case, not faulty-primary/view-change recovery.
The full-site inventory is now 315 pages / 986 figure elements, not a count of
approved figures. Production and the two preexisting review-file edits are untouched.

## Previous addition: CAP operation histories and proof diagrams

Preview: [DS-C1, interactive example](../../ds/DS-C1.html#s8),
[proof](../../ds/DS-C1.html#s12), [six traces](../../ds/DS-C1.html#s13).

Two native SVGs replace the triangle/old proof presentation: a read-policy
comparison and the indistinguishable-executions argument. They retain the shared
ivory/cobalt/vermilion style and embedded IBM Plex Mono. Labels, arrows and full
native canvases were visually inspected; mobile views scroll without shrinking
type. The original DS page skin is unchanged outside the figures.

The read/write simulator now judges operation histories, not cached-value
equality. Its six traces show no-write, stale-after-write, blocked authority read,
read-before-write and two overlapping-read cases. Healing cannot make an earlier
bad read disappear; an old value can be valid when the read overlaps the write.
The finite trace is not presented as a universal availability proof. The recovery
state explorer is explicitly a conceptual map, not an executable merge protocol
or an oracle that detects partitions.

Definitions, quiz, ACID/BASE discussion and unsupported product classifications
were corrected together. Official AWS sources were checked for the S3 and
DynamoDB examples. PCD16's CAP answer and DS-C4's CAP introduction now use the same
definitions and link to the model. Primary paper, slide evidence and implementation
limits are recorded in the [adapter README](../../dev/legacy-diagrams/README.md).

Verified in this checkpoint:

- 6,720 interval/value cases in both operation input orders, checked against an
  independent single-write temporal oracle; 688 exhaustive bounded action prefixes
  with up to four network changes. All authority histories are linearizable;
  73 local-policy prefixes violate it. Same G2 observations in the no-write and
  hidden-write traces are checked explicitly.
- Six exact interactive traces at 1280 and 390 px: every operation-table row,
  computed verdict, blocked delivery, policy reset, keyboard activation and focus.
  All ten traversed policy-map transitions work; all targets exist. All 24 static
  trace rows and both images remain available with JavaScript disabled.
- 21 SVGs pass XML, geometry, text-bounds/collision and deterministic-output tests;
  the two CAP diagrams have every expected directed edge. Seven invalid renderer
  inputs are rejected. Chapter/asset and trace-generation drift checks pass.
- 23 native assets contain the exact original font and license; Chromium glyph
  checks confirm the font, with no font-network dependency.
- 14 HTTP desktop/mobile page visits pass, including existing tab/widget checks;
  six figure-bearing pages load native images without JavaScript.
- All 20 specialized DL preset cases pass; the four approved original SVGs remain
  byte-identical.
- Native diagrams, desktop/mobile widget states (including the pending read),
  and static trace screenshots were inspected. A long table instruction was
  moved outside its horizontal scroll region after mobile inspection.

The first CAP browser-test attempt used an incomplete accessible button name for
the existing state-explorer control (which also includes its arrow and target).
That test timed out; its corrected selector and the full rerun passed. This was
not evidence of a broken transition. No failed test run is counted as passing.

Evidence: `cap-test.json`, `static-test.json`, `font-test.json`,
`browser-http-test.json` and `cap-*.png` / `ds-cap-*.png` in
`/home/ybc/notes-legacy-review-artifacts/`. Browser suites use pinned local copies
of external script dependencies and block unrelated remote requests.

The inventory now records 315 pages and 985 figure elements, not 985 approved
figures. The original 15-course scope remains 208 chapters / 882 figures. Broad
scientific and visual review remains open; DS-C4 still needs correction of its
BFT/FLP, finality and PoW-related claims. No production deployment was performed.

## Previous addition: phase king, consensus assumptions and literal formulas

Preview: [PCD16, section 19](../../pcd/cap-16-algoritmi-distribuiti.html#s19).
The new native flowchart separates the two communication rounds, candidate count,
strict threshold, king choice, phase loop and final decision. Verbose explanation
stays in the caption and chapter; neither font size nor the canvas is squeezed.

The previous text incorrectly applied N ≥ 3f+1 to a two-round variant requiring
N > 4f, and called f+1 phases f+1 rounds. It also left undefined values able to
escape the input domain. The chapter and model now explicitly use binary values,
one vote per identified sender, default 0, distinct kings, f+1 phases and
2(f+1) rounds. General Byzantine lower bounds are qualified by their unsigned
synchronous model rather than described as an approximate correct-node percentage.

The new round simulator and 22-row static traces show three executions. With N=5,
the first shows strong-validity preservation and the second reaches agreement
from split inputs. The N=4/f=1 example is deliberately marked outside the
variant's guarantee: three copies do not exceed threshold 3, and the Byzantine
second king produces correct decisions 0,1,1 despite a correct first king.

Tests exhaust 143,360 binary N=5 one-Byzantine schedules across all five possible
fault identities and all correct inputs, both exchange-round equivocations and
Byzantine-king equivocations. They also cover all 32 fault-free N=5 inputs and
1,000 seeded executions over 2–9 processes (3,150 rounds), including N=9/f=2.
The independent oracle reconstructs received vectors, candidates and choices
using integer threshold arithmetic in the seeded, fault-free and illustrated
runs; the exhaustive suite checks agreement, strong validity, completion and
binary decisions. The N=4 counterexample is tested separately
and is not included as a passing consensus execution. Invalid parameters, forged
correct-sender overrides, copied snapshots and post-decision actions are tested.

All three UI scenarios are exercised on desktop and mobile, checking every row
of each round, decision, reset and focus. All 22 static trace rows are available
with JavaScript disabled. Table columns are checked for text overflow and the
interactive table fits the desktop content column without shrinking fonts.
Horizontal keyboard scrolling handles mobile widths.
An attempted narrower static table initially failed the new cell-overflow test:
two long headers crossed their column boundaries. Shorter, explicitly explained
headers fixed this without reducing the font. The revised table and all cell
bounds pass. Native and desktop/mobile screenshots were visually inspected.

A visual check found a missing `>` in the first generated decision diamond:
Mermaid had dropped the raw operator despite passing geometry tests. The shared
adapter now encodes literal comparison signs in quoted labels while preserving
line breaks and graph arrows. Required-formula assertions and explicit operator
probes prevent this from silently recurring. The other reviewed SVG assets did
not change. All 19 flowcharts pass XML, bounds, text-collision, deterministic
output, node/edge completeness and invalid-input tests. All 21 standalone SVGs
retain the exact original embedded font and license, verified in browser pixels.

The text also separates origin validity, strong correct-input validity and
irrevocability, identifies the minimum-flooding counterexample to the stronger
claim, replaces indefinite receives with the synchronous round deadline, and
distinguishes message count from payload size. FLP now explicitly concerns
deterministic termination guarantees. Original slides 35–42 and the linked FLP,
Byzantine Generals and phase-king references were checked; the round model and
counterexample provide independent executable evidence for the key correction.

Evidence under `/home/ybc/notes-legacy-review-artifacts/`: `king-test.json`,
`king-*.png`, `pcd-phase-king.png`, `static-test.json`, `font-test.json` and
`browser-http-test.json` (12 desktop/mobile visits, 5 pages without JavaScript).
The consistent-cut regression also passes all 16 cuts and 19 conceptual snapshot
transitions. The 20-case native preset suite passes, with the four approved DL
SVGs unchanged byte-for-byte. Inventory: 315 pages and 983 figure elements, not a
certificate of correctness for the entire site.
Remaining: operational snapshot and crash-flooding traces, precise CAP/SMR review,
and the broader full-site audit. This checkpoint does not certify all course
content, and it does not publish the preview.

## Latest addition: consistent cuts and snapshot explanations

Preview: [PCD16, sections 14–16](../../pcd/cap-16-algoritmi-distribuiti.html#s14).
Three static figures now cover the event dependencies, a three-panel cut
comparison and two FIFO messages. This replaces two runtime Mermaid blocks and
one shrinking inline SVG, keeping the original embedded font and course palette.
The timelines retain identical event positions and message endpoints in all
panels; included/excluded events and the cut boundary have distinct notation.
The SVG generator also fixes a label crossed by its own arrow and a long legend
that escaped the original draft's viewBox. The new native SVG passes explicit
path/text intersection checks, not just text/text bounds checks.

The previous G1 paragraph both included and excluded e2 and did not describe
local prefixes. G2 listed both send and receive yet called the message in transit.
The new widget classifies the actual selected prefixes and records the exact
message status. An independent enumeration of 720 event permutations gives
10 legal executions; testing all 64 subsets yields 16 local-prefix cuts, of which
12 are consistent and 4 inconsistent. The three published examples match this
oracle. This is exhaustive for the six-event example, not all distributed systems.

The snapshot program example previously reversed two receives on a FIFO channel.
Its replacement preserves both send and receive order. Accompanying prose,
annotated pseudocode and review answers now include channel state, causal closure,
the open-channel recording interval, continued application processing and the
distinction between local completion and collecting global results. Original
module-4.2 slides 26–31 and [Chandy–Lamport §§2–4](https://lamport.azurewebsites.net/pubs/chandy.pdf)
were checked; the source's shorthand about concurrent local states is qualified.

Both existing snapshot state browsers are explicitly conceptual, not executable
channel models. The dead-end transition to an undefined RED state is repaired,
and open/closed-channel application receives are distinguished. A first marker
on the only input can complete the local snapshot without an impossible second
marker. All 19 actual
transition buttons, all 16 cut selections, all three preset buttons, focus and
horizontal keyboard scrolling pass at 1280 and 390 px. The figure and caption
remain readable with JavaScript disabled. Native images, mobile cut selection and
the state browser were visually inspected in the saved screenshots.

The renderer's two spacing fixtures pass deterministic output, XML, text bounds,
text overlap, path/text intersection, filled-event sets, matching coordinates,
orthogonal cut paths and complete message endpoints. All 18 general flowcharts
pass their structural/geometry tests. All 20 standalone SVG assets contain the
exact official font with its license; actual browser glyphs and rasterization
are verified. Existing centralized mutex, causal ordering, Chang–Roberts and
Ricart–Agrawala model/UI regressions also pass.
The 20-case native preset regression passes as well, preserving all four approved
DL SVGs byte-for-byte. The mobile cut figure was also inspected at its rightmost
scroll position to verify the receive events and boundary endpoints remain visible.

Evidence: `cut-test.json`, `cuts-*.png`, `se-cl-*.png`, `se-snapshot-*.png`,
`pcd-cut-events*.png`, `pcd-snapshot-fifo*.png`, `static-test.json` and
`font-test.json` in `/home/ybc/notes-legacy-review-artifacts/`.
One broader HTTP browser run terminated during an element screenshot with
“Target page, context or browser has been closed”; that run is not a pass and
its underlying cause is unconfirmed. Per-page diagnostics were added for retry;
the retry passed all 12 desktop/mobile HTTP visits and 5 JavaScript-disabled
pages, including all 18 static flowcharts and the existing tab/widget checks.
The final broad runtime audit (`audit-after-cuts.json`) completed all 64 visits:
101 remaining Mermaid diagrams in 32 pages, at both widths, with no render
failures, invalid geometry, page overflow or JavaScript errors. That automated
check does not establish scientific correctness or rule out all local overlaps.

Remaining: a real marker/channel simulator and snapshot trace, remaining PCD16
consensus claims and the full-site review. The refreshed inventory has 315 pages
and 982 figure elements; these counts do not certify correctness. Production and
the preexisting `review/index.html` / `review/report.md` modifications are untouched.

## Latest addition: centralized mutex and token conservation

Preview: [PCD16, sections 3–5](../../pcd/cap-16-algoritmi-distribuiti.html#s3).
Two diagrams now show the missing application-message causal bridge, the request
that waits for its predecessor, and the full token lifecycle. The second client
is not granted an unsolicited permission. The selected client is not implicitly
the most recent requester. Sources remain coordinate-free and use native SVG.

The old simulator's no-op sends and fixed P1/P2 schedule are replaced with actual
REQUEST/TOKEN/RELEASE/APP messages. The model distinguishes token at coordinator,
outbound, held by a client and returning. Clients leave before sending RELEASE;
P0 cannot grant again until it receives that return. Concessions and completions
have distinct counters. Eligibility uses `≤` for other clients, not `==`, with
an explicit independent-request counterexample. Matching prose and pseudocode
also correct the two-vs-three-message full-cycle count and fairness assumptions.

Tests cover 500 executions, 50,000 actions plus drains, 92,129 events and 5,973
completed requests. The independent oracle reconstructs request causal histories
and token movement, checks send-time vectors, predecessor completion, queue
contents, mutual exclusion and conserved ownership. Additional cases cover
reverse request arrival, immediate reacquisition while RELEASE travels, invalid
actions and three control messages per completed request. Desktop/mobile actual
controls reproduce both 22-row traces and check states, vectors and queue size;
keyboard scrolling/focus and JavaScript-disabled traces also pass.

Manual native-SVG and desktop/mobile widget inspection confirms readable labels,
the waiting/eligible distinction and in-transit token state. Evidence is in
`central-test.json`, `static-test.json`, `browser-http-test.json`, `font-test.json`
and `central-*` / `pcd-central-*` PNGs under
`/home/ybc/notes-legacy-review-artifacts/`. Random schedules are not a formal proof.
Snapshots, global cuts and other remaining PCD16 claims still need review. The
full-site goal remains open; production and preexisting review edits are untouched.

The original local module-4.2 slide text, slides 8–11, was inspected directly.
Slide 10 contains the equality/“at most” discrepancy and updates reqDone on grant;
the chapter now identifies that source discrepancy explicitly. One broad audit
attempt stopped with `ERR_ABORTED` navigating the unmodified `ds/DS-CX.html`,
after nine completed visits; it is not counted as a successful run. Its partial
record is retained as `audit-after-central-partial.json`.

The completed retry (`audit-after-central-retry.json`) passes 103 Mermaid blocks
in 32 pages at 1280/390 px: all 64 visits, including DS-CX at both widths, have no
renderer errors, invalid geometry, page overflow or JavaScript exceptions. The
sixteen-flowchart geometry suite checks all eight example edges and nine token
lifecycle edges; twelve HTTP page visits and seventeen embedded-font assets pass.
Causal-order, Chang–Roberts and Ricart–Agrawala regressions also pass, as does the
20-case DL preset suite with four byte-identical approved SVGs. Inventory now
counts 315 pages and 980 figure elements; original scope remains 208 chapters and
882 figures. Neither inventory nor rendering success certifies all content.

## Previous addition (3a40677): causal ordering and matrix eligibility

Preview: [PCD16, sections 11–13](../../pcd/cap-16-algoritmi-distribuiti.html#s11).
Two new static SVGs show the actual event-dependency graph and receiving buffer.
Message edges are unique; the causal bridge follows the first send, and the
delayed message arrives only once. Arrival and application delivery are no longer
conflated. The common-recipient qualification is explicit throughout these
sections and the corresponding review question.

The matrix's eligibility test now uses `≤` for other senders, with an executable
counterexample showing why equality can block an unrelated message forever.
Annotated code, prose, four static traces and a new model-backed widget agree.
The two intermediate P3 columns in the buffer figure are checked against actual
delivery events. Total and causal ordering are explained as distinct, combinable
properties; total order does not mean physical synchrony. Primary references and
the exact matrix variant's assumptions are documented in the chapter.

Checks: 1,050 randomized executions, 73,500 actions plus drains, 130,944 logged
events, with an independent oracle based on causal histories rather than matrix
comparisons. All four examples pass desktop/mobile controls, matrix and buffer
checks, keyboard focus/reset/scrolling and no-JavaScript traces. Manual native-SVG
and desktop/mobile widget inspection found readable labels and matrices; mobile
panels stack instead of shrinking text. The fourteen-flowchart geometry suite
also checks all six dependency edges and the three unique message labels.

Evidence: `causal-test.json`, `static-test.json`, `browser-http-test.json`,
`font-test.json`, and `pcd-causal-*` / `causal-*` screenshots in
`/home/ybc/notes-legacy-review-artifacts/`. The remaining centralized mutex,
snapshot and consensus claims in this chapter are not certified by these tests.
The full-site goal remains open; production has not been changed.

The remaining-runtime audit (`audit-after-causal.json`) passes 105 Mermaid blocks
in 32 pages at 1280 and 390 px (64 visits), with no error SVGs, invalid geometry,
page overflow or JavaScript exceptions. The 12-page HTTP regression, 15-asset font
checks, Chang–Roberts scenarios, Ricart–Agrawala tests and 20-case DL preset suite
also pass; the four approved DL SVGs remain byte-identical. Inventory: 315 pages,
978 figure elements; the original fifteen-course scope is still 208 chapters and
882 figures. Rendering counts do not establish scientific completion.

## Previous addition (d8746bc): Chang–Roberts diagrams, protocol and simulator

Preview: [PCD16, sections 9–10](../../pcd/cap-16-algoritmi-distribuiti.html#s9).
The general flowchart renderer now has twelve reviewed sources. The two new
diagrams distinguish physical/logical connections from execution phases, preserve
the original embedded font and palette, and have straight/angular native arrows.
The six-process example restores the missing candidate return to P7 and starts
the announcement at P7, not P2: 7 election + 6 leader transmissions.

The previous state explorer was replaced with a message-driven simulator. Its
participant state, FIFO queues, announcement and counts agree with the updated
pseudocode and static HTML trace generated from the same pure model. The single
initiator's 3N − 1 bound is no longer presented as the general concurrent bound.
Assumptions and source references are explicit in the chapter and adapter README.

Verification: 49,488 ring/initiator combinations through N=6 with one seeded random
channel interleaving each; 5,038 single-initiator bounds; 1,000 late-initiation cases;
exact worst-case examples N=2…12; exact 13-message trace and rejected invalid
actions. Actual desktop/mobile controls and no-JavaScript fallback pass. Manual
screenshots prompted wider tables and cleaner phase-label line breaks; scrolling
is explicit, not hidden overflow or smaller text. Geometry/markup tests cover
all twelve generated flowcharts. The original four approved DL SVGs are untouched.

Evidence: `chang-test.json`, `static-test.json`, `browser-http-test.json`,
`font-test.json` and `chang-*` / `pcd-chang-*` PNGs under
`/home/ybc/notes-legacy-review-artifacts/`. These are scoped tests, not an exhaustive
schedule proof or a certification of all PCD16 content. Causal ordering, snapshot
and other listed scientific-review findings remain open. Production is unchanged.

The remaining-runtime audit (`audit-after-chang.json`) covers 107 Mermaid blocks
in 32 pages at both 1280 and 390 px: 64 visits, no renderer errors, invalid geometry,
page overflow or JavaScript exceptions. It checks rendering, not scientific truth.
The twelve-page HTTP regression suite, 13-asset font checks, Ricart–Agrawala
500-scenario/50,000-action tests and 20-case DL preset suite pass. The source
inventory now has 315 pages and 976 figure elements; the original fifteen-course
208-page / 882-figure boundary remains unchanged and is not a completion claim.

## Previous addition (3198ca1): actual fonts and quantitative correctness

The font-loading question below is resolved. The original IBM Plex Mono Regular
font is embedded, unmodified and with its complete OFL license, in all ten generated
flowcharts and the new DS-M1 reliability plot. The renderer loads that same font
before computing layout. Native labels remain text, not outlines or raster images.

Chromium reports actual `IBM Plex Mono` custom-font glyphs; the earlier SVG control
falls back to an installed monospace font. An isolated SVG-image rasterization test
detects 1,472 changed pixels when removing the embedded font. All eleven asset
font hashes match the pinned official binary, with no external font requests.
This does not change the four previously approved native DL SVGs.

DS-M1 now uses a shared, tested mathematical model for the calculator and a new
[quantitative reliability plot](../../ds/DS-M1.html#s11). Corrections include:

- 99.671% is approximately 2.48 nines, not three nines; historical economics
  examples are explicitly labelled as historical, not current pricing evidence.
- A 365-day year is used consistently. Default static nines/downtime values now
  agree with the calculator (2.26 and 48.40 h).
- Badges test actual availability thresholds, not rounded display values. A result
  displayed as 3.00 nines may legitimately fail the three-nines threshold.
- Long-run uptime fractions, transient availability, measured annual budgets and
  stochastic guarantees are distinguished. The slides' MTBF convention is explicit.
- Exponential lifetimes and constant hazard are assumptions, with λ = 1/MTTF.
  The 10-minute-uptime example has R(30 min) ≈ 4.98%, not zero.
- The graph compares two synthetic systems with equal 99% long-run availability
  but different reliability curves. All 402 sampled coordinates are checked
  against the model; this is not an empirical measurement.
- Selected integrity, maintainability and heartbeat descriptions are qualified.
- Slider labels are associated with inputs; without JavaScript the inputs remain
  disabled with an explicit explanation and correct fixed values.

Latest checks: the existing ten-flowchart geometry suite and 12 desktop/mobile
HTTP page visits pass after regeneration; font tests pass for eleven assets; the
new dependability suite passes twelve calculator cases, exact nines boundaries,
all curve samples, native-size mobile scrolling and no-JavaScript fallback.
The 500-scenario Ricart–Agrawala suite and 20-case DL preset suite also pass.
Full-site inventory now counts 315 pages and 974 figure elements; the original
15-course scope is still 208 chapters and 882 figures. No broader semantic
completion is inferred from those counts.

Evidence: `font-test.json`, `dependability-test.json`, refreshed native and chapter
screenshots in `/home/ybc/notes-legacy-review-artifacts/`; implementation and source
citations in the [adapter README](../../dev/legacy-diagrams/README.md).

## Previous delivered checkpoint (d97c7f7)

Ten native SVG replacements in PCD and Distributed Systems, generated from
coordinate-free Mermaid sources using a pinned, build-time editorial adapter.
The [gallery](index.html) links to every changed chapter. Six previously broken or
empty diagrams are repaired; the others complete related comparison sets or
clarify the causal/logical model. See the
[source-by-source explanation](../../dev/legacy-diagrams/README.md).

Ricart–Agrawala now has a consistent diagram, protocol, pseudocode and interactive
message model. It cannot fabricate an OK or release a process that has not entered
the critical section. Its assumptions are explicit. DS-C4's orphan widget error
and selected cryptography/replication explanations are corrected.

## Verified in this checkpoint

- Ten regenerated SVGs: valid XML, no foreignObject, no NaN/undefined geometry,
  text/canvas bounds and text collision checks; exact node/edge counts; deterministic
  output. All six process pairs in the all-to-all example retain both arrowheads.
- Separate undirected, bidirectional and directed/dashed edge fixtures; five invalid
  source/override cases rejected. Chapter and asset drift check passes.
- All ten figures inspected visually at native size; chapter screenshots checked
  on desktop/mobile, including the independent-context diagram and new simulator.
- Six changed pages at 1280 and 390 px, both file and HTTP preview: 20 figure views
  per run, tab switching, no page overflow or pageerror, native-size SVG images and
  horizontal keyboard scrolling. Images also load with JavaScript disabled in
  all five chapters containing the new figures.
- Ricart–Agrawala: 500 reordered simultaneous-request scenarios (9,000 events),
  50,000 additional mixed actions, distinct permissions, mutual exclusion,
  monotonic clocks and eventual drain under fair delivery/releases. Additional
  2-, 4- and 8-process cases pass. This is testing, not a formal proof.
- Browser interactions: equal-timestamp P1/P3 competition, delayed permissions,
  release and reset; existing guided trace; DS availability calculator; DS-C4
  state explorer; all tab controls on these pages.
- Full remaining Mermaid render audit: 109 blocks in 32 pages, 64 desktop/mobile
  visits, no error SVGs, invalid geometry, page overflow or pageerror. The ten
  converted figures account for the difference from the 119-block baseline.
- Existing DL regression suite: 20 cases pass; four approved SVGs are byte-identical.
- Full-site inventory refreshed: 315 pages and 973 figure elements. The count
  increased because ten runtime diagrams now have semantic figure wrappers;
  this is not ten additional teaching diagrams. External SVG asset hashes are
  recorded alongside figure markup hashes.

Commands and reproducibility details are in the adapter README. Detailed JSON and
PNG evidence is in `/home/ybc/notes-legacy-review-artifacts/`:
`audit.json`, `audit-post-static.json`, `audit-final.json`, `static-test.json`,
`browser-test.json`, `browser-http-test.json`, and per-diagram/per-widget images.

## Not claimed complete

The 109 remaining runtime diagrams have passed rendering checks, not a complete
visual or scientific review. The full-site content review remains open, including
the concrete PCD, DS and cybersecurity findings listed in the adapter README.
No full-site widget regression is claimed for this checkpoint: testing of new
behavior targets the changed pages, while existing DL presets have a regression
check. The earlier broad regression reports remain historical evidence.

Browser tests block unrelated remote requests, including Google Fonts. The earlier
standalone-font uncertainty is resolved by the embedded-font check documented
above. No font-size reduction or hidden overflow was used to fit the figures.

No paid generation, production publication, Caddy change or service restart.
Preexisting edits in `review/index.html` and `review/report.md` are preserved and
excluded from this checkpoint.
