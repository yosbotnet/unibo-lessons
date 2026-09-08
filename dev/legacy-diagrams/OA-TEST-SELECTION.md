# OA test selection: targets, design and assumptions

Scope: section 12, its TOC entry and two matching quiz answers in
`oa/cap-08-statistics.html`. Baseline: `954a22c`. All existing figures and script
blocks remain byte-identical. This is a content/table correction, not a new
diagram family, automatic statistical advisor or raster illustration.

## Evidence and corrected claims

The original local inferential slide extraction, slides 33–36, was read at
`/home/ybc/content/unibo-course-slides/68996-Operational Analytics/7 - Statistics_ inferential.txt`.
The original chapter's section/table was inspected in the browser and captured
as `oa-selection-before.png` before editing. In particular:

- The text treated parametric as usually Gaussian and non-parametric as having
  no assumptions, universally lower power and less flexibility. The replacement
  explains finite-parameter families and method-specific sampling assumptions.
- The three slide motivations (non-normality, small samples and ordinal scales)
  are retained as considerations, not sufficient rules selecting a valid test.
- Point-biserial and phi were placed among generic non-parametric alternatives
  to Pearson. They are now identified as Pearson coefficients for appropriate
  binary coding; estimation of association is distinguished from inference.
- Categorical goodness of fit and contingency-table independence are separate.
- Paired t, signed-rank, Welch and Mann–Whitney have different nulls and conditions.
  In particular, rank tests are not automatically mean or median tests.
- Omnibus group comparisons are separate from prespecified ordered alternatives.
  Page's L is restored to repeated-subject/block trends, not factorial designs.
  Jonckheere–Terpstra concerns ordered independent groups.
- Shared CV splits create matching, not independent fold-score differences.
  Forecasting comparisons additionally need temporal/design assumptions.

The revision uses three native HTML tables with ten source records in
`oa-selection-content.cjs`. Each row provides the design, candidate procedures
and limitations. The records generate content only; they do not choose a test
from user inputs or certify assumptions. Reproduce with `--check` or print a
patch without that option; apply chapter patches using `apply_patch`.

## Primary-source trail — 8 September 2026

Thirteen captured pages are pinned by SHA-256 in `oa-selection-test.cjs`:
`/tmp/notes-oa-selection-evidence-WuDJKz/`.

- SciPy official documentation for `chisquare`, `chi2_contingency`,
  `pointbiserialr`, `ttest_ind`, `wilcoxon`, `mannwhitneyu`, `f_oneway`, `kruskal`,
  `friedmanchisquare` and `page_trend_test`: hypotheses, independence/paired
  structure, variance/shape assumptions, repeated blocks and ordered alternatives.
  Direct links are in the corresponding chapter rows and source records.
- [statsmodels AnovaRM](https://www.statsmodels.org/stable/generated/statsmodels.stats.anova.AnovaRM.html):
  repeated-measures scope and implementation limitations. Linking this reference
  does not claim that its API implements every mixed design or sphericity correction.
- [DescTools Jonckheere–Terpstra](https://andrisignorell.github.io/DescTools/reference/JonckheereTerpstraTest.html):
  ordered group alternatives. No R package was installed or executed.
- [scikit-learn model-comparison example](https://scikit-learn.org/stable/auto_examples/model_selection/plot_grid_search_stats.html):
  dependent CV scores and the variance correction in that example. No universal
  corrected-t prescription is asserted for arbitrary evaluation designs, and the
  grid search itself was not run.

The live SciPy pages identify themselves as 1.18.0; numerical checks reuse the
previous isolated Python 3.13.5 environment with NumPy 2.3.3 and SciPy 1.16.2.
No site runtime or system packages were changed.

## Verification

The selection test checks source hashes, the slide hash, ten explicit row
contracts, HTML parsing and exact reconstruction from the baseline. Every
unowned section, all SVGs and all script blocks remain identical. Earlier OA
tests now compose this explicit subsequent transform rather than treating their
old whole-page snapshots as permanently immutable.

Synthetic development-only algebra checks verify:

- point-biserial equals Pearson for the same binary/quantitative vectors;
- phi equals binary Pearson, and uncorrected 2×2 chi-square equals n·phi²;
- Page's L = 40 for three chosen rank rows, with 19 of all 216 within-block
  permutations in its upper tail; reversing the predicted order changes the
  Page result while the Friedman statistic remains unchanged;
- reversing just one sample changes the paired t statistic but leaves the
  independent-sample statistic unchanged.

These are algebra/ordering checks, not claims about real experimental data, a
simulation proving universal test validity, or a recommendation to use asymptotic
tests on these tiny examples. The test-selection content is justified by the
reviewed sources and explicit design limits, not by word-presence assertions alone.

The browser suite checks all ten rows and three tables at 1280/390/320px, with and
without JavaScript. It verifies native headings, complete cell content, text
bounds, no font below 14px, full-page width, keyboard horizontal scrolling,
quizzes and five adjacent widget responses. Desktop tables and the 320px no-JS
rightmost comparison column and CV callout were visually inspected. The old
table heading default was below 14px; the scoped new headings were increased,
not reduced to fit. No overflow is hidden.

```sh
node dev/legacy-diagrams/oa-selection-content.cjs --check
NOTES_OA_SELECTION_EVIDENCE=/tmp/notes-oa-selection-evidence-WuDJKz \
NOTES_OA_SELECTION_PYTHON=/tmp/notes-oa-qq-evidence-vH19dr/venv/bin/python \
  node dev/legacy-diagrams/oa-selection-test.cjs
node dev/legacy-diagrams/oa-selection-browser-test.cjs
```

Reports/screenshots: `/home/ybc/notes-legacy-review-artifacts/oa-selection-*`.
Preview: <http://localhost:8787/oa/cap-08-statistics.html#s12> via the SSH tunnel.
Production is separate; no publication or service restart is included.

Completed verification on 8 September 2026: the ten-row content/source suite and
all six selection browser views passed. The earlier histogram, coin and Q–Q
arithmetic suites passed with the composed section transform; their 21-case,
102-case and six-view browser regressions also passed. Production HEAD was
rechecked at `f0f4bde`; this revision remains on the dedicated preview branch.

## Remaining scope

Subsequent checkpoint: [OA-FORECAST-COMPARISON.md](OA-FORECAST-COMPARISON.md)
corrects section 14's arithmetic/interpretation and exposes its source-alignment
ambiguity. The list below records the original selection checkpoint.

Section 14's Diebold–Mariano example still needs a numerical/methodological review,
as do descriptive summaries, the scatter widget, distribution/CLT assumptions and
confidence intervals elsewhere in this chapter. The original 15-course and wider
site review remains active; these ten reviewed rows do not certify that scope.
