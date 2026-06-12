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

    if (!isPolling.value) {
      start()
      return
    }

    if (timer.value) {
      clearTimeout(timer.value)
      timer.value = null
    }
    scheduleNextPoll()
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

        const resourcesToFetch = []
        for (const resourceName of Object.keys(cursors)) {
          if (updatedResources.includes(resourceName)) {
            resourcesToFetch.push(resourceName)
          } else {
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

    requestCountInTier.value++

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

  return {
    start,
    stop,
    reset
  }
})

registerApiRequestListener(() => {
  usePollingStore().reset()
})
