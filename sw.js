/* Пекин · путеводитель — офлайн-режим */
var V = 'bg-v4';
var IMG = 'bg-img-v1';
var TILES = 'bg-tiles-v1';
var TILE_MAX = 3000;
var CORE = ['./', 'index.html', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(V).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return /^bg-v/.test(k) && k !== V; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function withTimeout(p, ms) {
  return new Promise(function (res, rej) { var t = setTimeout(function () { rej(new Error('timeout')); }, ms); p.then(function (v) { clearTimeout(t); res(v); }, function (e) { clearTimeout(t); rej(e); }); });
}
// страница: сначала сеть (чтобы получать обновления), при проблемах — кэш
function page(req) {
  return withTimeout(fetch(req), 6000).then(function (r) {
    if (r && r.ok) { var c = r.clone(); caches.open(V).then(function (cc) { cc.put('index.html', c); }); }
    return r;
  }).catch(function () {
    return caches.match('index.html', { cacheName: V }).then(function (h) { return h || caches.match(req); });
  });
}
function cacheFirst(req, name) {
  return caches.open(name).then(function (c) {
    return c.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (r) { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; });
    });
  });
}
var trimming = false;
function trimTiles() {
  if (trimming) return; trimming = true;
  caches.open(TILES).then(function (c) {
    return c.keys().then(function (ks) {
      var extra = ks.length - TILE_MAX;
      return extra > 0 ? Promise.all(ks.slice(0, extra).map(function (k) { return c.delete(k); })) : null;
    });
  }).then(function () { trimming = false; }, function () { trimming = false; });
}
function tile(req) {
  return caches.open(TILES).then(function (c) {
    return c.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (r) {
        if (r && (r.ok || r.type === 'opaque')) { c.put(req, r.clone()); if (Math.random() < 0.05) trimTiles(); }
        return r;
      });
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var u = new URL(req.url);
  if (req.mode === 'navigate' || (u.origin === location.origin && /(\/|\.html)$/.test(u.pathname))) { e.respondWith(page(req)); return; }
  if (u.origin === location.origin && u.pathname.indexOf('/img/') >= 0) { e.respondWith(cacheFirst(req, IMG)); return; }
  if (/(^|\.)tile\.openstreetmap\.org$/.test(u.hostname)) { e.respondWith(tile(req)); return; }
  if (u.origin === location.origin) e.respondWith(cacheFirst(req, V));
});
