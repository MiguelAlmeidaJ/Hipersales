const CACHE_NAME = "hypersales-v75-modules";
const ASSETS = [
  "/",
  "/index.html",
  "/styles.css?v=20261008-frontend-modules-1",
  "/app.js?v=20261008-frontend-modules-1",
  "/styles/01-occurrences.css?v=20261008-frontend-modules-1",
  "/styles/02-theme-foundation.css?v=20261008-frontend-modules-1",
  "/styles/03-admin-components.css?v=20261008-frontend-modules-1",
  "/styles/04-modals-and-settings.css?v=20261008-frontend-modules-1",
  "/styles/05-proposals.css?v=20261008-frontend-modules-1",
  "/styles/06-shared-components.css?v=20261008-frontend-modules-1",
  "/styles/07-orders.css?v=20261008-frontend-modules-1",
  "/styles/08-responsive.css?v=20261008-frontend-modules-1",
  "/styles/09-final-overrides.css?v=20261008-frontend-modules-1",
  "/modules/core/state.js",
  "/modules/core/ui.js",
  "/modules/core/api.js",
  "/modules/core/shell.js",
  "/modules/features/dashboard.js",
  "/modules/features/customer-requests.js",
  "/modules/features/occurrences.js",
  "/modules/features/customers.js",
  "/modules/features/catalog-views.js",
  "/modules/features/proposals.js",
  "/modules/admin/orders.js",
  "/modules/admin/modals.js",
  "/modules/admin/catalog.js",
  "/modules/admin/settings.js",
  "/manifest.webmanifest?v=20260609-multitenant-1",
  "/assets/iconapp.png?v=20260608-logo-3"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/")) return;
  if (["/", "/index.html", "/styles.css", "/app.js", "/sw.js"].includes(url.pathname)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
