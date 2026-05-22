import { todayISO, text } from './outletOperationsMeta.js'
import { buildStockMovementForAllocation, formatTimeOnly, toNumber } from './outletStockLogic.js'
import { compositeSaveRequest, executeActionRequest, OUTLET_ACTIONS, resourceBulkRequest, resourceUpdateRequest } from './outletOperationsBatch.js'

function stampFields(prefix, actorName = '', comment = '') {
  const now = new Date().toISOString()
  return {
    [`${prefix}At`]: now,
    [`${prefix}By`]: text(actorName),
    [`${prefix}Comment`]: text(comment)
  }
}

function pendingSourceCode(row = {}) {
  return text(row._pendingSourceCode || row._approvalSourceKey).replace(/^pending:/, '')
}

function allocationSourceCode(row = {}) {
  return text(row._pendingSourceCode || row.Code || row._approvalSourceKey).replace(/^pending:/, '')
}

export function buildRestockCompositePayload(form = {}, rows = [], code = form.Code) {
  return {
    resource: 'OutletRestocks',
    code,
    data: {
      Date: text(form.Date) || todayISO(),
      OutletCode: text(form.OutletCode),
      RequestedUser: text(form.RequestedUser),
      ApprovedUser: text(form.ApprovedUser),
      Progress: text(form.Progress) || 'DRAFT',
      ProgressSubmittedComment: text(form.ProgressSubmittedComment),
      ProgressRevisionRequiredComment: text(form.ProgressRevisionRequiredComment),
      ProgressApprovedComment: text(form.ProgressApprovedComment),
      ProgressRejectedComment: text(form.ProgressRejectedComment),
      Status: text(form.Status || 'Active')
    },
    children: [{
      resource: 'OutletRestockItems',
      records: rows.map(row => ({
        _action: row._delete || row.Status === 'Inactive' ? 'deactivate' : (row.Code ? 'update' : 'create'),
        ...(row.Code ? { _originalCode: row.Code } : {}),
        data: {
          SKU: text(row.SKU),
          WarehouseCode: text(row.WarehouseCode),
          StorageName: text(row.StorageName),
          Quantity: toNumber(row.Quantity),
          Progress: text(row.Progress) || 'PENDING',
          Status: text(row.Status || 'Active')
        }
      }))
    }]
  }
}

export function buildRestockAllocationBatchRequests(restock = {}, rows = [], actorName = '', comment = '', options = {}) {
  const activeRows = rows.filter(row => text(row.Status || 'Active') === 'Active')
  const allocationComment = text(comment) || `Allocated by ${text(actorName) || 'Unknown'} on ${formatTimeOnly()}`
  let itemRecords = activeRows.map(row => {
    const progress = text(row.Progress || 'PENDING')
    const code = text(row.Code) || (progress === 'PENDING' ? pendingSourceCode(row) : '')
    return {
      ...(code ? { Code: code } : {}),
      OutletRestockCode: text(restock.Code),
      SKU: text(row.SKU),
      WarehouseCode: text(row.WarehouseCode),
      StorageName: text(row.StorageName),
      Quantity: toNumber(row.Quantity),
      Progress: progress,
      ...(progress === 'ALLOCATED' ? stampFields('ProgressAllocated', actorName, allocationComment) : {}),
      Status: 'Active'
    }
  })
  // Deduplicate Codes: when the same Code appears on both
  // ALLOCATED and non-ALLOCATED records, strip Code from ALLOCATED
  // records so the backend auto-generates a new Code (CREATE)
  // instead of double-writing the same row (UPDATE+UPDATE).
  const codeCount = {}
  itemRecords.forEach(r => { if (r.Code) codeCount[r.Code] = (codeCount[r.Code] || 0) + 1 })
  const hasDupCodes = Object.values(codeCount).some(c => c > 1)
  if (hasDupCodes) {
    itemRecords = itemRecords.map(r => {
      if (r.Code && codeCount[r.Code] > 1 && r.Progress === 'ALLOCATED') {
        const { Code, ...rest } = r
        return rest
      }
      return r
    })
  }

  const allocated = itemRecords.filter(row => text(row.Progress) === 'ALLOCATED')
  const movementRefs = Array.isArray(options.movementReferences) ? options.movementReferences : []
  const movements = allocated.map((row, index) => buildStockMovementForAllocation(row, movementRefs[index] || row.Code || restock.Code, -1))
  const requests = [
    resourceBulkRequest('OutletRestockItems', itemRecords, ['OutletRestockItems']),
    resourceBulkRequest('StockMovements', movements, ['WarehouseStorages'])
  ]
  if (options.updateRestock !== false) {
    requests.push(resourceUpdateRequest('OutletRestocks', restock.Code, {
      Progress: 'APPROVED',
      ApprovedUser: text(actorName),
      ProgressApprovedComment: text(comment)
    }, ['OutletRestocks']))
  }
  return requests
}

export function buildPendingRestockAllocationBatchRequests(restock = {}, rows = [], actorName = '', comment = '') {
  const activeRows = rows.filter(row => text(row.Status || 'Active') === 'Active')
  const allocationComment = text(comment) || `Allocated by ${text(actorName) || 'Unknown'} on ${formatTimeOnly()}`
  const sourceCodes = Array.from(new Set(activeRows.map(allocationSourceCode).filter(Boolean)))
  const sourceRows = sourceCodes.map(code => activeRows.find(row => text(row.Code) === code || allocationSourceCode(row) === code)).filter(Boolean)
  const itemRecords = []
  const movements = []

  sourceRows.forEach(source => {
    const sourceCode = allocationSourceCode(source)
    const sourceQty = toNumber(source._approvalRequestedQty || source.Quantity)
    const allocatedRows = activeRows.filter(row => allocationSourceCode(row) === sourceCode && text(row.Progress) === 'ALLOCATED')
    const allocatedQty = allocatedRows.reduce((total, row) => total + toNumber(row.Quantity), 0)
    const remainingQty = Math.max(sourceQty - allocatedQty, 0)

    if (remainingQty === 0 && allocatedRows.length === 1 && sourceCode) {
      const row = allocatedRows[0]
      const record = {
        Code: sourceCode,
        OutletRestockCode: text(restock.Code),
        SKU: text(row.SKU),
        WarehouseCode: text(row.WarehouseCode),
        StorageName: text(row.StorageName),
        Quantity: toNumber(row.Quantity),
        Progress: 'ALLOCATED',
        ...stampFields('ProgressAllocated', actorName, allocationComment),
        Status: 'Active'
      }
      itemRecords.push(record)
      movements.push(buildStockMovementForAllocation(record, sourceCode, -1))
      return
    }

    if (sourceCode && remainingQty > 0) {
      itemRecords.push({
        Code: sourceCode,
        OutletRestockCode: text(restock.Code),
        SKU: text(source.SKU),
        WarehouseCode: '',
        StorageName: '',
        Quantity: remainingQty,
        Progress: 'PENDING',
        Status: 'Active'
      })
    } else if (sourceCode) {
      itemRecords.push({
        Code: sourceCode,
        Status: 'Inactive'
      })
    }

    allocatedRows.forEach(row => {
      const record = {
        OutletRestockCode: text(restock.Code),
        SKU: text(row.SKU),
        WarehouseCode: text(row.WarehouseCode),
        StorageName: text(row.StorageName),
        Quantity: toNumber(row.Quantity),
        Progress: 'ALLOCATED',
        ...stampFields('ProgressAllocated', actorName, allocationComment),
        Status: 'Active'
      }
      itemRecords.push(record)
      movements.push(buildStockMovementForAllocation(record, sourceCode || restock.Code, -1))
    })
  })

  return [
    resourceBulkRequest('OutletRestockItems', itemRecords, ['OutletRestockItems']),
    resourceBulkRequest('StockMovements', movements, ['WarehouseStorages'])
  ]
}

export function buildRestockRejectBatchRequests(restock = {}, rows = [], actorName = '', comment = '') {
  const activeRows = rows.filter(row => text(row.Status || 'Active') === 'Active')
  const movements = activeRows
    .filter(row => text(row.Progress) === 'ALLOCATED')
    .map(row => buildStockMovementForAllocation(row, row.Code || restock.Code, 1))
  const itemRecords = activeRows.map(row => ({
    Code: row.Code,
    Status: 'Inactive'
  })).filter(row => text(row.Code))
  return [
    resourceBulkRequest('StockMovements', movements, ['WarehouseStorages']),
    resourceBulkRequest('OutletRestockItems', itemRecords, ['OutletRestockItems']),
    resourceUpdateRequest('OutletRestocks', restock.Code, {
      Progress: 'REJECTED',
      ProgressRejectedComment: text(comment),
      ProgressRejectedAt: new Date().toISOString(),
      ProgressRejectedBy: text(actorName)
    }, ['OutletRestocks'])
  ]
}

export function buildRestockCancelItemsBatchRequests(restock = {}, rows = [], actorName = '', comment = '') {
  const cancelComment = text(comment)
  return rows
    .filter(row => text(row.Code) && text(row.Progress) === 'PENDING')
    .map(row => executeActionRequest('OutletRestockItems', row.Code, OUTLET_ACTIONS.cancelRestockItem, {
      ...stampFields('ProgressCancelled', actorName, cancelComment)
    }, ['OutletRestockItems']))
}

export function buildRestockSendBackRequest(restock = {}, comment = '') {
  return executeActionRequest('OutletRestocks', restock.Code, OUTLET_ACTIONS.sendBackRestock, { ProgressRevisionRequiredComment: text(comment) }, ['OutletRestocks'])
}

export function restockSaveRequest(form, rows) { return compositeSaveRequest(buildRestockCompositePayload(form, rows)) }
