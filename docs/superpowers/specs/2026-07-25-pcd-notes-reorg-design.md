# PCD Notes Reorganization — Design

Date: 2026-07-25
Status: approved pending user review
Scope: `pcd/` directory of this repo (site served at notes.ybc.sh/pcd)

## Problem

The PCD notes are 23 interactive HTML pages, one per lecture date, grouped into 4 modules. Because lectures recap heavily, every core topic is spread across 3–6 pages with near-duplicate treatments (the Mar 6/13/16 pages each re-explain semaphores, deadlock, readers-writers, monitors, and model checking from scratch), and module/date ordering conflicts (the Module 3 page of May 11 postdates the Module 4 page of May 8). Studying a topic means reading several long overlapping pages.

The exam (see `exam.md` in the `pcd-2025-2026` repo) is an individual oral discussion structured around the student's 4 assignments plus course concepts. The notes must support linear deep study of the theory AND preparation to discuss the actual assignment implementations.

## Goals

1. Topic-based study path: consolidated chapters in dependency order, readable front to back.
2. Zero content loss: every distinct explanation, quote, example, table, callout, widget, and quiz item from the source pages survives, deduplicated but not condensed.
3. Assignment-aware: one oral-prep page per assignment, grounded in the student's real code.
4. Light ybc.sh-style visual refresh with sparing archival-style SVG figures.
5. Date pages deleted (git history is the archive); URLs of chapter pages are new.

## Non-goals

- No condensing/summarizing of theory content (no "ripasso" layer).
- No changes to the other course directories (`ds/`, `pps/`, `cybersecurity/`).
- No external assets; the site stays fully self-contained static HTML.

## Site structure

`pcd/index.html` lists 4 parts → 17 chapters → 4 prep pages, in study order, with per-chapter estimated reading time. Chapter files are named `cap-NN-<slug>.html`, prep pages `prep-assignment-0N.html`.

### Parte I — Concorrenza a memoria condivisa (sources: Feb 16-1, Feb 16-2, Feb 20, Feb 23, Feb 27, Mar 2, Mar 6, Mar 13, Mar 16, Mar 20)

1. Introduzione: concorrenza, asincronia, thread e architetture
2. Modellazione dell'esecuzione: azioni atomiche, interleaving, diagrammi di stato
3. Proprietà di correttezza: safety, liveness, fairness, LTL
4. Sezione critica: Dekker, Peterson, test-and-set, lock
5. Semafori e problemi classici (producer-consumer, lettori-scrittori)
6. Deadlock: filosofi a cena, condizioni di Coffman, prevenzione
7. Monitor e variabili condizione, signaling disciplines
8. Concorrenza in Java: synchronized, ReentrantLock, barriere/latch, task ed executor
9. Verifica formale e model checking: SPIN, JPF, TLA+

→ `prep-assignment-01.html` — Poool (multithreaded + executor versions)

### Parte II — Asincrono e reattivo (sources: Mar 27, Mar 30, Apr 10, Apr 13)

10. Programmazione asincrona: event loop, callback, promise, async/await, coroutine, virtual thread
11. Programmazione reattiva: observable, operatori, scheduler, backpressure

→ `prep-assignment-02.html` — FSStat (event-loop, Rx, virtual-thread versions)

### Parte III — Message passing e attori (sources: Apr 17, Apr 20, Apr 24, Apr 27, May 4, May 11; plus the actor-intro sections of Mar 30)

12. Message passing e canali: modelli, Go
13. Il modello ad attori: concetti, Pekko/Akka, Erlang
14. Attori avanzati: timer, cluster

→ `prep-assignment-03.html` — Smart Home Alarm (Pekko) + Odds-and-Evens (Go)

### Parte IV — Sistemi distribuiti (sources: May 8, May 15, May 18)

15. Computazione distribuita: introduzione e modelli
16. Algoritmi distribuiti: mutua esclusione, elezione, orologi logici, snapshot, consenso
17. Oggetti distribuiti e servizi: RMI/RPC, MOM, SOA

→ `prep-assignment-04.html` — Distributed Alarm (Pekko Cluster) + TTT (Java RMI) + MOM critical sections

Each chapter footer lists its source lectures (dates) for traceability. Sections may move across parts only when clearly misplaced in the lecture flow (known case: actor-intro material in the Mar 30 page belongs to chapter 13).

## Merge rules (unit of work: source `<section id="sN">` block)

- Build an inventory of all source sections (~450), then a **coverage matrix** mapping every source section (page + id) to exactly one destination chapter + anchor. The matrix is committed as `pcd/coverage-matrix.json`.
- Within a chapter, collapse identical re-explanations into one; where two treatments of the same concept differ, keep both angles, interleaved with editorial glue text.
- Preserve verbatim: professor quotes, analogies, examples, tables, callouts ("Nota del redattore"), and interactive widgets (inline scripts move with their section).
- Per-lesson quiz sections merge into one deduplicated quiz per chapter, placed last.
- Language stays Italian, matching the source register.

## Verification (mechanical, post-build)

1. Every source section id appears exactly once in the coverage matrix.
2. Every matrix row's destination anchor exists and contains that section's key content (spot-checkable: headings, code identifiers, quote fragments).
3. All internal links resolve; no link targets a deleted date page.
4. Each chapter page's inline scripts parse (node --check on extracted script bodies) and widgets reference existing DOM ids.
5. index.html links to every chapter and prep page; no orphan files.

## Oral-prep pages

Built from `~/code/pcd-2025-2026/assignments/assignment-0N/` (code + README + report if present). Four parts each:

1. **Cosa ho costruito** — concise architecture recap of the student's solution(s), one per required version.
2. **Scelte concorrenti** — the concurrency-relevant design choices in the actual code, each linking to the theory chapter it exercises.
3. **Domande probabili** — likely oral questions with answer sketches.
4. **Punti deboli** — honest gaps the professor might probe.

Prep pages are built from the current state of each assignment (assignment 1 has uncommitted work in progress; optional exercises may be absent) and are cheap to regenerate as the code evolves. Where a required version/exercise is missing, the prep page says so under "Punti deboli" rather than inventing content.

## Styling and figures

- Restyle `assets/lesson-kit.css` to the ybc.sh palette: warm paper background, deep cobalt + vermilion accents, serif display headings, readable body text. Widget functionality untouched.
- Inline SVG figures in archival-technical style, numbered captions ("Fig. N — …"), added only where a diagram genuinely clarifies. Candidate list (not exhaustive, added at merge time when justified): critical-section state diagram, semaphore invariant, monitor structure, event loop, actor lifecycle, cluster topology, Lamport clocks.
- No external fonts/images/scripts.

## Build pipeline

Work happens on a branch of this repo, orchestrated with the Workflow tool (user opted in):

1. **Inventory** — fan out per page: extract section list (id, heading, topics, widgets, quotes).
2. **Mapping** — build the coverage matrix against the approved chapter list (barrier: needs all inventories).
3. **Merge** — per-chapter agents in parallel, each producing one chapter page from its assigned sections.
4. **Prep pages** — per-assignment agents reading the pcd-2025-2026 repo.
5. **Verify** — coverage, links, HTML/script checks (fix and re-verify until clean).
6. **Assemble** — new index.html, restyled lesson-kit.css, delete the 23 date pages.

Deploy: user reviews a local preview; on approval, merge + push, then `git pull` on the VPS (`ssh ybc@ybaro.it`, `~/hosted/unibo-lessons`). Nothing touches the live site before review.
