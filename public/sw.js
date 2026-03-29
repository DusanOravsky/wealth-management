const CACHE = "wm-v5";
const BASE = "/wealth-management";

const PRECACHE = [
  BASE + "/",
  BASE + "/dashboard",
  BASE + "/commodities",
  BASE + "/cash",
  BASE + "/pension",
  BASE + "/bank",
  BASE + "/crypto",
  BASE + "/stocks",
  BASE + "/realestate",
  BASE + "/budget",
  BASE + "/insurance",
  BASE + "/planning",
  BASE + "/goals",
  BASE + "/alerts",
  BASE + "/advisor",
  BASE + "/settings",
  BASE + "/manifest.json",
  BASE + "/icon-192.png",
  BASE + "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
      .then(async () => {
        // Reload open clients so they pick up fresh JS bundles after SW update
        const clients = await self.clients.matchAll({ type: "window" });
        clients.forEach((client) => client.navigate(client.url));
      })
  );
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
      .catch(() => caches.match(event.request))
  );
});
