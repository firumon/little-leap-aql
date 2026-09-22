// The live drafts for OutletConsumptionInvoices — Add and Edit. Layer 2. The page's nodes
// ARE the batch: the UI writes one column, the derives here regenerate every consequence,
// and submit only validates (UI_PAGE_STATE_NODES.md §5.7A–§5.7D).

import { useAuth } from 'src/composables/core/useAuth'
import { useRecord } from 'src/composables/resources/useRecord'
import { useInvoiceIndex } from './useInvoiceIndex'
import {
  resolvePriceListCode,
  invoiceDueDaysFor,
  dueDateFrom,
  storedTaxBreakdown
} from './useInvoiceCalculation'
import {
  invoiceNode,
  repriceInvoiceInPageState,
  buildInvoiceGenerationNodes,
  makeInvoiceLinePriceResolver,
  editableInvoiceItems,
  invoiceEditDefaults
} from './useInvoicePayload'
import { canEditInvoice } from './useInvoiceWorkflow'
import { makeLineTaxResolver } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionInvoice'
import { priceOf } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionStock'
import {
  taxTransactionRowsOf,
  buildTaxTransactionReplacementNodes
} from 'src/_resource/Accounts/TaxTransactions/composables/useTaxTransactionPayload'

const INVOICES = 'OutletConsumptionInvoices'
const INVOICE_ITEMS = 'OutletConsumptionInvoiceItems'
const CONSUMPTIONS = 'OutletConsumptions'
const RETURNS = 'OutletReturns'
const TAX_TRANSACTIONS = 'TaxTransactions'

/** Working state only — never a sheet column. All of them live on the invoice node. */
export const INVOICE_CONTROL = {
  DISCOUNT_TYPE: 'DiscountType',
  DISCOUNT_VALUE: 'DiscountValue',
  APPLY_RETURNS: 'ApplyReturns',
  BUILD_ERROR: 'BuildError'
}

const CTL = INVOICE_CONTROL

const text = (value) => (value == null ? '' : String(value).trim())
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const todayISO = () => new Date().toISOString().slice(0, 10)
const csv = (value) => text(value).split(',').map(text).filter(Boolean)
const isActiveRow = (row) => text(row?.Status || 'Active').toUpperCase() === 'ACTIVE'

const record = (pageState) => pageState.getRecord(null, INVOICES) || {}
const lineRows = (pageState) => pageState.getChildRows(INVOICE_ITEMS, INVOICES) || []
const billedLines = (pageState) => lineRows(pageState).filter((row) => num(row.Qty) > 0)

const getCtl = (pageState, header, fallback = null) =>
  pageState.getControls(header, fallback, INVOICES)

const setCtl = (pageState, header, value) =>
  pageState.setControls(header, value, INVOICES)

// ─── What the outlet offers ──────────────────────────────────────────────────

/** The outlet's uninvoiced consumptions with their billable item rows, newest first. */
export function invoiceableConsumptionsOf (outletCode) {
  const outlet = text(outletCode)
  if (!outlet) return []
  const index = useInvoiceIndex()
  return index.pendingInvoiceGeneration.value
    .filter((row) => text(row.OutletCode) === outlet)
    .map((row) => ({
      code: text(row.Code),
      date: text(row.Date),
      username: text(row.Username),
      // Joined through the aggregate's indexed map: a list record carries no children.
      items: index.itemsOfConsumption(row.Code).filter(isActiveRow)
    }))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
}

/** The outlet's returns still waiting to be credited on a bill. */
export function creditableReturnsOf (outletCode) {
  const outlet = text(outletCode)
  if (!outlet) return []
  return useInvoiceIndex().returnsAwaitingAdjustment.value
    .filter((row) => text(row.OutletCode) === outlet)
    .sort((a, b) => (text(a.Date) < text(b.Date) ? -1 : 1))
}

/** The raw return rows this draft credits — never a display shape, the builder reads them. */
export function creditedReturnRows (pageState) {
  if (getCtl(pageState, CTL.APPLY_RETURNS, false) !== true) return []
  const chosen = new Set(csv(record(pageState).OutletReturnCodes))
  // Intersected with what is still available: switching outlet leaves old codes behind for
  // one tick, and crediting another outlet's return is a real accounting error.
  return creditableReturnsOf(record(pageState).OutletCode)
    .filter((row) => chosen.has(text(row.Code)))
}

const deductionOf = (rows) => rows.reduce((sum, row) => sum + num(row.Qty) * num(row.Price), 0)

// ─── The derive handlers ─────────────────────────────────────────────────────

// A new outlet invalidates every answer below it, or the bill mixes two outlets.
export function applyInvoiceOutlet (outletCode, pageState) {
  const outlet = text(outletCode)
  const rules = useInvoiceIndex().operatingRules.value

  pageState.setRecord('OutletConsumptionCode', '', INVOICES)
  pageState.setRecord('OutletReturnCodes', '', INVOICES)
  setCtl(pageState, CTL.APPLY_RETURNS, false)
  clearInvoiceLines(pageState)

  if (!outlet) return
  pageState.setRecord('PriceListCode', resolvePriceListCode(outlet, rules), INVOICES)
  pageState.setRecord('DueDate', dueDateFrom(todayISO(), invoiceDueDaysFor(outlet, rules)), INVOICES)
}

function clearInvoiceLines (pageState) {
  for (let i = lineRows(pageState).length - 1; i >= 0; i--) {
    pageState.removeChild(INVOICE_ITEMS, i, INVOICES)
  }
}

const lineIndexOf = (pageState, sku) =>
  lineRows(pageState).findIndex((row) => text(row.SKU) === text(sku))

// One row per SKU: an outlet counted weekly and billed monthly gets one line per product,
// not four. `_sources` and `_manual` are frontend-only — the builder strips them.
export function seedInvoiceLines (pageState) {
  const chosen = new Set(csv(record(pageState).OutletConsumptionCode))
  const bySku = new Map()

  invoiceableConsumptionsOf(record(pageState).OutletCode).forEach((consumption) => {
    if (!chosen.has(consumption.code)) return
    consumption.items.forEach((item) => {
      const sku = text(item.SKU)
      if (!sku) return
      const qty = num(item.Qty)
      const entry = bySku.get(sku) || { Qty: 0, sources: [] }
      entry.Qty += qty
      entry.sources.push({
        key: `${consumption.code}-${sku}`,
        qty,
        label: `${qty} from ${consumption.date} (${consumption.username || '—'})`
      })
      bySku.set(sku, entry)
    })
  })

  for (let i = lineRows(pageState).length - 1; i >= 0; i--) {
    const row = lineRows(pageState)[i]
    const sku = text(row.SKU)
    if (!bySku.has(sku)) {
      const manualQty = num(row._manualQty)
      if (manualQty > 0) {
        if (num(row.Qty) !== manualQty || (row._sources && row._sources.length > 0) || !row._manual) {
          pageState.setChildren(INVOICE_ITEMS, i, null, {
            Qty: manualQty,
            _manual: true,
            _manualQty: manualQty,
            _sources: []
          }, INVOICES)
        }
      } else {
        pageState.removeChild(INVOICE_ITEMS, i, INVOICES)
      }
    }
  }

  bySku.forEach((entry, sku) => {
    const at = lineIndexOf(pageState, sku)
    if (at < 0) {
      pageState.addChild(INVOICE_ITEMS, {
        SKU: sku,
        Qty: entry.Qty,
        _manual: false,
        _manualQty: 0,
        _sources: entry.sources
      }, INVOICES)
      return
    }
    const current = lineRows(pageState)[at]
    const manualQty = num(current._manualQty)
    if (manualQty > 0) {
      pageState.setChildren(INVOICE_ITEMS, at, null, {
        Qty: entry.Qty + manualQty,
        _manual: true,
        _manualQty: manualQty,
        _sources: entry.sources
      }, INVOICES)
    } else {
      pageState.setChildren(INVOICE_ITEMS, at, null, {
        Qty: entry.Qty,
        _manual: false,
        _manualQty: 0,
        _sources: entry.sources
      }, INVOICES)
    }
  })
}

export function removeManualPart (pageState, at) {
  const row = lineRows(pageState)[at]
  if (!row) return

  const sources = Array.isArray(row._sources) ? row._sources : []
  const counted = sources.reduce((sum, s) => sum + num(s.qty), 0)

  if (!sources.length || counted <= 0) {
    pageState.removeChild(INVOICE_ITEMS, at, INVOICES)
    return
  }

  pageState.setChildren(INVOICE_ITEMS, at, null, {
    Qty: counted,
    _manualQty: 0,
    _manual: false
  }, INVOICES)
}

// The returns toggle owns the whole set: on credits everything available, off clears it, so
// a re-tick never restores an abandoned selection.
export function applyReturnsToggle (value, pageState) {
  const codes = value === true
    ? creditableReturnsOf(record(pageState).OutletCode).map((row) => text(row.Code))
    : []
  pageState.setRecord('OutletReturnCodes', codes.join(','), INVOICES)
}

// How many consumption-mark nodes the last pass raised. `applyNodes` only ever adds, so
// the tail has to be taken down by name before the next pass puts it back up.
let raisedMarks = 0

function clearDependentNodes (pageState) {
  for (let i = 0; i < raisedMarks; i++) {
    pageState.removeNode(CONSUMPTIONS, `invoiceGenerated${i}`)
  }
  raisedMarks = 0
  pageState.removeNode(TAX_TRANSACTIONS)
  pageState.removeNode(RETURNS)
}

function actorName (form) {
  const { user } = useAuth()
  return text(form?.Username) || text(user.value?.name || user.value?.email)
}

// The whole draft, re-cut: every line priced, every total restated, and the dependent tail
// raised again, so the summary is exactly what submit would send.
export function syncInvoiceDraft (pageState) {
  if (!pageState.hasNode(INVOICES)) return

  const credits = creditedReturnRows(pageState)
  const deduction = deductionOf(credits)
  // Written BEFORE the reprice: the engine reads it off the record to reach the payable.
  if (num(record(pageState).ReturnDeductionTotal) !== deduction) {
    pageState.setRecord('ReturnDeductionTotal', deduction, INVOICES)
  }
  repriceInvoiceInPageState(pageState)

  clearDependentNodes(pageState)

  const form = record(pageState)
  const outlet = text(form.OutletCode)
  const lines = billedLines(pageState).map((row) => ({ SKU: text(row.SKU), Qty: num(row.Qty) }))
  if (!outlet || !lines.length) {
    // Nothing to invoice. The page's own node stays — it holds the answers — but there is
    // nothing for Layer 2 to refuse either.
    setCtl(pageState, CTL.BUILD_ERROR, '')
    return
  }

  const priceListCode = text(form.PriceListCode)
  const resolvePrice = makeInvoiceLinePriceResolver(lineRows(pageState))
  const consumptionCodes = csv(form.OutletConsumptionCode)
  const actor = actorName(form)

  const applied = pageState.applyNodes(buildInvoiceGenerationNodes({
    outletCode: outlet,
    username: actor,
    actorName: actor,
    date: text(form.Date) || todayISO(),
    dueDate: text(form.DueDate) || todayISO(),
    priceListCode,
    lines,
    consumptionCodes,
    returnRows: credits,
    discountType: text(getCtl(pageState, CTL.DISCOUNT_TYPE, 'FLAT')) || 'FLAT',
    discountValue: num(getCtl(pageState, CTL.DISCOUNT_VALUE, 0)),
    comment: text(form.ProgressPendingPaymentComment),
    // Keeps this pass off the lines the user typed (UI_PAGE_STATE.md §5B.3 — watch the
    // input, never the output).
    withItems: false,
    resolvePrice,
    calculateLineTax: makeLineTaxResolver({ priceListCode, resolvePrice })
  }))

  // Why Layer 2 refused, in its own words, so the sticky bar vetoes submit with it instead
  // of inventing a second rule.
  setCtl(pageState, CTL.BUILD_ERROR, applied.valid === false ? text(applied.message) : '')
  if (applied.valid !== false) raisedMarks = consumptionCodes.length
}

// ─── The page contract's two calls ───────────────────────────────────────────

/** Every consequence the Add page has, re-derived from the one column the UI writes. */
export function invoiceDraftDerivations () {
  const sync = (value, api) => syncInvoiceDraft(api)

  return [
    // `immediate` so a deep link that arrives with an outlet already chosen still resolves
    // its price list and due date.
    { key: 'invoiceAdd:outlet', on: { resource: INVOICES, record: 'OutletCode' }, immediate: true, handler: applyInvoiceOutlet },
    { key: 'invoiceAdd:ticks', on: { resource: INVOICES, record: 'OutletConsumptionCode' }, handler: (value, api) => { seedInvoiceLines(api); syncInvoiceDraft(api) } },
    { key: 'invoiceAdd:lines', on: { resource: INVOICES, children: INVOICE_ITEMS }, handler: sync },
    { key: 'invoiceAdd:priceList', on: { resource: INVOICES, record: 'PriceListCode' }, handler: sync },
    { key: 'invoiceAdd:discountType', on: { resource: INVOICES, control: CTL.DISCOUNT_TYPE }, handler: sync },
    { key: 'invoiceAdd:discountValue', on: { resource: INVOICES, control: CTL.DISCOUNT_VALUE }, handler: sync },
    { key: 'invoiceAdd:applyReturns', on: { resource: INVOICES, control: CTL.APPLY_RETURNS }, handler: (value, api) => { applyReturnsToggle(value, api); syncInvoiceDraft(api) } },
    { key: 'invoiceAdd:returns', on: { resource: INVOICES, record: 'OutletReturnCodes' }, handler: sync },
    { key: 'invoiceAdd:dueDate', on: { resource: INVOICES, record: 'DueDate' }, immediate: false, handler: sync },
    { key: 'invoiceAdd:comment', on: { resource: INVOICES, record: 'ProgressPendingPaymentComment' }, immediate: false, handler: sync }
  ]
}

// The opening Add draft. Header only: the lines follow the ticks, and the page contract
// owns the derive rules so replacing this node cannot detach them.
export function buildInvoiceInitNodes ({ outletCode = '', consumptionCode = '', actorName: actor = '' } = {}) {
  const { user } = useAuth()
  raisedMarks = 0

  return [invoiceNode({
    OutletCode: text(outletCode),
    OutletConsumptionCode: text(consumptionCode),
    Date: todayISO(),
    Username: text(actor) || text(user.value?.name || user.value?.email)
  }, [], {}, { withDerive: false })]
}

/** Why the wizard cannot be submitted, or '' when it can. It builds nothing. */
export function invoiceDraftBlock (pageState) {
  if (!text(record(pageState).OutletCode)) return 'Select an outlet to continue.'
  if (!billedLines(pageState).length) {
    return 'Add at least one item with a quantity before continuing.'
  }
  return text(getCtl(pageState, CTL.BUILD_ERROR, ''))
}

export const invoiceDraftLines = billedLines

// ─── The live EDIT draft ─────────────────────────────────────────────────────

// The price the line opened at. Frontend-only, so `build()` strips it before the wire.
export const INVOICE_LINE_BASE_PRICE = '_basePrice'

/** The returns this issued invoice already credited. The Edit page only lists them. */
export function creditedReturnsOfInvoice (invoiceCode) {
  const code = text(invoiceCode)
  if (!code) return []
  return (useRecord().rows(RETURNS) || [])
    .map(asRow)
    .filter((row) => text(row.ConsumptionInvoiceCode) === code && isActiveRow(row))
}

function editLineRow (item) {
  const row = asRow(item)
  const price = num(row.Price)
  return {
    _action: 'update',
    [INVOICE_LINE_BASE_PRICE]: price,
    Code: text(row.Code),
    SKU: text(row.SKU),
    Qty: num(row.Qty),
    Price: price,
    Total: num(row.Total),
    Discount: num(row.Discount),
    TaxableAmount: num(row.TaxableAmount),
    TaxAmount: num(row.TaxAmount),
    TaxCode: text(row.TaxCode)
  }
}

// Rebuilt from scratch each pass: an edit can change the SET of tax codes, so there is no
// ledger row to match against.
function syncInvoiceEditLedger (pageState, stored) {
  const row = asRow(stored)
  const code = text(row.Code)
  pageState.removeNode(TAX_TRANSACTIONS)
  if (!code) return

  pageState.applyNodes(buildTaxTransactionReplacementNodes({
    existingRows: taxTransactionRowsOf(INVOICES, code),
    resource: INVOICES,
    resourceCode: code,
    date: text(row.Date),
    counterPartyType: 'Outlet',
    counterPartyCode: text(row.OutletCode),
    taxBreakdown: storedTaxBreakdown(record(pageState))
  }))
}

/** The whole edit, re-cut: every line re-priced, every total restated, ledger re-raised. */
export function syncInvoiceEdit (pageState, stored) {
  if (!pageState.hasNode(INVOICES)) return
  repriceInvoiceInPageState(pageState)
  syncInvoiceEditLedger(pageState, stored)
}

// A different list re-prices every line, and that new price becomes the baseline the "was"
// caption and Restore measure against.
export function applyInvoiceEditPriceList (value, pageState, previous) {
  if (previous === undefined || text(previous) === text(value)) return
  const list = text(value)
  lineRows(pageState).forEach((row, index) => {
    const listed = priceOf(row.SKU, list)
    const price = listed === null || listed === undefined ? num(row.Price) : num(listed)
    pageState.setChildren(INVOICE_ITEMS, index, null,
      { Price: price, [INVOICE_LINE_BASE_PRICE]: price }, INVOICES)
  })
}

// The invoice as ONE live update node, lines as children. Stored totals are not seeded:
// the lines derive re-prices the whole bill on the first tick.
export function buildInvoiceEditInitNodes (stored = {}) {
  const row = asRow(stored)
  const code = text(row.Code)
  if (!code || !canEditInvoice(row)) return []

  const items = editableInvoiceItems(row)
  if (!items.length) return []

  const defaults = invoiceEditDefaults(row)

  return [{
    resource: INVOICES,
    code,
    record: {
      DueDate: defaults.dueDate,
      PriceListCode: defaults.priceListCode,
      ReturnDeductionTotal: num(row.ReturnDeductionTotal)
    },
    children: [{ resource: INVOICE_ITEMS, records: items.map(editLineRow) }],
    controls: {
      [CTL.DISCOUNT_TYPE]: defaults.discountType,
      [CTL.DISCOUNT_VALUE]: defaults.discountValue
    },
    permissions: { update: 'You are not allowed to edit this invoice.' },
    successMsg: 'Invoice updated.'
  }]
}

// Every consequence the Edit page has. Only the lines entry is `immediate` — that is the
// zero-trust recalc at mount; the rest would re-price a historical bill on their own.
export function invoiceEditDerivations (stored = {}) {
  const row = asRow(stored)
  const sync = (value, api) => syncInvoiceEdit(api, row)

  return [
    { key: 'invoiceEdit:lines', on: { resource: INVOICES, children: INVOICE_ITEMS }, handler: sync },
    {
      key: 'invoiceEdit:priceList',
      on: { resource: INVOICES, record: 'PriceListCode' },
      immediate: false,
      handler: (value, api, previous) => {
        applyInvoiceEditPriceList(value, api, previous)
        syncInvoiceEdit(api, row)
      }
    },
    { key: 'invoiceEdit:dueDate', on: { resource: INVOICES, record: 'DueDate' }, immediate: false, handler: sync },
    { key: 'invoiceEdit:discountType', on: { resource: INVOICES, control: CTL.DISCOUNT_TYPE }, immediate: false, handler: sync },
    { key: 'invoiceEdit:discountValue', on: { resource: INVOICES, control: CTL.DISCOUNT_VALUE }, immediate: false, handler: sync }
  ]
}

/** Why the edit cannot be saved, or '' when it can. It builds nothing. */
export function invoiceEditBlock (pageState, stored = {}) {
  const row = asRow(stored)
  if (!text(row.Code)) return 'This invoice could not be loaded.'
  if (!canEditInvoice(row)) {
    return 'This invoice can no longer be edited — it has taken a payment or come to rest.'
  }

  const lines = lineRows(pageState)
  if (!lines.length) return 'This invoice has no items to price.'
  if (lines.some((line) => num(line.Price) < 0)) return 'A unit price cannot be negative.'

  const form = record(pageState)
  if (!text(form.DueDate)) return 'Set a due date for this invoice.'
  if (!text(form.PriceListCode)) return 'Choose a price list for this invoice.'

  const type = text(getCtl(pageState, CTL.DISCOUNT_TYPE, 'FLAT')) || 'FLAT'
  const value = num(getCtl(pageState, CTL.DISCOUNT_VALUE, 0))
  if (value < 0) return 'A discount cannot be negative.'
  if (type === 'PERCENT' && value > 100) return 'A percentage discount cannot be more than 100.'

  return ''
}

// Composable shape for setup-context callers. Same functions, one import (§5).
export function useInvoiceDraft () {
  return {
    INVOICE_CONTROL,
    buildInvoiceInitNodes,
    invoiceDraftDerivations,
    invoiceDraftBlock,
    invoiceDraftLines,
    syncInvoiceDraft,
    seedInvoiceLines,
    removeManualPart,
    applyInvoiceOutlet,
    invoiceableConsumptionsOf,
    creditableReturnsOf,
    creditedReturnRows,
    creditedReturnsOfInvoice,
    buildInvoiceEditInitNodes,
    invoiceEditDerivations,
    invoiceEditBlock,
    syncInvoiceEdit
  }
}
