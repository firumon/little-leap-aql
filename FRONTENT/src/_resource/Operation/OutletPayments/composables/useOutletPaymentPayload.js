/**
 * OutletPayments › batch mutation payloads — Layer 2.
 *
 * Encapsulates cross-resource batch construction for:
 * 1. Payment creation + invoice state transition ('MarkPaid' or 'MarkPartiallyPaid', with residual waiver)
 * 2. Payment cancellation + invoice state reversion ('Cancel', 'MarkPendingPayment', 'MarkPartiallyPaid', 'MarkPaid')
 *
 * All builders return canonical envelope:
 *   { valid, requests, permissions, message, successMsg }
 *
 * PURE: no Vue refs, no Pinia stores, no injects.
 */

import {
  resourceCreateRequest,
  executeActionRequest
} from 'src/composables/resources/resourceRequests'
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

const PAYMENTS = 'OutletPayments'
const INVOICES = 'OutletConsumptionInvoices'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const todayISO = () => new Date().toISOString().slice(0, 10)

export function stampFields (prefix, actorName = '', comment = '') {
  const atKey = `${prefix}At`
  const byKey = `${prefix}By`
  const commentKey = `${prefix}Comment`
  const now = new Date().toISOString()
  return {
    [atKey]: now,
    ...(actorName ? { [byKey]: actorName } : {}),
    ...(comment ? { [commentKey]: comment } : {})
  }
}

// ─── 1. Payment Creation Batch ────────────────────────────────────────────────

export function buildOutletPaymentCreationRequests ({
  selectedOutletCode = '',
  selectedInvoices = [],
  allocations = {},
  totalAmount = 0,
  mode = 'Cash',
  reference = '',
  username = '',
  actorName = '',
  comment = '',
  existingPayments = [],
  waiveResidual = false,
  waiverReason = '',
  waiverComment = ''
} = {}) {
  if (!canCreatePayment()) {
    return { valid: false, message: 'You do not have permission to submit payments.' }
  }

  const outletCode = text(selectedOutletCode)
  if (!outletCode) {
    return { valid: false, message: 'Select an outlet to record payment.' }
  }

  const invoices = (Array.isArray(selectedInvoices) ? selectedInvoices : []).map(asRow)
  if (!invoices.length) {
    return { valid: false, message: 'Select at least one invoice to pay.' }
  }

  const amount = num(totalAmount)
  if (amount <= 0) {
    return { valid: false, message: 'Payment amount must be greater than zero.' }
  }

  const payMode = text(mode) || 'Cash'

  const activeAllocations = invoices
    .map(inv => ({ invoice: inv, code: text(inv.Code), allocated: num(allocations[text(inv.Code)]) }))
    .filter(item => item.allocated > 0)

  if (!activeAllocations.length) {
    return { valid: false, message: 'Allocate payment amount to at least one invoice.' }
  }

  const allocatedSum = activeAllocations.reduce((sum, item) => sum + item.allocated, 0)
  if (Math.abs(allocatedSum - amount) > 0.01) {
    return { valid: false, message: `Sum of allocations (${allocatedSum.toFixed(2)}) does not match collected amount (${amount.toFixed(2)}).` }
  }

  if (waiveResidual && !text(waiverReason)) {
    return { valid: false, message: 'Please select a waiver reason for the residual balance.' }
  }

  const requests = []
  const dateStr = todayISO()
  const user = text(username) || text(actorName) || 'Unknown'
  const paymentsByInvoice = indexPaymentsByInvoice(existingPayments)

  for (const { invoice, code, allocated } of activeAllocations) {
    // 1. Payment Record
    const paymentRecord = {
      Date: dateStr,
      OutletCode: outletCode,
      OutletConsumptionInvoiceCode: code,
      Amount: allocated,
      Mode: payMode,
      Reference: text(reference),
      Username: user,
      Progress: 'SUBMITTED',
      ...stampFields('ProgressSubmitted', actorName || user, text(comment) || `Payment received via ${payMode}.`),
      Status: 'Active'
    }

    requests.push(resourceCreateRequest(PAYMENTS, paymentRecord, [PAYMENTS]))

    // 2. Derive Invoice State Transition
    const invBal = balanceDueOf(invoice, paymentsByInvoice.get(code) || [])
    const remaining = Math.max(0, Number((invBal - allocated).toFixed(2)))

    if (waiveResidual && isWaiverEligible(remaining, invoice.PriceListCode)) {
      const note = text(waiverComment) || waiverCommentOf(allocated, invBal, invoices.length, waiverReason)
      requests.push(executeActionRequest(INVOICES, code, {
        action: 'MarkPaid',
        column: 'Progress',
        columnValue: 'PAID'
      }, {
        SettlementReason: waiverReason,
        SettlementMismatchAmount: remaining,
        ...stampFields('ProgressPaid', actorName || user, note)
      }, [INVOICES]))
    } else if (remaining <= 0.01) {
      requests.push(executeActionRequest(INVOICES, code, {
        action: 'MarkPaid',
        column: 'Progress',
        columnValue: 'PAID'
      }, stampFields('ProgressPaid', actorName || user, `Payment of ${allocated} received via ${payMode}. Invoice fully paid.`), [INVOICES]))
    } else {
      requests.push(executeActionRequest(INVOICES, code, {
        action: 'MarkPartiallyPaid',
        column: 'Progress',
        columnValue: 'PARTIALLY_PAID'
      }, stampFields('ProgressPartiallyPaid', actorName || user, `Payment of ${allocated} received via ${payMode}; balance remaining: ${remaining.toFixed(2)}.`), [INVOICES]))
    }
  }

  return {
    valid: true,
    requests,
    permissions: {
      outletPayment: 'create',
      outletConsumptionInvoice: 'update'
    },
    successMsg: 'Payment submitted successfully.'
  }
}

// ─── 2. Payment Cancellation Batch ────────────────────────────────────────────

export function buildOutletPaymentCancellationRequests ({
  paymentRecord = {},
  comment = '',
  actorName = '',
  invoiceRecord = null,
  allInvoicePayments = []
} = {}) {
  const payment = asRow(paymentRecord)
  const paymentCode = text(payment.Code)

  if (!paymentCode) {
    return { valid: false, message: 'Payment record is missing identifier.' }
  }

  if (!canCancelPayment(payment)) {
    return { valid: false, message: 'You do not have permission to cancel this payment.' }
  }

  const reason = text(comment)
  if (!reason || reason.length < 3) {
    return { valid: false, message: 'Cancellation comment is mandatory (minimum 3 characters).' }
  }

  const requests = [
    executeActionRequest(PAYMENTS, paymentCode, {
      action: 'Cancel',
      column: 'Progress',
      columnValue: 'CANCELLED'
    }, {
      ProgressCancelledComment: reason,
      ...stampFields('ProgressCancelled', actorName, reason)
    }, [PAYMENTS])
  ]

  const invoice = asRow(invoiceRecord)
  const invoiceCode = text(invoice.Code || payment.OutletConsumptionInvoiceCode)

  if (invoiceCode && invoice && invoice.Code) {
    const total = netInvoiceTotalOf(invoice)
    const otherPaid = (Array.isArray(allInvoicePayments) ? allInvoicePayments : [])
      .filter(p => text(p.OutletConsumptionInvoiceCode) === invoiceCode && text(p.Code) !== paymentCode && countsAsPayment(p))
      .reduce((sum, p) => sum + num(p.Amount), 0)

    const remaining = Math.max(0, Number((total - otherPaid).toFixed(2)))

    let transitionAction = 'MarkPendingPayment'
    let nextProgress = 'PENDING_PAYMENT'
    let stamp = 'ProgressPendingPayment'

    if (otherPaid > 0.01) {
      if (remaining <= 0.01) {
        transitionAction = 'MarkPaid'
        nextProgress = 'PAID'
        stamp = 'ProgressPaid'
      } else {
        transitionAction = 'MarkPartiallyPaid'
        nextProgress = 'PARTIALLY_PAID'
        stamp = 'ProgressPartiallyPaid'
      }
    }

    requests.push(executeActionRequest(INVOICES, invoiceCode, {
      action: transitionAction,
      column: 'Progress',
      columnValue: nextProgress
    }, {
      Comment: `Payment ${paymentCode} cancelled: ${reason}`,
      ...stampFields(stamp, actorName, `Payment ${paymentCode} cancelled: ${reason}`)
    }, [INVOICES]))
  }

  return {
    valid: true,
    requests,
    permissions: {
      outletPayment: 'update',
      outletConsumptionInvoice: 'update'
    },
    successMsg: 'Payment receipt cancelled successfully.'
  }
}

// ─── Composable Wrapper ───────────────────────────────────────────────────────

export function useOutletPaymentPayload () {
  return {
    stampFields,
    buildOutletPaymentCreationRequests,
    buildOutletPaymentCancellationRequests
  }
}
