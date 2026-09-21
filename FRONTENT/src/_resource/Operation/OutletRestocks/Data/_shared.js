export {
  DRAFT,
  PENDING_APPROVAL,
  REVISION_REQUIRED,
  APPROVED,
  PARTIALLY_DELIVERED,
  DELIVERED,
  WORKFLOW_STATES,
  AWAITING_DELIVERY,
  PROGRESS_LABELS,
  progressOf,
  isDraft,
  isPendingApproval,
  isRevisionRequired,
  isAwaitingDelivery,
  isOwnedBy,
  isActiveRow,
  countsForUser
} from '../composables/useRestockProgress'

export const WAIT_BANDS = [
  { label: 'Under 1 day', max: 1 },
  { label: '1 to 3 days', max: 3 },
  { label: '3 to 7 days', max: 7 },
  { label: 'Over 7 days', max: Infinity }
]

export const FUNNEL_STEPS = [
  { label: 'Raised', codes: ['DRAFT', 'PENDING_APPROVAL', 'REVISION_REQUIRED', 'APPROVED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'REJECTED'] },
  { label: 'Sent for approval', codes: ['PENDING_APPROVAL', 'REVISION_REQUIRED', 'APPROVED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'REJECTED'] },
  { label: 'Approved', codes: ['APPROVED', 'PARTIALLY_DELIVERED', 'DELIVERED'] },
  { label: 'Delivered', codes: ['DELIVERED'] }
]

export const bandCounts = (ages) => {
  const bands = WAIT_BANDS.map((b) => ({ label: b.label, value: 0 }))
  for (const age of ages) {
    if (age === null || age < 0) continue
    const i = WAIT_BANDS.findIndex((b) => age < b.max)
    bands[i === -1 ? bands.length - 1 : i].value++
  }
  return bands
}
