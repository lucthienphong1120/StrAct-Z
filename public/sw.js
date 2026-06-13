const CACHE_NAME = 'stract-z-v2.3.16';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/login.html',
  '/register.html',
  '/css/theme.css',
  '/css/layout.css',
  '/css/components.css',
  '/js/app.js',
  '/js/core/api.js',
  '/js/core/auth.js',
  '/js/ui/dashboard.js',
  '/js/ui/config.js',
  '/js/ui/map.js',
  '/js/ui/scheduler.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Skip non-http(s) requests (e.g. chrome-extension://) — Cache API doesn't support them
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return;
  }

  // We only intercept caching for resources listed in ASSETS_TO_CACHE (checking exact path)
  let urlObj;
  try {
    urlObj = new URL(url);
  } catch (e) {
    return;
  }
  const pathname = urlObj.pathname;
  const isCachedAsset = ASSETS_TO_CACHE.some(asset => {
    if (asset.startsWith('http')) {
      return url === asset;
    }
    return pathname === asset || (asset === '/' && pathname === '/');
  });

  if (!isCachedAsset) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request);
      })
    );
    return;
  }

  // Check if it's a dynamic local asset (HTML, JS, CSS, JSON)
  const isDynamicLocal = url.endsWith('.html') || url.includes('/js/') || url.includes('/css/') || url.endsWith('.json') || url === self.location.origin || url === self.location.origin + '/';

  if (isDynamicLocal) {
    // Network-first strategy: try network, fallback to cache, and update cache if network succeeds
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
  } else {
    // Kiểm tra nếu KHÔNG PHẢI là request GET thì tải thẳng từ network, không cache
    if (event.request.method !== 'GET') {
      event.respondWith(fetch(event.request));
      return;
    }
    // Luồng xử lý Cache-first hiện tại của bạn dành riêng cho static resources (GET)
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone); // Dòng 94 cũ, giờ đã an toàn
            });
          }
          return networkResponse;
        });
      })
    );
  }
});
