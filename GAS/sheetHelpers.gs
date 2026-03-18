/**
 * ============================================================
 * AQL - Sheet Helpers
 * ============================================================
 * Shared helper functions for header/index/row access patterns.
 */

function getSheetHeaders(sheet) {
  const lastColumn = sheet.getLastColumn();
  if (!lastColumn) return [];
  return sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
}

function getHeaderIndexMap(headers) {
  const map = {};
  headers.forEach(function(header, index) {
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
  headers.forEach(function(header, index) {
    rowObj[header] = values[index];
  });
  return rowObj;
}

// ── APP.Config Helpers ──────────────────────────────────────

/**
 * Returns the full config map from APP.Config sheet as {Key: Value}.
 * Uses CacheService (6-hour TTL) since config rarely changes.
 */
function getConfigMap() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('APP_CONFIG_MAP');
  if (cached) {
    try { return JSON.parse(cached); } catch (e) { /* fall through */ }
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEETS.CONFIG);
  if (!sheet) return {};

  var data = sheet.getDataRange().getValues();
  var map = {};
  for (var i = 1; i < data.length; i++) {
    var key = (data[i][0] || '').toString().trim();
    var value = (data[i][1] || '').toString().trim();
    if (key) map[key] = value;
  }

  cache.put('APP_CONFIG_MAP', JSON.stringify(map), 21600); // 6 hours
  return map;
}

/**
 * Returns a single config value by key from APP.Config sheet.
 */
function getAppConfigValue(key) {
  var map = getConfigMap();
  return map[key] || '';
}

/**
 * Resolves a file ID for a given resource scope using the fallback chain:
 * Resource.FileID (if present) -> Config[{Scope}FileID] -> ss.getId()
 */
function resolveFileIdForScope(scope, resourceFileId) {
  if (resourceFileId) return resourceFileId;

  var scopeKeyMap = {
    master: 'MastersFileID',
    operation: 'OperationsFileID',
    report: 'ReportsFileID',
    accounts: 'AccountsFileID'
  };

  var configKey = scopeKeyMap[(scope || '').toLowerCase()];
  if (configKey) {
    var configValue = getAppConfigValue(configKey);
    if (configValue) return configValue;
  }

  return SpreadsheetApp.getActiveSpreadsheet().getId();
}
