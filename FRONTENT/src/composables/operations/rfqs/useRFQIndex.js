import { computed, ref, watch } from 'vue'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useResourceData } from 'src/composables/resources/useResourceData'
import { useResourceNav } from 'src/composables/resources/useResourceNav'

const GROUPS = [
  { key: 'draft', label: 'Draft', progress: 'DRAFT', color: '#c2410c', icon: 'priority_high', actionHint: 'Prepare' },
  { key: 'sent', label: 'Sent To Suppliers', progress: 'SENT', color: '#0f766e', icon: 'outgoing_mail', actionHint: 'Track' },
  { key: 'closed', label: 'Closed', progress: 'CLOSED', color: '#15803d', icon: 'check_circle', actionHint: 'View' },
  { key: 'cancelled', label: 'Cancelled', progress: 'CANCELLED', color: '#b91c1c', icon: 'cancel', actionHint: 'View' },
  { key: 'others', label: 'Others', progress: '', color: '#475569', icon: 'folder_open', actionHint: 'Open' }
]

export function useRFQIndex() {
  const nav = useResourceNav()
  const { resourceName, permissions } = useResourceConfig()
  const { items, loading, reload } = useResourceData(resourceName)
  const searchTerm = ref('')
  const activeGroupKey = ref(null)

  const filteredItems = computed(() => {
    const keyword = searchTerm.value.trim().toLowerCase()
    const activeItems = items.value.filter((row) => (row.Status || 'Active') === 'Active')
    if (!keyword) return activeItems
    return activeItems.filter((row) => Object.values(row || {})
      .map((value) => (value || '').toString().toLowerCase())
      .join(' ')
      .includes(keyword))
  })

  function groupFor(progress) {
    return GROUPS.find((group) => group.progress && group.progress === progress) || GROUPS[GROUPS.length - 1]
  }

  const visibleGroups = computed(() => {
    const grouped = Object.fromEntries(GROUPS.map((group) => [group.key, []]))
    filteredItems.value.forEach((row) => grouped[groupFor(row.Progress).key].push(row))
    return GROUPS.map((group) => ({ ...group, records: grouped[group.key] || [] }))
      .filter((group) => group.records.length)
  })

  const totalVisible = computed(() => filteredItems.value.length)

  function isGroupExpanded(key) {
    return activeGroupKey.value === key
  }

  function toggleGroup(key) {
    activeGroupKey.value = activeGroupKey.value === key ? null : key
  }

  function formatDate(value) {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
  }

  function isOverdue(value) {
    if (!value) return false
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return false
    return date < new Date()
  }

  function navigateTo(row) {
    nav.goTo('view', { code: row.Code })
  }

  function navigateToAdd() {
    nav.goTo('add')
  }

  watch(() => resourceName.value, async (name) => {
    if (name) await reload()
  }, { immediate: true })

  watch(visibleGroups, (groups) => {
    const keys = groups.map((group) => group.key)
    if (!keys.includes(activeGroupKey.value)) {
      activeGroupKey.value = keys.includes('draft') ? 'draft' : (keys[0] || null)
    }
  }, { immediate: true })

  return {
    permissions,
    items,
    loading,
    reload,
    searchTerm,
    activeGroupKey,
    visibleGroups,
    totalVisible,
    isGroupExpanded,
    toggleGroup,
    formatDate,
    isOverdue,
    navigateTo,
    navigateToAdd
  }
}
