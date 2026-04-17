const CACHE = "wm-v8";
const BASE = "/wealth-management";

const PRECACHE = [
  BASE + "/",
  BASE + "/dashboard/",
  BASE + "/commodities/",
  BASE + "/cash/",
  BASE + "/pension/",
  BASE + "/bank/",
  BASE + "/crypto/",
  BASE + "/stocks/",
  BASE + "/realestate/",
  BASE + "/budget/",
  BASE + "/insurance/",
  BASE + "/planning/",
  BASE + "/goals/",
  BASE + "/alerts/",
  BASE + "/advisor/",
  BASE + "/settings/",
  BASE + "/manifest.json",
  BASE + "/icon-192.png",
  BASE + "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);

      // Cache HTML pages
      await Promise.allSettled(
        PRECACHE.map((url) =>
          fetch(url, { redirect: "follow" })
            .then((r) => { if (r.ok) return cache.put(url, r); })
            .catch(() => {})
        )
      );

      // Cache all _next/static/ assets by extracting them from the app shell HTML.
      // Without this, JS/CSS files are only cached after the first online visit,
      // so the app fails offline on first install.
      try {
        const r = await fetch(BASE + "/", { redirect: "follow" });
        if (r.ok) {
          const html = await r.text();
          const staticPaths = [
            ...new Set(
              [...html.matchAll(/["'](\/wealth-management\/_next\/static\/[^"']+)["']/g)]
                .map((m) => m[1])
            ),
          ];
          await Promise.allSettled(
            staticPaths.map((path) =>
              fetch(path)
                .then((res) => { if (res.ok) return cache.put(path, res); })
                .catch(() => {})
            )
          );
        }
      } catch {}
    })()
  );
  // Don't skipWaiting — wait for user to approve the update via popup
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
  // No forced navigate — app reloads itself after user confirms update
});

// App sends SKIP_WAITING when user clicks "Aktualizovať"
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Cache-first for Next.js static assets (content-hashed — safe to cache forever)
  if (url.pathname.startsWith(BASE + "/_next/static/")) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
          return response;
        });
      })
    );
    return;
  }

  // Network-first for everything else (HTML pages, icons, manifest)
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
        return response;
      })
      .catch(() =>
        // Try exact match, then with trailing slash (GitHub Pages redirect)
        caches.match(event.request).then(
          (cached) =>
            cached ||
            caches.match(
              url.pathname.endsWith("/") ? event.request.url : event.request.url + "/"
            )
        )
      )
  );
});
