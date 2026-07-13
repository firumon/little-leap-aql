import { OUTLET_DEFAULT_STORAGE, OUTLET_REFERENCE_TYPES, STOCK_MOVEMENT_REFERENCE_TYPES, active, text } from './outletOperationsMeta.js'
import { textOrRef } from 'src/utils/appHelpers'

export function toNumber(value) { const number = Number(value); return Number.isFinite(number) ? number : 0 }
export function storageName(value) { return text(value) || OUTLET_DEFAULT_STORAGE }
export function sumBy(rows = [], field) { return rows.reduce((total, row) => total + toNumber(row[field]), 0) }
export function approvalRequestedQty(rows = []) {
  const explicitQty = Math.max(0, ...rows.map(row => toNumber(row._approvalRequestedQty)))
  return explicitQty > 0 ? explicitQty : sumBy(rows, 'Quantity')
}
export function restockEditableProgress(progress) { return ['DRAFT', 'REVISION_REQUIRED'].includes(text(progress) || 'DRAFT') }
export function allocatedRows(rows = []) { return rows.filter(active).filter(row => text(row.Progress) === 'ALLOCATED') }
export function deliveredRows(rows = []) { return rows.filter(active).filter(row => text(row.Progress) === 'DELIVERED') }
export function pendingRows(rows = []) { return rows.filter(active).filter(row => !text(row.Progress) || text(row.Progress) === 'PENDING') }
export function canSplitRow(item) { return active(item) && text(item.Progress) === 'PENDING' && toNumber(item.Quantity) > 1 }

function validationResult(errors = [], warnings = []) { return { valid: errors.length === 0, errors, warnings } }
function duplicateSkuErrors(rows = [], qtyField = 'Quantity') {
  const seen = new Set()
  const errors = []
  rows.filter(active).filter(row => toNumber(row[qtyField]) > 0).forEach((row) => {
    const sku = text(row.SKU)
    if (!sku) errors.push('SKU is required.')
    else if (seen.has(sku)) errors.push(`Duplicate SKU ${sku}.`)
    seen.add(sku)
  })
  return errors
}

export function warehouseAvailableQty(storages = [], row = {}) {
  const warehouse = text(row.WarehouseCode)
  const storage = storageName(row.StorageName)
  const sku = text(row.SKU)
  const match = storages.find(item =>
    active(item) &&
    text(item.WarehouseCode) === warehouse &&
    storageName(item.StorageName) === storage &&
    text(item.SKU) === sku
  )
  return toNumber(match?.Quantity)
}

function storageSortKey(row = {}) { return `${text(row.warehouseCode)}\u0000${text(row.storageName)}` }
function sortStorageCandidates(rows = []) {
  return rows.slice().sort((a, b) => {
    const availableDiff = toNumber(a.available) - toNumber(b.available)
    if (availableDiff) return availableDiff
    return storageSortKey(a).localeCompare(storageSortKey(b))
  })
}
function allocationQuantityRows(candidates = [], requestedQty = 0) {
  let remaining = toNumber(requestedQty)
  const rows = []
  sortStorageCandidates(candidates).forEach((candidate) => {
    if (remaining <= 0) return
    const quantity = Math.min(toNumber(candidate.available), remaining)
    if (quantity > 0) {
      rows.push({ WarehouseCode: candidate.warehouseCode, StorageName: candidate.storageName, Quantity: quantity })
      remaining -= quantity
    }
  })
  return rows
}

export function warehouseStorageCandidatesForSku(storages = [], skuCode = '') {
  return sortStorageCandidates(storages
    .filter(active)
    .filter(row => text(row.SKU) === text(skuCode))
    .map(row => ({
      id: `${text(row.WarehouseCode)}|${storageName(row.StorageName)}`,
      warehouseCode: text(row.WarehouseCode),
      storageName: storageName(row.StorageName),
      available: toNumber(row.Quantity)
    }))
    .filter(row => row.warehouseCode && row.storageName && row.available > 0))
}

export function recommendOrsiAllocation(row = {}, warehouseStorages = []) {
  const requestedQty = toNumber(row.Quantity)
  const candidates = warehouseStorageCandidatesForSku(warehouseStorages, row.SKU)
  const availableQty = sumBy(candidates, 'available')
  const availabilityGroup = requestedQty > 0
    ? (availableQty >= requestedQty ? 'full' : (availableQty > 0 ? 'partial' : 'none'))
    : 'none'
  if (requestedQty <= 0) {
    return { availabilityGroup, requestedQty, availableQty, recommendedAllocations: [], remainingQty: requestedQty, reason: 'Requested quantity must be greater than 0.' }
  }
  if (!candidates.length) {
    return { availabilityGroup, requestedQty, availableQty, recommendedAllocations: [], remainingQty: requestedQty, reason: 'No active warehouse storage stock is available for this SKU.' }
  }

  const recommendedAllocations = allocationQuantityRows(candidates, requestedQty)
  const allocatedQty = sumBy(recommendedAllocations, 'Quantity')
  return {
    availabilityGroup,
    requestedQty,
    availableQty,
    recommendedAllocations,
    remainingQty: Math.max(requestedQty - allocatedQty, 0),
    reason: allocatedQty >= requestedQty ? 'Smallest available storages can fully satisfy the request.' : 'Only partial warehouse stock is available for this request.'
  }
}

export function expandOrsiAllocationRows(row = {}, recommendation = recommendOrsiAllocation(row, [])) {
  const allocations = Array.isArray(recommendation.recommendedAllocations) ? recommendation.recommendedAllocations.filter(item => toNumber(item.Quantity) > 0) : []
  const remainingQty = toNumber(recommendation.remainingQty)
  if (toNumber(row.Quantity) <= 0 || (!allocations.length && remainingQty <= 0)) return [{ ...row, Progress: text(row.Progress) || 'PENDING' }]
  const base = {
    SKU: text(row.SKU),
    OutletRestockCode: text(row.OutletRestockCode),
    Status: text(row.Status || 'Active')
  }
  const allocatedRows = allocations.map((allocation, index) => ({
    ...base,
    ...(index === 0 && text(row.Code) ? { Code: row.Code } : {}),
    WarehouseCode: text(allocation.WarehouseCode),
    StorageName: storageName(allocation.StorageName),
    Quantity: toNumber(allocation.Quantity),
    Progress: 'ALLOCATED'
  }))
  const pendingRemainder = remainingQty > 0
    ? [{ ...base, Quantity: remainingQty, Progress: 'PENDING' }]
    : []
  return [...allocatedRows, ...pendingRemainder]
}

export function validateAllocation(row = {}, storages = []) {
  const errors = []
  if (!text(row.SKU)) errors.push('SKU is required.')
  if (!text(row.WarehouseCode)) errors.push(`Warehouse is required for ${row.SKU || 'allocated item'}.`)
  if (!text(row.StorageName)) errors.push(`Storage is required for ${row.SKU || 'allocated item'}.`)
  if (toNumber(row.Quantity) <= 0) errors.push(`Allocated quantity must be greater than 0 for ${row.SKU || 'item'}.`)
  const available = warehouseAvailableQty(storages, row)
  if (toNumber(row.Quantity) > available) errors.push(`Allocation exceeds available warehouse stock for ${row.SKU} at ${row.StorageName}.`)
  return validationResult(errors, [])
}

export function computeRestockProgressFromItems(items = []) {
  const rows = items.filter(active)
  if (!rows.length) return 'APPROVED'
  if (rows.every(row => text(row.Progress) === 'DELIVERED')) return 'DELIVERED'
  if (rows.some(row => text(row.Progress) === 'DELIVERED')) return 'PARTIALLY_DELIVERED'
  if (rows.some(row => text(row.Progress) === 'ALLOCATED')) return 'APPROVED'
  return 'PENDING_APPROVAL'
}

export function validateRestockDraft(form = {}, rows = []) {
  const activeRows = rows.filter(active).filter(row => toNumber(row.Quantity) > 0)
  const errors = []
  const warnings = []
  if (form.Code && !restockEditableProgress(form.Progress)) errors.push(`Restock ${form.Code} cannot be edited while progress is ${text(form.Progress) || 'blank'}.`)
  if (!text(form.OutletCode)) errors.push('Outlet is required.')
  if (!text(form.Date)) errors.push('Date is required.')
  if (!text(form.RequestedUser)) errors.push('Requested user is required.')
  if (!activeRows.length) errors.push('At least one requested item is required.')
  rows.filter(active).forEach(row => { if (text(row.SKU) && toNumber(row.Quantity) <= 0) errors.push(`Quantity must be greater than 0 for ${row.SKU}.`) })
  errors.push(...duplicateSkuErrors(rows, 'Quantity'))
  return validationResult(errors, warnings)
}

export function validateRestockAllocationRows(rows = [], storages = []) {
  const errors = []
  const warnings = []
  const allocated = allocatedRows(rows)
  if (!allocated.length) errors.push('Allocate at least one item row before approving.')
  allocated.forEach(row => errors.push(...validateAllocation(row, storages).errors))
  const approvalGroups = new Map()
  rows.filter(active).forEach((row, index) => {
    const key = text(row._approvalSourceKey) || text(row.Code) || `${text(row.SKU)}|${index}`
    if (!approvalGroups.has(key)) approvalGroups.set(key, [])
    approvalGroups.get(key).push(row)
  })
  approvalGroups.forEach((groupRows) => {
    const requestedQty = approvalRequestedQty(groupRows)
    const allocatedQty = sumBy(groupRows.filter(row => text(row.Progress) === 'ALLOCATED'), 'Quantity')
    if (allocatedQty > requestedQty) errors.push(`Allocated quantity exceeds requested quantity for ${groupRows[0]?.SKU || 'item'}.`)
  })
  const totals = new Map()
  allocated.forEach((row) => {
    const key = `${text(row.SKU)}|${text(row.WarehouseCode)}|${storageName(row.StorageName)}`
    totals.set(key, { row, quantity: (totals.get(key)?.quantity || 0) + toNumber(row.Quantity) })
  })
  totals.forEach(({ row, quantity }) => {
    const available = warehouseAvailableQty(storages, row)
    if (quantity > available) errors.push(`Allocation exceeds available warehouse stock for ${row.SKU} at ${storageName(row.StorageName)}.`)
  })
  return validationResult(errors, warnings)
}

export function validateRestockApproval(restock = {}, rows = [], storages = []) {
  const validation = validateRestockAllocationRows(rows, storages)
  const errors = [...validation.errors]
  if (!text(restock?.Code)) errors.push('Restock code is required for approval.')
  if (text(restock?.Progress) !== 'PENDING_APPROVAL') errors.push('Only pending approval restocks can be approved.')
  return validationResult(errors, validation.warnings)
}

export function validateDeliveryItems(rows = []) {
  const errors = []
  const activeRows = rows.filter(active)
  if (!activeRows.length) errors.push('Select at least one allocated item.')
  activeRows.forEach(row => {
    if (text(row.Progress) !== 'ALLOCATED') errors.push(`${row.Code || row.SKU} is not allocated.`)
    if (!text(row.Code)) errors.push(`Allocated item ${row.SKU || ''} must be saved before delivery.`)
  })
  return validationResult(errors, [])
}

export function warehouseDisplayName(warehouses = [], code = '') {
  const match = warehouses.find(w => text(w.Code) === text(code))
  return text(match?.Name) || text(code)
}

export function formatTimeOnly(date = new Date()) {
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const h = hours % 12 || 12
  const m = String(minutes).padStart(2, '0')
  return `${h}:${m} ${ampm}`
}

export function currentOutletStockQty(storages = [], outletCode, _store, sku) {
  const match = storages.find(row => active(row) && text(row.OutletCode) === text(outletCode) && text(row.SKU) === text(sku))
  return toNumber(match?.Quantity)
}

export function validateConsumption(form = {}, rows = [], storages = []) {
  const errors = []
  if (!text(form.OutletCode)) errors.push('Outlet is required.')
  if (!text(form.Date)) errors.push('Date is required.')
  if (!text(form.Username)) errors.push('Username is required.')
  const positives = rows.filter(row => toNumber(row.SoldQty ?? row.Qty) > 0)
  if (!positives.length) errors.push('At least one positive sold quantity is required.')
  errors.push(...duplicateSkuErrors(rows.map(row => ({ ...row, Quantity: toNumber(row.SoldQty ?? row.Qty) })), 'Quantity'))
  positives.forEach(row => { const available = currentOutletStockQty(storages, form.OutletCode, null, row.SKU); if (toNumber(row.SoldQty ?? row.Qty) > available) errors.push(`Consumption exceeds available stock for ${row.SKU}.`) })
  return validationResult(errors, [])
}

export function buildStockMovementForAllocation(row = {}, referenceCode = '', sign = -1) {
  return {
    WarehouseCode: text(row.WarehouseCode),
    StorageName: storageName(row.StorageName),
    SKU: text(row.SKU),
    QtyChange: Math.abs(toNumber(row.Quantity)) * (sign < 0 ? -1 : 1),
    ReferenceType: STOCK_MOVEMENT_REFERENCE_TYPES.outletRestock,
    ReferenceCode: textOrRef(referenceCode || row.Code),
    Status: 'Active'
  }
}

export function buildOutletMovementForDelivery(orsi = {}, restock = {}, referenceCode = '') {
  return {
    OutletCode: text(restock.OutletCode),
    SKU: text(orsi.SKU),
    QtyChange: Math.abs(toNumber(orsi.Quantity)),
    ReferenceType: OUTLET_REFERENCE_TYPES.delivery,
    ReferenceCode: textOrRef(referenceCode),
    MovementDate: new Date().toISOString(),
    Status: 'Active'
  }
}
