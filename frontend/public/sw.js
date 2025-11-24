// Service Worker for caching translations and offline support
const CACHE_NAME = 'kiosk-translations-v1';
const TRANSLATION_CACHE = 'kiosk-translations-data-v1';

// Files to cache immediately on install
const STATIC_CACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Translation files to cache
const TRANSLATION_URLS = [
  '/locales/tr/kiosk.json',
  '/locales/tr/admin.json',
  '/locales/tr/common.json',
  '/locales/tr/validation.json',
];

// Install event - cache static assets and translations
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    Promise.all([
      // Cache static files
      caches.open(CACHE_NAME).then((cache) => {
        console.log('[SW] Caching static files');
        return cache.addAll(STATIC_CACHE_URLS);
      }),
      // Cache translation files
      caches.open(TRANSLATION_CACHE).then((cache) => {
        console.log('[SW] Caching translation files');
        return cache.addAll(TRANSLATION_URLS).catch((err) => {
          console.warn('[SW] Failed to cache some translations:', err);
          // Continue even if some translations fail to cache
          return Promise.resolve();
        });
      }),
    ]).then(() => {
      console.log('[SW] Service worker installed successfully');
      // Activate immediately
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old caches
          if (cacheName !== CACHE_NAME && cacheName !== TRANSLATION_CACHE) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Service worker activated');
      // Take control of all pages immediately
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Check if this is a translation file request
  const isTranslation = url.pathname.includes('/locales/') && url.pathname.endsWith('.json');
  
  // Check if this is an API request
  const isAPI = url.pathname.startsWith('/api/');
  
  // Don't cache API requests
  if (isAPI) {
    return;
  }
  
  // Strategy for translation files: Cache First, then Network
  if (isTranslation) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          console.log('[SW] Serving translation from cache:', url.pathname);
          
          // Update cache in background
          fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(TRANSLATION_CACHE).then((cache) => {
                cache.put(request, networkResponse.clone());
              });
            }
          }).catch(() => {
            // Network failed, but we have cache
          });
          
          return cachedResponse;
        }
        
        // Not in cache, fetch from network
        console.log('[SW] Fetching translation from network:', url.pathname);
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            // Cache the new translation
            caches.open(TRANSLATION_CACHE).then((cache) => {
              cache.put(request, networkResponse.clone());
            });
          }
          return networkResponse;
        }).catch((error) => {
          console.error('[SW] Failed to fetch translation:', url.pathname, error);
          // Return a fallback response
          return new Response(JSON.stringify({}), {
            headers: { 'Content-Type': 'application/json' },
          });
        });
      })
    );
    return;
  }
  
  // Strategy for other files: Network First, then Cache
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        // Cache successful responses
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            console.log('[SW] Serving from cache (offline):', url.pathname);
            return cachedResponse;
          }
          
          // No cache available
          if (request.destination === 'document') {
            // Return cached index.html for navigation requests
            return caches.match('/index.html');
          }
          
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

// Message event - handle commands from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      }).then(() => {
        console.log('[SW] All caches cleared');
        event.ports[0].postMessage({ success: true });
      })
    );
  }
});
