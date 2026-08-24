/**
 * OutletDeliveries › setup-free row access — Layer 2.
 *
 * ── WHY THIS EXISTS ──
 * Half this module's decisions are about rows that do NOT belong to `OutletDeliveries`: a
 * manifest's lines live on `OutletRestockItems`, and their outlets on `OutletRestocks`. The
 * places that need them most — Index widgets, `PageAction` handlers, `ResourceAction` gates
 * — are JS modifiers, which run OUTSIDE any component `setup()`.
 *
 * `useRecord()` cannot serve them: it calls `useQuasar()`, `useResourceConfig()` and
 * `useRouteConfig()`, all of which require an active component instance or the current
 * route. Calling it from a modifier is a runtime failure a build will never catch, which is
 * exactly why no pre-existing modifier in this codebase does. This module is the sanctioned
 * alternative.
 *
 * ── WHY IT MAY TOUCH THE DATA STORE ──
 * It is a RESOURCE AGGREGATE, not a payload builder. §9.6's "no store" rule binds builders,
 * which must stay declarative; a resource aggregate owning store-backed reads is the shape
 * `useWarehouseStorageResource` and `usePriceListResource` already use, and it is what lets
 * a modifier obey §6.1's "may only import UI/Resource Composables" instead of reaching for
 * a store itself.
 *
 * ── READ-ONLY, AND HONEST ABOUT IT ──
 * `getRecords` reads the CACHE. It never fetches, so a caller gets whatever the app has
 * already loaded. That is correct for a widget — an empty result renders nothing rather
 * than a wrong number — but it means a page that needs these sheets must load them itself.
 * `Index/PreloadRows.vue` does that for the Index; the write pages do it through their own
 * relays.
 */

import { useDataStore } from 'src/stores/data'

const RESTOCK_ITEMS = 'OutletRestockItems'
const RESTOCKS = 'OutletRestocks'
const DELIVERIES = 'OutletDeliveries'

/** Every resource this module's cross-resource logic reads. One list, so a preloader and
 *  a reader cannot disagree about what "loaded" means. */
export const DELIVERY_SUPPORT_RESOURCES = [DELIVERIES, RESTOCK_ITEMS, RESTOCKS]

const text = (value) => (value == null ? '' : String(value).trim())

/** All `OutletRestockItems` rows currently in cache. Safe outside setup. */
export function restockItemRows () {
  return useDataStore().getRecords(RESTOCK_ITEMS) || []
}

/** All `OutletRestocks` rows currently in cache. Safe outside setup. */
export function restockRows () {
  return useDataStore().getRecords(RESTOCKS) || []
}

/** All `OutletDeliveries` rows currently in cache. Safe outside setup. */
export function deliveryRows () {
  return useDataStore().getRecords(DELIVERIES) || []
}

/**
 * Just the item rows a given manifest carries.
 *
 * Narrowed here rather than by each caller, so the predicates that measure
 * delivered-against-total always see the same set — and so the work stays proportional to
 * the run rather than to the tenant's whole item sheet.
 *
 * Takes the CODES rather than the record, because the caller has already parsed them
 * through `orsisForDelivery` and re-parsing would be a second reading of the CSV.
 */
export function itemRowsForCodes (codes = []) {
  const wanted = new Set((Array.isArray(codes) ? codes : []).map(text).filter(Boolean))
  if (!wanted.size) return []
  return restockItemRows().filter((row) => wanted.has(text(row?.Code)))
}

/**
 * `Map<restockCode, outletCode>` — a line's only route to an outlet.
 *
 * Built in ONE pass and handed back whole, because every consumer needs `O(1)` reads into it
 * from inside a loop over lines; a `.find()` per line would be `O(n×m)` over the two largest
 * sheets in the system (ARCHITECTURE RULES §6).
 */
export function outletCodeByRestock () {
  const map = new Map()
  for (const row of restockRows()) {
    const code = text(row?.Code)
    if (code) map.set(code, text(row?.OutletCode))
  }
  return map
}

// Composable shape for setup-context callers. Same functions, one import (§5).
export function useDeliveryRows () {
  return {
    DELIVERY_SUPPORT_RESOURCES,
    restockItemRows,
    restockRows,
    deliveryRows,
    itemRowsForCodes,
    outletCodeByRestock
  }
}
