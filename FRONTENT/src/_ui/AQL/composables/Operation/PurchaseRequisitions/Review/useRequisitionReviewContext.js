import { computed, inject, onMounted } from 'vue'
import { useAuth } from 'src/composables/core/useAuth'
import { useRecord } from 'src/composables/resources/useRecord'
import { useRouteConfig } from 'src/composables/resources/useRouteConfig'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { useWarehouseResource } from 'src/_resource/Master/Warehouses/composables/useWarehouseResource'
import {
  isPendingApproval,
  progressLabel,
  progressColor,
  typeMeta,
  priorityMeta
} from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionProgress'

const NODE = 'PurchaseRequisitions'
const CHILD = 'PurchaseRequisitionItems'

const text = (value) => String(value ?? '').trim()
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const isActive = (value) => text(asRow(value).Status || 'Active') === 'Active'

// An action route loads no record of its own, so this composable owns the fetch and
// the seeding. The first content the contract names is where it is first called.
export function useRequisitionReviewContext () {
  const pageState = inject('pageState', null)
  const resourceConfig = inject('resourceConfig', null)
  const ui = useAQLConfig()
  const { user } = useAuth()
  const { code: routeCode } = useRouteConfig()

  const requisitions = useRecord(NODE)
  const requisitionItems = useRecord(CHILD)
  const procurements = useRecord('Procurements')
  const skus = useRecord('SKUs')
  const products = useRecord('Products')
  const warehouses = useRecord('Warehouses')

  const { skuLabelOf } = useSkuResource()
  const { getWarehouse } = useWarehouseResource()

  onMounted(() => {
    ;[requisitions, requisitionItems, procurements, skus, products, warehouses]
      .forEach((resource) => resource.reload())
  })

  const requisition = computed(() => {
    const code = text(routeCode?.value)
    if (!code) return null
    return requisitions.items.value.map(asRow).find((row) => text(row.Code) === code) || null
  })

  const loading = computed(() => requisitions.loading?.value === true)
  const pending = computed(() => !requisition.value && loading.value)

  const reviewable = computed(() => isPendingApproval(requisition.value))

  const procurement = computed(() => {
    const code = text(requisition.value?.ProcurementCode)
    if (!code) return null
    return procurements.items.value.map(asRow).find((row) => text(row.Code) === code) || null
  })

  const lines = computed(() => {
    const code = text(requisition.value?.Code)
    if (!code) return []
    return requisitionItems.items.value
      .map(asRow)
      .filter((row) => text(row.PurchaseRequisitionCode) === code && isActive(row) && text(row.Code))
      .map((row) => {
        const label = skuLabelOf(text(row.SKU))
        const quantity = num(row.Quantity)
        const rate = num(row.EstimatedRate)
        return {
          code: text(row.Code),
          sku: text(row.SKU),
          primary: label.primary,
          secondary: label.secondary,
          uom: text(row.UOM) || label.uom,
          quantity,
          estimatedValue: quantity * rate
        }
      })
  })

  const totals = computed(() => lines.value.reduce((acc, line) => {
    acc.lines += 1
    acc.quantity += line.quantity
    acc.value += line.estimatedValue
    return acc
  }, { lines: 0, quantity: 0, value: 0 }))

  const warehouseName = computed(() => {
    const code = text(requisition.value?.WarehouseCode)
    if (!code) return ''
    return text(getWarehouse(code)?.name) || code
  })

  const comment = computed(() => text(pageState?.getControls('ReviewComment', null, NODE)))
  const verdict = computed(() => text(pageState?.getControls('ReviewVerdict', null, NODE)))

  function setComment (value) {
    pageState?.setControls('ReviewComment', value, NODE)
  }

  function setVerdict (value) {
    pageState?.setControls('ReviewVerdict', value, NODE)
  }

  return {
    pageState,
    resourceConfig,
    ui,
    user,
    requisition,
    procurement,
    loading,
    pending,
    reviewable,
    lines,
    totals,
    warehouseName,
    comment,
    verdict,
    setComment,
    setVerdict,
    progressLabel,
    progressColor,
    typeMeta,
    priorityMeta
  }
}
