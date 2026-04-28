import { ref, computed } from 'vue'
import { useResourceData } from '../../resources/useResourceData.js'
import { useWorkflowStore } from '../../../stores/workflow.js'
import { useResourceNav } from '../../resources/useResourceNav.js'
import { formatDate } from '../poReceivings/poReceivingMeta.js'

function text(value) { return value == null ? '' : String(value) }

export function useGoodsReceiptIndex() {
  const receipts = useResourceData(ref('GoodsReceipts'))
  const workflowStore = useWorkflowStore()
  const nav = useResourceNav()
  const loading = ref(false)
  const searchTerm = ref('')

  const items = computed(() => {
    const term = searchTerm.value.trim().toLowerCase()
    return receipts.items.value.filter(row => !term || [row.Code, row.PurchaseOrderCode, row.POReceivingCode, row.ProcurementCode, row.Status].some(v => text(v).toLowerCase().includes(term)))
  })
  const activeItems = computed(() => items.value.filter(row => (row.Status || 'Active') === 'Active'))
  const inactiveItems = computed(() => items.value.filter(row => row.Status === 'Inactive'))

  async function reload(forceSync = false) {
    loading.value = true
    try {
      await workflowStore.fetchResources(['GoodsReceipts', 'POReceivings', 'PurchaseOrders'], { includeInactive: true, forceSync })
    } finally {
      loading.value = false
    }
  }

  function navigateTo(code) { if (code) nav.goTo('view', { code }) }

  return { items, activeItems, inactiveItems, loading, searchTerm, reload, navigateTo, formatDate }
}
