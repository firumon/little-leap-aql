import { useAuth } from 'src/composables/core/useAuth'
import {
  progressOf,
  countsForUser,
  settledAt,
  daysSince,
  AGE_BANDS,
  ageBandOf,
  SENT
} from 'src/_resource/Operation/RFQs/composables/useRFQProgress'

// Ages RFQs that are out for quoting, for whoever can chase or close them.
const { user } = useAuth()

export default function (props, { resourceRecord, resourceConfig }) {
  return {
    title: 'Awaiting Quotations',
    items: () => {
      if (resourceConfig?.allowed?.({ RFQs: 'close' }) !== true) return []

      const records = resourceRecord?.records?.value
      if (!records || !records.length) return []

      const me = user.value?.id
      const counts = AGE_BANDS.map(() => 0)

      for (const row of records) {
        if (!countsForUser(row, me)) continue
        if (progressOf(row) !== SENT) continue
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
