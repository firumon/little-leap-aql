import { batchRef, textOrRef } from 'src/utils/appHelpers'
import { compositeNode } from 'src/composables/resources/nodePayloads'
import { splitByWarehouseStock } from './useRestockStockMatch'

import { stampFields } from 'src/utils/workflowStamp'
import { OUT_OF_WAREHOUSE, STOCK_REFERENCE, stockMovementRow, buildStockMovementNodes } from 'src/_resource/Operation/StockMovements/composables/useStockMovementPayload'
import { ONTO_THE_SHELF, OUTLET_REFERENCE, outletMovementRow, buildOutletMovementNodes } from 'src/_resource/Operation/OutletMovements/composables/useOutletMovementPayload'
// Creating a restock. DRAFT commits nothing, PENDING_APPROVAL waits for an approver,
// DIRECT auto-approves and deducts now. Partial cover is a supported DIRECT outcome.

const RESOURCE_NAME = 'OutletRestocks'
const RESTOCK_ITEMS = 'OutletRestockItems'
const STOCK_MOVEMENTS = 'StockMovements'
const OUTLET_MOVEMENTS = 'OutletMovements'
const CONSUMPTIONS = 'OutletConsumptions'

const DEFAULT_STORAGE = '_default'

export const RESTOCK_REF_PATH = `${RESOURCE_NAME}.latest.code`

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const todayISO = () => new Date().toISOString().slice(0, 10)


function modeOf (mode = '', draft = false) {
  const value = text(mode).toUpperCase()
  if (draft === true && value !== 'DIRECT') return 'DRAFT'
  if (value === 'DIRECT' || value === 'APPROVED') return 'DIRECT'
  if (value === 'DRAFT') return 'DRAFT'
  return 'PENDING_APPROVAL'
}

// A line is worth writing only with a SKU and a positive quantity.
function usableLines (lines = []) {
  return (Array.isArray(lines) ? lines : []).map(asRow)
    .filter((row) => text(row.SKU) && num(row.Quantity) > 0)
    .map((row) => ({ SKU: text(row.SKU), Quantity: num(row.Quantity) }))
}

// The columns a create lands with. Kept separate because the Add wizard owns its own
// pageState node; Layer 3 applies these to it rather than restating them.
export function restockCreateFields ({
  mode = 'PENDING_APPROVAL',
  draft = false,
  warehouseCode = '',
  actorName = '',
  comment = ''
} = {}) {
  const resolved = modeOf(mode, draft)
  const direct = resolved === 'DIRECT'

  return {
    mode: resolved,
    header: {
      Progress: direct ? 'APPROVED' : resolved,
      // A draft was not submitted, so it gets no stamp — that is what lets a later
      // real submit record when it actually happened.
      ...(resolved === 'DRAFT' ? {} : stampFields('ProgressSubmitted', actorName, comment)),
      ...(direct
        ? {
            ApprovedUser: text(actorName),
            ...stampFields('ProgressApproved', actorName, 'Auto-approved as a direct restock from the source warehouse.')
          }
        : {}),
      Status: 'Active'
    },
    // Only a direct restock allocates now. Pinning a warehouse on a draft would record
    // an availability that has expired by the time someone acts on it.
    linePatch: direct
      ? {
          WarehouseCode: text(warehouseCode),
          StorageName: DEFAULT_STORAGE,
          Progress: 'ALLOCATED',
          ...stampFields('ProgressAllocated', actorName, 'Allocated from the source warehouse on submission.')
        }
      : null
  }
}

// Every resource a create in this mode writes — the single gate Layer 3 checks.
export function restockCreatePermissions ({ mode = 'PENDING_APPROVAL', draft = false } = {}) {
  const permissions = { [RESOURCE_NAME]: 'create', [RESTOCK_ITEMS]: 'create' }
  if (modeOf(mode, draft) === 'DIRECT') permissions[STOCK_MOVEMENTS] = 'create'
  return permissions
}

// What a standalone create ADDS to the page's own restock node — never that node
// itself, which the Add wizard already holds and this must not overwrite.
export function buildRestockCreateChainNodes ({
  outletCode = '',
  mode = 'PENDING_APPROVAL',
  draft = false,
  warehouseCode = '',
  lines = [],
  actorName = ''
} = {}) {
  const resolved = modeOf(mode, draft)
  const direct = resolved === 'DIRECT'
  const rows = usableLines(lines)

  if (!text(outletCode)) {
    return { valid: false, nodes: [], permissions: {}, message: 'Select an outlet before submitting.' }
  }
  if (!rows.length) {
    return { valid: false, nodes: [], permissions: {}, message: 'Add at least one item with a quantity greater than zero.' }
  }
  if (direct && !text(warehouseCode)) {
    return { valid: false, nodes: [], permissions: {}, message: 'Select a source warehouse before submitting a direct restock.' }
  }

  const nodes = []
  if (direct) {
    // Negative: the units are committed OUT of the warehouse.
    nodes.push(...buildStockMovementNodes(rows.map((row) => stockMovementRow({
      warehouseCode,
      sku: row.SKU,
      qty: row.Quantity,
      direction: OUT_OF_WAREHOUSE,
      referenceType: STOCK_REFERENCE.RESTOCK,
      referenceCode: batchRef(RESTOCK_REF_PATH)
    }))).nodes)
  }

  return {
    valid: true,
    nodes,
    permissions: restockCreatePermissions({ mode: resolved }),
    successMsg: resolved === 'DRAFT' ? 'Restock request saved as draft.' : 'Restock request submitted.'
  }
}

// The restock another workflow raises, so this builds the restock node itself.
// linkToConsumption:false blanks OutletConsumptionCode — that batch writes no consumption.
export function buildRestockNodes (form = {}, restockRows = [], options = {}) {
  const entry = asRow(form)
  const rows = usableLines(restockRows)
  if (!rows.length) return { nodes: [], allocated: [], pending: [], shortfall: 0 }

  const resolved = modeOf(options.mode)
  const direct = resolved === 'DIRECT'
  const warehouseCode = text(options.warehouseCode)
  const actorName = text(options.actorName)
  const date = text(entry.Date) || todayISO()
  const markDelivered = direct && options.markDelivered === true
  const standalone = options.linkToConsumption === false
  const consumptionCode = standalone
    ? ''
    : textOrRef(options.consumptionRef || batchRef(`${CONSUMPTIONS}.latest.code`))
  // The timeline shows this verbatim, so it has to be true of the record it sits on.
  const origin = standalone
    ? 'Submitted from an outlet visit that recorded no consumption.'
    : 'Submitted with an outlet consumption.'

  const split = direct
    ? splitByWarehouseStock(rows, warehouseCode, options.warehouseStorages || [])
    : { allocated: [], pending: rows, shortfall: 0 }

  const itemProgress = markDelivered ? 'DELIVERED' : 'ALLOCATED'
  const children = [
    ...split.allocated.map((row) => ({
      _action: 'create',
      data: {
        SKU: row.SKU,
        Quantity: row.Quantity,
        WarehouseCode: warehouseCode,
        StorageName: DEFAULT_STORAGE,
        Progress: itemProgress,
        ...stampFields('ProgressAllocated', actorName, 'Allocated from the source warehouse during consumption submission.'),
        ...(markDelivered ? stampFields('ProgressDelivered', actorName, 'Delivered to the outlet during consumption submission.') : {}),
        Status: 'Active'
      }
    })),
    ...split.pending.map((row) => ({
      _action: 'create',
      data: {
        SKU: row.SKU,
        Quantity: row.Quantity,
        WarehouseCode: '',
        StorageName: '',
        Progress: 'PENDING',
        Status: 'Active'
      }
    }))
  ]

  // Derived from the pending lines, so the parent cannot disagree with its children.
  const parentProgress = direct
    ? (markDelivered ? (split.pending.length ? 'PARTIALLY_DELIVERED' : 'DELIVERED') : 'APPROVED')
    : resolved

  const nodes = [compositeNode({
    resource: RESOURCE_NAME,
    record: {
      Date: date,
      OutletCode: text(entry.OutletCode),
      OutletConsumptionCode: consumptionCode,
      RequestedUser: text(entry.Username),
      ApprovedUser: direct ? actorName : '',
      Progress: parentProgress,
      ...(resolved === 'PENDING_APPROVAL' ? stampFields('ProgressSubmitted', actorName, origin) : {}),
      ...(direct ? stampFields('ProgressApproved', actorName, 'Auto-approved as a direct restock from the source warehouse.') : {}),
      ...(markDelivered ? stampFields('ProgressDelivered', actorName, 'Delivered to the outlet during consumption submission.') : {}),
      Status: 'Active'
    },
    children: [{ resource: RESTOCK_ITEMS, records: children }],
    reload: [RESOURCE_NAME, RESTOCK_ITEMS]
  })]

  if (direct && split.allocated.length) {
    // Negative: the units are committed OUT of the warehouse.
    nodes.push(...buildStockMovementNodes(split.allocated.map((row) => stockMovementRow({
      warehouseCode,
      sku: row.SKU,
      qty: row.Quantity,
      direction: OUT_OF_WAREHOUSE,
      referenceType: STOCK_REFERENCE.RESTOCK,
      referenceCode: batchRef(RESTOCK_REF_PATH)
    }))).nodes)

    if (markDelivered) {
      // Positive, on the OUTLET ledger — the other leg, written only when the user
      // confirmed the stock physically travelled with them.
      nodes.push(...buildOutletMovementNodes(split.allocated.map((row) => outletMovementRow({
        outletCode: entry.OutletCode,
        sku: row.SKU,
        qty: row.Quantity,
        direction: ONTO_THE_SHELF,
        referenceType: OUTLET_REFERENCE.RESTOCK_DELIVERY,
        referenceCode: batchRef(RESTOCK_REF_PATH),
        movementDate: date
      }))).nodes)
    }
  }

  return { nodes, allocated: split.allocated, pending: split.pending, shortfall: split.shortfall }
}

// The chained create as an envelope. Empty lines yield a VALID, EMPTY one — a
// consumption with no replenishment is a normal submission.
export function buildRestockChainNodes ({
  form = {},
  lines = [],
  mode = 'PENDING_APPROVAL',
  warehouseCode = '',
  warehouseStorages = [],
  markDelivered = false,
  linkToConsumption = true,
  actorName = ''
} = {}) {
  const rows = usableLines(lines)
  if (!rows.length) return { valid: true, nodes: [], permissions: {} }

  const resolved = modeOf(mode)
  if (resolved === 'DIRECT' && !text(warehouseCode)) {
    return { valid: false, nodes: [], permissions: {}, message: 'Select a source warehouse for the direct restock.' }
  }

  const built = buildRestockNodes(form, rows, {
    mode: resolved,
    warehouseCode,
    warehouseStorages,
    markDelivered,
    linkToConsumption,
    actorName
  })

  const permissions = restockCreatePermissions({ mode: resolved })
  // Delivering on the visit writes a second ledger this submission would otherwise
  // leave ungated.
  if (resolved === 'DIRECT' && markDelivered === true) permissions[OUTLET_MOVEMENTS] = 'create'

  return {
    valid: true,
    nodes: built.nodes,
    permissions,
    allocated: built.allocated,
    pending: built.pending,
    shortfall: built.shortfall,
    successMsg: 'Restock request created.'
  }
}

export function useRestockCreation () {
  return {
    RESTOCK_REF_PATH,
    restockCreateFields,
    restockCreatePermissions,
    buildRestockCreateChainNodes,
    buildRestockNodes,
    buildRestockChainNodes
  }
}
