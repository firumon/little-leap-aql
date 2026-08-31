import { useAuth } from 'src/composables/core/useAuth'
import {
  progressOf,
  countsForUser,
  DRAFT,
  CONFIRMED
} from 'src/_resource/Operation/POReceivings/composables/usePOReceivingProgress'

// Open queues only: inspections still being counted, and confirmed ones awaiting a GRN.
const { user } = useAuth()

export default function (props, { resourceRecord }) {
  return {
    items: () => {
      const records = resourceRecord?.records?.value
      if (!records || !records.length) return []

      const me = user.value?.id
      let drafts = 0
      let awaitingGrn = 0

      for (const row of records) {
        if (!countsForUser(row, me)) continue
        const progress = progressOf(row)
        if (progress === DRAFT) drafts++
        else if (progress === CONFIRMED) awaitingGrn++
      }

      if (!drafts && !awaitingGrn) return []

      return [
        { label: 'Inspections in Progress', number: drafts, color: 'warning' },
        { label: 'Awaiting GRN', number: awaitingGrn, color: 'primary' }
      ]
    }
  }
}
