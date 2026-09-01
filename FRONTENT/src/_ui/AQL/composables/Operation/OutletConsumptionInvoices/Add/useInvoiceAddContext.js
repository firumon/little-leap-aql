import { inject, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useCurrencyResource } from 'src/_resource/Master/Currencies/composables/useCurrencyResource'
import { usePriceListResource } from 'src/_resource/Master/PriceLists/composables/usePriceListResource'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { useRecord } from 'src/composables/resources/useRecord'
import { useInvoiceIndex } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceIndex'
import {
  resolvePriceListCode,
  invoiceDueDaysFor,
  dueDateFrom,
  calculateConsumptionInvoice,
  makeLineTaxResolver
} from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceCalculation'
import { priceOf } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionStock'
import { useAuth } from 'src/composables/core/useAuth'
import { buildInvoiceGenerationNodes, repriceInvoiceInPageState } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoicePayload'

// OutletConsumptionInvoices › Add — one inject() for the three step cards, and the one
// place the wizard's state lives. Headers go to `record`, lines to `children`, and every
// change re-applies the Layer 2 node graph, so what is reviewed is what is submitted.

const text = (value) => (value == null ? '' : String(value).trim())
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const NODE = 'OutletConsumptionInvoices'
const ITEMS = 'OutletConsumptionInvoiceItems'

// Every answer that IS stored goes on the record; the lines go in `children`. Only
// `DiscountType`, `DiscountValue` and `ApplyReturns` stay controls - none of them is
// stored, they only decide what the stored figures become (UI_PAGE_STATE.md §5B.5).
const COLUMNS = new Set([
  'OutletCode', 'DueDate', 'PriceListCode',
  'OutletConsumptionCode', 'OutletReturnCodes', 'ProgressPendingPaymentComment'
])

const csv = (value) => text(value).split(',').map(text).filter(Boolean)

export function useInvoiceAddContext () {
  const pageState = inject('pageState', null)
  const resourceConfig = inject('resourceConfig', null)

  const route = useRoute()
  const ui = useAQLConfig()
  const { _C } = useCurrencyResource()
  const { activePriceLists } = usePriceListResource()
  // `skuLabelOf` is the ONE naming rule for a SKU, owned by the SKUs domain — a code is
  // never a name (UI_RESOURCE_DOMAIN_LOGIC.md §3.3).
  const { skus, skuLabelOf } = useSkuResource()
  const index = useInvoiceIndex()

  // ── The wizard's answers ────────────────────────────────────────────────────
  const field = (header, fallback = '') => {
    const value = COLUMNS.has(header)
      ? pageState?.getRecord(header, NODE)
      : pageState?.getControls(header, null, NODE)
    return value === undefined || value === null ? fallback : value
  }
  const setField = (header, value) => (COLUMNS.has(header)
    ? pageState?.setRecord(header, value, NODE)
    : pageState?.setControls(header, value, NODE))

  // Reads the record only, never the route query: `initNode` seeds the query in once, so
  // the screen and the submit path share one source of truth.
  const outletCode = computed({
    get: () => text(field('OutletCode')),
    set: (value) => {
      setField('OutletCode', text(value))
      // A new outlet invalidates every answer below, or the review shows one total built
      // from two outlets.
      setField('OutletConsumptionCode', '')
      clearLines()
      // A different outlet has different returns; carrying the old selection over would
      // credit one outlet's returns against another's bill.
      setField('ApplyReturns', false)
      setField('OutletReturnCodes', '')
      setField('PriceListCode', resolvePriceListCode(text(value), index.operatingRules.value))
      setField('DueDate', defaultDueDate(text(value)))
    }
  })

  function defaultDueDate (outlet) {
    const today = new Date().toISOString().slice(0, 10)
    return dueDateFrom(today, invoiceDueDaysFor(outlet, index.operatingRules.value))
  }

  const priceListCode = computed({
    get: () => text(field('PriceListCode')) || resolvePriceListCode(outletCode.value, index.operatingRules.value),
    set: (value) => setField('PriceListCode', text(value))
  })

  const dueDate = computed({
    get: () => text(field('DueDate')) || defaultDueDate(outletCode.value),
    set: (value) => setField('DueDate', text(value))
  })

  const discountType = computed({
    get: () => text(field('DiscountType')) || 'FLAT',
    set: (value) => setField('DiscountType', text(value) || 'FLAT')
  })

  const discountValue = computed({
    get: () => num(field('DiscountValue', 0)),
    set: (value) => setField('DiscountValue', num(value))
  })

  // The note IS stored - `stampFields` writes it to this column. It is not working state.
  const comment = computed({
    get: () => text(field('ProgressPendingPaymentComment')),
    set: (value) => setField('ProgressPendingPaymentComment', text(value))
  })

  /** The consumption codes ticked in step 1 - the record's own column, not a copy of it. */
  const selectedCodes = computed({
    get: () => csv(field('OutletConsumptionCode')),
    set: (value) => setField('OutletConsumptionCode', (Array.isArray(value) ? value : []).map(text).filter(Boolean).join(','))
  })

  // ── What the answers imply ──────────────────────────────────────────────────

  /** The chosen outlet's uninvoiced consumptions, newest first. */
  const availableConsumptions = computed(() => {
    const outlet = outletCode.value
    if (!outlet) return []
    return index.pendingInvoiceGeneration.value
      .filter((row) => text(row.OutletCode) === outlet)
      .map((row) => {
        // Joined through the aggregate's indexed map, NOT `row.$OutletConsumptionItems` —
        // list records carry no nested children, so that accessor reads empty for every row.
        const items = index.itemsOfConsumption(row.Code)
          .filter((item) => text(item?.Status || 'Active').toUpperCase() === 'ACTIVE')
        return {
          code: text(row.Code),
          date: text(row.Date),
          username: text(row.Username),
          itemCount: items.length,
          totalQty: items.reduce((sum, item) => sum + num(item.Qty), 0),
          items,
          daysSince: daysBetween(text(row.Date))
        }
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1))
  })

  function daysBetween (iso) {
    const date = new Date(`${iso}T00:00:00`)
    if (Number.isNaN(date.getTime())) return null
    return Math.round((Date.now() - date.getTime()) / 86400000)
  }

  // One row per SKU: an outlet counted weekly and billed monthly gets one line per product,
  // not four. Each line keeps the counts it came from.
  const lineRows = () => pageState?.getChildRows(ITEMS, NODE) || []

  const clearLines = () => {
    for (let i = lineRows().length - 1; i >= 0; i--) pageState?.removeChild(ITEMS, i, NODE)
  }

  const lineIndexOf = (sku) => lineRows().findIndex((row) => text(row.SKU) === text(sku))

  // Re-seed the ticked lines, keeping hand-added ones. `_sources` is frontend-only, so
  // build() strips it before the row reaches the sheet.
  function seedLinesFromConsumptions () {
    const chosen = new Set(selectedCodes.value)
    const bySku = new Map()

    availableConsumptions.value.forEach((consumption) => {
      if (!chosen.has(consumption.code)) return
      consumption.items.forEach((item) => {
        const sku = text(item.SKU)
        if (!sku) return
        const qty = num(item.Qty)
        const entry = bySku.get(sku) || { Qty: 0, sources: [] }
        entry.Qty += qty
        entry.sources.push({
          key: `${consumption.code}-${sku}`,
          qty,
          label: `${qty} from ${consumption.date} (${consumption.username || '—'})`
        })
        bySku.set(sku, entry)
      })
    })

    // Drop the rows the ticks no longer justify. A hand-added row is never dropped here -
    // only `removeLine` takes one off.
    for (let i = lineRows().length - 1; i >= 0; i--) {
      const row = lineRows()[i]
      if (row._manual) continue
      if (!bySku.has(text(row.SKU))) pageState?.removeChild(ITEMS, i, NODE)
    }

    bySku.forEach((entry, sku) => {
      const at = lineIndexOf(sku)
      if (at < 0) {
        pageState?.addChild(ITEMS, { SKU: sku, Qty: entry.Qty, _sources: entry.sources }, NODE)
        return
      }
      const row = lineRows()[at]
      // A hand-added row that a tick now also covers keeps its own quantity on top.
      const manual = row._manual ? num(row.Qty) : 0
      pageState?.setChildren(ITEMS, at, null, { Qty: entry.Qty + manual, _sources: entry.sources }, NODE)
    })
  }

  /** The bill, read straight off the node. One row per SKU. */
  const groupedLines = computed(() => {
    pageState?.useNode(NODE)
    return lineRows()
      .filter((row) => num(row.Qty) > 0)
      .map((row) => {
        const label = skuLabelOf(row.SKU)
        return {
          SKU: text(row.SKU),
          Qty: num(row.Qty),
          Price: row.Price,
          sources: Array.isArray(row._sources) ? row._sources : [],
          manual: row._manual === true,
          primary: label.primary,
          secondary: label.secondary,
          uom: label.uom
        }
      })
  })

  // Which returns qualify is decided in `useInvoiceIndex`; this only narrows them to the
  // chosen outlet.
  const creditableReturns = computed(() => {
    const outlet = outletCode.value
    if (!outlet) return []
    return index.returnsAwaitingAdjustment.value
      .filter((row) => text(row.OutletCode) === outlet)
      .map((row) => {
        const label = skuLabelOf(row.SKU)
        return {
          code: text(row.Code),
          date: text(row.Date),
          sku: text(row.SKU),
          primary: label.primary,
          secondary: label.secondary,
          qty: num(row.Qty),
          price: num(row.Price),
          amount: num(row.Qty) * num(row.Price),
          reason: text(row.Reason),
          raw: row
        }
      })
      .sort((a, b) => (a.date < b.date ? -1 : 1))
  })

  // Opt-in. Crediting a return also closes it, so the user has to say yes first.
  const applyReturns = computed({
    get: () => field('ApplyReturns', false) === true,
    set: (value) => {
      const on = value === true
      setField('ApplyReturns', on)
      // On selects everything; off clears, so a re-tick never restores an abandoned set.
      selectedReturnCodes.value = on ? creditableReturns.value.map((row) => row.code) : []
    }
  })

  /** Which of the available returns this invoice credits. */
  const selectedReturnCodes = computed({
    get: () => csv(field('OutletReturnCodes')),
    set: (value) => setField('OutletReturnCodes', (Array.isArray(value) ? value : []).map(text).filter(Boolean).join(','))
  })

  // Intersected with what is still available: switching outlet leaves old codes behind for
  // one tick, and crediting another outlet's return is a real accounting error.
  const selectedReturns = computed(() => {
    if (!applyReturns.value) return []
    const chosen = new Set(selectedReturnCodes.value)
    return creditableReturns.value.filter((row) => chosen.has(row.code))
  })

  const returnDeduction = computed(() =>
    selectedReturns.value.reduce((sum, row) => sum + row.amount, 0))

  /** Add a SKU to the bill by hand, or top up the quantity if it is already a line. */
  const addExtraItem = (sku, qty = 1) => {
    const code = text(sku)
    const quantity = num(qty)
    if (!code || quantity <= 0) return
    const at = lineIndexOf(code)
    if (at < 0) pageState?.addChild(ITEMS, { SKU: code, Qty: quantity, _manual: true, _sources: [] }, NODE)
    else pageState?.setChildren(ITEMS, at, 'Qty', num(lineRows()[at].Qty) + quantity, NODE)
  }

  // Only a hand-added line goes. A counted quantity is a fact; untick the consumption.
  const removeLine = (sku) => {
    const at = lineIndexOf(sku)
    if (at < 0) return
    if (!lineRows()[at]._manual) return
    pageState?.removeChild(ITEMS, at, NODE)
  }

  /** The typed unit price. It lives ON the line now, so a re-tick can no longer lose it. */
  const setLinePrice = (sku, value) => {
    const at = lineIndexOf(sku)
    if (at >= 0) pageState?.setChildren(ITEMS, at, 'Price', num(value), NODE)
  }

  // A resolver, not pre-priced lines: the override then flows through tax, discount and the
  // net payable inside the one engine call.
  const resolvePrice = (sku, listCode) => {
    const at = lineIndexOf(sku)
    const typed = at >= 0 ? lineRows()[at].Price : undefined
    if (typed !== undefined && typed !== null && typed !== '') return num(typed)
    return priceOf(sku, listCode)
  }

  // SKUs still addable by hand. One already on the bill would only merge back into its own
  // line, so offering it promises something the flow cannot do.
  const skuCandidates = computed(() => {
    const taken = new Set(groupedLines.value.map((line) => line.SKU))
    return (Array.isArray(skus.value) ? skus.value : [])
      .filter((sku) => text(sku.status || 'Active').toUpperCase() === 'ACTIVE')
      .filter((sku) => !taken.has(sku.code))
      .map((sku) => {
        const label = skuLabelOf(sku.code)
        return {
          value: sku.code,
          primary: label.primary,
          secondary: label.secondary,
          uom: label.uom,
          search: `${label.primary} ${label.secondary} ${sku.code}`.toLowerCase()
        }
      })
      .sort((a, b) => a.primary.localeCompare(b.primary) || a.secondary.localeCompare(b.secondary))
  })

  /** The candidate list narrowed by the expansion's own search box. */
  const skuCandidatesFor = (filter = '') => {
    const term = text(filter).toLowerCase()
    const all = skuCandidates.value
    if (!term) return all
    return all.filter((sku) => sku.search.includes(term))
  }

  const outletOptions = computed(() => index.outlets.value
    .map((outlet) => ({
      value: text(outlet.Code),
      label: text(outlet.Name) || text(outlet.Code)
    }))
    .sort((a, b) => a.label.localeCompare(b.label)))

  const priceListOptions = computed(() => (activePriceLists.value || [])
    .map((list) => ({ value: list.code, label: list.name || list.code })))

  // THE invoice: one call, one engine, shared by the review step and the live batch.
  const invoice = computed(() => calculateConsumptionInvoice({
    lines: groupedLines.value,
    priceListCode: priceListCode.value,
    discountType: discountType.value,
    discountValue: discountValue.value,
    returnDeduction: returnDeduction.value,
    resolvePrice,
    // Without this the engine bills every line untaxed. Same resolver as the lines, so an
    // overridden price is taxed at what is charged.
    calculateLineTax: makeLineTaxResolver({ priceListCode: priceListCode.value, resolvePrice })
  }))

  // `OutletConsumptionItems` must be here: the whole bill comes from those rows and nothing
  // else on this route fetches them. The rest are read for names and prices.
  const sources = [
    'OutletConsumptions',
    'OutletConsumptionItems',
    'OutletReturns',
    'OutletOperatingRules',
    'Outlets',
    'SKUs',
    'Products',
    'PriceList'
  ].map((name) => useRecord(name))

  // `reload()` renders from the store at once and syncs in the background.
  const loadSources = () => Promise.all(sources.map((resource) => resource.reload()))

  const initNode = () => {
    pageState?.initResource(NODE, {
      reset: true,
      isPrimaryKey: true,
      fields: {
        Date: new Date().toISOString().slice(0, 10),
        Progress: 'PENDING_PAYMENT',
        Status: 'Active'
      }
    })

    // Through the setter, so the price list and due date resolve as a hand pick would.
    const seeded = text(route.query.outletCode)
    if (seeded && !text(field('OutletCode'))) outletCode.value = seeded
  }

  const { user } = useAuth()
  const actorName = () => text(user.value?.name || user.value?.email)

  // How many consumption-mark nodes the last pass raised. `applyNodes` only ever adds, so
  // the tail has to be taken down by name before the next pass puts it back up.
  let raisedMarks = 0

  function clearDependentNodes () {
    for (let i = 0; i < raisedMarks; i++) {
      pageState?.removeNode('OutletConsumptions', `invoiceGenerated${i}`)
    }
    raisedMarks = 0
    pageState?.removeNode('TaxTransactions')
    pageState?.removeNode('OutletReturns')
  }

  // The live batch: header and dependent tail only. `withItems: false` keeps this pass off
  // the lines the user typed (UI_PAGE_STATE.md §5B.3 - watch the input, never the output).
  function rebuild () {
    clearDependentNodes()
    const outlet = text(outletCode.value)
    const lines = groupedLines.value.map((line) => ({ SKU: line.SKU, Qty: line.Qty }))
    if (!outlet || !lines.length) {
      // Nothing to invoice. The page's own node stays - it holds the answers and gates the
      // sticky bar - but there is nothing for Layer 2 to refuse either.
      setField('BuildError', '')
      return
    }
    const listCode = text(priceListCode.value)
    const today = new Date().toISOString().slice(0, 10)
    const applied = pageState.applyNodes(buildInvoiceGenerationNodes({
      outletCode: outlet,
      username: actorName(),
      actorName: actorName(),
      date: today,
      dueDate: text(dueDate.value) || today,
      priceListCode: listCode,
      lines,
      consumptionCodes: selectedCodes.value,
      // The RAW sheet rows, not the display shapes: Layer 2 reads `Code`, `Qty` and `Price`,
      // and a card's lowercase `code` would drop every credit on the floor.
      returnRows: selectedReturns.value.map((row) => row.raw),
      discountType: text(discountType.value) || 'FLAT',
      discountValue: num(discountValue.value),
      comment: text(comment.value),
      withItems: false,
      resolvePrice,
      // The SAME resolver the review step displays, so the tax the user agreed to and the
      // tax the sheet stores are one calculation, not two that happen to agree.
      calculateLineTax: makeLineTaxResolver({ priceListCode: listCode, resolvePrice })
    }))

    // Why Layer 2 refused, in its own words, so the sticky bar can veto submit with it
    // instead of inventing a second rule.
    setField('BuildError', applied.valid === false ? text(applied.message) : '')
    if (applied.valid !== false) raisedMarks = selectedCodes.value.length
  }

  // Ticking a consumption re-seeds the lines it contributes; everything else only re-cuts
  // the header and the tail. `repriceInvoiceInPageState` fills each line's figures in place.
  pageState?.derive([
    { key: 'invoiceAdd:ticks', on: { resource: NODE, field: 'OutletConsumptionCode' }, handler: () => { seedLinesFromConsumptions(); rebuild() } },
    { key: 'invoiceAdd:lines', on: { resource: NODE, children: ITEMS }, handler: () => { repriceInvoiceInPageState(pageState); rebuild() } },
    { key: 'invoiceAdd:returns', on: { resource: NODE, field: 'OutletReturnCodes' }, handler: rebuild },
    { key: 'invoiceAdd:applyReturns', on: { resource: NODE, control: 'ApplyReturns' }, handler: rebuild },
    { key: 'invoiceAdd:discountType', on: { resource: NODE, control: 'DiscountType' }, handler: () => { repriceInvoiceInPageState(pageState); rebuild() } },
    { key: 'invoiceAdd:discountValue', on: { resource: NODE, control: 'DiscountValue' }, handler: () => { repriceInvoiceInPageState(pageState); rebuild() } },
    { key: 'invoiceAdd:terms', on: { resource: NODE, field: 'PriceListCode' }, handler: () => { repriceInvoiceInPageState(pageState); rebuild() } },
    { key: 'invoiceAdd:dueDate', on: { resource: NODE, field: 'DueDate' }, handler: rebuild, immediate: false }
  ])

  return {
    pageState,
    initNode,
    loadSources,
    ui,
    money: (value) => _C(num(value), true),
    allowed: (permissions) => resourceConfig?.allowed?.(permissions) === true,

    outletCode,
    priceListCode,
    dueDate,
    discountType,
    discountValue,
    comment,
    selectedCodes,
    setLinePrice,
    skuLabelOf,
    skuCandidates,
    skuCandidatesFor,
    outletOptions,
    priceListOptions,
    resolvePrice,
    addExtraItem,
    removeLine,

    outlets: index.outlets,
    priceLists: activePriceLists,
    availableConsumptions,
    groupedLines,
    creditableReturns,
    applyReturns,
    selectedReturnCodes,
    selectedReturns,
    returnDeduction,
    invoice,

    step: computed(() => pageState?.meta?.currentStep || 1)
  }
}

