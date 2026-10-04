// SİTODED PWA service worker
// Navigasyon: network-first (giriş/panel sayfaları hep taze).
// Statik varlıklar (css/js/img/vendor): stale-while-revalidate.
const CACHE = 'sitoded-v1';

const PRECACHE = [
  '/css/style.css',
  '/css/theme.css',
  '/vendor/bootstrap.min.css',
  '/vendor/bootstrap-icons.css',
  '/img/site/favicon.ico',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .catch(() => null) // bir varlık eksikse kurulum yine de tamamlansın
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Sayfa yüklemeleri: önce ağ; ağ yoksa cache'ten, o da yoksa çevrimdışı bilgisi.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => null);
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || new Response(
          '<h1 style="font-family:sans-serif;padding:24px">Çevrimdışısın.</h1><p style="font-family:sans-serif;padding:0 24px">İnternet bağlantın yok. Bağlanınca sayfayı yenile.</p>',
          { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        )))
    );
    return;
  }

  // Varlıklar: cache önce, arka planda tazele.
  e.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => null);
          }
          return res;
        })
        .catch(() => hit);
      return hit || network;
    })
  );
});
