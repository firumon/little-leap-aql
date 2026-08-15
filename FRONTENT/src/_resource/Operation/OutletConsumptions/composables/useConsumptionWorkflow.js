/**
 * OutletConsumptions — the OPTIONAL workflow side-effects of a consumption. Layer 2.
 *
 * A consumption submit always writes the records in `useConsumptionPayload.js`. Everything
 * here is conditional on a choice the user made in the wizard: complete the visit,
 * schedule the next one, raise a restock, ship it immediately — plus the cancellation
 * cascade, which is the reverse of all of it.
 *
 * Split out of `useConsumptionPayload.js` purely for file size (CORE_ARCHITECTURE_RULES
 * §9, ~400 lines); it is the same layer, the same purity rules, and its builders are
 * re-exported from that file so a caller still has one import.
 *
 * PURE throughout — plain rows in, canonical request envelopes out.
 */

import { batchRef, textOrRef } from 'src/utils/appHelpers'
import { addDays, toDateOnly, toDateTime24 } from 'src/utils/dateHelpers'
import {
  compositeSaveRequest,
  resourceBulkRequest,
  resourceCreateRequest,
  executeActionRequest,
  resourceGetRequest
} from 'src/composables/resources/resourceRequests'
import { toNumber, splitByWarehouseStock, DEFAULT_STORAGE } from './useConsumptionStock'
import { CANCELLED, rejectableRestocks } from './useConsumptionProgress'

const VISITS = 'OutletVisits'
const RESTOCKS = 'OutletRestocks'
const RESTOCK_ITEMS = 'OutletRestockItems'
const STOCK_MOVEMENTS = 'StockMovements'
const OUTLET_MOVEMENTS = 'OutletMovements'
const CONSUMPTIONS = 'OutletConsumptions'
const INVOICES = 'OutletConsumptionInvoices'

// A warehouse movement and an outlet movement written for the same restock describe two
// different legs of one journey; the ledgers must stay tellable apart when reconciling.
const REF_RESTOCK = 'OutletRestock'
const REF_RESTOCK_DELIVERY = 'RestockDelivery'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const todayISO = () => new Date().toISOString().slice(0, 10)

// Restated rather than imported from the payload module, which re-exports THIS file — a
// mutual import would make the two modules' initialisation order load-dependent.
//
// `toDateTime24`, IDENTICALLY to the payload module's copy, and that is the whole point of
// naming it here rather than reaching for `toISOString()`: these are the same
// `Progress<State>At` columns GAS stamps with `formatDateTime24()`, and two formats in one
// column would sort and read inconsistently depending on which path wrote the row.
function stampFields (prefix, actorName = '', comment = '') {
  return {
    [`${prefix}At`]: toDateTime24(new Date()),
    [`${prefix}By`]: text(actorName),
    [`${prefix}Comment`]: text(comment)
  }
}

// ─── Visits ───────────────────────────────────────────────────────────────────

/**
 * Complete the planned visit this audit was carried out against.
 *
 * Routed through `executeAction` rather than a direct update so GAS applies the same
 * `Progress<State>` stamping and validation the standalone Visits page gets — the visit's
 * own workflow rules are not this module's to reimplement.
 */
export function buildVisitCompleteRequest (visitCode, actorName = '', comment = '') {
  const code = text(visitCode)
  if (!code) return null
  return executeActionRequest(VISITS, code, {
    action: 'Complete', column: 'Progress', columnValue: 'COMPLETED'
  }, {
    RespondDate: todayISO(),
    ProgressCompletedComment: text(comment) || `Completed from outlet consumption by ${text(actorName) || 'Unknown'}.`
  }, [VISITS])
}

/**
 * Plan the NEXT visit, `frequencyDays` after this audit.
 *
 * `frequencyDays` is REQUIRED and is not defaulted here. A cadence this module invented
 * would silently schedule every outlet on a number nobody configured; the caller resolves
 * it through `visitFrequencyFor`, which reads the outlet's own operating rule and falls
 * back to the backend's configured default. A non-positive value yields `null` — no visit
 * is planned rather than one planned for tomorrow.
 */
export function buildNextVisitRequest (form = {}, frequencyDays = 0, actorName = '') {
  const entry = asRow(form)
  const frequency = toNumber(frequencyDays)
  const outletCode = text(entry.OutletCode)
  if (!outletCode || frequency <= 0) return null

  const base = text(entry.Date) || todayISO()
  const nextDate = toDateOnly(addDays(base, frequency))
  if (!nextDate) return null

  return resourceCreateRequest(VISITS, {
    OutletCode: outletCode,
    Date: nextDate,
    Progress: 'PLANNED',
    ProgressPlannedComment: `Auto-planned ${frequency} days after the consumption recorded by ${text(actorName) || text(entry.Username) || 'Unknown'} on ${base}.`,
    Status: 'Active'
  }, [VISITS])
}

// ─── Restocks ─────────────────────────────────────────────────────────────────

/**
 * The restock request a consumption raises, in whichever of three modes was chosen.
 *
 *   DRAFT             parent DRAFT, lines PENDING. Nothing is committed; the requester
 *                     finishes it later from the Restocks module.
 *   PENDING_APPROVAL  parent PENDING_APPROVAL with its submission stamp, lines PENDING.
 *                     An approver allocates stock afterwards.
 *   APPROVED (direct) parent APPROVED. Lines the chosen warehouse can actually cover
 *                     become ALLOCATED against it and deduct warehouse stock immediately;
 *                     anything short stays PENDING for a later allocation.
 *
 * PARTIAL COVER IS A SUPPORTED OUTCOME, not a failure. `splitByWarehouseStock` decides the
 * split, so a direct restock ships what the warehouse has instead of refusing whole — and
 * the shortfall survives as PENDING lines rather than being silently dropped.
 *
 * `markDelivered` additionally walks the allocated lines to DELIVERED and writes the
 * POSITIVE `OutletMovements` arrival. That is the mirror of the warehouse deduction:
 * approval takes the units off the warehouse shelf, delivery puts them on the outlet's.
 * Nothing here touches warehouse stock twice.
 */
export function buildRestockRequests (form = {}, restockRows = [], options = {}) {
  const entry = asRow(form)
  const rows = (Array.isArray(restockRows) ? restockRows : []).map(asRow)
    .filter((row) => text(row.SKU) && toNumber(row.Quantity) > 0)
  if (!rows.length) return { requests: [], allocated: [], pending: [], shortfall: 0 }

  const mode = text(options.mode).toUpperCase() || 'PENDING_APPROVAL'
  const direct = mode === 'APPROVED'
  const warehouseCode = text(options.warehouseCode)
  const actorName = text(options.actorName)
  const date = text(entry.Date) || todayISO()
  const markDelivered = direct && options.markDelivered === true

  // Only a direct restock splits against real stock. A draft or an approval request is
  // allocated later, by someone looking at the warehouse at that time — splitting now
  // would record an availability that has expired by the time it is acted on.
  const split = direct
    ? splitByWarehouseStock(rows, warehouseCode, options.warehouseStorages || [])
    : { allocated: [], pending: rows.map((row) => ({ SKU: text(row.SKU), Quantity: toNumber(row.Quantity) })), shortfall: 0 }

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

  // A direct restock whose lines were ALL delivered is finished; one carrying a shortfall
  // is not, and says so rather than claiming completion. Derived from the pending lines
  // themselves, so the parent state cannot disagree with its children.
  const parentProgress = direct
    ? (markDelivered ? (split.pending.length ? 'PARTIALLY_DELIVERED' : 'DELIVERED') : 'APPROVED')
    : mode

  const requests = [compositeSaveRequest({
    resource: RESTOCKS,
    data: {
      Date: date,
      OutletCode: text(entry.OutletCode),
      OutletConsumptionCode: textOrRef(options.consumptionRef || batchRef(`${CONSUMPTIONS}.latest.code`)),
      RequestedUser: text(entry.Username),
      ApprovedUser: direct ? actorName : '',
      Progress: parentProgress,
      ...(mode === 'PENDING_APPROVAL' ? stampFields('ProgressSubmitted', actorName, 'Submitted with an outlet consumption.') : {}),
      ...(direct ? stampFields('ProgressApproved', actorName, 'Auto-approved as a direct restock from the source warehouse.') : {}),
      ...(markDelivered ? stampFields('ProgressDelivered', actorName, 'Delivered to the outlet during consumption submission.') : {}),
      Status: 'Active'
    },
    children: [{ resource: RESTOCK_ITEMS, records: children }]
  })]

  if (direct && split.allocated.length) {
    // NEGATIVE: the units are committed OUT of the warehouse. `Math.abs` first, so a row
    // carrying a negative quantity cannot flip the direction and credit the warehouse.
    requests.push(resourceBulkRequest(STOCK_MOVEMENTS, split.allocated.map((row) => ({
      WarehouseCode: warehouseCode,
      StorageName: DEFAULT_STORAGE,
      SKU: row.SKU,
      QtyChange: -Math.abs(row.Quantity),
      ReferenceType: REF_RESTOCK,
      ReferenceCode: textOrRef(batchRef(`${RESTOCKS}.latest.code`)),
      Status: 'Active'
    })), ['WarehouseStorages']))

    if (markDelivered) {
      // POSITIVE, on the OUTLET ledger — the other leg. Written only when the user
      // confirmed the stock physically travelled with them.
      requests.push(resourceBulkRequest(OUTLET_MOVEMENTS, split.allocated.map((row) => ({
        OutletCode: text(entry.OutletCode),
        StorageName: DEFAULT_STORAGE,
        SKU: row.SKU,
        QtyChange: Math.abs(row.Quantity),
        ReferenceType: REF_RESTOCK_DELIVERY,
        ReferenceCode: textOrRef(batchRef(`${RESTOCKS}.latest.code`)),
        MovementDate: date,
        Status: 'Active'
      })), ['OutletStorages']))
    }
  }

  return { requests, allocated: split.allocated, pending: split.pending, shortfall: split.shortfall }
}

// ─── Cancellation cascade ─────────────────────────────────────────────────────

/**
 * Cancel a consumption and everything downstream that has not yet been consumed.
 *
 * Three writes, and what is deliberately ABSENT from them matters as much as what is
 * present:
 *
 *   - the consumption walks to CANCELLED with the mandatory reason;
 *   - an invoice that is neither cancelled nor PAID is cancelled with it. A PAID invoice
 *     is left alone — money has changed hands and no state column undoes that;
 *   - restocks still awaiting a decision are rejected. Anything APPROVED, DELIVERED or
 *     PARTIALLY_DELIVERED is left alone: its stock has physically moved, and the caller is
 *     expected to have refused the cancellation outright (`cancellability`).
 *
 * NO REVERSING MOVEMENTS ARE WRITTEN. A cancellation does not put the consumed units back
 * on the outlet's shelf, because the audit found them gone — the count was a measurement,
 * not an instruction, and reversing it would restate a physical fact that is still true.
 * Correcting a miscount is a fresh audit, which is why this module has no Edit page.
 */
export function buildCancellationRequests (record = {}, reason = '', options = {}) {
  const consumption = asRow(record)
  const code = text(consumption.Code)
  if (!code) return []

  const actorName = text(options.actorName)
  const invoice = asRow(options.invoice)
  const cascadeNote = `Cancelled as a dependent of outlet consumption ${code}${actorName ? ` by ${actorName}` : ''}.`

  const requests = [executeActionRequest(CONSUMPTIONS, code, {
    action: 'CancelConsumption', column: 'Progress', columnValue: CANCELLED
  }, stampFields('ProgressCancelled', actorName, text(reason)), [CONSUMPTIONS])]

  const invoiceCode = text(invoice.Code)
  const invoiceProgress = text(invoice.Progress).toUpperCase()
  if (invoiceCode && invoiceProgress !== 'PAID' && invoiceProgress !== CANCELLED) {
    requests.push(executeActionRequest(INVOICES, invoiceCode, {
      action: 'Cancel', column: 'Progress', columnValue: CANCELLED
    }, stampFields('ProgressCancelled', actorName, cascadeNote), [INVOICES]))
  }

  rejectableRestocks(options.restocks).forEach((restock) => {
    requests.push(executeActionRequest(RESTOCKS, text(restock.Code), {
      action: 'RejectRestock', column: 'Progress', columnValue: 'REJECTED'
    }, stampFields('ProgressRejected', actorName, cascadeNote), [RESTOCKS]))
    // Its lines are retired with it, so a rejected request cannot leave PENDING rows a
    // later reallocation would try to fill.
    const lines = (Array.isArray(restock.$OutletRestockItems) ? restock.$OutletRestockItems : [])
      .map(asRow).filter((line) => text(line.Code))
    if (lines.length) {
      requests.push(resourceBulkRequest(RESTOCK_ITEMS, lines.map((line) => ({ Code: text(line.Code), Status: 'Inactive' })), [RESTOCK_ITEMS]))
    }
  })

  // The cancellation changed data three other resources derive from. Pull them back in the
  // same round trip rather than leaving the next page to discover it stale.
  requests.push(resourceGetRequest([CONSUMPTIONS, INVOICES, RESTOCKS]))
  return requests
}

// Composable shape for setup-context callers. Same functions, one import (§5).
export function useConsumptionWorkflow () {
  return {
    buildVisitCompleteRequest,
    buildNextVisitRequest,
    buildRestockRequests,
    buildCancellationRequests
  }
}
