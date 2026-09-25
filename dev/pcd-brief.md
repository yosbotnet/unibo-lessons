# PCD rewrite — writer's brief

Course: Programmazione Concorrente e Distribuita (PCD), UniBo Cesena, ISI LM, a.a. 2025/2026, Prof. Alessandro Ricci.
Audience: master's students who did NOT attend the lectures and will study only from these notes for an oral exam
(individual discussion of four assignments + course concepts). The notes must replace the course, but be readable:
concept-first, compressed, each idea explained once.

## Where things are

- Live site (do not edit): `/home/ybc/hosted/unibo-lessons/pcd/` — the OLD chapters. Treat them as a draft to mine, not as truth.
- Staging (write here): `/home/ybc/hosted/unibo-lessons/pcd-next/` — new chapters, same `assets/` folder.
- Models to imitate (already approved by the user): `pcd-next/cap-04-sezione-critica.html` and `pcd-next/cap-15-attori.html`.
  Read both fully before writing. Copy their head, nav, header, TOC, "Il capitolo in un paragrafo", section, quiz,
  coverage and footer structure exactly.
- Primary sources (truth):
  - Slides as text: `/home/ybc/content/exams/Programmazione Concorrente e Distribuita (PCD)/slides-text/*.txt`
  - Lecture transcripts (Italian, automatic): `/home/ybc/content/exams/Programmazione Concorrente e Distribuita (PCD)/transcripts/PCD-2026-MM-DD.md`
  - Old per-lecture pages: `git -C /home/ybc/hosted/unibo-lessons show 1424105^:pcd/PCD-2026-MM-DD.html` (generated earlier; use only as a pointer).
  - Mapping of old lecture sections to old chapters: `/home/ybc/hosted/unibo-lessons/pcd/coverage-matrix.json`.
- Exam question bank (students' list, 227 questions): `/home/ybc/pcd-exam-questions.txt`. The questions are valuable; many of
  the students' ANSWERS are wrong — never copy an answer without checking it against slides/transcripts.

## New chapter map (use these exact filenames in every link)

| File | Title (short) | Main sources |
|---|---|---|
| cap-01-introduzione.html | Introduzione: concorrenza, parallelismo, architetture | [Introduction], module-1.1 |
| cap-02-modellazione.html | Modellazione dell'esecuzione concorrente | module-1.2 (interleaving, atomicity, state diagrams, processes, interaction) |
| cap-03-correttezza.html | Correttezza: safety, liveness, fairness, LTL | module-1.2 (second half) |
| cap-04-sezione-critica.html | Il problema della sezione critica | DONE |
| cap-05-semafori.html | Semafori e problemi classici | module-1.3 |
| cap-06-deadlock.html | Deadlock | module-1.3, Lab Notes Thread Liveness |
| cap-07-monitor.html | Monitor e variabili condizione | module-1.3, Lab Notes Implementing Monitors in Java |
| cap-08-progettazione.html | Progettare programmi concorrenti (NEW) | module-1.4 |
| cap-09-formalismi-visuali.html | Formalismi visuali: reti di Petri e statechart (NEW) | module-1.5 |
| cap-10-java.html | Concorrenza in Java: thread, sincronizzazione, task, executor | Lab Notes: Multithreaded Overview, Thread Safety, Thread Coordination Library, Task-Oriented, GUI Frameworks, Performance, Virtual Threads |
| cap-11-verifica.html | Verifica formale e model checking | lectures 2026-03-02, 03-06 (+ parts of 02-20, 02-27, 03-13, 03-20), old cap-09 |
| cap-12-async.html | Programmazione asincrona | module-2.1 |
| cap-13-reattiva.html | Programmazione reattiva | module-2.2, Lab Notes RxJava |
| cap-14-message-passing.html | Message passing e canali | module-3.1 |
| cap-15-attori.html | Il modello ad attori | DONE |
| cap-16-attori-avanzati.html | Attori avanzati: timer e cluster | module-3.2 (later part), lectures on Pekko timers/cluster |
| cap-17-distribuiti.html | Computazione distribuita: modelli e orologi logici | module-4.1 |
| cap-18-algoritmi-distribuiti.html | Algoritmi distribuiti | module-4.2 |
| cap-19-servizi.html | Oggetti distribuiti, servizi e middleware | module-4.3, Lab Notes Message-Oriented Middlewares |

Parts: I = cap 01–11 "Concorrenza a memoria condivisa"; II = 12–13 "Programmazione asincrona e reattiva";
III = 14–16 "Message passing e attori"; IV = 17–19 "Sistemi distribuiti".
Prep pages keep their names: prep-assignment-01.html … prep-assignment-04.html. The index is index.html.
Top nav: previous chapter ← · Indice · next chapter →, using the table above (cap-01 has no previous; cap-19 has no next).

## House rules (from the two approved pilots)

1. **Language:** Italian, correct accents written as UTF-8 characters (più, perché, è, già — never "piu", "perche", "e'").
2. **Concept-first:** sections are named after the question they answer; group what the lectures said about a topic across
   all lectures into ONE explanation. The lectures repeated topics many times; the notes must not.
3. **One idea, once.** No "Idea chiave" boxes that restate the paragraph above. No "Nota del redattore". No lecture narration
   ("il professore sottolinea", "nella lezione", "Il Prof. Ricci mostra"). A "Per l'esame" callout is allowed only for
   genuine exam guidance (e.g. a question Ricci actually asked — see list below, or something he said will be asked).
4. **Open with** `<p><strong>Il capitolo in un paragrafo.</strong> …</p>` (60–110 words).
5. **Professor's lists stay complete.** If a slide enumerates N items, the notes have all N. Long enumerations that are not
   central go in a `<details><summary>Dalle slide: …</summary>` block.
6. **Beyond the slides** material is allowed when it helps understanding or corrects something, marked with
   `<div class="callout note"><span class="callout-label">Oltre le slide</span>…</div>`. Keep it short.
7. **Code:** one example per concept, correct, compilable/idiomatic, current APIs (Java 21, Pekko typed, modern JS). Drop
   obsolete APIs unless the slides insist on them. Keep the example the slides use when there is one.
8. **Correct errors.** The old notes contain wrong claims. Check every technical claim you keep against slides/transcripts or
   solid knowledge. List every error you fixed in your report.
9. **Widgets:** keep the existing custom instruments in `assets/*.js` (dining-philosophers, ricart-agrawala, chang-roberts,
   phase-king, consistent-cuts, causal-order, centralized-mutex, monitor-code, thread-basics, ltl-traces…) when they work and
   teach something; drop `LessonKit.stateExplorer`/`stepper` widgets that only narrate. You MAY write a new small instrument
   (pure JS in `pcd-next/assets/`, UMD pattern like `assets/cs-attempts.js` / `assets/actor-lab.js`, testable with `node`)
   only if it computes something the reader could not see from the text. Test its logic with node.
10. **No browsers.** Do NOT run Playwright, Chromium or any headless browser — this machine crashes under browser load. The
    lead will run the browser checks. Use node/python only.
11. **Figures:** inline SVG with a `viewBox`, width ≤ 640, all text inside the viewBox, readable at 390 px width. Existing
    SVGs in `assets/diagrams/` may be reused. No Mermaid.
12. **Quiz:** `<section id="quiz">` with 6–10 `<details>` questions, ONLY about this chapter, answers 1–3 sentences.
13. **Coverage block** before the footer: `<details class="lk-coverage"><summary>Da quali lezioni viene questo capitolo</summary>`
    listing slide decks and lecture dates.
14. **Footer:** chapter nav + "Fonti: …" line.
15. **Budgets** (prose words excluding code and quiz) are targets, not quotas; shorter is fine if nothing is lost.

## Exam questions

Questions marked **(A)** Ricci actually asked in an oral; **(N)** he announced they would be asked. Every question listed
for your chapter must be answerable from your chapter's text. The ones about "your assignment" belong to the prep pages.

Asked (A): 11, 26, 49, 50, 64, 72, 73, 75, 76, 77, 89, 91, 92, 93, 109, 110, 114, 115, 121, 132, 133, 134, 135, 136, 137,
143, 156, 163, 165, 166, 169, 170, 176, 178, 182, 187, 201, 225, 226, 227. Announced (N): 74, 79, 95, 97, 113.

Per chapter:
- cap-01: 1–13 (note 11 A), 48
- cap-02: 14–25, 29–36, 65
- cap-03: 37–41, 58–61
- cap-05: 52, 72–79 (72, 73, 75, 76, 77 A; 74, 79 N) — 75 is an exercise: show the solution; 76 asks for its Petri net (link cap-09)
- cap-06: 26–28, 66–68, 80
- cap-07: 81–88, 94–97, 102 (95, 97 N)
- cap-08: 92, 98, 99, 106–108, 111–113 (113 N)
- cap-09: 76, 103, 104
- cap-10: 42–50, 69–71, 86, 88, 100, 101, 115–124 (49, 50, 115, 121 A) — pool sizing rule N_threads = N_cpu · U_cpu · (1 + W/C) and "N+1" for CPU-bound
- cap-11: 62–64, 105, 109, 110, 114 (64 A)
- cap-12: 125–150 (132–137, 143 A)
- cap-13: 151–162 (156 A)
- cap-14: 167–175 (169, 170 A)
- cap-16: cluster/timer material (no specific questions)
- cap-17: 187–191, 194–198 (187 A)
- cap-18: 199–211 (201 A)
- cap-19: 47, 192, 193, 212–224

## Report back (final message, ≤ 600 words per chapter)

For each chapter: prose words before/after; what was cut, in four groups (repetition / dropped on purpose / small facts lost /
wrong claims removed); errors fixed; new material added from the slides; exam questions covered (list numbers); any doubt
the lead should check. Do not paste the chapter back.
