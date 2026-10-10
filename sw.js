const CACHE = 'two-hearts-one-cart-v3';
const SHELL = ['./', './index.html', './manifest.json', './icons/icon-192.png', './icons/icon-512.png'];

// Only the app shell and the pinned CDN scripts it imports belong in the
// cache. Firestore's long-poll/WebChannel traffic, the Open Food Facts API and
// product images are live data: caching every one of those responses used to
// grow the cache without bound and could hand the Firestore SDK a stale,
// unrelated response when offline.
const CDN_HOSTS = ['www.gstatic.com', 'cdn.jsdelivr.net'];
function shouldHandle(request) {
  const url = new URL(request.url);
  if (url.origin === self.location.origin) return true;
  return CDN_HOSTS.includes(url.hostname) && /\.(m?js)$/.test(url.pathname);
}

// GitHub Pages serves everything with Cache-Control: max-age=600, which we
// can't override (static host, no server config). `cache: 'no-store'` makes
// every fetch here bypass that entirely, so installs and revalidation never
// silently reuse a browser-cached response that's up to 10 minutes stale.
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(SHELL.map((url) =>
        fetch(url, { cache: 'no-store' }).then((res) => c.put(url, res))
      ))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Network-first: always prefer the live version; fall back to the last cached
// copy only when the network fails.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !shouldHandle(e.request)) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-store' }).then((res) => {
      if (res && res.status === 200) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
