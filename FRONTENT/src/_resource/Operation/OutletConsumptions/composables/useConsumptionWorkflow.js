// OutletConsumptions submit chain. Layer 2. One submit writes across up to six resources;
// the visit and restock legs are delegated to the domains that own them (§9.1).
// Cancellation lives in useConsumptionCancel.js, the live Add draft in useConsumptionDraft.js.

import {
  buildVisitCompletionChainNodes,
  buildNextVisitChainNodes
} from 'src/_resource/Operation/OutletVisits/composables/useVisitPayload'
import { buildRestockChainNodes } from 'src/_resource/Operation/OutletRestocks/composables/useRestockPayload'
import { toNumber, soldRowsOf, returnRowsOf, validateConsumption } from './useConsumptionStock'
import {
  consumptionCompositeNode,
  buildConsumptionMovementsNode,
  buildReturnsNodes,
  buildReturnAdjustmentNodes,
  buildInvoiceNodes
} from './useConsumptionPayload'

const CONSUMPTIONS = 'OutletConsumptions'
const RESTOCKS = 'OutletRestocks'
const RETURNS = 'OutletReturns'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const asList = (value) => (Array.isArray(value) ? value : [])

// Order: returns, consumption + lines, outlet ledger, invoice, return settle, visits,
// restock, refresh. Returns come first because the invoice needs their codes.
// In draft mode the submit gates still run but do not stop the build; the first complaint
// rides back on node one as `chainBlock`, so submit never rebuilds the batch to find it.
export function buildConsumptionWorkflowChainNodes ({
  form = {},
  countRows = [],
  actorName = '',
  outletStorages = [],
  warehouseStorages = [],
  operatingRules = [],
  returnMetaOf = () => ({}),
  returnRows = [],
  adjustedReturnCodes = [],
  generateInvoice = true,
  priceListCode = '',
  dueDate = '',
  discountType = 'FLAT',
  discountValue = 0,
  invoiceComment = '',
  calculateLineTax = null,
  // Per-SKU unit price overrides, as a resolver. Omitted, the price list decides.
  resolvePrice = null,
  restockRows = [],
  directRestock = false,
  warehouseCode = '',
  markDelivered = false,
  completeVisit = true,
  completeComment = '',
  scheduleNext = true,
  // `null` falls back to the outlet's configured visit frequency.
  nextVisitDays = null,
  nextVisit = {},
  draft = false
} = {}) {
  const entry = asRow(form)
  const sold = soldRowsOf(countRows)
  const returns = returnRowsOf(countRows)
  const hasSold = sold.length > 0
  const hasReturns = returns.length > 0
  const invoicing = hasSold && generateInvoice === true

  // The submit-only gates. Collected in draft mode, fatal at submit.
  const blocks = []
  const block = (message, veto) => {
    blocks.push(message)
    return draft ? null : (veto || [{ valid: false, message }])
  }

  const check = validateConsumption(entry, countRows, outletStorages, {
    generateInvoice: invoicing,
    priceListCode,
    resolvePrice,
    directRestock: directRestock === true,
    warehouseCode,
    returnMetaOf,
    restockRows,
    submitting: true
  })
  if (!check.valid) {
    const stop = block(check.errors[0])
    if (stop) return stop
  }

  const adjustedCodes = asList(adjustedReturnCodes).map(text).filter(Boolean)
  const completingVisit = completeVisit === true && !!text(entry.OutletVisitCode)

  const nodes = []
  let wroteReturns = false
  let wroteConsumption = false
  let wroteRestock = false

  // 1. Returns FIRST — the invoice below needs their codes to record what it credited.
  if (hasReturns) {
    const built = buildReturnsNodes(entry, countRows, returnMetaOf, { priceListCode })
    if (built[0]?.valid === false) {
      const stop = block(built[0].message || 'Return lines could not be built.', built)
      if (stop) return stop
    } else {
      wroteReturns = true
      nodes.push(...built)
    }
  }

  // 2. The consumption and its sold lines — ONLY when something was consumed. Everything
  //    after this that carries a `$ref` chains off it.
  if (hasSold) {
    wroteConsumption = true
    nodes.push(consumptionCompositeNode(entry, sold.map((row) => ({
      SKU: text(row.SKU),
      Qty: toNumber(row.SoldQty),
      Status: 'Active'
    })), { actorName, generateInvoice: invoicing }))

    // 3. The outlet ledger deduction.
    const movements = buildConsumptionMovementsNode(entry, countRows)
    if (movements) nodes.push(movements)
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
    // create a zero-value header and mark the consumption invoiced against it.
    if (!invoice.length) {
      const stop = block('Nothing on this invoice can be priced — check the price list.')
      if (stop) return stop
    } else {
      nodes.push(...invoice)
      // 5. Settle the returns that were credited against it.
      if (adjustedCodes.length) {
        const selected = asList(returnRows).map(asRow).filter((row) => adjustedCodes.includes(text(row.Code)))
        nodes.push(...buildReturnAdjustmentNodes(selected))
      }
    }
  }

  // 6. Close the visit this audit was made against, and plan the next one. BOTH delegated
  //    to OutletVisits (§9.1). A visit being closed plans its successor through the
  //    Complete action's own `nextVisit` target, so the two land as one workflow.
  const plansOnCompletion = completingVisit && scheduleNext === true
  if (completingVisit) {
    const completion = buildVisitCompletionChainNodes({
      visitCode: entry.OutletVisitCode,
      actorName,
      comment: text(completeComment),
      nextVisit: plansOnCompletion ? nextVisit : {},
      refresh: false
    })
    if (completion[0]?.valid === false) {
      const stop = block(completion[0].message || 'This visit cannot be completed.', completion)
      if (stop) return stop
    } else nodes.push(...completion)
  }
  if (scheduleNext === true && !plansOnCompletion) {
    const next = buildNextVisitChainNodes({
      form: entry, frequencyDays: nextVisitDays, operatingRules, actorName, visit: nextVisit, refresh: false })
    if (next[0]?.valid === false) {
      const stop = block(next[0].message || 'The next visit cannot be planned.', next)
      if (stop) return stop
    } else nodes.push(...next)
  }

  // 7. Replenishment, in whichever mode step 1 and step 4 selected — delegated to
  //    OutletRestocks. With no sale there is no consumption header to point at; the link is
  //    provenance, not a dependency.
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
  if (restock[0]?.valid === false) {
    // A half-answered restock is normal mid-wizard. Dropping it keeps the rest of the
    // chain alive; at submit the same refusal is returned instead.
    const stop = block(restock[0].message || 'This restock cannot be raised.', restock)
    if (stop) return stop
  } else if (restock.length) {
    wroteRestock = true
    nodes.push(...restock)
  }

  if (!nodes.length) {
    const stop = block('This visit recorded nothing to submit.')
    if (stop) return stop
    return []
  }

  // 8. The batch just changed balances three other resources derive from. Pull them back in
  //    the same round trip rather than leaving the next page to find them stale (§9.5).
  nodes.push({ resource: '$batch', reload: ['OutletStorages', 'WarehouseStorages', 'OutletVisits'] })

  // `outcome` names the RESOURCE post-submit navigation should open. A restock-only submit
  // has no consumption to open, so the caller cannot assume a position.
  const outcome = hasSold && wroteConsumption
    ? { message: 'Consumption recorded.', resource: CONSUMPTIONS, slug: '' }
    : wroteRestock
      ? {
          message: hasReturns ? 'Returns and restock request recorded.' : 'Restock request created.',
          resource: RESTOCKS,
          slug: 'outlet-restocks'
        }
      : { message: 'Returns recorded.', resource: wroteReturns ? RETURNS : '', slug: 'outlet-returns' }

  // `outcome` and `successMsg` ride on the first node; applyNodes hands them back.
  return [
    {
      ...nodes[0],
      outcome,
      successMsg: outcome.message,
      ...(draft ? { chainBlock: blocks[0] || '' } : {})
    },
    ...nodes.slice(1)
  ]
}

/** The monetary credit the ticked returns apply — read off the stored rows, not recomputed. */
function returnDeductionOf (returnRows = [], codes = []) {
  if (!codes?.length) return 0
  return asList(returnRows)
    .map(asRow)
    .filter((row) => codes.includes(text(row.Code)))
    .reduce((sum, row) => sum + toNumber(row.Qty) * toNumber(row.Price), 0)
}

// Composable shape for setup-context callers. Same functions, one import (§5).
export function useConsumptionWorkflow () {
  return { buildConsumptionWorkflowChainNodes }
}
