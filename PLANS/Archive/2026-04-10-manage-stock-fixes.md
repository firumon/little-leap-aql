# PLAN: Manage Stock Batch Sync & Cleanup Fixes

**Status**: DONE
**Created**: 2026-04-10
**Created By**: Brain Agent (Assistant)
**Executed By**: Build Agent (Assistant)

## Objective
Address three issues discovered during the Manage Stock batch sync implementation:
1. **Frontend Cache Refresh Failure**: `WarehouseStorages` data returned from the batch API is not saving to IndexedDB because `getResponse.meta.headers` is undefined.
2. **Zero-Quantity Row Cleanup**: `WarehouseStorages` rows that reach 0 quantity are cluttering the database. They should be deleted during the backend hook execution.
3. **URL Clean-up**: Remove `?referenceType=DirectEntry` from the "Manual Stock Entry" menu route definition in `GAS/syncAppResources.gs` so the URL stays clean.

## Context
- The `batch` API successfully returns updated `WarehouseStorages` rows, but `useStockMovements.js` fails to write them to `src/utils/db.js` because it expects headers in the response metadata.
- When stock is reduced to 0, the backend hook (`applyBatchStockMovementsToWarehouseStorages` and `applyStockMovementToWarehouseStorages`) currently just updates the quantity to 0. We want to remove these rows to keep the sheet lean.
- The `StockMovements` ledger already provides full historical tracking, so 0-qty summary rows are unnecessary.
- Deleting rows in Google Sheets must be done in reverse order (bottom-up) to avoid index-shifting bugs.

## Design Spec

### 1. Frontend: Fix IDB Cache Update
- Modify `FRONTENT/src/composables/useStockMovements.js` -> `submitBatch()`.
- Instead of reading `getResponse.meta.headers`, fetch the local headers via `ensureHeaders('WarehouseStorages')` (or similar utility, or read them from `meta` if we can guarantee they exist).
- Wait, the easiest fix is to just call `fetchResourceRecords('WarehouseStorages', { forceSync: true })` inside `submitBatch` if the batch response lacks headers, OR fix the batch response to include headers if it's the first time.
- Actually, the best fix is to use the existing `syncMasterResourcesBatch` or simply rely on `ensureHeaders` from `resourceRecords.js`. Since `useStockMovements.js` cannot easily access private functions from `resourceRecords.js`, we can just dispatch a background `fetchResourceRecords('WarehouseStorages', { forceSync: true })` after the batch completes!
- *Refined Plan*: Revert the custom IDB logic in `submitBatch()`. Instead, if `batchResult.success` is true, call `fetchResourceRecords('WarehouseStorages', { forceSync: true })` to guarantee the local DB is fully synchronized using the robust, existing sync engine. This ensures headers, cursors, and rows are all handled correctly.

### 2. Backend: Zero-Quantity Deletion
- Modify `GAS/stockMovements.gs` -> `applyBatchStockMovementsToWarehouseStorages`.
- Track rows whose `Quantity` becomes `<= 0`.
- Instead of adding them to `updatedRows`, collect their original 1-based sheet row numbers into a `rowsToDelete` array.
- After all `setValues` writes are complete, sort `rowsToDelete` in descending order.
- Loop through `rowsToDelete` and call `sheet.deleteRow(rowNum)`.
- Do the exact same logic for `applyStockMovementToWarehouseStorages` (the single-record hook): if `currentQty + qtyChange <= 0`, call `sheet.deleteRow(matchedRowNumber)`.

### 3. Backend: URL Cleanup
- Modify `GAS/syncAppResources.gs` -> `APP_RESOURCES_CODE_CONFIG` -> `StockMovements` entry.
- Change: `route: '/operations/manage-stock?referenceType=DirectEntry'`
- To: `route: '/operations/manage-stock'`

## Pre-Conditions
- All files are accessible.

## Steps

### Step 1: Fix Backend Hooks (Zero-Quantity Deletion)
- [x] Edit `GAS/stockMovements.gs` -> `applyStockMovementToWarehouseStorages`. If `currentQty + qtyChange <= 0`, delete the row.
- [x] Edit `GAS/stockMovements.gs` -> `applyBatchStockMovementsToWarehouseStorages`. Collect rows becoming `<= 0`, sort descending, delete them at the end.

### Step 2: Fix URL Configuration
- [x] Edit `GAS/syncAppResources.gs` and remove `?referenceType=DirectEntry`.

### Step 3: Fix Frontend Cache Refresh
- [x] Edit `FRONTENT/src/composables/useStockMovements.js` -> `submitBatch()`.
- [x] Remove the manual `upsertResourceRows` and `setResourceMeta` block.
- [x] Add `await fetchResourceRecords('WarehouseStorages', { forceSync: true })` after the batch completes successfully to guarantee a robust, full-schema local IDB update.
- [x] Remove unused imports `upsertResourceRows, setResourceMeta` from the top of the file.

## Post-Execution Notes (Build Agent fills this)

### Progress Log
- [x] Step 1 completed
- [x] Step 2 completed
- [x] Step 3 completed

### Deviations / Decisions
- I am also removing the redundant `WarehouseStorages` read from the batch request inside `submitBatch()`, as we will rely on the `fetchResourceRecords(..., {forceSync: true})` right after execution, which properly handles IndexedDB cache syncing. Thus, the batch only contains the single creation array again.

### Files Actually Changed
- `GAS/stockMovements.gs`
- `GAS/syncAppResources.gs`
- `FRONTENT/src/composables/useStockMovements.js`
- `PLANS/2026-04-10-manage-stock-fixes.md`
