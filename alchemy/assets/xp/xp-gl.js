/* xp-gl.js — the explainer kit's shader renderer (WebGL2). It draws the same scene as xp-svg.js,
   through the same orthographic camera (XP.project), in one of several styles: ink, cel, sketch,
   hatch, blueprint, clay. Two passes:
     1. geometry → an off-screen buffer holding, per pixel, the material, glow, normal, part id
        and depth (no colour yet: "deferred");
     2. one full-screen pass that turns those into a picture in style A and style B, outlines
        from discontinuities, and mixes the two with a hand-drawn diagonal wipe.
   So a style change is just new uniforms, and a switch between styles never pops.
   If WebGL2 is missing, XP.glRenderer returns { supported: false } and the SVG renderer is used.
   Speed (2026-10-14; ink at 2× on an Intel UHD 770 went from 48 to 12 ms a frame, references/perf-log.md):
   - specialization: while one style fills the screen, pass 2 is a copy of the shader compiled for that style, its
     settings written in as constants, so the compiler drops every effect the style doesn't use and unrolls the loops.
     The general shader draws wipes and custom styles. { specialize: false } turns it off.
   - the geometry buffer's second texture holds the normal in 2 bytes (octahedral) and a 16-bit part id in 2, so an
     outline check reads one texel. Parts are convex, so inside a part the only edges are folds.
   - the outline taps are whole-pixel offsets worked out once per style and scale (texelFetch truncates), duplicates
     and the pixel itself removed: at 2×, ink's 16 taps read 8 pixels.
   - ambient occlusion at half resolution, upsampled from the nearest texels on the same face only; the glow halo at
     one texel per 4 CSS px. Each is a small pass of its own.
   - parts drawn front to back, so hidden pixels fail the depth test before they are shaded. */
(function () {
  'use strict';
  var XP = window.XP = window.XP || {};

  function hex(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  }

  /* ---------- styles ----------
     Every field is a uniform; add a style by adding an object. Colours are hex strings.
       bg          background colour
       pal         10 colours indexed like XP.MATS: none, paper, steel, subject, mem, memx, work, workx, ink, gold
       bands       side tone bands (4 = the SVG kit's four tones, 2 = cel, 0 = smooth)
       shadow      darkest side tone as a multiple of the base colour
       topLift     how far top faces move toward white (0..1)
       topSoft     0 = hard top threshold (n.z > 0.72, like XP.toneOf), 1 = smooth
       warm, cool  multiplicative tints on the lit side / the shadow side
       outline     outline width in CSS px;  outlineColor;  outlineAlpha
       crease      strength of crease lines (between faces of one part) relative to silhouettes
       wobble      line wobble amplitude in CSS px;  boil: re-seeds per second (0 = still lines)
       double      a second, offset pencil stroke (0..1);  pressure: line weight variation (0..1)
       grain       paper grain amount
       hatch       cross-hatching strength in the shadows;  hatchColor;  hatchPeriod (CSS px)
       fill        how much of the shaded colour covers the background (1 = opaque, 0.1 = ghost)
       offReg      off-register shift of the fills in CSS px (printing / watercolour look)
       pool        watercolour pooling: fills darken toward their edges
       rim         a light rim just inside silhouettes;  spec, specPow: a specular blob
       ao          ambient occlusion from the depth buffer (soft contact shadows)
       grid        background grid amount;  gridColor
       glowColor, glow   the halo around parts with glow > 0                                    */
  XP.STYLES = {
    ink: {
      bg: '#FAF7EF',
      pal: ['#FAF7EF', '#F2EEE4', '#D8DDE6', '#1546B8', '#EED3CB', '#B83D2D', '#CBDCD2', '#1F5A49', '#2A2B25', '#C9962B'],
      bands: 4, shadow: 0.86, topLift: 0.3, topSoft: 0, warm: '#FFFFFF', cool: '#F4F1F7',
      outline: 0.8, outlineColor: '#2B2A24', outlineAlpha: 0.9, crease: 0.45,
      wobble: 0, boil: 0, double: 0, pressure: 0, grain: 0.05,
      hatch: 0, hatchColor: '#171813', hatchPeriod: 5,
      fill: 1, offReg: 0, pool: 0, rim: 0, spec: 0, specPow: 30, ao: 0.22,
      grid: 0, gridColor: '#000000', glowColor: '#6D8DDA', glow: 0.75
    },
    cel: {
      bg: '#FFF4DF',
      pal: ['#FFF4DF', '#FFE9C7', '#9FC2E8', '#2F6BFF', '#FFB4A2', '#F0452B', '#9EE0A8', '#1FA05A', '#2B2440', '#FFC93C'],
      bands: 2, shadow: 0.72, topLift: 0.22, topSoft: 0, warm: '#FFFFFF', cool: '#E6DDFF',
      outline: 2.4, outlineColor: '#1E1A2E', outlineAlpha: 1, crease: 0.85,
      wobble: 0, boil: 0, double: 0, pressure: 0, grain: 0,
      hatch: 0, hatchColor: '#1E1A2E', hatchPeriod: 5,
      fill: 1, offReg: 0, pool: 0, rim: 0.55, spec: 0.55, specPow: 24, ao: 0,
      grid: 0, gridColor: '#000000', glowColor: '#FFD447', glow: 0.9
    },
    sketch: {
      bg: '#F7F3E8',
      pal: ['#F7F3E8', '#EFE8D6', '#C9D3E2', '#4C7BD9', '#F1C2B2', '#D8604B', '#BFDCC3', '#4E9A6A', '#3A3A3A', '#E3B341'],
      bands: 3, shadow: 0.8, topLift: 0.35, topSoft: 0, warm: '#FFFFFF', cool: '#EDE7F5',
      outline: 1.3, outlineColor: '#3B3A36', outlineAlpha: 0.85, crease: 0.6,
      wobble: 1.6, boil: 8, double: 0.55, pressure: 0.7, grain: 0.2,
      hatch: 0.25, hatchColor: '#55534C', hatchPeriod: 6,
      fill: 0.72, offReg: 2.4, pool: 0.55, rim: 0, spec: 0, specPow: 30, ao: 0,
      grid: 0, gridColor: '#000000', glowColor: '#F2C14E', glow: 0.7
    },
    // pencil: sketch's hand-drawn feel, toned down for explanations where bars and numbers must read crisply
    pencil: {
      bg: '#F8F5EC',
      pal: ['#F8F5EC', '#EFE9DA', '#CCD5E3', '#3F6FD6', '#F0C3B4', '#CF553F', '#C1DDC6', '#3F8C5E', '#2F2F2C', '#DDAA35'],
      bands: 3, shadow: 0.82, topLift: 0.32, topSoft: 0, warm: '#FFFFFF', cool: '#EFEAF4',
      outline: 1.15, outlineColor: '#33322E', outlineAlpha: 0.92, crease: 0.55,
      wobble: 0.45, boil: 3, double: 0.12, pressure: 0.3, grain: 0.09,
      hatch: 0.1, hatchColor: '#55534C', hatchPeriod: 6,
      fill: 0.94, offReg: 0.5, pool: 0.15, rim: 0, spec: 0, specPow: 30, ao: 0,
      grid: 0, gridColor: '#000000', glowColor: '#F2C14E', glow: 0.7
    },
    hatch: {
      bg: '#FBF8F0',
      pal: ['#FBF8F0', '#FBF8F0', '#EEF1F5', '#8FAEF0', '#FBEDE8', '#F6D7CF', '#EAF3EC', '#D5E8DA', '#2A2A2A', '#F7EBCB'],
      bands: 4, shadow: 1, topLift: 0.1, topSoft: 0, warm: '#FFFFFF', cool: '#FFFFFF',
      outline: 0.9, outlineColor: '#121212', outlineAlpha: 1, crease: 0.8,
      wobble: 0, boil: 0, double: 0, pressure: 0, grain: 0.06,
      hatch: 1, hatchColor: '#1A1A1A', hatchPeriod: 4.5,
      fill: 1, offReg: 0, pool: 0, rim: 0, spec: 0, specPow: 30, ao: 0,
      grid: 0, gridColor: '#000000', glowColor: '#C9962B', glow: 0.6
    },
    blueprint: {
      bg: '#10305F',
      pal: ['#10305F', '#2A5A93', '#3A6DA8', '#7FD8FF', '#C46A7C', '#FF8A80', '#3E8E86', '#8EF0C8', '#E8F4FF', '#FFE08A'],
      bands: 4, shadow: 0.8, topLift: 0.25, topSoft: 0, warm: '#FFFFFF', cool: '#FFFFFF',
      outline: 1.0, outlineColor: '#EAF6FF', outlineAlpha: 0.95, crease: 0.55,
      wobble: 0, boil: 0, double: 0, pressure: 0, grain: 0.04,
      hatch: 0, hatchColor: '#EAF6FF', hatchPeriod: 5,
      fill: 0.28, offReg: 0, pool: 0, rim: 0, spec: 0, specPow: 30, ao: 0,
      grid: 0.16, gridColor: '#8FC4FF', glowColor: '#7FE7FF', glow: 1.0
    },
    clay: {
      bg: '#EFE9F3',
      pal: ['#EFE9F3', '#F3EBDD', '#C9D4E8', '#5B7CFA', '#F6B8A8', '#E8634F', '#B6E2C6', '#3FA37A', '#4A4458', '#F5C451'],
      bands: 0, shadow: 0.62, topLift: 0.12, topSoft: 1, warm: '#FFF6EA', cool: '#C9C8F2',
      outline: 1.0, outlineColor: '#5E5672', outlineAlpha: 0.32, crease: 0.2,
      wobble: 0, boil: 0, double: 0, pressure: 0, grain: 0.03,
      hatch: 0, hatchColor: '#000000', hatchPeriod: 5,
      fill: 1, offReg: 0, pool: 0, rim: 0.1, spec: 0.16, specPow: 14, ao: 0.8,
      grid: 0, gridColor: '#000000', glowColor: '#FFE7A0', glow: 0.8
    }
  };
  XP.STYLE_NAMES = ['ink', 'cel', 'sketch', 'pencil', 'hatch', 'blueprint', 'clay'];

  /* ---------- shaders ---------- */
  var GEO_VS = '#version 300 es\n' +
    'layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm;\n' +
    'layout(location=2) in vec3 iPos; layout(location=3) in vec3 iScale; layout(location=4) in vec2 iMG; layout(location=5) in float iId; layout(location=6) in vec2 iRot;\n' +
    'uniform vec3 uR, uDn, uD, uC; uniform float uZoom; uniform vec2 uVB; uniform vec3 uMap; uniform vec2 uCss; uniform float uDR;\n' +
    'out vec3 vN; flat out vec2 vMG; flat out float vId;\n' +
    'void main(){\n' +
    '  vec3 a = aPos * iScale; a.xy = vec2(iRot.x * a.x - iRot.y * a.y, iRot.y * a.x + iRot.x * a.y);\n' +   // scale, turn about z, move
    '  vec3 w = a + iPos, q = w - uC;\n' +
    // exactly XP.project: viewBox px, then "meet" into the canvas (CSS px), then clip space
    '  float sx = uVB.x * 0.5 + dot(uR, q) * uZoom, sy = uVB.y * 0.5 + dot(uDn, q) * uZoom;\n' +
    '  vec2 c = vec2(uMap.y + sx * uMap.x, uMap.z + sy * uMap.x);\n' +
    '  gl_Position = vec4(c.x / uCss.x * 2.0 - 1.0, 1.0 - c.y / uCss.y * 2.0, clamp(-dot(uD, q) / uDR, -1.0, 1.0), 1.0);\n' +
    '  vN = normalize(aNrm / max(abs(iScale), vec3(1e-4)) * sign(iScale + 1e-9)); vN.xy = vec2(iRot.x * vN.x - iRot.y * vN.y, iRot.y * vN.x + iRot.x * vN.y);\n' +
    '  vMG = iMG; vId = iId;\n' +
    '}';
  var GEO_FS = '#version 300 es\nprecision highp float;\n' +
    'in vec3 vN; flat in vec2 vMG; flat in float vId;\n' +
    'layout(location=0) out vec4 o0; layout(location=1) out vec4 o1;\n' +
    '#ifdef LEAN\n' + ['vec2 octE(vec3 n){ n /= abs(n.x) + abs(n.y) + abs(n.z); vec2 s = vec2(n.x >= 0.0 ? 1.0 : -1.0, n.y >= 0.0 ? 1.0 : -1.0);', '  return (n.z >= 0.0 ? n.xy : (1.0 - abs(n.yx)) * s) * 0.5 + 0.5; }', 'vec3 octD(vec2 e){ vec2 f = e * 2.0 - 1.0; vec3 n = vec3(f, 1.0 - abs(f.x) - abs(f.y)); float t = max(-n.z, 0.0);', '  n.xy += vec2(n.x >= 0.0 ? -t : t, n.y >= 0.0 ? -t : t); return normalize(n); }',].join('\n') + '\n#endif\n' +
    'void main(){\n' +
    '  o0 = vec4(vMG.x / 255.0, vMG.y, 0.0, 1.0);\n' +
    '#ifdef LEAN\n' +
    '  o1 = vec4(octE(normalize(vN)), mod(vId, 256.0) / 255.0, floor(vId / 256.0) / 255.0);   // normal in 2 bytes, part id in 2\n' +
    '#else\n' +
    '  o1 = vec4(normalize(vN) * 0.5 + 0.5, fract(vId * 0.6180339 + 0.13));\n' +
    '#endif\n' +
    '}';
  var FS_VS = '#version 300 es\nvoid main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }';

  var COMP_FS = [
    '#version 300 es',
    'precision highp float;',
    'uniform sampler2D uT0, uT1, uDepth;',
    'uniform vec4 uPartBounds, uGlowBounds; // conservative device-pixel bounds, recomputed with the geometry',
    'uniform vec2 uRes;          // device px',
    'uniform float uScale;       // device px per CSS px',
    'uniform float uTime, uMix, uWipeAng;',
    'uniform int uN;             // always 1: loop bounds the compiler cannot see, so Direct3D keeps loops instead of unrolling them',
    'uniform float uWpp;         // world units per device px',
    'uniform float uD2W;         // depth-buffer delta -> world units',
    'uniform vec3 uLight, uView, uRgt, uDown;   // camera basis: right, screen-down, toward viewer',
    '// style arrays: [0] = style A, [1] = style B',
    'uniform vec3 uBg[2]; uniform vec3 uPal[20];',
    'uniform float uBands[2], uShadow[2], uTopLift[2], uTopSoft[2];',
    'uniform vec3 uWarm[2], uCool[2];',
    'uniform float uOutW[2], uCrease[2], uOutA[2]; uniform vec3 uOutC[2];',
    'uniform float uWobble[2], uBoil[2], uDouble[2], uPressure[2];',
    'uniform float uGrain[2], uHatch[2], uHatchP[2]; uniform vec3 uHatchC[2];',
    'uniform float uFill[2], uOffReg[2], uPool[2], uRim[2], uSpec[2], uSpecPow[2], uAO[2], uGrid[2]; uniform vec3 uGridC[2];',
    'uniform vec3 uGlowC[2]; uniform float uGlowA[2];',
    'uniform vec2 uOff[32]; uniform int uOffN[4];   // outline taps as whole-pixel offsets, 8 per (style, ring); count -1 = compute them',
    '//SPEC_CONSTS',
    '#ifdef LOWRES',
    'uniform sampler2D uGlowT, uAOT;',
    '#endif',
    'out vec4 frag;',
    '',
    'float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }',
    'float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }',
    'float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }',
    '',
    'bool nearBounds(vec2 px, vec4 b, float r){',
    '  vec2 p = clamp(px, vec2(0.5), uRes - 0.5);',
    '  return all(greaterThanEqual(p, b.xy - r)) && all(lessThanEqual(p, b.zw + r));',
    '}',
    '',
    '#ifdef LEAN',
    'vec2 octE(vec3 n){ n /= abs(n.x) + abs(n.y) + abs(n.z); vec2 s = vec2(n.x >= 0.0 ? 1.0 : -1.0, n.y >= 0.0 ? 1.0 : -1.0);',
    '  return (n.z >= 0.0 ? n.xy : (1.0 - abs(n.yx)) * s) * 0.5 + 0.5; }',
    'vec3 octD(vec2 e){ vec2 f = e * 2.0 - 1.0; vec3 n = vec3(f, 1.0 - abs(f.x) - abs(f.y)); float t = max(-n.z, 0.0);',
    '  n.xy += vec2(n.x >= 0.0 ? -t : t, n.y >= 0.0 ? -t : t); return normalize(n); }',
    '#endif',
    '// the geometry buffer at a device-pixel position',
    'struct G { float mat; float glow; vec3 n; float id; float z; };',
    'G fetchG(vec2 px){',
    '  ivec2 ip = ivec2(clamp(px, vec2(0.5), uRes - 0.5));        // texelFetch, not texture(): no filtering, so Direct3D keeps loops and branches',
    '  vec4 a = texelFetch(uT0, ip, 0), b = texelFetch(uT1, ip, 0);',
    '#ifdef LEAN',
    '  G g; g.mat = floor(a.r * 255.0 + 0.5); g.glow = a.g; g.n = octD(b.xy); g.id = dot(b.zw, vec2(255.0, 65280.0)); g.z = texelFetch(uDepth, ip, 0).r;',
    '#else',
    '  G g; g.mat = floor(a.r * 255.0 + 0.5); g.glow = a.g; g.n = normalize(b.xyz * 2.0 - 1.0 + 1e-6); g.id = b.a; g.z = texelFetch(uDepth, ip, 0).r;',
    '#endif',
    '  return g;',
    '}',
    '',
    '// is there an edge between c and a sample s at distance r px? returns silhouette, sets crease',
    'float disc(G c, vec2 px, float r, out float crease){',
    '  crease = 0.0;',
    '  ivec2 ip = ivec2(clamp(px, vec2(0.5), uRes - 0.5));',
    '#ifdef LEAN',
    '  // one read: a 16-bit part id (0 = background) and the normal. Parts are convex, so within one part the only edges are folds',
    '  vec4 lb = texelFetch(uT1, ip, 0);',
    '  if (abs(c.id - dot(lb.zw, vec2(255.0, 65280.0))) > 0.5) return 1.0;   // another part, or part vs background',
    '  if (c.id < 0.5) return 0.0;',
    '  crease = 1.0 - smoothstep(0.80, 0.93, dot(c.n, octD(lb.xy)));',
    '  return 0.0;',
    '#endif',
    '  float mat = floor(texelFetch(uT0, ip, 0).r * 255.0 + 0.5);',
    '  if (c.mat != mat) return 1.0;            // different material, or object vs background',
    '  if (c.mat < 0.5) return 0.0;               // background on both sides',
    '  vec4 b = texelFetch(uT1, ip, 0);',
    '  if (abs(c.id - b.a) > 0.002) return 1.0;  // two different parts touching',
    '  float dz = abs(c.z - texelFetch(uDepth, ip, 0).r) * uD2W, allow = uWpp * (r * 2.6 + 0.6);',
    '  if (dz > allow) return smoothstep(allow, allow * 1.7, dz);',
    '  crease = 1.0 - smoothstep(0.80, 0.93, dot(c.n, normalize(b.xyz * 2.0 - 1.0 + 1e-6)));   // a fold between faces of one part',
    '  return 0.0;',
    '}',
    'vec2 edgeRing(vec2 px, float r, G c, int k){',
    '  if (!nearBounds(px, uPartBounds, r)) return vec2(0.0);',
    '  float sil = 0.0, cr = 0.0, kk;',
    '  int n = k >= 0 ? uOffN[k] : 8 * uN;',
    '  for (int i = 0; i < n; i++){',
    '    vec2 q;',
    '    if (k >= 0) q = px + uOff[k * 8 + i];',
    '    else { float a = float(i) * 0.7853982 + 0.39; q = px + vec2(cos(a), sin(a)) * r; }',
    '    sil = max(sil, disc(c, q, r, kk)); cr = max(cr, kk); }',
    '  return vec2(sil, cr);',
    '}',
    '// Share the two soft outline rings and pooling; keep the double stroke separate to preserve depth-threshold rounding.',
    'vec2 styleEdges(int s, vec2 px, vec2 fp, float seed, bool fill, G gc){',
    '  float r = max(uOutW[s] * uScale, 0.9) * 0.5, e = 0.0, pool = 0.0;',
    '  vec2 p = px;',
    '  if (uOutA[s] > 0.0 && uWobble[s] > 0.0) p += (vec2(vnoise(px / 38.0 + seed), vnoise(px / 38.0 + seed + 17.3)) - 0.5) * 2.0 * uWobble[s] * uScale;',
    '  vec2 first = vec2(0.0); G center;',
    '  for (int j = 0; j < 3 * uN; j++){',
    '    if (j < 2 && uOutA[s] <= 0.0) continue;',
    '    if (j == 2 && (!fill || uPool[s] <= 0.0)) continue;',
    '    vec2 q = p; float rr = r;',
    '    if (j == 1) rr = r + 0.75;',
    '    if (j == 2){ q = fp; rr = 3.0 * uScale; }',
    '    if (j != 1){ if (all(equal(q, fp))) center = gc; else center = fetchG(q); } // the two soft outline rings have the same center',
    '    int k = s * 2 + j;',
    '    vec2 v = edgeRing(q, rr, center, j < 2 && uOffN[k] >= 0 ? k : -1);',
    '    if (j == 0) first = v;',
    '    else if (j == 1) e = 0.5 * (max(first.x, first.y * uCrease[s]) + max(v.x, v.y * uCrease[s]));',
    '    else pool = max(v.x, v.y * 0.5);',
    '  }',
    '  if (uOutA[s] > 0.0 && uDouble[s] > 0.0){',
    '    vec2 q = px + (vec2(vnoise(px / 23.0 + seed + 5.1), vnoise(px / 23.0 + seed + 41.7)) - 0.5) * 2.4 * uWobble[s] * uScale;',
    '    vec2 e3 = edgeRing(q, r * 0.7, fetchG(q), -1);',
    '    e = max(e, max(e3.x, e3.y * uCrease[s]) * uDouble[s]);',
    '  }',
    '  if (uOutA[s] > 0.0 && uPressure[s] > 0.0) e *= mix(1.0, 0.35 + 0.65 * vnoise(px / 55.0 + seed * 0.37), uPressure[s]);',
    '  return vec2(clamp(e, 0.0, 1.0), pool);',
    '}',
    '',
    '// shaded fill colour (rgb) and its lightness 0..1 (a), for style s',
    'vec4 shade(int s, G g){',
    '  vec3 base = uPal[s * 10 + int(g.mat)];',
    '  float raw = dot(g.n, uLight), sideT = clamp((raw + 0.75) / 1.5, 0.0, 1.0), v;',
    '  if (uBands[s] > 0.5){ float k = min(floor(sideT * uBands[s]), uBands[s] - 1.0); v = uBands[s] > 1.5 ? k / (uBands[s] - 1.0) : 1.0; }',
    '  else v = smoothstep(0.0, 1.0, sideT);',
    '  float top = uTopSoft[s] > 0.5 ? smoothstep(0.5, 0.97, g.n.z) : step(0.72, g.n.z);',
    '  vec3 side = mix(base * uShadow[s] * uCool[s], base * uWarm[s], v);',
    '  vec3 col = mix(side, mix(base, vec3(1.0), uTopLift[s]) * uWarm[s], top);',
    '  if (uSpec[s] > 0.0){',
    '    float sp = pow(max(dot(g.n, normalize(uLight + uView)), 0.0), uSpecPow[s]);',
    '    col += uSpec[s] * (uBands[s] > 0.5 ? smoothstep(0.55, 0.62, sp) : sp) * vec3(1.0);',
    '  }',
    '  return vec4(col, mix(v, 1.0, top));',
    '}',
    '',
    'vec3 styleColor(int s, vec2 px){',
    '  float seed = uBoil[s] > 0.0 ? floor(uTime * uBoil[s]) * 7.31 : 0.0;',
    '  vec3 bg = uBg[s];',
    '  if (uGrid[s] > 0.0){',
    '    vec2 f = abs(fract(px / uScale / 24.0) - 0.5) * 24.0;',
    '    bg = mix(bg, uGridC[s], (1.0 - smoothstep(0.0, 0.9, min(f.x, f.y))) * uGrid[s]);',
    '  }',
    '  // fills: possibly shifted off-register, so colour slips past the lines like a print or a wash',
    '  vec2 fp = px;',
    '  if (uOffReg[s] > 0.0) fp += (vec2(vnoise(px / 140.0 + 3.0), vnoise(px / 140.0 + 31.0)) - 0.5) * 2.0 * uOffReg[s] * uScale;',
    '  G g = fetchG(fp);',
    '  vec2 ed = vec2(0.0);',
    '  if (uOutA[s] > 0.0 || (g.mat > 0.5 && uPool[s] > 0.0)) ed = styleEdges(s, px, fp, seed, g.mat > 0.5, g);',
    '  vec3 col = bg;',
    '  if (g.mat > 0.5){',
    '    vec4 sh = shade(s, g);',
    '    vec3 c = sh.rgb;',
    '    if (uHatch[s] > 0.0){                       // cross-hatching: more layers the darker the tone',
    '      float P = uHatchP[s] * uScale, lw = 0.42 * uScale;',
    '      float d1 = abs(fract((px.x + px.y) / P) - 0.5) * P, d2 = abs(fract((px.x - px.y) / P) - 0.5) * P, d3 = abs(fract(px.y / (P * 0.8)) - 0.5) * P * 0.8;',
    '      float l1 = 1.0 - smoothstep(lw - 0.5, lw + 0.6, d1), l2 = 1.0 - smoothstep(lw - 0.5, lw + 0.6, d2), l3 = 1.0 - smoothstep(lw - 0.5, lw + 0.6, d3);',
    '      float m = max(max(l1 * smoothstep(0.92, 0.7, sh.a), l2 * smoothstep(0.6, 0.4, sh.a)), l3 * smoothstep(0.3, 0.12, sh.a));',
    '      c = mix(c, uHatchC[s], m * uHatch[s] * 0.85);',
    '    }',
    '    if (uAO[s] > 0.0){                          // soft contact shadows from the depth buffer',
    '#ifdef LOWRES',
    '#ifdef BILATERAL',
    '      // the 4 nearest low-res texels, bilinear weights, keeping only those on this pixel\'s face (same part id, same normal)',
    '      vec2 lsz = vec2(textureSize(uAOT, 0)), lp = fp / uRes * lsz - 0.5, f = fract(lp); ivec2 b0 = ivec2(floor(lp));',
    '      float sw = 0.0, so = 0.0, bo = 0.0; vec2 nk = g.n.xy * 0.5 + 0.5;',
    '      for (int i = 0; i < 4; i++){ ivec2 o = ivec2(i & 1, i >> 1);',
    '        vec4 a = texelFetch(uAOT, clamp(b0 + o, ivec2(0), ivec2(lsz) - 1), 0);',
    '        float w = (o.x == 1 ? f.x : 1.0 - f.x) * (o.y == 1 ? f.y : 1.0 - f.y);',
    '#ifdef LEAN',
    '        float m = abs(a.g * 255.0 - mod(g.id, 256.0)) < 0.5 && all(lessThan(abs(a.ba - nk), vec2(0.02))) ? 1.0 : 0.0;',
    '#else',
    '        float m = abs(a.g - g.id) < 0.002 && all(lessThan(abs(a.ba - nk), vec2(0.02))) ? 1.0 : 0.0;',
    '#endif',
    '        bo += a.r * w; sw += w * m; so += a.r * w * m; }',
    '      c *= 1.0 - uAO[s] * (sw > 1e-3 ? so / sw : bo);',
    '#else',
    '      c *= 1.0 - uAO[s] * texture(uAOT, fp / uRes).r;',
    '#endif',
    '#else',
    '      // hemisphere AO in screen space: rebuild each sample\'s 3D offset from its screen offset and',
    '      // depth; it occludes only if it is near in 3D and above this surface (in front of its normal)',
    '      float occ = 0.0, jit = ign(px) * 6.2832, Rw = 22.0 * uScale * uWpp;',
    '      for (int i = 0; i < 16 * uN; i++){ float fi = float(i) + 0.5, a = fi * 2.39996 + jit, rr = sqrt(fi / 16.0) * 22.0 * uScale;',
    '        vec2 o = vec2(cos(a), sin(a)) * rr;',
    '        float zs = texelFetch(uDepth, ivec2(clamp(fp + o, vec2(0.5), uRes - 0.5)), 0).r;',
    '        vec3 off = (uRgt * o.x - uDown * o.y) * uWpp + uView * (g.z - zs) * uD2W;',
    '        float L = length(off) + 1e-5, up = dot(g.n, off) / L;',
    '        occ += smoothstep(0.1, 0.5, up) * (1.0 - smoothstep(Rw * 0.6, Rw * 1.2, L)); }',
    '      c *= 1.0 - uAO[s] * occ / 16.0;',
    '#endif',
    '    }',
    '    if (uRim[s] > 0.0){                         // a light rim just inside the silhouette',
    '      float far = 0.0;',
    '      for (int i = 0; i < 8 * uN; i++){ float a = float(i) * 0.7853982; G q = fetchG(fp + vec2(cos(a), sin(a)) * 3.5 * uScale);',
    '        far += (q.mat < 0.5 || (q.z - g.z) * uD2W > uWpp * 12.0) ? 1.0 : 0.0; }',
    '      c = mix(c, vec3(1.0), uRim[s] * smoothstep(0.1, 0.5, far / 8.0) * 0.7);',
    '    }',
    '    if (uPool[s] > 0.0){                        // watercolour: pigment pools at the edges of a wash',
    '      c = mix(c, c * 0.8, ed.y * uPool[s]);',
    '    }',
    '    col = mix(bg, c, uFill[s]);',
    '  }',
    '  // glow: a soft halo around glowing parts (blur of the glow channel), tinted by the style',
    '  if (uGlowA[s] > 0.0 && nearBounds(px, uGlowBounds, 20.0 * uScale)){',
    // a Gaussian (sigma 9 CSS px) from the glow channel's mipmaps: a centre and two rings of six, each read already averaged
    // over ~4x4 CSS px. Smooth and steady while parts move; a per-pixel dithered spiral sparkled from frame to frame.
    '#ifdef LOWRES',
    '    float h = texture(uGlowT, px / uRes).r * 155.0;',
    '#else',
    '    float lod = log2(4.0 * uScale), h = textureLod(uT0, px / uRes, lod).g * 16.0;',
    '    for (int i = 0; i < 6 * uN; i++){ float a = float(i) * 1.0471976;',
    '      h += textureLod(uT0, (px + vec2(cos(a), sin(a)) * 8.0 * uScale) / uRes, lod).g * 14.36;',
    '      h += textureLod(uT0, (px + vec2(cos(a + 0.5236), sin(a + 0.5236)) * 16.0 * uScale) / uRes, lod).g * 8.80; }',
    '#endif',
    '    h = clamp(h / 155.0 * 2.2, 0.0, 1.0) * (1.0 - g.glow);             // a halo around the part, not over it',
    '    col = mix(col, uGlowC[s], h * uGlowA[s] * 0.6);',
    '  }',
    '  // outlines on top',
    '  if (uOutA[s] > 0.0) col = mix(col, uOutC[s], ed.x * uOutA[s]);',
    '  // paper grain',
    '  if (uGrain[s] > 0.0){',
    '    float n = vnoise(px / (1.2 * uScale)) * 0.55 + vnoise(px / (7.0 * uScale) + 9.0) * 0.45;',
    '    col *= 1.0 + (n - 0.5) * uGrain[s] * 0.5;',
    '  }',
    '  return col;',
    '}',
    '',
    'void main(){',
    '  vec2 px = gl_FragCoord.xy;',
    '  vec2 dir = vec2(cos(uWipeAng), sin(uWipeAng)), uv = px / uRes;',
    '  float span = abs(dir.x) * uRes.x + abs(dir.y) * uRes.y;',
    '  float w = dot(px - uRes * 0.5, dir) / span + 0.5;                 // 0..1 across the screen',
    '  float along = dot(uv, vec2(-dir.y, dir.x));',
    '#ifdef SPEC',
    '  frag = vec4(styleColor(0, px), 1.0);                               // one style, its settings compiled in',
    '#else',
    '  float e = 0.0, m = uMix <= 0.0 ? 1.0 : 0.0;                         // no wipe: the edge is off screen (w is 0..1, e beyond -0.045 or 1.045)',
    '  if (uMix > 0.0 && uMix < 1.0){',
    '    e = mix(-0.06, 1.06, uMix) + (vnoise(vec2(along * 16.0, floor(uTime * 6.0))) - 0.5) * 0.012 + (vnoise(vec2(along * 3.0, 4.0)) - 0.5) * 0.01;',
    '    m = smoothstep(e - 0.004, e + 0.004, w);                         // 1 = style A side',
    '  }',
    '  vec3 col;',
    '  // one call site in a real loop: inlined once, not four times (Direct3D compile time grows with every copy)',
    '  int s0 = m < 0.001 ? 1 : 0, s1 = m > 0.999 ? 0 : 1;',
    '  vec3 cs[2]; cs[0] = vec3(0.0); cs[1] = vec3(0.0);',
    '  for (int s = s0; s <= s1; s++) cs[s] = styleColor(s, px);',
    '  col = s0 == s1 ? cs[s0] : mix(cs[1], cs[0], m);',
    '  if (uMix > 0.001 && uMix < 0.999){                               // the wipe edge, drawn in ink',
    '    float d = abs(w - e) * span;',
    '    col = mix(col, vec3(0.1, 0.09, 0.08), (1.0 - smoothstep(0.9 * uScale, 2.0 * uScale, d)) * 0.8);',
    '  }',
    '  frag = vec4(col, 1.0);',
    '#endif',
    '}'
  ].join('\n');

  /* lowres passes: each draws a small texture the composite reads with one filtered fetch */
  // the glow halo, evaluated at each low-res texel's centre exactly as the composite would there
  var GLOW_FS = [
    '#version 300 es',
    'precision highp float;',
    'uniform sampler2D uT0; uniform vec2 uRes, uLo; uniform float uScale;',
    'out vec4 frag;',
    'void main(){',
    '  vec2 px = gl_FragCoord.xy * uRes / uLo;',
    '  float lod = log2(4.0 * uScale), h = textureLod(uT0, px / uRes, lod).g * 16.0;',
    '  for (int i = 0; i < 6; i++){ float a = float(i) * 1.0471976;',
    '    h += textureLod(uT0, (px + vec2(cos(a), sin(a)) * 8.0 * uScale) / uRes, lod).g * 14.36;',
    '    h += textureLod(uT0, (px + vec2(cos(a + 0.5236), sin(a + 0.5236)) * 16.0 * uScale) / uRes, lod).g * 8.80; }',
    '  frag = vec4(h / 155.0, 0.0, 0.0, 1.0);',
    '}'
  ].join('\n');
  // ambient occlusion at half resolution: the composite's loop, for the full-res pixel under each texel's centre
  var AO_FS = [
    '#version 300 es',
    'precision highp float;',
    'uniform sampler2D uT0, uT1, uDepth; uniform vec2 uRes, uLo; uniform float uScale, uWpp, uD2W; uniform vec3 uView, uRgt, uDown;',
    'out vec4 frag;',
    'float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }',
    '#ifdef LEAN',
    'vec2 octE(vec3 n){ n /= abs(n.x) + abs(n.y) + abs(n.z); vec2 s = vec2(n.x >= 0.0 ? 1.0 : -1.0, n.y >= 0.0 ? 1.0 : -1.0);',
    '  return (n.z >= 0.0 ? n.xy : (1.0 - abs(n.yx)) * s) * 0.5 + 0.5; }',
    'vec3 octD(vec2 e){ vec2 f = e * 2.0 - 1.0; vec3 n = vec3(f, 1.0 - abs(f.x) - abs(f.y)); float t = max(-n.z, 0.0);',
    '  n.xy += vec2(n.x >= 0.0 ? -t : t, n.y >= 0.0 ? -t : t); return normalize(n); }',
    '#endif',
    'void main(){',
    '  vec2 fp = gl_FragCoord.xy * uRes / uLo;',
    '  ivec2 ip = ivec2(clamp(fp, vec2(0.5), uRes - 0.5));',
    '  if (floor(texelFetch(uT0, ip, 0).r * 255.0 + 0.5) < 0.5){ frag = vec4(0.0); return; }',
    '#ifdef LEAN',
    '  vec4 b = texelFetch(uT1, ip, 0); vec3 n = octD(b.xy); b.a = b.z; float z = texelFetch(uDepth, ip, 0).r;',
    '#else',
    '  vec4 b = texelFetch(uT1, ip, 0); vec3 n = normalize(b.xyz * 2.0 - 1.0 + 1e-6); float z = texelFetch(uDepth, ip, 0).r;',
    '#endif',
    '  float occ = 0.0, jit = ign(fp) * 6.2832, Rw = 22.0 * uScale * uWpp;',
    '  for (int i = 0; i < 16; i++){ float fi = float(i) + 0.5, a = fi * 2.39996 + jit, rr = sqrt(fi / 16.0) * 22.0 * uScale;',
    '    vec2 o = vec2(cos(a), sin(a)) * rr;',
    '    float zs = texelFetch(uDepth, ivec2(clamp(fp + o, vec2(0.5), uRes - 0.5)), 0).r;',
    '    vec3 off = (uRgt * o.x - uDown * o.y) * uWpp + uView * (z - zs) * uD2W;',
    '    float L = length(off) + 1e-5, up = dot(n, off) / L;',
    '    occ += smoothstep(0.1, 0.5, up) * (1.0 - smoothstep(Rw * 0.6, Rw * 1.2, L)); }',
    '  frag = vec4(occ / 16.0, b.a, n.xy * 0.5 + 0.5);              // the occlusion, and which face it belongs to (for the bilateral upsample)',
    '}'
  ].join('\n');

  // start compiling and linking; nothing here waits for the driver (finish() does)
  function startProgram(gl, vs, fs) {
    var p = gl.createProgram(), a = gl.createShader(gl.VERTEX_SHADER), b = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(a, vs); gl.compileShader(a); gl.shaderSource(b, fs); gl.compileShader(b);
    gl.attachShader(p, a); gl.attachShader(p, b); gl.linkProgram(p);
    return { p: p, vs: a, fs: b };
  }
  function finish(gl, q) {
    var p = q.p;
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      var log = gl.getShaderInfoLog(q.vs) || gl.getShaderInfoLog(q.fs) || gl.getProgramInfoLog(p);
      throw new Error('xp-gl shader: ' + log);
    }
    var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) { var info = gl.getActiveUniform(p, i), name = info.name.replace(/\[0\]$/, ''); u[name] = gl.getUniformLocation(p, info.name); }
    return { p: p, u: u };
  }

  XP.glRenderer = function (canvas, scene, opts) {
    opts = opts || {};
    var off = { supported: false, render: function () {}, setStyles: function () {}, resize: function () {}, styles: XP.STYLES };
    // keep the last frame only for the capture scripts (Playwright sets navigator.webdriver): retaining it costs every frame on phones
    var keep = opts.preserve != null ? opts.preserve : !!navigator.webdriver;
    var gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: keep, powerPreference: 'high-performance' });
    if (!gl) return off;
    // which GPU: a software rasterizer draws one frame in seconds, so the caller falls back to SVG (the capture scripts still get GL)
    var dbg = gl.getExtension('WEBGL_debug_renderer_info'), gpu = '';
    try { gpu = String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || ''); } catch (e) {}
    off.gpu = gpu;
    if (/swiftshader|llvmpipe|softpipe|lavapipe|basic render|software/i.test(gpu) && !navigator.webdriver && !window.XP_FORCE_GL && opts.allowSoftware !== true) {
      var lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
      off.software = true; return off;
    }
    /* Compiling. On Windows the driver compiles through Direct3D, which is slow: the general pass-2 shader takes ~0.7 s
       in Firefox, a specialized one ~0.25 s. So the start needs only pass 1, the small passes and pass 2 specialized for
       the starting style (opts.style, default ink): render() draws nothing until they are linked, and onReady(fn) says
       when. With { async: true } and KHR_parallel_shader_compile they compile in the background; otherwise they are
       linked here. The general shader (wipes, custom styles) comes after: in the background where the extension
       exists, else when warm() is called (the player calls it while the film is paused), or at the latest when a frame
       first needs it. { specialize: false }, { lean: false }, { lowres: false }, { sort: false } turn the speed-ups off. */
    var lean = opts.lean !== false, lowres = opts.lowres !== false, sorted = opts.sort !== false, specialize = opts.specialize !== false;
    var leanDef = lean ? '#define LEAN 1\n' : '', defs = leanDef + (lowres ? '#define LOWRES 1\n#define BILATERAL 1\n' : '');
    var par = opts.async ? gl.getExtension('KHR_parallel_shader_compile') : null, ready = false, failed = false, waiters = [];
    var geo, glowP, aoP, comp = null, qc = null, firstSpec = null;
    var base = [startProgram(gl, GEO_VS, GEO_FS.replace('\n', '\n' + leanDef))];
    if (lowres) base.push(startProgram(gl, FS_VS, GLOW_FS), startProgram(gl, FS_VS, AO_FS.replace('\n', '\n' + leanDef)));
    function compiled(q) { return !par || gl.getProgramParameter(q.p, par.COMPLETION_STATUS_KHR); }
    function startComp() { if (!qc) qc = startProgram(gl, FS_VS, COMP_FS.replace('\n', '\n' + defs)); }
    function linkComp() {                                          // the general shader, linked now (waits for the driver)
      if (comp || failed) return comp;
      startComp();
      try { comp = finish(gl, qc); } catch (err) { failed = true; if (window.console) console.warn(err.message); }
      return comp;
    }
    function settle() {
      try {
        geo = finish(gl, base[0]); if (lowres) { glowP = finish(gl, base[1]); aoP = finish(gl, base[2]); }
        if (!(firstSpec && specLink(firstSpec))) linkComp();       // no specialized start (or it failed): the general shader
        ready = !failed;
      } catch (err) { failed = true; if (window.console) console.warn(err.message); }
      var w = waiters; waiters = []; w.forEach(function (fn) { fn(ready); });
    }
    function poll() {
      if (gl.isContextLost()) { failed = true; return; }
      if (base.every(compiled) && (firstSpec ? compiled(firstSpec.q) : compiled(qc))) settle();
      else setTimeout(poll, 16);
    }
    function warm() { if (!comp && !failed && ready) { startComp(); if (!par) linkComp(); } }

    /* meshes → vertex buffers (fan-triangulated convex faces, flat normals), one VAO each */
    var meshes = {}, STRIDE = 11, ONE = [1, 0];   // floats per instance: pos, scale, mat, glow, id, cos and sin of rot
    var inst = gl.createBuffer(), instData = new Float32Array(STRIDE * 256);
    function meshOf(m) {
      if (meshes[m.id]) return meshes[m.id];
      var a = [];
      m.faces.forEach(function (f) {
        for (var i = 1; i < f.p.length - 1; i++) [f.p[0], f.p[i], f.p[i + 1]].forEach(function (q) { a.push(q[0], q[1], q[2], f.n[0], f.n[1], f.n[2]); });
      });
      var vao = gl.createVertexArray(), vbo = gl.createBuffer();
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(a), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
      for (var k = 2; k <= 6; k++) { gl.enableVertexAttribArray(k); gl.vertexAttribDivisor(k, 1); }
      gl.bindVertexArray(null);
      return (meshes[m.id] = { vao: vao, count: a.length / 6 });
    }

    /* the off-screen geometry buffer */
    var fbo = null, tex0, tex1, texD, bw = 0, bh = 0, cssW = 0, cssH = 0, dpr = 1;
    var lo = { glow: null, ao: null };                              // lowres: { tex, fbo, w, h } each
    /* resolution: 2× supersamples the fills (pass 1 has no MSAA), but the style pass reads ~100 texels a pixel, which an
       integrated GPU can't afford at 2× on a big screen. Start at the screen's density (at least 1.5×, at most 2×);
       the player lowers it with setScale when frames run slow. */
    var scale = opts.pixelRatio || window.XP_PIXEL_RATIO || Math.min(2, Math.max(1.5, window.devicePixelRatio || 1));
    function makeTex(fmt, ifmt, type) {
      var t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, bw, bh, 0, fmt, type, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }
    function resize() {
      cssW = canvas.clientWidth || opts.width || scene.cam.W; cssH = canvas.clientHeight || opts.height || scene.cam.H;
      dpr = scale;
      var w = Math.max(1, Math.round(cssW * dpr)), h = Math.max(1, Math.round(cssH * dpr));
      if (w === bw && h === bh && fbo) return;
      bw = w; bh = h; canvas.width = w; canvas.height = h;
      if (fbo) { gl.deleteFramebuffer(fbo); gl.deleteTexture(tex0); gl.deleteTexture(tex1); gl.deleteTexture(texD); }
      tex0 = makeTex(gl.RGBA, gl.RGBA8, gl.UNSIGNED_BYTE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);   // the halo reads its mips; texelFetch ignores filtering
      tex1 = makeTex(gl.RGBA, gl.RGBA8, gl.UNSIGNED_BYTE);
      texD = makeTex(gl.DEPTH_COMPONENT, gl.DEPTH_COMPONENT24, gl.UNSIGNED_INT);
      fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex0, 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, tex1, 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, texD, 0);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (lowres) {
        // the glow: one texel per 4 CSS px (the halo's sigma is 9); AO: half resolution
        lo.glow = loTarget(lo.glow, Math.ceil(bw / (4 * dpr)), Math.ceil(bh / (4 * dpr)));
        lo.ao = loTarget(lo.ao, Math.ceil(bw / 2), Math.ceil(bh / 2), gl.RGBA8);   // occlusion, part id, normal
      }
    }
    function loTarget(old, w, h, fmt, filter) {
      fmt = fmt || gl.R8; filter = filter || gl.LINEAR;
      if (old) { gl.deleteFramebuffer(old.fbo); gl.deleteTexture(old.tex); }
      var t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, fmt, w, h, 0, fmt === gl.R8 ? gl.RED : gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      var f = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return { tex: t, fbo: f, w: w, h: h };
    }

    /* styles → uniform arrays */
    var cur = { a: 'ink', b: 'ink', mix: 0, wipe: 35 };
    function styleOf(s) { return typeof s === 'string' ? (XP.STYLES[s] || XP.STYLES.ink) : s; }
    function setStyles(a, b, mix, wipe) {
      if (a != null) cur.a = a;
      cur.b = b == null ? cur.a : b;
      cur.mix = mix == null ? 0 : Math.max(0, Math.min(1, mix));
      if (wipe != null) cur.wipe = wipe;
    }
    function v3pair(f, A, B) { var x = hex(A[f]), y = hex(B[f]); return [x[0], x[1], x[2], y[0], y[1], y[2]]; }
    function f2(f, A, B) { return [A[f], B[f]]; }
    // the composite compiled for one style at this scale: per-style scalars become literals, the outline offsets constant
    // arrays, the loops' uN bound 1
    var SCALARS = { uBands: 'bands', uShadow: 'shadow', uTopLift: 'topLift', uTopSoft: 'topSoft', uOutW: 'outline', uCrease: 'crease', uOutA: 'outlineAlpha',
      uWobble: 'wobble', uBoil: 'boil', uDouble: 'double', uPressure: 'pressure', uGrain: 'grain', uHatch: 'hatch', uHatchP: 'hatchPeriod',
      uFill: 'fill', uOffReg: 'offReg', uPool: 'pool', uRim: 'rim', uSpec: 'spec', uSpecPow: 'specPow', uAO: 'ao', uGrid: 'grid', uGlowA: 'glow' };
    var specs = {}, specKeys = [], specMs = 0;
    function lit(v) { var x = Math.fround(+v || 0), t = String(x); return '(' + (/[.e]/.test(t) ? t : t + '.0') + ')'; }
    // start compiling (or find) the specialized shader for style S at this scale's outline offsets: { q, P (linked), bad }
    function specStart(S) {
      ringOffsets(S, 0);
      var vals = Object.keys(SCALARS).map(function (k) { return lit(S[SCALARS[k]]); });
      var key = vals.join(',') + '|' + Array.prototype.join.call(offN.subarray(0, 2)) + '|' + Array.prototype.join.call(offs.subarray(0, 32));
      if (specs[key]) return specs[key];
      var src = COMP_FS.replace('\n', '\n' + defs + '#define SPEC 1\n'), i = 0;
      Object.keys(SCALARS).forEach(function (k) { src = src.split(k + '[s]').join(vals[i++]); });
      var on = [], ov = [];
      for (var j = 0; j < 4; j++) on.push(j < 2 ? offN[j] : -1);
      for (j = 0; j < 32; j++) ov.push('vec2(' + lit(j < 16 ? offs[2 * j] : 0) + ', ' + lit(j < 16 ? offs[2 * j + 1] : 0) + ')');
      src = src.replace('uniform vec2 uOff[32]; uniform int uOffN[4];', '').replace('//SPEC_CONSTS', 'const int OFFN[4] = int[4](' + on.join(', ') + ');\nconst vec2 OFF[32] = vec2[32](' + ov.join(', ') + ');');
      src = src.split('uOffN[').join('OFFN[').split('uOff[').join('OFF[').split(' * uN').join(' * 1');
      var e = specs[key] = { q: startProgram(gl, FS_VS, src), P: null, bad: false, t0: performance.now() };
      specKeys.push(key);
      if (specKeys.length > 8) { var k0 = specKeys.shift(), old = specs[k0]; if (old && old.P) gl.deleteProgram(old.P.p); delete specs[k0]; }
      return e;
    }
    function specLink(e) {                                         // link if compiled (or if we may wait); null if not ready or broken
      if (e.P || e.bad) return e.P;
      if (par && !compiled(e.q)) return null;
      try { e.P = finish(gl, e.q); specMs = performance.now() - e.t0; } catch (err) { e.bad = true; if (window.console) console.warn(err.message); }
      return e.P;
    }
    function uploadStyles(u, A, B) {
      var pal = [];
      [A, B].forEach(function (S) { for (var i = 0; i < 10; i++) pal = pal.concat(hex(S.pal[i] || S.pal[1])); });
      gl.uniform3fv(u.uPal, pal);
      gl.uniform3fv(u.uBg, v3pair('bg', A, B));
      gl.uniform3fv(u.uWarm, v3pair('warm', A, B)); gl.uniform3fv(u.uCool, v3pair('cool', A, B));
      gl.uniform3fv(u.uOutC, v3pair('outlineColor', A, B)); gl.uniform3fv(u.uHatchC, v3pair('hatchColor', A, B));
      gl.uniform3fv(u.uGridC, v3pair('gridColor', A, B)); gl.uniform3fv(u.uGlowC, v3pair('glowColor', A, B));
      var F = { uBands: 'bands', uShadow: 'shadow', uTopLift: 'topLift', uTopSoft: 'topSoft', uOutW: 'outline', uCrease: 'crease', uOutA: 'outlineAlpha',
        uWobble: 'wobble', uBoil: 'boil', uDouble: 'double', uPressure: 'pressure', uGrain: 'grain', uHatch: 'hatch', uHatchP: 'hatchPeriod',
        uFill: 'fill', uOffReg: 'offReg', uPool: 'pool', uRim: 'rim', uSpec: 'spec', uSpecPow: 'specPow', uAO: 'ao', uGrid: 'grid', uGlowA: 'glow' };
      for (var k in F) if (u[k]) gl.uniform1fv(u[k], f2(F[k], A, B));
      ringOffsets(A, 0); ringOffsets(B, 1);
      gl.uniform2fv(u.uOff, offs); gl.uniform1iv(u.uOffN, offN);
    }
    // The outline rings' taps as whole-pixel offsets from the pixel centre, duplicates and the pixel itself removed
    // (a tap on the pixel itself never finds an edge). Mirrors the shader: a = i*0.7853982 + 0.39, r = max(w*scale, 0.9)/2,
    // second ring r + 0.75. Wobble moves the ring centre off the pixel centre, so those styles keep the shader's loop.
    var offs = new Float32Array(64), offN = new Int32Array(4), f32 = Math.fround;
    function ringOffsets(S, s) {
      offN[2 * s] = offN[2 * s + 1] = -1;
      if (S.outlineAlpha > 0 && S.wobble > 0) return;
      var r = f32(f32(Math.max(f32(f32(S.outline) * f32(dpr)), 0.9)) * 0.5);
      for (var j = 0; j < 2; j++) {
        var rr = j ? f32(r + 0.75) : r, seen = {}, n = 0, ok = true;
        for (var i = 0; i < 8; i++) {
          var a = f32(f32(i * f32(0.7853982)) + f32(0.39)), x = 0.5 + Math.cos(a) * rr, y = 0.5 + Math.sin(a) * rr;
          if (Math.abs(x - Math.round(x)) < 1e-3 || Math.abs(y - Math.round(y)) < 1e-3) ok = false;
          var dx = Math.floor(x), dy = Math.floor(y), key = dx + ',' + dy;
          if ((dx || dy) && !seen[key]) { seen[key] = 1; offs[2 * ((2 * s + j) * 8 + n)] = dx; offs[2 * ((2 * s + j) * 8 + n) + 1] = dy; n++; }
        }
        if (ok) offN[2 * s + j] = n;
      }
    }

    // Project a mesh AABB, including negative scales. Padding covers texel centers and float32 rounding.
    // Clamp bounds to the viewport conservatively: samples clamp to its edge too.
    function extendBounds(box, p, B, C, k, ox, oy) {
      var m = p.mesh, s = typeof p.scale === 'number' ? [p.scale, p.scale, p.scale] : p.scale;
      var q = [], h = [], err = 0;
      for (var j = 0; j < 3; j++) {
        q[j] = (m.lo[j] + m.hi[j]) * 0.5 * s[j] + p.pos[j] - C.center[j];
        h[j] = (m.hi[j] - m.lo[j]) * 0.5 * Math.abs(s[j]);
        err += Math.max(Math.abs(m.lo[j]), Math.abs(m.hi[j])) * Math.abs(s[j]) + Math.abs(p.pos[j]) + Math.abs(C.center[j]);
      }
      if (p.rot) {                                                   // a turned part: the box around its turned box
        var cs = XP.rotOf(p), ca = Math.abs(cs[0]), sa = Math.abs(cs[1]), cx = q[0] - p.pos[0] + C.center[0], cy = q[1] - p.pos[1] + C.center[1];
        q[0] = cs[0] * cx - cs[1] * cy + p.pos[0] - C.center[0]; q[1] = cs[1] * cx + cs[0] * cy + p.pos[1] - C.center[1];
        var hx = h[0]; h[0] = ca * hx + sa * h[1]; h[1] = sa * hx + ca * h[1];
      }
      var z = Math.abs(C.zoom * k), pad = 2 + err * z * 0.00001;
      var x = ox + (C.W * 0.5 + XP.v.dot(B.r, q) * C.zoom) * k;
      var y = cssH - oy - (C.H * 0.5 + XP.v.dot(B.dn, q) * C.zoom) * k;
      var rx = (Math.abs(B.r[0]) * h[0] + Math.abs(B.r[1]) * h[1] + Math.abs(B.r[2]) * h[2]) * z + pad;
      var ry = (Math.abs(B.dn[0]) * h[0] + Math.abs(B.dn[1]) * h[1] + Math.abs(B.dn[2]) * h[2]) * z + pad;
      box[0] = Math.min(box[0], Math.max(0, Math.min(bw, (x - rx) * bw / cssW)));
      box[1] = Math.min(box[1], Math.max(0, Math.min(bh, (y - ry) * bh / cssH)));
      box[2] = Math.max(box[2], Math.max(0, Math.min(bw, (x + rx) * bw / cssW)));
      box[3] = Math.max(box[3], Math.max(0, Math.min(bh, (y + ry) * bh / cssH)));
    }

    function render(t) {
      if (!ready) return;
      t = t || 0;
      if ((canvas.clientWidth && Math.round(canvas.clientWidth * dpr) !== bw) || !fbo) resize();
      var C = scene.cam, B = XP.basis(C);
      var k = Math.min(cssW / C.W, cssH / C.H), ox = (cssW - C.W * k) / 2, oy = (cssH - C.H * k) / 2;

      // visible parts grouped by mesh; depth range from their bounding spheres
      var groups = {}, order = [], n = 0, R = 1;
      var partBounds = [1e30, 1e30, -1e30, -1e30], glowBounds = [1e30, 1e30, -1e30, -1e30];
      scene.parts.forEach(function (p, i) {
        if (!p.show) return;
        var g = groups[p.mesh.id];
        if (!g) { g = groups[p.mesh.id] = { mesh: p.mesh, list: [] }; order.push(g); }
        g.list.push({ p: p, i: i, z: sorted ? XP.v.dot(B.d, XP.v.sub(p.pos, C.center)) : 0 }); n++;   // z: larger = nearer
        extendBounds(partBounds, p, B, C, k, ox, oy);
        if (p.glow > 0) extendBounds(glowBounds, p, B, C, k, ox, oy);
        var s = typeof p.scale === 'number' ? [p.scale, p.scale, p.scale] : p.scale, m = p.mesh;
        var c = XP.partCenter(p), rad = 0.5 * Math.hypot((m.hi[0] - m.lo[0]) * s[0], (m.hi[1] - m.lo[1]) * s[1], (m.hi[2] - m.lo[2]) * s[2]);
        R = Math.max(R, Math.abs(XP.v.dot(B.d, XP.v.sub(c, C.center))) + rad);
      });
      R *= 1.05;
      if (sorted) {                                                  // front to back: hidden pixels fail the depth test before shading
        order.forEach(function (g) { g.list.sort(function (a, b) { return b.z - a.z; }); g.z = g.list[0].z; });
        order.sort(function (a, b) { return b.z - a.z; });
      }
      if (instData.length < n * STRIDE) instData = new Float32Array(Math.ceil(n * 1.5) * STRIDE);
      var o = 0;
      order.forEach(function (g) {
        g.start = o / STRIDE;
        g.list.forEach(function (e) {
          var p = e.p, s = typeof p.scale === 'number' ? [p.scale, p.scale, p.scale] : p.scale;
          // layer settles depth ties, as it orders painting in the SVG renderer: a nudge toward the camera along the view
          // direction (invisible on screen in this orthographic view), ~30 steps of a 24-bit depth buffer per layer
          var lz = Math.max(-20, Math.min(20, p.layer || 0)) * R * 4e-6;
          instData[o++] = p.pos[0] + B.d[0] * lz; instData[o++] = p.pos[1] + B.d[1] * lz; instData[o++] = p.pos[2] + B.d[2] * lz;
          instData[o++] = s[0]; instData[o++] = s[1]; instData[o++] = s[2];
          instData[o++] = XP.matIndex(p.mat); instData[o++] = p.glow || 0; instData[o++] = e.i + 1;
          var cs = p.rot ? XP.rotOf(p) : ONE; instData[o++] = cs[0]; instData[o++] = cs[1];
        });
      });
      gl.bindBuffer(gl.ARRAY_BUFFER, inst);
      gl.bufferData(gl.ARRAY_BUFFER, instData.byteLength, gl.DYNAMIC_DRAW);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, instData, 0, o);

      // pass 1: geometry
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, bw, bh);
      gl.clearBufferfv(gl.COLOR, 0, [0, 0, 0, 0]); gl.clearBufferfv(gl.COLOR, 1, [0, 0, 0, 0]); gl.clearBufferfv(gl.DEPTH, 0, [1]);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
      gl.useProgram(geo.p);
      var u = geo.u;
      gl.uniform3fv(u.uR, B.r); gl.uniform3fv(u.uDn, B.dn); gl.uniform3fv(u.uD, B.d); gl.uniform3fv(u.uC, C.center);
      gl.uniform1f(u.uZoom, C.zoom); gl.uniform2f(u.uVB, C.W, C.H); gl.uniform3f(u.uMap, k, ox, oy); gl.uniform2f(u.uCss, cssW, cssH); gl.uniform1f(u.uDR, R);
      order.forEach(function (g) {
        var M = meshOf(g.mesh), off = g.start * STRIDE * 4, st = STRIDE * 4;
        gl.bindVertexArray(M.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, inst);
        gl.vertexAttribPointer(2, 3, gl.FLOAT, false, st, off);
        gl.vertexAttribPointer(3, 3, gl.FLOAT, false, st, off + 12);
        gl.vertexAttribPointer(4, 2, gl.FLOAT, false, st, off + 24);
        gl.vertexAttribPointer(5, 1, gl.FLOAT, false, st, off + 32);
        gl.vertexAttribPointer(6, 2, gl.FLOAT, false, st, off + 36);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, M.count, g.list.length);
      });
      gl.bindVertexArray(null);

      // pass 2: style composite
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.disable(gl.DEPTH_TEST);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex0);
      gl.generateMipmap(gl.TEXTURE_2D);                              // the halo's blur source (always: a mip-filtered texture without mips reads as black)
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tex1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, texD);
      if (lowres) {
        var SA = styleOf(cur.a), SB = styleOf(cur.b), wpp = 1 / (C.zoom * k * dpr);
        if ((SA.glow > 0 || SB.glow > 0) && glowBounds[2] >= glowBounds[0]) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, lo.glow.fbo); gl.viewport(0, 0, lo.glow.w, lo.glow.h);
          gl.useProgram(glowP.p); u = glowP.u;
          gl.uniform1i(u.uT0, 0); gl.uniform2f(u.uRes, bw, bh); gl.uniform2f(u.uLo, lo.glow.w, lo.glow.h); gl.uniform1f(u.uScale, dpr);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        }
        if (SA.ao > 0 || SB.ao > 0) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, lo.ao.fbo); gl.viewport(0, 0, lo.ao.w, lo.ao.h);
          gl.useProgram(aoP.p); u = aoP.u;
          gl.uniform1i(u.uT0, 0); gl.uniform1i(u.uT1, 1); gl.uniform1i(u.uDepth, 2);
          gl.uniform2f(u.uRes, bw, bh); gl.uniform2f(u.uLo, lo.ao.w, lo.ao.h); gl.uniform1f(u.uScale, dpr);
          gl.uniform1f(u.uWpp, wpp); gl.uniform1f(u.uD2W, 2 * R);
          gl.uniform3fv(u.uView, B.d); gl.uniform3fv(u.uRgt, B.r); gl.uniform3fv(u.uDown, B.dn);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, lo.glow.tex);
        gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, lo.ao.tex);
      }
      gl.viewport(0, 0, bw, bh);
      // the specialized shader for the style on screen if it is linked; else the general one, linked now unless it is
      // still compiling in the background (then this frame is skipped and the canvas keeps the last one)
      var vis = cur.mix <= 0 ? styleOf(cur.a) : cur.mix >= 1 ? styleOf(cur.b) : null, P = specialize && vis ? specLink(specStart(vis)) : null;
      if (!P) { startComp(); P = par && !comp && !compiled(qc) ? null : linkComp(); }
      if (!P) return;
      gl.useProgram(P.p);
      u = P.u;
      gl.uniform1i(u.uT0, 0); gl.uniform1i(u.uT1, 1); gl.uniform1i(u.uDepth, 2);
      if (lowres) { gl.uniform1i(u.uGlowT, 3); gl.uniform1i(u.uAOT, 4); }
      gl.uniform2f(u.uRes, bw, bh); gl.uniform1i(u.uN, 1); gl.uniform1f(u.uScale, dpr); gl.uniform1f(u.uTime, t);
      gl.uniform1f(u.uMix, cur.mix); gl.uniform1f(u.uWipeAng, cur.wipe * Math.PI / 180);
      gl.uniform1f(u.uWpp, 1 / (C.zoom * k * dpr)); gl.uniform1f(u.uD2W, 2 * R);
      gl.uniform3fv(u.uLight, XP.LIGHT); gl.uniform3fv(u.uView, B.d); gl.uniform3fv(u.uRgt, B.r); gl.uniform3fv(u.uDown, B.dn);
      gl.uniform4fv(u.uPartBounds, partBounds); gl.uniform4fv(u.uGlowBounds, glowBounds);
      if (P === comp) uploadStyles(u, styleOf(cur.a), styleOf(cur.b)); else uploadStyles(u, vis, vis);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    resize();
    if (specialize) firstSpec = specStart(styleOf(opts.style || 'ink'));
    if (!firstSpec || par) startComp();                            // in the background, or as the start itself
    if (!par) { settle(); if (failed) return off; } else poll();
    function setScale(x) { if (x === scale) return; scale = x; resize(); }
    function release() { var l = gl.getExtension('WEBGL_lose_context'); if (l) l.loseContext(); }
    function onReady(fn) { if (ready || failed) fn(ready); else waiters.push(fn); }
    function setScene(s) { scene = s; }                            // a film's shots: one renderer, several scenes (meshes are cached by id)
    return { supported: true, ready: function () { return ready; }, failed: function () { return failed; }, onReady: onReady, render: render, setScene: setScene, setStyles: setStyles, resize: resize, styles: XP.STYLES, gl: gl, state: cur,
      setScale: setScale, scale: function () { return scale; }, gpu: gpu, release: release, warm: warm, get specMs() { return specMs; } };
  };
})();
