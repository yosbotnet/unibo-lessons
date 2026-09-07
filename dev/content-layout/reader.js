/* Local, dependency-free presentation enhancement. No widget computations change. */
(function () {
  'use strict';
  if (window.NotesContentLayout) return;
  var pending = false, observed = new Map(), observer, resize;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; refresh(); });
  }
  function hasScrollOwner(table) {
    for (var p = table.parentElement; p && p !== document.body; p = p.parentElement) {
      if (p.matches('figure,.figure-table,.figure-diagram,.lk-content-scroll')) return true;
      if (/^(auto|scroll)$/.test(getComputedStyle(p).overflowX)) return true;
    }
    return false;
  }
  function refresh() {
    if (!document.body || !document.body.classList.contains('lk')) return;
    observed.forEach(function (wrapper, table) {
      if (!table.isConnected || !wrapper.isConnected) {
        resize.unobserve(table); resize.unobserve(wrapper); observed.delete(table);
      }
    });
    document.querySelectorAll('table').forEach(function (table) {
      if (hasScrollOwner(table)) return;
      var wrapper = document.createElement('div');
      wrapper.className = 'lk-content-scroll';
      table.before(wrapper); wrapper.appendChild(table);
    });
    document.querySelectorAll('.lk-content-scroll').forEach(function (wrapper) {
      var table = wrapper.querySelector('table');
      if (!table) return;
      if (resize && !observed.has(table)) { resize.observe(table); resize.observe(wrapper); observed.set(table, wrapper); }
      var overflow = wrapper.clientWidth > 0 && wrapper.scrollWidth > wrapper.clientWidth + 2;
      wrapper.classList.toggle('has-overflow', overflow);
      if (overflow) {
        wrapper.tabIndex = 0;
        wrapper.setAttribute('role', 'region');
        wrapper.setAttribute('aria-label', table.caption ? table.caption.textContent.trim() : 'Tabella scorribile / Scrollable table');
      } else {
        wrapper.removeAttribute('tabindex'); wrapper.removeAttribute('role'); wrapper.removeAttribute('aria-label');
      }
    });
    if (observer) observer.takeRecords(); // Do not loop on our own wrapper insertions.
  }
  function start() {
    if (!document.body.classList.contains('lk')) return;
    resize = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
    observer = new MutationObserver(schedule);
    observer.observe(document.body, {childList: true, subtree: true, characterData: true});
    refresh();
    window.addEventListener('resize', schedule);
  }
  window.NotesContentLayout = {refresh: refresh};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true});
  else start();
})();
