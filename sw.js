/* FILENAME: sw.js
   PURPOSE: Service Worker for Arth Book PWA - Full Offline Support
   VERSION: 2.2 (Fixed: Removed missing icon references to stop errors)
*/

const CACHE_NAME = 'ArthBook-v2.2'; // Version updated to clear old error

const STATIC_ASSETS = [
  '/', 
  '/index.html',
  '/login.html',
  '/style.css',
  '/sales_invoice.html',
  '/purchase_invoice.html',
  '/vouchers.html',
  '/item_master.html',
  '/ArthBook.html',
  '/reports.html',
  '/gst_filing.html',
  '/taxation.html',
  '/coa.html',
  '/settings.html',
  '/help.html',
  '/manifest.json',
  '/favicon.ico',
  
  // Core JS Files
  '/db.js',
  '/security_utils.js',
  '/ai_engine.js',
  '/tally_bridge.js',
  '/auth.js',
  
  // External CDNs
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'
];

// INSTALL
self.addEventListener('install', (e) => {
  console.log('SW: Installing & caching assets...');
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ACTIVATE
self.addEventListener('activate', (e) => {
  console.log('SW: Activating & cleaning old caches...');
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME)
                  .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// FETCH
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(e.request).then((cachedResponse) => {
        if (cachedResponse) {
            // Background update
            fetch(e.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    cache.put(e.request, networkResponse.clone());
                }
            }).catch(() => {});
            return cachedResponse;
        }
        return fetch(e.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(e.request, networkResponse.clone());
          }
          return networkResponse;
        });
      });
    })
  );
});