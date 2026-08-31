// OutletConsumptionInvoices payloads. Layer 2. Raised here or from a consumption submit;
// both share one arithmetic engine and one return-adjustment builder.
import { batchRef, isBatchRef, textOrRef } from 'src/utils/appHelpers'
import { useAuth } from 'src/composables/core/useAuth'
import { resourceRow } from 'src/composables/resources/useResourceConfig'
import { stampFields } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionPayload'
// OutletReturns owns both directions of the return-credit link.
import {
  buildReturnInvoiceAdjustmentLinkedNodes,
  buildReturnInvoiceCreditReversalNodes
} from 'src/_resource/Operation/OutletReturns/composables/useReturnPayload'
import { calculateConsumptionInvoice, makeLineTaxResolver } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionInvoice'
import { priceOf, priceListForOutlet } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionStock'
import { dueDateFrom } from './useInvoiceCalculation'
import { useOutletOperatingRulesResource } from 'src/_resource/Master/OutletOperatingRules/composables/useOutletOperatingRulesResource'
import {
  buildTaxTransactionNodes,
  buildTaxTransactionReplacementNodes,
  buildTaxTransactionReversalNodes
} from 'src/_resource/Accounts/TaxTransactions/composables/useTaxTransactionPayload'
import { INVOICE_GENERATED } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionProgress'
import {
  validateInvoiceDraft,
  validateSettlement,
  settlementGate,
  transitionForBalance,
  progressOf,
  PENDING_PAYMENT
} from './useInvoiceWorkflow'
import { nodePayloadForParent, changedInvoiceItemRows } from 'src/_resource/Operation/OutletConsumptionInvoiceItems/composables/useInvoiceItemPayload'
const INVOICES = 'OutletConsumptionInvoices'
const INVOICE_ITEMS = 'OutletConsumptionInvoiceItems'
const CONSUMPTIONS = 'OutletConsumptions'
const PAYMENTS = 'OutletPayments'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const todayISO = () => new Date().toISOString().slice(0, 10)
const codeList = (values) => (Array.isArray(values) ? values : []).map(text).filter(Boolean)

/** The batch path an invoice's children chain their parent code off. */
export const INVOICE_REF_PATH = `${INVOICES}.latest.code`

const rowOf = (row) => asRow(row?.data ?? row)

// NODE builder: an invoice and its lines, fully priced and taxed here. Layer 3 passes
// `{ SKU, Qty }` and binds. `options.withDerive` (on by default) keeps totals in step.
export function invoiceNode (parent = {}, children = [], extra = {}, options = {}) {
  const { user } = useAuth()
  const { invoiceDueDaysOf } = useOutletOperatingRulesResource()

  const seed = { ...asRow(parent), ...asRow(extra) }
  const outletCode = text(seed.OutletCode)
  const date = text(seed.Date) || todayISO()
  const priceListCode = text(seed.PriceListCode) || text(priceListForOutlet(outletCode)?.code)
  const dueDate = text(seed.DueDate) || dueDateFrom(date, invoiceDueDaysOf(outletCode)) || date

  const lines = (Array.isArray(children) ? children : []).map(rowOf)
    .map((row) => ({ SKU: text(row.SKU), Qty: num(row.Qty) }))
    .filter((line) => line.SKU && line.Qty > 0)

  // The tax resolver needs the price too - without it every line taxes on zero.
  const resolvePrice = typeof options.resolvePrice === 'function' ? options.resolvePrice : priceOf

  // No lines means a header-only merge, so nothing is priced: zeroed totals would land on
  // top of lines the node already carries.
  const priced = lines.length
    ? calculateConsumptionInvoice({
      lines,
      priceListCode,
      discountType: text(seed.DiscountType) || 'FLAT',
      discountValue: num(seed.DiscountValue ?? seed.Discount),
      returnDeduction: num(seed.ReturnDeductionTotal),
      resolvePrice,
      calculateLineTax: options.calculateLineTax || makeLineTaxResolver({ priceListCode, resolvePrice })
    })
    : null

  // `Total` is calculated but never stored — the sheet has no such column.
  const { Total, ...totals } = priced?.header || {}

  const record = resourceRow(INVOICES,
    { Username: user.value?.name || '', Progress: PENDING_PAYMENT, Status: 'Active' },
    parent, extra,
    { Date: date, DueDate: dueDate, OutletCode: outletCode, PriceListCode: priceListCode, ...totals })

  const itemBucket = nodePayloadForParent(priced?.lines || [])

  return {
    resource: INVOICES,
    record,
    ...(itemBucket.length ? { children: itemBucket } : {}),
    permissions: { create: 'You are not allowed to create an invoice.' },
    ...(options.withDerive === false ? {} : { derive: invoiceCompositionDerive() })
  }
}

// The invoice a VISIT raises, seeded from the consumption and what it sold. The one place
// that says which consumption columns an invoice inherits, so no screen re-decides it.
// `existing` is the invoice as it stands, so a price list already picked survives a
// re-seed; a blank one falls back to the outlet's own default inside `invoiceNode`.
export function invoiceNodeForConsumption (consumption = {}, soldRows = [], { existing = {}, resolvePrice } = {}) {
  const entry = asRow(consumption)
  const lines = (Array.isArray(soldRows) ? soldRows : []).map(asRow)
    .map((row) => ({ SKU: text(row.SKU), Qty: num(row.Qty) }))
    .filter((row) => row.SKU && row.Qty > 0)
  if (!lines.length) return null
  return invoiceNode({
    ...asRow(existing),
    OutletCode: text(entry.OutletCode),
    Date: text(entry.Date),
    Username: text(entry.Username)
  }, lines, {}, resolvePrice ? { resolvePrice } : {})
}

// ─── The invoice while it is being COMPOSED in pageState ─────────────────────

const DISCOUNT_TYPE = 'DiscountType'
const DISCOUNT_VALUE = 'DiscountValue'

const blank = (value) => value === '' || value === null || value === undefined

// The price a line is BILLED at: what the officer typed on the row, else the price list's.
// A RESOLVER rather than pre-priced lines, so the typed price flows through tax and
// discount apportionment inside the one engine.
export function makeInvoiceLinePriceResolver (rows = []) {
  const typed = new Map((Array.isArray(rows) ? rows : []).map(rowOf)
    .map((row) => [text(row.SKU), row.Price]))
  return (sku, listCode) => {
    const value = typed.get(text(sku))
    return blank(value) ? priceOf(sku, listCode) : num(value)
  }
}

// Layer 2 recalculation over the live node: the line rows carry the prices, so one engine
// call refreshes every line figure and every header total.
export function repriceInvoiceInPageState (pageState) {
  const record = pageState.getRecord(null, INVOICES)
  if (!record) return

  const rows = pageState.getChildRows(INVOICE_ITEMS, INVOICES)
  if (!rows.length) return

  const priceListCode = text(record.PriceListCode)
  const resolvePrice = makeInvoiceLinePriceResolver(rows)

  const priced = calculateConsumptionInvoice({
    lines: rows.map((row) => ({ SKU: row.SKU, Qty: row.Qty })),
    priceListCode,
    discountType: text(pageState.getControls(DISCOUNT_TYPE, 'FLAT', INVOICES)) || 'FLAT',
    discountValue: num(pageState.getControls(DISCOUNT_VALUE, 0, INVOICES)),
    returnDeduction: num(record.ReturnDeductionTotal),
    resolvePrice,
    calculateLineTax: makeLineTaxResolver({ priceListCode, resolvePrice })
  })

  const bySku = new Map(priced.lines.map((line) => [text(line.SKU), line]))
  rows.forEach((row, index) => {
    const line = bySku.get(text(row.SKU))
    if (!line) return
    const figures = {
      Price: line.Price,
      Total: line.Total,
      Discount: line.Discount,
      TaxableAmount: line.TaxableAmount,
      TaxAmount: line.TaxAmount,
      TaxCode: line.TaxCode
    }
    // Only what MOVED: an unchanged write would re-trigger the watcher that called this.
    const moved = Object.keys(figures).filter((key) => row[key] !== figures[key])
    if (moved.length) {
      pageState.setChildren(INVOICE_ITEMS, index, null,
        Object.fromEntries(moved.map((key) => [key, figures[key]])), INVOICES)
    }
  })

  // `Total` is derived by readers and the deduction is not this screen's to move.
  const { Total, ReturnDeductionTotal, ...totals } = priced.header
  pageState.setRecord(null, totals, INVOICES)
}

// What the composed invoice depends on: its own lines, its price list, its discount terms.
export function invoiceCompositionDerive () {
  const reprice = (value, pageState) => repriceInvoiceInPageState(pageState)
  return [
    { on: { resource: INVOICES, children: INVOICE_ITEMS }, handler: reprice },
    { on: { resource: INVOICES, control: DISCOUNT_TYPE }, handler: reprice },
    { on: { resource: INVOICES, control: DISCOUNT_VALUE }, handler: reprice },
    { on: { resource: INVOICES, field: 'PriceListCode' }, handler: (value, pageState, previous) => {
      // A different list re-prices every line: the typed prices were for the old one.
      if (previous !== undefined && text(previous) !== text(value)) {
        pageState.getChildRows(INVOICE_ITEMS, INVOICES).forEach((row, index) =>
          pageState.setChildren(INVOICE_ITEMS, index, 'Price',
            priceOf(row.SKU, text(value)) ?? 0, INVOICES))
      }
      repriceInvoiceInPageState(pageState)
    } }
  ]
}

// ─── 1. Generating an invoice ─────────────────────────────────────────────────

// THE one writer of an invoice document. The standalone page and the consumption wizard
// both come through here, so they cannot drift on what an invoice is.
export function buildInvoiceDocumentNodes ({
  invoice = null,
  outletCode = '',
  username = '',
  priceListCode = '',
  invoiceDate = '',
  dueDate = '',
  consumptionRef = '',
  markConsumptions = [],
  returnCodes = [],
  linkReturnRows = null,
  actorName = '',
  comment = '',
  // The LIVE path holds the lines in the node already and prices them in place, so it asks
  // for the header and the dependent tail only. Re-stating the bucket there would splice
  // the same rows back on every pass and the children watcher would never settle.
  withItems = true
} = {}) {
  if (!invoice?.lines?.length) {
    return [{ valid: false, message: 'Nothing on this invoice could be priced. Check the price list covers these SKUs.' }]
  }

  // A line the price list does not cover bills at zero, and the sheet rejects it with
  // "Price is required" AFTER the consumption stamps have already gone out. Stop here.
  const unpriced = invoice.lines.filter((line) => line.Unpriced).map((line) => text(line.SKU))
  if (unpriced.length) {
    return [{ valid: false, message: `No price for ${unpriced.join(', ')} in this price list. Add the price, or remove the item.` }]
  }

  const date = text(invoiceDate) || todayISO()
  const marks = codeList((Array.isArray(markConsumptions) ? markConsumptions : [])
    .filter((code) => !isBatchRef(code) && !String(code).startsWith('$ref:')))

  // `Total` is CALCULATED but not STORED - the sheet has no such column, and every reader
  // derives it from the six stored figures (`netPayableOf`).
  const { Total, ...storedTotals } = invoice.header

  const header = {
    OutletConsumptionCode: textOrRef(consumptionRef),
    Date: date,
    DueDate: text(dueDate) || date,
    OutletCode: text(outletCode),
    Username: text(username),
    PriceListCode: text(priceListCode),
    // Spread whole, so no column is ever assembled from a figure the engine did not make.
    ...storedTotals,
    OutletReturnCodes: (Array.isArray(returnCodes) ? returnCodes : []).map(text).filter(Boolean).join(','),
    SettlementMismatchAmount: 0,
    SettlementReason: '',
    Progress: 'PENDING_PAYMENT',
    ...stampFields('ProgressPendingPayment', actorName, text(comment) || 'Invoice generated from outlet consumptions.'),
    Status: 'Active'
  }


  // One role per code, or these collapse onto the consumption node the same batch creates.
  // An update, not a bulk: GAS reads a bulk as an upload.
  const markGenerated = marks.map((code, index) => ({
    resource: CONSUMPTIONS,
    role: `invoiceGenerated${index}`,
    code: textOrRef(code),
    record: {
      Progress: INVOICE_GENERATED,
      ...stampFields('ProgressInvoiceGenerated', actorName, 'Invoice generated from pending outlet consumption.')
    },
    reload: [CONSUMPTIONS]
  , permissions: { update: 'You are not allowed to update this outlet consumption.' }}))

  // Points at the invoice by $ref: its code does not exist until GAS commits the create.
  const ledger = buildTaxTransactionNodes({
    resource: INVOICES,
    resourceCode: batchRef(INVOICE_REF_PATH),
    date,
    counterPartyType: 'Outlet',
    counterPartyCode: text(outletCode),
    taxBreakdown: invoice.taxBreakdown
  })

  const credits = Array.isArray(linkReturnRows) ? linkReturnRows : []
  // `[]`, not `{ nodes: [] }` — this list is SPREAD below, and an object threw
  // "linked is not iterable" for every invoice raised without a return credit.
  const linked = credits.length
    ? buildReturnInvoiceAdjustmentLinkedNodes({ returnRows: credits, invoiceCode: batchRef(INVOICE_REF_PATH), actorName })
    : []

  // ONE composite: the header and its lines land together, and GAS writes the parent code
  // onto every child itself. The totals on `header` come from the one engine above, so no
  // reader has to add the lines up a second time.
  return [
    {
      resource: INVOICES,
      record: header,
      // Without the lines this is a MERGE onto the node the page already holds - it must
      // not replace, or the children go with it.
      ...(withItems ? { children: nodePayloadForParent(invoice.lines) } : { merge: true }),
      reload: [INVOICES],
      permissions: { create: 'You are not allowed to create an invoice.' },
      successMsg: 'Invoice generated.'
    },
    ...ledger,
    ...markGenerated,
    ...linked
  ]
}

// Header, then items, then the consumption and return marks. The order is the contract:
// nothing may claim an invoice that a later request in the batch could fail to write.
export function buildInvoiceGenerationNodes ({
  outletCode = '',
  username = '',
  actorName = '',
  date = '',
  dueDate = '',
  priceListCode = '',
  lines = [],
  consumptionCodes = [],
  returnRows = [],
  discountType = 'FLAT',
  discountValue = 0,
  comment = '',
  withItems = true,
  calculateLineTax = null,
  // A RESOLVER, not pre-priced lines: the override then flows through tax and discount
  // apportionment inside the one engine.
  resolvePrice = null
} = {}) {
  const invoiceDate = text(date) || todayISO()
  const consumptions = codeList(consumptionCodes)
  const credits = (Array.isArray(returnRows) ? returnRows : []).map(asRow).filter((row) => text(row.Code))

  // The credit an outlet's uninvoiced returns are worth. Summed here rather than passed in,
  // so the deduction on the bill and the returns marked adjusted below can never describe
  // different sets of rows.
  const returnDeduction = credits.reduce((sum, row) => sum + (num(row.Qty) * num(row.Price)), 0)

  const check = validateInvoiceDraft({ outletCode, priceListCode, lines, dueDate: text(dueDate) || invoiceDate })
  if (!check.valid) return [{ valid: false, message: check.message }]

  const invoice = calculateConsumptionInvoice({
    lines: check.lines,
    priceListCode,
    discountType,
    discountValue,
    returnDeduction,
    calculateLineTax,
    // Only forwarded when supplied: the engine defaults this parameter to its own price
    // lookup, and passing `null` would override that default with nothing.
    ...(typeof resolvePrice === 'function' ? { resolvePrice } : {})
  })

  // Every consumption here already exists, so the header carries real codes.
  return buildInvoiceDocumentNodes({
    invoice,
    outletCode,
    username,
    priceListCode,
    invoiceDate,
    dueDate,
    consumptionRef: consumptions.join(','),
    markConsumptions: consumptions,
    returnCodes: credits.map((row) => text(row.Code)),
    linkReturnRows: credits,
    actorName,
    comment,
    withItems
  })
}

// ─── 2. The state walk a balance implies ─────────────────────────────────────

// The invoice's own transition, for whoever moved the balance. No transition yields no
// node - re-stamping ProgressPaidAt would overwrite the real settlement time.
export function buildInvoiceBalanceTransitionNodes ({
  record = {},
  balance = 0,
  actorName = '',
  comment = ''
} = {}) {
  const invoice = asRow(record)
  const code = text(invoice.Code)
  if (!code) return [{ valid: false, message: 'The invoice could not be identified.' }]

  const transition = transitionForBalance(invoice, balance)
  if (!transition) return []

  return [
    { resource: INVOICES, actions: [{ ...{
      action: transition.action, column: 'Progress', columnValue: transition.columnValue
    }, code: textOrRef(code), data: { fields: stampFields(transition.stamp, actorName, text(comment) || transition.comment) } }], reload: [INVOICES] }
  ]
}

// ─── 3. Forced settlement ─────────────────────────────────────────────────────

// The one route from a leftover balance to PAID. Money alone never closes such an invoice,
// so every write-off comes through here and leaves a reason behind it.
export function buildSettlementNodes ({
  record = {},
  reason = '',
  comment = '',
  mismatchAmount = null,
  balanceDue = null,
  payments = null,
  actorName = ''
} = {}) {
  const invoice = asRow(record)
  const code = text(invoice.Code)
  if (!code) return [{ valid: false, message: 'The invoice could not be identified.' }]

  const gate = settlementGate(invoice, Array.isArray(payments) ? payments : [])
  if (!gate.allowed) return [{ valid: false, message: gate.reason }]

  const owed = Array.isArray(payments) || balanceDue === null ? gate.balance : num(balanceDue)

  const check = validateSettlement({ record: invoice, reason, comment, mismatchAmount, balanceDue: owed })
  if (!check.valid) return [{ valid: false, message: check.message }]

  const note = text(comment) || `Settled: ${check.settlement.SettlementReason}.`

  // The audited action, not a plain field write: GAS gates it on `markPaid`, so a role
  // granted settlement without record-edit rights can still close the invoice.
  return [
    { resource: INVOICES, actions: [{
      action: 'MarkPaid', column: 'Progress', columnValue: 'PAID',
      code: textOrRef(code),
      data: { fields: {
        SettlementReason: check.settlement.SettlementReason,
        SettlementMismatchAmount: check.settlement.SettlementMismatchAmount,
        ...stampFields('ProgressPaid', actorName, note)
      } }
    }], reload: [INVOICES], permissions: { markPaid: 'You are not allowed to settle this invoice.' }, successMsg: 'Invoice settled.' }
  ]
}

// ─── 4. Cancellation ──────────────────────────────────────────────────────────

// Cancel an invoice and release everything it held. Without the reversal the consumptions
// and returns stay locked to an invoice that no longer bills them.
export function buildCancellationNodes ({ record = {}, comment = '', actorName = '', returnRows = [], taxTransactionRows = null, releaseConsumptions = true } = {}) {
  const invoice = asRow(record)
  const code = text(invoice.Code)
  if (!code) return [{ valid: false, message: 'The invoice could not be identified.' }]
  if (!text(comment)) return [{ valid: false, message: 'A cancellation comment is required.' }]

  const consumptions = codeList(text(invoice.OutletConsumptionCode).split(','))
  const credits = (Array.isArray(returnRows) ? returnRows : []).map(asRow).filter((row) => text(row.Code))

  const nodes = [{ resource: INVOICES, actions: [{ ...{
    action: 'Cancel', column: 'Progress', columnValue: 'CANCELLED'
  }, code: textOrRef(code), data: { fields: stampFields('ProgressCancelled', actorName, text(comment)) } }], reload: [INVOICES] }]

  // One queued action per consumption, each keyed by its own code. Skipped when the
  // CONSUMPTION is what is being cancelled - walking it back to invoiceable would undo
  // the cancellation that triggered this.
  const released = releaseConsumptions ? consumptions : []
  released.forEach((consumptionCode) => {
    nodes.push({ resource: CONSUMPTIONS, actions: [{ ...{
      action: 'MarkPendingInvoiceGeneration', column: 'Progress', columnValue: 'PENDING_INVOICE_GENERATION'
    }, code: textOrRef(consumptionCode), data: { fields: stampFields('ProgressPendingInvoiceGeneration', actorName, `Invoice ${code} cancelled; consumption is invoiceable again.`) } }], reload: [CONSUMPTIONS] })
  })

  // Reversing the credit is the OutletReturns domain's own inverse of the forward link, so
  // both directions are written by one owner and cannot drift apart.
  nodes.push(...buildReturnInvoiceCreditReversalNodes({ returnRows: credits }))

  // A cancelled invoice charged nothing, so its ledger rows must leave the return.
  const ledger = buildTaxTransactionReversalNodes({ existingRows: taxTransactionRows || [] })
  nodes.push(...ledger)

  return nodes
}

// ─── 5. Editing an issued invoice ─────────────────────────────────────────────

/** The active line items an edit works over. One definition, shared by cards and builder. */
export function editableInvoiceItems (record = {}) {
  const children = asRow(record).$OutletConsumptionInvoiceItems
  return (Array.isArray(children) ? children : [])
    .map(asRow)
    .filter((item) => text(item.SKU) && text(item.Status || 'Active').toUpperCase() === 'ACTIVE')
}

// The sheet stores only a resolved `Discount`, so an edit always reopens as FLAT.
export function invoiceEditDefaults (record = {}) {
  const row = asRow(record)
  return {
    dueDate: text(row.DueDate) || text(row.Date),
    discountType: 'FLAT',
    discountValue: num(row.Discount),
    priceListCode: text(row.PriceListCode)
  }
}

// Override, then the chosen price list, then the stored price. The list is read only when
// it CHANGED - an invoice is historical and must not re-price on its own.
export function makeStoredPriceResolver (items = [], overrides = {}, { priceListCode = '', issuedPriceListCode = '' } = {}) {
  const stored = new Map((Array.isArray(items) ? items : [])
    .map(asRow)
    .map((item) => [text(item.SKU), num(item.Price)]))
  const typed = overrides && typeof overrides === 'object' ? overrides : {}

  const chosen = text(priceListCode)
  const switched = !!chosen && chosen !== text(issuedPriceListCode)

  return (sku) => {
    const key = text(sku)
    const override = typed[key]
    if (override !== undefined && override !== null && override !== '') return num(override)

    const fallback = stored.has(key) ? stored.get(key) : 0
    if (!switched) return fallback

    const listed = priceOf(key, chosen)
    return listed === null || listed === undefined ? fallback : num(listed)
  }
}

/** One engine call, shared by the Edit summary card and the builder below. */
export function recalculateStoredInvoice ({
  record = {},
  items = [],
  discountType = 'FLAT',
  discountValue = 0,
  priceListCode = '',
  priceOverrides = {},
  calculateLineTax = null
} = {}) {
  const row = asRow(record)
  const issued = text(row.PriceListCode)
  // Blank means unchanged, not "no list".
  const chosen = text(priceListCode) || issued
  const resolvePrice = makeStoredPriceResolver(items, priceOverrides, {
    priceListCode: chosen,
    issuedPriceListCode: issued
  })

  return calculateConsumptionInvoice({
    lines: (Array.isArray(items) ? items : []).map(asRow).map((item) => ({ SKU: item.SKU, Qty: item.Qty })),
    priceListCode: chosen,
    discountType,
    discountValue,
    // Returns are not editable here; carried through so the payable still nets them off.
    returnDeduction: num(row.ReturnDeductionTotal),
    resolvePrice,
    // Built from THIS resolver when the caller gives none. A tax resolver without the
    // price taxes every line on zero, so it is not left to each caller to remember.
    calculateLineTax: calculateLineTax || makeLineTaxResolver({ priceListCode: chosen, resolvePrice })
  })
}


const sameMoney = (a, b) => Math.abs(num(a) - num(b)) < 0.000001

// One batch: the header totals plus an update per line whose figures moved. Unchanged
// lines are dropped so a one-price fix does not write dozens of audit rows.
export function buildInvoiceUpdateNodes ({
  record = {},
  items = null,
  dueDate = undefined,
  discountType = undefined,
  discountValue = undefined,
  priceListCode = undefined,
  priceOverrides = {},
  calculateLineTax = null,
  // Passed in, not looked up: builders stay store-free. Omitted, the ledger is untouched.
  taxTransactionRows = null
} = {}) {
  const row = asRow(record)
  const code = text(row.Code)
  if (!code) return [{ valid: false, message: 'The invoice could not be identified.' }]

  if (progressOf(row) !== PENDING_PAYMENT) {
    return [{ valid: false, message: 'This invoice can no longer be edited — it has been paid, part-paid or cancelled.' }]
  }

  const lines = Array.isArray(items) ? items.map(asRow) : editableInvoiceItems(row)
  if (!lines.length) return [{ valid: false, message: 'This invoice has no items to price.' }]

  const defaults = invoiceEditDefaults(row)
  const terms = {
    dueDate: text(dueDate) || defaults.dueDate,
    discountType: text(discountType) || defaults.discountType,
    discountValue: discountValue === undefined || discountValue === null || discountValue === ''
      ? defaults.discountValue
      : num(discountValue),
    priceListCode: text(priceListCode) || defaults.priceListCode
  }

  if (!terms.dueDate) return [{ valid: false, message: 'Set a due date for this invoice.' }]
  if (!terms.priceListCode) return [{ valid: false, message: 'Choose a price list for this invoice.' }]
  if (terms.discountValue < 0) return [{ valid: false, message: 'A discount cannot be negative.' }]
  if (terms.discountType === 'PERCENT' && terms.discountValue > 100) {
    return [{ valid: false, message: 'A percentage discount cannot be more than 100.' }]
  }

  const priceFor = makeStoredPriceResolver(lines, priceOverrides, {
    priceListCode: terms.priceListCode,
    issuedPriceListCode: defaults.priceListCode
  })
  if (lines.some((item) => priceFor(item.SKU) < 0)) {
    return [{ valid: false, message: 'A unit price cannot be negative.' }]
  }

  const invoice = recalculateStoredInvoice({
    record: row,
    items: lines,
    discountType: terms.discountType,
    discountValue: terms.discountValue,
    priceListCode: terms.priceListCode,
    priceOverrides,
    calculateLineTax
  })

  // Neither is written: `Total` is derived by readers, and returns are not editable here.
  const { Total, ReturnDeductionTotal, ...storedTotals } = invoice.header

  // No progress stamp is rewritten: those columns say why the invoice was RAISED, and the
  // resource's audit columns already record who edited it.
  const nodes = [{ resource: INVOICES, code: textOrRef(code), record: {
    DueDate: terms.dueDate,
    PriceListCode: terms.priceListCode,
    ...storedTotals
  }, reload: [INVOICES] }]

  const ledger = Array.isArray(taxTransactionRows)
    ? buildTaxTransactionReplacementNodes({
      existingRows: taxTransactionRows,
      resource: INVOICES,
      resourceCode: code,
      date: text(row.Date),
      counterPartyType: 'Outlet',
      counterPartyCode: text(row.OutletCode),
      taxBreakdown: invoice.taxBreakdown
    })
    : []

  nodes.push(...ledger)

  // Which rows actually moved is the ITEM resource's own question.
  const itemRecords = changedInvoiceItemRows(lines, invoice.lines, sameMoney)
  if (itemRecords.length) {
    nodes.push({ resource: INVOICE_ITEMS, many: true, records: itemRecords, reload: [INVOICE_ITEMS], permissions: { update: 'You are not allowed to update invoice items.' } })
  }

  nodes[0].permissions = { update: 'You are not allowed to edit this invoice.' }
  nodes[0].successMsg = 'Invoice updated.'
  return nodes
}

// Composable shape for setup-context callers. Same functions, one import (§5).
export function useInvoicePayload () {
  return {
    INVOICE_REF_PATH,
    invoiceNode,
    invoiceNodeForConsumption,
    buildInvoiceGenerationNodes,
    buildInvoiceBalanceTransitionNodes,
    buildSettlementNodes,
    buildCancellationNodes,
    buildInvoiceUpdateNodes,
    invoiceCompositionDerive,
    repriceInvoiceInPageState,
    makeInvoiceLinePriceResolver,
    recalculateStoredInvoice,
    makeStoredPriceResolver,
    editableInvoiceItems,
    invoiceEditDefaults
  }
}
