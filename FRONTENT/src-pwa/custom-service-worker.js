/* eslint-env serviceworker */

/*
 * This file (which will be your service worker)
 * is picked up by the build system ONLY if
 * quasar.config file > pwa > workboxMode is set to "InjectManifest"
 */

import { clientsClaim } from 'workbox-core'
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { StaleWhileRevalidate, CacheFirst, NetworkFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { openDB } from 'idb'
import { BackgroundSyncPlugin } from 'workbox-background-sync'

const DB_NAME = 'little-leap-aql-db'
const DB_VERSION = 2

const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('api-cache')) {
      db.createObjectStore('api-cache', { keyPath: 'url' })
    }
  }
})

const bgSyncPlugin = new BackgroundSyncPlugin('api-sync-queue', {
  maxRetentionTime: 24 * 60 // Retry for max 24 Hours (in minutes)
})

self.skipWaiting()
clientsClaim()

// Use with precache injection
precacheAndRoute(self.__WB_MANIFEST)

cleanupOutdatedCaches()

// ── API Token & GAS Integration ──────────────────────────────

let authToken = null

// Listen for token updates from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_AUTH_TOKEN') {
    authToken = event.data.token
    console.log('[SW] Auth Token updated')
  }
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// Intercept and handle GAS API requests
registerRoute(
  ({ url }) => url.href.includes('script.google.com/macros/s/'),
  async ({ request }) => {
    // Clone request to read body
    const clonedRequest = request.clone()
    let body
    try {
      body = await clonedRequest.json()
    } catch (e) {
      return fetch(request)
    }

    // Inject token for non-login actions
    if (authToken && body.action !== 'login' && !body.token) {
      body.token = authToken
    }

    const newRequest = new Request(request, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(body),
      mode: 'cors'
    })

    // Use NetworkFirst for API calls
    const strategy = new NetworkFirst({
      cacheName: 'api-responses',
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 300 // 5 minutes
        }),
        bgSyncPlugin,
        {
          // Custom plugin to save to IndexedDB
          fetchDidSucceed: async ({ response, request }) => {
            const clonedResponse = response.clone()
            try {
              const data = await clonedResponse.json()
              const db = await dbPromise
              await db.put('api-cache', {
                url: request.url,
                data: data,
                timestamp: Date.now()
              })
            } catch (e) {
              // Ignore non-json or errors
            }
            return response
          }
        }
      ]
    })

    return strategy.handle({ request: newRequest })
  },
  'POST'
)

// ── Push Notifications ─────────────────────────────────────

self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json()
    const options = {
      body: data.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-128x128.png',
      data: {
        url: data.url || '/'
      }
    }

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    )
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  )
})

// ── Standard Caching ─────────────────────────────────────────

// Cache the Google Fonts stylesheets with a stale-while-revalidate strategy.
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({
    cacheName: 'google-fonts-stylesheets',
  })
)

// Cache the underlying font files with a cache-first strategy for 1 year.
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxAgeSeconds: 60 * 60 * 24 * 365,
        maxEntries: 30,
      }),
    ],
  })
)

// Cache images
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
      }),
    ],
  })
)

// Cache CSS and JavaScript files
registerRoute(
  ({ request }) => request.destination === 'script' || request.destination === 'style',
  new StaleWhileRevalidate({
    cacheName: 'static-resources',
  })
)

// Non-SSR fallbacks to index.html
if (process.env.MODE !== 'ssr' || process.env.PROD) {
  registerRoute(
    new NavigationRoute(
      createHandlerBoundToURL(process.env.PWA_FALLBACK_HTML),
      { denylist: [new RegExp(process.env.PWA_SERVICE_WORKER_REGEX), /workbox-(.)*\.js$/] }
    )
  )
}
