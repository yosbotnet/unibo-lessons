# Content-layout checkpoint

[Before/after preview](index.html) · [Implementation and limits](../../dev/content-layout/README.md)

## Changes

Shared reading-column repairs across 22 course bundles; local fixes in ASMD 10,
IRS 13, PM 10/13; generated DM 10.2 and its matching interactive parameter table;
Unicode mathematical labels in Reti LM 2–7 and ASMD 13. Native SVG, real tables,
original font stacks and ivory/cobalt/vermilion styling are retained.

The DM plate now actually contains the claimed **190 points**, rather than 150.
Its region and the widget share exactly ten highlighted configurations. Approximate
5.3% for that finite example is distinguished from the slide's idealized 5% case.

## Checks completed

- 315 pages × two viewport sizes: 178 HTML page-overflow cases before, zero after.
- Visual before/after review of tables, index layout, PM matching controls, DM plot
  and widget; screenshots available in this directory.
- Dedicated tests: table semantics and listeners preserved; no duplicate wrappers;
  local scroll and keyboard focus; 190 unique matching SVG/widget configurations;
  ten highlighted; arrow-key selection; PM scoring verified at 0/6 and 6/6.
- Core 208-page suite: 374 sliders and 4,887 buttons exercised, no markup/namespace,
  marker or JavaScript failures. Reviewed inline-script revisions are hash-pinned.
  One concurrent rerun lost its browser before completion; a subsequent isolated
  rerun completed all 208 pages successfully. The incomplete run is not counted.
- Reti LM semantic smoke suite: 184 passed. PM suite: 111 passed.
- DL: 30 rendered checks / 15 scroll checks; 20 preset cases and all four accepted
  SVG hashes unchanged. Cross-course: ten preset cases and desktop/mobile pass.
- HTTP preview: 416 chapter visits / 863 figure-scroll tests, offline shared CSS
  and RNN chapter pass. Macro and Politics offline tests pass 8 checks each.
- All three service workers' cache-cleanup ownership tests pass. Macro no longer
  deletes other courses' caches during activation.

## Still open

These layout numbers are not a full content or diagram audit. The whole-site test
blocks remote Mermaid, producing missing-library errors on ten legacy pages;
`ds/DS-C4.html` additionally has a preexisting null/style error. See
[report.json](report.json) for exact paths. Those diagrams and widgets need a
separate rendered review, followed by the remaining semantic figure/content work.

No paid image generation, production deployment or unrelated service restart.
The current revision remains on the dedicated preview branch pending approval.
