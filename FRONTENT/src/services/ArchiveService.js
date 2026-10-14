import { executeGasApi } from 'src/services/GasApiService'
import { deleteResourceRowsByCodes } from 'src/services/IndexedDbService'
import { createLogger } from 'src/services/_logger'

const logger = createLogger('ArchiveService')

export async function archiveRecords(resourcesPayload) {
  if (!resourcesPayload || typeof resourcesPayload !== 'object' || !Object.keys(resourcesPayload).length) {
    return { success: false, error: 'No resources provided for archive' }
  }

  try {
    const response = await executeGasApi('archive', { resources: resourcesPayload }, {
      requireAuth: true,
      background: true
    })

    if (!response || !response.success) {
      const errorMsg = response?.error || response?.message || 'Archive request failed'
      logger.error('Archive call failed', { error: errorMsg })
      return { success: false, error: errorMsg }
    }

    const archivedMap = response.data?.result?.archived || response.data?.archived || response.archived || {}

    for (const [resourceName, codes] of Object.entries(archivedMap)) {
      if (Array.isArray(codes) && codes.length > 0) {
        await deleteResourceRowsByCodes(resourceName, codes)
      }
    }

    return {
      success: true,
      archived: archivedMap
    }
  } catch (err) {
    const message = err?.message || String(err)
    logger.error('Archive service error', { error: message })
    return { success: false, error: message }
  }
}
