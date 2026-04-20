const MIN_QUEUE_WAIT_MS = 250

const masterSyncQueue = new Map()
const inFlightResourceNames = new Set()
let queueTimerId = null
let queueFlushPromise = null

function clearQueueTimer() {
  if (queueTimerId) {
    clearTimeout(queueTimerId)
    queueTimerId = null
  }
}

export function createResourceSyncQueue({ syncBatch }) {
  function scheduleResourceSyncQueueFlush() {
    clearQueueTimer()
    if (!masterSyncQueue.size) return

    let nextDueAt = Number.POSITIVE_INFINITY
    for (const queued of masterSyncQueue.values()) {
      const dueAt = Number(queued?.dueAt || 0)
      if (dueAt > 0 && dueAt < nextDueAt) {
        nextDueAt = dueAt
      }
    }

    const waitMs = Number.isFinite(nextDueAt)
      ? Math.max(nextDueAt - Date.now(), MIN_QUEUE_WAIT_MS)
      : MIN_QUEUE_WAIT_MS
    queueTimerId = setTimeout(() => {
      flushResourceSyncQueue(false, { showError: false, showLoading: false }).catch(() => {})
    }, waitMs)
  }

  function queueResourceSync(resourceName, dueAt, reason = '') {
    if (!resourceName) return
    if (inFlightResourceNames.has(resourceName)) return
    const normalizedDueAt = Number.isFinite(Number(dueAt)) ? Number(dueAt) : Date.now()
    const existing = masterSyncQueue.get(resourceName)
    if (!existing || normalizedDueAt < existing.dueAt) {
      masterSyncQueue.set(resourceName, {
        dueAt: normalizedDueAt,
        reason
      })
    }
    scheduleResourceSyncQueueFlush()
  }

  async function flushResourceSyncQueue(forceAll = false, syncOptions = {}) {
    if (queueFlushPromise) {
      const result = await queueFlushPromise
      if (masterSyncQueue.size > 0) {
        return flushResourceSyncQueue(forceAll, syncOptions)
      }
      return result
    }

    queueFlushPromise = (async () => {
      const now = Date.now()
      const dueResourceNames = []

      for (const [resourceName, queued] of masterSyncQueue.entries()) {
        if (forceAll || (queued?.dueAt || 0) <= now) {
          dueResourceNames.push(resourceName)
        }
      }

      if (!dueResourceNames.length) {
        scheduleResourceSyncQueueFlush()
        return { success: true, data: {}, meta: { resources: [] } }
      }

      dueResourceNames.forEach((resourceName) => {
        masterSyncQueue.delete(resourceName)
        inFlightResourceNames.add(resourceName)
      })

      try {
        const response = await syncBatch(dueResourceNames, {
          showError: syncOptions.showError === true,
          showLoading: syncOptions.showLoading === true
        })
        scheduleMasterSyncQueueFlush()
        return response
      } finally {
        dueResourceNames.forEach((name) => inFlightResourceNames.delete(name))
      }
    })().finally(() => {
      queueFlushPromise = null
    })

    return queueFlushPromise
  }

  return {
    flushResourceSyncQueue,
    queueResourceSync,
    // Transitional aliases for older import names.
    flushMasterSyncQueue: flushResourceSyncQueue,
    queueMasterResourceSync: queueResourceSync
  }
}
