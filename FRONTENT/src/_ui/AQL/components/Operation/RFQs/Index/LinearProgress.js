import { useAuth } from 'src/composables/core/useAuth'
import { useDataStore } from 'src/stores/data'
import {
  progressOf,
  countsForUser,
  supplierRowsOf,
  SENT,
  SUPPLIER_RESPONDED
} from 'src/_resource/Operation/RFQs/composables/useRFQProgress'

// Response rate across every RFQ that is actually out for quoting. Drafts never asked
// anyone for anything, so they stay out of the denominator.
const { user } = useAuth()

export default function (props, { resourceRecord }) {
  const dataStore = useDataStore()

  return {
    items: () => {
      const records = resourceRecord?.records?.value
      if (!records || !records.length) return []

      const me = user.value?.id
      const supplierRows = dataStore.getRecords('RFQSuppliers')

      let responded = 0
      let asked = 0

      for (const row of records) {
        if (!countsForUser(row, me)) continue
        if (progressOf(row) !== SENT) continue
        for (const entry of supplierRowsOf(row, supplierRows)) {
          asked++
          if (String(entry.Progress ?? '').trim().toUpperCase() === SUPPLIER_RESPONDED) responded++
        }
      }

      if (!asked) return []

      return [{ label: 'Supplier Response Rate', value: responded, max: asked, color: 'positive', unit: 'suppliers' }]
    }
  }
}
