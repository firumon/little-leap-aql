import { ref, computed, watch } from 'vue'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useResourceData } from 'src/composables/resources/useResourceData'
import { useResourceNav } from 'src/composables/resources/useResourceNav'

const GROUP_DEFS = [
  {
    key: 'revision',
    label: 'Revision Required',
    match: (progress) => progress === 'Review' || progress === 'Revision Required' || progress === 'Revision',
    color: '#c2410c',
    icon: 'edit_note',
    actionIcon: 'rate_review',
    actionHint: 'Review',
    navigateTo: 'record-page',
    pageSlug: 'review-purchase-requisition'
  },
  {
    key: 'draft',
    label: 'Draft',
    match: (progress) => progress === 'Draft',
    color: '#6d28d9',
    icon: 'drafts',
    actionIcon: 'edit',
    actionHint: 'Edit',
    navigateTo: 'record-page',
    pageSlug: 'review-purchase-requisition'
  },
  {
    key: 'pending',
    label: 'Pending Approval',
    match: (progress) => progress === 'Pending Approval' || progress === 'Pending' || progress === 'New' || progress === 'Submitted',
    color: '#0f766e',
    icon: 'pending_actions',
    actionIcon: 'visibility',
    actionHint: 'View',
    navigateTo: 'view'
  },
  {
    key: 'others',
    label: 'Others',
    match: () => true,
    color: '#475569',
    icon: 'folder_open',
    actionIcon: 'open_in_new',
    actionHint: 'Open',
    navigateTo: 'view'
  }
]

export function usePurchaseRequisitionIndex() {
  const nav = useResourceNav()
  const { resourceName, permissions } = useResourceConfig()
  const { items, loading, reload } = useResourceData(resourceName)

  const searchTerm = ref('')
  const collapsedGroups = ref({})

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

  function toggleGroup(key) {
    collapsedGroups.value = {
      ...collapsedGroups.value,
      [key]: !collapsedGroups.value[key]
    }
  }

  function navigateTo(row) {
    const group = getGroup(row.Progress)
    if (group.navigateTo === 'record-page') {
      nav.goTo('record-page', { code: row.Code, pageSlug: group.pageSlug })
      return
    }

    nav.goTo('view', { code: row.Code })
  }

  function navigateToAdd() {
    nav.goTo('add')
  }

  watch(() => resourceName.value, async (name) => {
    if (name) await reload()
  }, { immediate: true })

  return {
    permissions,
    items,
    loading,
    reload,
    searchTerm,
    collapsedGroups,
    visibleGroups,
    totalVisible,
    priorityColor,
    formatDate,
    isOverdue,
    toggleGroup,
    navigateTo,
    navigateToAdd
  }
}

