/**
 * The approval side of outlet restocks: what waits for a yes, how long it waits,
 * how fast approvers answer, and how the whole pile is spread across states.
 *
 * Reads:
 *   OutletRestocks: Progress, Status, CreatedBy, RequestedUser,
 *                   ProgressSubmittedAt, ProgressApprovedAt
 *
 * Exposes:
 *   loading          - true while OutletRestocks is loading and has no rows
 *   totalCount       - every active restock this user may count (other people's drafts left out)
 *   awaitingCount    - restocks at PENDING_APPROVAL
 *   awaitingOverWeek - of those, how many were submitted more than 7 days ago
 *   revisionCount    - restocks at REVISION_REQUIRED (sent back to fix)
 *   approvalWait     - PENDING_APPROVAL restocks in 4 age bands, age from ProgressSubmittedAt
 *   progressMix      - every counted restock by its Progress, with readable labels
 *   funnel           - how many restocks reached each of 4 steps: raised, sent, approved, delivered
 *   hoursToApprove   - mean hours from ProgressSubmittedAt to ProgressApprovedAt, rounded
 *   approvedSample   - how many restocks went into hoursToApprove
 *   controls         - none
 *
 * Controls:
 *   none
 */

import { computed } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useDataContext } from 'src/composables/data/useDataContext'
import { useAuth } from 'src/composables/core/useAuth'
import {
  WORKFLOW_STATES,
  PROGRESS_LABELS,
  FUNNEL_STEPS,
  progressOf,
  isPendingApproval,
  isRevisionRequired,
  countsForUser,
  bandCounts
} from './_shared'

export default function useRestockApprovalData () {
  const { rows, isLoading, remember } = useRecord()
  const { daysSince, hoursBetween, mean } = useDataContext()
  const { user } = useAuth()

  return remember('useRestockApprovalData', () => {
    const loading = computed(() => isLoading('OutletRestocks') && rows('OutletRestocks').length === 0)

    const counted = computed(() => rows('OutletRestocks').filter((r) => countsForUser(r, user.value?.id)))
    const totalCount = computed(() => counted.value.length)

    const awaiting = computed(() => counted.value.filter(isPendingApproval))
    const awaitingCount = computed(() => awaiting.value.length)
    const awaitingOverWeek = computed(() =>
      awaiting.value.filter((r) => (daysSince(r.ProgressSubmittedAt) ?? 0) > 7).length)

    const revisionCount = computed(() => counted.value.filter(isRevisionRequired).length)

    const approvalWait = computed(() => bandCounts(awaiting.value.map((r) => daysSince(r.ProgressSubmittedAt))))

    const progressMix = computed(() => {
      const counts = new Map()
      for (const r of counted.value) {
        const p = progressOf(r)
        counts.set(p, (counts.get(p) || 0) + 1)
      }
      return WORKFLOW_STATES
        .filter((s) => counts.get(s))
        .map((s) => ({ label: PROGRESS_LABELS[s], value: counts.get(s) }))
    })

    const funnel = computed(() => FUNNEL_STEPS.map((step) => ({
      label: step.label,
      value: counted.value.filter((r) => step.codes.includes(progressOf(r))).length
    })))

    const approvalHours = computed(() => counted.value
      .filter((r) => r.ProgressSubmittedAt && r.ProgressApprovedAt)
      .map((r) => hoursBetween(r.ProgressSubmittedAt, r.ProgressApprovedAt))
      .filter((h) => h !== null && h >= 0))
    const hoursToApprove = computed(() => Math.round(mean(approvalHours.value) ?? 0))
    const approvedSample = computed(() => approvalHours.value.length)

    const controls = []

    return {
      loading,
      totalCount,
      awaitingCount,
      awaitingOverWeek,
      revisionCount,
      approvalWait,
      progressMix,
      funnel,
      hoursToApprove,
      approvedSample,
      controls
    }
  })
}
