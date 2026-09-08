# Privacy regulation: scope, responsibilities and evidence

Both AI Security chapters share `#regulation-scope` and
`#governance-implications`. The original chapter's regulatory section 13 and
implications section 18 retain their anchors; the reworked chapter's section 17
retains its anchor. TOC/outline wording is updated. The reworked chapter's earlier
PII paragraph now links to the definitions instead of asserting a universal set
relationship or treating every attempted leak as an observed confidentiality loss.

## What changed

- Separates GDPR personal data, Article 9 special categories and HIPAA PHI.
  The security umbrella term “sensitive information” is not substituted for any
  of those legal definitions. Identifiers alone do not define PHI.
- Replaces “EU”/“US” as sufficient jurisdiction labels with scope qualifications:
  GDPR establishment/targeting/monitoring criteria and material scope; HIPAA
  covered entities/business associates rather than every consumer health app.
- Removes the unconditional GDPR explicit-consent requirement. Distinguishes
  Article 6 lawful basis from an applicable Article 9 condition; identifies the
  conditions/safeguards associated with Article 9(2)(h), without giving permission
  to an actual healthcare application. Erasure is not represented as unconditional.
- Distinguishes GDPR minimisation from HIPAA's minimum-necessary rule and its
  exceptions; HIPAA authorization is not treated as a synonym of GDPR consent.
- Separates GDPR processor/controller, authority and individual notices. The
  72-hour formulation is tied to controller awareness and authority notification;
  individual communication has its own high-risk threshold. Documentation and
  phased information are not a reason to wait for a complete investigation.
- Explains HIPAA's impermissible-use/disclosure presumption, risk assessment,
  exceptions and unsecured-PHI condition. Individual and business-associate
  notice timing is qualified; Secretary/media requirements are explicitly not
  reduced to the same deadline or claimed to be exhaustively tabulated.
- Removes the fixed $100–$50,000 penalty range as a current schedule. No monetary
  penalty, notification decision or compliance verdict is calculated here.
- Rewrites the three-audience conclusion: existing legal obligations versus
  proposed policy updates/certifications; logs as another protected data store;
  privileges and actual data paths rather than tool count as a risk score.
  Model capabilities and attempted attacks are not automatically actual breaches.

The original chapter's bibliography remains available, but its first four
clinical papers are explicitly unreviewed reading leads. Unsupported deployment
endorsements (“sufficient performance”) are removed, retaining the author/year and
slide-listed topic. This is not a completed clinical-literature review.

## Official sources actually consulted

Educational overview checked 8 September 2026, not legal advice for a live incident.
The chapter directs readers to the responsible privacy/security/legal team for
case-specific assessment, including applicable national rules and contracts.

- [GDPR official text, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj?locale=EN):
  relevant Articles 2–6, 9, 17 and 33–34. The official PDF is retained; in particular,
  Article 9's alternatives/safeguards and the separate Articles 33/34 thresholds
  were read directly. The EUR-Lex landing page's current-version link was checked;
  no proposal for new legislation is treated as enacted law.
- [Commission: application of the GDPR](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/application-gdpr_en):
  territorial scope and contextual applicability, independently retrieved as HTML.
- [Commission: legal grounds](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/legal-grounds-processing-data_en):
  lawfulness and additional conditions for special categories, including health.
- [EDPB: data breaches](https://www.edpb.europa.eu/sme/assess-the-risks/data-breaches_en):
  confidentiality/integrity/availability, assessment, documentation, phased
  information and notification/communication distinctions.
- [HHS: covered entities/business associates](https://www.hhs.gov/hipaa/for-professionals/covered-entities/index.html),
  [Privacy Rule summary](https://www.hhs.gov/hipaa/for-professionals/privacy/laws-regulations/index.html)
  and [Breach Notification Rule](https://www.hhs.gov/hipaa/for-professionals/breach-notification/index.html):
  PHI, coverage, permitted uses, minimum necessary, inflation-adjusted penalty
  information, breach presumptions, recipients and selected deadlines.
- [HHS October 2022 cybersecurity newsletter, footnote 16](https://www.hhs.gov/hipaa/for-professionals/security/guidance/cybersecurity-newsletter-october-2022/index.html):
  confirms the specific law-enforcement-delay provision at 45 CFR 164.412,
  supporting the timing qualification rather than an unconditional 60-day rule.

Evidence: `/tmp/notes-regulation-evidence-qNka0H/`. Seven files are SHA-pinned in
`regulation-test.cjs`: the GDPR PDF, Commission/EDPB HTML and three JSON files
containing the actual browsing-tool HHS text responses. Direct HHS downloads
returned 403, while the browsing tool provided the cited HHS text. eCFR and one
US Code direct page request were blocked; no access controls were bypassed.
The HHS combined-rules page identifies its March 2013 PDF as an unofficial
compilation: it is not represented here as newly obtained current consolidated law.
The preserved captures retain the difference between a source's publication/review
date and the date on which it was consulted. This review is not exhaustive legal
research into every national exception, contract, newer specialty rule or case law.

The local course PDF remains
`/home/ybc/content/exams/Cybersecurity/03 - privacy in LLM.pdf`. Its extracted text
confirms the previous consent/penalty claims and clinical reading list; the slides
are not substituted for the legal primary sources.

## Diagram, tables and tests

The existing native renderer generates `cyber-incident-responsibilities.svg`
from four Mermaid nodes and three connections. It uses original 14px embedded
IBM Plex Mono, ivory/cobalt/vermilion and straight/angular arrows, 732×161 px.
The incident branches to technical response, notice assessment and records.
These are parallel responsibilities, not sequential gates or an automated legal
decision tree. Captions explicitly say not to delay assessment until investigation
is complete. No legal thresholds or fake calculated risk scores are embedded in
the SVG.

Definitions and selected notice duties are real three-column HTML tables with
640px/730px minimum widths inside focusable scroll regions. The tables preserve
readable font sizes on mobile. The three-tab governance panel and existing
widgets remain interactive; all old script tags and inline script bytes are
unchanged from `8cb8832`. The privacy/injection/healthcare generators remain
compatible with the section boundaries they own.

```sh
NOTES_REGULATION_EVIDENCE=/tmp/notes-regulation-evidence-qNka0H node dev/legacy-diagrams/regulation-test.cjs
node dev/legacy-diagrams/regulation-content.cjs --check
node dev/legacy-diagrams/regulation-browser-test.cjs
node dev/legacy-diagrams/font-test.cjs
```

Without `--check`, the generator writes the native SVG and emits a chapter patch
for apply_patch. It never deploys. The tests check source hashes/selected clauses,
markup, unchanged scripts, generator idempotence, three definition rows and five
notice rows. Clause/string checks establish traceability, not legal correctness
by themselves; source review remains necessary.

The browser test covers the four-node/three-edge diagram, arrowheads, text within
node boxes/viewBox, overlap, XML and 12 chapter views at 1280/390/320px with and
without JavaScript. It checks both sides of scrollable tables, exact table text,
tabs, native worked checks, no page overflow and FGSM/agent smoke interactions.
Artifacts are `/home/ybc/notes-legacy-review-artifacts/regulation-*`.

Preview:
<http://localhost:8787/cybersecurity-reworked/Cyber-05-AI-Security.html#regulation-scope>
through the existing SSH tunnel. No notification is sent, model executed, paid
image generated, production file modified or unrelated service restarted.

## Verified checkpoint — 8 September 2026

- Source/markup test passed against all seven pinned captures; both chapters are
  synchronized with the generator and their existing scripts are unchanged.
- Regulation browser checks passed all 12 desktop/mobile JS/no-JS views and the
  four-node/three-edge SVG. Desktop tables, the original-style diagram and mobile
  governance tabs were also inspected visually in the captured screenshots.
- Adjacent agent checks passed 12 views, all five traces and both missing-model
  fallbacks. Leakage checks passed four plot variants and 12 chapter views.
- The broad HTTP-preview regression passed 26 desktop/mobile visits and all 13
  selected pages with JavaScript disabled, including affected widgets and tabs.
- The font check passed all 56 registered SVG assets, verifying the exact embedded
  IBM Plex Mono font/license and rendered glyphs without font network requests.
- An earlier serial test sequence terminated with exit 143 after its injection
  checks passed. Its termination was confirmed before resuming only the remaining
  suites; those completed successfully. No cause for the signal is established.
- The refreshed inventory contains 315 pages and 1,029 figures across the site;
  the original 15-course scope still contains 208 chapters and 882 figures. These
  are inventory counts, not a claim that every item has been reviewed.
- Preview responded with HTTP 200. Production HEAD remains `f0f4bde`; this
  checkpoint does not publish changes.

## Open scope

This does not certify the whole AI Security course or site. Clinical bibliography,
security-tool/library descriptions and the remaining overview claims need their
own evidence review; narration/audio has not been regenerated. The healthcare
paper's full-text/raw-data/uncertainty limitations remain unresolved. Preexisting
`review/index.html` and `review/report.md` edits are excluded from this checkpoint.
