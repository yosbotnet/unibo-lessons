# OA statistics: variables and reproducible frequency plots

Subsequent review of sections 10–11 and Plates 8.6–8.7 is documented in
[OA-HYPOTHESIS.md](OA-HYPOTHESIS.md). Regression tests compose that explicit
transform with this checkpoint; the histogram and sections 1–2 stay unchanged.

The reviewed scope is sections 1–2 of `oa/cap-08-statistics.html`, their related
quiz answers and the histogram widget. Plate 8.1's geometry was already repaired
and visually complete; its SVG stays byte-identical. Its caption now correctly
allows histograms of discrete quantitative observations. This does not certify
the later descriptive/inferential material in the same chapter.

## Evidence and the actual numerical error

Original course extraction:
`/home/ybc/content/unibo-course-slides/68996-Operational Analytics/6 - Statistics_ descriptive.txt`,
slides 12–13 (traffic column and frequency table), and the preceding vocabulary.
No original PDF or `traffico16.csv` was found in the content tree for this review.
The 31 `ago1` observations are transcribed in `oa/assets/frequency.js` and checked
against the slide's actual data column, not against its inconsistent frequency
table. Their mean is exactly 4258 and their sample standard deviation is about
720.1479014758011.

The chapter before `a80f149` claimed a corrected count column, but its ten values
sum to 32, despite the stated sample size of 31. Its canvas widget used min–max
edges while describing a different expanded-range count vector. A browser capture
confirmed that the bar heights, adjacent text and static table disagreed.

Recomputation distinguishes two legitimate conventions:

| Ten bins | Limits | Counts |
| --- | --- | --- |
| NumPy-style observed range | 2794 to 5167 | 4, 1, 0, 2, 1, 2, 7, 6, 1, 7 |
| SciPy-style expanded range | 2662.166… to 5298.833… | 4, 1, 0, 2, 1, 2, 8, 5, 6, 2 |

Both total 31. Comparing the extracted slide columns shows that its printed
counts match the first convention, whereas its rounded relative/cumulative
frequencies match the second. The old explanation that merely the last three
printed counts were garbled was not retained. The displayed slide intervals are
approximate and do not specify the exact computation.

Primary documentation consulted on 8 September 2026:

- [NumPy histogram](https://numpy.org/doc/stable/reference/generated/numpy.histogram.html):
  default min–max range, explicit edges and half-open bins with a closed final bin.
- [SciPy relfreq](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.relfreq.html):
  the default expansion formula and the option to supply real limits explicitly.
- [NIST histogram guide](https://www.itl.nist.gov/div898/handbook/eda/section3/histogra.htm):
  counts, proportions and density normalization.
- [Statistics Canada probability sampling](https://www150.statcan.gc.ca/n1/edu/power-pouvoir/ch13/prob/5214899-eng.htm):
  simple random sampling versus other probability designs, including unequal
  inclusion probabilities. Equal inclusion probabilities alone are not used as
  the definition of simple random sampling.

The four HTML captures are retained at
`/tmp/notes-oa-frequency-evidence-jekCyU/`; their hashes and the slide extraction
hash are pinned in `oa-frequency-test.cjs`. Source summaries are scoped to these
points, not an audit of every statement in the sources.

## Implementation and styling

The old canvas histogram is replaced by an SVG calculated from the observations,
with a native table and summary generated from the same result. A selector makes
range choice explicit; the existing slider changes the bin count. Values on bin
boundaries are assigned consistently, outside-range observations are counted
explicitly by the model, and rounded labels are not used for assignment.

The course-specific renderer uses fixed 14px monospace labels, ivory, cobalt bars
and a vermilion mean marker. Bar positions/heights and the mean line come from
scales, not hand-drawn quantitative geometry. Wide SVG/table content scrolls at
its readable size, with the site's existing mobile scroll hint. No raster image,
paid image generation or client dependency is used.

The model exports validated edge construction and histogram functions. It accepts
explicit increasing edges (including unequal widths) for computation; the course
chart only presents the widget's 5–16 equal-width-bin settings, not a general
histogram-density renderer. Constant data need explicit edges. It is not an
automatic arbitrary-chart layout engine.

`oa-frequency-content.cjs` prints patches for the chapter. The default chart and
table are rendered at build time, so disabling or failing to load JavaScript does
not erase the example. Controls stay disabled until initialization succeeds.
`frequency-widget.js` updates only its own region. The remaining four widget
bodies remain byte-identical; a guard around optional highlighting prevents a
missing external highlighting script from aborting those widgets.

The no-JS mobile comparison also revealed old unwrapped tables in sections 10–12:
page width was 548px before this change at a 390px viewport; after replacing the
histogram's old content, a remaining table still reached 395px. At 320px, three
legacy tables protruded. These visually confirmed cases now have native focusable
scroll wrappers. Their values and prose are unchanged and remain subject to the
semantic follow-up below. No overflow is hidden and no font is made smaller.

## Verification

```sh
node dev/legacy-diagrams/oa-frequency-content.cjs
# Apply the printed patch using apply_patch.
node dev/legacy-diagrams/oa-frequency-content.cjs --check
NOTES_OA_FREQUENCY_EVIDENCE=/tmp/notes-oa-frequency-evidence-jekCyU node dev/legacy-diagrams/oa-frequency-test.cjs
node dev/legacy-diagrams/oa-frequency-browser-test.cjs
```

The unit test independently evaluates both conventions for every bin count 5–16
using Python's exact `Fraction` arithmetic (24 cases). It checks the source data,
the mixed slide columns, totals, endpoint inclusion, excluded points, reversal
and affine invariance, invalid inputs, valid HTML, generator idempotence and
unchanged existing SVGs/adjacent widget code. NumPy and SciPy are not installed in
the system Python: the documentation's formulas were verified with the independent
oracle, not by claiming a library execution that did not occur. The accompanying
Python example supplies the same explicit edges to plotting and counting.

Browser tests exercise both conventions at 5/10/16 bins on desktop and two mobile
widths (1280/390/320), plus the static default at all three widths without JS.
They check chart/table agreement, bar-height scale within floating-point tolerance,
14px SVG text bounds, table-cell bounds, actual keyboard horizontal scrolling,
duplicate IDs, document width and the four adjacent widget interactions. External
highlighting is deliberately unavailable in this suite. Initial harness fixes
replaced exact float equality with a 1e-9 pixel tolerance and selected the frequency
quiz by its summary instead of an incorrect positional index.

Artifacts and before/after screenshots:
`/home/ybc/notes-legacy-review-artifacts/oa-frequency-*` and `oa-stat-before-*`.
All six browser views passed, covering 21 rendered settings in total. The unit
suite passed all 24 bin/convention combinations. Visual inspection covered the
desktop expanded-range chart, the 16-bin table, mobile chart/table scroll endpoints
and the no-JS legacy-table repair. The eight preexisting SVGs remain unchanged;
Plate 8.1's caption, not its diagram, is corrected.

The static fallback adds one inventoried figure element: current totals are
315 pages / 1,030 figures, including 208 chapters / 883 figures in the original
fifteen-course subset. The historical audit was 208/882; the difference is the
previously runtime-only histogram now represented in static HTML, not an extra
traffic dataset or an assertion that all counted figures are correct.

Preview: <http://localhost:8787/oa/cap-08-statistics.html#w-hist> through the
existing SSH tunnel. Production remains at `f0f4bde`, untouched.

## Remaining chapter review — not certified by these tests

Further concrete candidates found while reading the rest of the chapter:

- Median/symmetry equivalence, quantile conventions, variance denominators and
  automatic outlier-removal advice in sections 3–6 and their quiz answers.
- Independently sorting the two scatter-plot columns destroys observational pairs.
- Confidence-interval assumptions in section 9. The coin calculation and Type I/II
  discussion in sections 10–11 have since been reviewed in OA-HYPOTHESIS.md.
- Test-selection classifications in section 12, the plotted coordinates/axes and
  normality claims in Plate 8.8, and the DM statistic/p-value/convention in section 14.

These require source review, worked calculations and visual corrections as
appropriate; merely preserving their old output is not evidence of correctness.
The full-site goal remains active beyond this chapter and this checkpoint.
