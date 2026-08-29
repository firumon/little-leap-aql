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
    const value = pageState?.getControls(header, null, NODE)
    return value === undefined || value === null ? fallback : value
  }
  const setField = (header, value) => pageState?.setControls(header, value, NODE)

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
      setField('ConsumptionCodes', [])
      setField('ExtraItems', [])
      // A different outlet has different returns; carrying the old selection over would
      // credit one outlet's returns against another's bill.
      setField('ApplyReturns', false)
      setField('ReturnCodes', [])
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

  const comment = computed({
    get: () => text(field('Comment')),
    set: (value) => setField('Comment', text(value))
  })

  /** The consumption codes ticked in step 1. */
  const selectedCodes = computed({
    get: () => {
      const value = field('ConsumptionCodes', [])
      return Array.isArray(value) ? value : []
    },
    set: (value) => setField('ConsumptionCodes', Array.isArray(value) ? value : [])
  })

  /** Extra SKUs added by hand in step 2, as `[{ SKU, Qty }]`. */
  const extraItems = computed({
    get: () => {
      const value = field('ExtraItems', [])
      return Array.isArray(value) ? value : []
    },
    set: (value) => setField('ExtraItems', Array.isArray(value) ? value : [])
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
  const groupedLines = computed(() => {
    const chosen = new Set(selectedCodes.value)
    const bySku = new Map()

    availableConsumptions.value.forEach((consumption) => {
      if (!chosen.has(consumption.code)) return
      consumption.items.forEach((item) => {
        const sku = text(item.SKU)
        if (!sku) return
        const qty = num(item.Qty)
        const entry = bySku.get(sku) || { SKU: sku, Qty: 0, sources: [] }
        entry.Qty += qty
        // Each source carries its OWN quantity, not just its origin: on a bundled invoice the
        // whole point of listing sources is to show how the line's total was made up, and
        // "2026-08-16 · Firose" without a number says where some unknown share came from.
        entry.sources.push({
          key: `${consumption.code}-${sku}`,
          qty,
          label: `${qty} from ${consumption.date} (${consumption.username || '—'})`
        })
        bySku.set(sku, entry)
      })
    })

    extraItems.value.forEach((extra) => {
      const sku = text(extra.SKU)
      if (!sku) return
      const qty = num(extra.Qty)
      const entry = bySku.get(sku) || { SKU: sku, Qty: 0, sources: [] }
      entry.Qty += qty
      entry.sources.push({ key: `manual-${sku}`, qty, label: `${qty} added manually` })
      bySku.set(sku, entry)
    })

    return [...bySku.values()]
      .filter((entry) => entry.Qty > 0)
      .map((entry) => {
        const label = skuLabelOf(entry.SKU)
        return { ...entry, primary: label.primary, secondary: label.secondary, uom: label.uom }
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
      setField('ReturnCodes', on ? creditableReturns.value.map((row) => row.code) : [])
    }
  })

  /** Which of the available returns this invoice credits. */
  const selectedReturnCodes = computed({
    get: () => {
      const value = field('ReturnCodes', [])
      return Array.isArray(value) ? value : []
    },
    set: (value) => setField('ReturnCodes', Array.isArray(value) ? [...value] : [])
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

  /**
   * Per-SKU price overrides typed on step 2, as `{ [SKU]: price }`.
   *
   * Held separately from the lines because a line is DERIVED (from ticks and extras) and is
   * rebuilt whenever those change — an override written onto a line would be lost the moment
   * a consumption was re-ticked. Keyed by SKU, it survives.
   */
  const priceOverrides = computed({
    get: () => {
      const value = field('PriceOverrides', {})
      return value && typeof value === 'object' ? value : {}
    },
    set: (value) => setField('PriceOverrides', value && typeof value === 'object' ? value : {})
  })

  /** Add a SKU to the bill by hand, or top up the quantity if it is already an extra. */
  const addExtraItem = (sku, qty = 1) => {
    const code = text(sku)
    const quantity = num(qty)
    if (!code || quantity <= 0) return
    const existing = extraItems.value.find((row) => text(row.SKU) === code)
    extraItems.value = existing
      ? extraItems.value.map((row) => (text(row.SKU) === code ? { ...row, Qty: num(row.Qty) + quantity } : row))
      : [...extraItems.value, { SKU: code, Qty: quantity }]
  }

  /**
   * Drop a line from the bill.
   *
   * A manually added SKU is removed outright. A line that came from a ticked consumption
   * cannot be removed this way — its quantity is what was actually counted, and deleting it
   * would bill the outlet for less than it consumed without any record of the decision.
   * Untick the consumption in step 1 instead.
   */
  const removeLine = (sku) => {
    const code = text(sku)
    extraItems.value = extraItems.value.filter((row) => text(row.SKU) !== code)
  }

  const setLinePrice = (sku, value) => {
    const key = text(sku)
    if (!key) return
    priceOverrides.value = { ...priceOverrides.value, [key]: num(value) }
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
    const override = priceOverrides.value[text(sku)]
    if (override !== undefined && override !== null && override !== '') return num(override)
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
    extraItems,
    priceOverrides,
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

