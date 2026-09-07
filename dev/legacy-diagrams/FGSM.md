# Explicit FGSM model and shared native plot

Both cybersecurity chapter-05 versions now replace the schematic canvas with a
single model/view/widget implementation and a standalone SVG worked example.
Preview `http://localhost:8787/cybersecurity/Cyber-05-AI-Security.html#s4`
(also under `cybersecurity-reworked/`). Production is unchanged.

## Confirmed old defects

The previous “gradient” always had zero x component and pointed vertically toward
the hand-drawn quadratic boundary. Its displacement was 2.4 times the slider
epsilon, then clamped to unrelated canvas margins. The fake A/B point clouds did
not consistently match its own classifier, the initial point was described as A
while classified B, the sigmoid score was presented as confidence, and touch/
mouse coordinates were in canvas pixels. The previous checkpoint explicitly
warned about these limitations; the warning is replaced now that this model is
implemented rather than left as a disclaimer.

## Mathematical contract

The new domain is [0,1]² with u rightward and v upward:

```
b(u) = .35 + .8 (u − .5)²
z = 8 (v − b(u))
pB = sigmoid(z)
y = 1 if v ≥ b(u), else 0         # tie goes to B
J(u,v;y) = softplus(z) − y z
∇J = 8 (pB − y) (−1.6 (u − .5), 1)
Q = clip(P + ε sign(∇J(P;y)), 0, 1)
```

This is an explicit differentiable classifier, not a trained image network or
an externally labeled dataset. Runtime y is the clean prediction and is fixed
throughout the step. The reported outcome is therefore a *prediction flip*, not
proof of a semantic misclassification or perceptual robustness violation.
The sigmoid is a model score, not measured calibration. Changing the clean point
discards the previous candidate; changing epsilon recomputes a displayed candidate
from the clean point, never cumulatively from the previous adversarial point.

Default P=(.30,.43), ε=.08 produces Q=(.22,.35), B→A, actual norm .08, and losses
.5195→.9752 (rounded). A small step from (.8,.9) does not flip. At u=0, v=.9,
clipping removes the negative horizontal step. At u=.5 the horizontal gradient
vanishes exactly; sign(0)=0, not an invented ±1 direction. The exported mathematical
model accepts epsilon through 1; the UI deliberately offers 0–.25 normalized units.

The reference is [Goodfellow et al., §4](https://arxiv.org/pdf/1412.6572): the sign
step optimizes the first-order loss approximation under an L∞ constraint, not
arbitrary nonlinear loss. The toy model provides a concrete counterexample to
global optimality: for P=(.5,.9), ε=.1 and reference B, (.4,.8) has higher loss than
the FGSM candidate (.5,.8), while obeying the same box/domain constraint.

## Files and rendering

- `cybersecurity/assets/fgsm-model.js`: pure model, finite-input validation, stable
  softplus loss, gradient, clipping, score, outcome and actual perturbation norm.
- `fgsm-view.js`: one native SVG renderer usable in Node and the browser. It draws
  an exact quadratic Bézier boundary and clips the epsilon box to the domain.
  Its three control points express the same polynomial; this is mathematical
  geometry, not a flowchart with artificially curved connectors.
- `fgsm-widget.js`: numeric inputs, range control, keyboard access, pointer capture
  for mouse/touch, validation and full reset. It loads font metadata from the local
  static SVG and reuses it in data-URI images, so dynamic glyphs match the fallback.
  It needs no model/AI service. Invalid coordinate input does not silently attack
  the previous point. Controls stay disabled until initialization succeeds.
- `fgsm-widget.css`: locally scoped control styling with legible text and 44px
  minimum button height; no shared chapter theme was changed.
- `assets/diagrams/cyber-fgsm.svg`: native 332×426 worked example, exact embedded
  original IBM Plex Mono/license, ivory/cobalt/vermilion. Both course versions use
  this one asset. Short steps use an endpoint-to-endpoint line when an arrowhead
  would obscure the markers; epsilon zero draws coincident distinct symbols.
- `dev/legacy-diagrams/fgsm-content.cjs`: canonical widget, equations, fallback,
  scripts and adjacent explanation/annotation repairs. Build emits reviewed
  absolute patches; `--check` detects chapter/asset drift without writing them.

The formula panel also now has native fallback code when JavaScript is disabled;
its existing annotated-code enhancement is retained with corrected explanations.
The old canvas closure is removed from both chapters, not merely bypassed.

## Checks

```
node dev/legacy-diagrams/fgsm-test.cjs
node dev/legacy-diagrams/fgsm-content.cjs --check
node dev/legacy-diagrams/fgsm-browser-test.cjs
NOTES_GOODFELLOW_PDF=/path/to/1412.6572v3.pdf node dev/legacy-diagrams/fgsm-results-test.cjs
node dev/legacy-diagrams/fgsm-results.cjs --check
node dev/legacy-diagrams/transfer-content.cjs --check
node dev/legacy-diagrams/transfer-browser-test.cjs
node dev/legacy-diagrams/font-test.cjs
```

The numerical suite compares 3,042 analytical gradients against centered finite
differences of an independently written loss, and exercises 8,405 constrained
steps. It checks default/failed/clipped/zero steps, unchanged input, zero horizontal
gradient, ten invalid inputs, linearized corner gains and the nonlinear
non-optimality witness. 1,001 parameter values compare the Bézier polynomial to
the boundary independently. These tests are evidence for this model, not a proof
about ImageNet networks or the rest of the course.

The browser suite covers both chapters at 1280, 390 and 320px with and without
JavaScript. It checks the exact serialized SVG against the current model, XML,
text bounds/overlaps, actual loaded native size, default/zero/clipped/non-flipping
steps, invalid input, reset, numeric keyboard input, touch and mouse dragging,
horizontal keyboard scrolling and disabled controls in the static fallback.
The serialized SVG must match exactly. Cross-engine numeric evidence allows
absolute error below 1e-12 because Node/Chromium's exponential evaluations differed
by 2e-16 in a zero-horizontal-gradient fixture; labels and object structure remain
exact. This is not a tolerance on the stated mathematical perturbation budget.
Two additional failure-injection views block the initialization fetch and verify
that the static image remains loaded while controls stay disabled. Zero horizontal
gradient and the exact-boundary tie convention are also exercised in the browser.
The existing transfer suite separately exercises tabs, quiz answers and both
state-explorer paths. Artifacts: `/home/ybc/notes-legacy-review-artifacts/fgsm-*`.

The broader regression passes 26 desktop/mobile page visits and 13 pages with
JavaScript disabled. The font check covers 44 exact embedded-font assets. The
source inventory is 315 tracked pages and 1,005 figure elements; two new figure
instances now share the single FGSM SVG instead of empty canvases without JS.
These inventory totals are not evidence that every page or figure is approved.

## Historical results and input units

`cybersecurity/assets/fgsm-evidence.cjs` now holds three model-specific rows, not
dataset-only universal rates. The omitted MNIST maxout result is restored; CIFAR-10
retains the published precision and preprocessing context. The panda figure is
identified as one illustration, not aggregate ImageNet evidence. Error rates,
reported class scores and clean-correct-conditioned attack success are distinguished.
These are literature transcriptions, not new measurements or rerun attacks.

`fgsm-results.cjs` owns the shared introduction, table and annotation corrections.
The main `fgsm-content.cjs` generator calls it too, so regenerating the widget
cannot restore the old benchmark labels or generic [0,1] fallback.
The introductory ordered steps retain sign(0)=0 and require input bounds matching
the representation. Generic fallback and enhanced code use lower/upper bounds;
the explicitly normalized toy model correctly keeps [0,1].

The source was inspected as a rendered page and extracted text: arXiv 1412.6572v3,
printed page 3, including footnotes 1–2 and Figure 1. SHA-256:
`7f6c0a50475149e11e3b7efc9c0a00383652b7cae62f80facd8ae2684ef251e7`.
Local review copy: `/tmp/notes-fgsm-evidence-jI4WI9/goodfellow-v3.pdf`.
The source test extracts the architecture-associated values, verifies units and
illustration context, rejects five deliberately false transcriptions and checks
both chapters and generator idempotence. Browser checks additionally compare
every displayed table cell, verify text containment, keyboard scrolling, served
source download and lower/upper bounds in both code-rendering modes.

## Still open

The subsequent [defense revision](ROBUSTNESS.md) addresses training and smoothing.
The [feature revision](FEATURES.md) addresses the five explanations, neuron
interpretation and OOD percentage. Physical-world, privacy and agentic
claims remain subject to the review list in TRANSFER.md. The full-site objective
is still active. Existing audio narration has not been regenerated. No paid image
generation, production publication or unrelated service restart occurred, and
preexisting root review/index/report edits were preserved.
