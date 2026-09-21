export {
  PLANNED,
  COMPLETED,
  POSTPONED,
  CANCELLED,
  RESPONDED,
  PROGRESS_ORDER,
  PROGRESS_COLORS,
  PROGRESS_ICONS,
  PROGRESS_STAMPS,
  DELAY_BANDS,
  progressOf,
  progressOrStatusOf,
  isKnownProgress,
  progressBucket,
  isPlanned,
  isResponded,
  isEditable,
  canRespond,
  canComplete,
  canPostpone,
  canCancel,
  progressColor,
  progressIcon,
  progressLabel,
  progressComment,
  progressBy,
  plannedComment,
  respondDelayDays,
  daysUntilVisit,
  delayColor
} from '../composables/useVisitProgress'

export {
  defaultVisitFrequencyDays,
  visitFrequencyFor,
  visitDateFrom,
  visitDaysBetween
} from '../composables/useVisitCadence'

export const isActiveRow = (row) => {
  const status = String(row?.Status ?? 'Active').trim()
  return !status || status.toUpperCase() === 'ACTIVE'
}
