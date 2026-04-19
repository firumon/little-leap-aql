/**
 * IndexedDbCacheService — Standardized wrapper around IndexedDbService
 * All functions return { success, data, error } format
 * Uses raw IndexedDbService internally but provides consistent interface
 */

import { createLogger, standardizeResponse } from './_logger'
import {
  getCache,
  setCache,
  addToSyncQueue,
  getSyncQueue,
  removeFromSyncQueue,
  setResourceMeta,
  getResourceMeta,
  upsertResourceRows,
  getResourceRows,
  deleteResourceRowByCode,
  saveFunctionalDraft,
  getFunctionalDraft,
  deleteFunctionalDraft,
  clearAllClientStorage,
  setAuthorizedResources
} from './IndexedDbService'

const logger = createLogger('IndexedDbCacheService')

export async function cacheGet(url) {
  try {
    logger.debug('Getting cache', { url })
    const data = await getCache(url)
    return standardizeResponse(true, data)
  } catch (error) {
    logger.error('Cache get failed', { url, error: error.message })
    return standardizeResponse(false, null, error.message)
  }
}

export async function cacheSet(url, data) {
  try {
    logger.debug('Setting cache', { url })
    await setCache(url, data)
    return standardizeResponse(true, { url })
  } catch (error) {
    logger.error('Cache set failed', { url, error: error.message })
    return standardizeResponse(false, null, error.message)
  }
}

export async function queueAdd(requestData) {
  try {
    logger.debug('Adding to sync queue', { action: requestData?.action })
    const id = await addToSyncQueue(requestData)
    return standardizeResponse(true, { id, queued: true })
  } catch (error) {
    logger.error('Queue add failed', { error: error.message })
    return standardizeResponse(false, null, error.message)
  }
}

export async function queueGetAll() {
  try {
    logger.debug('Getting all sync queue items')
    const items = await getSyncQueue()
    return standardizeResponse(true, items)
  } catch (error) {
    logger.error('Queue get failed', { error: error.message })
    return standardizeResponse(false, null, error.message)
  }
}

export async function queueRemove(id) {
  try {
    logger.debug('Removing from sync queue', { id })
    await removeFromSyncQueue(id)
    return standardizeResponse(true, { removed: true })
  } catch (error) {
    logger.error('Queue remove failed', { id, error: error.message })
    return standardizeResponse(false, null, error.message)
  }
}

export async function metaSet(resource, meta) {
  try {
    logger.debug('Setting resource meta', { resource })
    await setResourceMeta(resource, meta)
    return standardizeResponse(true, { resource })
  } catch (error) {
    logger.error('Meta set failed', { resource, error: error.message })
    return standardizeResponse(false, null, error.message)
  }
}

export async function metaGet(resource) {
  try {
    logger.debug('Getting resource meta', { resource })
    const meta = await getResourceMeta(resource)
    return standardizeResponse(true, meta)
  } catch (error) {
    logger.error('Meta get failed', { resource, error: error.message })
    return standardizeResponse(false, null, error.message)
  }
}

export async function rowsUpsert(resource, headers, rows) {
  try {
    logger.debug('Upserting resource rows', { resource, rowCount: rows?.length || 0 })
    const affected = await upsertResourceRows(resource, headers, rows)
    return standardizeResponse(true, { affected, resource })
  } catch (error) {
    logger.error('Rows upsert failed', { resource, error: error.message })
    return standardizeResponse(false, null, error.message)
  }
}

export async function rowsGet(resource, options) {
  try {
    logger.debug('Getting resource rows', { resource })
    const rows = await getResourceRows(resource, options)
    return standardizeResponse(true, rows)
  } catch (error) {
    logger.error('Rows get failed', { resource, error: error.message })
    return standardizeResponse(false, null, error.message)
  }
}

export async function rowDelete(resource, code) {
  try {
    logger.debug('Deleting resource row', { resource, code })
    await deleteResourceRowByCode(resource, code)
    return standardizeResponse(true, { deleted: true })
  } catch (error) {
    logger.error('Row delete failed', { resource, code, error: error.message })
    return standardizeResponse(false, null, error.message)
  }
}

export async function draftSave(key, data) {
  try {
    logger.debug('Saving functional draft', { key })
    await saveFunctionalDraft(key, data)
    return standardizeResponse(true, { key })
  } catch (error) {
    logger.error('Draft save failed', { key, error: error.message })
    return standardizeResponse(false, null, error.message)
  }
}

export async function draftGet(key) {
  try {
    logger.debug('Getting functional draft', { key })
    const draft = await getFunctionalDraft(key)
    return standardizeResponse(true, draft)
  } catch (error) {
    logger.error('Draft get failed', { key, error: error.message })
    return standardizeResponse(false, null, error.message)
  }
}

export async function draftDelete(key) {
  try {
    logger.debug('Deleting functional draft', { key })
    await deleteFunctionalDraft(key)
    return standardizeResponse(true, { deleted: true })
  } catch (error) {
    logger.error('Draft delete failed', { key, error: error.message })
    return standardizeResponse(false, null, error.message)
  }
}

export async function storagesClear() {
  try {
    logger.info('Clearing all client storage')
    await clearAllClientStorage()
    return standardizeResponse(true, { cleared: true })
  } catch (error) {
    logger.error('Storage clear failed', { error: error.message })
    return standardizeResponse(false, null, error.message)
  }
}

export async function authorizedResourcesSet(resources, resetCursors) {
  try {
    logger.debug('Setting authorized resources', { count: resources?.length || 0 })
    await setAuthorizedResources(resources, resetCursors)
    return standardizeResponse(true, { set: true })
  } catch (error) {
    logger.error('Authorized resources set failed', { error: error.message })
    return standardizeResponse(false, null, error.message)
  }
}

// Export raw service for backward compatibility with critical direct access
export { onRowsUpserted } from './IndexedDbService'

