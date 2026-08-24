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
 * Every builder here returns the canonical `{ valid, requests, permissions, message,
 * successMsg }` (§9.2), so Layer 3 does one `allowed(result.permissions)` check and hands
 * `result.requests` straight to `pageState.submit()` — it never inspects, reorders or adds
 * to them (§9.1, Zero UI Schema Invention).
 *
 * PURE (§9.6): no reactivity, no injects, no stores. Every record it needs is an argument.
 */

import { batchRef, textOrRef } from 'src/utils/appHelpers'
import {
  resourceBulkRequest,
  resourceCreateRequest,
  resourceUpdateRequest,
  executeActionRequest
} from 'src/composables/resources/resourceRequests'
import { stampFields } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionPayload'
/**
 * The OutletReturns domain owns both directions of the return-credit link (§9.1).
 *
 * An invoice DECIDES which returns it credits — that is an invoicing question. What
 * crediting does to a return row, and whether the row is thereby reconciled, is
 * OutletReturns' own rule, read here rather than restated.
 */
import {
  buildReturnInvoiceAdjustmentLinkedBatch,
  buildReturnInvoiceCreditReversalBatch
} from 'src/_resource/Operation/OutletReturns/composables/useReturnPayload'
import {
  calculateConsumptionInvoice,
  invoiceItemOf
} from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionInvoice'
import { priceOf } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionStock'
import {
  buildTaxTransactionRequests,
  buildTaxTransactionReplacementRequests,
  buildTaxTransactionReversalRequests
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
import { balanceDueOf } from './useInvoiceCalculation'

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
export function buildInvoiceGenerationRequests ({
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

  if (!invoice.lines.length) {
    return { valid: false, message: 'Nothing on this invoice could be priced. Check the price list covers these SKUs.' }
  }

  // `Total` is CALCULATED but not STORED — `OutletConsumptionInvoices` has no `Total`
  // column, and every reader derives it from the six stored figures (`netPayableOf`).
  // Writing it would put a value in the payload that nothing reads back.
  const { Total, ...storedTotals } = invoice.header

  const header = {
    // A plain comma-separated list, NOT a `batchRefList`: unlike the consumption-side
    // builder, every consumption here already exists and has a real code.
    OutletConsumptionCode: consumptions.join(','),
    Date: invoiceDate,
    DueDate: text(dueDate) || invoiceDate,
    OutletCode: text(outletCode),
    Username: text(username),
    PriceListCode: text(priceListCode),
    ...storedTotals,
    OutletReturnCodes: credits.map((row) => text(row.Code)).join(','),
    SettlementMismatchAmount: 0,
    SettlementReason: '',
    Progress: 'PENDING_PAYMENT',
    ...stampFields('ProgressPendingPayment', actorName, text(comment) || 'Invoice generated from outlet consumptions.'),
    Status: 'Active'
  }

  const items = invoice.lines.map((line) => ({
    OutletConsumptionInvoiceCode: textOrRef(batchRef(INVOICE_REF_PATH)),
    ...invoiceItemOf(line),
    Status: 'Active'
  }))

  /**
   * Walk each covered consumption to `INVOICE_GENERATED`.
   *
   * ── A PLAIN UPDATE, NOT `executeAction('MarkInvoiceGenerated')` ──
   * That action carries a `targets` block in `syncAppResources.gs` which CREATES an
   * `OutletConsumptionInvoices` row as a side effect. It exists for the generic path, where
   * marking a consumption invoiced is what brings the invoice into being — but this chain has
   * already created the real invoice two requests earlier, so firing the action produced a
   * SECOND, empty invoice: no due date, zero subtotal, zero tax, pointing at the same
   * consumption.
   *
   * Writing the column directly performs the same state change without the side effect. The
   * audit stamps are written explicitly here, so the row records exactly what the action
   * would have stamped.
   */
  const markGenerated = consumptions.map((code) => resourceUpdateRequest(CONSUMPTIONS, code, {
    Progress: INVOICE_GENERATED,
    ...stampFields('ProgressInvoiceGenerated', actorName, 'Invoice generated from pending outlet consumption.')
  }, [CONSUMPTIONS]))

  // Points at the invoice by $ref: its code does not exist until GAS commits the create.
  const ledger = buildTaxTransactionRequests({
    resource: INVOICES,
    resourceCode: batchRef(INVOICE_REF_PATH),
    date: invoiceDate,
    counterPartyType: 'Outlet',
    counterPartyCode: text(outletCode),
    taxBreakdown: invoice.taxBreakdown
  })

  const requests = [
    resourceCreateRequest(INVOICES, header, [INVOICES]),
    resourceBulkRequest(INVOICE_ITEMS, items, [INVOICE_ITEMS]),
    ...ledger.requests,
    ...markGenerated,
    ...buildReturnInvoiceAdjustmentLinkedBatch({
      returnRows: credits,
      invoiceCode: batchRef(INVOICE_REF_PATH),
      actorName
    }).requests
  ]

  return {
    valid: true,
    requests,
    // Union of every resource this chain touches, so Layer 3 gates the whole thing in one
    // check rather than discovering a missing permission mid-batch (§9.3).
    // An action permission is looked up as `can<PascalCase(action)>`, so the value must be
    // the action's OWN name exactly as GAS declares it — `MarkInvoiceGenerated`, not an
    // upper-cased variant, which resolves to `canMARKINVOICEGENERATED` and is always false.
    permissions: {
      outletConsumptionInvoice: 'create',
      // `update`, matching the plain write above — the action is no longer dispatched.
      ...(consumptions.length ? { outletConsumption: 'update' } : {}),
      ...(credits.length ? { outletReturn: 'update' } : {}),
      ...ledger.permissions
    },
    successMsg: 'Invoice generated.',
    // The whole calculation bundle, so a caller confirming what it submitted reads the same
    // object the review step displayed.
    invoice
  }
}

// ─── 2. Recording a payment ───────────────────────────────────────────────────

/**
 * A payment against an invoice, PLUS the state walk that payment implies.
 *
 * The transition is derived from the balance AFTER this payment, by the one function that
 * owns that rule (`transitionForBalance`) — so the invoice's `Progress` and its payment
 * rows can never tell different stories. When the balance is unchanged in state terms the
 * transition is `null` and no action is appended at all, which is what stops a second
 * payment on an already-PAID invoice re-stamping `ProgressPaidAt`.
 */
export function buildPaymentRequests ({
  record = {},
  amount = 0,
  mode = 'Cash',
  reference = '',
  date = '',
  username = '',
  actorName = '',
  comment = '',
  existingPayments = []
} = {}) {
  const invoice = asRow(record)
  const code = text(invoice.Code)
  if (!code) return { valid: false, message: 'The invoice could not be identified.' }

  const paid = num(amount)
  if (paid <= 0) return { valid: false, message: 'Enter a payment amount greater than zero.' }

  const payment = {
    Date: text(date) || todayISO(),
    OutletCode: text(invoice.OutletCode),
    OutletConsumptionInvoiceCode: code,
    Amount: paid,
    Mode: text(mode) || 'Cash',
    Reference: text(reference),
    Username: text(username),
    Progress: 'SUBMITTED',
    ...stampFields('ProgressSubmitted', actorName, text(comment)),
    Status: 'Active'
  }

  const requests = [resourceCreateRequest(PAYMENTS, payment, [PAYMENTS])]

  // The balance this payment leaves behind, measured against the payments that already
  // count plus this one — the same `balanceDueOf` every card reads.
  const remaining = balanceDueOf(invoice, [...(Array.isArray(existingPayments) ? existingPayments : []), payment])
  const transition = transitionForBalance(invoice, remaining)

  if (transition) {
    requests.push(executeActionRequest(INVOICES, code, {
      action: transition.action, column: 'Progress', columnValue: transition.columnValue
    }, stampFields(transition.stamp, actorName, transition.comment), [INVOICES]))
  }

  return {
    valid: true,
    requests,
    // The invoice privilege is the TRANSITION this payment triggers, when it triggers one —
    // a payment that leaves the state unchanged needs no invoice permission at all.
    permissions: {
      outletPayment: 'create',
      ...(transition ? { outletConsumptionInvoice: transition.action } : {})
    },
    successMsg: transition?.columnValue === 'PAID' ? 'Payment recorded. Invoice fully settled.' : 'Payment recorded.',
    remaining
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
export function buildSettlementRequests ({
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
    requests: [executeActionRequest(INVOICES, code, {
      action: 'MarkPaid', column: 'Progress', columnValue: 'PAID'
    }, {
      SettlementReason: check.settlement.SettlementReason,
      SettlementMismatchAmount: check.settlement.SettlementMismatchAmount,
      ...stampFields('ProgressPaid', actorName, note)
    }, [INVOICES])],
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
export function buildCancellationRequests ({ record = {}, comment = '', actorName = '', returnRows = [], taxTransactionRows = null } = {}) {
  const invoice = asRow(record)
  const code = text(invoice.Code)
  if (!code) return { valid: false, message: 'The invoice could not be identified.' }
  if (!text(comment)) return { valid: false, message: 'A cancellation comment is required.' }

  const consumptions = codeList(text(invoice.OutletConsumptionCode).split(','))
  const credits = (Array.isArray(returnRows) ? returnRows : []).map(asRow).filter((row) => text(row.Code))

  const requests = [executeActionRequest(INVOICES, code, {
    action: 'Cancel', column: 'Progress', columnValue: 'CANCELLED'
  }, stampFields('ProgressCancelled', actorName, text(comment)), [INVOICES])]

  consumptions.forEach((consumptionCode) => {
    requests.push(executeActionRequest(CONSUMPTIONS, consumptionCode, {
      action: 'MarkPendingInvoiceGeneration', column: 'Progress', columnValue: 'PENDING_INVOICE_GENERATION'
    }, stampFields('ProgressPendingInvoiceGeneration', actorName, `Invoice ${code} cancelled; consumption is invoiceable again.`), [CONSUMPTIONS]))
  })

  // Reversing the credit is the OutletReturns domain's own inverse of the forward link, so
  // both directions are written by one owner and cannot drift apart.
  requests.push(...buildReturnInvoiceCreditReversalBatch({ returnRows: credits }).requests)

  // A cancelled invoice charged nothing, so its ledger rows must leave the return.
  const ledger = buildTaxTransactionReversalRequests({ existingRows: taxTransactionRows || [] })
  requests.push(...ledger.requests)

  return {
    valid: true,
    requests,
    // Gated on the actions this chain actually DISPATCHES, not on a generic `update`: the
    // consumptions are walked back by `MarkPendingInvoiceGeneration`, so that is the
    // privilege the user needs.
    permissions: {
      outletConsumptionInvoice: 'cancel',
      ...(consumptions.length ? { outletConsumption: 'MarkPendingInvoiceGeneration' } : {}),
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

const ITEM_FIGURES = ['Price', 'Total', 'Discount', 'TaxableAmount', 'TaxAmount']

const sameMoney = (a, b) => Math.abs(num(a) - num(b)) < 0.000001

/**
 * One atomic batch: the header totals, plus an update per line whose figures actually moved.
 * Unchanged lines are dropped so a one-price fix does not write dozens of audit rows.
 */
export function buildInvoiceUpdateRequests ({
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
  const requests = [resourceUpdateRequest(INVOICES, code, {
    DueDate: terms.dueDate,
    PriceListCode: terms.priceListCode,
    ...storedTotals
  }, [INVOICES])]

  const ledger = Array.isArray(taxTransactionRows)
    ? buildTaxTransactionReplacementRequests({
      existingRows: taxTransactionRows,
      resource: INVOICES,
      resourceCode: code,
      date: text(row.Date),
      counterPartyType: 'Outlet',
      counterPartyCode: text(row.OutletCode),
      taxBreakdown: invoice.taxBreakdown
    })
    : { requests: [], permissions: {} }

  requests.push(...ledger.requests)

  const calculated = new Map(invoice.lines.map((line) => [text(line.SKU), line]))

  // Counted, not inferred from requests.length, which also carries ledger rows.
  let itemUpdates = 0

  lines.forEach((item) => {
    const line = calculated.get(text(item.SKU))
    const itemCode = text(item.Code)
    if (!line || !itemCode) return

    const unchanged = ITEM_FIGURES.every((key) => sameMoney(item[key], line[key])) &&
      text(item.TaxCode) === text(line.TaxCode)
    if (unchanged) return

    itemUpdates += 1
    requests.push(resourceUpdateRequest(INVOICE_ITEMS, itemCode, {
      Price: num(line.Price),
      Total: num(line.Total),
      Discount: num(line.Discount),
      TaxableAmount: num(line.TaxableAmount),
      TaxAmount: num(line.TaxAmount),
      TaxCode: text(line.TaxCode)
    }, [INVOICE_ITEMS]))
  })

  return {
    valid: true,
    requests,
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
    buildInvoiceGenerationRequests,
    buildPaymentRequests,
    buildSettlementRequests,
    buildCancellationRequests,
    buildInvoiceUpdateRequests,
    recalculateStoredInvoice,
    makeStoredPriceResolver,
    editableInvoiceItems,
    invoiceEditDefaults
  }
}
