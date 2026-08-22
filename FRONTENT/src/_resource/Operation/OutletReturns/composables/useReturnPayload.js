/**
 * OutletReturns — the batch payloads a return writes. Layer 2.
 *
 * This file is the SOLE owner of every batch request that creates, advances or voids an
 * `OutletReturns` row and the ledger movements that follow from it. Three callers share it:
 *
 *   - the standalone OutletReturns UI (`_ui/AQL/**`), for a return logged on its own;
 *   - `useConsumptionPayload.js`, for the surplus lines a consumption count produces;
 *   - `useInvoicePayload.js`, for crediting returns when an invoice is finalised.
 *
 * All three write the same columns by the same rules, because they call the same builders
 * (UI_RESOURCE_DOMAIN_LOGIC.md §9.1). Whether `Progress` may become `COMPLETED` is never
 * decided here by hand — every builder asks `isReturnCompleted` from the vocabulary file.
 *
 * PURE functions throughout: no refs, no injects, no stores, nothing rendered. They take
 * plain rows and return the canonical envelope `{ valid, requests, permissions, message,
 * successMsg }` (§9.2), so a `PageAction.js` running outside any setup context can call
 * them. `resourceRequests` is imported rather than `usePageState` specifically so this
 * module's import graph stays store-free (§2.1).
 */

import { batchRef, textOrRef } from 'src/utils/appHelpers'
import { toDateTime24 } from 'src/utils/dateHelpers'
import {
  resourceBulkRequest,
  resourceCreateRequest,
  resourceUpdateRequest,
  resourceGetRequest,
  executeActionRequest
} from 'src/composables/resources/resourceRequests'
import {
  SUBMITTED,
  COMPLETED,
  CANCELLED,
  STOCKED,
  DISPOSED,
  isFlagged,
  isReturnCompleted,
  isCancelled,
  isEditable,
  invoiceAdjustmentRequired,
  warehouseActionRequired,
  warehouseActionCompleted
} from './useReturnProgress'

const RESOURCE_NAME = 'OutletReturns' // this module IS OutletReturns — always

const OUTLET_MOVEMENTS = 'OutletMovements'
const STOCK_MOVEMENTS = 'StockMovements'

/**
 * The ledger reference type both movement legs write.
 *
 * One value across the outlet ledger and the warehouse ledger, so a reconciliation can
 * follow a return end-to-end by reference type alone. Matches the `outletReturn` action
 * declared on `OutletMovements` in `GAS/syncAppResources.gs`.
 */
const REF_RETURN = 'OutletReturn'

/** The batch path a movement created alongside a brand-new return chains its code off. */
export const RETURN_REF_PATH = `${RESOURCE_NAME}.latest.code`

const DEFAULT_STORAGE = '_default'

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

// ─── The stock movement truth table ───────────────────────────────────────────

/**
 * The outlet-shelf ledger movement a return writes at creation.
 *
 *  IAR  WAR  physical meaning                                        QtyChange
 *   ✓    ✗   customer handed it back; shelf keeps it, outlet credited   +Qty
 *   ✗    ✓   units leave the shelf for a warehouse, no credit           -Qty
 *   ✓    ✓   credited AND shipped out — the two cancel                    0
 *   ✗    ✗   informational log only                                       0
 *
 * The two zero rows are the ones worth stating out loud. Case 3 nets to zero because the
 * unit is credited into the shelf and shipped straight back out of it. Case 4 touches
 * nothing: the unit stays where it is and nobody is paid for it.
 *
 * ONE function, because this table is also what a CANCELLATION inverts — reversing a
 * return means writing `-1 ×` whatever this returned at creation, and deriving both from
 * the same source is what guarantees the reversal actually balances.
 */
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

/**
 * One outlet-ledger row. `referenceCode` is a `$ref` for a return being created in this
 * same batch and a real code for one that already exists — `textOrRef` keeps an unresolved
 * reference intact instead of stringifying it into `[object Object]`
 * (CORE_ARCHITECTURE_RULES §3).
 */
function outletMovement ({ outletCode, storageName, sku, qtyChange, referenceCode, movementDate }) {
  return {
    OutletCode: text(outletCode),
    StorageName: text(storageName) || DEFAULT_STORAGE,
    SKU: text(sku),
    QtyChange: qtyChange,
    ReferenceType: REF_RETURN,
    ReferenceCode: textOrRef(referenceCode),
    MovementDate: text(movementDate) || todayISO(),
    Status: 'Active'
  }
}

// ─── 1. Creating a return ─────────────────────────────────────────────────────

/**
 * A return row plus, when the truth table calls for one, its outlet-ledger movement.
 *
 * `Progress` is decided by `isReturnCompleted` against the row as it will be stored: a
 * return with no track required is COMPLETED the moment it is written, because there is
 * nothing left to reconcile. Anything else lands in SUBMITTED.
 *
 * This builder does NOT refuse a return with neither track flagged — see
 * `returnRequiresTrack` in the vocabulary file for why that gate belongs to the standalone
 * Add page and not to the consumption path that also calls this.
 *
 * @param {Object}  form            Collected inputs — OutletCode, SKU, Qty, Reason, flags.
 * @param {number}  resolvedPrice   Unit credit value, already resolved by the caller.
 * @param {string}  actorName       Who is logging it.
 */
export function buildReturnCreateBatch ({ form = {}, resolvedPrice = 0, actorName = '' } = {}) {
  const entry = asRow(form)
  const outletCode = text(entry.OutletCode)
  const sku = text(entry.SKU)
  const qty = Math.abs(toNumber(entry.Qty))

  if (!outletCode) return { valid: false, message: 'Outlet is required.' }
  if (!sku) return { valid: false, message: 'SKU is required.' }
  if (qty <= 0) return { valid: false, message: 'Returned quantity must be greater than 0.' }

  const invoiceRequired = isFlagged(entry.InvoiceAdjustmentRequired)
  const warehouseRequired = isFlagged(entry.WarehouseActionRequired)

  if (warehouseRequired && !text(entry.WarehouseCode)) {
    return { valid: false, message: 'Target warehouse is required when stock is leaving the outlet.' }
  }

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
    // Only ever populated by the invoice chain, never at creation: a return carries an
    // invoice code once an invoice has actually credited it.
    ConsumptionInvoiceCode: '',
    WarehouseActionRequired: flag(warehouseRequired),
    WarehouseActionCompleted: 'FALSE',
    WarehouseCode: warehouseRequired ? text(entry.WarehouseCode) : '',
    WarehouseAction: '',
    WarehouseActionDisposedReason: '',
    Status: 'Active'
  }

  // The completion question asked of the row as it will be STORED — not of the form.
  record.Progress = isReturnCompleted(record) ? COMPLETED : SUBMITTED

  const requests = [resourceCreateRequest(RESOURCE_NAME, record, [RESOURCE_NAME])]

  const qtyChange = returnQtyChange(qty, { invoiceRequired, warehouseRequired })
  if (qtyChange !== 0) {
    requests.push(resourceCreateRequest(OUTLET_MOVEMENTS, outletMovement({
      outletCode,
      storageName: entry.StorageName,
      sku,
      qtyChange,
      // The return does not exist yet; GAS resolves this to its generated code (§9.4).
      referenceCode: batchRef(RETURN_REF_PATH),
      movementDate: record.Date
    }), ['OutletStorages']))
  }

  return {
    valid: true,
    requests,
    permissions: {
      outletReturn: 'create',
      ...(qtyChange !== 0 ? { outletMovement: 'create' } : {})
    },
    successMsg: 'Return logged.'
  }
}

/**
 * ── 1b. CORRECTING a return that is still open ────────────────────────────────
 *
 * The Edit page offers the SAME form as Add, so an edit can change anything Add could
 * decide: the item, the quantity, the credit value, the reason, and BOTH track flags.
 *
 * ── WHY THE FLAGS ARE EDITABLE HERE, AND WHAT THAT COSTS ──
 * The two flags decided which ledger movement was written at creation, and in which
 * direction (`returnQtyChange`). Letting them change means the stored row and the ledger
 * would describe different events unless the difference is written back — so this builder
 * computes the DELTA between the movement the stored row implies and the one the corrected
 * row implies, and posts a correcting movement for exactly that difference. Nothing is
 * rewritten: the original movement stands as history and the correction sits beside it,
 * which is what makes the outlet ledger auditable rather than merely current.
 *
 * A delta of zero writes nothing at all, which is the common case — most edits fix a
 * quantity or a reason and leave the truth table's answer where it was.
 *
 * ── WHAT IT REFUSES ──
 * A return whose credit has been issued or whose stock has already moved is not corrected,
 * it is cancelled and re-logged: `isEditable` is the gate, and it is the SAME predicate the
 * Edit FAB and the lock banner read (§8.6). This builder re-checks it rather than trusting
 * the page, because a record can settle while the form is open.
 *
 * `ConsumptionInvoiceCode`, `InvoiceAdjustmentDone`, `WarehouseActionCompleted` and every
 * `*At`/`*By` stamp are workflow columns and are never written here (§13.3) — they belong
 * to the action routes that cause each transition.
 *
 * @param {Object} record        The STORED row, as the server holds it.
 * @param {Object} form          The corrected values from the shared form.
 * @param {number} resolvedPrice Unit credit value, already resolved by the caller.
 */
export function buildReturnUpdateBatch ({ record = {}, form = {}, resolvedPrice = 0 } = {}) {
  const stored = asRow(record)
  const entry = asRow(form)
  const code = text(stored.Code)

  if (!code) return { valid: false, message: 'Return code is missing.' }
  if (!isEditable(stored)) {
    return { valid: false, message: 'This return can no longer be edited. Cancel and re-log it instead.' }
  }

  const sku = text(entry.SKU)
  const qty = Math.abs(toNumber(entry.Qty))

  if (!sku) return { valid: false, message: 'SKU is required.' }
  if (qty <= 0) return { valid: false, message: 'Returned quantity must be greater than 0.' }

  const invoiceRequired = isFlagged(entry.InvoiceAdjustmentRequired)
  const warehouseRequired = isFlagged(entry.WarehouseActionRequired)

  if (!invoiceRequired && !warehouseRequired) {
    return { valid: false, message: 'A return must either be credited on an invoice or move stock off the shelf.' }
  }

  if (warehouseRequired && !text(entry.WarehouseCode)) {
    return { valid: false, message: 'Target warehouse is required when stock is leaving the outlet.' }
  }

  const changes = {
    SKU: sku,
    Qty: qty,
    Price: Math.round(toNumber(resolvedPrice) * 100) / 100,
    Reason: text(entry.Reason) || 'DAMAGE',
    ReasonComment: text(entry.ReasonComment),
    InvoiceAdjustmentRequired: flag(invoiceRequired),
    WarehouseActionRequired: flag(warehouseRequired),
    WarehouseCode: warehouseRequired ? text(entry.WarehouseCode) : ''
  }

  // The completion question asked of the row as it will BE once this lands, never of the
  // row as it was — turning a track off can complete a return that was waiting on it.
  const merged = { ...stored, ...changes }
  changes.Progress = isReturnCompleted(merged) ? COMPLETED : (text(stored.Progress) || SUBMITTED)

  const requests = [resourceUpdateRequest(RESOURCE_NAME, code, changes, [RESOURCE_NAME])]

  const delta = returnQtyChange(qty, { invoiceRequired, warehouseRequired }) - storedQtyChange(stored)
  if (delta !== 0) {
    requests.push(resourceCreateRequest(OUTLET_MOVEMENTS, outletMovement({
      outletCode: stored.OutletCode,
      storageName: stored.StorageName,
      // The correction follows the CORRECTED item: an edit that changed the SKU has to move
      // the units back onto the shelf they never left and off the one they did.
      sku,
      qtyChange: delta,
      referenceCode: code,
      movementDate: todayISO()
    }), ['OutletStorages']))
  }

  requests.push(resourceGetRequest([RESOURCE_NAME, 'OutletStorages']))

  return {
    valid: true,
    requests,
    permissions: {
      outletReturn: 'update',
      ...(delta !== 0 ? { outletMovement: 'create' } : {})
    },
    successMsg: `Return ${code} updated.`
  }
}

/**
 * Many returns at once — the shape the consumption path needs.
 *
 * A consumption submit can produce several surplus lines, and each must land as its own
 * row with its own ledger movement. Bulk rather than N creates, but the per-row decisions
 * are the SAME ones `buildReturnCreateBatch` makes, delegated line by line so the two
 * paths cannot drift.
 *
 * ── Why the movements carry one shared `$ref` ──
 * `batchRef` resolves to `OutletReturns.latest.code` — the LAST code the batch generated.
 * With several returns created in one bulk request, every movement therefore points at the
 * same (final) return code rather than at its own row. That is the behaviour the
 * consumption path has always had; it is preserved here deliberately rather than silently
 * "fixed", because correcting it needs a per-row reference GAS does not currently expose,
 * and changing the linkage under the existing reconciliation reports is not this
 * migration's job. The ledger TOTALS are correct either way — only the per-row attribution
 * is approximate. Flagged for follow-up.
 *
 * @param {Array} lines  One entry per return: `{ form, resolvedPrice }`.
 */
export function buildReturnBulkCreateBatch ({ lines = [], actorName = '', movementDate = '' } = {}) {
  const entries = asList(lines).map(asRow).filter((line) => text(asRow(line.form).SKU))
  if (!entries.length) return { valid: true, requests: [], permissions: {} }

  const records = []
  const movements = []

  for (const line of entries) {
    const built = buildReturnCreateBatch({
      form: line.form,
      resolvedPrice: line.resolvedPrice,
      actorName
    })
    // Bubble the child's own message rather than restating it (§9.3).
    if (!built.valid) return built

    // Unwrap the per-line requests back into the two bulk collections. The builder is the
    // one that decided every column and every sign; this only regroups them.
    for (const request of built.requests) {
      if (request.resource === RESOURCE_NAME) records.push(request.payload.record)
      else movements.push({ ...request.payload.record, MovementDate: text(movementDate) || request.payload.record.MovementDate })
    }
  }

  const requests = [resourceBulkRequest(RESOURCE_NAME, records, [RESOURCE_NAME])]
  if (movements.length) requests.push(resourceBulkRequest(OUTLET_MOVEMENTS, movements, ['OutletStorages']))

  return {
    valid: true,
    requests,
    permissions: {
      outletReturn: 'create',
      ...(movements.length ? { outletMovement: 'create' } : {})
    },
    successMsg: `${records.length} return${records.length === 1 ? '' : 's'} logged.`
  }
}

// ─── 2. The physical track ────────────────────────────────────────────────────

/**
 * Confirming what physically happened to the units — stocked into a bin, or written off.
 *
 * Three things land in one batch:
 *   1. the return row's warehouse columns, stamped with the disposition and its actor;
 *   2. a positive `StockMovements` row, but only when the units were STOCKED and a target
 *      warehouse is known — a disposal adds nothing to any bin;
 *   3. `Progress: 'COMPLETED'`, but only if the commercial track is settled too.
 *
 * ── ON THE COMMERCIAL TRACK ──
 * The directive originally had this builder also set `InvoiceAdjustmentDone` whenever the
 * row carried a `ConsumptionInvoiceCode`. It does NOT, deliberately. `ConsumptionInvoiceCode`
 * is written by ONE path — `buildReturnInvoiceAdjustmentLinkedBatch`, when an invoice
 * actually credits the return — and that same path sets `InvoiceAdjustmentDone` in the same
 * request. So a row carrying an invoice code is already marked done, and re-deriving it
 * here would only ever fire on a row where the credit had NOT happened, silently settling a
 * commercial track nobody had settled. The invoice path owns that column exclusively.
 */
export function buildReturnWarehouseActionBatch ({
  record = {},
  actionType = STOCKED,
  storageName = '',
  disposalReason = '',
  actorName = ''
} = {}) {
  const row = asRow(record)
  const code = text(row.Code)

  if (!code) return { valid: false, message: 'Return code is missing.' }
  if (isCancelled(row)) return { valid: false, message: 'A cancelled return cannot be actioned.' }
  if (!warehouseActionRequired(row)) return { valid: false, message: 'This return has no warehouse action to confirm.' }
  if (warehouseActionCompleted(row)) return { valid: false, message: 'The warehouse action is already confirmed.' }

  const isDisposed = text(actionType) === DISPOSED
  if (isDisposed && !text(disposalReason)) {
    return { valid: false, message: 'A disposal reason is required when writing stock off.' }
  }

  const now = toDateTime24(new Date())
  const actor = text(actorName)

  const update = {
    WarehouseActionCompleted: 'TRUE',
    WarehouseAction: isDisposed ? DISPOSED : STOCKED,
    ...(isDisposed
      ? {
          WarehouseActionDisposedReason: text(disposalReason),
          WarehouseActionDisposedAt: now,
          WarehouseActionDisposedBy: actor
        }
      : {
          WarehouseActionStockedAt: now,
          WarehouseActionStockedBy: actor
        })
  }

  // Would the row be complete once this update lands? Asked of the merged state, never of
  // the stored row — the physical track is about to become settled.
  if (isReturnCompleted({ ...row, ...update })) update.Progress = COMPLETED

  const requests = [resourceUpdateRequest(RESOURCE_NAME, code, update, [RESOURCE_NAME])]

  const stocksBackIn = !isDisposed && text(row.WarehouseCode)
  if (stocksBackIn) {
    requests.push(resourceCreateRequest(STOCK_MOVEMENTS, {
      WarehouseCode: text(row.WarehouseCode),
      StorageName: text(storageName) || DEFAULT_STORAGE,
      SKU: text(row.SKU),
      // Always positive: the warehouse is RECEIVING units, whatever sign the outlet ledger
      // took when they left the shelf.
      QtyChange: Math.abs(toNumber(row.Qty)),
      ReferenceType: REF_RETURN,
      ReferenceCode: code,
      MovementDate: todayISO(),
      Status: 'Active'
    }, ['WarehouseStorages']))
  }

  requests.push(resourceGetRequest([RESOURCE_NAME, 'WarehouseStorages']))

  return {
    valid: true,
    requests,
    permissions: {
      outletReturn: 'update',
      ...(stocksBackIn ? { stockMovement: 'create' } : {})
    },
    successMsg: isDisposed ? 'Return disposed.' : 'Return stocked into the warehouse.'
  }
}

// ─── 3. The commercial track ──────────────────────────────────────────────────

/**
 * Settling the credit OUTSIDE the invoice cycle.
 *
 * For a return the outlet was compensated for directly — a cash refund, a manual credit
 * note, an adjustment agreed off-system. No `ConsumptionInvoiceCode` is written, because
 * no invoice credited it; the column stays blank and the View card reads "settled
 * directly" rather than naming an invoice that does not exist.
 */
export function buildReturnMarkInvoiceAdjustedBatch ({ record = {}, actorName = '', comment = '' } = {}) {
  const row = asRow(record)
  const code = text(row.Code)

  if (!code) return { valid: false, message: 'Return code is missing.' }
  if (isCancelled(row)) return { valid: false, message: 'A cancelled return cannot be settled.' }
  if (!invoiceAdjustmentRequired(row)) return { valid: false, message: 'This return needs no invoice adjustment.' }
  if (isFlagged(row.InvoiceAdjustmentDone)) return { valid: false, message: 'The invoice adjustment is already settled.' }

  const update = { InvoiceAdjustmentDone: 'TRUE' }
  if (isReturnCompleted({ ...row, ...update })) update.Progress = COMPLETED

  return {
    valid: true,
    requests: [
      resourceUpdateRequest(RESOURCE_NAME, code, update, [RESOURCE_NAME]),
      resourceGetRequest([RESOURCE_NAME])
    ],
    permissions: { outletReturn: 'update' },
    // `comment` is accepted and deliberately not written: this resource declares no
    // comment column an adjustment could land in (see `workflowStamps`' note). Kept in the
    // signature so callers need no change when the schema gains one.
    successMsg: 'Invoice adjustment settled.'
  }
}

/**
 * Crediting returns against an invoice — called by `useInvoicePayload.js` at finalisation.
 *
 * Each affected return gets `InvoiceAdjustmentDone = 'TRUE'` and the invoice's code, and
 * is walked to COMPLETED individually: two returns credited by the same invoice can end in
 * different states, because one may still owe a warehouse leg and the other may not. That
 * is why this returns one update PER return rather than a single bulk write — the rows
 * genuinely differ in what they become.
 *
 * @param {Array}  returnRows   The full return records being credited, not just their codes.
 * @param {Object} invoiceCode  A real code, or a `batchRef` for an invoice created in this
 *                              same batch — `textOrRef` keeps an unresolved ref intact.
 */
export function buildReturnInvoiceAdjustmentLinkedBatch ({ returnRows = [], invoiceCode = null, actorName = '' } = {}) {
  const rows = asList(returnRows).map(asRow).filter((row) => text(row.Code))
  if (!rows.length) return { valid: true, requests: [], permissions: {} }

  const requests = rows.map((row) => {
    const update = {
      InvoiceAdjustmentDone: 'TRUE',
      ConsumptionInvoiceCode: textOrRef(invoiceCode)
    }
    // Per row, against that row's own warehouse track — never one verdict for the batch.
    if (isReturnCompleted({ ...row, ...update })) update.Progress = COMPLETED
    return resourceUpdateRequest(RESOURCE_NAME, text(row.Code), update, [RESOURCE_NAME])
  })

  return {
    valid: true,
    requests,
    permissions: { outletReturn: 'update' },
    successMsg: `${rows.length} return${rows.length === 1 ? '' : 's'} credited.`
  }
}

/**
 * UN-crediting returns — called when an invoice that credited them is cancelled.
 *
 * The exact inverse of `buildReturnInvoiceAdjustmentLinkedBatch`: the credit flag clears,
 * the invoice link clears, and the row reopens. Written by the same mechanism (a plain
 * update) that set the columns, so each column has ONE write path in both directions.
 *
 * The row reopens to `SUBMITTED` rather than to the legacy `AWAITING_INVOICE_ADJUSTMENT`
 * this previously wrote — see `LEGACY_STATES` in the vocabulary file. A reopened return is
 * outstanding work again, and `isOpen` claims all three non-terminal states, so no queue
 * loses sight of it either way.
 *
 * A CANCELLED return is skipped: voiding an invoice does not resurrect a return somebody
 * separately withdrew.
 */
export function buildReturnInvoiceCreditReversalBatch ({ returnRows = [] } = {}) {
  const rows = asList(returnRows).map(asRow)
    .filter((row) => text(row.Code) && !isCancelled(row))
  if (!rows.length) return { valid: true, requests: [], permissions: {} }

  const requests = rows.map((row) => resourceUpdateRequest(RESOURCE_NAME, text(row.Code), {
    InvoiceAdjustmentDone: 'FALSE',
    ConsumptionInvoiceCode: '',
    Progress: SUBMITTED
  }, [RESOURCE_NAME]))

  return {
    valid: true,
    requests,
    permissions: { outletReturn: 'update' },
    successMsg: `${rows.length} return credit${rows.length === 1 ? '' : 's'} reversed.`
  }
}

// ─── 4. Voiding a return ──────────────────────────────────────────────────────

/**
 * Cancelling a return and reversing whatever it moved.
 *
 * The reversal is `-1 ×` the creation movement, read back off the STORED flags through the
 * same truth table that wrote it. Deriving both directions from one function is what makes
 * the pair actually balance — a hand-written inverse is where a reconciliation drifts.
 *
 * The `Cancel` action is dispatched through `executeActionRequest` because
 * `GAS/syncAppResources.gs` declares it on this resource, so the mutation is audited the
 * way the sheet expects.
 *
 * ── ON THE CANCELLATION REASON ──
 * `ProgressCancelledComment` is sent but WILL NOT PERSIST: the sheet declares no such
 * column, and `buildNewResourceRow` silently drops unknown keys. This is pre-existing
 * behaviour, kept rather than removed so the reason lands correctly the moment the schema
 * carries the column. The reason is still validated as mandatory, because the person
 * cancelling should have to state one even while the system cannot yet keep it.
 */
export function buildReturnCancelBatch ({ record = {}, reason = '', actorName = '' } = {}) {
  const row = asRow(record)
  const code = text(row.Code)

  if (!code) return { valid: false, message: 'Return code is missing.' }
  if (isCancelled(row)) return { valid: false, message: 'This return is already cancelled.' }
  if (!text(reason)) return { valid: false, message: 'A cancellation reason is required.' }

  const requests = [
    executeActionRequest(RESOURCE_NAME, code, {
      action: 'Cancel',
      column: 'Progress',
      columnValue: CANCELLED
    }, {
      Comment: text(reason),
      ProgressCancelledComment: text(reason),
      ProgressCancelledBy: text(actorName)
    }, [RESOURCE_NAME])
  ]

  const reversal = -storedQtyChange(row)
  if (reversal !== 0) {
    requests.push(resourceCreateRequest(OUTLET_MOVEMENTS, outletMovement({
      outletCode: row.OutletCode,
      storageName: row.StorageName,
      sku: row.SKU,
      qtyChange: reversal,
      referenceCode: code,
      movementDate: todayISO()
    }), ['OutletStorages']))
  }

  requests.push(resourceGetRequest([RESOURCE_NAME, 'OutletStorages']))

  return {
    valid: true,
    requests,
    permissions: {
      // An action permission resolves as `can<PascalCase(action)>`, so the value must be
      // the action's OWN name exactly as GAS declares it.
      outletReturn: 'Cancel',
      ...(reversal !== 0 ? { outletMovement: 'create' } : {})
    },
    successMsg: `Return ${code} cancelled.`
  }
}

// Composable shape for setup-context callers. Same functions, one import (§5).
export function useReturnPayload () {
  return {
    RETURN_REF_PATH,
    returnQtyChange,
    storedQtyChange,
    buildReturnCreateBatch,
    buildReturnUpdateBatch,
    buildReturnBulkCreateBatch,
    buildReturnWarehouseActionBatch,
    buildReturnMarkInvoiceAdjustedBatch,
    buildReturnInvoiceAdjustmentLinkedBatch,
    buildReturnInvoiceCreditReversalBatch,
    buildReturnCancelBatch
  }
}
