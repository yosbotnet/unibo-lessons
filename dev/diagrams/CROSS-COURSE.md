# Editorial diagrams beyond Deep Learning

The renderer now has seven preset families, not one neuron-shaped solution.
The existing four accepted DL SVGs remain protected by their original byte hashes.

## Three layers in use

1. `graph.cjs`: original course palette/font tokens, circle/ellipse/action/record
   shapes, named ports, straight paths, arrowheads and unobtrusive lifelines.
2. `layouts/ordered-tree.cjs`: content-sized ordered subtree layout, downward or
   left-to-right. No course labels, coordinates or special cases in this layer.
3. Presets: behavior-tree traversal order and node types; relational field-to-field
   joins; sequence participants, chronological messages and lifeline ports.

`sources/cross-course.cjs` is the course content. The source definitions do not
contain coordinates or routes. Captions remain prose in HTML, not tiny SVG text.
Generated diagrams are native SVG; no raster generation or paid calls were used.

## Five actual chapter replacements

| Figure | Change | Evidence |
| --- | --- | --- |
| IRS 8.1 | Ordered root → Sequence → find/pick/place; correct tick explanation | Local `72659-Intelligent Robotic Systems/Behavior trees - behavior_trees.txt`, anatomy and execution slides; chapter sections 2–3 |
| IRS 8.4 | Distinct condition ellipses, action rectangles and control circles; explicit ordered subtrees | Same slide source, “A variant”; chapter sections 5–6 |
| BI 11.3 | Explicit PK/FK rows, composite fact key, complete dimension attributes including omitted Fornitore | Local `69012-Business Intelligence/Il ciclo di vita dei data warehouse (seconda parte).txt`, slides 9–10 |
| BI 11.4 | Correct joins Prodotti → Tipi and Negozi → Città; no incorrect direct links from fact to secondary dimensions | Same slide source, slides 14–15, chapter section 6 |
| Reti LM 10.2 | Chronological sender/receiver arrows, readable separate flag and sequence-number labels | Local `59313-Reti di Telecomunicazioni LM - Instradamento e Trasporto in Internet/TCP_ gestione della connessione.txt`, slide 5; chapter section 3 |

Slide directory prefix: `/home/ybc/content/unibo-course-slides/`.
The BI layout is arranged by join distance for readability; “star” describes its
relational topology, not a requirement to place the tables radially. Arrowheads
mean FK → PK (N:1), not data movement. Attribute data stays in HTML tables elsewhere.

## Customization and explicit limits

- **behavior-tree**: nested `{id,kind,label,children}`. Supported kinds are root,
  sequence, fallback, action and condition. Child-array order is preserved;
  `siblingGap` and `levelGap` override spacing. Control nodes use canonical glyphs.
  Root has one child, execution nodes none, other control nodes at least one.
  Parallel/decorator semantics are not implemented or guessed.
- **relational-schema**: named tables/fields, PK/FK/PK-FK roles, explicit
  `{from,field,to,target}` references. Joins attach to the corresponding field
  rows. Overrides: `tableOrder` (all IDs) and `levelGap`. Currently supports rooted
  tree-shaped FK topology, including these star/snowflake examples. Shared
  dimensions, cycles and composite referenced keys need a different layout;
  unsupported topology fails. It is not a SQL validator or a general ER engine.
- **sequence**: named participants and ordered messages with label, optional
  detail, accent and dashed styling. Overrides: participantOrder, rowGap and
  slant (0–48). Slant conveys schematic travel time; durations are not quantitative.
  Self-messages, concurrency, activation bars and loss need explicit extensions.

Labels size the shapes/canvas; no automatic font reduction, clipped prose, curves
or hidden overflow. Wide figures use the existing focusable mobile scroll region.
The preset APIs currently accept JS/JSON specifications, not a Mermaid-like DSL.

## Reproduce

```sh
node dev/diagrams/generate-courses.cjs          # check chapter drift
node dev/diagrams/generate-courses.cjs --patch  # print patch for apply_patch
node dev/diagrams/cross-course-test.cjs         # gallery and browser checks
node dev/diagrams/presets/test.cjs              # DL defaults and variants
```

Preview: `http://localhost:8787/review/cross-course/` via the existing SSH tunnel.
Tests produce ten cases, including extra/reordered children, longer record fields,
three-participant request/response and reordered lifelines; twelve invalid inputs
must fail. They check SVG XML, marker and port geometry, edge/node intersections,
text bounds and overlaps, and actual chapter rendering/scroll at 1280 and 390 px.
Screenshots are generated alongside the preview; visual inspection is still
required for course replacements. Broad widget verification remains
`dev/verify-course-figures.cjs`, supplemented by course semantic smoke tests.

## Remaining scope

These five replacements demonstrate reuse across domains; they do not certify
all graphs or scientific content of notes. The earlier 208-page/882-figure audit
covered the requested 15 courses, not every course in the repository. The full-site
inventory distinguishes counts from reviewed evidence. Remaining diagrams require
visual and semantic review; future layouts must preserve domain-specific notation.
Production remains separate and requires approval before deploying this revision.
