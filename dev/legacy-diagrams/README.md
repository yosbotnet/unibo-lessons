# Static editorial flowcharts from Mermaid

This is a build-time adapter, not a Mermaid fork, replacement parser or universal
diagram engine. It complements the specialized native presets in `../diagrams`.
The existing Mermaid text notation provides named connections, native shapes,
subgraphs, undirected/bidirectional links and dashed arrows. The adapter fixes the
palette, 14px original monospace font stack, line weight and straight/angular
routes; it preserves the engine's domain-specific arrowheads.

Twenty-four reviewed sources live in `sources.cjs`. No coordinates or bend points occur in
these source records. Supported overrides: direction, nodeSpacing and rankSpacing.
Unknown overrides fail; fonts are never made smaller to accommodate content.
Only flowchart/graph input is supported here. Sequence/class diagrams remain with
their existing renderers until separately reviewed; neuron presets remain intact.

## Build and review

```sh
cd dev/legacy-diagrams
npm ci --ignore-scripts
npx playwright install chromium  # only if this pinned browser is not installed
node build.cjs                  # generates SVG assets and review gallery
node build.cjs --patch          # prints a chapter patch for apply_patch
node build.cjs --check          # fails on chapter/asset drift; no source writes
node test.cjs
node font-test.cjs
node dependability-test.cjs
node dependability-plot.cjs --check
node ricart-test.cjs
node chang-test.cjs
node chang-trace.cjs --check
node causal-test.cjs
node causal-traces.cjs --check
node central-test.cjs
node central-traces.cjs --check
node cut-test.cjs
node cut-timeline.cjs --check
node king-test.cjs
node king-traces.cjs --check
node cap-test.cjs
node cap-traces.cjs --check
node pbft-test.cjs
node pbft-traces.cjs --check
node ledger-test.cjs
node ledger-traces.cjs --check
node browser-test.cjs
REPORT_NAME=audit-final node audit.cjs
```

Mermaid 11.17.2, Playwright 1.62.1 and IBM Plex Mono 2.5.0 are pinned in package-lock.json. These are
development dependencies, never sent to readers. There is no AI image generation,
paid call, service restart or deployment in these commands. Rendering uses the
locally installed browser and packages without network access. Original target
blocks are protected by `original-hashes.json`; later updates use explicit markers.
The renderer generates standalone `.svg` files under course `assets/diagrams/`;
chapters load them as images at their native size, in keyboard-scrollable regions.
Titles and explanatory HTML captions remain accessible without SVG support.

### CAP: operation histories, not a triangle of switches

DS-C1 now uses two native reasoning diagrams: alternative read policies, and the
two-execution indistinguishability argument. Edges mean logical dependencies or
policy consequences, not network messages. Both use the existing static Mermaid
adapter and embedded original font. The unsupported CAP triangle and old proof
stepper are replaced; no image generation is involved.

`ds/assets/cap-register.js` models two live nodes, one completed write at G1 and
one read at G2. The local-copy policy returns the cached value; the authority
policy sends a query and waits for a reply containing the value at query handling.
Partition/heal and actual queued-message delivery are separate actions. Messages
remain available for retry/delivery after healing; this is not an irreversible
packet-loss or multi-writer merge simulator. Fixed authority is not quorum voting.

The checker enumerates legal sequential orders of completed operations, preserves
response-before-invocation precedence and applies the register specification.
Pending reads are omitted from the finite safety check. The limited model has no
pending writes. Event numbers belong to an observer, not node clocks. A pending
read proves no finite-time liveness failure; an execution that prevents its
required communication forever does. Replica equality after healing cannot erase
an earlier completed stale response. A read overlapping a write may legitimately
return either value, depending on its serialization position.

Six model-derived static trace tables remain usable without JavaScript. Tests
compare both input orders in 6,720 interval/value cases with an independent
single-write temporal oracle, then enumerate all 688 action prefixes with at most
four network changes, one write/read and deliverable messages. All authority
histories pass; 73 local-policy prefixes violate linearizability. Tests also
compare G2's observations in the no-write and hidden-write executions, reject
invalid operations, and check delayed reply capture and immutable return copies.
These bounded tests are not a general database verification or a proof of CAP.

Chapter definitions, quiz and conceptual recovery-map descriptions match the
operation model. ACID/BASE are no longer treated as formal CAP categories; product
names do not establish universal CP/AP behavior. The AWS discussion cites current
official S3 and DynamoDB documentation, including read-mode and index distinctions.
PCD16's CAP answer and DS-C4's CAP introduction now link to the same model.

Primary evidence: [Gilbert and Lynch 2002, §§2–3](https://www.cs.princeton.edu/courses/archive/spring21/cos418/papers/cap.pdf),
[Brewer's 2012 retrospective](https://www.infoq.com/articles/cap-twelve-years-later-how-the-rules-have-changed/),
[S3 consistency](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html),
[DynamoDB read consistency](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.ReadConsistency.html).
The local DS C1 slide text was checked, including slides 26–32: availability is
not guaranteed inter-server message delivery, and the proof needs an explicit
no-write comparison. The location-game diagram is framed as a historical slide
example, not a verified current deployment or an established cause of an outage.

The following PBFT checkpoint extends this review into DS-C4. Neither checkpoint
certifies the rest of the chapter or the entire site.

### PBFT: local evidence instead of a global phase animation

DS-C4 sections 5–6 and 9 now distinguish asynchronous safety from conditional
liveness, and PRE-PREPARE, backup PREPARE, replica COMMIT and client REPLY evidence.
At N=3f+1, prepared requires the request/proposal plus 2f distinct backup prepares;
committed-local requires prepared and 2f+1 distinct matching commits. The original
primary does not send PREPARE. A correct replica executes only after the lower
slots; f+1 matching authenticated replies complete the client's request.
The native diagram uses the shared angular-flow adapter, with full captions and
the original embedded font. A first layout had awkward label wrapping and excess
vertical gaps; concise labels and supported rank spacing corrected it without
shrinking text. The two conceptual state explorers now describe actual protocol
obligations, including evidence-preserving view changes, without claiming to run
them. The quiz uses the same definitions.

`ds/assets/pbft-normal.js` replaces the predetermined phase animation with actual
queued messages and per-replica evidence. The UI example has an honest primary R1,
silent backup R4, N=4/f=1 and one authenticated request X in view 0/slot 1; lower
slots are assumed complete. X increments a counter from 0 to 1. The normal-case
model also supports f=0–3 with N=3f+1 and up to f faulty backups for tests. A test
adversary may send its own prepare/commit votes with mismatching digest/view/slot;
it cannot use the adversary API to impersonate a correct sender. Duplicates count
once, out-of-order evidence is buffered, and executions/replies are not fabricated
by advancing a global phase counter. Authentication is assumed, not cryptographically
implemented. Faulty primaries, view changes, checkpoints and multiple slots remain
outside this normal-case model; it is not a full PBFT implementation.

The static 23-row trace comes from the same model. Its FIFO queue order is one
example, not a protocol channel assumption. Tests run 1,000 seeded reordered
schedules (74,000 deliveries), with an independent oracle reconstructing local
proposals and vote sets from delivery events, not trusting the model's phase flags.
They test premature commits, duplicate Byzantine votes, bad metadata, copied
snapshots, invalid API input and one execution per correct replica. Another
126,489 pairs of certificate subsets over 1–10 identities verify the intersection
bound. N=5/f=1/Q=3 is explicitly unsafe threshold reuse; quorum arithmetic alone
does not define a generalized PBFT protocol.

The surrounding PoW explanation now distinguishes work from raw chain length,
labels Ethereum mining historical, and removes universal throughput/security
claims. Section 11 uses q/(1−q) and lambda=zq/(1−q), distinguishes a known deficit
from hidden-progress averaging, and identifies Nakamoto's expected-time Poisson
approximation rather than presenting it as a universal measured risk. The printed
q=.10/.13, z=6 values are checked, as are 150 comparisons with an independent
positive Poisson-weighted tail calculation. The old 99.999% confidence claim fails
that calculation. These are teaching calculations, not payment recommendations.

The transaction widget's final-balance display previously referenced `b` outside
its callback scope, throwing a ReferenceError. It now uses the actual balances.
Its fabricated mint-ETH operation is replaced with an invalid-signature transfer;
all four examples are explicitly toy units and supplied authentication fixtures.
Two transfers apply, two are rejected, and total supply remains 27.5. A four-row
static table records the results. This is not real Ethereum validation.

Primary evidence: [Castro and Liskov 1999, §§3–4](https://pdos.csail.mit.edu/6.824/papers/castro-practicalbft.pdf),
[FLP 1985](https://groups.csail.mit.edu/tds/papers/Lynch/jacm85.pdf),
[Nakamoto 2008, especially §11](https://bitcoin.org/bitcoin.pdf),
[Ethereum's Merge](https://ethereum.org/en/roadmap/merge/),
and [Bitcoin Core proof-of-work validation](https://github.com/bitcoin/bitcoin/blob/master/src/pow.cpp).
Local DS C4 slide text sections on BFT (slides 69–74) and PBFT (109–111) were
checked. The slide shorthand about unconditional impossibility and all protocols
using periodic rounds needs the qualifications now present in the chapter.

The following checkpoint repairs the confirmed mining/chain issues. Several
smart-contract and platform generalizations remain open; the PBFT tests do not
certify those sections.

### Hash trials and a ledger fork derived from data

DS-C4 sections 7 and 10 now have two native SVGs using the same angular adapter.
`ledger-source.cjs` derives every parent-child edge and the selected branch from
`ds/assets/ledger-fork.js`; source definitions contain no coordinates. All six
blocks keep their actual parent, including the two competing height-3 blocks.
The figure uses explicit schematic IDs, not fake truncated hash strings. Arrows
point parent to child; the parent reference goes the other way. Caption and trace
make this distinction explicit. Both images keep the embedded original font.

The toy account ledger uses integer half-units, no rewards or fees and assumed
authentication. Proposed transfers are validated before inclusion: Eve's rejected
transfer no longer credits Alice or makes Eve negative. Each branch derives state
from its own parent. At equal accumulated work, this example retains the first-seen
tip; B4 later switches the active path from B3A to B3B → B4. The UI shows detached
and attached blocks and preserves separate inspected-block versus active-tip
balances. All six arrivals and each known-block button are keyboard accessible.
The final balances are Alice=15, Bob=7, Carol=4, Eve=1.5, total 27.5. The six-row
arrival table and six block details work without JavaScript. Work values are
assumed, not mined or proof-validated by this separate ledger experiment.

`ds/assets/pow-trials.js` replaces additive percentage bars with real SHA-256
trials over exact UTF-8 JSON inputs. It is intentionally a toy hash experiment,
not Bitcoin's binary header, double SHA-256, retargeting, network or rewards.
Difficulty is 4/8/12 zero bits; an interleaved 20-trial schedule allocates A/B/C/D
7/6/5/2 attempts. It models work shares, not measured parallel hardware timing or
guaranteed winner proportions. Every failed candidate changes a nonce; every
successful one supplies the next toy parent's digest. Counts and complete input /
digest values are visible, with no progress percentage or forced win.

One-trial, next-block and five-block controls compute only on user activation.
Batches yield periodically and stop at 50,000 trials with an explicit incomplete
message when appropriate. Stop snapshots recorded state and discards an in-flight
digest. Reset/difficulty changes create a new run. A generation token prevents
retired promises from repainting or mutating the active run. Hash failures surface
in the status instead of leaving disabled controls stuck. A precomputed 44-trial
table reaches the first valid toy proof; it remains usable without Web Crypto or
JavaScript. Both experiments are explicitly separate from the section 8 fixture.

Tests independently replay every ledger branch, check rejection and supply
conservation, exact reorganization membership and invalid fixture input. An abstract
unequal-work fixture confirms work selection rather than raw height; it is not
claimed to be a legal Bitcoin retargeting example. They check 8,586 real trials
across all three toy difficulties against Node's independent SHA-256 API, exact
target boundaries, unique input/nonce sequences, parent digests, counters and
copy isolation. On desktop/mobile, five blocks are found after 101 trials in the
default deterministic fixture. Stop/start and reset during an in-flight digest
are exercised. A separate injected nonwinning digest tests the 50,000-trial cap;
an injected crypto rejection tests recovery. Injected controls are not counted
as real SHA-256 evidence.

The block-format explanation now distinguishes Bitcoin's header/Merkle commitment
from the slides' schematic tuple, and an expected block interval from validation
rules. Source evidence: [Bitcoin developer guide](https://developer.bitcoin.org/devguide/block_chain.html),
[Nakamoto 2008](https://bitcoin.org/bitcoin.pdf), local DS C4 slides on block
validity and mining/forks (particularly 113–118). The site no longer presents
the slide timing shorthand as a complete Bitcoin validity test.

Remaining DS-C4 review: address/permissioned-identity generalizations, the informal
generation taxonomy and smart-contract properties (gas, upgradeability, privacy,
randomness and concurrency). The broader site still requires visual and semantic
review; generated asset counts are not approval counts.

### Font fidelity in image contexts

`font.cjs` embeds the unmodified official IBM Plex Mono Regular WOFF2 (49,248
bytes, about 66 KB as base64) in each standalone SVG, together with its copyright
notice and full SIL Open Font License. The builder loads the same font before
measuring labels; it does not depend on a workstation-installed or Google-hosted
font. Package install scripts are disabled in the local `.npmrc`, including the
font package's telemetry hook. No font binary is modified or renamed.

This resolves a verified difference in the previous checkpoint: SVGs in `<img>`
cannot inherit the parent page's web font. `font-test.cjs` checks the actual glyph
font through Chromium, compares embedded-font image pixels against a stripped-font
control in an isolated document, verifies embedded-byte hashes and licenses, and
asserts no external font requests. See [MDN's SVG image restrictions](https://developer.mozilla.org/en-US/docs/Web/SVG/Guides/SVG_as_an_image)
and the [official IBM package](https://github.com/IBM/plex/tree/master/packages/plex-mono).
The four previously approved native DL SVGs are deliberately unchanged.

### Consistent cuts use event timelines, not neuron layouts

PCD16 sections 14–16 now distinguish local prefixes, causal closure and channel
state. G1 includes a receive without its send; G2 includes only the send; G3
includes both. In all three panels the six events and the single message keep
exactly the same positions. Included events are filled, excluded events open;
the orthogonal dashed boundary is a cut, not another message. Text, captions,
review answers and marker-recording rules agree with those examples.

`pcd/assets/consistent-cuts.js` classifies prefix selections directly from local
orders and named send/receive endpoints. The widget explores all 16 cuts of this
example, with 12 consistent and 4 inconsistent choices. `cut-timeline.cjs` derives
positions from causal ranks and renders native SVG with the same embedded font.
It does not use Mermaid or AI image generation. The two surrounding event DAGs
use the ordinary Mermaid adapter; the second fixes reversed receives that
contradicted the assumed FIFO channel.

The model accepts 2–6 sequential processes, each with 1–8 uniquely named events,
and at most one send/receive role per event. IDs are bounded SVG-safe strings;
cycles, unknown endpoints and reused message endpoints are rejected. The model
does not assume FIFO for arbitrary input histories: cut consistency itself is
causal closure. The chapter's snapshot algorithm separately requires FIFO.
The timeline accepts 1–6 views and eventGap/rowGap overrides. Label widths expand
the requested gap/canvas rather than shrink text. This is schematic time, not
measured latency. Dense or multi-message layouts still require visual review;
causal ranks alone do not guarantee collision-free arbitrary diagrams.

`cut-test.cjs` independently enumerates all 720 event permutations, retains the
10 legal executions, and tests all 64 event subsets against their prefixes.
It checks exact channel classifications, the three event sets, invalid inputs,
deterministic SVG, XML, label bounds/overlaps, paths crossing text, orthogonal
cuts, unchanged panel coordinates and complete arrow endpoints. Desktop/mobile
checks exercise every cut, preset button and all 19 conceptual-state transitions,
including the previously undefined RED target. Native images/captions work with
JavaScript disabled. Spacing variants and keyboard focus/scroll are tested.

The two existing Chandy–Lamport state browsers remain **conceptual local-state
diagrams**, explicitly not executable channel simulations. Completion there is
local; it does not imply every process finished or that results were collected.
The one-input first-marker path can complete without waiting for another marker.
A full operational marker/channel simulator and trace remain future work.
The original module-4.2 slides 26–31 were checked against
[Chandy–Lamport §§2–4](https://lamport.azurewebsites.net/pubs/chandy.pdf).
Their shorthand about concurrent states must not be applied to the final
included events: in G3, e2 causally precedes e5 and the cut is still consistent.

The build adapter also now emits chapter patch hunks in document order, even
when source records are registered in reverse order. Source-order hunks previously
caused apply_patch to reject a valid two-figure update. Generation still does not
apply patches or deploy automatically.

### Phase king: fault bounds, real rounds and a failing example

PCD16 sections 17–19 now separate validity of origin, strong validity over correct
inputs and irrevocability. FLP statements explicitly concern deterministic
termination guarantees, not the impossibility of every successful execution.
The crash-stop minimum-of-set example no longer claims the stronger validity:
a proposal sent by a subsequently crashed process can still be the chosen minimum.
A set does not preserve voting multiplicities, and the round deadline is not an
indefinite wait for every sender. The original slide discrepancy is explained.

The two-round binary phase-king variant has its own bound, **N > 4f**, distinct
from the classical unsigned Byzantine lower bound N > 3f. There are f+1 phases
and 2(f+1) communication rounds, with distinct kings. The phase flowchart is a
native SVG generated through the shared Mermaid adapter; it is a control-flow
diagram, not a neuron template or a purported network-message trace.

`pcd/assets/phase-king.js` contains a pure synchronous round model and three UI
scenarios. It supports 2–9 processes, binary inputs, a fixed Byzantine subset of
at most f processes, identified point-to-point senders, and kings P1…P(f+1).
Every receiver counts one value per sender, including itself. Adversarial values
can differ per recipient. Missing values normalize to 0; the API accepts 0, 1
and null, representing all binary effects of invalid/missing messages. A tie uses
candidate 0. Correct messages cannot be overridden or impersonated. Constructor
validation rejects N ≤ 4f unless `allowUnsafe:true` explicitly requests an
out-of-guarantee experiment. The UI marks that case in vermilion, never as a
working four-node consensus protocol.

Each click executes an entire synchronous communication round. This is not an
asynchronous network simulator or a Byzantine-failure detector. The model stores
actual per-recipient vectors, candidates, multiplicities, king messages and
threshold choices; recorded logical receipts distinguish local self-votes and
omissions from network messages. Only correct-process states are displayed.
`king-traces.cjs` generates 22 static phase/process rows from those same rounds.

Three scenarios show unanimous-input preservation with N=5, convergence from
split inputs with N=5, and a failure with N=4/f=1. In the failing case the first
king is correct, but the second Byzantine king can undo agreement because three
copies equal, rather than exceed, the threshold. Correct decisions become 0,1,1.
This demonstrates failure of this variant, not impossibility of all N=4 protocols.

`king-test.cjs` exhausts 143,360 N=5 executions: every single Byzantine identity,
every assignment to the four correct inputs, both rounds of exchange
equivocations and every Byzantine-king equivocation. Omissions have the same
binary effects as 0. It also checks 32 fault-free inputs, 1,000 seeded executions
over 2–9 processes (including N=9/f=2), and the exact N=4 counterexample. A separate
oracle reconstructs vectors and uses the integer condition `2*copies > N+2*f`
for the seeded, fault-free and illustrated runs; the exhaustive suite checks
agreement, strong validity, completion and binary decisions.
All displayed states, decisions, reset/focus, table columns, horizontal keyboard
scrolling and no-JavaScript traces are tested at 1280 and 390 px. These are bounded
tests plus the chapter proof sketch, not a proof for all network models.

Original module-4.2 slides 35–42 were compared against the
[FLP paper](https://groups.csail.mit.edu/tds/papers/Lynch/jacm85.pdf),
[Byzantine Generals paper](https://lamport.azurewebsites.net/pubs/byz.pdf) and
[Aspnes's phase-king notes](https://www.cs.yale.edu/homes/aspnes/pinewiki/ByzantineAgreement.html).
The strict threshold's preservation inequality is derived in the chapter;
transferable signatures require a separate model, not an unqualified 3f rule.

### Preserve literal mathematical operators

Visual inspection caught Mermaid 11.17.2 dropping a raw `>` inside a quoted
node label: the decision diamond lost its crucial comparison sign even though
XML and geometry tests passed. `literalLabels()` now treats quoted labels as
plain text, with `<br/>` as the supported line-break markup, and encodes literal
`<`/`>` before parsing. It never rewrites graph arrows outside labels. Other HTML
inside quoted labels becomes literal text; this is not a rich-HTML label API.
Existing reviewed assets remain unchanged. Formula probes cover >, <, ≤, ≥ and ←.
Optional `requiredText` strings make the renderer reject output that loses a
declared formula; phase king checks its threshold, final-phase test and increment.

### Quantitative figures are not flowcharts

`dependability-plot.cjs` draws two exponential reliability curves directly from
`ds/assets/dependability.js`, the same pure model used by the chapter calculator.
It is a separate quantitative renderer: 402 sampled points, explicitly labelled
axes and synthetic model assumptions, not a Mermaid approximation or AI image.
Run `node dependability-plot.cjs` to generate the asset and print its chapter patch.
The plot and font are available without JavaScript. Preview: `/ds/DS-M1.html#s11`.

DS-M1 was compared with the original 55-slide M1 deck under
`/home/ybc/content/exams/Distributed Systems/slides-text/`, especially slides 6–7
and the metrics section. The slide numbers/elapsed-cycle convention are retained
with qualifications; misleading nines labels, unsupported present-day economics
claims, inconsistent year lengths and contradictory numerical examples are fixed.
The exponential assumption follows the [NIST lifetime model](https://www.itl.nist.gov/div898/handbook/apr/section1/apr161.htm).
Selected definitions also reference [Avizienis et al.](https://drum.lib.umd.edu/items/6b297ffc-373b-404f-be3a-70cc849e21fd)
and [Chandra–Toueg failure detectors](https://www.cs.cornell.edu/info/people/sam/FDpapers.html).
This does not certify every remaining claim in the chapter or the source slides.

### Chang–Roberts: topology is not a message trace

The two PCD16 replacements separate a directed ring topology (four processes and
four links) from a three-stage execution overview. Both use the general Mermaid
adapter, not a neural-network preset. The phase arrows represent succession of
phases, not individual network messages; the caption enumerates the complete
six-process ring and both complete tours. No coordinates occur in the sources.

`pcd/assets/chang-roberts.js` is a pure executable single-election model plus its
UI. It assumes fixed membership, unique IDs, no failures, and reliable, exactly-once
FIFO channels with eventual delivery. Initiation and receiving a greater candidate
both mark participation. Only the head message of each channel can be delivered;
the user can interleave different channels. A received lower ID cannot cause an
already-participating process to send another candidature. The maximum ID elects
itself only on return of its own candidate and then originates the announcement.
Reset creates a fresh epoch; this is not a failure detector or ring repair model.

The previous explorer allowed clicking logically impossible transitions and the
example omitted `P2 → P7: election(7)`, originating the announcement at P2 instead
of P7. The replacement widget shows actual queued transmissions, process state,
counts and a delivery trace. `chang-trace.cjs` prints an apply_patch patch for the
static 13-row HTML table derived from that same model; `--check` detects drift.
The table and two SVGs remain available without JavaScript. Tables retain readable
widths and keyboard-accessible horizontal scrolling on mobile.

The prose and annotated pseudocode now distinguish the single-initiator bound
`(N − 1) + N + N = 3N − 1` from quadratic concurrent-election traffic. Reverse
ordered IDs with every process initiating attain `N(N + 1)/2` election messages
plus N announcements in this model. This is message complexity, not an elapsed
time bound for asynchronous links. References: [Schindelhauer, slides 16–17](https://archive.cone.informatik.uni-freiburg.de/teaching/lecture/distributed-systems-s14/DS-04-Coordination-Agreement-c2.pdf)
for assumptions/single initiator; [Aspnes, §1.1.2](https://www.cs.yale.edu/homes/aspnes/pinewiki/LeaderElection.html)
for the decreasing-ID quadratic example. They describe related presentations;
the exact participant-flag variant and single-epoch scope here are explicit.

`chang-test.cjs` covers 49,488 ring/initiator combinations through N=6 with seeded
random FIFO channel interleavings (not exhaustive schedules), including 5,038
single-initiator bounds; 1,000 late-initiation cases; exact upper-bound examples
N=2…12; invalid inputs/actions; and the exact 13-message chapter trace. It also
exercises real widget controls on desktop/mobile, concurrent starts, final keyboard
focus, horizontal trace scrolling and the JavaScript-disabled fallback. It does
not certify the causal-order, snapshot or consensus widgets elsewhere in PCD16.

### Causal delivery: dependencies and buffer, not fictitious arrivals

PCD16 sections 11–13 now distinguish application delivery from arrival in the
middleware and qualify the ordering relation by common recipients. The two new
sources replace a graph with duplicated message edges and a sequence drawing
that sent the causal bridge too early, then drew one message twice. One SVG
expresses the actual send/deliver dependency DAG, with a separate dashed delivery
constraint; the other follows the receiving middleware's buffer transitions.
Both use the same generic flowchart adapter as the rest of this collection.

`pcd/assets/causal-order.js` implements the chapter's increment-before-send matrix
variant for fixed point-to-point membership, distinct sender/receiver, no failures,
and reliable exactly-once channels that need not be FIFO. A receiver tests its
column: exact next sequence number from the sender, `≤` for dependencies from
other senders. It merges the matrix only when delivering and drains newly eligible
buffered messages. The chapter's earlier `==` test on other senders permanently
blocked a simple concurrent-message case after one recipient advanced further
than another sender knew. Prose, summary and annotated code now agree.

Four scenarios cover causal overtaking, unrelated messages and the equality
counterexample, reordered messages from one sender, and a causal bridge sent
before the event it cannot convey. `causal-traces.cjs` prints an apply_patch patch
for four static HTML tables generated from those same executable scenarios.
The widget displays all three matrices, pending messages and per-process buffers
and deliveries, with real tables and responsive stacked panels. No script is
needed to read the diagrams or the four generated traces.

Source comparison: [Kshemkalyani–Singhal, slides 4–5 and 24](https://www.cs.uic.edu/~ajayk/Chapter6.pdf)
defines common-destination delivery ordering and describes the related RST
algorithm. Its FIFO, increment-after-send, separate-DELIV convention is not copied
as if identical to this variant; the chapter states the differences. [Krzyzanowski's
group communication notes](https://people.cs.rutgers.edu/~pxk/classes/417/notes/groups.html)
support the distinction between causal and total order. The chapter no longer
equates total multicast ordering with synchronous/rendezvous communication or
claims the causal matrix is mandatory for every causal multicast protocol.

`causal-test.cjs` checks 1,050 seeded random executions with 2–8 processes and
73,500 actions plus fair network drains (130,944 logged events). Its independent
oracle reconstructs send-event causal histories without using matrices, checks
predecessors at each delivery, actual incoming-column counts, and that no safely
deliverable message remains buffered. Exact checks cover all four examples,
the two intermediate P3 columns in the SVG, immutable timestamp copies, rejected
invalid actions and the order-only counterexamples. Browser tests exercise all
four scenarios at 1280/390 px, matrix values, buffers, reset, keyboard focus,
horizontal static-table scrolling and JavaScript-disabled fallbacks. Random
executions are not an exhaustive proof. Centralized mutex eligibility, snapshots
and other findings below remain separate work.

### Centralized mutex: the token also exists while in transit

PCD16 sections 3–5 now use a real message-driven coordinator/client model instead
of a stepper with no-op sends and hardcoded P1-then-P2 grants. REQUEST, TOKEN and
RELEASE are queued messages; an APP message can propagate the causal knowledge
that makes a later request depend on an earlier one. The diagrams show that bridge
explicitly, the waiting request and token lifecycle, with no unrequested P2 grant.
They use the same generic coordinate-free flowchart adapter. The selected client
need not be the most recent requester.

`pcd/assets/centralized-mutex.js` supports 2–6 clients (the UI shows two) with fixed
membership, no failures, reliable exactly-once channels and arbitrary delivery
order. Clients have one pending acquisition at a time and can send/receive APP
while waiting. Every control/application message carries a copied request-counter
vector; the coordinator also maintains knowledge distinct from its grant counters.
Eligibility uses exact next request for the requester and `≤` for other clients.
The first eligible queued request is granted only when the token is at P0.

`granted` counts TOKEN sends; `completed` counts RELEASE deliveries to P0. The
chapter's former `reqDone` name conflated them. The conserved token has four
locations: coordinator, outbound message, client, returning message. Clients
enter only on TOKEN delivery and leave before sending RELEASE. They may request
again while their previous RELEASE travels, but cannot receive a second grant
until P0 receives that return. P0 is not automatically safe against failures,
and this model has no timeout-based token regeneration.

Both the chapter and matching annotated pseudocode distinguish causal precedence
from starvation freedom and the pure coordinator's arrival-order queue. The full
cycle uses three control messages, not two; request-vector piggyback changes size,
not transmission count. [Aspnes, Distributed mutual exclusion](https://www.cs.yale.edu/homes/aspnes/pinewiki/DistributedSystems.html)
supports the central request/grant/release cycle. The exact causal queue policy
here is the chapter's explicit variant, checked against independent histories,
not attributed as a verbatim algorithm from that reference. The introductory
Ricart–Agrawala comparison now also preserves the HELD guard and 2(N − 1) count.

The original local slide extraction was checked directly: `slides-text/[module-4.2]
Distributed Algorithms - An Overview.txt` under
`/home/ybc/content/exams/Programmazione Concorrente e Distribuita (PCD)/`, slides
8–11 (especially 10). It really does print `==` for the other clients beside an
“at most” explanation, increments `reqDone` when sending the token, and places
the release send before clearing `inCS`. The chapter explicitly flags the
eligibility correction and renamed count instead of silently claiming literal
agreement with the slides. The exit-before-send order is safe even when those
actions can interleave with remote message deliveries.

Two examples cover a causal successor arriving first and independent requests
that an equality test would block. `central-traces.cjs` prints an apply_patch
patch for their 22 static rows; `--check` detects model/chapter drift. Real
desktop/mobile controls reproduce every action and compare vectors, queues,
token location, grant/completion counts and network size. The static traces and
both SVGs are available without JavaScript; tables scroll using the keyboard.

`central-test.cjs` runs 500 seeded random executions, 50,000 mixed actions plus
fair drains, 92,129 events and 5,973 completed requests. A separate oracle tracks
request-event causal histories and token movement, never the eligibility test.
It checks actual send-time knowledge, grants after completed causal predecessors,
single entry, queue contents and conservation of the token. Additional cases
cover reverse arrival priority, immutable request stamps, reacquisition with a
RELEASE still in transit, invalid operations and exactly three control messages
per completed request. These are scoped regression tests, not an exhaustive
schedule proof or a certification of the rest of the distributed algorithms.

Mermaid theme configuration and linear curves follow the
[official configuration](https://mermaid.js.org/config/theming.html) and
[flowchart options](https://mermaid.js.org/config/schema-docs/config-defs-flowchart-diagram-config.html).
SVG labels are actual text/tspan, never foreignObject. Rendering outside the lesson
avoids the zero-size/NaN geometry caused by measuring hidden tab panels.

## Evidence and limits

The baseline audit rendered 119 blocks in 33 pages at 1280 and 390 px, using pinned
local Mermaid and highlight.js in place of their CDN URLs. Other remote requests
(including Google Fonts) are blocked. Tabs are opened using their real controls.
It found five error SVGs, plus a sixth empty/NaN SVG found when geometry checks were
added. It does not certify the remaining diagrams' scientific correctness.

- PCD 02, interleaving: raw `<stato iniziale>` was parsed as HTML. Replaced the
  mixed process/state diagram with all five reachable states and four transitions.
  Corrected the accompanying first-vs-last assignment explanation.
- PCD 12, symmetric exchange: rendering inside a hidden panel generated invalid
  geometry. The original also omitted outgoing messages from P0 and P3. The new
  three-strategy set uses the same four participants and explains message counts.
- PCD 16, Ricart–Agrawala: unquoted parentheses caused parse failure; the diagram,
  prose, pseudocode and interactive model now distinguish REQUESTING and HELD,
  break timestamp ties with process IDs, and wait for distinct permissions.
- PCD 16, consensus rounds: braces in unquoted labels caused parse failure.
  Explicitly shows a fault-free example within a synchronous crash-stop model;
  stages are connected and are not confused with individual network messages.
- PCD 16, SMR/Raft: nested square brackets caused parse failure. Replaced the
  external-consensus/load-balancer sketch with a logical SMR overview and a
  separate leader/follower Raft example; application follows commit.
- DS M1: chain of threats now has native text, consistent styling and no Mermaid
  runtime dependency. Existing availability calculator retained and tested.
- DS M2: independent contexts was an empty 16×16 viewBox with NaN geometry in a
  hidden panel. The static version retains separate contexts and bidirectionality.
- DS C4: removed an orphan initialization of a nonexistent hidden code host;
  corrected digital-signature and ordering descriptions. This is not a full
  certification of that chapter.

Local comparison material is under
`/home/ybc/content/exams/Programmazione Concorrente e Distribuita (PCD)/lessons/`,
especially 2026-02-27, 2026-04-20 and 2026-05-18. These generated lesson notes share
some of the original mistakes and are not independent proof. Primary references:
[Ricart–Agrawala](https://doi.org/10.1145/358527.358537),
[Raft paper](https://raft.github.io/raft.pdf),
[NIST FIPS 186-5](https://csrc.nist.gov/pubs/fips/186-5/final).

## Remaining scientific review findings

These are concrete next checks, not claims that whole chapters are repaired:

- PCD 16: consistent-cut definitions, marker explanations and both conceptual
  state browsers have been corrected and tested. Still needed: an operational
  marker/channel simulation and concrete snapshot trace. Phase-king resilience
  and the FLP/validity explanations are now corrected; the crash-stop flooding
  algorithm still needs an executable failure trace. Remaining CAP, Paxos/Raft
  and state-machine claims need their own precise-model review.
- DS C4: qualify CAP, FLP, hash-chain immutability and BFT threshold/termination
  claims against their precise system models.
- DS M1: numerical availability examples, reliability assumptions, nines thresholds
  and year length are now reconciled against the shared model. Selected integrity,
  maintainability and heartbeat descriptions are corrected. The broader taxonomy,
  recovery and failure-mode examples still need a complete semantic review.
- Cybersecurity and cybersecurity-reworked, chapter 05: verify the attribution of
  VGG→ResNet transfer to a 2015 paper and the unsourced transfer-rate table before
  turning it into a new illustration.
- The other runtime Mermaid figures and the rest of the full-site inventory still
  need current visual and semantic review. An SVG existing is not proof of that.

Preview: `http://localhost:8787/review/legacy-diagrams/` through the existing SSH
tunnel. Production is separate and remains unchanged pending approval.
