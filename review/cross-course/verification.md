# Cross-course revision — verification checkpoint

Preview branch: `feat/editorial-diagram-presets`. Production remains at `f0f4bde`.
No service restart, paid image call or deployment was performed.

Replaced IRS 8.1/8.4, BI 11.3/11.4 and Reti LM 10.2. Source/slide evidence and
supported customization are in [CROSS-COURSE.md](../../dev/diagrams/CROSS-COURSE.md).

## Verified

- Visually inspected all five standalone SVGs and the revised desktop chapter
  layouts, including the previously too-wide BT and snowflake. Source fonts remain
  14 px; wrapping and computed spacing bring the actual examples into the desktop
  column without clipping. Mobile uses the existing explicit scroll region.
- `cross-course-test.cjs`: 10 cases, 12 invalid inputs rejected; deterministic
  SVG, XML, port/marker geometry, text bounds/overlap, edge/node intersections,
  ordered children, key-to-key references and message direction.
- Ten actual chapter renders at 1280/390 px; desktop fit and mobile scrolling.
  Removing the old SVG style blocks does not change computed styles of other
  figures in those three chapters (comparison against production).
- `presets/test.cjs`: 20 DL cases pass; four previously accepted SVG byte hashes
  remain unchanged. `diagrams/test.cjs`: 15 DL diagrams, 122 edges pass.
- `diagrams/browser-test.cjs`: 30 DL renders, 15 mobile-scroll tests, no failures.
- Both generators report zero chapter drift: 15 DL + 5 cross-course figures.
- `verify-course-figures.cjs`: 208 pages, 374 slider interactions and 4,697 button
  interactions; no SVG markup/namespace/marker or JavaScript failures. Inline
  widget scripts remain unchanged. The same local highlight.js fixture used by
  earlier audits supplies the CDN dependency for deterministic browser checks.
- Existing semantic smoke suites: BI 228 passed / 0 failed; Reti LM 184 / 0.
- Preview responds HTTP 200 on loopback port 8787. `git diff --check` passes.

These checks do not certify every figure or every scientific statement on the
site. See the [full-site inventory](../notes-inventory.md) for the broader active
scope, and the earlier report for still-open responsive content issues outside
figures. The new presets intentionally reject unsupported graph types/topologies;
they are not a universal Mermaid replacement yet. Publication requires approval.
