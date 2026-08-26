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
function buildUsersCacheKey() {
  return 'AQL_USERS_CONTEXT_V1_' + getAppSpreadsheet().getId();
}

// MUST be called after any Users write not mirrored into the cached values, or
// the next execution reads a stale grid.
function clearUsersCache() {
  _users_context_cache = null;
  // Sessions hold a copy of the user row, so they must age out with it.
  if (typeof bumpSessionAuthVersion === 'function') bumpSessionAuthVersion();
  try {
    // The grid is written in chunks, so the base key alone holds nothing.
    removeChunkedCache(buildUsersCacheKey());
  } catch (e) { /* non-fatal */ }
}

// Re-publishes the grid after an in-place edit; keeps the next cache hit.
function persistUsersCache(context) {
  if (!context || !Array.isArray(context.values)) return;
  try {
    var json = JSON.stringify({
      values: stripUsersPasswordHash(context.values, context.idx),
      headers: context.headers
    });
    putChunkedCache(buildUsersCacheKey(), json, CACHE_TTL_SEC);
  } catch (e) { /* non-fatal */ }
}

// Every path that publishes the grid to CacheService MUST go through this:
// a cold read still carries real hashes, which must not leave the sheet.
function stripUsersPasswordHash(values, idx) {
  var hashIdx = idx ? idx.PasswordHash : undefined;
  if (hashIdx === undefined) return values;

  return values.map(function (row, rowIndex) {
    if (rowIndex === 0) return row;
    var copy = row.slice();
    copy[hashIdx] = '';
    return copy;
  });
}

// Rebuilds the derived lookup maps; pure in-memory, no RPCs.
function buildUsersContextFromValues(sheet, values) {
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

  return {
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
}

// On the hot path of every protected request. Cached across executions;
// PasswordHash is stripped before caching and read from the sheet by handleLogin.
// `force` skips both cache tiers and re-reads the grid; validateToken passes it
// when a token misses, so a diverged cache cannot lock every user out.
function getUsersContext(options) {
  const force = !!(options && options.force);
  if (!force && _users_context_cache) {
    return _users_context_cache;
  }

  const sheet = getAppSpreadsheet().getSheetByName(CONFIG.SHEETS.USERS);
  if (!sheet) {
    throw new Error('Users sheet not found');
  }

  const cachedJson = force ? null : getChunkedCache(buildUsersCacheKey());
  if (cachedJson) {
    try {
      const parsed = JSON.parse(cachedJson);
      if (parsed && Array.isArray(parsed.values) && parsed.values.length) {
        _users_context_cache = buildUsersContextFromValues(sheet, parsed.values);
        _users_context_cache.fromCache = true;
        return _users_context_cache;
      }
    } catch (e) { /* fall through to a fresh read */ }
  }

  const values = sheet.getDataRange().getValues();
  const headers = values && values.length ? values[0] : [];
  const idx = getHeaderIndexMap(headers);

  const safeValues = stripUsersPasswordHash(values, idx);

  _users_context_cache = buildUsersContextFromValues(sheet, values);

  try {
    const json = JSON.stringify({ values: safeValues, headers: headers });
    putChunkedCache(buildUsersCacheKey(), json, CACHE_TTL_SEC);
  } catch (e) { /* non-fatal */ }

  return _users_context_cache;
}

// Mirrors a single-cell Users write into the cached grid.
function syncUsersCachedCell(context, rowNumber, headerName, value) {
  if (!context) return;

  const columnIndex = context.idx ? context.idx[headerName] : undefined;
  if (columnIndex === undefined) return;

  const rowIndex = rowNumber - 1;
  if (Array.isArray(context.values) && context.values[rowIndex]) {
    context.values[rowIndex][columnIndex] = value;
  }
  if (context.rowsByNumber && context.rowsByNumber[rowNumber]) {
    context.rowsByNumber[rowNumber][headerName] = value;
  }

  if (headerName === 'PasswordHash') {
    return;
  }
  persistUsersCache(context);
}

/**
 * Handle Login
 */
function handleLogin(email, password) {
  // Fresh grid: login resolves the row it writes the new token into, and it also
  // republishes the cache every protected request then reads.
  const users = getUsersContext({ force: true });
  const emailKey = normalizeEmailKey(email);
  const emailRow = users.rowByEmail[emailKey] || -1;

  if (emailRow === -1) {
    return { success: false, message: 'Invalid credentials' };
  }

  const row = users.rowsByNumber[emailRow] || getRowAsObject(users.sheet, emailRow, users.headers);
  const passwordHash = hashPassword(password || '');

  // Straight from the sheet: a cache-hit row carries a blank hash.
  const storedHash = users.idx.PasswordHash === undefined
    ? row.PasswordHash
    : users.sheet.getRange(emailRow, users.idx.PasswordHash + 1).getValue();

  if (storedHash !== passwordHash) {
    return { success: false, message: 'Invalid credentials' };
  }

  if (row.Status !== 'Active') {
    return { success: false, message: 'Account is inactive' };
  }

  // The previous token is about to stop existing in the sheet. Its cached
  // session would otherwise keep answering requests.
  const previousToken = normalizeTokenKey(row.ApiKey);
  if (previousToken) {
    clearSessionProofState(previousToken);
    delete users.rowByApiKey[previousToken];
  }

  const token = Utilities.getUuid();
  users.sheet.getRange(emailRow, users.idx.ApiKey + 1).setValue(token);
  users.rowByApiKey[normalizeTokenKey(token)] = emailRow;
  // Critical: a stale ApiKey column would reject the token just issued.
  syncUsersCachedCell(users, emailRow, 'ApiKey', token);
  const roleIds = resolveUserRoleIds(row);

  seedSessionProofState(token, {
    rowNumber: emailRow,
    user: sanitizeUserRowForSession(row),
    roleIds: roleIds,
    accessRegionScope: buildUserAccessRegionScope(row)
  });

  return {
    success: true,
    token,
    user: buildAuthUserPayload(row, roleIds),
    resources: getLoginAuthorizedResources(roleIds),
    appConfig: getLoginAppConfig(),
    appOptions: getAppOptions()
  };
}

// The session cache never carries a password hash.
function sanitizeUserRowForSession(userRow) {
  const copy = {};
  Object.keys(userRow || {}).forEach(function (header) {
    if (header === 'PasswordHash') return;
    copy[header] = userRow[header];
  });
  return copy;
}

// Writes the first session state at login so the first request is a cache hit.
function seedSessionProofState(token, authContext) {
  const params = deriveSessionParams(token);
  if (!params) return;

  writeSessionProofState(token, {
    uuid_code: deriveSessionCode(token, params.letterShift, params.digitShift),
    generation: 0,
    user: authContext.user,
    roleIds: authContext.roleIds,
    accessRegionScope: authContext.accessRegionScope,
    rowNumber: authContext.rowNumber
  });
}

// Sheet-backed resolve. Only runs on a session cache miss.
function resolveUserAuthFromSheet(token) {
  if (!token) return null;

  const key = normalizeTokenKey(token);
  let users = getUsersContext();
  let rowNumber = users.rowByApiKey[key] || -1;

  // A cached grid that has drifted from the sheet would reject a token the sheet
  // holds. Never trust a cache miss for auth — re-read once before rejecting.
  if (rowNumber === -1 && users.fromCache) {
    users = getUsersContext({ force: true });
    rowNumber = users.rowByApiKey[key] || -1;
  }

  if (rowNumber === -1) {
    return null;
  }

  const rawUser = users.rowsByNumber[rowNumber] || getRowAsObject(users.sheet, rowNumber, users.headers);
  const user = sanitizeUserRowForSession(rawUser);
  return {
    rowNumber: rowNumber,
    user: user,
    roleIds: resolveUserRoleIds(user),
    accessRegionScope: buildUserAccessRegionScope(user)
  };
}

/**
 * Session-cache first. A miss falls back to the sheet and re-seeds the session.
 */
function validateToken(token) {
  if (!token) return null;

  const state = readSessionProofState(token);
  if (state && state.user) {
    return {
      token: token,
      rowNumber: state.rowNumber,
      user: state.user,
      roleIds: state.roleIds,
      accessRegionScope: state.accessRegionScope
    };
  }

  const authContext = resolveUserAuthFromSheet(token);
  if (!authContext) return null;

  seedSessionProofState(token, authContext);
  authContext.token = token;
  return authContext;
}

// The Users sheet handle is only needed by the profile writers, so it is
// attached on demand instead of on every request.
function ensureAuthSheetContext(auth) {
  if (auth && auth.sheet) return auth;

  const users = getUsersContext();
  auth.sheet = users.sheet;
  auth.headers = users.headers;
  auth.idx = users.idx;
  return auth;
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
  ensureAuthSheetContext(auth);
  auth.sheet.getRange(auth.rowNumber, auth.idx.Avatar + 1).setValue(value);
  syncUsersCachedCell(_users_context_cache, auth.rowNumber, 'Avatar', value);
  updateSessionAuth(auth.token, { Avatar: value });
  return { success: true, avatarUrl: value };
}

function handleUpdateName(auth, name) {
  const value = (name || '').toString().trim();
  if (!value) {
    return { success: false, message: 'Name is required' };
  }

  ensureAuthSheetContext(auth);
  auth.sheet.getRange(auth.rowNumber, auth.idx.Name + 1).setValue(value);
  syncUsersCachedCell(_users_context_cache, auth.rowNumber, 'Name', value);
  updateSessionAuth(auth.token, { Name: value });
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

  ensureAuthSheetContext(auth);
  auth.sheet.getRange(auth.rowNumber, auth.idx.Email + 1).setValue(email);
  if (_users_context_cache) {
    _users_context_cache.rowByEmail[emailKey] = auth.rowNumber;
  }
  syncUsersCachedCell(_users_context_cache, auth.rowNumber, 'Email', email);
  updateSessionAuth(auth.token, { Email: email });
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

  ensureAuthSheetContext(auth);
  const storedHash = auth.sheet.getRange(auth.rowNumber, auth.idx.PasswordHash + 1).getValue();
  const currentHash = hashPassword(current);

  if (storedHash !== currentHash) {
    return { success: false, message: 'Current password is incorrect' };
  }

  const updatedHash = hashPassword(updated);
  auth.sheet.getRange(auth.rowNumber, auth.idx.PasswordHash + 1).setValue(updatedHash);
  syncUsersCachedCell(_users_context_cache, auth.rowNumber, 'PasswordHash', updatedHash);
  return { success: true };
}

/**
 * Bulk-loads all roles into an in-memory cache.
 * Pattern mirrors _designations_cache approach.
 */
function getRolesCache() {
  if (_roles_cache) return _roles_cache;

  // Try CacheService
  var cachedJson = getChunkedCache('AQL_ROLES_CACHE_V1_' + getAppSpreadsheet().getId());
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
    putChunkedCache('AQL_ROLES_CACHE_V1_' + getAppSpreadsheet().getId(), json, CACHE_TTL_SEC);
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
    var scopedROLE = 'AQL_ROLES_CACHE_V1_' + getAppSpreadsheet().getId();
    CacheService.getScriptCache().remove(scopedROLE);
    removeChunkedCache(scopedROLE);
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
  var cachedJson = getChunkedCache('AQL_DESIGNATIONS_CACHE_V1_' + getAppSpreadsheet().getId());
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
    putChunkedCache('AQL_DESIGNATIONS_CACHE_V1_' + getAppSpreadsheet().getId(), json, CACHE_TTL_SEC);
  } catch (e) { /* non-fatal */ }

  return _designations_cache;
}

function clearDesignationsCache() {
  _designations_cache = null;
  try {
    var scopedDESI = 'AQL_DESIGNATIONS_CACHE_V1_' + getAppSpreadsheet().getId();
    CacheService.getScriptCache().remove(scopedDESI);
    removeChunkedCache(scopedDESI);
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
