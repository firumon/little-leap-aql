import { computed } from 'vue'
import { useDataStore } from 'src/stores/data'
import { defineSharedComposable } from 'src/utils/appHelpers'

// OutletVisits grouped by outlet - `{ OutletCode: [visit, ...] }`, soonest date first.
// One pass for the whole app, so no caller filters the visit sheet per outlet.

const RESOURCE_NAME = 'OutletVisits'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const isActiveRow = (value) => {
  const status = text(asRow(value).Status)
  return !status || status.toUpperCase() === 'ACTIVE'
}

export function indexVisitsByOutlet (rows = []) {
  const byOutlet = new Map()

  ;(Array.isArray(rows) ? rows : []).forEach((entry) => {
    const row = asRow(entry)
    if (!isActiveRow(row)) return
    const outlet = text(row.OutletCode)
    if (!outlet) return
    const bucket = byOutlet.get(outlet)
    if (bucket) bucket.push(row)
    else byOutlet.set(outlet, [row])
  })

  byOutlet.forEach((bucket) => bucket.sort((a, b) => (text(a.Date) < text(b.Date) ? -1 : 1)))
  return byOutlet
}

const shared = defineSharedComposable((dataStore) => {
  const rawVisits = computed(() => (dataStore.getRecords(RESOURCE_NAME) || []).map(asRow))
  const visitsByOutlet = computed(() => indexVisitsByOutlet(rawVisits.value))

  return {
    RESOURCE_NAME,
    rawVisits,
    visitsByOutlet,
    visitsOf: (outletCode) => visitsByOutlet.value.get(text(outletCode)) || []
  }
})

export function useVisitResource () {
  return shared(useDataStore())
}
