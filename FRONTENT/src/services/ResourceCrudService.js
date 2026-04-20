import { executeGasApi } from 'src/services/GasApiService'
import { createLogger, standardizeResponse } from './_logger'

const logger = createLogger('ResourceCrudService')

export async function createMasterRecord(resourceName, record) {
  try {
    logger.debug('Creating master record', { resource: resourceName })
    const response = await executeGasApi('create', {
      resource: resourceName,
      record
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

export async function updateMasterRecord(resourceName, code, record) {
  try {
    logger.debug('Updating master record', { resource: resourceName, code })
    const response = await executeGasApi('update', {
      resource: resourceName,
      code,
      record
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

export async function bulkMasterRecords(targetResourceName, records) {
  try {
    logger.debug('Bulk upload', { resource: targetResourceName, count: records?.length || 0 })
    const response = await executeGasApi('bulk', {
      resource: 'BulkUploadMasters',
      callerResource: 'BulkUploadMasters',
      targetResource: targetResourceName,
      records
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
    logger.debug('Composite save', { resources: payload?.records?.length || 0 })
    const response = await executeGasApi('compositeSave', payload)
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
    const response = await executeGasApi('executeAction', {
      resource: resourceName,
      code,
      action: actionConfig.action,
      column: actionConfig.column,
      columnValue: actionConfig.columnValue,
      fields
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

