# Observation attacks and trajectory return

The two Cybersecurity chapter-05 versions replace their one-sentence RL aside
with a sourced explanation, observation/environment pseudocode, a model-derived
native trajectory SVG, an HTML result table and a check question. The original
FGSM explorer remains separate. All additions live between explicit
`POLICY OBSERVATIONS` markers; the new anchor is `#policy-observations`.

## Source boundary

The course's `AdvEx.pdf` links to
[Huang et al., arXiv v1](https://arxiv.org/pdf/1702.02284v1).
Sections 4–5 and the DQN footnote distinguish input-gradient generation from
execution and trajectory evaluation. The clean policy's favored action supplies
a fixed reference; it is not ground-truth optimality. A differentiable softmax
over Q-values is used for the DQN attack, not as a replacement execution policy.
The experiments concern selected Atari policies, not universal RL vulnerability.
The notes do not reproduce their scores or claim to rerun their experiments.

PDF SHA-256: `020f43c7a196e1ea9bb967ea48b5a1010f99e616f0df041a64391b03edf228d7`.
The loss/footnote page was visually inspected as well as read as text. The source
test pins the PDF and checks the relevant method/evaluation descriptions.

## Executable teaching example

`cybersecurity/assets/policy-model.cjs` is an invented deterministic corridor,
not a trained network. States are 0, 1, 2; start at 1; state 2 terminates. Actions
L/R move one cell and clamp at the boundaries. Only entry to goal 2 earns reward
1. Calling the transition function on an already terminal state is rejected, so
terminal padding cannot generate fictitious rewards.

Observation: `o=(s+2)/4`. The hand-defined action score is
`p(R|o)=sigmoid(4*(o-.5))`; execution chooses R at or above .5, including ties.
The attack freezes the reference action, differentiates its cross-entropy with
respect to o, and clips the sign-gradient update to [0,1]. It never edits state
or reward directly. Only t=0 is attacked; later observations are clean.

With ε=.4, the initial observation .75 becomes .35 and R becomes L. The true
state remains 1 until that action causes the transition to 0. The three records
are calculated, not transcribed as expected output inside the renderer:

| Run | True states | Actions | Rewards | G at γ=1 |
| --- | --- | --- | --- | --- |
| Clean, H=2 | 1,2 | R | 1 | 1 |
| Attack, H=2 | 1,0,1 | L,R | 0,0 | 0 |
| Attack, H=3 | 1,0,1,2 | L,R,R | 0,0,1 | 1 |

The second run hits a time limit, not a terminal environment state. The third
recovers the same undiscounted return; with γ<1 it instead yields γ². This shows
why an action-change metric is not a return metric. It does not prove that this
input attack is globally worst-case for an arbitrary policy or environment.

The model accepts H=1…8, ε∈[0,1], γ∈[0,1]; unknown options, invalid numeric inputs
and terminal transitions fail. Its source is downloadable from the chapters.
The plot supports ε/γ variants and derives nodes, arrows, rewards, totals and
stopping positions from the records. Red means an action differs from that at
the clean observation. Empty later time columns on a terminal row are intentional.

This is a small native trace renderer, not a generic Mermaid layout, symbolic
RL engine or simulation of Atari. It reuses the palette and embedded original
14px IBM Plex Mono. Text is not scaled down; wide images/formulas/tables scroll
with a keyboard on mobile. No paid image generation or production changes occur.

## Reproduction and checks

```sh
node dev/legacy-diagrams/policy-content.cjs
# Apply the emitted chapter patch with apply_patch.
node dev/legacy-diagrams/policy-content.cjs --check
NOTES_HUANG_PDF=/path/to/1702.02284v1.pdf node dev/legacy-diagrams/policy-test.cjs
node dev/legacy-diagrams/policy-browser-test.cjs
node dev/legacy-diagrams/font-test.cjs
```

Numerical checks: 198 finite-difference gradients with fixed reference labels;
707 bounded/clipped updates; 280 rollouts against an independent explicit
transition table and closed-form return; 17 invalid inputs; zero, threshold,
clipping, terminal-stop, discount and input-immutability cases. These finite tests
are not a formal proof for every floating-point input.

Browser checks: five deterministic plot variants; XML, text bounds and collisions;
exact state positions, every action/reward arrow and its marker; both chapters
at 1280/390/320px with and without JavaScript. They check all table values and text
containment, actual image dimensions, formula/table/image keyboard scrolling,
the check question, served model download, duplicate IDs and whole-page overflow.
Screenshots and JSON reports are in `/home/ybc/notes-legacy-review-artifacts/`.
The font suite now includes 49 assets. The new plot is not silently inserted into
the older 39-source flowchart migration registry.

Regression results: the existing FGSM explorer passed twelve JS/no-JS views and
two initialization-failure fallbacks, including keyboard, touch and drag input.
The broader suite passed 26 desktop/mobile page visits and 13 no-JavaScript pages.
Policy, FGSM, published FGSM results, feature and transfer content stayed in sync;
the impact and robustness section generators also preserve the new content.
The inventory now has 315 pages and 1,015 figure elements (two instances of this
shared SVG), with the original scope unchanged at 208 chapters / 882 figures.

Preview: `http://localhost:8787/cybersecurity/Cyber-05-AI-Security.html#policy-observations`
via the existing SSH tunnel; the reworked chapter has the same anchor.

## Remaining scope

The later privacy/memorization, inversion, LLM and agentic content still needs
review. Existing audio was not regenerated. The broader all-notes objective is
not complete, and no source count or small-model test establishes otherwise.
Production and preexisting root review/index/report changes remain untouched.
