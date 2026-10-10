const CACHE = 'two-hearts-one-cart-v4';
const SHELL = ['./', './index.html', './manifest.json', './icons/icon-192.png', './icons/icon-512.png'];
// Versioned, immutable library URLs (Firebase SDK, barcode scanner).
const CDN_HOSTS = ['www.gstatic.com', 'cdn.jsdelivr.net'];

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

function putInCache(request, res) {
  if (res && res.status === 200) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(request, copy));
  }
  return res;
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Our own shell: network-first so the live version always wins, with the
  // last cached copy as the offline fallback.
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then((res) => putInCache(e.request, res))
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Pinned CDN libraries never change at a given URL: serve from cache for a
  // fast start, fetch once when missing.
  if (CDN_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => putInCache(e.request, res)))
    );
    return;
  }

  // Everything else (Firestore/Auth channels, Open Food Facts, product
  // photos) goes straight to the network: caching those is useless at best
  // and, for Firestore's long-polling responses, actively harmful. Firestore
  // has its own offline cache.
});

// ---- Push notifications (partner nudges) ----
// FCM delivers the Cloud Function's message as a JSON push payload. We show it
// ourselves rather than loading the Firebase messaging SDK into the worker.
self.addEventListener('push', (e) => {
  let payload = {};
  try { payload = e.data ? e.data.json() : {}; } catch (err) { payload = { notification: { body: e.data && e.data.text() } }; }
  const n = payload.notification || {};
  const d = payload.data || {};
  const link = (payload.fcmOptions && payload.fcmOptions.link) || d.link || './';
  e.waitUntil(self.registration.showNotification(n.title || 'Two Hearts, One Cart', {
    body: n.body || d.message || 'Anything else?',
    icon: n.icon || './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag: d.tag || 'nudge',
    renotify: true,
    data: { link },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL((e.notification.data && e.notification.data.link) || './', self.location.href).href;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => w.url.startsWith(self.registration.scope));
      if (open) return open.focus();
      return self.clients.openWindow(target);
    })
  );
});
