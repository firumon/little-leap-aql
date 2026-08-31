import {
  progressOf,
  countsForUser,
  isExpired,
  isDeclined,
  RECEIVED
} from 'src/_resource/Operation/SupplierQuotations/composables/useSupplierQuotationProgress'

// Open queues only: quotations still awaiting a decision, and the ones going stale.
export default function (props, { resourceRecord }) {
  return {
    items: () => {
      const records = resourceRecord?.records?.value
      if (!records || !records.length) return []

      let awaitingDecision = 0
      let expiring = 0
      let declined = 0

      for (const row of records) {
        if (!countsForUser(row)) continue
        if (progressOf(row) !== RECEIVED) continue
        awaitingDecision++
        if (isExpired(row)) expiring++
        if (isDeclined(row)) declined++
      }

      if (!awaitingDecision && !expiring && !declined) return []

      return [
        { label: 'Awaiting Decision', number: awaitingDecision, color: 'warning' },
        { label: 'Past Validity', number: expiring, color: 'negative' },
        { label: 'Declined', number: declined, color: 'grey-7' }
      ]
    }
  }
}
