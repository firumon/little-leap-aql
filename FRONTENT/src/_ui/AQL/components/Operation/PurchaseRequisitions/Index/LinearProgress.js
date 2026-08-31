import { useAuth } from 'src/composables/core/useAuth'
import {
  progressOf,
  countsForUser,
  APPROVED,
  RFQ_PROCESSED
} from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionProgress'

// Sourcing rate: of everything approved, how much has reached an RFQ. Drafts and
// rejections never became a sourcing obligation, so they stay out of the denominator.
const { user } = useAuth()

export default function (props, { resourceRecord }) {
  return {
    items: () => {
      const records = resourceRecord?.records?.value
      if (!records || !records.length) return []

      const me = user.value?.id
      let sourced = 0
      let outstanding = 0

      for (const row of records) {
        if (!countsForUser(row, me)) continue
        const progress = progressOf(row)
        if (progress === RFQ_PROCESSED) sourced++
        else if (progress === APPROVED) outstanding++
      }

      const total = sourced + outstanding
      if (!total) return []

      return [{ label: 'Sourcing Rate', value: sourced, max: total, color: 'positive', unit: 'requisitions' }]
    }
  }
}
