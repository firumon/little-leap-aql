import { computed, inject, onMounted } from 'vue'
import { useAuth } from 'src/composables/core/useAuth'
import { useRecord } from 'src/composables/resources/useRecord'
import { useRouteConfig } from 'src/composables/resources/useRouteConfig'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import {
  canCancel,
  progressLabel,
  progressColor,
  consumesQuotationQuantity
} from 'src/_resource/Operation/PurchaseOrders/composables/usePurchaseOrderProgress'

const NODE = 'PurchaseOrders'

const text = (value) => String(value ?? '').trim()
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const isActive = (value) => text(asRow(value).Status || 'Active') === 'Active'

// The cancel route loads no record of its own, so this owns the fetch and the seeding.
export function useOrderCancelContext () {
  const pageState = inject('pageState', null)
  const resourceConfig = inject('resourceConfig', null)
  const ui = useAQLConfig()
  const { user } = useAuth()
  const { code: routeCode } = useRouteConfig()

  const purchaseOrders = useRecord(NODE)
  const orderItems = useRecord('PurchaseOrderItems')
  const receivings = useRecord('POReceivings')
  const rfqs = useRecord('RFQs')
  const rfqSuppliers = useRecord('RFQSuppliers')
  const suppliers = useRecord('Suppliers')
  const procurements = useRecord('Procurements')

  onMounted(() => {
    ;[purchaseOrders, orderItems, receivings, rfqs, rfqSuppliers, suppliers, procurements]
      .forEach((resource) => resource.reload())
  })

  const purchaseOrder = computed(() => {
    const code = text(routeCode?.value)
    if (!code) return null
    return purchaseOrders.items.value.map(asRow).find((row) => text(row.Code) === code) || null
  })

  const loading = computed(() => purchaseOrders.loading?.value === true)
  const pending = computed(() => !purchaseOrder.value && loading.value)

  const supplierName = computed(() => {
    const code = text(purchaseOrder.value?.SupplierCode)
    if (!code) return ''
    const master = suppliers.items.value.map(asRow).find((row) => text(row.Code) === code)
    return text(master?.Name) || code
  })

  const rfq = computed(() => {
    const quotationRfq = text(purchaseOrder.value?.RFQCode)
    if (quotationRfq) {
      return rfqs.items.value.map(asRow).find((row) => text(row.Code) === quotationRfq) || null
    }
    const procurementCode = text(purchaseOrder.value?.ProcurementCode)
    if (!procurementCode) return null
    return rfqs.items.value.map(asRow).find((row) => text(row.ProcurementCode) === procurementCode) || null
  })

  const procurement = computed(() => {
    const code = text(purchaseOrder.value?.ProcurementCode)
    if (!code) return null
    return procurements.items.value.map(asRow).find((row) => text(row.Code) === code) || null
  })

  // A receiving already started against this order is the reason a cancellation may
  // no longer be safe.
  const liveReceivings = computed(() => {
    const code = text(purchaseOrder.value?.Code)
    if (!code) return []
    return receivings.items.value
      .map(asRow)
      .filter((row) => text(row.PurchaseOrderCode) === code &&
        isActive(row) &&
        text(row.Progress).toUpperCase() !== 'CANCELLED')
  })

  const otherLiveOrders = computed(() => {
    const code = text(purchaseOrder.value?.Code)
    const procurementCode = text(purchaseOrder.value?.ProcurementCode)
    if (!procurementCode) return []
    return purchaseOrders.items.value
      .map(asRow)
      .filter((row) => text(row.Code) !== code &&
        text(row.ProcurementCode) === procurementCode &&
        consumesQuotationQuantity(row))
  })

  const cancellable = computed(() => canCancel(purchaseOrder.value) && !liveReceivings.value.length)

  const comment = computed(() => text(pageState?.getControls('CancelComment', null, NODE)))

  function setComment (value) {
    pageState?.setControls('CancelComment', value, NODE)
  }

  return {
    pageState,
    resourceConfig,
    ui,
    user,
    purchaseOrder,
    purchaseOrders,
    loading,
    pending,
    supplierName,
    rfq,
    rfqSuppliers,
    procurement,
    liveReceivings,
    otherLiveOrders,
    cancellable,
    comment,
    setComment,
    progressLabel,
    progressColor
  }
}
