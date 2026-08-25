import { computed } from 'vue'
import { useConsumptionAddContext } from './useConsumptionAddContext'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { useOutletResource } from 'src/_resource/Master/Outlets/composables/useOutletResource'
import { useOutletStorageResource } from 'src/_resource/Operation/OutletStorages/composables/useOutletStorageResource'
import { useWarehouseStorageResource } from 'src/_resource/Operation/WarehouseStorages/composables/useWarehouseStorageResource'
import {
  toNumber,
  buildCountRow,
  buildManualReturnRow,
  recountRow,
  soldRowsOf,
  returnRowsOf,
  defaultReturnMeta,
  defaultRestockQty,
  priceListForOutlet,
  priceOf,
  splitByWarehouseStock
} from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionStock'
import {
  calculateConsumptionInvoice,
  makeLineTaxResolver
} from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionInvoice'
import {
  progressOf,
  isActiveRow,
  visitFrequencyFor,
  PENDING_INVOICE_GENERATION
} from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionProgress'
import { useConsumptionIndex } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionIndex'

/**
 * OutletConsumptions › Add — the wizard's working surface.
 *
 * PRESENTATION ONLY (UI_RESOURCE_DOMAIN_LOGIC.md §4). Every quantity, price, split and
 * predicate below is READ from Layer 2; this file decides only what each step shows and
 * where the user's answers are stored.
 *
 * SINGLE SOURCE OF TRUTH (§13.6). Everything the user builds lives in `pageState` control
 * fields on the consumption node — never in a parallel local `ref` or a mirrored map. That
 * is what lets `Add/PageAction.js`, which runs outside any component setup, read the
 * finished decision back and assemble the batch from exactly what the cards displayed.
 *
 * Control fields, not record fields, for all of it: none of these columns exists on
 * `OutletConsumptions`, and a control field is deliberately excluded from the payload
 * (§13.5). The real headers — `OutletCode`, `Date`, `Username`, `OutletVisitCode` — go
 * through `setField` and ride the normal composite save.
 */

const NODE = 'OutletConsumptions'

// Working state, all control fields.
const F = {
  COUNT_ROWS: 'CountRows',
  RETURN_META: 'ReturnMeta',
  RESTOCK_ROWS: 'RestockRows',
  ENABLE_RESTOCK: 'EnableRestock',
  ADJUSTED_RETURNS: 'AdjustedReturnCodes',
  DIRECT_RESTOCK: 'DirectRestock',
  WAREHOUSE: 'RestockWarehouseCode',
  MARK_DELIVERED: 'MarkDelivered',
  GENERATE_INVOICE: 'GenerateInvoice',
  PRICE_LIST: 'PriceListCode',
  PRICE_OVERRIDES: 'PriceOverrides',
  DISCOUNT_TYPE: 'DiscountType',
  DISCOUNT_VALUE: 'DiscountValue',
  INVOICE_COMMENT: 'InvoiceComment',
  COMPLETE_VISIT: 'CompleteVisit',
  SCHEDULE_NEXT: 'ScheduleNextVisit',
  NEXT_VISIT_DAYS: 'NextVisitDays',
  SEEDED_FOR: 'SeededForOutlet'
}

export { F as WIZARD_FIELDS, NODE as WIZARD_NODE }

/** How many one-tap outlet chips step 1 offers before the select is the faster route. */
const SUGGESTED_OUTLET_LIMIT = 8

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})

export function useConsumptionWizard () {
  const { pageState, ui, user, query, resource, hasRegionAccess } = useConsumptionAddContext()
  const node = pageState.useNode(NODE)

  // Rows are read through the relay's accessor, so no store is imported here (§5).
  const outlets = resource('Outlets')
  const visits = resource('OutletVisits')
  const storages = resource('OutletStorages')
  const warehouses = resource('Warehouses')
  const warehouseStorages = resource('WarehouseStorages')
  const skus = resource('SKUs')
  const products = resource('Products')
  const returns = resource('OutletReturns')
  const operatingRules = resource('OutletOperatingRules')
  // Opened for the INVOICE, not for anything this file displays. `calculateLineTax` reads
  // the tax rows straight out of the data store, and an unloaded `Taxes` resource makes it
  // find no components and return zero tax — silently. The review step then showed a
  // tax-free total for lines that were about to be invoiced WITH tax, because the submit
  // ran later, by which time some other page had usually loaded them.
  const taxes = resource('Taxes')
  const { getSku } = useSkuResource()
  const { getOutlet } = useOutletResource()
  // The stock index (outlet × SKU, built once for the whole app) — the wizard seeds and
  // validates against it instead of rescanning `OutletStorages` per outlet.
  const { stockRowsOf } = useOutletStorageResource()
  // The warehouse side of the same story — one index for the whole app, read by the
  // coverage split and by the per-line availability figure below.
  const { index: warehouseStockIndex, stockOf: warehouseStockOf } = useWarehouseStorageResource()
  const index = useConsumptionIndex()

  // ── Control-field accessors ────────────────────────────────────────────────
  const get = (field, fallback = null) => {
    const value = pageState.getControlField(NODE, field)
    return value === undefined || value === null ? fallback : value
  }
  const set = (field, value) => pageState.setControlField(NODE, field, value)

  const outletCode = computed(() => text(node.record.value.OutletCode))
  const visitCode = computed(() => text(node.record.value.OutletVisitCode))

  // ── SKU labelling ──────────────────────────────────────────────────────────
  /**
   * Projected from the ENRICHED SKU rather than re-joining SKUs × Products here — the
   * variant-name join and its five-column cap already live in `_resource/Master/SKUs`
   * (CORE_ARCHITECTURE_RULES §6 — Enrich Once, Then Project).
   */
  function skuLabel (sku) {
    const code = text(sku)
    const info = asRow(getSku(code))
    const variants = (info.variantValues || []).filter(Boolean).join(' / ')
    return { primary: text(info.productName) || code, secondary: variants || code, uom: text(info.uom) || 'PCS' }
  }

  const skuOptions = computed(() => skus.items.value
    .map(asRow)
    .filter(isActiveRow)
    .map((row) => {
      const label = skuLabel(row.Code)
      return { value: text(row.Code), label: `${label.primary} · ${label.secondary}` }
    }))

  const outletOptions = computed(() => outlets.items.value
    .map(asRow)
    .filter(isActiveRow)
    .map((row) => ({ value: text(row.Code), label: text(row.Name) || text(row.Code) })))

  /** Planned visits for the selected outlet — today's and overdue, soonest first. */
  const visitOptions = computed(() => visits.items.value
    .map(asRow)
    .filter((row) => isActiveRow(row) && progressOf(row) === 'PLANNED' && text(row.OutletCode) === outletCode.value)
    .sort((a, b) => (text(a.Date) < text(b.Date) ? -1 : 1))
    .map((row) => ({ value: text(row.Code), label: `${text(row.Date)} · planned visit` })))

  /**
   * The same planned visits, as CARDS rather than dropdown options.
   *
   * Step 1 renders them as selectable cards instead of a select: on a phone, picking the
   * visit is the second-most important decision on the screen and a collapsed dropdown
   * hides both how many are due and how late they are. The card carries the date and its
   * lateness, which is what the officer actually chooses on.
   */
  const plannedVisitCards = computed(() => {
    const today = new Date().toISOString().slice(0, 10)
    return visits.items.value
      .map(asRow)
      .filter((row) => isActiveRow(row) && progressOf(row) === 'PLANNED' && text(row.OutletCode) === outletCode.value)
      .sort((a, b) => (text(a.Date) < text(b.Date) ? -1 : 1))
      .map((row) => {
        const date = text(row.Date)
        return {
          code: text(row.Code),
          date,
          isToday: date === today,
          isOverdue: !!date && date < today
        }
      })
  })

  /**
   * Outlets the officer is most likely to be standing in — one tap instead of a search.
   *
   * Built from the PLANNED visit queue: an outlet with a visit due today or overdue is
   * where the round actually is, and the select above stays for everything else. Soonest
   * first, deduped by outlet, and capped — a chip row long enough to need scrolling is
   * slower than typing.
   *
   * Indexed in ONE pass rather than a `.find()` per visit (CORE_ARCHITECTURE_RULES §6).
   */
  const suggestedOutlets = computed(() => {
    const today = new Date().toISOString().slice(0, 10)
    const byCode = new Map(outlets.items.value
      .map(asRow)
      .filter(isActiveRow)
      .map((row) => [text(row.Code), row]))

    const seen = new Set()
    return visits.items.value
      .map(asRow)
      .filter((row) => isActiveRow(row) && progressOf(row) === 'PLANNED')
      .sort((a, b) => (text(a.Date) < text(b.Date) ? -1 : 1))
      .reduce((list, row) => {
        const code = text(row.OutletCode)
        const outlet = byCode.get(code)
        if (!code || !outlet || seen.has(code)) return list
        seen.add(code)
        const date = text(row.Date)
        list.push({
          code,
          visitCode: text(row.Code),
          label: text(outlet.Name) || code,
          date,
          isToday: date === today,
          isOverdue: !!date && date < today
        })
        return list
      }, [])
      .slice(0, SUGGESTED_OUTLET_LIMIT)
  })

  /**
   * Warehouses in the user's own access region.
   *
   * `hasRegionAccess` rather than a flat equality test, because it also honours
   * universe-scoped users and rolled-up child regions — a flat comparison silently
   * excluded both from direct restock.
   */
  const regionWarehouses = computed(() => warehouses.items.value
    .map(asRow)
    .filter(isActiveRow)
    .filter((row) => hasRegionAccess(row.AccessRegion))
    .map((row) => ({ value: text(row.Code), label: text(row.Name) || text(row.Code) })))

  // ── Step 2: the physical count ─────────────────────────────────────────────

  const countRows = computed(() => get(F.COUNT_ROWS, []) || [])

  /**
   * Seed the count from the outlet's recorded stock — once per outlet.
   *
   * Keyed on `SeededForOutlet` rather than a local closure flag, for the same reason the
   * Edit pages key on `EditHydratedFor` (§13.5): several cards call this composable, and a
   * closure variable would let the second caller wipe the counts the first one collected.
   * Re-seeding only happens when the user genuinely changes outlet, which is the one case
   * where the previous counts are meaningless.
   */
  function seedCountRows (force = false) {
    const code = outletCode.value
    if (!code) return
    if (!force && text(get(F.SEEDED_FOR)) === code) return

    // O(1) into the OutletStorages index rather than a scan of the whole storage sheet:
    // `stockRowsOf` returns exactly this outlet's active, non-zero balances, already
    // grouped by the resource that owns them.
    const rows = stockRowsOf(code)
      .filter((row) => toNumber(row.Quantity) > 0)
      .map((row) => buildCountRow(row))

    set(F.SEEDED_FOR, code)
    set(F.COUNT_ROWS, rows)
    set(F.RETURN_META, {})
    // Restocks mirror sales, and there are none yet.
    set(F.RESTOCK_ROWS, [])
    set(F.ADJUSTED_RETURNS, [])
    set(F.PRICE_LIST, text(priceListForOutlet(code)?.code))
  }

  function setCurrentQty (rowIndex, value) {
    const rows = countRows.value.slice()
    if (!rows[rowIndex]) return
    rows[rowIndex] = recountRow(rows[rowIndex], value)
    set(F.COUNT_ROWS, rows)
    syncRestockFromSales()
  }

  const stepCurrentQty = (rowIndex, delta) => {
    const row = countRows.value[rowIndex]
    if (!row) return
    setCurrentQty(rowIndex, toNumber(row.CurrentQty) + delta)
  }

  function addManualReturn (sku, qty = 1) {
    const code = text(sku)
    if (!code) return
    const rows = countRows.value.slice()
    // A SKU already on the count is adjusted rather than duplicated — two rows for one SKU
    // would each claim their own sold/return figure and `validateConsumption` would reject
    // the whole submission for a duplicate.
    const existing = rows.findIndex((row) => text(row.SKU) === code)
    if (existing >= 0) {
      rows[existing] = recountRow(rows[existing], toNumber(rows[existing].CurrentQty) + toNumber(qty))
    } else {
      rows.push(buildManualReturnRow(code, qty))
    }
    set(F.COUNT_ROWS, rows)
  }

  function removeManualReturn (rowIndex) {
    const rows = countRows.value.slice()
    if (!rows[rowIndex]?.isManualReturn) return
    rows.splice(rowIndex, 1)
    set(F.COUNT_ROWS, rows)
  }

  const soldRows = computed(() => soldRowsOf(countRows.value))
  const returnRows = computed(() => returnRowsOf(countRows.value))
  const hasCountRows = computed(() => countRows.value.length > 0)

  // ── Return routing metadata ────────────────────────────────────────────────

  const returnMeta = computed(() => get(F.RETURN_META, {}) || {})
  const metaFor = (sku) => ({ ...defaultReturnMeta(), ...asRow(returnMeta.value[text(sku)]) })
  function setReturnMeta (sku, patch) {
    set(F.RETURN_META, { ...returnMeta.value, [text(sku)]: { ...metaFor(sku), ...asRow(patch) } })
  }

  // ── Step 3: invoice ────────────────────────────────────────────────────────

  const generateInvoice = computed(() => get(F.GENERATE_INVOICE, true) === true)
  const priceListCode = computed(() => text(get(F.PRICE_LIST)) || text(priceListForOutlet(outletCode.value)?.code))
  const discountType = computed(() => text(get(F.DISCOUNT_TYPE)) || 'FLAT')
  const discountValue = computed(() => toNumber(get(F.DISCOUNT_VALUE, 0)))

  /**
   * Unit prices the officer typed over the price list's answer.
   *
   * The list is the DEFAULT, not the law: a negotiated one-off or a stale list both need
   * overriding at the moment of billing. Held as a control field like every other wizard
   * answer, so `Add/PageAction.js` — which runs outside setup — reads back exactly what the
   * review step displayed.
   */
  const priceOverrides = computed(() => asRow(get(F.PRICE_OVERRIDES, {})))

  function setLinePrice (sku, value) {
    const key = text(sku)
    if (!key) return
    set(F.PRICE_OVERRIDES, { ...priceOverrides.value, [key]: toNumber(value) })
  }

  /**
   * The resolver the engine prices through: an override if one was typed, otherwise the
   * price list's own answer.
   *
   * A RESOLVER rather than pre-priced lines, so the override stays inside the ONE
   * calculation — line tax, discount apportionment and the net payable all move with it.
   */
  const resolvePrice = (sku, listCode) => {
    const override = priceOverrides.value[text(sku)]
    return override === undefined || override === null || override === '' ? priceOf(sku, listCode) : toNumber(override)
  }

  // Built from the SAME resolvePrice the lines use, so an edited price moves the tax too.
  const lineTaxResolver = computed(() => makeLineTaxResolver({
    priceListCode: priceListCode.value,
    resolvePrice
  }))

  // Off DISCARDS the typed prices: they are invoice figures, and there is no invoice.
  function setGenerateInvoice (on) {
    const enabled = on === true
    set(F.GENERATE_INVOICE, enabled)
    if (!enabled) set(F.PRICE_OVERRIDES, {})
  }

  function resetLinePrice (sku) {
    const key = text(sku)
    if (!key || !(key in priceOverrides.value)) return
    const { [key]: dropped, ...rest } = priceOverrides.value
    set(F.PRICE_OVERRIDES, rest)
  }

  /**
   * THE invoice, calculated exactly as the submit will calculate it.
   *
   * One call to the Layer 2 engine, and every figure the review step displays is read off
   * its result — including the tax. The step previously summed `qty × price` and took a flat
   * discount off it, so the "Total" the user confirmed deliberately excluded the tax the
   * batch was about to charge; on a tax-exclusive list that is the entire tax amount, and on
   * a PRE_TAX list the discount was applied to a base the invoice never used.
   *
   * `returnDeduction` is declared further down with step 5. The forward reference is safe
   * because a `computed` getter does not run during setup — by the time anything reads this,
   * every binding in this composable exists. Including it here is what makes the running
   * total on step 3 keep up with returns ticked on step 5 and then reviewed by going Back.
   */
  const invoiceCalculation = computed(() => calculateConsumptionInvoice({
    lines: soldRows.value,
    priceListCode: priceListCode.value,
    discountType: discountType.value,
    discountValue: discountValue.value,
    returnDeduction: returnDeduction.value,
    resolvePrice,
    calculateLineTax: lineTaxResolver.value
  }))

  // The same engine without the discount or return credit — per-line prices for the
  // "Sold this visit" list, so the list and the bill cannot disagree on what a line costs.
  const visitCalculation = computed(() => calculateConsumptionInvoice({
    lines: soldRows.value,
    priceListCode: priceListCode.value,
    // No discount and no return credit: those belong to the INVOICE, not to a line, and
    // apportioning them across this subset would print a per-line figure the bill never uses.
    resolvePrice,
    calculateLineTax: lineTaxResolver.value
  }))

  /** The engine's lines, carrying the labels only the UI needs. */
  const invoiceLines = computed(() => visitCalculation.value.lines.map((line) => {
    const label = skuLabel(line.SKU)
    const listPrice = toNumber(priceOf(line.SKU, priceListCode.value))
    return {
      sku: line.SKU,
      name: label.primary,
      variant: label.secondary,
      qty: line.Qty,
      price: line.Price,
      listPrice,
      overridden: text(line.SKU) in priceOverrides.value,
      // A SKU with no price in this list is SURFACED rather than billed at zero — a silent
      // zero is how consignment stock gets given away.
      unpriced: line.Unpriced,
      total: line.Total,
      tax: line.TaxAmount
    }
  }))

  const invoiceHeader = computed(() => invoiceCalculation.value.header)
  const invoiceSubtotal = computed(() => invoiceHeader.value.Subtotal)
  const invoiceDiscount = computed(() => invoiceHeader.value.Discount)
  const invoiceTaxableAmount = computed(() => invoiceHeader.value.TotalTaxableAmount)
  const invoiceTax = computed(() => invoiceHeader.value.TotalTaxAmount)
  const invoiceReturnDeduction = computed(() => invoiceHeader.value.ReturnDeductionTotal)
  const invoiceTotal = computed(() => invoiceHeader.value.Total)
  const invoiceTaxBreakdown = computed(() => invoiceCalculation.value.taxBreakdown)
  const invoicePolicy = computed(() => invoiceCalculation.value.policy)

  // ── Step 4: restock ────────────────────────────────────────────────────────

  /**
   * Whether this visit leaves a restock behind at all.
   *
   * Defaults to TRUE: replenishment mirrors consumption, and the overwhelmingly common
   * case is that a visit which sold something also restocks it. Turning it off hides the
   * whole step's body — including the DIRECT/STANDARD choice, which is meaningless once
   * there is no restock to route.
   */
  const enableRestock = computed(() => get(F.ENABLE_RESTOCK, true) !== false)

  const restockRows = computed(() => get(F.RESTOCK_ROWS, []) || [])
  const directRestock = computed(() => get(F.DIRECT_RESTOCK, false) === true)
  const warehouseCode = computed(() => text(get(F.WAREHOUSE)))
  const markDelivered = computed(() => get(F.MARK_DELIVERED, false) === true)

  /**
   * Mirror the sold quantities into the restock lines — but only for SKUs the user has not
   * already adjusted by hand.
   *
   * Re-running the mirror wholesale on every keystroke would overwrite a quantity the user
   * deliberately changed, so an edited line is left alone and only new sales are added.
   */
  function syncRestockFromSales () {
    const existing = new Map(restockRows.value.map((row) => [text(row.SKU), row]))
    const rows = soldRows.value.map((row) => {
      const sku = text(row.SKU)
      const prior = existing.get(sku)
      return prior?._edited
        ? prior
        : { SKU: sku, Quantity: defaultRestockQty(row.SystemQty, row.CurrentQty), _edited: false }
    })
    // Only rows the user authored survive a SKU leaving the sales list. An untouched
    // mirror row must follow its sale back to zero, not stick at the old quantity.
    restockRows.value.forEach((row) => {
      if (!row._edited) return
      if (!rows.some((entry) => text(entry.SKU) === text(row.SKU))) rows.push(row)
    })
    set(F.RESTOCK_ROWS, rows.filter((row) => toNumber(row.Quantity) > 0 || row._edited))
  }

  function setRestockQty (rowIndex, value) {
    const rows = restockRows.value.slice()
    if (!rows[rowIndex]) return
    // `_edited` latches the user's intent so the sales mirror above stops overwriting it.
    rows[rowIndex] = { ...rows[rowIndex], Quantity: Math.max(0, toNumber(value)), _edited: true }
    set(F.RESTOCK_ROWS, rows)
  }

  function addRestockRow (sku, qty = 1) {
    const code = text(sku)
    if (!code) return
    const rows = restockRows.value.slice()
    const existing = rows.findIndex((row) => text(row.SKU) === code)
    if (existing >= 0) rows[existing] = { ...rows[existing], Quantity: toNumber(rows[existing].Quantity) + toNumber(qty), _edited: true }
    else rows.push({ SKU: code, Quantity: Math.max(1, toNumber(qty)), _edited: true })
    set(F.RESTOCK_ROWS, rows)
  }

  function removeRestockRow (rowIndex) {
    const rows = restockRows.value.slice()
    rows.splice(rowIndex, 1)
    set(F.RESTOCK_ROWS, rows)
  }

  /**
   * What the chosen warehouse can actually cover right now.
   *
   * Computed for DISPLAY here and again by the payload builder at submit time, from the
   * same Layer 2 `splitByWarehouseStock` — so the warning the user reads and the split the
   * batch writes cannot disagree.
   */
  const restockCoverage = computed(() => {
    if (!directRestock.value || !warehouseCode.value) return { allocated: [], pending: [], shortfall: 0 }
    return splitByWarehouseStock(restockRows.value, warehouseCode.value, warehouseStockIndex.value)
  })

  // Asked once per restock line, so it reads the shared warehouse × SKU index instead of
  // re-summing the storage sheet per line (§10.4 — no scan inside a loop).
  const availableAt = (sku) => warehouseStockOf(warehouseCode.value, sku)

  /**
   * SKUs not yet on the restock list — what the "Add other items" expansion offers.
   *
   * Computed as a DIFFERENCE rather than filtered at render time, so a SKU disappears from
   * the expansion the moment it is added to the list above: the two are one set split in
   * two, and an item visible in both would let the same SKU be added twice.
   *
   * Indexed once per recompute rather than scanned per candidate (CORE_ARCHITECTURE_RULES §6).
   */
  const restockCandidates = computed(() => {
    const taken = new Set(restockRows.value.map((row) => text(row.SKU)))
    return skuOptions.value.filter((option) => !taken.has(option.value))
  })

  /**
   * SKUs not yet counted — what the returns step's expansion offers.
   *
   * Excludes anything already on the count, whether it was seeded from outlet storage or
   * added by hand, for the same reason: a SKU already carrying a quantity is adjusted on
   * its own card, never re-added as a second line.
   */
  const returnCandidates = computed(() => {
    const taken = new Set(countRows.value.map((row) => text(row.SKU)))
    return skuOptions.value.filter((option) => !taken.has(option.value))
  })

  // ── Step 5: pending returns from earlier visits ────────────────────────────

  /**
   * Returns raised at this outlet that were meant to credit an invoice and never did.
   *
   * The step that offers these SKIPS ITSELF when this list is empty — asking "adjust any
   * pending returns?" and then showing nothing is a step that wastes a tap.
   */
  const pendingReturns = computed(() => returns.items.value
    .map(asRow)
    .filter((row) => isActiveRow(row) &&
      text(row.OutletCode) === outletCode.value &&
      text(row.InvoiceAdjustmentRequired) === 'TRUE' &&
      text(row.InvoiceAdjustmentDone) !== 'TRUE' &&
      progressOf(row) !== 'CANCELLED')
    .map((row) => {
      const label = skuLabel(row.SKU)
      return {
        code: text(row.Code),
        sku: text(row.SKU),
        name: label.primary,
        variant: label.secondary,
        qty: toNumber(row.Qty),
        price: toNumber(row.Price),
        value: toNumber(row.Qty) * toNumber(row.Price),
        reason: text(row.Reason),
        date: text(row.Date),
        _raw: row
      }
    }))

  const adjustedReturnCodes = computed(() => get(F.ADJUSTED_RETURNS, []) || [])
  function toggleAdjustedReturn (code) {
    const value = text(code)
    const current = adjustedReturnCodes.value
    set(F.ADJUSTED_RETURNS, current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value])
  }

  const returnDeduction = computed(() => pendingReturns.value
    .filter((row) => adjustedReturnCodes.value.includes(row.code))
    .reduce((sum, row) => sum + row.value, 0))

  // ── Step 6: visit completion ───────────────────────────────────────────────

  const completeVisit = computed(() => get(F.COMPLETE_VISIT, true) === true && !!visitCode.value)
  const scheduleNextVisit = computed(() => get(F.SCHEDULE_NEXT, true) === true)

  /** The outlet's own cadence, or the backend's configured default. Never a literal. */
  const frequencyDays = computed(() => visitFrequencyFor(outletCode.value, operatingRules.items.value))

  /**
   * The next visit, as TWO linked answers.
   *
   * On a phone, "in how many days" and "on what date" are each easier than the other
   * depending on what the officer is thinking about — a cadence, or a day they will be back
   * in the area. So both are offered and each writes the other: the DAYS count is the stored
   * answer (a number the submit hands straight to the visit domain), and the DATE is derived
   * from it. Typing a date is converted back to a day count on the way in, so there is still
   * exactly ONE stored value and the two boxes cannot disagree.
   *
   * Seeded from the outlet's configured cadence; `0` means the cadence is unknown and no
   * next visit is scheduled rather than one being invented.
   */
  const nextVisitDays = computed(() => {
    const stored = get(F.NEXT_VISIT_DAYS, null)
    return stored === null || stored === undefined || stored === '' ? frequencyDays.value : toNumber(stored)
  })

  /** The audit's own date is day zero — the same base the visit domain counts from. */
  const scheduleBaseDate = () => text(node.record.value.Date) || new Date().toISOString().slice(0, 10)

  function addDaysFromBase (days) {
    const base = new Date(scheduleBaseDate())
    if (Number.isNaN(base.getTime())) return ''
    base.setDate(base.getDate() + (toNumber(days) || 0))
    return base.toISOString().slice(0, 10)
  }

  const nextVisitDate = computed(() => {
    if (!nextVisitDays.value) return ''
    return addDaysFromBase(nextVisitDays.value)
  })

  /** Days in → the date follows. Negative counts are refused; a visit is not scheduled backwards. */
  function setNextVisitDays (value) {
    set(F.NEXT_VISIT_DAYS, Math.max(0, Math.round(toNumber(value))))
  }

  /** A date in → the day count follows, as whole calendar days from the audit's own date. */
  function setNextVisitDate (value) {
    const chosen = new Date(text(value))
    const base = new Date(scheduleBaseDate())
    if (Number.isNaN(chosen.getTime()) || Number.isNaN(base.getTime())) return
    const days = Math.round((chosen.getTime() - base.getTime()) / 86400000)
    setNextVisitDays(days)
  }

  const outletName = computed(() => text(getOutlet(outletCode.value)?.name) || outletCode.value)

  return {
    // context
    node, pageState, ui, user, query, outletCode, visitCode, outletName,
    // options
    outletOptions, visitOptions, plannedVisitCards, suggestedOutlets, skuOptions, regionWarehouses,
    // resources (for a card that needs to `reload()` them)
    resources: { outlets, visits, storages, warehouses, warehouseStorages, skus, products, returns, operatingRules, taxes },
    // step 2
    countRows, hasCountRows, seedCountRows, setCurrentQty, stepCurrentQty,
    addManualReturn, removeManualReturn, soldRows, returnRows, skuLabel,
    returnMeta, metaFor, setReturnMeta,
    // step 3
    generateInvoice, priceListCode, discountType, discountValue,
    priceOverrides, setLinePrice, resetLinePrice, resolvePrice, setGenerateInvoice,
    invoiceCalculation, invoiceHeader, invoiceLines, invoiceSubtotal, invoiceDiscount,
    invoiceTaxableAmount, invoiceTax, invoiceReturnDeduction, invoiceTotal,
    invoiceTaxBreakdown, invoicePolicy,
    // step 4
    restockRows, enableRestock, directRestock, warehouseCode, markDelivered,
    syncRestockFromSales, setRestockQty, addRestockRow, removeRestockRow,
    restockCoverage, availableAt, restockCandidates, returnCandidates,
    // step 5
    pendingReturns, adjustedReturnCodes, toggleAdjustedReturn, returnDeduction,
    // step 6
    completeVisit, scheduleNextVisit, frequencyDays, nextVisitDays, nextVisitDate,
    setNextVisitDays, setNextVisitDate,
    // raw control-field access, for the cards' own toggles
    get, set, PENDING_INVOICE_GENERATION
  }
}
