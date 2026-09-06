// The live Add draft for OutletConsumptions. Layer 2. The wizard's nodes ARE the batch:
// the UI writes one column, the derives here regenerate every consequence, and submit only
// validates (UI_PAGE_STATE_NODES.md §5.7A–§5.7D).

import { useDataStore } from 'src/stores/data'
import { useAuth } from 'src/composables/core/useAuth'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { toNumber, countRowsOf, positiveRows } from './useConsumptionStock'
import { consumptionCompositeNode, buildConsumptionMovementsNode } from './useConsumptionPayload'
import { buildConsumptionWorkflowChainNodes } from './useConsumptionWorkflow'
import { makeLineTaxResolver } from './useConsumptionInvoice'
import { returnsNode } from 'src/_resource/Operation/OutletReturns/composables/useReturnPayload'
import { RESTOCK_CONTROL, restockNode } from 'src/_resource/Operation/OutletRestocks/composables/useRestockPayload'
import { buildRestockMovementNodes } from 'src/_resource/Operation/OutletRestocks/composables/useRestockCreation'
import {
  INVOICE_DOCUMENT_COMPANIONS,
  invoiceNodeForConsumption,
  makeInvoiceLinePriceResolver
} from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoicePayload'
import { OUTLET_ROLE } from 'src/_resource/Operation/OutletMovements/composables/useOutletMovementPayload'
import { visitFrequencyFor, visitDateFrom } from 'src/_resource/Operation/OutletVisits/composables/useVisitCadence'
import { useOutletStorageResource } from 'src/_resource/Operation/OutletStorages/composables/useOutletStorageResource'

const CONSUMPTIONS = 'OutletConsumptions'
const CONSUMPTION_ITEMS = 'OutletConsumptionItems'
const INVOICES = 'OutletConsumptionInvoices'
const INVOICE_ITEMS = 'OutletConsumptionInvoiceItems'
const OUTLET_MOVEMENTS = 'OutletMovements'
const VISITS = 'OutletVisits'
const RESTOCKS = 'OutletRestocks'
const RESTOCK_ITEMS = 'OutletRestockItems'
const RETURNS = 'OutletReturns'
const STOCK_MOVEMENTS = 'StockMovements'

/** The next visit is its own record beside the consumption, so it needs its own role. */
export const CONSUMPTION_ROLE = { NEXT: 'next' }

/** Working state only — never a sheet column. Each names the node it belongs to. */
export const CONSUMPTION_CONTROL = {
  INVOICING: { header: 'invoicing' },
  RESTOCKING: { header: 'restocking' },
  DIRECT_RESTOCK: { header: RESTOCK_CONTROL.DIRECT, resource: RESTOCKS },
  WAREHOUSE: { header: RESTOCK_CONTROL.WAREHOUSE, resource: RESTOCKS },
  MARK_DELIVERED: { header: RESTOCK_CONTROL.DELIVER, resource: RESTOCKS },
  DISCOUNT_TYPE: { header: 'DiscountType', resource: INVOICES },
  DISCOUNT_VALUE: { header: 'DiscountValue', resource: INVOICES },
  INVOICE_COMMENT: { header: 'InvoiceComment', resource: INVOICES },
  ADJUSTED_RETURNS: { header: 'AdjustedReturnCodes' },
  COMPLETE_VISIT: { header: 'CompleteVisit' },
  SCHEDULE_NEXT: { header: 'ScheduleNextVisit' },
  NEXT_VISIT_DAYS: { header: 'NextVisitDays' },
  NEXT_VISIT_COMMENT: { header: 'NextVisitComment' }
}

/** One literal for both the toggle that queues the action and the chain that rebuilds it. */
export const VISIT_COMPLETE_COMMENT = 'Completed along with consumption'

// The action system derives this header from the column and outcome.
export const VISIT_COMPLETE_COMMENT_FIELD = 'ProgressCompletedComment'

/** What the live chain handed back, for submit to report and to land on. */
export const CHAIN_SUCCESS = 'ChainSuccessMsg'
export const CHAIN_OUTCOME = 'ChainOutcome'

/** The chain's submit verdict, evaluated on every stroke so submit rebuilds nothing. */
export const CHAIN_BLOCK = 'ChainBlock'

const CTL = CONSUMPTION_CONTROL

const text = (value) => (value == null ? '' : String(value).trim())
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)
const unset = (value) => value === null || value === undefined || value === ''
const isTrue = (value) => text(value).toUpperCase() === 'TRUE'

const getCtl = (pageState, ctl, fallback = null) =>
  pageState.getControls(ctl.header, fallback, ctl.resource)

const storeRows = (name) => useDataStore().getRecords(name) || []

const allowedTo = (resource, action) => useResourceConfig(resource).allowed(action) === true

const soldItemsOf = (pageState) =>
  positiveRows(pageState.getChildRows(CONSUMPTION_ITEMS, CONSUMPTIONS))

const returnItemsOf = (pageState) =>
  positiveRows(pageState.getRecordRows(RETURNS))

const restockItemsOf = (pageState) =>
  positiveRows(pageState.getChildRows(RESTOCK_ITEMS, RESTOCKS), 'Quantity')

/** One stored return row, in the shape the Layer 2 return builder reads it. */
function returnMetaFrom (row) {
  return {
    Reason: text(row?.Reason) || 'DAMAGE',
    ReasonComment: text(row?.ReasonComment),
    SourceInvoiceCode: text(row?.SourceInvoiceCode),
    Price: unset(row?.Price) ? null : toNumber(row.Price),
    InvoiceAdjustmentRequired: isTrue(row?.InvoiceAdjustmentRequired),
    WarehouseActionRequired: isTrue(row?.WarehouseActionRequired),
    WarehouseCode: text(row?.WarehouseCode)
  }
}

// The next visit's answers. Both the scheduling card and the completion card read them.
export function nextVisitPlan (pageState, operatingRules = []) {
  const record = pageState.getRecord(null, CONSUMPTIONS) || {}
  const outletCode = text(record.OutletCode)
  // The audit's own date is day zero — the same base the visit domain counts from.
  const base = text(record.Date) || new Date().toISOString().slice(0, 10)

  const frequency = visitFrequencyFor(outletCode, operatingRules)
  const storedDays = getCtl(pageState, CTL.NEXT_VISIT_DAYS)
  const days = unset(storedDays) ? num(frequency) : num(storedDays)

  const storedComment = getCtl(pageState, CTL.NEXT_VISIT_COMMENT)
  const comment = storedComment === null
    ? `Planned after consumption on ${base}`
    : text(storedComment)

  // 0 days plans nothing, but is a legitimate thing to type on the way to another number.
  const date = days > 0 ? visitDateFrom(base, days) : ''
  const wanted = getCtl(pageState, CTL.SCHEDULE_NEXT, true) === true

  return { outletCode, base, frequency, days, date, comment, wanted, willSchedule: wanted && !!date }
}

/** Every answer the master chain takes, read straight off the live nodes. */
function chainInputs (pageState) {
  const form = pageState.getRecord(null, CONSUMPTIONS) || {}
  const outletStorages = storeRows('OutletStorages')
  const invoiceRecord = pageState.getRecord(null, INVOICES) || {}
  const priceListCode = text(invoiceRecord.PriceListCode)
  const resolvePrice = makeInvoiceLinePriceResolver(pageState.getChildRows(INVOICE_ITEMS, INVOICES))

  const sold = soldItemsOf(pageState)
  const returned = returnItemsOf(pageState)
  const returnBySku = new Map(returned.map((row) => [text(row.SKU), row]))

  const restocking = pageState.hasNode(RESTOCKS) && getCtl(pageState, CTL.RESTOCKING, true) === true
  const directRestock = restocking && getCtl(pageState, CTL.DIRECT_RESTOCK, false) === true
  const plan = nextVisitPlan(pageState, storeRows('OutletOperatingRules'))
  const completingVisit = getCtl(pageState, CTL.COMPLETE_VISIT, true) === true &&
    !!text(form.OutletVisitCode)

  return {
    form,
    countRows: countRowsOf(sold, returned, outletStorages, text(form.OutletCode)),
    actorName: text(form.Username),
    outletStorages,
    warehouseStorages: storeRows('WarehouseStorages'),
    operatingRules: storeRows('OutletOperatingRules'),
    returnRows: storeRows('OutletReturns'),
    returnMetaOf: (sku) => returnMetaFrom(returnBySku.get(text(sku))),
    adjustedReturnCodes: (getCtl(pageState, CTL.ADJUSTED_RETURNS, []) || []).map(text).filter(Boolean),
    generateInvoice: pageState.hasNode(INVOICES) && getCtl(pageState, CTL.INVOICING, true) === true,
    priceListCode,
    dueDate: text(invoiceRecord.DueDate),
    discountType: text(getCtl(pageState, CTL.DISCOUNT_TYPE)) || 'FLAT',
    discountValue: toNumber(getCtl(pageState, CTL.DISCOUNT_VALUE, 0)),
    invoiceComment: text(getCtl(pageState, CTL.INVOICE_COMMENT)),
    calculateLineTax: makeLineTaxResolver({ priceListCode, resolvePrice }),
    resolvePrice,
    restockRows: restocking ? restockItemsOf(pageState) : [],
    directRestock,
    warehouseCode: directRestock ? text(getCtl(pageState, CTL.WAREHOUSE)) : '',
    markDelivered: directRestock && getCtl(pageState, CTL.MARK_DELIVERED, false) === true,
    completeVisit: completingVisit,
    completeComment: text(pageState.getActions(
      'Complete', `fields.${VISIT_COMPLETE_COMMENT_FIELD}`, VISITS)) || VISIT_COMPLETE_COMMENT,
    // The PLAN, not the node: a plan riding on Complete's own target has no node.
    scheduleNext: plan.willSchedule,
    nextVisit: pageState.hasNode(VISITS, CONSUMPTION_ROLE.NEXT)
      ? (pageState.getRecord(null, VISITS, CONSUMPTION_ROLE.NEXT) || {})
      : {
          OutletCode: text(form.OutletCode),
          Date: plan.date,
          ProgressPlannedComment: plan.comment,
          Username: text(form.Username)
        },
    nextVisitDays: plan.days
  }
}

// The outlet's own shelf becomes the count sheet: one child per SKU it holds, starting at
// zero. A different outlet is a different sheet, so what was found at the last one goes.
export function applyConsumptionOutlet (outletCode, pageState) {
  const code = text(outletCode)
  if (!code) return
  const lines = positiveRows(useOutletStorageResource().stockRowsOf(code), 'Quantity')
    .map((row) => ({ SKU: text(row.SKU), Qty: 0 }))

  pageState.applyNodes(consumptionCompositeNode({ ...(pageState.getRecord(null, CONSUMPTIONS) || {}) }, lines))
  pageState.removeNode(RETURNS)
  pageState.removeNode(RESTOCKS)
}

// The invoice node's EXISTENCE is the answer to "does this visit also bill", so one
// function both raises it and drops it.
function syncInvoiceNode (pageState) {
  const wanted = getCtl(pageState, CTL.INVOICING, true) === true && allowedTo(INVOICES, 'create')
  const sold = soldItemsOf(pageState)
  if (!wanted || !sold.length) return dropInvoiceNodes(pageState)
  if (!pageState.hasNode(INVOICES)) seedConsumptionInvoice(pageState, sold)
}

// The tax rows `$ref` the invoice's code, so they cannot outlive it. `applyNodes` only ever
// adds or replaces, so a leg the answer retired has to be taken out by hand.
export function dropInvoiceNodes (pageState) {
  pageState.removeNode(INVOICES)
  for (const at of INVOICE_DOCUMENT_COMPANIONS) pageState.removeNode(at.resource, at.role)
}

function enforceToggles (pageState) {
  syncInvoiceNode(pageState)
  if (getCtl(pageState, CTL.RESTOCKING, true) !== true) pageState.removeNode(RESTOCKS)
  const completing = getCtl(pageState, CTL.COMPLETE_VISIT, true) === true &&
    !!text(pageState.getRecord('OutletVisitCode', CONSUMPTIONS))
  if (!completing) pageState.excludeAdditionalAction('Complete', { resource: VISITS })
}

// The two ledgers, kept live. Same builders the chain uses, so the preview cannot drift.
function syncLedgerNodes (pageState) {
  const form = pageState.getRecord(null, CONSUMPTIONS) || {}
  const outletCode = text(form.OutletCode)

  const apply = (resource, role, node) => {
    if (node) pageState.applyNodes([node])
    else pageState.removeNode(resource, role)
  }

  const countRows = countRowsOf(soldItemsOf(pageState), returnItemsOf(pageState),
    storeRows('OutletStorages'), outletCode)
  apply(OUTLET_MOVEMENTS, OUTLET_ROLE.SALE,
    outletCode ? buildConsumptionMovementsNode(form, countRows) : null)

  const items = restockItemsOf(pageState)
  const restocking = pageState.hasNode(RESTOCKS) && getCtl(pageState, CTL.RESTOCKING, true) === true

  const movements = restocking && outletCode && items.length
    ? buildRestockMovementNodes({
      outletCode,
      warehouseCode: text(getCtl(pageState, CTL.WAREHOUSE, '')),
      date: text(form.Date),
      items,
      direct: getCtl(pageState, CTL.DIRECT_RESTOCK, false) === true,
      deliver: getCtl(pageState, CTL.MARK_DELIVERED, false) === true
    })
    : []

  apply(STOCK_MOVEMENTS, null, movements.find((node) => node.resource === STOCK_MOVEMENTS) || null)
  apply(OUTLET_MOVEMENTS, OUTLET_ROLE.DELIVERY,
    movements.find((node) => node.resource === OUTLET_MOVEMENTS) || null)
}

/** `ProgressCompletedAt`, `ProgressPlannedBy`, `ProgressInvoiceGeneratedComment`, … */
const WORKFLOW_STAMP_KEY = /^Progress[A-Za-z]*(At|By|Comment)$/

// Every answer re-derives the whole batch, so submit only validates. The digest stops the
// loop, since the builder rewrites the nodes it reads.
let lastDigest = ''

export function syncConsumptionChain (pageState) {
  enforceToggles(pageState)
  if (!soldItemsOf(pageState).length && !returnItemsOf(pageState).length) return

  const args = chainInputs(pageState)
  const digest = JSON.stringify(args, (key, value) => {
    if (typeof value === 'function') return undefined
    // The chain STAMPS the same record it reads its inputs from, and every stamp carries a
    // fresh `new Date()`. Left in, the rebuild loops until Vue gives up.
    if (WORKFLOW_STAMP_KEY.test(key)) return undefined
    return value
  })
  if (digest === lastDigest) return

  // DRAFT mode while the wizard is being answered: the submit-only gates run but do not
  // stop the build, so a half-filled wizard still gets the nodes it can.
  const nodes = buildConsumptionWorkflowChainNodes({ ...args, draft: true })
  if (!Array.isArray(nodes) || nodes.some((node) => node?.valid === false)) return

  // The verdict rides on node one. Read and stripped here, so it never reaches a payload.
  const { chainBlock = '', ...first } = nodes[0] || {}
  const applied = pageState.applyNodes(nodes.length ? [first, ...nodes.slice(1)] : nodes)
  if (applied.valid === false) return
  // Latched ONLY on success: latching before the apply froze the chain for the rest of the
  // wizard whenever one pass failed.
  lastDigest = digest

  // Nothing sold means no consumption row to write. The node's EXISTENCE is the answer.
  if (!soldItemsOf(pageState).length) pageState.removeNode(CONSUMPTIONS)
  enforceToggles(pageState)

  pageState.setControls(CHAIN_SUCCESS, applied.successMsg || 'Consumption recorded.')
  pageState.setControls(CHAIN_OUTCOME, applied.outcome || null)
  pageState.setControls(CHAIN_BLOCK, chainBlock)
}

// Every consequence the Add page has. The UI writes one column; the rest is regenerated
// here, so the live nodes are always exactly the batch that would be sent.
export function consumptionDraftDerivations () {
  // ONE entry per source address. Two entries watching the same address collide in the
  // derive registry and only one survives.
  const chain = (value, api) => syncConsumptionChain(api)
  const both = (value, api) => { syncLedgerNodes(api); syncConsumptionChain(api) }

  return [
    // The count sheet follows the outlet. `immediate` so a deep link that arrives with an
    // outlet already chosen still opens a sheet.
    { key: 'consumptionAdd:outlet', on: { resource: CONSUMPTIONS, record: 'OutletCode' }, immediate: true, handler: applyConsumptionOutlet },
    { key: 'consumptionAdd:seedToggles', on: { resource: CONSUMPTIONS, record: true }, immediate: true, handler: (value, api) => seedConsumptionToggles(api) },

    // Both ledgers and the chain follow these five.
    { key: 'consumptionAdd:soldLines', on: { resource: CONSUMPTIONS, children: true }, handler: both },
    { key: 'consumptionAdd:returns', on: { resource: RETURNS, records: true }, handler: both },
    { key: 'consumptionAdd:restockItems', on: { resource: RESTOCKS, children: true }, handler: both },
    { key: 'consumptionAdd:restocking', on: { control: CTL.RESTOCKING.header }, handler: both },
    { key: 'consumptionAdd:directRestock', on: { resource: RESTOCKS, control: RESTOCK_CONTROL.DIRECT }, handler: both },
    { key: 'consumptionAdd:markDelivered', on: { resource: RESTOCKS, control: RESTOCK_CONTROL.DELIVER }, handler: both },
    { key: 'consumptionAdd:warehouse', on: { resource: RESTOCKS, control: RESTOCK_CONTROL.WAREHOUSE }, handler: both },

    // Chain only.
    { key: 'consumptionAdd:header', on: { resource: CONSUMPTIONS, record: true }, handler: chain },
    { key: 'consumptionAdd:invoicing', on: { control: CTL.INVOICING.header }, handler: chain },
    { key: 'consumptionAdd:invoice', on: { resource: INVOICES, record: true }, handler: chain },
    { key: 'consumptionAdd:invoiceItems', on: { resource: INVOICES, children: true }, handler: chain },
    { key: 'consumptionAdd:discountType', on: { resource: INVOICES, control: CTL.DISCOUNT_TYPE.header }, handler: chain },
    { key: 'consumptionAdd:discountValue', on: { resource: INVOICES, control: CTL.DISCOUNT_VALUE.header }, handler: chain },
    { key: 'consumptionAdd:invoiceComment', on: { resource: INVOICES, control: CTL.INVOICE_COMMENT.header }, handler: chain },
    { key: 'consumptionAdd:restock', on: { resource: RESTOCKS, record: true }, handler: chain },
    { key: 'consumptionAdd:completeVisit', on: { control: CTL.COMPLETE_VISIT.header }, handler: chain },
    { key: 'consumptionAdd:scheduleNext', on: { control: CTL.SCHEDULE_NEXT.header }, handler: chain },
    { key: 'consumptionAdd:nextVisitDays', on: { control: CTL.NEXT_VISIT_DAYS.header }, handler: chain },
    { key: 'consumptionAdd:nextVisitComment', on: { control: CTL.NEXT_VISIT_COMMENT.header }, handler: chain }
  ]
}

function seedConsumptionToggles (pageState) {
  if (getCtl(pageState, CTL.INVOICING) === null) {
    pageState.setControls(CTL.INVOICING.header, allowedTo(INVOICES, 'create'))
  }
  if (getCtl(pageState, CTL.RESTOCKING) === null) {
    pageState.setControls(CTL.RESTOCKING.header, allowedTo(RESTOCKS, 'create'))
  }
}

// The opening Add draft. Layer 3 applies it and lists no columns of its own.
export function buildConsumptionInitNodes ({ outletCode = '', visitCode = '', actorName = '' } = {}) {
  const { user } = useAuth()
  lastDigest = ''

  // The derive rules are registered by the page contract, NOT carried on the node:
  // replacing the consumption node would detach every one of them.
  return [consumptionCompositeNode({
    OutletCode: text(outletCode),
    OutletVisitCode: text(visitCode),
    Username: text(actorName) || text(user.value?.name || user.value?.email)
  }, [])]
}

// Why the wizard cannot be submitted, or '' when it can. The live rebuild already asked the
// submit gates, so this only reads its verdict — it builds nothing.
export function validateConsumptionDraft (pageState) {
  if (!soldItemsOf(pageState).length && !returnItemsOf(pageState).length) {
    return 'Count at least one item before submitting.'
  }
  return text(pageState.getControls(CHAIN_BLOCK, ''))
}

// ─── Step transitions ─────────────────────────────────────────────────────────
// Run when the officer LEAVES a step. Dropping a zeroed row on the keystroke that reached
// zero would unmount it under their finger.

function restockControlsOf (pageState) {
  return {
    [RESTOCK_CONTROL.DIRECT]: getCtl(pageState, CTL.DIRECT_RESTOCK, false) === true,
    [RESTOCK_CONTROL.DELIVER]: getCtl(pageState, CTL.MARK_DELIVERED, false) === true,
    [RESTOCK_CONTROL.WAREHOUSE]: text(getCtl(pageState, CTL.WAREHOUSE))
  }
}

// Drop every zeroed line and rebuild each node from the survivors. A leg with nothing
// left loses its node.
export function settleConsumptionCount (pageState) {
  const sold = soldItemsOf(pageState)
  const returned = returnItemsOf(pageState)
  const restocks = restockItemsOf(pageState)

  pageState.setResource(CONSUMPTIONS, null,
    consumptionCompositeNode({ ...(pageState.getRecord(null, CONSUMPTIONS) || {}) }, sold))

  if (restocks.length) {
    pageState.setResource(RESTOCKS, null,
      restockNode({ ...(pageState.getRecord(null, RESTOCKS) || {}) }, restocks, restockControlsOf(pageState)))
  } else {
    pageState.removeNode(RESTOCKS)
  }

  if (returned.length) pageState.setResource(RETURNS, null, returnsNode(returned))
  else pageState.removeNode(RETURNS)

  return { sold, returned, restocks }
}

// Decides only THAT there is an invoice. What is on it is the invoice domain's.
export function seedConsumptionInvoice (pageState, sold) {
  const node = invoiceNodeForConsumption(
    pageState.getRecord(null, CONSUMPTIONS),
    sold,
    {
      existing: pageState.getRecord(null, INVOICES) || {},
      resolvePrice: makeInvoiceLinePriceResolver(pageState.getChildRows(INVOICE_ITEMS, INVOICES))
    })
  if (node) pageState.setResource(INVOICES, null, node)
  return !!node
}

// The restock answers stop changing here, so the node is rebuilt once and its derive
// rules are dropped.
export function settleConsumptionRestock (pageState) {
  if (getCtl(pageState, CTL.RESTOCKING, true) !== true) return pageState.removeNode(RESTOCKS)
  const kept = restockItemsOf(pageState)
  if (!kept.length) return pageState.removeNode(RESTOCKS)
  pageState.setResource(RESTOCKS, null, restockNode(
    { ...(pageState.getRecord(null, RESTOCKS) || {}) }, kept, restockControlsOf(pageState), { withDerive: false }))
}

/** Unsettled returns raised on an EARLIER visit, which the returns step also offers. */
export function hasPendingConsumptionReturns (outletCode) {
  return storeRows('OutletReturns').some((row) =>
    text(row?.OutletCode) === text(outletCode) &&
    text(row?.Status || 'Active') === 'Active' &&
    isTrue(row?.InvoiceAdjustmentRequired) &&
    !isTrue(row?.InvoiceAdjustmentDone))
}

export const consumptionInvoicingAllowed = () => allowedTo(INVOICES, 'create')
export const consumptionRestockingAllowed = () => allowedTo(RESTOCKS, 'create')
export const consumptionSoldItems = soldItemsOf
export const consumptionReturnItems = returnItemsOf
export const consumptionRestockItems = restockItemsOf

// Composable shape for setup-context callers. Same functions, one import (§5).
export function useConsumptionDraft () {
  return {
    CONSUMPTION_ROLE,
    CONSUMPTION_CONTROL,
    CHAIN_SUCCESS,
    CHAIN_OUTCOME,
    CHAIN_BLOCK,
    buildConsumptionInitNodes,
    consumptionDraftDerivations,
    validateConsumptionDraft,
    syncConsumptionChain,
    nextVisitPlan,
    applyConsumptionOutlet,
    settleConsumptionCount,
    seedConsumptionInvoice,
    settleConsumptionRestock,
    dropInvoiceNodes,
    hasPendingConsumptionReturns
  }
}
