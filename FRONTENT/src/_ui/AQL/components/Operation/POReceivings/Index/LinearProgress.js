import { useAuth } from 'src/composables/core/useAuth'
import {
  progressOf,
  countsForUser,
  CONFIRMED,
  GRN_GENERATED
} from 'src/_resource/Operation/POReceivings/composables/usePOReceivingProgress'

// Of everything that passed inspection, how much has been posted as a goods receipt.
// Drafts never became an obligation, and cancellations were written off.
const { user } = useAuth()

export default function (props, { resourceRecord }) {
  return {
    items: () => {
      const records = resourceRecord?.records?.value
      if (!records || !records.length) return []

      const me = user.value?.id
      let posted = 0
      let waiting = 0

      for (const row of records) {
        if (!countsForUser(row, me)) continue
        const progress = progressOf(row)
        if (progress === GRN_GENERATED) posted++
        else if (progress === CONFIRMED) waiting++
      }

      const total = posted + waiting
      if (!total) return []

      return [{ label: 'GRN Completion', value: posted, max: total, color: 'positive', unit: 'receivings' }]
    }
  }
}
