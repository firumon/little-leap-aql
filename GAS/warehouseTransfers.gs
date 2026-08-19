/**
 * ============================================================
 * AQL - Warehouse Transfers Hooks
 * ============================================================
 * Handles business logic and StockMovements integration for:
 * - WarehouseTransfers
 * - WarehouseTransferItems
 *
 * Rules:
 * - Hooks must NEVER throw errors to the caller (use try/catch).
 * - All stock deductions and additions are written to StockMovements.
 * - Semicolons must terminate all statements.
 * ============================================================
 */

// ---------------------------------------------------------------------------
// PARENT AFTER-COMPOSITE-SAVE HOOK
// ---------------------------------------------------------------------------

function handleWarehouseTransfers_afterCompositeSave(payload, result, auth, action, meta, resourceName) {
  // All initial save stock movements and transitions are managed by the frontend composable
  return result;
}

// ---------------------------------------------------------------------------
// PARENT AFTER-EXECUTE-ACTION HOOK
// ---------------------------------------------------------------------------

function handleWarehouseTransfers_afterExecuteAction(payload, result, auth, action, meta, resourceName) {
  try {
    if (!result || result.success !== true) return result;

    var parentRecord = meta.savedRecord;
    var actionName = meta.actionName;
    if (!parentRecord || !actionName) return result;

    var wtCode = parentRecord.Code;
    var items = getWarehouseTransferItems(wtCode);

    if (actionName === 'Reject') {
      // 1. Return/reverse stock to Source Warehouse
      var returnMovements = [];
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        if (item.Progress !== 'CANCELLED') {
          returnMovements.push({
            WarehouseCode: parentRecord.SourceWarehouseCode,
            StorageName: item.SourceStorageName || '_default',
            SKU: item.SKUCode,
            QtyChange: Math.abs(Number(item.Quantity)),
            ReferenceType: 'WarehouseTransfer',
            ReferenceCode: wtCode
          });
        }
      }

      // Update items to CANCELLED
      updateWarehouseTransferItemsProgress(items, 'CANCELLED', auth);

      if (returnMovements.length > 0) {
        writeStockMovements(returnMovements, auth);
      }
    }
    else if (actionName === 'Complete' || actionName === 'ClaimAndComplete') {
      var destWH = parentRecord.DestinationWarehouseCode;
      if (!destWH) {
        Logger.log('handleWarehouseTransfers_afterExecuteAction: DestinationWarehouseCode must be set for completion.');
        return result;
      }

      var completeMovements = [];
      var itemsToUpdate = [];

      for (var j = 0; j < items.length; j++) {
        var itemToComplete = items[j];
        if (itemToComplete.Progress === 'PENDING') {
          var destStorage = itemToComplete.DestinationStorageName || '_default';
          completeMovements.push({
            WarehouseCode: destWH,
            StorageName: destStorage,
            SKU: itemToComplete.SKUCode,
            QtyChange: Math.abs(Number(itemToComplete.Quantity)),
            ReferenceType: 'WarehouseTransfer',
            ReferenceCode: wtCode
          });
          itemsToUpdate.push(itemToComplete);
        }
      }

      // Update items to TRANSFERRED
      updateWarehouseTransferItemsProgress(itemsToUpdate, 'TRANSFERRED', auth);

      if (completeMovements.length > 0) {
        writeStockMovements(completeMovements, auth);
      }
    }

  } catch (e) {
    Logger.log('handleWarehouseTransfers_afterExecuteAction ERROR: ' + String(e));
  }
  return result;
}

// ---------------------------------------------------------------------------
// CHILD ITEM AFTER-UPDATE HOOK (Item-by-item completion support)
// ---------------------------------------------------------------------------

function handleWarehouseTransferItems_afterUpdate(payload, result, auth, action, meta, resourceName) {
  try {
    if (!result || result.success !== true) return result;

    var prevRecord = meta.previousRecord;
    var savedRecord = meta.savedRecord;
    if (!prevRecord || !savedRecord) return result;

    // Check if progress transitioned from PENDING to TRANSFERRED
    if (prevRecord.Progress !== 'TRANSFERRED' && savedRecord.Progress === 'TRANSFERRED') {
      var wtCode = savedRecord.WarehouseTransferCode;
      
      // Get destination warehouse code from parent record
      var parentContext = getResourceRecordContextByCode('WarehouseTransfers', wtCode);
      if (!parentContext) return result;
      
      var parentObj = rowArrayToObject(parentContext.headers, parentContext.rowData);
      var destWH = parentObj.DestinationWarehouseCode;
      
      if (!destWH) {
        Logger.log('handleWarehouseTransferItems_afterUpdate ERROR: DestinationWarehouseCode is not set on parent WT ' + wtCode);
        return result;
      }

      // Write positive stock movement for this completed item
      var movement = {
        WarehouseCode: destWH,
        StorageName: savedRecord.DestinationStorageName || '_default',
        SKU: savedRecord.SKUCode,
        QtyChange: Math.abs(Number(savedRecord.Quantity)),
        ReferenceType: 'WarehouseTransfer',
        ReferenceCode: wtCode
      };

      writeStockMovements([movement], auth);

      // Check if all items for the parent are now TRANSFERRED or CANCELLED
      var siblingItems = getWarehouseTransferItems(wtCode);
      var allCompleted = siblingItems.every(function(item) {
        return item.Progress === 'TRANSFERRED' || item.Progress === 'CANCELLED';
      });

      if (allCompleted) {
        updateWarehouseTransferProgress(wtCode, 'COMPLETED', auth);
      }
    }

  } catch (e) {
    Logger.log('handleWarehouseTransferItems_afterUpdate ERROR: ' + String(e));
  }
  return result;
}

// ---------------------------------------------------------------------------
// GENERAL INTERNAL HELPERS
// ---------------------------------------------------------------------------

/**
 * Bulk writes StockMovements records to the sheet and triggers WarehouseStorages updates.
 */
function writeStockMovements(movements, auth) {
  if (!movements || movements.length === 0) return;

  var resource = openResourceSheet('StockMovements');
  var sheet = resource.sheet;
  var values = sheet.getDataRange().getValues();
  var headers = values[0] || [];
  var idx = getHeaderIndexMap(headers);
  var lastRow = sheet.getLastRow();

  var codePrefix = (resource.config.codePrefix || 'SM').toString().trim();
  var codeSeqLength = resource.config.codeSequenceLength || 6;

  var rowsToWrite = [];
  // Newest audit timestamp across the batch; drives the StockMovements cursor.
  var maxMovementTimestamp = 0;
  for (var i = 0; i < movements.length; i++) {
    var mov = movements[i];
    var row = new Array(headers.length).fill('');
    
    // Generate code using values already in sheet + rows generated in this loop
    row[idx.Code] = generateNextCode(values.concat(rowsToWrite), idx, codePrefix, codeSeqLength);
    row[idx.WarehouseCode] = mov.WarehouseCode;
    row[idx.StorageName] = mov.StorageName || '_default';
    row[idx.SKU] = mov.SKU;
    row[idx.QtyChange] = mov.QtyChange;
    row[idx.ReferenceType] = mov.ReferenceType;
    row[idx.ReferenceCode] = mov.ReferenceCode;
    row[idx.Status] = 'Active';

    applyAccessRegionOnWrite(row, idx, auth);
    var movementTimestamp = applyAuditFields(row, idx, auth, resource.config, true);
    if (movementTimestamp > maxMovementTimestamp) maxMovementTimestamp = movementTimestamp;
    rowsToWrite.push(row);
  }

  sheet.getRange(lastRow + 1, 1, rowsToWrite.length, headers.length).setValues(rowsToWrite);
  SpreadsheetApp.flush();
  updateResourceSyncCursor('StockMovements', maxMovementTimestamp);

  // Trigger warehouse storage balance updates
  var storageRecords = movements.map(function(mov) {
    return {
      warehouseCode: mov.WarehouseCode,
      storageName: mov.StorageName || '_default',
      sku: mov.SKU,
      qtyChange: mov.QtyChange
    };
  });
  
  applyBatchStockMovementsToWarehouseStorages(storageRecords, auth);
}

/**
 * Retrieves all items associated with a WarehouseTransfer code.
 */
function getWarehouseTransferItems(wtCode) {
  var resource = openResourceSheet('WarehouseTransferItems');
  var sheet = resource.sheet;
  var values = sheet.getDataRange().getValues();
  var headers = values[0] || [];
  var idx = getHeaderIndexMap(headers);

  var items = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if ((row[idx.WarehouseTransferCode] || '').toString().trim() === wtCode &&
        (row[idx.Status] || '').toString().trim() === 'Active') {
      var item = rowArrayToObject(headers, row);
      item._rowNumber = i + 1; // save row number for updates
      items.push(item);
    }
  }
  return items;
}

/**
 * Updates the progress of a list of WT items.
 */
function updateWarehouseTransferItemsProgress(items, progress, auth, storageField, storageValue) {
  if (!items || items.length === 0) return;

  var resource = openResourceSheet('WarehouseTransferItems');
  var sheet = resource.sheet;
  var headers = sheet.getDataRange().getValues()[0] || [];
  var idx = getHeaderIndexMap(headers);
  // Newest audit timestamp across the items touched in this progress update.
  var maxItemTimestamp = 0;

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var rowNumber = item._rowNumber;
    if (!rowNumber) continue;

    var rowData = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
    rowData[idx.Progress] = progress;

    // Stamping
    var stampSuffix = toActionHeaderSuffix(progress);
    var atField = 'Progress' + stampSuffix + 'At';
    var byField = 'Progress' + stampSuffix + 'By';
    if (idx[atField] !== undefined) rowData[idx[atField]] = formatDateTime24();
    if (idx[byField] !== undefined) rowData[idx[byField]] = auth.user.Name || auth.user.UserID;

    if (storageField && idx[storageField] !== undefined) {
      rowData[idx[storageField]] = storageValue;
    }

    var itemTimestamp = applyAuditFields(rowData, idx, auth, resource.config, false);
    if (itemTimestamp > maxItemTimestamp) maxItemTimestamp = itemTimestamp;
    sheet.getRange(rowNumber, 1, 1, headers.length).setValues([rowData]);
  }
  SpreadsheetApp.flush();
  updateResourceSyncCursor('WarehouseTransferItems', maxItemTimestamp);
}

/**
 * Updates the progress and action stamps for a WarehouseTransfer header.
 */
function updateWarehouseTransferProgress(wtCode, progress, auth, fieldsToUpdate) {
  var context = getResourceRecordContextByCode('WarehouseTransfers', wtCode);
  if (!context) return null;

  var rowData = context.rowData.slice();
  var idx = context.idx;

  rowData[idx.Progress] = progress;
  var stampSuffix = toActionHeaderSuffix(progress);
  var atField = 'Progress' + stampSuffix + 'At';
  var byField = 'Progress' + stampSuffix + 'By';
  if (idx[atField] !== undefined) rowData[idx[atField]] = formatDateTime24();
  if (idx[byField] !== undefined) rowData[idx[byField]] = auth.user.Name || auth.user.UserID;

  if (fieldsToUpdate) {
    Object.keys(fieldsToUpdate).forEach(function(k) {
      if (idx[k] !== undefined) rowData[idx[k]] = fieldsToUpdate[k];
    });
  }

  var transferTimestamp = applyAuditFields(rowData, idx, auth, context.resource.config, false);
  context.sheet.getRange(context.rowNumber, 1, 1, context.headers.length).setValues([rowData]);
  updateResourceSyncCursor('WarehouseTransfers', transferTimestamp);
  return rowArrayToObject(context.headers, rowData);
}


