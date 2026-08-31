import { computed, inject, onMounted } from 'vue'
import { useAuth } from 'src/composables/core/useAuth'
import { useRecord } from 'src/composables/resources/useRecord'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { isRfqEligible, typeMeta, priorityMeta } from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionProgress'
import { termOptions, termLabel } from 'src/_resource/Operation/RFQs/composables/useRFQProgress'
import { toDateInputValue, addDays } from 'src/_resource/Operation/RFQs/composables/useRFQPayload'

const NODE = 'RFQs'

const text = (value) => String(value ?? '').trim()
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const isActive = (value) => text(asRow(value).Status || 'Active') === 'Active'

const DEFAULT_FORM = {
  RFQDate: '',
  LeadTimeDays: 30,
  LeadTimeType: 'FLEXIBLE',
  ShippingTermMode: 'ANY',
  ShippingTerm: '',
  PaymentTermMode: 'ANY',
  PaymentTerm: '',
  PaymentTermDetail: '',
  QuotationValidityDays: 30,
  QuotationValidityMode: 'MIN_REQUIRED',
  DeliveryMode: 'ANY',
  AllowPartialDelivery: false,
  AllowSplitShipment: false,
  SubmissionDeadline: ''
}

// The Add wizard owns its own fetch and seeding: no record route loads an RFQ that
// does not exist yet.
export function useRFQAddContext () {
  const pageState = inject('pageState', null)
  const resourceConfig = inject('resourceConfig', null)
  const ui = useAQLConfig()
  const { user } = useAuth()

  const requisitions = useRecord('PurchaseRequisitions')
  const requisitionItems = useRecord('PurchaseRequisitionItems')
  const suppliers = useRecord('Suppliers')
  const procurements = useRecord('Procurements')
  const skus = useRecord('SKUs')
  const products = useRecord('Products')

  const { skuLabelOf } = useSkuResource()

  onMounted(() => {
    ;[requisitions, requisitionItems, suppliers, procurements, skus, products]
      .forEach((resource) => resource.reload())
    seedDefaults()
  })

  function control (key) {
    return pageState?.getControls(key, null, NODE)
  }

  function setControl (key, value) {
    pageState?.setControls(key, value, NODE)
  }

  function seedDefaults () {
    if (control('Seeded') === true) return
    const today = toDateInputValue()
    setControl('Form', { ...DEFAULT_FORM, RFQDate: today, SubmissionDeadline: addDays(today, 7) })
    setControl('SelectedItemCodes', [])
    setControl('SelectedSupplierCodes', [])
    setControl('Seeded', true)
  }

  const form = computed(() => {
    const value = control('Form')
    return value && typeof value === 'object' ? value : DEFAULT_FORM
  })

  function setFormField (key, value) {
    setControl('Form', { ...form.value, [key]: value })
  }

  const eligibleRequisitions = computed(() => requisitions.items.value
    .map(asRow)
    .filter(isRfqEligible)
    .map((row) => ({
      code: text(row.Code),
      label: `${typeMeta(row.Type).label} · ${text(row.Code)}`,
      caption: [priorityMeta(row.Priority).label, text(row.RequiredDate)].filter(Boolean).join(' • '),
      row
    })))

  const selectedRequisitionCode = computed(() => text(control('RequisitionCode')))

  const requisition = computed(() => {
    const code = selectedRequisitionCode.value
    if (!code) return null
    return requisitions.items.value.map(asRow).find((row) => text(row.Code) === code) || null
  })

  const procurement = computed(() => {
    const code = text(requisition.value?.ProcurementCode)
    if (!code) return null
    return procurements.items.value.map(asRow).find((row) => text(row.Code) === code) || null
  })

  const availableItems = computed(() => {
    const code = selectedRequisitionCode.value
    if (!code) return []
    return requisitionItems.items.value
      .map(asRow)
      .filter((row) => text(row.PurchaseRequisitionCode) === code && isActive(row) && text(row.Code))
      .map((row) => {
        const label = skuLabelOf(text(row.SKU))
        return {
          code: text(row.Code),
          sku: text(row.SKU),
          primary: label.primary,
          secondary: label.secondary,
          uom: text(row.UOM) || label.uom,
          quantity: num(row.Quantity),
          row
        }
      })
  })

  const selectedItemCodes = computed(() => {
    const value = control('SelectedItemCodes')
    return Array.isArray(value) ? value : []
  })

  const selectedItems = computed(() => {
    const wanted = new Set(selectedItemCodes.value)
    return availableItems.value.filter((item) => wanted.has(item.code))
  })

  const selectedSupplierCodes = computed(() => {
    const value = control('SelectedSupplierCodes')
    return Array.isArray(value) ? value : []
  })

  const availableSuppliers = computed(() => suppliers.items.value
    .map(asRow)
    .filter((row) => isActive(row) && text(row.Code))
    .map((row) => ({
      code: text(row.Code),
      name: text(row.Name) || text(row.Code),
      country: text(row.Country),
      contact: text(row.ContactPerson)
    })))

  function selectRequisition (code) {
    setControl('RequisitionCode', text(code))
    setControl('SelectedItemCodes', [])
  }

  function toggleItem (code) {
    const next = new Set(selectedItemCodes.value)
    if (next.has(code)) next.delete(code)
    else next.add(code)
    setControl('SelectedItemCodes', Array.from(next))
  }

  function selectAllItems () {
    setControl('SelectedItemCodes', availableItems.value.map((item) => item.code))
  }

  function toggleSupplier (code) {
    const next = new Set(selectedSupplierCodes.value)
    if (next.has(code)) next.delete(code)
    else next.add(code)
    setControl('SelectedSupplierCodes', Array.from(next))
  }

  const totals = computed(() => selectedItems.value.reduce((acc, item) => {
    acc.lines += 1
    acc.quantity += item.quantity
    return acc
  }, { lines: 0, quantity: 0 }))

  const currentStep = computed(() => pageState?.meta?.currentStep || 1)

  return {
    pageState,
    resourceConfig,
    ui,
    user,
    form,
    setFormField,
    eligibleRequisitions,
    selectedRequisitionCode,
    requisition,
    procurement,
    availableItems,
    selectedItemCodes,
    selectedItems,
    availableSuppliers,
    selectedSupplierCodes,
    selectRequisition,
    toggleItem,
    selectAllItems,
    toggleSupplier,
    totals,
    currentStep,
    termOptions,
    termLabel
  }
}
