import { useAuth } from 'src/composables/core/useAuth'
import { useDataStore } from 'src/stores/data'
import {
  progressOf,
  countsForUser,
  isDeadlinePassed,
  supplierRowsOf,
  DRAFT,
  SENT,
  SUPPLIER_ASSIGNED
} from 'src/_resource/Operation/RFQs/composables/useRFQProgress'

// Open queues only: drafts to finish, RFQs out for quoting, suppliers not yet sent,
// and deadlines that have slipped.
const { user } = useAuth()

export default function (props, { resourceRecord }) {
  const dataStore = useDataStore()

  return {
    items: () => {
      const records = resourceRecord?.records?.value
      if (!records || !records.length) return []

      const me = user.value?.id
      const supplierRows = dataStore.getRecords('RFQSuppliers')

      let drafts = 0
      let outForQuoting = 0
      let awaitingDispatch = 0
      let deadlinePassed = 0

      for (const row of records) {
        if (!countsForUser(row, me)) continue
        const progress = progressOf(row)
        if (progress === DRAFT) drafts++
        else if (progress === SENT) {
          outForQuoting++
          if (isDeadlinePassed(row)) deadlinePassed++
          const assigned = supplierRowsOf(row, supplierRows)
            .filter((entry) => String(entry.Progress ?? '').trim().toUpperCase() === SUPPLIER_ASSIGNED)
          if (assigned.length) awaitingDispatch++
        }
      }

      if (!drafts && !outForQuoting && !awaitingDispatch && !deadlinePassed) return []

      return [
        { label: 'Drafts', number: drafts, color: 'grey-7' },
        { label: 'Out for Quoting', number: outForQuoting, color: 'primary' },
        { label: 'Awaiting Dispatch', number: awaitingDispatch, color: 'warning' },
        { label: 'Deadline Passed', number: deadlinePassed, color: 'negative' }
      ]
    }
  }
}
