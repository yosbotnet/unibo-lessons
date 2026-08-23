# Generated-Image Opportunity Audit

Date: 2026-08-23
Scope: all 23 resources linked from the root catalog
Status: visual direction corrected after the two-image pilot; first two plates integrated

## Decision

Use a restrained hybrid system:

- keep technical SVGs, charts, state machines, formulas, schemas, protocol flows, and code diagrams;
- add generated images only when a mechanism-specific editorial plate carries learning value that the precise technical SVG cannot;
- use real/canonical images for empirical visual evidence, screenshots, adversarial examples, image-processing outputs, and historical artifacts when rights permit;
- follow the PCD/ybc.sh archival plate family: warm fibrous paper, one or two risograph inks, cobalt dominant, sparse vermilion or occasional forest, fine linework, registration marks, and negative space;
- avoid people, photography, generated text, labels, formulas, dashboards, generic software imagery, glossy 3D, gradients, and shadows.

The audit found no reason to add generated imagery to every course. Macro and Politics are already image-rich. BI, most of ASMD, most of Deep Learning, and the formal/protocol-heavy chapters are correctly diagram-first.

## Recommended pilot: eight images

These eight provide the clearest test of whether generated imagery improves recall without overwhelming the lesson system.

### 1. EventStorming workshop

- Course/file: `sap/cap-08-eventstorming.html`
- Placement: section 4, immediately after the environment/materials paragraph.
- Evidence: the lesson specifies a whole wall covered with butcher paper, many coloured sticky notes, and markers (`sap/cap-08-eventstorming.html:112`, `:397`).
- Learning purpose: make the physical, collaborative nature of EventStorming memorable; complement rather than replace the ten-step technical plate.
- Plate brief: `Long horizontal event timeline made from blank note rectangles; clusters resolve into domain regions; sparse vermilion marks identify pivotal transitions. Warm fibrous paper, cobalt risograph linework, registration marks, generous negative space. No people, room, words, photography, gradients, shadows, or 3D.`

### 2. Grey Walter tortoises

- Course/file: `irs/cap-02-history-of-robotics.html`
- Placement: section 5, after the Elmer-and-Elsie description.
- Evidence: two candle-equipped tortoises approach and produce an unplanned “dance” (`irs/cap-02-history-of-robotics.html:211`); the lesson identifies this as environment-coupled and locally emergent behaviour (`:367`).
- Learning purpose: anchor synthetic psychology, situated behaviour, and early swarm emergence in one historical scene.
- Plate brief: `Top-down schematic of two simplified tortoise machines with photocell mast and steering wheel; curved motion traces converge on one vermilion light source and cross into a dance. Warm paper, cobalt risograph linework, registration marks, no text or photographic laboratory.`
- Note: stylistic reconstruction, not a claimed archival photograph.

### 3. Alice and Bob’s milk race

- Course/file: `pcd/cap-02-modellazione.html`
- Placement: section 2, beside “Alice e Bob comprano il latte.”
- Evidence: both actors can inspect the refrigerator and notes concurrently, then both buy milk because the check-and-note operation is not atomic (`pcd/cap-01-introduzione.html:534-537`; scenario heading at `pcd/cap-02-modellazione.html:129`).
- Learning purpose: make race condition and non-atomic check-then-act behavior retrievable through an everyday scene.
- Plate brief: `Two independent cobalt process traces perform check and buy operations against one shared refrigerator state; both traces terminate in duplicate milk cartons, with the non-atomic overlap indexed in vermilion. No people, kitchen scene, text, or labels.`

### 4. Passive dynamic walker

- Course/file: `irs/cap-16-morphological-computation.html`
- Placement: section 3, after the characteristic-cases list.
- Evidence: the machine walks down a slope without motors, sensors, controller, or computer; gait emerges from slope and mechanical parameters (`irs/cap-16-morphological-computation.html:145`, `:301`).
- Learning purpose: make “the body performs part of the computation” physically intuitive.
- Plate brief: `Side-elevation sequence of a bare passive walker descending a shallow inclined plane; repeated cobalt leg positions and one continuous center-of-mass path express momentum without motors or controller. No person, laboratory, text, or photorealism.`

### 5. Predictive maintenance on the factory floor

- Course/file: `oa/cap-01-operational-analytics.html`
- Placement: section 3, before the cost-curve plate.
- Evidence: failure prediction relies on vibration, noise, temperature, pressure, oil, current, and corrosion measurements (`oa/cap-01-operational-analytics.html:155`, `:413`).
- Learning purpose: connect later time-series variables to the physical machine and maintenance decision that generate them.
- Plate brief: `A simplified rotating machine cross-section emits several distinct sensor traces that converge into a maintenance threshold and intervention mark; cobalt mechanism, sparse vermilion warning, warm paper. No technician, factory scene, interface, or labels.`

### 6. Purdue level 0–2 factory scene

- Course/file: `netprog/cap-09-industrial-networks.html`
- Placement: section 4, before or after the Purdue stack plate.
- Evidence: level 0 consists of sensors, drives, valves, motors, conveyor movement, temperature, pressure, flow, and batch processes (`netprog/cap-09-industrial-networks.html:155`).
- Learning purpose: establish the physical process that OT networking and security ultimately control and protect.
- Plate brief: `Vertical industrial control stack built from a physical process strip—conveyor, motor, valve, sensor—feeding a compact controller layer and supervisory layer. Use pictographic mechanism marks without embedded labels; no operator, factory photography, or screens.`

### 7. Distributed computational bubble

- Course/file: `ds/DS-M0.html`
- Placement: section 2, after the opening computational-bubble paragraph.
- Evidence: computation surrounds the learner across homes, cars, workplaces, hospitals, transport hubs, education, and public infrastructure (`ds/DS-M0.html:50-52`).
- Learning purpose: open the course with a concrete sense that distributed computation has no single visible center.
- Plate brief: `Distributed field of small home, vehicle, hospital, rail, and traffic-system glyphs connected into overlapping computational clusters with no single center; cobalt network linework and one sparse vermilion active path. No city panorama, people, photography, or text.`

### 8. University call center queue

- Course/file: `reti-lm/cap-06-code-attesa.html`
- Placement: section containing Exercise 13.
- Evidence: the exercise sizes operators for a university call center and compares distributed and centralized staffing (`reti-lm/cap-06-code-attesa.html:192`, `:425-426`).
- Learning purpose: give Erlang queueing quantities a physical referent—callers waiting and parallel servers handling work.
- Plate brief: `An incoming stream of call tokens accumulates in a queue and fans out across a finite row of parallel service stations; a second compact arrangement contrasts centralized and distributed capacity. No operators, office, text, formulas, or photography.`

## Second wave: eight candidates

Generate these only if the pilot images test well in-browser and are judged useful while studying.

1. `cybersecurity-reworked/Cyber-02-Security-Concepts.html`, section 4 — unlocked door and approaching hand to anchor vulnerability → threat → attack (`:211`). Keep the three moments visually distinguishable without labels.
2. `netprog/cap-12-mobile-radio-networks.html`, section 3 — urban base stations and a moving user crossing coverage areas; retain the hexagonal technical plates for exact planning concepts (`:118`, `:474`).
3. `irs/cap-10-evolutionary-robotics.html`, section 10 — workbench of 3D-printed GOLEM bodies with hand-added motors and batteries (`:432`, `:440`).
4. `ise/cap-02-autonomy-living-systems.html`, section 4 — realistic cell maintaining a boundary against a surrounding molecular soup (`:87-89`).
5. `dm/cap-03-case-studies.html`, sections 1–3 — city movement trails converging on home/work staypoints; preserve Plate 3.1 for the exact trajectory/staypoint transformation (`:71`, `:140-143`).
6. `pm/cap-19-caso-pdq-ed-esercitazioni.html`, section 1 — pizza factory/store, dispatch operation, and delivery van as the recurring PDQ case anchor (`:41`, `:51`; recurrence documented at `pm/cap-07-analisi-e-pos.html:564-566`).
7. `irs/cap-09-swarm-robotics.html`, ant-foraging section — physical double-bridge experiment and pheromone-based stigmergy; keep the graph schematic for mechanism.
8. `cybersecurity/podcasts` — one 1400×1400 show cover. The feed explicitly lacks required podcast artwork (`cybersecurity/podcasts/feed.xml:15`). Produce cover art separately from lesson figures and do not imply that episode-level images are needed.

## Use real or canonical imagery instead

Do not use generated images where the pixels are evidence:

- adversarial examples and imperceptible perturbations in Cybersecurity;
- segmentation masks, keypoint matches, panoramas, feature responses, and recognition examples in Visione;
- product dashboards and Power BI interfaces in BI;
- browser/tool interfaces and operational screenshots in ASW, NetProg labs, and similar tool-driven lessons;
- historical robot artifacts when an appropriately licensed archival photograph can be sourced and attributed.

## Explicit no-addition decisions

- **Macro and Politics:** already use generated heroes/scenes; further additions would dilute the existing visual rhythm.
- **BI:** retain schemas, cubes, ETL flows, dashboards, and charts; generated scenes add little.
- **Deep Learning:** keep mathematical and architectural plates. The single possible reward-learning scene is not strong enough for the pilot.
- **Visione chapters 3–14:** use real visual examples, never synthetic stand-ins for algorithmic evidence.
- **Formal chapters across PCD, PPS, DS, ASMD, DM, OA, Reti LM, and SAP:** keep diagrams where correctness depends on labels, ordering, equations, topology, state, or timing.
- **Duplicate datacenter imagery:** do not generate both a generic Big Data server room and a generic sustainability server room. If sustainability later needs a visual, use real measured infrastructure photography or a purpose-built energy-flow diagram.

## Implementation contract for approved images

1. Generate one candidate at a time at 16:9, preferably 1200×675 or larger.
2. Inspect for accidental text, impossible geometry, photographic or 3D drift, palette drift, and factual implications absent from the lesson. Compare paper/ink proportions against PCD reference plates.
3. Convert the accepted image to WebP with a practical quality/size target; retain the source generation record outside the public lesson tree if desired.
4. Store under `<course>/assets/img/` with a semantic filename.
5. Place in `<figure class="lk-fig">` with explicit width/height, descriptive alt text, and a caption that states the course concept rather than describing decoration.
6. Keep the existing SVG plate whenever it carries technical structure.
7. Extend the course validator to require the asset, alt text, dimensions, and valid relative path.
8. Run structural validation, JavaScript syntax checks, full Chromium smoke tests, mobile-width visual inspection, console/page-error checks, and public HTTP verification before accepting.
9. Commit each pilot course separately or in a small visual-pilot commit so images can be reverted without touching lesson content.

## Proposed pilot order

1. SAP EventStorming
2. IRS tortoises
3. PCD milk race
4. IRS passive walker
5. OA predictive maintenance
6. NetProg factory floor
7. DS computational bubble
8. Reti LM call center

After the first two, perform an explicit style and usefulness review before producing the remaining six.
