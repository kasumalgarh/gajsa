const CACHE_NAME = 'moneywise-v1';
const ASSETS = [
  'index.html',
  'coa.html',
  'settings.html',
  'db.js',
  'auth.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap'
];

// फाइलों को सेव करना (Install)
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// ऑफलाइन होने पर फाइलें दिखाना (Fetch)
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});