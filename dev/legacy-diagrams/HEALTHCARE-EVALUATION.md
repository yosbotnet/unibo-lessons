# Healthcare evaluation: denominators, deployment and evidence

Both AI Security chapters now share `#healthcare-evaluation`, with subanchors
`#model-deployment` and `#leakage-metrics`. This replaces original section 17 and
reworked section 16, preserving their anchors, example tabs, all script assets
and unrelated widgets. Two recap answers and the “privacy instructions are
necessary” implication are corrected. The new figure is native SVG, not a
generated raster or a screenshot of a table.

## Evidence actually obtained

The course PDF is `/home/ybc/content/exams/Cybersecurity/03 - privacy in LLM.pdf`.
Slide 81 was visually inspected: its formula is the average of binary labels,
whereas its prose describes an any-success event. Slides 82–83 list 10 personas,
five prompts, five repetitions, two models and two conditions. Slide 85 was
visually inspected and its six rows transcribed, retaining all displayed ± terms.
Slides 84/86 supply the approximate baseline and conclusions, not raw outcomes.
The full PDF hash is pinned in `leakage-test.cjs`.

The study exists: publisher-deposited [Crossref metadata](https://api.crossref.org/works/10.1109/PerComWorkshops68308.2026.11585450)
identifies Gianluca Aguzzi, Sara Montagna and Stefano Ferretti, PerCom Workshops
2026, pages 1–6. [Ferretti's publication list](https://stefano-ferretti.github.io/publications/)
also lists it (with a different first-name initial); the publisher metadata is
used for attribution. The DOI is 10.1109/PerComWorkshops68308.2026.11585450.

**The healthcare paper's full text and run logs were not obtained.** IEEE returned
a WAF challenge, the Urbino repository a 403 challenge, and DBLP an anti-bot page.
Searches and the accessible author publication list yielded no downloadable
author copy. No access control was bypassed. Aggregator summaries were discovery
leads, not evidence for the equation, table or clinical conclusions. The revised
lesson explicitly attributes detailed measurements to the slides, not a newly
verified paper or reproduced experiment. This remains an evidence limitation.

Other primary sources:

- [Chen et al., Evaluating Large Language Models Trained on Code](https://arxiv.org/abs/2107.03374),
  v2 PDF: section 2.1, equation 1 and Figure 3, visually inspected on PDF page 3.
  n samples and k attempts differ; k=1 reduces the estimator to c/n. A plug-in
  estimate using 1−(1−p̂)^k is not the same estimator. The new calculation is an
  invented label example, not a code-generation benchmark or healthcare result.
- [Qwen3-1.7B](https://huggingface.co/Qwen/Qwen3-1.7B) and
  [Qwen3-4B](https://huggingface.co/Qwen/Qwen3-4B) author model cards: nominal total
  parameter counts. The [original Qwen3 release](https://qwenlm.github.io/blog/qwen3/)
  describes both serving and local tools, not a size-based residency guarantee.
- Official OpenAI documentation for [gpt-oss-20b](https://developers.openai.com/api/docs/models/gpt-oss-20b)
  distinguishes 21B total / 3.6B active parameters and local/specialized uses.
  It does not validate this study's judge accuracy. The consulted
  [GPT-4 API model page](https://developers.openai.com/api/docs/models/gpt-4)
  does not establish the old >100B estimate; that unsupported table entry is removed.

The OpenAI Docs skill directed official documentation lookup for those model
claims. No API application, keys, API execution, paid generation or models were
installed. The primary research/model-card sources serve different factual claims.
Downloaded evidence is `/tmp/notes-healthcare-evidence-Zy4FoB/`; five files plus
the local slides are SHA-pinned in the source test. Crossref JSON is validated
for title, authors, publisher, DOI and publication year, not treated as full text.

## What the corrections establish

- A per-run mean differs from an OR over repeated runs. In the default invented
  three-scenario/five-run matrix there are 4/15 flagged runs (26.7%) and 2/3
  scenarios with any flag (66.7%). A zero is “not flagged,” not verified safe.
- Reconstructing the balanced design gives 50 scenarios × 5 repeats = 250 runs
  per model/condition, then ×2×2 = 1,000 across all four cells. This is arithmetic
  on the described design, not verification of missing/failed/retried runs.
- The hardened values are transcribed as displayed; the reviewed slide leaves
  the ± aggregation undefined. They are not drawn as assumed confidence intervals.
  Approximate baseline values are not converted into invented exact counts.
- The observed model comparison does not isolate a causal parameter-count effect,
  prove internal cognitive incapacity or settle clinical/regulatory suitability.
  Constructed conditional/cross-reference examples are not observed reasoning.
- Model size, memory format, hosting, cost and authorization are separate choices.
  P×b/8 gives idealized weight bytes: 1.7B/4B at 16 bits cost 3.40/8.00 decimal GB;
  at uniform 4 bits, 0.85/2.00 GB. These exclude KV cache, activations, runtime and
  quantization metadata; they do not establish real file sizes or device fit.

## Code, figure and verification

`cybersecurity/assets/leakage-metrics.cjs` contains the finite public calculation:
`analyze`, `anyOfK(n,c,k)`, `example`, `design` and `weightBytes`. `analyze` accepts
up to 20 scenarios with 1–20 binary labels each and reports pooled rate, mean
scenario rate and any-scenario rate separately. Unequal run counts are supported
and flagged. Invalid/nonbinary/missing labels and duplicate IDs are rejected.
`anyOfK` supports integer 1≤k≤n≤20 and 0≤c≤n; it calculates an any-success
estimator for a k-sample budget, not a probability of at least k successes.

`leakage-plot.cjs` accepts exactly three scenarios with five runs each. All circle
labels, per-row fractions, totals and percentages come from the model. The
750×380 SVG uses embedded original 14px IBM Plex Mono, ivory/cobalt/vermilion,
0/1 labels and no curves. It fits the desktop column and uses native-size mobile
scroll. The same data is in an accessible HTML table. This is not a general chart
engine or a replacement for empirical data.

```sh
NOTES_HEALTHCARE_EVIDENCE=/tmp/notes-healthcare-evidence-Zy4FoB node dev/legacy-diagrams/leakage-test.cjs
node dev/legacy-diagrams/leakage-content.cjs --check
node dev/legacy-diagrams/leakage-browser-test.cjs
node dev/legacy-diagrams/font-test.cjs
```

Running `leakage-content.cjs` without `--check` writes its generated SVG and emits
a chapter patch for apply_patch. Tests enumerate 510 binary label vectors,
4,052 subsets for 240 estimator comparisons, BigInt binomial checks over the
whole supported n/c/k domain, a 400-label boundary case, 48 experimental designs,
eight memory budgets, 18 invalid cases plus a sparse-scenario regression, same-total/different-OR counterexamples
and unequal-weighting cases. Source/markup tests preserve prior widget/script
hooks and compare generated content/asset bytes.

Browser tests cover four plot variants and two chapters × 1280/390/320px ×
JS/no-JS. They check all 15 circle labels and positions, bounds/overlap/XML,
five HTML tables (including exact slide values and computed weights), citations,
downloads, tabs, recaps, keyboard scrolling, no page overflow and desktop fit.
Artifacts are under `/home/ybc/notes-legacy-review-artifacts/leakage-*`.

The first broad regression sequence stopped at FGSM's JS-enabled 320px initial
widget screenshot (the underlying process exited). Ten separate geometry samples
then showed the off-screen 291.21875×1311.90625 widget unchanged, and the isolated
normal screenshot succeeded. Explicit pre-scrolling did not resolve the next
full-run locator timeout. Using the compositor for every JS screenshot produced
correct artifacts but was needlessly slow; that live, progressing test was
deliberately terminated to revise the capture strategy, not mistaken for a dead
process. The FGSM harness now brings the actual course page to the foreground and
uses a normal JS screenshot first. Only a locator TimeoutError triggers the
existing no-JS compositor capture, with three spaced geometry samples and an
additional interactive-state equality check before and after capture. Other
errors still fail. No-JS continues to use the measured capture. PNG dimensions must
match the measured document-coordinate clip; no viewport resize or course CSS
mutation is used. All numerical, SVG, input, keyboard/touch/drag, reset and overflow
assertions remain. Probe artifacts are in the healthcare evidence directory.
One subsequent long-lived browser run timed out finding the widget after a
390px screenshot failure. Each view and initialization-failure case now uses a
fresh browser, with the same complete case matrix and a separate SVG inspector.
This is test isolation, not evidence of a diagnosed course DOM bug or proof of
a specific Chromium resource leak.

## Verified checkpoint — 8 September 2026

The final serial regression process completed with exit code 0; it was observed
to completion, not restarted after an observation timeout. Its reports confirm:

- FGSM: 12 desktop/mobile JS/no-JS views and two failed-initialization fallbacks;
  exact model/SVG agreement, numerical inputs, keyboard, touch, drag, reset,
  zero/clipped/non-flipping steps and no JavaScript errors. Some JS captures
  needed the measured compositor fallback described above; capture latency
  remains a test-harness limitation, not a proven site defect.
- Shared flowchart regression over HTTP: 26 desktop/mobile visits plus native
  image loading on 13 pages without JavaScript; tabs and affected widgets pass.
- Healthcare: four SVG variants and 12 chapter views at 1280/390/320px, with and
  without JavaScript. All 15 labels, five tables, downloads, recaps, tab panels,
  bounds, overflow and keyboard-scroll checks pass on the final content.
- The final source test passes 510 label vectors, 240 estimator comparisons over
  4,052 subsets, 3,080 independent BigInt checks, 48 design products, eight memory
  budgets, 18 invalid inputs and the additional sparse-scenario regression.
  Generated chapter/asset bytes are synchronized and parse5 reports no errors.
- Adjacent agent and transfer regressions had already passed on these chapter
  edits: 12 agent views plus two fallback cases, and eight transfer views.
  The embedded-font test covers 54 SVG assets with the original font and license.

The default trial matrix, the mobile weight table and desktop reported-results
table were also visually inspected. The downloadable calculation module is
formatted and commented so its denominators and assumptions can be read directly;
this does not change the generated figure or numerical results.

The current inventory records 315 HTML pages and 1,025 figure elements; the
original fifteen-course subset remains 208 chapters and 882 figures. These counts
are coverage inventory, not a claim that all those figures have passed review.

Preview: <http://localhost:8787/cybersecurity-reworked/Cyber-05-AI-Security.html#leakage-metrics>
through the existing SSH tunnel. Production was checked at `f0f4bde` and remains
untouched. Preexisting edits to `review/index.html` and `review/report.md` are
excluded from this checkpoint.

## Remaining scope

The study's full text, raw outcomes, judge validation, missing-run handling and
meaning of the ± terms remain unresolved; they are explicitly marked in the
lesson. Regulatory summaries, other clinical literature claims, alignment and
jailbreak material, and audio/narration still need separate review. This is not
completion of all notes. Preview and production remain separate; no deployment
or service restart is part of this checkpoint.
