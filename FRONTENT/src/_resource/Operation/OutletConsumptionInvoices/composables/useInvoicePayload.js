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
import { toDateTime24 } from 'src/utils/dateHelpers'
import { dueDateFrom } from './useInvoiceCalculation'
import { useOutletOperatingRulesResource } from 'src/_resource/Master/OutletOperatingRules/composables/useOutletOperatingRulesResource'
import {
  TAX_TRANSACTION_RESOURCES,
  buildTaxTransactionNodes,
  buildTaxTransactionReversalNodes
} from 'src/_resource/Accounts/TaxTransactions/composables/useTaxTransactionPayload'
import {
  INVOICE_GENERATED,
  PENDING_INVOICE_GENERATION,
  consumptionCodesOf
} from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionProgress'
import {
  validateInvoiceDraft,
  settlementGate,
  transitionForBalance,
  PENDING_PAYMENT,
  PAID,
  PARTIALLY_PAID,
  CANCELLED,
  progressOf
} from './useInvoiceWorkflow'
import { nodePayloadForParent } from 'src/_resource/Operation/OutletConsumptionInvoiceItems/composables/useInvoiceItemPayload'
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

// One wording for a raised invoice, whether the node chain reports it or the page does.
export const INVOICE_GENERATED_MESSAGE = 'Invoice generated.'

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
// The nodes this document raises BESIDE the invoice. Each one `$ref`s the invoice's code,
// so a caller that drops the invoice must drop these or the batch keeps a dangling ref.
export const INVOICE_DOCUMENT_COMPANIONS = TAX_TRANSACTION_RESOURCES.map((resource) => ({ resource }))

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
      successMsg: INVOICE_GENERATED_MESSAGE
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

// The invoice's own transition, for whoever moved the balance.
export function buildInvoiceBalanceTransitionNodes ({
  record = {},
  balance = 0,
  actorName = '',
  comment = '',
  amount = 0
} = {}) {
  const invoice = asRow(record)
  const code = text(invoice.Code || invoice.code)
  if (!code) return [{ valid: false, message: 'The invoice could not be identified.' }]

  const numBal = num(balance)
  const numAmt = num(amount)
  const actor = text(actorName) || 'System'
  const entry = toDateTime24(new Date()) + ' - Amount: ' + numAmt.toFixed(2) + ' by ' + actor + ', Balance: ' + numBal.toFixed(2)

  const transition = transitionForBalance(invoice, numBal)

  if (!transition && progressOf(invoice) === PARTIALLY_PAID && numBal > 0) {
    const existing = text(invoice.ProgressPartiallyPaidComment)
    const combined = existing ? (existing + '\n' + entry) : entry
    return [{
      resource: INVOICES,
      code: textOrRef(code),
      record: {
        Progress: PARTIALLY_PAID,
        ProgressPartiallyPaidAt: toDateTime24(new Date()),
        ProgressPartiallyPaidBy: actor,
        ProgressPartiallyPaidComment: combined
      },
      reload: [INVOICES]
    }]
  }

  if (!transition) return []

  const commentKey = transition.stamp + 'Comment'
  const existing = text(invoice[commentKey])
  const combined = existing ? (existing + '\n' + entry) : entry
  const stamp = {
    ...stampFields(transition.stamp, actor, combined),
    [commentKey]: combined
  }

  if (transition.columnValue !== PAID) {
    return [{
      resource: INVOICES,
      code: textOrRef(code),
      record: { Progress: transition.columnValue, ...stamp },
      reload: [INVOICES]
    }]
  }

  return [
    { resource: INVOICES, actions: [{
      action: 'SettleInvoice', column: 'Progress', columnValue: PAID,
      code: textOrRef(code), data: { fields: stamp }
    }], reload: [INVOICES] }
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

  // A blank amount means the whole gap, which is what almost every settlement writes off.
  const mismatch = mismatchAmount === null || mismatchAmount === '' ? num(owed) : num(mismatchAmount)
  const note = text(comment) || (text(reason) ? `Settled: ${text(reason)}.` : 'Invoice settled.')

  // A pure record node, not a queued action: the page keeps this batch standing while the
  // reason is chosen, so submit sends it as it is. The missing reason is the bar's gate —
  // refusing here would leave the page with no nodes to show.
  return [{
    resource: INVOICES,
    code: textOrRef(code),
    record: {
      Progress: PAID,
      SettlementReason: text(reason),
      SettlementMismatchAmount: mismatch,
      ...stampFields('ProgressPaid', actorName, note)
    },
    reload: [INVOICES],
    permissions: { settleInvoice: 'You are not allowed to settle this invoice.' },
    successMsg: 'Invoice settled.'
  }]
}

// ─── 4. Cancellation ──────────────────────────────────────────────────────────

// Cancel an invoice and release everything it held. Without the reversal the consumptions
// and returns stay locked to an invoice that no longer bills them.
export function buildCancellationNodes ({
  record = {},
  comment = '',
  actorName = '',
  returnRows = [],
  taxTransactionRows = null,
  skipConsumptionCodes = []
} = {}) {
  const invoice = asRow(record)
  const code = text(invoice.Code)
  if (!code) return [{ valid: false, message: 'The invoice could not be identified.' }]

  const credits = (Array.isArray(returnRows) ? returnRows : []).map(asRow).filter((row) => text(row.Code))

  // A pure record node, not a queued action: the page keeps this batch standing while the
  // reason is typed, so submit sends it as it is. The empty reason is the bar's gate, not
  // this builder's — refusing here would leave the page with no nodes to show.
  const nodes = [{
    resource: INVOICES,
    code: textOrRef(code),
    record: {
      Progress: CANCELLED,
      ...stampFields('ProgressCancelled', actorName, text(comment))
    },
    reload: [INVOICES],
    permissions: { cancel: 'You are not allowed to cancel this invoice.' },
    successMsg: 'Invoice cancelled.'
  }]

  // The bill no longer bills them, so every consumption it carried goes back to the
  // invoiceable queue. `skipConsumptionCodes` is how a caller that is CANCELLING one of
  // those consumptions keeps this from un-cancelling it.
  const skipped = new Set(codeList(skipConsumptionCodes))
  consumptionCodesOf(invoice)
    .filter((consumptionCode) => !skipped.has(consumptionCode))
    // One role per code, or these collapse onto one node.
    .forEach((consumptionCode, index) => nodes.push({
      resource: CONSUMPTIONS,
      role: `consumptionPending${index}`,
      code: textOrRef(consumptionCode),
      record: {
        Progress: PENDING_INVOICE_GENERATION,
        ...stampFields('ProgressPendingInvoiceGeneration', actorName,
          `Invoice ${code} cancelled, makes consumption back to pending..`)
      },
      reload: [CONSUMPTIONS],
      permissions: { update: 'You are not allowed to update consumptions.' }
    }))

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

// Composable shape for setup-context callers. Same functions, one import (§5).
export function useInvoicePayload () {
  return {
    INVOICE_REF_PATH,
    INVOICE_GENERATED_MESSAGE,
    invoiceNode,
    invoiceNodeForConsumption,
    buildInvoiceGenerationNodes,
    buildInvoiceBalanceTransitionNodes,
    buildSettlementNodes,
    buildCancellationNodes,
    invoiceCompositionDerive,
    repriceInvoiceInPageState,
    makeInvoiceLinePriceResolver,
    editableInvoiceItems,
    invoiceEditDefaults
  }
}
