/**
 * ============================================================
 * AQL - Authentication Logic
 * ============================================================
 */

// Shared constants are located in Constants.gs

var _users_context_cache = null;
var _designations_cache = null;
var _roles_cache = null;

function normalizeEmailKey(value) {
  return (value || '').toString().trim().toLowerCase();
}

function normalizeTokenKey(value) {
  return (value || '').toString().trim();
}

function buildUserRowObject(headers, rowValues) {
  const rowObj = {};
  (headers || []).forEach(function(header, index) {
    rowObj[header] = rowValues[index];
  });
  return rowObj;
}

/**
 * Build headers/index context once for Users sheet.
 */
function getUsersContext() {
  if (_users_context_cache) {
    return _users_context_cache;
  }

  const sheet = getAppSpreadsheet().getSheetByName(CONFIG.SHEETS.USERS);
  if (!sheet) {
    throw new Error('Users sheet not found');
  }

  const values = sheet.getDataRange().getValues();
  const headers = values && values.length ? values[0] : [];
  const idx = getHeaderIndexMap(headers);
  const rowsByNumber = {};
  const rowByUserId = {};
  const rowByEmail = {};
  const rowByApiKey = {};
  const userById = {};

  for (let i = 1; i < values.length; i++) {
    const rowValues = values[i];
    const rowNumber = i + 1;
    const rowObj = buildUserRowObject(headers, rowValues);
    rowsByNumber[rowNumber] = rowObj;

    const userId = (idx.UserID === undefined ? '' : (rowValues[idx.UserID] || '')).toString().trim();
    if (userId && rowByUserId[userId] === undefined) {
      rowByUserId[userId] = rowNumber;
      userById[userId] = rowObj;
    }

    const email = normalizeEmailKey(idx.Email === undefined ? '' : rowValues[idx.Email]);
    if (email && rowByEmail[email] === undefined) {
      rowByEmail[email] = rowNumber;
    }

    const token = normalizeTokenKey(idx.ApiKey === undefined ? '' : rowValues[idx.ApiKey]);
    if (token && rowByApiKey[token] === undefined) {
      rowByApiKey[token] = rowNumber;
    }
  }

  _users_context_cache = {
    sheet: sheet,
    values: values,
    headers: headers,
    idx: idx,
    rowsByNumber: rowsByNumber,
    rowByUserId: rowByUserId,
    rowByEmail: rowByEmail,
    rowByApiKey: rowByApiKey,
    userById: userById
  };
  return _users_context_cache;
}

/**
 * Handle Login
 */
function handleLogin(email, password) {
  const users = getUsersContext();
  const emailKey = normalizeEmailKey(email);
  const emailRow = users.rowByEmail[emailKey] || -1;

  if (emailRow === -1) {
    return { success: false, message: 'Invalid credentials' };
  }

  const row = users.rowsByNumber[emailRow] || getRowAsObject(users.sheet, emailRow, users.headers);
  const passwordHash = hashPassword(password || '');

  if (row.PasswordHash !== passwordHash) {
    return { success: false, message: 'Invalid credentials' };
  }

  if (row.Status !== 'Active') {
    return { success: false, message: 'Account is inactive' };
  }

  const token = Utilities.getUuid();
  users.sheet.getRange(emailRow, users.idx.ApiKey + 1).setValue(token);
  users.rowByApiKey[normalizeTokenKey(token)] = emailRow;
  const roleIds = resolveUserRoleIds(row);

  return {
    success: true,
    token,
    user: buildAuthUserPayload(row, roleIds),
    resources: getLoginAuthorizedResources(roleIds),
    appConfig: getLoginAppConfig(),
    appOptions: getAppOptions()
  };
}

/**
 * Stateless validation with direct user row lookup.
 */
function validateToken(token) {
  if (!token) return null;

  const users = getUsersContext();
  const rowNumber = users.rowByApiKey[normalizeTokenKey(token)] || -1;

  if (rowNumber === -1) {
    return null;
  }

  const user = users.rowsByNumber[rowNumber] || getRowAsObject(users.sheet, rowNumber, users.headers);
  const roleIds = resolveUserRoleIds(user);
  const accessRegionScope = buildUserAccessRegionScope(user);
  return {
    rowNumber,
    user,
    roleIds,
    accessRegionScope,
    sheet: users.sheet,
    headers: users.headers,
    idx: users.idx
  };
}

/**
 * Get Profile Info
 */
function handleGetProfile(auth) {
  return {
    success: true,
    user: buildAuthUserPayload(auth.user, auth.roleIds),
    appConfig: getLoginAppConfig()
  };
}

function getLoginAppConfig() {
  try {
    var ss = getAppSpreadsheet();
    var sheet = ss.getSheetByName(CONFIG.SHEETS.CONFIG);
    if (!sheet) return {};
    var values = sheet.getDataRange().getValues();
    var map = {};
    for (var i = 1; i < values.length; i++) {
      var key = (values[i][0] || '').toString().trim();
      if (!key) continue;
      map[key] = values[i][1];
    }
    return map;
  } catch (err) {
    return {};
  }
}

function handleGetAuthorizedResources(auth, payload) {
  const includeHeaders = !(payload && payload.includeHeaders === false);
  const scope = payload && payload.scope ? payload.scope : '';
  return {
    success: true,
    resources: safeGetRoleResourceAccess(auth.roleIds, {
      includeHeaders: includeHeaders,
      includeUiConfig: true,
      scope: scope,
      sortByMenuOrder: true
    })
  };
}

function getLoginAuthorizedResources(roleIds) {
  return safeGetRoleResourceAccess(roleIds, {
    includeHeaders: true,
    includeUiConfig: true,
    scope: '',
    sortByMenuOrder: true
  });
}

function buildAuthUserPayload(userRow, roleIds) {
  return {
    id: userRow.UserID,
    name: userRow.Name,
    email: userRow.Email,
    avatar: userRow.Avatar || '',
    accessRegion: buildUserAccessRegionPayload(userRow),
    designation: getDesignationById(userRow.DesignationID),
    roles: getRoleNamesByIds(roleIds || resolveUserRoleIds(userRow)),
    role: getPrimaryRoleName(userRow)
  };
}

function sortAuthorizedResources(resources) {
  const entries = Array.isArray(resources) ? resources.slice() : [];

  function minOrder(entry) {
    var menus = entry && entry.ui && Array.isArray(entry.ui.menus) ? entry.ui.menus : [];
    if (menus.length === 0) return 9999;
    return menus.reduce(function(min, m) { var o = Number(m.order) || 9999; return o < min ? o : min; }, 9999);
  }

  entries.sort(function(a, b) {
    const aOrder = minOrder(a);
    const bOrder = minOrder(b);
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }

    const aName = (a && a.name ? a.name : '').toString().toLowerCase();
    const bName = (b && b.name ? b.name : '').toString().toLowerCase();
    if (aName < bName) return -1;
    if (aName > bName) return 1;
    return 0;
  });
  return entries;
}

function safeGetRoleResourceAccess(roleId, options) {
  const opts = options || {};
  try {
    const resources = getRoleResourceAccess(roleId, {
      includeHeaders: opts.includeHeaders === true,
      includeUiConfig: opts.includeUiConfig !== false,
      scope: opts.scope || ''
    });
    return opts.sortByMenuOrder === false ? resources : sortAuthorizedResources(resources);
  } catch (err) {
    console.error('safeGetRoleResourceAccess failed for role(s): ' + JSON.stringify(roleId) + '. Error: ' + (err && err.message ? err.message : err));
    return [];
  }
}

function handleUpdateAvatar(auth, avatarUrl) {
  const value = (avatarUrl || '').toString().trim();
  auth.sheet.getRange(auth.rowNumber, auth.idx.Avatar + 1).setValue(value);
  if (_users_context_cache && _users_context_cache.rowsByNumber[auth.rowNumber]) {
    _users_context_cache.rowsByNumber[auth.rowNumber].Avatar = value;
  }
  return { success: true, avatarUrl: value };
}

function handleUpdateName(auth, name) {
  const value = (name || '').toString().trim();
  if (!value) {
    return { success: false, message: 'Name is required' };
  }

  auth.sheet.getRange(auth.rowNumber, auth.idx.Name + 1).setValue(value);
  if (_users_context_cache && _users_context_cache.rowsByNumber[auth.rowNumber]) {
    _users_context_cache.rowsByNumber[auth.rowNumber].Name = value;
  }
  return { success: true, name: value };
}

function handleUpdateEmail(auth, newEmail) {
  const email = (newEmail || '').toString().trim();
  if (!email) {
    return { success: false, message: 'Email is required' };
  }

  const users = getUsersContext();
  const emailKey = normalizeEmailKey(email);
  const emailRow = users.rowByEmail[emailKey] || -1;
  if (emailRow !== -1 && emailRow !== auth.rowNumber) {
    return { success: false, message: 'Email already in use' };
  }

  auth.sheet.getRange(auth.rowNumber, auth.idx.Email + 1).setValue(email);
  if (_users_context_cache && _users_context_cache.rowsByNumber[auth.rowNumber]) {
    _users_context_cache.rowsByNumber[auth.rowNumber].Email = email;
    _users_context_cache.rowByEmail[emailKey] = auth.rowNumber;
  }
  return { success: true, email: email };
}

function handleUpdatePassword(auth, currentPassword, newPassword) {
  const current = (currentPassword || '').toString();
  const updated = (newPassword || '').toString();

  if (!current || !updated) {
    return { success: false, message: 'Current and new password are required' };
  }

  if (updated.length < 6) {
    return { success: false, message: 'New password must be at least 6 characters' };
  }

  const storedHash = auth.sheet.getRange(auth.rowNumber, auth.idx.PasswordHash + 1).getValue();
  const currentHash = hashPassword(current);

  if (storedHash !== currentHash) {
    return { success: false, message: 'Current password is incorrect' };
  }

  const updatedHash = hashPassword(updated);
  auth.sheet.getRange(auth.rowNumber, auth.idx.PasswordHash + 1).setValue(updatedHash);
  if (_users_context_cache && _users_context_cache.rowsByNumber[auth.rowNumber]) {
    _users_context_cache.rowsByNumber[auth.rowNumber].PasswordHash = updatedHash;
  }
  return { success: true };
}

/**
 * Bulk-loads all roles into an in-memory cache.
 * Pattern mirrors _designations_cache approach.
 */
function getRolesCache() {
  if (_roles_cache) return _roles_cache;

  // Try CacheService
  var scriptCache = CacheService.getScriptCache();
  var cachedJson = scriptCache.get('AQL_ROLES_CACHE_V1');
  if (cachedJson) {
    try {
      _roles_cache = JSON.parse(cachedJson);
      return _roles_cache;
    } catch (e) { /* fall through */ }
  }

  var sheet = getAppSpreadsheet().getSheetByName(CONFIG.SHEETS.ROLES);
  var byId = {};
  if (sheet) {
    var values = sheet.getDataRange().getValues();
    var headers = values && values.length ? values[0] : [];
    var idx = getHeaderIndexMap(headers);

    if (idx.RoleID !== undefined && idx.Name !== undefined) {
      for (var i = 1; i < values.length; i++) {
        var row = values[i];
        var id = (row[idx.RoleID] || '').toString().trim();
        if (!id || byId[id]) continue;
        byId[id] = {
          id: id,
          name: (row[idx.Name] || '').toString().trim() || 'User',
          description: idx.Description !== undefined ? (row[idx.Description] || '').toString().trim() : ''
        };
      }
    }
  }

  _roles_cache = { byId: byId };

  // Persist to CacheService
  try {
    var json = JSON.stringify(_roles_cache);
    if (json.length < 100000) {
      scriptCache.put('AQL_ROLES_CACHE_V1', json, 300);
    }
  } catch (e) { /* non-fatal */ }

  return _roles_cache;
}

/**
 * Clears the cached roles data.
 * Call after any write to the Roles sheet.
 */
function clearRolesCache() {
  _roles_cache = null;
  try {
    CacheService.getScriptCache().remove('AQL_ROLES_CACHE_V1');
  } catch (e) { /* non-fatal */ }
}

function getRoleNameById(roleId) {
  if (!roleId) return 'User';
  var cache = getRolesCache();
  var role = cache.byId[(roleId || '').toString().trim()];
  return role ? role.name : 'User';
}

function getDesignationsCache() {
  if (_designations_cache) return _designations_cache;

  // Try CacheService
  var scriptCache = CacheService.getScriptCache();
  var cachedJson = scriptCache.get('AQL_DESIGNATIONS_CACHE_V1');
  if (cachedJson) {
    try {
      _designations_cache = JSON.parse(cachedJson);
      return _designations_cache;
    } catch (e) { /* fall through */ }
  }

  var sheet = getAppSpreadsheet().getSheetByName(CONFIG.SHEETS.DESIGNATIONS);
  var byId = {};
  if (sheet) {
    var values = sheet.getDataRange().getValues();
    var headers = values && values.length ? values[0] : [];
    var idx = getHeaderIndexMap(headers);

    if (idx.DesignationID !== undefined && idx.Name !== undefined) {
      for (var i = 1; i < values.length; i++) {
        var row = values[i];
        var id = (row[idx.DesignationID] || '').toString().trim();
        if (!id || byId[id]) continue;

        byId[id] = {
          id: id,
          name: (row[idx.Name] || '').toString().trim(),
          hierarchyLevel: idx.HierarchyLevel === undefined
            ? null
            : Number(row[idx.HierarchyLevel] || 0) || null
        };
      }
    }
  }

  _designations_cache = { byId: byId };

  // Persist to CacheService
  try {
    var json = JSON.stringify(_designations_cache);
    if (json.length < 100000) {
      scriptCache.put('AQL_DESIGNATIONS_CACHE_V1', json, 300);
    }
  } catch (e) { /* non-fatal */ }

  return _designations_cache;
}

function clearDesignationsCache() {
  _designations_cache = null;
  try {
    CacheService.getScriptCache().remove('AQL_DESIGNATIONS_CACHE_V1');
  } catch (e) { /* non-fatal */ }
}

function getDesignationById(designationId) {
  const normalizedId = (designationId || '').toString().trim();
  if (!normalizedId) {
    return { id: '', name: '', hierarchyLevel: null };
  }

  var cache = getDesignationsCache();
  var designation = cache.byId[normalizedId];
  if (!designation) {
    return { id: normalizedId, name: '', hierarchyLevel: null };
  }

  return designation;
}

function getUserRoleIds(userId) {
  if (!userId) return [];
  const users = getUsersContext();
  const rowNumber = users.rowByUserId[(userId || '').toString().trim()] || -1;
  if (rowNumber === -1) return [];
  const row = users.rowsByNumber[rowNumber] || getRowAsObject(users.sheet, rowNumber, users.headers);
  return resolveUserRoleIds(row);
}

function resolveUserRoleIds(userRow) {
  const csv = (userRow.Roles || '').toString().trim();
  if (!csv) return [];
  const seen = {};
  return csv.split(',').map(function(roleId) {
    return (roleId || '').toString().trim();
  }).filter(function(roleId) {
    if (!roleId) return false;
    if (seen[roleId]) return false;
    seen[roleId] = true;
    return true;
  });
}

function getRoleNamesByIds(roleIds) {
  const ids = normalizeRoleIds(roleIds);
  if (!ids.length) return [];
  return ids.map(function(roleId) {
    return {
      id: roleId,
      name: getRoleNameById(roleId)
    };
  });
}

function getPrimaryRoleName(userRow) {
  const roleIds = resolveUserRoleIds(userRow);
  if (!roleIds.length) return 'User';
  return getRoleNameById(roleIds[0]);
}

/**
 * Backward-compatible role resolver by UserID (implemented without full-sheet loops).
 */
function getUserRole(userId) {
  if (!userId) return 'User';

  const users = getUsersContext();
  const userRow = users.rowByUserId[(userId || '').toString().trim()] || -1;
  if (userRow === -1) return 'User';

  const row = users.rowsByNumber[userRow] || getRowAsObject(users.sheet, userRow, users.headers);
  const roleIds = resolveUserRoleIds(row);
  if (!roleIds.length) return 'User';
  return getRoleNameById(roleIds[0]);
}

/**
 * SHA-256 Hashing
 */
function hashPassword(password) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password));
}
