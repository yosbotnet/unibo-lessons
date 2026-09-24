# Distributed Systems (reworked) — writer's brief

This folder replaces `../ds/` (17 slide-by-slide lessons, ~87k words, verbose, several factual errors).
The student said plainly: they will never study long verbose notes. The new course **groups and compresses
concepts into a new text**, instead of expanding each slide into a note page.

## Who it is for, and the exam

- UniBo ISI master's student, course "Distributed Systems", Prof. Andrea Omicini, A.Y. 2025/26.
- **The exam is an oral discussion of a project** (after a project-artefact check). There is no written test.
  So: no "The examiner will ask" boxes, no exam tips, no drill. Prepare the student to *discuss* concepts and to
  show them in a project.
- The student's project, **Thunk**: a peer-to-peer distributed evaluator for pure functional computations in
  Elixir/BEAM, Docker Compose cluster. Combinators (map/reduce + divide-and-conquer), recursive splitting past a
  size threshold, decentralised **work stealing** (idle worker asks a random peer), results combined back,
  optional: fault-tolerant **re-execution** of lost work (purity makes it safe), distributed **termination
  detection** (Dijkstra-Scholten), **memoisation** of shared sub-results (purity makes caching safe),
  dynamic membership, dashboard. Computations travel as data (small operator DSL), not serialised closures.
- The slides are the reference: the professor reasons in the slides' terms.

## Sources

- Slide text (authoritative): `/home/ybc/content/exams/Distributed Systems/slides-text/*.txt`
  (file names start with the deck id: M0..M9, C1..C6, CX, A0). Figures are lost in extraction; reconstruct
  their meaning only when the surrounding text makes it unambiguous.
- Old lessons (reference only; do NOT copy their prose; they contain known errors listed per chapter in your task):
  `/tmp/claude-1000/-home-ybc/82487059-35ce-409c-af14-3e842d441e7d/scratchpad/ds-old/DS-<ID>.html`.
  You may salvage a widget idea or an SVG if it is correct.
- **The model chapter: `ch-02-time.html`.** Read it fully before writing. Match its structure, tone,
  density and components.

## Hard rules

1. **Concept-first structure.** Organise by ideas, not by slide order. Merge the decks you are given into one
   argument with 6-10 `h2` sections. Each idea is explained **once**, in one place; later mentions link back.
2. **Length budget** is given in your task (words of visible text, excluding scripts/SVG). Stay within it.
   Short sentences, no filler, no restating paragraphs, no callout that repeats the paragraph above it.
3. **Faithful to the slides.** Every definition the slides give goes in a `.defn` block with the slides'
   terminology and the citation the slides use. **Every list the professor enumerates is kept complete and
   countable** in a `ol.ds-count` (with an optional `.ds-count-head` title), in the static HTML (never only
   inside a widget). Keep the slides' own examples and numbers.
4. **When the slides are wrong or loose**, state what the slides say, then a `.slidefix` box with the
   correction. Never silently "fix" the professor, never argue with the slides' framing in the body.
5. **Beyond-the-slides content** goes in a `.beyond` box (max ~3 per chapter), only when it truly helps
   understand slide material. Keep it short.
6. **Banned:** "The examiner will ask", "Exam tip", "Key idea" boxes that restate text, hedging boilerplate
   ("this is not proof that...", "in this simplified model..." repeated), meta/drafting language ("corrected",
   "earlier wording", "as of <date>", "the original slides use shorthand"), emojis, invented statistics,
   mermaid, external JS libraries, raster images.
7. **Template** (see ch-02): chapter nav (top and bottom) · header (kicker `Part X — Name · Chapter N`, h1,
   `.lk-meta` with read time + instrument count + `A.Y. 2025/26 · Prof. Omicini`, `.ds-sources` chips for the
   decks) · `.ds-spine` (the one question the chapter answers) · `.ds-thesis` (the argument in one paragraph) ·
   `.ds-contents` strip · sections · `#oral` "For the oral" (`.ds-oral`, 4-6 `<details>` discussion prompts
   with short answer outlines) · `.ds-project` "Project lens · Thunk" (3-5 bullets, only honest connections) ·
   `details.ds-coverage` slide coverage table (every slide section of your decks → section here) · bottom nav
   · `footer.lk-foot` (copy ch-02's).
8. **Instruments** (widgets): 1-3 per chapter that *do work* (compute, check, simulate, classify), inside
   `.ds-inst` with header `Instrument N` + name, a one-line `.ds-inst-howto`, a `<noscript>` fallback that
   states the key result. Plain JS in an inline `<script>` at the end (IIFE, no globals except what you need).
   Use `assets/spacetime.js` (`DSSpaceTime.mount`, API documented at the top of the file) wherever events,
   messages, cuts or checkpoints are involved. Reuse lesson-kit helpers if useful (`LessonKit.stepper`,
   `stateExplorer`, `annotatedCode`, tabs) — see the top of `assets/lesson-kit.js`.
   Use `.ds-seg`, `.ds-btn`, `.ds-row`, `.ds-readout`, `.ds-verdict` classes from `assets/ds.css`.
9. **Figures:** inline SVG in `figure.lk-fig` with `role="img"`, `aria-label`, numbered caption
   `<b>Fig. N.k</b> — ...`, colours only via `var(--lk-*)` tokens (cobalt structure, sparse vermilion).
   Text inside SVG must stay inside the viewBox. Wide diagrams: wrap the svg in `<div class="figure-diagram">`.
10. **Mobile:** readable at 390px with no horizontal page scroll for prose.
11. **Do not edit shared files** (`assets/*.css`, `assets/*.js`, other chapters). If you need extra CSS, add a
    small `<style>` block in your chapter using `--lk-*` tokens. If you find a bug in `spacetime.js`, report it
    in your final message instead of editing.
12. **Cross-links:** use `<a class="xref" href="ch-0N-....html#anchor">Ch. N</a>` to the anchors in the
    registry below; your own chapter **must** expose the anchors listed for it (as `id` on a section or
    heading).
13. Wrap each term the chapter defines in `<dfn>` once, at its defining occurrence (a glossary is generated
    from these; add `id="term-<slug>"` to each dfn).

## Chapters, files and anchor registry

| # | File | Title | Part | Decks | Must expose ids |
|---|---|---|---|---|---|
| 1 | ch-01-distribution.html | What makes a system distributed | I — Foundations | M0, M2, M4, M5 | contexts, definitions, goals, transparency, fallacies, sorts |
| 2 | ch-02-time.html | Time, order and causality | I — Foundations | M6, C5 | physical, causality, logical, scalar, vector, coordination |
| 3 | ch-03-space.html | Space, situatedness and mobility | I — Foundations | M7, C6 | space, spatial-computing, mobility, resources |
| 4 | ch-04-failure-recovery.html | Failure and recovery | II — Failure, replication, agreement | M1, C2 | dependability, attributes, faults, global-state, snapshots, checkpointing, logging |
| 5 | ch-05-replication-consistency.html | Replication, consistency and CAP | II — Failure, replication, agreement | M3, C1 | replication, data-centric, client-centric, cap, base |
| 6 | ch-06-consensus.html | Consensus | II — Failure, replication, agreement | C3 | problem, flp, paxos |
| 7 | ch-07-ledgers.html | Distributed ledgers as middleware | II — Failure, replication, agreement | C4 | middleware, smr, blockchain, pow, smart-contracts |
| 8 | ch-08-modelling.html | Modelling: architectures and process algebra | III — Models and machinery | M8, M9 | architectures, styles, process-algebra, semantics |
| 9 | ch-09-kubernetes.html | Running it in production: Kubernetes | III — Models and machinery | CX | containers, objects, control-loop, scaling |

Other pages (written separately): `index.html`, `project.html` (course concepts through the Thunk project),
`glossary.html` (generated from `<dfn id="term-...">`). Nav: chapter 1's "previous" is the course index;
chapter 9's "next" is `project.html` ("Project companion").

## Self-check before you finish

- Run: `node /tmp/claude-1000/-home-ybc/82487059-35ce-409c-af14-3e842d441e7d/scratchpad/shot.cjs file:///home/ybc/hosted/unibo-lessons/ds/<file> /tmp/claude-1000/-home-ybc/82487059-35ce-409c-af14-3e842d441e7d/scratchpad/<name>.png 1280 1`
  (and again with width 390) — it prints any console/page errors; then look at the screenshots
  (Read the png) and fix layout problems. Exercise every instrument once with a small Playwright script if
  practical (playwright is at `/home/ybc/hosted/unibo-lessons/dev/node_modules/playwright`).
- Count words (visible text without script/svg); stay within budget.
- Walk the slide text top to bottom and confirm every slide section appears in your coverage table and in
  the text.
- Final message: file written, word count, instruments, anything from the slides you deliberately left out
  and why, any spacetime.js bugs found.
