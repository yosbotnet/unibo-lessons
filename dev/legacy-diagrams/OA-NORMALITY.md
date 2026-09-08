# OA normality: calculated Q–Q geometry and explicit test hypotheses

This revision owns section 13, Plate 8.8 and its matching quiz answer in
`oa/cap-08-statistics.html`. Baseline: `dba7547`. It preserves the previously
reviewed frequency and coin sections and all five widget implementations.

## Confirmed errors and changes

The original figure's seven points were hand-positioned near a diagonal, not
calculated from the seven listed values. Its vertical labels increased downward,
its horizontal sample labels sat on the axis, and its 10.5–11px text accompanied
an unsupported “points hug the reference line” conclusion. The claimed 45° line,
mean/standard-deviation line and `qqplot(..., line='q')` also described three
different constructions as if they were interchangeable.

The original slide extraction was read at
`/home/ybc/content/unibo-course-slides/68996-Operational Analytics/7 - Statistics_ inferential.txt`,
slides 37–45. It supplies the seven observations, midpoint positions, 3.85 scale,
rounded table and seeded normality-test example. The chapter's original rendering
was inspected at `oa-qq-before.png` in the artifact directory before replacement.

The revised chapter separates informal summary/histogram checks from calibrated
tests, removes the universal 50-observation and 1%-of-range criteria, and explains
why symmetry is not sufficient. It states which quantity a normality assumption
concerns and does not claim that all parametric methods require normal data.
The printed sample is synthetic; non-rejection does not prove normality.

## Reproducible quantities

Data: −4, −3, 0.8, 1.8, 3.9, 6.2, 6.5.

- Mean = 61/35 = 1.7428571428571429.
- n-denominator variance = 36231/2450; scale dₙ = 3.845538098277811.
- n−1 sample standard deviation = 4.1536558767978295.
- Midpoint positions pᵢ = (i − ½)/7, not their rounded display values.
- Horizontal coordinates: zᵢ = Φ⁻¹(pᵢ); vertical: ordered observations.
- Cobalt reference: y = mean + dₙz. Vermilion marks: observed values.
- A native table also gives qᵢ = mean + dₙzᵢ in the observations' units.

The n-denominator scale deliberately reproduces the slide convention, not an
assertion that 3.85 is the n−1 sample standard deviation. Switching the horizontal
axis to qᵢ would make the reference y = x; a literal screen angle of 45° additionally
requires equal axis unit scales. No confidence band or test verdict is inferred.

`oa-qq-model.py` computes the coordinates with Python's standard library.
`oa-qq-content.cjs` generates the SVG, table, prose and runnable code blocks;
it prints chapter edits for `apply_patch`, never writes the chapter directly.
The model accepts 2–1000 finite observations of magnitude at most 1e6, rejects
constant data and preserves ties. The course drawing is a seven-observation
fixture with explicit axis ranges, not a general chart engine.

## Primary sources read on 8 September 2026

- [NIST normal probability plots](https://www.itl.nist.gov/div898/handbook/eda/section3/normprpl.htm):
  ordered responses versus normal quantiles, approximate linearity and an
  alternative plotting-position convention. The chapter does not falsely assign
  NIST's order-statistic-median convention to its midpoint calculation.
- [statsmodels qqplot](https://www.statsmodels.org/stable/generated/statsmodels.graphics.gofplots.qqplot.html):
  offset a = 0 by default, configurable positions, quartile/reference-line options.
  This documentation was read; statsmodels itself was not installed or executed.
- [SciPy Shapiro–Wilk](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.shapiro.html)
  and [KS API](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.kstest.html):
  the tested hypotheses and parameter arguments. The fetched live documentation
  identifies itself as 1.18.0; the separately pinned validation runtime below is
  1.16.2, not a claim to have executed 1.18.0.
- [NIST KS limitations](https://www.itl.nist.gov/div898/handbook/eda/section3/eda35g.htm):
  standard calibration requires a fully specified continuous distribution;
  parameters fitted on the tested sample require different calibration.

The five HTML captures are pinned by SHA-256 in `oa-qq-test.cjs`, along with the
local slide extraction. Current capture directory:
`/tmp/notes-oa-qq-evidence-vH19dr/`.

## Executed examples and verification

An isolated temporary environment uses Python 3.13.5, NumPy 2.3.3 and SciPy
1.16.2. No system Python packages or site runtime dependencies were changed.
`oa-normality-example.py` preserves the lecture's `RandomState(20)` stream and
prints these results (statistic / p-value, rounded):

| Null hypothesis | Statistic | p-value | At 5% |
| --- | --- | --- | --- |
| Some normal distribution, Shapiro–Wilk | 0.983372 | 0.241025 | Do not reject |
| Specified N(0,1), KS | 1 | 0 (numerical limits) | Reject |
| Specified N(100,20²), KS | 0.0863609 | 0.421188 | Do not reject |

The third null uses known generating parameters, not estimates from those 100
observations. Rejecting the standard-normal null is not rejecting every normal
distribution. The page prints decisions without “Gaussian/non-Gaussian proven”
labels. The executable example is embedded directly from its source file.
For this extreme standard-null mismatch, even the smallest observation
(36.20594421549475) has a computed CDF of exactly 1.0, although its survival
probability is about 2.4542 × 10⁻²⁸⁷. Floating-point saturation already affects
the computed KS statistic; the displayed zero is not an exact mathematical claim.

The arithmetic test compares 1,232 coordinates across 14 datasets with SciPy's
normal inverse CDF and CDF, checks exact-rational means/variances, reversal
invariance, ties and invalid inputs. It also executes both chapter code examples,
checks their outputs, parses the HTML and reconstructs the chapter exactly from
the baseline. Existing coin/frequency tests compose this explicitly scoped
subsequent change; five remaining legacy SVGs stay byte-identical.

The browser test checks the seven actual point positions and reference endpoints,
all native table cells, SVG/XML validity, font size/case, text bounds, duplicate
IDs, full-page width and keyboard scrolling at 1280/390/320px, with and without
JavaScript. All five adjacent widgets receive changed inputs in the JS views.
The inline SVG initially had a bare data attribute valid only in HTML; XML
validation caught it, and it now has an explicit value. Desktop plot/table and
320px no-JS right-scroll screenshots were visually inspected after that fix.

```sh
node dev/legacy-diagrams/oa-qq-content.cjs --check
NOTES_OA_QQ_EVIDENCE=/tmp/notes-oa-qq-evidence-vH19dr \
NOTES_OA_QQ_PYTHON=/tmp/notes-oa-qq-evidence-vH19dr/venv/bin/python \
  node dev/legacy-diagrams/oa-qq-test.cjs
node dev/legacy-diagrams/oa-qq-browser-test.cjs
```

Artifacts: `/home/ybc/notes-legacy-review-artifacts/oa-qq-*`.
Preview: <http://localhost:8787/oa/cap-08-statistics.html#s13> through the SSH tunnel.
No image-generation calls, production writes or service restarts were performed.

Completed checks on 8 September 2026: model/source/HTML tests and all six Q–Q
browser views passed, as did the prior 690-case coin and 24-case histogram
arithmetic suites and their 102-case and 21-case browser regressions. The full
inventory remains 315 pages / 1,030 figures; the count is not a certification.
Production HEAD remains `f0f4bde`. The branch is `feat/editorial-diagram-presets`.

## Remaining scope

This does not certify the chapter or whole site. Descriptive statistics, the
scatter widget, distribution/CLT/confidence-interval assumptions, section 12's
test-selection classifications and section 14's Diebold–Mariano numbers remain
separate review work. The corresponding other quiz answers are not silently
included in this checkpoint. Whole-site review remains active.
