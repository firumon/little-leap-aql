import { computed } from 'vue'
import { defineSharedComposable } from 'src/utils/appHelpers'
import { useDataStore } from 'src/stores/data'
import { daysFromToday } from 'src/utils/dateHelpers'
import { CANCELLED, progressOf, isActiveRow } from './useConsumptionProgress'

export const VOLUME_WINDOW_DAYS = 7
export const VOLUME_TOP_LIMIT = 5

const asRow = (value) => (value && typeof value === 'object' ? value : {})
const text = (value) => (value == null ? '' : String(value).trim())
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)

// A Map, not an array: every line resolves its parent in O(1).
export function countedConsumptions (consumptions = [], days = VOLUME_WINDOW_DAYS) {
  const kept = new Map()
  for (const raw of (Array.isArray(consumptions) ? consumptions : [])) {
    const row = asRow(raw)
    if (!isActiveRow(row)) continue
    if (progressOf(row) === CANCELLED) continue
    const age = -daysFromToday(row.Date)
    if (Number.isNaN(age) || age > days || age < 0) continue
    const code = text(row.Code)
    if (code) kept.set(code, row)
  }
  return kept
}

export function topConsumedBy (counted, items = [], labelOf, limit = VOLUME_TOP_LIMIT) {
  const totals = new Map()

  for (const raw of (Array.isArray(items) ? items : [])) {
    const line = asRow(raw)
    if (!isActiveRow(line)) continue
    const parent = counted.get(text(line.OutletConsumptionCode))
    if (!parent) continue
    const quantity = num(line.Qty)
    if (quantity <= 0) continue
    const label = text(labelOf(line, parent))
    if (!label) continue
    totals.set(label, (totals.get(label) || 0) + quantity)
  }

  return Array.from(totals.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

const shared = defineSharedComposable((dataStore) => {
  const rows = (name) => (dataStore.getRecords(name) || []).map(asRow)

  const counted = computed(() => countedConsumptions(rows('OutletConsumptions')))

  // A SKU is read by its product name: a bar labelled `SKU-0147` names the row, not the thing.
  const skuLabel = computed(() => {
    const productName = new Map(rows('Products').map((row) => [text(row.Code), text(row.Name)]))
    return new Map(rows('SKUs').map((row) => {
      const code = text(row.Code)
      return [code, productName.get(text(row.ProductCode)) || code]
    }))
  })

  const outletLabel = computed(() =>
    new Map(rows('Outlets').map((row) => [text(row.Code), text(row.Name)])))

  const topItems = computed(() => topConsumedBy(counted.value, rows('OutletConsumptionItems'),
    (line) => skuLabel.value.get(text(line.SKU)) || text(line.SKU)))

  const topOutlets = computed(() => topConsumedBy(counted.value, rows('OutletConsumptionItems'),
    (line, parent) => outletLabel.value.get(text(parent.OutletCode)) || text(parent.OutletCode)))

  return { windowDays: VOLUME_WINDOW_DAYS, topItems, topOutlets }
})

export function useConsumptionVolume () {
  return shared(useDataStore())
}
