// FILE: /sw.js
const CACHE = 'app-v1';
const PRECACHE = [
  '/', '/index.html', '/manifest.webmanifest',
  '/icons/icon-192.png', '/icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(PRECACHE);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== CACHE ? caches.delete(k) : Promise.resolve())));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Only same-origin GET
  if (req.method !== 'GET' || url.origin !== location.origin) return;

  // Navigate fallback to index.html (SPA)
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const cached = await caches.match('/index.html');
        const net = fetch('/index.html').then(r => {
          caches.open(CACHE).then(c => c.put('/index.html', r.clone()));
          return r.clone();
        }).catch(() => null);
        return net || cached;
      } catch {
        return caches.match('/index.html');
      }
    })());
    return;
  }

  // Cache-first for other GET
  e.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      const cache = await caches.open(CACHE);
      cache.put(req, res.clone());
      return res;
    } catch {
      // If offline and not in cache, try index for same-origin HTML
      if (req.headers.get('accept')?.includes('text/html')) {
        return caches.match('/index.html');
      }
      throw err;
    }
  })());
});