import { computed } from 'vue'
import { useDataStore } from 'src/stores/data'

// Pure single Tax record enrichment function
export const enrichTax = (tax, allTaxes = []) => {
  if (!tax || !tax.Code) return null
  const parentCode = tax.ParentCode || ''
  const isTopLevel = !parentCode

  // Find child tax components if this is a parent/group
  const children = allTaxes
    .filter((t) => (t.ParentCode || '') === tax.Code)
    .sort((a, b) => (Number(a.CalculationOrder) || 1) - (Number(b.CalculationOrder) || 1))
    .map((c) => ({
      code: c.Code,
      name: c.Name || '',
      parentCode: tax.Code,
      percentageTransaction: Number(c.PercentageTransaction) || 0,
      flatUnit: Number(c.FlatUnit) || 0,
      calculationOrder: Number(c.CalculationOrder) || 1,
      compoundOn: c.CompoundOn || '',
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

// Composable for Taxes master resource
export function useTaxResource() {
  const dataStore = useDataStore()

  const taxes = computed(() => {
    const raw = dataStore.getRecords('Taxes') || []
    return raw.map((t) => enrichTax(t, raw)).filter(Boolean)
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

  // Returns sorted active tax components for a given tax code (group or single)
  const getTaxComponents = (taxCode) => {
    if (!taxCode) return []
    const tax = getTax(taxCode)
    if (!tax) return []
    if (tax.children && tax.children.length > 0) {
      return tax.children.filter((c) => c.status === 'Active')
    }
    return tax.status === 'Active' ? [tax] : []
  }

  // Calculate taxes on a line item
  const calculateLineTax = ({ price = 0, quantity = 1, discount = 0, taxCode = '', taxInclusive = false, discountTaxPolicy = 'PRE_TAX' } = {}) => {
    const numPrice = Number(price) || 0
    const numQty = Number(quantity) || 0
    const numDisc = Number(discount) || 0

    const components = getTaxComponents(taxCode)
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

    components.forEach((comp) => {
      let base = taxableAmount
      if (comp.compoundOn === 'PREVIOUS') {
        base = taxableAmount + runningPreceding
      }
      const pctAmt = (base * (Number(comp.percentageTransaction) || 0)) / 100
      const flatAmt = (Number(comp.flatUnit) || 0) * numQty
      const compTax = pctAmt + flatAmt

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
}
