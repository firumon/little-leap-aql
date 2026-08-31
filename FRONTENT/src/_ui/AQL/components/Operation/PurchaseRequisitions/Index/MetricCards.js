import { useAuth } from 'src/composables/core/useAuth'
import {
  progressOf,
  countsForUser,
  isOverdue,
  PENDING_APPROVAL,
  REVISION_REQUIRED,
  APPROVED
} from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionProgress'

// Open queues only. Rejected and RFQ-processed rows are history and belong to the funnel.
const { user } = useAuth()

export default function (props, { resourceRecord }) {
  return {
    items: () => {
      const records = resourceRecord?.records?.value
      if (!records || !records.length) return []

      const me = user.value?.id
      let pendingApproval = 0
      let needsRevision = 0
      let awaitingSourcing = 0
      let overdue = 0

      for (const row of records) {
        if (!countsForUser(row, me)) continue
        const progress = progressOf(row)
        if (progress === PENDING_APPROVAL) pendingApproval++
        else if (progress === REVISION_REQUIRED) needsRevision++
        else if (progress === APPROVED) awaitingSourcing++
        if (isOverdue(row)) overdue++
      }

      if (!pendingApproval && !needsRevision && !awaitingSourcing && !overdue) return []

      return [
        { label: 'Pending Approval', number: pendingApproval, color: 'warning' },
        { label: 'Needs Revision', number: needsRevision, color: 'orange' },
        { label: 'Awaiting Sourcing', number: awaitingSourcing, color: 'primary' },
        { label: 'Past Required Date', number: overdue, color: 'negative' }
      ]
    }
  }
}
