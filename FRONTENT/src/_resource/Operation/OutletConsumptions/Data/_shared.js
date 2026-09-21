export {
  PENDING_INVOICE_GENERATION,
  INVOICE_GENERATED,
  CANCELLED,
  WORKFLOW_STATES,
  TERMINAL_STATES,
  IN_FLIGHT_STATES,
  PROGRESS_META,
  OVERDUE_TIERS,
  progressOf,
  progressColor,
  progressIcon,
  progressLabel,
  isActiveRow,
  isCancelled,
  isTerminal,
  defaultVisitFrequencyDays,
  visitFrequencyFor,
  overdueBands,
  overdueBandOf,
  overdueColor,
  isOverdue
} from '../composables/useConsumptionProgress'

export { WAIT_BANDS, bandCounts } from 'src/_resource/Operation/OutletRestocks/Data/_shared'
