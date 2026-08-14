import { useAuth } from 'src/composables/core/useAuth'
import {
  progressOf,
  countsForUser,
  PENDING_APPROVAL,
  REVISION_REQUIRED,
  AWAITING_DELIVERY
} from 'src/_resource/Operation/OutletRestocks/composables/useRestockProgress'

/**
 * OutletRestocks › Index › MetricCards — JS modifier (tier CP: resource + page).
 *
 * Three counts, and deliberately only three: each one is a QUEUE SOMEONE OWNS, so every
 * card answers "is there work for me right now?". Totals that nobody can act on
 * (Delivered, Rejected, the all-time request count) are history and belong to the
 * funnel below, which shows them in proportion rather than as a number to be proud of.
 *
 * `items` is FUNCTION-VALUED because a JS modifier is invoked ONCE, at resolve time, and
 * its return value is cached by `useSectionResolver`. A plain array would freeze at
 * whatever the store held on that first tick — usually empty, since the index page
 * resolves its sections before the fetch settles. The closure is re-run by
 * `evaluateProp` on every render, so the counts track the store.
 *
 * Counted from `records` (every row this user may see), NOT `filteredRecords`: these
 * cards are the reason to switch views, so they must not change when a view is switched.
 *
 * `countsForUser` is the page-wide row gate — Active, and not someone else's draft. None
 * of the three counts here is a draft count, so it changes no number today; it is applied
 * so that it cannot start to. A fourth card counting DRAFT would otherwise reintroduce
 * the leak silently, and the whole point of the shared predicate is that a section cannot
 * opt out of the rule by forgetting about it.
 *
 * `useAuth()` at MODULE level is safe: it only reaches Pinia stores and calls no
 * `inject()`. `user` stays a computed, so the closure below reads the LIVE session user
 * on every render rather than whoever was signed in at import time.
 */
const { user } = useAuth()

export default function (props, { resourceRecord }) {
  return {
    items: () => {
      const records = resourceRecord?.records?.value
      if (!records || !records.length) return []

      const me = user.value?.id

      let pendingApproval = 0
      let needsRevision = 0
      let pendingCompletion = 0

      for (const row of records) {
        if (!countsForUser(row, me)) continue
        const progress = progressOf(row)
        if (progress === PENDING_APPROVAL) pendingApproval++
        else if (progress === REVISION_REQUIRED) needsRevision++
        else if (AWAITING_DELIVERY.includes(progress)) pendingCompletion++
      }

      return [
        { label: 'Pending Approval', number: pendingApproval, color: 'warning' },
        { label: 'Needs Revision', number: needsRevision, color: 'orange' },
        { label: 'Pending Completion', number: pendingCompletion, color: 'primary' }
      ]
    }
  }
}
