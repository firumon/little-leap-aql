import { computed, inject, onMounted } from 'vue'
import { useAuth } from 'src/composables/core/useAuth'
import { useRecord } from 'src/composables/resources/useRecord'
import { useRouteConfig } from 'src/composables/resources/useRouteConfig'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { canReceive } from 'src/_resource/Operation/PurchaseOrders/composables/usePurchaseOrderProgress'
import { isEditable, progressLabel, progressColor } from 'src/_resource/Operation/POReceivings/composables/usePOReceivingProgress'
import {
  normalizeNumber,
  mergeInspectionLines,
  summarizeItems
} from 'src/_resource/Operation/POReceivings/composables/usePOReceivingInspection'
import { todayDashed } from 'src/_resource/Operation/POReceivings/composables/usePOReceivingPayload'

const NODE = 'POReceivings'

const text = (value) => String(value ?? '').trim()
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const isActive = (value) => text(asRow(value).Status || 'Active') === 'Active'

// Shared by Add and Edit: both provide pageState and both resolve the inspection grid.
export function useReceivingFormContext () {
  const pageState = inject('pageState', null)
  const resourceConfig = inject('resourceConfig', null)
  const ui = useAQLConfig()
  const { user } = useAuth()
  const { code: routeCode } = useRouteConfig()

  const receivings = useRecord(NODE)
  const receivingItems = useRecord('POReceivingItems')
  const purchaseOrders = useRecord('PurchaseOrders')
  const purchaseOrderItems = useRecord('PurchaseOrderItems')
  const procurements = useRecord('Procurements')
  const skus = useRecord('SKUs')
  const products = useRecord('Products')

  const { skuLabelOf } = useSkuResource()

  onMounted(() => {
    ;[receivings, receivingItems, purchaseOrders, purchaseOrderItems, procurements, skus, products]
      .forEach((resource) => resource.reload())
    hydrate()
  })

  const control = (key) => pageState?.getControls(key, null, NODE)
  const setControl = (key, value) => pageState?.setControls(key, value, NODE)

  const receiving = computed(() => {
    const code = text(routeCode?.value)
    if (!code) return null
    return receivings.items.value.map(asRow).find((row) => text(row.Code) === code) || null
  })

  // Keyed on the record so a resumed draft never seeds another receiving's counts.
  function hydrate () {
    const key = text(receiving.value?.Code) || 'new'
    if (text(control('HydratedFor')) === key) return

    const record = receiving.value || {}
    setControl('Form', {
      Code: text(record.Code),
      ProcurementCode: text(record.ProcurementCode),
      PurchaseOrderCode: text(record.PurchaseOrderCode),
      InspectionDate: text(record.InspectionDate) || todayDashed(),
      InspectedUserName: text(record.InspectedUserName) || text(user.value?.name) || text(user.value?.email),
      Remarks: text(record.Remarks),
      Status: text(record.Status) || 'Active'
    })
    setControl('Counts', {})
    setControl('HydratedFor', key)
  }

  const form = computed(() => {
    const value = control('Form')
    return value && typeof value === 'object' ? value : {}
  })

  function setFormField (key, value) {
    setControl('Form', { ...form.value, [key]: value })
  }

  const eligibleOrders = computed(() => purchaseOrders.items.value
    .map(asRow)
    .filter(canReceive)
    .map((row) => ({
      code: text(row.Code),
      label: text(row.Code),
      caption: [text(row.SupplierCode), text(row.PODate)].filter(Boolean).join(' • '),
      row
    })))

  const purchaseOrder = computed(() => {
    const code = text(form.value.PurchaseOrderCode)
    if (!code) return null
    return purchaseOrders.items.value.map(asRow).find((row) => text(row.Code) === code) || null
  })

  const procurement = computed(() => {
    const code = text(purchaseOrder.value?.ProcurementCode) || text(form.value.ProcurementCode)
    if (!code) return null
    return procurements.items.value.map(asRow).find((row) => text(row.Code) === code) || null
  })

  const orderLines = computed(() => {
    const code = text(purchaseOrder.value?.Code)
    if (!code) return []
    return purchaseOrderItems.items.value
      .map(asRow)
      .filter((row) => text(row.PurchaseOrderCode) === code && isActive(row) && text(row.Code))
  })

  const savedItems = computed(() => {
    const code = text(receiving.value?.Code)
    if (!code) return new Map()
    const rows = receivingItems.items.value
      .map(asRow)
      .filter((row) => text(row.POReceivingCode) === code && isActive(row))
    return new Map(rows.map((row) => [text(row.PurchaseOrderItemCode), row]))
  })

  const counts = computed(() => {
    const value = control('Counts')
    return value && typeof value === 'object' ? value : {}
  })

  // The same Layer 2 merge the sticky bar submits, decorated with display labels only.
  const lines = computed(() => mergeInspectionLines({
    orderLines: orderLines.value,
    savedByOrderItem: savedItems.value,
    counts: counts.value
  }).map((line) => {
    const label = skuLabelOf(text(line.SKU))
    line.primary = label.primary
    line.secondary = label.secondary
    line.uom = text(line.UOM) || label.uom
    return line
  }))

  function setLineField (key, field, value) {
    const current = counts.value[key] || {}
    setControl('Counts', {
      ...counts.value,
      [key]: {
        ...current,
        [field]: ['ReceivedQty', 'DamagedQty', 'RejectedQty'].includes(field) ? normalizeNumber(value) : value
      }
    })
  }

  function receiveAllExpected () {
    const next = { ...counts.value }
    for (const line of lines.value) {
      next[line.key] = { ...(next[line.key] || {}), ReceivedQty: line.ExpectedQty }
    }
    setControl('Counts', next)
  }

  const summary = computed(() => summarizeItems(lines.value))
  const editable = computed(() => !receiving.value || isEditable(receiving.value))
  const currentStep = computed(() => pageState?.meta?.currentStep || 1)

  return {
    pageState,
    resourceConfig,
    ui,
    user,
    receiving,
    form,
    setFormField,
    eligibleOrders,
    purchaseOrder,
    procurement,
    lines,
    setLineField,
    receiveAllExpected,
    summary,
    editable,
    currentStep,
    progressLabel,
    progressColor
  }
}
