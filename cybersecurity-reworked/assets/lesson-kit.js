/* lesson-kit.js — shared interactive components for PCD lessons.
   Include near the end of <body> with: <script src="assets/lesson-kit.js"></script>
   Auto-inits: Mermaid (if present), highlight.js (if present), and any .lk-tabs[data-kit="tabs"].
   Programmatic API (call after this script loads):
     LessonKit.annotatedCode(sel, { lang, lines:[[code, explanation], ...] })
     LessonKit.stateExplorer(sel, { start, states:{ NAME:{ desc, to:[[trigger,target], ...] } } })
     LessonKit.stepper(sel, {
        title, sub, shared:{...}, watch:['x'],            // watch = shared keys to display
        threads:{ A:{ name:'P', steps:[ { label:'wait(S)', run:function(shared,local){ ... } } ] } },
        verdict:function(shared, allDone){ return { status:'ok'|'bad'|'', text:'...' }; }
     })
     // a step's run() may return false or 'block' to mean "blocked: do not advance".
   All components are keyboard-accessible and self-contained. */
(function (global) {
  'use strict';
  function $(sel) { return typeof sel === 'string' ? document.querySelector(sel) : sel; }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---- tabs (declarative) ---- */
  function initTabs(root) {
    var tabs = [].slice.call(root.querySelectorAll('.lk-tab'));
    var panels = [].slice.call(root.querySelectorAll('.lk-tabpanel'));
    if (!tabs.length) return;
    var list = root.querySelector('.lk-tablist'); if (list) list.setAttribute('role', 'tablist');
    function select(i) {
      tabs.forEach(function (t, j) {
        var on = i === j;
        t.setAttribute('role', 'tab'); t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1;
        if (panels[j]) panels[j].hidden = !on;
      });
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(i); });
      t.addEventListener('keydown', function (e) {
        var n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : -1;
        if (n < 0) return; e.preventDefault(); n = (n + tabs.length) % tabs.length; select(n); tabs[n].focus();
      });
    });
    select(0);
  }

  /* ---- annotated code ---- */
  function annotatedCode(sel, opts) {
    var host = $(sel); if (!host || !opts || !opts.lines) return;
    host.classList.add('lk-acode'); host.innerHTML = '';
    var codeWrap = el('div', 'lk-ac-code');
    var expl = el('div', 'lk-ac-expl', (opts.lines[0] && opts.lines[0][1]) || 'Seleziona una riga per la spiegazione.');
    var btns = [];
    opts.lines.forEach(function (ln, i) {
      var b = el('button', 'lk-ac-line', ln[0] != null ? ln[0] : '');
      b.type = 'button'; b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () {
        btns.forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        expl.textContent = ln[1] != null ? ln[1] : '';
      });
      btns.push(b); codeWrap.appendChild(b);
    });
    host.appendChild(codeWrap); host.appendChild(expl);
  }

  /* ---- state explorer ---- */
  function stateExplorer(sel, opts) {
    var host = $(sel); if (!host || !opts || !opts.states) return;
    host.classList.add('lk-se'); host.innerHTML = '';
    var names = Object.keys(opts.states);
    var grid = el('div', 'lk-se-grid'); grid.setAttribute('role', 'group');
    var panel = el('div', 'lk-se-panel');
    var curLine = el('p', 'lk-se-cur'); curLine.innerHTML = 'Stato corrente: <b></b>';
    var curB = curLine.querySelector('b');
    var title = el('h4'), desc = el('p'), transLbl = el('strong', null, 'Transizioni in uscita:');
    transLbl.style.fontSize = '.85rem';
    var trans = el('ul', 'lk-se-trans');
    panel.appendChild(curLine); panel.appendChild(title); panel.appendChild(desc); panel.appendChild(transLbl); panel.appendChild(trans);
    var nodes = {};
    names.forEach(function (name) {
      var b = el('button', 'lk-se-node', name); b.type = 'button'; b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () { select(name); });
      grid.appendChild(b); nodes[name] = b;
    });
    function setCurrent(name) { curB.textContent = name; names.forEach(function (n) { nodes[n].classList.toggle('lk-se-current', n === name); }); }
    function select(name) {
      var s = opts.states[name]; if (!s) return;
      names.forEach(function (n) { nodes[n].setAttribute('aria-pressed', n === name ? 'true' : 'false'); });
      title.textContent = name; desc.textContent = s.desc || ''; trans.innerHTML = '';
      var to = s.to || [];
      if (!to.length) { var li = el('li', null, 'Nessuna: stato finale.'); li.style.color = 'var(--lk-muted)'; trans.appendChild(li); }
      to.forEach(function (tr) {
        var li = el('li'); var btn = el('button'); btn.type = 'button';
        btn.innerHTML = '<code></code> &rarr; <strong></strong>';
        btn.querySelector('code').textContent = tr[0]; btn.querySelector('strong').textContent = tr[1];
        btn.addEventListener('click', function () { setCurrent(tr[1]); select(tr[1]); });
        li.appendChild(btn); trans.appendChild(li);
      });
    }
    host.appendChild(grid); host.appendChild(panel);
    var start = opts.start && opts.states[opts.start] ? opts.start : names[0];
    setCurrent(start); select(start);
  }

  /* ---- step simulator ---- */
  function stepper(sel, opts) {
    var host = $(sel); if (!host || !opts || !opts.threads) return;
    host.classList.add('lk-step'); host.innerHTML = '';
    var keys = Object.keys(opts.threads);
    if (opts.title) host.appendChild(el('h4', null, opts.title));
    if (opts.sub) host.appendChild(el('p', 'lk-step-sub', opts.sub));
    var cols = el('div', 'lk-step-cols'); var insLists = {};
    keys.forEach(function (k) {
      var th = opts.threads[k];
      var box = el('div', 'lk-step-th');
      box.appendChild(el('h5', null, th.name || k));
      var ul = el('ul', 'lk-step-ins');
      (th.steps || []).forEach(function (s) { ul.appendChild(el('li', null, s.label != null ? s.label : '')); });
      box.appendChild(ul); cols.appendChild(box); insLists[k] = ul;
    });
    host.appendChild(cols);
    var stateBar = el('div', 'lk-step-state'); host.appendChild(stateBar);
    var verdict = el('div', 'lk-step-verdict'); host.appendChild(verdict);
    var btns = el('div', 'lk-step-btns'); var stepBtns = {};
    keys.forEach(function (k) {
      var b = el('button', null, 'Passo ' + (opts.threads[k].name || k)); b.type = 'button';
      b.addEventListener('click', function () { doStep(k); });
      btns.appendChild(b); stepBtns[k] = b;
    });
    var rs = el('button', 'lk-step-reset', 'Reset'); rs.type = 'button'; rs.addEventListener('click', reset); btns.appendChild(rs);
    host.appendChild(btns);

    var S, local;
    function reset() { S = clone(opts.shared || {}); local = {}; keys.forEach(function (k) { local[k] = { pc: 0, blocked: false, lcl: {} }; }); render(); }
    function doStep(k) {
      var t = local[k], steps = opts.threads[k].steps || [];
      if (t.pc >= steps.length) return;
      var r = steps[t.pc].run ? steps[t.pc].run(S, t.lcl) : undefined;
      if (r === false || r === 'block') { t.blocked = true; } else { t.blocked = false; t.pc++; }
      render();
    }
    function render() {
      keys.forEach(function (k) {
        var t = local[k], steps = opts.threads[k].steps || [], lis = insLists[k].children;
        for (var i = 0; i < lis.length; i++) lis[i].className = t.pc > i ? 'done' : (t.pc === i ? (t.blocked ? 'blocked' : 'on') : '');
        stepBtns[k].disabled = t.pc >= steps.length;
      });
      stateBar.innerHTML = '';
      (opts.watch || Object.keys(S)).forEach(function (key) {
        var box = el('div', 'lk-step-box'); box.innerHTML = key + ' = <b></b>';
        box.querySelector('b').textContent = S[key]; stateBar.appendChild(box);
      });
      var allDone = keys.every(function (k) { return local[k].pc >= (opts.threads[k].steps || []).length; });
      var v = opts.verdict ? opts.verdict(S, allDone) : null;
      verdict.className = 'lk-step-verdict' + (v && v.status ? ' ' + v.status : '');
      verdict.textContent = v && v.text ? v.text : (allDone ? 'Esecuzione completata.' : 'Scegli quale processo far avanzare.');
    }
    reset();
  }

  function initAll(root) {
    root = root || document;
    if (global.mermaid && typeof global.mermaid.initialize === 'function') {
      try { global.mermaid.initialize({ startOnLoad: true, theme: 'neutral' }); } catch (e) {}
    }
    if (global.hljs && typeof global.hljs.highlightAll === 'function') { try { global.hljs.highlightAll(); } catch (e) {} }
    [].slice.call(root.querySelectorAll('.lk-tabs[data-kit="tabs"]')).forEach(initTabs);
  }

  global.LessonKit = { annotatedCode: annotatedCode, stateExplorer: stateExplorer, stepper: stepper, tabs: initTabs, init: initAll };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { initAll(); });
  else initAll();
})(window);
