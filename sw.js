/* Ora — service worker : garde l'app disponible hors ligne. */
var VERSION = 'ora-v0.4.0';
var FICHIERS = ['./', 'index.html', 'manifest.webmanifest', 'bible.json', 'bible-es.json', 'bible-en.json', 'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FICHIERS); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (k) { return Promise.all(k.filter(function (x) { return x !== VERSION; }).map(function (x) { return caches.delete(x); })); }).then(function () { return self.clients.claim(); })); });
// Le réseau d'abord (pour recevoir les mises à jour), le cache si on est hors ligne.
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(function (rep) {
    if (rep && (rep.ok || rep.type === 'opaque')) { var copie = rep.clone(); caches.open(VERSION).then(function (c) { c.put(e.request, copie); }); }
    return rep;
  }).catch(function () { return caches.match(e.request).then(function (r) { return r || caches.match('index.html'); }); }));
});
