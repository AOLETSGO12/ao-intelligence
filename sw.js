/* Service worker for the AO Intelligence front-end prototype.
   Precaches the site with a versioned cache and serves it offline.
   Paths are relative to the worker’s scope so the cache works under a /repo/ subpath. */
/* eslint-disable no-restricted-globals */
var CACHE_VERSION = "ao-intelligence-v3";
var ASSETS = [
  "./",
  "./index.html",
  "./dashboard.html",
  "./business.html",
  "./start.html",
  "./app.html",
  "./css/journey.css",
  "./js/engine.js",
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
      return cache.addAll(ASSETS);
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

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      var network = fetch(event.request).then(function (response) {
        if (response && response.ok) {
          var copy = response.clone();
          caches.open(CACHE_VERSION).then(function (cache) {
            cache.put(event.request, copy);
          });
        }
        return response;
      }).catch(function () {
        if (cached) return cached;
        if (event.request.mode === "navigate") {
          return caches.match("./index.html");
        }
        return caches.match(event.request);
      });
      return cached || network;
    })
  );
});
