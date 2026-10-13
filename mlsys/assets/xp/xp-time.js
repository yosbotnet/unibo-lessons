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
    var S = o.scene, tl = o.tl, total = o.total || tl.duration;
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
    var svgR = XP.svgRenderer(svg, S), glR = null, canvas = null;
    if (o.gl !== false && XP.glRenderer) {
      canvas = document.createElement('canvas');
      stage.appendChild(canvas);
      try { glR = XP.glRenderer(canvas, S, {}); } catch (e) { glR = null; }
      if (!glR || !glR.supported) { canvas.remove(); canvas = null; glR = null; }
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
    var mode = glR ? 'gl' : 'svg';
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
      (glR ? '<span class="xp-menu-w"><button type="button" class="b-style" title="Style" aria-label="Style" aria-haspopup="true" aria-expanded="false">' + ICON.style + '</button>' +
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

    /* sound: one <audio> per voice line, kept in step with T (the film clock stays the master) */
    var sound = false, clips = [];
    if (hasVoice) tl.lines.forEach(function (l) { if (l.src) { var au = new Audio(l.src); au.preload = 'auto'; clips.push({ l: l, au: au }); } });
    function setSound(on) {
      sound = !!on && hasVoice;
      if (soundBtn) { soundBtn.innerHTML = sound ? ICON.snd : ICON.mute; soundBtn.setAttribute('aria-pressed', String(sound)); soundBtn.setAttribute('aria-label', sound ? 'Mute' : 'Sound'); }
      syncAudio();
    }
    function syncAudio() {
      clips.forEach(function (c) {
        var local = T - c.l.t0, on = sound && playing && local >= 0 && local < c.l.dur + 0.4;
        if (!on) { if (!c.au.paused) c.au.pause(); return; }
        if (c.au.paused) { try { c.au.currentTime = local; } catch (e) {} c.au.play().catch(function () {}); }
        else if (Math.abs(c.au.currentTime - local) > 0.18) c.au.currentTime = local;
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

    function draw() {
      tl.apply(T, S);
      var useSvg = !glR || forced === 'svg';
      stage.setAttribute('data-renderer', useSvg ? 'svg' : 'gl');
      if (useSvg) svgR.render();
      else {
        var st = forced ? { a: forced, b: forced, mix: 0 } : (o.styleAt ? o.styleAt(T) : { a: 'ink', b: 'ink', mix: 0 });
        glR.setStyles(st.a, st.b, st.mix, st.wipe);
        glR.render(T);
      }
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
      syncAudio();
    }
    function setPlaying(on) {
      playing = on && !calm;
      if (playing && !started) { started = true; T = 0; }          // leave the poster frame: films start at the start
      playBtn.innerHTML = playing ? ICON.pause : ICON.play; playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play'); playBtn.title = (playing ? 'Pause' : 'Play') + ' (Space)';
      card.classList.toggle('playing', playing);
      wake(); kick(); syncAudio(); if (!frame) draw();
    }
    function tick(now) {
      var dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60; last = now;
      if (playing) { T += dt; if (T >= total) { if (o.loop !== false && !hasVoice) T = 0; else { T = total; setPlaying(false); } } }
      draw();
      frame = visible && playing ? requestAnimationFrame(tick) : 0;
    }
    function kick() { if (!frame && visible && playing) { last = 0; frame = requestAnimationFrame(tick); } }
    function seek(t) { started = true; T = Math.max(0, Math.min(total, t)); draw(); }
    function goBeat(i) { i = Math.max(0, Math.min(beatsOf.length - 1, i)); var b = beatsOf[i]; seek(calm && b.still != null ? b.still : b.t + 0.01); }
    function toggle(showFlash) {
      if (hasVoice && !playing && !host.dataset.heard) { host.dataset.heard = '1'; setSound(true); }   // the first play is the gesture that allows sound
      if (!playing && T >= total - 0.05) T = 0;
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
    new IntersectionObserver(function (es) {
      var was = visible; visible = es[es.length - 1].isIntersecting;
      if (visible && !was && !calm && autoplay && !host.dataset.started) { host.dataset.started = '1'; setPlaying(true); }
      if (!visible && playing && hasVoice) setPlaying(false);       // scrolled away: a narrator should not keep talking off screen
      if (visible) kick();
    }, { rootMargin: '0px 0px -10% 0px' }).observe(stage);
    var lastW = 0;
    if (window.ResizeObserver) new ResizeObserver(function () { if (stage.clientWidth === lastW) return; lastW = stage.clientWidth; if (glR) glR.resize(); if (!playing) draw(); }).observe(stage);
    setPlaying(false);
    draw();

    var api = { card: card, export: function (on) { card.classList.toggle('export', on !== false); }, setTime: function (t, style) { forced = style || ''; started = true; T = t; setPlaying(false); draw(); }, total: total, beats: tl.beats, renderer: function () { return glR ? 'gl' : 'svg'; }, play: function () { setPlaying(true); }, draw: draw,
      lines: function () { return (tl.lines || []).map(function (l) { return { id: l.id, text: l.text, t0: l.t0, dur: l.dur }; }); },
      audio: function () { return (tl.lines || []).filter(function (l) { return l.src; }).map(function (l) { return { src: new URL(l.src, location.href).href, t0: l.t0 }; }); } };
    XP.films = XP.films || {};
    XP.films[o.id || host.id || 'film'] = api;
    return api;
  };
})();
