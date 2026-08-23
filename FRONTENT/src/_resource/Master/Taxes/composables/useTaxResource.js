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
 * `Taxes.SupplyScope` — which place-of-supply branch a component belongs to. Indian GST is
 * the case: CGST+SGST within a state, IGST across, never both.
 *
 * BLANK MEANS ALWAYS. Treating blank as INTRA would drop every ordinary tax (VAT, excise,
 * sales tax) from an inter-state sale.
 */
export const SUPPLY_ALWAYS = ''
export const SUPPLY_INTRA = 'INTRA'
export const SUPPLY_INTER = 'INTER'

function normaliseSupplyScope (value) {
  const raw = (value == null ? '' : String(value)).trim().toUpperCase()
  return raw === SUPPLY_INTRA || raw === SUPPLY_INTER ? raw : SUPPLY_ALWAYS
}

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

  // Active components in CalculationOrder, narrowed to this transaction's supply branch.
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
   * TAKES A PRICE, NEVER A SKU. A calculator that resolves its own price taxes the list
   * price while the line is billed at an overridden one.
   *
   * compoundOn: '' on the line's taxable amount | 'PREVIOUS' on that plus every component
   * already applied | '<taxCode>' on that one component's tax amount.
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
    // What each component charged, so a later one can compound on it by name.
    const taxByCode = {}

    components.forEach((comp) => {
      let base = taxableAmount
      if (comp.compoundOn === 'PREVIOUS') {
        base = taxableAmount + runningPreceding
      } else if (comp.compoundOn) {
        // Naming a component not yet applied charges nothing, never the full taxable amount.
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
