import { useAuth } from 'src/composables/core/useAuth'
import {
  progressOf,
  countsForUser,
  settledAt,
  daysSince,
  AGE_BANDS,
  ageBandOf,
  CONFIRMED
} from 'src/_resource/Operation/POReceivings/composables/usePOReceivingProgress'

// Ages confirmed inspections that have not been posted yet, for whoever posts them.
const { user } = useAuth()

export default function (props, { resourceRecord, resourceConfig }) {
  return {
    title: 'Awaiting GRN Ageing',
    items: () => {
      if (resourceConfig?.allowed?.({ POReceivings: 'generateGRN' }) !== true) return []

      const records = resourceRecord?.records?.value
      if (!records || !records.length) return []

      const me = user.value?.id
      const counts = AGE_BANDS.map(() => 0)

      for (const row of records) {
        if (!countsForUser(row, me)) continue
        if (progressOf(row) !== CONFIRMED) continue
        const band = ageBandOf(daysSince(settledAt(row)))
        if (!band) continue
        const index = AGE_BANDS.indexOf(band)
        if (index >= 0) counts[index]++
      }

      return AGE_BANDS.map((band, index) => ({
        label: band.label,
        caption: band.caption,
        color: band.color,
        count: counts[index]
      }))
    }
  }
}
