import { useDataStore } from 'src/stores/data'

function parseVariantTypes(csv) {
  if (!csv || typeof csv !== 'string') return []
  return csv.split(',').map(l => l.trim()).filter(Boolean).slice(0, 5)
}

export function useProductSkuResolver() {
  const dataStore = useDataStore()
  function skuInfo(skuCode) {
    if (!skuCode) return null
    const skus = dataStore.getRecords('SKUs') || []
    const products = dataStore.getRecords('Products') || []
    const uoms = dataStore.getRecords('UOMs') || []
    const sku = skus.find(s => s.Code === skuCode)
    if (!sku) return null
    const product = products.find(p => p.Code === sku.ProductCode)
    const uom = uoms.find(u => u.Code === sku.UOM)
    const baseUom = uoms.find(u => u.Code === (uom?.BaseUOM || sku.BaseUOM))
    const variantTypes = parseVariantTypes(product?.VariantTypes || '')
    const variantNames = variantTypes.map(v => v)
    const variantValues = variantTypes.map(v => sku[`Variant${variantTypes.indexOf(v) + 1}`] || '')
    const variantMap = {}
    variantTypes.forEach((label, i) => { variantMap[label] = sku[`Variant${i + 1}`] || '' })
    return {
      productName: product?.Name || '',
      productCode: product?.Code || '',
      variantNames,
      skuCode: sku.Code,
      variantValues,
      variantMap,
      status: sku.Status || 'Active',
      uom: sku.UOM || '',
      uomName: uom?.Name || '',
      baseUom: baseUom?.Code || '',
      baseUomName: baseUom?.Name || '',
      conversionFactor: uom?.ConversionFactor || 1
    }
  }

  return { skuInfo }
}
