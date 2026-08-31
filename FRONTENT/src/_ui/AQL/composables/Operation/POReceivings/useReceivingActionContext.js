import { computed, inject, onMounted } from 'vue'
import { useAuth } from 'src/composables/core/useAuth'
import { useRecord } from 'src/composables/resources/useRecord'
import { useRouteConfig } from 'src/composables/resources/useRouteConfig'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import {
  canGenerateGrn,
  canCancel,
  progressLabel,
  progressColor
} from 'src/_resource/Operation/POReceivings/composables/usePOReceivingProgress'
import { acceptedItems, summarizeItems, acceptedQty } from 'src/_resource/Operation/POReceivings/composables/usePOReceivingInspection'

const NODE = 'POReceivings'

const text = (value) => String(value ?? '').trim()
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const isActive = (value) => text(asRow(value).Status || 'Active') === 'Active'

// Shared by GenerateGrn and CancelReceiving: both provide the same context and both
// need the receiving, its lines and the records the chain touches.
export function useReceivingActionContext () {
  const pageState = inject('pageState', null)
  const resourceConfig = inject('resourceConfig', null)
  const ui = useAQLConfig()
  const { user } = useAuth()
  const { code: routeCode } = useRouteConfig()

  const receivings = useRecord(NODE)
  const receivingItems = useRecord('POReceivingItems')
  const purchaseOrders = useRecord('PurchaseOrders')
  const goodsReceipts = useRecord('GoodsReceipts')
  const goodsReceiptItems = useRecord('GoodsReceiptItems')
  const procurements = useRecord('Procurements')
  const skus = useRecord('SKUs')
  const products = useRecord('Products')

  const { skuLabelOf } = useSkuResource()

  onMounted(() => {
    ;[receivings, receivingItems, purchaseOrders, goodsReceipts, goodsReceiptItems, procurements, skus, products]
      .forEach((resource) => resource.reload())
  })

  const receiving = computed(() => {
    const code = text(routeCode?.value)
    if (!code) return null
    return receivings.items.value.map(asRow).find((row) => text(row.Code) === code) || null
  })

  const loading = computed(() => receivings.loading?.value === true)
  const pending = computed(() => !receiving.value && loading.value)

  const items = computed(() => {
    const code = text(receiving.value?.Code)
    if (!code) return []
    return receivingItems.items.value
      .map(asRow)
      .filter((row) => text(row.POReceivingCode) === code && isActive(row) && text(row.Code))
  })

  const postingLines = computed(() => acceptedItems(items.value).map((row) => {
    const label = skuLabelOf(text(row.SKU))
    return {
      code: text(row.Code),
      primary: label.primary,
      secondary: label.secondary,
      accepted: acceptedQty(row)
    }
  }))

  const summary = computed(() => summarizeItems(items.value))

  const purchaseOrder = computed(() => {
    const code = text(receiving.value?.PurchaseOrderCode)
    if (!code) return null
    return purchaseOrders.items.value.map(asRow).find((row) => text(row.Code) === code) || null
  })

  const goodsReceipt = computed(() => {
    const code = text(receiving.value?.Code)
    if (!code) return null
    return goodsReceipts.items.value
      .map(asRow)
      .find((row) => text(row.POReceivingCode) === code && isActive(row)) || null
  })

  const procurement = computed(() => {
    const code = text(receiving.value?.ProcurementCode)
    if (!code) return null
    return procurements.items.value.map(asRow).find((row) => text(row.Code) === code) || null
  })

  const grnReady = computed(() => canGenerateGrn(receiving.value))
  const cancellable = computed(() => canCancel(receiving.value))

  const comment = computed(() => text(pageState?.getControls('ActionComment', null, NODE)))

  function setComment (value) {
    pageState?.setControls('ActionComment', value, NODE)
  }

  return {
    pageState,
    resourceConfig,
    ui,
    user,
    receiving,
    items,
    postingLines,
    summary,
    purchaseOrder,
    goodsReceipt,
    goodsReceiptItems,
    procurement,
    loading,
    pending,
    grnReady,
    cancellable,
    comment,
    setComment,
    progressLabel,
    progressColor
  }
}
