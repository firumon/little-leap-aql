import {
  progressOf,
  countsForUser,
  settledAt,
  daysSince,
  AGE_BANDS,
  ageBandOf,
  RECEIVED
} from 'src/_resource/Operation/SupplierQuotations/composables/useSupplierQuotationProgress'

// Ages the undecided queue, for whoever can clear it.
export default function (props, { resourceRecord, resourceConfig }) {
  return {
    title: 'Undecided Quotations',
    items: () => {
      if (resourceConfig?.allowed?.({ SupplierQuotations: 'reject' }) !== true) return []

      const records = resourceRecord?.records?.value
      if (!records || !records.length) return []

      const counts = AGE_BANDS.map(() => 0)

      for (const row of records) {
        if (!countsForUser(row)) continue
        if (progressOf(row) !== RECEIVED) continue
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
