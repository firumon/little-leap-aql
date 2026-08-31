import {
  isActiveRow,
  isTerminal,
  settledAt,
  daysSince,
  AGE_BANDS,
  ageBandOf
} from 'src/_resource/Operation/Procurements/composables/useProcurementProgress'

// Ages every procurement still in flight. A stalled one is the whole point of this board.
export default function (props, { resourceRecord }) {
  return {
    title: 'In-Flight Ageing',
    items: () => {
      const records = resourceRecord?.records?.value
      if (!records || !records.length) return []

      const counts = AGE_BANDS.map(() => 0)

      for (const row of records) {
        if (!isActiveRow(row) || isTerminal(row)) continue
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
