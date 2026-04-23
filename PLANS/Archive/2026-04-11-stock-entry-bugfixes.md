# PLAN: Stock Entry Grid — Three Bugfixes
**Status**: COMPLETED
**Created**: 2026-04-11
**Created By**: Brain Agent (Claude Code)
**Executed By**: Build Agent (Claude Code)

## Objective
Fix three bugs in the Manual Stock Entry page:
1. Grid doesn't reload with fresh data after saving
2. Delete-only changes don't show the Save button
3. Zero-quantity rows persist in WarehouseStorages sheet (single-record path + existing stale data)

## Context
- The bulk handler `applyBatchStockMovementsToWarehouseStorages` in `GAS/stockMovements.gs` (lines 232-290) **already deletes zero-qty rows**. The bug is in the **single-record** handler `applyStockMovementToWarehouseStorages` (lines 92-167) which lacks this logic.
- The frontend `StockEntryGrid.vue` calls `fetchData()` (no forceSync) after save, which may serve stale IDB-cached data.
- The `dirtyExistingRows` computed only checks `currentQty !== originalQty`. When a row already has `Quantity: 0` in the sheet (stale data), removing it produces delta 0 → Save button never appears.
- These three issues are interconnected: fixing the backend (delete zero-qty rows) + frontend filter (don't show zero-qty) + force-sync after save resolves all three.

## Pre-Conditions
- [x] Backend bulk handler already has zero-qty deletion (no change needed there)
- [x] `StockEntryGrid.vue` and `useStockMovements.js` exist from previous plan execution

## Steps

### Step 1: Backend — Delete zero-qty rows in single-record handler
Add deletion logic to `applyStockMovementToWarehouseStorages` in `GAS/stockMovements.gs` for consistency with the bulk handler.

- [ ] In `applyStockMovementToWarehouseStorages` (around line 141-145), after computing the new quantity (`currentQty + qtyChange`), check if the result is `<= 0`:
  - If `<= 0`: **delete the row** from the sheet instead of updating it. Use `sheet.deleteRow(matchedRowNumber)`.
  - If `> 0`: update the row as currently done (existing behavior, no change).
- [ ] For the **new row insertion** path (around line 146-157): skip insertion if `qtyChange <= 0` (don't create a new row with zero/negative stock). This matches what the bulk handler already does (line 251).

**File**: `GAS/stockMovements.gs`
**Lines**: ~139-157 (the `if (matchedRowNumber !== -1)` block and the `else` block)

Current code (update path, lines 139-145):
```javascript
if (matchedRowNumber !== -1) {
  var existingRow = sheet.getRange(matchedRowNumber, 1, 1, headers.length).getValues()[0];
  var currentQty  = Number(existingRow[idx.Quantity] || 0);
  existingRow[idx.Quantity] = currentQty + qtyChange;
  if (idx.UpdatedAt !== undefined) existingRow[idx.UpdatedAt] = now;
  if (idx.UpdatedBy !== undefined) existingRow[idx.UpdatedBy] = userId;
  sheet.getRange(matchedRowNumber, 1, 1, headers.length).setValues([existingRow]);
```

Change to:
```javascript
if (matchedRowNumber !== -1) {
  var existingRow = sheet.getRange(matchedRowNumber, 1, 1, headers.length).getValues()[0];
  var currentQty  = Number(existingRow[idx.Quantity] || 0);
  var newQty = currentQty + qtyChange;
  if (newQty <= 0) {
    // Remove the row entirely — zero/negative stock has no place in WarehouseStorages
    sheet.deleteRow(matchedRowNumber);
  } else {
    existingRow[idx.Quantity] = newQty;
    if (idx.UpdatedAt !== undefined) existingRow[idx.UpdatedAt] = now;
    if (idx.UpdatedBy !== undefined) existingRow[idx.UpdatedBy] = userId;
    sheet.getRange(matchedRowNumber, 1, 1, headers.length).setValues([existingRow]);
  }
```

Current code (new row path, lines 146-157):
```javascript
} else {
  var rowData = new Array(headers.length).fill('');
  ...
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, headers.length).setValues([rowData]);
}
```

Change to — wrap the insertion in an `if (qtyChange > 0)` guard:
```javascript
} else if (qtyChange > 0) {
  var rowData = new Array(headers.length).fill('');
  ...
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, headers.length).setValues([rowData]);
}
```

**Rule**: Keep `updateResourceSyncCursor('WarehouseStorages')` call at the end — it's already there and runs regardless of path.

### Step 2: Frontend — Filter out zero-qty rows when building the grid
Even with the backend fix, old zero-qty rows may still exist in the sheet (and in IDB cache). Filter them out so they never appear in the grid.

- [ ] In `StockEntryGrid.vue`, in the `fetchData()` function (around line 195), add a filter to exclude rows with `Quantity <= 0` before mapping to `existingRows`:

Current code (line 195):
```javascript
existingRows.value = storages.map((s, idx) => {
```

Change to:
```javascript
existingRows.value = storages.filter(s => Number(s.Quantity || 0) > 0).map((s, idx) => {
```

**File**: `FRONTENT/src/components/Warehouse/StockEntryGrid.vue`
**Line**: ~195

### Step 3: Frontend — Force sync after save
After a successful save, reload data from the network (not IDB cache) to ensure the grid reflects the backend's current state.

- [ ] In `StockEntryGrid.vue`, in `saveChanges()` (around line 333-337), change `fetchData()` to `fetchData(true)`:

Current code:
```javascript
if (succeeded > 0) {
  await fetchData()
}
```

Change to:
```javascript
if (succeeded > 0) {
  await fetchData(true)
}
```

**File**: `FRONTENT/src/components/Warehouse/StockEntryGrid.vue`
**Line**: ~336

### Step 4: Deploy GAS changes
- [ ] Run `cd GAS && clasp push` to deploy the updated `stockMovements.gs`
- [ ] No new Web App deployment needed (no API contract change — same endpoints, same request/response shape)

### Step 5: (Optional) Clean up existing zero-qty rows in sheet
- [ ] Inform the user: Existing zero-qty rows in `WarehouseStorages` sheet can be manually deleted by the user (sort by Quantity, delete rows with 0). Or they will be naturally filtered out by the frontend fix in Step 2 and never re-created thanks to the backend fix in Step 1.

## Documentation Updates Required
- [ ] No doc changes needed — these are bugfixes, not new features or workflow changes.

## Acceptance Criteria
- [ ] After saving stock changes, the grid reloads and shows fresh data from the backend
- [ ] Marking a row for deletion (trash icon) → Save button appears → Save sends negative delta → row disappears from grid after reload
- [ ] Zero-quantity rows are not shown in the grid (even if they exist in the sheet)
- [ ] Backend single-record path: if qty reaches 0, row is deleted from WarehouseStorages (not left as 0)
- [ ] Backend single-record path: negative qtyChange on a non-existent row does NOT create a new row
- [ ] No regression on adding new stock or editing existing quantities

## Post-Execution Notes (Build Agent fills this)

### Progress Log
- [x] Step 1 completed (backend single-record fix) — added `qtyChange > 0` guard on new row insert
- [x] Step 2 completed (frontend filter zero-qty)
- [x] Step 3 completed (frontend force sync)
- [x] Step 4 completed (clasp push — 23 files deployed)
- [ ] Step 5 (optional) — user can manually clean existing zero-qty rows from sheet

### Deviations / Decisions

### Files Actually Changed
- `GAS/stockMovements.gs` — added `qtyChange > 0` guard on single-record new-row path
- `FRONTENT/src/components/Warehouse/StockEntryGrid.vue` — filter zero-qty rows + force sync after save

### Validation Performed
- [ ] Tested delete → save → grid reloads without zero-qty row
- [ ] Tested edit qty → save → grid reloads with updated qty
- [ ] Tested add new row → save → grid reloads with new row
- [ ] Acceptance criteria verified

### Manual Actions Required
- [ ] (Optional) User manually deletes existing zero-qty rows from WarehouseStorages sheet, or lets the frontend filter hide them
