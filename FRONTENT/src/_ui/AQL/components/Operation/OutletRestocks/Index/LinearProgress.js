import { useAuth } from 'src/composables/core/useAuth'
import {
  progressOf,
  countsForUser,
  APPROVED,
  PARTIALLY_DELIVERED,
  DELIVERED
} from 'src/_ui/AQL/composables/Operation/OutletRestocks/useRestockProgress'

/**
 * OutletRestocks › Index › LinearProgress — JS modifier (tier CP: resource + page).
 *
 * Fulfilment rate: of everything that was APPROVED and therefore owed to an outlet, how
 * much has actually arrived there?
 *
 *     DELIVERED / (APPROVED + PARTIALLY_DELIVERED + DELIVERED)
 *
 * The denominator is deliberately the post-approval set only. Drafts, pending approvals
 * and rejections never became a delivery obligation, and folding them in would let a
 * warehouse improve this bar by rejecting requests.
 *
 * PARTIALLY_DELIVERED counts wholly against the rate rather than fractionally: the
 * request row does not carry a fulfilled quantity (that lives on `OutletRestockItems`),
 * and a bar that silently reads a different grain than the counts beside it is worse
 * than a blunt one. It is an outlet-level "did the order land?" reading.
 *
 * Returns `[]` when nothing has been approved yet, which trips the section's strict hide
 * rule — a 0% bar on a workflow that has not started is a false alarm, not information.
 *
 * Rows are gated by `countsForUser` — Active, and not another user's draft. A draft
 * cannot reach this bar's numerator or denominator anyway (both sides are post-approval
 * states), so this changes no figure today. It is applied because the alternative is a
 * section that agrees with the rest of the page only by coincidence: the moment the
 * denominator grows an earlier state, the coincidence ends silently.
 *
 * `items` is function-valued for the same reason as `MetricCards.js`: a modifier's return
 * value is resolved once and cached, so only a closure sees the settled store. That file
 * also explains why `useAuth()` is safe at module level.
 */
const { user } = useAuth()

export default function (props, { resourceRecord }) {
  return {
    items: () => {
      const records = resourceRecord?.records?.value
      if (!records || !records.length) return []

      const me = user.value?.id

      let delivered = 0
      let outstanding = 0

      for (const row of records) {
        if (!countsForUser(row, me)) continue
        const progress = progressOf(row)
        if (progress === DELIVERED) delivered++
        else if (progress === APPROVED || progress === PARTIALLY_DELIVERED) outstanding++
      }

      const total = delivered + outstanding
      if (!total) return []

      return [
        { label: 'Fulfilment Rate', value: delivered, max: total, color: 'positive', unit: 'requests' }
      ]
    }
  }
}
