import { computed } from 'vue'
import { useDataStore } from 'src/stores/data'
import { useAuthStore } from 'src/stores/auth'
import { defineSharedComposable } from 'src/utils/appHelpers'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'

/**
 * Group raw `PriceListItems` rows by their PriceListCode — built in ONE pass.
 *
 * `enrichPriceList` used to filter the entire items sheet for its own rows, so
 * enriching n lists rescanned all m items n times (§6 — Indexed Joins).
 */
export const groupPriceListItems = (rows = []) => {
  const map = new Map()
  ;(Array.isArray(rows) ? rows : []).forEach((row) => {
    const code = row?.PriceListCode || ''
    if (!code) return
    if (!map.has(code)) map.set(code, [])
    map.get(code).push(row)
  })
  return map
}

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

// Pure PriceList enrichment function. `ownItems` is THIS list's `PriceListItems` rows
// (ITEMS mode only), already selected by `groupPriceListItems` — never the whole sheet.
export const enrichPriceList = (priceList, lookupMode = 'INLINE', ownItems = [], skusMap = new Map()) => {
  if (!priceList || !priceList.Code) return null

  const isDefault = String(priceList.IsDefault).toUpperCase() === 'TRUE' || priceList.IsDefault === true
  const taxInclusive = String(priceList.TaxInclusive).toUpperCase() === 'TRUE' || priceList.TaxInclusive === true
  const discountTaxPolicy = priceList.DiscountTaxPolicy || 'PRE_TAX'

  const items = []
  const priceMap = {}
  const rspMap = {}

  if (lookupMode === 'ITEMS') {
    // Already this list's own rows — selected by `groupPriceListItems`, not re-filtered.
    ;(Array.isArray(ownItems) ? ownItems : []).forEach((row) => {
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
  // Indexed alongside `priceMap`/`rspMap` so `getItemOf` is an O(1) read rather than a
  // scan of `items` sitting right next to two maps that already answered the question.
  const itemMap = new Map(items.map((item) => [item.skuCode, item]))

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
    itemMap,
    itemCount: items.length,
    activeItemCount: activeItems.length,

    createdAt: priceList.CreatedAt || '',
    updatedAt: priceList.UpdatedAt || '',
    createdBy: priceList.CreatedBy || '',
    updatedBy: priceList.UpdatedBy || '',
    _raw: priceList
  }
}

// Composable for PriceList master resource.
//
// ONCE PER APP (CORE_ARCHITECTURE_RULES §6) — see `useSkuResource` for the rationale.
const shared = defineSharedComposable((dataStore) => {
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
    const itemsByList = mode === 'ITEMS' ? groupPriceListItems(rawItems) : null

    return rawLists
      .map((pl) => enrichPriceList(pl, mode, itemsByList ? (itemsByList.get(pl.Code) || []) : [], skus))
      .filter(Boolean)
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
    return pl.itemMap.get(skuCode) || null
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
})

export function usePriceListResource() {
  return shared(useDataStore())
}
