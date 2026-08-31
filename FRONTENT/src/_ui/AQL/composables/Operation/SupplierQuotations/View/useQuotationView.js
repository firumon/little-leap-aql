import { computed, onMounted } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useCurrency } from 'src/composables/useCurrency'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import {
  progressLabel,
  progressColor,
  progressIcon,
  responseLabel,
  responseColor,
  responseIcon,
  chargeLabel,
  isDeclined,
  isAccepted,
  isRejected,
  isExpired,
  daysToExpiry,
  allowsPartialPo,
  canReject,
  workflowStamps
} from 'src/_resource/Operation/SupplierQuotations/composables/useSupplierQuotationProgress'
import { quotationTotals } from 'src/_resource/Operation/SupplierQuotations/composables/useSupplierQuotationTotals'
import { useQuotationViewContext } from './useQuotationViewContext'

const CHILD = 'SupplierQuotationItems'

const text = (value) => String(value ?? '').trim()
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const isActive = (value) => text(asRow(value).Status || 'Active') === 'Active'

export { progressLabel, progressColor, progressIcon, responseLabel, responseColor, responseIcon, chargeLabel, workflowStamps }

export function formatStampDate (value) {
  const raw = text(value)
  if (!raw) return ''
  const parsed = new Date(Number(raw) || raw)
  if (Number.isNaN(parsed.getTime())) return raw
  return parsed.toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

export function useQuotationView () {
  const { resourceRecord } = useQuotationViewContext()

  const quotationItems = useRecord(CHILD)
  const suppliers = useRecord('Suppliers')
  const rfqs = useRecord('RFQs')
  const purchaseOrders = useRecord('PurchaseOrders')
  const skus = useRecord('SKUs')
  const products = useRecord('Products')

  const { skuLabelOf } = useSkuResource()
  const { _C } = useCurrency()

  onMounted(() => {
    ;[quotationItems, suppliers, rfqs, purchaseOrders, skus, products].forEach((resource) => resource.reload())
  })

  const quotation = computed(() => resourceRecord?.record?.value || null)
  const loading = computed(() => resourceRecord?.loading?.value === true)
  const pending = computed(() => !quotation.value && loading.value)

  const currency = computed(() => text(quotation.value?.Currency))

  function money (amount) {
    const value = num(amount)
    try {
      return currency.value ? _C(value, true, currency.value, currency.value) : _C(value, true)
    } catch {
      return `${currency.value || ''} ${value.toFixed(2)}`.trim()
    }
  }

  const supplierName = computed(() => {
    const code = text(quotation.value?.SupplierCode)
    if (!code) return ''
    const master = suppliers.items.value.map(asRow).find((row) => text(row.Code) === code)
    return text(master?.Name) || code
  })

  const items = computed(() => {
    const code = text(quotation.value?.Code)
    if (!code) return []
    return quotationItems.items.value
      .map(asRow)
      .filter((row) => text(row.SupplierQuotationCode) === code && isActive(row) && text(row.Code))
  })

  const lines = computed(() => items.value.map((row) => {
    const label = skuLabelOf(text(row.SKU))
    return {
      code: text(row.Code),
      sku: text(row.SKU),
      primary: label.primary,
      secondary: text(row.Description) || label.secondary,
      quantity: num(row.Quantity),
      unitPrice: num(row.UnitPrice),
      totalPrice: num(row.TotalPrice) || num(row.Quantity) * num(row.UnitPrice),
      leadTimeDays: row.LeadTimeDays === '' || row.LeadTimeDays == null ? null : num(row.LeadTimeDays),
      deliveryDate: text(row.DeliveryDate),
      remarks: text(row.Remarks)
    }
  }))

  const totals = computed(() => quotationTotals(quotation.value || {}, items.value))

  const purchaseOrderRows = computed(() => {
    const code = text(quotation.value?.Code)
    if (!code) return []
    return purchaseOrders.items.value
      .map(asRow)
      .filter((row) => text(row.SupplierQuotationCode) === code && isActive(row))
  })

  const declined = computed(() => isDeclined(quotation.value))
  const accepted = computed(() => isAccepted(quotation.value))
  const rejected = computed(() => isRejected(quotation.value))
  const expired = computed(() => isExpired(quotation.value))
  const expiryDays = computed(() => daysToExpiry(quotation.value))
  const partialAllowed = computed(() => allowsPartialPo(quotation.value))
  const rejectable = computed(() => canReject(quotation.value))
  const events = computed(() => workflowStamps(quotation.value))

  return {
    quotation,
    loading,
    pending,
    currency,
    money,
    supplierName,
    lines,
    totals,
    purchaseOrderRows,
    declined,
    accepted,
    rejected,
    expired,
    expiryDays,
    partialAllowed,
    rejectable,
    events,
    progressLabel,
    progressColor,
    progressIcon,
    responseLabel,
    responseColor,
    responseIcon,
    chargeLabel,
    formatStampDate
  }
}
