import { computed } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'

export const MAX_VARIANTS = 5

export const parseVariantTypes = (csv) => {
  if (!csv || typeof csv !== 'string') return []
  return csv
    .split(',')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, MAX_VARIANTS)
}

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
    productName: product?.Name || '',
    productStatus: product?.Status || 'Active',
    accessRegion: product?.AccessRegion || '',
    variantTypes,
    variantNames,
    variantValues,
    variantMap,
    uomName: uom?.Name || '',
    baseUom: baseUom?.Code || '',
    baseUomName: baseUom?.Name || '',
    conversionFactor: Number(uom?.ConversionFactor) || 1,
    _raw: sku,
    _product: product,
    _uom: uom
  }
}

const build = (recordSource) => {
  const skus = computed(() => {
    const rawSkus = recordSource.rows('SKUs') || []
    const rawProducts = recordSource.rows('Products') || []
    const rawUoms = recordSource.rows('UOMs') || []

    const productsMap = new Map(rawProducts.map((p) => [p.Code, p]))
    const uomsMap = new Map(rawUoms.map((u) => [u.Code, u]))

    return rawSkus.map((s) => enrichSku(s, productsMap, uomsMap)).filter(Boolean)
  })

  const activeSkus = computed(() => skus.value.filter((s) => s.status === 'Active'))

  const skuMap = computed(() => new Map(skus.value.map((s) => [s.code, s])))

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

  const skuLabelText = (skuCode) => {
    const code = String(skuCode == null ? '' : skuCode).trim()
    if (!code) return ''
    const sku = getSku(code)
    if (!sku?.productName) return code
    const count = skusByProduct.value.get(sku.productCode)?.length || 0
    if (count === 1) return sku.productName
    const variants = (sku.variantValues || []).filter(Boolean).join(' / ')
    return `${sku.productName} · ${variants || code}`
  }

  const getSkusByProduct = (productCode) => {
    if (!productCode) return []
    return skusByProduct.value.get(productCode) || []
  }

  const skuOptions = computed(() => activeSkus.value.map((sku) => ({
    label: skuLabelText(sku.code),
    value: sku.code
  })))

  return {
    skus,
    allSkus: skus,
    activeSkus,
    skuOptions,
    skuMap,
    skusByProduct,
    getSku,
    skuInfo,
    skuLabelOf,
    skuLabelText,
    getSkusByProduct
  }
}

export function useSkuResource () {
  const recordSource = useRecord()
  return recordSource.remember('useSkuResource', () => build(recordSource))
}
