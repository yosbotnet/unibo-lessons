# Reusable editorial presets

The approved image-guided layouts are now parameterized templates. Authors specify
content and supported constraints; presets calculate node placement, shape sizes,
ports, arrow endpoints, channel totals and derived numerical values. This is
**not** a general-purpose graph layout engine or a Mermaid parser.

The four course definitions live in `../sources/editorial.json`. They contain no
positions or waypoints. The four original SVGs are preserved byte-for-byte and
protected by `approved-svg-hashes.json` (update only after visual approval).

Three additional non-DL families now use the same renderer: `behavior-tree`,
`relational-schema` and `sequence`. See [cross-course documentation](../CROSS-COURSE.md)
for their APIs, limits, slide evidence and actual IRS/BI/Reti chapter examples.
The four-family test gallery described below remains the DL regression suite.

## Use

```js
const {renderPreset} = require('./presets/index.cjs');
const diagram = renderPreset({
  preset: 'neuron',
  id: 'my-neuron',
  inputs: ['x₁', 'x₂', 'x₃', 'x₄', 'x₅'],
  bias: true,
  activation: 'ReLU(a)',
  overrides: {activationShape: 'circle'}
});
const svg = diagram.svg(); // inline SVG inheriting the lesson-kit CSS
```

From the repository root:

```sh
node dev/diagrams/render-preset.cjs dev/diagrams/sources/neuron-example.json --out /tmp/neuron.svg
node dev/diagrams/presets/test.cjs
```

CLI output is standalone by default: it embeds the actual lesson-kit tokens,
including the original font stack and ivory background. Add `--inline` for an SVG
that inherits tokens from its enclosing course page. No network, image generation,
ELK dependency or paid call is involved. The CLI never publishes or edits chapters.

## Supported content and overrides

All presets require `preset` and a lowercase SVG-safe `id`. `title` and `plate`
are optional metadata. Unknown fields/overrides fail instead of being ignored.
Labels are single-line and limited to 48 characters. Font size is never reduced;
larger content expands the canvas, which can scroll in the site's figure wrapper.

### Neuron

`inputs`: 1–8 unique labels; `bias`: boolean (default true); `activation` and
`output`: labels. Inputs become `x1`…`x8`; the optional bias is `x0`.

Overrides: `inputOrder` (every enabled ID exactly once), `activationShape`
(`square` or `circle`), `rowGap` (20–120). Extra inputs add their own weights,
circles and straight arrows. Labels affect node sizing and canvas width.

### Inception / parallel convolution branches

`input`: `{height,width,channels}`; `branches`: 2–6 arrays of 1–4 operations.
Operations: `{kind:'conv',kernel:3,channels:128}` or `{kind:'pool',kernel:3}`.
`reduction:true` highlights a 1×1 convolution. Pools preserve channel count.
Output channels are computed by summing the final branch channels; concatenation
has separate input ports. Different branch depths are aligned at their outputs.

Only odd kernels, stride 1 and same padding are supported. This preset does not
silently pretend that arbitrary strides/spatial shapes can be concatenated.
The course fixture reproduces slide 38; other fixture architectures are synthetic
layout tests, not claims about canonical GoogLeNet modules.

### Autodiff

`expression:'sum-product'`, `values:{x,y,z}` and optional
`labels:{x,y,z,q,f}`. Computes q, f and all reverse derivatives. Supports only
`f=(x+y)z`, with finite inputs of magnitude at most 1e6. It is a reusable example
template, **not a symbolic autodiff engine**. Display numbers use 10 significant
digits; semantic metadata retains the JavaScript numeric values.

### GRU

`layout:'split'|'stacked'`; `updateConvention:'retain'|'candidate'` selects which
term receives u and which receives 1−u. Both the node labels and equations change
together. Optional `labels` keys: `previous,input,reset,update,candidate,output`.
The candidate is reused between the two stages; gate definitions stay in the
caption. This preset is not an arbitrary gated/recurrent-network compiler.

## Testing and preview

`test.cjs` rebuilds `review/presets/`: semantic JSON beside each rendered SVG.
It checks 20 examples, including extra/reordered inputs, longer labels, changed
channels, deeper/more branches, renamed variables, zero values, vertical GRU and
both update conventions. Checks include node/edge geometry, text bounds/overlap
in Chromium, XML, marker references, deterministic SVG, and desktop/mobile scroll.
Playwright can be selected with `PLAYWRIGHT_PATH`.

Preview: <http://localhost:8787/review/presets/> through the existing SSH tunnel.
The chapter generator still checks/applies its normal patch separately:
`node dev/diagrams/generate.cjs --patch`. No production files are touched by tests.

Text measurement uses a conservative monospace width estimate, checked against
the installed browser's font rendering. Novel fonts or extreme labels still need
visual review. Unsupported graph types need a new preset, not per-figure patches
hidden in these course specifications.
