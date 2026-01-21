/* FILENAME: sw.js
   PURPOSE: Service Worker for Arth Book PWA - Full Offline Support
   VERSION: 2.4 (Fixed: Safe Caching Mode - Ignores missing files)
*/

const CACHE_NAME = 'ArthBook-v2.4';

const STATIC_ASSETS = [
  './', 
  './index.html',
  // './login.html',       // Enable if file exists
  // './style.css',        // Enable if file exists
  './sales_invoice.html',
  './purchase_invoice.html',
  './vouchers.html',
  './item_master.html',
  './ArthBook.html',
  './reports.html',
  './gst_filing.html',
  // './taxation.html',    // Enable if file exists
  './coa.html',
  './settings.html',
  // './help.html',        // Enable if file exists
  // './manifest.json',    // Enable if file exists
  // './favicon.ico',      // Enable if file exists
  
  // Core JS Files
  './db.js',
  // './security_utils.js', // Enable if file exists
  './ai_engine.js',
  // './tally_bridge.js',   // Enable if file exists
  // './auth.js',           // Enable if file exists
  
  // External CDNs
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'
];

// INSTALL (Safe Mode)
self.addEventListener('install', (e) => {
  console.log('SW: Installing & caching assets...');
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // We map over assets and cache them individually. 
      // This ensures that if ONE file is missing, the others still get cached.
      return Promise.allSettled(
        STATIC_ASSETS.map(url => {
          return cache.add(url).catch(err => {
            console.warn(`SW: Failed to cache ${url}. It might be missing.`);
          });
        })
      );
    }).then(() => self.skipWaiting())
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
        const fetchPromise = fetch(e.request)
          .then((networkResponse) => {
            // Update cache with new version if available
            if (networkResponse && networkResponse.status === 200) {
              cache.put(e.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => {
            // Network failed, do nothing (we rely on cache)
          });

        // Return cached response immediately if available, else wait for network
        return cachedResponse || fetchPromise;
      });
    })
  );
});