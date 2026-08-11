const CACHE_NAME = 'canada-trip-v8';
const PRECACHE = [
  './',
  './index.html',
  './style.css?v=8',
  './app.js?v=8',
  './data.json',
  './manifest.json',
  './favicon.svg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './qr/fl1.png',
  './qr/fl2.png',
  './qr/fl3.png',
  './qr/fl4.png',
  './qr/tr1.png',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://images.unsplash.com/photo-1569982615761-66697da68502?fm=jpg&q=75&w=1600&auto=format&fit=crop'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.all(
        PRECACHE.map(url => cache.add(url).catch(() => {}))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const isData = req.url.includes('data.json');

  if (isData) {
    // Network-first for trip data, so edits show up when online; fall back to cache offline.
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Cache-first for everything else (app shell, map tiles, libraries).
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res.ok && (req.url.startsWith(self.location.origin) || req.url.includes('cdnjs.cloudflare.com') || req.url.includes('tile.openstreetmap.org'))) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
