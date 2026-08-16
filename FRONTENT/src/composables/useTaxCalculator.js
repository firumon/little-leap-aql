import { useDataStore } from 'src/stores/data'
import { usePriceListResource } from 'src/_resource/Master/PriceLists/composables/usePriceListResource'

export const useTaxCalculator = () => {
  const dataStore = useDataStore()
  const { getPriceList, getItemOf } = usePriceListResource()

  const getAllActiveTaxes = () => {
    const records = dataStore.getRecords('Taxes') || []
    return records.filter(r => r.Status === 'Active')
  }

  /**
   * A SKU's price and tax configuration under one price list.
   *
   * Price resolution is DELEGATED to `usePriceListResource`, which owns the INLINE-vs-ITEMS
   * split keyed by `AppConfigMap.PriceListLookup`. This function previously read
   * `PriceListItems` directly — the ITEMS path only. On an INLINE tenant (the default, and
   * the one where prices live in the price list's own `SKUPrices` map) that sheet is empty,
   * so every price resolved to 0 and every invoice was silently taxed on a zero base while
   * still displaying a correct unit price. Reading the enriched list fixes that for every
   * caller at once rather than per invoice screen.
   */
  const getSkuPricingAndTax = (skuCode, priceListCode) => {
    const skus = dataStore.getRecords('SKUs') || []
    const skuRecord = skus.find(s => s.Code === skuCode && s.Status === 'Active')
    if (!skuRecord) {
      throw new Error(`SKU not found or inactive: ${skuCode}`)
    }

    const priceList = getPriceList(priceListCode)
    if (!priceList || priceList.status !== 'Active') {
      throw new Error(`Price List not found or inactive: ${priceListCode}`)
    }

    const item = getItemOf(skuCode, priceListCode)

    return {
      taxCode: skuRecord.TaxCode || '',
      price: Number(item?.price) || 0,
      rsp: Number(item?.rsp) || 0,
      taxInclusive: priceList.taxInclusive,
      discountTaxPolicy: priceList.discountTaxPolicy || 'PRE_TAX'
    }
  }

  const calculateLineTax = (options) => {
    const quantity = Number(options.quantity !== undefined ? options.quantity : 1)
    const discount = Number(options.discount !== undefined ? options.discount : 0)

    let taxCode = options.taxCode || ''
    let price = Number(options.price || 0)
    let taxInclusive = !!options.taxInclusive
    let discountTaxPolicy = options.discountTaxPolicy || 'PRE_TAX'

    if (options.skuCode) {
      if (!options.priceListCode) {
        throw new Error('priceListCode is required when skuCode is provided')
      }
      const resolved = getSkuPricingAndTax(options.skuCode, options.priceListCode)
      taxCode = resolved.taxCode
      price = resolved.price
      taxInclusive = resolved.taxInclusive
      discountTaxPolicy = resolved.discountTaxPolicy
    }

    const rawSubtotal = price * quantity
    let itemPrice = price

    let components = []
    if (taxCode) {
      const allTaxes = getAllActiveTaxes()
      components = allTaxes.filter(t => t.ParentCode === taxCode)
      if (!components.length) {
        const parentTax = allTaxes.find(t => t.Code === taxCode)
        if (parentTax) {
          components = [parentTax]
        }
      }
      components.sort((a, b) => Number(a.CalculationOrder || 1) - Number(b.CalculationOrder || 1))
    }

    if (taxInclusive && components.length > 0) {
      let totalRate = 0
      components.forEach(c => {
        const noCompound = !c.CompoundOn || c.CompoundOn === ''
        if (noCompound) {
          totalRate += Number(c.PercentageTransaction || 0) / 100
        }
      })
      itemPrice = price / (1 + totalRate)
    }

    const subtotal = itemPrice * quantity
    let taxableAmount = subtotal

    if (discountTaxPolicy === 'PRE_TAX') {
      taxableAmount = Math.max(0, subtotal - discount)
    }

    let totalTaxAmount = 0
    let runningPrecedingTaxes = 0
    const taxMap = {}
    const taxBreakdown = []

    components.forEach(comp => {
      let compBase = taxableAmount
      
      if (comp.CompoundOn === 'PREVIOUS') {
        compBase = taxableAmount + runningPrecedingTaxes
      } else if (comp.CompoundOn && comp.CompoundOn !== '') {
        compBase = taxMap[comp.CompoundOn] || 0
      }

      const pctRate = Number(comp.PercentageTransaction || 0) / 100
      const flatRate = Number(comp.FlatUnit || 0)

      const percentageTax = compBase * pctRate
      const flatTax = flatRate * quantity
      const taxAmount = percentageTax + flatTax

      taxMap[comp.Code] = taxAmount
      runningPrecedingTaxes += taxAmount
      totalTaxAmount += taxAmount

      taxBreakdown.push({
        taxCode: comp.Code,
        taxName: comp.Name,
        taxRate: Number(comp.PercentageTransaction || 0),
        taxAmount
      })
    })

    let grossAmount = taxableAmount + totalTaxAmount
    if (discountTaxPolicy === 'POST_TAX') {
      grossAmount = Math.max(0, (subtotal + totalTaxAmount) - discount)
    }

    return {
      subtotal: rawSubtotal,
      itemPrice,
      taxableAmount,
      taxAmount: totalTaxAmount,
      discountAmount: discount,
      grossAmount,
      taxBreakdown
    }
  }

  return {
    calculateLineTax
  }
}
