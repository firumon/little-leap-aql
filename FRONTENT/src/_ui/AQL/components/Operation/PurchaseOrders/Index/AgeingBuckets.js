import {
  progressOf,
  countsForUser,
  settledAt,
  daysSince,
  AGE_BANDS,
  ageBandOf,
  SENT,
  ACKNOWLEDGED,
  ACCEPTED
} from 'src/_resource/Operation/PurchaseOrders/composables/usePurchaseOrderProgress'

// Ages orders that are out with a supplier and still owe goods.
const OPEN_STATES = [SENT, ACKNOWLEDGED, ACCEPTED]

export default function (props, { resourceRecord, resourceConfig }) {
  return {
    title: 'Open Orders Ageing',
    items: () => {
      if (resourceConfig?.allowed?.({ PurchaseOrders: 'cancel' }) !== true) return []

      const records = resourceRecord?.records?.value
      if (!records || !records.length) return []

      const counts = AGE_BANDS.map(() => 0)

      for (const row of records) {
        if (!countsForUser(row)) continue
        if (!OPEN_STATES.includes(progressOf(row))) continue
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
