/**
 * ============================================================
 * Little Leap AQL - API Dispatcher
 * ============================================================
 * Owns doPost and action routing across auth/master scopes.
 */

const JSON_MIME_TYPE = ContentService.MimeType.JSON;

function doPost(e) {
  let result = { success: false, message: 'Invalid request' };

  try {
    const data = parseRequestPayload(e);
    const action = (data.action || '').toString().trim();

    if (!action) {
      return jsonResponse({ success: false, message: 'Action is required' });
    }

    // Public actions
    if (action === 'login') {
      return jsonResponse(handleLogin(data.email, data.password));
    }

    // Protected actions
    const authContext = validateToken(data.token);
    if (!authContext) {
      return jsonResponse({ success: false, message: 'Unauthorized' });
    }

    result = dispatchProtectedAction(action, authContext, data);
  } catch (err) {
    result = { success: false, message: err.toString() };
  }

  return jsonResponse(result);
}

function dispatchProtectedAction(action, auth, data) {
  if (isGenericMasterCrudAction(action, data)) {
    return dispatchGenericMasterCrudAction(action, auth, data);
  }

  if (isLegacyMasterAction(action)) {
    return dispatchLegacyMasterAction(action, auth, data);
  }

  switch (action) {
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

    default:
      return { success: false, message: 'Action not found' };
  }
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

  return JSON.parse(e.postData.contents);
}

function isGenericMasterCrudAction(action, payload) {
  const normalizedAction = (action || '').toString().trim().toLowerCase();
  const normalizedScope = (payload && payload.scope ? payload.scope : '').toString().trim().toLowerCase();

  if (normalizedAction === 'master.get' || normalizedAction === 'master.create' || normalizedAction === 'master.update') {
    return true;
  }

  if (normalizedScope !== 'master') {
    return false;
  }

  return normalizedAction === 'get' || normalizedAction === 'create' || normalizedAction === 'update';
}

function dispatchGenericMasterCrudAction(action, auth, payload) {
  const normalizedAction = (action || '').toString().trim().toLowerCase();

  if (normalizedAction === 'master.get' || normalizedAction === 'get') {
    const hasMultiResourceRequest = payload && payload.resources !== undefined && payload.resources !== null && payload.resources !== '';
    if (hasMultiResourceRequest) {
      return handleMasterGetMultiRecords(auth, payload);
    }
    return handleMasterGetRecords(auth, payload);
  }

  if (normalizedAction === 'master.create' || normalizedAction === 'create') {
    return handleMasterCreateRecord(auth, payload);
  }

  if (normalizedAction === 'master.update' || normalizedAction === 'update') {
    return handleMasterUpdateRecord(auth, payload);
  }

  return { success: false, message: 'Unsupported master action' };
}

function isLegacyMasterAction(action) {
  const normalizedAction = (action || '').toString().trim();
  if (!normalizedAction) return false;

  if (normalizedAction === 'master.getRecords' || normalizedAction === 'master.createRecord' || normalizedAction === 'master.updateRecord') {
    return true;
  }

  return /^master\.(get|create|update)[A-Z]/.test(normalizedAction);
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

  const parsed = action.match(/^master\.(get|create|update)([A-Z].+)$/);
  if (!parsed) {
    return { success: false, message: 'Unsupported legacy master action' };
  }

  const verb = parsed[1].toLowerCase();
  const rawResource = parsed[2];
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
  Object.keys(source).forEach(function(key) {
    cloned[key] = source[key];
  });
  cloned.resource = resourceName;
  return cloned;
}
