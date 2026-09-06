// OutletConsumptions cancellation cascade. Layer 2. Each leg is built by the domain that
// owns it; the operator's reason travels down onto every one.

import { textOrRef } from 'src/utils/appHelpers'
import { buildRestockRejectNodes } from 'src/_resource/Operation/OutletRestocks/composables/useRestockPayload'
import { buildReturnCancelInitNodes } from 'src/_resource/Operation/OutletReturns/composables/useReturnPayload'
import { buildCancellationNodes as buildInvoiceCancellationNodes } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoicePayload'
import { CANCELLED, progressOf, cascadeOptionsFor } from './useConsumptionProgress'
import { stampFields, restorableConsumptionLines, buildConsumptionReversalMovementsNode } from './useConsumptionPayload'

const CONSUMPTIONS = 'OutletConsumptions'
const INVOICES = 'OutletConsumptionInvoices'
const OUTLET_MOVEMENTS = 'OutletMovements'
const RESTOCKS = 'OutletRestocks'
const RESTOCK_ITEMS = 'OutletRestockItems'
const RETURNS = 'OutletReturns'
const STOCK_MOVEMENTS = 'StockMovements'
const OUTLET_STORAGES = 'OutletStorages'
const TAX_TRANSACTIONS = 'TaxTransactions'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const asList = (value) => (Array.isArray(value) ? value : [])

/** The three cascade toggles. They live on the consumption node the cascade rebuilds. */
export const CONSUMPTION_CANCEL_CONTROL = {
  RESTOCK: 'cancelRestock',
  RETURNS: 'cancelReturns',
  INVOICE: 'cancelInvoice'
}

/** The node the three toggles are addressed on. */
export const CONSUMPTION_CANCEL_NODE = CONSUMPTIONS

export function buildConsumptionCancellationNodes (record = {}, reason = '', options = {}) {
  const consumption = asRow(record)
  const code = text(consumption.Code)
  if (!code) return [{ valid: false, message: 'This consumption could not be identified.' }]
  if (progressOf(consumption) === CANCELLED) {
    return [{ valid: false, message: 'This consumption is already cancelled.' }]
  }

  const actorName = text(options.actorName)
  const cascade = cascadeOptionsFor(consumption, {
    invoice: options.invoice,
    restocks: options.restocks,
    returns: options.returns
  })
  const cascadeNote = `${text(reason)} — cancelled with outlet consumption ${code}${actorName ? ` by ${actorName}` : ''}.`

  // A plain update, not the `CancelConsumption` action: the route REPLACED that mutate, so
  // it is registered as `kind: navigate` and has no executeAction envelope to build.
  const nodes = [{
    resource: CONSUMPTIONS,
    permissions: { CancelConsumption: 'You are not allowed to cancel this consumption.' },
    code: textOrRef(code),
    record: {
      Progress: CANCELLED,
      ...stampFields('ProgressCancelled', actorName, text(reason))
    },
    ...(options.controls ? { controls: options.controls } : {}),
    reload: [CONSUMPTIONS],
    successMsg: 'Consumption cancelled.'
  }]

  const reversal = buildConsumptionReversalMovementsNode(consumption, {
    items: options.consumptionItems,
    movements: options.outletMovements
  })
  if (reversal) nodes.push(reversal)

  if (cascade.invoice.cancellable && options[CONSUMPTION_CANCEL_CONTROL.INVOICE] !== false) {
    nodes.push(...buildInvoiceCancellationNodes({
      record: cascade.invoice.rows[0],
      comment: cascadeNote,
      actorName,
      returnRows: options.invoiceReturnRows || [],
      taxTransactionRows: options.invoiceTaxRows || null
    }))
  }

  if (cascade.restock.cancellable && options[CONSUMPTION_CANCEL_CONTROL.RESTOCK] !== false) {
    cascade.restock.rows.forEach((restock) => {
      nodes.push(...buildRestockRejectNodes(
        restock,
        asList(restock.$OutletRestockItems),
        actorName,
        cascadeNote,
        { role: text(restock.Code) }
      ))
    })
  }

  // One role per return, or several single-record nodes would collapse onto one address.
  if (cascade.returns.cancellable && options[CONSUMPTION_CANCEL_CONTROL.RETURNS] !== false) {
    cascade.returns.rows.forEach((entry) => {
      nodes.push(...buildReturnCancelInitNodes({
        record: entry,
        reason: cascadeNote,
        role: text(entry.Code)
      }))
    })
  }

  nodes.push({ resource: '$batch', reload: [OUTLET_STORAGES] })

  return nodes
}

// Every node address a cascade leg can occupy. The derive drops them all before it
// rebuilds, so a toggle switched OFF really does leave the batch.
export function consumptionCancelAddresses (record = {}, options = {}) {
  const cascade = cascadeOptionsFor(asRow(record), {
    invoice: options.invoice,
    restocks: options.restocks,
    returns: options.returns
  })

  const nodes = [
    { resource: INVOICES },
    { resource: RETURNS },
    { resource: TAX_TRANSACTIONS },
    { resource: RESTOCK_ITEMS },
    { resource: STOCK_MOVEMENTS }
  ]

  cascade.restock.rows.forEach((row) => nodes.push({ resource: RESTOCKS, role: text(row.Code) }))
  cascade.returns.rows.forEach((row) => {
    nodes.push({ resource: RETURNS, role: text(row.Code) })
    nodes.push({ resource: OUTLET_MOVEMENTS, role: text(row.Code) })
  })

  // An action is queued in `state.actions`, not on a node, so `removeNode` cannot reach it.
  const actions = [{ resource: INVOICES, action: 'Cancel' }]

  return { nodes, actions }
}

/** The opening toggle stance — ON wherever the leg can still be cancelled. */
export function consumptionCancelToggles (record = {}, sources = {}) {
  const cascade = cascadeOptionsFor(asRow(record), sources)
  return {
    [CONSUMPTION_CANCEL_CONTROL.RESTOCK]: cascade.restock.cancellable,
    [CONSUMPTION_CANCEL_CONTROL.RETURNS]: cascade.returns.cancellable,
    [CONSUMPTION_CANCEL_CONTROL.INVOICE]: cascade.invoice.cancellable
  }
}

// The whole cancellation, mounted live, with the toggles seeded on the node itself so
// Layer 3 hydrates by applying ONE node and nothing else (§5.7A).
export function buildConsumptionCancelInitNodes ({ record = {}, reason = '', ...sources } = {}) {
  const row = asRow(record)
  const defaults = consumptionCancelToggles(row, sources)
  // Defaults first, so a caller carrying the operator's answered toggles overrides them.
  const answers = { ...defaults, ...sources }

  return buildConsumptionCancellationNodes(row, reason, {
    ...answers,
    controls: {
      [CONSUMPTION_CANCEL_CONTROL.RESTOCK]: answers[CONSUMPTION_CANCEL_CONTROL.RESTOCK] === true,
      [CONSUMPTION_CANCEL_CONTROL.RETURNS]: answers[CONSUMPTION_CANCEL_CONTROL.RETURNS] === true,
      [CONSUMPTION_CANCEL_CONTROL.INVOICE]: answers[CONSUMPTION_CANCEL_CONTROL.INVOICE] === true
    }
  })
}

// Rebuild the live batch whenever a toggle moves. The nodes are dropped and remade on
// every pass; the toggles ride on the consumption node, which survives a rebuild.
export function consumptionCancelDerivations ({ record = {}, ...sources } = {}) {
  const row = asRow(record)

  const rebuild = (value, api) => {
    const keptReason = text(api.getRecord('ProgressCancelledComment', CONSUMPTIONS))
    const { nodes, actions } = consumptionCancelAddresses(row, sources)
    for (const address of nodes) api.removeNode(address.resource, address.role)
    // A leg can queue the same action for several rows, so drop every queued entry that
    // matches the address rather than the first one only.
    for (const entry of actions) dropQueuedActions(api, entry)
    api.applyNodes(buildConsumptionCancellationNodes(row, keptReason, {
      ...sources,
      [CONSUMPTION_CANCEL_CONTROL.RESTOCK]: api.getControls(CONSUMPTION_CANCEL_CONTROL.RESTOCK, false, CONSUMPTIONS) === true,
      [CONSUMPTION_CANCEL_CONTROL.RETURNS]: api.getControls(CONSUMPTION_CANCEL_CONTROL.RETURNS, false, CONSUMPTIONS) === true,
      [CONSUMPTION_CANCEL_CONTROL.INVOICE]: api.getControls(CONSUMPTION_CANCEL_CONTROL.INVOICE, false, CONSUMPTIONS) === true
    }))
  }

  return Object.values(CONSUMPTION_CANCEL_CONTROL).map((control) => ({
    key: `consumptionCancel:${control}`,
    on: { resource: CONSUMPTIONS, control },
    immediate: false,
    handler: rebuild
  }))
}

// Bounded by the queue itself, so the pass ends when the queue does.
function dropQueuedActions (api, { action, resource, role }) {
  for (let left = api.state.actions.length; left > 0; left--) {
    if (api.getActions(action, null, resource, role) === null) return
    api.excludeAdditionalAction(action, { resource, role })
  }
}

/** Why a cancellation cannot be committed, or '' when it can. */
export function validateConsumptionCancelDraft (draft = {}) {
  return text(asRow(draft).ProgressCancelledComment) ? '' : 'A cancellation reason is required.'
}

export { restorableConsumptionLines }

// Composable shape for setup-context callers. Same functions, one import (§5).
export function useConsumptionCancel () {
  return {
    CONSUMPTION_CANCEL_CONTROL,
    CONSUMPTION_CANCEL_NODE,
    buildConsumptionCancellationNodes,
    buildConsumptionCancelInitNodes,
    consumptionCancelAddresses,
    consumptionCancelToggles,
    consumptionCancelDerivations,
    validateConsumptionCancelDraft,
    restorableConsumptionLines
  }
}
