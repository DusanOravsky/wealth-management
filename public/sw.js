const CACHE = "wm-v3";
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
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  // Only cache same-origin requests — skip external APIs
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
