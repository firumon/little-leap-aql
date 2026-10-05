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
import { resourceRow } from 'src/composables/resources/useResourceConfig'
import { useAuth } from 'src/composables/core/useAuth'
import {
  canCreatePayment,
  canCancelPayment,
  canApprovePayment,
  progressOf
} from './useOutletPaymentProgress'
import {
  netInvoiceTotalOf,
  balanceDueOf,
  countsAsPayment,
  isWaiverEligible,
  waiverCommentOf,
  indexPaymentsByInvoice,
  paymentsForInvoice
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

export function buildOutletPaymentInitNodes ({ actorName = '', outletCode = '' } = {}) {
  const { user } = useAuth()
  return [{
    resource: PAYMENTS,
    record: resourceRow(PAYMENTS, {
      Date: todayISO(),
      Username: text(actorName) || text(user.value?.name || user.value?.email),
      OutletCode: text(outletCode),
      Mode: 'Cash',
      Amount: 0,
      Progress: 'SUBMITTED',
      Status: 'Active'
    })
  }]
}


/**
 * The columns EVERY receipt row of one collection shares. One Mode, one Reference and one
 * collector are fanned across N rows here, so no screen writes a payment column itself.
 */
export function paymentRowFields ({ mode = 'Cash', reference = '', username = '', actorName = '', comment = '', date = '', progress = 'SUBMITTED' } = {}) {
  const payMode = text(mode) || 'Cash'
  const user = text(username) || text(actorName) || 'Unknown'
  const note = text(comment)
  return {
    Date: text(date) || todayISO(),
    Mode: payMode,
    Reference: text(reference),
    Username: user,
    Progress: progress,
    ...stampFields('ProgressSubmitted', actorName || user, note || `Payment received via ${payMode}.`),
    ...(progress === 'APPROVED' ? stampFields('ProgressApproved', actorName || user, note || 'Payment auto-approved.') : {}),
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
  // The receipt rows the page holds, `[{ OutletConsumptionInvoiceCode, Amount }]`.
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
  autoApprove = false
} = {}) {
  if (!canCreatePayment()) {
    return [{ valid: false, message: 'You do not have permission to submit payments.' }]
  }

  const outletCode = text(selectedOutletCode)
  if (!outletCode) {
    return [{ valid: false, message: 'Select an outlet to record payment.' }]
  }

  const amount = num(totalAmount)
  if (amount <= 0) {
    return [{ valid: false, message: 'Payment amount must be greater than zero.' }]
  }

  const payMode = text(mode) || 'Cash'
  const shared = paymentRowFields({ mode: payMode, reference, username, actorName, comment, progress: autoApprove ? 'APPROVED' : 'SUBMITTED' })

  if (!autoApprove) {
    return [{
      resource: PAYMENTS,
      record: {
        OutletCode: outletCode,
        OutletConsumptionInvoiceCode: '',
        Amount: amount,
        ...shared
      },
      reload: [PAYMENTS],
      permissions: { create: 'You are not allowed to record a payment.' },
      successMsg: PAYMENT_RECORDED_MESSAGE
    }]
  }

  const invoices = (Array.isArray(selectedInvoices) ? selectedInvoices : []).map(asRow)
  if (!invoices.length) {
    return [{ valid: false, message: 'Select at least one invoice to pay.' }]
  }

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
  nodes.push({
    resource: PAYMENTS,
    record: {
      OutletCode: outletCode,
      OutletConsumptionInvoiceCode: activeAllocations.map(({ code }) => code).join(','),
      Allocation: activeAllocations.length > 1
        ? JSON.stringify(Object.fromEntries(activeAllocations.map(({ code, allocated }) => [code, allocated])))
        : '',
      Amount: amount,
      ...shared
    },
    reload: [PAYMENTS],
    permissions: { create: 'You are not allowed to record a payment.' },
    successMsg: PAYMENT_RECORDED_MESSAGE
  })

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

export function buildOutletPaymentAllocationNodes (allocations = {}, existingRecord = {}, options = {}) {
  const row = asRow(existingRecord)
  const actor = text(options.actorName || options.username)
  const amount = num(row.Amount)
  const autoApprove = options.autoApprove !== undefined ? !!options.autoApprove : true

  const entries = Array.isArray(allocations)
    ? allocations.map(a => [text(a.code || a.OutletConsumptionInvoiceCode), num(a.amount || a.Amount)])
    : Object.entries(allocations || {}).map(([c, a]) => [text(c), num(a)])
  const active = entries.filter(([code, val]) => code && val > 0)
  const activeCodes = active.map(([code]) => code)
  const allocatedSum = active.reduce((sum, [_, val]) => sum + val, 0)

  const isFullyAllocated = autoApprove && amount > 0 && Math.abs(amount - allocatedSum) < 0.01
  const nextProgress = isFullyAllocated ? 'APPROVED' : 'SUBMITTED'
  const stamps = isFullyAllocated
    ? {
        ...stampFields('ProgressSubmitted', actor, row.ProgressSubmittedComment || text(options.comment) || 'Payment submitted.'),
        ...stampFields('ProgressApproved', actor, text(options.comment) || 'Payment auto-approved.')
      }
    : {
        ProgressApprovedAt: '',
        ProgressApprovedBy: '',
        ProgressApprovedComment: '',
        ...stampFields('ProgressSubmitted', actor, row.ProgressSubmittedComment || text(options.comment) || 'Payment submitted.')
      }

  const paymentNode = {
    resource: PAYMENTS,
    ...(row.Code || options.code ? { code: text(row.Code || options.code) } : {}),
    merge: true,
    reload: [PAYMENTS, 'OutletConsumptionInvoices'],
    record: {
      ...row,
      Date: row.Date || todayISO(),
      Mode: row.Mode || 'Cash',
      Username: row.Username || actor,
      Status: row.Status || 'Active',
      Amount: amount,
      OutletConsumptionInvoiceCode: autoApprove ? activeCodes.join(',') : '',
      Allocation: autoApprove && activeCodes.length > 1 ? JSON.stringify(Object.fromEntries(active)) : '',
      Progress: nextProgress,
      ...stamps
    }
  }

  const invoiceNodes = []
  if (isFullyAllocated) {
    const invoiceList = Array.isArray(options.invoices) ? options.invoices : []
    for (const [code, allocated] of active) {
      const rawInv = invoiceList.find(i => text(i.code || i.Code) === code) || { Code: code }
      const inv = { ...rawInv, Code: text(rawInv.Code || rawInv.code) }
      const currentBal = inv.balance !== undefined
        ? num(inv.balance)
        : balanceDueOf(inv, options.existingPayments || [])
      const rem = Math.max(0, Number((currentBal - allocated).toFixed(2)))
      const note = text(options.comment) || (rem <= 0
        ? ('Payment of ' + allocated + ' allocated. Invoice fully paid.')
        : ('Payment of ' + allocated + ' allocated; balance remaining: ' + rem.toFixed(2) + '.'))
      const walk = buildInvoiceBalanceTransitionNodes({
        record: inv,
        balance: rem,
        amount: allocated,
        actorName: actor,
        comment: note
      })
      if (walk[0]?.valid !== false) {
        for (const node of walk) {
          invoiceNodes.push({ ...node, role: code })
        }
      }
    }
  }

  return [paymentNode, ...invoiceNodes]
}

export function buildOutletPaymentApproveNodes (allocationObj = {}, payment = {}, options = {}) {
  const row = asRow(payment)
  const amount = num(row.Amount)
  const entries = Object.entries(allocationObj || {}).map(([c, a]) => [text(c), num(a)])
  const active = entries.filter(([code, val]) => code && val > 0)
  const activeCodes = active.map(([code]) => code)
  const allocatedSum = active.reduce((sum, [_, val]) => sum + val, 0)

  if (amount <= 0 || Math.abs(amount - allocatedSum) >= 0.01) {
    return [{
      valid: false,
      message: 'Allocated amount does not match the payment amount.'
    }]
  }

  const { user } = useAuth()
  const actor = text(options.actorName || user.value?.name)
  const stamps = stampFields('ProgressApproved', actor, text(options.comment) || 'Payment approved.')

  const paymentNode = {
    resource: PAYMENTS,
    code: text(row.Code),
    permissions: { approve: 'You are not allowed to approve payments.' },
    record: {
      Progress: 'APPROVED',
      OutletConsumptionInvoiceCode: activeCodes.join(','),
      Allocation: activeCodes.length > 1 ? JSON.stringify(Object.fromEntries(active)) : '',
      ...stamps
    }
  }

  const invoiceList = Array.isArray(options.invoices) ? options.invoices : []
  const invoiceNodes = []

  for (const [invCode, allocated] of active) {
    const rawInv = invoiceList.find(i => text(i.code || i.Code) === invCode) || { Code: invCode }
    const inv = { ...rawInv, Code: text(rawInv.Code || rawInv.code) }
    const currentBal = inv.balance !== undefined
      ? num(inv.balance)
      : balanceDueOf(inv, options.existingPayments || [])
    const rem = Math.max(0, Number((currentBal - allocated).toFixed(2)))
    const note = text(options.comment) || (rem <= 0
      ? ('Payment of ' + allocated + ' allocated. Invoice fully paid.')
      : ('Payment of ' + allocated + ' allocated; balance remaining: ' + rem.toFixed(2) + '.'))

    const transitionNodes = buildInvoiceBalanceTransitionNodes({
      record: inv,
      balance: rem,
      amount: allocated,
      actorName: actor,
      comment: note
    })

    if (transitionNodes[0]?.valid === false) {
      return transitionNodes
    }

    for (const node of transitionNodes) {
      invoiceNodes.push({ ...node, role: invCode })
    }
  }

  return [paymentNode, ...invoiceNodes]
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

  if (progressOf(payment) === 'SUBMITTED') return nodes

  const invoice = asRow(invoiceRecord)
  const invoiceCode = text(invoice.Code || payment.OutletConsumptionInvoiceCode)

  if (invoiceCode && invoice && invoice.Code) {
    const total = netInvoiceTotalOf(invoice)
    const otherPaid = paymentsForInvoice(invoiceCode, allInvoicePayments)
      .filter(p => text(p.Code) !== paymentCode)
      .reduce((sum, p) => sum + num(p.allocation?.[invoiceCode] !== undefined ? p.allocation[invoiceCode] : p.Amount), 0)

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



export { stampFields }
