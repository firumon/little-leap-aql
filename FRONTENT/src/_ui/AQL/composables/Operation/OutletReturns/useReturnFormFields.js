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

/**
 * OutletReturns — the ONE form controller behind every card of Add and Edit.
 *
 * ── WHY THE FORM IS SIX COMPONENTS AND ONE COMPOSABLE ──
 * The return form is now six independent section cards (`FormReturnedItem`, `FormBilledOn`,
 * `FormQuantityValue`, `FormCommercialCredit`, `FormReason`, `FormPhysicalStock`), declared
 * by BOTH page contracts. Six siblings cannot share a `ref`, so nothing here holds local
 * state: every value is a projection of `pageState` and every writer goes straight back to
 * it (ARCHITECTURE RULES §6). Any card may therefore mount, unmount or re-order without the
 * form losing a thing — and Add and Edit render the same controls because they render the
 * same components, not because two files were kept in step.
 *
 * ── EVERY COMPUTED HERE IS LAZY, ON PURPOSE ──
 * All six cards call this one function, but a Vue `computed` only evaluates when something
 * reads it. `skuOptions` runs in the card that renders the SKU selector and nowhere else,
 * so the single wide surface costs no more than six narrow ones would.
 *
 * ── `priceTouched` IS A CONTROL FIELD, NOT A `ref` ──
 * Two different cards move the price: the invoice picker in `FormBilledOn` and the manual
 * field in `FormQuantityValue`. The "the officer typed this figure themselves" flag is
 * shared state between them, so it lives on the node like `PriceListCode` does (§13.5) —
 * a `ref` in this closure would give each card its own copy and the cascade would overwrite
 * a typed figure the moment another card re-priced.
 *
 * Not one business rule is decided here: the price cascade, the reason vocabulary and the
 * dual-track shape rule are all Layer 2 calls (§4).
 */

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

  // ─── Option sets ────────────────────────────────────────────────────────────

  const outletOptions = computed(() => outlets.items.value
    .filter(isActive)
    .map((row) => ({ label: [row.Code, row.Name].filter(Boolean).join(' · '), value: row.Code })))

  const productNameByCode = computed(() => {
    const map = new Map()
    for (const row of products.items.value) map.set(text(row.Code), text(row.Name))
    return map
  })

  /**
   * SKU options as "Product — variants", built through ONE `Map` pass rather than a
   * `.find()` per SKU: this list runs to every active SKU in the tenant, and a lookup
   * inside the projection would make it O(n×m) and recompute on every keystroke (§6).
   */
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

  // ─── The outlet lock ────────────────────────────────────────────────────────

  /** `?outletCode=OUT-01` from the Outlet Hub. Blank when the page was opened directly. */
  const presetOutletCode = computed(() => text(query.value?.outletCode))

  /**
   * The outlet is STATED rather than offered in two cases: arriving from the Outlet Hub
   * with it already decided, and editing — where re-pointing the return would leave the
   * ledger movement written at creation against the wrong shelf, with nothing to reverse
   * it (the reasoning `Edit.js` used to give for omitting the field entirely).
   */
  const outletLocked = computed(() => !!serverRecord.value || (
    !!presetOutletCode.value && outletOptions.value.some((o) => o.value === presetOutletCode.value)
  ))

  const lockedOutletLabel = computed(() =>
    outletOptions.value.find((option) => option.value === form.value.OutletCode)?.label ||
    text(form.value.OutletCode))

  // ─── The invoice shortcut ───────────────────────────────────────────────────

  /**
   * This SKU's line on each invoice — quantity, unit price and amount, indexed by invoice.
   * ONE pass over the item sheet, then O(1) reads; a `.find()` per invoice would be O(n×m)
   * over two of the largest sheets in the system.
   */
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
      // One SKU can legitimately appear on several lines of one bill; they are summed, and
      // the unit price is taken from the first line rather than averaged — an average of
      // two genuinely different prices is a number that was never charged.
      if (existing) {
        existing.qty += qty
        existing.amount += Number(row.Total) || qty * price
      } else {
        map.set(code, { qty, price, amount: Number(row.Total) || qty * price })
      }
    }
    return map
  })

  /**
   * Invoices that billed THIS SKU to THIS outlet, newest first.
   *
   *   label      `<date> • <username>`
   *   caption 1  `Invoiced Quantity: <qty>`
   *   caption 2  `Invoice Total: <amount>`
   *   chip       the unit price that was charged
   *
   * The two caption strings and the chip are formatted HERE rather than in the template:
   * the rows render in a `v-for`, and a currency call per cell per re-render is work this
   * computed already did once.
   */
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

  const selectedInvoiceCode = computed(() => text(form.value.ConsumptionInvoiceCode))

  // ─── Flags & control fields ─────────────────────────────────────────────────

  const invoiceRequired = computed(() => form.value.InvoiceAdjustmentRequired === true)
  const warehouseRequired = computed(() => form.value.WarehouseActionRequired === true)

  /**
   * Not a column: `OutletReturns` declares no `PriceListCode` header, so the chosen list is
   * a CONTROL FIELD (§13.5) whose only job is to decide what goes in `Price`.
   */
  const priceListCode = computed(() => text(pageState.getControlField(NODE, PRICE_LIST_CONTROL)))

  const priceTouched = computed(() => pageState.getControlField(NODE, PRICE_TOUCHED_CONTROL) === true)

  // ─── Writers ────────────────────────────────────────────────────────────────

  const set = (key, value) => pageState.setField(NODE, key, value)
  const setControl = (key, value) => pageState.setControlField(NODE, key, value)

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

  /**
   * The officer's own figure wins from here on. Once a price has been typed, changing the
   * SKU or the list must not silently overwrite it — but the cascade should still fill a
   * field nobody has touched. Picking an invoice deliberately RESETS the flag, because that
   * is an explicit request to take that bill's numbers.
   */
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
    // Turning the flag off drops the link too — a return that credits nothing has no
    // business pointing at an invoice. Turning it back ON does not restore it: the officer
    // re-picks.
    if (value !== true) set('ConsumptionInvoiceCode', '')
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
    if (selectedInvoiceCode.value) set('ConsumptionInvoiceCode', '')
  }

  /**
   * Picking an invoice says four things at once: this return is credited, here is the bill,
   * here is what was billed, and here is the list it was priced from.
   *
   * Clicking the selected one again clears the LINK and the flag together — the two were
   * set as one act, so they are undone as one.
   */
  function toggleInvoice (code) {
    if (selectedInvoiceCode.value === code) {
      set('ConsumptionInvoiceCode', '')
      set('InvoiceAdjustmentRequired', false)
      return
    }

    const invoice = matchingInvoices.value.find((row) => row.code === code)
    if (!invoice) return

    set('ConsumptionInvoiceCode', code)
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

  // ─── Captions and gates ─────────────────────────────────────────────────────

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

  /**
   * The conditions that stop a submit and are not obvious from the fields themselves. Said
   * here, above the sticky bar, rather than discovered at it (§13.4).
   */
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

/**
 * The page's HYDRATION POINT (§5.5, §13.5) — called by `FormReturnedItem`, the first card
 * both contracts render, and by nothing else.
 *
 * Neither contract carries a `Create`/`Update` content, so the node is seeded here: with
 * this module's defaults on Add, and from the server row on Edit. The bookkeeping flag
 * lives on the NODE rather than in this closure, exactly as `useRestockEditForm` keeps its
 * own — a second caller would otherwise re-seed over what the user had typed.
 *
 * @param {'add'|'edit'} mode
 */
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
        // The PHYSICAL track starts ON, because that is what a return is by default: units
        // coming off the shelf. The COMMERCIAL one stays off — defaulting the credit to on
        // would quietly bill a decision the officer never made, and picking an invoice
        // turns it on for them.
        InvoiceAdjustmentRequired: false,
        WarehouseActionRequired: true,
        WarehouseCode: '',
        ConsumptionInvoiceCode: ''
      }
    })
    setControl(PRICE_LIST_CONTROL, '')
    setControl(PRICE_TOUCHED_CONTROL, false)
  }

  /**
   * Edit seeds from the server row, once per (node, record code).
   *
   * Keyed on the CODE rather than the record OBJECT: a background delta sync hands back a
   * fresh enriched object for the same row, and re-hydrating on that would wipe the
   * correction being typed.
   *
   * The two flag columns arrive as `'TRUE'`/`'FALSE'` STRINGS from the sheet, while every
   * toggle in this form reads a real boolean — so they are normalized on the way in. Left
   * as strings, both switches would render off on a return that has both tracks open, and
   * saving would then turn them off for real.
   */
  function seedEdit () {
    const record = serverRecord.value
    if (!record) return
    const code = t(record.Code)
    if (!code) return
    if (t(pageState.getControlField(NODE, HYDRATED_FOR_CONTROL)) === code) return

    pageState.initResource(NODE, { isPrimaryKey: true, reset: true, code })
    pageState.setControlField(NODE, HYDRATED_FOR_CONTROL, code)
    pageState.load(NODE, record)

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

    // The physical track is on from the first paint, but its options only exist after the
    // load above — so the target is seeded here rather than in `initResource`, which would
    // otherwise leave the default-on track pointing at nothing.
    if (form.value.WarehouseActionRequired === true && !t(form.value.WarehouseCode)) {
      set('WarehouseCode', warehouseOptions.value[0]?.value || '')
    }
  })

  // Edit hydrates on whichever comes last, the record landing or the node being replaced.
  if (isEdit) {
    watch([serverRecord, () => fields.node.identifier.value], () => { seedEdit() }, { immediate: true })
  }

  /**
   * Re-price once the price list data actually lands.
   *
   * `onMounted` runs before the cascade's rows are in the store on a cold start, so the
   * first lookup would answer 0 for everything. Watching the resolved figure lets the field
   * fill itself the moment the data settles — and `priceTouched` keeps it from ever
   * overwriting a figure the officer typed, while a live invoice link suppresses it.
   */
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
