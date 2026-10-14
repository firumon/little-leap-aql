import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAuthStore } from './auth'
import { useDataStore } from './data'
import { useRecord } from 'src/composables/resources/useRecord'
import { archiveRecords } from 'src/services/ArchiveService'
import {
  prepareArchiveCondition,
  evaluatePreparedArchiveCondition
} from 'src/utils/archiveEvaluator'
import { resolveTokenContext } from 'src/utils/tokenEvaluator'
import { createLogger } from 'src/services/_logger'

const logger = createLogger('ArchiveStore')

export const useArchiveStore = defineStore('archive', () => {
  const isArchiving = ref(false)
  const lastRunAt = ref(null)
  const recentlyArchived = ref({})

  async function runArchiveCheck() {
    if (isArchiving.value) return

    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return

    const authorizedResources = authStore.authorizedResources || []
    if (!authorizedResources.length) return

    const dataStore = useDataStore()
    const recordApi = useRecord()
    const tokenCtx = resolveTokenContext()
    const payloadToArchive = {}

    for (const res of authorizedResources) {
      const archiveConfig = res.archive || res.ui?.archive
      if (!archiveConfig || !archiveConfig.condition) continue

      const resourceName = res.name
      if (!dataStore.hasRows(resourceName)) continue

      const prepared = prepareArchiveCondition(archiveConfig.condition, tokenCtx)
      if (!prepared) continue

      const limit = Math.max(
        1,
        Number(archiveConfig.limit || authStore.appConfigMap?.archiveBatchLimit || 30)
      )

      const records = dataStore.getRecords(resourceName)
      const matchingCodes = []

      for (const rec of records) {
        if (!rec || !rec.Code) continue
        const enriched = recordApi.enrich(resourceName, rec.Code)
        if (evaluatePreparedArchiveCondition(prepared, enriched)) {
          matchingCodes.push(rec.Code)
          if (matchingCodes.length >= limit) break
        }
      }

      if (matchingCodes.length > 0) {
        payloadToArchive[resourceName] = matchingCodes
      }
    }

    if (Object.keys(payloadToArchive).length === 0) return

    isArchiving.value = true
    try {
      logger.info('Starting archive check run', { resources: Object.keys(payloadToArchive) })
      const result = await archiveRecords(payloadToArchive)

      if (result && result.success && result.archived) {
        const archivedMap = result.archived
        for (const [resName, codes] of Object.entries(archivedMap)) {
          if (Array.isArray(codes) && codes.length > 0) {
            dataStore.removeRows(resName, codes)
            recentlyArchived.value[resName] = (recentlyArchived.value[resName] || []).concat(codes)
          }
        }
        lastRunAt.value = Date.now()
        logger.info('Archive check completed successfully', { archived: archivedMap })
      } else {
        logger.warn('Archive check did not complete', { error: result?.error })
      }
    } catch (err) {
      logger.error('Error during archive run', { error: err?.message || String(err) })
    } finally {
      isArchiving.value = false
    }
  }

  return {
    isArchiving,
    lastRunAt,
    recentlyArchived,
    runArchiveCheck
  }
})
