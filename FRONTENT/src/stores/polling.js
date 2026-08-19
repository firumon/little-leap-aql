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
import { DEFAULT_REQUEST_TIMEOUT_MS } from 'src/services/ApiClientService'
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

/** A poll is a cursor comparison, not a write — it has no business taking long. */
const POLL_TIMEOUT_MS = 45000

const BASE_TIER = 0
const BASE_INTERVAL = POLLING_CONFIG[BASE_TIER].interval

/**
 * How often the watchdog checks that the machine is still alive, and how long a
 * request may stay pending before it is written off. The write-off threshold
 * sits above the axios ceiling so a request that is merely slow is never
 * mistaken for one that vanished.
 */
const WATCHDOG_INTERVAL_MS = 60000
const PENDING_REQUEST_MAX_AGE_MS = DEFAULT_REQUEST_TIMEOUT_MS + 60000

export const usePollingStore = defineStore('polling', () => {
  const timer = ref(null)
  const watchdog = ref(null)
  const currentTier = ref(BASE_TIER)
  const requestCountInTier = ref(0)
  const currentInterval = ref(BASE_INTERVAL)
  const isPolling = ref(false)

  /**
   * The machine has exactly three resting states, and `waiting`/`inflight` are
   * mutually exclusive:
   *
   *   waiting  — a countdown is pending, nothing in flight
   *   inflight — a poll request is open
   *   neither  — a non-poll API call is running; the countdown is suspended
   *              until it settles, so a poll never lands on top of a
   *              transaction the user (or the sync path) is in the middle of.
   */
  const waiting = ref(false)
  const inflight = ref(false)

  // A COUNT, not a flag: overlapping API calls must all settle before the
  // countdown resumes. Restarting when the first one lands would let a poll
  // fire while the others are still open.
  const pendingRequests = ref(0)
  const oldestPendingAt = ref(null)

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
    startWatchdog()
    logger.info('Polling store started')

    // Login fires the initial resource sync before this runs, so there may
    // already be calls in flight. resumeCountdown honours them and lets their
    // settle notification start the countdown instead.
    resumeCountdown()
  }

  function stop() {
    clearTimer()
    stopWatchdog()
    isPolling.value = false
    inflight.value = false
    pendingRequests.value = 0
    oldestPendingAt.value = null
    logger.info('Polling store stopped')
  }

  /**
   * Restarts the countdown, but only from a state that is allowed to have one.
   * Every path that ends an activity funnels through here rather than calling
   * scheduleNextPoll directly, so the mutual exclusion above cannot be broken
   * by two callers racing.
   */
  function resumeCountdown() {
    if (!isPolling.value) return
    if (inflight.value) return          // the poll's own completion will resume
    if (pendingRequests.value > 0) return // another API call is still open
    scheduleNextPoll()
  }

  /** A non-poll API call has started: suspend the countdown for its duration. */
  function noteRequestStarted() {
    pendingRequests.value++
    if (pendingRequests.value === 1) {
      oldestPendingAt.value = Date.now()
    }
    if (!isPolling.value) return
    clearTimer()
  }

  /**
   * A non-poll API call has settled.
   *
   * @param {Object} [options]
   * @param {boolean} [options.background] true when the poller issued the call
   *   itself. Such a call still gated the countdown, but it is not evidence of
   *   a user at the keyboard, so it must not collapse the escalation ladder.
   */
  function noteRequestSettled(options = {}) {
    pendingRequests.value = Math.max(0, pendingRequests.value - 1)
    if (pendingRequests.value === 0) {
      oldestPendingAt.value = null
    }
    if (!isPolling.value) return
    if (options.background !== true) {
      resetTier()
    }
    resumeCountdown()
  }

  /**
   * Last line of defence. The machine parks in the "neither" state on every API
   * call and relies on a settle notification to leave it; if one never arrives
   * — a listener throws, a response is lost, a tab is suspended mid-flight —
   * polling would stay dead for the rest of the session with nothing to notice.
   */
  function runWatchdog() {
    if (!isPolling.value) return
    if (waiting.value || inflight.value) return

    const stuckSince = oldestPendingAt.value
    if (pendingRequests.value > 0) {
      if (!stuckSince || Date.now() - stuckSince < PENDING_REQUEST_MAX_AGE_MS) return
      logger.warn('Abandoning stale in-flight API requests', {
        pending: pendingRequests.value,
        ageMs: Date.now() - stuckSince
      })
      pendingRequests.value = 0
      oldestPendingAt.value = null
    }

    logger.warn('Watchdog restarting stalled polling countdown')
    resumeCountdown()
  }

  function startWatchdog() {
    stopWatchdog()
    watchdog.value = setInterval(runWatchdog, WATCHDOG_INTERVAL_MS)
  }

  function stopWatchdog() {
    if (watchdog.value) {
      clearInterval(watchdog.value)
      watchdog.value = null
    }
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
    // A call slipped in between the timer firing and this running.
    if (pendingRequests.value > 0) {
      resumeCountdown()
      return
    }

    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) {
      stop()
      return
    }

    const statusStore = useResourceStatusStore()
    const initiatedResources = statusStore.initiated || []

    if (initiatedResources.length === 0) {
      logger.debug('No initiated resources to poll. Skipping poll request.')
      resumeCountdown()
      return
    }

    const cursors = {}
    initiatedResources.forEach((name) => {
      // Poll against the DATA cursor. lastSyncAt is only a round-trip stamp and
      // drifts ahead of the newest record, which used to mask every change.
      cursors[name] = statusStore.byResource[name]?.lastDataUpdatedAt
        || statusStore.lastSync[name]
        || 0
    })

    logger.info('Executing poll for resources', { count: initiatedResources.length })

    inflight.value = true
    let updatedResources = []
    try {
      const response = await executeGasApi('poll', { cursors }, {
        requireAuth: true,
        // The heartbeat is tiny; it must not inherit the write-sized ceiling.
        timeout: POLL_TIMEOUT_MS
      })

      if (response && response.success) {
        const result = response.data?.result || {}
        updatedResources = Array.isArray(result.updatedResources) ? result.updatedResources : []

        logger.debug('Poll successful', { updatedCount: updatedResources.length })

        // An empty poll proves only that we talked to the server — it says
        // nothing about the data. Bump the local heartbeat and leave
        // lastDataUpdatedAt / lastSyncAt exactly where they are; advancing them
        // to serverTime pushed the cursor past writes that had not been fetched
        // yet, so those changes were never detected again.
        //
        // Each write is isolated: one bad record must not abort the run and
        // strand the delta fetch below, which is exactly what a DataCloneError
        // here used to do — silently, on every single poll.
        for (const resourceName of Object.keys(cursors)) {
          if (updatedResources.includes(resourceName)) continue

          const currentMeta = statusStore.byResource[resourceName] || {}
          const nextMeta = {
            headers: currentMeta.headers || [],
            lastFetchAt: Date.now()
          }
          try {
            await setResourceMeta(resourceName, nextMeta)
            statusStore.markFetched(resourceName, nextMeta.lastFetchAt)
          } catch (metaError) {
            logger.error('Failed to persist poll heartbeat', {
              resource: resourceName,
              error: metaError?.message || String(metaError)
            })
          }
        }
      } else {
        logger.warn('Poll request unsuccessful', { error: response?.error || response?.message })
      }
    } catch (err) {
      logger.error('Error running poll', { error: err?.message || String(err) })
    } finally {
      // The poll itself is done. Advance the ladder and hand the countdown back
      // BEFORE the delta fetch, so the next poll is already scheduled while the
      // fetch runs. The fetch registers as an API call of its own, which
      // suspends that countdown for its duration and resumes it on settle.
      inflight.value = false
      escalateTier()
      resumeCountdown()
    }

    if (!updatedResources.length) return
    // Logout (or an auth failure) can land while the poll is open.
    if (!isPolling.value) return

    logger.info('Syncing modified resources discovered via poll', { resources: updatedResources })
    try {
      const resourceIo = useResourceIoStore()
      await resourceIo.syncResources(updatedResources, { forceSync: true, background: true })
    } catch (syncError) {
      logger.error('Poll-driven sync failed', { error: syncError?.message || String(syncError) })
    }
  }

  return {
    currentTier,
    requestCountInTier,
    currentInterval,
    isPolling,
    waiting,
    inflight,
    pendingRequests,
    start,
    stop,
    noteRequestStarted,
    noteRequestSettled
  }
})

// Any non-poll request is starting: suspend the countdown so a poll cannot fire
// on top of a transaction that is already in progress.
registerApiRequestListener(() => {
  usePollingStore().noteRequestStarted()
})

// That request has settled (success or failure). Resume the countdown once the
// last one lands; a user-driven call also collapses the ladder back to Tier 0,
// while a poll-driven one (`background`) leaves the tier where it was.
registerApiResponseListener((action, meta) => {
  usePollingStore().noteRequestSettled({ background: meta?.background === true })
})
