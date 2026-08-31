import { computed, onMounted } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import {
  progressLabel,
  progressColor,
  progressIcon,
  lineProgressLabel,
  lineProgressColor,
  lineProgressIcon,
  canConfirm,
  canGenerateGrn,
  canCancel,
  isEditable,
  workflowStamps
} from 'src/_resource/Operation/POReceivings/composables/usePOReceivingProgress'
import {
  acceptedQty,
  shortQty,
  excessQty,
  lineOutcome,
  summarizeItems,
  normalizeNumber
} from 'src/_resource/Operation/POReceivings/composables/usePOReceivingInspection'
import { useReceivingViewContext } from './useReceivingViewContext'

const CHILD = 'POReceivingItems'

const text = (value) => String(value ?? '').trim()
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const isActive = (value) => text(asRow(value).Status || 'Active') === 'Active'

export { progressLabel, progressColor, progressIcon, lineProgressLabel, lineProgressColor, lineProgressIcon, workflowStamps }

export function formatStampDate (value) {
  const raw = text(value)
  if (!raw) return ''
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return raw
  return parsed.toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

export function useReceivingView () {
  const { resourceRecord } = useReceivingViewContext()

  const receivingItems = useRecord(CHILD)
  const purchaseOrders = useRecord('PurchaseOrders')
  const goodsReceipts = useRecord('GoodsReceipts')
  const procurements = useRecord('Procurements')
  const skus = useRecord('SKUs')
  const products = useRecord('Products')

  const { skuLabelOf } = useSkuResource()

  onMounted(() => {
    ;[receivingItems, purchaseOrders, goodsReceipts, procurements, skus, products]
      .forEach((resource) => resource.reload())
  })

  const receiving = computed(() => resourceRecord?.record?.value || null)
  const loading = computed(() => resourceRecord?.loading?.value === true)
  const pending = computed(() => !receiving.value && loading.value)

  const items = computed(() => {
    const code = text(receiving.value?.Code)
    if (!code) return []
    return receivingItems.items.value
      .map(asRow)
      .filter((row) => text(row.POReceivingCode) === code && isActive(row) && text(row.Code))
  })

  const lines = computed(() => items.value.map((row) => {
    const label = skuLabelOf(text(row.SKU))
    return {
      code: text(row.Code),
      sku: text(row.SKU),
      primary: label.primary,
      secondary: label.secondary,
      expected: normalizeNumber(row.ExpectedQty),
      received: normalizeNumber(row.ReceivedQty),
      damaged: normalizeNumber(row.DamagedQty),
      rejected: normalizeNumber(row.RejectedQty),
      accepted: acceptedQty(row),
      short: shortQty(row),
      excess: excessQty(row),
      outcome: lineOutcome(row),
      rejectedReason: text(row.RejectedReason),
      remarks: text(row.Remarks)
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

  const confirmable = computed(() => canConfirm(receiving.value))
  const grnReady = computed(() => canGenerateGrn(receiving.value))
  const cancellable = computed(() => canCancel(receiving.value))
  const editable = computed(() => isEditable(receiving.value))
  const events = computed(() => workflowStamps(receiving.value))

  return {
    receiving,
    loading,
    pending,
    lines,
    summary,
    purchaseOrder,
    goodsReceipt,
    procurement,
    confirmable,
    grnReady,
    cancellable,
    editable,
    events,
    progressLabel,
    progressColor,
    progressIcon,
    lineProgressLabel,
    lineProgressColor,
    lineProgressIcon,
    formatStampDate
  }
}
