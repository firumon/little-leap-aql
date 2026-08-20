/**
 * OutletConsumptions — the WORKFLOW CHAIN a consumption submit runs. Layer 2.
 *
 * A consumption is not one record; it is an atomic transaction across up to six resources,
 * two of which belong to OTHER domains. `buildConsumptionWorkflowChainRequests` below is
 * the single entry point that orchestrates all of it: it validates, builds this resource's
 * own writes, and delegates the visit and restock legs to their owning domains rather than
 * restating their schemas (UI_RESOURCE_DOMAIN_LOGIC.md §9.1).
 *
 * The core writes — the consumption, its lines, the outlet ledger, returns, the invoice —
 * live in `useConsumptionPayload.js` beside this file and are imported from it. The split
 * is purely file size (CORE_ARCHITECTURE_RULES §9); it is the same layer and the same
 * purity rules. The dependency runs ONE way — workflow → payload — so neither module's
 * initialisation order depends on the other's.
 *
 * PURE throughout — plain rows in, canonical request envelopes out. No refs, no injects,
 * no stores, nothing rendered (§9.6).
 */

import {
  resourceBulkRequest,
  executeActionRequest,
  resourceGetRequest
} from 'src/composables/resources/resourceRequests'
import {
  buildVisitCompletionChainRequests,
  buildNextVisitChainRequests
} from 'src/_resource/Operation/OutletVisits/composables/useVisitPayload'
import { buildRestockChainRequests } from 'src/_resource/Operation/OutletRestocks/composables/useRestockPayload'
import { toNumber, soldRowsOf, returnRowsOf, validateConsumption } from './useConsumptionStock'
import { CANCELLED, rejectableRestocks } from './useConsumptionProgress'
import {
  stampFields,
  buildConsumptionCompositeRequest,
  buildConsumptionMovementsRequest,
  buildReturnsRequests,
  buildReturnAdjustmentRequests,
  buildInvoiceRequests,
  restorableConsumptionLines,
  buildConsumptionReversalMovementsRequest
} from './useConsumptionPayload'

const CONSUMPTIONS = 'OutletConsumptions'
const CONSUMPTION_ITEMS = 'OutletConsumptionItems'
const INVOICES = 'OutletConsumptionInvoices'
const INVOICE_ITEMS = 'OutletConsumptionInvoiceItems'
const OUTLET_MOVEMENTS = 'OutletMovements'
const VISITS = 'OutletVisits'
const RESTOCKS = 'OutletRestocks'
const RESTOCK_ITEMS = 'OutletRestockItems'
const RETURNS = 'OutletReturns'
const OUTLET_STORAGES = 'OutletStorages'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const asList = (value) => (Array.isArray(value) ? value : [])
const isActive = (value) => text(asRow(value).Status || 'Active') === 'Active'

/**
 * Claim one action on one resource, keeping anything already claimed.
 *
 * Two legs of a chain routinely touch the SAME resource with DIFFERENT actions — this
 * submission completes one visit (`update`) and schedules another (`create`). A plain
 * overwrite would silently drop whichever ran first, and the batch would then execute a
 * write the user was never gated on. `allowed()` AND-s an array of actions for one
 * resource (`useResourceConfig.checkActionsList`), so the union is expressed as an array
 * and stays a single, comprehensive gate check (§9.3.4).
 */
function claim (permissions, resource, action) {
  const name = text(resource)
  const act = text(action)
  if (!name || !act) return permissions
  const existing = permissions[name]
  if (existing === undefined) {
    permissions[name] = act
    return permissions
  }
  const list = Array.isArray(existing) ? existing : [existing]
  if (!list.includes(act)) permissions[name] = [...list, act]
  return permissions
}

/** Union a child builder's whole permissions dictionary into the chain's (§9.3.4). */
function mergePermissions (permissions, incoming = {}) {
  Object.entries(asRow(incoming)).forEach(([resource, action]) => {
    (Array.isArray(action) ? action : [action]).forEach((one) => claim(permissions, resource, one))
  })
  return permissions
}

// ─── The master chain ─────────────────────────────────────────────────────────

/**
 * EVERY request one consumption submission sends, in dependency order.
 *
 * ── WHAT DECIDES THE SHAPE ──
 * NO CONSUMPTION IS WRITTEN WITHOUT A SALE. An `OutletConsumptions` row asserts a billable
 * event, so a header with no lines can never be invoiced or settled and would sit in
 * `PENDING_INVOICE_GENERATION` forever. A visit that only returned stock writes returns;
 * one that only raised a restock writes a restock; both still complete and schedule visits.
 * The batch's shape — and with it the success message and where the user lands — follows
 * from what actually happened.
 *
 * ── THE ORDER, AND WHY ──
 *   1. returns          FIRST: the invoice needs their codes to record what it credited.
 *   2. consumption      the header + sold lines, as one composite save.
 *   3. outlet ledger    the negative movement for what was consumed.
 *   4. invoice          bundling any earlier un-invoiced audits the user ticked.
 *   5. return settle    the returns credited against that invoice.
 *   6. visits           complete this one, plan the next — delegated to OutletVisits (§9.1).
 *   7. restock          the replenishment — delegated to OutletRestocks (§9.1).
 *   8. refresh          the balances this batch just invalidated (§9.5).
 *
 * Everything chained to the composite save carries `$ref:OutletConsumptions.latest.code`,
 * so nothing is split into a second round trip that could fail after the first committed.
 *
 * ── PERMISSIONS ──
 * NOTHING is unconditional. The map is a function of what the user actually chose, so a
 * plain stock count is not blocked by an invoice permission it never needed — and a direct
 * restock cannot proceed without the warehouse-movement permission it genuinely requires.
 * Child domains' permission maps are merged in (union), so Layer 3 performs ONE gate check
 * covering the whole chain (§9.3.4).
 *
 * ── THE `outcome` FIELD ──
 * Post-submit navigation reads a code out of the batch response by INDEX. Which index is
 * right depends on what was written: a restock-only submit has no consumption to open. The
 * indices are recorded as the batch is assembled rather than assumed from a fixed order,
 * and returned as contextual metadata for the caller's `onSuccess`.
 */
export function buildConsumptionWorkflowChainRequests ({
  form = {},
  countRows = [],
  actorName = '',
  // Stock & validation context
  outletStorages = [],
  warehouseStorages = [],
  operatingRules = [],
  // Returns
  returnMetaOf = () => ({}),
  returnRows = [],
  adjustedReturnCodes = [],
  // Invoicing
  generateInvoice = true,
  priceListCode = '',
  bundledConsumptionCodes = [],
  consumptionItems = [],
  discountType = 'FLAT',
  discountValue = 0,
  invoiceComment = '',
  calculateLineTax = null,
  // Per-SKU unit price overrides, as a resolver. Omitted, the price list decides.
  resolvePrice = null,
  // Restock
  restockRows = [],
  directRestock = false,
  warehouseCode = '',
  markDelivered = false,
  // Visits
  completeVisit = true,
  scheduleNext = true,
  // The cadence the officer confirmed on the last step. `null` falls back to the outlet's
  // configured visit frequency, which is every existing caller's behaviour.
  nextVisitDays = null
} = {}) {
  const entry = asRow(form)
  const sold = soldRowsOf(countRows)
  const returns = returnRowsOf(countRows)
  const hasSold = sold.length > 0
  const hasReturns = returns.length > 0
  const invoicing = hasSold && generateInvoice === true

  // 0. The full domain validation gate — the same one the wizard's step-2 `next` runs,
  //    now with `submitting` armed so the "at least one of the three" rule applies.
  const check = validateConsumption(entry, countRows, outletStorages, {
    generateInvoice: invoicing,
    priceListCode,
    directRestock: directRestock === true,
    warehouseCode,
    returnMetaOf,
    restockRows,
    submitting: true
  })
  if (!check.valid) return { valid: false, requests: [], permissions: {}, message: check.errors[0] }

  const adjustedCodes = asList(adjustedReturnCodes).map(text).filter(Boolean)
  const completingVisit = completeVisit === true && !!text(entry.OutletVisitCode)

  const permissions = {}
  const requests = []
  // Where each landmark request ended up, so post-submit navigation reads the right code.
  let returnsAt = -1
  let consumptionAt = -1
  let restockAt = -1

  // 1. Returns FIRST — the invoice below needs their codes to record what it credited.
  if (hasReturns) {
    returnsAt = requests.length
    requests.push(...buildReturnsRequests(entry, countRows, returnMetaOf, { priceListCode }))
    claim(permissions, RETURNS, 'create')
    // A return writes the outlet ledger too — the matrix decides the direction, and two of
    // its four cases move stock. Claimed whenever returns exist rather than only when a
    // movement survives the filter, so the gate does not depend on arithmetic the user can
    // change after it is evaluated.
    claim(permissions, OUTLET_MOVEMENTS, 'create')
  }

  // 2. The consumption and its sold lines — ONLY when something was consumed. Everything
  //    after this that carries a `$ref` chains off it, and every one of those is itself
  //    gated on a sale, so nothing can reference a header the batch did not write.
  if (hasSold) {
    consumptionAt = requests.length
    requests.push(buildConsumptionCompositeRequest(entry, countRows, actorName, { generateInvoice: invoicing }))
    claim(permissions, CONSUMPTIONS, 'create')
    claim(permissions, CONSUMPTION_ITEMS, 'create')

    // 3. The outlet ledger deduction.
    const movements = buildConsumptionMovementsRequest(entry, countRows)
    if (movements) {
      requests.push(movements)
      claim(permissions, OUTLET_MOVEMENTS, 'create')
    }
  }

  // 4. The invoice, bundling any earlier un-invoiced audits the user ticked. Its lines are
  //    the UNION of this audit's sales and every bundled audit's — resolved here, from the
  //    stored item rows, because deciding what belongs on the bill is a domain question.
  if (invoicing) {
    const bundled = asList(bundledConsumptionCodes).map(text).filter(Boolean)
    const bundledLines = bundled.flatMap((code) => asList(consumptionItems)
      .map(asRow)
      .filter((row) => text(row.OutletConsumptionCode) === code && isActive(row))
      .map((row) => ({ SKU: row.SKU, SoldQty: row.Qty })))

    const invoice = buildInvoiceRequests(entry, [...sold, ...bundledLines], {
      priceListCode,
      bundledConsumptionCodes: bundled,
      returnDeduction: returnDeductionOf(returnRows, adjustedCodes),
      discountType: text(discountType) || 'FLAT',
      discountValue: Number(discountValue) || 0,
      invoiceComment: text(invoiceComment),
      returnCodes: adjustedCodes,
      actorName,
      calculateLineTax,
      resolvePrice
    })
    // The engine ran once, inside the builder, and returned what it calculated. An invoice
    // with no priced lines is REFUSED rather than submitted empty: the batch would
    // otherwise create a zero-value invoice header and walk every bundled consumption to
    // INVOICE_GENERATED against it, leaving them permanently unbillable.
    if (!invoice.requests.length) {
      return { valid: false, requests: [], permissions: {}, message: 'Nothing on this invoice can be priced — check the price list.' }
    }
    requests.push(...invoice.requests)
    claim(permissions, INVOICES, 'create')
    claim(permissions, INVOICE_ITEMS, 'create')

    // 5. Settle the returns that were credited against it.
    if (adjustedCodes.length) {
      const selected = asList(returnRows).map(asRow).filter((row) => adjustedCodes.includes(text(row.Code)))
      requests.push(...buildReturnAdjustmentRequests(selected))
      claim(permissions, RETURNS, 'update')
    }
  }

  // 6. Close the visit this audit was made against, and plan the next one. BOTH delegated
  //    to OutletVisits' own domain builders — a visit's schema and cadence rule are not
  //    this module's to restate (§9.1). `refresh: false` because step 8 pulls the visits
  //    back once for the whole batch.
  if (completingVisit) {
    const completion = buildVisitCompletionChainRequests({ visitCode: entry.OutletVisitCode, actorName, refresh: false })
    if (!completion.valid) return { valid: false, requests: [], permissions: {}, message: completion.message }
    requests.push(...completion.requests)
    mergePermissions(permissions, completion.permissions)
  }
  if (scheduleNext === true) {
    const next = buildNextVisitChainRequests({ form: entry, frequencyDays: nextVisitDays, operatingRules, actorName, refresh: false })
    if (!next.valid) return { valid: false, requests: [], permissions: {}, message: next.message }
    requests.push(...next.requests)
    mergePermissions(permissions, next.permissions)
  }
  // Both visit legs claim the SAME resource key — completion `update`, scheduling `create`
  // — so a plain merge lets whichever ran last silently drop the other's claim. Completion
  // is restated here, after the merge, so a submission doing both is gated on the write it
  // actually performs against an EXISTING record rather than only on the create.
  if (completingVisit) claim(permissions, VISITS, 'update')

  // 7. Replenishment, in whichever mode step 1 and step 4 selected — delegated to
  //    OutletRestocks' own domain builder. With no sale there is no consumption header to
  //    point at; the link is provenance, not a dependency.
  const restock = buildRestockChainRequests({
    form: entry,
    lines: restockRows,
    mode: directRestock === true ? 'DIRECT' : 'PENDING_APPROVAL',
    warehouseCode,
    warehouseStorages,
    markDelivered: markDelivered === true,
    linkToConsumption: hasSold,
    actorName
  })
  if (!restock.valid) return { valid: false, requests: [], permissions: {}, message: restock.message }
  if (restock.requests.length) {
    restockAt = requests.length
    requests.push(...restock.requests)
    mergePermissions(permissions, restock.permissions)
    claim(permissions, RESTOCK_ITEMS, 'create')
  }

  // Nothing at all to write is not a submission. Reachable only if validation let an empty
  // audit through, which it should not — stated anyway rather than sending an empty batch.
  if (!requests.length) {
    return { valid: false, requests: [], permissions: {}, message: 'This visit recorded nothing to submit.' }
  }

  // 8. The batch just changed balances three other resources derive from. Pull them back
  //    in the same round trip rather than leaving the next page to find them stale (§9.5).
  requests.push(resourceGetRequest(['OutletStorages', 'WarehouseStorages', 'OutletVisits']))

  /**
   * What the user is told, and where they land.
   *
   * The default post-submit navigation reads the code off the FIRST request in the batch
   * and opens THIS resource's View page. That is right only when a consumption was
   * written; on a restock-only submit the first request is a visit action, and the user
   * would be sent to a consumption View for a record that does not exist.
   */
  const outcome = hasSold
    ? { message: 'Consumption recorded.', at: consumptionAt, slug: '' }
    : restockAt >= 0
      ? {
          message: hasReturns ? 'Returns and restock request recorded.' : 'Restock request created.',
          at: restockAt,
          slug: 'outlet-restocks'
        }
      : { message: 'Returns recorded.', at: returnsAt, slug: 'outlet-returns' }

  return { valid: true, requests, permissions, outcome, successMsg: outcome.message }
}

/** The monetary credit the ticked returns apply — read off the stored rows, not recomputed. */
function returnDeductionOf (returnRows = [], codes = []) {
  if (!codes?.length) return 0
  return asList(returnRows)
    .map(asRow)
    .filter((row) => codes.includes(text(row.Code)))
    .reduce((sum, row) => sum + toNumber(row.Qty) * toNumber(row.Price), 0)
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
 * THE OUTLET LEDGER IS REVERSED. A cancelled consumption is a consumption that never
 * happened, so the units it deducted are put back on the outlet's shelf with compensating
 * POSITIVE movements — one per SKU and storage, built by
 * `buildConsumptionReversalMovementsRequest` from the original ledger rows so the stock
 * lands back exactly where it was taken from. Without this, cancelling left the shelf
 * permanently short by an amount no later audit could account for.
 *
 * The reversal is derived from the SAME pure helper (`restorableConsumptionLines`) that the
 * cancellation review screen renders, so what the user is shown and what the batch writes
 * cannot disagree.
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

  // Put the consumed units back on the outlet's shelf. `options.consumptionItems` and
  // `options.outletMovements` are the sources the helper reads; when neither is supplied
  // nothing is restorable and no ledger request is added at all (never an empty bulk).
  const reversal = buildConsumptionReversalMovementsRequest(consumption, {
    items: options.consumptionItems,
    movements: options.outletMovements
  })
  if (reversal) requests.push(reversal)

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
    const lines = asList(restock.$OutletRestockItems).map(asRow).filter((line) => text(line.Code))
    if (lines.length) {
      requests.push(resourceBulkRequest(RESTOCK_ITEMS, lines.map((line) => ({ Code: text(line.Code), Status: 'Inactive' })), [RESTOCK_ITEMS]))
    }
  })

  // The cancellation changed data four other resources derive from. Pull them back in the
  // same round trip rather than leaving the next page to discover it stale.
  requests.push(resourceGetRequest([CONSUMPTIONS, INVOICES, RESTOCKS, OUTLET_STORAGES]))
  return requests
}

export { restorableConsumptionLines }

// Composable shape for setup-context callers. Same functions, one import (§5).
export function useConsumptionWorkflow () {
  return {
    buildConsumptionWorkflowChainRequests,
    buildCancellationRequests,
    restorableConsumptionLines
  }
}
