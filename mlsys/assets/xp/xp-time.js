/* xp-time.js — time for the explainer kit.
   XP.timeline(): Manim-like authoring (play / with / wait / beat / set), evaluated as a pure function
   of t: apply(t) resets the scene, then runs every animation that has started, in order, with its
   eased progress. Any t can be drawn directly, so one source gives the interactive player, review
   stills and a frame-stepped MP4 (scripts/render.js).
   XP.player(host, opts): the card, renderers (SVG always, GL when available), captions from beats,
   play/pause, scrub, beat chips, keys while focused, autoplay in view, reduced motion, export hooks. */
(function () {
  'use strict';
  var XP = window.XP;

  XP.timeline = function (o) {
    o = o || {};
    var tl = { cursor: 0, anims: [], beats: [], duration: 0, reset: o.reset || function () {}, clock: o.clock || null };
    function push(a) { tl.anims.push(a); tl.duration = Math.max(tl.duration, a.t0 + a.dur); return a; }
    // play(dur, fn(p, S, t, local), {ease, at}) — runs after the previous step (or at an absolute time)
    tl.play = function (dur, fn, opt) {
      opt = opt || {};
      var a = push({ t0: opt.at != null ? opt.at : tl.cursor, dur: Math.max(1e-6, dur), fn: fn, ease: opt.ease || XP.ease.inOut });
      tl.last = a; if (opt.at == null) tl.cursor = a.t0 + dur;
      return tl;
    };
    // with(dur, fn) — starts together with the previous play (Manim's AnimationGroup)
    tl.with = function (dur, fn, opt) {
      opt = opt || {};
      var t0 = (tl.last ? tl.last.t0 : tl.cursor) + (opt.delay || 0);
      var a = push({ t0: t0, dur: Math.max(1e-6, dur), fn: fn, ease: opt.ease || XP.ease.inOut });
      tl.cursor = Math.max(tl.cursor, a.t0 + a.dur);
      return tl;
    };
    tl.wait = function (d) { tl.cursor += d; tl.duration = Math.max(tl.duration, tl.cursor); return tl; };
    tl.set = function (fn) { return tl.play(1e-6, function (p, S, t) { fn(S, t); }, { ease: XP.ease.linear }); };
    // a story beat: a title and a line of narration, shown from now until the next beat
    tl.beat = function (title, say, extra) { var b = { t: tl.cursor, title: title, say: say || '' }; for (var k in extra) b[k] = extra[k]; tl.beats.push(b); return tl; };
    tl.at = function (t) { tl.cursor = t; return tl; };

    /* Voice. say(id, spoken, {show, gap}) puts a narration line at the cursor and advances by its
       length: the recorded clip's when a voice manifest has it (XP.VOICE[film], written by
       scripts/voice.js), else an estimate from the text, so a film works before any audio exists.
       cue(id, word, nth) is the moment that word is spoken, for pinning animations to the voice. */
    var VO = o.voice || null, RATE = o.rate || 14.6;      // estimated characters per second (Will ≈ 14.6)
    tl.lines = []; tl.voiced = false;
    function norm(w) { return w.replace(/^[^\w]+|[^\w]+$/g, ''); }
    tl.say = function (id, spoken, opt) {
      opt = opt || {};
      var rec = VO && VO.lines && VO.lines[id], t0 = tl.cursor, words = [], dur;
      if (rec && rec.text === spoken) {
        tl.voiced = true;
        rec.words.forEach(function (w) { words.push({ w: w[0], s: t0 + w[1], e: t0 + w[2] }); });
        dur = rec.dur;
      } else {
        var re = /\S+/g, m;
        while ((m = re.exec(spoken))) words.push({ w: m[0], s: t0 + m.index / RATE, e: t0 + (m.index + m[0].length) / RATE });
        dur = spoken.length / RATE + 0.3;
      }
      var line = { id: id, text: spoken, show: opt.show || null, t0: t0, dur: dur, words: words, src: rec && rec.text === spoken ? rec.src : null };
      tl.lines.push(line);
      tl.cursor = t0 + dur + (opt.gap != null ? opt.gap : 0.35);
      tl.duration = Math.max(tl.duration, tl.cursor);
      return tl;
    };
    tl.line = function (id) { for (var i = 0; i < tl.lines.length; i++) if (tl.lines[i].id === id) return tl.lines[i]; throw new Error('no line ' + id); };
    tl.cue = function (id, word, nth) {
      var L = tl.line(id), n = nth || 1, i, k = 0; word = norm(word);   // 'board.' and 'board' are the same cue
      for (i = 0; i < L.words.length; i++) if (norm(L.words[i].w) === word && ++k === n) return L.words[i].s;
      k = 0; for (i = 0; i < L.words.length; i++) if (norm(L.words[i].w).toLowerCase() === word.toLowerCase() && ++k === n) return L.words[i].s;
      throw new Error('cue "' + word + '" not in line ' + id);
    };
    tl.end = function (id) { var L = tl.line(id); return L.t0 + L.dur; };
    tl.lineAt = function (t) { var r = null; for (var i = 0; i < tl.lines.length; i++) if (t >= tl.lines[i].t0 - 1e-6) r = tl.lines[i]; return r; };
    tl.apply = function (t, S) {
      tl.reset(S, t);
      for (var i = 0; i < tl.anims.length; i++) {
        var a = tl.anims[i];
        if (t < a.t0) continue;
        var lp = Math.min(1, (t - a.t0) / a.dur);
        a.fn(a.ease(lp), S, t, lp);
      }
    };
    tl.beatAt = function (t) { var k = 0; for (var i = 0; i < tl.beats.length; i++) if (t >= tl.beats[i].t - 1e-6) k = i; return k; };
    return tl;
  };

  /* XP.player(host, {
       fig, title, label, W, H, scene, tl, keys:[[cls,text]], caption (html),
       styleAt(t) → { a, b, mix }   (GL style schedule; optional),
       readout(t, S) → text,          stillAt (t for reduced motion), loop (bool), id (export key),
       posterAt (the frame behind the play button of a narrated film), autoplay (default: only silent films),
       gl: true|false (try the shader renderer), styles: names offered in the style picker })
     Everything you operate lives inside the frame, as on a video: click the picture to play or pause,
     subtitles at the bottom, a control bar that fades while the film plays, the acts as segments of the
     scrubber, and a lower-third title as each act begins. Below the card: only the legend and the caption. */
  var ICON = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.2v13.6L18.8 12z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.8 5h3.7v14H6.8zM13.5 5h3.7v14h-3.7z"/></svg>',
    snd: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.8 9.3h3.6L12 5.4v13.2l-4.6-3.9H3.8z"/><path class="ln" d="M15.4 9.1a4.1 4.1 0 0 1 0 5.8M17.9 6.6a7.6 7.6 0 0 1 0 10.8"/></svg>',
    mute: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.8 9.3h3.6L12 5.4v13.2l-4.6-3.9H3.8z"/><path class="ln" d="M15.8 9.6l4.8 4.8M20.6 9.6l-4.8 4.8"/></svg>',
    cc: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect class="ln" x="3.4" y="5.8" width="17.2" height="12.4" rx="2.6"/><path class="ln" d="M10.6 10.2a2.3 2.3 0 1 0 0 3.6M16.6 10.2a2.3 2.3 0 1 0 0 3.6"/></svg>',
    style: '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="ln" d="M12 3.6a8.4 8.4 0 1 0 0 16.8c1.2 0 1.8-.8 1.8-1.7 0-1.2-1-1.4-1-2.5 0-1 .8-1.6 1.8-1.6h2.1a3.8 3.8 0 0 0 3.8-3.8C20.5 7 16.7 3.6 12 3.6z"/><circle cx="7.7" cy="11.4" r="1.3"/><circle cx="10.1" cy="7.6" r="1.3"/><circle cx="14.6" cy="7.6" r="1.3"/></svg>',
    fs: '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="ln" d="M4.5 9V4.5H9M15 4.5h4.5V9M19.5 15v4.5H15M9 19.5H4.5V15"/></svg>',
    fsx: '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="ln" d="M9 4.5V9H4.5M19.5 9H15V4.5M15 19.5V15h4.5M4.5 15H9v4.5"/></svg>'
  };
  var ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  function esc(x) { return String(x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  XP.player = function (host, o) {
    host.classList.add('xp');
    var tl = o.tl, total = o.total || tl.duration;
    /* shots: a film can cut between scenes. o.shots = [{ scene, at, tl, cut }] in film time (the first starts at 0).
       A shot's scene is driven by its own timeline (tl) when it has one, else by the film's. cut says how a shot comes in:
       { kind: 'zoom' | 'wipe' | 'dissolve' | 'cut', dur (s), focus (zoom: a world point or part of the OLD scene, default
       the middle), scale (zoom: how far the old frame grows; below 1 it shrinks, for a pull-back), angle (wipe, degrees) }.
       The old shot's last frame is frozen and laid over the new one while it starts (scaled, faded or wiped away), so a cut
       costs one extra frame, not a second renderer. Without o.shots a film is one shot of o.scene. Scenes share cam.W × H. */
    var shots = (o.shots || [{ scene: o.scene }]).map(function (s, i) { return { scene: s.scene, at: i ? s.at : 0, tl: s.tl || null, cut: s.cut || null, i: i }; });
    var S = shots[0].scene;
    function shotAt(t) { var k = 0; for (var i = 1; i < shots.length; i++) if (t >= shots[i].at - 1e-9) k = i; return shots[k]; }
    function applyShot(sh, t) { (sh.tl || tl).apply(t, sh.scene); }
    host.innerHTML = '';
    var card = document.createElement('div'); card.className = 'xp-card';
    card.className = 'xp-card xp-film';
    card.innerHTML = '<div class="xp-fig">' + (o.fig || '') + '</div><div class="xp-title">' + (o.title || '') + '</div>' +
      '<div class="xp-stage" tabindex="0" role="group"></div>';
    host.appendChild(card);
    var stage = card.querySelector('.xp-stage');
    stage.style.setProperty('--xp-ar', String((S.cam.W || 760) / (S.cam.H || 440)));
    stage.setAttribute('aria-label', o.label || o.title || 'Animated figure');
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', o.label || '');
    stage.appendChild(svg);
    var svgR = XP.svgRenderer(svg, S), glR = null, canvas = null, glOff = null;
    var snap = document.createElement('div'); snap.className = 'xp-snap'; snap.setAttribute('aria-hidden', 'true'); stage.appendChild(snap);
    var views = [{ scene: S, svg: svg, svgR: svgR }];               // one SVG renderer per scene, made when its shot first shows
    function viewOf(sc) {
      for (var i = 0; i < views.length; i++) if (views[i].scene === sc) return views[i];
      var e = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); e.setAttribute('class', 'xp-shot'); e.setAttribute('aria-hidden', 'true');
      stage.insertBefore(e, snap);
      var v = { scene: sc, svg: e, svgR: XP.svgRenderer(e, sc) }; views.push(v); return v;
    }
    /* WebGL starts late on purpose: when the film nears the screen, after the page has painted, and with the shader
       compiling in the background. Until it is ready the frame stays blank paper. Scripts (setTime) get it at once. */
    var glWant = o.gl !== false && !!XP.glRenderer, glWait = glWant;
    /* WebGPU (xp-gpu.js, when loaded) draws the same picture and never blocks on its compile. For now it is opt-in:
       ?webgpu, o.webgpu or window.XP_WEBGPU; ?gl forces WebGL. Scripts (setTime) always get WebGL: they need a frame at once. */
    var gpuWant = glWant && !!XP.gpuRenderer && !!navigator.gpu && !/[?&]gl\b/.test(location.search) &&
      (/[?&]webgpu\b/.test(location.search) || ((o.webgpu || window.XP_WEBGPU) && !navigator.webdriver));
    function startGL(now) {
      if (!glWait) return; glWait = false;
      canvas = document.createElement('canvas'); stage.insertBefore(canvas, svg.nextSibling);
      if (gpuWant && !now) {
        glR = XP.gpuRenderer(canvas, S, {});
        if (glR.supported) {
          Q.max = glR.scale();
          glR.onReady(function (ok) { if (ok) { draw(); perfText(); } else toGL(); });
          return;
        }
      }
      try { glR = XP.glRenderer(canvas, S, { async: !now && !navigator.webdriver }); } catch (e) { glR = null; }
      if (!glR || !glR.supported) { noGL(); draw(); return; }
      Q.max = glR.scale();
      glR.onReady(function (ok) { if (!ok) noGL(); draw(); perfText(); });
    }
    function toGL() {                                             // no WebGPU device, or it was lost: WebGL on a fresh canvas
      glOff = glR; glR = null; if (canvas) canvas.remove(); canvas = null; gpuWant = false; glWait = true; startGL(); draw();
    }
    function noGL() {                                             // no usable WebGL: the SVG renderer, and no style menu
      glOff = glR; glR = null; if (canvas) canvas.remove(); canvas = null;
      var w = card.querySelector('.xp-menu-w'); if (w) w.remove();
    }
    /* quality: while the film plays, watch the frame interval. When the GPU can't keep up (frames slow, but not
       because of our own JavaScript), draw fewer pixels: 2× → 1.5× → 1.25× → 1× → 0.75×. Climb back at most twice. */
    var Q = { steps: [0.75, 1, 1.25, 1.5, 2], ema: 0, js: 0, n: 0, since: 0, ups: 0, up: false, max: 1, box: null };
    if (/[?&]perf\b/.test(location.search)) { Q.box = document.createElement('div'); Q.box.className = 'xp-perf'; card.appendChild(Q.box); }
    function adapt(dtMs, jsMs) {
      if (dtMs == null || !glR || forced === 'svg' || window.XP_PIXEL_RATIO) return;
      if (++Q.n < 6) return;                                     // the first frames after a start include warm-up
      Q.ema = Q.ema ? Q.ema * 0.9 + dtMs * 0.1 : dtMs; Q.js = Q.js ? Q.js * 0.9 + jsMs * 0.1 : jsMs; Q.since++;
      var sc = glR.scale(), i = 0;
      Q.steps.forEach(function (x, k) { if (Math.abs(x - sc) < Math.abs(Q.steps[i] - sc)) i = k; });
      if (Q.ema > 26 && Q.ema - Q.js > 8 && Q.since > 20 && i > 0) { glR.setScale(Q.steps[i - 1]); if (Q.up) Q.ups = 9; reQ(); }
      else if (Q.ema < 18.5 && Q.since > 240 && Q.ups < 2 && i + 1 < Q.steps.length && Q.steps[i + 1] <= Q.max) { glR.setScale(Q.steps[i + 1]); Q.ups++; Q.up = true; reQ(); }
    }
    function reQ() { Q.n = 0; Q.since = 0; Q.ema = 0; Q.js = 0; }
    function perfText() {
      if (!Q.box) return;
      var r = glR ? (glR.gpu || 'WebGL').replace(/^ANGLE \((.*)\)$/, '$1') + ' · ' + glR.scale() + '×' + (canvas ? ' · ' + canvas.width + '×' + canvas.height + ' px' : '')
        : 'SVG' + (glOff && glOff.software ? ' (software GPU: ' + glOff.gpu + ')' : '');
      Q.box.textContent = r + (Q.ema ? ' · ' + Q.ema.toFixed(1) + ' ms/frame · js ' + Q.js.toFixed(1) + ' ms' : '');
    }
    /* labels: HTML text pinned to 3D points (o.labels(t, S) → [{ p:[x,y,z], text, short, wide, cls, align: 'r'|'l', o }]), the same in both renderers */
    var labLayer = null, labEls = [];
    if (o.labels) { labLayer = document.createElement('div'); labLayer.className = 'xp-labels'; labLayer.setAttribute('aria-hidden', 'true'); stage.appendChild(labLayer); }
    function drawLabels() {
      if (!labLayer) return;
      var narrow = stage.clientWidth < 520;                    // phones: short forms, and drop labels marked wide-only
      var items = (o.labels(T, S) || []).filter(function (it) { return !(narrow && it.wide); }), B = XP.basis(S.cam), k = stage.clientWidth / S.cam.W;
      while (labEls.length < items.length) { var e = document.createElement('span'); labLayer.appendChild(e); labEls.push(e); }
      labEls.forEach(function (e, i) {
        var it = items[i];
        if (!it) { e.style.display = 'none'; return; }
        var q = XP.project(S.cam, it.p, B);
        e.style.display = ''; e.className = 'xp-label' + (it.cls ? ' ' + it.cls : '');
        var txt = narrow && it.short ? it.short : it.text;
        if (e.textContent !== txt) e.textContent = txt;
        e.style.transform = 'translate(' + (q[0] * k).toFixed(1) + 'px,' + (q[1] * k).toFixed(1) + 'px) translate(' + (it.align === 'r' ? '-100%' : it.align === 'l' ? '0' : '-50%') + ',-50%)';
        e.style.opacity = it.o == null ? '' : String(it.o);
      });
    }
    var mode = glWant ? 'gl' : 'svg';
    stage.setAttribute('data-renderer', mode);
    var hasVoice = !!(tl.lines && tl.lines.some(function (l) { return l.src; }));
    var styleNames = o.styles || (XP.STYLES ? Object.keys(XP.STYLES) : []);
    var beatsOf = tl.beats.length ? tl.beats : [{ t: 0, title: o.title || '' }];

    /* in the picture: the live readout, the act's lower-third, subtitles, the big play button, a flash on toggle */
    var over = document.createElement('div'); over.className = 'xp-over';
    over.innerHTML = '<div class="xp-live" aria-hidden="true"></div>' +
      '<div class="xp-act" aria-hidden="true"><small></small><span></span></div>' +
      '<button type="button" class="xp-big" aria-label="Play' + (hasVoice ? ' with sound' : '') + '">' + ICON.play +
        '<span><b>Play</b>' + (hasVoice ? ' with sound' : '') + ' · <i>' + mmss(total) + '</i></span></button>' +
      '<div class="xp-flash" aria-hidden="true"></div>';
    stage.appendChild(over);
    var subBox = document.createElement('div'); subBox.className = 'xp-sub'; subBox.setAttribute('aria-hidden', 'true'); subBox.innerHTML = '<span class="xp-sub-l"></span>';
    card.appendChild(subBox);                                        // overlaid on the picture; on phones, a strip under it
    var readout = over.querySelector('.xp-live'), actEl = over.querySelector('.xp-act'), sub = subBox.firstChild,
      big = over.querySelector('.xp-big'), flash = over.querySelector('.xp-flash');

    /* the bar: play · the acts as scrubber segments · time · sound · subtitles · style · full screen */
    var bar = document.createElement('div'); bar.className = 'xp-bar';
    var canFs = !!(card.requestFullscreen && document.fullscreenEnabled);
    bar.innerHTML = '<button type="button" class="b-play" title="Play (Space)" aria-label="Play">' + ICON.play + '</button>' +
      '<div class="xp-scrub" role="slider" tabindex="0" aria-label="Time" aria-valuemin="0" aria-valuemax="' + Math.round(total) + '">' +
        '<div class="segs">' + beatsOf.map(function (b, i) {
          var d = (i + 1 < beatsOf.length ? beatsOf[i + 1].t : total) - b.t;
          return '<i style="flex-grow:' + Math.max(d, 0.01).toFixed(3) + '"><b></b></i>';
        }).join('') + '</div><div class="thumb"></div><div class="tip"></div></div>' +
      '<span class="time">0:00 / ' + mmss(total) + '</span><span class="now"></span>' +
      (hasVoice ? '<button type="button" class="b-snd" title="Sound (M)" aria-label="Sound" aria-pressed="false">' + ICON.mute + '</button>' : '') +
      '<button type="button" class="b-cc" title="Subtitles (C)" aria-label="Subtitles" aria-pressed="true">' + ICON.cc + '</button>' +
      (glWant ? '<span class="xp-menu-w"><button type="button" class="b-style" title="Style" aria-label="Style" aria-haspopup="true" aria-expanded="false">' + ICON.style + '</button>' +
        '<div class="xp-menu" role="menu" hidden>' + [['', 'As directed']].concat(styleNames.map(function (n) { return [n, n]; }), [['svg', 'svg (fallback)']]).map(function (m) {
          return '<button type="button" role="menuitemradio" data-s="' + m[0] + '" aria-checked="' + (m[0] === '') + '">' + m[1] + '</button>'; }).join('') + '</div></span>' : '') +
      (canFs ? '<button type="button" class="b-fs" title="Full screen (F)" aria-label="Full screen">' + ICON.fs + '</button>' : '');
    card.appendChild(bar);
    var playBtn = bar.querySelector('.b-play'), scrub = bar.querySelector('.xp-scrub'), segEls = [].slice.call(scrub.querySelectorAll('.segs i')),
      thumb = scrub.querySelector('.thumb'), tip = scrub.querySelector('.tip'), timeEl = bar.querySelector('.time'), nowEl = bar.querySelector('.now'),
      soundBtn = bar.querySelector('.b-snd'), ccBtn = bar.querySelector('.b-cc'), styleBtn = bar.querySelector('.b-style'), menu = bar.querySelector('.xp-menu'),
      fsBtn = bar.querySelector('.b-fs');

    /* below the card: only what belongs to the figure */
    if (o.keys) {
      var lg = document.createElement('div'); lg.className = 'xp-keys';
      lg.innerHTML = o.keys.map(function (k) { return '<span><i class="k-' + k[0] + '"></i>' + k[1] + '</span>'; }).join('');
      host.appendChild(lg);
    }
    var live = document.createElement('div'); live.className = 'xp-sr'; live.setAttribute('aria-live', 'polite'); host.appendChild(live);
    if (o.caption) { var cap = document.createElement('p'); cap.className = 'xp-cap'; cap.innerHTML = o.caption; host.appendChild(cap); }

    var forced = '', calm = XP.still(), playing = false, started = false, lastBeat = -1, visible = false, frame = 0, last = 0;
    var autoplay = o.autoplay != null ? o.autoplay : !hasVoice;      // a narrated film waits on its poster: it never starts silently
    var T = calm ? (o.stillAt != null ? o.stillAt : 0) : (hasVoice && o.posterAt != null ? o.posterAt : 0);
    if (calm || !hasVoice) started = true;
    try { if (localStorage.getItem('xp-cc') === '0') card.classList.add('nocc'); } catch (e) {}
    ccBtn.setAttribute('aria-pressed', String(!card.classList.contains('nocc')));

    /* sound: Web Audio, and the sound is the clock. Voice clips are decoded once and scheduled on the
       audio timeline; while the film plays with sound, T is read back from what the speakers are playing,
       so a slow frame drops a frame instead of cutting the voice. An optional score (o.score, see
       references/api.md) plays under the voice and ducks while a line is spoken. */
    var sound = false, clips = [], AU = null, hasScore = typeof o.score === 'function';
    if (hasVoice) tl.lines.forEach(function (l) { if (l.src) clips.push({ l: l, p: null, buf: null, dead: false }); });
    var DEC = null;
    function load(c) {                                            // fetch and decode one clip, once. An offline context decodes without a gesture,
      if (c.p) return c.p;                                        // so the opening lines are ready before anyone presses play
      if (!DEC) { var O = window.OfflineAudioContext || window.webkitOfflineAudioContext; DEC = O ? new O(1, 1, 48000) : null; }
      if (!DEC) { c.dead = true; return (c.p = Promise.resolve()); }
      return (c.p = fetch(c.l.src).then(function (r) { if (!r.ok) throw r.status; return r.arrayBuffer(); })
        .then(function (ab) { return new Promise(function (ok, no) { DEC.decodeAudioData(ab, ok, no); }); })
        .then(function (b) { c.buf = b; }, function () { c.dead = true; })
        .then(function () { if (AU && AU.run) voiceAt(c); }));
    }
    function prefetch(n) {                                        // the n lines nearest where the film will start, one after another
      var from = started ? T : 0;
      clips.slice().sort(function (a, b) { return Math.abs(a.l.t0 - from) - Math.abs(b.l.t0 - from); }).slice(0, n)
        .reduce(function (p, c) { return p.then(function () { return load(c); }); }, Promise.resolve());
    }
    function audio() {                                            // made inside the first play gesture
      if (AU) { if (AU.ctx.state !== 'running') AU.ctx.resume(); return AU; }
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}   // iOS: play with the ringer switch off
      var ctx = new AC({ latencyHint: 'playback' }), A = AU = { ctx: ctx, run: false, gate: null, srcs: [] };
      A.master = ctx.createGain(); A.master.connect(ctx.destination);
      A.voice = ctx.createGain(); A.voice.connect(A.master);
      A.duck = ctx.createGain(); A.duck.gain.value = 0; A.duck.connect(A.master);
      if (hasScore) { A.sc = scoreOn(ctx, A.duck); A.ev = (A.sc.events || []).slice().sort(function (a, b) { return a[0] - b[0]; }); }
      prefetch(clips.length);
      return A;
    }
    // the score's own graph: K.out persists (drones, pads); K.tone and K.noise are one-shots on the current gate, cut on pause or seek
    function scoreOn(ctx, out) {
      var nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), nd = nb.getChannelData(0);
      for (var i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      var K = { ctx: ctx, out: ctx.createGain(), bus: null };
      K.out.gain.value = o.scoreGain != null ? o.scoreGain : 1; K.out.connect(out);
      function dest() { return K.bus || K.out; }
      K.tone = function (when, f, dur, vol, type, f2) {
        var os = ctx.createOscillator(), g = ctx.createGain();
        os.type = type || 'sine'; os.frequency.setValueAtTime(f, when);
        if (f2) os.frequency.exponentialRampToValueAtTime(f2, when + dur);
        g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(vol, when + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
        os.connect(g); g.connect(dest()); os.start(when); os.stop(when + dur + 0.05);
      };
      K.noise = function (when, dur, vol, f0, f1, q) {
        var sr = ctx.createBufferSource(); sr.buffer = nb; sr.loop = true;
        var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q || 1.2;
        bp.frequency.setValueAtTime(f0, when); if (f1) bp.frequency.exponentialRampToValueAtTime(f1, when + dur);
        var g = ctx.createGain(); g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(vol, when + Math.min(0.05, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
        sr.connect(bp); bp.connect(g); g.connect(dest()); sr.start(when); sr.stop(when + dur + 0.05);
      };
      var sc = o.score(K) || {}; sc.K = K; return sc;
    }
    // the duck: the score dips under every spoken line, planned ahead on the audio timeline
    function duckPlan(g, fromT, at, now) {
      var lo = o.duck != null ? o.duck : 0.3, inLine = (tl.lines || []).some(function (l) { return fromT >= l.t0 - 0.25 && fromT < l.t0 + l.dur; });
      g.cancelScheduledValues(0); g.setValueAtTime(inLine ? lo : 1, now);
      (tl.lines || []).forEach(function (l) {
        if (l.t0 + l.dur <= fromT) return;
        if (l.t0 - 0.25 > fromT) g.setTargetAtTime(lo, at(l.t0 - 0.25), 0.08);
        g.setTargetAtTime(1, at(l.t0 + l.dur + 0.1), 0.4);
      });
    }
    function heard() {                                            // the context time the speakers are playing right now
      var ctx = AU.ctx, ts = ctx.getOutputTimestamp ? ctx.getOutputTimestamp() : null;
      if (ts && ts.performanceTime > 0) return ts.contextTime + (performance.now() - ts.performanceTime) / 1000;
      return ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0);
    }
    function at(t) { return AU.c0 + (t - AU.t0); }
    function voiceAt(c) {
      if (!c.buf || !AU.run) return;
      var now = AU.ctx.currentTime + 0.02, w = at(c.l.t0), off = Math.max(0, now - w);
      if (off >= c.buf.duration) return;
      var s = AU.ctx.createBufferSource(); s.buffer = c.buf; s.connect(AU.gate.v); s.start(Math.max(w, now), off); AU.srcs.push(s);
    }
    function ready() { return clips.every(function (c) { return c.buf || c.dead || c.l.t0 + c.l.dur <= T || c.l.t0 > T + 1; }); }
    // (re)lay the audio timeline from T: on play, pause, seek and mute. Never touched while the film simply plays.
    function relay(hush) {
      var A = AU; if (!A) return;
      var ctx = A.ctx, now = ctx.currentTime, go = playing && sound && !hush && ready();
      A.srcs.forEach(function (s) { try { s.stop(); } catch (e) {} }); A.srcs = [];
      if (A.gate) { var old = A.gate; old.v.gain.setTargetAtTime(0, now, 0.015); old.e.gain.setTargetAtTime(0, now, 0.015); setTimeout(function () { old.v.disconnect(); old.e.disconnect(); }, 250); }
      A.gate = null; A.run = go; A.dirty = false;
      if (A.sc) A.sc.K.bus = null;
      if (!go) { A.duck.gain.cancelScheduledValues(0); A.duck.gain.setTargetAtTime(0, now, 0.05); return; }
      A.gate = { v: ctx.createGain(), e: ctx.createGain() }; A.gate.v.connect(A.voice);
      A.c0 = now + 0.08; A.t0 = T;
      clips.forEach(voiceAt);
      if (A.sc) {
        A.gate.e.connect(A.sc.K.out); A.sc.K.bus = A.gate.e;
        if (A.sc.at) A.sc.at(T, now, 'set');
        A.ei = 0; while (A.ei < A.ev.length && A.ev[A.ei][0] < T) A.ei++;
        duckPlan(A.duck.gain, T, at, now);
      }
    }
    function scoreTick() {                                        // continuous parameters follow T; one-shots are scheduled 0.4 s ahead
      var A = AU; if (!A || !A.run || !A.sc) return;
      var now = A.ctx.currentTime;
      if (A.sc.at) A.sc.at(T, now, 'glide');
      while (A.ei < A.ev.length && A.ev[A.ei][0] < T + 0.4) { var w = at(A.ev[A.ei][0]); if (w > now - 0.03) A.ev[A.ei][1](Math.max(w, now)); A.ei++; }
    }
    function setSound(on) {
      sound = !!on && hasVoice;
      if (sound) audio();
      if (soundBtn) { soundBtn.innerHTML = sound ? ICON.snd : ICON.mute; soundBtn.setAttribute('aria-pressed', String(sound)); soundBtn.setAttribute('aria-label', sound ? 'Mute' : 'Sound'); }
      relay();
    }
    // the score alone, rendered offline (mono WAV, base64) for render.js, which mixes the voice clips on top
    function scoreWav(sr) {
      if (!hasScore) return Promise.resolve(null);
      sr = sr || 44100;
      var ctx = new OfflineAudioContext(1, Math.ceil(total * sr), sr), duck = ctx.createGain(); duck.connect(ctx.destination);
      var sc = scoreOn(ctx, duck), ev = sc.events || [];
      if (sc.at) { sc.at(0, 0, 'set'); for (var t = 0.05; t <= total; t += 0.05) sc.at(t, t, 'ramp'); }
      ev.forEach(function (e) { e[1](e[0]); });
      duckPlan(duck.gain, 0, function (t) { return Math.max(0, t); }, 0);
      return ctx.startRendering().then(function (buf) {
        var d = buf.getChannelData(0), n = d.length, ab = new ArrayBuffer(44 + n * 2), v = new DataView(ab);
        function str(q, x) { for (var i = 0; i < x.length; i++) v.setUint8(q + i, x.charCodeAt(i)); }
        str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
        v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 2, true);
        for (var i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 32767, true);
        var bytes = new Uint8Array(ab), bin = '';
        for (i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        return btoa(bin);
      });
    }

    /* subtitles: the spoken line, each word lit as it is said; a silent film shows its beat's text */
    var curLine = null, curSub = null, wordEls = [];
    function subtitle() {
      if (tl.lines && tl.lines.length) {
        var L = tl.lineAt(T);
        if (L && T > L.t0 + L.dur + 0.9) L = null;                // the line has been said: clear the screen until the next
        if (L !== curLine) {
          curLine = L; wordEls = []; sub.textContent = '';
          if (L) {
            L.words.forEach(function (w) { var sp = document.createElement('span'); sp.className = 'xp-w'; sp.textContent = w.w; sub.appendChild(sp); sub.appendChild(document.createTextNode(' ')); wordEls.push(sp); });
            live.textContent = L.text;
          }
          sub.parentNode.classList.toggle('on', !!L);
        }
        if (L) L.words.forEach(function (w, i) { wordEls[i].className = T >= w.e ? 'xp-w past' : (T >= w.s ? 'xp-w on' : 'xp-w'); });
        return;
      }
      var b = tl.beats[tl.beatAt(T)], txt = b ? b.say : '';
      if (txt !== curSub) { curSub = txt; sub.innerHTML = txt || ''; sub.parentNode.classList.toggle('on', !!txt); if (b) live.textContent = b.title + '. ' + sub.textContent; }
    }
    function mmss(t) { var s = Math.max(0, Math.floor(t)); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
    function segOf(t) { var k = 0; for (var i = 0; i < beatsOf.length; i++) if (t >= beatsOf[i].t - 1e-6) k = i; return k; }
    function segEnd(i) { return i + 1 < beatsOf.length ? beatsOf[i + 1].t : total; }

    /* cuts: while a shot's cut plays, the previous shot's last frame (frozen once, at the cut) lies over the new shot */
    var snapKey = '', snapEl = null, snapInk = null, snapFocus = [0.5, 0.5], snapRect = null;
    function styleNow(t) { return forced ? { a: forced, b: forced, mix: 0 } : (o.styleAt ? o.styleAt(t) : { a: 'ink', b: 'ink', mix: 0 }); }
    function cutAt(sh, t) {
      var c = sh.cut; if (!sh.i || !c || c.kind === 'cut' || !(c.dur > 0)) return null;
      var p = (t - sh.at) / c.dur; return p < 1 ? { prev: shots[sh.i - 1], c: c, p: XP.clamp(p, 0, 1) } : null;
    }
    function freeze(tr, at, gl) {
      var prev = tr.prev, key = prev.i + '|' + (gl ? 'gl ' + canvas.width + 'x' + canvas.height : 'svg') + '|' + forced + '|' + stage.clientWidth;
      if (key === snapKey && snapEl) return; snapKey = key;
      var t = at - 1e-3; applyShot(prev, t);
      if (snapEl) snapEl.remove();
      if (gl) {
        var st = styleNow(t); glR.setScene(prev.scene); glR.setStyles(st.a, st.b, st.mix, st.wipe); glR.render(t);
        snapEl = document.createElement('canvas'); snapEl.width = canvas.width; snapEl.height = canvas.height;
        snapEl.getContext('2d').drawImage(canvas, 0, 0);            // same task as the render, so the drawing buffer is still there
      } else {
        var v = viewOf(prev.scene); v.svgR.render(); snapEl = v.svg.cloneNode(true); snapEl.setAttribute('class', 'xp-svg'); snapEl.style.visibility = '';   // keeps the material styles, drops xp-shot
      }
      snap.insertBefore(snapEl, snap.firstChild);
      var f = tr.c.focus, C = prev.scene.cam, q = !f ? [C.W / 2, C.H / 2] : XP.project(C, Array.isArray(f) ? f : XP.partCenter(f));
      snapFocus = [q[0] / C.W, q[1] / C.H];
      snapRect = f ? XP.screenRect(C, f) : null;                     // where the focus sat in the frozen frame (viewBox px)
    }
    function paintCut(tr) {
      snap.style.display = tr && snapEl ? 'block' : '';
      if (labLayer) labLayer.style.opacity = tr ? String(XP.ease.smooth(XP.clamp((tr.p - 0.45) / 0.55, 0, 1))) : '';   // the new shot's labels arrive late
      if (!tr || !snapEl) return;
      var c = tr.c, e = XP.ease.inOut(tr.p), x = snapEl.style;
      x.transform = ''; x.opacity = ''; x.clipPath = ''; x.maskImage = ''; x.webkitMaskImage = '';
      if (snapInk) snapInk.style.display = 'none';
      if (c.kind === 'dissolve') x.opacity = String(1 - e);
      else if (c.kind === 'zoom' && c.to && snapRect) {            // match cut: the old focus rides on the new scene's `to`, frame by frame
        var r1 = XP.screenRect(S.cam, c.to), r0 = snapRect, k = stage.clientWidth / S.cam.W;
        var sc = Math.sqrt(Math.max(1e-6, (r1[2] - r1[0]) * (r1[3] - r1[1])) / Math.max(1e-6, (r0[2] - r0[0]) * (r0[3] - r0[1])));
        var tx = ((r1[0] + r1[2]) / 2 - sc * (r0[0] + r0[2]) / 2) * k, ty = ((r1[1] + r1[3]) / 2 - sc * (r0[1] + r0[3]) / 2) * k;
        x.transformOrigin = '0 0'; x.transform = 'translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px) scale(' + sc.toFixed(4) + ')';
        // and closes in on the focus, so a shrinking frame never shows its edges
        var g = XP.lerp(2.0, 1.15, XP.ease.smooth(XP.clamp(tr.p / 0.4, 0, 1))), CW0 = S.cam.W, CH0 = S.cam.H;
        var m = 'radial-gradient(ellipse ' + ((r0[2] - r0[0]) / CW0 * 50 * g).toFixed(1) + '% ' + ((r0[3] - r0[1]) / CH0 * 50 * g).toFixed(1) + '% at '
          + ((r0[0] + r0[2]) / CW0 * 50).toFixed(1) + '% ' + ((r0[1] + r0[3]) / CH0 * 50).toFixed(1) + '%, #000 72%, transparent 100%)';
        x.webkitMaskImage = m; x.maskImage = m;
        x.opacity = String(1 - XP.ease.smooth(XP.clamp((tr.p - 0.1) / 0.65, 0, 1)));
      } else if (c.kind === 'zoom') {                               // the old frame keeps diving (or pulling back) and fades
        x.transformOrigin = (snapFocus[0] * 100).toFixed(2) + '% ' + (snapFocus[1] * 100).toFixed(2) + '%';
        x.transform = 'scale(' + Math.pow(c.scale || 3, e).toFixed(4) + ')';
        x.opacity = String(1 - XP.ease.smooth(XP.clamp((tr.p - 0.15) / 0.7, 0, 1)));
      } else if (c.kind === 'wipe') {                               // a hand-drawn edge sweeps the old frame away, like the style wipe
        var W = stage.clientWidth, H = stage.clientHeight, a = (c.angle == null ? 35 : c.angle) * Math.PI / 180, d = [Math.cos(a), Math.sin(a)];
        var span = Math.abs(d[0]) * W + Math.abs(d[1]) * H, ex = XP.lerp(-0.06, 1.06, e), Lg = Math.hypot(W, H), n = 28, pts = [], seed = Math.floor(T * 6);
        var b0 = [W / 2 + d[0] * (ex - 0.5) * span, H / 2 + d[1] * (ex - 0.5) * span];
        for (var i = 0; i <= n; i++) {
          var u = (i / n - 0.5) * 2 * Lg, j = (XP.hash(i * 7 + seed * 131) - 0.5) * 2.4 + Math.sin(i * 0.9 + 1.3) * 1.6;
          pts.push([b0[0] - d[1] * u + d[0] * j, b0[1] + d[0] * u + d[1] * j]);
        }
        var poly = pts.concat([[pts[n][0] + d[0] * 2 * Lg, pts[n][1] + d[1] * 2 * Lg], [pts[0][0] + d[0] * 2 * Lg, pts[0][1] + d[1] * 2 * Lg]]);
        x.clipPath = 'polygon(' + poly.map(function (q) { return q[0].toFixed(1) + 'px ' + q[1].toFixed(1) + 'px'; }).join(',') + ')';
        if (!snapInk) {
          snapInk = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); snapInk.setAttribute('class', 'xp-snap-ink');
          snapInk.innerHTML = '<path fill="none" stroke="#1a1813" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>';
          snap.appendChild(snapInk);
        }
        snapInk.style.display = ''; snapInk.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        snapInk.firstChild.setAttribute('d', 'M' + pts.map(function (q) { return q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join('L'));
      }
    }

    function draw() {
      var sh = shotAt(T), tr = cutAt(sh, T);
      var useSvg = forced === 'svg' || (!glR && !glWait), glOK = !useSvg && glR && glR.ready() && !(glR.kind === 'webgpu' && glR.failed());
      if (tr && (useSvg || glOK)) freeze(tr, sh.at, glOK);
      S = sh.scene; applyShot(sh, T);
      var view = viewOf(S);
      views.forEach(function (v) { v.svg.style.visibility = v === view ? '' : 'hidden'; });
      stage.setAttribute('data-renderer', useSvg ? 'svg' : 'gl');
      if (useSvg) view.svgR.render();
      else if (glR && glR.kind === 'webgpu' && glR.failed()) toGL();
      else if (glR && glR.ready()) {
        var st = styleNow(T);
        glR.setScene(S); glR.setStyles(st.a, st.b, st.mix, st.wipe);
        var g0 = performance.now(); glR.render(T); glMs = performance.now() - g0;
      }
      paintCut(tr);
      drawLabels();
      if (o.readout) { var r = o.readout(T, S) || ''; if (readout.textContent !== r) readout.textContent = r; readout.classList.toggle('on', !!r); }
      card.classList.toggle('poster', !started);
      /* the scrubber: each act fills in turn */
      var si = segOf(T);
      segEls.forEach(function (e, i) { var f = i < si ? 1 : i > si ? 0 : XP.clamp((T - beatsOf[i].t) / Math.max(segEnd(i) - beatsOf[i].t, 1e-6), 0, 1); e.firstChild.style.width = (f * 100).toFixed(2) + '%'; e.classList.toggle('cur', i === si); });
      var se = segEls[si]; if (se) thumb.style.left = (se.offsetLeft + se.firstChild.offsetWidth) + 'px';
      scrub.setAttribute('aria-valuenow', String(Math.round(T)));
      scrub.setAttribute('aria-valuetext', mmss(T) + ' of ' + mmss(total) + (tl.beats.length ? ', ' + beatsOf[si].title : ''));
      timeEl.textContent = mmss(T) + ' / ' + mmss(total);
      /* the act: its name in the bar, and a lower-third for the first seconds of each act (pure in T, so exports show it too) */
      if (si !== lastBeat) {
        lastBeat = si; nowEl.textContent = tl.beats.length > 1 ? beatsOf[si].title : '';
        actEl.firstChild.textContent = tl.beats.length > 1 ? 'Act ' + (ROMAN[si] || si + 1) : ''; actEl.lastChild.textContent = tl.beats.length > 1 ? beatsOf[si].title : '';
      }
      var since = T - beatsOf[si].t;
      actEl.classList.toggle('on', tl.beats.length > 1 && started && !calm && since >= 0.15 && since < 3.2);
      subtitle();
    }
    function setPlaying(on) {
      playing = on && !calm;
      if (playing && !started) { started = true; T = 0; }          // leave the poster frame: films start at the start
      playBtn.innerHTML = playing ? ICON.pause : ICON.play; playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play'); playBtn.title = (playing ? 'Pause' : 'Play') + ' (Space)';
      card.classList.toggle('playing', playing);
      wake(); kick(); relay(); if (!frame) draw();
    }
    var glMs = 0;
    function tick(now) {
      var raw = last ? now - last : null, dt = raw != null ? Math.min(raw / 1000, 1 / 20) : 1 / 60; last = now;
      if (playing) {
        if (AU && sound) {                                        // the audio clock: T is what the speakers are playing
          if (AU.ctx.state !== 'running') { T += dt; AU.dirty = true; }   // no audio device yet: the wall clock, and re-lay when it wakes
          else {
            if (AU.dirty && !dragging) relay();
            if (!AU.run) { if (ready() && !dragging) relay(); }     // still decoding the next line: hold the picture, like a buffering video
            else T = Math.max(T, AU.t0 + Math.max(0, heard() - AU.c0));
          }
          scoreTick();
        } else T += dt;
        if (T >= total) { if (o.loop !== false && !hasVoice) T = 0; else { T = total; setPlaying(false); } }
      }
      var d0 = performance.now(); glMs = 0;
      draw();
      if (playing) { adapt(raw, performance.now() - d0 - glMs); if (Q.box && Q.n % 15 === 0) perfText(); }
      frame = visible && playing ? requestAnimationFrame(tick) : 0;
    }
    function kick() { if (!frame && visible && playing) { last = 0; Q.n = 0; frame = requestAnimationFrame(tick); } }
    function seek(t) { started = true; T = Math.max(0, Math.min(total, t)); if (AU) { if (dragging) { relay(true); AU.dirty = true; } else relay(); } draw(); }
    function goBeat(i) { i = Math.max(0, Math.min(beatsOf.length - 1, i)); var b = beatsOf[i]; seek(calm && b.still != null ? b.still : b.t + 0.01); }
    function toggle(showFlash) {
      if (hasVoice && !playing && !host.dataset.heard) { host.dataset.heard = '1'; setSound(true); }   // the first play is the gesture that allows sound
      if (!playing && T >= total - 0.05) T = 0;
      if (sound) audio();                                         // resume the context inside the gesture
      setPlaying(!playing);
      if (showFlash) { flash.innerHTML = playing ? ICON.play : ICON.pause; flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go'); }
    }

    /* the bar fades while the film plays and nobody is touching it */
    var idleTimer = 0;
    function wake() {
      card.classList.remove('idle'); clearTimeout(idleTimer);
      if (playing) idleTimer = setTimeout(function () {
        if (playing && !bar.contains(document.activeElement) && (!menu || menu.hidden) && !bar.matches(':hover')) card.classList.add('idle');
        else wake();
      }, 2200);
    }
    card.addEventListener('pointermove', wake);
    card.addEventListener('pointerleave', function (e) { if (playing && e.pointerType === 'mouse' && (!menu || menu.hidden)) { clearTimeout(idleTimer); card.classList.add('idle'); } });
    card.addEventListener('focusin', wake);

    /* the picture is the play button; on touch, the first tap only brings the bar back */
    stage.addEventListener('pointerup', function (e) {
      if (e.button || e.target.closest('.xp-big')) return;
      stage.focus({ preventScroll: true });
      if (e.pointerType === 'touch' && card.classList.contains('idle')) { wake(); return; }
      if (calm) return;
      toggle(true);
    });
    big.addEventListener('click', function () { stage.focus({ preventScroll: true }); toggle(false); });
    playBtn.addEventListener('click', function () { toggle(false); });
    if (soundBtn) soundBtn.addEventListener('click', function () { host.dataset.heard = '1'; setSound(!sound); });
    function setCC(on) { card.classList.toggle('nocc', !on); ccBtn.setAttribute('aria-pressed', String(on)); try { localStorage.setItem('xp-cc', on ? '1' : '0'); } catch (e) {} }
    ccBtn.addEventListener('click', function () { setCC(card.classList.contains('nocc')); });
    if (styleBtn) {
      var openMenu = function (on) { menu.hidden = !on; styleBtn.setAttribute('aria-expanded', String(on)); if (on) (menu.querySelector('[aria-checked="true"]') || menu.firstChild).focus(); wake(); };
      styleBtn.addEventListener('click', function () { openMenu(menu.hidden); });
      menu.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        forced = b.dataset.s; [].forEach.call(menu.children, function (m) { m.setAttribute('aria-checked', String(m === b)); });
        styleBtn.classList.toggle('set', !!forced); openMenu(false); styleBtn.focus(); draw();
      });
      menu.addEventListener('keydown', function (e) {
        var items = [].slice.call(menu.children), i = items.indexOf(document.activeElement);
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus(); e.preventDefault(); e.stopPropagation(); }
        else if (e.key === 'Escape') { openMenu(false); styleBtn.focus(); e.stopPropagation(); }
      });
      document.addEventListener('pointerdown', function (e) { if (!menu.hidden && !e.target.closest('.xp-menu-w')) openMenu(false); });
    }
    if (fsBtn) {
      fsBtn.addEventListener('click', function () { if (document.fullscreenElement === card) document.exitFullscreen(); else card.requestFullscreen().catch(function () {}); });
      document.addEventListener('fullscreenchange', function () { var on = document.fullscreenElement === card; fsBtn.innerHTML = on ? ICON.fsx : ICON.fs; fsBtn.setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen'); wake(); });
    }

    /* the scrubber: drag anywhere, hover to see which act is where */
    function timeAtX(x) {
      for (var i = 0; i < segEls.length; i++) {
        var r = segEls[i].getBoundingClientRect(), nx = i + 1 < segEls.length ? segEls[i + 1].getBoundingClientRect().left : r.right;
        if (x < nx || i === segEls.length - 1) return beatsOf[i].t + XP.clamp((x - r.left) / Math.max(r.width, 1), 0, 1) * (segEnd(i) - beatsOf[i].t);
      }
      return 0;
    }
    var dragging = false;
    scrub.addEventListener('pointerdown', function (e) { dragging = true; scrub.setPointerCapture(e.pointerId); seek(timeAtX(e.clientX)); });
    scrub.addEventListener('pointermove', function (e) {
      var t = timeAtX(e.clientX), sr = scrub.getBoundingClientRect();
      if (dragging) seek(t);
      tip.textContent = (tl.beats.length > 1 ? beatsOf[segOf(t)].title + ' · ' : '') + mmss(t);
      tip.style.left = XP.clamp(e.clientX - sr.left, 0, sr.width) + 'px'; scrub.classList.add('hover');
    });
    scrub.addEventListener('pointerup', function () { dragging = false; });
    scrub.addEventListener('pointerleave', function () { if (!dragging) scrub.classList.remove('hover'); });
    scrub.addEventListener('keydown', function (e) {
      var si = segOf(T);
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') seek(T + 5);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') seek(T - 5);
      else if (e.key === 'PageDown') goBeat(si + 1);
      else if (e.key === 'PageUp') goBeat(si - 1);
      else if (e.key === 'Home') seek(0);
      else if (e.key === 'End') seek(total);
      else return;
      e.preventDefault(); e.stopPropagation(); wake();
    });

    /* keys, while the film has focus: Space/K play · ← → acts · J L five seconds · M sound · C subtitles · F full screen */
    card.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var onBtn = e.target.closest('button, .xp-menu'), si = segOf(T), k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if ((k === ' ' || k === 'Enter') && onBtn) return;
      if (k === ' ' || k === 'k') toggle(e.target === stage);
      else if (k === 'ArrowRight') goBeat(si + 1);
      else if (k === 'ArrowLeft') goBeat(T - beatsOf[si].t > 1.5 ? si : si - 1);
      else if (k === 'l') seek(T + 5);
      else if (k === 'j') seek(T - 5);
      else if (k === 'Home') seek(0);
      else if (k === 'm' && soundBtn) { host.dataset.heard = '1'; setSound(!sound); }
      else if (k === 'c') setCC(card.classList.contains('nocc'));
      else if (k === 'f' && fsBtn) fsBtn.click();
      else return;
      e.preventDefault(); wake();
    });
    if (calm) { playBtn.disabled = true; card.classList.add('calm'); }
    if (glWant && window.IntersectionObserver) {
      var near = new IntersectionObserver(function (es) {
        if (!es[es.length - 1].isIntersecting) return;
        near.disconnect(); requestAnimationFrame(function () { setTimeout(startGL, 0); });
      }, { rootMargin: '400px 0px' });
      near.observe(stage);
    } else if (glWant) startGL();
    new IntersectionObserver(function (es) {
      var was = visible; visible = es[es.length - 1].isIntersecting;
      if (visible && !was && !calm && autoplay && !host.dataset.started) { host.dataset.started = '1'; setPlaying(true); }
      if (!visible && playing && hasVoice) setPlaying(false);       // scrolled away: a narrator should not keep talking off screen
      if (visible) { kick(); if (hasVoice) prefetch(3); }
    }, { rootMargin: '0px 0px -10% 0px' }).observe(stage);
    var lastW = 0;
    if (window.ResizeObserver) new ResizeObserver(function () { if (stage.clientWidth === lastW) return; lastW = stage.clientWidth; if (glR) glR.resize(); if (!playing) draw(); }).observe(stage);
    setPlaying(false);
    draw(); perfText();

    var api = { card: card, export: function (on) { card.classList.toggle('export', on !== false); }, time: function () { return T; }, setTime: function (t, style) { startGL(true); forced = style || ''; started = true; T = t; setPlaying(false); draw(); }, total: total, beats: tl.beats, renderer: function () { return glR ? (glR.kind || 'gl') : 'svg'; }, play: function () { setPlaying(true); }, draw: draw,
      lines: function () { return (tl.lines || []).map(function (l) { return { id: l.id, text: l.text, t0: l.t0, dur: l.dur }; }); },
      audio: function () { return (tl.lines || []).filter(function (l) { return l.src; }).map(function (l) { return { src: new URL(l.src, location.href).href, t0: l.t0 }; });  },
      score: scoreWav };
    XP.films = XP.films || {};
    XP.films[o.id || host.id || 'film'] = api;
    return api;
  };
})();
