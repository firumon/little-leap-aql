// OutletConsumptions payloads. Layer 2. A consumption writes across several resources at
// once, so the signs, the states and the order live here, not in the UI.
import { batchRef } from 'src/utils/appHelpers'
import { useAuth } from 'src/composables/core/useAuth'
import { useConsumptionIndex } from './useConsumptionIndex'
import { resourceRow } from 'src/composables/resources/useResourceConfig'
import {
  toNumber,
  soldRowsOf,
  returnRowsOf,
  creditsInvoice,
  priceOf,
  DEFAULT_STORAGE
} from './useConsumptionStock'
// OutletReturns owns every return row this consumption writes (§9.1): a consumption finds
// a surplus, but the return's shape and its ledger direction are that domain's rules.
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

/** The batch path every request in one submit chains its parent code off. */
export const CONSUMPTION_REF_PATH = `${CONSUMPTIONS}.latest.code`

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const asList = (value) => (Array.isArray(value) ? value : [])
const todayISO = () => new Date().toISOString().slice(0, 10)
const dateOf = (form) => text(asRow(form).Date) || todayISO()


// ─── 1. The consumption itself ────────────────────────────────────────────────

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

// THE consumption node — header plus sold lines — for the blank draft and the submitted
// composite alike. `options.generateInvoice` left `null` means the live draft (sheet
// defaults, no stamp); a boolean means the submission, stamped and reloading what it wrote.
// Only built when something was consumed: a header with no lines can never be invoiced.
export function consumptionCompositeNode (form = {}, lines = [], options = {}) {
  const { user } = useAuth()
  const { actorName = '', extra = {}, generateInvoice = null } = options
  const seed = { ...asRow(form), ...asRow(extra) }
  const submitting = generateInvoice !== null
  const invoiced = generateInvoice === true

  const stamp = submitting
    ? {
        Progress: invoiced ? INVOICE_GENERATED : PENDING_INVOICE_GENERATION,
        ...stampFields(
          invoiced ? 'ProgressInvoiceGenerated' : 'ProgressPendingInvoiceGeneration',
          actorName,
          invoiced
            ? 'Consumption recorded; invoice generated in the same submission.'
            : 'Consumption recorded; invoice generation pending.')
      }
    : {}

  const record = resourceRow(CONSUMPTIONS, {
    Username: user.value?.name || '',
    Date: todayISO(),
    Progress: PENDING_INVOICE_GENERATION,
    Status: 'Active'
  }, form, extra, {
    OutletVisitCode: text(seed.OutletVisitCode) || plannedVisitCodeFor(text(seed.OutletCode)),
    ...stamp
  })

  return {
    resource: CONSUMPTIONS,
    record,
    // A bucket, not a bare list: that is the shape pageState stores children in.
    children: [{ resource: CONSUMPTION_ITEMS, records: asList(lines).map((child) => consumptionItemRow(child)) }],
    permissions: { create: 'You are not allowed to record a consumption.' },
    ...(submitting ? { reload: [CONSUMPTIONS, CONSUMPTION_ITEMS] } : {})
  }
}

// ─── 2. The outlet ledger ─────────────────────────────────────────────────────

// One NEGATIVE outlet movement per sold line. `-Math.abs(…)`, so a stray negative quantity
// cannot flip the direction and credit the outlet for a sale. `null` when nothing sold.
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

// What goes back on the shelf when a consumption is cancelled. The LEDGER is the truth;
// the stored item lines are the fallback and land on the outlet's default storage.
// The cancellation review screen renders exactly this list, so it cannot promise more
// than the batch restores.
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

// The compensating positive movement. `Math.abs(…)`, so an already-positive ledger row
// cannot turn this restoration into a second deduction. `null` when nothing is restorable.
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
    // The SAME reference type the sale wrote, exactly as a cancelled return reuses its
    // own. The sheet allows four values and `ConsumptionCancelled` was never one of them,
    // so the row was rejected on write. The positive sign is what tells a restoration
    // apart from the original sale on the same code.
    referenceType: OUTLET_REFERENCE.CONSUMPTION,
    referenceCode: record.Code
  })
}

// ─── 3. Returns ───────────────────────────────────────────────────────────────

// The `OutletReturns` rows a surplus produces, plus their ledger movements. Decided HERE:
// which rows are surplus and what each is worth. Decided THERE: what a return row is.
// Built before the consumption, because the invoice needs their codes.
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

  // The veto travels as a node, never as an exception — a builder that cannot build
  // returns `[{ valid: false, message }]` and the caller stops the whole chain.
  return built
}

// Mark returns raised on an EARLIER visit as adjusted against the invoice this batch makes.
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

  if (!invoice.lines.length) return []

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

  // An ARRAY of nodes, never an object. The chain spreads this straight into its batch,
  // and `{ ...built, invoice }` made that spread throw — killing the whole rebuild.
  return built
}

// Composable shape for setup-context callers. Same functions, one import (§5).
export function useConsumptionPayload () {
  return {
    CONSUMPTION_REF_PATH,
    restorableConsumptionLines,
    buildConsumptionReversalMovementsNode,
    stampFields,
    consumptionCompositeNode,
    consumptionItemRow,
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
