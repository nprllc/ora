// Ora — service worker (fabriqué par outils/build.mjs : la VERSION est une empreinte du contenu des fichiers).
// Installation : « la coquille » de l'app est mise en cache (page, contenus des trois langues donnees-*.json,
// manifeste, icônes, images, polices) : l'app s'ouvre hors ligne, et change de langue hors ligne.
// Les Bibles (environ 5 Mo chacune) sont mises en cache seulement quand l'app les demande :
// la Bible de la langue en cours au premier lancement, une autre seulement si l'on change de langue.
// Stratégie : réseau d'abord, cache si l'on est hors ligne. Chemins relatifs : fonctionne quel que soit l'hébergeur.
var VERSION = '__VERSION__';
var COQUILLE = __COQUILLE__;
// Les Bibles ont leur propre cache, qui survit aux mises à jour de l'app : pas besoin de retélécharger 5 Mo à chaque publication.
var BIBLES = 'ora-bibles';
function estBible(url) { return /\/bible(-[a-z]+)?\.json$/.test(new URL(url).pathname); }

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(COQUILLE); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (cles) {
    return Promise.all(cles.filter(function (k) { return k !== VERSION && k !== BIBLES; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(fetch(e.request).then(function (rep) {
    if (rep && rep.ok) { var copie = rep.clone(); caches.open(estBible(e.request.url) ? BIBLES : VERSION).then(function (c) { c.put(e.request, copie); }); }
    return rep;
  }).catch(function () {
    return caches.match(e.request, { ignoreSearch: true }).then(function (r) { return r || caches.match('./'); });
  }));
});
