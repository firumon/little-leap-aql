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

/**
 * OutletConsumptionInvoices › Add — the injection relay and shared wizard state
 * (UI_RESOURCE_DOMAIN_LOGIC.md §6.1).
 *
 * ONE `inject()` for the three step cards, and ONE place the wizard's answers live.
 *
 * ── WHY THE ANSWERS ARE CONTROL FIELDS ──
 * An invoice is not assembled the way an ordinary create form is. Its line items are not
 * typed by the user — they are DERIVED from whichever consumptions were ticked, priced by
 * the shared engine, and recomputed whenever the outlet, the price list, the discount or an
 * added SKU changes. So there is no `pageState` child collection to bind to; there is a set
 * of wizard answers, held as control fields, from which the whole invoice is a `computed()`.
 *
 * That is also what makes the review step honest: the figures it shows come from ONE call to
 * `calculateConsumptionInvoice`, and `PageAction.js` submits from the same inputs through the
 * same engine. The number the user agreed to and the number the sheet stores are the same
 * number by construction, not by two implementations agreeing.
 *
 * PLACEMENT — `Add/`, the page tier (§6.2): only this page provides the context it injects.
 */

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

  /**
   * The outlet.
   *
   * Reads the CONTROL FIELD only — never the route query as a fallback.
   *
   * It used to fall back to `route.query.outletCode`, which made the wizard DISPLAY an outlet
   * that `PageAction.js` could not see: the action reads control fields, so it found a blank
   * `OutletCode` and vetoed every attempt to advance with "Select an outlet to continue."
   * against a form that plainly showed one. The query is now SEEDED into the field once, in
   * `initNode`, so the screen and the submit path read the same single source of truth
   * (CORE_ARCHITECTURE_RULES §6).
   */
  const outletCode = computed({
    get: () => text(field('OutletCode')),
    set: (value) => {
      setField('OutletCode', text(value))
      // Switching outlet invalidates every downstream answer: a different outlet has
      // different consumptions, may bill on a different price list, and certainly has
      // different returns. Clearing them here is what stops the review step showing a
      // total assembled from two outlets.
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

  /**
   * The billable lines: every ticked consumption's items GROUPED BY SKU, plus the extras.
   *
   * Grouping matters because one outlet may have been counted three times in a month and the
   * same SKU appears on each — billing it as three lines would be correct arithmetic and an
   * unreadable invoice. Each grouped line keeps the sources it came from so the step-2 card
   * can show which counts contributed.
   */
  const lineRows = () => pageState?.getChildRows(ITEMS, NODE) || []

  const clearLines = () => {
    for (let i = lineRows().length - 1; i >= 0; i--) pageState?.removeChild(ITEMS, i, NODE)
  }

  const lineIndexOf = (sku) => lineRows().findIndex((row) => text(row.SKU) === text(sku))

  /**
   * Re-seed the lines that came from ticked consumptions, keeping hand-added ones.
   *
   * `_sources` says where a line's quantity came from. It is frontend-only (`_` prefix), so
   * `build()` strips it before the row reaches the sheet.
   */
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

  /**
   * The outlet's unadjusted returns — everything this invoice COULD credit.
   *
   * WHICH returns qualify is a domain rule (adjustment required, not yet done, not
   * cancelled) decided in `useInvoiceIndex`; this only narrows the qualifying set to the
   * chosen outlet. Deciding it here would put the rule in two places.
   */
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

  /**
   * Whether return credits are applied to this invoice at all.
   *
   * OPT-IN, and deliberately so. Crediting every outstanding return automatically was wrong:
   * whether a credit belongs on THIS invoice is a commercial decision — it may be settled
   * separately, held pending a warehouse inspection, or deliberately carried to a later bill
   * — and a flow that applies it silently gives the user no way to say no. The invoice is
   * also the point at which the return is marked adjusted, so an automatic credit closes a
   * return the user never agreed to close.
   */
  const applyReturns = computed({
    get: () => field('ApplyReturns', false) === true,
    set: (value) => {
      const on = value === true
      setField('ApplyReturns', on)
      // Turning it ON selects everything, which is the common case and keeps the toggle
      // useful on its own. Turning it OFF clears the selection so a later re-tick does not
      // silently restore a set the user had narrowed and then abandoned.
      selectedReturnCodes.value = on ? creditableReturns.value.map((row) => row.code) : []
    }
  })

  /** Which of the available returns this invoice credits. */
  const selectedReturnCodes = computed({
    get: () => csv(field('OutletReturnCodes')),
    set: (value) => setField('OutletReturnCodes', (Array.isArray(value) ? value : []).map(text).filter(Boolean).join(','))
  })

  /**
   * The returns actually being credited — the selection, intersected with what is still
   * available. The intersection matters because switching outlet leaves the old codes behind
   * for one tick, and crediting another outlet's return would be a real accounting error.
   */
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

  /**
   * Drop a line from the bill.
   *
   * A hand-added SKU is removed outright. A line that came from a ticked consumption cannot
   * be removed this way - its quantity is what was actually counted. Untick the consumption.
   */
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

  /**
   * The price resolver handed to the engine: an override if the user typed one, otherwise
   * the price list's own answer.
   *
   * Passing a RESOLVER rather than pre-priced lines is what keeps the override inside the one
   * calculation — tax, discount apportionment and the net payable all recompute off it,
   * instead of the UI patching a total the engine never saw.
   */
  const resolvePrice = (sku, listCode) => {
    const at = lineIndexOf(sku)
    const typed = at >= 0 ? lineRows()[at].Price : undefined
    if (typed !== undefined && typed !== null && typed !== '') return num(typed)
    return priceOf(sku, listCode)
  }

  /**
   * SKUs available to add by hand, MINUS everything already on the bill.
   *
   * Filtering out the taken ones is what makes the add-list safe to tap through: a SKU that
   * is already a line would only be merged back into that line by the grouping above, so
   * offering it promises something the flow cannot deliver.
   *
   * Names come from the SKUs domain (`skuLabelOf`), never from the code — see that function.
   * A search term matches the product name, the variant OR the code, because a user reaching
   * for a specific variant and a user who only remembers the code are both common.
   */
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

  /**
   * THE invoice, as the review step shows it and as `PageAction.js` submits it.
   *
   * One call, one engine — see the file header.
   */
  const invoice = computed(() => calculateConsumptionInvoice({
    lines: groupedLines.value,
    priceListCode: priceListCode.value,
    discountType: discountType.value,
    discountValue: discountValue.value,
    returnDeduction: returnDeduction.value,
    resolvePrice,
    // WITHOUT THIS EVERY LINE IS BILLED UNTAXED. The engine treats a missing tax calculator
    // as "bill it untaxed" by design, so omitting it showed `Tax Amount 0.00` on an invoice
    // whose SKUs were taxable. Built with the same `resolvePrice` the lines use, so an
    // overridden unit price is taxed at the price actually being charged.
    calculateLineTax: makeLineTaxResolver({ priceListCode: priceListCode.value, resolvePrice })
  }))

  /**
   * Create the page's `pageState` node and seed the header fields the wizard does not ask
   * for. Called once, from step 1's `onMounted`.
   *
   * `reset: true` clears any node left behind by a previously-visited resource page, so a
   * generator opened straight after another form does not inherit its half-filled state.
   */
  /**
   * Every resource this wizard reads, as a `useRecord` handle.
   *
   * `OutletConsumptionItems` is the one that MUST be here: the whole bill is derived from the
   * ticked consumptions' item rows, and nothing else on this page's route fetches them — the
   * invoices resource pulls its own children, not another resource's. Without this the
   * wizard renders "0 items · 0 qty" against a consumption that has plenty, and step 2 offers
   * nothing to bill.
   *
   * The rest are read for names and prices and are usually already warm; asking for them
   * costs a delta sync, not a full fetch.
   */
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

  /**
   * Pull everything the wizard reads.
   *
   * `reload()` renders from whatever the store already holds and runs the sync as a silent
   * background delta, so a warm cache shows the form immediately rather than blocking on a
   * round trip — the same contract the restock wizard's step 1 uses.
   */
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

    // The outlet the page was opened for, written INTO the wizard's own state rather than
    // read from the query on every access. Going through the setter is what also resolves
    // this outlet's price list and due date, exactly as picking it by hand would.
    const seeded = text(route.query.outletCode)
    if (seeded && !text(field('OutletCode'))) outletCode.value = seeded
  }

  const { user } = useAuth()
  const actorName = () => text(user.value?.name || user.value?.email)

  /**
   * THE LIVE BATCH - the header and the dependent tail only.
   *
   * The LINES are not rebuilt here. They live in `children`, which is where the user put
   * them, and `withItems: false` is what stops this pass splicing the same rows back on top
   * of them - a write the children watcher below would answer with another rebuild, for ever
   * (UI_PAGE_STATE.md §5B.3 - watch the input, never the output).
   */
  function rebuild () {
    const outlet = text(outletCode.value)
    const lines = groupedLines.value.map((line) => ({ SKU: line.SKU, Qty: line.Qty }))
    if (!outlet || !lines.length) {
      // Nothing to invoice, so the dependants the last pass raised have to go. The page's
      // own node stays — it holds the answers and gates the sticky bar.
      for (let i = 0; i < selectedCodes.value.length; i++) {
        pageState?.removeNode('OutletConsumptions', `invoiceGenerated${i}`)
      }
      pageState?.removeNode('TaxTransactions')
      pageState?.removeNode('OutletReturns')
      return
    }
    const listCode = text(priceListCode.value)
    const today = new Date().toISOString().slice(0, 10)
    pageState.applyNodes(buildInvoiceGenerationNodes({
      outletCode: outlet,
      username: actorName(),
      actorName: actorName(),
      date: today,
      dueDate: text(dueDate.value) || today,
      priceListCode: listCode,
      lines,
      consumptionCodes: selectedCodes.value,
      returnRows: selectedReturns.value,
      discountType: text(discountType.value) || 'FLAT',
      discountValue: num(discountValue.value),
      comment: text(comment.value),
      withItems: false,
      resolvePrice,
      // The SAME resolver the review step displays, so the tax the user agreed to and the
      // tax the sheet stores are one calculation, not two that happen to agree.
      calculateLineTax: makeLineTaxResolver({ priceListCode: listCode, resolvePrice })
    }))
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

