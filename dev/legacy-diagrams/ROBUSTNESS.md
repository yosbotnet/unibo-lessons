# Adversarial training and Gaussian smoothing

Both Cybersecurity chapter-05 versions replace their incorrect defense summaries,
training pseudocode and quizzes. Two shared native SVGs use the existing Mermaid
adapter, original embedded IBM Plex Mono, ivory/cobalt/vermilion and angular
connectors. No image generation, production deploy or service restart.

Preview through the existing SSH tunnel:

- `http://localhost:8787/cybersecurity/Cyber-05-AI-Security.html#s9`
- `http://localhost:8787/cybersecurity/Cyber-05-AI-Security.html#s10`
- `http://localhost:8787/cybersecurity-reworked/Cyber-05-AI-Security.html#s9`

## Confirmed defects and changes

The old training table gave unconditional yes/no robustness by training attack,
asserted a universal clean-accuracy penalty increasing with attack strength, and
treated two sequential parameter updates as a necessary clean/adversarial mixture.
The replacement distinguishes the robust objective, finite inner input search,
outer parameter step and an optional, explicit single-update weighted loss. It
does not claim that a finite attack finds the true maximum. Clean-data accuracy is
measured, not guaranteed by an extra update. The figure shows one iteration.

The old smoothing account said noise cancels the adversarial direction, required
noise retraining as a theorem assumption, omitted the norm/radius/confidence and
abstention details, and conflated 100–1000 prediction samples with certification
cost. The new figure and algorithm separate independent class selection and
probability estimation. Text distinguishes f and g, strict local L2 stability and
label correctness, probability bounds and vote fractions, empirical testing and
certification. It no longer treats adversarial training as synonymous with gradient
obfuscation or as incompatible with a separately certified smoothed model.

## Primary evidence

- [Madry et al., arXiv v4, §2](https://arxiv.org/pdf/1706.06083v4): threat set,
  min-max objective and inner/outer optimization interpretation.
- [Athalye et al., §§5–6](https://arxiv.org/pdf/1802.00420): the particular evaluated
  defenses and the need to evaluate actual defense behavior, including adaptive
  attacks. It does not establish that every adversarially trained model relies
  on obfuscated gradients.
- [Cohen et al., ICML 2019](https://proceedings.mlr.press/v97/cohen19c/cohen19c.pdf):
  Theorem 1, §3.2.2 / Proposition 2, §3.3 and the §4 sampling configuration.
  The certification page was also rendered and visually inspected.
- [Authors' core implementation](https://github.com/locuslab/smoothing/blob/master/code/core.py):
  two sample batches, frozen selected class, one-sided Clopper–Pearson and
  Gaussian standard deviation sigma. The printed second sampling call has sigma²,
  while the released code uses the same sigma for both batches; this reconstruction
  follows the consistent Gaussian distribution and released implementation.
- Local course slides: `/home/ybc/content/exams/Cybersecurity/AdvEx.pdf` and its
  `slides-text/AdvEx.txt`, defense section. The oversimplifications are present in
  that slide text; the revision retains the topics but checks the actual sources.

Reviewed local sources: `/tmp/notes-smoothing-evidence-5vwv0Q/cohen.pdf` and
`core.py`. SHA-256 respectively:

```
409715d2ae1cd52d39b0a78ed1227edbdaa575be76dd40ab66b9869e97de4551
194857134fbcf4770a3d1823b5902123b391a1cc828298d6e3b8a0a7f67fb4d6
```

## Computational example and limits

`cybersecurity/assets/smoothing-model.cjs` implements binomial upper tails by a
log-PMF recurrence/log-sum-exp, lower bounds by bisection (with endpoint cases),
and normal quantiles by inversion of a convergent normal-CDF series. It accepts
1–10,000 counts, alpha in [1e-6,0.1], sigma in (0,10], and 2–20 classes. Its numeric
quantile helper supports probabilities in [1e-6,1-1e-6]. These implementation
limits are not limits on the theorem or the authors' 100,000-sample experiment.

All four fixtures are explicitly invented counts. They do not simulate a trained
network or claim to demonstrate empirical attack resistance. The same selected
class is retained for 90/100, 60/100, 10/100 and 100/100 estimation outcomes. The
middle two abstain; unanimity has finite radius. The model cannot establish that
externally supplied counts actually came from independent Gaussian samples.

This is educational double-precision software. Bisection's lower endpoint is not
an outward-rounding proof for the floating-point tail computation. The chapter
distinguishes the mathematical statistical certificate from these illustrative
rounded calculations; it does not advertise this module as a certified numeric
library. Equality at pLower=0.5 abstains, consistent with the paper's positive-radius
pseudocode (the released code instead permits a zero-radius return).

## Reproduction and verification

```sh
node dev/legacy-diagrams/robustness-content.cjs           # emit absolute patch
# Apply emitted chapter patch with apply_patch; never hand-edit generated SVG.
node dev/legacy-diagrams/robustness-content.cjs --check
NOTES_COHEN_PDF=/path/to/cohen.pdf NOTES_SMOOTHING_CORE=/path/to/core.py node dev/legacy-diagrams/smoothing-test.cjs
node dev/legacy-diagrams/robustness-browser-test.cjs
node dev/legacy-diagrams/font-test.cjs
node dev/legacy-diagrams/fgsm-content.cjs --check
node dev/legacy-diagrams/transfer-content.cjs --check
node dev/legacy-diagrams/transfer-browser-test.cjs
```

`robustness-sources.cjs` is coordinate-free. `robustness-content.cjs` owns both
defense sections, the shared figures, numerical table and the related quiz answer.
It preserves the original section IDs, including the reworked version's combined
defense section and its following privacy section. These two shared flowcharts
are not silently added to the older 39-entry migration registry.

The numerical oracle uses Python standard-library exact integer combinations and
NormalDist, not the production recurrence or CDF series: 90 lower bounds and 11
quantiles. There are 450 finite-grid coverage checks, high-count endpoint checks,
13 invalid-input checks, monotonic confidence/sigma checks, input immutability,
selection tie and exact half-probability cases. This is not a proof for all inputs.
The same one-versus-rest count calculation is checked with three classes too.

Browser verification checks both graphs' complete directed edges, deterministic
SVG, XML, bounds and label collisions; both chapters at 1280/390/320px with and
without JavaScript; actual image loading, native sizes, keyboard scrolling,
every table cell and its text containment, code/formula regions, served model
download, stable IDs and corrected quiz. Font verification includes 46 assets.
Artifacts are in `/home/ybc/notes-legacy-review-artifacts/`.

Existing-widget regressions also passed: eight transfer chapter views, twelve
FGSM views plus two initialization-failure fallbacks, and the broader suite's 26
desktop/mobile page visits plus 13 no-JavaScript pages. The updated inventory has
315 pages and 1,009 figure elements (four new instances sharing two SVG assets);
the original fifteen-course scope remains 208 chapters / 882 figures.

## Open scope

The physical-attack claims, asserted OOD percentage, generic feature/neuron
explanations, RL aside, privacy/memorization, LLM and agentic material still require
review. Existing audio has not been regenerated. The full-site goal remains open;
these checks are not approval of every diagram or all scientific content.
Production and preexisting root review/index/report edits remain untouched.
