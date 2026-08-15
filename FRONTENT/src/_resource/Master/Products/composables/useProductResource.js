import { computed } from 'vue'
import { useDataStore } from 'src/stores/data'
import { defineSharedComposable } from 'src/utils/appHelpers'
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

// Composable for Product resource operations.
//
// ONCE PER APP (CORE_ARCHITECTURE_RULES §6) — see `useSkuResource` for the rationale.
const shared = defineSharedComposable((dataStore) => {
  // The SKU → product grouping is owned by `useSkuResource` and read here rather than
  // rebuilt (§6 — Enrich Once, Then Project). It used to be re-derived in this computed,
  // which meant the same index existed twice and was rebuilt on every product change.
  const { skusByProduct } = useSkuResource()

  const products = computed(() => {
    const rawProducts = dataStore.getRecords('Products') || []
    const skusByProductMap = skusByProduct.value

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
})

export function useProductResource() {
  return shared(useDataStore())
}
