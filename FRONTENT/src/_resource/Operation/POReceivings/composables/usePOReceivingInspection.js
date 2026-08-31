import {
  LINE_CLEAN,
  LINE_SHORT,
  LINE_EXCESS,
  LINE_DAMAGED,
  LINE_REJECTED,
  LINE_PENDING
} from './usePOReceivingProgress'

const text = (value) => String(value ?? '').trim()
const asRow = (value) => (value && typeof value === 'object' ? value : {})

export function normalizeNumber (value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

// Accepted, short and excess are derived at read time — the sheet stores none of them.
export function acceptedQty (item = {}) {
  const row = asRow(item)
  return Math.max(normalizeNumber(row.ReceivedQty) - normalizeNumber(row.DamagedQty) - normalizeNumber(row.RejectedQty), 0)
}

export function shortQty (item = {}) {
  const row = asRow(item)
  return Math.max(normalizeNumber(row.ExpectedQty) - normalizeNumber(row.ReceivedQty), 0)
}

export function excessQty (item = {}) {
  const row = asRow(item)
  return Math.max(normalizeNumber(row.ReceivedQty) - normalizeNumber(row.ExpectedQty), 0)
}

// The settled cases are tested first: a rejected line must never read as merely short.
export function lineOutcome (item = {}) {
  const row = asRow(item)
  if (normalizeNumber(row.RejectedQty) > 0) return LINE_REJECTED
  if (normalizeNumber(row.DamagedQty) > 0) return LINE_DAMAGED
  if (normalizeNumber(row.ReceivedQty) <= 0) return LINE_PENDING
  if (excessQty(row) > 0) return LINE_EXCESS
  if (shortQty(row) > 0) return LINE_SHORT
  return LINE_CLEAN
}

export function decorateItem (item = {}) {
  const row = asRow(item)
  row.AcceptedQty = acceptedQty(row)
  row.ShortQty = shortQty(row)
  row.ExcessQty = excessQty(row)
  row.Outcome = lineOutcome(row)
  return row
}

export function summarizeItems (items = []) {
  return (Array.isArray(items) ? items : []).map(asRow).reduce((acc, row) => {
    acc.expected += normalizeNumber(row.ExpectedQty)
    acc.received += normalizeNumber(row.ReceivedQty)
    acc.accepted += acceptedQty(row)
    acc.damaged += normalizeNumber(row.DamagedQty)
    acc.rejected += normalizeNumber(row.RejectedQty)
    acc.short += shortQty(row)
    acc.excess += excessQty(row)
    acc.lines += 1
    return acc
  }, { expected: 0, received: 0, accepted: 0, damaged: 0, rejected: 0, short: 0, excess: 0, lines: 0 })
}

export function acceptedItems (items = []) {
  return (Array.isArray(items) ? items : [])
    .map(asRow)
    .filter((row) => acceptedQty(row) > 0)
}

export function acceptedItemCount (items = []) {
  return acceptedItems(items).length
}

// One line per purchase order line, with saved rows and typed counts merged over it.
// The form cards and the sticky bar both read this, so the two cannot drift.
export function mergeInspectionLines ({ orderLines = [], savedByOrderItem = new Map(), counts = {} } = {}) {
  return (Array.isArray(orderLines) ? orderLines : []).map(asRow).map((order) => {
    const key = text(order.Code)
    const saved = asRow(savedByOrderItem.get ? savedByOrderItem.get(key) : savedByOrderItem[key])
    const typed = asRow(counts[key])
    const line = {
      key,
      Code: text(saved.Code),
      PurchaseOrderItemCode: key,
      SKU: text(order.SKU) || text(saved.SKU),
      UOM: text(order.UOM),
      ExpectedQty: normalizeNumber(saved.ExpectedQty ?? order.OrderedQuantity ?? order.Quantity),
      ReceivedQty: typed.ReceivedQty == null ? normalizeNumber(saved.ReceivedQty) : normalizeNumber(typed.ReceivedQty),
      DamagedQty: typed.DamagedQty == null ? normalizeNumber(saved.DamagedQty) : normalizeNumber(typed.DamagedQty),
      RejectedQty: typed.RejectedQty == null ? normalizeNumber(saved.RejectedQty) : normalizeNumber(typed.RejectedQty),
      RejectedReason: typed.RejectedReason == null ? text(saved.RejectedReason) : text(typed.RejectedReason),
      Remarks: typed.Remarks == null ? text(saved.Remarks) : text(typed.Remarks),
      Status: 'Active'
    }
    return decorateItem(line)
  })
}

export function validateInspection (header = {}, items = []) {
  const record = asRow(header)
  const errors = []
  if (!text(record.PurchaseOrderCode)) errors.push('Select a purchase order.')
  if (!text(record.InspectionDate)) errors.push('An inspection date is required.')
  if (!text(record.InspectedUserName)) errors.push('Name the person who inspected the goods.')

  const rows = (Array.isArray(items) ? items : []).map(asRow)
  if (!rows.length) errors.push('Add at least one receiving line.')

  rows.forEach((row, index) => {
    const line = index + 1
    const received = normalizeNumber(row.ReceivedQty)
    const damaged = normalizeNumber(row.DamagedQty)
    const rejected = normalizeNumber(row.RejectedQty)
    if (!text(row.PurchaseOrderItemCode)) errors.push(`Row ${line}: the purchase order line link is missing.`)
    if (!text(row.SKU)) errors.push(`Row ${line}: SKU is required.`)
    for (const key of ['ExpectedQty', 'ReceivedQty', 'DamagedQty', 'RejectedQty']) {
      if (normalizeNumber(row[key]) < 0) errors.push(`Row ${line}: ${key} cannot be negative.`)
    }
    if (received < damaged + rejected) {
      errors.push(`Row ${line}: received quantity must cover damaged plus rejected.`)
    }
    if (rejected > 0 && !text(row.RejectedReason)) {
      errors.push(`Row ${line}: a rejection reason is required.`)
    }
  })

  return { valid: errors.length === 0, errors }
}

// A stable fingerprint of the inspection, so a resumed draft can tell whether anything
// actually changed before it writes.
export function inspectionSnapshot (header = {}, items = []) {
  const record = asRow(header)
  return JSON.stringify({
    header: {
      Code: text(record.Code),
      ProcurementCode: text(record.ProcurementCode),
      PurchaseOrderCode: text(record.PurchaseOrderCode),
      InspectionDate: text(record.InspectionDate),
      InspectedUserName: text(record.InspectedUserName),
      Progress: text(record.Progress) || 'DRAFT',
      Remarks: text(record.Remarks),
      Status: text(record.Status) || 'Active'
    },
    items: (Array.isArray(items) ? items : []).map(asRow).map((row) => ({
      Code: text(row.Code),
      PurchaseOrderItemCode: text(row.PurchaseOrderItemCode),
      SKU: text(row.SKU),
      ExpectedQty: normalizeNumber(row.ExpectedQty),
      ReceivedQty: normalizeNumber(row.ReceivedQty),
      DamagedQty: normalizeNumber(row.DamagedQty),
      RejectedQty: normalizeNumber(row.RejectedQty),
      RejectedReason: text(row.RejectedReason),
      Remarks: text(row.Remarks),
      Status: text(row.Status) || 'Active'
    })).sort((a, b) => (a.PurchaseOrderItemCode || a.Code).localeCompare(b.PurchaseOrderItemCode || b.Code))
  })
}

export function usePOReceivingInspection () {
  return {
    normalizeNumber,
    acceptedQty,
    shortQty,
    excessQty,
    lineOutcome,
    decorateItem,
    summarizeItems,
    acceptedItems,
    acceptedItemCount,
    mergeInspectionLines,
    validateInspection,
    inspectionSnapshot
  }
}
