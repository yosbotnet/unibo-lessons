# Static editorial flowcharts from Mermaid

This is a build-time adapter, not a Mermaid fork, replacement parser or universal
diagram engine. It complements the specialized native presets in `../diagrams`.
The existing Mermaid text notation provides named connections, native shapes,
subgraphs, undirected/bidirectional links and dashed arrows. The adapter fixes the
palette, 14px original monospace font stack, line weight and straight/angular
routes; it preserves the engine's domain-specific arrowheads.

Ten reviewed sources live in `sources.cjs`. No coordinates or bend points occur in
these source records. Supported overrides: direction, nodeSpacing and rankSpacing.
Unknown overrides fail; fonts are never made smaller to accommodate content.
Only flowchart/graph input is supported here. Sequence/class diagrams remain with
their existing renderers until separately reviewed; neuron presets remain intact.

## Build and review

```sh
cd dev/legacy-diagrams
npm ci --ignore-scripts
npx playwright install chromium  # only if this pinned browser is not installed
node build.cjs                  # generates SVG assets and review gallery
node build.cjs --patch          # prints a chapter patch for apply_patch
node build.cjs --check          # fails on chapter/asset drift; no source writes
node test.cjs
node ricart-test.cjs
node browser-test.cjs
REPORT_NAME=audit-final node audit.cjs
```

Mermaid 11.17.2 and Playwright 1.62.1 are pinned in package-lock.json. These are
development dependencies, never sent to readers. There is no AI image generation,
paid call, service restart or deployment in these commands. Rendering uses the
locally installed browser and packages without network access. Original target
blocks are protected by `original-hashes.json`; later updates use explicit markers.
The renderer generates standalone `.svg` files under course `assets/diagrams/`;
chapters load them as images at their native size, in keyboard-scrollable regions.
Titles and explanatory HTML captions remain accessible without SVG support.

Mermaid theme configuration and linear curves follow the
[official configuration](https://mermaid.js.org/config/theming.html) and
[flowchart options](https://mermaid.js.org/config/schema-docs/config-defs-flowchart-diagram-config.html).
SVG labels are actual text/tspan, never foreignObject. Rendering outside the lesson
avoids the zero-size/NaN geometry caused by measuring hidden tab panels.

## Evidence and limits

The baseline audit rendered 119 blocks in 33 pages at 1280 and 390 px, using pinned
local Mermaid and highlight.js in place of their CDN URLs. Other remote requests
(including Google Fonts) are blocked. Tabs are opened using their real controls.
It found five error SVGs, plus a sixth empty/NaN SVG found when geometry checks were
added. It does not certify the remaining diagrams' scientific correctness.

- PCD 02, interleaving: raw `<stato iniziale>` was parsed as HTML. Replaced the
  mixed process/state diagram with all five reachable states and four transitions.
  Corrected the accompanying first-vs-last assignment explanation.
- PCD 12, symmetric exchange: rendering inside a hidden panel generated invalid
  geometry. The original also omitted outgoing messages from P0 and P3. The new
  three-strategy set uses the same four participants and explains message counts.
- PCD 16, Ricart–Agrawala: unquoted parentheses caused parse failure; the diagram,
  prose, pseudocode and interactive model now distinguish REQUESTING and HELD,
  break timestamp ties with process IDs, and wait for distinct permissions.
- PCD 16, consensus rounds: braces in unquoted labels caused parse failure.
  Explicitly shows a fault-free example within a synchronous crash-stop model;
  stages are connected and are not confused with individual network messages.
- PCD 16, SMR/Raft: nested square brackets caused parse failure. Replaced the
  external-consensus/load-balancer sketch with a logical SMR overview and a
  separate leader/follower Raft example; application follows commit.
- DS M1: chain of threats now has native text, consistent styling and no Mermaid
  runtime dependency. Existing availability calculator retained and tested.
- DS M2: independent contexts was an empty 16×16 viewBox with NaN geometry in a
  hidden panel. The static version retains separate contexts and bidirectionality.
- DS C4: removed an orphan initialization of a nonexistent hidden code host;
  corrected digital-signature and ordering descriptions. This is not a full
  certification of that chapter.

Local comparison material is under
`/home/ybc/content/exams/Programmazione Concorrente e Distribuita (PCD)/lessons/`,
especially 2026-02-27, 2026-04-20 and 2026-05-18. These generated lesson notes share
some of the original mistakes and are not independent proof. Primary references:
[Ricart–Agrawala](https://doi.org/10.1145/358527.358537),
[Raft paper](https://raft.github.io/raft.pdf),
[NIST FIPS 186-5](https://csrc.nist.gov/pubs/fips/186-5/final).

## Remaining scientific review findings

These are concrete next checks, not claims that whole chapters are repaired:

- PCD 16: check Chang–Roberts worst-case message count, causal-order sequence
  example, Chandy–Lamport explorers and the stated resilience of the two-phase
  king variant. The chapter contains additional interactive material not covered
  by the Ricart–Agrawala tests.
- DS C4: qualify CAP, FLP, hash-chain immutability and BFT threshold/termination
  claims against their precise system models.
- DS M1: numerical availability examples and reliability distribution assumptions
  need reconciliation beyond the preserved calculator.
- Cybersecurity and cybersecurity-reworked, chapter 05: verify the attribution of
  VGG→ResNet transfer to a 2015 paper and the unsourced transfer-rate table before
  turning it into a new illustration.
- The other runtime Mermaid figures and the rest of the full-site inventory still
  need current visual and semantic review. An SVG existing is not proof of that.

Preview: `http://localhost:8787/review/legacy-diagrams/` through the existing SSH
tunnel. Production is separate and remains unchanged pending approval.
