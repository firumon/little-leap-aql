// PostAction = handleStockMovementsBulkSave. Keeps WarehouseStorages in step with the StockMovements ledger.

function handleStockMovementsBulkSave_afterBulk(payload, result, auth, action, meta, resourceName) {
  try {
    var records = meta && Array.isArray(meta.savedRecords)
      ? meta.savedRecords
      : (payload && Array.isArray(payload.records) ? payload.records : []);
    applyBatchStockMovementsToWarehouseStorages(records.map(toStorageMovement), auth);
  } catch (e) {
    Logger.log('handleStockMovementsBulkSave_afterBulk ERROR: ' + String(e));
  }
}

function handleStockMovementsBulkSave_afterCreate(payload, result, auth, action, meta, resourceName) {
  try {
    var record = meta && meta.savedRecord ? meta.savedRecord : null;
    if (record) applyStockMovementToWarehouseStorages(record, auth);
  } catch (e) {
    Logger.log('handleStockMovementsBulkSave_afterCreate ERROR: ' + String(e));
  }
}

function toStorageMovement(rec) {
  return { warehouseCode: rec.WarehouseCode, storageName: rec.StorageName, sku: rec.SKU, qtyChange: rec.QtyChange };
}

function applyStockMovementToWarehouseStorages(record, auth) {
  try {
    if (!record) return { success: true, skipped: true };
    applyBatchStockMovementsToWarehouseStorages([toStorageMovement(record)], auth);
    return { success: true };
  } catch (e) {
    Logger.log('applyStockMovementToWarehouseStorages ERROR: ' + String(e) + ' | record=' + JSON.stringify(record));
    return { success: false, error: String(e) };
  }
}

// Zero and negative balances are kept as rows so delta reads carry them to the app.
function applyBatchStockMovementsToWarehouseStorages(records, auth) {
  var aggregates = {};
  (records || []).forEach(function (rec) {
    if (!rec) return;
    var warehouseCode = (rec.warehouseCode || '').toString().trim();
    var storageName = (rec.storageName || '').toString().trim();
    var sku = (rec.sku || '').toString().trim();
    var qtyChange = Number(rec.qtyChange);
    if (!warehouseCode || !storageName || !sku || !Number.isFinite(qtyChange) || qtyChange === 0) return;
    var key = warehouseCode + '|' + storageName + '|' + sku;
    if (!aggregates[key]) aggregates[key] = { warehouseCode: warehouseCode, storageName: storageName, sku: sku, qtyChange: 0 };
    aggregates[key].qtyChange += qtyChange;
  });

  var keys = Object.keys(aggregates);
  if (!keys.length) return;

  var resource = openResourceSheet('WarehouseStorages');
  var sheet = resource.sheet;
  var config = resource.config;
  var values = sheet.getDataRange().getValues();
  var headers = values[0] || [];
  var idx = getHeaderIndexMap(headers);
  var updatedRows = {};
  var newRows = [];
  var now = Date.now();
  var userId = auth && auth.user ? (auth.user.UserID || '') : '';

  keys.forEach(function (key) {
    var entry = aggregates[key];
    if (!entry.qtyChange) return;
    var matchedIndex = -1;
    for (var i = 1; i < values.length; i++) {
      if ((values[i][idx.WarehouseCode] || '').toString().trim() === entry.warehouseCode &&
          (values[i][idx.StorageName] || '').toString().trim() === entry.storageName &&
          (values[i][idx.SKU] || '').toString().trim() === entry.sku) {
        matchedIndex = i;
        break;
      }
    }
    if (matchedIndex !== -1) {
      var existing = values[matchedIndex].slice();
      var nextQty = Number(existing[idx.Quantity] || 0) + entry.qtyChange;
      existing[idx.Quantity] = nextQty;
      if (idx.UpdatedAt !== undefined) existing[idx.UpdatedAt] = now;
      if (idx.Revision !== undefined) {
        var curRev = Number(existing[idx.Revision]);
        existing[idx.Revision] = (!curRev || isNaN(curRev) || curRev < 0) ? 1 : curRev + 1;
      }
      if (idx.UpdatedBy !== undefined) existing[idx.UpdatedBy] = userId;
      updatedRows[matchedIndex] = existing;
    } else {
      var newRow = new Array(headers.length).fill('');
      if (idx.Code !== undefined) newRow[idx.Code] = generateNextCode(values.concat(newRows), idx, (config.codePrefix || 'LOC').toString().trim(), config.codeSequenceLength || 5);
      if (idx.WarehouseCode !== undefined) newRow[idx.WarehouseCode] = entry.warehouseCode;
      if (idx.StorageName !== undefined) newRow[idx.StorageName] = entry.storageName;
      if (idx.SKU !== undefined) newRow[idx.SKU] = entry.sku;
      if (idx.Quantity !== undefined) newRow[idx.Quantity] = entry.qtyChange;
      applyAccessRegionOnWrite(newRow, idx, auth);
      applyAuditFields(newRow, idx, auth, config, true);
      if (idx.UpdatedAt !== undefined) newRow[idx.UpdatedAt] = now;
      if (idx.Revision !== undefined) newRow[idx.Revision] = 1;
      newRows.push(newRow);
    }
  });

  Object.keys(updatedRows).forEach(function (rowIndexText) {
    var rowIndex = parseInt(rowIndexText, 10);
    sheet.getRange(rowIndex + 1, 1, 1, headers.length).setValues([updatedRows[rowIndex]]);
  });
  if (newRows.length) sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, headers.length).setValues(newRows);

  if (Object.keys(updatedRows).length || newRows.length) {
    updateResourceSyncCursor('WarehouseStorages', now);
  }
}
