import { todayInputValue } from './poReceivingMeta.js'

export function normalizeNumber(value) {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

export function acceptedQty(item = {}) {
  return Math.max(normalizeNumber(item.ReceivedQty) - normalizeNumber(item.DamagedQty) - normalizeNumber(item.RejectedQty), 0)
}

export function shortQty(item = {}) {
  return Math.max(normalizeNumber(item.ExpectedQty) - normalizeNumber(item.ReceivedQty), 0)
}

export function excessQty(item = {}) {
  return Math.max(normalizeNumber(item.ReceivedQty) - normalizeNumber(item.ExpectedQty), 0)
}

export function decorateItem(item = {}, skuInfoByCode = {}) {
  const skuInfo = skuInfoByCode[item.SKU] || {}
  return {
    ...item,
    ProductName: skuInfo.productName || item.ProductName || item.Description || item.SKU || 'Unknown Product',
    VariantCaption: skuInfo.variantsCsv || item.VariantCaption || item.SKU || '',
    AcceptedQty: acceptedQty(item),
    ShortQty: shortQty(item),
    ExcessQty: excessQty(item)
  }
}

export function defaultHeaderForm(purchaseOrder = null, receiving = null, userName = '') {
  return {
    Code: receiving?.Code || '',
    ProcurementCode: receiving?.ProcurementCode || purchaseOrder?.ProcurementCode || '',
    PurchaseOrderCode: receiving?.PurchaseOrderCode || purchaseOrder?.Code || '',
    InspectionDate: receiving?.InspectionDate || todayInputValue(),
    InspectedUserName: receiving?.InspectedUserName || userName || '',
    Progress: receiving?.Progress || 'DRAFT',
    Remarks: receiving?.Remarks || '',
    Status: receiving?.Status || 'Active'
  }
}

export function defaultItemForm(poItem = {}, receivingItem = null, skuInfoByCode = {}) {
  return decorateItem({
    Code: receivingItem?.Code || '',
    POReceivingCode: receivingItem?.POReceivingCode || '',
    PurchaseOrderItemCode: receivingItem?.PurchaseOrderItemCode || poItem?.Code || '',
    SKU: receivingItem?.SKU || poItem?.SKU || '',
    ExpectedQty: normalizeNumber(receivingItem?.ExpectedQty ?? poItem?.OrderedQuantity ?? poItem?.Quantity),
    ReceivedQty: normalizeNumber(receivingItem?.ReceivedQty),
    DamagedQty: normalizeNumber(receivingItem?.DamagedQty),
    RejectedQty: normalizeNumber(receivingItem?.RejectedQty),
    RejectedReason: receivingItem?.RejectedReason || '',
    Remarks: receivingItem?.Remarks || '',
    Status: receivingItem?.Status || 'Active'
  }, skuInfoByCode)
}

export function validateReceiving(header = {}, items = []) {
  const errors = []
  if (!header.PurchaseOrderCode) errors.push('Purchase Order is required.')
  if (!header.InspectionDate) errors.push('Inspection date is required.')
  if (!header.InspectedUserName) errors.push('Inspected user name is required.')
  if (!items.length) errors.push('At least one receiving item is required.')

  items.forEach((item, index) => {
    const row = index + 1
    const received = normalizeNumber(item.ReceivedQty)
    const damaged = normalizeNumber(item.DamagedQty)
    const rejected = normalizeNumber(item.RejectedQty)
    if (!`${item.PurchaseOrderItemCode || ''}`.trim()) errors.push(`Row ${row}: purchase order item link is required.`)
    if (!`${item.SKU || ''}`.trim()) errors.push(`Row ${row}: SKU is required.`)
    if (!`${item.Status || ''}`.trim()) errors.push(`Row ${row}: status is required.`)
    ;['ExpectedQty', 'ReceivedQty', 'DamagedQty', 'RejectedQty'].forEach((key) => {
      if (normalizeNumber(item[key]) < 0) errors.push(`Row ${row}: ${key} cannot be negative.`)
    })
    if (received < damaged + rejected) errors.push(`Row ${row}: received quantity must cover damaged plus rejected quantity.`)
    if (rejected > 0 && !`${item.RejectedReason || ''}`.trim()) errors.push(`Row ${row}: rejected reason is required.`)
  })

  return { valid: errors.length === 0, errors }
}

export function buildHeaderRecord(form = {}) {
  return {
    ProcurementCode: form.ProcurementCode || '',
    PurchaseOrderCode: form.PurchaseOrderCode,
    InspectionDate: form.InspectionDate,
    InspectedUserName: form.InspectedUserName,
    Progress: 'DRAFT',
    Remarks: form.Remarks || '',
    Status: form.Status || 'Active'
  }
}

export function buildItemRecord(item = {}) {
  return {
    PurchaseOrderItemCode: item.PurchaseOrderItemCode,
    SKU: item.SKU,
    ExpectedQty: normalizeNumber(item.ExpectedQty),
    ReceivedQty: normalizeNumber(item.ReceivedQty),
    DamagedQty: normalizeNumber(item.DamagedQty),
    RejectedQty: normalizeNumber(item.RejectedQty),
    RejectedReason: item.RejectedReason || '',
    Remarks: item.Remarks || '',
    Status: item.Status || 'Active'
  }
}

export function buildCompositePayload(header = {}, items = []) {
  return {
    resource: 'POReceivings',
    ...(header.Code ? { code: header.Code } : {}),
    data: buildHeaderRecord(header),
    children: [
      {
        resource: 'POReceivingItems',
        records: items.map((item) => ({
          _action: item.Code ? 'update' : 'create',
          ...(item.Code ? { _originalCode: item.Code } : {}),
          data: buildItemRecord(item)
        }))
      }
    ]
  }
}

export function summarizeItems(items = []) {
  return items.reduce((acc, item) => {
    acc.expected += normalizeNumber(item.ExpectedQty)
    acc.received += normalizeNumber(item.ReceivedQty)
    acc.accepted += acceptedQty(item)
    acc.damaged += normalizeNumber(item.DamagedQty)
    acc.rejected += normalizeNumber(item.RejectedQty)
    acc.short += shortQty(item)
    acc.excess += excessQty(item)
    return acc
  }, { expected: 0, received: 0, accepted: 0, damaged: 0, rejected: 0, short: 0, excess: 0 })
}

export function canonicalReceivingSnapshot(header = {}, items = []) {
  return JSON.stringify({
    header: {
      Code: header.Code || '',
      ProcurementCode: header.ProcurementCode || '',
      PurchaseOrderCode: header.PurchaseOrderCode || '',
      InspectionDate: header.InspectionDate || '',
      InspectedUserName: header.InspectedUserName || '',
      Progress: header.Progress || 'DRAFT',
      Remarks: header.Remarks || '',
      Status: header.Status || 'Active'
    },
    items: items.map((item) => ({
      Code: item.Code || '',
      PurchaseOrderItemCode: item.PurchaseOrderItemCode || '',
      SKU: item.SKU || '',
      ExpectedQty: normalizeNumber(item.ExpectedQty),
      ReceivedQty: normalizeNumber(item.ReceivedQty),
      DamagedQty: normalizeNumber(item.DamagedQty),
      RejectedQty: normalizeNumber(item.RejectedQty),
      RejectedReason: item.RejectedReason || '',
      Remarks: item.Remarks || '',
      Status: item.Status || 'Active'
    })).sort((a, b) => (a.PurchaseOrderItemCode || a.Code).localeCompare(b.PurchaseOrderItemCode || b.Code))
  })
}

export function buildGoodsReceiptCompositePayload(receiving = {}, receivingItems = [], purchaseOrder = {}, procurement = {}) {
  const acceptedItems = receivingItems
    .map((item) => ({ item, qty: acceptedQty(item) }))
    .filter((entry) => entry.qty > 0)

  return {
    resource: 'GoodsReceipts',
    data: {
      ProcurementCode: receiving.ProcurementCode || purchaseOrder.ProcurementCode || procurement.Code || '',
      PurchaseOrderCode: receiving.PurchaseOrderCode || purchaseOrder.Code || '',
      POReceivingCode: receiving.Code || '',
      Date: todayInputValue(),
      Status: 'Active'
    },
    children: [
      {
        resource: 'GoodsReceiptItems',
        records: acceptedItems.map(({ item, qty }) => ({
          _action: 'create',
          data: {
            POReceivingItemCode: item.Code,
            SKU: item.SKU,
            Qty: qty,
            Status: 'Active'
          }
        }))
      }
    ]
  }
}

export function acceptedReceiptItemCount(items = []) {
  return items.filter((item) => acceptedQty(item) > 0).length
}

export function acceptedReceiptItems(items = []) {
  return items
    .map((item) => ({ ...item, Qty: acceptedQty(item) }))
    .filter((item) => item.Qty > 0)
}
