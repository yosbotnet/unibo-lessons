# Privacy provenance and threat taxonomy

Both Cyber-05-AI-Security chapters now share a native 7-node/6-edge SVG and
HTML tables. Original sections 11–12 and reworked sections 10–11 are revised;
their section anchors survive. The shared figure anchor is `#privacy-provenance`.
The corresponding recap question and reworked alignment introduction are updated.

## Why the content changed

The local course PDF `/home/ybc/content/exams/Cybersecurity/03 - privacy in LLM.pdf`
contains both the ambiguous training-time taxonomy and the 1.3B/6.7B/175B table.
Its hyperlink (recovered with `pdftohtml -i -stdout`) points to arXiv 2202.07646.
The cited paper does not substantiate that table's counts/percentages or the
slide's universal super-linear claim. The table has been removed, with an explicit
editorial explanation, not replaced by invented measurements or a fitted curve.

Reviewed primary evidence:

- [Carlini et al., Quantifying Memorization, v3](https://arxiv.org/html/2202.07646v3):
  Definition 3.1 distinguishes prefix-only greedy extractability from broader
  notions of memorization. Sections 3–5 explain suffix length, biased versus
  uniform sampling, log-linear relationships and cross-family qualifications.
  Visually checked PDF page 4, Figure 1: log-scaled model size and a fraction of
  extractable suffixes, not the slide's distinct-string table. This is the ICLR
  2023 revision of the paper initially posted in 2022; neither experiments nor
  training were rerun.
- [Shokri et al., membership inference](https://arxiv.org/abs/1610.05820):
  the v2 PDF introduction and section II distinguish membership from inversion
  and compare training inputs to held-out inputs from the same population.
  Black-box queries attack a trained model; they need not modify training.
- [Fredrikson et al., CCS 2015](https://www.cs.cmu.edu/~mfredrik/papers/fjr2015ccs.pdf):
  confidence-based inference and recognizable reconstructed faces, including
  black-box access; not a general promise to recover exact stored photographs.
- [Carlini et al., USENIX Security 2021](https://www.usenix.org/conference/usenixsecurity21/presentation/carlini-extracting):
  verified the conference abstract for the GPT-2 extraction example. No recovered
  personal data or paper-specific success percentages are reproduced.
- [Greshake et al., 2023](https://arxiv.org/abs/2302.12173):
  verified the primary abstract for attacker-controlled instructions in retrieved
  material. This is not the Perez red-teaming paper linked elsewhere in the slides.

The first three PDFs are SHA-pinned in `privacy-test.cjs`; local verification used
`/tmp/notes-privacy-evidence-rRZqY7/`. The last two entries were checked against their
primary landing-page abstracts, not added to the PDF hash verification claim.

## Diagram contract

`privacy-sources.cjs` specifies named Mermaid connections, not coordinates:

    D → T → W → G → O → E
                C ↗

Here D is the training corpus, T training/fine-tuning, W trained weights, C live
context, G generation, O reply/tool arguments, E recipient/authorization assessment.
The actual connections are D→T, T→W, W→G, C→G, G→O and O→E. There is deliberately
no C→W edge: this diagram's inference scenario has fixed weights. It does not claim
that deployment systems never log or later train on conversations. Output does
not establish provenance, truth or authorization merely by existing.

The build-time adapter preserves the site's ivory, cobalt, vermilion, original
embedded IBM Plex Mono at 14px, angular routes and domain-neutral shapes. The
549×532 SVG is static and scrollable at native size on mobile. Prose lives in the
caption and actual HTML tables (six threats and four qualitative evidence cases).
These cases are explicitly illustrative, not generated model outputs or a new
numerical experiment. They separate a positive extraction witness, context copying,
unknown provenance and a failed particular test. A negative test is not a general
privacy guarantee.

## Reproduce and verify

```sh
node dev/legacy-diagrams/privacy-content.cjs   # emits a patch; apply with apply_patch
node dev/legacy-diagrams/privacy-content.cjs --check
NOTES_PRIVACY_EVIDENCE=/path/to/reviewed-pdfs node dev/legacy-diagrams/privacy-test.cjs
node dev/legacy-diagrams/privacy-browser-test.cjs
node dev/legacy-diagrams/font-test.cjs
node dev/legacy-diagrams/fgsm-browser-test.cjs
NOTES_PREVIEW_URL=http://127.0.0.1:8787/ node dev/legacy-diagrams/browser-test.cjs
```

Browser coverage: both chapters at 1280/390/320px, JS enabled and disabled;
native image decoding; full topology and arrowheads; XML and text geometry;
all table-cell text bounds, citations, keyboard scroll; both new native checks,
updated recap, alignment tabs and both existing ReAct branch transitions (UI
regression only; their substantive authorization claims remain open below).
Source tests parse both complete HTML documents
and check idempotence and preservation of widget hooks. Font and existing widget
regressions are separate tests, not implied by valid markup. Screenshots and JSON
results live in `/home/ybc/notes-legacy-review-artifacts/privacy-*`.

At this checkpoint, the font regression verifies 50 shared SVG assets, including
this one. FGSM passes its 12 views and two initialization-failure fallbacks. The
broader legacy suite passes 26 desktop/mobile visits and 13 no-JavaScript pages.
The whole-site inventory is 315 pages / 1,017 figure elements; the original
15-course scope remains 208 / 882. These are inventory counts, not completion
claims. Visually inspected the complete new SVG, its 390px chapter presentation,
both desktop tables and the primary paper's Figure 1.

## Still open

This resolves the memorization/taxonomy portion, not all of AI Security or notes.
The differential-privacy subsection has since been corrected separately; see
[DP.md](DP.md) for its model, source evidence and verification scope.
The ReAct explorer, authorization assumptions and on-device confidentiality
paragraphs are addressed separately in [AGENT-ARCHITECTURE.md](AGENT-ARCHITECTURE.md).
The large/small-model comparison and Attack@1 material are addressed separately
in [HEALTHCARE-EVALUATION.md](HEALTHCARE-EVALUATION.md); full-text/raw-data limits remain explicit.
Zero-shot/alignment and injection claims are addressed in [INJECTION.md](INJECTION.md).
Legal terminology and regulatory summaries are addressed in [REGULATION.md](REGULATION.md),
without claiming exhaustive legal research or a compliance determination.
Narration/audio has not been regenerated.
Production is separate; no deployment, paid image generation or service restart
is performed by this workflow.
