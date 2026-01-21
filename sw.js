/* FILENAME: sw.js
   PURPOSE: Service Worker for Arth Book PWA - Full Offline Support
   VERSION: 2.0 (Improved: Complete asset list, cache cleanup, stale-while-revalidate, CDN caching)
*/

const CACHE_NAME = 'ArthBook-v2.0'; // Version bump kiya taaki purana cache clear ho

const STATIC_ASSETS = [
  '/', // Root for index.html fallback
  '/index.html',
  '/sales_invoice.html',
  '/purchase_invoice.html',
  '/vouchers.html',
  '/item_master.html',
  '/ArthBook.html', // Parties page
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
  
  // External CDNs (Cached for offline)
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
  'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2',
  'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hiA.woff2',
  // Add more font weights if needed
];

// INSTALL: Cache all static assets
self.addEventListener('install', (e) => {
  console.log('SW: Installing & caching assets...');
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()) // Force new SW to activate immediately
  );
});

// ACTIVATE: Clean up old caches
self.addEventListener('activate', (e) => {
  console.log('SW: Activating & cleaning old caches...');
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME)
                  .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim()) // Take control of pages immediately
  );
});

// FETCH: Stale-while-revalidate strategy (Best for PWA)
self.addEventListener('fetch', (e) => {
  // Only handle GET requests
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(e.request).then((cachedResponse) => {
        // Return cached if available
        if (cachedResponse) {
          // Update cache in background
          fetch(e.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(e.request, networkResponse.clone());
            }
          }).catch(() => {}); // Ignore network errors
          return cachedResponse;
        }

        // Otherwise fetch from network and cache
        return fetch(e.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(e.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
          // Offline fallback (optional: custom offline page)
          if (e.request.destination === 'document') {
            return caches.match('/index.html');
          }
          return new Response('Offline - No cached response', { status: 503 });
        });
      });
    })
  );
});

// Optional: Background Sync (for future - if you add sync for data)