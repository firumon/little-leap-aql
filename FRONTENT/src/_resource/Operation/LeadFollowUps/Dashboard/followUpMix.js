/**
 * Follow-up status distribution for talks booked in a selected date range.
 *
 * Answers: Of the talks booked in this window, where are they now?
 *
 * Uses:
 *   - useFollowUpResponseData: bookedMix, totalFollowUpsCount, range, loading, controls
 *   - useDataContext: rangeLabel
 *
 * Controls: range
 */

import { computed } from 'vue'
import useFollowUpResponseData from '../Data/useFollowUpResponseData'
import { useDataContext } from 'src/composables/data/useDataContext'

export default (props) => {
  const d = useFollowUpResponseData()
  const { rangeLabel } = useDataContext()

  return {
    widget: 'RingDonut',
    size: { xs: [6, 12], sm: [6, 12], md: [4, 6], lg: [3, 4, 6], xl: [3, 4] },
    permission: { LeadFollowUps: 'Read' },
    title: 'Booked follow-ups',
    controls: d.controls.filter((c) => ['range'].includes(c.name)),
    data: computed(() => ({
      items: d.bookedMix.value,
      caption: `Booked ${rangeLabel(d.range.value)}`,
      empty: d.totalFollowUpsCount.value === 0,
      loading: d.loading.value
    }))
  }
}
