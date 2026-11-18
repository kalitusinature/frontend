const CACHE_NAME = 'kalitusi-admin-v3'
const APP_SHELL = self.registration.scope
const scopedUrl = (path) => new URL(path, self.registration.scope).href

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        cache.addAll([
          APP_SHELL,
          scopedUrl('manifest.webmanifest'),
          scopedUrl('icons/icon-180.png'),
          scopedUrl('icons/icon-192.png'),
          scopedUrl('icons/icon-512.png'),
        ]),
      )
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith('kalitusi-admin-') && cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const requestUrl = new URL(request.url)

  if (request.method !== 'GET' || requestUrl.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-cache' }).catch(() => caches.match(APP_SHELL)),
    )
    return
  }

  if (['script', 'style', 'image', 'font'].includes(request.destination)) {
    const cachedResponsePromise = caches.match(request)
    let responseToCache
    const networkResponsePromise = cachedResponsePromise.then((cachedResponse) =>
      cachedResponse
        ? undefined
        : fetch(request).then((response) => {
            if (response.ok) responseToCache = response.clone()
            return response
          }),
    )

    event.respondWith(
      Promise.all([cachedResponsePromise, networkResponsePromise]).then(
        ([cachedResponse, networkResponse]) => cachedResponse || networkResponse,
      ),
    )
    event.waitUntil(
      networkResponsePromise.then(
        () =>
          responseToCache
            ? caches
                .open(CACHE_NAME)
                .then((cache) => cache.put(request, responseToCache))
            : undefined,
        () => undefined,
      ),
    )
  }
})
