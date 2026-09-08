# Security references: implementation, measurement and enforcement

Subsequent threat-model/overview changes are documented in
[THREAT-MODELS.md](THREAT-MODELS.md); the regression test composes that explicit
transform with the resource and clinical transforms, preserving their owned blocks.

Both AI Security chapters now expose `#security-resources` through their TOCs.
In the original chapter this replaces the two unsourced security/tool lists in
section 18. In the reworked chapter it supplies the missing resource guide before
the quiz. At this checkpoint the clinical reading list and its explicit unreviewed
status were retained unchanged. Its subsequent review and access limits are in
[CLINICAL-READING.md](CLINICAL-READING.md).

## Corrections and primary evidence

Sources were retrieved on 8 September 2026. README descriptions are a dated
documentation review, not tested installation recipes or a promise that all
framework/attack/version combinations are supported.

- [CleverHans](https://github.com/cleverhans-lab/cleverhans): corrects the old
  TensorFlow-only description using the documented v4 framework support.
- [Foolbox](https://github.com/bethgelab/foolbox): identifies its attack-library
  role and EagerPy-based implementation, without transferring a failed attack
  search into a proof of robustness.
- [RobustBench](https://github.com/RobustBench/robustbench): distinguishes its
  benchmark/model-zoo role from attack libraries and formal certification.
- [ART](https://github.com/Trusted-AI/adversarial-robustness-toolbox): replaces a
  bare product name with its ML-security scope and current hosting attribution.
- [AgentDojo v3](https://arxiv.org/html/2406.13352v3), sections 3.1 and 3.4,
  plus the [repository](https://github.com/ethz-spylab/agentdojo): task checks use
  outputs and environment state. Utility and attacker-goal outcomes are distinct.
  AgentLeak's characterization of AgentDojo as output-only was not copied: the
  direct AgentDojo source contradicts that characterization.
- [CaMeL v2](https://arxiv.org/html/2503.18813v2), sections 3, 3.1, 5 and 7:
  architectural approach with explicit assumptions and non-goals. Its paper title
  is not treated as an unconditional statement that prompt injection is solved.
- [Progent v1](https://arxiv.org/html/2504.11703v1), sections 3 and 4:
  adds the missing project name and distinguishes policy enforcement from policy
  generation. The specific reviewed version is cited, not labeled the latest.
- [AgentLeak v3](https://arxiv.org/html/2602.11510v3), channel-coverage paragraph
  in section VI and limitations in VII: uses the revised title and distinguishes
  instrumentation from evaluated coverage. No model ranking or leakage percentage
  is imported from the old project page or combined across versions. This is a
  scoped resource description, not validation of all claims in the paper.

Nine exact source captures are in `/tmp/notes-security-tools-evidence-imd8ty/`:
five repository READMEs and four versioned paper HTML files. Their SHA-256 hashes
are pinned in `security-tools-test.cjs`. The source test checks selected phrases
for traceability; human source review, not string presence, supports the summaries.
The original course reading leads were checked in
`/home/ybc/content/exams/Cybersecurity/slides-text/03 - privacy in LLM.txt`.

## Presentation and reproducibility

Two real HTML tables contain four resources each, with columns for role, provided
functionality and interpretation limits. These comparisons do not need another
flowchart or raster image. Tables inherit the chapter's existing font and colors;
740px minimum width and focusable horizontal scroll retain readable columns on
mobile. No text is squeezed into SVG, reduced in size, or hidden by overflow.

A native worked check explains why blocking every call does not establish useful
agent behavior. It links to the existing local policy example while expressly
distinguishing that example from CaMeL and Progent. No new client script is added.
All previous script tags and inline contents stay identical to `22049f9`.

```sh
node dev/legacy-diagrams/security-tools-content.cjs
# Apply the emitted chapter patch with apply_patch; the generator writes no files.
node dev/legacy-diagrams/security-tools-content.cjs --check
NOTES_SECURITY_TOOLS_EVIDENCE=/tmp/notes-security-tools-evidence-imd8ty node dev/legacy-diagrams/security-tools-test.cjs
node dev/legacy-diagrams/security-tools-browser-test.cjs
```

The source test also verifies that only the intended blocks/TOC links changed,
clinical leads are preserved, both generators remain idempotent, and scripts,
figures and existing widget hooks did not change. Browser checks cover both
chapters at 1280/390/320px with and without JavaScript, exact table content, text
within cells, chapter-native typography, both scroll endpoints, TOC/reference
links, native details and adjacent FGSM/agent/tab smoke interactions.

The first browser run stopped on an incorrect test assumption that all chapter
table text is at least 16px. Direct browser measurement showed that both the old
notice table and new resource tables use the unchanged 15.2px chapter style.
After visual inspection, the test was corrected to compare the new cells' exact
computed font size/family against the existing chapter table. No stylesheet or
font size was changed to accommodate content or make the assertion pass.

Source checks passed all nine captures and both chapters. The corrected browser
suite passed all 12 views; adjacent regulation source/generator checks and its
12-view browser suite passed as well. These checks do not execute the described
Python projects or validate their reported benchmark results.

Visual inspection covered the full desktop model/agent tables, the rightmost
agent-table column at 320px without JavaScript, and the expanded worked check at
390px. Text stays within cells, and the mobile scroll region exposes the complete
last column without reducing type size. The inventory remains 315 pages and
1,029 figures (the original fifteen-course subset remains 208/882); no figure was
added or replaced in this content checkpoint.

Artifacts: `/home/ybc/notes-legacy-review-artifacts/security-tools-*`.
Preview through the existing SSH tunnel:
<http://localhost:8787/cybersecurity-reworked/Cyber-05-AI-Security.html#security-resources>.

## Remaining work

Clinical reading leads are now addressed in [CLINICAL-READING.md](CLINICAL-READING.md),
including the unresolved Magnini full-text access. Healthcare full-text/raw-data
questions, other overview claims, narration and the rest of notes remain in scope. No package is
installed, benchmark executed, hosted model called, paid image generated, external
message sent or production service restarted by this checkpoint. Production remains
separate. Preexisting `review/index.html` and `review/report.md` changes are excluded.
