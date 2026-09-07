# Generated art-direction reference

Generated with the built-in image generation tool, using the BARO rasterization
plate as a style reference only. The user explicitly requested image generation.
The raster is a visual reference, not a mathematically authoritative course figure.

## Exact prompt

Use case: scientific-educational. Asset type: editorial art-direction proof sheet, later to be rebuilt precisely as SVG for notes.ybc.sh. Generate ONE cohesive landscape design sheet with four distinct technical plates, not a generic dashboard. Input image is STYLE REFERENCE ONLY: preserve the engineering notebook / restrained technical print sensibility, not its subject. Warm uniform ivory #F3EFE3, hairline cobalt #1546B8, neutral ink #171813, sparse vermilion #B83D2D indexing. Crisp small monospace labels, modest condensed uppercase headings. Generous whitespace, minimal borders, no filled cards, no curved connectors, no shadows, no gradients, no decorative fake graphs. Aim for precise, elegant textbook diagrams, not poster ornament. Four subjects: upper left '2.4 / AUTODIFF': x and y feed a small circular + operator through straight diagonal arrows; its output q and z feed a circular multiplication operator through straight diagonal arrows; output f to the right. Use only these short labels, not entire equations in boxes. Upper right '3.1 / NEURON': three small input circles x1 x2 x3 and a red bias circle 1 fan through straight diagonal arrows toward a summation circle, then a small activation square phi, then y. Label weights beside the arrows. Lower left, larger '7.3 / INCEPTION': elegant four vertical parallel paths from a shared input at bottom to channel concatenation at top, classic architecture orientation. Paths are 1x1; 1x1 then 3x3; 1x1 then 5x5; 3x3 pool then 1x1. Short labels; slim outlined operation blocks and clear separate output entry points. Note 28x28x192 at input and 28x28x256 at output. Lower right '8.4 / GRU': simplify into two open mini-diagrams titled 'RESET / CANDIDATE' and 'UPDATE / MIX'. First: previous h multiplied by r then candidate tanh; x also feeds candidate. Second: old h weighted by u and candidate weighted by 1-u, converging with diagonal arrows to circular + then new h. Place gates' definitions in a compact annotation strip rather than wiring every shared input across the whole plate. Keep the two stages visually linked by the candidate label. This is an art-direction reference: favor readable grouping and straight angled arrows, visually distinct operators, and no spaghetti. Don't invent extra loops, neurons, operations or branding. Flat digital print, restrained paper texture at most, no distressed functional labels.

## What is reproduced in SVG

The four reconstructions are now reusable presets. Their coordinate-free course
specifications are in `dev/diagrams/sources/editorial.json`; see the
[preset variation gallery](../presets/).

Diagonal fan-in arrows; small circular operators; open composition; a bottom-up
Inception module with four distinct output entries; GRU separated into candidate
construction and state mixing. The existing site tokens and font stack remain.

## What is corrected, not copied

The generated GRU equations swap W/U relative to the source slides and add bias
terms not shown there. Its gate arrows are incomplete. The SVG uses the chapter
equations and explicit gate-to-product connections. Inception also needs the
intermediate channel dimensions, which the raster omitted.
