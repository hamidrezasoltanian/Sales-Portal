var CACHE = 'atena-crm-v5';
var PRECACHE = [
  'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

function isPrecacheUrl(url) {
  return PRECACHE.some(function (u) {
    return url === u || url.split('?')[0] === u;
  });
}

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(PRECACHE.map(function (u) {
        return new Request(u, { mode: 'no-cors' });
      })).catch(function () {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; })
          .map(function (k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// Only intercept exact precache URLs — never blanket-match CDN hosts (breaks CSP + TinyMCE/XLSX)
self.addEventListener('fetch', function (e) {
  if (!isPrecacheUrl(e.request.url)) return;
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      return cached || fetch(e.request).then(function (r) {
        var rc = r.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, rc); });
        return r;
      }).catch(function () {
        return cached || Response.error();
      });
    })
  );
});
self.addEventListener('push', function(e) {
  var data = {};
  try { data = e.data ? e.data.json() : {}; } catch(err) {}
  var title = data.title || 'اعلان CRM';
  var opts = {
    body: data.body || '',
    icon: '/favicon.ico',
    tag: data.tag || 'crm-push',
    data: { url: data.url || '/' },
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});
self.addEventListener('message', function(e) {
  if (!e.data || e.data.type !== 'crm-notif') return;
  self.registration.showNotification(e.data.title || 'اعلان CRM', {
    body: e.data.body || '',
    icon: '/favicon.ico',
    tag: e.data.tag || 'crm-notif',
    data: { url: e.data.url || '/' },
  });
});
self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  e.waitUntil(clients.openWindow((e.notification.data && e.notification.data.url) || '/'));
});
