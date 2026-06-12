# PLAN: API Feature Polling and Caching Optimization (REVISED)
**Status**: COMPLETED
**Created**: 2026-06-13
**Created By**: Brain Agent (Antigravity)
**Executed By**: Build Agent (Cursor)
**Completed**: 2026-06-12

## Objective
Implement a revised API feature polling mechanism using a Pinia store (`usePollingStore`) to strictly follow [ARCHITECTURE RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/ARCHITECTURE%20RULES.md). The poll request will check for resource updates on the server. The poll response will NOT contain row data; it will return only the list of resources that have server updates. For up-to-date resources, the client will advance their local sync cursors to `serverTime`. For modified resources, the client will trigger `action:get` (via `syncResources(updatedResources, { forceSync: true })`) to pull the delta rows.

## Context
- Roll back all changes to `App.vue` (completed).
- Delete the standalone `PollingService.js` and implement the polling loop inside a new Pinia store: [polling.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/stores/polling.js).
- Update the GAS backend `handlePollAction` to return only the list of modified resources and `serverTime`.
- Update [useAuthLogic.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/core/useAuthLogic.js) to start/stop the polling Pinia store.
- Update [useMainLayoutNavTree.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/layout/useMainLayoutNavTree.js) to start polling on layout initialization.

## Pre-Conditions
- [x] App.vue changes rolled back.
- [x] Required source docs reviewed.

## Steps

### Step 1: Delete Standalone Polling Service & Revert App.vue
- [x] Delete `FRONTENT/src/services/PollingService.js` (replaced by Pinia store).
- [x] Ensure `FRONTENT/src/App.vue` has no polling/auth store imports or calls.

---

### Step 2: Implement Revised Poll Action in GAS Backend
- [x] Update `handlePollAction` in [apiDispatcher.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/apiDispatcher.gs) to return only `updatedResources` and `serverTime` without delta row payloads.

**Files**: [apiDispatcher.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/apiDispatcher.gs)
**Snippet 1 (Modify `handlePollAction` at line 725)**:
Replace `handlePollAction` function (lines 725-769):
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
With:
```js
function handlePollAction(auth, payload) {
  const cursors = payload && payload.cursors ? payload.cursors : {};
  const updatedResources = [];
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
        updatedResources.push(resourceName);
      }
    } catch (e) {
      // Log individual resource permission or fetch errors, but do not block other resources
      console.warn('Error polling resource ' + resourceName + ': ' + e.message);
    }
  });

  return {
    success: true,
    data: {
      updatedResources: updatedResources,
      serverTime: Date.now()
    }
  };
}
```

---

### Step 3: Create Polling Pinia Store
- [x] Create [polling.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/stores/polling.js) to manage interval tiers, poll requests, advancing metadata cursors, and triggering delta fetches.

**Files**: [polling.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/stores/polling.js) [NEW]
**Snippet 1 (Write complete file contents)**:
```javascript
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAuthStore } from './auth'
import { useResourceStatusStore } from './resourceStatus'
import { useResourceIoStore } from './resourceIo'
import { executeGasApi, registerApiRequestListener } from 'src/services/GasApiService'
import { setResourceMeta } from 'src/services/IndexedDbService'
import { createLogger } from 'src/services/_logger'

const logger = createLogger('PollingStore')

const POLLING_CONFIG = [
  { interval: 60, maxRequests: 5 },   // Tier 0: 60s, 5 requests
  { interval: 120, maxRequests: 4 },  // Tier 1: 120s, 4 requests
  { interval: 240, maxRequests: 3 },  // Tier 2: 240s, 3 requests
  { interval: 480, maxRequests: 2 },  // Tier 3: 480s, 2 requests
  { interval: 960, maxRequests: 1 }   // Tier 4: 960s, 1 request
]

export const usePollingStore = defineStore('polling', () => {
  const timer = ref(null)
  const currentTier = ref(0)
  const requestCountInTier = ref(0)
  const currentInterval = ref(60)
  const isPolling = ref(false)

  function start() {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) {
      logger.debug('Cannot start polling: User is not authenticated')
      return
    }

    if (isPolling.value) return
    isPolling.value = true
    logger.info('Polling store started')

    scheduleNextPoll()
  }

  function stop() {
    if (timer.value) {
      clearTimeout(timer.value)
      timer.value = null
    }
    isPolling.value = false
    logger.info('Polling store stopped')
  }

  function reset() {
    currentTier.value = 0
    requestCountInTier.value = 0
    currentInterval.value = 60
    logger.debug('Polling reset: interval = 60s')

    if (isPolling.value) {
      if (timer.value) {
        clearTimeout(timer.value)
        timer.value = null
      }
      scheduleNextPoll()
    }
  }

  function scheduleNextPoll() {
    if (!isPolling.value) return

    const delayMs = currentInterval.value * 1000
    logger.debug(`Scheduling next poll in ${currentInterval.value}s`)

    timer.value = setTimeout(async () => {
      await runPoll()
    }, delayMs)
  }

  async function runPoll() {
    if (!isPolling.value) return

    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) {
      stop()
      return
    }

    const statusStore = useResourceStatusStore()
    const initiatedResources = statusStore.initiated || []

    if (initiatedResources.length === 0) {
      logger.debug('No initiated resources to poll. Skipping poll request.')
      scheduleNextPoll()
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
        const result = response.data?.result || {}
        const updatedResources = Array.isArray(result.updatedResources) ? result.updatedResources : []
        const serverTime = Number(result.serverTime) || Date.now()

        logger.debug('Poll successful', { updatedCount: updatedResources.length })

        // Process each polled resource
        const resourcesToFetch = []
        for (const resourceName of Object.keys(cursors)) {
          if (updatedResources.includes(resourceName)) {
            resourcesToFetch.push(resourceName)
          } else {
            // Advancing cursor locally for up-to-date resources
            const currentMeta = statusStore.byResource[resourceName] || {}
            const nextMeta = {
              headers: currentMeta.headers || [],
              lastSyncAt: serverTime,
              lastFetchAt: Date.now(),
              hasHydratedOnce: true
            }
            await setResourceMeta(resourceName, nextMeta)
            statusStore.applyResourceMeta(resourceName, nextMeta)
          }
        }

        // Trigger action:get for all updated resources
        if (resourcesToFetch.length > 0) {
          logger.info('Syncing modified resources discovered via poll', { resources: resourcesToFetch })
          const resourceIo = useResourceIoStore()
          await resourceIo.syncResources(resourcesToFetch, { forceSync: true })
        }
      } else {
        logger.warn('Poll request unsuccessful', { error: response?.error || response?.message })
      }
    } catch (err) {
      logger.error('Error running poll', err)
    }

    // Increment request count in current tier
    requestCountInTier.value++

    // Determine the next interval
    const tierConfig = POLLING_CONFIG[currentTier.value]
    if (tierConfig) {
      if (requestCountInTier.value < tierConfig.maxRequests) {
        currentInterval.value = tierConfig.interval
      } else {
        currentTier.value++
        requestCountInTier.value = 0
        const nextConfig = POLLING_CONFIG[currentTier.value]
        if (nextConfig) {
          currentInterval.value = nextConfig.interval
        } else {
          currentInterval.value = Math.round(currentInterval.value * 1.5)
        }
      }
    } else {
      currentInterval.value = Math.round(currentInterval.value * 1.5)
    }

    scheduleNextPoll()
  }

  // Register request listener to reset polling on active API mutations
  registerApiRequestListener(() => {
    reset()
  })

  return {
    start,
    stop,
    reset
  }
})
```

---

### Step 4: Hook Polling Store to Auth Life cycle & Layout Initialization
- [x] Start and stop polling in [useAuthLogic.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/core/useAuthLogic.js) via the Pinia store.
- [x] Start polling when layout initializes in [useMainLayoutNavTree.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/layout/useMainLayoutNavTree.js).

**Files**: [useAuthLogic.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/core/useAuthLogic.js), [useMainLayoutNavTree.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/layout/useMainLayoutNavTree.js)

**useAuthLogic.js Snippet 1 (Import Polling Store at line 11)**:
Replace lines 9-11:
```javascript
import { useAuthStore } from 'src/stores/auth'
import { useInitialResourceSync } from 'src/composables/resources/useInitialResourceSync'
import { pollingService } from 'src/services/PollingService'
```
With:
```javascript
import { useAuthStore } from 'src/stores/auth'
import { useInitialResourceSync } from 'src/composables/resources/useInitialResourceSync'
import { usePollingStore } from 'src/stores/polling'
```

**useAuthLogic.js Snippet 2 (Start Polling on Login success at line 76)**:
Replace lines 75-78:
```javascript
        pollingService.start()

        return { success: true }
```
With:
```javascript
        const polling = usePollingStore()
        polling.start()

        return { success: true }
```

**useAuthLogic.js Snippet 3 (Stop Polling on Logout at line 138)**:
Replace lines 138-140:
```javascript
  async function logout() {
    pollingService.stop()
    auth.clearSessionState()
```
With:
```javascript
  async function logout() {
    const polling = usePollingStore()
    polling.stop()
    auth.clearSessionState()
```

**useMainLayoutNavTree.js Snippet 1 (Import Polling Store at line 5)**:
Replace lines 4-5:
```javascript
import { useMenuAccess } from 'src/composables/layout/useMenuAccess'
import { useAuthLogic } from 'src/composables/core/useAuthLogic'
```
With:
```javascript
import { useMenuAccess } from 'src/composables/layout/useMenuAccess'
import { useAuthLogic } from 'src/composables/core/useAuthLogic'
import { usePollingStore } from 'src/stores/polling'
```

**useMainLayoutNavTree.js Snippet 2 (Start Polling on Layout Setup at line 41)**:
Replace lines 41-43:
```javascript
  const { logout } = useAuthLogic()
  const leftDrawerOpen = ref(false)
```
With:
```javascript
  const { logout } = useAuthLogic()
  const polling = usePollingStore()
  const leftDrawerOpen = ref(false)

  // Start polling service on layout mount (safe and idempotent)
  polling.start()
```

---

## Documentation Updates Required
- [x] Update `Documents/GAS_API_CAPABILITIES.md` with the revised poll request/response interface description.

## Acceptance Criteria
- [x] Standalone service file `PollingService.js` is deleted, and no direct service references are used in `App.vue` or composables.
- [x] Polling service logic is encapsulated completely inside a Pinia store (`usePollingStore`).
- [x] Polling request returns only `updatedResources` and `serverTime`. No data rows are returned in the poll payload.
- [x] Client advances local cursors to `serverTime` for all resources that did not have modifications.
- [x] Client triggers a standard `get` request for all resources that had modifications, and ingests updates.
- [x] Polling store starts upon logging in and layout mount, and halts on logout.

## Execution Self-Check Protocol
### Progress Log
- [x] Step 1 completed (Revert App.vue & delete standalone service)
- [x] Step 2 completed (GAS Backend Integration)
- [x] Step 3 completed (Pinia Polling Store Creation)
- [x] Step 4 completed (Layout & Auth Hooks Integration)
