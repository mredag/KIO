// Service Worker registration utility
// This file handles the registration and lifecycle of the service worker

type Config = {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onOffline?: () => void;
  onOnline?: () => void;
};

const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
    window.location.hostname === '[::1]' ||
    window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
);

export function register(config?: Config) {
  if ('serviceWorker' in navigator) {
    // Wait for the page to load
    window.addEventListener('load', () => {
      const swUrl = `${import.meta.env.BASE_URL}sw.js`;

      if (isLocalhost) {
        // Check if a service worker exists
        checkValidServiceWorker(swUrl, config);

        // Log additional info in localhost
        navigator.serviceWorker.ready.then(() => {
          console.log(
            '[SW] This web app is being served cache-first by a service worker. ' +
              'To learn more, visit https://cra.link/PWA'
          );
        });
      } else {
        // Register service worker in production
        registerValidSW(swUrl, config);
      }
    });

    // Listen for online/offline events
    window.addEventListener('online', () => {
      console.log('[SW] App is online');
      config?.onOnline?.();
    });

    window.addEventListener('offline', () => {
      console.log('[SW] App is offline');
      config?.onOffline?.();
    });
  }
}

function registerValidSW(swUrl: string, config?: Config) {
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      console.log('[SW] Service worker registered:', registration);

      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker == null) {
          return;
        }

        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // New content is available
              console.log('[SW] New content is available; please refresh.');
              config?.onUpdate?.(registration);
            } else {
              // Content is cached for offline use
              console.log('[SW] Content is cached for offline use.');
              config?.onSuccess?.(registration);
            }
          }
        };
      };
    })
    .catch((error) => {
      console.error('[SW] Error during service worker registration:', error);
    });
}

function checkValidServiceWorker(swUrl: string, config?: Config) {
  // Check if the service worker can be found
  fetch(swUrl, {
    headers: { 'Service-Worker': 'script' },
  })
    .then((response) => {
      // Ensure service worker exists
      const contentType = response.headers.get('content-type');
      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf('javascript') === -1)
      ) {
        // No service worker found, reload the page
        navigator.serviceWorker.ready.then((registration) => {
          registration.unregister().then(() => {
            window.location.reload();
          });
        });
      } else {
        // Service worker found, proceed normally
        registerValidSW(swUrl, config);
      }
    })
    .catch(() => {
      console.log('[SW] No internet connection found. App is running in offline mode.');
    });
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
        console.log('[SW] Service worker unregistered');
      })
      .catch((error) => {
        console.error('[SW] Error unregistering service worker:', error.message);
      });
  }
}

// Utility to clear all caches
export async function clearCaches() {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    return new Promise((resolve, reject) => {
      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        if (event.data.success) {
          resolve(true);
        } else {
          reject(new Error('Failed to clear caches'));
        }
      };
      
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage(
          { type: 'CLEAR_CACHE' },
          [messageChannel.port2]
        );
      } else {
        reject(new Error('No service worker controller available'));
      }
    });
  }
  
  // Fallback: clear caches directly
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
    return true;
  }
  
  return false;
}

// Check if app is running in offline mode
export function isOffline(): boolean {
  return !navigator.onLine;
}

// Get cache statistics
export async function getCacheStats() {
  if (!('caches' in window)) {
    return null;
  }

  const cacheNames = await caches.keys();
  const stats = await Promise.all(
    cacheNames.map(async (name) => {
      const cache = await caches.open(name);
      const keys = await cache.keys();
      return {
        name,
        size: keys.length,
      };
    })
  );

  return stats;
}
