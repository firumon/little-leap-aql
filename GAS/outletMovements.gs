// PostAction = handleOutletMovementsBulkSave. Keeps OutletStorages in step with the OutletMovements ledger.

function handleOutletMovementsBulkSave_afterBulk(payload, result, auth, action, meta, resourceName) {
  try {
    if (!result || result.success === false) return result;
    var records = meta && Array.isArray(meta.savedRecords) ? meta.savedRecords : (payload && Array.isArray(payload.records) ? payload.records : []);
    applyBatchOutletMovementsToOutletStorages(records, auth);
  } catch (e) {
    Logger.log('handleOutletMovementsBulkSave_afterBulk ERROR: ' + String(e));
  }
  return result;
}

function handleOutletMovementsBulkSave_afterCreate(payload, result, auth, action, meta, resourceName) {
  try {
    if (!result || result.success === false) return result;
    var record = meta && meta.savedRecord ? meta.savedRecord : (payload && payload.record ? payload.record : null);
    if (record) applyOutletMovementToOutletStorages(record, auth);
  } catch (e) {
    Logger.log('handleOutletMovementsBulkSave_afterCreate ERROR: ' + String(e));
  }
  return result;
}

function applyOutletMovementToOutletStorages(record, auth) {
  if (!record) return { success: true, skipped: true };
  return applyBatchOutletMovementsToOutletStorages([record], auth);
}

// Zero and negative balances are kept as rows so delta reads carry them to the app.
function applyBatchOutletMovementsToOutletStorages(records, auth) {
  try {
    if (!Array.isArray(records) || !records.length) return { success: true, skipped: true };
    var aggregates = {};
    records.forEach(function (rec) {
      if (!rec || (rec.Status && rec.Status !== 'Active')) return;
      var outletCode = (rec.OutletCode || '').toString().trim();
      var sku = (rec.SKU || '').toString().trim();
      var qtyChange = Number(rec.QtyChange);
      if (!outletCode || !sku || !Number.isFinite(qtyChange) || qtyChange === 0) return;
      var key = outletCode + '|' + sku;
      if (!aggregates[key]) aggregates[key] = { outletCode: outletCode, sku: sku, qtyChange: 0 };
      aggregates[key].qtyChange += qtyChange;
    });

    var keys = Object.keys(aggregates);
    if (!keys.length) return { success: true, skipped: true };

    var resource = openResourceSheet('OutletStorages');
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
        if ((values[i][idx.OutletCode] || '').toString().trim() === entry.outletCode &&
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
        if (idx.Code !== undefined) newRow[idx.Code] = generateNextCode(values.concat(newRows), idx, (config.codePrefix || 'OST').toString().trim(), config.codeSequenceLength || 7);
        if (idx.OutletCode !== undefined) newRow[idx.OutletCode] = entry.outletCode;
        if (idx.SKU !== undefined) newRow[idx.SKU] = entry.sku;
        if (idx.Quantity !== undefined) newRow[idx.Quantity] = entry.qtyChange;
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
      updateResourceSyncCursor('OutletStorages', now);
    }
    return { success: true };
  } catch (e) {
    Logger.log('applyBatchOutletMovementsToOutletStorages ERROR: ' + String(e));
    return { success: false, error: String(e) };
  }
}
