/**
 * OutletPayments › batch mutation payloads — Layer 2.
 *
 * Encapsulates cross-resource batch construction for:
 * 1. Payment creation + invoice state transition. PAID needs an exact match or an
 *    explicit residual waiver carrying a reason; anything else stays PARTIALLY_PAID.
 * 2. Payment cancellation + invoice state reversion ('Cancel', 'MarkPendingPayment', 'MarkPartiallyPaid', 'MarkPaid')
 *
 * Every builder returns an array of Nodes (UI_PAGE_STATE.md §5), or a one-element veto.
 *
 * PURE: no Vue refs, no Pinia stores, no injects.
 */

import { textOrRef } from 'src/utils/appHelpers'
import {
  canCreatePayment,
  canCancelPayment
} from './useOutletPaymentProgress'
import {
  netInvoiceTotalOf,
  balanceDueOf,
  countsAsPayment,
  isWaiverEligible,
  waiverCommentOf,
  indexPaymentsByInvoice
} from './useOutletPaymentAllocation'
import { buildInvoiceBalanceTransitionNodes, buildSettlementNodes } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoicePayload'

import { stampFields } from 'src/utils/workflowStamp'
const PAYMENTS = 'OutletPayments'
const INVOICES = 'OutletConsumptionInvoices'

// One wording for a recorded collection, used by the node chain and by the page.
export const PAYMENT_RECORDED_MESSAGE = 'Payment recorded.'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const todayISO = () => new Date().toISOString().slice(0, 10)


/**
 * The columns EVERY receipt row of one collection shares. One Mode, one Reference and one
 * collector are fanned across N rows here, so no screen writes a payment column itself.
 */
export function paymentRowFields ({ mode = 'Cash', reference = '', username = '', actorName = '', comment = '', date = '' } = {}) {
  const payMode = text(mode) || 'Cash'
  const user = text(username) || text(actorName) || 'Unknown'
  return {
    Date: text(date) || todayISO(),
    Mode: payMode,
    Reference: text(reference),
    Username: user,
    Progress: 'SUBMITTED',
    ...stampFields('ProgressSubmitted', actorName || user, text(comment) || `Payment received via ${payMode}.`),
    Status: 'Active'
  }
}

/**
 * Stamp the shared columns onto the receipt rows the PAGE holds.
 *
 * Only what MOVED is written: the rows are watched, and an unchanged write would answer its
 * own watcher for ever (UI_PAGE_STATE.md §5B.3).
 */
export function stampPaymentRowsInPageState (pageState, options = {}) {
  const rows = pageState.getRecordRows(PAYMENTS)
  if (!rows.length) return
  const fields = paymentRowFields(options)
  rows.forEach((row, index) => {
    const moved = Object.keys(fields).filter((key) => row[key] !== fields[key])
    if (moved.length) {
      pageState.setRecords(index, null, Object.fromEntries(moved.map((key) => [key, fields[key]])), PAYMENTS)
    }
  })
}

// ─── 1. Payment Creation Batch ────────────────────────────────────────────────

export function buildOutletPaymentCreationNodes ({
  selectedOutletCode = '',
  selectedInvoices = [],
  // The receipt rows the PAGE holds, `[{ OutletConsumptionInvoiceCode, Amount }]`. They are
  // read, never restated: `withRows: false` leaves them where the user put them.
  rows = [],
  totalAmount = 0,
  mode = 'Cash',
  reference = '',
  username = '',
  actorName = '',
  comment = '',
  existingPayments = [],
  waiveResidual = false,
  waiverReason = '',
  waiverComment = '',
  withRows = true
} = {}) {
  if (!canCreatePayment()) {
    return [{ valid: false, message: 'You do not have permission to submit payments.' }]
  }

  const outletCode = text(selectedOutletCode)
  if (!outletCode) {
    return [{ valid: false, message: 'Select an outlet to record payment.' }]
  }

  const invoices = (Array.isArray(selectedInvoices) ? selectedInvoices : []).map(asRow)
  if (!invoices.length) {
    return [{ valid: false, message: 'Select at least one invoice to pay.' }]
  }

  const amount = num(totalAmount)
  if (amount <= 0) {
    return [{ valid: false, message: 'Payment amount must be greater than zero.' }]
  }

  const payMode = text(mode) || 'Cash'

  const allocated = new Map((Array.isArray(rows) ? rows : []).map(asRow)
    .map((row) => [text(row.OutletConsumptionInvoiceCode), num(row.Amount)]))

  const activeAllocations = invoices
    .map(inv => ({ invoice: inv, code: text(inv.Code), allocated: num(allocated.get(text(inv.Code))) }))
    .filter(item => item.allocated > 0)

  if (!activeAllocations.length) {
    return [{ valid: false, message: 'Allocate payment amount to at least one invoice.' }]
  }

  const allocatedSum = activeAllocations.reduce((sum, item) => sum + item.allocated, 0)
  if (Math.abs(allocatedSum - amount) > 0.01) {
    return [{ valid: false, message: `Sum of allocations (${allocatedSum.toFixed(2)}) does not match collected amount (${amount.toFixed(2)}).` }]
  }

  if (waiveResidual && !text(waiverReason)) {
    return [{ valid: false, message: 'Please select a waiver reason for the residual balance.' }]
  }

  const nodes = []
  const paymentsByInvoice = indexPaymentsByInvoice(existingPayments)
  const shared = paymentRowFields({ mode: payMode, reference, username, actorName, comment })

  if (withRows) {
    nodes.push({
      resource: PAYMENTS,
      many: true,
      records: activeAllocations.map(({ code, allocated }) => ({
        OutletCode: outletCode,
        OutletConsumptionInvoiceCode: code,
        Amount: allocated,
        ...shared
      })),
      reload: [PAYMENTS],
      permissions: { create: 'You are not allowed to record a payment.' },
      successMsg: PAYMENT_RECORDED_MESSAGE
    })
  } else {
    nodes.push({ resource: PAYMENTS, merge: true, record: {}, reload: [PAYMENTS], permissions: { create: 'You are not allowed to record a payment.' }, successMsg: PAYMENT_RECORDED_MESSAGE })
  }

  for (const { invoice, code, allocated } of activeAllocations) {
    // Derive Invoice State Transition
    const invBal = balanceDueOf(invoice, paymentsByInvoice.get(code) || [])
    const remaining = Math.max(0, Number((invBal - allocated).toFixed(2)))

    if (waiveResidual && isWaiverEligible(remaining, invoice.PriceListCode)) {
      // THE INVOICE DOMAIN WRITES ITS OWN SETTLEMENT (Domain Payload Chains). Writing
      // `SettlementReason`/`SettlementMismatchAmount` and the `ProgressPaid` stamps from
      // here would be a second implementation of the invoice's own rule — the one the
      // settle route calls — free to disagree with it the day either changes.
      const note = text(waiverComment) || waiverCommentOf(allocated, invBal, invoices.length, waiverReason)
      const settlement = buildSettlementNodes({
        record: invoice,
        reason: waiverReason,
        comment: note,
        mismatchAmount: remaining,
        balanceDue: remaining,
        actorName: actorName || username
      })
      if (settlement[0]?.valid === false) return settlement
      nodes.push(...settlement)
    } else {
      // The invoice domain decides its own state walk. PAID only on an exact match: any
      // leftover keeps it PARTIALLY_PAID until somebody settles it through the audited
      // action and records why.
      const walk = buildInvoiceBalanceTransitionNodes({
        record: invoice,
        balance: remaining,
        actorName: actorName || username,
        comment: remaining <= 0
          ? `Payment of ${allocated} received via ${payMode}. Invoice fully paid.`
          : `Payment of ${allocated} received via ${payMode}; balance remaining: ${remaining.toFixed(2)}.`
      })
      if (walk[0]?.valid === false) return walk
      nodes.push(...walk)
    }
  }

  return nodes
}

// ─── 2. Payment Cancellation Batch ────────────────────────────────────────────

// The one statement of what a cancellation reason must be. The card disables its button on
// it and the builder vetoes on it, so the two cannot disagree.
export function cancellationCommentError (comment = '') {
  const reason = text(comment)
  return !reason || reason.length < 3
    ? 'Cancellation comment is mandatory (minimum 3 characters).'
    : ''
}


export function buildOutletPaymentCancellationNodes ({
  paymentRecord = {},
  comment = '',
  actorName = '',
  invoiceRecord = null,
  allInvoicePayments = [],
  requireComment = true
} = {}) {
  const payment = asRow(paymentRecord)
  const paymentCode = text(payment.Code)

  if (!paymentCode) {
    return [{ valid: false, message: 'Payment record is missing identifier.' }]
  }

  if (!canCancelPayment(payment)) {
    return [{ valid: false, message: 'You do not have permission to cancel this payment.' }]
  }

  const reason = text(comment)
  // `requireComment: false` lets the page mount this batch while the reason is still being
  // typed. The veto still guards the submit, so an empty reason can never be sent.
  const commentError = requireComment ? cancellationCommentError(reason) : ''
  if (commentError) return [{ valid: false, message: commentError }]

  const nodes = [
    { resource: PAYMENTS, actions: [{ ...{
      action: 'Cancel',
      column: 'Progress',
      columnValue: 'CANCELLED'
    }, code: textOrRef(paymentCode), data: {
      fields: {
        ProgressCancelledComment: reason,
        ...stampFields('ProgressCancelled', actorName, reason)
      }
    } }], reload: [PAYMENTS], permissions: { update: 'You are not allowed to cancel this payment.' }, successMsg: 'Payment receipt cancelled.' }
  ]

  const invoice = asRow(invoiceRecord)
  const invoiceCode = text(invoice.Code || payment.OutletConsumptionInvoiceCode)

  if (invoiceCode && invoice && invoice.Code) {
    const total = netInvoiceTotalOf(invoice)
    const otherPaid = (Array.isArray(allInvoicePayments) ? allInvoicePayments : [])
      .filter(p => text(p.OutletConsumptionInvoiceCode) === invoiceCode && text(p.Code) !== paymentCode && countsAsPayment(p))
      .reduce((sum, p) => sum + num(p.Amount), 0)

    const remaining = Math.max(0, Number((total - otherPaid).toFixed(2)))

    // Again the invoice's own walk, from the balance this cancellation leaves behind.
    const walk = buildInvoiceBalanceTransitionNodes({
      record: invoice,
      balance: remaining,
      actorName,
      comment: `Payment ${paymentCode} cancelled: ${reason}`
    })
    if (walk[0]?.valid === false) return walk
    nodes.push(...walk)
  }

  return nodes
}

// ─── Composable Wrapper ───────────────────────────────────────────────────────

export function useOutletPaymentPayload () {
  return {
    stampFields,
    PAYMENT_RECORDED_MESSAGE,
    buildOutletPaymentCreationNodes,
    buildOutletPaymentCancellationNodes,
    cancellationCommentError
  }
}

export { stampFields }
