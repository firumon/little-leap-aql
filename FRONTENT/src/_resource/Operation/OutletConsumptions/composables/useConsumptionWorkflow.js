/**
 * OutletConsumptions — the WORKFLOW CHAIN a consumption submit runs. Layer 2.
 *
 * A consumption is not one record; it is an atomic transaction across up to six resources,
 * two of which belong to OTHER domains. `buildConsumptionWorkflowChainNodes` below is
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

import { textOrRef } from 'src/utils/appHelpers'
import {
  buildVisitCompletionChainNodes,
  buildNextVisitChainNodes
} from 'src/_resource/Operation/OutletVisits/composables/useVisitPayload'
import { buildRestockChainNodes, buildRestockRejectNodes } from 'src/_resource/Operation/OutletRestocks/composables/useRestockPayload'
import { buildCancellationNodes as buildInvoiceCancellationNodes } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoicePayload'
import { toNumber, soldRowsOf, returnRowsOf, validateConsumption } from './useConsumptionStock'
import { CANCELLED, rejectableRestocks } from './useConsumptionProgress'
import {
  stampFields,
  buildConsumptionCompositeNode,
  buildConsumptionMovementsNode,
  buildReturnsNodes,
  buildReturnAdjustmentNodes,
  buildInvoiceNodes,
  restorableConsumptionLines,
  buildConsumptionReversalMovementsNode
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
 *   4. invoice          the bill for what sold on this visit.
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
 * `outcome` names the RESOURCE whose code post-submit navigation should open. A
 * restock-only submit has no consumption to open, so the caller cannot assume a position.
 */
export function buildConsumptionWorkflowChainNodes ({
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
  dueDate = '',
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
  completeComment = '',
  scheduleNext = true,
  // The cadence the officer confirmed on the last step. `null` falls back to the outlet's
  // configured visit frequency, which is every existing caller's behaviour.
  nextVisitDays = null,
  // The next-visit answers as the page already holds them, so a date or comment the
  // officer typed survives the rebuild instead of being recalculated over.
  nextVisit = {},
  // The wizard rebuilds this chain on every answer to keep its nodes live. In draft mode
  // the submit-only gates are off, so a half-filled wizard still gets the nodes it can.
  draft = false
} = {}) {
  const entry = asRow(form)
  const sold = soldRowsOf(countRows)
  const returns = returnRowsOf(countRows)
  const hasSold = sold.length > 0
  const hasReturns = returns.length > 0
  const invoicing = hasSold && generateInvoice === true

  // 0. The full domain validation gate — the same one the wizard's step-2 `next` runs,
  //    now with `submitting` armed so the "at least one of the three" rule applies.
  if (!draft) {
    const check = validateConsumption(entry, countRows, outletStorages, {
      generateInvoice: invoicing,
      priceListCode,
      directRestock: directRestock === true,
      warehouseCode,
      returnMetaOf,
      restockRows,
      submitting: true
    })
    if (!check.valid) return [{ valid: false, message: check.errors[0] }]
  }

  const adjustedCodes = asList(adjustedReturnCodes).map(text).filter(Boolean)
  const completingVisit = completeVisit === true && !!text(entry.OutletVisitCode)

  const nodes = []
  // Which resources this submission actually wrote, so post-submit navigation can find
  // the right code in the response without depending on a position.
  let wroteReturns = false
  let wroteConsumption = false
  let wroteRestock = false

  // 1. Returns FIRST — the invoice below needs their codes to record what it credited.
  if (hasReturns) {
    wroteReturns = true
    nodes.push(...buildReturnsNodes(entry, countRows, returnMetaOf, { priceListCode }))
    // A return writes the outlet ledger too — the matrix decides the direction, and two of
    // its four cases move stock. Claimed whenever returns exist rather than only when a
    // movement survives the filter, so the gate does not depend on arithmetic the user can
    // change after it is evaluated.
  }

  // 2. The consumption and its sold lines — ONLY when something was consumed. Everything
  //    after this that carries a `$ref` chains off it, and every one of those is itself
  //    gated on a sale, so nothing can reference a header the batch did not write.
  if (hasSold) {
    wroteConsumption = true
    nodes.push(buildConsumptionCompositeNode(entry, countRows, actorName, { generateInvoice: invoicing }))

    // 3. The outlet ledger deduction.
    const movements = buildConsumptionMovementsNode(entry, countRows)
    if (movements) {
      nodes.push(movements)
    }
  }

  // 4. The invoice for this audit's sales.
  if (invoicing) {
    const invoice = buildInvoiceNodes(entry, sold, {
      priceListCode,
      dueDate: text(dueDate),
      returnDeduction: returnDeductionOf(returnRows, adjustedCodes),
      discountType: text(discountType) || 'FLAT',
      discountValue: Number(discountValue) || 0,
      invoiceComment: text(invoiceComment),
      returnCodes: adjustedCodes,
      actorName,
      calculateLineTax,
      resolvePrice
    })
    // An invoice with no priced lines is REFUSED, not submitted empty: the batch would
    // create a zero-value header and mark the consumption invoiced against it, leaving it
    // permanently unbillable.
    if (!invoice.length && !draft) {
      return [{ valid: false, message: 'Nothing on this invoice can be priced — check the price list.' }]
    }
    nodes.push(...invoice)
    // 5. Settle the returns that were credited against it.
    if (adjustedCodes.length) {
      const selected = asList(returnRows).map(asRow).filter((row) => adjustedCodes.includes(text(row.Code)))
      nodes.push(...buildReturnAdjustmentNodes(selected))
    }
  }

  // 6. Close the visit this audit was made against, and plan the next one. BOTH delegated
  //    to OutletVisits' own domain builders — a visit's schema and cadence rule are not
  //    this module's to restate (§9.1). `refresh: false` because step 8 pulls the visits
  //    back once for the whole batch.
  // A visit being closed plans its successor through the Complete action's own
  // `nextVisit` target, so the two land as one workflow rather than as two records.
  const plansOnCompletion = completingVisit && scheduleNext === true
  if (completingVisit) {
    const completion = buildVisitCompletionChainNodes({
      visitCode: entry.OutletVisitCode,
      actorName,
      comment: text(completeComment),
      nextVisit: plansOnCompletion ? nextVisit : {},
      refresh: false
    })
    if (completion[0]?.valid === false && !draft) return completion
    nodes.push(...completion)
  }
  if (scheduleNext === true && !plansOnCompletion) {
    const next = buildNextVisitChainNodes({
      form: entry, frequencyDays: nextVisitDays, operatingRules, actorName, visit: nextVisit, refresh: false })
    if (next[0]?.valid === false && !draft) return next
    nodes.push(...next)
  }

  // 7. Replenishment, in whichever mode step 1 and step 4 selected — delegated to
  //    OutletRestocks' own domain builder. With no sale there is no consumption header to
  //    point at; the link is provenance, not a dependency.
  const restock = buildRestockChainNodes({
    form: entry,
    lines: restockRows,
    mode: directRestock === true ? 'DIRECT' : 'PENDING_APPROVAL',
    warehouseCode,
    warehouseStorages,
    markDelivered: markDelivered === true,
    linkToConsumption: hasSold,
    actorName
  })
    if (restock[0]?.valid === false && !draft) return restock
  if (restock.length) {
    wroteRestock = true
    nodes.push(...restock)
  }

  // Nothing at all to write is not a submission. Reachable only if validation let an empty
  // audit through, which it should not — stated anyway rather than sending an empty batch.
  if (!nodes.length) {
    return draft ? [] : [{ valid: false, message: 'This visit recorded nothing to submit.' }]
  }

  // 8. The batch just changed balances three other resources derive from. Pull them back
  //    in the same round trip rather than leaving the next page to find them stale (§9.5).
  nodes.push({ resource: '$batch', reload: ['OutletStorages', 'WarehouseStorages', 'OutletVisits'] })

  /**
   * What the user is told, and where they land.
   *
   * The default post-submit navigation reads the code off the FIRST request in the batch
   * and opens THIS resource's View page. That is right only when a consumption was
   * written; on a restock-only submit the first request is a visit action, and the user
   * would be sent to a consumption View for a record that does not exist.
   */
  const outcome = hasSold && wroteConsumption
    ? { message: 'Consumption recorded.', resource: CONSUMPTIONS, slug: '' }
    : wroteRestock
      ? {
          message: hasReturns ? 'Returns and restock request recorded.' : 'Restock request created.',
          resource: RESTOCKS,
          slug: 'outlet-restocks'
        }
      : { message: 'Returns recorded.', resource: wroteReturns ? RETURNS : '', slug: 'outlet-returns' }

  // `outcome` and `successMsg` ride on the first node; applyNodes hands them back so the
  // page knows what to say and where to land.
  return [{ ...nodes[0], outcome, successMsg: outcome.message }, ...nodes.slice(1)]
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
 * `buildConsumptionReversalMovementsNode` from the original ledger rows so the stock
 * lands back exactly where it was taken from. Without this, cancelling left the shelf
 * permanently short by an amount no later audit could account for.
 *
 * The reversal is derived from the SAME pure helper (`restorableConsumptionLines`) that the
 * cancellation review screen renders, so what the user is shown and what the batch writes
 * cannot disagree.
 */
export function buildConsumptionCancellationNodes (record = {}, reason = '', options = {}) {
  const consumption = asRow(record)
  const code = text(consumption.Code)
  if (!code) return [{ valid: false, message: 'This consumption could not be identified.' }]

  const actorName = text(options.actorName)
  const invoice = asRow(options.invoice)
  const cascadeNote = `Cancelled as a dependent of outlet consumption ${code}${actorName ? ` by ${actorName}` : ''}.`

  const nodes = [{
    resource: CONSUMPTIONS,
    permissions: { CancelConsumption: 'You are not allowed to cancel this consumption.' },
    actions: [{
      action: 'CancelConsumption',
      column: 'Progress',
      columnValue: CANCELLED,
      code: textOrRef(code),
      data: { fields: stampFields('ProgressCancelled', actorName, text(reason)) }
    }],
    reload: [CONSUMPTIONS],
    successMsg: 'Consumption cancelled.'
  }]

  // Put the consumed units back on the outlet's shelf. `options.consumptionItems` and
  // `options.outletMovements` are the sources the helper reads; when neither is supplied
  // nothing is restorable and no ledger request is added at all (never an empty bulk).
  const reversal = buildConsumptionReversalMovementsNode(consumption, {
    items: options.consumptionItems,
    movements: options.outletMovements
  })
  if (reversal) nodes.push(reversal)


  // The invoice cancels itself. `releaseConsumptions: false` because THIS consumption is
  // what is being cancelled - walking it back to invoiceable would undo that.
  const invoiceCode = text(invoice.Code)
  const invoiceProgress = text(invoice.Progress).toUpperCase()
  if (invoiceCode && invoiceProgress !== 'PAID' && invoiceProgress !== CANCELLED) {
    const cancelled = buildInvoiceCancellationNodes({
      record: invoice,
      comment: cascadeNote,
      actorName,
      returnRows: options.invoiceReturnRows || [],
      taxTransactionRows: options.invoiceTaxRows || null,
      releaseConsumptions: false
    })
    nodes.push(...cancelled)
  }

  // Each restock rejects itself. `rejectableRestocks` has already excluded anything that
  // moved stock, so the reject builder's reversal leg is empty by construction.
  rejectableRestocks(options.restocks).forEach((restock) => {
    const rejected = buildRestockRejectNodes(
      restock,
      asList(restock.$OutletRestockItems),
      actorName,
      cascadeNote,
      { role: text(restock.Code) }
    )
    nodes.push(...rejected)
  })

  // The cancellation changed data four other resources derive from. Pull them back in the
  // same round trip rather than leaving the next page to discover it stale.
  nodes.push({ resource: '$batch', reload: [CONSUMPTIONS, INVOICES, RESTOCKS, OUTLET_STORAGES] })

  return nodes
}

export { restorableConsumptionLines }

// Composable shape for setup-context callers. Same functions, one import (§5).
export function useConsumptionWorkflow () {
  return {
    buildConsumptionWorkflowChainNodes,
    buildConsumptionCancellationNodes,
    restorableConsumptionLines
  }
}
