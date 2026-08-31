import { useDataStore } from 'src/stores/data'
import { batchResultCode } from 'src/composables/resources/resourceRequests'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import {
  NODE,
  ROLE,
  CTRL,
  INVOICING,
  RESTOCKING,
  VISIT_COMPLETE_COMMENT,
  VISIT_COMPLETE_COMMENT_FIELD,
  getCtrl
} from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/nodes'
import {
  toNumber,
  countRowsOf
} from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionStock'
import { makeLineTaxResolver } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionInvoice'
import { buildConsumptionWorkflowChainNodes } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionWorkflow'
import { nextVisitPlan } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/useNextVisitPlan'
import { consumptionNode } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionPayload'
import { returnsNode } from 'src/_resource/Operation/OutletReturns/composables/useReturnPayload'
import { RESTOCK_CONTROL, restockNode } from 'src/_resource/Operation/OutletRestocks/composables/useRestockPayload'
import { invoiceNodeForConsumption, makeInvoiceLinePriceResolver } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoicePayload'

// The sticky bar for the six-step wizard. The nodes are the answers, so nothing is
// collected here. These two hold what the live chain handed back, for `submit` to report.
export const CHAIN_SUCCESS = 'ChainSuccessMsg'
export const CHAIN_OUTCOME = 'ChainOutcome'

export default (props, { pageState, resourceConfig }) => {
  const dataStore = useDataStore()

  const step = () => pageState.meta.currentStep
  const text = (value) => (value == null ? '' : String(value).trim())
  const rows = (name) => dataStore.getRecords(name) || []

  const consumption = pageState.useNode(NODE.CONSUMPTION)
  const returns = pageState.useNode(NODE.RETURNS)
  const restock = pageState.useNode(NODE.RESTOCKS)
  const invoice = pageState.useNode(NODE.INVOICES)

  const outletCode = () => text(pageState.getRecord('OutletCode', NODE.CONSUMPTION))

  const isTrue = (value) => text(value).toUpperCase() === 'TRUE'

  // One return record, in the shape the Layer 2 return builder reads it.
  const returnMetaFrom = (row) => ({
    Reason: text(row?.Reason) || 'DAMAGE',
    ReasonComment: text(row?.ReasonComment),
    SourceInvoiceCode: text(row?.SourceInvoiceCode),
    Price: row?.Price === undefined || row?.Price === null || row?.Price === '' ? null : toNumber(row.Price),
    InvoiceAdjustmentRequired: isTrue(row?.InvoiceAdjustmentRequired),
    WarehouseActionRequired: isTrue(row?.WarehouseActionRequired),
    WarehouseCode: text(row?.WarehouseCode)
  })

  // Only positive lines are real answers. A zero is a row the officer opened and left.
  const soldItems = () => (consumption.children(NODE.ITEMS).value || []).filter((row) => toNumber(row.Qty) > 0)
  const returnItems = () => (returns.node.value.records || []).filter((row) => toNumber(row.Qty) > 0)
  const restockItems = () => (restock.children(NODE.RESTOCK_ITEMS).value || []).filter((row) => toNumber(row.Quantity) > 0)

  const invoiceAllowed = () => useResourceConfig(NODE.INVOICES).allowed('create') === true
  const restockAllowed = () => useResourceConfig(NODE.RESTOCKS).allowed('create') === true

  const invoiceLines = () => invoice.children(NODE.INVOICE_ITEMS).value || []

  // The prices the reviewed lines carry, else the price list. Used by the SUBMIT, which
  // rebuilds the whole chain through Layer 2 rather than reading the reviewed node.
  const priceResolver = () => makeInvoiceLinePriceResolver(invoiceLines())

  // The step 4a answers, in the shape Layer 2 reads them.
  const restockControls = () => ({
    [RESTOCK_CONTROL.DIRECT]: getCtrl(pageState, CTRL.DIRECT_RESTOCK, false) === true,
    [RESTOCK_CONTROL.DELIVER]: getCtrl(pageState, CTRL.MARK_DELIVERED, false) === true,
    [RESTOCK_CONTROL.WAREHOUSE]: text(getCtrl(pageState, CTRL.WAREHOUSE))
  })

  const completingVisit = () => getCtrl(pageState, CTRL.COMPLETE_VISIT, true) === true &&
    !!text(pageState.getRecord('OutletVisitCode', NODE.CONSUMPTION))

  const invoicingOn = () => pageState.getControls(INVOICING, true) === true
  const restockingOn = () => pageState.getControls(RESTOCKING, true) === true

  // Leaving step 4 settles the restock: the answers stop changing, so the node is rebuilt
  // once from the surviving lines and its derive rules are dropped.
  function settleRestock () {
    if (!restockingOn()) return pageState.removeNode(NODE.RESTOCKS)
    const kept = restockItems()
    if (!kept.length) return pageState.removeNode(NODE.RESTOCKS)
    pageState.setResource(NODE.RESTOCKS, null, restockNode(
      { ...restock.node.value.record }, kept, restockControls(), { withDerive: false }))
  }

  // Drop every zeroed line, then rebuild each node from the survivors through its own
  // Layer 2 builder. Done on the TRANSITION, not on the keystroke that reached zero -
  // that would unmount the row under the officer's finger.
  function purify (sold, returned, restocks) {
    // Same shape for all three: keep the non-zero lines, rebuild through the resource's own
    // Layer 2 node builder, re-apply. Only record/children/records are replaced, so each
    // node keeps its controls. A leg with nothing left loses its node.
    pageState.setResource(NODE.CONSUMPTION, null,
      consumptionNode({ ...consumption.node.value.record }, sold))

    if (restocks.length) {
      pageState.setResource(NODE.RESTOCKS, null,
        restockNode({ ...restock.node.value.record }, restocks, restockControls()))
    } else {
      pageState.removeNode(NODE.RESTOCKS)
    }

    if (returned.length) pageState.setResource(NODE.RETURNS, null, returnsNode(returned))
    else pageState.removeNode(NODE.RETURNS)
  }

  // Decides only THAT there is an invoice. What is on it is Layer 2's, and the price
  // resolver keeps a price the officer already typed from being undone on re-entry.
  function seedInvoice (sold) {
    const node = invoiceNodeForConsumption(
      pageState.getRecord(null, NODE.CONSUMPTION),
      sold,
      { existing: invoice.node.value.record, resolvePrice: priceResolver() })
    if (node) pageState.setResource(NODE.INVOICES, null, node)
  }

  /** Unsettled returns raised on an EARLIER visit, which step 5 also offers to settle. */
  const hasPendingReturns = () => rows('OutletReturns').some((row) =>
    text(row?.OutletCode) === outletCode() &&
    text(row?.Status || 'Active') === 'Active' &&
    text(row?.InvoiceAdjustmentRequired) === 'TRUE' &&
    text(row?.InvoiceAdjustmentDone) !== 'TRUE')

  // A step is skipped when its question has no subject.
  const STEP_VISIBLE = {
    1: () => true,
    2: () => true,
    3: () => invoiceAllowed() && soldItems().length > 0,
    // Permission only, never the toggle or the lines: turning restock off drops the node,
    // and a line count read off it then locked the step the user turns it back on in.
    4: () => restockAllowed(),
    5: () => returnItems().length > 0 || hasPendingReturns(),
    6: () => true
  }

  const FIRST_STEP = 1
  const LAST_STEP = 6

  /** The next step at or after `from` that has something to ask; `null` past the end. */
  function nextStep (from) {
    for (let step = from + 1; step <= LAST_STEP; step++) {
      if (STEP_VISIBLE[step]?.() !== false) return step
    }
    return null
  }

  /** The previous visible step; `null` before the beginning. */
  function prevStep (from) {
    for (let step = from - 1; step >= FIRST_STEP; step--) {
      if (STEP_VISIBLE[step]?.() !== false) return step
    }
    return null
  }

  // The answers the Layer 2 chain takes, read straight off the nodes and their controls.
  // Exported through `buildChainInputs` below so the page contract's live chain and this
  // modifier read ONE assembly of the wizard's answers, never two that must agree.
  function chainInputs () {
    const form = pageState.getRecord(null, NODE.CONSUMPTION) || {}
    const outletStorages = rows('OutletStorages')
    const priceListCode = text(invoice.node.value.record.PriceListCode)

    const resolvePrice = priceResolver()

    // The step-5 answers live on the OutletReturns records themselves, keyed by SKU here
    // because that is how the Layer 2 builder asks for them.
    const returnBySku = new Map(returnItems().map((row) => [text(row.SKU), row]))
    const restocking = restock.exists.value && restockingOn()
    const directRestock = restocking && getCtrl(pageState, CTRL.DIRECT_RESTOCK, false) === true
    const days = getCtrl(pageState, CTRL.NEXT_VISIT_DAYS, null)
    const plan = nextVisitPlan(pageState, rows('OutletOperatingRules'))

    return {
      form,
      countRows: countRowsOf(soldItems(), returnItems(), outletStorages, text(form.OutletCode)),
      actorName: text(form.Username),
      outletStorages,
      warehouseStorages: rows('WarehouseStorages'),
      operatingRules: rows('OutletOperatingRules'),
      returnRows: rows('OutletReturns'),
      returnMetaOf: (sku) => returnMetaFrom(returnBySku.get(text(sku))),
      adjustedReturnCodes: (getCtrl(pageState, CTRL.ADJUSTED_RETURNS, []) || []).map(text).filter(Boolean),
      generateInvoice: invoice.exists.value && invoicingOn(),
      priceListCode,
      dueDate: text(invoice.node.value.record.DueDate),
      discountType: text(getCtrl(pageState, CTRL.DISCOUNT_TYPE)) || 'FLAT',
      discountValue: toNumber(getCtrl(pageState, CTRL.DISCOUNT_VALUE, 0)),
      invoiceComment: text(getCtrl(pageState, CTRL.INVOICE_COMMENT)),
      calculateLineTax: makeLineTaxResolver({ priceListCode, resolvePrice }),
      resolvePrice,
      restockRows: restocking ? restockItems() : [],
      directRestock,
      warehouseCode: directRestock ? text(getCtrl(pageState, CTRL.WAREHOUSE)) : '',
      markDelivered: directRestock && getCtrl(pageState, CTRL.MARK_DELIVERED, false) === true,
      // Step 6's two answers, read where each one lives: the toggle's own control, and
      // the planned-visit node the scheduling card seeds.
      completeVisit: completingVisit(),
      completeComment: text(pageState.getActions(
        'Complete', `fields.${VISIT_COMPLETE_COMMENT_FIELD}`, NODE.VISITS)) || VISIT_COMPLETE_COMMENT,
      // The PLAN, not the node. A plan that rides on the Complete action's own target has
      // no standalone node - the scheduling card drops it precisely then - so reading the
      // node here left the chain's Complete carrying no next visit at all.
      scheduleNext: plan.willSchedule,
      nextVisit: pageState.hasNode(NODE.VISITS, ROLE.NEXT)
        ? (pageState.getRecord(null, NODE.VISITS, ROLE.NEXT) || {})
        : {
          OutletCode: text(form.OutletCode),
          Date: plan.date,
          ProgressPlannedComment: plan.comment,
          Username: text(form.Username)
        },
      nextVisitDays: plan.days || (days === null || days === '' ? null : toNumber(days))
    }
  }

  // Run on its own, not inside the rebuild: the rebuild exits early when the digest is
  // unchanged, and a toggle flipped in that window left its node behind.
  function enforceToggles () {
    if (!invoicingOn()) pageState.removeNode(NODE.INVOICES)
    if (!restockingOn()) pageState.removeNode(NODE.RESTOCKS)
    // Same rule for the queued action: applyNodes replaces an entry, it never drops one
    // the answer retired. Removing it from the card instead desynced this rebuild's digest.
    if (!completingVisit()) pageState.excludeAdditionalAction('Complete', { resource: NODE.VISITS })
  }

  // The live chain: every answer re-derives the whole batch, so submit only validates.
  // The digest stops the loop, since the builder rewrites the nodes it reads.
  let lastDigest = ''
  function rebuildChain () {
    enforceToggles()
    if (!soldItems().length && !returnItems().length) return
    const args = chainInputs()
    const digest = JSON.stringify(args, (key, value) => (typeof value === 'function' ? undefined : value))
    if (digest === lastDigest) return
    lastDigest = digest

    const nodes = buildConsumptionWorkflowChainNodes(args)
    if (!Array.isArray(nodes) || nodes.some((node) => node?.valid === false)) return
    const applied = pageState.applyNodes(nodes)
    if (applied.valid === false) return

    // Nothing sold means no consumption row to write; a toggle that is off must not leave
    // its node in the batch. The node's EXISTENCE is the answer, kept in step live (§5A.1).
    if (!soldItems().length) pageState.removeNode(NODE.CONSUMPTION)
    enforceToggles()

    pageState.setControls(CHAIN_SUCCESS, applied.successMsg || 'Consumption recorded.')
    pageState.setControls(CHAIN_OUTCOME, applied.outcome || null)
  }

  pageState.derive([
    { key: 'consumptionAdd:consumption', on: { resource: NODE.CONSUMPTION, children: true }, handler: rebuildChain },
    { key: 'consumptionAdd:header', on: { resource: NODE.CONSUMPTION, record: true }, handler: rebuildChain },
    { key: 'consumptionAdd:returns', on: { resource: NODE.RETURNS, records: true }, handler: rebuildChain },
    { key: 'consumptionAdd:invoicing', on: { control: INVOICING }, handler: rebuildChain },
    { key: 'consumptionAdd:invoice', on: { resource: NODE.INVOICES, record: true }, handler: rebuildChain },
    { key: 'consumptionAdd:invoiceItems', on: { resource: NODE.INVOICES, children: true }, handler: rebuildChain },
    { key: 'consumptionAdd:discountType', on: { control: CTRL.DISCOUNT_TYPE.header, resource: NODE.INVOICES }, handler: rebuildChain },
    { key: 'consumptionAdd:discountValue', on: { control: CTRL.DISCOUNT_VALUE.header, resource: NODE.INVOICES }, handler: rebuildChain },
    { key: 'consumptionAdd:invoiceComment', on: { control: CTRL.INVOICE_COMMENT.header, resource: NODE.INVOICES }, handler: rebuildChain },
    { key: 'consumptionAdd:restocking', on: { control: RESTOCKING }, handler: rebuildChain },
    // A toggle fires BEFORE its step re-seeds the node, so the toggle alone rebuilds a
    // chain that still has no invoice or restock in it. These follow the nodes themselves.
    { key: 'consumptionAdd:restock', on: { resource: NODE.RESTOCKS, record: true }, handler: rebuildChain },
    { key: 'consumptionAdd:restockItems', on: { resource: NODE.RESTOCKS, children: true }, handler: rebuildChain },
    { key: 'consumptionAdd:directRestock', on: { control: RESTOCK_CONTROL.DIRECT, resource: NODE.RESTOCKS }, handler: rebuildChain },
    { key: 'consumptionAdd:markDelivered', on: { control: RESTOCK_CONTROL.DELIVER, resource: NODE.RESTOCKS }, handler: rebuildChain },
    { key: 'consumptionAdd:warehouse', on: { control: RESTOCK_CONTROL.WAREHOUSE, resource: NODE.RESTOCKS }, handler: rebuildChain },
    // Step 6's answers feed the chain too, so the Complete action it builds follows them.
    { key: 'consumptionAdd:completeVisit', on: { control: CTRL.COMPLETE_VISIT.header }, handler: rebuildChain },
    { key: 'consumptionAdd:scheduleNext', on: { control: CTRL.SCHEDULE_NEXT.header }, handler: rebuildChain },
    { key: 'consumptionAdd:nextVisitDays', on: { control: CTRL.NEXT_VISIT_DAYS.header }, handler: rebuildChain },
    { key: 'consumptionAdd:nextVisitComment', on: { control: CTRL.NEXT_VISIT_COMMENT.header }, handler: rebuildChain }
  ])

  return {
    get actions () {
      if (step() === 1) return ['cancel', 'next']
      // Keyed on whether a NEXT step exists: with step 5 skipped, step 4 is the last screen.
      if (nextStep(step()) === null) return ['back', 'submit']
      return ['back', 'next']
    },

    submitLabel: 'Record Consumption',

    // Leaving abandons an unsaved audit, so go to the list rather than `goBack()`.
    cancel: (name, { nav }) => {
      nav.goTo('index')
      return false
    },

    next: () => {
      if (step() === 1) {
        if (!outletCode()) return { valid: false, message: 'Select an outlet to continue.' }
      }

      if (step() === 2) {
        const sold = soldItems()
        const returned = returnItems()
        const restocks = restockItems()

        if (!sold.length && !restocks.length && !returned.length) {
          return {
            valid: false,
            message: 'Consumption requires at least one sold, restock, or return item to proceed.'
          }
        }

        purify(sold, returned, restocks)

        if (restocks.length && restockAllowed()) pageState.setControls(RESTOCKING, true)

        if (sold.length && invoiceAllowed()) {
          seedInvoice(sold)
          pageState.setControls(INVOICING, true)
          return { step: 3 }
        }
        pageState.removeNode(NODE.INVOICES)
        // Asked for, never set here: PageAction moves the step behind its own fade, so a
        // skip looks the same as a plain Continue instead of swapping the bar mid-fade.
        return { step: nextStep(2) ?? LAST_STEP }
      }

      // Leaving step 3 settles the invoice: the toggle is the answer, so a node the
      // officer turned off must not travel on into the rest of the wizard.
      if (step() === 3 && !invoicingOn()) pageState.removeNode(NODE.INVOICES)

      if (step() === 4) settleRestock()

      const target = nextStep(step())
      return target !== null && target !== step() + 1 ? { step: target } : undefined
    },

    back: () => {
      const target = prevStep(step())
      return target !== null && target !== step() - 1 ? { step: target } : undefined
    },

    // Validation only: pageState already holds exactly what will be sent.
    submit: (name, { nav }) => {
      if (!soldItems().length && !returnItems().length) {
        return { valid: false, message: 'Count at least one item before submitting.' }
      }

      const outcome = pageState.getControls(CHAIN_OUTCOME) || null
      // Resolved after hydration: only build() knows where the resource lands in the batch.
      const at = outcome?.resource
        ? pageState.build().findIndex((request) => request.resource === outcome.resource)
        : -1

      return {
        successMsg: pageState.getControls(CHAIN_SUCCESS) || 'Consumption recorded.',
        onSuccess: ({ response }) => {
          // Our handler replaces the default reset, so clear the wizard here.
          pageState.reset()
          const code = at >= 0 ? text(batchResultCode(response, at)) : ''
          // A bulk create may report no single code. The index is the honest fallback.
          if (!code) return nav.goTo('index')
          if (!outcome?.slug) return nav.goTo('view', { code })
          nav.goTo('view', { scope: 'operation', resourceSlug: outcome.slug, code })
        }
      }
    }
  }
}
