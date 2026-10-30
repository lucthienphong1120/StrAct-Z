/**
 * StrAct Z - Service Worker (Network-Only PWA Mode)
 * Maintained strictly for PWA installation capability without caching frontend assets.
 * All requests pass directly to the network.
 */

const CACHE_NAME = 'stract-z-v3.6.0';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Clear ALL existing caches in CacheStorage across all versions
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => caches.delete(cacheName))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Pure Network-Only: fetch directly from server without saving to cache
  event.respondWith(fetch(event.request));
});
