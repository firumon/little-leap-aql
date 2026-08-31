import { computed, onMounted } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import {
  progressLabel,
  progressColor,
  progressIcon,
  supplierProgressLabel,
  supplierProgressColor,
  supplierProgressIcon,
  termLabel,
  parsePrItemCodeCsv,
  supplierRowsOf,
  allSuppliersDispatched,
  daysToDeadline,
  isDeadlinePassed,
  canAssignSuppliers,
  canMarkSuppliersSent,
  canClose,
  workflowStamps,
  SUPPLIER_ASSIGNED,
  SUPPLIER_RESPONDED
} from 'src/_resource/Operation/RFQs/composables/useRFQProgress'
import { progressLabel as procurementLabel, progressColor as procurementColor, progressIcon as procurementIcon } from 'src/_resource/Operation/Procurements/composables/useProcurementProgress'
import { useRFQViewContext } from './useRFQViewContext'

const text = (value) => String(value ?? '').trim()
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const asRow = (value) => (value && typeof value === 'object' ? value : {})

export { progressLabel, progressColor, progressIcon, supplierProgressLabel, supplierProgressColor, supplierProgressIcon, termLabel, workflowStamps }

export function formatStampDate (value) {
  const raw = text(value)
  if (!raw) return ''
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return raw
  return parsed.toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

export function useRFQView () {
  const { resourceRecord } = useRFQViewContext()

  const rfqSuppliers = useRecord('RFQSuppliers')
  const suppliers = useRecord('Suppliers')
  const requisitionItems = useRecord('PurchaseRequisitionItems')
  const quotations = useRecord('SupplierQuotations')
  const procurements = useRecord('Procurements')
  const skus = useRecord('SKUs')
  const products = useRecord('Products')

  const { skuLabelOf } = useSkuResource()

  onMounted(() => {
    ;[rfqSuppliers, suppliers, requisitionItems, quotations, procurements, skus, products]
      .forEach((resource) => resource.reload())
  })

  const rfq = computed(() => resourceRecord?.record?.value || null)
  const loading = computed(() => resourceRecord?.loading?.value === true)
  const pending = computed(() => !rfq.value && loading.value)

  const supplierIndex = computed(() => new Map(
    suppliers.items.value.map(asRow).map((row) => [text(row.Code), row])))

  const supplierRows = computed(() => supplierRowsOf(rfq.value, rfqSuppliers.items.value)
    .map((row) => {
      const master = supplierIndex.value.get(text(row.SupplierCode)) || {}
      return {
        code: text(row.Code),
        supplierCode: text(row.SupplierCode),
        name: text(master.Name) || text(row.SupplierCode),
        country: text(master.Country),
        contact: text(master.ContactPerson),
        sentDate: text(row.SentDate),
        progress: text(row.Progress).toUpperCase()
      }
    }))

  const supplierCounts = computed(() => supplierRows.value.reduce((acc, row) => {
    acc.total += 1
    if (row.progress === SUPPLIER_ASSIGNED) acc.assigned += 1
    if (row.progress === SUPPLIER_RESPONDED) acc.responded += 1
    return acc
  }, { total: 0, assigned: 0, responded: 0 }))

  const lines = computed(() => {
    const codes = parsePrItemCodeCsv(rfq.value?.PurchaseRequisitionItemsCode)
    if (!codes.length) return []
    const wanted = new Set(codes)
    return requisitionItems.items.value
      .map(asRow)
      .filter((row) => wanted.has(text(row.Code)))
      .map((row) => {
        const label = skuLabelOf(text(row.SKU))
        return {
          code: text(row.Code),
          sku: text(row.SKU),
          primary: label.primary,
          secondary: label.secondary,
          uom: text(row.UOM) || label.uom,
          quantity: num(row.Quantity)
        }
      })
  })

  const totals = computed(() => lines.value.reduce((acc, line) => {
    acc.lines += 1
    acc.quantity += line.quantity
    return acc
  }, { lines: 0, quantity: 0 }))

  const terms = computed(() => {
    const record = rfq.value
    if (!record) return []
    return [
      { label: 'Lead Time', value: `${num(record.LeadTimeDays)} days · ${termLabel(record.LeadTimeType)}` },
      { label: 'Validity', value: `${num(record.QuotationValidityDays)} days · ${termLabel(record.QuotationValidityMode)}` },
      { label: 'Shipping', value: `${termLabel(record.ShippingTermMode)}${text(record.ShippingTerm) ? ` · ${termLabel(record.ShippingTerm)}` : ''}` },
      { label: 'Payment', value: `${termLabel(record.PaymentTermMode)}${text(record.PaymentTerm) ? ` · ${termLabel(record.PaymentTerm)}` : ''}` },
      { label: 'Payment Detail', value: text(record.PaymentTermDetail) },
      { label: 'Delivery', value: termLabel(record.DeliveryMode) },
      { label: 'Partial Delivery', value: text(record.AllowPartialDelivery) },
      { label: 'Split Shipment', value: text(record.AllowSplitShipment) }
    ].filter((line) => text(line.value))
  })

  const quotationRows = computed(() => {
    const code = text(rfq.value?.Code)
    if (!code) return []
    return quotations.items.value
      .map(asRow)
      .filter((row) => text(row.RFQCode) === code && text(row.Status || 'Active') === 'Active')
  })

  const procurement = computed(() => {
    const code = text(rfq.value?.ProcurementCode)
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
      icon: procurementIcon(row.Progress)
    }
  })

  const deadlineDays = computed(() => daysToDeadline(rfq.value))
  const deadlinePassed = computed(() => isDeadlinePassed(rfq.value))
  const dispatched = computed(() => allSuppliersDispatched(rfq.value, rfqSuppliers.items.value))
  const canAssign = computed(() => canAssignSuppliers(rfq.value))
  const canDispatch = computed(() => canMarkSuppliersSent(rfq.value) && supplierCounts.value.assigned > 0)
  const closable = computed(() => canClose(rfq.value))
  const events = computed(() => workflowStamps(rfq.value))

  return {
    rfq,
    loading,
    pending,
    supplierRows,
    supplierCounts,
    lines,
    totals,
    terms,
    quotationRows,
    procurement,
    procurementStage,
    deadlineDays,
    deadlinePassed,
    dispatched,
    canAssign,
    canDispatch,
    closable,
    events,
    progressLabel,
    progressColor,
    progressIcon,
    supplierProgressLabel,
    supplierProgressColor,
    supplierProgressIcon,
    termLabel,
    formatStampDate
  }
}
