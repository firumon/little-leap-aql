import { apiClient } from 'src/services/ApiClientService'
import { createLogger, standardizeResponse } from './_logger'
import { buildSessionPayload } from 'src/services/SessionKeyService'
import {
  getResourceMeta,
  setResourceMeta,
  upsertResourceRows
} from 'src/services/IndexedDbService'

const logger = createLogger('GasApiService')

const API_VERSION = 'v1'

let onApiRequestCallback = null
let onApiResponseCallback = null

export function registerApiRequestListener(callback) {
  onApiRequestCallback = callback
}

export function registerApiResponseListener(callback) {
  onApiResponseCallback = callback
}

/** Lifecycle notifications are advisory; a listener fault must never fail the API call. */
function notifyLifecycle(callback, action, meta = {}) {
  if (typeof callback !== 'function') return
  try {
    callback(action, meta)
  } catch (error) {
    logger.warn('API lifecycle listener error', { action, error: error?.message || String(error) })
  }
}

function createRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function normalizeResourceSelector(resource) {
  if (Array.isArray(resource)) {
    const list = resource
      .map((entry) => (entry || '').toString().trim())
      .filter(Boolean)
    return list.length ? list : undefined
  }

  if (resource === null || resource === undefined) {
    return undefined
  }

  const normalized = resource.toString().trim()
  return normalized || undefined
}

function buildCanonicalRequest(action, payload = {}, token = null, requireAuth = true) {
  const requestId = createRequestId()
  const source = payload && typeof payload === 'object' ? payload : {}
  const resource = normalizeResourceSelector(source.resource)

  const nextPayload = { ...source }
  delete nextPayload.resource

  if (action === 'batch' && Array.isArray(nextPayload.requests)) {
    nextPayload.requests = nextPayload.requests.map((request) => {
      if (!request || typeof request !== 'object') return request
      return {
        requestId: request.requestId || createRequestId(),
        ...request
      }
    })
  }

  return buildSessionPayload({
    requestId,
    action,
    ...(requireAuth ? { token } : {}),
    ...(resource !== undefined ? { resource } : {}),
    payload: nextPayload
  })
}

function isCanonicalEnvelope(data) {
  return !!(
    data &&
    typeof data === 'object' &&
    typeof data.success === 'boolean' &&
    typeof data.requestId === 'string' &&
    typeof data.action === 'string' &&
    data.data &&
    typeof data.data === 'object' &&
    typeof data.data.resources === 'object' &&
    typeof data.data.result === 'object' &&
    typeof data.data.artifacts === 'object'
  )
}

async function fetchAuthorizedHeaders(token) {
  if (!token) return []

  const requestBody = buildSessionPayload({
    requestId: createRequestId(),
    action: 'getAuthorizedResources',
    token,
    payload: {
      includeHeaders: true
    }
  })

  try {
    const response = await apiClient.post('', requestBody)
    const data = response?.data
    if (!isCanonicalEnvelope(data) || data.success !== true) {
      return []
    }
    return Array.isArray(data.data?.result?.resources)
      ? data.data.result.resources
      : []
  } catch {
    return []
  }
}

function readHeadersFromLocalSession(resourceName) {
  try {
    const resources = JSON.parse(localStorage.getItem('resources') || '[]')
    const found = resources.find((entry) => entry?.name === resourceName)
    return Array.isArray(found?.headers) && found.headers.length ? found.headers : []
  } catch {
    return []
  }
}

async function resolveHeaders(resourceName, fallbackResources = []) {
  const meta = await getResourceMeta(resourceName)
  if (Array.isArray(meta?.headers) && meta.headers.length) {
    return meta.headers
  }

  const fallback = fallbackResources.find((entry) => entry?.name === resourceName)
  if (Array.isArray(fallback?.headers) && fallback.headers.length) {
    return fallback.headers
  }

  return readHeadersFromLocalSession(resourceName)
}

async function ingestResourcePayloads(resourcesPayload, token) {
  const resources = resourcesPayload && typeof resourcesPayload === 'object'
    ? resourcesPayload
    : {}

  const names = Object.keys(resources)
  if (!names.length) return

  let fallbackResources = []
  const missingHeaders = []

  for (const resourceName of names) {
    const payload = resources[resourceName] || {}
    const rows = Array.isArray(payload.rows) ? payload.rows : []
    let headers = Array.isArray(payload.headers) && payload.headers.length
      ? payload.headers
      : await resolveHeaders(resourceName, fallbackResources)

    if (!headers.length) {
      missingHeaders.push(resourceName)
      continue
    }

    if (rows.length) {
      await upsertResourceRows(resourceName, headers, rows)
    }

    const lastSyncAt = payload?.meta?.lastSyncAt || Date.now()
    // Data cursor (max UpdatedAt on the server) — distinct from lastSyncAt,
    // which is only a "when did we last talk to the server" stamp.
    const lastDataUpdatedAt = payload?.meta?.lastDataUpdatedAt || lastSyncAt
    await setResourceMeta(resourceName, {
      headers,
      lastSyncAt,
      lastDataUpdatedAt,
      lastFetchAt: Date.now(),
      hasHydratedOnce: true
    })
  }

  if (!missingHeaders.length || !token) {
    return
  }

  fallbackResources = await fetchAuthorizedHeaders(token)
  for (const resourceName of missingHeaders) {
    const payload = resources[resourceName] || {}
    const rows = Array.isArray(payload.rows) ? payload.rows : []
    const headers = await resolveHeaders(resourceName, fallbackResources)
    if (!headers.length) {
      logger.warn('Skipping resource ingestion due to missing headers', { resource: resourceName })
      continue
    }

    if (rows.length) {
      await upsertResourceRows(resourceName, headers, rows)
    }

    const lastSyncAt = payload?.meta?.lastSyncAt || Date.now()
    // Data cursor (max UpdatedAt on the server) — distinct from lastSyncAt,
    // which is only a "when did we last talk to the server" stamp.
    const lastDataUpdatedAt = payload?.meta?.lastDataUpdatedAt || lastSyncAt
    await setResourceMeta(resourceName, {
      headers,
      lastSyncAt,
      lastDataUpdatedAt,
      lastFetchAt: Date.now(),
      hasHydratedOnce: true
    })
  }
}

export function getGasApiErrorMessage(error) {
  const responseMessage = error?.response?.data?.message
  if (responseMessage) {
    return responseMessage
  }

  if (error?.message) {
    return error.message
  }

  return 'Unable to connect to service'
}

export async function executeGasApi(action, payload = {}, options = {}) {
  const {
    requireAuth = true,
    token = null,
    background = false,
    timeout = null,
    tokenResolver = () => localStorage.getItem('token')
  } = options

  const authToken = token || tokenResolver()
  if (requireAuth && !authToken) {
    logger.warn('GAS API call without auth', { action })
    return standardizeResponse(false, null, 'Not authenticated')
  }

  const requestBody = buildCanonicalRequest(action, payload, authToken, requireAuth)

  // `poll` is the background heartbeat itself, so it must not drive its own
  // pause/resume lifecycle. Every other action suspends the countdown while it
  // runs, but `background: true` marks a call the poller made on its own behalf
  // (the delta `get` after a poll finds changes) — that still holds the
  // countdown, yet must NOT collapse the escalation ladder, or a tab nobody is
  // watching would sit at Tier 0 forever just because its data keeps changing.
  const isLifecycleAction = action !== 'poll'
  const lifecycleMeta = { background: background === true }
  if (isLifecycleAction) {
    notifyLifecycle(onApiRequestCallback, action, lifecycleMeta)
  }

  try {
    logger.debug('Calling GAS API', { action, requestId: requestBody.requestId })
    const response = await apiClient.post('', requestBody, timeout ? { timeout } : {})
    const data = response?.data

    if (!isCanonicalEnvelope(data)) {
      logger.error('Invalid GAS API envelope', { action, response: data })
      return standardizeResponse(false, null, 'Invalid service response envelope')
    }

    try {
      await ingestResourcePayloads(data.data?.resources || {}, authToken)
    } catch (ingestError) {
      logger.warn('Resource ingestion warning', {
        action,
        requestId: data.requestId,
        error: ingestError?.message || String(ingestError)
      })
    }

    const result = {
      success: data.success === true,
      requestId: data.requestId,
      action: data.action,
      data: data.data,
      error: data.error || null,
      message: data.message || '',
      meta: data.meta || { version: API_VERSION }
    }
    logger.debug('GAS API response', { action, requestId: data.requestId, success: result.success })
    return result
  } catch (error) {
    const errorMsg = getGasApiErrorMessage(error)
    logger.error('GAS API error', { action, error: errorMsg })
    return standardizeResponse(false, null, errorMsg)
  } finally {
    if (isLifecycleAction) {
      notifyLifecycle(onApiResponseCallback, action, lifecycleMeta)
    }
  }
}
