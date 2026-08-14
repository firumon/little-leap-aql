import { computed } from 'vue'
import { useDataStore } from 'src/stores/data'
import { useAuthStore } from 'src/stores/auth'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'

// Parse JSON string safely
export const parseInlinePrices = (raw) => {
  if (!raw) return {}
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch (_) {
    return {}
  }
}

// Pure PriceList enrichment function
export const enrichPriceList = (priceList, lookupMode = 'INLINE', priceListItems = [], skusMap = new Map()) => {
  if (!priceList || !priceList.Code) return null

  const isDefault = String(priceList.IsDefault).toUpperCase() === 'TRUE' || priceList.IsDefault === true
  const taxInclusive = String(priceList.TaxInclusive).toUpperCase() === 'TRUE' || priceList.TaxInclusive === true
  const discountTaxPolicy = priceList.DiscountTaxPolicy || 'PRE_TAX'

  const items = []
  const priceMap = {}
  const rspMap = {}

  if (lookupMode === 'ITEMS') {
    const matchingItems = priceListItems.filter((row) => (row.PriceListCode || '') === priceList.Code)
    matchingItems.forEach((row) => {
      const skuCode = row.SKUCode || ''
      if (!skuCode) return
      const price = Number(row.Price) || 0
      const rsp = Number(row.RSP) || 0
      const status = row.Status || 'Active'

      priceMap[skuCode] = price
      rspMap[skuCode] = rsp

      items.push({
        code: row.Code || '',
        priceListCode: priceList.Code,
        skuCode,
        price,
        rsp,
        status,
        sku: skusMap.get(skuCode) || null,
        _raw: row
      })
    })
  } else {
    const inlineMap = parseInlinePrices(priceList.SKUPrices)
    Object.entries(inlineMap).forEach(([skuCode, priceVal]) => {
      if (!skuCode) return
      const isObj = typeof priceVal === 'object' && priceVal !== null
      const price = isObj ? (Number(priceVal.price ?? priceVal.Price) || 0) : (Number(priceVal) || 0)
      const rsp = isObj ? (Number(priceVal.rsp ?? priceVal.RSP) || 0) : 0

      priceMap[skuCode] = price
      rspMap[skuCode] = rsp

      items.push({
        code: `${priceList.Code}_${skuCode}`,
        priceListCode: priceList.Code,
        skuCode,
        price,
        rsp,
        status: 'Active',
        sku: skusMap.get(skuCode) || null,
        _raw: priceVal
      })
    })
  }

  const activeItems = items.filter((item) => item.status === 'Active')

  return {
    code: priceList.Code,
    priceListCode: priceList.Code,
    name: priceList.Name || '',
    description: priceList.Description || '',
    currency: priceList.Currency || '',
    isDefault,
    taxInclusive,
    discountTaxPolicy,
    accessRegion: priceList.AccessRegion || '',
    status: priceList.Status || 'Active',
    lookupMode,

    // Items & fast lookup maps
    items,
    activeItems,
    priceMap,
    rspMap,
    itemCount: items.length,
    activeItemCount: activeItems.length,

    createdAt: priceList.CreatedAt || '',
    updatedAt: priceList.UpdatedAt || '',
    createdBy: priceList.CreatedBy || '',
    updatedBy: priceList.UpdatedBy || '',
    _raw: priceList
  }
}

// Composable for PriceList master resource
export function usePriceListResource() {
  const dataStore = useDataStore()
  const authStore = useAuthStore()
  const { skuMap } = useSkuResource()

  const lookupMode = computed(() => {
    const val = String(authStore.appConfigMap?.PriceListLookup || '').trim().toUpperCase()
    return val === 'ITEMS' ? 'ITEMS' : 'INLINE'
  })

  const priceLists = computed(() => {
    const rawLists = dataStore.getRecords('PriceList') || []
    const rawItems = dataStore.getRecords('PriceListItems') || []
    const mode = lookupMode.value
    const skus = skuMap.value

    return rawLists.map((pl) => enrichPriceList(pl, mode, rawItems, skus)).filter(Boolean)
  })

  const activePriceLists = computed(() => priceLists.value.filter((pl) => pl.status === 'Active'))

  const defaultPriceList = computed(() => {
    return activePriceLists.value.find((pl) => pl.isDefault) || activePriceLists.value[0] || null
  })

  const priceListMap = computed(() => new Map(priceLists.value.map((pl) => [pl.code, pl])))

  const getPriceList = (code) => {
    if (!code) return null
    return priceListMap.value.get(code) || null
  }

  // Returns numerical price for a SKU from specified or default PriceList
  const getPriceOf = (skuCode, priceListCode) => {
    if (!skuCode) return null
    const pl = priceListCode ? getPriceList(priceListCode) : defaultPriceList.value
    if (!pl) return null
    return pl.priceMap[skuCode] !== undefined ? pl.priceMap[skuCode] : null
  }

  // Returns numerical RSP for a SKU from specified or default PriceList
  const getRspOf = (skuCode, priceListCode) => {
    if (!skuCode) return null
    const pl = priceListCode ? getPriceList(priceListCode) : defaultPriceList.value
    if (!pl) return null
    return pl.rspMap[skuCode] !== undefined ? pl.rspMap[skuCode] : null
  }

  // Returns full item details for a SKU from specified or default PriceList
  const getItemOf = (skuCode, priceListCode) => {
    if (!skuCode) return null
    const pl = priceListCode ? getPriceList(priceListCode) : defaultPriceList.value
    if (!pl) return null
    return pl.items.find((it) => it.skuCode === skuCode) || null
  }

  return {
    lookupMode,
    priceLists,
    allPriceLists: priceLists,
    activePriceLists,
    defaultPriceList,
    priceListMap,
    getPriceList,
    getPriceOf,
    getRspOf,
    getItemOf
  }
}
