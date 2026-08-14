import { computed } from 'vue'
import { useDataStore } from 'src/stores/data'

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

// Composable for SKU resource operations
export function useSkuResource() {
  const dataStore = useDataStore()

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

  const getSku = (skuCode) => {
    if (!skuCode) return null
    return skuMap.value.get(skuCode) || null
  }

  const skuInfo = (skuCode) => getSku(skuCode)

  const getSkusByProduct = (productCode) => {
    if (!productCode) return []
    return skus.value.filter((s) => s.productCode === productCode)
  }

  return {
    skus,
    allSkus: skus,
    activeSkus,
    skuMap,
    getSku,
    skuInfo,
    getSkusByProduct
  }
}
