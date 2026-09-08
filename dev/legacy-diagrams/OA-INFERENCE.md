# OA sampling, CLT and confidence intervals

This checkpoint covers statistics sections 8–9, plates 8.3–8.5, the CI widget,
and the two CLT/z-score quiz answers. It does not establish valid statistical
inference for the recorded traffic days or certify the rest of the site.

## What changed

- Plate 8.3 retains population/sample structure, with complete orthogonal arrows,
  14px labels and the shared ivory/cobalt/vermilion theme. The erroneous caption
  identifying the gap between arrows as sampling error is removed. Estimation
  is conditional on a design/model, not guaranteed recovery or unbiasedness.
- The CLT now distinguishes observations per sample `n` from repetitions `R`,
  gives the i.i.d./finite-positive-variance conditions, and separates exact normal
  sampling from asymptotic approximation. Dependence, finite-population sampling
  and the Cauchy counterexample prevent the former blanket endorsement of tests.
- A new analytic figure compares the standardized means of independent
  Exponential(rate 1) observations at n = 4, 16, 64 against N(0,1), with the same
  scales in all panels. These are calculated densities, not empirical histograms.
  Their unstandardized mean SDs and skewness values are in a native table.
- Plate 8.4 keeps the useful calculated normal curve and nested probability-band
  idea, now with an unambiguous z axis, 14px labels and complete brackets. Areas
  are calculated from the CDF and independently integrated, not estimated from
  pixels. Normal population bands are explicitly not mean confidence intervals.
- Plate 8.5 replaces the ambiguous normal-band/CI sketch with a reproducible
  coverage illustration: twenty independent samples of ten N(100,20²) values,
  known σ = 20, seed 20260908. All sample means, intervals, endpoint caps and
  coverage decisions are calculated. True μ = 100 stays fixed. The actual batch
  has 18 covering intervals, not a manufactured 19/20. Native data and reproduction
  code are supplied. This is labelled simulation, not source traffic measurements.
- Confidence, probability and prediction targets are separated, with explicit
  normal-model assumptions. z/t quantile notation is defined in plain text;
  known σ is not confused with sample s. Prediction coverage concerns the joint
  repetition of the original sample and one independent new observation.
- The old CI canvas clipped on mobile, used non-theme fills and called a sample
  SD known σ. It is replaced by shared static/live SVG and native table. Both
  existing sliders remain: n = 5…200; nominal level 80…99.9% in 0.1% steps.
  Without JS the default plot/table remain complete and sliders are disabled.

## Widget interpretation

The 31 August observations still provide mean 4258 and sample SD
720.1479014758011. The widget now explicitly evaluates **hypothetical fixed
summaries**, holding that center and spread constant while n changes. It does
not pretend to collect additional days. It simultaneously compares:

| Target/scenario | Half-width |
| --- | --- |
| Mean CI, hypothetical known σ | z(1−α/2) σ/√n |
| Mean CI, estimated s under independent normal sampling | t(1−α/2,n−1) s/√n |
| One future observation under the same normal model | t(1−α/2,n−1) s√(1+1/n) |

The z comparison supposes σ numerically equal to s; it does not make σ known for
the traffic data. The diagram's numeric axis expands to contain all endpoints,
and that changing scale is stated in the diagram and caption. Negative limits
at extreme settings are retained rather than clipped: the normal model permits
them, illustrating why an assumed model is not automatically suitable for counts.

At n = 31 and 95%, the t mean interval is [3993.85, 4522.15], the hypothetical
known-σ z interval [4004.49, 4511.51], and the t prediction interval
[2763.73, 5752.27]. No confidence claim about real traffic is inferred from these
conditional arithmetic results. The 31 days may also constitute the complete
descriptive period rather than a random sample from an inferential target.

## Implementation and sources

- `oa-inference-model.py`: standard-library normal PDF/CDF, analytic gamma
  densities via log-gamma and the density change of variable, and the seeded
  `random.Random(...).gauss` coverage sample. No numerical runtime dependencies.
- `oa-inference-figures.cjs`: data-derived SVG geometry and orthogonal flow.
- `oa-inference-content.cjs`: owns sections 8–9 and the two quiz answers; prints
  apply_patch changes and checks synchronization. Removes only the old CI IIFE.
- `oa/assets/inference.js`: shared Node/browser model, interval calculations,
  native table and SVG. `inference-widget.js` progressively enhances the default
  markup. `inference.css` is scoped to these two sections and preserves case in
  mathematical table headings.

The browser's quantile calculation is deliberately bounded to the UI, not offered
as a general-purpose statistical library. The normal CDF integrates its convergent
power series on |z| ≤ 4. Integer-df Student CDF uses θ = atan(t/√ν) and the recurrence
for the integral of cos(θ)^(ν−1), with its gamma-ratio normalization calculated by
finite products. Positive critical values are bracketed and bisected. No lookup
interpolation, large vendored numerical library or new production dependency is
required. All allowed confidence/df combinations are checked against SciPy, with
additional direct CDF/coverage tests.

Original inferential slide text:
`/home/ybc/content/unibo-course-slides/68996-Operational Analytics/7 - Statistics_ inferential.txt`

SHA-256: `a1bb74f95203168b0e23701a5a5718f8b951347145ca8c84a8a1efd580004493`.
The relevant opening slides repeat the misleading twenty-repetitions claim,
normal-only z-score definition, rounded percentages and “95% of data” CI labels.
They document the source but are not independent validation of those claims.

Primary references retrieved 8 September 2026:

- [MIT CLT and standardization slides](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/mit18_05_s22_lec06b.pdf).
- [NIST confidence-interval interpretation and known-σ mean formula](https://www.itl.nist.gov/div898/handbook/prc/section1/prc14.htm).
- [NIST t confidence intervals](https://www.itl.nist.gov/div898/handbook/prc/section2/prc221.htm).
- [NIST prediction limits](https://www.itl.nist.gov/div898/software/dataplot/refman1/auxillar/predlimi.htm).
- [SciPy Student distribution](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.t.html).

Five source snapshots are pinned in `oa-inference-test.cjs`, under
`/tmp/notes-oa-inference-evidence-AKzl11`. The independent oracle uses the existing
Python 3.13.5 / NumPy 2.3.3 / SciPy 1.16.2 venv; current SciPy documentation is
1.18.0, not the executed version. The Cauchy stability counterexample is checked
algebraically through the product of its scaled characteristic functions.

## Verification

- All **39,200** n/level combinations: both quantiles, standard errors, all three
  widths/endpoints, bracketing, monotonicity and conditional coverage identities.
  Maximum quantile differences from SciPy: z 2.27e−13, t 1.26e−10.
- 1,764 additional Student CDF cases and 801 normal CDF cases; invalid inputs.
- 2,403 analytic standardized-gamma coordinates and 801 normal coordinates;
  density normalization and three normal-band probabilities by quadrature.
- All 200 seeded observations, twenty means/intervals and 18 coverage decisions;
  all three complete embedded Python snippets executed.
- Six browser configurations: 1280, 390, 320px, with and without JS. Each JS
  viewport exercises 399 distinct states: every n at 95%, every level at n = 31,
  and the four corner combinations. Every displayed widget endpoint/table value
  is checked; this is not falsely described as all 39,200 DOM states.
- All static curve coordinates, closed areas, guide/bracket coordinates,
  population/sample arrow routes and marker targets, coverage endpoint caps,
  true-mean line and dots. SVG XML validity and HTML namespace checks; source
  preservation against `3342846` and idempotent generation.
- 14px SVG text, text bounds/collisions, case-preserving tables, original theme,
  keyboard scrolling and sliders, native details/quiz, no-JS fallback, no page
  overflow, no duplicate IDs or console errors, and five widget smoke tests.
- Eight earlier OA numerical/preservation suites and eight earlier browser
  suites rerun serially. Their explicit reconstruction chains include this
  reviewed transformation. Old CI byte-preservation guards now verify its exact
  removal; the new suite verifies all other script code remains byte-identical.
  The center migration must remove its old widget before removing the CI marker
  it used as a delimiter; the regression test preserves that order.

Desktop/mobile screenshots are visually reviewed in addition to geometry tests.
Wide diagrams and tables scroll on mobile; they are not squeezed or hidden to
pass the checks. Artifacts: `/home/ybc/notes-legacy-review-artifacts/oa-inference-*`.

```sh
node dev/legacy-diagrams/oa-inference-content.cjs --check
NOTES_OA_INFERENCE_EVIDENCE=/tmp/notes-oa-inference-evidence-AKzl11 \
NOTES_OA_INFERENCE_PYTHON=/tmp/notes-oa-qq-evidence-vH19dr/venv/bin/python \
node dev/legacy-diagrams/oa-inference-test.cjs
node dev/legacy-diagrams/oa-inference-browser-test.cjs
```

## Preview and remaining work

Preview through the existing SSH tunnel:
`http://localhost:8787/oa/cap-08-statistics.html#s8`.
Production remains separate and unchanged, pending approval. No service restarts
or paid image generation. The preexisting `review/index.html` and
`review/report.md` changes are untouched.

This closes the identified section 8–9 defects, not the full-site objective.
The source forecast-alignment and missing cross-dataset comparison evidence in
section 14 remain unresolved and explicit; new data/provenance are not invented.
Other OA chapters and the wider course inventory still require visual and
semantic review. Counted figures are not a correctness certificate.

Inventory: 315 HTML pages / 1038 figure elements across the site; 208 chapters /
891 figures in the initial fifteen-course scope. This checkpoint adds the CLT
comparison and static widget figure, while replacing three numbered plates.
