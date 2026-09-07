# Legacy diagrams and dependability — 7 September 2026

Preview only. Production remains at `f0f4bde`.

## Latest addition: Chang–Roberts diagrams, protocol and simulator

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
