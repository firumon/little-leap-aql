/**
 * ============================================================
 * AQL - API Dispatcher
 * ============================================================
 * Owns doPost and action routing across auth/master scopes.
 */

const JSON_MIME_TYPE = ContentService.MimeType.JSON;

function doPost(e) {
  var request;
  var result = { success: false, message: 'Invalid request' };

  try {
    request = normalizeIncomingRequest(parseRequestPayload(e));
    var action = (request.action || '').toString().trim();

    if (!action) {
      return jsonResponse(buildErrorEnvelope(request, 'Action is required'));
    }

    // Public actions
    if (action === 'login') {
      result = handleLogin(request.payload.email, request.payload.password);
      return jsonResponse(buildApiEnvelope(request, result));
    }

    // Protected actions
    var authContext = validateToken(request.token);
    if (!authContext) {
      return jsonResponse(buildErrorEnvelope(request, 'Unauthorized'));
    }

    result = dispatchProtectedAction(action, authContext, request.payload);
  } catch (err) {
    if (!request) {
      request = {
        requestId: Utilities.getUuid(),
        action: '',
        resource: '',
        payload: {},
        token: ''
      };
    }
    return jsonResponse(buildErrorEnvelope(request, err && err.message ? err.message : String(err)));
  }

  return jsonResponse(buildApiEnvelope(request, result));
}

function normalizeIncomingRequest(raw) {
  var source = raw || {};
  var requestId = (source.requestId || '').toString().trim() || Utilities.getUuid();
  var action = (source.action || '').toString().trim();
  var token = (source.token || '').toString().trim();
  var mergedPayload = mergePayloadWithTopLevel(source);
  var resource = normalizeResourceSelector(
    mergedPayload.resource !== undefined ? mergedPayload.resource : source.resource
  );

  if (resource !== '' && resource !== null && resource !== undefined) {
    mergedPayload.resource = resource;
  }
  if (Array.isArray(resource)) {
    mergedPayload.resources = resource;
  }

  if (action === 'batch') {
    var requests = Array.isArray(mergedPayload.requests) ? mergedPayload.requests : [];
    mergedPayload.requests = requests.map(function (entry) {
      return normalizeBatchSubRequest(entry);
    });
  }

  return {
    requestId: requestId,
    action: action,
    token: token,
    resource: resource,
    payload: mergedPayload
  };
}

function normalizeBatchSubRequest(raw) {
  var source = raw || {};
  var mergedPayload = mergePayloadWithTopLevel(source);
  var resource = normalizeResourceSelector(
    mergedPayload.resource !== undefined ? mergedPayload.resource : source.resource
  );
  if (resource !== '' && resource !== null && resource !== undefined) {
    mergedPayload.resource = resource;
  }
  if (Array.isArray(resource)) {
    mergedPayload.resources = resource;
  }

  var normalized = {};
  Object.keys(mergedPayload).forEach(function (key) {
    normalized[key] = mergedPayload[key];
  });
  normalized.requestId = (source.requestId || '').toString().trim() || Utilities.getUuid();
  normalized.action = (source.action || '').toString().trim();
  if (resource !== '' && resource !== null && resource !== undefined) {
    normalized.resource = resource;
  }
  return normalized;
}

function mergePayloadWithTopLevel(source) {
  var payload = {};
  if (source && source.payload && typeof source.payload === 'object' && !Array.isArray(source.payload)) {
    Object.keys(source.payload).forEach(function (key) {
      payload[key] = source.payload[key];
    });
  }

  var reserved = {
    requestId: true,
    action: true,
    token: true,
    payload: true
  };
  Object.keys(source || {}).forEach(function (key) {
    if (reserved[key]) return;
    if (payload[key] === undefined) {
      payload[key] = source[key];
    }
  });
  return payload;
}

function normalizeResourceSelector(resource) {
  if (Array.isArray(resource)) {
    var list = resource
      .map(function (item) { return (item || '').toString().trim(); })
      .filter(Boolean);
    return list.length ? list : '';
  }
  if (resource === null || resource === undefined) return '';
  var normalized = resource.toString().trim();
  return normalized || '';
}

function buildErrorEnvelope(request, message) {
  return {
    success: false,
    requestId: request && request.requestId ? request.requestId : Utilities.getUuid(),
    action: request && request.action ? request.action : '',
    error: message || 'Request failed',
    message: message || 'Request failed',
    data: {
      resources: {},
      result: {},
      artifacts: {}
    },
    meta: {
      serverTime: Date.now(),
      version: 'v1'
    }
  };
}

function buildApiEnvelope(request, rawResult) {
  var success = !!(rawResult && rawResult.success === true);
  var message = rawResult && rawResult.message ? rawResult.message : '';
  var error = success ? null : (rawResult && (rawResult.error || rawResult.message) ? (rawResult.error || rawResult.message) : 'Request failed');
  var normalizedData = normalizeActionData(
    request && request.action ? request.action : '',
    request && request.resource,
    request && request.payload ? request.payload : {},
    rawResult || {}
  );

  return {
    success: success,
    requestId: request && request.requestId ? request.requestId : Utilities.getUuid(),
    action: request && request.action ? request.action : '',
    error: error,
    message: message,
    data: normalizedData,
    meta: {
      serverTime: Date.now(),
      version: 'v1'
    }
  };
}

function normalizeActionData(action, requestResource, requestPayload, rawResult) {
  var resources = {};
  var result = {};
  var artifacts = {};

  if (action === 'batch') {
    var requests = Array.isArray(requestPayload && requestPayload.requests) ? requestPayload.requests : [];
    var rawItems = Array.isArray(rawResult && rawResult.data) ? rawResult.data : [];
    result.results = rawItems.map(function (entry, index) {
      var subReq = requests[index] || {};
      var normalizedReq = {
        requestId: subReq.requestId || Utilities.getUuid(),
        action: (subReq.action || '').toString().trim(),
        resource: subReq.resource || '',
        payload: subReq
      };
      return buildApiEnvelope(normalizedReq, entry || { success: false, message: 'Empty batch item result' });
    });
    return { resources: {}, result: result, artifacts: {} };
  }

  extractResourcePayloads(resources, requestResource, rawResult, requestPayload);

  var topLevelResultKeys = ['token', 'user', 'resources', 'appConfig', 'appOptions', 'avatarUrl', 'name', 'email'];
  topLevelResultKeys.forEach(function (key) {
    if (rawResult && rawResult[key] !== undefined) {
      result[key] = rawResult[key];
    }
  });

  var data = rawResult ? rawResult.data : null;
  if (data !== null && data !== undefined) {
    if (typeof data === 'object' && !Array.isArray(data)) {
      var sanitized = stripResourceFields(data);
      Object.keys(sanitized).forEach(function (key) {
        result[key] = sanitized[key];
      });
    } else {
      result.value = data;
    }
  }

  if (rawResult && rawResult.base64) {
    artifacts.report = {
      base64: rawResult.base64,
      fileName: rawResult.fileName || '',
      mimeType: rawResult.mimeType || 'application/pdf'
    };
  }

  return {
    resources: resources,
    result: result,
    artifacts: artifacts
  };
}

function extractResourcePayloads(target, requestResource, rawResult, requestPayload) {
  if (!rawResult || typeof rawResult !== 'object') return;

  if (Array.isArray(rawResult.rows)) {
    var singleName = resolveRequestedResourceName(requestResource, rawResult.meta);
    if (singleName) {
      target[singleName] = buildResourcePayload(singleName, rawResult.rows, rawResult.meta, null, requestPayload);
    }
  }

  var data = rawResult.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return;
  }

  if (Array.isArray(data.rows)) {
    var dataName = resolveRequestedResourceName(requestResource, data.meta || rawResult.meta);
    if (dataName) {
      target[dataName] = buildResourcePayload(dataName, data.rows, data.meta || rawResult.meta, data.headers, requestPayload);
    }
  }

  Object.keys(data).forEach(function (key) {
    var value = data[key];
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;

    if (Array.isArray(value.rows)) {
      target[key] = buildResourcePayload(key, value.rows, value.meta, value.headers, requestPayload);
      return;
    }

    if (value.success === true && Array.isArray(value.rows)) {
      target[key] = buildResourcePayload(key, value.rows, value.meta, value.headers, requestPayload);
    }
  });
}

function resolveRequestedResourceName(requestResource, meta) {
  if (meta && meta.resource) {
    return (meta.resource || '').toString().trim();
  }
  if (Array.isArray(requestResource)) {
    return requestResource.length ? requestResource[0] : '';
  }
  return (requestResource || '').toString().trim();
}

function buildResourcePayload(resourceName, rows, meta, headers, requestPayload) {
  var payload = {
    rows: Array.isArray(rows) ? rows : [],
    meta: meta && typeof meta === 'object' ? meta : { resource: resourceName, lastSyncAt: Date.now() }
  };

  var includeHeaders = !!(requestPayload && requestPayload.includeHeaders === true);
  if (includeHeaders && Array.isArray(headers) && headers.length) {
    payload.headers = headers;
  }
  return payload;
}

function stripResourceFields(data) {
  var result = {};
  Object.keys(data || {}).forEach(function (key) {
    if (key === 'rows' || key === 'headers' || key === 'meta' || key === 'records') {
      return;
    }
    var value = data[key];
    if (value && typeof value === 'object' && Array.isArray(value.rows)) {
      return;
    }
    if (value && typeof value === 'object' && value.success === true && Array.isArray(value.rows)) {
      return;
    }
    result[key] = value;
  });
  return result;
}

function dispatchProtectedAction(action, auth, data) {
  if (isGenericCrudAction(action, data)) {
    return dispatchGenericCrudAction(action, auth, data);
  }

  switch (action) {
    // Generic batch action processing
    case 'batch':
      return handleBatchActions(auth, data);

    // Auth/Profile scope
    case 'getProfile':
      return handleGetProfile(auth);
    case 'updateAvatar':
      return handleUpdateAvatar(auth, data.avatarUrl);
    case 'updateName':
      return handleUpdateName(auth, data.name);
    case 'updateEmail':
      return handleUpdateEmail(auth, data.email);
    case 'updatePassword':
      return handleUpdatePassword(auth, data.currentPassword, data.newPassword);
    case 'getAuthorizedResources':
      return handleGetAuthorizedResources(auth, data);

    // Master scope
    case 'master.health':
      return handleMasterHealth(auth);

    // Composite save (parent + children atomic)
    case 'compositeSave':
      return handleCompositeSave(auth, data);

    // Additional action execution (Approve, Reject, etc.)
    case 'executeAction':
      return handleExecuteAction(auth, data);

    // Report scope
    case 'generateReport':
      return generateReportPdf(auth, data);

    default:
      if (isCanonicalCrudVerb(action)) {
        return { success: false, message: 'Invalid canonical CRUD payload: resource selector is required' };
      }
      return { success: false, message: 'Action not found' };
  }
}

function isCanonicalCrudVerb(action) {
  var normalized = (action || '').toString().trim().toLowerCase();
  return normalized === 'get' || normalized === 'create' || normalized === 'update' || normalized === 'bulk';
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(JSON_MIME_TYPE);
}

function parseRequestPayload(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('Empty request body');
  }

  try {
    return JSON.parse(e.postData.contents);
  } catch (parseErr) {
    throw new Error('Malformed JSON payload: ' + parseErr.message);
  }
}

/**
 * Handles batching multiple API actions together sequentially.
 */
function handleBatchActions(auth, payload) {
  var requests = Array.isArray(payload.requests) ? payload.requests : [];
  if (!requests.length) {
    return { success: false, message: 'No requests provided for batch action' };
  }

  var results = [];
  var anyFailed = false;

  for (var i = 0; i < requests.length; i++) {
    var req = requests[i];
    var action = (req.action || '').toString().trim();
    if (!action) {
      results.push({ success: false, message: 'Action is required' });
      anyFailed = true;
      continue;
    }

    try {
      var res = dispatchProtectedAction(action, auth, req);
      results.push(res);
      if (!res.success) {
        anyFailed = true;
      }
    } catch (e) {
      results.push({ success: false, message: e.toString() });
      anyFailed = true;
    }
  }

  return {
    success: !anyFailed,
    message: anyFailed ? 'One or more batch actions failed' : 'Batch actions completed successfully',
    data: results
  };
}


function hasResourceSelector(payload) {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  if (Array.isArray(payload.resource)) {
    if (payload.resource.some(function (item) { return (item || '').toString().trim(); })) {
      return true;
    }
  } else if ((payload.resource || '').toString().trim()) {
    return true;
  }

  if (Array.isArray(payload.resources)) {
    return payload.resources.some(function (item) { return (item || '').toString().trim(); });
  }

  if (typeof payload.resources === 'string') {
    return payload.resources.split(',').map(function (item) { return item.trim(); }).filter(Boolean).length > 0;
  }

  return false;
}

function isGenericCrudAction(action, payload) {
  const normalizedAction = (action || '').toString().trim().toLowerCase();

  if (normalizedAction === 'master.get' || normalizedAction === 'master.create' || normalizedAction === 'master.update' || normalizedAction === 'master.bulk') {
    return true;
  }

  if (!isCanonicalCrudVerb(normalizedAction)) {
    return false;
  }

  return hasResourceSelector(payload);
}

function dispatchGenericCrudAction(action, auth, payload) {
  const normalizedAction = (action || '').toString().trim().toLowerCase();

  // Resolve resource config for view scope validation
  const resourceName = resolveMasterResourceName(payload);
  const resource = openResourceSheet(resourceName);
  if (resource.config.scope === 'view' && normalizedAction !== 'get') {
    return { success: false, error: 'View-scope resources are read-only.' };
  }

  if (normalizedAction === 'master.get' || normalizedAction === 'get') {
    const hasMultiResourceRequest = payload && (
      (Array.isArray(payload.resources) && payload.resources.length > 0) ||
      (payload.resources !== undefined && payload.resources !== null && payload.resources !== '') ||
      (Array.isArray(payload.resource) && payload.resource.length > 1)
    );
    if (hasMultiResourceRequest) {
      return handleMasterGetMultiRecords(auth, payload);
    }
    return handleMasterGetRecords(auth, payload);
  }

  if (normalizedAction === 'master.create' || normalizedAction === 'create') {
    // Array payload → bulk create/upsert via PostAction (or generic bulk fallback).
    // action=bulk is reserved exclusively for the Bulk Upload UI (BulkUploadMasters).
    if (Array.isArray(payload.records) && payload.records.length > 0) {
      return dispatchBulkCreateRecords(auth, payload);
    }
    return handleMasterCreateRecord(auth, payload);
  }

  if (normalizedAction === 'master.update' || normalizedAction === 'update') {
    // Array payload → bulk update via PostAction (or generic bulk fallback).
    if (Array.isArray(payload.records) && payload.records.length > 0) {
      return dispatchBulkCreateRecords(auth, payload);
    }
    return handleMasterUpdateRecord(auth, payload);
  }

  if (normalizedAction === 'master.bulk' || normalizedAction === 'bulk') {
    // Reserved for Bulk Upload UI only (resource=BulkUploadMasters).
    return dispatchBulkAction(auth, payload);
  }

  return { success: false, message: 'Unsupported master action' };
}

function isLegacyMasterAction(action) {
  const normalizedAction = (action || '').toString().trim();
  if (!normalizedAction) return false;

  if (normalizedAction === 'master.getRecords' || normalizedAction === 'master.createRecord' || normalizedAction === 'master.updateRecord') {
    return true;
  }

  if (!normalizedAction.startsWith('master.')) {
    return false;
  }

  var verbs = ['get', 'create', 'update'];
  for (var i = 0; i < verbs.length; i++) {
    var prefix = 'master.' + verbs[i];
    if (!normalizedAction.startsWith(prefix)) {
      continue;
    }

    var suffix = normalizedAction.slice(prefix.length);
    if (!suffix) {
      return false;
    }

    var first = suffix.charAt(0);
    return first >= 'A' && first <= 'Z';
  }

  return false;
}

function dispatchLegacyMasterAction(action, auth, payload) {
  if (action === 'master.getRecords') {
    return handleMasterGetRecords(auth, payload);
  }
  if (action === 'master.createRecord') {
    return handleMasterCreateRecord(auth, payload);
  }
  if (action === 'master.updateRecord') {
    return handleMasterUpdateRecord(auth, payload);
  }

  const normalized = (action || '').toString().trim();
  const prefixes = ['master.get', 'master.create', 'master.update'];
  let verb = '';
  let rawResource = '';

  for (let i = 0; i < prefixes.length; i++) {
    const prefix = prefixes[i];
    if (!normalized.startsWith(prefix)) {
      continue;
    }
    rawResource = normalized.slice(prefix.length);
    if (!rawResource) {
      continue;
    }
    const first = rawResource.charAt(0);
    if (first < 'A' || first > 'Z') {
      continue;
    }
    verb = prefix.split('.')[1];
    break;
  }

  if (!verb || !rawResource) {
    return { success: false, message: 'Unsupported legacy master action' };
  }

  const resource = normalizeLegacyMasterResource(rawResource);
  const mergedPayload = cloneWithMasterResource(payload, resource);

  if (verb === 'get') return handleMasterGetRecords(auth, mergedPayload);
  if (verb === 'create') return handleMasterCreateRecord(auth, mergedPayload);
  if (verb === 'update') return handleMasterUpdateRecord(auth, mergedPayload);

  return { success: false, message: 'Unsupported legacy master action verb' };
}

function normalizeLegacyMasterResource(value) {
  const normalized = (value || '').toString().trim();
  if (!normalized) return normalized;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function cloneWithMasterResource(payload, resourceName) {
  const source = payload || {};
  const cloned = {};
  Object.keys(source).forEach(function (key) {
    cloned[key] = source[key];
  });
  cloned.resource = resourceName;
  return cloned;
}

function dispatchBulkAction(auth, payload) {
  var callerResourceName = '';
  try {
    callerResourceName = (payload.callerResource || payload.resource || '').toString().trim();
  } catch (e) {
    callerResourceName = '';
  }

  if (!callerResourceName) {
    return { success: false, message: 'Resource name is required for bulk action' };
  }

  var config;
  try {
    config = getResourceConfig(callerResourceName);
  } catch (e) {
    return { success: false, message: 'Resource not found: ' + callerResourceName };
  }

  var handlerName = (config.postAction || '').toString().trim();
  if (!handlerName) {
    return { success: false, message: 'No PostAction handler defined for resource: ' + callerResourceName };
  }

  var handler = this[handlerName];
  if (typeof handler !== 'function') {
    return { success: false, message: 'PostAction handler not found: ' + handlerName };
  }

  return handler(auth, payload);
}
