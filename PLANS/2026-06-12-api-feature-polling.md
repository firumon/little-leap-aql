# PLAN: API Feature Polling and Caching Optimization
**Status**: COMPLETED
**Created**: 2026-06-12
**Created By**: Brain Agent (Antigravity)
**Executed By**: Build Agent (Antigravity)

## Objective
Implement a pilot API feature polling mechanism with a backoff interval strategy that checks for resource updates on the server (`App.Resources.LastDataUpdatedAt`) and pulls only delta updates for initialized resources. In addition, optimize page transitions to use local IndexedDB cache-first and avoid redundant `get` API requests on page mount.

## Context
- The frontend currently performs a server sync of resources on page visit/mount.
- We need to stop the page visits from doing immediate server sync if they have already hydrated once.
- We need to poll for updates of initialized resources at a backoff interval (60s -> 120s -> 240s -> 480s -> 960s -> increase by 50% on every request).
- Any request from the frontend to GAS (except the poll request itself) should reset the polling interval and schedule back to 60s.
- Manual reload via the refresh button should still force a server fetch and reset polling.

## Pre-Conditions
- [x] Required access/credentials are available.
- [x] Required source docs were reviewed.
- [x] User confirmed Low-Capability (Option B) plan structure.

## Steps

### Step 1: Implement Poll Action in GAS Backend
- [ ] Add the `poll` case to `dispatchProtectedAction` in [apiDispatcher.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/apiDispatcher.gs#L398-L443).
- [ ] Add `handlePollAction` helper function at the end of [apiDispatcher.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/apiDispatcher.gs).

**Files**: [apiDispatcher.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/apiDispatcher.gs)
**Snippet 1 (Modify `dispatchProtectedAction` at line 433)**:
Replace lines 433-436:
```js
    // Report scope
    case 'generateReport':
      return generateReportPdf(auth, data);
```
With:
```js
    // Polling action for resource updates
    case 'poll':
      return handlePollAction(auth, data);

    // Report scope
    case 'generateReport':
      return generateReportPdf(auth, data);
```

**Snippet 2 (Append `handlePollAction` at the end of file)**:
Add the following code to the very end of [apiDispatcher.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/apiDispatcher.gs):
```js
function handlePollAction(auth, payload) {
  const cursors = payload && payload.cursors ? payload.cursors : {};
  const updatedResources = {};
  const configMap = getResourceConfigMap() || {};

  Object.keys(cursors).forEach(function (resourceName) {
    try {
      const clientCursor = Number(cursors[resourceName]) || 0;
      const config = configMap[resourceName];
      if (!config) return;

      // Check if user has read permission
      enforceMasterPermission(auth, resourceName, 'canRead');

      // Compare client cursor with server's LastDataUpdatedAt
      const serverLastUpdated = config.lastDataUpdatedAt || 0;
      if (serverLastUpdated > clientCursor) {
        // Fetch only the delta updates
        const result = handleResourceGetRecords(auth, {
          resource: resourceName,
          lastUpdatedAt: clientCursor
        });

        if (result && result.success) {
          updatedResources[resourceName] = {
            rows: result.rows,
            meta: result.meta
          };
        }
      }
    } catch (e) {
      // Log individual resource permission or fetch errors, but do not block other resources
      console.warn('Error polling resource ' + resourceName + ': ' + e.message);
    }
  });

  return {
    success: true,
    data: {
      resources: updatedResources
    }
  };
}
```

---

### Step 2: Implement Request Interceptor in Frontend GAS Service
- [ ] Add an API request listener registry to reset polling.
- [ ] Call the listener callback in `executeGasApi` in [GasApiService.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/services/GasApiService.js#L205) when the action is not `poll`.

**Files**: [GasApiService.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/services/GasApiService.js)
**Snippet 1 (Add Listener Variable and Exporter at line 10)**:
Replace lines 9-10:
```javascript
const logger = createLogger('GasApiService')

const API_VERSION = 'v1'
```
With:
```javascript
const logger = createLogger('GasApiService')

const API_VERSION = 'v1'

let onApiRequestCallback = null

export function registerApiRequestListener(callback) {
  onApiRequestCallback = callback
}
```

**Snippet 2 (Trigger Callback in `executeGasApi` at line 219)**:
Replace lines 218-220:
```javascript
  const requestBody = buildCanonicalRequest(action, payload, authToken, requireAuth)

  try {
```
With:
```javascript
  const requestBody = buildCanonicalRequest(action, payload, authToken, requireAuth)

  if (action !== 'poll' && typeof onApiRequestCallback === 'function') {
    try {
      onApiRequestCallback(action)
    } catch (e) {
      // Safe boundary check
    }
  }

  try {
```

---

### Step 3: Implement Polling Service with Backoff Logic
- [ ] Create a new file [PollingService.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/services/PollingService.js) that manages the polling loop and registers the API request listener.

**Files**: [PollingService.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/services/PollingService.js) [NEW]
**Snippet 1 (Write complete file contents)**:
```javascript
import { useAuthStore } from 'src/stores/auth'
import { useResourceStatusStore } from 'src/stores/resourceStatus'
import { executeGasApi, registerApiRequestListener } from 'src/services/GasApiService'
import { createLogger } from './_logger'

const logger = createLogger('PollingService')

const POLLING_CONFIG = [
  { interval: 60, maxRequests: 5 },   // Tier 0: 60s, 5 requests
  { interval: 120, maxRequests: 4 },  // Tier 1: 120s, 4 requests
  { interval: 240, maxRequests: 3 },  // Tier 2: 240s, 3 requests
  { interval: 480, maxRequests: 2 },  // Tier 3: 480s, 2 requests
  { interval: 960, maxRequests: 1 }   // Tier 4: 960s, 1 request
]

class PollingService {
  constructor() {
    this.timer = null
    this.currentTier = 0
    this.requestCountInTier = 0
    this.currentInterval = 60
    this.isPolling = false
  }

  start() {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) {
      logger.debug('Cannot start polling: User is not authenticated')
      return
    }

    if (this.isPolling) return
    this.isPolling = true
    logger.info('Polling service started')

    this.scheduleNextPoll()
  }

  stop() {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.isPolling = false
    logger.info('Polling service stopped')
  }

  reset() {
    this.currentTier = 0
    this.requestCountInTier = 0
    this.currentInterval = 60
    logger.debug('Polling reset: interval = 60s')

    if (this.isPolling) {
      if (this.timer) {
        clearTimeout(this.timer)
        this.timer = null
      }
      this.scheduleNextPoll()
    }
  }

  scheduleNextPoll() {
    if (!this.isPolling) return

    const delayMs = this.currentInterval * 1000
    logger.debug(`Scheduling next poll in ${this.currentInterval}s`)

    this.timer = setTimeout(async () => {
      await this.runPoll()
    }, delayMs)
  }

  async runPoll() {
    if (!this.isPolling) return

    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) {
      this.stop()
      return
    }

    const statusStore = useResourceStatusStore()
    const initiatedResources = statusStore.initiated || []

    if (initiatedResources.length === 0) {
      logger.debug('No initiated resources to poll. Skipping poll request.')
      this.scheduleNextPoll()
      return
    }

    const cursors = {}
    initiatedResources.forEach((name) => {
      const syncTime = statusStore.lastSync[name]
      cursors[name] = syncTime || 0
    })

    logger.info('Executing poll for resources', { count: initiatedResources.length })

    try {
      const response = await executeGasApi('poll', { cursors }, { requireAuth: true })

      if (response && response.success) {
        logger.debug('Poll successful', { resourcesUpdated: Object.keys(response.data?.resources || {}).length })
      } else {
        logger.warn('Poll request unsuccessful', { error: response?.error || response?.message })
      }
    } catch (err) {
      logger.error('Error running poll', err)
    }

    // Increment request count in the current tier
    this.requestCountInTier++

    // Determine the next interval
    const tierConfig = POLLING_CONFIG[this.currentTier]
    if (tierConfig) {
      if (this.requestCountInTier < tierConfig.maxRequests) {
        this.currentInterval = tierConfig.interval
      } else {
        // Move to next tier
        this.currentTier++
        this.requestCountInTier = 0
        const nextConfig = POLLING_CONFIG[this.currentTier]
        if (nextConfig) {
          this.currentInterval = nextConfig.interval
        } else {
          // Exceeded configured tiers, multiply current interval by 1.5
          this.currentInterval = Math.round(this.currentInterval * 1.5)
        }
      }
    } else {
      // Already beyond config tiers, continue multiplying by 1.5
      this.currentInterval = Math.round(this.currentInterval * 1.5)
    }

    // Schedule the next poll
    this.scheduleNextPoll()
  }
}

export const pollingService = new PollingService()

// Register request interceptor listener to reset polling on any non-polling activity
registerApiRequestListener(() => {
  pollingService.reset()
})
```

---

### Step 4: Hook Polling Service to App Lifetime and Auth State
- [ ] Initialize the client session on app load in [App.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/App.vue) and start polling if already logged in.
- [ ] Start polling after successful login and stop polling on logout in [useAuthLogic.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/core/useAuthLogic.js).

**Files**: [App.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/App.vue), [useAuthLogic.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/core/useAuthLogic.js)
**App.vue Snippet 1 (Import Polling Service at line 9)**:
Replace lines 8-9:
```javascript
import { requestNotificationPermission, subscribeToPush } from 'src/utils/notifications'
import { useQuasar } from 'quasar'
```
With:
```javascript
import { requestNotificationPermission, subscribeToPush } from 'src/utils/notifications'
import { useQuasar } from 'quasar'
import { pollingService } from 'src/services/PollingService'
```

**App.vue Snippet 2 (Restore Client Session and Start Polling at line 43)**:
Replace lines 42-45:
```javascript
  // Sync token with Service Worker on app load
  if (authStore.token) {
    authStore.notifyServiceWorker(authStore.token)
  }
```
With:
```javascript
  // Sync token with Service Worker on app load
  if (authStore.token) {
    authStore.notifyServiceWorker(authStore.token)
    authStore.initializeClientSession(false)
      .then(() => {
        pollingService.start()
      })
      .catch((e) => {
        console.error('[App] Failed to initialize client session:', e)
      })
  }
```

**useAuthLogic.js Snippet 1 (Import Polling Service at line 11)**:
Replace lines 9-11:
```javascript
import { useAuthStore } from 'src/stores/auth'
import { useInitialResourceSync } from 'src/composables/resources/useInitialResourceSync'
```
With:
```javascript
import { useAuthStore } from 'src/stores/auth'
import { useInitialResourceSync } from 'src/composables/resources/useInitialResourceSync'
import { pollingService } from 'src/services/PollingService'
```

**useAuthLogic.js Snippet 2 (Start Polling on Login at line 72)**:
Replace lines 72-76:
```javascript
          .finally(() => {
            auth.isGlobalSyncing = false
          })

        return { success: true }
```
With:
```javascript
          .finally(() => {
            auth.isGlobalSyncing = false
          })

        pollingService.start()

        return { success: true }
```

**useAuthLogic.js Snippet 3 (Stop Polling on Logout at line 137)**:
Replace lines 137-142:
```javascript
  async function logout() {
    auth.clearSessionState()

    try {
      await auth.clearClientSession()
    } catch (_) {}
```
With:
```javascript
  async function logout() {
    pollingService.stop()
    auth.clearSessionState()

    try {
      await auth.clearClientSession()
    } catch (_) {}
```

---

### Step 5: Optimize Frontend Data Hydration & Sync Options
- [ ] Modify [ResourceIoService.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/services/ResourceIoService.js) to only call `syncResourcesBatch` during page mount/loads if the resource has not hydrated/initialized once, OR if it's a manual reload (`forceSync`).
- [ ] Pass `forceSync` in `syncResources` and `fetchResources` in [resourceIo.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/stores/resourceIo.js).
- [ ] Pass `forceSync: true` in `reloadDependencies` in [useResourceReload.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/resources/useResourceReload.js).

**Files**: [ResourceIoService.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/services/ResourceIoService.js), [resourceIo.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/stores/resourceIo.js), [useResourceReload.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/resources/useResourceReload.js)

**ResourceIoService.js Snippet 1 (Update `fetchResourceRecords` at line 416)**:
Replace lines 416-431:
```javascript
    const hasUsableHydration = hasHydratedOnce || !!effectiveCursor
    const shouldImmediateSync = !hasUsableHydration
      || !cacheRefreshedAt
      || (cachedRows.length
        ? !isWithinTtl(cacheRefreshedAt, ttlMs)
        : !isWithinTtl(cacheRefreshedAt, emptyCacheThrottleMs))

    logger.debug('Determining sync strategy', { resource: resourceName, shouldSync: shouldImmediateSync })

    if (shouldImmediateSync) {
      if (!cachedRows.length && syncCursor) {
        await setResourceMeta(resourceName, { lastSyncAt: null })
      }

      const batchSyncResponse = await syncResourcesBatch([resourceName], authorizedResources, appConfig, {
        showError: !cachedRows.length,
        showLoading: !cachedRows.length,
        resourceStatus
      })
```
With:
```javascript
    const hasUsableHydration = hasHydratedOnce || !!effectiveCursor
    const isManualReload = options.forceSync === true
    const shouldImmediateSync = !hasUsableHydration || isManualReload

    logger.debug('Determining sync strategy', { resource: resourceName, shouldSync: shouldImmediateSync })

    if (shouldImmediateSync) {
      if (!cachedRows.length && syncCursor) {
        await setResourceMeta(resourceName, { lastSyncAt: null })
      }

      const batchSyncResponse = await syncResourcesBatch([resourceName], authorizedResources, appConfig, {
        showError: !cachedRows.length,
        showLoading: !cachedRows.length,
        forceSync: isManualReload,
        resourceStatus
      })
```

**ResourceIoService.js Snippet 2 (Update `fetchResourceRecordsBatch` at line 521)**:
Replace lines 521-535:
```javascript
      let shouldSync = false
      const populatedCacheFreshEnough = cachedRows.length > 0 && isWithinTtl(cacheRefreshedAt, ttlMs)

      if (!emptyCacheFreshEnough && (!cachedRows.length || !populatedCacheFreshEnough)) {
        const hasUsableHydration = hasHydratedOnce || !!effectiveCursor
        shouldSync = !hasUsableHydration ||
          !cacheRefreshedAt ||
          (cachedRows.length
            ? now >= cacheRefreshedAt + ttlMs
            : now >= cacheRefreshedAt + emptyCacheThrottleMs)
      }

      if (shouldSync) {
        syncNames.push(resourceName)
      }
```
With:
```javascript
      const hasUsableHydration = hasHydratedOnce || !!effectiveCursor
      const isManualReload = options.forceSync === true
      const shouldSync = !hasUsableHydration || isManualReload

      if (shouldSync) {
        syncNames.push(resourceName)
      }
```

**ResourceIoService.js Snippet 3 (Pass `forceSync` to `syncResourcesBatch` inside `fetchResourceRecordsBatch` at line 556)**:
Replace lines 556-560:
```javascript
      const syncResponse = await syncResourcesBatch(syncNames, authorizedResources, appConfig, {
        showError: options.showError === true,
        showLoading: options.showLoading === true,
        resourceStatus
      })
```
With:
```javascript
      const syncResponse = await syncResourcesBatch(syncNames, authorizedResources, appConfig, {
        showError: options.showError === true,
        showLoading: options.showLoading === true,
        forceSync: options.forceSync === true,
        resourceStatus
      })
```

**resourceIo.js Snippet 1 (Forward `forceSync` in `fetchResources` at line 152)**:
Replace lines 152-156:
```javascript
    const response = await fetchResourceRecordsBatch(resources, authorizedResources, appConfig, {
      showLoading: payload.showLoading === true,
      showError: payload.showError === true,
      resourceStatus
    })
```
With:
```javascript
    const response = await fetchResourceRecordsBatch(resources, authorizedResources, appConfig, {
      showLoading: payload.showLoading === true,
      showError: payload.showError === true,
      forceSync: payload.forceSync === true,
      resourceStatus
    })
```

**resourceIo.js Snippet 2 (Forward `forceSync` in `syncResources` at line 188)**:
Replace lines 188-192:
```javascript
    const response = await syncResourcesBatch(resources, authorizedResources, appConfig, {
      showLoading: options.showLoading === true,
      showError: options.showError === true,
      resourceStatus
    })
```
With:
```javascript
    const response = await syncResourcesBatch(resources, authorizedResources, appConfig, {
      showLoading: options.showLoading === true,
      showError: options.showError === true,
      forceSync: options.forceSync === true,
      resourceStatus
    })
```

**useResourceReload.js Snippet 1 (Set `forceSync: true` in `reloadDependencies` at line 104)**:
Replace lines 104-107:
```javascript
    return resourceIo.syncResources(resources, {
      showLoading: options.showLoading === true,
      showError: options.showError !== false
    })
```
With:
```javascript
    return resourceIo.syncResources(resources, {
      showLoading: options.showLoading === true,
      showError: options.showError !== false,
      forceSync: true
    })
```

---

## Documentation Updates Required
- [ ] Add description of the polling action request/response schema in `Documents/GAS_API_CAPABILITIES.md`.
- [ ] Update `Documents/ARCHITECTURE RULES.md` with guidelines on page visits utilizing IndexedDB cache-first with polling updates, rather than raw server calls.

## Acceptance Criteria
- [ ] Page mounts do not send individual `action:get` server requests if the resources are already hydrated.
- [ ] Clicking the manual reload button sends a server `get` request (delta sync) and resets the polling interval.
- [ ] Polling triggers on a 60-second interval initially, and after 5 requests, increases to 120s (then 240s, 480s, 960s, and by 50% thereafter).
- [ ] Any outgoing user action or custom mutation api request (e.g. create, update, compositeSave) resets the polling cycle and schedules the next poll 60s out.
- [ ] Polling payloads correctly contain all initiated resources with their local last sync cursors.
- [ ] GAS backend correctly processes the `poll` action by comparing cursors to `App.Resources.LastDataUpdatedAt` and returns delta updates.

## Execution Self-Check Protocol
### Progress Log
- [ ] Step 1 completed (GAS Backend Integration)
- [ ] Step 2 completed (Frontend API Request Listener)
- [ ] Step 3 completed (Polling Service Creation)
- [ ] Step 4 completed (App Lifecycle hooks)
- [ ] Step 5 completed (Hydration & Caching Optimization)

### Files Actually Changed
- `GAS/apiDispatcher.gs`
- `FRONTENT/src/services/GasApiService.js`
- `FRONTENT/src/services/PollingService.js`
- `FRONTENT/src/App.vue`
- `FRONTENT/src/composables/core/useAuthLogic.js`
- `FRONTENT/src/services/ResourceIoService.js`
- `FRONTENT/src/stores/resourceIo.js`
- `FRONTENT/src/composables/resources/useResourceReload.js`

### Validation Performed
- [ ] Local build runs successfully (`npm run build` inside `FRONTENT/`)
- [ ] Polling loop triggers and backoff delays are calculated correctly.
