# OA hypothesis tests: exact coin probabilities and calibrated decisions

This checkpoint replaces sections 10–11, Plates 8.6–8.7 and the coin widget in
`oa/cap-08-statistics.html`. It updates the matching quiz answers and the quiz's
test–interval equivalence statement. Section 9's main discussion/widget, later
test-selection material and the Q–Q plot remain separate review work.

## What was wrong

The previous canvas compared the probability of one count with 5%, labeled that
line a significance threshold and called eight heads in ten a rejection. It
reported a one-sided cumulative probability but treated the wrong single-outcome
comparison as an equally valid “deck convention.” Its displayed formula also had
2⁶ instead of 2¹⁰. The old Plate 8.7 attached 2.5% tail labels to uncalibrated age
bars, with an inverted vertical scale, so its claimed areas were not established
by its geometry. Plate 8.6 routed a vague “chance” box to accept/reject boxes and
had a systematic-error label crossing the data box boundary.

All three were inspected in desktop screenshots before replacement. The original
local slide extraction was read at
`/home/ybc/content/unibo-course-slides/68996-Operational Analytics/7 - Statistics_ inferential.txt`,
including the hypothesis/coin material (slides 17–22) and error discussion
(slides 26–29). Extracted placement of slide verdict labels is not treated as an
unambiguous row-by-row specification. The directly inspected chapter/widget is
the evidence for the incorrect eight-head rejection.

## Exact model and interpretation

Under independent Bernoulli trials with common θ = 0.5 and n = 10:

- P(K = 8) = 45/1024 = 0.0439453125.
- For a prespecified upper alternative, P(K ≥ 8) = 56/1024 = 0.0546875.
- The probability-ordered two-sided p-value is 112/1024 = 0.109375.
- The lower-tail p-value is 1013/1024 = 0.9892578125.

Neither the upper nor the two-sided test rejects eight heads at 5%. Under this
symmetric null, probability ordering and absolute distance from n/2 give the same
two-sided outcomes. No generic equality between all definitions of two-sided
p-values and doubled tails is asserted for asymmetric null distributions.

The wrong single-outcome rule rejects {0,1,2,8,9,10}, giving a Type I error rate
112/1024 = 10.9375%. The nonrandomized level-5% two-sided rule rejects {0,1,9,10},
whose actual null rate is 22/1024 = 2.1484375%, below the nominal level. Against
θ₁ = 0.75, its power is 255910/1048576 ≈ 24.405479%; β is about 75.594521%.
These are exact model calculations, not observations of a physical coin.

The text now separates a p-value from the probability a hypothesis is true,
non-rejection from proof of equality, actual test size from nominal α, and power
from an application-independent ranking of which error is worse. It states the
alternative and threshold before the data and qualifies test–interval duality by
requiring matched constructions and boundary conventions. The rule in this
example is p ≤ α; no ten-flip p-value lies exactly at 0.05.

## Primary evidence — checked 8 September 2026

- [SciPy binomtest documentation](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.binomtest.html)
  and [v1.18.0 source](https://github.com/scipy/scipy/blob/v1.18.0/scipy/stats/_binomtest.py),
  the implementation branches around lines 282–323: lower CDF, upper survival
  probability and probability-ordered two-sided calculation. No SciPy runtime was
  installed or executed; the chapter's Python snippet uses this documented API.
- [NIST critical values and p-values](https://www.itl.nist.gov/div898/handbook/prc/section1/prc131.htm):
  specified test statistic, null-tail probability and advance threshold choice.
  The exact-equality wording about α in this introductory source is qualified
  for the discrete example using its explicitly enumerated rejection probability.
- [ASA's 7 March 2016 release summarizing its statement](https://www.amstat.org/asa/files/pdfs/P-ValueStatement.pdf):
  the six principles distinguish p-values from hypothesis probabilities and
  practical importance, and call for reporting and contextual interpretation.
  This saved PDF is the release/summary, not a claimed copy of the full journal
  article. The browser request failed; direct retrieval succeeded and its text
  was read locally.

Four captures are at `/tmp/notes-oa-coin-evidence-ucd9jT/`: two HTML pages, the ASA
PDF and the versioned SciPy source file. SHA pins plus the local slide hash are
in `oa-coin-test.cjs`. No experiments or external model calls were performed.

## Rendering and generation

Plate 8.6 uses the existing Mermaid-to-static-SVG adapter, with six semantic nodes
and five named connections, not manually positioned SVG elements. Its source is
in `oa-coin-content.cjs`; the asset is `oa/assets/diagrams/oa-testing-workflow.svg`.
The resulting 374 × 489 drawing embeds the actual IBM Plex Mono font and its
license. It uses the established ivory/cobalt/vermilion style and straight/angular
connections, with optional spacing/wrapping constraints from the shared renderer.

Plate 8.7 is generated by `oa/assets/coin-test.js` from integer binomial weights.
Vermilion bars contribute to the selected p-value; an ink outline identifies the
observed count. The highlighted set is explicitly distinguished from the fixed
rejection region. No 5% line is drawn through single-outcome probabilities.
The same model generates the native table and summary; fractions are preserved
until display rounding. The chart stays 700px wide with 14px original monospace
labels and native horizontal scrolling, not smaller mobile text.

The exact model supports fair-null n = 1–20 and validates counts/alternatives.
The course renderer/widget intentionally presents n = 10, not an arbitrary
distribution plotting engine. It computes no data-dependent tail selection.
Special-character escaping is tested for the lower-tail label in both SVG/XML
and HTML. Math spans preserve α, θ and j from the table heading's uppercase style.

The default two-sided eight-head plot and full table are in the static HTML;
controls stay disabled until initialization succeeds. Native worked checks show
the wrong rule's error rate and the alternative-specific power. Other widgets
retain their existing code, with the earlier optional-highlighting guard intact.

## Verification and preview

```sh
node dev/legacy-diagrams/oa-coin-content.cjs
# Applies no chapter edits: apply the printed patch using apply_patch.
# The generator does write its derived SVG asset.
node dev/legacy-diagrams/oa-coin-content.cjs --check
NOTES_OA_COIN_EVIDENCE=/tmp/notes-oa-coin-evidence-ucd9jT node dev/legacy-diagrams/oa-coin-test.cjs
node dev/legacy-diagrams/oa-coin-browser-test.cjs
node dev/legacy-diagrams/font-test.cjs
```

The arithmetic suite checks 690 n/count/alternative cases against an independent
Python integer oracle, enumerates all 1,024 ten-flip sequences, checks valid
levels for n = 1–20 and validates invalid inputs and source pins. Exact chapter
reconstruction from `0de08d7`, HTML parsing and generator idempotence bound the
authored changes. The frequency test now composes this explicit subsequent
transform while separately preserving its own reviewed sections and model.

The browser suite covers all 33 count/alternative combinations at each of
1280/390/320px, plus the no-JS static case at each width: 102 rendered cases across
six views. It checks bar geometry, highlighted sets, exact table/summary agreement,
SVG/XML validity, typography, scroll access, links to the matching quiz, duplicate
IDs, document width, native details and adjacent widget responses. External
highlighting remains blocked during testing. The shared font suite includes this
new asset among 57 SVGs with the exact embedded font/license.

Before/after screenshots and test JSON:
`/home/ybc/notes-legacy-review-artifacts/oa-coin-*`.
Preview: <http://localhost:8787/oa/cap-08-statistics.html#w-coin> via the existing
SSH tunnel. Production was not modified; no paid image calls were made.

Verification completed on 8 September 2026: the 690-case arithmetic suite,
102-case/six-view coin browser suite, 24-case frequency regression suite,
six-view frequency browser regression and 57-asset embedded-font check passed.
Desktop workflow/plot and 320px no-JS table/power screenshots were inspected;
the lower-case α in headings remains intact and the rightmost table column is
reachable by keyboard scrolling. Migration history stays in this review note;
the lesson source's caption describes the statistical example itself.
The inventory remains 315 pages and 1,030 figures, not a correctness certificate.
Production HEAD was checked at `f0f4bde`; this checkpoint is preview-only.

## Remaining work

Subsequent checkpoint: [OA-NORMALITY.md](OA-NORMALITY.md) now documents section 13,
the calculated Q–Q plot and its quiz. The remaining-work list below records what
was open at the original coin checkpoint, not an instruction to undo that review.

This does not certify the entire chapter. Still open: descriptive summaries and
quantile conventions, variance/CV and outlier advice, paired scatter data,
distribution/CLT/interval assumptions in sections 7–9, the test-selection table,
normality/Q–Q claims and coordinates, and Diebold–Mariano assumptions/numbers.
The broader site-wide review remains active.
