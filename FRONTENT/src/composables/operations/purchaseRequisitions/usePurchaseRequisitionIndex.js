import { ref, computed, watch } from 'vue'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useResourceData } from 'src/composables/resources/useResourceData'
import { useResourceNav } from 'src/composables/resources/useResourceNav'

const GROUP_DEFS = [
  {
    key: 'revision',
    label: 'Revision Required',
    match: (progress) => progress === 'Revision Required',
    color: '#c2410c',
    icon: 'edit_note',
    actionIcon: 'edit',
    actionHint: 'Open'
  },
  {
    key: 'draft',
    label: 'Draft',
    match: (progress) => progress === 'Draft',
    color: '#6d28d9',
    icon: 'drafts',
    actionIcon: 'edit',
    actionHint: 'Open'
  },
  {
    key: 'pending',
    label: 'Pending Approval',
    match: (progress) => progress === 'Pending Approval',
    color: '#0f766e',
    icon: 'fact_check',
    actionIcon: 'visibility',
    actionHint: 'Review'
  },
  {
    key: 'approved',
    label: 'Approved',
    match: (progress) => progress === 'Approved',
    color: '#15803d',
    icon: 'check_circle',
    actionIcon: 'visibility',
    actionHint: 'View'
  },
  {
    key: 'rejected',
    label: 'Rejected',
    match: (progress) => progress === 'Rejected',
    color: '#b91c1c',
    icon: 'cancel',
    actionIcon: 'visibility',
    actionHint: 'View'
  },
  {
    key: 'others',
    label: 'Others',
    match: () => true,
    color: '#475569',
    icon: 'folder_open',
    actionIcon: 'open_in_new',
    actionHint: 'Open'
  }
]

function isWithinLastTenDays(value) {
  if (!value) return false
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  const diff = Date.now() - date.getTime()
  return diff >= 0 && diff <= 10 * 24 * 60 * 60 * 1000
}

export function usePurchaseRequisitionIndex() {
  const nav = useResourceNav()
  const { resourceName, permissions } = useResourceConfig()
  const { items, loading, reload } = useResourceData(resourceName)

  const searchTerm = ref('')
  const activeGroupKey = ref(null)

  const filteredItems = computed(() => {
    const keyword = (searchTerm.value || '').trim().toLowerCase()
    const list = items.value.filter((row) => (row.Status || 'Active') === 'Active')
    if (!keyword) return list

    return list.filter((row) =>
      Object.values(row || {})
        .map((value) => (value ?? '').toString().toLowerCase())
        .join(' ')
        .includes(keyword)
    )
  })

  function getGroup(progress) {
    return GROUP_DEFS.find((group) => group.match(progress || 'Draft'))
  }

  const groupedRecords = computed(() => {
    const grouped = {}
    GROUP_DEFS.forEach((group) => { grouped[group.key] = [] })

    filteredItems.value.forEach((row) => {
      const group = getGroup(row.Progress)
      grouped[group.key].push(row)
    })

    return grouped
  })

  const visibleGroups = computed(() =>
    GROUP_DEFS
      .map((group) => ({
        ...group,
        records: groupedRecords.value[group.key] || []
      }))
      .filter((group) => group.records.length > 0)
  )

  const totalVisible = computed(() => filteredItems.value.length)

  const initialExpandedGroupKey = computed(() => {
    const revisionGroup = visibleGroups.value.find((group) => group.key === 'revision')
    if (revisionGroup) return 'revision'

    const rejectedGroup = visibleGroups.value.find((group) => group.key === 'rejected')
    if (rejectedGroup && rejectedGroup.records.some((row) => isWithinLastTenDays(row.UpdatedAt))) {
      return 'rejected'
    }

    return null
  })

  function priorityColor(priority) {
    if (!priority) return 'grey-5'
    const map = { urgent: 'negative', high: 'deep-orange', medium: 'warning', low: 'positive' }
    return map[priority.toLowerCase()] || 'grey-5'
  }

  function formatDate(value) {
    if (!value) return ''
    try {
      return new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: '2-digit' })
    } catch {
      return value
    }
  }

  function isOverdue(value) {
    if (!value) return false
    return new Date(value) < new Date()
  }

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

  watch(() => resourceName.value, async (name) => {
    if (name) await reload()
  }, { immediate: true })

  watch(visibleGroups, (groups) => {
    const visibleKeys = groups.map((group) => group.key)
    if (!visibleKeys.includes(activeGroupKey.value)) {
      activeGroupKey.value = initialExpandedGroupKey.value
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
    priorityColor,
    formatDate,
    isOverdue,
    isGroupExpanded,
    toggleGroup,
    navigateTo,
    navigateToAdd
  }
}
