import { useAuth } from 'src/composables/core/useAuth'
import {
  IN_FLIGHT_STATES,
  progressOf,
  countsForUser,
  progressLabel,
  progressColor,
  progressIcon
} from 'src/_resource/Operation/PurchaseOrders/composables/usePurchaseOrderProgress'

// In-flight states only. Terminal rows accumulate forever and would squeeze the live
// stages into slivers.
const { user } = useAuth()

export default function (props, { resourceRecord }) {
  return {
    title: 'Purchase Order Pipeline',
    items: () => {
      const records = resourceRecord?.records?.value
      if (!records || !records.length) return []

      const me = user.value?.id
      const counts = Object.create(null)

      for (const row of records) {
        if (!countsForUser(row, me)) continue
        const progress = progressOf(row)
        if (!progress) continue
        counts[progress] = (counts[progress] || 0) + 1
      }

      return IN_FLIGHT_STATES.map((state) => ({
        label: progressLabel(state),
        count: counts[state] || 0,
        color: progressColor(state),
        icon: progressIcon(state)
      }))
    }
  }
}
