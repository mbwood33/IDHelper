/** Versioned cache name; increment whenever shell behavior materially changes. */
const CACHE_NAME = "idhelper-shell-v3";

// Install immediately instead of waiting behind an older application worker.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Delete only earlier IDHelper shell caches, then control existing tabs.
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names
          .filter((name) => name.startsWith("idhelper-shell-") && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  // Mutating requests must always reach their intended destination unchanged.
  if (event.request.method !== "GET") return;

  if (event.request.mode === "navigate") {
    // Pages are network-first so deployments appear promptly, with a cached
    // navigation response used only when the network is unavailable.
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.open(CACHE_NAME).then((cache) => cache.match(event.request))),
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Static same-origin assets use stale-while-revalidate: return cached
      // bytes quickly while refreshing them opportunistically in background.
      const cached = await cache.match(event.request);
      const network = fetch(event.request)
        .then((response) => {
          if (response.ok && new URL(event.request.url).origin === self.location.origin) {
            void cache.put(event.request, response.clone());
          }
          return response;
        })
        .catch(() => cached);

      return cached ?? network;
    }),
  );
});
