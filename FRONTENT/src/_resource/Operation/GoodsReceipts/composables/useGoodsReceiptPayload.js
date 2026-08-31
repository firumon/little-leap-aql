import { textOrRef } from 'src/utils/appHelpers'
import { buildProcurementRollbackNode } from 'src/_resource/Operation/Procurements/composables/useProcurementPayload'
import { GOODS_RECEIVING } from 'src/_resource/Operation/Procurements/composables/useProcurementProgress'
import { acceptedQty } from 'src/_resource/Operation/POReceivings/composables/usePOReceivingInspection'
import { INACTIVE, canInvalidate } from './useGoodsReceiptProgress'

const RESOURCE_NAME = 'GoodsReceipts'
const ITEMS_RESOURCE = 'GoodsReceiptItems'
const RECEIVINGS_RESOURCE = 'POReceivings'
const REFRESH_RESOURCES = [
  'GoodsReceipts',
  'GoodsReceiptItems',
  'POReceivings',
  'POReceivingItems',
  'PurchaseOrders',
  'Procurements'
]

export const INVALIDATE_ACTION = { action: 'Invalidate', column: 'Status', columnValue: INACTIVE }

export { RESOURCE_NAME, ITEMS_RESOURCE }

const text = (value) => String(value ?? '').trim()
const asRow = (value) => (value && typeof value === 'object' ? value : {})

export function todayDashed () {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

// A GRN line carries accepted quantity only, derived from the inspection counts.
export function buildGoodsReceiptCompositeNode ({ receiving = null, items = [], purchaseOrder = null, procurement = null } = {}) {
  const record = asRow(receiving)
  const order = asRow(purchaseOrder)
  const proc = asRow(procurement)

  const lines = (Array.isArray(items) ? items : [])
    .map(asRow)
    .map((row) => ({ row, qty: acceptedQty(row) }))
    .filter((entry) => entry.qty > 0)

  return {
    resource: RESOURCE_NAME,
    record: {
      ProcurementCode: text(record.ProcurementCode) || text(order.ProcurementCode) || text(proc.Code),
      PurchaseOrderCode: text(record.PurchaseOrderCode) || text(order.Code),
      POReceivingCode: text(record.Code),
      Date: todayDashed(),
      Status: 'Active'
    },
    children: [{
      resource: ITEMS_RESOURCE,
      records: lines.map(({ row, qty }) => ({
        _action: 'create',
        data: {
          POReceivingItemCode: text(row.Code),
          SKU: text(row.SKU),
          Qty: qty,
          Status: 'Active'
        }
      }))
    }]
  }
}

export function buildGoodsReceiptItemDeactivationNodes (goodsReceiptCode, goodsReceiptItems = []) {
  const parent = text(goodsReceiptCode)
  const records = (Array.isArray(goodsReceiptItems) ? goodsReceiptItems : [])
    .map(asRow)
    .filter((row) => text(row.GoodsReceiptCode) === parent && text(row.Status || 'Active') === 'Active')
    .map((row) => ({ Code: text(row.Code), Status: INACTIVE }))
  return records.length ? [{ resource: ITEMS_RESOURCE, many: true, records: records, reload: [ITEMS_RESOURCE] }] : []
}

// Pulling a GRN back also rolls the receiving to CONFIRMED and the procurement to
// GOODS_RECEIVING, so the stock posting never outlives the record behind it.
export function buildGoodsReceiptInvalidateNodes ({ goodsReceipt = null, goodsReceiptItems = [], receiving = null, procurement = null } = {}) {
  const record = asRow(goodsReceipt)
  const code = text(record.Code)
  if (!code || !canInvalidate(record)) return []

  const nodes = [
    {
      resource: RESOURCE_NAME,
      permissions: { invalidate: 'You are not allowed to invalidate this goods receipt.' },
      actions: [{ ...INVALIDATE_ACTION, code: textOrRef(code), data: {} }],
      reload: REFRESH_RESOURCES
    },
    ...buildGoodsReceiptItemDeactivationNodes(code, goodsReceiptItems)
  ]

  const receivingRow = asRow(receiving)
  if (text(receivingRow.Code) && text(receivingRow.Progress).toUpperCase() === 'GRN_GENERATED') {
    nodes.push({
      resource: RECEIVINGS_RESOURCE,
      code: textOrRef(receivingRow.Code),
      record: { Progress: 'CONFIRMED' },
      permissions: { update: 'You are not allowed to reopen this receiving.' }
    })
  }

  const rollback = buildProcurementRollbackNode(procurement, GOODS_RECEIVING)
  if (rollback) nodes.push(rollback)

  return nodes
}

export function buildGoodsReceiptInvalidateChainNodes ({ goodsReceipt = null, goodsReceiptItems = [], receiving = null, procurement = null } = {}) {
  const built = buildGoodsReceiptInvalidateNodes({ goodsReceipt, goodsReceiptItems, receiving, procurement })
  if (!built.length) {
    return [{ valid: false, message: 'This goods receipt is already invalidated.' }]
  }
  return [{ ...built[0], successMsg: 'Goods receipt invalidated.' }, ...built.slice(1)]
}

export function goodsReceiptItemsOf (goodsReceipt, goodsReceiptItems = []) {
  const code = text(asRow(goodsReceipt).Code)
  if (!code) return []
  return (Array.isArray(goodsReceiptItems) ? goodsReceiptItems : [])
    .map(asRow)
    .filter((row) => text(row.GoodsReceiptCode) === code && text(row.Status || 'Active') === 'Active')
}

export function goodsReceiptTotals (goodsReceipt, goodsReceiptItems = []) {
  const rows = goodsReceiptItemsOf(goodsReceipt, goodsReceiptItems)
  const qty = rows.reduce((sum, row) => {
    const parsed = Number(row.Qty)
    return sum + (Number.isFinite(parsed) ? parsed : 0)
  }, 0)
  return { lines: rows.length, quantity: qty }
}

export function useGoodsReceiptPayload () {
  return {
    buildGoodsReceiptCompositeNode,
    buildGoodsReceiptItemDeactivationNodes,
    buildGoodsReceiptInvalidateNodes,
    buildGoodsReceiptInvalidateChainNodes,
    goodsReceiptItemsOf,
    goodsReceiptTotals,
    todayDashed
  }
}
