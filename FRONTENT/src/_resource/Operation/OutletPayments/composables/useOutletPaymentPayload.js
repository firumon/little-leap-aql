/**
 * OutletPayments › batch mutation payloads — Layer 2.
 *
 * Encapsulates cross-resource batch construction for:
 * 1. Payment creation + invoice state transition. PAID needs an exact match or an
 *    explicit residual waiver carrying a reason; anything else stays PARTIALLY_PAID.
 * 2. Payment cancellation + invoice state reversion ('Cancel', 'MarkPendingPayment', 'MarkPartiallyPaid', 'MarkPaid')
 *
 * All builders return canonical envelope:
 *   { valid, nodes, permissions, message, successMsg }
 *
 * PURE: no Vue refs, no Pinia stores, no injects.
 */

import { actionNode, bulkNode } from 'src/composables/resources/nodePayloads'
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

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const todayISO = () => new Date().toISOString().slice(0, 10)


// ─── 1. Payment Creation Batch ────────────────────────────────────────────────

export function buildOutletPaymentCreationNodes ({
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

  const nodes = []
  // Merged in below rather than assumed: only a batch that actually force-settles an invoice
  // asks for the `MarkPaid` privilege.
  let settlementPermissions = {}
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

    // A bulk of one: several invoices in a run write several payment rows, and they all
    // share the one OutletPayments address.
    nodes.push(bulkNode(PAYMENTS, [paymentRecord], [PAYMENTS]))

    // 2. Derive Invoice State Transition
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
        actorName: actorName || user
      })
      if (!settlement.valid) return { valid: false, message: settlement.message }
      nodes.push(...settlement.nodes)
      settlementPermissions = { ...settlementPermissions, ...settlement.permissions }
    } else {
      // The invoice domain decides its own state walk. PAID only on an exact match: any
      // leftover keeps it PARTIALLY_PAID until somebody settles it through the audited
      // action and records why.
      const walk = buildInvoiceBalanceTransitionNodes({
        record: invoice,
        balance: remaining,
        actorName: actorName || user,
        comment: remaining <= 0
          ? `Payment of ${allocated} received via ${payMode}. Invoice fully paid.`
          : `Payment of ${allocated} received via ${payMode}; balance remaining: ${remaining.toFixed(2)}.`
      })
      if (!walk.valid) return { valid: false, message: walk.message }
      nodes.push(...walk.nodes)
      settlementPermissions = { ...settlementPermissions, ...walk.permissions }
    }
  }

  return {
    valid: true,
    nodes,
    permissions: {
      outletPayment: 'create',
      outletConsumptionInvoice: 'update',
      ...settlementPermissions
    },
    successMsg: 'Payment submitted successfully.'
  }
}

// ─── 2. Payment Cancellation Batch ────────────────────────────────────────────

export function buildOutletPaymentCancellationNodes ({
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

  const nodes = [
    actionNode(PAYMENTS, paymentCode, {
      action: 'Cancel',
      column: 'Progress',
      columnValue: 'CANCELLED'
    }, {
      ProgressCancelledComment: reason,
      ...stampFields('ProgressCancelled', actorName, reason)
    }, { reload: [PAYMENTS] })
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
    if (!walk.valid) return { valid: false, message: walk.message }
    nodes.push(...walk.nodes)
  }

  return {
    valid: true,
    nodes,
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
    buildOutletPaymentCreationNodes,
    buildOutletPaymentCancellationNodes
  }
}

export { stampFields }
