import axios from 'axios'
import { openDB } from 'idb'
import { useAuthStore } from 'src/stores/auth'
import { createLogger } from './_logger'

const logger = createLogger('StorageService')

const CACHE_DB_NAME = 'aql_uploaded_files'
const CACHE_DB_VERSION = 1
const CACHE_STORE_NAME = 'metadata'

let cacheDbPromise = null

function getCacheDb() {
  if (cacheDbPromise) return cacheDbPromise
  
  if (typeof indexedDB === 'undefined') {
    return null
  }

  cacheDbPromise = openDB(CACHE_DB_NAME, CACHE_DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) {
        db.createObjectStore(CACHE_STORE_NAME)
      }
    }
  })
  return cacheDbPromise
}

function getStorageConfig() {
  const authStore = useAuthStore()
  try {
    const configStr = authStore.appConfigMap?.File
    return configStr ? JSON.parse(configStr) : {}
  } catch (err) {
    logger.error('Failed to parse storage configuration', { error: err.message })
    return {}
  }
}

/**
 * Uploads a file to the temporary storage server folder.
 * Path: _temp/<ResourceName>/<ColumnName>/<uuid>/file.<ext>
 */
export async function uploadTempFile(file, resource, column) {
  const config = getStorageConfig()
  if (!config.url) {
    return { success: false, error: 'Storage URL is not configured. Please check App.Config.' }
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('resource', resource)
  formData.append('column', column)

  try {
    const headers = {}
    if (config.token) {
      headers['Authorization'] = `Bearer ${config.token}`
    }

    const response = await axios.post(`${config.url}?action=upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        ...headers
      }
    })

    if (response.data && response.data.success) {
      const meta = response.data.metadata || response.data.meta || response.data
      if (meta && meta.uuid) {
        const db = await getCacheDb()
        if (db) {
          await db.put(CACHE_STORE_NAME, meta, meta.uuid)
        }
      }
      return { success: true, data: meta }
    } else {
      return { success: false, error: response.data?.error || 'Upload failed' }
    }
  } catch (err) {
    logger.error('Storage upload failed', { error: err.message })
    return { success: false, error: err.message }
  }
}

/**
 * Confirms an upload by moving it from temp to the permanent directory.
 * Path: <ResourceName>/<ColumnName>/<uuid>/file.<ext>
 */
export async function confirmUploadedFile(uuid, resource, column) {
  const config = getStorageConfig()
  if (!config.url) {
    return { success: false, error: 'Storage URL is not configured. Please check App.Config.' }
  }

  try {
    const headers = {}
    if (config.token) {
      headers['Authorization'] = `Bearer ${config.token}`
    }

    const response = await axios.post(`${config.url}?action=confirm`, {
      uuid,
      resource,
      column
    }, { headers })

    return { success: response.data?.success === true }
  } catch (err) {
    logger.error('Storage confirmation failed', { uuid, error: err.message })
    return { success: false, error: err.message }
  }
}

/**
 * Deletes a file and its metadata from the storage server and local database cache.
 */
export async function deleteUploadedFile(uuid, resource, column) {
  const config = getStorageConfig()
  if (!config.url) {
    return { success: false, error: 'Storage URL is not configured. Please check App.Config.' }
  }

  try {
    // Delete from local IndexedDB cache first
    const db = await getCacheDb()
    if (db) {
      await db.delete(CACHE_STORE_NAME, uuid)
    }

    const headers = {}
    if (config.token) {
      headers['Authorization'] = `Bearer ${config.token}`
    }

    const response = await axios.post(`${config.url}?action=delete`, {
      uuid,
      resource,
      column
    }, { headers })

    return { success: response.data?.success === true }
  } catch (err) {
    logger.error('Storage deletion failed', { uuid, error: err.message })
    return { success: false, error: err.message }
  }
}

/**
 * Fetches metadata for a UUID, using local IndexedDB cache as primary source.
 */
export async function getFileMetadata(uuid, resource, column) {
  if (!uuid) return { success: false, error: 'No UUID provided' }

  // Check local cache first
  try {
    const db = await getCacheDb()
    if (db) {
      const cached = await db.get(CACHE_STORE_NAME, uuid)
      if (cached) {
        return { success: true, data: cached }
      }
    }
  } catch (err) {
    logger.warn('Failed to read from storage cache', { uuid, error: err.message })
  }

  const config = getStorageConfig()
  if (!config.url) {
    return { success: false, error: 'Storage URL is not configured. Please check App.Config.' }
  }

  try {
    const headers = {}
    if (config.token) {
      headers['Authorization'] = `Bearer ${config.token}`
    }

    const response = await axios.get(`${config.url}?action=meta&uuid=${uuid}&resource=${resource}&column=${column}`, { headers })

    if (response.data && response.data.uuid) {
      const db = await getCacheDb()
      if (db) {
        await db.put(CACHE_STORE_NAME, response.data, uuid)
      }
      return { success: true, data: response.data }
    }

    return { success: false, error: 'Metadata not found' }
  } catch (err) {
    logger.error('Failed to get file metadata from server', { uuid, error: err.message })
    return { success: false, error: err.message }
  }
}
