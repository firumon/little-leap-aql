import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAuthStore } from './auth'
import { useResourceStatusStore } from './resourceStatus'
import { useResourceIoStore } from './resourceIo'
import {
  executeGasApi,
  registerApiRequestListener,
  registerApiResponseListener
} from 'src/services/GasApiService'
import { setResourceMeta } from 'src/services/IndexedDbService'
import { createLogger } from 'src/services/_logger'

const logger = createLogger('PollingStore')

/**
 * Progressive escalation ladder. The client polls fast while the session looks
 * active, then stretches the gap as the session stays quiet, so an idle tab
 * costs the GAS quota (and the device battery) almost nothing.
 *
 * Any user-driven API call collapses the ladder back to Tier 0 — a user who is
 * writing data is a user whose screen must stay fresh.
 */
const POLLING_CONFIG = [
  { interval: 30, maxRequests: 30 },        // Tier 0: 30s  x 30
  { interval: 60, maxRequests: 30 },        // Tier 1: 60s  x 30
  { interval: 120, maxRequests: 30 },       // Tier 2: 120s x 30
  { interval: 240, maxRequests: 30 },       // Tier 3: 240s x 30
  { interval: 480, maxRequests: 15 },       // Tier 4: 480s x 15
  { interval: 960, maxRequests: Infinity }  // Tier 5: 960s, idle floor
]

const BASE_TIER = 0
const BASE_INTERVAL = POLLING_CONFIG[BASE_TIER].interval

export const usePollingStore = defineStore('polling', () => {
  const timer = ref(null)
  const currentTier = ref(BASE_TIER)
  const requestCountInTier = ref(0)
  const currentInterval = ref(BASE_INTERVAL)
  const isPolling = ref(false)
  const waiting = ref(false)
  const inflight = ref(false)

  /** Clears the pending countdown. Always call before scheduling, so no two timers can co-exist. */
  function clearTimer() {
    if (timer.value) {
      clearTimeout(timer.value)
      timer.value = null
    }
    waiting.value = false
  }

  function applyTier(tierIndex) {
    const index = Math.min(Math.max(tierIndex, BASE_TIER), POLLING_CONFIG.length - 1)
    currentTier.value = index
    currentInterval.value = POLLING_CONFIG[index].interval
  }

  function resetTier() {
    requestCountInTier.value = 0
    applyTier(BASE_TIER)
  }

  function scheduleNextPoll() {
    clearTimer()
    if (!isPolling.value) return

    const delayMs = currentInterval.value * 1000
    logger.debug(`Scheduling next poll in ${currentInterval.value}s`)

    waiting.value = true
    timer.value = setTimeout(() => {
      timer.value = null
      waiting.value = false
      runPoll()
    }, delayMs)
  }

  function start() {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) {
      logger.debug('Cannot start polling: User is not authenticated')
      return
    }

    if (isPolling.value) return
    isPolling.value = true
    inflight.value = false
    resetTier()
    logger.info('Polling store started')

    scheduleNextPoll()
  }

  function stop() {
    clearTimer()
    isPolling.value = false
    inflight.value = false
    logger.info('Polling store stopped')
  }

  /** Pauses the countdown while a user-driven API call is in flight. */
  function pause() {
    if (!isPolling.value) return
    clearTimer()
    logger.debug('Polling paused: API request in flight')
  }

  /** Collapses back to Tier 0 and restarts the countdown. */
  function reset() {
    if (!isPolling.value) return
    resetTier()
    logger.debug(`Polling reset: interval = ${BASE_INTERVAL}s`)
    scheduleNextPoll()
  }

  function escalateTier() {
    const tierConfig = POLLING_CONFIG[currentTier.value]
    if (!tierConfig) {
      applyTier(POLLING_CONFIG.length - 1)
      return
    }

    requestCountInTier.value++
    if (requestCountInTier.value < tierConfig.maxRequests) return

    if (currentTier.value >= POLLING_CONFIG.length - 1) {
      // Idle floor: stay here indefinitely.
      requestCountInTier.value = 0
      return
    }

    requestCountInTier.value = 0
    applyTier(currentTier.value + 1)
    logger.debug(`Polling escalated to tier ${currentTier.value} (${currentInterval.value}s)`)
  }

  async function runPoll() {
    if (!isPolling.value || inflight.value) return

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
      cursors[name] = statusStore.lastSync[name] || 0
    })

    logger.info('Executing poll for resources', { count: initiatedResources.length })

    inflight.value = true
    try {
      const response = await executeGasApi('poll', { cursors }, { requireAuth: true })

      if (response && response.success) {
        const result = response.data?.result || {}
        const updatedResources = Array.isArray(result.updatedResources) ? result.updatedResources : []
        // serverTime is stamped by GAS BEFORE it reads any resource cursor, so
        // anchoring unchanged resources to it cannot skip a write that landed
        // while the poll was being evaluated.
        const serverTime = Number(result.serverTime) || null

        logger.debug('Poll successful', { updatedCount: updatedResources.length })

        if (serverTime) {
          for (const resourceName of Object.keys(cursors)) {
            // Changed resources keep their old cursor; it only advances once the
            // delta `get` fetch below succeeds and the rows are ingested.
            if (updatedResources.includes(resourceName)) continue

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

        if (updatedResources.length > 0) {
          logger.info('Syncing modified resources discovered via poll', { resources: updatedResources })
          const resourceIo = useResourceIoStore()
          await resourceIo.syncResources(updatedResources, { forceSync: true })
        }
      } else {
        logger.warn('Poll request unsuccessful', { error: response?.error || response?.message })
      }
    } catch (err) {
      logger.error('Error running poll', err)
    } finally {
      inflight.value = false
    }

    escalateTier()
    scheduleNextPoll()
  }

  return {
    currentTier,
    requestCountInTier,
    currentInterval,
    isPolling,
    waiting,
    inflight,
    start,
    stop,
    pause,
    reset
  }
})

// A user-driven request is starting: drop the pending countdown so the poll
// cannot fire on top of the user's own transaction.
registerApiRequestListener(() => {
  usePollingStore().pause()
})

// That request has settled (success or failure): the user is active, so
// collapse back to Tier 0 and start a fresh countdown.
registerApiResponseListener(() => {
  usePollingStore().reset()
})
