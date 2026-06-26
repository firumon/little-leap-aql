import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useResourceConfig } from '../../resources/useResourceConfig.js'
import { useRecord } from '../../resources/useRecord.js'
import { useResourceIoStore } from 'src/stores/resourceIo'
import { useResourceNav } from '../../resources/useResourceNav.js'
import { formatDate } from '../poReceivings/poReceivingMeta.js'
import { buildInvalidateGrnRequests, failureMessage, refreshRequest, responseFailed } from '../poReceivings/poReceivingBatch.js'

function text(value) { return value == null ? '' : String(value).trim() }

export function useGoodsReceiptView() {
  const $q = useQuasar()
  const { code } = useResourceConfig()
  const nav = useResourceNav()
  const resourceIoStore = useResourceIoStore()
  const receipts = useRecord(ref('GoodsReceipts'))
  const receiptItems = useRecord(ref('GoodsReceiptItems'))
  const receivings = useRecord(ref('POReceivings'))
  const procurements = useRecord(ref('Procurements'))
  const loading = ref(false)
  const acting = ref(false)

  const record = computed(() => receipts.items.value.find(row => row.Code === code.value) || null)
  const items = computed(() => receiptItems.items.value.filter(row => row.GoodsReceiptCode === code.value && text(row.Status || 'Active') === 'Active'))
  const receiving = computed(() => receivings.items.value.find(row => row.Code === record.value?.POReceivingCode) || null)
  const procurement = computed(() => procurements.items.value.find(row => row.Code === record.value?.ProcurementCode) || null)
  const isCompletedProcurement = computed(() => text(procurement.value?.Progress) === 'COMPLETED')
  const totalQty = computed(() => items.value.reduce((sum, item) => sum + Number(item.Qty || 0), 0))
  const canInvalidate = computed(() => record.value?.Status === 'Active' && !isCompletedProcurement.value)

  async function loadData(forceSync = false) {
    loading.value = true
    try {
      await resourceIoStore.fetchResources(['GoodsReceipts', 'GoodsReceiptItems', 'POReceivings', 'Procurements'], { forceSync })
    } finally {
      loading.value = false
    }
  }

  async function invalidateGoodsReceipt() {
    if (!canInvalidate.value) return
    acting.value = true
    try {
      const result = await resourceIoStore.runBatchRequests([
        ...buildInvalidateGrnRequests(record.value, receiptItems.items.value, receiving.value, procurement.value),
        refreshRequest(['GoodsReceipts', 'GoodsReceiptItems', 'POReceivings', 'Procurements'])
      ])
      if (responseFailed(result)) return $q.notify({ type: 'negative', message: failureMessage(result, 'Failed to invalidate GRN.'), position: 'top' })
      await loadData(true)
    } finally {
      acting.value = false
    }
  }

  function goToList() { nav.goTo('index') }
  function goToReceiving() { if (receiving.value?.Code) nav.goTo('view', { scope: 'operations', resourceSlug: 'po-receivings', code: receiving.value.Code }) }

  return { loading, acting, record, items, receiving, procurement, isCompletedProcurement, totalQty, canInvalidate, loadData, invalidateGoodsReceipt, goToList, goToReceiving, formatDate }
}
