/* eslint-env serviceworker */

/*
 * This file (which will be your service worker)
 * is picked up by the build system ONLY if
 * quasar.config file > pwa > workboxMode is set to "InjectManifest"
 */

import './idb-compat'
import { clientsClaim } from 'workbox-core'
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { StaleWhileRevalidate, CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { openDB } from 'idb'

const DB_NAME = 'aql-db'
const DB_VERSION = 2

let swDbPromise = null
function getDB() {
  if (swDbPromise) return swDbPromise

  swDbPromise = openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('api-cache')) {
        db.createObjectStore('api-cache', { keyPath: 'url' })
      }
      if (!db.objectStoreNames.contains('sync-queue')) {
        db.createObjectStore('sync-queue', { keyPath: 'id', autoIncrement: true })
      }
      if (!db.objectStoreNames.contains('app-data')) {
        db.createObjectStore('app-data')
      }
      if (!db.objectStoreNames.contains('resource-meta')) {
        db.createObjectStore('resource-meta', { keyPath: 'resource' })
      }
      if (!db.objectStoreNames.contains('resource-records')) {
        const store = db.createObjectStore('resource-records', { keyPath: 'id' })
        store.createIndex('by-resource', 'resource', { unique: false })
        store.createIndex('by-resource-updatedAt', ['resource', 'updatedAt'], { unique: false })
      }
    },
    blocked() {
      console.warn('[SW] DB open blocked')
    },
    blocking() {
      console.warn('[SW] DB version change requested elsewhere, closing...')
      if (swDbPromise) {
        swDbPromise.then(db => db.close()).catch(() => {})
        swDbPromise = null
      }
    }
  })
  return swDbPromise
}

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
    if (authToken === null && swDbPromise) {
      swDbPromise.then(db => db.close()).catch(() => {})
      swDbPromise = null
    }
  }
  if (event.data && event.data.type === 'CLOSE_DB') {
    console.log('[SW] Close DB requested')
    if (swDbPromise) {
      swDbPromise.then(db => db.close()).catch(() => {})
      swDbPromise = null
    }
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

    const response = await fetch(newRequest)

    // Mirror successful JSON responses to IDB for optional offline diagnostics.
    const clonedResponse = response.clone()
    try {
      const data = await clonedResponse.json()
      const db = await getDB()
      await db.put('api-cache', {
        url: newRequest.url,
        data: data,
        timestamp: Date.now()
      })
    } catch (e) {
      // Ignore non-json or cache write errors
    }

    return response
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
  const swRegex = process.env.PWA_SERVICE_WORKER_REGEX || 'sw.js'
  registerRoute(
    new NavigationRoute(
      createHandlerBoundToURL(process.env.PWA_FALLBACK_HTML),
      { denylist: [new RegExp(swRegex), /workbox-(.)*\.js$/] }
    )
  )
}
