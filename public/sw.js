const CACHE_NAME = 'ghb-pay-shell-v1'
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('ghb-pay-shell-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || request.mode !== 'navigate') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(
    fetch(request).catch(async () => {
      const offlinePage = await caches.match(OFFLINE_URL)
      if (offlinePage) return offlinePage
      return new Response('Connexion Internet requise.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    })
  )
})
