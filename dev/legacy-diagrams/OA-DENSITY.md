# OA distributions: density, mass, cumulative probability and fitting

Scope: `oa/cap-08-statistics.html`, section 7 and its PDF/PMF/CDF quiz.
This checkpoint does not certify the later sampling/CLT/confidence-interval
sections, nor the whole course or site. It adds one unnumbered calculated SVG
comparison where the original section had no figure.

## Corrected claims and implementation

- A distribution is not necessarily a smooth theoretical histogram fit.
  Empirical frequencies and a proposed probability model are distinguished.
- PDF height is not point probability. An absolutely continuous model has
  zero point masses even where its density exceeds one. Density is nonnegative,
  integrates to one and may carry inverse measurement units; x can be negative.
- PMF assigns discrete masses. CDF means cumulative **distribution** function,
  applies to discrete and continuous variables, and satisfies
  `F(b) − F(a) = P(a < X ≤ b)`. A fair die demonstrates the jumps/endpoints.
- The normal formula specifies both μ and σ > 0. SciPy `scale` is SD, not variance.
  Standardizing arbitrary observations does not make them normal.
- Fitter/distfit candidates use `norm`, not the nonexistent SciPy name `normal`.
  Both source examples are explicitly synthetic, seeded and limited to three
  candidates. All candidate scores must be finite; failed fits are not silently
  ignored. No traffic-series inference is performed.
- The reported SSE/RSS compares histogram density against PDF values at bin
  centers. It is neither a p-value nor proof of a true generating family.
  A fit leaderboard does not determine whether a statistical test is valid.
  Links point to the revised design/normality sections 12 and 13.
- The original three-tab interaction is retained; without JS all three panels
  remain readable. Runnable Python snippets live in native details elements.
  No browser dependency on Python, NumPy, Fitter or distfit is introduced.

`oa-density-model.py` calculates one fixed example using `math.exp` and
`math.erfc`, with no third-party dependencies. `oa-density-content.cjs` invokes
that model at build time, creates the paths/table and owns the section/quiz.
Generation prints an apply_patch document; `--check` checks synchronization.

The new SVG uses the existing `--lk-paper`, `--lk-mono`, `--lk-cobalt` and
`--lk-vermilion` tokens, 14px labels, and two 401-point calculated polylines.
Curves are mathematical curves, not orthogonally routed graph edges. The shaded
polygon contains 101 sampled PDF points and closes to the baseline. Four vertical
guides, two CDF horizontal guides, two endpoints, the peak dot and the complete
CDF-difference bracket are present and numerically checked. The two panels share
the horizontal scale; the vertical scales intentionally differ.

The 700 × 412 diagram and 640px-minimum native table scroll horizontally on
narrow screens, using the existing visible scroll hint and keyboard-focusable
regions. Nothing is hidden to conceal overflow and fonts are not reduced.
`density.css` is section-scoped; it disables automatic uppercase on all table
headings so `f` and `F` remain visibly different mathematical symbols.

## Calculated example

For X ~ N(0, 0.25²), a = −0.25 and b = 0.25:

| Quantity | Unrounded numerical result |
| --- | --- |
| f(0) | 1.5957691216057308 |
| P(X = 0) | 0 |
| F(a) | 0.15865525393145707 |
| F(b) | 0.8413447460685429 |
| F(b) − F(a) | 0.6826894921370859 |
| Independent SciPy quadrature of PDF on [a,b] | 0.682689492137086 |

The displayed six-decimal values are rounded only for presentation. The numeric
probability is not estimated from SVG pixels or the polygon's trapezoidal area.
The finite x window [−1,1] does not truncate the model's support.

## Sources and executable evidence

The local descriptive-slide text was checked (distribution slides 37–43 and the
fitting examples). It repeats the misleading PDF/CDF wording and `normal`
candidate, so it is evidence of the original example, not independent validation:

`/home/ybc/content/unibo-course-slides/68996-Operational Analytics/6 - Statistics_ descriptive.txt`

SHA-256: `c09011b7437bb9972d69782bcad922adef16023ca08b4a9f7b9d30acbb6c929c`.

Primary API references retrieved 8 September 2026:

- [SciPy norm](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.norm.html)
  for PDF, CDF, location and scale.
- [Fitter reference](https://fitter.readthedocs.io/en/latest/references.html)
  for candidates, fitting, finite-error checks and ranking.
- [distfit functions](https://erdogant.github.io/distfit/pages/html/Functions.html)
  for explicit parametric/RSS, bins, histogram method and bootstrap settings.
- [Fitter package metadata](https://pypi.org/pypi/fitter/json) and
  [distfit package metadata](https://pypi.org/pypi/distfit/json).

Five downloaded snapshots are pinned by hash in `oa-density-test.cjs`, under
`/tmp/notes-oa-density-evidence-HAiHfF`. The installed Fitter/distfit source files
are pinned too: both compute the stated SSE/RSS from density-histogram centers.
The actual code was read, not inferred solely from library names or defaults.

A fresh isolated venv there uses Python 3.13.5, NumPy 2.3.3, SciPy 1.16.2,
pandas 2.3.3, Matplotlib 3.10.7, Fitter 1.8.0 and distfit 2.0.2. It does not modify
the previous OA numerical venv or production dependencies. Current SciPy docs
identify version 1.18.0; the actually executed version is explicitly 1.16.2.

All three complete Python snippets are executed and checked, including the six
normal comparison lines, two 100-bar density histograms and two fitted overlays.
Source samples retain 10,000 observations and their original generating
parameters, with `default_rng(20260908)` added for reproduction. Direct SciPy
fits independently reproduce all six candidates' parameters, scores and rankings.

Observed ranking in this pinned runtime:

| Synthetic sample / tool | norm SSE/RSS | gamma SSE/RSS | expon SSE/RSS |
| --- | --- | --- | --- |
| Gamma / Fitter | 0.071026 | 0.001757 | 0.124832 |
| Normal / distfit | 0.002867 | 0.002859 | 0.698446 |

The normal-generated sample slightly prefers a freely shifted/scaled gamma under
this histogram criterion. That is not a contradiction or a reason to change the
seed until `norm` wins. The large fitted gamma shape and negative location are
recorded in the test artifact; the generating parameters were not fixed during
fitting. No bootstrap goodness-of-fit validation was requested. The snippets draw
only histogram/PDF overlays, avoiding automatic threshold markings that could be
mistaken for confidence intervals for unknown parameters.

## Verification and reproduction

Numerical checks cover all 802 PDF/CDF ordinates, 126 additional normal cases,
invalid inputs, monotonicity, unit total area, interval quadrature and discrete
endpoint conventions. HTML parse and SVG-namespace checks catch escaped formula
errors; browser XML parsing independently validates the complete SVG.

Six browser configurations: 1280, 390 and 320px, each with and without JS.
Tests check every curve coordinate, the complete closed area, all guides/points
and bracket, all table values, SVG text bounds/collisions, 14px labels, theme
equality with the histogram widget, case-preserving headings, tab click/keyboard
behavior, native details/quiz, keyboard scrolling, unique IDs, console errors,
page overflow and five widget smoke tests. Desktop/mobile screenshots are
visually reviewed in addition to geometry checks. Horizontal panning is expected
on mobile; the two full panels are not squeezed into a 320px viewport.

The seven earlier OA numerical/preservation suites and seven earlier browser
suites are also rerun serially. Their baseline reconstruction now explicitly
composes the density transformation last. This checkpoint's test compares against
`1ae5c7a`: all other sections, prior SVGs and scripts remain unchanged, and the
whole output equals the single reviewed transformation. No old assertion is
removed to permit unexplained changes. The pinned original DM script still emits
its previously documented Python `SyntaxWarning` for `\d`; it is not modified.

Artifacts: `/home/ybc/notes-legacy-review-artifacts/oa-density-*`, including JSON
numeric and browser results and before/after screenshots.

```sh
node dev/legacy-diagrams/oa-density-content.cjs --check
NOTES_OA_DENSITY_EVIDENCE=/tmp/notes-oa-density-evidence-HAiHfF \
NOTES_OA_DENSITY_PYTHON=/tmp/notes-oa-density-evidence-HAiHfF/venv/bin/python \
node dev/legacy-diagrams/oa-density-test.cjs
node dev/legacy-diagrams/oa-density-browser-test.cjs
```

## Remaining work and preview

Sections 8–9 still require correction of sampling/CLT claims and the distinction
between population probability bands, confidence intervals and prediction
intervals, including the legacy CI widget. The forecast alignment/CD limitations
remain explicit in section 14. Broader course/site review is still unfinished.

Preview: `http://localhost:8787/oa/cap-08-statistics.html#s7`, through the existing
SSH tunnel. Production remains at `f0f4bde`, pending approval for this revision.
No service restarts or paid image generation. Preexisting `review/index.html`
and `review/report.md` changes are untouched.

Updated inventory: 315 HTML pages / 1036 figures across the full site, with
208 chapters / 889 figures in the original fifteen-course scope. The increase
here is one new unnumbered teaching figure, not a renamed or missing old plate.
These counts do not certify correctness.
