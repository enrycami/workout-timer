const CACHE_NAME = 'interval-timer-v2';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './site.webmanifest',
  './icons/favicon.ico',
  './icons/favicon.svg',
  './icons/favicon-96x96.png',
  './icons/apple-touch-icon.png',
  './icons/web-app-manifest-192x192.png',
  './icons/web-app-manifest-512x512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(e.request).catch(() => {
        // Fallback to cached root if navigation fails offline
        if (e.request.mode === 'navigate') {
          return caches.match('./');
        }
      });
    })
  );
});