const CACHE_NAME = 'kalitusi-admin-v5'
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

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch (error) {
    console.error('Could not parse an admin push message.', error)
  }
  if (!payload || typeof payload !== 'object') payload = {}

  const title =
    typeof payload.title === 'string' ? payload.title : 'Kalitusi admin alert'
  const body =
    typeof payload.body === 'string' ? payload.body : 'There is a new resort update.'
  const page =
    payload.page === 'orders' || payload.page === 'reservations'
      ? payload.page
      : 'dashboard'

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: scopedUrl('icons/icon-192.png'),
      badge: scopedUrl('icons/icon-192.png'),
      tag: typeof payload.tag === 'string' ? payload.tag : undefined,
      data: { page },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  const page = event.notification.data?.page
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (new URL(client.url).origin !== self.location.origin) continue
        void client.focus()
        client.postMessage({ type: 'push-notification-click', page })
        return
      }
      return self.clients.openWindow(APP_SHELL)
    }),
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
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseToCache = response.clone()
            event.waitUntil(
              caches
                .open(CACHE_NAME)
                .then((cache) => cache.put(request, responseToCache)),
            )
          }
          return response
        })
        .catch(() => caches.match(request)),
    )
  }
})
