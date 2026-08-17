/**
 * OutletPayments › workflow vocabulary, progress states and gates — Layer 2.
 *
 * One single definition of payment lifecycle states ('SUBMITTED' -> 'CANCELLED')
 * and permission gates for all UI consumers.
 *
 * Pure functions take record/records only, hardcoding resource name for config resolution.
 */

import { useResourceConfig } from 'src/composables/resources/useResourceConfig'

const RESOURCE_NAME = 'OutletPayments'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})

// ─── States ───────────────────────────────────────────────────────────────────

export const SUBMITTED = 'SUBMITTED'
export const CANCELLED = 'CANCELLED'

export const PROGRESS_META = {
  [SUBMITTED]: { label: 'Submitted', color: 'positive', icon: 'task_alt' },
  [CANCELLED]: { label: 'Cancelled', color: 'negative', icon: 'block' }
}

export const OPEN_STATES = [SUBMITTED]
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

export function isCancelled (record) {
  return progressOf(record) === CANCELLED
}

// ─── Permission Gates ─────────────────────────────────────────────────────────

const gate = () => useResourceConfig(RESOURCE_NAME)

export function canCreatePayment () {
  return !!gate().allowed({ outletPayment: 'create' })
}

export function canCancelPayment (record) {
  const isRowActive = text(asRow(record).Status).toUpperCase() !== 'ARCHIVED'
  return !!gate().allowed({ outletPayment: 'update' }) && isSubmitted(record) && isRowActive
}

// ─── Composable Wrapper ───────────────────────────────────────────────────────

export function useOutletPaymentProgress () {
  return {
    SUBMITTED,
    CANCELLED,
    PROGRESS_META,
    OPEN_STATES,
    TERMINAL_STATES,
    progressOf,
    progressMetaOf,
    isSubmitted,
    isCancelled,
    canCreatePayment,
    canCancelPayment
  }
}
