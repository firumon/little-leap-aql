import { computed, inject, onMounted } from 'vue'
import { useAuth } from 'src/composables/core/useAuth'
import { useRecord } from 'src/composables/resources/useRecord'
import { useRouteConfig } from 'src/composables/resources/useRouteConfig'
import { useCurrency } from 'src/composables/useCurrency'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { parsePrItemCodeCsv, isSent, supplierRowsOf, SUPPLIER_CANCELLED } from 'src/_resource/Operation/RFQs/composables/useRFQProgress'
import {
  RESPONSE_TYPES,
  DECLINED,
  responseLabel,
  chargeLabel,
  EXTRA_CHARGE_KEYS
} from 'src/_resource/Operation/SupplierQuotations/composables/useSupplierQuotationProgress'
import {
  normalizeNumber,
  parseCharges,
  blankCharges,
  itemSubtotal,
  extraChargesTotal
} from 'src/_resource/Operation/SupplierQuotations/composables/useSupplierQuotationTotals'
import {
  resolveSourceUnitPrice,
  toDateInputValue,
  addDays,
  normalizeFlag
} from 'src/_resource/Operation/SupplierQuotations/composables/useSupplierQuotationPayload'

const NODE = 'SupplierQuotations'

const text = (value) => String(value ?? '').trim()
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const isActive = (value) => text(asRow(value).Status || 'Active') === 'Active'

// Shared by Add and Edit: both provide pageState and both resolve the same item and
// terms cards, so the relay sits at the resource tier.
export function useQuotationCaptureContext () {
  const pageState = inject('pageState', null)
  const resourceConfig = inject('resourceConfig', null)
  const ui = useAQLConfig()
  const { user } = useAuth()
  const { code: routeCode } = useRouteConfig()
  const { defaultCurrencyCode, _C } = useCurrency()

  const quotations = useRecord(NODE)
  const quotationItems = useRecord('SupplierQuotationItems')
  const rfqs = useRecord('RFQs')
  const rfqSuppliers = useRecord('RFQSuppliers')
  const suppliers = useRecord('Suppliers')
  const requisitionItems = useRecord('PurchaseRequisitionItems')
  const procurements = useRecord('Procurements')
  const skus = useRecord('SKUs')
  const products = useRecord('Products')

  const { skuLabelOf } = useSkuResource()

  onMounted(() => {
    ;[quotations, quotationItems, rfqs, rfqSuppliers, suppliers, requisitionItems, procurements, skus, products]
      .forEach((resource) => resource.reload())
    hydrate()
  })

  const control = (key) => pageState?.getControls(key, null, NODE)
  const setControl = (key, value) => pageState?.setControls(key, value, NODE)

  const existing = computed(() => {
    const code = text(routeCode?.value)
    if (!code) return null
    return quotations.items.value.map(asRow).find((row) => text(row.Code) === code) || null
  })

  function defaultForm (seed = {}) {
    const responseDate = text(seed.ResponseDate) || toDateInputValue()
    const validityDays = normalizeNumber(seed.QuotationValidityDays || 7)
    return {
      ProcurementCode: text(seed.ProcurementCode),
      RFQCode: text(seed.RFQCode),
      SupplierCode: text(seed.SupplierCode),
      ResponseType: text(seed.ResponseType) || 'QUOTED',
      ResponseDate: responseDate,
      DeclineReason: text(seed.DeclineReason),
      SupplierQuotationReference: text(seed.SupplierQuotationReference),
      LeadTimeDays: normalizeNumber(seed.LeadTimeDays),
      LeadTimeType: text(seed.LeadTimeType) || 'FLEXIBLE',
      DeliveryMode: text(seed.DeliveryMode) || 'ANY',
      AllowPartialPO: seed.AllowPartialPO == null || seed.AllowPartialPO === '' ? true : normalizeFlag(seed.AllowPartialPO),
      AllowPartialDelivery: normalizeFlag(seed.AllowPartialDelivery),
      AllowSplitShipment: normalizeFlag(seed.AllowSplitShipment),
      ShippingTerm: text(seed.ShippingTerm),
      PaymentTerm: text(seed.PaymentTerm),
      PaymentTermDetail: text(seed.PaymentTermDetail),
      QuotationValidityDays: validityDays,
      ValidUntilDate: text(seed.ValidUntilDate) || addDays(responseDate, validityDays),
      Currency: text(seed.Currency) || text(defaultCurrencyCode?.value) || 'AED',
      Remarks: text(seed.Remarks),
      ExtraChargesBreakup: parseCharges(seed.ExtraChargesBreakup) || blankCharges()
    }
  }

  // Keyed on the record so a stale answer never reaches a different quotation.
  function hydrate () {
    const key = text(existing.value?.Code) || 'new'
    if (text(control('HydratedFor')) === key) return

    const seed = existing.value || {}
    setControl('Form', defaultForm(seed))
    setControl('HydratedFor', key)

    if (text(seed.Code)) {
      const saved = quotationItems.items.value
        .map(asRow)
        .filter((row) => text(row.SupplierQuotationCode) === text(seed.Code) && isActive(row))
      setControl('Lines', saved.map((row) => ({
        Code: text(row.Code),
        PurchaseRequisitionItemCode: text(row.PurchaseRequisitionItemCode),
        SKU: text(row.SKU),
        Description: text(row.Description),
        Quantity: normalizeNumber(row.Quantity),
        UnitPrice: normalizeNumber(row.UnitPrice),
        LeadTimeDays: row.LeadTimeDays === '' || row.LeadTimeDays == null ? '' : normalizeNumber(row.LeadTimeDays),
        DeliveryDate: text(row.DeliveryDate),
        Remarks: text(row.Remarks)
      })))
    } else {
      setControl('Lines', [])
    }
  }

  const form = computed(() => {
    const value = control('Form')
    return value && typeof value === 'object' ? value : defaultForm()
  })

  function setFormField (key, value) {
    setControl('Form', { ...form.value, [key]: value })
  }

  function setCharge (key, value) {
    const charges = { ...(form.value.ExtraChargesBreakup || blankCharges()), [key]: normalizeNumber(value) }
    setFormField('ExtraChargesBreakup', charges)
  }

  const sentRfqs = computed(() => rfqs.items.value
    .map(asRow)
    .filter((row) => isSent(row) && isActive(row))
    .map((row) => ({ code: text(row.Code), label: text(row.Code), caption: text(row.SubmissionDeadline), row })))

  const selectedRfq = computed(() => {
    const code = text(form.value.RFQCode)
    if (!code) return null
    return rfqs.items.value.map(asRow).find((row) => text(row.Code) === code) || null
  })

  const assignedSuppliers = computed(() => {
    const rows = supplierRowsOf(selectedRfq.value, rfqSuppliers.items.value)
      .filter((row) => text(row.Progress).toUpperCase() !== SUPPLIER_CANCELLED)
    const index = new Map(suppliers.items.value.map(asRow).map((row) => [text(row.Code), row]))
    return rows.map((row) => {
      const master = index.get(text(row.SupplierCode)) || {}
      return {
        rowCode: text(row.Code),
        code: text(row.SupplierCode),
        name: text(master.Name) || text(row.SupplierCode),
        country: text(master.Country),
        progress: text(row.Progress).toUpperCase()
      }
    })
  })

  const supplierRow = computed(() => {
    const code = text(form.value.SupplierCode)
    if (!code) return null
    return supplierRowsOf(selectedRfq.value, rfqSuppliers.items.value)
      .find((row) => text(row.SupplierCode) === code) || null
  })

  const procurement = computed(() => {
    const code = text(selectedRfq.value?.ProcurementCode) || text(form.value.ProcurementCode)
    if (!code) return null
    return procurements.items.value.map(asRow).find((row) => text(row.Code) === code) || null
  })

  // The requisition lines this RFQ asked about, which is what the supplier quotes against.
  const itemContext = computed(() => {
    const codes = parsePrItemCodeCsv(selectedRfq.value?.PurchaseRequisitionItemsCode)
    if (!codes.length) return []
    const wanted = new Set(codes)
    return requisitionItems.items.value
      .map(asRow)
      .filter((row) => wanted.has(text(row.Code)))
  })

  const savedLines = computed(() => {
    const value = control('Lines')
    return Array.isArray(value) ? value : []
  })

  const lines = computed(() => {
    const byContext = new Map(savedLines.value.map((row) => [text(row.PurchaseRequisitionItemCode), row]))
    return itemContext.value.map((context) => {
      const saved = byContext.get(text(context.Code)) || {}
      const label = skuLabelOf(text(context.SKU))
      const quantity = saved.Quantity == null ? normalizeNumber(context.Quantity) : normalizeNumber(saved.Quantity)
      const unitPrice = saved.UnitPrice == null ? resolveSourceUnitPrice(context) : normalizeNumber(saved.UnitPrice)
      return {
        key: text(context.Code),
        Code: text(saved.Code),
        PurchaseRequisitionItemCode: text(context.Code),
        SKU: text(context.SKU),
        Description: text(saved.Description) || label.primary,
        primary: label.primary,
        secondary: label.secondary,
        uom: text(context.UOM) || label.uom,
        requestedQuantity: normalizeNumber(context.Quantity),
        Quantity: quantity,
        UnitPrice: unitPrice,
        TotalPrice: quantity * unitPrice,
        LeadTimeDays: saved.LeadTimeDays == null ? '' : saved.LeadTimeDays,
        DeliveryDate: text(saved.DeliveryDate),
        Remarks: text(saved.Remarks)
      }
    })
  })

  function setLineField (key, field, value) {
    const next = lines.value.map((line) => {
      if (line.key !== key) {
        return {
          Code: line.Code,
          PurchaseRequisitionItemCode: line.PurchaseRequisitionItemCode,
          SKU: line.SKU,
          Description: line.Description,
          Quantity: line.Quantity,
          UnitPrice: line.UnitPrice,
          LeadTimeDays: line.LeadTimeDays,
          DeliveryDate: line.DeliveryDate,
          Remarks: line.Remarks
        }
      }
      const updated = {
        Code: line.Code,
        PurchaseRequisitionItemCode: line.PurchaseRequisitionItemCode,
        SKU: line.SKU,
        Description: line.Description,
        Quantity: line.Quantity,
        UnitPrice: line.UnitPrice,
        LeadTimeDays: line.LeadTimeDays,
        DeliveryDate: line.DeliveryDate,
        Remarks: line.Remarks
      }
      updated[field] = field === 'Quantity' || field === 'UnitPrice' ? normalizeNumber(value) : value
      return updated
    })
    setControl('Lines', next)
  }

  const declined = computed(() => text(form.value.ResponseType).toUpperCase() === DECLINED)

  const totals = computed(() => {
    if (declined.value) return { subtotal: 0, charges: 0, total: 0 }
    const subtotal = itemSubtotal(lines.value)
    const charges = extraChargesTotal(form.value.ExtraChargesBreakup)
    return { subtotal, charges, total: subtotal + charges }
  })

  function money (amount) {
    const value = normalizeNumber(amount)
    const currency = text(form.value.Currency)
    try {
      return currency ? _C(value, true, currency, currency) : _C(value, true)
    } catch {
      return `${currency} ${value.toFixed(2)}`.trim()
    }
  }

  const responseOptions = computed(() => RESPONSE_TYPES.map((value) => ({ value, label: responseLabel(value) })))
  const chargeKeys = EXTRA_CHARGE_KEYS
  const currentStep = computed(() => pageState?.meta?.currentStep || 1)

  return {
    pageState,
    resourceConfig,
    ui,
    user,
    existing,
    form,
    setFormField,
    setCharge,
    sentRfqs,
    selectedRfq,
    assignedSuppliers,
    supplierRow,
    procurement,
    itemContext,
    lines,
    setLineField,
    declined,
    totals,
    money,
    responseOptions,
    chargeKeys,
    chargeLabel,
    currentStep
  }
}
