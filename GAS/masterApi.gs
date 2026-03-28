/**
 * ============================================================
 * AQL - Master API Handlers (Generic)
 * ============================================================
 */

function handleMasterGetRecords(auth, payload) {
  const resourceName = resolveMasterResourceName(payload);
  const resource = openResourceSheet(resourceName);
  enforceMasterPermission(auth, resourceName, 'canRead');

  const includeInactive = payload && payload.includeInactive === true;
  const lastUpdatedAt = payload && payload.lastUpdatedAt ? parseDateInput(payload.lastUpdatedAt) : null;
  const headers = getSheetHeaders(resource.sheet);

  if (!headers.length) {
    return buildMasterRowsResponse(auth, resourceName, resource, [], lastUpdatedAt, []);
  }

  if (
    lastUpdatedAt &&
    resource.config.lastDataUpdatedAt &&
    lastUpdatedAt.getTime() >= resource.config.lastDataUpdatedAt
  ) {
    return buildMasterRowsResponse(auth, resourceName, resource, [], lastUpdatedAt, headers);
  }

  const values = resource.sheet.getDataRange().getValues();
  if (!values || values.length < 2) {
    return buildMasterRowsResponse(auth, resourceName, resource, [], lastUpdatedAt, headers);
  }

  const idx = getHeaderIndexMap(headers);
  const statusIdx = idx.Status;
  const updatedAtIdx = idx.UpdatedAt;
  const rows = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const status = statusIdx === undefined ? 'Active' : ((row[statusIdx] || '').toString().trim() || 'Active');

    if (!includeInactive && status !== 'Active') {
      continue;
    }

    if (lastUpdatedAt && updatedAtIdx !== undefined) {
      const updatedDate = parseDateInput(row[updatedAtIdx]);
      if (!updatedDate || updatedDate.getTime() <= lastUpdatedAt.getTime()) {
        continue;
      }
    }

    rows.push(row);
  }

  return buildMasterRowsResponse(auth, resourceName, resource, rows, lastUpdatedAt, headers);
}

function handleMasterGetMultiRecords(auth, payload) {
  const requestedResources = resolveMasterResourceNames(payload);
  if (!requestedResources.length) {
    throw new Error('Master resources are required');
  }

  const data = {};
  requestedResources.forEach(function (resourceName) {
    const singlePayload = cloneWithResource(payload, resourceName);
    const cursor = resolveMultiResourceCursor(payload, resourceName);
    if (cursor !== null && cursor !== undefined && cursor !== '') {
      singlePayload.lastUpdatedAt = cursor;
    } else {
      delete singlePayload.lastUpdatedAt;
    }
    data[resourceName] = handleMasterGetRecords(auth, singlePayload);
  });

  return {
    success: true,
    data: data,
    meta: {
      resources: requestedResources,
      lastSyncAt: Date.now()
    }
  };
}

function handleMasterCreateRecord(auth, payload) {
  const resourceName = resolveMasterResourceName(payload);
  const resource = openResourceSheet(resourceName);
  const schema = buildMasterSchemaFromResourceConfig(resource.config);
  enforceMasterPermission(auth, resourceName, 'canWrite');

  const sheet = resource.sheet;
  const values = sheet.getDataRange().getValues();
  const headers = values[0] || [];
  const idx = getHeaderIndexMap(headers);
  const providedValues = extractProvidedHeaderValues(headers, payload);

  const codePrefix = (resource.config.codePrefix || '').toString().trim();
  if (!codePrefix) {
    return { success: false, message: 'CodePrefix is missing for resource: ' + resourceName };
  }

  const seqLength = resource.config.codeSequenceLength || 6;
  const code = generateNextCode(values, idx, codePrefix, seqLength);
  const rowData = buildNewMasterRow(headers, idx, providedValues, schema);
  rowData[idx.Code] = code;

  applyAccessRegionOnWrite(rowData, idx, auth);
  applyAuditFields(rowData, idx, auth, resource.config, true);
  validateRequiredFields(rowData, idx, schema.requiredHeaders, resourceName);
  validateMasterUniqueness(values, idx, rowData, schema, -1, resourceName);

  const targetRow = sheet.getLastRow() + 1;
  sheet.getRange(targetRow, 1, 1, headers.length).setValues([rowData]);
  updateResourceSyncCursor(resourceName);

  return {
    success: true,
    message: resourceName + ' record created successfully',
    data: { code: code }
  };
}

function handleMasterUpdateRecord(auth, payload) {
  const resourceName = resolveMasterResourceName(payload);
  const resource = openResourceSheet(resourceName);
  const schema = buildMasterSchemaFromResourceConfig(resource.config);
  enforceMasterPermission(auth, resourceName, 'canUpdate');

  const sheet = resource.sheet;
  const values = sheet.getDataRange().getValues();
  const headers = values[0] || [];
  const idx = getHeaderIndexMap(headers);

  const code = sanitizeRequiredText(resolveCodeValue(payload), 'Code is required');
  const rowNumber = findRowByValue(sheet, idx.Code, code, 2, true);
  if (rowNumber === -1) {
    return { success: false, message: resourceName + ' record not found' };
  }

  const existingRow = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  enforceRecordLevelAccess(auth, resource.config, headers, existingRow);
  const providedValues = extractProvidedHeaderValues(headers, payload);
  const mergedRow = mergeMasterRow(existingRow, idx, providedValues, schema);
  mergedRow[idx.Code] = code;

  applyAuditFields(mergedRow, idx, auth, resource.config, false);
  validateRequiredFields(mergedRow, idx, schema.requiredHeaders, resourceName);
  validateMasterUniqueness(values, idx, mergedRow, schema, rowNumber, resourceName);

  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([mergedRow]);
  updateResourceSyncCursor(resourceName);

  return {
    success: true,
    message: resourceName + ' record updated successfully',
    data: { code: code }
  };
}

function handleMasterGetProducts(auth, payload) {
  return handleMasterGetRecords(auth, attachMasterResource(payload, 'Products'));
}

function handleMasterCreateProduct(auth, payload) {
  return handleMasterCreateRecord(auth, attachMasterResource(payload, 'Products'));
}

function handleMasterUpdateProduct(auth, payload) {
  return handleMasterUpdateRecord(auth, attachMasterResource(payload, 'Products'));
}

function handleMasterHealth(auth) {
  return {
    success: true,
    data: {
      scope: 'master',
      userId: auth.user.UserID,
      roleIds: auth.roleIds || []
    }
  };
}

function buildMasterSchemaFromResourceConfig(config) {
  const defaults = config && typeof config.defaultValues === 'object' && config.defaultValues !== null
    ? config.defaultValues
    : {};

  if (defaults.Status === undefined) {
    defaults.Status = 'Active';
  }

  return {
    requiredHeaders: (config && Array.isArray(config.requiredHeaders)) ? config.requiredHeaders : [],
    uniqueHeaders: (config && Array.isArray(config.uniqueHeaders)) ? config.uniqueHeaders : [],
    uniqueCompositeHeaders: (config && Array.isArray(config.uniqueCompositeHeaders)) ? config.uniqueCompositeHeaders : [],
    defaults: defaults
  };
}

function resolveMasterResourceName(payload) {
  const resourceNames = resolveMasterResourceNames(payload);
  if (!resourceNames.length) {
    throw new Error('Master resource is required');
  }
  return resourceNames[0];
}

function resolveMasterResourceNames(payload) {
  const candidates = extractRequestedResourceCandidates(payload);
  if (!candidates.length) {
    return [];
  }

  const supported = getResourcesByScope('master').map(function (config) {
    return config.name;
  });
  const canonicalMap = {};
  supported.forEach(function (name) {
    const variants = getResourceNameVariants(name);
    variants.forEach(function (variant) {
      canonicalMap[variant] = name;
    });
  });

  return candidates.map(function (candidate) {
    const key = normalizeResourceAlias(candidate);
    const match = canonicalMap[key];
    if (!match) {
      throw new Error('Unsupported master resource: ' + candidate);
    }
    return match;
  });
}

function attachMasterResource(payload, resourceName) {
  const source = payload || {};
  const cloned = {};
  Object.keys(source).forEach(function (key) {
    cloned[key] = source[key];
  });
  cloned.resource = resourceName;
  return cloned;
}

function enforceMasterPermission(auth, resourceName, permissionName) {
  const roleIds = auth && Array.isArray(auth.roleIds) ? auth.roleIds : [];
  const allowed = hasRolePermission(roleIds, resourceName, permissionName);
  if (!allowed) {
    throw new Error('Access denied for ' + resourceName + ' (' + permissionName + ')');
  }
}

function buildMasterRowsResponse(auth, resourceName, resource, rows, lastUpdatedAt, headersInput) {
  const headers = Array.isArray(headersInput) && headersInput.length ? headersInput : getSheetHeaders(resource.sheet);
  const idx = getHeaderIndexMap(headers);
  const filteredRows = rows.filter(function (row) {
    return canAccessRowByPolicy(auth, resource.config, row, idx);
  });

  return {
    success: true,
    rows: filteredRows,
    meta: {
      resource: resourceName,
      fileId: resource.config.fileId,
      sheetName: resource.config.sheetName,
      requestedBy: auth && auth.user ? auth.user.UserID : null,
      hasDeltaFilter: !!lastUpdatedAt,
      lastSyncAt: Date.now()
    }
  };
}

function enforceRecordLevelAccess(auth, resourceConfig, headers, rowValues) {
  const idx = getHeaderIndexMap(headers || []);
  if (!canAccessRowByPolicy(auth, resourceConfig, rowValues, idx)) {
    throw new Error('Access denied by record-level policy');
  }
}

function canAccessRowByPolicy(auth, resourceConfig, rowValues, idx) {
  const policy = resourceConfig && resourceConfig.recordAccessPolicy
    ? resourceConfig.recordAccessPolicy
    : 'ALL';
  const regionCheckRequired = requiresAccessRegionCheck(auth, idx);

  if (policy === 'ALL' && !regionCheckRequired) {
    return true;
  }

  if (regionCheckRequired && !canAccessRowByAccessRegion(auth, rowValues, idx)) {
    return false;
  }

  if (policy === 'ALL') return true;
  if (!auth || !auth.user) return false;

  const ownerField = resourceConfig.ownerUserField || 'CreatedBy';
  const ownerIdx = idx[ownerField];
  if (ownerIdx === undefined) return true;

  const ownerUserId = (rowValues[ownerIdx] || '').toString().trim();
  const currentUserId = (auth.user.UserID || '').toString().trim();

  if (!ownerUserId) return true;
  if (ownerUserId === currentUserId) return true;
  if (policy === 'OWNER') return false;

  const currentDesignation = getDesignationById(auth.user.DesignationID);
  const ownerUser = getUserById(ownerUserId);
  const ownerDesignation = getDesignationById(ownerUser ? ownerUser.DesignationID : '');
  const currentLevel = Number(currentDesignation.hierarchyLevel || 0);
  const ownerLevel = Number(ownerDesignation.hierarchyLevel || 0);

  if (!currentLevel || !ownerLevel) {
    return false;
  }

  if (policy === 'OWNER_GROUP') {
    return currentLevel === ownerLevel;
  }

  if (policy === 'OWNER_AND_UPLINE') {
    return currentLevel <= ownerLevel;
  }

  return true;
}

function getUserById(userId) {
  if (!userId) return null;
  const users = getUsersContext();
  return users.userById[(userId || '').toString().trim()] || null;
}

function requiresAccessRegionCheck(auth, idx) {
  const regionHeader = resolveAccessRegionHeader(idx);
  if (!regionHeader) return false;

  const scope = buildAuthAccessRegionScope(auth);
  return !scope.isUniverse;
}

function extractProvidedHeaderValues(headers, payload) {
  const result = {};
  const sourceRecord = payload && typeof payload.record === 'object' && payload.record !== null ? payload.record : {};
  const sourcePayload = payload || {};
  const normalizedRecord = buildNormalizedValueMap(sourceRecord);
  const normalizedPayload = buildNormalizedValueMap(sourcePayload);

  headers.forEach(function (header) {
    const key = normalizeFieldKey(header);
    if (key in normalizedRecord) {
      result[header] = normalizedRecord[key];
      return;
    }

    if (key in normalizedPayload) {
      result[header] = normalizedPayload[key];
    }
  });

  return result;
}

function buildNormalizedValueMap(source) {
  const map = {};
  Object.keys(source || {}).forEach(function (key) {
    map[normalizeFieldKey(key)] = source[key];
  });
  return map;
}

function normalizeFieldKey(value) {
  return (value || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function resolveCodeValue(payload) {
  if (!payload) return '';
  if (payload.code !== undefined && payload.code !== null && payload.code !== '') {
    return payload.code;
  }
  if (payload.Code !== undefined && payload.Code !== null && payload.Code !== '') {
    return payload.Code;
  }
  if (payload.record && payload.record.Code) {
    return payload.record.Code;
  }
  return '';
}

function buildNewMasterRow(headers, idx, providedValues, schema) {
  const row = new Array(headers.length).fill('');

  headers.forEach(function (header) {
    const headerIndex = idx[header];
    if (header === 'Code' || isAuditHeader(header)) {
      return;
    }

    if (providedValues[header] !== undefined) {
      row[headerIndex] = normalizeValueByHeader(header, providedValues[header]);
      return;
    }

    if (schema.defaults && schema.defaults[header] !== undefined) {
      row[headerIndex] = schema.defaults[header];
      return;
    }

    if (header === 'Status') {
      row[headerIndex] = 'Active';
    }
  });

  return row;
}

function mergeMasterRow(existingRow, idx, providedValues, schema) {
  const row = existingRow.slice();
  Object.keys(providedValues).forEach(function (header) {
    if (header === 'Code' || isAuditHeader(header) || idx[header] === undefined || isRegionHeader(header)) {
      return;
    }
    row[idx[header]] = normalizeValueByHeader(header, providedValues[header]);
  });

  if (idx.Status !== undefined) {
    if (!row[idx.Status]) {
      row[idx.Status] = schema.defaults && schema.defaults.Status ? schema.defaults.Status : 'Active';
    }
    row[idx.Status] = sanitizeStatus(row[idx.Status]);
  }

  return row;
}

function canAccessRowByAccessRegion(auth, rowValues, idx) {
  const regionHeader = resolveAccessRegionHeader(idx);
  if (!regionHeader) return true;

  const regionCode = normalizeAccessRegionCode(rowValues[idx[regionHeader]]);
  if (!regionCode) {
    // Universe records are readable across all regions.
    return true;
  }

  return canAuthAccessRegionCode(auth, regionCode);
}

function applyAccessRegionOnWrite(row, idx, auth) {
  const regionHeader = resolveAccessRegionHeader(idx);
  if (!regionHeader) return;

  const colIndex = idx[regionHeader];
  const requestedCode = normalizeAccessRegionCode(row[colIndex]);
  const scope = buildAuthAccessRegionScope(auth);
  let effectiveCode = requestedCode;

  if (!scope.isUniverse) {
    // Restricted users cannot write outside assigned subtree.
    effectiveCode = requestedCode || scope.assignedCode;
    if (!effectiveCode) {
      throw new Error('AccessRegion is required for scoped users');
    }
    if (!canAuthAccessRegionCode(auth, effectiveCode)) {
      throw new Error('Access denied for AccessRegion: ' + effectiveCode);
    }
  }

  validateAccessRegionCodeExists(effectiveCode);
  row[colIndex] = effectiveCode;
}

function resolveAccessRegionHeader(idx) {
  if (!idx || typeof idx !== 'object') return '';
  if (idx.AccessRegion !== undefined) return 'AccessRegion';
  if (idx.ServiceRegion !== undefined) return 'ServiceRegion';
  return '';
}

function isRegionHeader(header) {
  return header === 'AccessRegion' || header === 'ServiceRegion';
}

function normalizeValueByHeader(header, value) {
  if (header === 'Status') {
    return sanitizeStatus(value);
  }
  if (value === undefined || value === null) {
    return '';
  }
  return value;
}

function applyAuditFields(row, idx, auth, resourceConfig, isCreate) {
  const now = Date.now();

  if (resourceConfig.audit) {
    if (isCreate && idx.CreatedAt !== undefined) row[idx.CreatedAt] = now;
    if (idx.UpdatedAt !== undefined) row[idx.UpdatedAt] = now;
    if (isCreate && idx.CreatedBy !== undefined) row[idx.CreatedBy] = auth.user.UserID;
    if (idx.UpdatedBy !== undefined) row[idx.UpdatedBy] = auth.user.UserID;
  }
}

function validateRequiredFields(row, idx, requiredHeaders, resourceName) {
  (requiredHeaders || []).forEach(function (header) {
    const headerIdx = idx[header];
    if (headerIdx === undefined) return;

    const value = (row[headerIdx] || '').toString().trim();
    if (!value) {
      throw new Error(resourceName + ': ' + header + ' is required');
    }
  });
}

function validateMasterUniqueness(values, idx, candidateRow, schema, excludeRowNumber, resourceName) {
  const singleHeaders = schema.uniqueHeaders || [];
  const compositeHeaders = schema.uniqueCompositeHeaders || [];

  for (let i = 1; i < values.length; i++) {
    const rowNumber = i + 1;
    if (excludeRowNumber && rowNumber === excludeRowNumber) {
      continue;
    }

    const existing = values[i];

    for (let j = 0; j < singleHeaders.length; j++) {
      const header = singleHeaders[j];
      const headerIdx = idx[header];
      if (headerIdx === undefined) continue;

      const currentValue = normalizeForComparison(candidateRow[headerIdx]);
      const existingValue = normalizeForComparison(existing[headerIdx]);
      if (currentValue && existingValue && currentValue === existingValue) {
        throw new Error(resourceName + ': duplicate value for ' + header);
      }
    }

    for (let k = 0; k < compositeHeaders.length; k++) {
      const combo = compositeHeaders[k];
      if (!combo || !combo.length) continue;

      let hasMissing = false;
      let allMatch = true;
      for (let c = 0; c < combo.length; c++) {
        const comboHeader = combo[c];
        const comboIdx = idx[comboHeader];
        if (comboIdx === undefined) {
          hasMissing = true;
          break;
        }

        const candidateValue = normalizeForComparison(candidateRow[comboIdx]);
        const existingValue = normalizeForComparison(existing[comboIdx]);
        if (!candidateValue || !existingValue || candidateValue !== existingValue) {
          allMatch = false;
          break;
        }
      }

      if (!hasMissing && allMatch) {
        throw new Error(resourceName + ': duplicate combination for ' + combo.join('+'));
      }
    }
  }
}

function normalizeForComparison(value) {
  return (value || '').toString().trim().toLowerCase();
}

function sanitizeRequiredText(value, message) {
  const normalized = (value || '').toString().trim();
  if (!normalized) {
    throw new Error(message || 'Value is required');
  }
  return normalized;
}

function sanitizeStatus(value) {
  const normalized = (value || 'Active').toString().trim();
  return normalized === 'Inactive' ? 'Inactive' : 'Active';
}

function isAuditHeader(header) {
  return header === 'CreatedAt' || header === 'UpdatedAt' || header === 'CreatedBy' || header === 'UpdatedBy';
}

function generateNextCode(values, idx, prefix, sequenceLength) {
  let maxCodeNum = 0;
  const escapedPrefix = escapeRegex(prefix);
  const codePattern = new RegExp('^' + escapedPrefix + '(\\d+)$');

  for (let i = 1; i < values.length; i++) {
    const code = (values[i][idx.Code] || '').toString().trim();
    const match = code.match(codePattern);
    if (match) {
      const num = Number(match[1]);
      if (num > maxCodeNum) maxCodeNum = num;
    }
  }

  const nextNum = maxCodeNum + 1;
  return prefix + padSequence(nextNum, sequenceLength);
}

function escapeRegex(value) {
  return (value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function padSequence(numberValue, sequenceLength) {
  const digits = Math.max(1, Number(sequenceLength) || 6);
  const str = String(numberValue);
  if (str.length >= digits) {
    return str;
  }
  return '0'.repeat(digits - str.length) + str;
}

function parseDateInput(value) {
  if (!value) return null;

  // Google Sheets auto-formatting could still cast to a Date object natively
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  // Assuming value is strictly a Unix Timestamp (either Number or String representation of Number)
  const parsed = new Date(Number(value));
  return isNaN(parsed.getTime()) ? null : parsed;
}

function extractRequestedResourceCandidates(payload) {
  const source = payload || {};
  const result = [];

  if (Array.isArray(source.resources)) {
    source.resources.forEach(function (item) {
      const value = extractResourceNameFromCandidate(item);
      if (value) result.push(value);
    });
  } else if (typeof source.resources === 'string') {
    source.resources.split(',').forEach(function (item) {
      const value = (item || '').toString().trim();
      if (value) result.push(value);
    });
  }

  if (source.resource !== undefined && source.resource !== null && source.resource !== '') {
    const value = source.resource.toString().trim();
    if (value) result.unshift(value);
  }

  // Deduplicate while preserving order
  const unique = [];
  const seen = {};
  result.forEach(function (item) {
    const key = item.toLowerCase();
    if (!seen[key]) {
      seen[key] = true;
      unique.push(item);
    }
  });

  return unique;
}

function normalizeResourceAlias(value) {
  let key = (value || '').toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (key.endsWith('s')) {
    key = key.slice(0, -1);
  }
  return key;
}

function getResourceNameVariants(resourceName) {
  const singular = normalizeResourceAlias(resourceName);
  return [singular, singular + 's'];
}

function cloneWithResource(payload, resourceName) {
  const source = payload || {};
  const cloned = {};
  Object.keys(source).forEach(function (key) {
    cloned[key] = source[key];
  });
  cloned.resource = resourceName;
  return cloned;
}

function resolveMultiResourceCursor(payload, resourceName) {
  const source = payload || {};
  const resourceKey = normalizeResourceAlias(resourceName);

  var cursorFromMap = readCursorFromMap(source.lastUpdatedAtByResource, resourceKey);
  if (cursorFromMap === null || cursorFromMap === undefined || cursorFromMap === '') {
    cursorFromMap = readCursorFromMap(source.resourceCursors, resourceKey);
  }
  if (cursorFromMap === null || cursorFromMap === undefined || cursorFromMap === '') {
    cursorFromMap = readCursorFromMap(source.cursors, resourceKey);
  }
  if (cursorFromMap !== null && cursorFromMap !== undefined && cursorFromMap !== '') {
    return cursorFromMap;
  }

  if (Array.isArray(source.resources)) {
    for (var i = 0; i < source.resources.length; i++) {
      var item = source.resources[i];
      if (!item || typeof item !== 'object') {
        continue;
      }

      var candidateName = extractResourceNameFromCandidate(item);
      if (!candidateName) {
        continue;
      }

      if (normalizeResourceAlias(candidateName) !== resourceKey) {
        continue;
      }

      if (item.lastUpdatedAt !== undefined && item.lastUpdatedAt !== null && item.lastUpdatedAt !== '') {
        return item.lastUpdatedAt;
      }
    }
  }

  if (source.lastUpdatedAt !== undefined && source.lastUpdatedAt !== null && source.lastUpdatedAt !== '') {
    return source.lastUpdatedAt;
  }

  return null;
}

function readCursorFromMap(cursorMap, resourceKey) {
  if (!cursorMap || typeof cursorMap !== 'object') {
    return null;
  }

  var keys = Object.keys(cursorMap);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (normalizeResourceAlias(key) !== resourceKey) {
      continue;
    }
    return cursorMap[key];
  }

  return null;
}

function extractResourceNameFromCandidate(candidate) {
  if (candidate === null || candidate === undefined) {
    return '';
  }

  if (typeof candidate === 'string') {
    return candidate.toString().trim();
  }

  if (typeof candidate === 'object') {
    if (candidate.resource !== undefined && candidate.resource !== null && candidate.resource !== '') {
      return candidate.resource.toString().trim();
    }
    if (candidate.name !== undefined && candidate.name !== null && candidate.name !== '') {
      return candidate.name.toString().trim();
    }
  }

  return '';
}

/**
 * Handles bulk insert/update of master records.
 * Payload: { targetResource: 'Products', records: [{...}, {...}] }
 * The 'targetResource' field names the actual master (e.g. Products),
 * while 'resource' may refer to the caller (e.g. BulkUploadMasters).
 */
/**
 * Handles composite (parent + children) save.
 * Validates ALL records first, then writes atomically.
 * Recursive — children can have their own children.
 *
 * Payload: {
 *   resource: 'Products',
 *   data: { Name: 'Widget', Status: 'Active' },
 *   code: 'PRD00001',               // present for edit, absent for create
 *   children: [{
 *     resource: 'SKUs',
 *     records: [{ data: {...}, _action: 'create'|'update'|'deactivate' }]
 *   }]
 * }
 */
function handleCompositeSave(auth, payload) {
  var parentResourceName = (payload.resource || '').toString().trim();
  if (!parentResourceName) {
    return { success: false, message: 'Resource is required for composite save' };
  }

  var isEdit = !!(payload.code && payload.code.toString().trim());
  var parentData = payload.data || {};
  var childrenPayload = Array.isArray(payload.children) ? payload.children : [];

  // Phase 1: Validate everything
  var validationErrors = [];
  var parentResource = openResourceSheet(parentResourceName);
  var parentSchema = buildMasterSchemaFromResourceConfig(parentResource.config);

  // Check permissions
  if (isEdit) {
    enforceMasterPermission(auth, parentResourceName, 'canUpdate');
  } else {
    enforceMasterPermission(auth, parentResourceName, 'canWrite');
  }

  var parentSheet = parentResource.sheet;
  var parentValues = parentSheet.getDataRange().getValues();
  var parentHeaders = parentValues[0] || [];
  var parentIdx = getHeaderIndexMap(parentHeaders);

  // Build parent row
  var parentProvidedValues = {};
  Object.keys(parentData).forEach(function(key) {
    if (key === 'Code' || isAuditHeader(key)) return;
    parentProvidedValues[key] = parentData[key];
  });

  var parentCode;
  var parentRowData;
  var parentRowNumber = -1;

  if (isEdit) {
    parentCode = payload.code.toString().trim();
    parentRowNumber = findRowByValue(parentSheet, parentIdx.Code, parentCode, 2, true);
    if (parentRowNumber === -1) {
      return { success: false, message: parentResourceName + ' record not found: ' + parentCode };
    }
    var existingRow = parentSheet.getRange(parentRowNumber, 1, 1, parentHeaders.length).getValues()[0];
    enforceRecordLevelAccess(auth, parentResource.config, parentHeaders, existingRow);
    parentRowData = mergeMasterRow(existingRow, parentIdx, parentProvidedValues, parentSchema);
    parentRowData[parentIdx.Code] = parentCode;
    applyAuditFields(parentRowData, parentIdx, auth, parentResource.config, false);
  } else {
    var codePrefix = (parentResource.config.codePrefix || '').toString().trim();
    if (!codePrefix) {
      return { success: false, message: 'CodePrefix is missing for resource: ' + parentResourceName };
    }
    var seqLength = parentResource.config.codeSequenceLength || 6;
    parentCode = generateNextCode(parentValues, parentIdx, codePrefix, seqLength);
    parentRowData = buildNewMasterRow(parentHeaders, parentIdx, parentProvidedValues, parentSchema);
    parentRowData[parentIdx.Code] = parentCode;
    applyAccessRegionOnWrite(parentRowData, parentIdx, auth);
    applyAuditFields(parentRowData, parentIdx, auth, parentResource.config, true);
  }

  // Validate parent
  try {
    validateRequiredFields(parentRowData, parentIdx, parentSchema.requiredHeaders, parentResourceName);
    validateMasterUniqueness(parentValues, parentIdx, parentRowData, parentSchema, parentRowNumber, parentResourceName);
  } catch (err) {
    validationErrors.push({ resource: parentResourceName, message: err.message || err.toString() });
  }

  // Phase 1b: Validate all children
  var childWriteOps = [];

  for (var c = 0; c < childrenPayload.length; c++) {
    var childGroup = childrenPayload[c];
    var childResourceName = (childGroup.resource || '').toString().trim();
    if (!childResourceName) continue;

    var childRecords = Array.isArray(childGroup.records) ? childGroup.records : [];
    if (!childRecords.length) continue;

    try {
      enforceMasterPermission(auth, childResourceName, 'canWrite');
      enforceMasterPermission(auth, childResourceName, 'canUpdate');
    } catch (err) {
      validationErrors.push({ resource: childResourceName, message: err.message || err.toString() });
      continue;
    }

    var childResource = openResourceSheet(childResourceName);
    var childSchema = buildMasterSchemaFromResourceConfig(childResource.config);
    var childSheet = childResource.sheet;
    var childValues = childSheet.getDataRange().getValues();
    var childHeaders = childValues[0] || [];
    var childIdx = getHeaderIndexMap(childHeaders);
    var childCodePrefix = (childResource.config.codePrefix || '').toString().trim();
    var childSeqLength = childResource.config.codeSequenceLength || 6;
    var childCurrentValues = childValues.slice();

    var childOps = { resourceName: childResourceName, sheet: childSheet, headers: childHeaders, newRows: [], updateOps: [] };

    for (var r = 0; r < childRecords.length; r++) {
      var rec = childRecords[r];
      var recData = rec.data || {};
      var recAction = rec._action || 'create';

      try {
        var childProvidedValues = {};
        Object.keys(recData).forEach(function(key) {
          if (key === 'Code' || isAuditHeader(key)) return;
          childProvidedValues[key] = recData[key];
        });

        // Inject parent code into child (find the right field)
        var parentCodeField = resolveParentCodeField(childHeaders, parentResourceName);
        if (parentCodeField) {
          childProvidedValues[parentCodeField] = parentCode;
        }

        if (recAction === 'deactivate' && recData.Code) {
          var deactivateRowNum = findRowByValue(childSheet, childIdx.Code, recData.Code, 2, true);
          if (deactivateRowNum !== -1) {
            var deactivateRow = childSheet.getRange(deactivateRowNum, 1, 1, childHeaders.length).getValues()[0];
            deactivateRow[childIdx.Status] = 'Inactive';
            applyAuditFields(deactivateRow, childIdx, auth, childResource.config, false);
            childOps.updateOps.push({ rowNumber: deactivateRowNum, rowData: deactivateRow });
          }
        } else if (recAction === 'update' && recData.Code) {
          var updateRowNum = findRowByValue(childSheet, childIdx.Code, recData.Code, 2, true);
          if (updateRowNum === -1) {
            validationErrors.push({ resource: childResourceName, index: r, message: 'Record not found: ' + recData.Code });
            continue;
          }
          var existingChildRow = childSheet.getRange(updateRowNum, 1, 1, childHeaders.length).getValues()[0];
          var mergedChild = mergeMasterRow(existingChildRow, childIdx, childProvidedValues, childSchema);
          mergedChild[childIdx.Code] = recData.Code;
          applyAuditFields(mergedChild, childIdx, auth, childResource.config, false);
          validateRequiredFields(mergedChild, childIdx, childSchema.requiredHeaders, childResourceName);
          validateMasterUniqueness(childCurrentValues, childIdx, mergedChild, childSchema, updateRowNum, childResourceName);
          childOps.updateOps.push({ rowNumber: updateRowNum, rowData: mergedChild });
          childCurrentValues[updateRowNum - 1] = mergedChild;
        } else {
          // create
          var newChildCode = generateNextCode(childCurrentValues, childIdx, childCodePrefix, childSeqLength);
          var newChildRow = buildNewMasterRow(childHeaders, childIdx, childProvidedValues, childSchema);
          newChildRow[childIdx.Code] = newChildCode;
          applyAccessRegionOnWrite(newChildRow, childIdx, auth);
          applyAuditFields(newChildRow, childIdx, auth, childResource.config, true);
          validateRequiredFields(newChildRow, childIdx, childSchema.requiredHeaders, childResourceName);
          validateMasterUniqueness(childCurrentValues, childIdx, newChildRow, childSchema, -1, childResourceName);
          childOps.newRows.push(newChildRow);
          childCurrentValues.push(newChildRow);
        }
      } catch (err) {
        validationErrors.push({ resource: childResourceName, index: r, message: err.message || err.toString() });
      }
    }

    childWriteOps.push(childOps);
  }

  // If validation errors — abort, write nothing
  if (validationErrors.length) {
    return {
      success: false,
      message: 'Validation failed',
      errors: validationErrors
    };
  }

  // Phase 2: Write everything
  // Write parent
  if (isEdit) {
    parentSheet.getRange(parentRowNumber, 1, 1, parentHeaders.length).setValues([parentRowData]);
  } else {
    var parentTargetRow = parentSheet.getLastRow() + 1;
    parentSheet.getRange(parentTargetRow, 1, 1, parentHeaders.length).setValues([parentRowData]);
  }
  updateResourceSyncCursor(parentResourceName);

  // Write children
  for (var w = 0; w < childWriteOps.length; w++) {
    var ops = childWriteOps[w];
    if (ops.newRows.length) {
      var startRow = ops.sheet.getLastRow() + 1;
      ops.sheet.getRange(startRow, 1, ops.newRows.length, ops.headers.length).setValues(ops.newRows);
    }
    for (var u = 0; u < ops.updateOps.length; u++) {
      ops.sheet.getRange(ops.updateOps[u].rowNumber, 1, 1, ops.headers.length).setValues([ops.updateOps[u].rowData]);
    }
    updateResourceSyncCursor(ops.resourceName);
  }

  return {
    success: true,
    message: parentResourceName + ' saved successfully',
    data: { parentCode: parentCode }
  };
}

/**
 * Resolves the parent code field name in a child resource's headers.
 * Convention: ParentCode or {SingularParentName}Code (e.g., ProductCode).
 */
function resolveParentCodeField(childHeaders, parentResourceName) {
  if (childHeaders.indexOf('ParentCode') !== -1) return 'ParentCode';
  var singular = parentResourceName.replace(/s$/, '');
  var candidate = singular + 'Code';
  if (childHeaders.indexOf(candidate) !== -1) return candidate;
  return '';
}

/**
 * Handles additional action execution (Approve, Reject, etc.)
 * Updates the record's column + auto-fill fields + user-provided fields.
 *
 * Payload: {
 *   resource: 'Procurements',
 *   code: 'PRC00001',
 *   actionName: 'Approve',
 *   column: 'Progress',
 *   columnValue: 'Approved',
 *   fields: { ProgressApprovedComment: 'Looks good' }
 * }
 */
function handleExecuteAction(auth, payload) {
  var resourceName = (payload.resource || '').toString().trim();
  if (!resourceName) return { success: false, message: 'Resource is required' };

  var code = (payload.code || '').toString().trim();
  if (!code) return { success: false, message: 'Record code is required' };

  var actionName = (payload.actionName || '').toString().trim();
  if (!actionName) return { success: false, message: 'Action name is required' };

  var column = (payload.column || 'Progress').toString().trim();
  var columnValue = (payload.columnValue || '').toString().trim();
  if (!columnValue) return { success: false, message: 'Column value is required' };

  var userFields = payload.fields || {};

  // Permission check
  enforceMasterPermission(auth, resourceName, 'canUpdate');

  var resource = openResourceSheet(resourceName);
  var sheet = resource.sheet;
  var values = sheet.getDataRange().getValues();
  var headers = values[0] || [];
  var idx = getHeaderIndexMap(headers);

  var rowNumber = findRowByValue(sheet, idx.Code, code, 2, true);
  if (rowNumber === -1) {
    return { success: false, message: resourceName + ' record not found: ' + code };
  }

  var existingRow = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  enforceRecordLevelAccess(auth, resource.config, headers, existingRow);

  // Set the column value (e.g., Progress = 'Approved')
  if (idx[column] !== undefined) {
    existingRow[idx[column]] = columnValue;
  }

  // Set auto-fill fields: {column}{value}At and {column}{value}By
  var atField = column + columnValue + 'At';
  var byField = column + columnValue + 'By';
  if (idx[atField] !== undefined) existingRow[idx[atField]] = Date.now();
  if (idx[byField] !== undefined) existingRow[idx[byField]] = auth.user.UserID;

  // Set user-provided fields
  Object.keys(userFields).forEach(function(fieldName) {
    if (idx[fieldName] !== undefined) {
      existingRow[idx[fieldName]] = userFields[fieldName];
    }
  });

  // Apply audit
  applyAuditFields(existingRow, idx, auth, resource.config, false);

  // Write back
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([existingRow]);
  updateResourceSyncCursor(resourceName);

  return {
    success: true,
    message: actionName + ' completed successfully',
    data: { code: code, column: column, columnValue: columnValue }
  };
}

function handleMasterBulkRecords(auth, payload) {
  var targetResourceName = (payload.targetResource || '').toString().trim();
  if (!targetResourceName) {
    return { success: false, message: 'targetResource is required for bulk upload' };
  }

  var records = Array.isArray(payload.records) ? payload.records : [];
  if (!records.length) {
    return { success: false, message: 'No records provided' };
  }

  // Enforce permissions on the TARGET resource (not the caller)
  enforceMasterPermission(auth, targetResourceName, 'canWrite');
  enforceMasterPermission(auth, targetResourceName, 'canUpdate');

  var resource = openResourceSheet(targetResourceName);
  var schema = buildMasterSchemaFromResourceConfig(resource.config);
  var sheet = resource.sheet;
  var values = sheet.getDataRange().getValues();
  var headers = values[0] || [];
  var idx = getHeaderIndexMap(headers);
  var codePrefix = (resource.config.codePrefix || '').toString().trim();
  var seqLength = resource.config.codeSequenceLength || 6;

  var results = { created: 0, updated: 0, skipped: 0, errors: [] };

  // Local copy for uniqueness checks within the batch
  var currentValues = values.slice();

  var newRows = [];       // Array of rowData arrays to append
  var updateOps = [];     // Array of {rowNumber, rowData} to write back

  records.forEach(function (recordData, index) {
    try {
      var code = resolveCodeValue({ record: recordData });
      var rowNumber = code ? findRowByValue(sheet, idx.Code, code, 2, true) : -1;

      var providedValues = extractProvidedHeaderValues(headers, { record: recordData });
      var rowData;

      if (rowNumber === -1) {
        // --- INSERT (collect for batch) ---
        var newCode = code || generateNextCode(currentValues, idx, codePrefix, seqLength);
        rowData = buildNewMasterRow(headers, idx, providedValues, schema);
        rowData[idx.Code] = newCode;
        applyAccessRegionOnWrite(rowData, idx, auth);
        applyAuditFields(rowData, idx, auth, resource.config, true);
        validateRequiredFields(rowData, idx, schema.requiredHeaders, targetResourceName);
        validateMasterUniqueness(currentValues, idx, rowData, schema, -1, targetResourceName);

        newRows.push(rowData);
        currentValues.push(rowData);
        results.created++;
      } else {
        // --- UPDATE (collect for batch) ---
        var existingRow = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
        enforceRecordLevelAccess(auth, resource.config, headers, existingRow);
        rowData = mergeMasterRow(existingRow, idx, providedValues, schema);
        rowData[idx.Code] = code;
        applyAuditFields(rowData, idx, auth, resource.config, false);
        validateRequiredFields(rowData, idx, schema.requiredHeaders, targetResourceName);
        validateMasterUniqueness(currentValues, idx, rowData, schema, rowNumber, targetResourceName);

        updateOps.push({ rowNumber: rowNumber, rowData: rowData });
        currentValues[rowNumber - 1] = rowData;
        results.updated++;
      }
    } catch (err) {
      results.errors.push({ index: index, message: err.toString() });
    }
  });

  // Batch write: new rows as a single block append
  if (newRows.length) {
    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, newRows.length, headers.length).setValues(newRows);
  }

  // Batch write: updates (individual rows — scattered positions prevent single setValues)
  for (var u = 0; u < updateOps.length; u++) {
    sheet.getRange(updateOps[u].rowNumber, 1, 1, headers.length).setValues([updateOps[u].rowData]);
  }

  updateResourceSyncCursor(targetResourceName);

  // Re-read full sheet so the frontend can cache a complete snapshot in IDB
  var freshValues = sheet.getDataRange().getValues();
  var freshHeaders = freshValues[0] || [];
  var freshIdx = getHeaderIndexMap(freshHeaders);
  var allRows = [];
  for (var r = 1; r < freshValues.length; r++) {
    allRows.push(freshValues[r]);
  }
  var filtered = allRows.filter(function (row) {
    return canAccessRowByPolicy(auth, resource.config, row, freshIdx);
  });

  return {
    success: results.errors.length < records.length,
    message: 'Bulk processing completed',
    data: {
      created: results.created,
      updated: results.updated,
      skipped: results.skipped,
      errors: results.errors,
      rows: filtered,
      headers: freshHeaders,
      meta: {
        resource: targetResourceName,
        lastSyncAt: Date.now()
      }
    }
  };
}
