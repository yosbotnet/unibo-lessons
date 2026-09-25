# PPS restructuring — writer's brief

Course: Paradigmi di Programmazione e Sviluppo (PPS), UniBo Cesena, ISI LM, a.a. 2025/2026, Prof. Mirko Viroli. Notes are in
ENGLISH (keep them in English). Audience: master's students preparing the exam, which is: a project (team or individual),
its discussion, and additional questions on FP and LP concepts. Per the intro deck the exam checks four things:
(1) FP concepts, (2) FP vs OOP and good fluency in Scala, (3) LP concepts and reasonable fluency in Prolog on simple programs,
(4) software-engineering principles/techniques and quality programming skills.

This is a RESTRUCTURING pass, not a compression job: the old notes (`pps/PPS-0*.html`, ~41k words) are accurate, have almost no
repetition and good worked examples. Their problems: 15–20 flat sections per lesson with no grouping; code that exists only
inside JavaScript widgets (invisible without JS or in print); "Why this matters / Design principle / Key idea" boxes that
restate the text; meta-talk about "the slides"; "oral question / examiner will ask" boxes that guess at the examiner (there
are no transcripts for PPS — nobody recorded what Viroli asks); overlap between lesson 1 and lesson 6 (SE principles table,
Agile Manifesto). Keep the substance and the worked examples; fix the form. Length may stay similar; cut only what is
redundant.

## Where things are

- Old lessons (read, do not edit): `/home/ybc/hosted/unibo-lessons/pps/`.
- Staging (write here): `/home/ybc/hosted/unibo-lessons/pps-next/` (same `assets/`).
- Structural model to imitate: `/home/ybc/hosted/unibo-lessons/pcd/cap-15-attori.html` and `pcd/cap-04-sezione-critica.html`
  (Italian, but copy the structure: header, TOC, one-paragraph summary, sections named after questions, quiz, coverage block,
  footer). Keep the PPS stylesheet `assets/lesson-kit.css` (it includes the `.lk-figure` additions) and PPS's own look.
- Sources of truth: slide decks as text in `/home/ybc/content/exams/Paradigmi (PPS)/slides-text/*.txt`, the course code in
  `/home/ybc/content/exams/Paradigmi (PPS)/repos/` (code-scala, code-java, seminar-testing, tdd-solid-bankaccounts) and
  `/home/ybc/content/exams/Paradigmi (PPS)/0*-code.txt, 1*-code.txt`.
- Toolchain (use it — every code block should be checked). ALWAYS use these wrappers: they take a machine-wide lock so only one JVM runs at a time (4 cores / 7 GB RAM shared by several writers). Never call scala-cli, java or sbt directly, never start a bloop/compile server, and keep one compile per command:
  - Scala 3.3.6 / Java 21: `pps-scala run File.scala` (also `pps-scala test …`, `pps-scala compile …`)
    (put `//> using scala 3.3.6` at the top; for tests add `//> using test.dep org.scalatest::scalatest:3.2.19` and use
    `pps-scala test`). Java: `pps-java File.java` (single-file source launch). Work in your own scratch folder
    named after you (other writers run in parallel; do not overwrite shared files).
  - Prolog (the course's tuProlog 4.0.3): `tuprolog-query theory.pl "goal." [maxSolutions]` or `tuprolog-query - "goal."`.
  - node for widget logic. NO BROWSERS — never run Playwright/Chromium (the machine crashes under browser load).

## New lesson map (exact filenames; use them in every link)

| File | Title | Main sources |
|---|---|---|
| PPS-01-Software-Quality-and-Testing.html | Software quality, testing and tooling | 00-intro (course/exam organisation, short), 00-lab (git basics — currently missing from the notes), 01-quality (except the agile-methodology section: link to lesson 8), 01-lab, 01b-lab, Seminar-AdvancedTesting |
| PPS-02-Functional-Programming-Basics.html | Functional programming basics in Scala 3 | 02-fp-basic, 02lab-fp, 02-code.txt |
| PPS-03-Functional-Data-Structures.html | Functional data structures | 03-fp-structures, 03lab |
| PPS-04-Advanced-Functional-Programming.html | Advanced FP: ADTs, modules, type classes, monads | 04-fp-advanced, 04lab |
| PPS-05-Scala-OOP.html | Object-oriented programming in Scala | 05-scala-oop, 05lab |
| PPS-06-Scala-Scalability.html | Scala for scalable software: collections, mutability, modularity | 06-scala-scalability, 06lab |
| PPS-07-Advanced-Scala.html | Advanced Scala: types, mixins, variance, contextual abstractions | 07-scala-advanced, 07lab |
| PPS-08-Agile-and-Methodology.html | Agile development and software methodology | 08-Agility, 08b-Methodology, agile section of 01-quality |
| PPS-09-Logic-Programming.html | Logic programming: the paradigm and its computational model | 10-LogicProgramming, 10-lab, 10-code.txt |
| PPS-10-Prolog-Programming.html | Programming in Prolog: built-ins, idioms, metaprogramming | 11-Prolog, 11-lab, 11-code.txt, 12a-prolog-metaprogramming |
| PPS-11-Java-Scala-Prolog-Integration.html | Java/Scala/Prolog integration and cross-platform Scala | 12b-JavaScalaProlog, 12c-scala-cross-platform, 12-lab, 12-code.txt |

Parts: I "Software quality and testing" (01); II "Functional programming in Scala 3" (02–04); III "Scala for scalable
software" (05–07); IV "Process and methodology" (08); V "Logic programming and integration" (09–11).
Nav: `← Lesson N — Title` · `Index` · `Lesson N — Title →` (index.html). Kicker: `Part X — … · Lesson N`.

## House rules

1. English, clear and direct. Sections are named after the question they answer, grouped: a lesson has at most ~8–10 `<h2>`
   sections (use `<h3>` inside them). Give each lesson a TOC.
2. Open with `<p><strong>The lesson in one paragraph.</strong> …</p>` (60–110 words).
3. One idea, once. No boxes that restate the paragraph above (delete "Key idea / Why this matters / Design principle / Takeaway"
   boxes unless they add something new — then merge it into the prose). No meta-talk ("the slides show", "extracted from the
   slides"); cite a slide only when quoting it or correcting it.
4. **All code visible**: every code example is a `<pre><code class="language-scala|java|prolog">` block in the page. A widget
   may remain as an extra (e.g. an evaluation stepper that actually computes steps), never as the only place code lives.
   Drop widgets that only narrate or re-display code. You may write a small new instrument (pure JS in `pps-next/assets/`,
   UMD pattern like `/home/ybc/hosted/unibo-lessons/pcd/assets/actor-lab.js`, node-tested) only if it computes something the
   reader cannot see from the text (e.g. a Prolog resolution/SLD-tree stepper, a call-by-name/need evaluation tracer, a mixin
   linearisation calculator).
5. **Check the code**: compile/run every Scala/Java example with scala-cli/java and every Prolog example with tuprolog-query;
   the printed outputs in the notes must be the real outputs. Keep the slides' examples. Report anything that did not compile.
6. **Exam framing**: the exam is project + discussion + FP/LP questions. Replace "The examiner will ask / Oral question"
   boxes with a single end-of-lesson `<section id="quiz">` "Check your understanding" (6–10 `<details>` questions with 1–3
   sentence answers, practice questions about THIS lesson only). For lessons 1 and 8 say plainly, in one sentence, that the
   material matters mainly for how you build and document the project (process, testing, quality) rather than for concept
   questions.
7. Keep professor's lists complete (long non-central enumerations may go in `<details><summary>From the slides: …</summary>`).
8. "Beyond the slides" material, when useful or corrective, in `<div class="callout note"><span class="callout-label">Beyond the slides</span>…</div>`.
9. Figures: inline SVG with viewBox, width ≤ 640, text inside the viewBox, readable at 390 px. Keep the good existing figures.
10. Coverage block before the footer: `<details class="lk-coverage"><summary>Where this lesson comes from</summary>` listing decks/labs/code.
11. Footer: nav + a sources line.
12. Do not change the site's look; reuse the classes the old lessons and the PCD models use.

## Report back (final message)

Per lesson: words before/after (prose, excluding code and quiz), sections before/after, what was removed (restating boxes,
meta-talk, widgets) and what was moved, code examples checked (how many compiled/ran; any failures and fixes), errors
found and fixed, content added from the slides, doubts for the lead. Do not paste the lesson back.
