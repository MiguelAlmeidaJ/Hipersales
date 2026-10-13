// Minimal service worker for browser PWA installation.
// Network requests are not cached to avoid stale authenticated or financial data.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
