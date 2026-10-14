/* ledger.js — the course's prediction ledger.
   Three components, all progressive enhancement over plain HTML (without JS the answers are simply shown):

   1. Sealed predictions
      <div class="pred" data-id="u1-seed-sd">
        <div class="pred-q"><p>Question…</p></div>
        <ol class="pred-opts"><li>0.0003</li><li data-ok>0.003</li>…</ol>
        <div class="pred-why"><p>Why…</p><p class="pred-src">Measured by …</p></div>
      </div>
      Pick an option and a confidence, lock it, then reveal. Nothing can be changed after locking.

   2. Audit drills: a fictional research log, then "what would you challenge?"
      <div class="drill" data-id="u1-d1" data-title="Short title">
        <div class="drill-log">…</div>
        <p class="drill-q">…</p>
        <ul class="drill-opts"><li data-ok><span>A real problem</span><div class="why">…</div></li>
                               <li><span>A red herring</span><div class="why">…</div></li></ul>
        <div class="drill-why">…</div>
      </div>

   3. The ledger page: <div id="ledger"></div> lists every locked prediction and checked drill, with calibration.

   4. Predictions inside films: an explainer-kit film (assets/xp/xp-time.js) stops at each tl.ask and sends the answer
      as an 'xp-ask' event. Answers land here like a locked and revealed prediction (the film shows the answer right
      away); a film whose questions are already in the ledger doesn't stop for them again.

   State lives in localStorage under one key, per browser. Export / import moves it between devices.
   Every storage access is wrapped: in a private window the components still work, they just forget. */
(function () {
  'use strict';
  var KEY = 'alchemy.ledger.v1';
  var CONFS = [50, 70, 90];

  function load() {
    try { var s = JSON.parse(localStorage.getItem(KEY) || '{}'); s.preds = s.preds || {}; s.drills = s.drills || {}; return s; }
    catch (e) { return { preds: {}, drills: {} }; }
  }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private mode: keep going */ } }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function text(node) { return node ? node.textContent.replace(/\s+/g, ' ').trim() : ''; }
  function page() { return location.pathname.split('/').pop() || 'index.html'; }
  function pageTitle() { var h = document.querySelector('h1'); return h ? text(h) : document.title; }
  var uid = 0;

  /* ---------- 1. sealed predictions ---------- */
  function initPred(box) {
    var id = box.getAttribute('data-id');
    if (!id) return;
    var q = box.querySelector('.pred-q'), ol = box.querySelector('.pred-opts'), why = box.querySelector('.pred-why');
    if (!ol) return;
    var name = 'pred-' + (++uid);
    var items = [].slice.call(ol.children);
    var okIdx = items.findIndex(function (li) { return li.hasAttribute('data-ok'); });

    var head = el('div', 'pred-head');
    head.appendChild(el('span', 'pred-tag', 'Predict'));
    var state = el('span', 'pred-state', '');
    head.appendChild(state);
    box.insertBefore(head, box.firstChild);

    var radios = items.map(function (li, i) {
      var lab = el('label'), inp = el('input'), span = el('span'), mark = el('span', 'mark');
      inp.type = 'radio'; inp.name = name; inp.value = String(i);
      while (li.firstChild) span.appendChild(li.firstChild);
      lab.appendChild(inp); lab.appendChild(span); lab.appendChild(mark);
      li.appendChild(lab);
      return inp;
    });

    var conf = el('div', 'pred-conf');
    conf.appendChild(el('span', null, 'How sure are you?'));
    var confs = CONFS.map(function (c) {
      var lab = el('label'), inp = el('input');
      inp.type = 'radio'; inp.name = name + '-c'; inp.value = String(c);
      lab.appendChild(inp); lab.appendChild(document.createTextNode(c + '%'));
      conf.appendChild(lab);
      return inp;
    });
    ol.parentNode.insertBefore(conf, ol.nextSibling);

    var act = el('div', 'pred-act');
    var lockB = el('button', null, 'Lock my prediction'); lockB.type = 'button';
    var showB = el('button', null, 'Reveal the answer'); showB.type = 'button';
    var reset = el('button', 'pred-reset', 'start over'); reset.type = 'button';
    act.appendChild(lockB); act.appendChild(showB); act.appendChild(reset);
    conf.parentNode.insertBefore(act, conf.nextSibling);

    function current() {
      var c = radios.findIndex(function (r) { return r.checked; });
      var k = confs.findIndex(function (r) { return r.checked; });
      return { c: c, k: k };
    }
    function render() {
      var S = load(), rec = S.preds[id], cur = current();
      var locked = !!rec, shown = !!(rec && rec.revealed);
      box.classList.toggle('locked', locked);
      box.classList.toggle('revealed', shown);
      radios.forEach(function (r, i) { r.disabled = locked; if (locked) r.checked = rec.choice === i; });
      confs.forEach(function (r, i) { r.disabled = locked; if (locked) r.checked = CONFS[i] === rec.conf; });
      items.forEach(function (li, i) {
        var chosen = locked ? rec.choice === i : radios[i].checked;
        li.classList.toggle('chosen', chosen);
        li.classList.toggle('ok', shown && i === okIdx);
        li.classList.toggle('miss', shown && chosen && i !== okIdx);
        var m = li.querySelector('.mark');
        m.textContent = !shown ? '' : i === okIdx ? (chosen ? 'your pick · answer' : 'answer') : chosen ? 'your pick' : '';
      });
      lockB.hidden = locked; showB.hidden = !locked || shown;
      lockB.disabled = cur.c < 0 || cur.k < 0;
      reset.hidden = !locked;
      state.textContent = !locked ? (cur.c < 0 ? 'pick an answer and a confidence, then lock it' : cur.k < 0 ? 'now a confidence' : 'ready to lock')
        : !shown ? 'locked at ' + rec.conf + '% · reveal when ready'
        : (rec.ok ? 'right' : 'wrong') + ' at ' + rec.conf + '% · in your ledger';
    }
    radios.concat(confs).forEach(function (r) { r.addEventListener('change', render); });
    lockB.addEventListener('click', function () {
      var cur = current(); if (cur.c < 0 || cur.k < 0) return;
      var S = load();
      S.preds[id] = { q: text(q).slice(0, 220), page: page(), title: pageTitle(), choice: cur.c, choiceText: text(items[cur.c].querySelector('span')),
                      conf: CONFS[cur.k], ok: cur.c === okIdx, okText: okIdx >= 0 ? text(items[okIdx].querySelector('span')) : '', locked: Date.now(), revealed: 0 };
      save(S); render();
    });
    showB.addEventListener('click', function () {
      var S = load(); if (!S.preds[id]) return;
      S.preds[id].revealed = Date.now(); save(S); render();
    });
    reset.addEventListener('click', function () {
      var S = load(); delete S.preds[id]; save(S);
      radios.concat(confs).forEach(function (r) { r.checked = false; });
      render();
    });
    box.classList.add('ready');
    render();
  }

  /* ---------- 2. audit drills ---------- */
  function initDrill(box) {
    var id = box.getAttribute('data-id');
    if (!id) return;
    var ul = box.querySelector('.drill-opts');
    if (!ul) return;
    var head = el('div', 'drill-head');
    head.appendChild(el('span', 'drill-tag', 'Audit drill'));
    head.appendChild(el('span', 'drill-title', box.getAttribute('data-title') || ''));
    head.appendChild(el('span', 'drill-fic', 'fictional log, written for this course'));
    box.insertBefore(head, box.firstChild);

    var items = [].slice.call(ul.children);
    var boxes = items.map(function (li) {
      var lab = el('label'), inp = el('input'), mark = el('span', 'mark');
      var body = li.querySelector('span') || li.firstChild;
      inp.type = 'checkbox';
      li.insertBefore(lab, li.firstChild);
      lab.appendChild(inp); if (body) lab.appendChild(body); lab.appendChild(mark);
      return inp;
    });
    var btns = el('div', 'w-btns');
    var check = el('button', null, 'Check my audit'); check.type = 'button';
    var score = el('span', 'drill-score', '');
    var reset = el('button', 'pred-reset', 'start over'); reset.type = 'button';
    btns.appendChild(check); btns.appendChild(score); btns.appendChild(reset);
    ul.parentNode.insertBefore(btns, ul.nextSibling);

    function render() {
      var S = load(), rec = S.drills[id], done = !!rec;
      box.classList.toggle('checked', done);
      var hits = 0, real = 0, falses = 0;
      items.forEach(function (li, i) {
        var ok = li.hasAttribute('data-ok'), on = done ? rec.picked.indexOf(i) >= 0 : boxes[i].checked;
        boxes[i].disabled = done; if (done) boxes[i].checked = on;
        li.classList.remove('hit', 'missed', 'false', 'skip');
        var m = li.querySelector('.mark'); m.textContent = '';
        if (ok) real++;
        if (!done) return;
        if (ok && on) { li.classList.add('hit'); m.textContent = 'caught'; hits++; }
        else if (ok) { li.classList.add('missed'); m.textContent = 'missed'; }
        else if (on) { li.classList.add('false'); m.textContent = 'not the problem here'; falses++; }
        else { li.classList.add('skip'); m.textContent = 'rightly passed'; }
      });
      check.hidden = done; reset.hidden = !done;
      score.textContent = done ? 'caught ' + hits + ' of ' + real + (falses ? ' · ' + falses + ' false alarm' + (falses > 1 ? 's' : '') : '') : '';
    }
    check.addEventListener('click', function () {
      var S = load(), picked = [], hits = 0, real = 0, falses = 0;
      items.forEach(function (li, i) {
        var ok = li.hasAttribute('data-ok');
        if (boxes[i].checked) picked.push(i);
        if (ok) real++; if (ok && boxes[i].checked) hits++; if (!ok && boxes[i].checked) falses++;
      });
      S.drills[id] = { title: box.getAttribute('data-title') || id, page: page(), picked: picked, hits: hits, real: real, falses: falses, at: Date.now() };
      save(S); render();
    });
    reset.addEventListener('click', function () {
      var S = load(); delete S.drills[id]; save(S);
      boxes.forEach(function (b) { b.checked = false; }); render();
    });
    box.classList.add('ready');
    render();
  }

  /* ---------- 3. the ledger page ---------- */
  function stat(k, v) { var d = el('div', 'w-stat'); d.appendChild(el('span', 'k', k)); d.appendChild(el('span', 'v', v)); return d; }
  function pct(a, b) { return b ? Math.round(100 * a / b) + '%' : '–'; }
  function initLedger(root) {
    function draw() {
      root.innerHTML = '';
      var S = load(), ids = Object.keys(S.preds), dids = Object.keys(S.drills);
      var shown = ids.filter(function (i) { return S.preds[i].revealed; });
      var right = shown.filter(function (i) { return S.preds[i].ok; }).length;
      var sum = el('div', 'ledger-sum');
      sum.appendChild(stat('predictions locked', String(ids.length)));
      sum.appendChild(stat('revealed', String(shown.length)));
      sum.appendChild(stat('right', shown.length ? right + ' · ' + pct(right, shown.length) : '–'));
      var dh = 0, dr = 0, df = 0;
      dids.forEach(function (i) { dh += S.drills[i].hits; dr += S.drills[i].real; df += S.drills[i].falses; });
      sum.appendChild(stat('audit catches', dr ? dh + ' of ' + dr : '–'));
      sum.appendChild(stat('false alarms', dids.length ? String(df) : '–'));
      root.appendChild(sum);

      // calibration: when you said 70%, were you right about 70% of the time?
      root.appendChild(el('h3', null, 'Calibration'));
      if (!shown.length) root.appendChild(el('p', 'ledger-empty', 'No revealed predictions yet. Lock a prediction in any unit, reveal it, and it appears here.'));
      else {
        var tw = el('div', 'tw'), t = el('table', 'ledger');
        t.innerHTML = '<tr><th>You said</th><th>Revealed</th><th>Right</th><th>Hit rate</th><th>Reading</th></tr>';
        CONFS.forEach(function (c) {
          var rows = shown.filter(function (i) { return S.preds[i].conf === c; });
          var r = rows.filter(function (i) { return S.preds[i].ok; }).length;
          var tr = el('tr'), hr = rows.length ? r / rows.length : null;
          var reading = rows.length < 5 ? 'too few to read' : hr < c / 100 - 0.15 ? 'overconfident' : hr > c / 100 + 0.15 ? 'underconfident' : 'about right';
          [c + '%', String(rows.length), String(r), rows.length ? pct(r, rows.length) : '–', reading].forEach(function (v, j) {
            var td = el('td', j && j < 4 ? 'r' : null, v); tr.appendChild(td);
          });
          t.appendChild(tr);
        });
        tw.appendChild(t); root.appendChild(tw);
      }

      root.appendChild(el('h3', null, 'Every prediction'));
      if (!ids.length) root.appendChild(el('p', 'ledger-empty', 'Nothing locked yet.'));
      else {
        var tw2 = el('div', 'tw'), t2 = el('table', 'ledger');
        t2.innerHTML = '<tr><th>Unit</th><th>Question</th><th>Your answer</th><th>Conf.</th><th>Result</th></tr>';
        ids.sort(function (a, b) { return S.preds[a].locked - S.preds[b].locked; }).forEach(function (i) {
          var p = S.preds[i], tr = el('tr');
          var a = el('a', null, p.title.replace(/^Unit\s+/i, '')); a.href = p.href || p.page + '#' + i;
          var td0 = el('td'); td0.appendChild(a); tr.appendChild(td0);
          tr.appendChild(el('td', null, p.q.length > 140 ? p.q.slice(0, 137) + '…' : p.q));
          tr.appendChild(el('td', null, p.choiceText));
          tr.appendChild(el('td', 'r', p.conf + '%'));
          tr.appendChild(p.revealed ? el('td', p.ok ? 'hit' : 'miss', p.ok ? 'right' : 'wrong · ' + p.okText) : el('td', null, 'sealed'));
          t2.appendChild(tr);
        });
        tw2.appendChild(t2); root.appendChild(tw2);
      }

      root.appendChild(el('h3', null, 'Audit drills'));
      if (!dids.length) root.appendChild(el('p', 'ledger-empty', 'No drills checked yet.'));
      else {
        var tw3 = el('div', 'tw'), t3 = el('table', 'ledger');
        t3.innerHTML = '<tr><th>Drill</th><th>Caught</th><th>False alarms</th></tr>';
        dids.forEach(function (i) {
          var d = S.drills[i], tr = el('tr'), a = el('a', null, d.title); a.href = d.page + '#' + i;
          var td = el('td'); td.appendChild(a); tr.appendChild(td);
          tr.appendChild(el('td', 'r', d.hits + ' of ' + d.real));
          tr.appendChild(el('td', 'r', String(d.falses)));
          t3.appendChild(tr);
        });
        tw3.appendChild(t3); root.appendChild(tw3);
      }

      var tools = el('div', 'ledger-tools');
      var ex = el('button', null, 'Export ledger (JSON)'); ex.type = 'button';
      var imL = el('label', null, 'Import: '), im = el('input'); im.type = 'file'; im.accept = 'application/json,.json'; imL.appendChild(im);
      var clr = el('button', 'alt', 'Clear everything'); clr.type = 'button';
      tools.appendChild(ex); tools.appendChild(imL); tools.appendChild(clr);
      root.appendChild(tools);
      ex.addEventListener('click', function () {
        var blob = new Blob([JSON.stringify(load(), null, 1)], { type: 'application/json' });
        var a = el('a'); a.href = URL.createObjectURL(blob); a.download = 'alchemy-ledger.json';
        document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      });
      im.addEventListener('change', function () {
        var f = im.files && im.files[0]; if (!f) return;
        var r = new FileReader();
        r.onload = function () {
          try {
            var inc = JSON.parse(r.result), S = load();
            Object.keys(inc.preds || {}).forEach(function (k) { if (!S.preds[k] || (inc.preds[k].revealed && !S.preds[k].revealed)) S.preds[k] = inc.preds[k]; });
            Object.keys(inc.drills || {}).forEach(function (k) { if (!S.drills[k]) S.drills[k] = inc.drills[k]; });
            save(S); draw();
          } catch (e) { alert('That file is not a ledger export.'); }
        };
        r.readAsText(f);
      });
      clr.addEventListener('click', function () {
        if (!confirm('Clear every prediction and drill in this browser? This cannot be undone (export first if unsure).')) return;
        save({ preds: {}, drills: {} }); draw();
      });
    }
    draw();
  }

  /* ---------- 4. predictions inside films ---------- */
  document.addEventListener('xp-ask', function (e) {
    var d = e.detail || {}; if (!d.id || d.skipped || d.choice == null) return;
    var S = load(); if (S.preds[d.id]) return;                    // locked once, like the boxes
    var host = e.target && e.target.closest ? e.target.closest('[id]') : null;
    S.preds[d.id] = { q: String(d.question || '').slice(0, 220), page: page(), title: pageTitle(), href: page() + (host ? '#' + host.id : ''), film: d.film,
                      choice: d.choice, choiceText: String(d.answer || ''), conf: d.confidence || 50, ok: !!d.correct,
                      okText: d.right != null && d.options ? String(d.options[d.right]) : '', locked: Date.now(), revealed: Date.now() };
    save(S);
  });
  function seedFilms() {                                          // answers already in the ledger: the films don't ask again
    var films = window.XP && window.XP.films; if (!films) return;
    var S = load();
    Object.keys(S.preds).forEach(function (id) {
      var p = S.preds[id], f = p.film && films[p.film];
      if (f && f.answer) f.answer(id, p.choice, p.conf);
    });
  }

  function init() {
    seedFilms();
    [].forEach.call(document.querySelectorAll('.pred'), initPred);
    [].forEach.call(document.querySelectorAll('.drill'), initDrill);
    var L = document.getElementById('ledger'); if (L) initLedger(L);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.AlchemyLedger = { load: load, KEY: KEY };
})();
