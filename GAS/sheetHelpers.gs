/**
 * ============================================================
 * AQL - Sheet Helpers
 * ============================================================
 * Shared helper functions for header/index/row access patterns.
 */

var _appSpreadsheetCache = null;
var _sheet_headers_cache = {};

function getSheetHeaders(sheet) {
  if (!sheet) return [];
  return getSheetHeadersByMeta(sheet.getParent().getId(), sheet.getName(), sheet);
}

/**
 * Fetches headers using fileId and sheetName, checking CacheService first.
 * Only opens the sheet if not in cache.
 */
function getSheetHeadersByMeta(fileId, sheetName, sheetObject) {
  if (!fileId || !sheetName) return [];
  var cacheKey = 'HEADERS_' + fileId + '_' + sheetName;

  // 1. Memory Cache
  if (_sheet_headers_cache[cacheKey]) return _sheet_headers_cache[cacheKey];

  // 2. CacheService
  var scriptCache = CacheService.getScriptCache();
  var cached = scriptCache.get(cacheKey);
  if (!cached) {
    // 2.5 Permanent Metadata (fallback for CacheService)
    cached = getPermanentMetadata(cacheKey);
  }

  if (cached) {
    try {
      var cachedHeaders = JSON.parse(cached);
      _sheet_headers_cache[cacheKey] = cachedHeaders;
      return cachedHeaders;
    } catch (e) { /* fall through */ }
  }

  // 3. Sheet Read (Expensive)
  var sheet = sheetObject;
  if (!sheet) {
    try {
      var ss = SpreadsheetApp.openById(fileId);
      sheet = ss.getSheetByName(sheetName);
    } catch (e) { return []; }
  }
  if (!sheet) return [];

  const lastColumn = sheet.getLastColumn();
  if (!lastColumn) return [];
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];

  _sheet_headers_cache[cacheKey] = headers;

  // Persist to CacheService AND Permanent Metadata
  try {
    var jsonValue = JSON.stringify(headers);
    scriptCache.put(cacheKey, jsonValue, 300);
    setPermanentMetadata(cacheKey, jsonValue);
  } catch (e) { /* non-fatal */ }

  return headers;
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

/**
 * Resolves the APP spreadsheet safely for both bound and web app execution contexts.
 * Fallback: ScriptProperties.APP_FILE_ID when getActiveSpreadsheet() is unavailable.
 * Uses a global variable to cache the result for the duration of the request.
 */
function getAppSpreadsheet() {
  if (_appSpreadsheetCache) return _appSpreadsheetCache;

  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    _appSpreadsheetCache = active;
    return active;
  }
  var appFileId = PropertiesService.getScriptProperties().getProperty('APP_FILE_ID');
  if (!appFileId) {
    throw new Error('APP spreadsheet is unavailable (no active spreadsheet). Set ScriptProperties.APP_FILE_ID first.');
  }
  try {
    _appSpreadsheetCache = SpreadsheetApp.openById(appFileId);
    return _appSpreadsheetCache;
  } catch (err) {
    throw new Error('Failed to open APP spreadsheet using ScriptProperties.APP_FILE_ID. Please re-run setup and store the APP file ID.');
  }
}
/**
 * Stores the current APP spreadsheet ID in ScriptProperties.APP_FILE_ID.
 * Safe to call repeatedly; no-op when value already matches.
 */
function setAppFileId() {
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error('Cannot store APP_FILE_ID without an active spreadsheet context.');
  }
  var fileId = active.getId();
  var props = PropertiesService.getScriptProperties();
  var current = props.getProperty('APP_FILE_ID');
  if (current === fileId) return fileId;
  props.setProperty('APP_FILE_ID', fileId);
  return fileId;
}

// ── APP.Config Helpers ──────────────────────────────────────

/**
 * Returns the full config map from APP.Config sheet as {Key: Value}.
 * Uses CacheService (6-hour TTL) since config rarely changes.
 */
function getConfigMap() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('APP_CONFIG_MAP_V2');
  if (cached) {
    try { return JSON.parse(cached); } catch (e) { /* fall through */ }
  }

  var ss = getAppSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEETS.CONFIG);
  if (!sheet) return {};

  var data = sheet.getDataRange().getValues();
  var map = {};
  for (var i = 1; i < data.length; i++) {
    var key = (data[i][0] || '').toString().trim().toLowerCase();
    var value = (data[i][1] || '').toString().trim();
    if (key) map[key] = value;
  }

  cache.put('APP_CONFIG_MAP_V2', JSON.stringify(map), 300); // 5 minutes
  return map;
}

/**
 * Clears the cached APP.Config map so next read fetches fresh data.
 * Call after any write to the Config sheet.
 */
function clearConfigCache() {
  var cache = CacheService.getScriptCache();
  cache.remove('APP_CONFIG_MAP_V2');
}

/**
 * Returns a single config value by key from APP.Config sheet.
 */
function getAppConfigValue(key) {
  var map = getConfigMap();
  return map[(key || '').toString().toLowerCase()] || '';
}

/**
 * Resolves a file ID for a given resource scope using the fallback chain:
 * Resource.FileID (if present) -> Config[{Scope}FileID] -> ss.getId()
 */
function resolveFileIdForScope(scope, resourceFileId) {
  if (resourceFileId) return resourceFileId;

  var normalizedScope = (scope || '').toString().trim();
  if (!normalizedScope) return getAppSpreadsheet().getId();

  // Dynamic format: "MasterFileID", "OperationFileID", etc.
  var capitalizedScope = normalizedScope.charAt(0).toUpperCase() + normalizedScope.slice(1).toLowerCase();
  var configKey = capitalizedScope + 'FileID';
  var configValue = getAppConfigValue(configKey);
  
  // Fallback for plural legacy keys (MastersFileID, OperationsFileID, etc.)
  if (!configValue) {
    var fallbackKey = capitalizedScope + 'sFileID';
    configValue = getAppConfigValue(fallbackKey);
  }

  if (configValue) return configValue;

  return getAppSpreadsheet().getId();
}

/**
 * Diagnostics: logs resolved file IDs per resource for troubleshooting.
 * Non-public utility — call from Script Editor > Run.
 */
function diagLogResolvedFileIds() {
  var ss = getAppSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEETS.RESOURCES);
  if (!sheet) { Logger.log('Resources sheet not found'); return; }

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idx = {};
  headers.forEach(function(h, i) { idx[h] = i; });

  var lines = ['=== AQL FileID Resolution Diagnostics ==='];
  for (var i = 1; i < data.length; i++) {
    var name = (data[i][idx.Name] || '').toString().trim();
    if (!name) continue;
    var scope = (data[i][idx.Scope] || 'master').toString().trim();
    var rawFileId = (data[i][idx.FileID] || '').toString().trim();
    var resolved = resolveFileIdForScope(scope, rawFileId);
    lines.push(name + ' | scope=' + scope + ' | raw=' + (rawFileId || '(blank)') + ' | resolved=' + resolved);
  }
  Logger.log(lines.join('\n'));
}
/**
 * Gets the metadata context from the APP file.
 */
var _metadata_cache = null;
function getMetadataContext() {
  if (_metadata_cache) return _metadata_cache;
  var ss = getAppSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEETS.METADATA);
  
  var defaultHeaders = ['Key', 'Value'];
  var defaultIdx = { Key: 0, Value: 1 };

  if (!sheet) return { sheet: null, values: [], headers: defaultHeaders, idx: defaultIdx, map: {} };

  var values = sheet.getDataRange().getValues();
  var headers = values.length > 0 ? values[0] : defaultHeaders;
  var idx = getHeaderIndexMap(headers);
  
  // Safety fallback if headers are malformed
  if (idx.Key === undefined) idx.Key = 0;
  if (idx.Value === undefined) idx.Value = 1;

  var map = {};
  for (var i = 1; i < values.length; i++) {
    var key = (values[i][idx.Key] || '').toString().trim();
    if (key) map[key] = values[i][idx.Value];
  }
  _metadata_cache = { sheet: sheet, values: values, headers: headers, idx: idx, map: map };
  return _metadata_cache;
}

/**
 * Gets a value from the permanent Metadata sheet.
 */
function getPermanentMetadata(key) {
  var ctx = getMetadataContext();
  return ctx.map[key];
}

/**
 * Saves a value to the permanent Metadata sheet.
 */
function setPermanentMetadata(key, value) {
  var ctx = getMetadataContext();
  if (!ctx.sheet) {
    var ss = getAppSpreadsheet();
    ctx.sheet = ss.insertSheet(CONFIG.SHEETS.METADATA);
    ctx.sheet.appendRow(['Key', 'Value']);
    ctx.idx = { Key: 0, Value: 1 };
    ctx.sheet.setColumnWidth(1, 300);
    ctx.sheet.setColumnWidth(2, 600);
    ctx.sheet.setFrozenRows(1);
    ctx.sheet.hideSheet();
  }

  var row = findRowByValue(ctx.sheet, ctx.idx.Key, key, 2, true);
  var jsonValue = typeof value === 'string' ? value : JSON.stringify(value);

  if (row !== -1) {
    ctx.sheet.getRange(row, ctx.idx.Value + 1).setValue(jsonValue);
  } else {
    ctx.sheet.appendRow([key, jsonValue]);
  }
  if (ctx.map) ctx.map[key] = jsonValue;
}

/**
 * Clears all in-memory and CacheService caches.
 * Call from setup/sync operations that modify APP sheets.
 */
function clearAllAppCaches() {
  // In-memory: spreadsheet cache
  _appSpreadsheetCache = null;
  _sheet_headers_cache = {};
  _metadata_cache = null;

  // Clear Metadata sheet if exists (to force full rebuild)
  try {
    var ss = getAppSpreadsheet();
    var metaSheet = ss.getSheetByName(CONFIG.SHEETS.METADATA);
    if (metaSheet && metaSheet.getLastRow() > 1) {
      metaSheet.deleteRows(2, metaSheet.getLastRow() - 1);
    }
  } catch (e) { /* non-fatal */ }

  // Delegate to module-specific cache clears
  if (typeof clearConfigCache === 'function') clearConfigCache();
  if (typeof clearResourceConfigCache === 'function') clearResourceConfigCache();
  if (typeof clearRolePermissionsCache === 'function') clearRolePermissionsCache();
  if (typeof clearRolesCache === 'function') clearRolesCache();
  if (typeof clearAccessRegionCache === 'function') clearAccessRegionCache();
  if (typeof clearDesignationsCache === 'function') clearDesignationsCache();
}

