import { ref, computed } from 'vue'
import { useResourceData } from '../../resources/useResourceData.js'
import { useResourceConfig } from '../../resources/useResourceConfig.js'
import { useResourceNav } from '../../resources/useResourceNav.js'
import { useWorkflowStore } from '../../../stores/workflow.js'
import { PO_RECEIVING_PROGRESS_ORDER, progressMeta, formatDate } from './poReceivingMeta.js'

function text(value) { return value == null ? '' : String(value) }
function sortTime(row = {}) {
  const value = row.UpdatedAt || row.CreatedAt || row.InspectionDate || ''
  if (typeof value === 'number') return value
  const parsed = Date.parse(text(value))
  return Number.isNaN(parsed) ? 0 : parsed
}

export function usePOReceivingIndex() {
  const { permissions } = useResourceConfig()
  const receivings = useResourceData(ref('POReceivings'))
  const purchaseOrders = useResourceData(ref('PurchaseOrders'))
  const workflowStore = useWorkflowStore()
  const nav = useResourceNav()
  const loading = ref(false)
  const searchTerm = ref('')
  const expandedGroups = ref({ DRAFT: true, CONFIRMED: true })

  const items = computed(() => {
    const term = searchTerm.value.trim().toLowerCase()
    return receivings.items.value
      .filter(row => text(row.Status || 'Active') === 'Active')
      .filter(row => !term || [row.Code, row.PurchaseOrderCode, row.InspectedUserName, row.Progress].some(v => text(v).toLowerCase().includes(term)))
  })

  const groups = computed(() => {
    const map = Object.fromEntries(PO_RECEIVING_PROGRESS_ORDER.map(key => [key, []]))
    items.value.forEach(row => {
      const key = PO_RECEIVING_PROGRESS_ORDER.includes(row.Progress) ? row.Progress : 'OTHER'
      map[key].push(row)
    })
    return PO_RECEIVING_PROGRESS_ORDER.map(key => ({ key, meta: progressMeta(key), items: map[key].sort((a, b) => sortTime(b) - sortTime(a)) })).filter(group => group.items.length)
  })

  async function reload(forceSync = false) {
    loading.value = true
    try {
      await workflowStore.fetchResources(['POReceivings', 'PurchaseOrders'], { includeInactive: true, forceSync })
    } finally {
      loading.value = false
    }
  }

  function purchaseOrderLabel(code) {
    const po = purchaseOrders.items.value.find(row => row.Code === code)
    return po ? `${po.Code} / ${po.SupplierCode || ''}` : code
  }

  function isGroupExpanded(key) { return !!expandedGroups.value[key] }
  function toggleGroup(key) { expandedGroups.value[key] = !expandedGroups.value[key] }
  function navigateTo(code) { if (code) nav.goTo('view', { code }) }
  function navigateToAdd() { nav.goTo('add') }

  return { permissions, items, groups, loading, searchTerm, reload, isGroupExpanded, toggleGroup, navigateTo, navigateToAdd, purchaseOrderLabel, formatDate }
}
