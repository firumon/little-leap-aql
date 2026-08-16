/**
 * OutletConsumptions — the batch payloads a consumption submit writes. Layer 2.
 *
 * A consumption is not one record; it is an atomic transaction across up to six resources.
 * The sign conventions, the state each side-effect lands in, and the order the requests
 * must run in ARE the business rule, so they live here rather than in the sticky bar that
 * dispatches them (UI_RESOURCE_DOMAIN_LOGIC.md §3).
 *
 * This file owns the CORE writes — the consumption itself, the outlet ledger, returns, and
 * the (possibly bundled) invoice. The optional workflow side-effects — completing a visit,
 * scheduling the next one, raising a restock, cascading a cancellation — live in
 * `useConsumptionWorkflow.js` beside it and are re-exported at the bottom, so a caller
 * still has exactly one import.
 *
 * PURE functions throughout: no refs, no injects, no stores, nothing rendered. They take
 * plain rows and return canonical request envelopes, so a `PageAction.js` running outside
 * any setup context can call them (§5). `resourceRequests` is imported rather than
 * `usePageState` specifically so this module's graph stays store-free (§2.1).
 */

import { batchRef, batchRefList, textOrRef } from 'src/utils/appHelpers'
import { toDateTime24 } from 'src/utils/dateHelpers'
import {
  compositeSaveRequest,
  resourceBulkRequest,
  resourceCreateRequest,
  resourceUpdateRequest,
  executeActionRequest
} from 'src/composables/resources/resourceRequests'
import {
  toNumber,
  soldRowsOf,
  returnRowsOf,
  returnQtyChange,
  returnProgressFor,
  creditsInvoice,
  priceOf,
  DEFAULT_STORAGE
} from './useConsumptionStock'
import { calculateConsumptionInvoice, invoiceItemOf } from './useConsumptionInvoice'
import { PENDING_INVOICE_GENERATION, INVOICE_GENERATED } from './useConsumptionProgress'

const CONSUMPTIONS = 'OutletConsumptions'
const CONSUMPTION_ITEMS = 'OutletConsumptionItems'
const INVOICES = 'OutletConsumptionInvoices'
const INVOICE_ITEMS = 'OutletConsumptionInvoiceItems'
const OUTLET_MOVEMENTS = 'OutletMovements'
const RETURNS = 'OutletReturns'

/** The ledger reference type each leg of the journey writes. Kept tellable apart so a
 *  reconciliation can say WHY a balance moved, not just that it did. */
const REF_CONSUMPTION = 'Consumption'
const REF_RETURN = 'OutletReturn'

/** The batch path every request in one submit chains its parent code off. */
export const CONSUMPTION_REF_PATH = `${CONSUMPTIONS}.latest.code`

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const todayISO = () => new Date().toISOString().slice(0, 10)
const dateOf = (form) => text(asRow(form).Date) || todayISO()

/**
 * One workflow stamp — the At/By/Comment triple for a `Progress<State>` prefix.
 *
 * The SINGLE writer of a stamp in this module, so no outcome can record two of the three
 * columns and leave the third blank. A stamp with no `By` reads as a stage that never
 * happened and is dropped from the View timeline.
 *
 * `toDateTime24` rather than an ISO string, because GAS stamps these same columns with
 * `formatDateTime24()` whenever an `executeAction` writes one — two formats in one column
 * would sort and read inconsistently depending on which path wrote the row.
 *
 * Written under the hood, never exposed as form fields, so a submission cannot be
 * back-dated or attributed to someone else (UI_MODULE_DEVELOPER_GUIDE.md §13.5).
 */
export function stampFields (prefix, actorName = '', comment = '') {
  return {
    [`${prefix}At`]: toDateTime24(new Date()),
    [`${prefix}By`]: text(actorName),
    [`${prefix}Comment`]: text(comment)
  }
}

// ─── 1. The consumption itself ────────────────────────────────────────────────

/**
 * The consumption header plus its sold lines, as one composite save.
 *
 * ALWAYS lands in `PENDING_INVOICE_GENERATION`, even when an invoice is generated in the
 * same batch. The walk to `INVOICE_GENERATED` is a separate `executeAction` appended after
 * the invoice exists (`buildInvoiceRequests`), so the state column can never claim an
 * invoice that a later request in the batch failed to write.
 *
 * ONLY CALLED WHEN SOMETHING WAS ACTUALLY CONSUMED. An `OutletConsumptions` row asserts a
 * billable consumption event, and one written with no lines can never be invoiced or
 * settled — it sits in `PENDING_INVOICE_GENERATION` forever, polluting the invoiceable
 * queue with a bill that has nothing to put on it. A visit that only returned stock or only
 * raised a restock writes those records directly and no header at all; the caller
 * (`Add/PageAction.js`) is what decides, because it is what knows the whole submission.
 */
export function buildConsumptionCompositeRequest (form = {}, countRows = [], actorName = '', options = {}) {
  const entry = asRow(form)
  const sold = soldRowsOf(countRows)
  const note = options.generateInvoice
    ? 'Consumption recorded; invoice generated in the same submission.'
    : 'Consumption recorded; invoice generation pending.'

  return compositeSaveRequest({
    resource: CONSUMPTIONS,
    data: {
      OutletCode: text(entry.OutletCode),
      Date: dateOf(entry),
      Username: text(entry.Username),
      OutletVisitCode: text(entry.OutletVisitCode),
      Progress: PENDING_INVOICE_GENERATION,
      ...stampFields('ProgressPendingInvoiceGeneration', actorName, note),
      Status: 'Active'
    },
    children: [{
      resource: CONSUMPTION_ITEMS,
      records: sold.map((row) => ({
        _action: 'create',
        data: { SKU: text(row.SKU), Qty: toNumber(row.SoldQty), Status: 'Active' }
      }))
    }]
  })
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
 * the same contract `buildVisitCompleteRequest` and `buildNextVisitRequest` already use.
 */
export function buildConsumptionMovementsRequest (form = {}, countRows = [], consumptionRef = null) {
  const entry = asRow(form)
  const sold = soldRowsOf(countRows)
  if (!sold.length) return null

  const records = sold.map((row) => ({
    OutletCode: text(entry.OutletCode),
    StorageName: text(row.StorageName) || DEFAULT_STORAGE,
    SKU: text(row.SKU),
    QtyChange: -Math.abs(toNumber(row.SoldQty)),
    ReferenceType: REF_CONSUMPTION,
    ReferenceCode: textOrRef(consumptionRef || batchRef(CONSUMPTION_REF_PATH)),
    MovementDate: dateOf(entry),
    Status: 'Active'
  }))
  return resourceBulkRequest(OUTLET_MOVEMENTS, records, ['OutletStorages'])
}

// ─── 3. Returns ───────────────────────────────────────────────────────────────

/**
 * The `OutletReturns` rows a count's surplus lines produce, plus their ledger movements.
 *
 * The movement quantity comes from `returnQtyChange`, the one place the IAR/WAR truth
 * table is written down — so a return credited-and-kept adds stock back, a return shipped
 * out removes it, and the two cases where the flags cancel write no ledger row at all.
 * Zero movements are FILTERED rather than written: an empty ledger row is noise that makes
 * a reconciliation look like it moved something.
 *
 * Returns are created BEFORE the consumption in the submit order, because the invoice
 * needs their codes to record what it credited — see `buildConsumptionSubmitRequests`.
 */
export function buildReturnsRequests (form = {}, countRows = [], metaOf = () => ({}), options = {}) {
  const entry = asRow(form)
  const rows = returnRowsOf(countRows)
  if (!rows.length) return []

  const priceListCode = text(options.priceListCode)
  const movementDate = dateOf(entry)

  const returns = rows.map((row) => {
    const meta = asRow(metaOf(row.SKU))
    return {
      OutletCode: text(entry.OutletCode),
      Date: movementDate,
      Username: text(entry.Username),
      SKU: text(row.SKU),
      Qty: Math.abs(toNumber(row.ReturnQty)),
      // A missing price is stored as 0 here rather than blocking: the return itself is a
      // physical fact that must be recorded even when it carries no monetary credit.
      // `validateConsumption` is what refuses to INVOICE an unpriced line.
      Price: priceOf(row.SKU, priceListCode) ?? 0,
      Reason: text(meta.Reason) || 'DAMAGE',
      ReasonComment: text(meta.ReasonComment),
      InvoiceAdjustmentRequired: creditsInvoice(meta) ? 'TRUE' : 'FALSE',
      InvoiceAdjustmentDone: 'FALSE',
      WarehouseActionRequired: meta.WarehouseActionRequired === true ? 'TRUE' : 'FALSE',
      WarehouseActionCompleted: 'FALSE',
      WarehouseCode: meta.WarehouseActionRequired === true ? text(meta.WarehouseCode) : '',
      Progress: returnProgressFor(meta),
      Status: 'Active'
    }
  })

  const movements = rows
    .map((row) => ({ row, change: returnQtyChange(row.ReturnQty, metaOf(row.SKU)) }))
    .filter((pair) => pair.change !== 0)
    .map((pair) => ({
      OutletCode: text(entry.OutletCode),
      StorageName: text(pair.row.StorageName) || DEFAULT_STORAGE,
      SKU: text(pair.row.SKU),
      QtyChange: pair.change,
      ReferenceType: REF_RETURN,
      ReferenceCode: textOrRef(batchRef(`${RETURNS}.latest.code`)),
      MovementDate: movementDate,
      Status: 'Active'
    }))

  const requests = [resourceBulkRequest(RETURNS, returns, [RETURNS])]
  if (movements.length) requests.push(resourceBulkRequest(OUTLET_MOVEMENTS, movements, ['OutletStorages']))
  return requests
}

/**
 * Mark previously-submitted returns as adjusted against the invoice this batch creates.
 *
 * Used by the wizard's pending-returns step, where the user selects returns raised on an
 * EARLIER visit that were never credited. Their `Progress` follows the same matrix a fresh
 * return does: still owed to a warehouse, or done.
 */
export function buildReturnAdjustmentRequests (returnRows = [], invoiceRef = null) {
  return (Array.isArray(returnRows) ? returnRows : []).map(asRow).filter((row) => text(row.Code)).map((row) => {
    const awaitingWarehouse = text(row.WarehouseActionRequired) === 'TRUE' && text(row.WarehouseActionCompleted) !== 'TRUE'
    return resourceUpdateRequest(RETURNS, text(row.Code), {
      InvoiceAdjustmentDone: 'TRUE',
      ConsumptionInvoiceCode: textOrRef(invoiceRef || batchRef(`${INVOICES}.latest.code`)),
      Progress: awaitingWarehouse ? 'AWAITING_WAREHOUSE_RECEIPT' : 'COMPLETED'
    }, [RETURNS])
  })
}

// ─── 4. The invoice ───────────────────────────────────────────────────────────

/**
 * The invoice header, its line items, and the state walk for EVERY consumption it covers.
 *
 * BUNDLING is the reason this is one builder rather than three. When the user bundles
 * earlier uninvoiced consumptions, one invoice covers several consumption codes, and:
 *
 *   - `OutletConsumptionCode` holds the comma-separated list. It is built with
 *     `batchRefList`, so the code of the consumption THIS batch is creating stays an
 *     unresolved `$ref` and GAS performs the join — the front-end never concatenates a
 *     reference to a record that does not exist yet (CORE_ARCHITECTURE_RULES §3).
 *   - every bundled consumption gets its own `MarkInvoiceGenerated` action, so none is
 *     left claiming to be uninvoiced. The new one is walked by `$ref`; the earlier ones by
 *     their known codes.
 *   - the line items are the UNION of all bundled consumptions' sold lines, which the
 *     caller supplies already merged — this builder prices what it is given and does not
 *     decide what belongs on the bill.
 */
export function buildInvoiceRequests (form = {}, soldLines = [], options = {}) {
  const entry = asRow(form)
  const priceListCode = text(options.priceListCode)
  const bundledCodes = (Array.isArray(options.bundledConsumptionCodes) ? options.bundledConsumptionCodes : []).map(text).filter(Boolean)
  const actorName = text(options.actorName)

  // EVERY figure below comes from this one call — the same call the wizard's review step
  // makes to display them. This builder decides what belongs on the bill and where it is
  // written; it does not do arithmetic (see `useConsumptionInvoice.js`).
  const invoice = calculateConsumptionInvoice({
    lines: soldLines,
    priceListCode,
    discountType: options.discountType,
    discountValue: options.discountValue,
    returnDeduction: options.returnDeduction,
    calculateLineTax: options.calculateLineTax
  })

  if (!invoice.lines.length) return { requests: [], invoice }

  const invoiceDate = dateOf(entry)

  // The net payable is CALCULATED but not STORED: `OutletConsumptionInvoices` has no `Total`
  // column (`setupOperationSheets.gs`), and every reader — the View card, the payments page,
  // the printed invoice — derives it from the six stored figures. Writing a seventh column
  // the sheet does not declare would put a figure in the payload that nothing reads back.
  // It stays on `invoice.header.Total` for the UI, which is the point of one engine.
  const { Total, ...storedTotals } = invoice.header

  const header = {
    // The one column that is a LIST rather than a code. See the note above.
    OutletConsumptionCode: batchRefList(CONSUMPTION_REF_PATH, bundledCodes),
    Date: invoiceDate,
    DueDate: text(options.dueDate) || invoiceDate,
    OutletCode: text(entry.OutletCode),
    Username: text(entry.Username),
    PriceListCode: priceListCode,
    // `Subtotal`, `Discount`, `TotalTaxableAmount`, `TotalTaxAmount`, `TaxDetails` (grouped
    // by tax code, never SKU-wise) and `ReturnDeductionTotal` — spread whole, so a column
    // can never be assembled here from a figure the engine did not produce.
    ...storedTotals,
    OutletReturnCodes: (Array.isArray(options.returnCodes) ? options.returnCodes : []).map(text).filter(Boolean).join(','),
    Progress: 'PENDING_PAYMENT',
    ...stampFields('ProgressPendingPayment', actorName, text(options.invoiceComment)),
    Status: 'Active'
  }

  const items = invoice.lines.map((line) => ({
    OutletConsumptionInvoiceCode: textOrRef(batchRef(`${INVOICES}.latest.code`)),
    ...invoiceItemOf(line),
    Status: 'Active'
  }))

  const markGenerated = (code) => executeActionRequest(CONSUMPTIONS, code, {
    action: 'MarkInvoiceGenerated', column: 'Progress', columnValue: INVOICE_GENERATED
  }, stampFields('ProgressInvoiceGenerated', actorName, 'Invoice generated during consumption submission.'), [CONSUMPTIONS])

  return {
    requests: [
      resourceCreateRequest(INVOICES, header, [INVOICES]),
      resourceBulkRequest(INVOICE_ITEMS, items, [INVOICE_ITEMS]),
      markGenerated(batchRef(CONSUMPTION_REF_PATH)),
      ...bundledCodes.map(markGenerated)
    ],
    // The whole calculation bundle, not a private summary shape — a caller that wants to
    // confirm what it just submitted reads the same object the review step displayed.
    invoice
  }
}

// Re-exported so a caller assembling a submit has ONE import for every builder it needs.
export {
  buildVisitCompleteRequest,
  buildNextVisitRequest,
  buildRestockRequests,
  buildCancellationRequests
} from './useConsumptionWorkflow'

// Composable shape for setup-context callers. Same functions, one import (§5).
export function useConsumptionPayload () {
  return {
    CONSUMPTION_REF_PATH,
    stampFields,
    buildConsumptionCompositeRequest,
    buildConsumptionMovementsRequest,
    buildReturnsRequests,
    buildReturnAdjustmentRequests,
    buildInvoiceRequests
  }
}

// The invoice arithmetic lives in its own Layer 2 file but is re-exported here, so a caller
// assembling a submit still has ONE import for the builders AND the engine behind them.
export { calculateConsumptionInvoice, groupTaxDetails, invoiceItemOf } from './useConsumptionInvoice'
