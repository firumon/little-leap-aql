import { computed, inject, onMounted } from 'vue'
import { useAuth } from 'src/composables/core/useAuth'
import { useRecord } from 'src/composables/resources/useRecord'
import { useCurrency } from 'src/composables/useCurrency'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { useWarehouseResource } from 'src/_resource/Master/Warehouses/composables/useWarehouseResource'
import { isPoEligible, allowsPartialPo } from 'src/_resource/Operation/SupplierQuotations/composables/useSupplierQuotationProgress'
import { EXTRA_CHARGE_KEYS, chargeLabel } from 'src/_resource/Operation/PurchaseOrders/composables/usePurchaseOrderProgress'
import {
  normalizeNumber,
  parseCharges,
  blankCharges,
  orderedQtyByQuotationItem,
  remainingQtyOf,
  itemSubtotal,
  extraChargesTotal,
  hasLivePurchaseOrder
} from 'src/_resource/Operation/PurchaseOrders/composables/usePurchaseOrderTotals'
import { shouldOfferRfqClose, todayDashed } from 'src/_resource/Operation/PurchaseOrders/composables/usePurchaseOrderPayload'

const NODE = 'PurchaseOrders'

const text = (value) => String(value ?? '').trim()
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const isActive = (value) => text(asRow(value).Status || 'Active') === 'Active'

// The Add wizard owns its own fetch and seeding: no record route loads a PO that does
// not exist yet.
export function usePurchaseOrderAddContext () {
  const pageState = inject('pageState', null)
  const resourceConfig = inject('resourceConfig', null)
  const ui = useAQLConfig()
  const { user } = useAuth()
  const { defaultCurrencyCode, _C } = useCurrency()

  const quotations = useRecord('SupplierQuotations')
  const quotationItems = useRecord('SupplierQuotationItems')
  const purchaseOrders = useRecord(NODE)
  const purchaseOrderItems = useRecord('PurchaseOrderItems')
  const requisitionItems = useRecord('PurchaseRequisitionItems')
  const rfqs = useRecord('RFQs')
  const suppliers = useRecord('Suppliers')
  const warehouses = useRecord('Warehouses')
  const procurements = useRecord('Procurements')
  const skus = useRecord('SKUs')
  const products = useRecord('Products')

  const { skuLabelOf } = useSkuResource()
  const { activeWarehouses } = useWarehouseResource()

  onMounted(() => {
    ;[quotations, quotationItems, purchaseOrders, purchaseOrderItems, requisitionItems, rfqs,
      suppliers, warehouses, procurements, skus, products].forEach((resource) => resource.reload())
    seed()
  })

  const control = (key) => pageState?.getControls(key, null, NODE)
  const setControl = (key, value) => pageState?.setControls(key, value, NODE)

  function seed () {
    if (control('Seeded') === true) return
    setControl('Form', {
      QuotationCode: '',
      PODate: todayDashed(),
      ShipToWarehouseCode: '',
      Remarks: '',
      ExtraChargesBreakup: blankCharges()
    })
    setControl('Lines', {})
    setControl('CloseRfq', false)
    setControl('Seeded', true)
  }

  const form = computed(() => {
    const value = control('Form')
    return value && typeof value === 'object'
      ? value
      : { QuotationCode: '', PODate: todayDashed(), ShipToWarehouseCode: '', Remarks: '', ExtraChargesBreakup: blankCharges() }
  })

  function setFormField (key, value) {
    setControl('Form', { ...form.value, [key]: value })
  }

  function setCharge (key, value) {
    setFormField('ExtraChargesBreakup', {
      ...(form.value.ExtraChargesBreakup || blankCharges()),
      [key]: normalizeNumber(value)
    })
  }

  const supplierIndex = computed(() => new Map(
    suppliers.items.value.map(asRow).map((row) => [text(row.Code), row])))

  // A quotation is offered while it can still take an order: partial POs may be topped
  // up, a full one is offered only until its single order exists.
  const eligibleQuotations = computed(() => quotations.items.value
    .map(asRow)
    .filter((row) => isPoEligible(row))
    .filter((row) => allowsPartialPo(row) || !hasLivePurchaseOrder(purchaseOrders.items.value, text(row.Code)))
    .map((row) => ({
      code: text(row.Code),
      label: `${text(supplierIndex.value.get(text(row.SupplierCode))?.Name) || text(row.SupplierCode)} · ${text(row.Code)}`,
      caption: [text(row.RFQCode), text(row.ResponseDate)].filter(Boolean).join(' • '),
      row
    })))

  const quotation = computed(() => {
    const code = text(form.value.QuotationCode)
    if (!code) return null
    return quotations.items.value.map(asRow).find((row) => text(row.Code) === code) || null
  })

  const rfq = computed(() => {
    const code = text(quotation.value?.RFQCode)
    if (!code) return null
    return rfqs.items.value.map(asRow).find((row) => text(row.Code) === code) || null
  })

  const procurement = computed(() => {
    const code = text(quotation.value?.ProcurementCode)
    if (!code) return null
    return procurements.items.value.map(asRow).find((row) => text(row.Code) === code) || null
  })

  const sourceItems = computed(() => {
    const code = text(quotation.value?.Code)
    if (!code) return []
    return quotationItems.items.value
      .map(asRow)
      .filter((row) => text(row.SupplierQuotationCode) === code && isActive(row) && text(row.Code))
  })

  const orderedIndex = computed(() => orderedQtyByQuotationItem(
    purchaseOrders.items.value, purchaseOrderItems.items.value, text(quotation.value?.Code)))

  const requisitionIndex = computed(() => new Map(
    requisitionItems.items.value.map(asRow).map((row) => [text(row.Code), row])))

  const partialAllowed = computed(() => allowsPartialPo(quotation.value))

  const lineState = computed(() => {
    const value = control('Lines')
    return value && typeof value === 'object' ? value : {}
  })

  const lines = computed(() => sourceItems.value.map((row) => {
    const key = text(row.Code)
    const saved = lineState.value[key] || {}
    const remaining = remainingQtyOf(row, orderedIndex.value)
    const label = skuLabelOf(text(row.SKU))
    const prItem = requisitionIndex.value.get(text(row.PurchaseRequisitionItemCode)) || {}
    const ordered = saved.OrderedQuantity == null ? remaining : normalizeNumber(saved.OrderedQuantity)
    const selected = saved.Selected == null ? (!partialAllowed.value || remaining > 0) : saved.Selected === true
    return {
      key,
      Selected: selected,
      SupplierQuotationItemCode: key,
      SKU: text(row.SKU),
      primary: label.primary,
      secondary: text(row.Description) || label.secondary,
      Description: text(row.Description) || label.primary,
      UOM: text(prItem.UOM) || label.uom,
      QuotedQuantity: normalizeNumber(row.Quantity),
      RemainingQuantity: remaining,
      OrderedQuantity: ordered,
      UnitPrice: normalizeNumber(row.UnitPrice),
      SupplierItemCode: text(row.SupplierItemCode),
      Remarks: text(row.Remarks),
      lineTotal: ordered * normalizeNumber(row.UnitPrice)
    }
  }))

  function setLineField (key, field, value) {
    const current = lineState.value[key] || {}
    const next = { ...lineState.value }
    next[key] = {
      ...current,
      [field]: field === 'OrderedQuantity' ? normalizeNumber(value) : value
    }
    setControl('Lines', next)
  }

  const selectedLines = computed(() => lines.value.filter((line) => line.Selected))

  const totals = computed(() => {
    const subtotal = itemSubtotal(selectedLines.value)
    const charges = extraChargesTotal(form.value.ExtraChargesBreakup)
    return { subtotal, charges, total: subtotal + charges }
  })

  const currency = computed(() => text(quotation.value?.Currency) || text(defaultCurrencyCode?.value) || 'AED')

  function money (amount) {
    const value = normalizeNumber(amount)
    try {
      return _C(value, true, currency.value, currency.value)
    } catch {
      return `${currency.value} ${value.toFixed(2)}`
    }
  }

  const warehouseOptions = computed(() => (activeWarehouses?.value || [])
    .map(asRow)
    .filter((row) => text(row.code))
    .map((row) => ({ value: text(row.code), label: text(row.name) || text(row.code) })))

  const closeRfqOffered = computed(() => shouldOfferRfqClose({
    quotationItems: sourceItems.value,
    selectedItems: selectedLines.value,
    purchaseOrders: purchaseOrders.items.value,
    purchaseOrderItems: purchaseOrderItems.items.value,
    quotationCode: text(quotation.value?.Code),
    rfq: rfq.value
  }))

  const closeRfq = computed(() => control('CloseRfq') === true)

  function setCloseRfq (value) {
    setControl('CloseRfq', value === true)
  }

  const currentStep = computed(() => pageState?.meta?.currentStep || 1)

  return {
    pageState,
    resourceConfig,
    ui,
    user,
    form,
    setFormField,
    setCharge,
    eligibleQuotations,
    quotation,
    rfq,
    procurement,
    sourceItems,
    lines,
    setLineField,
    selectedLines,
    partialAllowed,
    totals,
    currency,
    money,
    warehouseOptions,
    closeRfqOffered,
    closeRfq,
    setCloseRfq,
    chargeKeys: EXTRA_CHARGE_KEYS,
    chargeLabel,
    currentStep
  }
}
