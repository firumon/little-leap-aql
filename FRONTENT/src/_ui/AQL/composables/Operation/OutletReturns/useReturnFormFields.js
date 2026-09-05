import { computed, onMounted, watch } from 'vue'
import { useAuth } from 'src/composables/core/useAuth'
import { useCurrency } from 'src/composables/useCurrency'
import { useRouteConfig } from 'src/composables/resources/useRouteConfig'
import { useReturnFormContext } from 'src/_ui/AQL/composables/Operation/OutletReturns/useReturnFormContext'
import { buildReturnEditNodes, applyReturnWarehouseTrack } from 'src/_resource/Operation/OutletReturns/composables/useReturnPayload'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { useOutletResource } from 'src/_resource/Master/Outlets/composables/useOutletResource'
import { useWarehouseResource } from 'src/_resource/Master/Warehouses/composables/useWarehouseResource'
import { usePriceListResource } from 'src/_resource/Master/PriceLists/composables/usePriceListResource'
import {
  REASON_META,
  REASONS,
  REASON_REQUIRING_COMMENT,
  returnRequiresTrack,
  isFlagged
} from 'src/_resource/Operation/OutletReturns/composables/useReturnProgress'

export const NODE = 'OutletReturns'

const PRICE_LIST_CONTROL = 'PriceListCode'
const PRICE_TOUCHED_CONTROL = 'PriceTouched'

const text = (value) => (value == null ? '' : String(value).trim())
const isActive = (row) => text(row?.Status || 'Active') === 'Active'

export function useReturnFormFields () {
  const { pageState, resourceRecord, resourceConfig, resource, ui } = useReturnFormContext()
  const { user } = useAuth()
  const { query } = useRouteConfig()
  const { _C } = useCurrency()

  // Published ONCE by the resource that owns the rows. Never rebuilt here — this composable
  // is imported by six cards, so a list built here would be built six times (§13.7 rule 5).
  const { skuOptions } = useSkuResource()
  const { outletOptions } = useOutletResource()
  const { warehouseOptions } = useWarehouseResource()
  const { priceListOptions } = usePriceListResource()

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

  // The sheet stores 'TRUE'/'FALSE' strings, so the toggle reads through `isFlagged`.
  const invoiceRequired = computed(() => isFlagged(form.value.InvoiceAdjustmentRequired))
  const warehouseRequired = computed(() => isFlagged(form.value.WarehouseActionRequired))

  const priceListCode = computed(() => text(pageState.getControls(PRICE_LIST_CONTROL, null, NODE)))

  // A control field, not a ref: the invoice picker and the price field are separate cards.
  const priceTouched = computed(() => pageState.getControls(PRICE_TOUCHED_CONTROL, null, NODE) === true)

  const set = (key, value) => pageState.setRecord(key, value, NODE)
  const setControl = (key, value) => pageState.setControls(key, value, NODE)

  // Every setter writes ONE column and stops. What follows from that column — the price,
  // the price list, the invoice link, the warehouse, the shelf movement — is regenerated by
  // the Layer 2 `derive` entries the node carries (UI_PAGE_STATE_NODES.md §5.7B).
  function setOutlet (value) { set('OutletCode', value) }
  function setSku (value) { set('SKU', value) }
  function setQty (value) { set('Qty', Number(value) || 0) }
  function setReason (value) { set('Reason', value) }
  function setReasonComment (value) { set('ReasonComment', value) }
  function setWarehouse (value) { set('WarehouseCode', value) }
  function setInvoiceRequired (value) { set('InvoiceAdjustmentRequired', !!value) }
  function setWarehouseRequired (value) { set('WarehouseActionRequired', !!value) }

  function setPrice (value) {
    setControl(PRICE_TOUCHED_CONTROL, true)
    set('Price', Number(value) || 0)
  }

  // Claimed prices are released first, so the derive that watches this control may reprice.
  function setPriceList (value) {
    setControl(PRICE_TOUCHED_CONTROL, false)
    setControl(PRICE_LIST_CONTROL, text(value))
  }

  function toggleInvoice (code) {
    set('SourceInvoiceCode', selectedInvoiceCode.value === code ? '' : code)
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
    outletLocked, presetOutletCode, setOutlet
  } = fields

  const isEdit = mode === 'edit'

  function seedEdit () {
    const record = serverRecord.value
    if (!record) return
    const code = t(record.Code)
    if (!code) return
    // The contract's `ready` already flushed the previous page, so the node's existence is a
    // safe "have I hydrated this" — and it needs no marker control, which `applyNodes`
    // would wipe anyway (UI_PAGE_STATE_NODES.md §5B.5).
    if (pageState.hasNode(NODE)) return

    // The whole draft — record, controls and derivations — is Layer 2's.
    pageState.initResource(NODE, { isPrimaryKey: true, code })
    pageState.applyNodes(buildReturnEditNodes({ record }))
  }

  onMounted(async () => {
    // On Add the blank draft, its controls and all its derivations are mounted by the page
    // contract's `ready` hook from the Layer 2 builder, so nothing is seeded here.
    // `reload()` renders from whatever the store already holds and runs the sync as a
    // silent background delta, so a warm cache shows the form immediately.
    await Promise.all(resources.map((res) => res.reload()))

    if (isEdit) return

    if (outletLocked.value) setOutlet(presetOutletCode.value)

    // The node opens with the physical track ON, and a derive only fires on a CHANGE, so
    // the destination is settled here — by Layer 2, once its master rows are in.
    applyReturnWarehouseTrack(form.value.WarehouseActionRequired, pageState)
  })

  // Edit hydrates on whichever comes last, the record landing or the node being replaced.
  if (isEdit) {
    watch([serverRecord, () => fields.node.identifier.value], () => { seedEdit() }, { immediate: true })
  }

  return fields
}
