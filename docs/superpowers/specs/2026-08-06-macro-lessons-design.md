# Macro (Macroeconomic Policy) — pilot lessons: design spec

Date: 2026-08-06 · Status: approved (pilot scope)

## Purpose

A new course on notes.ybc.sh: **Macroeconomic Policy** (UniBO, Prof. Guglielmo
Barone, Mankiw *Macroeconomics* 12e — 11e fine per syllabus). Audience: a student
deciding whether to enroll, worried the course is too mathematical. The pilot must
demonstrate, with the course's real materials, that every exam skill is learnable:
intuition first, math introduced only where the exam needs it, always interactive.

The exam (from the course's own slides and mock exams): 16 multiple-choice
questions in 40 minutes; +1 per correct, −⅓ per wrong, 0 for blank; pass = 9/16.
Two midterms (Ch1–8; Ch12–16) + retake, or one 32-question total exam. Every
question in both mocks falls into ~5 recurring patterns: compute-from-table,
formula plug-in, model-direction reasoning, policy-prescription, concept check.

## Scope (pilot = 3 lessons + course index)

- `macro/index.html` — course index, pps-style, warm footer note.
- `macro/Macro-00-Start-Here.html` — the course decoded: format, exam scoring
  simulator (interactive: right/wrong/blank → grade; when guessing pays),
  the 5 question patterns with real mock examples, the actual math prerequisites
  (percentages, growth rates, one linear equation, reading a graph — no calculus),
  how to use the lessons.
- `macro/Macro-01-GDP-Prices-Inflation.html` — course Ch1–2 (first midterm core):
  GDP three ways, nominal vs real (side-by-side calculator), GDP deflator +
  **deflator trainer** generating mock-Q1-style tables with step-by-step guided
  solutions, CPI vs deflator, unemployment/participation/employment rates trainer.
  Exam-style quiz (mock 1 patterns).
- `macro/Macro-02-IS-LM.html` — course Ch12–13/14 (second midterm heart):
  sticky prices story, Keynesian cross with G/T sliders + spending-rounds
  multiplier stepper, IS derived in words, money market → LM, **full IS-LM
  interactive** (G, T, M sliders, live curves + plain-words readout, preset
  buttons replaying real mock scenarios), policy-direction drill, exam-style quiz
  (mock 2 patterns).
- Card added to root `index.html`.

Out of scope (post-pilot, if she enrolls): Ch4–8 lessons, Ch16/AD-AS, exercise-set
quiz banks, second-mock full walkthrough.

## Format & architecture

Same architecture as existing courses: self-contained HTML per lesson; per-course
`assets/lesson-kit.css` + `lesson-kit.js` (copied from `pps/`); per-page custom
widgets in inline `<style>`/`<script>` (cybersecurity pattern). No build step, no
external deps beyond fonts. Course accent overridden in the copied kit
(`--lk-ac`: warm rose) to give the course its own identity vs the blue
engineering courses; all interactive diagram colors validated for CVD safety
(dataviz validator): IS/PE curves blue `#2563eb`, LM/second-series amber
`#b45309`, pre-shift curves dashed gray `#94a3b8`, equilibrium rose.

Diagrams: inline SVG, direct curve labels (IS, LM, PE, 45°), one axis pair,
recessive axes, 2px curves; interactivity via sliders (`input[type=range]`) with
live plain-English readouts. All quiz MCQs mirror exam scoring: feedback shows
+1/−⅓ implications and full explanations. English throughout (course language).

## Content sources

Professor's slide decks (Ch1, 2, 12, 13/14) and both mock exams (with solutions)
downloaded from Virtuale; Mankiw 11e as reference. Source PDFs are **not**
redistributed; lessons are original explanations. Trainer numbers are generated,
mock-style, not copied verbatim (a couple of mock questions quoted in Macro-00 as
worked examples of the patterns, consistent with existing site footer policy).

## Testing

Playwright headless smoke test per page: zero console errors; slider input moves
curve (`d`/transform mutates); trainer generates and grades a table; quiz answer
click yields feedback. Manual visual pass via screenshots. Live URL check after
deploy.

## Deploy

Commit to `main`, push to GitHub, `git pull` on VPS (`~/hosted/unibo-lessons`,
already served at notes.ybc.sh by Caddy — no config change).

## Addendum (2026-08-07): full-course expansion

Pilot approved; scope extended to the whole course on Baro's go-ahead ("do it all").
Added Macro-03 (ch 4, pantry/loanable funds), Macro-04 (ch 5-6, arcade/quantity
theory), Macro-05 (ch 8, bathtub), Macro-06 (ch 12/14, mattress/AD-AS stepper),
Macro-07 (ch 16, escalator/Phillips + disinflation game), and the Exam Room (16
fresh questions, 40-minute timer, real scoring, per-lesson breakdown). Every page
carries a hero illustration generated with Nano Banana Pro (google/gemini-3-pro-image
via OpenRouter), one consistent ink-and-watercolor style, one rose accent, stored as
~30-80KB webp in macro/assets/img/. Same voice rules as the pilot: story + one
analogy per model, recall bridges, no em dashes.
