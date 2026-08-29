import { computed, onMounted, watch } from 'vue'
import { useAuth } from 'src/composables/core/useAuth'
import { useCurrency } from 'src/composables/useCurrency'
import { useRouteConfig } from 'src/composables/resources/useRouteConfig'
import { useReturnFormContext } from 'src/_ui/AQL/composables/Operation/OutletReturns/useReturnFormContext'
import {
  resolveReturnUnitPrice,
  effectivePriceListCode,
  priceFromList
} from 'src/_resource/Operation/OutletReturns/composables/useReturnPricing'
import {
  REASON_META,
  REASONS,
  REASON_REQUIRING_COMMENT,
  returnRequiresTrack
} from 'src/_resource/Operation/OutletReturns/composables/useReturnProgress'

export const NODE = 'OutletReturns'

const PRICE_LIST_CONTROL = 'PriceListCode'
const PRICE_TOUCHED_CONTROL = 'PriceTouched'
const HYDRATED_FOR_CONTROL = 'EditHydratedFor'

const text = (value) => (value == null ? '' : String(value).trim())
const isActive = (row) => text(row?.Status || 'Active') === 'Active'

export function useReturnFormFields () {
  const { pageState, resourceRecord, resourceConfig, resource, ui } = useReturnFormContext()
  const { user } = useAuth()
  const { query } = useRouteConfig()
  const { _C } = useCurrency()

  // Every resource goes through the relay's `useRecord` accessor, which owns both the
  // reactive rows and the `reload()` delta sync — no store is imported here (§5).
  const outlets = resource('Outlets')
  const skus = resource('SKUs')
  const products = resource('Products')
  const warehouses = resource('Warehouses')
  const priceLists = resource('PriceList')
  const invoices = resource('OutletConsumptionInvoices')
  const invoiceItems = resource('OutletConsumptionInvoiceItems')

  const node = pageState.useNode(NODE)
  const form = computed(() => node.record.value || {})

  /** The server row behind an Edit page. Always null on Add. */
  const serverRecord = computed(() => resourceRecord?.record?.value || null)

  const outletOptions = computed(() => outlets.items.value
    .filter(isActive)
    .map((row) => ({ label: [row.Code, row.Name].filter(Boolean).join(' · '), value: row.Code })))

  const productNameByCode = computed(() => {
    const map = new Map()
    for (const row of products.items.value) map.set(text(row.Code), text(row.Name))
    return map
  })

  const skuOptions = computed(() => skus.items.value
    .filter(isActive)
    .map((row) => {
      const productName = productNameByCode.value.get(text(row.ProductCode)) || text(row.Code)
      const variants = [row.Variant1, row.Variant2, row.Variant3, row.Variant4, row.Variant5]
        .map(text).filter(Boolean).join(' / ')
      return { label: variants ? `${productName} — ${variants}` : productName, value: row.Code }
    }))

  const warehouseOptions = computed(() => warehouses.items.value
    .filter(isActive)
    .map((row) => ({ label: [row.Code, row.Name].filter(Boolean).join(' · '), value: row.Code })))

  const priceListOptions = computed(() => priceLists.items.value
    .filter(isActive)
    .map((row) => ({ label: text(row.Name) || text(row.Code), value: text(row.Code) })))

  /** The seven reason codes, projected from the ONE vocabulary — never restated (§4.5). */
  const reasonOptions = REASONS.map((code) => ({ label: REASON_META[code].label, value: code }))

  /** `?outletCode=OUT-01` from the Outlet Hub. Blank when the page was opened directly. */
  const presetOutletCode = computed(() => text(query.value?.outletCode))

  const outletLocked = computed(() => !!serverRecord.value || (
    !!presetOutletCode.value && outletOptions.value.some((o) => o.value === presetOutletCode.value)
  ))

  const lockedOutletLabel = computed(() =>
    outletOptions.value.find((option) => option.value === form.value.OutletCode)?.label ||
    text(form.value.OutletCode))

  const lineByInvoiceCode = computed(() => {
    const sku = text(form.value.SKU)
    const map = new Map()
    if (!sku) return map
    for (const row of invoiceItems.items.value) {
      if (text(row.SKU) !== sku) continue
      const code = text(row.OutletConsumptionInvoiceCode)
      if (!code) continue
      const qty = Number(row.Qty) || 0
      const price = Number(row.Price) || 0
      const existing = map.get(code)
      if (existing) {
        existing.qty += qty
        existing.amount += Number(row.Total) || qty * price
      } else {
        map.set(code, { qty, price, amount: Number(row.Total) || qty * price })
      }
    }
    return map
  })

  const matchingInvoices = computed(() => {
    const outletCode = text(form.value.OutletCode)
    if (!outletCode || !text(form.value.SKU)) return []
    return invoices.items.value
      .filter((row) => isActive(row) && text(row.OutletCode) === outletCode)
      .map((row) => {
        const code = text(row.Code)
        const line = lineByInvoiceCode.value.get(code)
        if (!line) return null
        return {
          code,
          Code: code,
          date: text(row.Date),
          priceListCode: text(row.PriceListCode),
          qty: line.qty,
          price: line.price,
          label: [text(row.Date), text(row.Username)].filter(Boolean).join(' • '),
          qtyLabel: `Invoiced Quantity: ${line.qty}`,
          totalLabel: `Invoice Total: ${_C(line.amount)}`,
          priceLabel: _C(line.price)
        }
      })
      .filter(Boolean)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
  })

  // The SOURCE bill, never `ConsumptionInvoiceCode` — that column belongs to the credit chain.
  const selectedInvoiceCode = computed(() => text(form.value.SourceInvoiceCode))

  const invoiceRequired = computed(() => form.value.InvoiceAdjustmentRequired === true)
  const warehouseRequired = computed(() => form.value.WarehouseActionRequired === true)

  const priceListCode = computed(() => text(pageState.getControls(PRICE_LIST_CONTROL, null, NODE)))

  // A control field, not a ref: the invoice picker and the price field are separate cards.
  const priceTouched = computed(() => pageState.getControls(PRICE_TOUCHED_CONTROL, null, NODE) === true)

  const set = (key, value) => pageState.setRecord(key, value, NODE)
  const setControl = (key, value) => pageState.setControls(key, value, NODE)

  function setOutlet (value) {
    set('OutletCode', value)
    // The invoice link belonged to the previous outlet; keeping it would credit this return
    // against a bill that was never issued to the outlet now selected.
    clearInvoiceLink()
    applyOutletPriceList(value)
    repriceFromList()
  }

  function setSku (value) {
    set('SKU', value)
    clearInvoiceLink()
    repriceFromList()
  }

  function setQty (value) { set('Qty', Number(value) || 0) }
  function setReason (value) { set('Reason', value) }
  function setReasonComment (value) { set('ReasonComment', value) }
  function setWarehouse (value) { set('WarehouseCode', value) }

  function setPrice (value) {
    setControl(PRICE_TOUCHED_CONTROL, true)
    set('Price', Number(value) || 0)
  }

  function setPriceList (value) {
    setControl(PRICE_LIST_CONTROL, text(value))
    // Choosing a list IS a pricing instruction, so it overrides a previously typed figure —
    // unlike a SKU change, which only fills a blank.
    setControl(PRICE_TOUCHED_CONTROL, false)
    repriceFromList()
  }

  function setInvoiceRequired (value) {
    set('InvoiceAdjustmentRequired', value === true)
    if (value !== true) set('SourceInvoiceCode', '')
  }

  function setWarehouseRequired (value) {
    const on = value === true
    set('WarehouseActionRequired', on)
    // Cleared on the way off, so a stale warehouse code cannot ride along on a return whose
    // stock never leaves the shelf.
    set('WarehouseCode', on
      ? (text(form.value.WarehouseCode) || warehouseOptions.value[0]?.value || '')
      : '')
  }

  function clearInvoiceLink () {
    if (selectedInvoiceCode.value) set('SourceInvoiceCode', '')
  }

  function toggleInvoice (code) {
    if (selectedInvoiceCode.value === code) {
      set('SourceInvoiceCode', '')
      set('InvoiceAdjustmentRequired', false)
      return
    }

    const invoice = matchingInvoices.value.find((row) => row.code === code)
    if (!invoice) return

    set('SourceInvoiceCode', code)
    // Pointing at the bill IS the request to credit it — the officer would otherwise have to
    // say the same thing twice, once here and once on the toggle two cards down.
    set('InvoiceAdjustmentRequired', true)
    set('Qty', invoice.qty)
    set('Price', invoice.price)
    setControl(PRICE_LIST_CONTROL, invoice.priceListCode)
    // The figures came from the bill, not from a list lookup, so a later list change is
    // still free to overwrite them.
    setControl(PRICE_TOUCHED_CONTROL, false)
  }

  /** Seed the list selector from the outlet's own effective list. */
  function applyOutletPriceList (outletCode) {
    const resolved = effectivePriceListCode(outletCode)
    if (resolved) setControl(PRICE_LIST_CONTROL, resolved)
  }

  /** Price from the CHOSEN list, filling only what the officer has not claimed. */
  function repriceFromList () {
    if (priceTouched.value) return
    const sku = text(form.value.SKU)
    if (!sku) return
    const list = priceListCode.value
    set('Price', list
      ? priceFromList(list, sku)
      : resolveReturnUnitPrice(form.value.OutletCode, sku))
  }

  const priceCaption = computed(() => {
    if (selectedInvoiceCode.value) {
      return `Quantity and price taken from invoice ${selectedInvoiceCode.value}.`
    }
    if (priceTouched.value) return 'Unit price entered manually.'
    const price = Number(form.value.Price) || 0
    return price > 0
      ? 'Unit price from the selected price list. Editable.'
      : 'This item is not priced on the selected list — enter the credit value if one is owed.'
  })

  const commentLabel = computed(() =>
    form.value.Reason === REASON_REQUIRING_COMMENT ? 'Reason Comment *' : 'Reason Comment')

  /** Both tracks off — the one failure no field can show, and the reason it reads DANGER. */
  const noTrackChosen = computed(() => !returnRequiresTrack({
    InvoiceAdjustmentRequired: invoiceRequired.value,
    WarehouseActionRequired: warehouseRequired.value
  }))

  const blockingMessage = computed(() => {
    if (!form.value.OutletCode || !form.value.SKU) return ''
    if (noTrackChosen.value) {
      return 'A return must either be credited on an invoice or move stock off the shelf. Turn on at least one of the two above.'
    }
    if (warehouseRequired.value && !text(form.value.WarehouseCode)) {
      return 'Choose the warehouse this stock is going to.'
    }
    if (form.value.Reason === REASON_REQUIRING_COMMENT && !text(form.value.ReasonComment)) {
      return 'Reason "Other" needs an explanation.'
    }
    return ''
  })

  return {
    pageState,
    resourceRecord,
    resourceConfig,
    ui,
    user,
    text,

    // resources, so the seeder can preload exactly what the form reads
    resources: [outlets, skus, products, warehouses, priceLists, invoices, invoiceItems],

    node,
    form,
    serverRecord,

    outletOptions,
    skuOptions,
    warehouseOptions,
    priceListOptions,
    reasonOptions,

    presetOutletCode,
    outletLocked,
    lockedOutletLabel,

    matchingInvoices,
    selectedInvoiceCode,
    toggleInvoice,

    invoiceRequired,
    warehouseRequired,
    priceListCode,
    priceTouched,

    set,
    setControl,
    setOutlet,
    setSku,
    setQty,
    setPrice,
    setPriceList,
    setReason,
    setReasonComment,
    setWarehouse,
    setInvoiceRequired,
    setWarehouseRequired,
    applyOutletPriceList,
    repriceFromList,

    priceCaption,
    commentLabel,
    noTrackChosen,
    blockingMessage
  }
}

export function useReturnFormSeed (mode = 'add') {
  const fields = useReturnFormFields()
  const {
    pageState, form, serverRecord, resources, text: t,
    warehouseOptions, outletLocked, presetOutletCode,
    setOutlet, set, setControl, priceTouched, priceListCode, selectedInvoiceCode
  } = fields

  const isEdit = mode === 'edit'

  function seedAdd () {
    pageState.initResource(NODE, {
      reset: true,
      isPrimaryKey: true,
      fields: {
        Date: new Date().toISOString().slice(0, 10),
        Username: t(fields.user.value?.name || fields.user.value?.email || ''),
        OutletCode: '',
        SKU: '',
        Qty: 1,
        Price: 0,
        Reason: 'DAMAGE',
        ReasonComment: '',
        InvoiceAdjustmentRequired: false,
        WarehouseActionRequired: true,
        WarehouseCode: '',
        SourceInvoiceCode: ''
      }
    })
    setControl(PRICE_LIST_CONTROL, '')
    setControl(PRICE_TOUCHED_CONTROL, false)
  }

  function seedEdit () {
    const record = serverRecord.value
    if (!record) return
    const code = t(record.Code)
    if (!code) return
    if (t(pageState.getControls(HYDRATED_FOR_CONTROL, null, NODE)) === code) return

    pageState.initResource(NODE, { isPrimaryKey: true, reset: true, code })
    pageState.setControls(HYDRATED_FOR_CONTROL, code, NODE)
    pageState.load(record, NODE)

    const flag = (value) => value === true || t(value).toUpperCase() === 'TRUE'
    set('InvoiceAdjustmentRequired', flag(record.InvoiceAdjustmentRequired))
    set('WarehouseActionRequired', flag(record.WarehouseActionRequired))

    // The stored price is the figure that was recorded, so it is treated as typed: the
    // cascade must never re-price a correction someone already made.
    setControl(PRICE_TOUCHED_CONTROL, true)
    fields.applyOutletPriceList(t(record.OutletCode))
  }

  onMounted(async () => {
    if (!isEdit) seedAdd()

    // `reload()` renders from whatever the store already holds and runs the sync as a
    // silent background delta, so a warm cache shows the form immediately.
    await Promise.all(resources.map((res) => res.reload()))

    if (isEdit) return

    if (outletLocked.value) setOutlet(presetOutletCode.value)

    if (form.value.WarehouseActionRequired === true && !t(form.value.WarehouseCode)) {
      set('WarehouseCode', warehouseOptions.value[0]?.value || '')
    }
  })

  // Edit hydrates on whichever comes last, the record landing or the node being replaced.
  if (isEdit) {
    watch([serverRecord, () => fields.node.identifier.value], () => { seedEdit() }, { immediate: true })
  }

  watch(
    () => (t(form.value.SKU) && priceListCode.value
      ? priceFromList(priceListCode.value, form.value.SKU)
      : 0),
    (price) => {
      if (priceTouched.value || selectedInvoiceCode.value) return
      if (price > 0 && Number(form.value.Price) !== price) set('Price', price)
    }
  )

  return fields
}
