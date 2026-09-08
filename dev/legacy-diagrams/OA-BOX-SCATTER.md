# OA statistics: box-plots, outliers and observational pairing

Scope: section 6 and its matching revision question in
`oa/cap-08-statistics.html`, based on chapter baseline `b893dce`.
This checkpoint replaces Plate 8.2 and the canvas box widget with calculated
SVG, and adds an explicitly synthetic scatter counterexample. It does not
certify the rest of OA or the full notes site. Production is unchanged.

## Confirmed defects and repairs

- Plate 8.2 placed Q1=69, median=74, Q3=77 and max=80 at inconsistent horizontal
  distances; Q3 and max even shared an x-coordinate. It added an outlier absent
  from the twelve source speeds. The replacement uses one linear scale for all
  observations, box, median, mean, fences and whiskers; no invented point.
- The source's median-of-halves quartiles are 69 and 77, with IQR 8 and fences
  57/89. Linear interpolation instead gives 69.5/76.5, IQR 7 and fences 59/87.
  A native table distinguishes the conventions. Both have whiskers 62/80 and
  no flagged observations. Python explicitly supplies the slide statistics to
  `Axes.bxp`, rather than silently using a library's different quartiles.
- The old slider had `step=10`, `min=3000`, `value=5167`: the browser normalized
  it to 5170 immediately. The replacement uses integer steps and starts at
  exactly 5167. Its 31 counts come from the existing shared frequency model.
- The old widget said quartiles never move and rendered tiny, colliding canvas
  labels on mobile. All statistics are now recomputed and provided in a table;
  a fixed 2000–10000 axis makes changes comparable. At 3000 the median is 4406;
  at 9000 it remains 4438 while the mean is 4381.65. The largest original value
  is replaced, not supplemented. Every observation remains in the data.
- Fences are not observations or automatic deletion rules. The prose and quiz
  now distinguish flagging, investigation and justified exclusions. The Gaussian
  has unbounded tails; a known-parameter three-sigma tail is approximately .0027,
  not a guarantee about every sample or a license to trim at 1.5–2 sample SD.
- Slide 36 independently sorts `ago1` and `set1`. Actual Matplotlib execution
  confirms that pandas labels do not restore the pairing. The corrected example
  filters incomplete pairs jointly, and warns that rows must first represent a
  justified match. Sorting whole rows only changes drawing order.
- The two-panel synthetic example uses A=(1,4), B=(2,1), C=(3,3), D=(4,5),
  E=(5,2). Pearson r is 0. Independently sorting the columns gives r=1 while
  keeping both marginal value sets. Right-panel labels expose each x/y source
  identity; only C/C stays matched. This is not a traffic-data result or test.

## Source evidence and limits

Local source, slides 29–36:
`/home/ybc/content/unibo-course-slides/68996-Operational Analytics/6 - Statistics_ descriptive.txt`

SHA256: `c09011b7437bb9972d69782bcad922adef16023ca08b4a9f7b9d30acbb6c929c`.
The test verifies the twelve printed speeds and erroneous scatter call.
The earlier frequency suite independently extracts all 31 August counts from
the slide table. A scoped search found no OA CSV, notebook, Python export or PDF
establishing a defensible August–September matching key. No real cross-month
correlation is asserted. Matching day numbers across months is a design choice,
not simultaneous observation; timestamps/observational provenance remain needed.

Primary documentation inspected on 8 September 2026 and linked in the chapter:

- [Matplotlib boxplot](https://matplotlib.org/stable/api/_as_gen/matplotlib.pyplot.boxplot.html): box/whisker and fence convention.
- [NumPy quantile](https://numpy.org/doc/stable/reference/generated/numpy.quantile.html): explicit interpolation methods.
- [NIST outlier guide](https://www.itl.nist.gov/div898/handbook/eda/section3/eda35h.htm): investigate flags and avoid unjustified removal.
- [NIST scatter guide](https://www.itl.nist.gov/div898/handbook/eda/section3/scatterp.htm): corresponding values, nonlinear structure and association limits.
- [Matplotlib scatter](https://matplotlib.org/stable/api/_as_gen/matplotlib.pyplot.scatter.html): supplied x/y positions.

Snapshots are in `/tmp/notes-oa-box-evidence-MDkUnT`; all five hashes are pinned
in `oa-box-test.cjs`. Live documentation reported Matplotlib 3.11.1 and NumPy 2.5;
execution used explicitly pinned Matplotlib 3.10.6 / NumPy 2.3.3 / SciPy 1.16.2 /
pandas 2.3.2 / Python 3.13.5. Do not describe those as the same versions.
Matplotlib and dependencies were added only to the existing temporary validation
venv at `/tmp/notes-oa-qq-evidence-vH19dr/venv`, not production or site dependencies.

## Implementation and verification

- `oa/assets/boxplot.js`: shared, pure numerical model and static SVG/table
  rendering. General summary methods are explicit (`linear`, `halves`, excluding
  the middle observation for odd-sized halves). Display functions have reviewed
  limits, not an arbitrary auto-layout promise. Pearson returns null for a
  constant marginal instead of an invented coefficient.
- `boxplot-widget.js`: progressive enhancement. With JavaScript off, the full
  original plot and values remain, and the disabled slider is honest.
- `oa-box-content.cjs`: deterministic section/quiz/script transformation; emits
  a patch for apply_patch or checks drift. Authored source is the generator, not
  the inline SVG. SVG custom attributes have explicit values for valid XML.
- All 6501 integer slider positions and eight boundary/tie/constant datasets
  agree with Matplotlib `boxplot_stats`. Their 19,527 quantiles are independently
  checked with exact rational interpolation. Tests include strict fence endpoints,
  invalid input, order/affine invariance, retained records and stable initial data.
- All three chapter Python fragments execute with the pinned runtime. Tests
  inspect actual box paths and scatter offsets, demonstrate the separately sorted
  pandas-index failure, and verify joint missing-pair removal.
- Browser suite: 1280, 390 and 320 px, JavaScript on and off. Fourteen states per
  JS viewport and one static state per no-JS viewport; all point coordinates,
  box/whisker/fence/mean geometry, numeric tables, SVG XML, text bounds and overlaps,
  original font/background tokens, keyboard scrolling and single-step slider
  operation. All five chapter widgets are exercised without external resources.
- Existing frequency/coin/Q–Q/selection/DM tests reconstruct their original
  baselines plus this explicit subsequent transformation. Unrelated sections,
  SVGs and scripts remain byte-identical; preservation tests were not removed.
- Screenshots and machine-readable evidence are under
  `/home/ybc/notes-legacy-review-artifacts/oa-box-*`. Before/after desktop and
  mobile screenshots were inspected, including the rightmost no-JS scatter
  panel and the corrected convention table. Numerical checks do not substitute
  for these visual checks.

Reproduce from repository root:

```sh
node dev/legacy-diagrams/oa-box-content.cjs --check
NOTES_OA_BOX_EVIDENCE=/tmp/notes-oa-box-evidence-MDkUnT \
NOTES_OA_BOX_PYTHON=/tmp/notes-oa-qq-evidence-vH19dr/venv/bin/python \
node dev/legacy-diagrams/oa-box-test.cjs
node dev/legacy-diagrams/oa-box-browser-test.cjs
```

Preview: `http://localhost:8787/oa/cap-08-statistics.html#s6` through the existing
SSH tunnel. No paid image generation, deployment or service restart.

## Remaining work

OA sections 3–5 were subsequently revised with explicit center/skewness,
quartile and variance/CV conventions; see [OA-CENTER-SPREAD.md](OA-CENTER-SPREAD.md).
Sections 7–9 still contain unreviewed
PDF/CDF, distribution-selection, inference and interval claims/widgets. Section 14
retains an explicit unresolved forecast-alignment issue and missing CD score
matrix. Neither this checkpoint nor inventory counts close the full-site goal.

Inventory after this revision: 315 HTML pages / 1033 figure elements; original
fifteen-course scope 208 chapters / 886 figures. The two additional figure elements
are the static box-widget figure and synthetic pairing example, not two previously
existing numbered plates. Counts are not correctness certification.
