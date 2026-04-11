/**
 * ============================================================
 * AQL - Stock Movements Hooks
 * ============================================================
 * Side-effect hook functions for the StockMovements resource.
 * These are NOT write handlers — writing ledger rows is handled by the
 * generic handleBulkUpsertRecords / handleMasterCreateRecord machinery.
 *
 * PostAction = 'handleStockMovementsBulkSave'
 *
 *   Bulk  (action=create, records: []):
 *     dispatchBulkCreateRecords → handleBulkUpsertRecords (writes rows)
 *     → dispatchAfterBulkHook  → handleStockMovementsBulkSave_afterBulk(records, auth)
 *
 *   Single create (action=create, record: {}):
 *     handleMasterCreateRecord (writes row)
 *     → dispatchAfterCreateHook → handleStockMovementsBulkSave_afterCreate(record, auth)
 *
 * Both hooks only update WarehouseStorages — they never write to StockMovements.
 * Rule: Functions here must NEVER throw to the caller.
 * ============================================================
 */

// ---------------------------------------------------------------------------
// BULK AFTER-HOOK — called by dispatchAfterBulkHook after bulk array write
// ---------------------------------------------------------------------------

/**
 * Naming convention: {PostAction}_afterBulk(records, auth)
 * Called by dispatchAfterBulkHook in masterApi.gs after bulk StockMovements rows are written.
 * Responsibility: update WarehouseStorages totals for all affected locations.
 *
 * @param {Array}  records - The original records[] from the payload
 *   [{ WarehouseCode, StorageName, SKU, QtyChange, ... }]
 * @param {Object} auth
 */
function handleStockMovementsBulkSave_afterBulk(records, auth) {
  try {
    var storageRecords = [];
    for (var i = 0; i < records.length; i++) {
      var rec = records[i];
      var warehouseCode = (rec.WarehouseCode || '').toString().trim();
      var storageName   = (rec.StorageName   || '').toString().trim();
      var sku           = (rec.SKU           || '').toString().trim();
      var qtyChange     = Number(rec.QtyChange);
      if (warehouseCode && sku && Number.isFinite(qtyChange) && qtyChange !== 0) {
        storageRecords.push({ warehouseCode: warehouseCode, storageName: storageName, sku: sku, qtyChange: qtyChange });
      }
    }
    if (storageRecords.length) {
      applyBatchStockMovementsToWarehouseStorages(storageRecords, auth);
    }
  } catch (e) {
    Logger.log('handleStockMovementsBulkSave_afterBulk ERROR: ' + String(e));
    // Do NOT throw — ledger rows are already committed
  }
}

// ---------------------------------------------------------------------------
// SINGLE-CREATE HOOK — called by dispatchAfterCreateHook after each single create
// ---------------------------------------------------------------------------

/**
 * Naming convention: {postAction}_afterCreate
 * Called by dispatchAfterCreateHook in masterApi.gs after a single StockMovements row is written.
 *
 * @param {Object} record - Plain row object (headers as keys)
 * @param {Object} auth   - Auth context
 */
function handleStockMovementsBulkSave_afterCreate(record, auth) {
  try {
    applyStockMovementToWarehouseStorages(record, auth);
  } catch (e) {
    Logger.log('handleStockMovementsBulkSave_afterCreate ERROR: ' + String(e));
    // Do NOT throw — ledger row is already committed
  }
}

// ---------------------------------------------------------------------------
// INTERNAL HELPERS
// ---------------------------------------------------------------------------

/**
 * Upserts a single WarehouseStorages row for a given stock movement.
 * Called by handleStockMovementsBulkSave_afterCreate (single-record path).
 *
 * @param {Object} record - Plain object with at minimum:
 *   WarehouseCode, StorageName, SKU, QtyChange
 * @param {Object} auth
 * @returns {{ success: boolean, skipped?: boolean, error?: string }}
 */
function applyStockMovementToWarehouseStorages(record, auth) {
  try {
    var warehouseCode = (record.WarehouseCode || '').toString().trim();
    var storageName   = (record.StorageName   || '').toString().trim();
    var sku           = (record.SKU           || '').toString().trim();
    var qtyChange     = Number(record.QtyChange);

    if (!warehouseCode || !storageName || !sku) {
      Logger.log('applyStockMovementToWarehouseStorages: skipping — missing required fields. record=' + JSON.stringify(record));
      return { success: true, skipped: true };
    }
    if (qtyChange === 0 || isNaN(qtyChange)) {
      Logger.log('applyStockMovementToWarehouseStorages: skipping — QtyChange is 0 or NaN.');
      return { success: true, skipped: true };
    }

    var resource  = openResourceSheet('WarehouseStorages');
    var sheet     = resource.sheet;
    var config    = resource.config;
    var lastRow   = sheet.getLastRow();
    var headers, values;

    if (lastRow < 1) {
      headers = [];
      values  = [];
    } else {
      values  = sheet.getDataRange().getValues();
      headers = values[0] || [];
    }

    var idx = getHeaderIndexMap(headers);

    // Find matching row
    var matchedRowNumber = -1;
    for (var i = 1; i < values.length; i++) {
      var row = values[i];
      if ((row[idx.WarehouseCode] || '').toString().trim() === warehouseCode &&
          (row[idx.StorageName]   || '').toString().trim() === storageName &&
          (row[idx.SKU]           || '').toString().trim() === sku) {
        matchedRowNumber = i + 1;
        break;
      }
    }

    var now    = Date.now();
    var userId = auth && auth.user ? (auth.user.UserID || '') : '';

    if (matchedRowNumber !== -1) {
      var existingRow = sheet.getRange(matchedRowNumber, 1, 1, headers.length).getValues()[0];
      var currentQty  = Number(existingRow[idx.Quantity] || 0);
      var newQty      = currentQty + qtyChange;

      if (newQty <= 0) {
        // Delete the row if it hits 0 or below
        sheet.deleteRow(matchedRowNumber);
      } else {
        // Update the row
        existingRow[idx.Quantity] = newQty;
        if (idx.UpdatedAt !== undefined) existingRow[idx.UpdatedAt] = now;
        if (idx.UpdatedBy !== undefined) existingRow[idx.UpdatedBy] = userId;
        sheet.getRange(matchedRowNumber, 1, 1, headers.length).setValues([existingRow]);
      }
    } else if (qtyChange > 0) {
      // Only insert a new row if qtyChange is positive — don't create zero/negative stock
      var rowData = new Array(headers.length).fill('');
      var codePrefix    = (config.codePrefix || 'LOC').toString().trim();
      var codeSeqLength = config.codeSequenceLength || 5;
      rowData[idx.Code] = generateNextCode(values, idx, codePrefix, codeSeqLength);
      if (idx.WarehouseCode !== undefined) rowData[idx.WarehouseCode] = warehouseCode;
      if (idx.StorageName   !== undefined) rowData[idx.StorageName]   = storageName;
      if (idx.SKU           !== undefined) rowData[idx.SKU]           = sku;
      if (idx.Quantity      !== undefined) rowData[idx.Quantity]      = qtyChange;
      applyAccessRegionOnWrite(rowData, idx, auth);
      applyAuditFields(rowData, idx, auth, config, true);
      sheet.getRange(sheet.getLastRow() + 1, 1, 1, headers.length).setValues([rowData]);
    }

    updateResourceSyncCursor('WarehouseStorages');
    return { success: true };

  } catch (e) {
    Logger.log('applyStockMovementToWarehouseStorages ERROR: ' + String(e) + ' | record=' + JSON.stringify(record));
    return { success: false, error: String(e) };
  }
}

/**
 * Bulk-upsert WarehouseStorages for a list of stock movements.
 * Opens the sheet ONCE, applies all changes in memory, writes in minimal setValues calls.
 * Called by handleStockMovementsBulkSave (bulk path).
 *
 * @param {Array}  records - [{ warehouseCode, storageName, sku, qtyChange }]
 * @param {Object} auth
 */
function applyBatchStockMovementsToWarehouseStorages(records, auth) {
  var resource = openResourceSheet('WarehouseStorages');
  var sheet    = resource.sheet;
  var config   = resource.config;

  var values  = sheet.getDataRange().getValues();
  var headers = values[0] || [];
  var idx     = getHeaderIndexMap(headers);

  var codePrefix = (config.codePrefix || 'LOC').toString().trim();
  var codeSeqLen = config.codeSequenceLength || 5;
  var now        = Date.now();
  var userId     = auth && auth.user ? (auth.user.UserID || '') : '';

  // updatedRows: sparse map of row-index-in-values → updated row array
  var updatedRows   = {};
  var newRows       = [];
  var rowsToDelete  = []; // Stores 1-based row numbers to be deleted
  var currentValues = values.slice(); // working copy for lookups + code generation

  for (var r = 0; r < records.length; r++) {
    var rec           = records[r];
    var warehouseCode = (rec.warehouseCode || '').toString().trim();
    var storageName   = (rec.storageName   || '').toString().trim();
    var sku           = (rec.sku           || '').toString().trim();
    var qtyChange     = Number(rec.qtyChange);

    if (!warehouseCode || !storageName || !sku || !Number.isFinite(qtyChange) || qtyChange === 0) continue;

    // Scan in-memory first so same-batch duplicates accumulate correctly
    var matchedIndex = -1;
    for (var i = 1; i < currentValues.length; i++) {
      var row = updatedRows[i] || currentValues[i];
      if ((row[idx.WarehouseCode] || '').toString().trim() === warehouseCode &&
          (row[idx.StorageName]   || '').toString().trim() === storageName &&
          (row[idx.SKU]           || '').toString().trim() === sku) {
        matchedIndex = i;
        break;
      }
    }

    if (matchedIndex !== -1) {
      var existing = (updatedRows[matchedIndex] || currentValues[matchedIndex]).slice();
      existing[idx.Quantity] = Number(existing[idx.Quantity] || 0) + qtyChange;
      if (idx.UpdatedAt !== undefined) existing[idx.UpdatedAt] = now;
      if (idx.UpdatedBy !== undefined) existing[idx.UpdatedBy] = userId;

      if (existing[idx.Quantity] <= 0) {
        // Mark for deletion and remove from memory so subsequent ops on same batch don't find it
        rowsToDelete.push(matchedIndex + 1); // Convert to 1-based sheet row number
        currentValues[matchedIndex] = new Array(headers.length).fill(''); // Blank out memory
        if (updatedRows[matchedIndex]) {
          delete updatedRows[matchedIndex];
        }
      } else {
        updatedRows[matchedIndex] = existing;
      }
    } else {
      var newRow  = new Array(headers.length).fill('');
      var newCode = generateNextCode(currentValues, idx, codePrefix, codeSeqLen);
      if (idx.Code          !== undefined) newRow[idx.Code]          = newCode;
      if (idx.WarehouseCode !== undefined) newRow[idx.WarehouseCode] = warehouseCode;
      if (idx.StorageName   !== undefined) newRow[idx.StorageName]   = storageName;
      if (idx.SKU           !== undefined) newRow[idx.SKU]           = sku;
      if (idx.Quantity      !== undefined) newRow[idx.Quantity]      = qtyChange;

      if (qtyChange > 0) { // Don't insert negative/zero new records
        applyAccessRegionOnWrite(newRow, idx, auth);
        applyAuditFields(newRow, idx, auth, config, true);
        newRows.push(newRow);
        currentValues.push(newRow); // visible to subsequent iterations in this batch
      }
    }
  }

  // Write changed existing rows (scattered positions — individual setValues per row)
  var updatedIndices = Object.keys(updatedRows);
  for (var j = 0; j < updatedIndices.length; j++) {
    var rowIndex    = parseInt(updatedIndices[j], 10);
    var sheetRowNum = rowIndex + 1; // values[] is 0-indexed; sheet rows are 1-indexed
    sheet.getRange(sheetRowNum, 1, 1, headers.length).setValues([updatedRows[rowIndex]]);
  }

  // Append all new rows in one block
  if (newRows.length) {
    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, newRows.length, headers.length).setValues(newRows);
  }

  // Delete rows that dropped to 0 or below
  // IMPORTANT: Must sort in descending order to avoid index shift when deleting
  if (rowsToDelete.length > 0) {
    rowsToDelete.sort(function(a, b) { return b - a; });

    // Deduplicate array just in case multiple batch ops hit the same row
    var uniqueRowsToDelete = [];
    for (var d = 0; d < rowsToDelete.length; d++) {
      if (uniqueRowsToDelete.indexOf(rowsToDelete[d]) === -1) {
        uniqueRowsToDelete.push(rowsToDelete[d]);
      }
    }

    for (var k = 0; k < uniqueRowsToDelete.length; k++) {
      sheet.deleteRow(uniqueRowsToDelete[k]);
    }
  }

  if (updatedIndices.length || newRows.length || rowsToDelete.length > 0) {
    updateResourceSyncCursor('WarehouseStorages');
  }
}
