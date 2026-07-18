/* Service worker for Comic Page Extender.
   Strategy: cache-first for the app shell (so it opens offline), with a
   background refresh so updates arrive on the next visit. API calls to
   Google are never cached — generation always goes to the network. */
const CACHE = "cpx-shell-v5";
const SHELL = ["./", "./index.html", "./manifest.json", "./icon.svg"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  // Only handle same-origin GETs; the AI APIs and anything else pass through.
  if (e.request.method !== "GET" || url.origin !== location.origin) return;

  // The page itself is NETWORK-FIRST: when online you always get the newest
  // version immediately; the cache is only a fallback for offline use.
  // (Cache-first here made users see stale versions after every update.)
  if (e.request.mode === "navigate" || e.request.destination === "document") {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(e.request).then(c => c || caches.match("./index.html")))
    );
    return;
  }

  // Everything else (icon, manifest): cache-first with background refresh.
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fresh = fetch(e.request)
        .then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => cached); // offline: fall back to cache
      return cached || fresh;
    })
  );
});
