/**
 * ============================================================
 * AQL - API Dispatcher
 * ============================================================
 * Owns doPost and action routing across auth/resource scopes.
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
    // The session proof carries the full auth context, so a verified request
    // needs no user lookup at all.
    var proof = verifySessionProof(request.token, request.sessionKey);
    if (!proof.ok) {
      return jsonResponse(buildErrorEnvelope(request, 'Unauthorized / ' + proof.message));
    }

    var authContext = proof.auth;
    authContext.token = request.token;

    result = dispatchProtectedAction(action, authContext, request.payload);
  } catch (err) {
    if (!request) {
      request = {
        requestId: Utilities.getUuid(),
        action: '',
        resource: '',
        payload: {},
        token: '',
        sessionKey: ''
      };
    }
    return jsonResponse(buildErrorEnvelope(request, err && err.message ? err.message : String(err)));
  } finally {
    // Read paths queue sync-cursor bumps instead of writing one CacheService key
    // at a time. Flush them as a single batch, on every exit path including the
    // early returns above.
    try {
      if (typeof flushPendingCursorWrites === 'function') flushPendingCursorWrites();
    } catch (flushErr) { /* never let a cache flush break the response */ }
  }

  return jsonResponse(buildApiEnvelope(request, result));
}

function normalizeIncomingRequest(raw) {
  var source = raw || {};
  var requestId = (source.requestId || '').toString().trim() || Utilities.getUuid();
  var action = (source.action || '').toString().trim();
  var token = (source.token || '').toString().trim();
  var sessionKey = (source.sessionKey || '').toString().trim();
  var mergedPayload = mergePayloadWithTopLevel(source, action);
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
    var formTicket = normalizeFormTicket(
      mergedPayload.formTicket !== undefined ? mergedPayload.formTicket : source.formTicket
    );
    if (formTicket) mergedPayload.formTicket = formTicket;
    else delete mergedPayload.formTicket;
  }

  return {
    requestId: requestId,
    action: action,
    token: token,
    sessionKey: sessionKey,
    resource: resource,
    payload: mergedPayload
  };
}

// Cache keys have a length cap, so a long or odd ticket is rejected rather than
// silently truncated into a key that could collide with another form.
function normalizeFormTicket(raw) {
  var ticket = (raw === null || raw === undefined ? '' : raw).toString().trim();
  if (!ticket || ticket.length > 100) return '';
  return /^[A-Za-z0-9_-]+$/.test(ticket) ? ticket : '';
}

function normalizeBatchSubRequest(raw) {
  var source = raw || {};
  var action = (source.action || '').toString().trim();
  var mergedPayload = mergePayloadWithTopLevel(source, action);
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
  normalized.action = action;
  if (resource !== '' && resource !== null && resource !== undefined) {
    normalized.resource = resource;
  }
  return normalized;
}

function mergePayloadWithTopLevel(source, action) {
  if (requiresStrictNestedPayload(action)) {
    validateStrictNestedPayload(source, action);
    return clonePayloadObject(source.payload || {});
  }

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
    sessionKey: true,
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

function requiresStrictNestedPayload(action) {
  var normalized = (action || '').toString().trim().toLowerCase();
  return normalized === 'create'
    || normalized === 'update'
    || normalized === 'bulk'
    || normalized === 'record'
    || normalized === 'compositesave'
    || normalized === 'executeaction';
}

function validateStrictNestedPayload(source, action) {
  if (!source || typeof source.payload !== 'object' || Array.isArray(source.payload)) {
    throw new Error(action + ' requires a nested payload object');
  }

  var reservedTopLevel = {
    requestId: true,
    action: true,
    token: true,
    sessionKey: true,
    payload: true,
    resource: true,
    scope: true
  };

  var topLevelKeys = Object.keys(source || {});
  for (var i = 0; i < topLevelKeys.length; i++) {
    var key = topLevelKeys[i];
    if (!reservedTopLevel[key]) {
      throw new Error(action + ' does not allow top-level field "' + key + '"; use payload.' + key);
    }
  }
}

function clonePayloadObject(payload) {
  var cloned = {};
  Object.keys(payload || {}).forEach(function (key) {
    cloned[key] = payload[key];
  });
  return cloned;
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
    result.responses = rawItems.map(function (entry, index) {
      var subReq = requests[index] || {};
      var normalizedReq = {
        requestId: subReq.requestId || Utilities.getUuid(),
        action: (subReq.action || '').toString().trim(),
        resource: subReq.resource || '',
        payload: subReq
      };
      var envelope = buildApiEnvelope(normalizedReq, entry || { success: false, message: 'Empty batch item result' });
      mergeResourcePayloadMap(resources, envelope && envelope.data ? envelope.data.resources : {});
      if (envelope && envelope.data && envelope.data.resources) {
        delete envelope.data.resources;
      }
      return envelope;
    });

    var deltas = rawResult && rawResult.deltaResources;
    if (deltas && typeof deltas === 'object') {
      var deltaPayloads = {};
      Object.keys(deltas).forEach(function (resourceName) {
        var delta = deltas[resourceName];
        if (!delta || !Array.isArray(delta.rows)) return;
        deltaPayloads[resourceName] = buildResourcePayload(
          resourceName, delta.rows, delta.meta, delta.headers, requestPayload
        );
      });
      mergeResourcePayloadMap(resources, deltaPayloads);
    }
    return { resources: resources, result: result, artifacts: {} };
  }

  extractResourcePayloads(resources, requestResource, rawResult, requestPayload);

  var topLevelResultKeys = ['token', 'user', 'resources', 'appConfig', 'appOptions', 'avatarUrl', 'name', 'email'];
  topLevelResultKeys.forEach(function (key) {
    if (rawResult && rawResult[key] !== undefined) {
      result[key] = rawResult[key];
    }
  });

  if (rawResult && Array.isArray(rawResult.errors)) {
    result.errors = rawResult.errors;
  }

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

function mergeResourcePayloadMap(target, source) {
  var destination = target && typeof target === 'object' ? target : {};
  var incoming = source && typeof source === 'object' ? source : {};

  Object.keys(incoming).forEach(function (resourceName) {
    var inPayload = incoming[resourceName];
    if (!inPayload || typeof inPayload !== 'object') return;

    var destPayload = destination[resourceName];
    if (!destPayload || typeof destPayload !== 'object') {
      destination[resourceName] = inPayload;
      return;
    }

    var destHeaders = Array.isArray(destPayload.headers) ? destPayload.headers : [];
    var inHeaders = Array.isArray(inPayload.headers) ? inPayload.headers : [];
    var headers = inHeaders.length >= destHeaders.length ? inHeaders : destHeaders;

    var destCodeIdx = destHeaders.indexOf('Code');
    var inCodeIdx = inHeaders.indexOf('Code');
    if (destCodeIdx === -1) destCodeIdx = inCodeIdx;
    if (inCodeIdx === -1) inCodeIdx = destCodeIdx;

    var destRows = Array.isArray(destPayload.rows) ? destPayload.rows : [];
    var inRows = Array.isArray(inPayload.rows) ? inPayload.rows : [];

    var mergedRows = [];
    if (!destRows.length && !inRows.length) {
      mergedRows = [];
    } else if (!destRows.length) {
      mergedRows = inRows.slice();
    } else if (!inRows.length) {
      mergedRows = destRows.slice();
    } else if (destCodeIdx === -1 && inCodeIdx === -1) {
      mergedRows = destRows.concat(inRows);
    } else {
      var codeMap = {};
      destRows.forEach(function (row) {
        if (!Array.isArray(row)) return;
        var code = destCodeIdx !== -1 ? (row[destCodeIdx] || '').toString().trim() : '';
        if (code) codeMap[code] = mergedRows.length;
        mergedRows.push(row);
      });

      inRows.forEach(function (row) {
        if (!Array.isArray(row)) return;
        var code = inCodeIdx !== -1 ? (row[inCodeIdx] || '').toString().trim() : '';
        if (code && codeMap[code] !== undefined) {
          mergedRows[codeMap[code]] = row;
        } else {
          if (code) codeMap[code] = mergedRows.length;
          mergedRows.push(row);
        }
      });
    }

    var destMeta = destPayload.meta && typeof destPayload.meta === 'object' ? destPayload.meta : {};
    var inMeta = inPayload.meta && typeof inPayload.meta === 'object' ? inPayload.meta : {};

    var destDataUpdated = typeof normalizeUpdatedAtMillis === 'function' ? normalizeUpdatedAtMillis(destMeta.lastDataUpdatedAt) : (Number(destMeta.lastDataUpdatedAt) || 0);
    var inDataUpdated = typeof normalizeUpdatedAtMillis === 'function' ? normalizeUpdatedAtMillis(inMeta.lastDataUpdatedAt) : (Number(inMeta.lastDataUpdatedAt) || 0);
    var mergedDataUpdated = Math.max(destDataUpdated, inDataUpdated);

    var destSyncAt = typeof normalizeUpdatedAtMillis === 'function' ? normalizeUpdatedAtMillis(destMeta.lastSyncAt) : (Number(destMeta.lastSyncAt) || 0);
    var inSyncAt = typeof normalizeUpdatedAtMillis === 'function' ? normalizeUpdatedAtMillis(inMeta.lastSyncAt) : (Number(inMeta.lastSyncAt) || 0);
    var mergedSyncAt = Math.max(destSyncAt, inSyncAt, Date.now());

    var mergedMeta = Object.assign({}, destMeta, inMeta, {
      lastDataUpdatedAt: mergedDataUpdated,
      lastSyncAt: mergedSyncAt
    });

    destination[resourceName] = {
      success: inPayload.success !== false && destPayload.success !== false,
      rows: mergedRows,
      headers: headers,
      meta: mergedMeta
    };
  });
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

  if (data.resources && typeof data.resources === 'object' && !Array.isArray(data.resources)) {
    Object.keys(data.resources).forEach(function (resourceName) {
      var resourcePayload = data.resources[resourceName];
      if (resourcePayload && typeof resourcePayload === 'object' && Array.isArray(resourcePayload.rows)) {
        target[resourceName] = buildResourcePayload(resourceName, resourcePayload.rows, resourcePayload.meta, resourcePayload.headers, requestPayload);
      }
    });
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
    if (key === 'rows' || key === 'headers' || key === 'meta' || key === 'resources') {
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
    return dispatchResourceCrudAction(action, auth, data);
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

    // Resource scope
    case 'master.health':
      return handleResourceHealth(auth);

    // Composite save (parent + children atomic)
    case 'compositeSave':
      return handleCompositeSave(auth, data);

    // Record-level multi-resource fetch
    case 'record':
      return handleResourceRecordFetch(auth, data);

    // Additional action execution (Approve, Reject, etc.)
    case 'executeAction':
      return handleExecuteAction(auth, data);

    // Polling action for resource updates
    case 'poll':
      return handlePollAction(auth, data);

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

var FT_CACHE_TTL_SECONDS = 1800;
var FT_STALE_HEARTBEAT_MS = 45000;
var FT_POLL_INTERVAL_MS = 2500;
var FT_POLL_CEILING_MS = 20000;

/**
 * Handles batching multiple API actions together sequentially.
 */
function handleBatchActions(auth, payload) {
  var requests = Array.isArray(payload.requests) ? payload.requests : [];
  if (!requests.length) {
    return { success: false, message: 'No requests provided for batch action' };
  }

  // Same ticket means the same form submission. The ticket owns its own cache
  // key, so two different forms never wait on each other and no script lock is
  // taken anywhere in this path.
  var formTicket = normalizeFormTicket(payload.formTicket);
  if (!formTicket) {
    return runBatchQueue(auth, payload, requests, null, null, null);
  }

  var cacheKey = 'FT_' + formTicket;
  var cache = openScriptCache();
  var state = cache ? readFormTicketState(cache, cacheKey, requests.length) : null;

  if (!state) {
    state = createFormTicketState(requests);
    writeFormTicketState(cache, cacheKey, state);
    return runBatchQueue(auth, payload, requests, cache, cacheKey, state);
  }

  if (state.finished) {
    return buildFormTicketReplayResult(auth, payload, requests, state);
  }

  var idleFor = Date.now() - Number(state.lastUpdatedAt || 0);
  if (idleFor < FT_STALE_HEARTBEAT_MS) {
    var waited = 0;
    while (waited < FT_POLL_CEILING_MS) {
      Utilities.sleep(FT_POLL_INTERVAL_MS);
      waited += FT_POLL_INTERVAL_MS;
      var fresh = cache ? readFormTicketState(cache, cacheKey, requests.length) : null;
      if (!fresh) break;
      if (fresh.finished) {
        return buildFormTicketReplayResult(auth, payload, requests, fresh);
      }
    }
    return {
      success: false,
      inProgress: true,
      message: 'Your form is still being saved. Please wait a moment.',
      data: []
    };
  }

  // The heartbeat went quiet, so the first run died mid-flight. Put back what it
  // had claimed and take over the rest of the queue.
  state.queue = state.processing.concat(state.queue);
  state.processing = [];
  return runBatchQueue(auth, payload, requests, cache, cacheKey, state);
}

function createFormTicketState(requests) {
  var now = Date.now();
  var queue = [];
  for (var i = 0; i < requests.length; i++) queue.push(i);
  return {
    initiated: now,
    lastUpdatedAt: now,
    finished: false,
    resources: collectBatchResourceNames(requests),
    queue: queue,
    processing: [],
    completed: [],
    refs: scanBatchReferencePaths(requests)
  };
}

// The queue holds step indexes, not step bodies. A retry always resends the same
// requests array under the same ticket, so keeping the bodies would only push the
// cached state past its size budget for nothing.
function readFormTicketState(cache, cacheKey, requestCount) {
  try {
    var raw = cache.get(cacheKey);
    if (!raw) return null;
    var parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.queue) || !Array.isArray(parsed.completed)) return null;
    parsed.processing = Array.isArray(parsed.processing) ? parsed.processing : [];
    parsed.resources = Array.isArray(parsed.resources) ? parsed.resources : [];
    parsed.refs = parsed.refs && typeof parsed.refs === 'object' ? parsed.refs : {};
    parsed.finished = parsed.finished === true;
    var pending = parsed.queue.concat(parsed.processing);
    for (var i = 0; i < pending.length; i++) {
      var index = Number(pending[i]);
      if (!(index >= 0 && index < requestCount)) return null;
    }
    return parsed;
  } catch (readErr) {
    return null;
  }
}

function writeFormTicketState(cache, cacheKey, state) {
  if (!cache || !cacheKey || !state) return;
  try {
    cache.put(cacheKey, JSON.stringify(state), FT_CACHE_TTL_SECONDS);
  } catch (putErr) { /* a cache miss next time is safer than failing the write */ }
}

function stampFormTicketState(cache, cacheKey, state) {
  state.lastUpdatedAt = Date.now();
  writeFormTicketState(cache, cacheKey, state);
}

function collectBatchResourceNames(requests) {
  var names = [];
  var seen = {};
  var push = function (value) {
    if (Array.isArray(value)) {
      value.forEach(push);
      return;
    }
    var name = (value === null || value === undefined ? '' : value).toString().trim();
    if (!name) return;
    var key = name.toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    names.push(name);
  };

  (requests || []).forEach(function (req) {
    if (!req || typeof req !== 'object') return;
    push(req.resource);
    push(req.resources);
    push(req.targetResource);
  });

  return names;
}

function scanBatchReferencePaths(value, collected) {
  var refs = collected || {};

  if (Array.isArray(value)) {
    value.forEach(function (item) { scanBatchReferencePaths(item, refs); });
    return refs;
  }
  if (!value || typeof value !== 'object') return refs;

  if (value.$ref !== undefined) {
    var path = (value.$ref === null ? '' : value.$ref).toString().trim();
    if (path && refs[path] === undefined) refs[path] = null;
  }

  Object.keys(value).forEach(function (key) {
    scanBatchReferencePaths(value[key], refs);
  });

  return refs;
}

// Codes recovered from cache are replayed into the batch context, so a taken-over
// run resolves $ref through the same path walker as a first run.
function seedBatchContextFromRefs(batchContext, refs) {
  Object.keys(refs || {}).forEach(function (path) {
    var code = refs[path];
    if (code === null || code === undefined || code === '') return;
    var parts = path.split('.').map(function (part) { return part.trim(); }).filter(Boolean);
    if (parts.length < 2) return;
    var cursor = ensureBatchContextResource(batchContext, parts[0]);
    for (var i = 1; i < parts.length - 1; i++) {
      if (!cursor[parts[i]] || typeof cursor[parts[i]] !== 'object') cursor[parts[i]] = {};
      cursor = cursor[parts[i]];
    }
    cursor[parts[parts.length - 1]] = code;
  });
}

function refreshResolvedRefs(refs, batchContext) {
  Object.keys(refs || {}).forEach(function (path) {
    if (refs[path]) return;
    try {
      var resolved = resolveBatchReferencePath(batchContext, path);
      if (typeof resolved === 'string' && resolved) refs[path] = resolved;
    } catch (refErr) { /* not produced yet — a later step fills it in */ }
  });
}

function extractStepCode(res) {
  var data = res && res.data && typeof res.data === 'object' && !Array.isArray(res.data) ? res.data : {};
  var parentCode = (data.parentCode === null || data.parentCode === undefined ? '' : data.parentCode).toString().trim();
  if (parentCode) return { key: 'parentCode', code: parentCode };
  var code = (data.code === null || data.code === undefined ? '' : data.code).toString().trim();
  if (code) return { key: 'code', code: code };
  return null;
}

function buildCompletedStepResult(entry) {
  var data = {};
  if (entry && entry.code) data[entry.codeKey || 'code'] = entry.code;
  return {
    success: !!(entry && entry.success !== false),
    message: entry && entry.message ? entry.message : '',
    data: data
  };
}

function buildFormTicketStepResults(requests, state, liveResults) {
  var byIndex = {};
  (state.completed || []).forEach(function (entry) {
    if (entry && entry.index !== undefined) byIndex[entry.index] = entry;
  });

  var live = liveResults || {};
  var results = [];
  for (var i = 0; i < requests.length; i++) {
    results.push(live[i] ? live[i] : buildCompletedStepResult(byIndex[i]));
  }
  return results;
}

// Nothing here writes to the sheet. The rows come back as a plain read delta,
// exactly the way a fresh run would have returned them.
function buildFormTicketReplayResult(auth, payload, requests, state) {
  return {
    success: true,
    replayed: true,
    message: 'Batch actions completed successfully',
    data: buildFormTicketStepResults(requests, state, null),
    deltaResources: collectWriteDeltaResources(auth, payload, state.resources || [])
  };
}

function runBatchQueue(auth, payload, requests, cache, cacheKey, state) {
  var tracked = !!state;
  if (!tracked) state = createFormTicketState(requests);

  var batchContext = createBatchContext();
  seedBatchContextFromRefs(batchContext, state.refs);

  var liveResults = {};
  var failure = null;

  while (state.queue.length) {
    var index = Number(state.queue.shift());
    state.processing = [index];
    if (tracked) stampFormTicketState(cache, cacheKey, state);

    var stepResult;
    var resolvedReq = null;
    try {
      resolvedReq = resolveBatchReferencesDeep(requests[index], batchContext);
      var action = (resolvedReq.action || '').toString().trim();
      if (!action) throw new Error('Action is required');
      stepResult = dispatchProtectedAction(action, auth, resolvedReq);
    } catch (e) {
      stepResult = { success: false, message: e && e.message ? e.message : e.toString() };
    }

    if (!stepResult || stepResult.success !== true) {
      state.processing = [];
      state.queue.unshift(index);
      if (tracked) stampFormTicketState(cache, cacheKey, state);
      failure = { index: index, result: stepResult || { success: false, message: 'Batch action failed' } };
      break;
    }

    updateBatchContextFromResult(batchContext, resolvedReq, stepResult);
    refreshResolvedRefs(state.refs, batchContext);

    var stepCode = extractStepCode(stepResult);
    state.processing = [];
    state.completed.push({
      index: index,
      action: (resolvedReq.action || '').toString().trim(),
      resource: resolvedReq.resource || '',
      code: stepCode ? stepCode.code : '',
      codeKey: stepCode ? stepCode.key : '',
      message: stepResult.message || '',
      success: true
    });
    if (tracked) stampFormTicketState(cache, cacheKey, state);

    liveResults[index] = stepResult;
  }

  var liveCount = Object.keys(liveResults).length;
  var results = buildFormTicketStepResults(requests, state, liveResults);

  if (failure) {
    results[failure.index] = failure.result;
    var result = {
      success: false,
      message: 'One or more batch actions failed',
      data: results
    };
    // Steps replayed from cache carry no rows, so the client needs a read delta.
    if (liveCount < (state.completed || []).length) {
      result.deltaResources = collectWriteDeltaResources(auth, payload, state.resources || []);
    }
    return result;
  }

  state.finished = true;
  if (tracked) stampFormTicketState(cache, cacheKey, state);

  var finalResult = {
    success: true,
    message: 'Batch actions completed successfully',
    data: results
  };
  if (liveCount < requests.length) {
    if (liveCount === 0) finalResult.replayed = true;
    finalResult.deltaResources = collectWriteDeltaResources(auth, payload, state.resources || []);
  }
  return finalResult;
}

function openScriptCache() {
  try {
    return CacheService.getScriptCache();
  } catch (cacheErr) {
    return null;
  }
}

function createBatchContext() {
  return { resources: {} };
}

function resolveBatchReferencesDeep(value, batchContext) {
  if (Array.isArray(value)) {
    return value.map(function (item) { return resolveBatchReferencesDeep(item, batchContext); });
  }
  if (value && typeof value === 'object') {
    var keys = Object.keys(value);
    if (keys.length === 1 && value.$ref !== undefined) {
      return resolveBatchReferencePath(batchContext, value.$ref);
    }
    // A $ref JOINED to literal codes already known to the caller — e.g. an invoice
    // bundling the consumption this batch is about to create together with several
    // earlier ones, whose column holds a comma-separated list.
    //
    // The join happens HERE, on resolution, rather than in the frontend: the transport
    // contract forbids stringifying or concatenating a $ref payload object
    // (CORE_ARCHITECTURE_RULES §3), because a client-side concatenation would have to
    // guess the code before the batch has created the record. The literals are plain
    // strings; only the unresolved half is a reference.
    if (value.$ref !== undefined && Array.isArray(value.$append)) {
      var head = resolveBatchReferencePath(batchContext, value.$ref);
      var separator = value.$separator === undefined ? ',' : String(value.$separator);
      var parts = [head].concat(value.$append)
        .map(function (part) { return (part === null || part === undefined ? '' : String(part).trim()); })
        .filter(function (part) { return part !== ''; });
      // De-duplicated: a caller that also listed the new record's own code would
      // otherwise write it twice, and membership tests downstream read the list as a set.
      var seen = {};
      return parts.filter(function (part) {
        if (seen[part]) return false;
        seen[part] = true;
        return true;
      }).join(separator);
    }
    var cloned = {};
    keys.forEach(function (key) {
      cloned[key] = resolveBatchReferencesDeep(value[key], batchContext);
    });
    return cloned;
  }
  return value;
}

function resolveBatchReferencePath(batchContext, refPath) {
  var path = (refPath || '').toString().trim();
  if (!path) {
    throw new Error('Batch $ref path is required');
  }

  var parts = path.split('.');
  var resourceName = parts.shift();
  var current = batchContext.resources[resourceName];
  if (current === undefined) {
    throw new Error('Unable to resolve batch $ref "' + path + '": resource not found in batch context');
  }

  for (var i = 0; i < parts.length; i++) {
    var part = parts[i];
    if (current === null || current === undefined || current[part] === undefined) {
      throw new Error('Unable to resolve batch $ref "' + path + '" at "' + part + '"');
    }
    current = current[part];
  }
  return current;
}

function updateBatchContextFromResult(batchContext, request, rawResult) {
  updateBatchContextFromRawResources(batchContext, rawResult);

  var actionResourceName = request && request.resource
    ? (Array.isArray(request.resource) ? request.resource[0] : request.resource)
    : '';
  var actionScalarCode = rawResult && rawResult.data && typeof rawResult.data === 'object' && !Array.isArray(rawResult.data)
    ? (rawResult.data.parentCode || rawResult.data.code || '').toString().trim()
    : '';
  if (actionResourceName && actionScalarCode) {
    ensureBatchContextResource(batchContext, actionResourceName).latest.code = actionScalarCode;
  }

  var normalizedReq = {
    requestId: request && request.requestId ? request.requestId : Utilities.getUuid(),
    action: request && request.action ? request.action : '',
    resource: request && request.resource ? request.resource : '',
    payload: request || {}
  };
  var envelope = buildApiEnvelope(normalizedReq, rawResult || {});
  var resourcePayloads = envelope && envelope.data && envelope.data.resources ? envelope.data.resources : {};
  Object.keys(resourcePayloads).forEach(function (resourceName) {
    updateBatchContextResourceFromPayload(batchContext, resourceName, resourcePayloads[resourceName]);
  });

  var result = envelope && envelope.data && envelope.data.result ? envelope.data.result : {};
  if (request && request.resource) {
    var scalarCode = (result.parentCode || result.code || '').toString().trim();
    if (scalarCode) {
      var resourceName = Array.isArray(request.resource) ? request.resource[0] : request.resource;
      ensureBatchContextResource(batchContext, resourceName).latest.code = scalarCode;
    }
  }
}

function updateBatchContextFromRawResources(batchContext, rawResult) {
  var data = rawResult && rawResult.data && typeof rawResult.data === 'object' && !Array.isArray(rawResult.data)
    ? rawResult.data
    : {};
  var resources = data.resources && typeof data.resources === 'object' && !Array.isArray(data.resources)
    ? data.resources
    : {};
  Object.keys(resources).forEach(function (resourceName) {
    updateBatchContextResourceFromPayload(batchContext, resourceName, resources[resourceName]);
  });

  Object.keys(data).forEach(function (key) {
    if (key === 'resources') return;
    var value = data[key];
    if (value && typeof value === 'object' && !Array.isArray(value) && Array.isArray(value.rows)) {
      updateBatchContextResourceFromPayload(batchContext, key, value);
    }
  });
}

function updateBatchContextResourceFromPayload(batchContext, resourceName, payload) {
  var entry = ensureBatchContextResource(batchContext, resourceName);
  var rows = payload && Array.isArray(payload.rows) ? payload.rows : [];
  var headers = payload && Array.isArray(payload.headers) ? payload.headers : [];
  var records = headers.length ? rows.map(function (row) { return rowArrayToObject(headers, row); }) : [];
  entry.records = records;
  records.forEach(function (record) {
    var code = (record.Code || '').toString().trim();
    if (code) {
      entry.byCode[code] = record;
    }
  });
  if (records.length) {
    var latestRecord = records[records.length - 1];
    entry.latest = {
      record: latestRecord,
      code: (latestRecord.Code || entry.latest.code || '').toString().trim()
    };
  }
}

function ensureBatchContextResource(batchContext, resourceName) {
  var name = (resourceName || '').toString().trim();
  if (!batchContext.resources[name]) {
    batchContext.resources[name] = { latest: {}, records: [], byCode: {} };
  }
  return batchContext.resources[name];
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

  if (!isCanonicalCrudVerb(normalizedAction)) {
    return false;
  }

  return hasResourceSelector(payload);
}

function dispatchResourceCrudAction(action, auth, payload) {
  const normalizedAction = (action || '').toString().trim().toLowerCase();

  // Config only: this check reads one field and must not open the spreadsheet.
  const resourceName = resolveResourceName(payload);
  const resourceConfig = getResourceConfig(resourceName);
  if (resourceConfig.scope === 'view' && normalizedAction !== 'get') {
    return { success: false, error: 'View-scope resources are read-only.' };
  }

  if (normalizedAction === 'get') {
    const hasMultiResourceRequest = payload && (
      (Array.isArray(payload.resources) && payload.resources.length > 0) ||
      (payload.resources !== undefined && payload.resources !== null && payload.resources !== '') ||
      (Array.isArray(payload.resource) && payload.resource.length > 1)
    );
    if (hasMultiResourceRequest) {
      return handleResourceGetMultiRecords(auth, payload);
    }
    return handleResourceGetRecords(auth, payload);
  }

  if (normalizedAction === 'create') {
    // Array payload → bulk create/upsert via PostAction (or generic bulk fallback).
    // action=bulk is reserved exclusively for the Bulk Upload UI (BulkUploadMasters).
    if (Array.isArray(payload.records) && payload.records.length > 0) {
      return dispatchBulkCreateRecords(auth, payload);
    }
    return handleResourceCreateRecord(auth, payload);
  }

  if (normalizedAction === 'update') {
    // Array payload → bulk update via PostAction (or generic bulk fallback).
    if (Array.isArray(payload.records) && payload.records.length > 0) {
      return dispatchBulkCreateRecords(auth, payload);
    }
    return handleResourceUpdateRecord(auth, payload);
  }

  if (normalizedAction === 'bulk') {
    return handleResourceBulkUpsertRecords(auth, payload);
  }

  return { success: false, message: 'Unsupported resource action' };
}

function handlePollAction(auth, payload) {
  const cursors = payload && payload.cursors ? payload.cursors : {};
  const updatedResources = [];

  // Stamp the cursor BEFORE reading any resource state. If the stamp were taken
  // after evaluation, a write landing mid-evaluation would carry a
  // LastDataUpdatedAt earlier than the returned serverTime; the client would
  // then advance its unchanged-resource cursor past that write and never see it.
  const serverTime = Date.now();

  // Live cursors come from the dedicated cursor store (CacheService keyed by
  // spreadsheet id + resource), NOT from the frozen resource config snapshot.
  // The config snapshot is cached permanently and its lastDataUpdatedAt goes
  // stale the moment any write lands, which is what made every poll report
  // zero updates.
  const resourceNames = Object.keys(cursors);
  const serverCursors = getResourceSyncCursors(resourceNames) || {};

  // Resolve readable resources ONCE for the whole heartbeat. Calling
  // enforceMasterPermission per resource rebuilt the permission catalog on every
  // iteration, and the surrounding try/catch cost a console.warn RPC for each
  // resource the user cannot read — on a poll that fires every 30s.
  const roleIds = auth && Array.isArray(auth.roleIds) ? auth.roleIds : [];
  const readable = getReadableResourceNameSet(roleIds);

  resourceNames.forEach(function (resourceName) {
    // Mirror enforceMasterPermission exactly: catalog membership first, then
    // the hasRolePermission fallback for resources the catalog omits (inactive,
    // or IncludeInAuthorizationPayload=FALSE). Skipping straight to the set
    // alone would silently stop reporting updates for those resources.
    if (!readable[resourceName] && !hasRolePermission(roleIds, resourceName, 'canRead')) return;

    const clientCursor = Number(cursors[resourceName]) || 0;
    const serverLastUpdated = Number(serverCursors[resourceName]) || 0;
    if (serverLastUpdated > clientCursor) {
      updatedResources.push(resourceName);
    }
  });

  // Strictly a cursor check — never a row payload.
  return {
    success: true,
    data: {
      updatedResources: updatedResources,
      serverTime: serverTime
    }
  };
}
