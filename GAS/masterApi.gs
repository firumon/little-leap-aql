/**
 * ============================================================
 * Little Leap AQL - Master API Handlers (Generic)
 * ============================================================
 */

function handleMasterGetRecords(auth, payload) {
  const resourceName = resolveMasterResourceName(payload);
  const resource = openResourceSheet(resourceName);
  enforceMasterPermission(auth, resourceName, 'canRead');

  const includeInactive = payload && payload.includeInactive === true;
  const lastUpdatedAt = payload && payload.lastUpdatedAt ? parseDateInput(payload.lastUpdatedAt) : null;
  const values = resource.sheet.getDataRange().getValues();

  if (!values || values.length < 2) {
    return buildMasterRowsResponse(auth, resourceName, resource, [], lastUpdatedAt);
  }

  const headers = values[0];
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

  return buildMasterRowsResponse(auth, resourceName, resource, rows, lastUpdatedAt);
}

function handleMasterGetMultiRecords(auth, payload) {
  const requestedResources = resolveMasterResourceNames(payload);
  if (!requestedResources.length) {
    throw new Error('Master resources are required');
  }

  const data = {};
  requestedResources.forEach(function(resourceName) {
    const singlePayload = cloneWithResource(payload, resourceName);
    data[resourceName] = handleMasterGetRecords(auth, singlePayload);
  });

  return {
    success: true,
    data: data,
    meta: {
      resources: requestedResources,
      lastSyncAt: new Date().toISOString()
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

  applyAuditFields(rowData, idx, auth, resource.config, true);
  validateRequiredFields(rowData, idx, schema.requiredHeaders, resourceName);
  validateMasterUniqueness(values, idx, rowData, schema, -1, resourceName);

  const targetRow = sheet.getLastRow() + 1;
  sheet.getRange(targetRow, 1, 1, headers.length).setValues([rowData]);

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

  const supported = getResourcesByScope('master').map(function(config) {
    return config.name;
  });
  const canonicalMap = {};
  supported.forEach(function(name) {
    const variants = getResourceNameVariants(name);
    variants.forEach(function(variant) {
      canonicalMap[variant] = name;
    });
  });

  return candidates.map(function(candidate) {
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
  Object.keys(source).forEach(function(key) {
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

function buildMasterRowsResponse(auth, resourceName, resource, rows, lastUpdatedAt) {
  const headers = getSheetHeaders(resource.sheet);
  const idx = getHeaderIndexMap(headers);
  const filteredRows = rows.filter(function(row) {
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
      lastSyncAt: new Date().toISOString()
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
  const row = findRowByValue(users.sheet, users.idx.UserID, userId, 2, true);
  if (row === -1) return null;
  return getRowAsObject(users.sheet, row, users.headers);
}

function extractProvidedHeaderValues(headers, payload) {
  const result = {};
  const sourceRecord = payload && typeof payload.record === 'object' && payload.record !== null ? payload.record : {};
  const sourcePayload = payload || {};
  const normalizedRecord = buildNormalizedValueMap(sourceRecord);
  const normalizedPayload = buildNormalizedValueMap(sourcePayload);

  headers.forEach(function(header) {
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
  Object.keys(source || {}).forEach(function(key) {
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

  headers.forEach(function(header) {
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
  Object.keys(providedValues).forEach(function(header) {
    if (header === 'Code' || isAuditHeader(header) || idx[header] === undefined) {
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
  const now = new Date();

  if (resourceConfig.audit) {
    if (isCreate && idx.CreatedAt !== undefined) row[idx.CreatedAt] = now;
    if (idx.UpdatedAt !== undefined) row[idx.UpdatedAt] = now;
    if (isCreate && idx.CreatedBy !== undefined) row[idx.CreatedBy] = auth.user.UserID;
    if (idx.UpdatedBy !== undefined) row[idx.UpdatedBy] = auth.user.UserID;
  }
}

function validateRequiredFields(row, idx, requiredHeaders, resourceName) {
  (requiredHeaders || []).forEach(function(header) {
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
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function extractRequestedResourceCandidates(payload) {
  const source = payload || {};
  const result = [];

  if (Array.isArray(source.resources)) {
    source.resources.forEach(function(item) {
      const value = (item || '').toString().trim();
      if (value) result.push(value);
    });
  } else if (typeof source.resources === 'string') {
    source.resources.split(',').forEach(function(item) {
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
  result.forEach(function(item) {
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
  Object.keys(source).forEach(function(key) {
    cloned[key] = source[key];
  });
  cloned.resource = resourceName;
  return cloned;
}
