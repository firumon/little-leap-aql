import {
  progressOf,
  countsForUser,
  ACCEPTED,
  RECEIVED
} from 'src/_resource/Operation/SupplierQuotations/composables/useSupplierQuotationProgress'

// Acceptance rate over quotations that reached a decision point. Rejections stay in
// the denominator because they were real candidates.
export default function (props, { resourceRecord }) {
  return {
    items: () => {
      const records = resourceRecord?.records?.value
      if (!records || !records.length) return []

      let accepted = 0
      let open = 0

      for (const row of records) {
        if (!countsForUser(row)) continue
        const progress = progressOf(row)
        if (progress === ACCEPTED) accepted++
        else if (progress === RECEIVED) open++
      }

      const total = accepted + open
      if (!total) return []

      return [{ label: 'Quotations Converted', value: accepted, max: total, color: 'positive', unit: 'quotations' }]
    }
  }
}
