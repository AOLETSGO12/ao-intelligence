/* Service worker for the AO Intelligence front-end prototype.
   Precaches the site with a versioned cache and serves it offline.
   Paths are relative to the worker’s scope so the cache works under a /repo/ subpath. */
/* eslint-disable no-restricted-globals */
var CACHE_VERSION = "ao-intelligence-v6";
var ASSETS = [
  "./",
  "./index.html",
  "./dashboard.html",
  "./business.html",
  "./start.html",
  "./app.html",
  "./oauth.html",
  "./css/journey.css",
  "./js/engine.js",
  "./js/config.js",
  "./js/ics.js",
  "./js/real.js",
  "./js/live.js",
  "./js/oauth.js",
  "./js/ui.js",
  "./js/journey.js",
  "./js/app.js",
  "./manifest.webmanifest",
  "./css/styles.css",
  "./js/brand.js",
  "./js/data.js",
  "./js/dashboard.js",
  "./js/landing.js",
  "./js/business-data.js",
  "./js/connectors.js",
  "./js/business.js",
  "./js/pwa.js",
  "./assets/logo-ao.svg",
  "./assets/logo-ao.png",
  "./assets/favicon-ao.svg",
  "./assets/favicon-ao.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-512-maskable.png",
  "./assets/apple-touch-icon.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      return cache.addAll(ASSETS.map(function (u) { return new Request(u, { cache: "reload" }); }));
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE_VERSION) return caches.delete(key);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  // Sign-in landing pages carry one-time codes: never cache or intercept them.
  if (/\/oauth\.html$/.test(url.pathname) || url.search.indexOf("code=") !== -1) return;
  // Network first for everything: always the newest files when online (so old and new files can never mix),
  // and the saved copy only when offline. The request bypasses the browser's own 10-minute HTTP cache.
  event.respondWith(
    fetch(event.request.url, { cache: "no-cache", credentials: "same-origin" }).then(function (response) {
      if (response && response.ok && response.type === "basic") {
        var copy = response.clone();
        caches.open(CACHE_VERSION).then(function (cache) { cache.put(event.request, copy); });
      }
      return response;
    }).catch(function () {
      return caches.match(event.request, { ignoreSearch: true }).then(function (cached) {
        if (cached) return cached;
        if (event.request.mode === "navigate") return caches.match("./index.html");
        return Response.error();
      });
    })
  );
});
