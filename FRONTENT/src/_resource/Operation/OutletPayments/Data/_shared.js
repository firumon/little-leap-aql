export {
  SUBMITTED,
  CANCELLED,
  progressOf,
  isSubmitted,
  isCancelled
} from '../composables/useOutletPaymentProgress'

export {
  countsAsPayment
} from '../composables/useOutletPaymentAllocation'

export const isActiveRow = (row) => {
  const status = String(row?.Status ?? 'Active').trim()
  return !status || status.toUpperCase() === 'ACTIVE'
}
