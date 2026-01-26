/* FILENAME: sw.js
   PURPOSE: Service Worker for Arth Book PWA - Full Offline Support
   VERSION: 2.5 (Fully Loaded for Platinum Edition)
*/

const CACHE_NAME = 'ArthBook-v2.6-StockFix';

const STATIC_ASSETS = [
  './', 
  './index.html',
  './login.html',           // Now active
  './sales_invoice.html',
  './purchase_invoice.html',
  './vouchers.html',        // Essential
  './item_master.html',
  './ArthBook.html',
  './reports.html',
  './gst_filing.html',
  './coa.html',
  './settings.html',
  './manifest.json',        // Essential for PWA
  
  // Core JS Files
  './db.js',
  './auth.js',              // Security
  './security_utils.js',    // Security
  './ai_engine.js',         // Intelligence
  './tally_bridge.js',      // Export tool
  
  // External CDNs (Cached for offline use)
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.0/dist/JsBarcode.all.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'
];

// 1. INSTALL (Safe Mode)
// Uses Promise.allSettled so one missing file doesn't break the whole app
self.addEventListener('install', (e) => {
  console.log('SW: Installing & caching assets...');
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        STATIC_ASSETS.map(url => {
          return cache.add(url).catch(err => {
            console.warn(`SW: Optional file missing: ${url}`);
          });
        })
      );
    }).then(() => self.skipWaiting())
  );
});

// 2. ACTIVATE (Cleanup Old Caches)
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

// 3. FETCH (Stale-While-Revalidate Strategy)
// Serve from cache immediately, then update from network in background
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  
  e.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(e.request).then((cachedResponse) => {
        
        // Fetch from network to update cache
        const fetchPromise = fetch(e.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(e.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => {
            // Network failed - just ignore, we rely on cache
          });

        // Return cached response immediately if we have it
        return cachedResponse || fetchPromise;
      });
    })
  );
});