const OFFLINE_CACHE = "so4-offline-v1"
const OFFLINE_PAGE = "/offline.html"

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(OFFLINE_CACHE)
      .then((cache) => cache.add(OFFLINE_PAGE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith("so4-offline-") && key !== OFFLINE_CACHE)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET" || request.mode !== "navigate") return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(
    fetch(request).catch(async () => {
      const fallback = await caches.match(OFFLINE_PAGE)
      return fallback ?? new Response("Offline page unavailable", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    }),
  )
})