/**
 * OutletPayments › workflow vocabulary, progress states and gates — Layer 2.
 *
 * One single definition of payment lifecycle states ('SUBMITTED' -> 'CANCELLED')
 * and permission gates for all UI consumers.
 *
 * Pure functions take record/records only, hardcoding resource name for config resolution.
 */

import { useResourceConfig, findResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useAuth } from 'src/composables/core/useAuth'

const RESOURCE_NAME = 'OutletPayments'
const INVOICE_RESOURCE = 'OutletConsumptionInvoices'
const DEFAULT_MODES = ['Cash', 'Cheque', 'Bank Transfer', 'Card', 'Other']

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})

export function paymentModes () {
  const { appOptionsMap } = useAuth()
  const options = appOptionsMap.value?.OutletPaymentMode
  const list = (Array.isArray(options) ? options : []).map(text).filter(Boolean)
  return list.length ? list : [...DEFAULT_MODES]
}

// ─── States ───────────────────────────────────────────────────────────────────

export const SUBMITTED = 'SUBMITTED'
export const APPROVED = 'APPROVED'
export const CANCELLED = 'CANCELLED'

export const PROGRESS_META = {
  [SUBMITTED]: { label: 'Submitted', color: 'warning', icon: 'schedule' },
  [APPROVED]: { label: 'Approved', color: 'positive', icon: 'check_circle' },
  [CANCELLED]: { label: 'Cancelled', color: 'negative', icon: 'block' }
}

export const OPEN_STATES = [SUBMITTED, APPROVED]
export const TERMINAL_STATES = [CANCELLED]

export function progressOf (record) {
  return text(asRow(record).Progress).toUpperCase() || SUBMITTED
}

export function progressMetaOf (record) {
  return PROGRESS_META[progressOf(record)] || {
    label: text(asRow(record).Progress) || 'Unknown',
    color: 'grey-6',
    icon: 'help'
  }
}

export function isSubmitted (record) {
  return progressOf(record) === SUBMITTED
}

export function isApproved (record) {
  return progressOf(record) === APPROVED
}

export function isCancelled (record) {
  return progressOf(record) === CANCELLED
}

export const WORKFLOW_STAMPS = [
  { state: SUBMITTED, prefix: 'ProgressSubmitted', title: 'Submitted' },
  { state: APPROVED, prefix: 'ProgressApproved', title: 'Approved' },
  { state: CANCELLED, prefix: 'ProgressCancelled', title: 'Cancelled' }
]

export function workflowStamps (record) {
  const row = asRow(record)
  return WORKFLOW_STAMPS
    .map((stamp) => {
      const at = text(row[`${stamp.prefix}At`])
      const meta = PROGRESS_META[stamp.state] || {}
      return {
        state: stamp.state,
        title: stamp.title,
        by: text(row[`${stamp.prefix}By`]),
        at,
        comment: text(row[`${stamp.prefix}Comment`]),
        icon: meta.icon || 'schedule',
        color: meta.color || 'grey-6',
        label: meta.label || stamp.state
      }
    })
    .filter((event) => event.by || event.at)
}

// ─── Permission Gates ─────────────────────────────────────────────────────────

const gate = () => useResourceConfig(RESOURCE_NAME)

export function canCreatePayment () {
  return !!(gate().allowed('create') || gate().allowed('write') || gate().allowed({ OutletPayments: 'create' }) || gate().allowed({ OutletPayments: 'write' }))
}

export function canCancelPayment (record) {
  const status = text(asRow(record).Status).toUpperCase()
  const isRowActive = !status || status === 'ACTIVE'
  const permitted = gate().allowed('cancel') || gate().allowed('update') || gate().allowed({ OutletPayments: 'cancel' }) || gate().allowed({ OutletPayments: 'update' })
  return !!permitted && OPEN_STATES.includes(progressOf(record)) && isRowActive
}

export function canApprovePayment (record) {
  const status = text(asRow(record).Status).toUpperCase()
  const isRowActive = !status || status === 'ACTIVE'
  const permitted = gate().allowed('approve') || gate().allowed('update') || gate().allowed({ OutletPayments: 'approve' }) || gate().allowed({ OutletPayments: 'update' })
  return !!permitted && isSubmitted(record) && isRowActive
}

export function hasInvoiceResource () {
  return !!findResourceConfig(INVOICE_RESOURCE)
}

export function canCollectInvoicePayment () {
  return !!useResourceConfig(INVOICE_RESOURCE).allowed('CollectPayment')
}

// ─── Composable Wrapper ───────────────────────────────────────────────────────


