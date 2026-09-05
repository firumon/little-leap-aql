
import { batchRef, textOrRef } from 'src/utils/appHelpers'
import { toDateTime24 } from 'src/utils/dateHelpers'
import {
  SUBMITTED,
  CANCELLED,
  STOCKED,
  DISPOSED,
  isFlagged,
  returnRequiresTrack,
  REASON_REQUIRING_COMMENT,
  deriveReturnProgress,
  isCancelled,
  isEditable,
  invoiceAdjustmentRequired,
  warehouseActionRequired,
  warehouseActionCompleted
} from './useReturnProgress'

import { INTO_WAREHOUSE, STOCK_REFERENCE, stockMovementRow, buildStockMovementNodes } from 'src/_resource/Operation/StockMovements/composables/useStockMovementPayload'
import { OFF_THE_SHELF, ONTO_THE_SHELF, OUTLET_REFERENCE, outletMovementRow, buildOutletMovementNode, buildOutletMovementNodes } from 'src/_resource/Operation/OutletMovements/composables/useOutletMovementPayload'
const RESOURCE_NAME = 'OutletReturns' // this module IS OutletReturns — always

const STOCK_MOVEMENTS = 'StockMovements'

const REF_RETURN = 'OutletReturn'

/** The batch path a movement created alongside a brand-new return chains its code off. */
export const RETURN_REF_PATH = `${RESOURCE_NAME}.latest.code`

const DEFAULT_STORAGE = '_default'

// Stamped by GAS on every write. Echoing them back from a hydrated row would re-send the
// creation audit as if it were an edit.
const AUDIT_COLUMNS = ['Code', 'CreatedAt', 'CreatedBy', 'UpdatedAt', 'UpdatedBy', 'AccessRegion']

const withoutAudit = (row) => {
  const out = { ...asRow(row) }
  for (const key of AUDIT_COLUMNS) delete out[key]
  return out
}

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const asList = (value) => (Array.isArray(value) ? value : [])
const toNumber = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}
const todayISO = () => new Date().toISOString().slice(0, 10)

/** The `'TRUE'`/`'FALSE'` strings the sheet stores — never a native boolean. */
const flag = (value) => (isFlagged(value) ? 'TRUE' : 'FALSE')

export function returnQtyChange (qty, { invoiceRequired = false, warehouseRequired = false } = {}) {
  const quantity = Math.abs(toNumber(qty))
  if (invoiceRequired && !warehouseRequired) return quantity
  if (!invoiceRequired && warehouseRequired) return -quantity
  return 0
}

/** The same table read off a STORED row, for the cancellation reversal. */
export function storedQtyChange (record) {
  const row = asRow(record)
  return returnQtyChange(row.Qty, {
    invoiceRequired: invoiceAdjustmentRequired(row),
    warehouseRequired: warehouseActionRequired(row)
  })
}

// `qtyChange` already carries its sign from `returnQtyChange`; the ledger takes a
// magnitude plus a direction.
const shelfDirection = (qtyChange) => (toNumber(qtyChange) < 0 ? OFF_THE_SHELF : ONTO_THE_SHELF)

import { useAuth } from 'src/composables/core/useAuth'
import { useDataStore } from 'src/stores/data'
import { useWarehouseResource } from 'src/_resource/Master/Warehouses/composables/useWarehouseResource'
import { effectivePriceListCode, priceFromList, resolveReturnUnitPrice } from './useReturnPricing'
import { resourceRow } from 'src/composables/resources/useResourceConfig'
import { priceOf, priceListForOutlet } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionStock'

// ROW builder: one OutletReturns sheet row, with every column the domain can answer already
// resolved — the credit price included. A return has no children, so a row is all it needs.
export function returnRow (parent = {}, extra = {}) {
  const { user } = useAuth()
  const seed = { ...asRow(parent), ...asRow(extra) }
  const outletCode = text(seed.OutletCode)
  const priceListCode = text(seed.PriceListCode) || text(priceListForOutlet(outletCode)?.code)
  const price = seed.Price === undefined || seed.Price === null || seed.Price === ''
    ? toNumber(priceOf(seed.SKU, priceListCode))
    : toNumber(seed.Price)

  return resourceRow(RESOURCE_NAME, {
    Username: user.value?.name || '',
    Date: todayISO(),
    Reason: 'DAMAGE',
    InvoiceAdjustmentRequired: flag(true),
    InvoiceAdjustmentDone: 'FALSE',
    WarehouseActionRequired: flag(false),
    WarehouseActionCompleted: 'FALSE',
    Progress: SUBMITTED,
    Status: 'Active'
  }, parent, extra, { Price: Math.round(price * 100) / 100 })
}

// NODE builder: the pageState many-node those rows sit on. A return carries no aggregate,
// so there is nothing to derive.
export function returnsNode (records = [], options = {}) {
  const rows = (Array.isArray(records) ? records : []).map((row) => returnRow(row, options.extra))
  return {
    resource: RESOURCE_NAME,
    many: true,
    records: rows,
    permissions: { create: 'You are not allowed to log a return.' },
    successMsg: `${rows.length} return${rows.length === 1 ? '' : 's'} logged.`
  }
}

const PRICE_LIST_CONTROL = 'PriceListCode'
const PRICE_TOUCHED_CONTROL = 'PriceTouched'

const OUTLET_MOVEMENTS = 'OutletMovements'

const draftOf = (pageState) => asRow(pageState.getRecord(null, RESOURCE_NAME))
const setDraft = (pageState, key, value) => pageState.setRecord(key, value, RESOURCE_NAME)

// The one line a bill charges for a SKU, plus the list it was billed on.
function invoiceLineFor (invoiceCode, sku) {
  const code = text(invoiceCode)
  if (!code) return null

  const store = useDataStore()
  const header = (store.getRecords('OutletConsumptionInvoices') || [])
    .find((row) => text(row.Code) === code) || null

  let qty = 0
  let price = null
  for (const line of store.getRecords('OutletConsumptionInvoiceItems') || []) {
    if (text(line.OutletConsumptionInvoiceCode) !== code) continue
    if (sku && text(line.SKU) !== text(sku)) continue
    qty += toNumber(line.Qty)
    if (price === null) price = toNumber(line.Price)
  }

  if (price === null) return null
  return { qty, price, priceListCode: text(header?.PriceListCode) }
}

// Price from the chosen list, filling only what nobody has claimed. A bill-linked draft is
// never repriced: its figures came off the invoice, and a list may not argue with it.
function repriceDraft (pageState) {
  const draft = draftOf(pageState)
  if (text(draft.SourceInvoiceCode)) return
  if (pageState.getControls(PRICE_TOUCHED_CONTROL, false, RESOURCE_NAME) === true) return

  const sku = text(draft.SKU)
  if (!sku) return

  const list = text(pageState.getControls(PRICE_LIST_CONTROL, '', RESOURCE_NAME))
  const price = list ? priceFromList(list, sku) : resolveReturnUnitPrice(draft.OutletCode, sku)
  setDraft(pageState, 'Price', toNumber(price))
}

// A new outlet bills on its own list, and the old bill was never issued to it.
function applyReturnOutlet (outletCode, pageState) {
  setDraft(pageState, 'SourceInvoiceCode', '')
  const list = effectivePriceListCode(outletCode)
  if (list) pageState.setControls(PRICE_LIST_CONTROL, list, RESOURCE_NAME)
  repriceDraft(pageState)
}

function applyReturnSku (sku, pageState) {
  setDraft(pageState, 'SourceInvoiceCode', '')
  repriceDraft(pageState)
}

// Picking or clearing a source invoice reshapes the draft. Runs as the node's `derive`.
export function applyReturnSourceInvoice (invoiceCode, pageState) {
  if (!pageState) return
  const code = text(invoiceCode)

  if (!code) {
    setDraft(pageState, 'InvoiceAdjustmentRequired', flag(false))
    return
  }

  const line = invoiceLineFor(code, draftOf(pageState).SKU)
  if (!line) return

  pageState.setRecord(null, {
    Qty: line.qty,
    Price: line.price,
    InvoiceAdjustmentRequired: flag(true),
    InvoiceAdjustmentDone: flag(false)
  }, RESOURCE_NAME)

  pageState.setControls(PRICE_LIST_CONTROL, line.priceListCode, RESOURCE_NAME)
  pageState.setControls(PRICE_TOUCHED_CONTROL, false, RESOURCE_NAME)
}

// A return that credits nothing carries no bill. Writing '' twice is a no-op, so this and
// the source-invoice handler settle each other rather than looping.
function applyReturnInvoiceTrack (required, pageState) {
  if (!isFlagged(required)) setDraft(pageState, 'SourceInvoiceCode', '')
}

// Stock only needs a destination while it is actually leaving the shelf.
export function applyReturnWarehouseTrack (required, pageState) {
  if (!isFlagged(required)) {
    setDraft(pageState, 'WarehouseCode', '')
    return
  }
  if (text(draftOf(pageState).WarehouseCode)) return
  setDraft(pageState, 'WarehouseCode', text(useWarehouseResource().mainWarehouse.value?.code))
}

// Progress is a FUNCTION of the two track flags, so it is re-derived on the live node.
// Submit no longer builds a record, so nothing else would ever set it.
function syncReturnDraftProgress (pageState) {
  setDraft(pageState, 'Progress', deriveReturnProgress(draftOf(pageState)))
}

// The shelf movement is a NODE. Its existence IS the answer to "does this return move
// stock", so it is created and dropped as the draft changes, never at submit.
function syncReturnDraftMovement (pageState, stored = null) {
  const draft = draftOf(pageState)
  const was = asRow(stored)
  const editing = !!text(was.Code)
  const outletCode = text(draft.OutletCode) || text(was.OutletCode)
  const sku = text(draft.SKU)

  // An edit moves the DIFFERENCE, never the whole: the units already on the ledger stay
  // there, and only what the correction changed is written.
  const qtyChange = returnQtyChange(draft.Qty, {
    invoiceRequired: isFlagged(draft.InvoiceAdjustmentRequired),
    warehouseRequired: isFlagged(draft.WarehouseActionRequired)
  }) - (editing ? storedQtyChange(was) : 0)

  if (!qtyChange || !outletCode || !sku) {
    pageState.removeNode(OUTLET_MOVEMENTS)
    return
  }

  pageState.applyNodes(buildOutletMovementNode(outletMovementRow({
    outletCode,
    storageName: draft.StorageName || was.StorageName,
    sku,
    qty: qtyChange,
    direction: shelfDirection(qtyChange),
    referenceType: OUTLET_REFERENCE.RETURN,
    // On Add the return does not exist yet; GAS resolves the ref to its generated code.
    referenceCode: editing ? text(was.Code) : batchRef(RETURN_REF_PATH),
    movementDate: editing ? todayISO() : (text(draft.Date) || todayISO())
  })))
}

// Progress for an ACTION route: the node holds only the columns that change, so the
// verdict is asked of the stored row with those changes laid over it.
function syncReturnActionProgress (pageState, stored) {
  const merged = { ...asRow(stored), ...draftOf(pageState) }
  setDraft(pageState, 'Progress', deriveReturnProgress(merged))
}

/** Whichever stamp pair the disposition writes. The other is blanked, never left stale. */
function warehouseStampPair (action, actorName) {
  const now = toDateTime24(new Date())
  const actor = text(actorName)
  return text(action) === DISPOSED
    ? { WarehouseActionDisposedAt: now, WarehouseActionDisposedBy: actor, WarehouseActionStockedAt: '', WarehouseActionStockedBy: '' }
    : { WarehouseActionStockedAt: now, WarehouseActionStockedBy: actor, WarehouseActionDisposedAt: '', WarehouseActionDisposedBy: '' }
}

// A disposal writes stock off; only a stocking puts units back on a warehouse shelf.
function syncReturnStockMovement (pageState, stored) {
  const was = asRow(stored)
  const draft = draftOf(pageState)
  const stocksBackIn = text(draft.WarehouseAction) !== DISPOSED && text(was.WarehouseCode)

  if (!stocksBackIn) {
    pageState.removeNode(STOCK_MOVEMENTS)
    return
  }

  pageState.applyNodes(buildStockMovementNodes([stockMovementRow({
    warehouseCode: was.WarehouseCode,
    storageName: draft.StorageName,
    sku: was.SKU,
    qty: was.Qty,
    direction: INTO_WAREHOUSE,
    referenceType: STOCK_REFERENCE.RETURN,
    referenceCode: text(was.Code)
  })]))
}

// Every consequence the Add page has, declared once. The UI writes ONE column per
// interaction; everything that follows from it is regenerated here, so the live nodes are
// always exactly the batch that would be sent.
export function returnDraftDerivations ({ movement = true, stored = null } = {}) {
  // Every entry names its resource. `usePageStateDerive.sourceFor` resolves the address
  // itself and does NOT inherit it from the node the entry travelled on, so an entry
  // without `resource` silently watches a blank node and never fires.
  const on = (spec) => ({ ...spec, resource: RESOURCE_NAME })

  return [
    { key: 'returnAdd:outlet', on: on({ record: 'OutletCode' }), immediate: false, handler: applyReturnOutlet },
    { key: 'returnAdd:sku', on: on({ record: 'SKU' }), immediate: false, handler: applyReturnSku },
    { key: 'returnAdd:sourceInvoice', on: on({ record: 'SourceInvoiceCode' }), immediate: false, handler: applyReturnSourceInvoice },
    { key: 'returnAdd:priceList', on: on({ control: PRICE_LIST_CONTROL }), immediate: false, handler: (value, api) => repriceDraft(api) },
    { key: 'returnAdd:invoiceTrack', on: on({ record: 'InvoiceAdjustmentRequired' }), immediate: false, handler: applyReturnInvoiceTrack },
    { key: 'returnAdd:warehouseTrack', on: on({ record: 'WarehouseActionRequired' }), immediate: false, handler: applyReturnWarehouseTrack },
    ...(movement
      ? [{ key: 'returnAdd:record', on: on({ record: true }), immediate: false, handler: (value, api) => { syncReturnDraftProgress(api); syncReturnDraftMovement(api, stored) } }]
      : [{ key: 'returnAdd:record', on: on({ record: true }), immediate: false, handler: (value, api) => syncReturnDraftProgress(api) }])
  ]
}

// Why a draft cannot be submitted, or '' when it can. The ONE rule set: the create builder
// asks it too, so the headless bulk path and the page can never disagree.
export function validateReturnDraft (record = {}, { requireTrack = true } = {}) {
  const entry = asRow(record)

  if (!text(entry.OutletCode)) return 'Outlet is required.'
  if (!text(entry.SKU)) return 'SKU is required.'
  if (Math.abs(toNumber(entry.Qty)) <= 0) return 'Returned quantity must be greater than 0.'
  if (requireTrack && !returnRequiresTrack(entry)) {
    return 'A return must either be credited on an invoice or move stock off the shelf.'
  }
  if (text(entry.Reason) === REASON_REQUIRING_COMMENT && !text(entry.ReasonComment)) {
    return 'Reason "Other" needs an explanation.'
  }
  if (isFlagged(entry.WarehouseActionRequired) && !text(entry.WarehouseCode)) {
    return 'Target warehouse is required when stock is leaving the outlet.'
  }
  return ''
}

// The blank Add draft, its controls and every rule that keeps it true. Layer 3 applies it.
export function buildReturnInitNodes ({ actorName = '', outletCode = '' } = {}) {
  const { user } = useAuth()

  return [{
    resource: RESOURCE_NAME,
    // The sheet's own DefaultValues first; only what the PAGE decides is passed in.
    record: resourceRow(RESOURCE_NAME, {
      Date: todayISO(),
      Username: text(actorName) || text(user.value?.name || user.value?.email),
      OutletCode: text(outletCode),
      SKU: '',
      // Not in DefaultValues yet — belongs in syncAppResources.gs beside the others.
      Reason: 'DAMAGE',
      ReasonComment: '',
      WarehouseCode: '',
      // The page's opening STANCE, deliberately not the sheet's default: a return is logged
      // one unit at a time, and its stock usually does leave the shelf.
      Qty: 1,
      WarehouseActionRequired: flag(true)
    }),
    controls: { [PRICE_LIST_CONTROL]: '', [PRICE_TOUCHED_CONTROL]: false },
    derive: returnDraftDerivations(),
    permissions: { create: 'You are not allowed to log a return.' }
  }]
}

export function buildReturnCreateNodes ({ form = {}, resolvedPrice = 0, actorName = '', requireTrack = true } = {}) {
  const entry = asRow(form)
  const outletCode = text(entry.OutletCode)
  const sku = text(entry.SKU)
  const qty = Math.abs(toNumber(entry.Qty))

  const problem = validateReturnDraft(entry, { requireTrack })
  if (problem) return [{ valid: false, message: problem }]

  const invoiceRequired = isFlagged(entry.InvoiceAdjustmentRequired)
  const warehouseRequired = isFlagged(entry.WarehouseActionRequired)

  const record = {
    OutletCode: outletCode,
    Date: text(entry.Date) || todayISO(),
    Username: text(entry.Username) || text(actorName),
    SKU: sku,
    Qty: qty,
    Price: Math.round(toNumber(resolvedPrice) * 100) / 100,
    Reason: text(entry.Reason) || 'DAMAGE',
    ReasonComment: text(entry.ReasonComment),
    InvoiceAdjustmentRequired: flag(invoiceRequired),
    InvoiceAdjustmentDone: 'FALSE',
    // Only ever populated by the invoice chain, never at creation: a return carries a
    // SETTLEMENT invoice code once an invoice has actually credited it.
    ConsumptionInvoiceCode: '',
    SourceInvoiceCode: invoiceRequired ? text(entry.SourceInvoiceCode) : '',
    WarehouseActionRequired: flag(warehouseRequired),
    WarehouseActionCompleted: 'FALSE',
    WarehouseCode: warehouseRequired ? text(entry.WarehouseCode) : '',
    WarehouseAction: '',
    WarehouseActionDisposedReason: '',
    Status: 'Active'
  }

  // Asked of the row as it will be STORED — not of the form.
  record.Progress = deriveReturnProgress(record)

  const nodes = [{ resource: RESOURCE_NAME, record: record, permissions: { create: 'You are not allowed to create this outlet return.' }}]

  const qtyChange = returnQtyChange(qty, { invoiceRequired, warehouseRequired })
  if (qtyChange !== 0) {
    nodes.push(buildOutletMovementNode(outletMovementRow({
      outletCode,
      storageName: entry.StorageName,
      sku,
      qty: qtyChange,
      direction: shelfDirection(qtyChange),
      referenceType: OUTLET_REFERENCE.RETURN,
      // The return does not exist yet; GAS resolves this to its generated code (§9.4).
      referenceCode: batchRef(RETURN_REF_PATH),
      movementDate: record.Date
    })))
  }

  return nodes
}

// Which list this return was priced on. `OutletReturns` has no PriceListCode column, so it
// is recovered: the linked bill's list if there is one, else the outlet's effective list.
function storedPriceListCode (stored) {
  const row = asRow(stored)
  const fromInvoice = invoiceLineFor(row.SourceInvoiceCode, row.SKU)
  return text(fromInvoice?.priceListCode) || text(effectivePriceListCode(row.OutletCode))
}

// The Edit draft: the stored row, its controls and every rule that keeps it true. The
// derivations carry the stored row so the shelf movement writes the DIFFERENCE.
export function buildReturnEditNodes ({ record = {} } = {}) {
  const stored = asRow(record)
  const code = text(stored.Code)

  if (!code) return [{ valid: false, message: 'Return code is missing.' }]
  if (!isEditable(stored)) {
    return [{ valid: false, message: 'This return can no longer be edited. Cancel and re-log it instead.' }]
  }

  return [{
    resource: RESOURCE_NAME,
    code: textOrRef(code),
    // Progress is stated at mount as well as re-derived on change, so an edit that alters
    // nothing still corrects a row whose stored state predates the current matrix.
    record: { ...withoutAudit(resourceRow(RESOURCE_NAME, stored)), Progress: deriveReturnProgress(stored) },
    // The stored price is the figure that was recorded, so it counts as typed: nothing may
    // re-price a correction someone already made.
    controls: { [PRICE_LIST_CONTROL]: storedPriceListCode(stored), [PRICE_TOUCHED_CONTROL]: true },
    derive: returnDraftDerivations({ stored }),
    reload: ['OutletStorages'],
    permissions: { update: 'You are not allowed to update this outlet return.' },
    successMsg: `Return ${code} updated.`
  }]
}

export function buildReturnBulkCreateNodes ({ lines = [], actorName = '', movementDate = '' } = {}) {
  const entries = asList(lines).map(asRow).filter((line) => text(asRow(line.form).SKU))
  if (!entries.length) return [
    
  ]

  const records = []
  const movements = []

  for (const line of entries) {
    const built = buildReturnCreateNodes({
      form: line.form,
      resolvedPrice: line.resolvedPrice,
      actorName,
      // A consumption surplus line may credit nothing and move nothing; the count is still
      // a physical fact the officer wrote down, and `PendingReturns.vue` already flags it.
      requireTrack: false
    })
    // Bubble the child's own message rather than restating it (§9.3).
    if (built[0]?.valid === false) return built

    // Unwrap the per-line requests back into the two bulk collections. The builder is the
    // one that decided every column and every sign; this only regroups them.
    for (const node of built) {
      if (node.resource === RESOURCE_NAME) records.push(node.record)
      else movements.push({ ...node.record, MovementDate: text(movementDate) || node.record.MovementDate })
    }
  }

  const nodes = [{ resource: RESOURCE_NAME, many: true, records: records, permissions: { create: 'You are not allowed to create this outlet return.' }}]
  nodes.push(...buildOutletMovementNodes(movements))

  return nodes
}

// The warehouse-action draft. The disposition, its stamp pair and the warehouse receipt
// node all stand on the live node from mount, and follow the operator's choice from there.
export function buildReturnWarehouseActionInitNodes ({ record = {}, actorName = '' } = {}) {
  const row = asRow(record)
  const code = text(row.Code)

  if (!code) return [{ valid: false, message: 'Return code is missing.' }]
  if (isCancelled(row)) return [{ valid: false, message: 'A cancelled return cannot be actioned.' }]
  if (!warehouseActionRequired(row)) return [{ valid: false, message: 'This return has no warehouse action to confirm.' }]
  if (warehouseActionCompleted(row)) return [{ valid: false, message: 'The warehouse action is already confirmed.' }]

  const update = {
    WarehouseActionCompleted: 'TRUE',
    WarehouseAction: STOCKED,
    WarehouseActionDisposedReason: '',
    StorageName: DEFAULT_STORAGE,
    ...warehouseStampPair(STOCKED, actorName)
  }
  update.Progress = deriveReturnProgress({ ...row, ...update })

  const on = (spec) => ({ ...spec, resource: RESOURCE_NAME })

  const nodes = [{
    resource: RESOURCE_NAME,
    code: textOrRef(code),
    record: update,
    reload: ['WarehouseStorages'],
    derive: [
      // The stamp records the moment the operator DECIDED, and the other pair is blanked
      // so a switched answer cannot leave the previous one behind.
      { key: 'returnWa:disposition', on: on({ record: 'WarehouseAction' }), immediate: false,
        handler: (action, api) => api.setRecord(null, warehouseStampPair(action, actorName), RESOURCE_NAME) },
      { key: 'returnWa:record', on: on({ record: true }), immediate: false,
        handler: (value, api) => { syncReturnActionProgress(api, row); syncReturnStockMovement(api, row) } }
    ],
    permissions: { warehouseAction: 'You are not allowed to warehouse action this outlet return.' },
    successMsg: 'Warehouse action confirmed.'
  }]

  // The default disposition STOCKS the units, and a derive only fires on a CHANGE — so the
  // receipt stands from mount. Switching to Disposed removes it again.
  if (text(row.WarehouseCode)) {
    nodes.push(...buildStockMovementNodes([stockMovementRow({
      warehouseCode: row.WarehouseCode,
      storageName: DEFAULT_STORAGE,
      sku: row.SKU,
      qty: row.Qty,
      direction: INTO_WAREHOUSE,
      referenceType: STOCK_REFERENCE.RETURN,
      referenceCode: code
    })]))
  }

  return nodes
}

/** Why a warehouse action cannot be confirmed, or '' when it can. */
export function validateReturnWarehouseActionDraft (draft = {}) {
  const entry = asRow(draft)
  if (text(entry.WarehouseAction) === DISPOSED && !text(entry.WarehouseActionDisposedReason)) {
    return 'A disposal reason is required when writing stock off.'
  }
  return ''
}

// The settlement draft. `ConsumptionInvoiceCode` is left blank for the card to fill from
// its invoice match — blank means the credit was settled outside the invoice cycle.
export function buildReturnMarkInvoiceAdjustedInitNodes ({ record = {} } = {}) {
  const row = asRow(record)
  const code = text(row.Code)

  if (!code) return [{ valid: false, message: 'Return code is missing.' }]
  if (isCancelled(row)) return [{ valid: false, message: 'A cancelled return cannot be settled.' }]
  if (!invoiceAdjustmentRequired(row)) return [{ valid: false, message: 'This return needs no invoice adjustment.' }]
  if (isFlagged(row.InvoiceAdjustmentDone)) return [{ valid: false, message: 'The invoice adjustment is already settled.' }]

  const update = { InvoiceAdjustmentDone: 'TRUE', ConsumptionInvoiceCode: '' }
  update.Progress = deriveReturnProgress({ ...row, ...update })

  return [{
    resource: RESOURCE_NAME,
    code: textOrRef(code),
    record: update,
    derive: [{
      key: 'returnSettle:record',
      on: { resource: RESOURCE_NAME, record: true },
      immediate: false,
      handler: (value, api) => syncReturnActionProgress(api, row)
    }],
    permissions: { markInvoiceAdjusted: 'You are not allowed to mark invoice adjusted this outlet return.' }
  }]
}

export function buildReturnInvoiceAdjustmentLinkedNodes ({ returnRows = [], invoiceCode = null, actorName = '' } = {}) {
  const rows = asList(returnRows).map(asRow).filter((row) => text(row.Code))
  if (!rows.length) return [
    
  ]

  // One bulk, not one update per row: a node is addressed by resource, so several
  // single-record nodes for OutletReturns would collapse onto each other.
  const records = rows.map((row) => {
    const update = {
      Code: text(row.Code),
      InvoiceAdjustmentDone: 'TRUE',
      ConsumptionInvoiceCode: textOrRef(invoiceCode)
    }
    // Per row, against that row's own warehouse track — never one verdict for the batch.
    update.Progress = deriveReturnProgress({ ...row, ...update })
    return update
  })

  return [
    { resource: RESOURCE_NAME, many: true, records: records, permissions: { update: 'You are not allowed to update this outlet return.' }, successMsg: `${rows.length} return${rows.length === 1 ? '' : 's'} credited.` }
  ]
}

export function buildReturnInvoiceCreditReversalNodes ({ returnRows = [] } = {}) {
  const rows = asList(returnRows).map(asRow)
    .filter((row) => text(row.Code) && !isCancelled(row))
  if (!rows.length) return [
    
  ]

  return [
    { resource: RESOURCE_NAME, many: true, records: rows.map((row) => {
      const update = { Code: text(row.Code), InvoiceAdjustmentDone: 'FALSE', ConsumptionInvoiceCode: '' }
      update.Progress = deriveReturnProgress({ ...row, ...update })
      return update
    }), permissions: { update: 'You are not allowed to update this outlet return.' }, successMsg: `${rows.length} return credit${rows.length === 1 ? '' : 's'} reversed.` }
  ]
}

// The cancellation draft. The reversal depends only on the STORED row, so it stands from
// mount; the reason is the one thing the operator adds.
export function buildReturnCancelInitNodes ({ record = {} } = {}) {
  const row = asRow(record)
  const code = text(row.Code)

  if (!code) return [{ valid: false, message: 'Return code is missing.' }]
  if (isCancelled(row)) return [{ valid: false, message: 'This return is already cancelled.' }]

  // The reason lives on the record itself: `OutletReturns` has no ProgressCancelled columns,
  // so a stamp here would be silently dropped by GAS.
  const nodes = [{
    resource: RESOURCE_NAME,
    code: textOrRef(code),
    record: { Progress: CANCELLED, ReasonComment: text(row.ReasonComment) },
    reload: ['OutletStorages'],
    permissions: { Cancel: 'You are not allowed to cancel this outlet return.' },
    successMsg: `Return ${code} cancelled.`
  }]

  const reversal = -storedQtyChange(row)
  if (reversal !== 0) {
    nodes.push(buildOutletMovementNode(outletMovementRow({
      outletCode: row.OutletCode,
      storageName: row.StorageName,
      sku: row.SKU,
      qty: reversal,
      direction: shelfDirection(reversal),
      referenceType: OUTLET_REFERENCE.RETURN,
      referenceCode: code,
      movementDate: todayISO()
    })))
  }

  return nodes
}

/** Why a cancellation cannot be committed, or '' when it can. */
export function validateReturnCancelDraft (draft = {}) {
  return text(asRow(draft).ReasonComment) ? '' : 'A cancellation reason is required.'
}

// Composable shape for setup-context callers. Same functions, one import (§5).
export function useReturnPayload () {
  return {
    RETURN_REF_PATH,
    returnRow,
    returnsNode,
    returnQtyChange,
    storedQtyChange,
    buildReturnInitNodes,
    returnDraftDerivations,
    validateReturnDraft,
    applyReturnWarehouseTrack,
    applyReturnSourceInvoice,
    buildReturnCreateNodes,
    buildReturnEditNodes,
    buildReturnBulkCreateNodes,
    buildReturnWarehouseActionInitNodes,
    validateReturnWarehouseActionDraft,
    buildReturnMarkInvoiceAdjustedInitNodes,
    buildReturnInvoiceAdjustmentLinkedNodes,
    buildReturnInvoiceCreditReversalNodes,
    buildReturnCancelInitNodes,
    validateReturnCancelDraft
  }
}
