// OutletConsumptions payloads. Layer 2. A consumption writes across several resources at
// once, so the signs, the states and the order live here, not in the UI.
import { batchRef } from 'src/utils/appHelpers'
import { resourceRow } from 'src/composables/resources/useResourceConfig'
import {
  toNumber,
  soldRowsOf,
  returnRowsOf,
  creditsInvoice,
  priceOf,
  DEFAULT_STORAGE
} from './useConsumptionStock'
/**
 * The OutletReturns domain owns every return row this consumption writes (§9.1).
 *
 * A consumption DISCOVERS returns — a surplus line counted at the outlet — but it does not
 * get to decide what a return record looks like, which way its ledger movement points, or
 * when it counts as reconciled. Those are OutletReturns' rules, and they are now read from
 * the one place that states them, so a return raised here is identical to one logged from
 * the standalone Returns page.
 */
import {
  buildReturnBulkCreateNodes,
  buildReturnInvoiceAdjustmentLinkedNodes
} from 'src/_resource/Operation/OutletReturns/composables/useReturnPayload'
import { calculateConsumptionInvoice } from './useConsumptionInvoice'
import { buildInvoiceDocumentNodes } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoicePayload'
import { PENDING_INVOICE_GENERATION, INVOICE_GENERATED } from './useConsumptionProgress'

import { stampFields } from 'src/utils/workflowStamp'
import {
  OFF_THE_SHELF,
  ONTO_THE_SHELF,
  OUTLET_REFERENCE,
  OUTLET_ROLE,
  outletMovementsNode
} from 'src/_resource/Operation/OutletMovements/composables/useOutletMovementPayload'
const CONSUMPTIONS = 'OutletConsumptions'
const CONSUMPTION_ITEMS = 'OutletConsumptionItems'
const INVOICES = 'OutletConsumptionInvoices'
const INVOICE_ITEMS = 'OutletConsumptionInvoiceItems'
const OUTLET_MOVEMENTS = 'OutletMovements'

/** The ledger reference type each leg of the journey writes. Kept tellable apart so a
 *  reconciliation can say WHY a balance moved, not just that it did.
 *
 *  The RETURN leg's reference type is no longer stated here — it belongs to the
 *  OutletReturns domain, which writes it. */

/** The batch path every request in one submit chains its parent code off. */
export const CONSUMPTION_REF_PATH = `${CONSUMPTIONS}.latest.code`

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const asList = (value) => (Array.isArray(value) ? value : [])
const todayISO = () => new Date().toISOString().slice(0, 10)
const dateOf = (form) => text(asRow(form).Date) || todayISO()


// ─── 1. The consumption itself ────────────────────────────────────────────────

/**
 * The consumption header plus its sold lines, as one composite save.
 *
 * Lands in `INVOICE_GENERATED` when this batch also creates its invoice. Otherwise it
 * lands in `PENDING_INVOICE_GENERATION` for the standalone invoice workflow.
 *
 * ONLY CALLED WHEN SOMETHING WAS ACTUALLY CONSUMED. An `OutletConsumptions` row asserts a
 * billable consumption event, and one written with no lines can never be invoiced or
 * settled — it sits in `PENDING_INVOICE_GENERATION` forever, polluting the invoiceable
 * queue with a bill that has nothing to put on it. A visit that only returned stock or only
 * raised a restock writes those records directly and no header at all; the caller
 * (`Add/PageAction.js`) is what decides, because it is what knows the whole submission.
 */
import { useAuth } from 'src/composables/core/useAuth'
import { useConsumptionIndex } from './useConsumptionIndex'

// ROW builder: one OutletConsumptionItems sheet row.
export function consumptionItemRow (child, extra) {
  return resourceRow(CONSUMPTION_ITEMS, child, extra)
}

/** Today's PLANNED visit for this outlet, which a walk-in audit belongs to. */
function plannedVisitCodeFor (outletCode) {
  const code = text(outletCode)
  if (!code) return ''
  const { auditByOutlet } = useConsumptionIndex()
  return text(auditByOutlet.value.get(code)?.plannedToday?.Code)
}

// NODE builder: a consumption and its lines, with every column the domain can answer
// already resolved. `OutletConsumptions` stores no aggregate, so there is nothing to derive.
export function consumptionNode (parent = {}, children = [], extra = {}) {
  const { user } = useAuth()
  const seed = { ...asRow(parent), ...asRow(extra) }
  const outletCode = text(seed.OutletCode)

  const record = resourceRow(CONSUMPTIONS, {
    Username: user.value?.name || '',
    Date: todayISO(),
    Progress: PENDING_INVOICE_GENERATION,
    Status: 'Active'
  }, parent, extra, {
    OutletVisitCode: text(seed.OutletVisitCode) || plannedVisitCodeFor(outletCode)
  })

  return {
    resource: CONSUMPTIONS,
    record,
    // A bucket, not a bare list: that is the shape pageState stores children in.
    children: [{ resource: CONSUMPTION_ITEMS, records: (children || []).map((child) => consumptionItemRow(child)) }],
    permissions: { create: 'You are not allowed to record a consumption.' }
  }
}
export function buildConsumptionCompositeNode (form = {}, countRows = [], actorName = '', options = {}) {
  const entry = asRow(form)
  const sold = soldRowsOf(countRows)
  const generated = options.generateInvoice === true
  const progress = generated ? INVOICE_GENERATED : PENDING_INVOICE_GENERATION
  const stamp = generated ? 'ProgressInvoiceGenerated' : 'ProgressPendingInvoiceGeneration'
  const note = generated
    ? 'Consumption recorded; invoice generated in the same submission.'
    : 'Consumption recorded; invoice generation pending.'

  return {
    resource: CONSUMPTIONS,
    record: {
      OutletCode: text(entry.OutletCode),
      Date: dateOf(entry),
      Username: text(entry.Username),
      OutletVisitCode: text(entry.OutletVisitCode),
      Progress: progress,
      ...stampFields(stamp, actorName, note),
      Status: 'Active'
    },
    children: [{
      resource: CONSUMPTION_ITEMS,
      records: sold.map((row) => ({
        _action: 'create',
        data: { SKU: text(row.SKU), Qty: toNumber(row.SoldQty), Status: 'Active' }
      }))
    }],
    reload: [CONSUMPTIONS, CONSUMPTION_ITEMS]
  }
}

// ─── 2. The outlet ledger ─────────────────────────────────────────────────────

/**
 * One NEGATIVE outlet movement per sold line.
 *
 * `-Math.abs(…)` rather than a bare negation: a row carrying an accidentally negative
 * quantity must not silently flip the direction of the movement and CREDIT the outlet for
 * a sale. The magnitude is always absolute; the sign is the contract.
 *
 * `OutletStorages` is named as a cursor resource so the recalculated balances come back in
 * the same round trip — GAS's `applyBatchOutletMovementsToOutletStorages` hook rewrites
 * them as this request lands, and the next page would otherwise read a stale shelf.
 *
 * Returns `null` when nothing sold. A restock-only audit consumed no stock, so it has no
 * ledger movement to write — and a bulk request carrying an empty `records` array is not
 * "no movement", it is a round trip that asks GAS to recalculate every outlet storage
 * balance on the strength of nothing. The caller pushes the result only when it is truthy,
 * the same contract `buildVisitCompleteNode` and `buildNextVisitNode` already use.
 */
export function buildConsumptionMovementsNode (form = {}, countRows = [], consumptionRef = null) {
  const entry = asRow(form)
  const sold = soldRowsOf(countRows)
  if (!sold.length) return null

  return outletMovementsNode(sold.map((row) => ({
    StorageName: row.StorageName,
    SKU: row.SKU,
    Quantity: row.SoldQty
  })), {
    outletCode: entry.OutletCode,
    // The sale leg. A restock delivery on the same audit writes the same resource, so
    // without a role apiece the two would collide on one node address.
    role: OUTLET_ROLE.SALE,
    direction: OFF_THE_SHELF,
    referenceType: OUTLET_REFERENCE.CONSUMPTION,
    referenceCode: consumptionRef || batchRef(CONSUMPTION_REF_PATH),
    movementDate: dateOf(entry)
  })
}

// ─── 2b. Reversing the outlet ledger on cancellation ──────────────────────────

/** The ledger reference type a cancellation writes, so a reconciliation can tell a
 *  restoration apart from an original sale on the same consumption code. */

/**
 * WHAT GOES BACK ON THE SHELF when a consumption is cancelled — one line per SKU and
 * storage, positive, matching what the original audit took off.
 *
 * The truth is read from the LEDGER first. The original movements know the storage each
 * unit came off and the exact quantity that was posted, so reversing them restores the
 * same shelf the sale emptied. When the ledger rows are not loaded, the stored
 * `OutletConsumptionItems` lines are the fallback; they carry no storage, so they land on
 * the outlet's default storage — the same place `buildConsumptionMovementsNode` puts a
 * line whose count row named no storage.
 *
 * PURE and shared: the cancellation review screen renders exactly this list, and the
 * builder below writes exactly this list. One derivation, so the preview cannot promise a
 * restoration the batch does not perform.
 *
 * @param {Object} consumption  the consumption row being cancelled
 * @param {Object} sources
 * @param {Array}  [sources.items]      `OutletConsumptionItems` rows (any outlet's — filtered here)
 * @param {Array}  [sources.movements]  `OutletMovements` rows (any outlet's — filtered here)
 * @returns {Array<{ sku, storageName, qty }>}
 */
export function restorableConsumptionLines (consumption = {}, sources = {}) {
  const record = asRow(consumption)
  const code = text(record.Code)
  if (!code) return []

  const buckets = new Map()
  const add = (sku, storageName, qty) => {
    const amount = Math.abs(toNumber(qty))
    if (!sku || amount <= 0) return
    const key = `${sku}\u0000${storageName}`
    // Sum into the index, never assign — one SKU can be counted from several storages,
    // and several ledger rows can carry the same pair (CORE_ARCHITECTURE_RULES §6).
    buckets.set(key, (buckets.get(key) || 0) + amount)
  }

  const ledger = asList(sources.movements)
    .map(asRow)
    .filter((row) => text(row.ReferenceType) === OUTLET_REFERENCE.CONSUMPTION &&
      text(row.ReferenceCode) === code &&
      toNumber(row.QtyChange) < 0)

  if (ledger.length) {
    ledger.forEach((row) => add(text(row.SKU), text(row.StorageName) || DEFAULT_STORAGE, row.QtyChange))
  } else {
    asList(sources.items)
      .map(asRow)
      .filter((row) => text(row.OutletConsumptionCode) === code && text(row.Status || 'Active') === 'Active')
      .forEach((row) => add(text(row.SKU), text(row.StorageName) || DEFAULT_STORAGE, row.Qty))
  }

  return [...buckets.entries()].map(([key, qty]) => {
    const [sku, storageName] = key.split('\u0000')
    return { sku, storageName, qty }
  })
}

/**
 * One POSITIVE outlet movement per restorable line — the compensating entry that puts a
 * cancelled consumption's units back on the outlet's shelf.
 *
 * `Math.abs(…)` rather than a bare negation of the original: a ledger row that is already
 * positive (a correction posted by hand) must not flip this restoration into a second
 * deduction. The magnitude is absolute; the sign is the contract, the mirror image of
 * `buildConsumptionMovementsNode`.
 *
 * `OutletStorages` is named as a cursor resource so the recalculated shelf balances come
 * back in the same round trip. Returns `null` when nothing is restorable, so the caller
 * pushes it only when it is truthy.
 */
export function buildConsumptionReversalMovementsNode (consumption = {}, sources = {}) {
  const record = asRow(consumption)
  const lines = restorableConsumptionLines(record, sources)
  if (!lines.length) return null

  return outletMovementsNode(lines.map((line) => ({
    StorageName: line.storageName,
    SKU: line.sku,
    Quantity: line.qty
  })), {
    outletCode: record.OutletCode,
    direction: ONTO_THE_SHELF,
    referenceType: OUTLET_REFERENCE.CONSUMPTION_CANCELLED,
    referenceCode: record.Code
  })
}

// ─── 3. Returns ───────────────────────────────────────────────────────────────

/**
 * The `OutletReturns` rows a count's surplus lines produce, plus their ledger movements.
 *
 * DELEGATED to the OutletReturns domain (§9.1). What is decided HERE is consumption-side:
 * which counted rows are surplus, what each is worth against the price list, and which
 * return meta the officer attached to the SKU. What a return ROW looks like, which way its
 * ledger movement points, and when it counts as reconciled are decided THERE, by
 * `buildReturnBulkCreateNodes`.
 *
 * One behaviour changes with this delegation, and it is a fix rather than a side effect.
 * The old local rule keyed COMPLETED off the warehouse track alone, so a return raised
 * with `InvoiceAdjustmentRequired = TRUE` and no warehouse leg was stamped COMPLETED at
 * creation — before the outlet had been credited anything, and with no queue that could
 * ever surface it. The shared rule (`isReturnCompleted`) requires EVERY flagged track to
 * be done, so such a return now correctly stays open until an invoice credits it.
 *
 * Returns are created BEFORE the consumption in the submit order, because the invoice
 * needs their codes to record what it credited — see `buildConsumptionSubmitRequests`.
 */
export function buildReturnsNodes (form = {}, countRows = [], metaOf = () => ({}), options = {}) {
  const entry = asRow(form)
  const rows = returnRowsOf(countRows)
  if (!rows.length) return []

  const priceListCode = text(options.priceListCode)
  const movementDate = dateOf(entry)

  // One line per surplus row, in the shape the OutletReturns domain takes. This builder
  // decides WHICH rows are returns and WHAT they are worth — both consumption-side
  // questions. It does not decide what a return row looks like or which way its ledger
  // movement points; those are OutletReturns' own rules.
  const lines = rows.map((row) => {
    const meta = asRow(metaOf(row.SKU))
    return {
      form: {
        OutletCode: text(entry.OutletCode),
        Date: movementDate,
        Username: text(entry.Username),
        SKU: text(row.SKU),
        Qty: Math.abs(toNumber(row.ReturnQty)),
        StorageName: text(row.StorageName) || DEFAULT_STORAGE,
        Reason: text(meta.Reason) || 'DAMAGE',
        ReasonComment: text(meta.ReasonComment),
        SourceInvoiceCode: text(meta.SourceInvoiceCode),
        InvoiceAdjustmentRequired: creditsInvoice(meta),
        WarehouseActionRequired: meta.WarehouseActionRequired === true,
        WarehouseCode: meta.WarehouseActionRequired === true ? text(meta.WarehouseCode) : ''
      },
      // The price the officer settled on wins - it may have come off the source invoice
      // rather than the price list. A missing price is stored as 0 rather than blocking:
      // the return is a physical fact even when it carries no credit. `validateConsumption`
      // is what refuses to INVOICE an unpriced line.
      resolvedPrice: meta.Price === null || meta.Price === undefined || meta.Price === ''
        ? (priceOf(row.SKU, priceListCode) ?? 0)
        : toNumber(meta.Price)
    }
  })

  const built = buildReturnBulkCreateNodes({
    lines,
    actorName: text(entry.Username),
    movementDate
  })

  // Raised rather than returned: every caller here splices these into a larger list it is
  // already assembling, and a bad return line means the whole consumption submit is
  // malformed and must not be dispatched half-built.
  if (built[0]?.valid === false) throw new Error(built[0].message || 'Return lines could not be built.')
  return built
}

/**
 * Mark previously-submitted returns as adjusted against the invoice this batch creates.
 *
 * Used by the wizard's pending-returns step, where the user selects returns raised on an
 * EARLIER visit that were never credited. Their `Progress` follows the same matrix a fresh
 * return does: still owed to a warehouse, or done.
 */
export function buildReturnAdjustmentNodes (returnRows = [], invoiceRef = null) {
  const built = buildReturnInvoiceAdjustmentLinkedNodes({
    returnRows,
    invoiceCode: invoiceRef || batchRef(`${INVOICES}.latest.code`)
  })
  return built
}

// The invoice for this audit's sales.
//
// The bill's SCHEMA is not this module's - `buildInvoiceDocumentNodes` owns every column,
// so an invoice raised here is identical to one raised from the Invoices module. What is
// decided HERE is consumption-side: which lines sold, and what they are worth.
export function buildInvoiceNodes (form = {}, soldLines = [], options = {}) {
  const entry = asRow(form)
  const priceListCode = text(options.priceListCode)

  // EVERY figure comes from this one call - the same call the wizard's review step makes.
  const invoice = calculateConsumptionInvoice({
    lines: soldLines,
    priceListCode,
    discountType: options.discountType,
    discountValue: options.discountValue,
    returnDeduction: options.returnDeduction,
    calculateLineTax: options.calculateLineTax,
    // A RESOLVER, not pre-priced lines, so an override the officer typed flows through tax
    // and discount apportionment inside the one engine.
    ...(typeof options.resolvePrice === 'function' ? { resolvePrice: options.resolvePrice } : {})
  })

  if (!invoice.lines.length) return [
    
  ]

  const built = buildInvoiceDocumentNodes({
    invoice,
    outletCode: text(entry.OutletCode),
    username: text(entry.Username),
    priceListCode,
    invoiceDate: dateOf(entry),
    dueDate: options.dueDate,
    // The consumption does not exist yet; GAS resolves this to its generated code.
    consumptionRef: batchRef(CONSUMPTION_REF_PATH),
    markConsumptions: [],
    returnCodes: options.returnCodes,
    // The workflow links the selected returns itself, from its own selection.
    linkReturnRows: null,
    actorName: text(options.actorName),
    comment: text(options.invoiceComment) || 'Invoice generated during consumption submission.'
  })

  return { ...built, invoice }
}

// Composable shape for setup-context callers. Same functions, one import (§5).
export function useConsumptionPayload () {
  return {
    CONSUMPTION_REF_PATH,
    restorableConsumptionLines,
    buildConsumptionReversalMovementsNode,
    stampFields,
    consumptionNode,
    consumptionItemRow,
    buildConsumptionCompositeNode,
    buildConsumptionMovementsNode,
    buildReturnsNodes,
    buildReturnAdjustmentNodes,
    buildInvoiceNodes
  }
}

// The invoice arithmetic lives in its own Layer 2 file but is re-exported here, so a caller
// assembling a submit still has ONE import for the builders AND the engine behind them.
export { calculateConsumptionInvoice, groupTaxDetails, invoiceItemOf } from './useConsumptionInvoice'

export { stampFields }
