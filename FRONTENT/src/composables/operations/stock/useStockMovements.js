/**
 * useStockMovements
 *
 * Encapsulates:
 *   - Loading active Warehouses
 *   - Loading SKUs with Products
 *   - Loading WarehouseStorages rows for a given warehouse
 *   - Submitting a batch of StockMovements in ONE GAS call
 *
 * API contract:
 *   action   = 'create'   (records[] array triggers dispatchBulkCreateRecords)
 *   resource = 'StockMovements'
 *   → GAS: dispatchBulkCreateRecords → handleStockMovementsBulkSave (PostAction)
 *   → N rows, 1 round-trip, 2 sheet opens total
 *   Batch also includes action=get WarehouseStorages so the refresh is in-band (no second
 *   round-trip). GasApiService auto-ingests the resource payload into IDB + Pinia.
 *
 * Note: action=bulk is reserved for the Bulk Upload UI (BulkUploadMasters) only.
 */

import { useQuasar } from 'quasar'
import { useDataStore } from 'src/stores/data'
import { useWorkflowStore } from 'src/stores/workflow'

export function useStockMovements() {
  const $q = useQuasar()
  const dataStore = useDataStore()
  const workflowStore = useWorkflowStore()

  async function loadWarehouses() {
    try {
      await dataStore.loadResource('Warehouses', { includeInactive: false })
      return dataStore.getRecords('Warehouses')
    } catch {
      return []
    }
  }

  async function loadSkusWithProducts() {
    try {
      await Promise.all([
        dataStore.loadResource('SKUs', { includeInactive: false }),
        dataStore.loadResource('Products', { includeInactive: false })
      ])
      const skus = dataStore.getRecords('SKUs')
      const prods = dataStore.getRecords('Products')

      const prodMap = new Map(prods.map(p => [p.Code, p.Name]))

      return skus.map(s => ({
        ...s,
        SKU: s.Code, // Alias Code as SKU for compatibility with StockEntryGrid
        ProductName: prodMap.get(s.ProductCode) || 'Unknown Product',
        label: `${s.Code} - ${prodMap.get(s.ProductCode) || 'Unknown'}`
      }))
    } catch {
      return []
    }
  }

  async function loadStoragesForWarehouse(warehouseCode, forceSync = false) {
    if (!warehouseCode) return []
    try {
      await dataStore.loadResource('WarehouseStorages', { includeInactive: true, forceSync })
      const records = dataStore.getRecords('WarehouseStorages')
      return records.filter(r => r.WarehouseCode === warehouseCode)
    } catch {
      return []
    }
  }

  /**
   * Submit all rows in ONE GAS call via action=create, resource=StockMovements, records:[].
   * GAS dispatches to handleStockMovementsBulkSave (registered PostAction).
   *
   * @param {Object} context  { warehouseCode, referenceType, referenceCode }
   * @param {Array}  rows     [{ sku, storageName, qtyChange }]
   * @param {Object} options  { notify?: boolean }
   * @returns {{ succeeded, failed, succeededRows }}
   */
  async function submitBatch(context, rows, options = {}) {
    const notify = options.notify !== false

    if (!rows.length) {
      if (notify) $q.notify({ type: 'warning', message: 'No stock changes to save.' })
      return { succeeded: 0, failed: [], succeededRows: [] }
    }

    const movementRecords = rows.map(row => ({
      WarehouseCode: context.warehouseCode,
      StorageName:   row.storageName || '',
      ReferenceType: context.referenceType || 'DirectEntry',
      ReferenceCode: context.referenceCode || '',
      SKU:           row.sku,
      QtyChange:     row.qtyChange
    }))

    try {
      const batchResult = await workflowStore.runBatchRequests([
        {
          action: 'create',
          resource: 'StockMovements',
          payload: { records: movementRecords }
        },
        {
          action: 'get',
          resource: 'WarehouseStorages',
          includeInactive: true,
          includeHeaders: true
        }
      ])

      if (!batchResult.success) {
        throw new Error(batchResult.error || batchResult.message || 'Batch operation failed')
      }

      const [createResponse] = batchResult.data || []

      const created  = createResponse?.data?.result?.created ?? 0
      const updated  = createResponse?.data?.result?.updated ?? 0
      const succeeded = created + updated
      const errors   = createResponse?.data?.result?.errors ?? []

      const failedIndices = new Set(errors.map(e => e.index))
      const succeededRows = movementRecords
        .filter((_, i) => !failedIndices.has(i))
        .map(r => ({
          sku:         r.SKU,
          storageName: r.StorageName,
          qtyChange:   r.QtyChange
        }))

      const failed = errors

      if (notify) {
        if (failed.length === 0 && succeeded > 0) {
          $q.notify({
            type: 'positive',
            message: `${succeeded} movement${succeeded !== 1 ? 's' : ''} saved.`
          })
        } else if (succeeded === 0) {
          $q.notify({ type: 'negative', message: 'All movements failed to save.' })
        } else {
          $q.notify({
            type: 'warning',
            message: `${succeeded} of ${rows.length} saved — ${failed.length} failed.`,
            caption: 'Failed: ' + failed.map(f => f.message || `row ${f.index}`).join(', ')
          })
        }
      }

      // After a successful batch, WarehouseStorages is already refreshed in-band via the
      // second batch sub-request (ingested into IDB + Pinia by GasApiService automatically).
      // No additional round-trip needed.

      return { succeeded, failed, succeededRows }
    } catch (e) {
      if (notify) $q.notify({ type: 'negative', message: 'Failed to save stock movements.' })
      return {
        succeeded: 0,
        failed: rows.map(r => ({ sku: r.sku, error: e?.message || String(e) })),
        succeededRows: []
      }
    }
  }

  return {
    loadWarehouses,
    loadSkusWithProducts,
    loadStoragesForWarehouse,
    submitBatch
  }
}
