import { executeGasApi } from 'src/services/GasApiService'
import { getResourceMeta } from 'src/services/IndexedDbService'
import { normalizeCursorValue } from 'src/services/ResourceMapperService'
import { createLogger, standardizeResponse } from './_logger'

const logger = createLogger('ResourceCrudService')

async function buildLastUpdatedAtByResource(resourceNames = []) {
  const uniqueNames = Array.from(new Set((Array.isArray(resourceNames) ? resourceNames : [])
    .map((entry) => (entry || '').toString().trim())
    .filter(Boolean)))

  const cursorMap = {}
  for (const resourceName of uniqueNames) {
    try {
      const meta = await getResourceMeta(resourceName)
      const cursor = normalizeCursorValue(meta?.lastSyncAt)
      cursorMap[resourceName] = cursor || null
    } catch {
      cursorMap[resourceName] = null
    }
  }

  return cursorMap
}

export async function createRecord(resourceName, record) {
  try {
    logger.debug('Creating record', { resource: resourceName })
    const lastUpdatedAtByResource = await buildLastUpdatedAtByResource([resourceName])
    const response = await executeGasApi('create', {
      resource: resourceName,
      record,
      lastUpdatedAtByResource
    })
    if (response.success) {
      logger.info('Record created', { resource: resourceName })
    }
    return response
  } catch (error) {
    logger.error('Create failed', { resource: resourceName, error: error.message })
    return standardizeResponse(false, null, error.message)
  }
}

export async function updateRecord(resourceName, code, record) {
  try {
    logger.debug('Updating record', { resource: resourceName, code })
    const lastUpdatedAtByResource = await buildLastUpdatedAtByResource([resourceName])
    const response = await executeGasApi('update', {
      resource: resourceName,
      code,
      record,
      lastUpdatedAtByResource
    })
    if (response.success) {
      logger.info('Record updated', { resource: resourceName, code })
    }
    return response
  } catch (error) {
    logger.error('Update failed', { resource: resourceName, code, error: error.message })
    return standardizeResponse(false, null, error.message)
  }
}

export async function bulkRecords(targetResourceName, records) {
  try {
    logger.debug('Bulk upload', { resource: targetResourceName, count: records?.length || 0 })
    const lastUpdatedAtByResource = await buildLastUpdatedAtByResource([targetResourceName])
    const response = await executeGasApi('bulk', {
      resource: targetResourceName,
      targetResource: targetResourceName,
      records,
      lastUpdatedAtByResource
    })
    if (response.success) {
      logger.info('Bulk upload success', { resource: targetResourceName })
    }
    return response
  } catch (error) {
    logger.error('Bulk upload failed', { resource: targetResourceName, error: error.message })
    return standardizeResponse(false, null, error.message)
  }
}

export async function compositeSave(payload) {
  try {
    const parentResource = (payload?.resource || '').toString().trim()
    const childResources = Array.isArray(payload?.children)
      ? payload.children.map((entry) => (entry?.resource || '').toString().trim()).filter(Boolean)
      : []
    const lastUpdatedAtByResource = await buildLastUpdatedAtByResource([parentResource, ...childResources])
    logger.debug('Composite save', { resource: parentResource, childResources: childResources.length })
    const response = await executeGasApi('compositeSave', {
      ...payload,
      lastUpdatedAtByResource
    })
    if (response.success) {
      logger.info('Composite save success')
    }
    return response
  } catch (error) {
    logger.error('Composite save failed', { error: error.message })
    return standardizeResponse(false, null, error.message)
  }
}

export async function executeAction(resourceName, code, actionConfig, fields = {}) {
  try {
    logger.debug('Executing action', { resource: resourceName, action: actionConfig.action, code })
    const lastUpdatedAtByResource = await buildLastUpdatedAtByResource([resourceName])
    const response = await executeGasApi('executeAction', {
      resource: resourceName,
      code,
      actionName: actionConfig.action,
      column: actionConfig.column,
      columnValue: actionConfig.columnValue,
      fields,
      lastUpdatedAtByResource
    })
    if (response.success) {
      logger.info('Action executed', { resource: resourceName, action: actionConfig.action })
    }
    return response
  } catch (error) {
    logger.error('Action failed', { resource: resourceName, error: error.message })
    return standardizeResponse(false, null, error.message)
  }
}

