export {
  DRAFT,
  PROCESSING,
  LATER,
  REJECTED,
  APPROVED,
  OPEN,
  SETTLED,
  SLEEPING,
  CLOSED,
  PROGRESS_ORDER,
  PROGRESS_COLORS,
  PROGRESS_STAMPS,
  progressOf,
  progressBucket,
  isOpen,
  isSleeping,
  isClosed
} from '../composables/useLeadProgress'

export {
  enrichLead,
  indexLeadsByType
} from '../composables/useLeadResource'

export const PROCESSING_AGE_BANDS = [
  { label: '0-7 days', max: 8 },
  { label: '8-30 days', max: 31 },
  { label: '31-90 days', max: 91 },
  { label: '90+ days', max: Infinity }
]
