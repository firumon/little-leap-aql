import { useProductSkuResolver } from 'src/composables/masters/products/useProductSkuResolver'

function buildVariantsCsv(sku) {
  return [sku?.Variant1, sku?.Variant2, sku?.Variant3, sku?.Variant4, sku?.Variant5]
    .filter((variant) => variant != null && String(variant).trim() !== '')
    .join(', ')
}

export function buildCodeOnlySkuOptions(allSkus = []) {
  return allSkus.map((sku) => ({ label: sku.Code, value: sku.Code, ...sku }))
}

export function filterCodeOnlySkuOptions(allSkus = [], keyword = '') {
  const needle = (keyword || '').toLowerCase()
  return buildCodeOnlySkuOptions(
    needle
      ? allSkus.filter((sku) => (sku.Code || '').toLowerCase().includes(needle))
      : allSkus
  )
}

export function buildPurchaseRequisitionSkuInfo(allSkus = [], allProducts = []) {
  const { skuInfo } = useProductSkuResolver()
  const info = {}

  allSkus.forEach((sku) => {
    const details = skuInfo(sku.Code) || {}
    info[sku.Code] = {
      productName: details.productName || sku.Code,
      variantsCsv: details.variantValues?.filter(Boolean).join(', ') || '',
      uom: details.uom || sku.UOM || ''
    }
  })

  return info
}

export function buildRichSkuOptions(allSkus = [], skuInfoByCode = {}) {
  return allSkus.map((sku) => ({
    label: skuInfoByCode[sku.Code]?.productName || sku.Code,
    sublabel: [sku.Code, skuInfoByCode[sku.Code]?.variantsCsv].filter(Boolean).join(' — '),
    value: sku.Code,
    UOM: sku.UOM,
    ...sku
  }))
}

export function filterRichSkuOptions(allSkus = [], skuInfoByCode = {}, keyword = '') {
  const needle = (keyword || '').toLowerCase()
  return buildRichSkuOptions(
    needle
      ? allSkus.filter((sku) => {
        const info = skuInfoByCode[sku.Code] || {}
        return (sku.Code || '').toLowerCase().includes(needle)
          || (info.productName || '').toLowerCase().includes(needle)
          || (info.variantsCsv || '').toLowerCase().includes(needle)
      })
      : allSkus,
    skuInfoByCode
  )
}

