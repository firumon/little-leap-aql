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
import {
  stampFields,
  buildReturnAdjustmentRequests
} from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionPayload'
import {
  calculateConsumptionInvoice,
  invoiceItemOf
} from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionInvoice'
import { INVOICE_GENERATED } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionProgress'
import { validateInvoiceDraft, validateSettlement, transitionForBalance } from './useInvoiceWorkflow'
import { balanceDueOf } from './useInvoiceCalculation'

const INVOICES = 'OutletConsumptionInvoices'
const INVOICE_ITEMS = 'OutletConsumptionInvoiceItems'
const CONSUMPTIONS = 'OutletConsumptions'
const RETURNS = 'OutletReturns'
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

  const requests = [
    resourceCreateRequest(INVOICES, header, [INVOICES]),
    resourceBulkRequest(INVOICE_ITEMS, items, [INVOICE_ITEMS]),
    ...markGenerated,
    ...buildReturnAdjustmentRequests(credits, batchRef(INVOICE_REF_PATH))
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
      ...(credits.length ? { outletReturn: 'update' } : {})
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
 * The mismatch and the reason go onto their own columns (`executeAction` writes any field
 * whose name matches a header), and the comment derives to `ProgressPaidComment` off the
 * action's stamp suffix. `validateSettlement` owns the rules — including the one GAS cannot
 * express, that `Other` demands a comment.
 */
export function buildSettlementRequests ({
  record = {},
  reason = '',
  comment = '',
  mismatchAmount = null,
  balanceDue = 0,
  actorName = ''
} = {}) {
  const invoice = asRow(record)
  const code = text(invoice.Code)
  if (!code) return { valid: false, message: 'The invoice could not be identified.' }

  const check = validateSettlement({ record: invoice, reason, comment, mismatchAmount, balanceDue })
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
export function buildCancellationRequests ({ record = {}, comment = '', actorName = '', returnRows = [] } = {}) {
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

  // A plain update, not an `executeAction`: `OutletReturns` declares no additional actions
  // at all, and its forward adjustment (`buildReturnAdjustmentRequests`) is likewise a plain
  // update. Reverting by the same mechanism it was set by keeps one write path per column.
  credits.forEach((row) => {
    requests.push(resourceUpdateRequest(RETURNS, text(row.Code), {
      InvoiceAdjustmentDone: 'FALSE',
      ConsumptionInvoiceCode: '',
      Progress: 'AWAITING_INVOICE_ADJUSTMENT'
    }, [RETURNS]))
  })

  return {
    valid: true,
    requests,
    // Gated on the actions this chain actually DISPATCHES, not on a generic `update`: the
    // consumptions are walked back by `MarkPendingInvoiceGeneration`, so that is the
    // privilege the user needs.
    permissions: {
      outletConsumptionInvoice: 'cancel',
      ...(consumptions.length ? { outletConsumption: 'MarkPendingInvoiceGeneration' } : {}),
      ...(credits.length ? { outletReturn: 'update' } : {})
    },
    successMsg: 'Invoice cancelled.'
  }
}

// Composable shape for setup-context callers. Same functions, one import (§5).
export function useInvoicePayload () {
  return {
    INVOICE_REF_PATH,
    buildInvoiceGenerationRequests,
    buildPaymentRequests,
    buildSettlementRequests,
    buildCancellationRequests
  }
}
