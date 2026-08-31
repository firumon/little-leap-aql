import { computed, onMounted } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useCurrency } from 'src/composables/useCurrency'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { useWarehouseResource } from 'src/_resource/Master/Warehouses/composables/useWarehouseResource'
import {
  progressLabel,
  progressColor,
  progressIcon,
  lineProgressLabel,
  lineProgressColor,
  lineProgressIcon,
  chargeLabel,
  canReceive,
  canCancel,
  isCancelled,
  workflowStamps
} from 'src/_resource/Operation/PurchaseOrders/composables/usePurchaseOrderProgress'
import {
  purchaseOrderTotals,
  lineFulfilmentState,
  receivedQtyByPurchaseOrderItem,
  normalizeNumber
} from 'src/_resource/Operation/PurchaseOrders/composables/usePurchaseOrderTotals'
import { acceptedQty } from 'src/_resource/Operation/POReceivings/composables/usePOReceivingInspection'
import { usePurchaseOrderViewContext } from './usePurchaseOrderViewContext'

const CHILD = 'PurchaseOrderItems'

const text = (value) => String(value ?? '').trim()
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const isActive = (value) => text(asRow(value).Status || 'Active') === 'Active'

export { progressLabel, progressColor, progressIcon, lineProgressLabel, lineProgressColor, lineProgressIcon, chargeLabel, workflowStamps }

export function formatStampDate (value) {
  const raw = text(value)
  if (!raw) return ''
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return raw
  return parsed.toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

export function usePurchaseOrderView () {
  const { resourceRecord } = usePurchaseOrderViewContext()

  const orderItems = useRecord(CHILD)
  const receivings = useRecord('POReceivings')
  const receivingItems = useRecord('POReceivingItems')
  const suppliers = useRecord('Suppliers')
  const warehouses = useRecord('Warehouses')
  const skus = useRecord('SKUs')
  const products = useRecord('Products')

  const { skuLabelOf } = useSkuResource()
  const { getWarehouse } = useWarehouseResource()
  const { _C } = useCurrency()

  onMounted(() => {
    ;[orderItems, receivings, receivingItems, suppliers, warehouses, skus, products]
      .forEach((resource) => resource.reload())
  })

  const purchaseOrder = computed(() => resourceRecord?.record?.value || null)
  const loading = computed(() => resourceRecord?.loading?.value === true)
  const pending = computed(() => !purchaseOrder.value && loading.value)

  const currency = computed(() => text(purchaseOrder.value?.Currency))

  function money (amount) {
    const value = normalizeNumber(amount)
    try {
      return currency.value ? _C(value, true, currency.value, currency.value) : _C(value, true)
    } catch {
      return `${currency.value || ''} ${value.toFixed(2)}`.trim()
    }
  }

  const supplierName = computed(() => {
    const code = text(purchaseOrder.value?.SupplierCode)
    if (!code) return ''
    const master = suppliers.items.value.map(asRow).find((row) => text(row.Code) === code)
    return text(master?.Name) || code
  })

  const warehouseName = computed(() => {
    const code = text(purchaseOrder.value?.ShipToWarehouseCode)
    if (!code) return ''
    return text(getWarehouse(code)?.name) || code
  })

  const items = computed(() => {
    const code = text(purchaseOrder.value?.Code)
    if (!code) return []
    return orderItems.items.value
      .map(asRow)
      .filter((row) => text(row.PurchaseOrderCode) === code && isActive(row) && text(row.Code))
  })

  // Receiving rows that still stand — a cancelled inspection posted nothing.
  const liveReceivingItems = computed(() => {
    const code = text(purchaseOrder.value?.Code)
    if (!code) return []
    const liveCodes = new Set(receivings.items.value
      .map(asRow)
      .filter((row) => text(row.PurchaseOrderCode) === code &&
        isActive(row) &&
        text(row.Progress).toUpperCase() !== 'CANCELLED')
      .map((row) => text(row.Code)))
    return receivingItems.items.value
      .map(asRow)
      .filter((row) => liveCodes.has(text(row.POReceivingCode)) && isActive(row))
  })

  const receivedIndex = computed(() => receivedQtyByPurchaseOrderItem(liveReceivingItems.value, acceptedQty))

  const lines = computed(() => items.value.map((row) => {
    const label = skuLabelOf(text(row.SKU))
    const ordered = normalizeNumber(row.OrderedQuantity)
    const received = receivedIndex.value.get(text(row.Code)) || 0
    return {
      code: text(row.Code),
      sku: text(row.SKU),
      primary: label.primary,
      secondary: text(row.Description) || label.secondary,
      uom: text(row.UOM) || label.uom,
      quotedQuantity: normalizeNumber(row.QuotedQuantity),
      orderedQuantity: ordered,
      receivedQuantity: received,
      outstanding: Math.max(0, ordered - received),
      unitPrice: normalizeNumber(row.UnitPrice),
      lineTotal: ordered * normalizeNumber(row.UnitPrice),
      state: lineFulfilmentState(row, received),
      supplierItemCode: text(row.SupplierItemCode),
      remarks: text(row.Remarks)
    }
  }))

  const totals = computed(() => purchaseOrderTotals(purchaseOrder.value || {}, items.value))

  const fulfilment = computed(() => lines.value.reduce((acc, line) => {
    acc.ordered += line.orderedQuantity
    acc.received += line.receivedQuantity
    acc.outstanding += line.outstanding
    return acc
  }, { ordered: 0, received: 0, outstanding: 0 }))

  const receivingRows = computed(() => {
    const code = text(purchaseOrder.value?.Code)
    if (!code) return []
    return receivings.items.value
      .map(asRow)
      .filter((row) => text(row.PurchaseOrderCode) === code && isActive(row))
  })

  const receivable = computed(() => canReceive(purchaseOrder.value))
  const cancellable = computed(() => canCancel(purchaseOrder.value))
  const cancelled = computed(() => isCancelled(purchaseOrder.value))
  const events = computed(() => workflowStamps(purchaseOrder.value))

  return {
    purchaseOrder,
    loading,
    pending,
    currency,
    money,
    supplierName,
    warehouseName,
    lines,
    totals,
    fulfilment,
    receivingRows,
    receivable,
    cancellable,
    cancelled,
    events,
    progressLabel,
    progressColor,
    progressIcon,
    lineProgressLabel,
    lineProgressColor,
    lineProgressIcon,
    chargeLabel,
    formatStampDate
  }
}
