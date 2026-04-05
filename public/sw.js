// Dienstplan Service Worker – smart caching for hashed assets
const CACHE_NAME = 'dienstplan-v6.1.0'
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.svg',
  './icon-192.png',
  './icon-512.png',
]

// Install: cache static shell, activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(STATIC_ASSETS).catch((err) =>
        console.warn('[SW] Failed to cache some assets:', err)
      )
    )
  )
  self.skipWaiting()
})

// Activate: clean ALL old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

// Fetch strategy
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Skip non-GET and Supabase API requests
  if (event.request.method !== 'GET') return
  if (url.hostname.includes('supabase')) return
  if (url.pathname.startsWith('/auth/')) return

  // Hashed assets (e.g. index-ChjhOf_B.js, icons-Xyz123.css)
  // These have unique hashes — safe to cache forever, but MUST use network-first
  // so a new deploy with new hashes always wins
  const isHashedAsset = url.pathname.match(/\/assets\/.*-[A-Za-z0-9_-]{6,}\.(js|css)$/)

  if (isHashedAsset) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
        .catch(() =>
          caches.match(event.request).then((cached) =>
            cached || new Response('Asset not available offline', { status: 503 })
          )
        )
    )
    return
  }

  // Fonts & static non-hashed assets: cache-first (these don't change)
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('gstatic.com') ||
      url.pathname.match(/\.(png|svg|woff2?|ttf|ico)$/)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return response
        }).catch(() => cached || new Response('Offline', { status: 503 }))
      })
    )
    return
  }

  // HTML/navigation: network-first with cache fallback
  if (event.request.mode === 'navigate' || event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          return response
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
    )
    return
  }
})
