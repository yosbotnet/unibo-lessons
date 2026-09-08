# Agent proposals, policy checks and dispatch

Both AI Security chapters share `#agent-enforcement`: original section 16
(retaining its complete differential-privacy block), reworked section 14,
the ReAct recap, and the existing `#react-flow` widget anchor. The older
local-safe/external-unsafe explorer is replaced, not silently certified.

## Evidence and corrections

Local course source: `/home/ybc/content/exams/Cybersecurity/03 - privacy in LLM.pdf`
and its `slides-text/03 - privacy in LLM.txt`, agent/ReAct/trust-boundary slides.
The old discussion conflated location with authorization and model proposals
with dispatched operations. Residency paragraphs and the study setup now qualify
the slides' “safe”/“unsafe” tool labels as scenario assumptions. This does not
validate the study's metrics, model-size table or healthcare/legal conclusions.

Primary references checked:

- [Yao et al., ReAct v3](https://arxiv.org/abs/2210.03629v3), ICLR 2023:
  interleaved reasoning/actions/observations; section 3.1 search, lookup and
  finish action space; visually inspected PDF page 2, Figure 1. It is an
  interaction pattern, not an authorization mechanism.
- [Debenedetti et al., CaMeL v2](https://arxiv.org/html/2503.18813v2), June 2025:
  sections 3–5, 7 and 9, control/data flow and capability-based tool policies,
  trusted-input assumptions, non-goals, side channels and declassification.
  Visually inspected PDF page 5, Figure 3 and explicit non-goals. The lesson's
  small policy is not CaMeL and inherits none of its proofs or benchmark scores.

PDF hashes are pinned in `agent-test.cjs`; local evidence is
`/tmp/notes-agent-evidence-KkGtAi/{react,camel}.pdf`. No LLM, private data,
real search, tool execution or paid image generation is involved.

## Reproducible figure and model

`agent-content.cjs` uses the shared build-time Mermaid adapter. Seven named
nodes and seven edges cover request → proposal → check, denial → blocked,
permission → dispatch, dispatch → observation → proposal, and dispatch → finished.
The checked-in SVG is 773×587, with embedded original IBM Plex Mono at 14px,
ivory/cobalt/vermilion, straight/angular routes and no HTML inside SVG.
The final-reply branch precedes the observation branch in the source so the
return loop no longer crosses the reply arrow. A 25px node gap keeps the full
figure inside the 800px desktop column, including its wrapper padding; mobile
retains native-size horizontal scrolling. Prose remains in HTML.

`cybersecurity/assets/agent-policy-model.js` is the shared deterministic model:
actor and owner A/B; destination record-store/search/reply; data public/record.
Own records can enter record-store or the actor's reply; other accounts' records
are denied. Search accepts public data only. Public record-store requests are
outside the toy operation's domain and denied. Exactly four fields are required.
Identity/ownership/labels are trusted inputs here, not model assertions.

Five prewritten traces show own-local, other-local, public-search, private-search
and an untrusted search result followed by a new private-data proposal. Every
proposal gets a new check. That final example retains its first completed call
even though its second dispatch is blocked. Replies are checked too. There is
no claim about real authentication, provenance tracking, classification, complete
mediation, exception handling or a production policy enforcement boundary.

`agent-policy-widget.js` steps through exactly those model states. Native details
contain all five complete traces even without JavaScript or when the model asset
fails to load; controls remain disabled in those cases. UI text uses textContent.
The lesson explicitly warns that editable browser code cannot enforce real access.

## Reproduce and verification scope

```sh
NOTES_AGENT_EVIDENCE=/tmp/notes-agent-evidence-KkGtAi node dev/legacy-diagrams/agent-test.cjs
node dev/legacy-diagrams/agent-content.cjs --check
node dev/legacy-diagrams/agent-browser-test.cjs
node dev/legacy-diagrams/font-test.cjs
```

To regenerate, run `agent-content.cjs` without `--check`, then apply its emitted
chapter patch with apply_patch. It writes only its generated SVG directly.

Tests enumerate all 24 policy combinations against an independent predicate,
15 invalid cases, five exact traces and 29 transitions against the graph's edges.
They check no input mutation, fresh scenario/trace objects, complete DP block
preservation, chapter markup, source pins and generator synchronization.

Browser coverage is two chapters × 1280/390/320px × JS/no-JS, plus two missing-model
fallbacks. Assertions cover all static/dynamic trace steps, reset and terminal
state, keyboard/touch, source download, citations, quiz, duplicate IDs, horizontal
scroll, overflow, native SVG bounds/text overlap/markers and deterministic output.
The loop/reply intersection and desktop no-scroll constraints are regression-tested.
Widget interactions must issue no network requests. Viewport screenshots avoid
the known tall no-JS locator-screenshot stability issue; assertions still visit
every step and every complete static trace. Artifacts are under
`/home/ybc/notes-legacy-review-artifacts/agent-*`.

The privacy and transfer regression suites now exercise the replacement widget;
their unrelated checks remain. Privacy source tests explicitly account for the
two new script assets while preserving the previous script set and widget hooks.

Verified checkpoint, 8 September 2026: the agent source/model test and all 12
agent views plus two fallbacks pass on the final 773×587 layout. Visually reviewed
the complete SVG, its desktop chapter presentation and 390/320px widget states.
The generator is synchronized. Font testing confirms 53 SVGs carry the exact
original embedded font and license, including the new asset. Privacy (12 views),
transfer (8 views) and FGSM (12 views plus two fallbacks) regression suites pass.
The final broad suite uses the running HTTP preview and passes 26 desktop/mobile
visits plus 13 no-JS pages. These are the suites' bounded coverage, not a site-wide
content certification. Inventory is now 315 HTML pages / 1,023 figure elements;
the original fifteen-course inventory remains 208 / 882.

Preview: <http://localhost:8787/cybersecurity-reworked/Cyber-05-AI-Security.html#agent-enforcement>
through the existing SSH tunnel. Production was checked at `f0f4bde` and not changed.

## Open scope

This is an agent-architecture checkpoint, not certification of all AI Security or
notes. Deployment tables, Attack@1 and slide-reported healthcare evidence are
addressed in [HEALTHCARE-EVALUATION.md](HEALTHCARE-EVALUATION.md), including its
explicit full-text/raw-data limitations. Alignment and injection claims are
addressed in [INJECTION.md](INJECTION.md). Regulatory material and narration still
need review. Production remains separate; this workflow neither deploys nor
restarts services.
