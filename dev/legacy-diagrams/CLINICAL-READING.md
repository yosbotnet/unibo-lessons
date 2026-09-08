# Medical-model reading list: evidence and limits

Both AI Security chapters now expose `#clinical-evidence`, linked from their TOCs.
The original chapter's “SLMs in Clinical Deployments” list is replaced by four
scoped reading entries; the reworked chapter gets the same guide before its
security-resource section. The 2026 leakage study remains linked to its existing
section, with its separate full-text/raw-data limitations unchanged.

The previous list implied a common deployment status that the identified sources
do not establish. The new entries distinguish evaluated tasks, observed results
and interpretation limits, with the extent of source access visible per entry.
They are research summaries, not patient advice or deployment recommendations.

## Sources actually consulted — 8 September 2026

- [Kim et al., npj Digital Medicine 8, 240 (2025)](https://www.nature.com/articles/s41746-025-01653-8),
  DOI `10.1038/s41746-025-01653-8`: publisher HTML retrieved directly; abstract,
  methods and discussion reviewed. The journal version, not an older preprint's
  model/results list, is the basis of the entry. It reports benchmark improvement
  and also inaccuracies and unsafe-output concerns. No clinical-effectiveness
  inference or model ranking is added.
- [Magnini, Aguzzi and Montagna, Intelligence-Based Medicine 11, 100197 (2025)](https://doi.org/10.1016/j.ibmed.2024.100197):
  identity and abstract confirmed through publisher and institutional indexed
  records, including [Urbino](https://ora.uniurb.it/handle/11576/2749051) and
  [Bologna](https://cris.unibo.it/handle/11585/1002051). The review did not obtain
  the full paper. Publisher PDF and Bologna retrieve/bitstream URLs returned 403;
  a successful initial browser view of the Urbino record was followed by 403 on
  renewed direct access. The saved search response contains the actual indexed
  abstract and metadata, not a claimed full-text download. No sample size,
  detailed performance result or clinical-study conclusion is invented.
- [Griewing et al., Journal of Cancer Research and Clinical Oncology 150, 451 (2024)](https://link.springer.com/article/10.1007/s00432-024-05964-3):
  publisher HTML, methods and limitations reviewed. The entry separates fictional
  profiles from binary decisions and agreement from clinical validation. The
  linked title is shortened before its subtitle. Hardware and broad security
  assurances in the article are not copied as independently established facts.
- [Aguzzi et al., Journal of Medical Systems 49, 159 (2025)](https://link.springer.com/article/10.1007/s10916-025-02297-7):
  publisher HTML, evaluation and limitations reviewed. The entry identifies the
  pilot's restricted evaluation and avoids converting nonsignificance into
  equivalence. No quantitative performance table or significance claim is
  reproduced; the experiments and statistical analyses were not rerun.

Three full publisher HTML captures plus one search-tool JSON capture are retained
at `/tmp/notes-clinical-reading-evidence-IFlnkO/`, SHA-pinned in
`clinical-reading-test.cjs`. A failed browser response is also retained separately
as `magnini-web.json`; it is not used as supporting evidence. No access control
was bypassed. Source access level and publication date are distinct from review
date. The local course reading list was checked in
`/home/ybc/content/exams/Cybersecurity/slides-text/03 - privacy in LLM.txt`.

## Content and rendering

Each paper has a linked citation, an explicit access-status label and three short
paragraphs: evaluation, result interpretation and limits. Keeping the prose in
native HTML makes long titles and qualifications wrap naturally on mobile;
neither a wide comparison chart nor a raster image improves this reading task.
Existing chapter typography is inherited without changing styles or font sizes.

A native worked check contrasts benchmark answers, simulated decisions and patient
outcomes. Cross-links lead to the existing application-boundary, regulatory and
2026 healthcare-study sections. No patient data, model calls, new runtime scripts,
paid images or external messages are involved.

```sh
node dev/legacy-diagrams/clinical-reading-content.cjs
# Apply its emitted patch with apply_patch; it does not write chapter files.
node dev/legacy-diagrams/clinical-reading-content.cjs --check
NOTES_CLINICAL_READING_EVIDENCE=/tmp/notes-clinical-reading-evidence-IFlnkO node dev/legacy-diagrams/clinical-reading-test.cjs
node dev/legacy-diagrams/clinical-reading-browser-test.cjs
```

Unit checks cover source hashes/selected passages, exact source-access labels,
four entries, clinical-only edits relative to `e03e336`, unchanged scripts/figures,
markup, and compatibility with the regulation and security-resource generators.
The earlier security-resource test now composes both explicit generators when
checking the complete chapter; it still protects its exact owned resource block.
The clinical test independently proves that block is unchanged from `e03e336`.

Browser checks cover both chapters at 1280/390/320px, with and without JavaScript:
exact paragraphs/citations, font equality with existing chapter paragraphs, text
within viewport, TOC and internal links, native details and adjacent FGSM/agent/tab
smoke checks. Artifacts are `/home/ybc/notes-legacy-review-artifacts/clinical-reading-*`.

Preview through the existing SSH tunnel:
<http://localhost:8787/cybersecurity-reworked/Cyber-05-AI-Security.html#clinical-evidence>.

## Verified checkpoint

Source/markup checks passed, including the security-resource and regulation
compatibility checks. The final clinical browser suite passed all 12 views;
security-resource and regulation suites each passed their own 12 views as well.
Visual review covered desktop Kim/Magnini entries and mobile Magnini/Griewing
entries at 390/320px, including long citation wrapping and the explicit
abstract-only label. Existing scripts, styles and figure blocks are unchanged.
The inventory remains 315 pages and 1,029 figures, with 208 chapters/882 figures
in the original fifteen-course subset. These counts are not a site-wide approval.

## Open work

Magnini's full methods/results remain unreviewed. The 2026 leakage paper's full-text
and raw-data gaps are not resolved by identifying these four other articles.
Remaining overview claims, narration/audio and the wider site remain in scope.
This checkpoint does not deploy, alter production or restart services. Preexisting
`review/index.html` and `review/report.md` changes remain excluded.
