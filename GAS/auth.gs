/**
 * ============================================================
 * Little Leap AQL - Authentication & API Logic
 * ============================================================
 */

// Shared constants are located in Constants.gs

const JSON_MIME_TYPE = ContentService.MimeType.JSON;

function doPost(e) {
  let result = { success: false, message: 'Invalid request' };

  try {
    const data = parseRequestPayload(e);
    const action = data.action;

    if (action === 'login') {
      return jsonResponse(handleLogin(data.email, data.password));
    }

    const authContext = validateToken(data.token);
    if (!authContext) {
      return jsonResponse({ success: false, message: 'Unauthorized' });
    }

    switch (action) {
      case 'getProfile':
        result = handleGetProfile(authContext);
        break;
      case 'updateAvatar':
        result = handleUpdateAvatar(authContext, data.avatarUrl);
        break;
      case 'updateName':
        result = handleUpdateName(authContext, data.name);
        break;
      case 'updateEmail':
        result = handleUpdateEmail(authContext, data.email);
        break;
      case 'updatePassword':
        result = handleUpdatePassword(authContext, data.currentPassword, data.newPassword);
        break;
      default:
        result = { success: false, message: 'Action not found' };
    }
  } catch (err) {
    result = { success: false, message: err.toString() };
  }

  return jsonResponse(result);
}

/**
 * Global JSON response helper.
 */
function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(JSON_MIME_TYPE);
}

/**
 * Global request parser (accepts JSON body from frontend).
 */
function parseRequestPayload(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('Empty request body');
  }

  return JSON.parse(e.postData.contents);
}

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

function getSheetHeaders(sheet) {
  const lastColumn = sheet.getLastColumn();
  if (!lastColumn) return [];
  return sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
}

function getHeaderIndexMap(headers) {
  const map = {};
  headers.forEach((header, index) => {
    map[header] = index;
  });
  return map;
}

function findRowByValue(sheet, colIndex, value, startRow, matchCase) {
  if (colIndex === undefined || colIndex < 0 || value === undefined || value === null || value === '') {
    return -1;
  }

  const rowStart = startRow || 2;
  const totalRows = sheet.getLastRow();
  if (totalRows < rowStart) return -1;

  const range = sheet.getRange(rowStart, colIndex + 1, totalRows - rowStart + 1, 1);
  const finder = range.createTextFinder(String(value)).matchEntireCell(true);

  if (typeof matchCase === 'boolean') {
    finder.matchCase(matchCase);
  }

  const match = finder.findNext();
  return match ? match.getRow() : -1;
}

function getRowAsObject(sheet, rowNumber, headers) {
  const values = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  const rowObj = {};
  headers.forEach((header, index) => {
    rowObj[header] = values[index];
  });
  return rowObj;
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

  return {
    success: true,
    token,
    user: {
      id: row.UserID,
      name: row.Name,
      email: row.Email,
      avatar: row.Avatar || '',
      role: getRoleNameById(row.RoleID)
    }
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
  return {
    rowNumber,
    user,
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
    user: {
      id: auth.user.UserID,
      name: auth.user.Name,
      email: auth.user.Email,
      avatar: auth.user.Avatar || '',
      role: getRoleNameById(auth.user.RoleID)
    }
  };
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

/**
 * Backward-compatible role resolver by UserID (implemented without full-sheet loops).
 */
function getUserRole(userId) {
  if (!userId) return 'User';

  const users = getUsersContext();
  const userRow = findRowByValue(users.sheet, users.idx.UserID, userId, 2, true);
  if (userRow === -1) return 'User';

  const roleId = users.sheet.getRange(userRow, users.idx.RoleID + 1).getValue();
  return getRoleNameById(roleId);
}

/**
 * SHA-256 Hashing
 */
function hashPassword(password) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password));
}
