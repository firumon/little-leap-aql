/**
 * OutletConsumptionInvoices › the batch payloads an invoice writes — Layer 2.
 *
 * ── HOW THIS DIFFERS FROM THE CONSUMPTION-SIDE BUILDER ──
 * `OutletConsumptions/composables/useConsumptionPayload.js` already builds an invoice, for
 * the case where the consumption and its invoice are created in ONE submit. There, the
 * consumption's code does not exist yet, so the invoice's `OutletConsumptionCode` is a
 * `batchRefList` that GAS resolves.
 *
 * This module builds the OTHER case: an invoice raised from this resource's own Add page,
 * over consumptions that were recorded earlier and already have codes. Nothing is
 * unresolved, so nothing is a `$ref` except the invoice's own code, which its line items
 * chain off.
 *
 * The two are separate builders because their reference topology genuinely differs — but
 * they share the ONE arithmetic engine and the ONE return-adjustment builder, both imported
 * below rather than restated (UI_RESOURCE_DOMAIN_LOGIC.md §8.3).
 *
 * ── THE ENVELOPE ──
 * Every builder here returns the canonical `{ valid, nodes, permissions, message,
 * successMsg }` (§9.2), so Layer 3 does one `allowed(result.permissions)` check and hands
 * `result.nodes` straight to `pageState.applyNodes()` — it never inspects, reorders or adds
 * to them (§9.1, Zero UI Schema Invention).
 *
 * PURE (§9.6): no reactivity, no injects, no stores. Every record it needs is an argument.
 */

import { batchRef, textOrRef } from 'src/utils/appHelpers'
import { actionNode, bulkNode, createNode, derive, deriveNode, updateNode } from 'src/composables/resources/nodePayloads'
import { stampFields } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionPayload'
/**
 * The OutletReturns domain owns both directions of the return-credit link (§9.1).
 *
 * An invoice DECIDES which returns it credits — that is an invoicing question. What
 * crediting does to a return row, and whether the row is thereby reconciled, is
 * OutletReturns' own rule, read here rather than restated.
 */
import {
  buildReturnInvoiceAdjustmentLinkedNodes,
  buildReturnInvoiceCreditReversalNodes
} from 'src/_resource/Operation/OutletReturns/composables/useReturnPayload'
import { calculateConsumptionInvoice } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionInvoice'
import { priceOf } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionStock'
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
import { buildInvoiceItemNodes, changedInvoiceItemRows } from 'src/_resource/Operation/OutletConsumptionInvoiceItems/composables/useInvoiceItemPayload'
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

// ─── 1. Generating an invoice ─────────────────────────────────────────────────

// THE one writer of an invoice document. Both the standalone generation page and the
// consumption wizard come through here, so the two cannot drift on what an invoice is.
//
// `consumptionRef` is what the header points at: real codes as a CSV, or a $ref when the
// consumption is created in this same batch. `markConsumptions` are the rows walked to
// INVOICE_GENERATED - a plain update, never executeAction('MarkInvoiceGenerated'), whose
// `targets` block in syncAppResources.gs would create a SECOND, empty invoice beside the
// real one this batch already wrote.
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
  comment = ''
} = {}) {
  if (!invoice?.lines?.length) {
    return { valid: false, nodes: [], permissions: {}, message: 'Nothing on this invoice could be priced. Check the price list covers these SKUs.' }
  }

  const date = text(invoiceDate) || todayISO()
  const marks = codeList(markConsumptions)

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


  const markGenerated = marks.length
    ? [bulkNode(CONSUMPTIONS, marks.map((code) => ({
      Code: textOrRef(code),
      Progress: INVOICE_GENERATED,
      ...stampFields('ProgressInvoiceGenerated', actorName, 'Invoice generated from pending outlet consumption.')
    })), [CONSUMPTIONS])]
    : []

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
  const linked = credits.length
    ? buildReturnInvoiceAdjustmentLinkedNodes({ returnRows: credits, invoiceCode: batchRef(INVOICE_REF_PATH), actorName })
    : { nodes: [] }

  return {
    valid: true,
    nodes: [
      createNode(INVOICES, header, [INVOICES]),
      ...buildInvoiceItemNodes(invoice.lines, batchRef(INVOICE_REF_PATH)).nodes,
      ...ledger.nodes,
      ...markGenerated,
      ...linked.nodes,
      // The stored totals follow the line items, so an edit to a row in pageState cannot
      // leave the header claiming a figure nothing adds up to.
      deriveNode(INVOICES, [derive(
        { resource: INVOICE_ITEMS, records: true },
        (rows, pageState) => {
          const sum = (key) => (rows || []).reduce((total, row) => total + num(row?.data?.[key]), 0)
          pageState.setFields(INVOICES, {
            Subtotal: sum('Total'),
            TotalTaxableAmount: sum('TaxableAmount'),
            TotalTaxAmount: sum('TaxAmount')
          })
        }
      )])
    ],
    permissions: {
      outletConsumptionInvoice: 'create',
      ...(marks.length ? { outletConsumption: 'update' } : {}),
      ...(credits.length ? { outletReturn: 'update' } : {}),
      ...ledger.permissions
    },
    successMsg: 'Invoice generated.',
    invoice
  }
}

/**
 * The whole chain an invoice generation writes, in dependency order:
 *
 *   1. the invoice header,
 *   2. its line items, chained to the header by `$ref`,
 *   3. `MarkInvoiceGenerated` on every consumption the invoice covers,
 *   4. `InvoiceAdjustmentDone` on every return it credited.
 *
 * ORDER IS THE CONTRACT, not a preference (§9.3): the items reference a header that must
 * already exist, and the consumptions must not be walked to `INVOICE_GENERATED` until the
 * invoice they are claiming actually landed. GAS commits the array atomically, so a failure
 * anywhere leaves every consumption still invoiceable rather than pointing at an invoice
 * that was never written.
 *
 * The arithmetic is ONE call to the shared engine — the same call the wizard's review step
 * makes to display the figures. That is what makes the number the user agreed to and the
 * number the sheet stores the same number by construction (see `useConsumptionInvoice.js`).
 */
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
  calculateLineTax = null,
  // The UI's per-SKU price overrides, as a RESOLVER rather than pre-priced lines — the
  // override then flows through tax and discount apportionment inside the one engine
  // instead of the caller patching a total the engine never saw. Omitted, the engine falls
  // back to the price list.
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
  if (!check.valid) return { valid: false, message: check.message }

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
    comment
  })
}

// ─── 2. The state walk a balance implies ─────────────────────────────────────

// The invoice's OWN transition, for whoever moved the balance. OutletPayments writes the
// payment row and calls this rather than deciding MarkPaid/MarkPartiallyPaid itself, so
// the invoice's Progress and its payments can never tell different stories.
//
// No transition yields NO node: re-stamping ProgressPaidAt would overwrite the real
// settlement time with a later one.
export function buildInvoiceBalanceTransitionNodes ({
  record = {},
  balance = 0,
  actorName = '',
  comment = ''
} = {}) {
  const invoice = asRow(record)
  const code = text(invoice.Code)
  if (!code) return { valid: false, nodes: [], permissions: {}, message: 'The invoice could not be identified.' }

  const transition = transitionForBalance(invoice, balance)
  if (!transition) return { valid: true, nodes: [], permissions: {} }

  return {
    valid: true,
    nodes: [actionNode(INVOICES, code, {
      action: transition.action, column: 'Progress', columnValue: transition.columnValue
    }, stampFields(transition.stamp, actorName, text(comment) || transition.comment), { reload: [INVOICES] })],
    permissions: { outletConsumptionInvoice: transition.action }
  }
}

// ─── 3. Forced settlement ─────────────────────────────────────────────────────

/**
 * Close an invoice while a balance remains, recording why the gap was accepted.
 *
 * THE ONE ROUTE FROM A RESIDUE TO `PAID`. Money alone never closes an invoice that still
 * owes something (`progressForBalance`), so every write-off, rounding residue and accepted
 * underpayment arrives here and leaves a reason behind it.
 *
 * The mismatch and the reason go onto their own columns (`executeAction` writes any field
 * whose name matches a header), and the comment derives to `ProgressPaidComment` off the
 * action's stamp suffix. `validateSettlement` owns the rules — including the one GAS cannot
 * express, that `Other` demands a comment.
 *
 * Hand it `payments` — the invoice's own rows — and the balance is derived here rather than
 * trusted from the caller, so a stale figure typed into a screen cannot become the amount
 * written off. `balanceDue` remains accepted for a caller that already holds the joined
 * figure and no rows.
 */
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
  if (!code) return { valid: false, message: 'The invoice could not be identified.' }

  const gate = settlementGate(invoice, Array.isArray(payments) ? payments : [])
  if (!gate.allowed) return { valid: false, message: gate.reason }

  const owed = Array.isArray(payments) || balanceDue === null ? gate.balance : num(balanceDue)

  const check = validateSettlement({ record: invoice, reason, comment, mismatchAmount, balanceDue: owed })
  if (!check.valid) return { valid: false, message: check.message }

  const note = text(comment) || `Settled: ${check.settlement.SettlementReason}.`

  return {
    valid: true,
    nodes: [actionNode(INVOICES, code, {
      action: 'MarkPaid', column: 'Progress', columnValue: 'PAID'
    }, {
      SettlementReason: check.settlement.SettlementReason,
      SettlementMismatchAmount: check.settlement.SettlementMismatchAmount,
      ...stampFields('ProgressPaid', actorName, note)
    }, { reload: [INVOICES] })],
    // The action this dispatches, so a user who may update an invoice but may not force-settle
    // one is correctly refused.
    permissions: { outletConsumptionInvoice: 'MarkPaid' },
    successMsg: 'Invoice settled.'
  }
}

// ─── 4. Cancellation ──────────────────────────────────────────────────────────

/**
 * Cancel an invoice and RELEASE everything it was holding.
 *
 * Cancelling the header alone would strand both sides of the chain: the consumptions would
 * stay `INVOICE_GENERATED` against an invoice that no longer bills them, and the returns
 * would stay `InvoiceAdjustmentDone` against a credit nobody received — so neither could
 * ever be invoiced again. The reversal is part of the cancellation, in the same atomic
 * batch, which is why it lives in the builder rather than in whatever UI pressed the button.
 */
export function buildCancellationNodes ({ record = {}, comment = '', actorName = '', returnRows = [], taxTransactionRows = null, releaseConsumptions = true } = {}) {
  const invoice = asRow(record)
  const code = text(invoice.Code)
  if (!code) return { valid: false, message: 'The invoice could not be identified.' }
  if (!text(comment)) return { valid: false, message: 'A cancellation comment is required.' }

  const consumptions = codeList(text(invoice.OutletConsumptionCode).split(','))
  const credits = (Array.isArray(returnRows) ? returnRows : []).map(asRow).filter((row) => text(row.Code))

  const nodes = [actionNode(INVOICES, code, {
    action: 'Cancel', column: 'Progress', columnValue: 'CANCELLED'
  }, stampFields('ProgressCancelled', actorName, text(comment)), { reload: [INVOICES] })]

  // One queued action per consumption, each keyed by its own code. Skipped when the
  // CONSUMPTION is what is being cancelled - walking it back to invoiceable would undo
  // the cancellation that triggered this.
  const released = releaseConsumptions ? consumptions : []
  released.forEach((consumptionCode) => {
    nodes.push(actionNode(CONSUMPTIONS, consumptionCode, {
      action: 'MarkPendingInvoiceGeneration', column: 'Progress', columnValue: 'PENDING_INVOICE_GENERATION'
    }, stampFields('ProgressPendingInvoiceGeneration', actorName, `Invoice ${code} cancelled; consumption is invoiceable again.`), { reload: [CONSUMPTIONS] }))
  })

  // Reversing the credit is the OutletReturns domain's own inverse of the forward link, so
  // both directions are written by one owner and cannot drift apart.
  nodes.push(...buildReturnInvoiceCreditReversalNodes({ returnRows: credits }).nodes)

  // A cancelled invoice charged nothing, so its ledger rows must leave the return.
  const ledger = buildTaxTransactionReversalNodes({ existingRows: taxTransactionRows || [] })
  nodes.push(...ledger.nodes)

  return {
    valid: true,
    nodes,
    // Gated on the actions this chain actually DISPATCHES, not on a generic `update`: the
    // consumptions are walked back by `MarkPendingInvoiceGeneration`, so that is the
    // privilege the user needs.
    permissions: {
      outletConsumptionInvoice: 'cancel',
      ...(released.length ? { outletConsumption: 'MarkPendingInvoiceGeneration' } : {}),
      ...(credits.length ? { outletReturn: 'update' } : {}),
      ...ledger.permissions
    },
    successMsg: 'Invoice cancelled.'
  }
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

/**
 * Override, then the chosen price list, then the line's stored price. The list is only
 * consulted when it CHANGED: an invoice is historical, so an untouched line must not
 * re-price just because master data moved.
 */
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
    calculateLineTax
  })
}


const sameMoney = (a, b) => Math.abs(num(a) - num(b)) < 0.000001

/**
 * One atomic batch: the header totals, plus an update per line whose figures actually moved.
 * Unchanged lines are dropped so a one-price fix does not write dozens of audit rows.
 */
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
  if (!code) return { valid: false, message: 'The invoice could not be identified.' }

  if (progressOf(row) !== PENDING_PAYMENT) {
    return { valid: false, message: 'This invoice can no longer be edited — it has been paid, part-paid or cancelled.' }
  }

  const lines = Array.isArray(items) ? items.map(asRow) : editableInvoiceItems(row)
  if (!lines.length) return { valid: false, message: 'This invoice has no items to price.' }

  const defaults = invoiceEditDefaults(row)
  const terms = {
    dueDate: text(dueDate) || defaults.dueDate,
    discountType: text(discountType) || defaults.discountType,
    discountValue: discountValue === undefined || discountValue === null || discountValue === ''
      ? defaults.discountValue
      : num(discountValue),
    priceListCode: text(priceListCode) || defaults.priceListCode
  }

  if (!terms.dueDate) return { valid: false, message: 'Set a due date for this invoice.' }
  if (!terms.priceListCode) return { valid: false, message: 'Choose a price list for this invoice.' }
  if (terms.discountValue < 0) return { valid: false, message: 'A discount cannot be negative.' }
  if (terms.discountType === 'PERCENT' && terms.discountValue > 100) {
    return { valid: false, message: 'A percentage discount cannot be more than 100.' }
  }

  const priceFor = makeStoredPriceResolver(lines, priceOverrides, {
    priceListCode: terms.priceListCode,
    issuedPriceListCode: defaults.priceListCode
  })
  if (lines.some((item) => priceFor(item.SKU) < 0)) {
    return { valid: false, message: 'A unit price cannot be negative.' }
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
  const nodes = [updateNode(INVOICES, code, {
    DueDate: terms.dueDate,
    PriceListCode: terms.priceListCode,
    ...storedTotals
  }, [INVOICES])]

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
    : { nodes: [], permissions: {} }

  nodes.push(...ledger.nodes)

  const calculated = new Map(invoice.lines.map((line) => [text(line.SKU), line]))

  // Which rows actually moved is the ITEM resource's own question.
  const itemRecords = changedInvoiceItemRows(lines, invoice.lines, sameMoney)
  const itemUpdates = itemRecords.length
  if (itemUpdates) nodes.push(bulkNode(INVOICE_ITEMS, itemRecords, [INVOICE_ITEMS]))

  return {
    valid: true,
    nodes,
    permissions: {
      outletConsumptionInvoice: 'update',
      ...(itemUpdates ? { outletConsumptionInvoiceItem: 'update' } : {}),
      ...ledger.permissions
    },
    successMsg: 'Invoice updated.',
    invoice
  }
}

// Composable shape for setup-context callers. Same functions, one import (§5).
export function useInvoicePayload () {
  return {
    INVOICE_REF_PATH,
    buildInvoiceGenerationNodes,
    buildInvoiceBalanceTransitionNodes,
    buildSettlementNodes,
    buildCancellationNodes,
    buildInvoiceUpdateNodes,
    recalculateStoredInvoice,
    makeStoredPriceResolver,
    editableInvoiceItems,
    invoiceEditDefaults
  }
}
