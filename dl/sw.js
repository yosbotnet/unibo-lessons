/* Deep Learning course PWA. Network-first for course files, cache fallback offline. */
'use strict';
const CACHE = 'dl-v1';
const FILES = [
  "./",
  "cap-01-introduction.html",
  "cap-02-math-autodiff.html",
  "cap-03-neural-networks.html",
  "cap-04-backpropagation.html",
  "cap-05-optimization.html",
  "cap-06-cnn.html",
  "cap-07-cnn-architectures.html",
  "cap-08-rnn.html",
  "cap-09-autoencoders.html",
  "cap-10-transformers.html",
  "cap-11-generative-models.html",
  "cap-12-reinforcement-learning.html",
  "index.html",
  "manifest.webmanifest",
  "assets/lesson-kit.css",
  "assets/lesson-kit.js",
  "assets/icon-180.png",
  "assets/icon-192.png",
  "assets/icon-512.png"
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('dl-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(new URL('./', self.location).pathname)) return;
  event.respondWith(fetch(request).then(response => {
    if (response && response.ok) caches.open(CACHE).then(cache => cache.put(request, response.clone()));
    return response;
  }).catch(() => caches.match(request, {ignoreSearch:true}).then(hit => hit || (request.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
