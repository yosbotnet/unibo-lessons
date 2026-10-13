/* xp-gl.js — the explainer kit's shader renderer (WebGL2). It draws the same scene as xp-svg.js,
   through the same orthographic camera (XP.project), in one of several styles: ink, cel, sketch,
   hatch, blueprint, clay. Two passes:
     1. geometry → an off-screen buffer holding, per pixel, the material, glow, normal, part id
        and depth (no colour yet: "deferred");
     2. one full-screen pass that turns those into a picture in style A and style B, outlines
        from discontinuities, and mixes the two with a hand-drawn diagonal wipe.
   So a style change is just new uniforms, and a switch between styles never pops.
   If WebGL2 is missing, XP.glRenderer returns { supported: false } and the SVG renderer is used. */
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
    'layout(location=2) in vec3 iPos; layout(location=3) in vec3 iScale; layout(location=4) in vec2 iMG; layout(location=5) in float iId;\n' +
    'uniform vec3 uR, uDn, uD, uC; uniform float uZoom; uniform vec2 uVB; uniform vec3 uMap; uniform vec2 uCss; uniform float uDR;\n' +
    'out vec3 vN; flat out vec2 vMG; flat out float vId;\n' +
    'void main(){\n' +
    '  vec3 w = aPos * iScale + iPos, q = w - uC;\n' +
    // exactly XP.project: viewBox px, then "meet" into the canvas (CSS px), then clip space
    '  float sx = uVB.x * 0.5 + dot(uR, q) * uZoom, sy = uVB.y * 0.5 + dot(uDn, q) * uZoom;\n' +
    '  vec2 c = vec2(uMap.y + sx * uMap.x, uMap.z + sy * uMap.x);\n' +
    '  gl_Position = vec4(c.x / uCss.x * 2.0 - 1.0, 1.0 - c.y / uCss.y * 2.0, clamp(-dot(uD, q) / uDR, -1.0, 1.0), 1.0);\n' +
    '  vN = normalize(aNrm / max(abs(iScale), vec3(1e-4)) * sign(iScale + 1e-9));\n' +
    '  vMG = iMG; vId = iId;\n' +
    '}';
  var GEO_FS = '#version 300 es\nprecision highp float;\n' +
    'in vec3 vN; flat in vec2 vMG; flat in float vId;\n' +
    'layout(location=0) out vec4 o0; layout(location=1) out vec4 o1;\n' +
    'void main(){\n' +
    '  o0 = vec4(vMG.x / 255.0, vMG.y, 0.0, 1.0);\n' +
    '  o1 = vec4(normalize(vN) * 0.5 + 0.5, fract(vId * 0.6180339 + 0.13));\n' +
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
    '// the geometry buffer at a device-pixel position',
    'struct G { float mat; float glow; vec3 n; float id; float z; };',
    'G fetchG(vec2 px){',
    '  ivec2 ip = ivec2(clamp(px, vec2(0.5), uRes - 0.5));        // texelFetch, not texture(): no filtering, so Direct3D keeps loops and branches',
    '  vec4 a = texelFetch(uT0, ip, 0), b = texelFetch(uT1, ip, 0);',
    '  G g; g.mat = floor(a.r * 255.0 + 0.5); g.glow = a.g; g.n = normalize(b.xyz * 2.0 - 1.0 + 1e-6); g.id = b.a; g.z = texelFetch(uDepth, ip, 0).r;',
    '  return g;',
    '}',
    '',
    '// is there an edge between c and a sample s at distance r px? returns silhouette, sets crease',
    'float disc(G c, vec2 px, float r, out float crease){',
    '  crease = 0.0;',
    '  ivec2 ip = ivec2(clamp(px, vec2(0.5), uRes - 0.5));',
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
    'vec2 edgeRing(vec2 px, float r, G c){',
    '  if (!nearBounds(px, uPartBounds, r)) return vec2(0.0);',
    '  float sil = 0.0, cr = 0.0, k;',
    '  for (int i = 0; i < 8 * uN; i++){ float a = float(i) * 0.7853982 + 0.39;',
    '    sil = max(sil, disc(c, px + vec2(cos(a), sin(a)) * r, r, k)); cr = max(cr, k); }',
    '  return vec2(sil, cr);',
    '}',
    '// Share the two soft outline rings and pooling; keep the double stroke separate to preserve depth-threshold rounding.',
    'vec2 styleEdges(int s, vec2 px, vec2 fp, float seed, bool fill){',
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
    '    if (j != 1) center = fetchG(q); // the two soft outline rings have the same center',
    '    vec2 v = edgeRing(q, rr, center);',
    '    if (j == 0) first = v;',
    '    else if (j == 1) e = 0.5 * (max(first.x, first.y * uCrease[s]) + max(v.x, v.y * uCrease[s]));',
    '    else pool = max(v.x, v.y * 0.5);',
    '  }',
    '  if (uOutA[s] > 0.0 && uDouble[s] > 0.0){',
    '    vec2 q = px + (vec2(vnoise(px / 23.0 + seed + 5.1), vnoise(px / 23.0 + seed + 41.7)) - 0.5) * 2.4 * uWobble[s] * uScale;',
    '    vec2 e3 = edgeRing(q, r * 0.7, fetchG(q));',
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
    '  if (uOutA[s] > 0.0 || (g.mat > 0.5 && uPool[s] > 0.0)) ed = styleEdges(s, px, fp, seed, g.mat > 0.5);',
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
    '    float h = 0.0, ws = 0.0, jit = ign(px + 17.0) * 6.2832;',
    '    for (int i = 0; i < 24 * uN; i++){ float fi = float(i) + 0.5, a = fi * 2.39996 + jit, rr = sqrt(fi / 24.0) * 20.0 * uScale;',
    '      float wt = exp(-rr * rr / (2.0 * 81.0 * uScale * uScale));',
    '      h += texelFetch(uT0, ivec2(clamp(px + vec2(cos(a), sin(a)) * rr, vec2(0.5), uRes - 0.5)), 0).g * wt; ws += wt; }',
    '    h = clamp(h / ws * 2.2, 0.0, 1.0) * (1.0 - g.glow);             // a halo around the part, not over it',
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
    '  float e = mix(-0.06, 1.06, uMix) + (vnoise(vec2(along * 16.0, floor(uTime * 6.0))) - 0.5) * 0.012 + (vnoise(vec2(along * 3.0, 4.0)) - 0.5) * 0.01;',
    '  float m = smoothstep(e - 0.004, e + 0.004, w);                    // 1 = style A side',
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
    /* the style shader is big, and on Windows the driver compiles it through Direct3D, which can take a second or more.
       With { async: true } and KHR_parallel_shader_compile the compile runs in the background: render() draws nothing
       until it is done, and onReady(fn) says when. Without the extension, or without async, it waits here. */
    var geo, comp, qg = startProgram(gl, GEO_VS, GEO_FS), qc = startProgram(gl, FS_VS, COMP_FS);
    var par = opts.async ? gl.getExtension('KHR_parallel_shader_compile') : null, ready = false, failed = false, waiters = [];
    function settle() {
      try { geo = finish(gl, qg); comp = finish(gl, qc); ready = true; }
      catch (err) { failed = true; if (window.console) console.warn(err.message); }
      var w = waiters; waiters = []; w.forEach(function (fn) { fn(ready); });
    }
    if (!par) { settle(); if (failed) return off; }
    else (function poll() {
      if (gl.isContextLost()) { failed = true; return; }
      if (gl.getProgramParameter(qg.p, par.COMPLETION_STATUS_KHR) && gl.getProgramParameter(qc.p, par.COMPLETION_STATUS_KHR)) settle();
      else setTimeout(poll, 16);
    })();

    /* meshes → vertex buffers (fan-triangulated convex faces, flat normals), one VAO each */
    var meshes = {}, STRIDE = 9;
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
      for (var k = 2; k <= 5; k++) { gl.enableVertexAttribArray(k); gl.vertexAttribDivisor(k, 1); }
      gl.bindVertexArray(null);
      return (meshes[m.id] = { vao: vao, count: a.length / 6 });
    }

    /* the off-screen geometry buffer */
    var fbo = null, tex0, tex1, texD, bw = 0, bh = 0, cssW = 0, cssH = 0, dpr = 1;
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
      tex1 = makeTex(gl.RGBA, gl.RGBA8, gl.UNSIGNED_BYTE);
      texD = makeTex(gl.DEPTH_COMPONENT, gl.DEPTH_COMPONENT24, gl.UNSIGNED_INT);
      fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex0, 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, tex1, 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, texD, 0);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
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
    function uploadStyles() {
      var A = styleOf(cur.a), B = styleOf(cur.b), u = comp.u, pal = [];
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
        g.list.push({ p: p, i: i }); n++;
        extendBounds(partBounds, p, B, C, k, ox, oy);
        if (p.glow > 0) extendBounds(glowBounds, p, B, C, k, ox, oy);
        var s = typeof p.scale === 'number' ? [p.scale, p.scale, p.scale] : p.scale, m = p.mesh;
        var c = XP.partCenter(p), rad = 0.5 * Math.hypot((m.hi[0] - m.lo[0]) * s[0], (m.hi[1] - m.lo[1]) * s[1], (m.hi[2] - m.lo[2]) * s[2]);
        R = Math.max(R, Math.abs(XP.v.dot(B.d, XP.v.sub(c, C.center))) + rad);
      });
      R *= 1.05;
      if (instData.length < n * STRIDE) instData = new Float32Array(Math.ceil(n * 1.5) * STRIDE);
      var o = 0;
      order.forEach(function (g) {
        g.start = o / STRIDE;
        g.list.forEach(function (e) {
          var p = e.p, s = typeof p.scale === 'number' ? [p.scale, p.scale, p.scale] : p.scale;
          instData[o++] = p.pos[0]; instData[o++] = p.pos[1]; instData[o++] = p.pos[2];
          instData[o++] = s[0]; instData[o++] = s[1]; instData[o++] = s[2];
          instData[o++] = XP.matIndex(p.mat); instData[o++] = p.glow || 0; instData[o++] = e.i + 1;
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
        gl.drawArraysInstanced(gl.TRIANGLES, 0, M.count, g.list.length);
      });
      gl.bindVertexArray(null);

      // pass 2: style composite
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, bw, bh);
      gl.disable(gl.DEPTH_TEST);
      gl.useProgram(comp.p);
      u = comp.u;
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex0); gl.uniform1i(u.uT0, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tex1); gl.uniform1i(u.uT1, 1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, texD); gl.uniform1i(u.uDepth, 2);
      gl.uniform2f(u.uRes, bw, bh); gl.uniform1i(u.uN, 1); gl.uniform1f(u.uScale, dpr); gl.uniform1f(u.uTime, t);
      gl.uniform1f(u.uMix, cur.mix); gl.uniform1f(u.uWipeAng, cur.wipe * Math.PI / 180);
      gl.uniform1f(u.uWpp, 1 / (C.zoom * k * dpr)); gl.uniform1f(u.uD2W, 2 * R);
      gl.uniform3fv(u.uLight, XP.LIGHT); gl.uniform3fv(u.uView, B.d); gl.uniform3fv(u.uRgt, B.r); gl.uniform3fv(u.uDown, B.dn);
      gl.uniform4fv(u.uPartBounds, partBounds); gl.uniform4fv(u.uGlowBounds, glowBounds);
      uploadStyles();
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    resize();
    function setScale(x) { if (x === scale) return; scale = x; resize(); }
    function release() { var l = gl.getExtension('WEBGL_lose_context'); if (l) l.loseContext(); }
    function onReady(fn) { if (ready || failed) fn(ready); else waiters.push(fn); }
    return { supported: true, ready: function () { return ready; }, failed: function () { return failed; }, onReady: onReady, render: render, setStyles: setStyles, resize: resize, styles: XP.STYLES, gl: gl, state: cur,
      setScale: setScale, scale: function () { return scale; }, gpu: gpu, release: release };
  };
})();
