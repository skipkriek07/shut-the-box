/* Service worker voor offline gebruik.
   Verhoog CACHE_VERSIE bij elke update zodat nieuwe bestanden doorkomen. */
'use strict';

const CACHE_VERSIE = 'stb-cache-v4';

const BESTANDEN = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './game-logic.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSIE).then(function (cache) {
      return cache.addAll(BESTANDEN);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (namen) {
      return Promise.all(namen.map(function (naam) {
        if (naam !== CACHE_VERSIE) return caches.delete(naam);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(function (gecachet) {
      return gecachet || fetch(event.request).then(function (antwoord) {
        // nieuwe bestanden alsnog in de cache zetten
        var kopie = antwoord.clone();
        caches.open(CACHE_VERSIE).then(function (cache) {
          cache.put(event.request, kopie);
        });
        return antwoord;
      });
    })
  );
});
