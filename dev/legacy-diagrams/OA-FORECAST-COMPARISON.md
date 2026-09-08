# OA forecast comparison: reproduce the statistic, expose the alignment ambiguity

Scope: section 14, its TOC entry and matching quiz in `oa/cap-08-statistics.html`.
Baseline: `e93df47`. A new unnumbered SVG alignment audit is added; no old figure
is removed or changed. All sections 1–13 and widget scripts remain byte-identical.

## What the source actually says

The local inferential slide extraction was read through slides 64–68, at
`/home/ybc/content/unibo-course-slides/68996-Operational Analytics/7 - Statistics_ inferential.txt`.
The chapter's original section was rendered and inspected in `oa-dm-before.png`.

Slide 66 begins the MLP array with 414.231, 417.662, 381.815. Slide 67's executable
example moves 414.231 to the end and shifts every other prediction left. The
actual and LSTM sequences do not move. The old chapter presented only the code
ordering without flagging this conflict, and interpreted the output as verified
predictive superiority. The available material does not settle which ordering
has the correct forecast target timestamps.

The linked implementation applies Harvey–Leybourne–Newbold scaling and a
two-sided Student t tail with 11 df. The old explanation instead paired that
output with a normal ±1.96 cutoff and called the p-value a probability of chance.
Both interpretations were corrected, as were claims of equivalence from a
critical-difference crossbar and a universal t law whenever variance is unknown.

## Verified calculations, not verified model performance

For squared-error differences d = loss(MLP) − loss(LSTM), n = 12 and h = 1:

| Printed MLP sequence | Mean loss difference | Modified statistic | Two-sided t p-value |
| --- | --- | --- | --- |
| Slide 66 list | 2437.345239916666… | 3.4290525986084304 | 0.005632468889644067 |
| Slide 67 code | 224.918406583333… | 2.933300449662608 | 0.013609843048263027 |

The matching two-sided 5% t₁₁ cutoff is ±2.200985160082949. For the code sequence,
the unmodified statistic is 3.0637323989463674; its asymptotic normal-tail p-value
is 0.0021859434709694922. These are different test variants, not interchangeable
pieces of one calculation.

At h = 1, the linked code uses only lag-zero covariance, with denominator n,
and multiplies the unmodified statistic by √((n−1)/n). Algebraically this equals
the ordinary t statistic of the loss differences. It does not establish their
independence, normality or the suitability of ignoring nonzero lags. The new text
explicitly limits the small-sample interpretation and does not claim that mere
covariance stationarity is a sufficient central-limit theorem.

The LSTM values differ from each actual by at most 0.001; their calculated MSE is
approximately 5×10⁻⁷. This is a reason to inspect the pipeline/provenance, not a
finding that leakage occurred, nor proof of exceptional generalization.

## Primary sources and access scope — 8 September 2026

- [John Tsang's slide-linked implementation](https://github.com/johntwk/Diebold-Mariano-Test/blob/c880f1af55a7552a020fdb4a166dc615b3fe74c2/dm_test.py),
  commit `c880f1af55a7552a020fdb4a166dc615b3fe74c2`: all 163 lines inspected before
  execution. The captured unchanged function was executed on both source arrays.
  Its legacy regex emits a Python 3.13 SyntaxWarning; no source monkeypatch or
  warning suppression was used, and the MSE/h=1 computations completed.
- [forecast dm.test documentation](https://pkg.robjhyndman.com/forecast/reference/dm.test.html)
  and its linked R source were inspected for modified-test and variance-estimator
  conventions. R was not installed or executed in this checkpoint.
- [Diebold's 2012 working paper](https://economics.sas.upenn.edu/sites/default/files/filevault/12-035.pdf),
  PIER 12-035, dated 7 September 2012: title/abstract, introduction and section 2.1
  were read, including the loss differential and serial-correlation discussion.
  The browser refused the URL; direct retrieval and local PDF text extraction
  succeeded. This is not described as the full 2015 journal article.
- [scikit-posthocs critical-difference diagram API](https://scikit-posthocs.readthedocs.io/en/latest/generated/scikit_posthocs.critical_difference_diagram.html):
  average ranks, corresponding post-hoc p-value matrix and crossbars for
  non-rejection. No fabricated score matrix or concrete five-method plot was made.

Four primary captures and the local slide are SHA-pinned in `oa-dm-test.cjs`.
Capture directory: `/tmp/notes-oa-dm-evidence-TGdk0V/`.
Searching the available content files for the inferential PDF, prediction exports
and `critical_difference_diagram` found only the existing inferential text file;
the timestamped arrays and original score/p-value matrices remain unavailable.

## Generation and verification

`oa-dm-model.py` calculates the fixed twelve-position squared-loss/h=1 example.
It rejects mismatched lengths, nonfinite/non-numeric input, excessive magnitudes
and zero loss-difference variance. It is intentionally not a general DM library
or an automatic forecast-validity checker. Its output is the derived
`oa-dm-values.json`, compared with fresh model output by the tests. Regenerate the
JSON with the pinned Python, apply the resulting file update with `apply_patch`,
then run `oa-dm-content.cjs` to print the chapter patch. Do not hand-edit its values
or the generated SVG.

The SVG bars are calculated from both arrays on one common linear scale. Its
horizontal coordinate is explicitly a printed position, not a certified date.
Small bars remain small; the complete values are available in a native table.
The original ivory/cobalt/vermilion palette and 14px monospace labels are used.
Both tables fit the desktop content area and remain keyboard-scrollable on mobile.
Shortening their headings, not shrinking the font, resolved narrow header cells.

Tests independently check 24 losses with exact decimal fractions, both outputs
against the pinned original implementation, sign reversal under forecast swap,
scale invariance and the h=1 t-statistic identity. They also execute the embedded
chapter Python example, compare its JSON output, parse HTML, verify the source
array rotation and protect all other sections/SVGs/scripts. Earlier OA tests
compose this explicitly scoped subsequent change.

Python runtime: existing isolated Python 3.13.5, NumPy 2.3.3, SciPy 1.16.2;
pandas 2.3.2 was added only to that temporary environment to run the unmodified
slide-linked function. System Python, production dependencies and services were
not changed. There were no training runs or paid image calls.

```sh
node dev/legacy-diagrams/oa-dm-content.cjs --check
NOTES_OA_DM_EVIDENCE=/tmp/notes-oa-dm-evidence-TGdk0V \
NOTES_OA_DM_PYTHON=/tmp/notes-oa-qq-evidence-vH19dr/venv/bin/python \
  node dev/legacy-diagrams/oa-dm-test.cjs
node dev/legacy-diagrams/oa-dm-browser-test.cjs
```

The browser suite covers all 24 bars, 12 source rows and two result rows at
1280/390/320px, with and without JavaScript. It checks geometry, XML, typography,
table text bounds, keyboard scrolling, quiz/reproduction details, duplicate IDs,
full-page width and five widget responses. Before/after desktop and mobile
screenshots were inspected. Reports: `/home/ybc/notes-legacy-review-artifacts/oa-dm-*`.
Preview: <http://localhost:8787/oa/cap-08-statistics.html#s14> via the SSH tunnel.

Completed verification on 8 September 2026: both-order arithmetic/source tests
and all six DM browser views passed. Histogram, coin, Q–Q and selection unit
regressions passed, and all four of their browser suites passed after the final
table layout. The inventory is now 315 pages / 1,031 figures (208 / 884 in the
original 15-course scope), reflecting the one new alignment-audit plot rather
than a coverage certificate. Production HEAD remains `f0f4bde`.

## Remaining scope

The arithmetic and interpretation errors in this section are corrected. Temporal
alignment and out-of-sample provenance cannot be certified from the conflicting
source arrays, and the slide's specific five-method significance crossbars cannot
be reconstructed without their underlying data. These limitations are visible in
the lesson, not hidden by significant p-values. Descriptive statistics, scatter,
distribution/CLT and interval material elsewhere still require review; the full
site goal remains active.
