# Feature sensitivity: calculated geometry, not a neuron template

Both Cybersecurity chapter-05 versions now share a native two-panel SVG, a
downloadable numerical model, five corrected perspective panels and a revised
quiz. Introductory claims about neuron interpretation, random noise and downstream
system impact are qualified too. The reworked chapter's separate CIA introduction
is outside this revision.

## Mathematical and visual contract

`cybersecurity/assets/feature-model.cjs` defines an invented two-point distribution:
y is equally likely −1 or +1; x=(y,ηy). True labels in the neighborhood are sign(u),
with sign(0)=+1. The default η=.1 and L∞ budget ε=.2 give two normalized features
u and v/η, each with mean zero, variance one and clean E[yf]=1.

The same δ=(−εy,−εy) is shown in both panels. It attains the minimum signed score
for both features: 1−ε=.8 and 1−ε/η=−1 respectively. Ground truth is unchanged.
The two candidate predictions are correct using u and both incorrect using v/η.
For any linear score the shared helper computes
`y*(wᵀx+b) − ε*(|w₁|+|w₂|)`, with finite-result validation.

The renderer derives point positions, equal axis scales, complete budget squares,
decision boundaries, arrows, colors and counts from that model. Color denotes
prediction, never a changed true label. Circular clean points and outlined square
candidates retain their positions between panels. Arrows are straight diagonals;
zero perturbations have no arrow, and very short steps have no oversized arrowhead.
It is a quantitative plot renderer, not a general graph layout or neural-network
experiment. It uses the shared ivory/cobalt/vermilion palette and embedded original
IBM Plex Mono at 14px. Labels do not shrink; the native image scrolls on mobile.
Explanations and the score table remain HTML outside the tab panels.

Supported parameters: η∈[.02,.4], ε∈[0,.8]. This keeps the true label fixed in
the entire permitted box and the plot geometry within its calculated canvas.
Unknown option keys, non-object options and invalid numeric inputs fail. Defaults
are frozen. Variant rendering does not imply a stable classifier for every ε:
the ε=η tie uses the explicit +1 rule. This is not an empirical OOD experiment;
leaving the toy distribution's two-point support says nothing universal about
real adversarial images or human perception.

## Sources and corrections

The local course source is
`/home/ybc/content/exams/Cybersecurity/slides-text/AdvEx.txt`, especially its neuron
experiment and five-hypothesis slides. Primary papers delimit the slide claims:

- [Szegedy et al., §3](https://arxiv.org/pdf/1312.6199v4): semantically related
  activating images occur for both individual units and random combinations in
  the examined networks. This does not prove all individual neurons uninterpretable.
- [Goodfellow et al., §§3–4](https://arxiv.org/pdf/1412.6572v3): the linear argument
  depends on margin and allowed perturbation, not nonlinearity alone. The panda
  introduction shares the separately checked model/units in `FGSM.md`.
- [Schmidt et al.](https://proceedings.neurips.cc/paper_files/paper/2018/file/f708f064faaf32a43e4d3c784e6af9ea-Paper.pdf):
  robust sample requirements differ between specified Gaussian and binary settings;
  this is not a universal exponential-data law.
- [Ilyas et al., §2](https://arxiv.org/pdf/1905.02175): normalized-feature usefulness
  and worst-case usefulness are average criteria. Footnote 1 explicitly allows
  other sources of adversarial vulnerability. Robustness is not defined through
  human interpretability.
- [Amich & Eshete](https://arxiv.org/pdf/2202.08944v1): the preliminary CIFAR-10
  experiment reports SSD flagging 90% of FGSM and 87% of PGD samples as OOD. These
  detector-specific results do not support the notes' universal “~75%” statement.
  Approximately 75% also occurs for the different relative-robustness metric;
  we do not claim to know how the slides obtained their number.
- [Stutz et al.](https://openaccess.thecvf.com/content_CVPR_2019/papers/Stutz_Disentangling_Adversarial_Robustness_and_Generalization_CVPR_2019_paper.pdf):
  label-preserving on-manifold adversarial examples are studied using known or
  estimated manifolds; OOD and adversarial error are not interchangeable definitions.

Pinned PDF SHA-256 values used by the transcription checks:

- Amich: `a472a18e177d1cd18b3578f1f790ad596f2a7eb88381c0389f81215909654935`
- Ilyas: `81c3715d1e256579071591f3bc61f55d63b32a33dcc981026209d14d32990f32`

The PDF introduction/feature-definition pages were also visually inspected.
Published experiments were not rerun. Text-match checks alone are not scientific
verification; the source qualifications above and analytic example are essential.

## Reproduction and verification

```sh
node dev/legacy-diagrams/feature-content.cjs
# Apply any printed chapter patch with apply_patch.
node dev/legacy-diagrams/feature-content.cjs --check
NOTES_AMICH_PDF=/path/to/amich.pdf NOTES_ILYAS_PDF=/path/to/ilyas.pdf node dev/legacy-diagrams/feature-test.cjs
node dev/legacy-diagrams/feature-browser-test.cjs
node dev/legacy-diagrams/font-test.cjs
```

The numerical test checks 40 normalized-feature configurations and 2,430 general
linear-box minima against independent corner enumeration, default/tie/zero cases,
input immutability, 16 invalid inputs and pinned primary-source transcriptions.
The browser suite checks four plot variants for XML, text overlap/bounds, marker
counts, exact shared coordinates, decision outputs and full budget dimensions.
Twelve chapter views cover 1280/390/320px with and without JavaScript, all five
tabs, image decoding, formula/table/figure keyboard scrolling, table cell content
and containment, quiz, served source download and page overflow/errors.
Screenshots and JSON reports are under `/home/ybc/notes-legacy-review-artifacts/`.
The new SVG extends the font suite to 47 assets; it is deliberately separate from
the older 39-entry flowchart migration registry.

Regression checks also passed for twelve training/smoothing chapter views, eight
transfer views, and twelve FGSM views plus two failed-initialization fallbacks.
The broader static-diagram regression passed 26 desktop/mobile page visits and
13 pages with JavaScript disabled, including tabs and affected widgets.
The existing FGSM numerical suite (3,042 finite-difference gradients and 8,405
constrained steps) and smoothing oracle (90 binomial bounds, 11 quantiles and 450
coverage checks) passed without changes. All five related content generators
remain idempotent. The full-site inventory now contains 315 tracked pages and
1,011 figure elements: two new instances share one SVG. The original fifteen
courses still contain 208 chapters / 882 figures. These are counts, not review
completion metrics.

Preview: `http://localhost:8787/cybersecurity/Cyber-05-AI-Security.html#s7`
through the existing SSH tunnel; the reworked chapter has the same `#s7` anchor.

## Still open

The subsequent [impact revision](IMPACT.md) addresses physical attacks,
vehicle-transfer assertions and the separate reworked CIA introduction.
The [policy revision](POLICIES.md) addresses the RL aside. Privacy/model
inversion/memorization, LLM and agentic content still need review. Existing audio
has not been regenerated and may contain superseded claims. These changes do not
certify the remaining site or authorize deployment. Production and preexisting
root `review/index.html` / `review/report.md` edits remain untouched.
