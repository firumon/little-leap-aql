import { computed } from 'vue'
import { useDataStore } from 'src/stores/data'
import { defineSharedComposable } from 'src/utils/appHelpers'

/**
 * Group raw tax rows by their ParentCode — the child index, built in ONE pass.
 *
 * `enrichTax` used to take the whole array and filter it for its own children, so
 * enriching n taxes rescanned all n taxes n times (§6 — Indexed Joins). The index is
 * built once here and each record is handed its own bucket.
 */
export const groupTaxesByParent = (allTaxes = []) => {
  const map = new Map()
  ;(Array.isArray(allTaxes) ? allTaxes : []).forEach((t) => {
    const parent = (t?.ParentCode || '')
    if (!parent) return
    if (!map.has(parent)) map.set(parent, [])
    map.get(parent).push(t)
  })
  return map
}

/**
 * WHICH PLACE-OF-SUPPLY BRANCH a tax component belongs to (`Taxes.SupplyScope`).
 *
 * Some taxes split by destination and charge a DIFFERENT set of components each way — Indian
 * GST is the standard case: a sale inside the state charges CGST + SGST, a sale across state
 * lines charges IGST instead, and the two are alternatives that must never both apply. They
 * are modelled as siblings under one parent (`GST18` → `CGST9`, `SGST9`, `IGST18`), so
 * something has to say which branch a component is for.
 *
 * BLANK MEANS ALWAYS, and that default is load-bearing: every ordinary tax — VAT, US sales
 * tax, excise, a carbon levy — applies regardless of destination, and none of them will ever
 * carry this column. Treating blank as "intra-state only" would silently drop every one of
 * them from an inter-state sale.
 */
export const SUPPLY_ALWAYS = ''
export const SUPPLY_INTRA = 'INTRA'
export const SUPPLY_INTER = 'INTER'

function normaliseSupplyScope (value) {
  const raw = (value == null ? '' : String(value)).trim().toUpperCase()
  return raw === SUPPLY_INTRA || raw === SUPPLY_INTER ? raw : SUPPLY_ALWAYS
}

/**
 * Does this component apply to the transaction being priced?
 *
 * `interState` defaults to FALSE everywhere — the overwhelmingly common sale is a local one,
 * and a caller that has no concept of place of supply gets the intra-state branch rather than
 * a surprise.
 */
export function appliesToSupply (component, interState = false) {
  const scope = normaliseSupplyScope(component?.supplyScope ?? component?.SupplyScope)
  if (scope === SUPPLY_ALWAYS) return true
  return interState === true ? scope === SUPPLY_INTER : scope === SUPPLY_INTRA
}

// Pure single Tax record enrichment function.
//
// `childRows` is this tax's OWN children, already selected by `groupTaxesByParent`.
// An array is still accepted for callers that pass a bucket directly.
export const enrichTax = (tax, childRows = []) => {
  if (!tax || !tax.Code) return null
  const parentCode = tax.ParentCode || ''
  const isTopLevel = !parentCode

  const children = (Array.isArray(childRows) ? childRows : [])
    .slice()
    .sort((a, b) => (Number(a.CalculationOrder) || 1) - (Number(b.CalculationOrder) || 1))
    .map((c) => ({
      code: c.Code,
      name: c.Name || '',
      parentCode: tax.Code,
      percentageTransaction: Number(c.PercentageTransaction) || 0,
      flatUnit: Number(c.FlatUnit) || 0,
      calculationOrder: Number(c.CalculationOrder) || 1,
      compoundOn: c.CompoundOn || '',
      supplyScope: normaliseSupplyScope(c.SupplyScope),
      description: c.Description || '',
      status: c.Status || 'Active',
      _raw: c
    }))

  const isGroup = children.length > 0
  const percentage = Number(tax.PercentageTransaction) || 0
  const flatUnit = Number(tax.FlatUnit) || 0

  // Total rate for non-compound components
  const simpleTotalRate = isGroup
    ? children.filter((c) => !c.compoundOn).reduce((sum, c) => sum + c.percentageTransaction, 0)
    : percentage

  return {
    code: tax.Code,
    taxCode: tax.Code,
    name: tax.Name || '',
    parentCode,
    isTopLevel,
    isGroup,
    percentageTransaction: percentage,
    flatUnit,
    calculationOrder: Number(tax.CalculationOrder) || 1,
    compoundOn: tax.CompoundOn || '',
    supplyScope: normaliseSupplyScope(tax.SupplyScope),
    description: tax.Description || '',
    accessRegion: tax.AccessRegion || '',
    status: tax.Status || 'Active',

    // Parent/Child relational structure
    children,
    childCount: children.length,
    simpleTotalRate,

    createdAt: tax.CreatedAt || '',
    updatedAt: tax.UpdatedAt || '',
    createdBy: tax.CreatedBy || '',
    updatedBy: tax.UpdatedBy || '',
    _raw: tax
  }
}

// Composable for Taxes master resource.
//
// ONCE PER APP (CORE_ARCHITECTURE_RULES §6) — see `useSkuResource` for the rationale.
const shared = defineSharedComposable((dataStore) => {
  const taxes = computed(() => {
    const raw = dataStore.getRecords('Taxes') || []
    const childrenByParent = groupTaxesByParent(raw)
    return raw.map((t) => enrichTax(t, childrenByParent.get(t.Code) || [])).filter(Boolean)
  })

  const activeTaxes = computed(() => taxes.value.filter((t) => t.status === 'Active'))

  // Top-level tax groups / taxes
  const taxGroups = computed(() => taxes.value.filter((t) => t.isTopLevel))
  const activeTaxGroups = computed(() => activeTaxes.value.filter((t) => t.isTopLevel))

  const taxMap = computed(() => new Map(taxes.value.map((t) => [t.code, t])))

  const getTax = (code) => {
    if (!code) return null
    return taxMap.value.get(code) || null
  }

  /**
   * The active components of a tax, in `CalculationOrder`, narrowed to the branch this
   * transaction is on.
   *
   * The `SupplyScope` filter is what stops a GST group charging CGST + SGST + IGST all at
   * once — see `appliesToSupply`. A group whose children carry no scope is unaffected.
   */
  const getTaxComponents = (taxCode, { interState = false } = {}) => {
    if (!taxCode) return []
    const tax = getTax(taxCode)
    if (!tax) return []
    if (tax.children && tax.children.length > 0) {
      return tax.children.filter((c) => c.status === 'Active' && appliesToSupply(c, interState))
    }
    return tax.status === 'Active' && appliesToSupply(tax, interState) ? [tax] : []
  }

  /**
   * THE tax calculation for one line. Every tax figure in the app comes from here.
   *
   * ── IT TAKES A PRICE, NEVER A SKU ──
   * Deliberately, and it is the whole reason this is the only survivor. The second calculator
   * that used to sit in `src/composables/` (now deleted) accepted a `skuCode` and resolved the
   * price from the price list ITSELF — so on any screen that lets the user override a unit
   * price, the line was taxed at the list price while it was billed at the typed one.
   * `Subtotal` moved and `TotalTaxAmount` did not, in the review step AND in the row that got
   * written. A calculator that cannot see the price cannot be handed one, so this one
   * demands it.
   *
   * ── THE PLACE-OF-SUPPLY BRANCH ──
   * `interState` (default `false`) picks which components apply, through `SupplyScope`. It is
   * the caller's fact, not this module's: only the transaction knows whether the buyer is in
   * the seller's state. A tax whose components carry no scope ignores it entirely.
   *
   * ── THE THREE COMPOUND MODES ──
   *   compoundOn = ''           charged on the line's own taxable amount.
   *   compoundOn = 'PREVIOUS'   charged on the taxable amount PLUS every component already
   *                             applied — a surcharge stacked on the running total.
   *   compoundOn = '<taxCode>'  charged on that ONE named component's tax amount — a cess
   *                             levied on a specific duty rather than on the goods.
   * Components arrive in `CalculationOrder` (sorted once, in `enrichTax`), which is what makes
   * "already applied" well-defined.
   *
   * PURE: takes plain numbers and a tax code, touches no invoice, no price list and no store
   * beyond the Taxes rows this module owns.
   */
  const calculateLineTax = ({ price = 0, quantity = 1, discount = 0, taxCode = '', taxInclusive = false, discountTaxPolicy = 'PRE_TAX', interState = false } = {}) => {
    const numPrice = Number(price) || 0
    const numQty = Number(quantity) || 0
    const numDisc = Number(discount) || 0

    const components = getTaxComponents(taxCode, { interState })
    let itemPrice = numPrice

    if (taxInclusive && components.length > 0) {
      let nonCompoundRate = 0
      components.forEach((c) => {
        if (!c.compoundOn) {
          nonCompoundRate += (Number(c.percentageTransaction) || 0) / 100
        }
      })
      itemPrice = numPrice / (1 + nonCompoundRate)
    }

    const subtotal = itemPrice * numQty
    let taxableAmount = subtotal
    if (discountTaxPolicy === 'PRE_TAX') {
      taxableAmount = Math.max(0, subtotal - numDisc)
    }

    let totalTax = 0
    let runningPreceding = 0
    const breakdown = []
    // What each component charged, so a later one can compound on it BY NAME — see the
    // three modes in the docblock.
    const taxByCode = {}

    components.forEach((comp) => {
      let base = taxableAmount
      if (comp.compoundOn === 'PREVIOUS') {
        base = taxableAmount + runningPreceding
      } else if (comp.compoundOn) {
        // A component naming one that has not been applied yet charges nothing rather than
        // silently falling back to the full taxable amount, which would over-charge by the
        // whole line instead of by a rounding error.
        base = taxByCode[comp.compoundOn] || 0
      }
      const pctAmt = (base * (Number(comp.percentageTransaction) || 0)) / 100
      const flatAmt = (Number(comp.flatUnit) || 0) * numQty
      const compTax = pctAmt + flatAmt

      taxByCode[comp.code] = compTax
      runningPreceding += compTax
      totalTax += compTax

      breakdown.push({
        code: comp.code,
        name: comp.name,
        base,
        rate: comp.percentageTransaction,
        flatUnit: comp.flatUnit,
        amount: compTax
      })
    })

    let grossAmount = 0
    if (discountTaxPolicy === 'POST_TAX') {
      grossAmount = (taxableAmount + totalTax) - numDisc
    } else {
      grossAmount = taxableAmount + totalTax
    }

    return {
      itemPrice,
      subtotal,
      discount: numDisc,
      taxableAmount,
      totalTax,
      grossAmount,
      breakdown
    }
  }

  return {
    taxes,
    allTaxes: taxes,
    activeTaxes,
    taxGroups,
    activeTaxGroups,
    taxMap,
    getTax,
    getTaxComponents,
    calculateLineTax
  }
})

export function useTaxResource() {
  return shared(useDataStore())
}
