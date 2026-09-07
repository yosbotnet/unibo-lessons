# Raft commit: bounded executable examples

Preview: [PCD 16, section 20](../../pcd/cap-16-algoritmi-distribuiti.html#s20).

The native seven-node/seven-edge figure uses the shared angular flow renderer,
not hand-positioned SVG. Its editable source is `pcd-raft-commit` in `sources.cjs`.
The original embedded IBM Plex Mono, ivory, cobalt and vermilion are retained.
Tables use HTML, with keyboard-scrollable regions on narrow screens. No paid
generation, production writes or service restart is involved.

## Evidence and scope

- [Ongaro and Ousterhout, extended Raft paper](https://raft.github.io/raft.pdf):
  Figure 2, sections 5.3–5.4, Figure 8 and section 8. The leader's direct commit
  rule includes the current-term guard. Older entries can become committed as
  a prefix, without changing their original term. Application and client reply
  are subsequent operations. Retries and reads need additional rules.
- [Lamport, Paxos Made Simple](https://lamport.azurewebsites.net/pubs/paxos-simple.pdf):
  sections 2.1–2.5 and 3, including stable information across crash/restart.
- Local PCD module 4.2 slide text, slides 43–45, was inspected. The chapter
  distinguishes its 2013 Raft reference from the 2014 publication and no longer
  promotes the slide acronym or a universal Paxos/Raft performance equivalence.
  Source: `/home/ybc/content/exams/Programmazione Concorrente e Distribuita (PCD)/slides-text/[module-4.2] Distributed Algorithms - An Overview.txt`.

`raft-commit.cjs` exports three deliberately limited operations:

- `advance`: given a valid leader log and named match indexes in a fixed
  membership, find the largest eligible new commit index. Count distinct servers,
  including the leader. The input is assumed to represent valid protocol evidence;
  this helper does not prove that an arbitrary input history is reachable.
- `append`: the follower's term, predecessor, conflict, append and commit-bound
  checks. Empty or matching shorter requests do not erase an unrelated local
  suffix. A higher term is learned even on a predecessor mismatch. A request from
  an older term is rejected. Inputs are copied, not mutated. Overwriting a committed
  prefix or changing a command at the same index/term is rejected as violating
  the valid-leader assumptions, not handled as a Byzantine recovery strategy.
- `upToDate`: only the log freshness filter, comparing last term before length.
  Passing it is not a granted vote or an election.

`scenario()` derives the (c), (d) and (e) log tables from Figure 8's structure.
The term-4 entry is chosen to be a no-op; command labels are illustrative additions.
Index 1 is assumed committed. In (c), index 2 has three copies but its old term
prevents direct commit. Alternative (d) permits a newer-term leader with a fresher
log to overwrite that uncommitted suffix. Alternative (e) replicates index 3 in
the current term, committing indexes 2 and 3 together. Cases (d) and (e) are not
consecutive. `matchIndex=0` for unreachable S5 denotes missing leader evidence,
not an empty S5 log.

The fixture's follower current term is initialized to its last log term only to
exercise the local append rule; a real server's current term can be higher.
These examples do not run elections, transport, timers, persistent storage,
membership changes, compaction, application or request deduplication. They are
not a full Raft implementation, formal proof, or replacement for the paper.

## Reproduce and verified bounds

```sh
node dev/legacy-diagrams/raft-commit-traces.cjs --check
node dev/legacy-diagrams/raft-commit-test.cjs
node dev/legacy-diagrams/build.cjs --check
node dev/legacy-diagrams/test.cjs
node dev/legacy-diagrams/font-test.cjs
NOTES_PREVIEW_URL=http://127.0.0.1:8787/ node dev/legacy-diagrams/browser-test.cjs
```

The trace generator without `--check` prints a patch for `apply_patch`; chapter
tables are not independently hand-maintained.

Verified 181,066 commit states: nondecreasing logs of length 0–4, entry terms 1–3,
current terms through 4, memberships 1–5, every bounded follower match index and
commit index. The independent oracle uses the quorum order statistic, then scans
backward for a current-term entry. It also checks every newly committed index.
There are 25 freshness comparisons and follower cases for heartbeats, predecessor
mismatch, higher/stale RPC terms, conflicting suffixes, duplicate requests,
unchanged input state and invalid committed-prefix/same-term rewrites.

The chapter passes HTML5 parsing, unique-ID and stray-SVG checks, with no Mermaid
requests or page errors. Four HTTP views cover 1280/390 px with JavaScript on/off,
exact generated results, the alternative-case detail and keyboard scrolling.
All five section-20 tabs select exactly their corresponding panel. Native SVG and
chapter/table screenshots were visually inspected. Shared regressions pass for
27 diagrams, 29 embedded-font assets, 14 desktop/mobile page visits and seven
no-JavaScript image-loading visits, including tab and Ricart–Agrawala widget tests.
Additional consistent-cut and Phase-King model/browser regressions pass on the
modified chapter. The 20-case DL preset suite passes, with all four approved SVGs
remaining byte-identical.

Artifacts: `/home/ybc/notes-legacy-review-artifacts/raft-commit-test.json`,
`raft-*.png`, `pcd-raft-commit*.png` and `browser-http-test.json`.
The broader site goal remains open; PCD's conceptual snapshot explorers have not
been converted into channel-level simulators by this change.
