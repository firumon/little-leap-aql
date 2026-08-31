import { computed, onMounted } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import {
  progressLabel,
  progressColor,
  progressIcon,
  isInvalidated,
  canInvalidate,
  workflowStamps
} from 'src/_resource/Operation/GoodsReceipts/composables/useGoodsReceiptProgress'
import { goodsReceiptItemsOf, goodsReceiptTotals } from 'src/_resource/Operation/GoodsReceipts/composables/useGoodsReceiptPayload'
import { useGoodsReceiptViewContext } from './useGoodsReceiptViewContext'

const text = (value) => String(value ?? '').trim()
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const asRow = (value) => (value && typeof value === 'object' ? value : {})

export { progressLabel, progressColor, progressIcon, workflowStamps }

export function formatStampDate (value) {
  const raw = text(value)
  if (!raw) return ''
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return raw
  return parsed.toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

export function useGoodsReceiptView () {
  const { resourceRecord } = useGoodsReceiptViewContext()

  const receiptItems = useRecord('GoodsReceiptItems')
  const receivings = useRecord('POReceivings')
  const purchaseOrders = useRecord('PurchaseOrders')
  const stockMovements = useRecord('StockMovements')
  const skus = useRecord('SKUs')
  const products = useRecord('Products')

  const { skuLabelOf } = useSkuResource()

  onMounted(() => {
    ;[receiptItems, receivings, purchaseOrders, stockMovements, skus, products]
      .forEach((resource) => resource.reload())
  })

  const goodsReceipt = computed(() => resourceRecord?.record?.value || null)
  const loading = computed(() => resourceRecord?.loading?.value === true)
  const pending = computed(() => !goodsReceipt.value && loading.value)

  const items = computed(() => goodsReceiptItemsOf(goodsReceipt.value, receiptItems.items.value))

  const lines = computed(() => items.value.map((row) => {
    const label = skuLabelOf(text(row.SKU))
    return {
      code: text(row.Code),
      sku: text(row.SKU),
      primary: label.primary,
      secondary: label.secondary,
      uom: label.uom,
      quantity: num(row.Qty)
    }
  }))

  const totals = computed(() => goodsReceiptTotals(goodsReceipt.value, receiptItems.items.value))

  const receiving = computed(() => {
    const code = text(goodsReceipt.value?.POReceivingCode)
    if (!code) return null
    return receivings.items.value.map(asRow).find((row) => text(row.Code) === code) || null
  })

  const purchaseOrder = computed(() => {
    const code = text(goodsReceipt.value?.PurchaseOrderCode)
    if (!code) return null
    return purchaseOrders.items.value.map(asRow).find((row) => text(row.Code) === code) || null
  })

  // Stock the GRN actually posted, so the reader can see it reached the ledger.
  const movements = computed(() => {
    const code = text(goodsReceipt.value?.Code)
    if (!code) return []
    return stockMovements.items.value
      .map(asRow)
      .filter((row) => text(row.ReferenceCode) === code && text(row.Status || 'Active') === 'Active')
  })

  const invalidated = computed(() => isInvalidated(goodsReceipt.value))
  const invalidatable = computed(() => canInvalidate(goodsReceipt.value))
  const events = computed(() => workflowStamps(goodsReceipt.value))

  return {
    goodsReceipt,
    loading,
    pending,
    lines,
    totals,
    receiving,
    purchaseOrder,
    movements,
    invalidated,
    invalidatable,
    events,
    progressLabel,
    progressColor,
    progressIcon,
    formatStampDate
  }
}
