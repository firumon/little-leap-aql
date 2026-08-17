import { computed } from 'vue'
import { useDataStore } from 'src/stores/data'
import { defineSharedComposable } from 'src/utils/appHelpers'

export const MAX_VARIANTS = 5

// Parse CSV variant types (e.g. "Color, Size" -> ['Color', 'Size'])
export const parseVariantTypes = (csv) => {
  if (!csv || typeof csv !== 'string') return []
  return csv
    .split(',')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, MAX_VARIANTS)
}

// Pure SKU enrichment function
export const enrichSku = (sku, productsMap = new Map(), uomsMap = new Map()) => {
  if (!sku || !sku.Code) return null
  const product = productsMap.get(sku.ProductCode) || null
  const uom = uomsMap.get(sku.UOM) || null
  const baseUom = uomsMap.get(uom?.BaseUOM || sku.BaseUOM) || null

  const variantTypes = parseVariantTypes(product?.VariantTypes || '')
  const variantNames = [...variantTypes]
  const variantValues = variantTypes.map((_, i) => sku[`Variant${i + 1}`] || '')
  const variantMap = {}
  variantTypes.forEach((label, i) => {
    variantMap[label] = sku[`Variant${i + 1}`] || ''
  })

  return {
    code: sku.Code,
    skuCode: sku.Code,
    productCode: sku.ProductCode || '',
    uom: sku.UOM || '',
    taxCode: sku.TaxCode || '',
    barcode: sku.Barcode || '',
    status: sku.Status || 'Active',
    variant1: sku.Variant1 || '',
    variant2: sku.Variant2 || '',
    variant3: sku.Variant3 || '',
    variant4: sku.Variant4 || '',
    variant5: sku.Variant5 || '',
    createdAt: sku.CreatedAt || '',
    updatedAt: sku.UpdatedAt || '',
    createdBy: sku.CreatedBy || '',
    updatedBy: sku.UpdatedBy || '',

    // Enriched Product details
    productName: product?.Name || '',
    productStatus: product?.Status || 'Active',
    accessRegion: product?.AccessRegion || '',

    // Variants (matching skuInfo contract)
    variantTypes,
    variantNames,
    variantValues,
    variantMap,

    // Enriched UOM details & conversions
    uomName: uom?.Name || '',
    baseUom: baseUom?.Code || '',
    baseUomName: baseUom?.Name || '',
    conversionFactor: Number(uom?.ConversionFactor) || 1,

    // Raw record references
    _raw: sku,
    _product: product,
    _uom: uom
  }
}

// Composable for SKU resource operations.
//
// ONCE PER APP (CORE_ARCHITECTURE_RULES §6): the enrichment graph below is built one
// time and shared by every caller. `useProductResource`, `usePriceListResource` and
// every component reading SKU labels all land on the same `computed()` refs, so the
// pass over the SKU sheet runs once per data change rather than once per consumer.
const shared = defineSharedComposable((dataStore) => {
  const skus = computed(() => {
    const rawSkus = dataStore.getRecords('SKUs') || []
    const rawProducts = dataStore.getRecords('Products') || []
    const rawUoms = dataStore.getRecords('UOMs') || []

    const productsMap = new Map(rawProducts.map((p) => [p.Code, p]))
    const uomsMap = new Map(rawUoms.map((u) => [u.Code, u]))

    return rawSkus.map((s) => enrichSku(s, productsMap, uomsMap)).filter(Boolean)
  })

  const activeSkus = computed(() => skus.value.filter((s) => s.status === 'Active'))

  const skuMap = computed(() => new Map(skus.value.map((s) => [s.code, s])))

  // Indexed once, not re-filtered per lookup (§6 — Indexed Joins). `useProductResource`
  // reads this same index to build its nested `skus`, so the grouping exists in exactly
  // one place and both consumers are guaranteed to agree on it.
  const skusByProduct = computed(() => {
    const map = new Map()
    skus.value.forEach((s) => {
      if (!map.has(s.productCode)) map.set(s.productCode, [])
      map.get(s.productCode).push(s)
    })
    return map
  })

  const getSku = (skuCode) => {
    if (!skuCode) return null
    return skuMap.value.get(skuCode) || null
  }

  const skuInfo = (skuCode) => getSku(skuCode)

  /**
   * How a SKU is NAMED anywhere in the app: the product on top, what distinguishes this
   * variant beneath it.
   *
   *   { primary: 'Fruit Feeder', secondary: 'Red / 500ml', uom: 'PCS' }
   *
   * A SKU CODE IS NOT A NAME. `CK3-09` identifies a row to the system and means nothing to
   * the person reading it, so the code is only ever the FALLBACK — used for `secondary` when
   * a product declares no variant types, and for `primary` when the SKU resolves to no
   * product at all. Everywhere else the reader sees words.
   *
   * This lives in Layer 2, not in a page composable, because "what do we call this SKU" is
   * one question with one answer for every screen that asks it. Two UI-side copies of this
   * rule already exist (`useConsumptionWizard.skuLabel`, `useRestockView.skuLabelOf`) and
   * they are exactly the drift UI_RESOURCE_DOMAIN_LOGIC.md §3.3 warns about — new callers
   * take it from here so a third copy never happens.
   */
  const skuLabelOf = (skuCode) => {
    const code = String(skuCode == null ? '' : skuCode).trim()
    const info = getSku(code) || {}
    const variants = (info.variantValues || []).filter(Boolean).join(' / ')
    return {
      primary: info.productName || code,
      secondary: variants || code,
      uom: info.uom || 'PCS'
    }
  }

  /** The same name as one string, for a select option or a single-line row. */
  const skuLabelText = (skuCode) => {
    const { primary, secondary } = skuLabelOf(skuCode)
    return secondary && secondary !== primary ? `${primary} · ${secondary}` : primary
  }

  const getSkusByProduct = (productCode) => {
    if (!productCode) return []
    return skusByProduct.value.get(productCode) || []
  }

  return {
    skus,
    allSkus: skus,
    activeSkus,
    skuMap,
    skusByProduct,
    getSku,
    skuInfo,
    skuLabelOf,
    skuLabelText,
    getSkusByProduct
  }
})

export function useSkuResource() {
  return shared(useDataStore())
}
