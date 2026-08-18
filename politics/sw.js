/* Service worker for the politics course.
   Strategy: precache the whole course on install; when online, always fetch
   fresh from the network and refresh the cache; when offline, serve the cache.
   Google Fonts are cached first-hit and kept (they never change).
   When adding files to politics/, add them to FILES and bump CACHE. */
'use strict';
var CACHE = 'politics-v1';
var FILES = [
  './',
  'index.html',
  'Poli-00-Start-Here.html',
  'Poli-01-Politics-and-Political-Science.html',
  'Poli-02-The-State.html',
  'Poli-03-Democracy.html',
  'Poli-04-Autocracy.html',
  'Poli-05-Constitutions.html',
  'Poli-06-Executives-Parliaments-Bureaucracies.html',
  'Poli-07-Elections-and-Referendums.html',
  'Poli-08-Political-Attitudes-and-Behaviour.html',
  'Poli-09-Parties-and-Pressure-Groups.html',
  'Poli-10-Media-and-Political-Communication.html',
  'Poli-11-Populism.html',
  'Poli-12-Globalization-and-Global-Governance.html',
  'Poli-13-Political-Trust.html',
  'Poli-Exam-Room.html',
  'manifest.webmanifest',
  'assets/lesson-kit.css',
  'assets/lesson-kit.js',
  'assets/img/hero-00.webp',
  'assets/img/hero-01.webp',
  'assets/img/hero-02.webp',
  'assets/img/hero-03.webp',
  'assets/img/hero-04.webp',
  'assets/img/hero-05.webp',
  'assets/img/hero-06.webp',
  'assets/img/hero-07.webp',
  'assets/img/hero-08.webp',
  'assets/img/hero-09.webp',
  'assets/img/hero-10.webp',
  'assets/img/hero-11.webp',
  'assets/img/hero-12.webp',
  'assets/img/hero-13.webp',
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
        return Promise.all(keys.filter(function (k) { return k !== CACHE && k.indexOf('politics-') === 0; })
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
