/**
 * ============================================================
 * AQL - Procurement PostAction Hooks
 * ============================================================
 * PostAction handlers for PurchaseRequisitions and linked Procurements.
 * Hooks follow the centralized dispatch contract:
 *   payload, result, auth, action, meta, resourceName
 * ============================================================
 */

var PROCUREMENT_RESOURCE_NAME = 'Procurements';
var PURCHASE_REQUISITIONS_RESOURCE_NAME = 'PurchaseRequisitions';

/**
 * PostAction fallback for PurchaseRequisitions.
 * Runs after supported actions when the resource config sets:
 *   PostAction = 'handlePurchaseRequisitionPostAction'
 *
 * Current responsibilities:
 * - Create a linked Procurement the first time a PR reaches Progress = New.
 * - Keep the linked Procurement progress aligned for key PR transitions.
 *
 * @param {Object} payload
 * @param {Object} result
 * @param {Object} auth
 * @param {string} action
 * @param {Object} meta
 * @param {string} resourceName
 */
function handlePurchaseRequisitionPostAction(payload, result, auth, action, meta, resourceName) {
  try {
    if (!result || result.success !== true) return result;

    var prRecord = resolvePurchaseRequisitionPostActionRecord(payload, meta);
    if (!prRecord || !prRecord.Code) return result;

    var progress = (prRecord.Progress || '').toString().trim();
    var procurementCode = (prRecord.ProcurementCode || '').toString().trim();

    if (progress === 'New' && !procurementCode) {
      var procurementRecord = createLinkedProcurementForPurchaseRequisition(prRecord, auth);
      if (procurementRecord && procurementRecord.Code) {
        updateResourceRecordFieldsByCode(
          PURCHASE_REQUISITIONS_RESOURCE_NAME,
          prRecord.Code,
          { ProcurementCode: procurementRecord.Code },
          auth
        );
      }
      return result;
    }

    var targetProcurementProgress = mapPurchaseRequisitionProgressToProcurementProgress(progress);
    if (targetProcurementProgress && procurementCode) {
      updateResourceRecordFieldsByCode(
        PROCUREMENT_RESOURCE_NAME,
        procurementCode,
        { Progress: targetProcurementProgress },
        auth
      );
    }
  } catch (e) {
    Logger.log('handlePurchaseRequisitionPostAction ERROR: ' + String(e));
  }

  return result;
}

function resolvePurchaseRequisitionPostActionRecord(payload, meta) {
  if (meta && meta.savedRecord) return meta.savedRecord;
  if (meta && meta.parentRecord) return meta.parentRecord;

  var code = payload && payload.code ? payload.code.toString().trim() : '';
  if (!code && payload && payload.record && payload.record.Code) {
    code = payload.record.Code.toString().trim();
  }
  if (!code && payload && payload.data && payload.data.Code) {
    code = payload.data.Code.toString().trim();
  }
  if (!code) return null;

  var context = getResourceRecordContextByCode(PURCHASE_REQUISITIONS_RESOURCE_NAME, code);
  return context ? context.record : null;
}

function mapPurchaseRequisitionProgressToProcurementProgress(progress) {
  switch ((progress || '').toString().trim()) {
    case 'Revision Required': return 'PR_CREATED';
    case 'Approved': return 'PR_APPROVED';
    case 'Rejected': return 'CANCELLED';
    default: return '';
  }
}

function createLinkedProcurementForPurchaseRequisition(prRecord, auth) {
  var resource = openResourceSheet(PROCUREMENT_RESOURCE_NAME);
  var schema = buildMasterSchemaFromResourceConfig(resource.config);
  var sheet = resource.sheet;
  var values = sheet.getDataRange().getValues();
  var headers = values[0] || [];
  var idx = getHeaderIndexMap(headers);
  var codePrefix = (resource.config.codePrefix || '').toString().trim();
  var seqLength = resource.config.codeSequenceLength || 6;

  if (!codePrefix) {
    throw new Error('CodePrefix is missing for resource: ' + PROCUREMENT_RESOURCE_NAME);
  }

  var code = resource.config.scope === 'operation'
    ? generateNextYearScopedCode(values, idx, codePrefix, seqLength)
    : generateNextCode(values, idx, codePrefix, seqLength);

  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var rowData = buildNewMasterRow(headers, idx, {
    InitiatedDate: today,
    CreatedUser: auth && auth.user ? auth.user.name || '' : '',
    CreatedRole: auth && auth.user ? auth.user.role || '' : ''
  }, schema);
  rowData[idx.Code] = code;

  applyAccessRegionOnWrite(rowData, idx, auth);
  applyAuditFields(rowData, idx, auth, resource.config, true);
  validateRequiredFields(rowData, idx, schema.requiredHeaders, PROCUREMENT_RESOURCE_NAME);
  validateMasterUniqueness(values, idx, rowData, schema, -1, PROCUREMENT_RESOURCE_NAME);

  var targetRow = sheet.getLastRow() + 1;
  sheet.getRange(targetRow, 1, 1, headers.length).setValues([rowData]);
  updateResourceSyncCursor(PROCUREMENT_RESOURCE_NAME);

  return rowArrayToObject(headers, rowData);
}

function updateResourceRecordFieldsByCode(resourceName, code, fields, auth) {
  var context = getResourceRecordContextByCode(resourceName, code);
  if (!context) return null;

  var rowData = context.rowData.slice();
  var fieldNames = Object.keys(fields || {});
  for (var i = 0; i < fieldNames.length; i++) {
    var fieldName = fieldNames[i];
    if (context.idx[fieldName] !== undefined) {
      rowData[context.idx[fieldName]] = fields[fieldName];
    }
  }

  applyAuditFields(rowData, context.idx, auth, context.resource.config, false);
  context.sheet.getRange(context.rowNumber, 1, 1, context.headers.length).setValues([rowData]);
  updateResourceSyncCursor(resourceName);
  return rowArrayToObject(context.headers, rowData);
}

function getResourceRecordContextByCode(resourceName, code) {
  var normalizedCode = (code || '').toString().trim();
  if (!normalizedCode) return null;

  var resource = openResourceSheet(resourceName);
  var sheet = resource.sheet;
  var values = sheet.getDataRange().getValues();
  var headers = values[0] || [];
  var idx = getHeaderIndexMap(headers);
  var rowNumber = findRowByValue(sheet, idx.Code, normalizedCode, 2, true);
  if (rowNumber === -1) return null;

  var rowData = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  return {
    resource: resource,
    sheet: sheet,
    headers: headers,
    idx: idx,
    rowNumber: rowNumber,
    rowData: rowData,
    record: rowArrayToObject(headers, rowData)
  };
}
