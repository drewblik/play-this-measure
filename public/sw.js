// Minimal service worker for M-1 installability.
//
// Lives in public/ (not src/) so Vite copies it verbatim to the dist root and
// it keeps a stable, root-scoped URL — the idiomatic way to ship a hand-written
// SW with Vite, no plugin. (TDD §2 sketches it at src/sw.js; the file's job is
// what matters, and root-scope serving requires public/.)
//
// Strategy here is NETWORK-FIRST with a cache fallback, deliberately: during
// active development the phone must always get the freshly deployed build.
// /api/* is network-only. The real CACHE-FIRST app-shell worker lands in M5
// (TDD §15.6) once the offline contract matters.

const CACHE = 'ptm-shell-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API is never cached — always hits the network (TDD §2/§15.6).
  if (url.pathname.startsWith('/api/')) return;
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok && url.origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy));
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        return cached || caches.match('/index.html');
      })
  );
});
