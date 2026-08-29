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
import { consumptionNode } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionPayload'
import { returnsNode } from 'src/_resource/Operation/OutletReturns/composables/useReturnPayload'
import { RESTOCK_CONTROL, restockNode } from 'src/_resource/Operation/OutletRestocks/composables/useRestockPayload'
import { invoiceNode, makeInvoiceLinePriceResolver } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoicePayload'

// The sticky bar for the six-step wizard: navigation, the step-2 hand-off, the submit.
// The nodes ARE the answers, so nothing is collected here - this file reads pageState,
// purifies it on the transition, and lets Layer 2 build the batch.
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

  // Decides only THAT there is an invoice, and gives it the outlet and the lines. What is
  // ON it - prices, discount, tax, totals - is SoldReview's, which owns those terms.
  function seedInvoice (sold) {
    const header = pageState.getRecord(null, NODE.CONSUMPTION) || {}
    pageState.setResource(NODE.INVOICES, null, invoiceNode(
      {
        ...invoice.node.value.record,
        OutletCode: text(header.OutletCode),
        Date: text(header.Date),
        Username: text(header.Username)
      },
      sold.map((row) => ({ SKU: text(row.SKU), Qty: toNumber(row.Qty) })),
      {},
      // Re-entering step 3 must not undo a price the officer already typed.
      { resolvePrice: priceResolver() }
    ))
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
    4: () => restockItems().length > 0,
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
      scheduleNext: pageState.hasNode(NODE.VISITS, ROLE.NEXT),
      nextVisit: pageState.getRecord(null, NODE.VISITS, ROLE.NEXT) || {},
      nextVisitDays: days === null || days === '' ? null : toNumber(days)
    }
  }

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
          pageState.meta.currentStep = 3
        } else {
          pageState.removeNode(NODE.INVOICES)
          pageState.meta.currentStep = restocks.length ? 4 : 5
        }
        // `false` suppresses the built-in increment - this jump already moved the step.
        return false
      }

      // Leaving step 3 settles the invoice: the toggle is the answer, so a node the
      // officer turned off must not travel on into the rest of the wizard.
      if (step() === 3 && !invoicingOn()) pageState.removeNode(NODE.INVOICES)

      if (step() === 4) settleRestock()

      const target = nextStep(step())
      if (target !== null && target !== step() + 1) {
        pageState.meta.currentStep = target
        return false
      }
    },

    back: () => {
      const target = prevStep(step())
      if (target !== null && target !== step() - 1) {
        pageState.meta.currentStep = target
        return false
      }
    },

    // A thin adapter: Layer 2 decides the batch, build() turns the nodes into requests.
    submit: (name, { nav }) => {
      const hadSales = soldItems().length > 0
      const applied = pageState.applyNodes(buildConsumptionWorkflowChainNodes(chainInputs()))
      if (applied.valid === false) return false
      const outcome = applied.outcome
      // Nothing sold means no consumption row to write.
      if (!hadSales) pageState.removeNode(NODE.CONSUMPTION)
      // The toggle is off, so the reviewed invoice node must not reach the batch.
      if (!invoicingOn()) pageState.removeNode(NODE.INVOICES)
      if (!restockingOn()) pageState.removeNode(NODE.RESTOCKS)

      // Resolved after hydration: only build() knows where the resource lands in the batch.
      const at = outcome?.resource
        ? pageState.build().findIndex((request) => request.resource === outcome.resource)
        : -1
      return {
        successMsg: applied.successMsg,
        onSuccess: ({ response }) => {
          // Our handler replaces the default reset, so clear the wizard here.
          pageState.reset()
          const code = at >= 0 ? text(batchResultCode(response, at)) : ''
          // A bulk create may report no single code. The index is the honest fallback.
          if (!code) return nav.goTo('index')
          if (!outcome.slug) return nav.goTo('view', { code })
          nav.goTo('view', { scope: 'operation', resourceSlug: outcome.slug, code })
        }
      }
    }
  }
}
