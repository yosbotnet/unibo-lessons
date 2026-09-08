# Alignment, input provenance and observed outcomes

Both AI Security chapters now share `#alignment-scope` and `#injection-channels`.
The original chapter's sections 14–15 and the reworked chapter's sections 12–13
retain their anchors; TOC labels change. All existing script tags and inline
script contents remain byte-identical to checkpoint `2818b90`. The original
three-tab comparison remains, with native worked checks and no new runtime JS.

## Corrections and primary evidence

- Few-shot prompting is not universally 1–5 examples. The illustrated task now
  keeps its input unchanged across few-shot and zero-shot panels, leaves the
  answer slot empty, and distinguishes an expected teaching label from a model
  result. In-context demonstrations do not themselves update weights. Previously
  instruction-tuned models can still be evaluated zero-shot.
- Alignment is an aim relative to specified intentions/values, not a guarantee
  of helpfulness, harmlessness or confidentiality. Training, prompt composition
  and externally enforced permissions are separate dimensions, not mutually
  exclusive model types. Placeholder replacement alone does not demonstrate
  anonymity; the remaining details and observer's information still matter.
- Prompt injection is an attempt, not necessarily successful modification of a
  stored system prompt. Input provenance, modality, adversary objective and
  observed effects are separated. Jailbreaking and injection can overlap, but
  they are not interchangeable with every confidentiality attack.
- The slides' DAN example remains a historical role-play example, without a
  fabricated current success rate or a claim about every model. No harmful
  payloads, optimized images or actual attacks are produced by these pages.
- Zhu's MiniGPT-4 architecture paper is distinguished from Carlini's attack
  study. Image-carried readable text is not equated with optimized pixels or
  physical patches; neither attackability nor safety is inferred universally.
- Four constructed outcome checks separate quoting an instruction, answer
  redirection, a blocked disclosure proposal and actual unauthorized delivery.
  They are not traces captured from a real LLM or new experimental evidence.

The six cited primary PDFs were downloaded and relevant sections read. Evidence
directory: `/tmp/notes-injection-evidence-jbh16V/`. Exact SHA-256 values are pinned
in `injection-test.cjs`:

| Source | Passage used and scope |
| --- | --- |
| [Brown et al.](https://arxiv.org/abs/2005.14165v4) | Section 2, pp. 6–7; Figure 2.1 visually inspected. Distinguishes weight updates from demonstrations; often K=10–100 in that study, not a universal recommendation. |
| [Ouyang et al.](https://arxiv.org/abs/2203.02155v1) | Introduction and Figure 2, p. 3, visually inspected. Supervised demonstrations, preference comparisons/reward model, reinforcement learning; not proof of universal alignment. |
| [Perez and Ribeiro](https://arxiv.org/abs/2211.09527v1) | Introduction/definitions: goal hijacking and prompt leaking. Not treated as a DAN replication or current-model benchmark. |
| [Greshake et al.](https://arxiv.org/abs/2302.12173v2) | Abstract and sections 2–3: attacker content retrieved by an application and the distinction from direct access. Terminology is contextual, not a claim all taxonomies are identical. |
| [Carlini et al., NeurIPS 2023](https://papers.neurips.cc/paper_files/paper/2023/file/c1f0b856a35986348ab3414177266f75-Paper-Conference.pdf) | Sections 6.1–6.3, pp. 8–9; Table 3 visually inspected. Differentiable image-to-output setup, random initial images, reported outcomes for specific implementations. No small-budget/imperceptibility/physical-camera guarantee is inferred. |
| [Zhu et al., MiniGPT-4](https://arxiv.org/abs/2304.10592v2) | Abstract/architecture: visual encoder connected to an LLM. This is not the attack paper. |

The local course PDF is
`/home/ybc/content/exams/Cybersecurity/03 - privacy in LLM.pdf`, SHA-256
`82506e353bda60ff819a96eaa8b538818b625639343b658e434b2bf6a6855749`.
Its extracted text contains the oversimplified few-shot definition, zero-shot
privacy promises, DAN/Perez examples and abbreviated Carlini/Zhu citations.
The new material qualifies those claims instead of treating slide prose as proof.
Qi et al.'s related visual-attack PDF was downloaded during discovery but is not
used as a replacement citation for the slides' Carlini reference.

## Native diagram and reusable tooling

`injection-content.cjs` declares the figure as ordinary Mermaid node connections,
using the existing build-time adapter, not per-figure SVG coordinates:

```text
Application policy ──┐
User message ────────┤
Retrieved content ───┼──→ Model processing ──→ Proposed reply / call
Image input ────────┘
```

The six nodes/five edges generate `cyber-injection-channels.svg`, 738×291 px,
with original embedded IBM Plex Mono at 14px and ivory/cobalt/vermilion tokens.
Vermilion identifies potentially adversary-controlled input channels; text labels
and the caption preserve the distinction without color. The application policy
is assumed trusted for this threat model. Arrows show influence, not authority,
text concatenation, completed tool execution or guaranteed compromise. The output
links conceptually to the already reviewed proposal/check/dispatch architecture.

The default fits the 800px desktop column, including wrapper padding/border.
Mobile keeps native-size glyphs and keyboard-scrollable overflow. The five-row
taxonomy and four-row outcome comparison are real HTML tables, not prose packed
into small boxes. Visual review found the initial mobile table columns too
narrow; both tables now keep a 640px minimum width with a keyboard-scrollable
container, unchanged text size and checks on both left and right portions.
Prompt examples also have explicit keyboard-scroll tests. Three layout fixtures exercise default, larger spacing and
vertical orientation without altering the graph's semantic edges.

## Reproduce and verification scope

```sh
NOTES_INJECTION_EVIDENCE=/tmp/notes-injection-evidence-jbh16V node dev/legacy-diagrams/injection-test.cjs
node dev/legacy-diagrams/injection-content.cjs --check
node dev/legacy-diagrams/injection-browser-test.cjs
node dev/legacy-diagrams/font-test.cjs
```

Without `--check`, the generator writes the SVG asset and prints a chapter patch
for apply_patch. It does not deploy. Tests pin source bytes, parse chapter markup,
preserve every existing script, and verify source/chapter synchronization. Browser
checks cover geometry, marker targets, exact edge topology, text bounds/overlap,
paths through unrelated nodes, native sizing, table contents and cell bounds,
tabs, worked checks and adjacent FGSM/agent smoke interactions. Full existing
widget suites remain separate from those smoke checks.

Artifacts: `/home/ybc/notes-legacy-review-artifacts/injection-*` and
`alignment-tab-*`. Preview:
<http://localhost:8787/cybersecurity-reworked/Cyber-05-AI-Security.html#injection-channels>
through the existing SSH tunnel. No paid generation or model execution.

## Verified checkpoint — 8 September 2026

- Source/provenance test: six pinned primary PDFs, both chapters, all existing
  scripts unchanged, five taxonomy rows and four constructed outcome rows;
  valid markup and idempotent chapter generation.
- Final browser test: three diagram layouts (default 738×291, spacious 788×396,
  vertical 811×256) with the same six nodes and five directed edges; 12 actual
  chapter views at 1280/390/320px with and without JavaScript. The larger variants
  are test fixtures, not replacements that must fit the default desktop column.
- Visually inspected the default SVG, both sides of the final 390px taxonomy
  table, the 320px few-shot panel and the desktop outcome table. Tables retain
  the original font size; the mobile example blocks scroll by keyboard.
- The final HTTP regression completed: 26 desktop/mobile page visits and native
  diagrams on 13 pages without JavaScript, including tab/widget assertions.
- Embedded-font test: 55 SVG assets with the exact original font and license;
  no font network requests. Adjacent agent suite: 12 views plus two missing-model
  fallbacks; healthcare suite: four plot variants and 12 views. Those adjacent
  suites ran before the final table-width-only refinement; the final injection
  suite rechecks both neighboring widgets on all JS-enabled views afterward.
- Neighboring agent, privacy and healthcare source tests passed after the final
  table change. FGSM numerical tests passed 3,042 gradient checks and 8,405
  constrained steps. The full FGSM screenshot suite was not rerun here; attack
  and reset interactions were checked in the final new chapter suite, and every
  existing widget script remains byte-identical to `2818b90`.

Inventory: 315 HTML pages / 1,027 figure elements; the original 15-course subset
remains 208 chapters / 882 figures. Inventory is not correctness certification.
Production HEAD was checked at `f0f4bde` and not changed. Preexisting edits to
`review/index.html` and `review/report.md` are excluded from this checkpoint.

## Remaining scope

This is not a complete review of every AI Security claim or all notes. Regulatory
summaries and the final generalizations in these chapters still require review.
The healthcare checkpoint's full-text/raw-data/uncertainty limits remain open;
this work does not fill them. Narration/audio has not been regenerated.
Production remains separate and unchanged.
