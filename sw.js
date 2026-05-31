const CACHE = 'v-silverhand-v3';

// Static assets that are safe to cache (CSS, JS, icons)
const CACHEABLE = ['/style.css', '/app.js', '/manifest.json',
                   '/icons/icon-192.png', '/icons/icon-512.png'];

// ── Install: cache static assets, activate immediately ──────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CACHEABLE))
  );
  self.skipWaiting(); // don't wait for old SW to die
});

// ── Activate: delete every old cache version ─────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim(); // take over all open tabs immediately
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // 1. API calls — NEVER cache, always straight to network, no fallback wrapper
  if (url.includes('/api/')) {
    return; // let the browser handle it natively
  }

  // 2. HTML (navigation) — network-first, fall back to cache only if offline
  if (e.request.mode === 'navigate' || url.endsWith('.html') || url.endsWith('/')) {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          // Update the cache with the fresh HTML
          const clone = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return r;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // 3. Static assets (CSS, JS, icons) — cache-first, update in background
  e.respondWith(
    caches.match(e.request).then(cached => {
      const networkFetch = fetch(e.request).then(r => {
        const clone = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return r;
      });
      return cached || networkFetch;
    })
  );
});
