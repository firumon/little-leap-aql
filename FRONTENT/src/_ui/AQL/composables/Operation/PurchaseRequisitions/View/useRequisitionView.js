import { computed, onMounted } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { useWarehouseResource } from 'src/_resource/Master/Warehouses/composables/useWarehouseResource'
import {
  progressLabel,
  progressColor,
  progressIcon,
  typeMeta,
  priorityMeta,
  needsTypeReference,
  isRevisionRequired,
  isRejected,
  stampOf,
  workflowStamps
} from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionProgress'
import { progressLabel as procurementLabel, progressColor as procurementColor, progressIcon as procurementIcon } from 'src/_resource/Operation/Procurements/composables/useProcurementProgress'
import { useRequisitionViewContext } from './useRequisitionViewContext'

const CHILD = 'PurchaseRequisitionItems'
const DEFAULT_UOM = 'PCS'

const text = (value) => String(value ?? '').trim()
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const isActive = (value) => text(asRow(value).Status || 'Active') === 'Active'

export { progressLabel, progressColor, progressIcon, typeMeta, priorityMeta, workflowStamps }

export function formatStampDate (value) {
  const raw = text(value)
  if (!raw) return ''
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return raw
  return parsed.toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

export function useRequisitionView () {
  const { resourceRecord } = useRequisitionViewContext()

  const requisitionItems = useRecord(CHILD)
  const procurements = useRecord('Procurements')
  const skus = useRecord('SKUs')
  const products = useRecord('Products')
  const warehouses = useRecord('Warehouses')

  const { skuLabelOf } = useSkuResource()
  const { getWarehouse } = useWarehouseResource()

  onMounted(() => {
    ;[requisitionItems, procurements, skus, products, warehouses].forEach((resource) => resource.reload())
  })

  const requisition = computed(() => resourceRecord?.record?.value || null)
  const loading = computed(() => resourceRecord?.loading?.value === true)
  const pending = computed(() => !requisition.value && loading.value)

  const warehouseName = computed(() => {
    const code = text(requisition.value?.WarehouseCode)
    if (!code) return ''
    return text(getWarehouse(code)?.name) || code
  })

  const items = computed(() => {
    const code = text(requisition.value?.Code)
    if (!code) return []
    return requisitionItems.items.value
      .map(asRow)
      .filter((row) => text(row.PurchaseRequisitionCode) === code && isActive(row) && text(row.Code))
  })

  // One projection every card reads, so no two cards can disagree on quantities.
  const lines = computed(() => items.value.map((row) => {
    const label = skuLabelOf(text(row.SKU))
    const quantity = num(row.Quantity)
    const rate = num(row.EstimatedRate)
    return {
      code: text(row.Code),
      sku: text(row.SKU),
      primary: label.primary,
      secondary: label.secondary,
      uom: text(row.UOM) || label.uom || DEFAULT_UOM,
      quantity,
      estimatedRate: rate,
      estimatedValue: quantity * rate
    }
  }))

  const totals = computed(() => lines.value.reduce((acc, line) => {
    acc.lines += 1
    acc.quantity += line.quantity
    acc.value += line.estimatedValue
    return acc
  }, { lines: 0, quantity: 0, value: 0 }))

  const procurement = computed(() => {
    const code = text(requisition.value?.ProcurementCode)
    if (!code) return null
    return procurements.items.value.map(asRow).find((row) => text(row.Code) === code) || null
  })

  const procurementStage = computed(() => {
    const row = procurement.value
    if (!row) return null
    return {
      code: text(row.Code),
      label: procurementLabel(row.Progress),
      color: procurementColor(row.Progress),
      icon: procurementIcon(row.Progress),
      initiatedDate: text(row.InitiatedDate)
    }
  })

  const revisionNote = computed(() => stampOf(requisition.value, 'ProgressRevisionRequired').comment)
  const rejectionNote = computed(() => stampOf(requisition.value, 'ProgressRejected').comment)
  const needsRevision = computed(() => isRevisionRequired(requisition.value))
  const rejected = computed(() => isRejected(requisition.value))
  const referenceRequired = computed(() => needsTypeReference(requisition.value?.Type))
  const events = computed(() => workflowStamps(requisition.value))

  return {
    requisition,
    loading,
    pending,
    warehouseName,
    lines,
    totals,
    procurement,
    procurementStage,
    revisionNote,
    rejectionNote,
    needsRevision,
    rejected,
    referenceRequired,
    events,
    progressLabel,
    progressColor,
    progressIcon,
    typeMeta,
    priorityMeta,
    formatStampDate
  }
}
