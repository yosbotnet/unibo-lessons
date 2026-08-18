/* Service worker for the macro course.
   Strategy: precache the whole course on install; when online, always fetch
   fresh from the network and refresh the cache; when offline, serve the cache.
   Google Fonts are cached first-hit and kept (they never change).
   When adding files to macro/, add them to FILES and bump CACHE. */
'use strict';
var CACHE = 'macro-v1';
var FILES = [
  './',
  'index.html',
  'Macro-00-Start-Here.html',
  'Macro-01-GDP-Prices-Inflation.html',
  'Macro-02-National-Income.html',
  'Macro-03-Money-Inflation.html',
  'Macro-04-Unemployment.html',
  'Macro-05-IS-LM.html',
  'Macro-06-AD-AS.html',
  'Macro-07-Phillips-Curve.html',
  'Macro-Exam-Room.html',
  'manifest.webmanifest',
  'assets/lesson-kit.css',
  'assets/lesson-kit.js',
  'assets/img/fig-barter.webp',
  'assets/img/fig-chain.webp',
  'assets/img/fig-chairs.webp',
  'assets/img/fig-counter.webp',
  'assets/img/fig-handshake.webp',
  'assets/img/fig-jars.webp',
  'assets/img/fig-queue.webp',
  'assets/img/fig-wheelbarrow.webp',
  'assets/img/hero-00.webp',
  'assets/img/hero-01.webp',
  'assets/img/hero-02.webp',
  'assets/img/hero-03.webp',
  'assets/img/hero-04.webp',
  'assets/img/hero-05.webp',
  'assets/img/hero-06.webp',
  'assets/img/hero-07.webp',
  'assets/img/hero-exam.webp',
  'assets/img/hero-index.webp',
  'assets/img/icon-180.png',
  'assets/img/icon-192.png',
  'assets/img/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(FILES); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; })
          .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = req.url;

  // Fonts never change: serve from cache, fetch once if missing.
  if (url.indexOf('fonts.googleapis.com') >= 0 || url.indexOf('fonts.gstatic.com') >= 0) {
    e.respondWith(
      caches.open(CACHE).then(function (c) {
        return c.match(req).then(function (hit) {
          return hit || fetch(req).then(function (resp) {
            c.put(req, resp.clone());
            return resp;
          });
        });
      })
    );
    return;
  }

  if (url.indexOf(self.location.origin) !== 0) return;

  // Course files: network first (always current when online), cache when not.
  e.respondWith(
    fetch(req).then(function (resp) {
      if (resp && resp.ok) {
        var copy = resp.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return resp;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (hit) {
        if (hit) return hit;
        if (req.mode === 'navigate') return caches.match('index.html');
        return Response.error();
      });
    })
  );
});
