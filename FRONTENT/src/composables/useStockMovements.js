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
 *
 * Note: action=bulk is reserved for the Bulk Upload UI (BulkUploadMasters) only.
 */

import { useQuasar } from 'quasar'
import { callGasApi } from 'src/services/gasApi'
import { fetchResourceRecords, ensureHeaders } from 'src/services/resourceRecords'
import { upsertResourceRows, setResourceMeta } from 'src/utils/db'

export function useStockMovements() {
  const $q = useQuasar()

  async function loadWarehouses() {
    try {
      const result = await fetchResourceRecords('Warehouses', { includeInactive: false })
      return Array.isArray(result?.records) ? result.records : []
    } catch {
      return []
    }
  }

  async function loadSkusWithProducts() {
    try {
      const [skusRes, prodsRes] = await Promise.all([
        fetchResourceRecords('SKUs', { includeInactive: false }),
        fetchResourceRecords('Products', { includeInactive: false })
      ])
      const skus = Array.isArray(skusRes?.records) ? skusRes.records : []
      const prods = Array.isArray(prodsRes?.records) ? prodsRes.records : []

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
      const result = await fetchResourceRecords('WarehouseStorages', { includeInactive: true, forceSync })
      const records = Array.isArray(result?.records) ? result.records : []
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

    const requests = [
      {
        action: 'create',
        scope: 'operation',
        resource: 'StockMovements',
        records: movementRecords
      },
      {
        action: 'get',
        scope: 'operation',
        resource: 'WarehouseStorages',
        includeInactive: true
      }
    ]

    try {
      const batchResult = await callGasApi('batch', { requests }, { showLoading: true, successMessage: null, showError: false })

      if (!batchResult.success) {
        throw new Error(batchResult.message || 'Batch operation failed')
      }

      const [createResponse, getResponse] = batchResult.data

      const created  = createResponse?.data?.created ?? 0
      const updated  = createResponse?.data?.updated ?? 0
      const succeeded = created + updated
      const errors   = createResponse?.data?.errors  ?? []

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

      // Update local IDB cache using locally-known headers (no response-header dependency)
      if (getResponse && getResponse.success && Array.isArray(getResponse.rows)) {
        const localHeaders = await ensureHeaders('WarehouseStorages')
        if (localHeaders.length) {
          const rowsForIdb = getResponse.rows.length === 0 || Array.isArray(getResponse.rows[0])
            ? getResponse.rows
            : getResponse.rows.map((r) => localHeaders.map((h) => r?.[h]))
          const written = await upsertResourceRows('WarehouseStorages', localHeaders, rowsForIdb)
          if (written > 0) {
            const nextCursor = Number(getResponse?.meta?.lastSyncAt) || Date.now()
            await setResourceMeta('WarehouseStorages', {
              headers: localHeaders,
              lastSyncAt: nextCursor,
              hasHydratedOnce: true
            })
          }
        }
        // If local headers unavailable OR upsert did not write, do NOT advance the cursor.
        // The caller's subsequent fetchData() will handle re-hydration via the normal sync path.
      }

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
