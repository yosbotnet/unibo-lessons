# Legacy diagram checkpoint — 7 September 2026

Preview only. Production remains at `f0f4bde`.

## Delivered

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

Browser tests block unrelated remote requests, including Google Fonts. The SVGs
declare the original font stack; exact web-font availability in standalone SVG
images needs an explicit font-loading check before deployment. No font-size
reduction or hidden overflow was used to fit the figures.

No paid generation, production publication, Caddy change or service restart.
Preexisting edits in `review/index.html` and `review/report.md` are preserved and
excluded from this checkpoint.
