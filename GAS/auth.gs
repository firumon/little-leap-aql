/**
 * ============================================================
 * Little Leap AQL - Authentication Logic
 * ============================================================
 */

// Shared constants are located in Constants.gs

/**
 * Build headers/index context once for Users sheet.
 */
function getUsersContext() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.USERS);
  if (!sheet) {
    throw new Error('Users sheet not found');
  }

  const headers = getSheetHeaders(sheet);
  const idx = getHeaderIndexMap(headers);

  return { sheet, headers, idx };
}

/**
 * Handle Login
 */
function handleLogin(email, password) {
  const users = getUsersContext();
  const emailRow = findRowByValue(users.sheet, users.idx.Email, (email || '').trim(), 2, false);

  if (emailRow === -1) {
    return { success: false, message: 'Invalid credentials' };
  }

  const row = getRowAsObject(users.sheet, emailRow, users.headers);
  const passwordHash = hashPassword(password || '');

  if (row.PasswordHash !== passwordHash) {
    return { success: false, message: 'Invalid credentials' };
  }

  if (row.Status !== 'Active') {
    return { success: false, message: 'Account is inactive' };
  }

  const token = Utilities.getUuid();
  users.sheet.getRange(emailRow, users.idx.ApiKey + 1).setValue(token);
  const roleIds = resolveUserRoleIds(row);

  return {
    success: true,
    token,
    user: buildAuthUserPayload(row, roleIds),
    resources: getLoginAuthorizedResources(roleIds)
  };
}

/**
 * Stateless validation with direct user row lookup.
 */
function validateToken(token) {
  if (!token) return null;

  const users = getUsersContext();
  const rowNumber = findRowByValue(users.sheet, users.idx.ApiKey, token, 2, true);

  if (rowNumber === -1) {
    return null;
  }

  const user = getRowAsObject(users.sheet, rowNumber, users.headers);
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
    user: buildAuthUserPayload(auth.user, auth.roleIds)
  };
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
  entries.sort(function(a, b) {
    const aOrder = Number(a && a.ui ? a.ui.menuOrder : 9999);
    const bOrder = Number(b && b.ui ? b.ui.menuOrder : 9999);
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
    return [];
  }
}

function handleUpdateAvatar(auth, avatarUrl) {
  const value = (avatarUrl || '').toString().trim();
  auth.sheet.getRange(auth.rowNumber, auth.idx.Avatar + 1).setValue(value);
  return { success: true, avatarUrl: value };
}

function handleUpdateName(auth, name) {
  const value = (name || '').toString().trim();
  if (!value) {
    return { success: false, message: 'Name is required' };
  }

  auth.sheet.getRange(auth.rowNumber, auth.idx.Name + 1).setValue(value);
  return { success: true, name: value };
}

function handleUpdateEmail(auth, newEmail) {
  const email = (newEmail || '').toString().trim();
  if (!email) {
    return { success: false, message: 'Email is required' };
  }

  const emailRow = findRowByValue(auth.sheet, auth.idx.Email, email, 2, false);
  if (emailRow !== -1 && emailRow !== auth.rowNumber) {
    return { success: false, message: 'Email already in use' };
  }

  auth.sheet.getRange(auth.rowNumber, auth.idx.Email + 1).setValue(email);
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

  auth.sheet.getRange(auth.rowNumber, auth.idx.PasswordHash + 1).setValue(hashPassword(updated));
  return { success: true };
}

/**
 * Helper to fetch role name from role ID.
 */
function getRoleNameById(roleId) {
  if (!roleId) return 'User';

  const roleSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.ROLES);
  if (!roleSheet) return 'User';

  const headers = getSheetHeaders(roleSheet);
  const idx = getHeaderIndexMap(headers);

  const roleRow = findRowByValue(roleSheet, idx.RoleID, roleId, 2, true);
  if (roleRow === -1) return 'User';

  return roleSheet.getRange(roleRow, idx.Name + 1).getValue() || 'User';
}

function getDesignationById(designationId) {
  if (!designationId) {
    return { id: '', name: '', hierarchyLevel: null };
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.DESIGNATIONS);
  if (!sheet) {
    return { id: designationId, name: '', hierarchyLevel: null };
  }

  const headers = getSheetHeaders(sheet);
  const idx = getHeaderIndexMap(headers);
  if (idx.DesignationID === undefined || idx.Name === undefined) {
    return { id: designationId, name: '', hierarchyLevel: null };
  }
  const rowNumber = findRowByValue(sheet, idx.DesignationID, designationId, 2, true);
  if (rowNumber === -1) {
    return { id: designationId, name: '', hierarchyLevel: null };
  }

  const hierarchyLevel = idx.HierarchyLevel === undefined
    ? null
    : Number(sheet.getRange(rowNumber, idx.HierarchyLevel + 1).getValue() || 0) || null;

  return {
    id: designationId,
    name: sheet.getRange(rowNumber, idx.Name + 1).getValue() || '',
    hierarchyLevel: hierarchyLevel
  };
}

function getUserRoleIds(userId) {
  if (!userId) return [];
  const users = getUsersContext();
  const rowNumber = findRowByValue(users.sheet, users.idx.UserID, userId, 2, true);
  if (rowNumber === -1) return [];
  const row = getRowAsObject(users.sheet, rowNumber, users.headers);
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
  const userRow = findRowByValue(users.sheet, users.idx.UserID, userId, 2, true);
  if (userRow === -1) return 'User';

  const row = getRowAsObject(users.sheet, userRow, users.headers);
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
