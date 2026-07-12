'use strict';
// Service worker: cache the whole game so the installed app works offline.
const CACHE = 'emberwild-v4';
const FILES = [
  './', './index.html', './sprites.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png',
  './js/util.js', './js/sfx.js', './js/kaya_sheet.js', './js/scene1.js',
  './js/sprites.js', './js/levels.js', './js/entities.js', './js/game.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request))
  );
});
