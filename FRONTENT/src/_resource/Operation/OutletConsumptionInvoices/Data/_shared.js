export {
  PENDING_PAYMENT,
  PARTIALLY_PAID,
  PAID,
  CANCELLED,
  PROGRESS_META,
  OPEN_STATES,
  TERMINAL_STATES,
  SETTLEMENT_OTHER,
  settlementReasons,
  progressOf,
  progressMetaOf,
  isOpen,
  isCancelled,
  isPaid,
  progressForBalance,
  transitionForBalance,
  settlementGate,
  settlementOf
} from '../composables/useInvoiceWorkflow'

export {
  grandTotalOf,
  settledOffOf,
  countsAsPayment,
  balanceDueOf
} from '../composables/useInvoiceCalculation'

export const isActiveRow = (row) => {
  const status = String(row?.Status ?? 'Active').trim()
  return !status || status.toUpperCase() === 'ACTIVE'
}
