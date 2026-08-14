import { computed } from 'vue'
import { useDataStore } from 'src/stores/data'
import { useSkuResource, parseVariantTypes } from 'src/_resource/Master/SKUs/composables/useSkuResource'

// Pure Product enrichment function
export const enrichProduct = (product, skusByProduct = []) => {
  if (!product || !product.Code) return null
  const variantTypes = parseVariantTypes(product.VariantTypes || '')

  const activeSkus = skusByProduct.filter((s) => s.status === 'Active')

  // Aggregate variant option values across all associated SKUs
  const variantOptions = {}
  variantTypes.forEach((label) => {
    const set = new Set()
    skusByProduct.forEach((sku) => {
      const val = sku.variantMap?.[label]
      if (val) set.add(val)
    })
    variantOptions[label] = Array.from(set)
  })

  // Aggregated UOMs and Tax Codes used across its SKUs
  const uoms = Array.from(new Set(skusByProduct.map((s) => s.uom).filter(Boolean)))
  const taxCodes = Array.from(new Set(skusByProduct.map((s) => s.taxCode).filter(Boolean)))

  return {
    code: product.Code,
    productCode: product.Code,
    name: product.Name || '',
    productName: product.Name || '',
    variantTypes,
    hasVariants: variantTypes.length > 0,
    accessRegion: product.AccessRegion || '',
    status: product.Status || 'Active',
    createdAt: product.CreatedAt || '',
    updatedAt: product.UpdatedAt || '',
    createdBy: product.CreatedBy || '',
    updatedBy: product.UpdatedBy || '',

    // Nested enriched SKUs
    skus: skusByProduct,
    activeSkus,
    skuCount: skusByProduct.length,
    activeSkuCount: activeSkus.length,

    // Aggregates
    variantOptions,
    uoms,
    taxCodes,

    // Raw record reference
    _raw: product
  }
}

// Composable for Product resource operations
export function useProductResource() {
  const dataStore = useDataStore()
  const { skus } = useSkuResource()

  const products = computed(() => {
    const rawProducts = dataStore.getRecords('Products') || []

    const skusByProductMap = new Map()
    for (const sku of skus.value) {
      if (!skusByProductMap.has(sku.productCode)) {
        skusByProductMap.set(sku.productCode, [])
      }
      skusByProductMap.get(sku.productCode).push(sku)
    }

    return rawProducts.map((p) => enrichProduct(p, skusByProductMap.get(p.Code) || [])).filter(Boolean)
  })

  const activeProducts = computed(() => products.value.filter((p) => p.status === 'Active'))

  const productMap = computed(() => new Map(products.value.map((p) => [p.code, p])))

  const getProduct = (productCode) => {
    if (!productCode) return null
    return productMap.value.get(productCode) || null
  }

  const productInfo = (productCode) => getProduct(productCode)

  const getProductVariantOptions = (productCode) => {
    const prod = getProduct(productCode)
    return prod?.variantOptions || {}
  }

  return {
    products,
    allProducts: products,
    activeProducts,
    productMap,
    getProduct,
    productInfo,
    getProductVariantOptions
  }
}
