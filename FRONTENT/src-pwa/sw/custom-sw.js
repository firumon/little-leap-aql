/* eslint-env serviceworker */

import './idb-compat'
import {
  precacheAndRoute,
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  PrecacheController
} from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { StaleWhileRevalidate, CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { openDB } from 'idb'

const DB_NAME = 'aql-db'
const DB_VERSION = 2

let swDbPromise = null
function getDB () {
  if (swDbPromise) return swDbPromise

  swDbPromise = openDB(DB_NAME, DB_VERSION, {
    upgrade (db) {
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
    blocked () {
      console.warn('[SW] DB open blocked')
    },
    blocking () {
      console.warn('[SW] DB version change requested elsewhere, closing...')
      if (swDbPromise) {
        swDbPromise.then((db) => db.close()).catch(() => {})
        swDbPromise = null
      }
    }
  })
  return swDbPromise
}

const CONCURRENCY_LIMIT = 20

// Depends on workbox-precaching v7 internals; falls back to default install when they change.
const originalInstall = PrecacheController.prototype.install

PrecacheController.prototype.install = function (event) {
  if (!(this._urlsToCacheKeys instanceof Map && typeof this.strategy?.handleAll === 'function')) {
    console.warn('[SW] Parallel precache unavailable, using default install')
    return originalInstall.call(this, event)
  }

  const p = (async () => {
    const entries = Array.from(this._urlsToCacheKeys.entries())
    let index = 0

    const workers = Array.from({ length: Math.min(CONCURRENCY_LIMIT, entries.length) }, async () => {
      while (index < entries.length) {
        const [url, cacheKey] = entries[index++]
        const integrity = this._cacheKeysToIntegrities?.get(cacheKey)
        const cacheMode = this._urlsToCacheModes?.get(url)
        const request = new Request(url, {
          integrity,
          cache: cacheMode,
          credentials: 'same-origin'
        })
        await Promise.all(this.strategy.handleAll({
          params: { cacheKey },
          request,
          event
        }))
      }
    })

    await Promise.all(workers)
  })()

  event.waitUntil(p)
  return p
}

precacheAndRoute(self.__WB_MANIFEST)

cleanupOutdatedCaches()

let authToken = null

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_AUTH_TOKEN') {
    authToken = event.data.token
    console.log('[SW] Auth Token updated')
    if (authToken === null && swDbPromise) {
      swDbPromise.then((db) => db.close()).catch(() => {})
      swDbPromise = null
    }
  }
  if (event.data && event.data.type === 'CLOSE_DB') {
    console.log('[SW] Close DB requested')
    if (swDbPromise) {
      swDbPromise.then((db) => db.close()).catch(() => {})
      swDbPromise = null
    }
  }
  // Only the user's Reload action (and the cold-start apply) may send this; never call skipWaiting automatically, or the open app loses its files.
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

registerRoute(
  ({ request }) => request.mode === 'navigate',
  createHandlerBoundToURL('index.html')
)

registerRoute(
  ({ url }) =>
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.webp'),
  new CacheFirst({
    cacheName: 'image-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200]
      })
    ]
  })
)

registerRoute(
  ({ url }) => url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com'),
  new StaleWhileRevalidate({
    cacheName: 'google-fonts',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 365 * 24 * 60 * 60
      })
    ]
  })
)

registerRoute(
  ({ url }) => url.pathname.includes('/api/') || url.hostname.includes('script.google.com'),
  async ({ request }) => {
    if (request.method !== 'GET') {
      return fetch(request)
    }

    const db = await getDB()
    const cacheKey = request.url

    try {
      const response = await fetch(request)
      if (response && response.status === 200) {
        const clonedResponse = response.clone()
        const data = await clonedResponse.json()
        await db.put('api-cache', {
          url: cacheKey,
          data,
          timestamp: Date.now()
        })
      }
      return response
    } catch {
      const cached = await db.get('api-cache', cacheKey)
      if (cached) {
        return new Response(JSON.stringify(cached.data), {
          headers: { 'Content-Type': 'application/json' }
        })
      }
      return new Response(JSON.stringify({ error: 'Offline and no cached data' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
)
