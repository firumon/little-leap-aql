import { computed, ref, watch } from 'vue'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useResourceData } from 'src/composables/resources/useResourceData'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { formatCurrency, formatDate, progressMeta, PROGRESS_ORDER } from './supplierQuotationMeta'

const DAY_MS = 86400000

function text(value) {
  return (value || '').toString().trim()
}

function timestamp(row = {}, keys = []) {
  for (const key of keys) {
    const value = row[key]
    if (!value) continue
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return date.getTime()
    const numeric = Number(value)
    if (Number.isFinite(numeric) && numeric > 0) return numeric
  }
  return 0
}

export function useSupplierQuotationIndex() {
  const nav = useResourceNav()
  const { resourceName, permissions } = useResourceConfig()
  const quotations = useResourceData(resourceName)
  const suppliers = useResourceData(ref('Suppliers'))
  const procurements = useResourceData(ref('Procurements'))
  const searchTerm = ref('')
  const activeGroupKey = ref(null)

  const supplierByCode = computed(() =>
    new Map(suppliers.items.value.map((row) => [text(row.Code), row]))
  )

  const procurementByCode = computed(() =>
    new Map(procurements.items.value.map((row) => [text(row.Code), row]))
  )

  function supplierName(code) {
    return supplierByCode.value.get(text(code))?.Name || code || '-'
  }

  function isStale(row) {
    const progress = text(row.Progress).toUpperCase()
    const now = Date.now()
    if (progress === 'REJECTED') {
      const rejectedAt = timestamp(row, ['ProgressRejectedAt', 'UpdatedAt', 'ResponseRecordedAt', 'CreatedAt'])
      return rejectedAt > 0 && now - rejectedAt > 14 * DAY_MS
    }
    if (progress === 'ACCEPTED') {
      const procurement = procurementByCode.value.get(text(row.ProcurementCode))
      const updatedAt = timestamp(row, ['UpdatedAt', 'ResponseRecordedAt', 'CreatedAt'])
      return procurement?.Progress === 'COMPLETED' && updatedAt > 0 && now - updatedAt > 14 * DAY_MS
    }
    return false
  }

  const filteredItems = computed(() => {
    const keyword = searchTerm.value.trim().toLowerCase()
    return quotations.items.value
      .filter((row) => text(row.Status || 'Active') === 'Active')
      .filter((row) => !isStale(row))
      .filter((row) => {
        if (!keyword) return true
        return [
          row.Code,
          row.RFQCode,
          row.SupplierCode,
          supplierName(row.SupplierCode),
          row.ProcurementCode,
          row.ResponseType,
          row.Progress,
          row.Currency,
          row.TotalAmount,
          row.ResponseDate,
          row.ResponseRecordedAt
        ].map((value) => text(value).toLowerCase()).join(' ').includes(keyword)
      })
      .sort((a, b) =>
        timestamp(b, ['ResponseRecordedAt', 'UpdatedAt', 'ResponseDate', 'CreatedAt']) -
        timestamp(a, ['ResponseRecordedAt', 'UpdatedAt', 'ResponseDate', 'CreatedAt'])
      )
  })

  const groups = computed(() => {
    const base = [
      ...PROGRESS_ORDER.map((progress) => ({ progress, ...progressMeta(progress) })),
      { progress: '', ...progressMeta('OTHER') }
    ]
    const grouped = Object.fromEntries(base.map((group) => [group.key, []]))
    filteredItems.value.forEach((row) => {
      const progress = text(row.Progress).toUpperCase()
      const meta = PROGRESS_ORDER.includes(progress) ? progressMeta(progress) : progressMeta('OTHER')
      grouped[meta.key].push(row)
    })
    return base.map((group) => ({ ...group, records: grouped[group.key] || [] }))
      .filter((group) => group.records.length)
  })

  const totalVisible = computed(() => filteredItems.value.length)

  function isGroupExpanded(key) {
    return activeGroupKey.value === key
  }

  function toggleGroup(key) {
    activeGroupKey.value = activeGroupKey.value === key ? null : key
  }

  function navigateTo(row) {
    nav.goTo('view', { code: row.Code })
  }

  function navigateToAdd() {
    nav.goTo('add')
  }

  async function reload(forceSync = false) {
    await Promise.all([
      quotations.reload(forceSync),
      suppliers.reload(forceSync),
      procurements.reload(forceSync)
    ])
  }

  watch(() => resourceName.value, async (name) => {
    if (name) await reload()
  }, { immediate: true })

  watch(groups, (next) => {
    const keys = next.map((group) => group.key)
    if (!keys.includes(activeGroupKey.value)) {
      activeGroupKey.value = keys.includes('received') ? 'received' : (keys[0] || null)
    }
  }, { immediate: true })

  return {
    permissions,
    items: quotations.items,
    loading: quotations.loading,
    searchTerm,
    groups,
    totalVisible,
    reload,
    isGroupExpanded,
    toggleGroup,
    navigateTo,
    navigateToAdd,
    supplierName,
    formatDate,
    formatCurrency
  }
}
