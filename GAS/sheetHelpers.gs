/**
 * ============================================================
 * AQL - Sheet Helpers
 * ============================================================
 * Shared helper functions for header/index/row access patterns.
 */

var _appSpreadsheetCache = null;
var _sheet_headers_cache = {};
var _openedSpreadsheetsCache = {};
var _config_map_cache = null;

/**
 * Safely opens a spreadsheet by ID, caching the reference in memory
 * for the duration of the execution context to avoid redundant openById calls.
 */
function openSpreadsheetById(fileId) {
  if (!fileId) return null;
  if (_openedSpreadsheetsCache[fileId]) return _openedSpreadsheetsCache[fileId];

  // Reuse _appSpreadsheetCache if it matches to avoid extra round-trips
  if (_appSpreadsheetCache && _appSpreadsheetCache.getId() === fileId) {
    _openedSpreadsheetsCache[fileId] = _appSpreadsheetCache;
    return _appSpreadsheetCache;
  }

  var ss = SpreadsheetApp.openById(fileId);
  _openedSpreadsheetsCache[fileId] = ss;
  return ss;
}

function getSheetHeaders(sheet) {
  if (!sheet) return [];
  return getSheetHeadersByMeta(sheet.getParent().getId(), sheet.getName(), sheet);
}

// Values past the ~100KB CacheService cap are split across <key>_C0..Cn with a
// <key>_MANIFEST holding the part count. One getAll to read, one putAll to write.
function buildCacheChunkKeys(baseKey, count) {
  var keys = [];
  for (var i = 0; i < count; i++) keys.push(baseKey + '_C' + i);
  return keys;
}

function putChunkedCache(baseKey, json, ttlSeconds) {
  var ttl = ttlSeconds || CACHE_TTL_SEC;
  var text = (json === null || json === undefined) ? '' : String(json);
  var parts = [];
  for (var i = 0; i < text.length; i += CACHE_CHUNK_CHARS) {
    parts.push(text.substring(i, i + CACHE_CHUNK_CHARS));
  }
  if (!parts.length) parts.push('');

  var batch = {};
  batch[baseKey + '_MANIFEST'] = String(parts.length);
  for (var p = 0; p < parts.length; p++) batch[baseKey + '_C' + p] = parts[p];

  var cache;
  try {
    cache = CacheService.getScriptCache();
  } catch (e) {
    return false;
  }

  try {
    cache.putAll(batch, ttl);
    return true;
  } catch (e) { /* fall through */ }

  // putAll limits the COMBINED payload, so a batch can fail yet succeed key by key.
  var keys = Object.keys(batch);
  for (var k = 0; k < keys.length; k++) {
    try {
      cache.put(keys[k], batch[keys[k]], ttl);
    } catch (e) {
      // A partial write would leave a manifest pointing at missing chunks.
      try { cache.removeAll(keys); } catch (e2) { /* best-effort */ }
      return false;
    }
  }
  return true;
}

function getChunkedCache(baseKey) {
  try {
    var cache = CacheService.getScriptCache();

    // Manifest plus the likely chunks in ONE getAll, not two round-trips.
    var probeKeys = [baseKey + '_MANIFEST'];
    for (var p = 0; p < CACHE_CHUNK_PROBE; p++) probeKeys.push(baseKey + '_C' + p);

    var found = cache.getAll(probeKeys) || {};
    var manifest = found[baseKey + '_MANIFEST'];
    if (!manifest) return null;

    var count = Number(manifest) || 0;
    if (count <= 0) return null;

    if (count > CACHE_CHUNK_PROBE) {
      var restKeys = [];
      for (var r = CACHE_CHUNK_PROBE; r < count; r++) restKeys.push(baseKey + '_C' + r);
      var rest = cache.getAll(restKeys) || {};
      for (var key in rest) {
        if (Object.prototype.hasOwnProperty.call(rest, key)) found[key] = rest[key];
      }
    }

    var out = '';
    for (var i = 0; i < count; i++) {
      var part = found[baseKey + '_C' + i];
      // A partial value is unusable; rebuild beats parsing truncated JSON.
      if (part === undefined || part === null) return null;
      out += part;
    }
    return out;
  } catch (e) {
    return null;
  }
}

function removeChunkedCache(baseKey) {
  try {
    var cache = CacheService.getScriptCache();
    var count = Number(cache.get(baseKey + '_MANIFEST')) || 0;
    var keys = [baseKey + '_MANIFEST'];
    // Sweep generously so a shrunk payload leaves no readable orphan tail.
    var sweep = Math.max(count, 8);
    for (var i = 0; i < sweep; i++) keys.push(baseKey + '_C' + i);
    cache.removeAll(keys);
  } catch (e) { /* non-fatal */ }
}

function getSheetHeadersByMeta(fileId, sheetName, sheetObject, options) {
  if (!fileId || !sheetName) return [];
  var cacheKey = 'HEADERS_' + fileId + '_' + sheetName;
  // `force` skips every cache tier and re-reads row 1; the rebuild paths pass it.
  var force = !!(options && options.force);

  // 1. Memory Cache
  if (!force && _sheet_headers_cache[cacheKey]) return _sheet_headers_cache[cacheKey];

  // 2. CacheService
  var scriptCache = CacheService.getScriptCache();
  var cached = force ? null : scriptCache.get(cacheKey);
  if (!cached && !force) {
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
      var ss = openSpreadsheetById(fileId);
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
    scriptCache.put(cacheKey, jsonValue, CACHE_TTL_SEC);
    setPermanentMetadata(cacheKey, jsonValue);
  } catch (e) { /* non-fatal */ }

  return headers;
}

// Batched header resolution: one getAll, one putAll, one grouped metadata write.
// The per-resource path costs a TextFinder-backed sheet write EACH, and login asks
// for all ~49 at once. Writes the same HEADERS_<fileId>_<sheetName> keys.
function getSheetHeadersBatch(entries, options) {
  var out = {};
  var list = Array.isArray(entries) ? entries : [];
  if (!list.length) return out;

  // Forced: re-read row 1 and write through both tiers — the only way a schema change lands.
  var force = !!(options && options.force);

  var wanted = {};
  var order = [];
  for (var i = 0; i < list.length; i++) {
    var entry = list[i] || {};
    var fileId = (entry.fileId || '').toString().trim();
    var sheetName = (entry.sheetName || '').toString().trim();
    if (!fileId || !sheetName) continue;

    var pairKey = fileId + '::' + sheetName;
    if (wanted[pairKey]) continue;
    wanted[pairKey] = { fileId: fileId, sheetName: sheetName, cacheKey: 'HEADERS_' + fileId + '_' + sheetName };
    order.push(pairKey);
  }
  if (!order.length) return out;

  var pending = [];
  for (var a = 0; a < order.length; a++) {
    var memPair = wanted[order[a]];
    var memHit = force ? null : _sheet_headers_cache[memPair.cacheKey];
    if (memHit) {
      out[order[a]] = memHit;
    } else {
      pending.push(order[a]);
    }
  }
  if (!pending.length) return out;

  // One getAll for every remaining key.
  var cacheKeys = [];
  var keyToPair = {};
  for (var b = 0; b < pending.length; b++) {
    var ck = wanted[pending[b]].cacheKey;
    cacheKeys.push(ck);
    keyToPair[ck] = pending[b];
  }

  var cached = {};
  if (!force) {
    try {
      cached = CacheService.getScriptCache().getAll(cacheKeys) || {};
    } catch (e) {
      cached = {};
    }
  }

  var stillPending = [];
  for (var c = 0; c < pending.length; c++) {
    var pairKeyC = pending[c];
    var raw = cached[wanted[pairKeyC].cacheKey];
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        out[pairKeyC] = parsed;
        _sheet_headers_cache[wanted[pairKeyC].cacheKey] = parsed;
        continue;
      } catch (e) { /* fall through to metadata/sheet */ }
    }
    stillPending.push(pairKeyC);
  }
  if (!stillPending.length) return out;

  var sheetPending = [];
  for (var d = 0; d < stillPending.length; d++) {
    var pairKeyD = stillPending[d];
    var meta = force ? null : getPermanentMetadata(wanted[pairKeyD].cacheKey);
    if (meta) {
      try {
        var parsedMeta = JSON.parse(meta);
        out[pairKeyD] = parsedMeta;
        _sheet_headers_cache[wanted[pairKeyD].cacheKey] = parsedMeta;
        continue;
      } catch (e) { /* fall through to sheet */ }
    }
    sheetPending.push(pairKeyD);
  }
  if (!sheetPending.length) return out;

  // Sheet reads for genuine misses only; openSpreadsheetById dedupes per file.
  var cacheWrites = {};
  var metadataWrites = {};

  for (var e2 = 0; e2 < sheetPending.length; e2++) {
    var pairKeyE = sheetPending[e2];
    var pair = wanted[pairKeyE];
    try {
      var ss = openSpreadsheetById(pair.fileId);
      var sheet = ss ? ss.getSheetByName(pair.sheetName) : null;
      if (!sheet) {
        out[pairKeyE] = [];
        continue;
      }

      var lastColumn = sheet.getLastColumn();
      if (!lastColumn) {
        out[pairKeyE] = [];
        continue;
      }

      var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
      out[pairKeyE] = headers;
      _sheet_headers_cache[pair.cacheKey] = headers;

      var json = JSON.stringify(headers);
      cacheWrites[pair.cacheKey] = json;
      metadataWrites[pair.cacheKey] = json;
    } catch (err) {
      out[pairKeyE] = [];
    }
  }

  if (Object.keys(cacheWrites).length) {
    try {
      CacheService.getScriptCache().putAll(cacheWrites, CACHE_TTL_SEC);
    } catch (e) { /* cache is best-effort */ }
  }
  if (Object.keys(metadataWrites).length) {
    setPermanentMetadataBatch(metadataWrites);
  }

  // Non-enumerable so a caller iterating `fileId::sheetName` entries does not see it.
  try {
    Object.defineProperty(out, '__persisted', {
      value: Object.keys(metadataWrites).length,
      enumerable: false
    });
  } catch (e) { /* diagnostics only */ }

  return out;
}

// CacheService cannot enumerate keys, so purging needs the list rebuilt from config.
function sheetHeaderCacheKeys() {
  var keys = [];
  var seen = {};
  try {
    var configMap = (typeof getResourceConfigMap === 'function' ? getResourceConfigMap() : null) || {};
    Object.keys(configMap).forEach(function(resourceName) {
      var config = configMap[resourceName] || {};
      if (!config.fileId || !config.sheetName) return;
      var key = 'HEADERS_' + config.fileId + '_' + config.sheetName;
      if (seen[key]) return;
      seen[key] = true;
      keys.push(key);
    });
  } catch (e) { /* a broken config map must not block the rest of the purge */ }
  return keys;
}

// Without this the `HEADERS_*` CacheService entries outlive a schema change by 6h, and the
// stale column order maps every row one position out.
function clearSheetHeaderCaches() {
  var keys = sheetHeaderCacheKeys();
  _sheet_headers_cache = {};
  if (!keys.length) return 0;
  try {
    CacheService.getScriptCache().removeAll(keys);
  } catch (e) { /* non-fatal: the memo and metadata clears still stand */ }
  return keys.length;
}

/**
 * Formats a value as the canonical AQL workflow date-time string:
 * `YYYY-MM-DD HH:mm:ss`, 24-hour, in the script's timezone.
 *
 * This is the on-sheet shape for every `...At` workflow stamp column (and for
 * `RespondDate`). Epoch milliseconds were the previous shape; they are still
 * accepted as INPUT here so historical rows re-stamped by a later action come
 * back out in the readable form rather than staying numeric.
 *
 * @param {Date|number|string} [value] - defaults to now
 * @returns {string}
 */
function formatDateTime24(value) {
  var date;
  if (value instanceof Date) {
    date = value;
  } else if (value === undefined || value === null || value === '') {
    date = new Date();
  } else {
    date = new Date(typeof value === 'number' ? value : String(value));
  }
  if (isNaN(date.getTime())) date = new Date();
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
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
  // Memo: resolveFileIdForScope calls this twice per resource row, so a config
  // rebuild otherwise issues ~100 blocking CacheService round-trips.
  if (_config_map_cache) return _config_map_cache;

  var ss = getAppSpreadsheet();
  var cacheKey = 'APP_CONFIG_MAP_V2_' + ss.getId();
  var cache = CacheService.getScriptCache();
  var cached = cache.get(cacheKey);
  if (cached) {
    try {
      _config_map_cache = JSON.parse(cached);
      return _config_map_cache;
    } catch (e) { /* fall through */ }
  }

  var sheet = ss.getSheetByName(CONFIG.SHEETS.CONFIG);
  if (!sheet) return {};

  var data = sheet.getDataRange().getValues();
  var map = {};
  for (var i = 1; i < data.length; i++) {
    var key = (data[i][0] || '').toString().trim().toLowerCase();
    var value = (data[i][1] || '').toString().trim();
    if (key) map[key] = value;
  }

  _config_map_cache = map;
  cache.put(cacheKey, JSON.stringify(map), CACHE_TTL_SEC);
  return map;
}

/**
 * Clears the cached APP.Config map so next read fetches fresh data.
 * Call after any write to the Config sheet.
 */
function clearConfigCache() {
  _config_map_cache = null;
  var cache = CacheService.getScriptCache();
  cache.remove('APP_CONFIG_MAP_V2_' + getAppSpreadsheet().getId());
}

/**
 * Returns a single config value by key from APP.Config sheet.
 */
function getAppConfigValue(key) {
  var map = getConfigMap();
  return map[(key || '').toString().toLowerCase()] || '';
}

/**
 * Returns the list of valid scopes from App.Config "Scopes" key.
 * Falls back to a default set if not configured.
 */
function getConfiguredScopes() {
  var raw = getAppConfigValue('Scopes');
  if (!raw) return ['master', 'operation', 'accounts', 'report', 'view'];
  return raw.toString().split(',').map(function(s) { return s.trim().toLowerCase(); }).filter(Boolean);
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

// Batched metadata write: row numbers come from the cached grid, not a TextFinder
// scan per key, and all new keys append as one setValues block.
function setPermanentMetadataBatch(entries) {
  var map = entries && typeof entries === 'object' ? entries : {};
  var keys = Object.keys(map);
  if (!keys.length) return;

  var ctx = getMetadataContext();
  if (!ctx.sheet) {
    // Let the single-key path create the sheet, then batch the remainder.
    setPermanentMetadata(keys[0], map[keys[0]]);
    if (keys.length === 1) return;
    var rest = {};
    for (var r = 1; r < keys.length; r++) rest[keys[r]] = map[keys[r]];
    setPermanentMetadataBatch(rest);
    return;
  }

  var rowByKey = {};
  for (var i = 1; i < ctx.values.length; i++) {
    var existingKey = (ctx.values[i][ctx.idx.Key] || '').toString().trim();
    if (existingKey && rowByKey[existingKey] === undefined) {
      rowByKey[existingKey] = i + 1;
    }
  }

  var appends = [];
  for (var k = 0; k < keys.length; k++) {
    var key = keys[k];
    var value = map[key];
    var jsonValue = typeof value === 'string' ? value : JSON.stringify(value);

    if (jsonValue.length > METADATA_CHUNK_CHARS) {
      setPermanentMetadataLarge(key, jsonValue);
      continue;
    }

    var row = rowByKey[key];
    if (row !== undefined) {
      ctx.sheet.getRange(row, ctx.idx.Value + 1).setValue(jsonValue);
    } else {
      appends.push([key, jsonValue]);
    }
    if (ctx.map) ctx.map[key] = jsonValue;
  }

  if (appends.length) {
    var startRow = ctx.sheet.getLastRow() + 1;
    ctx.sheet.getRange(startRow, 1, appends.length, 2).setValues(appends);
    // Keep the cached grid in step so a later read does not re-append.
    for (var a = 0; a < appends.length; a++) {
      ctx.values.push([appends[a][0], appends[a][1]]);
    }
  }
}

// A cell caps at 50000 chars, so large values split across <key>#0..#n rows with a
// <key>#COUNT row. The plain single-row form is read first, so existing rows still work.
function getPermanentMetadataLarge(key) {
  var ctx = getMetadataContext();
  if (!ctx.map) return undefined;

  var direct = ctx.map[key];
  if (direct !== undefined && direct !== null && direct !== '') return direct;

  var count = Number(ctx.map[key + '#COUNT']) || 0;
  if (count <= 0) return undefined;

  var out = '';
  for (var i = 0; i < count; i++) {
    var part = ctx.map[key + '#' + i];
    // A missing part means a torn write; rebuild beats truncated JSON.
    if (part === undefined || part === null) return undefined;
    out += part;
  }
  return out;
}

function setPermanentMetadataLarge(key, value) {
  var text = typeof value === 'string' ? value : JSON.stringify(value);

  if (text.length <= METADATA_CHUNK_CHARS) {
    setPermanentMetadata(key, text);
    clearPermanentMetadataChunks(key);
    return;
  }

  var parts = [];
  for (var i = 0; i < text.length; i += METADATA_CHUNK_CHARS) {
    parts.push(text.substring(i, i + METADATA_CHUNK_CHARS));
  }

  var batch = {};
  batch[key + '#COUNT'] = String(parts.length);
  for (var p = 0; p < parts.length; p++) {
    batch[key + '#' + p] = parts[p];
  }

  // The single-row form must not survive alongside the chunked form.
  var ctx = getMetadataContext();
  if (ctx.sheet && ctx.map && ctx.map[key] !== undefined) {
    var row = findRowByValue(ctx.sheet, ctx.idx.Key, key, 2, true);
    if (row !== -1) {
      ctx.sheet.getRange(row, ctx.idx.Value + 1).setValue('');
    }
    delete ctx.map[key];
  }

  setPermanentMetadataBatch(batch);
}

function clearPermanentMetadataChunks(key) {
  var ctx = getMetadataContext();
  if (!ctx.sheet || !ctx.map) return;

  var count = Number(ctx.map[key + '#COUNT']) || 0;
  if (count <= 0) return;

  var chunkKeys = [key + '#COUNT'];
  for (var i = 0; i < count; i++) chunkKeys.push(key + '#' + i);

  for (var c = 0; c < chunkKeys.length; c++) {
    var row = findRowByValue(ctx.sheet, ctx.idx.Key, chunkKeys[c], 2, true);
    if (row !== -1) ctx.sheet.getRange(row, ctx.idx.Value + 1).setValue('');
    delete ctx.map[chunkKeys[c]];
  }
}

/**
 * Clears permanent metadata rows from the APP Metadata sheet.
 * Returns a summary so menu wrappers and manual script runs can verify the target.
 */
function clearPermanentMetadataCache() {
  var ss = getAppSpreadsheet();
  var metaSheet = ss.getSheetByName(CONFIG.SHEETS.METADATA);
  var summary = {
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    sheetName: CONFIG.SHEETS.METADATA,
    clearedRows: 0,
    message: ''
  };

  if (!metaSheet) {
    summary.message = 'Metadata sheet was not found.';
    _metadata_cache = null;
    return summary;
  }

  var lastRow = metaSheet.getLastRow();
  var lastColumn = Math.max(metaSheet.getLastColumn(), 2);
  if (lastRow > 1) {
    metaSheet.getRange(2, 1, lastRow - 1, lastColumn).clearContent();
    summary.clearedRows = lastRow - 1;
  }

  _metadata_cache = null;
  SpreadsheetApp.flush();
  summary.message = 'Permanent metadata cache cleared.';
  return summary;
}

/**
 * Clears all in-memory and CacheService caches.
 * Call from setup/sync operation that modify APP sheets.
 */
function clearAllAppCaches() {
  // First, while the config map is still readable — the key names come from it.
  var headerKeysCleared = clearSheetHeaderCaches();

  // In-memory: spreadsheet cache
  _appSpreadsheetCache = null;
  _sheet_headers_cache = {};
  _metadata_cache = null;
  _openedSpreadsheetsCache = {};
  _config_map_cache = null;

  var metadataSummary = clearPermanentMetadataCache();
  metadataSummary.headerCacheKeysCleared = headerKeysCleared;

  // Delegate to module-specific cache clears
  if (typeof clearConfigCache === 'function') clearConfigCache();
  if (typeof clearResourceConfigCache === 'function') clearResourceConfigCache();
  if (typeof clearRolePermissionsCache === 'function') clearRolePermissionsCache();
  if (typeof clearRolesCache === 'function') clearRolesCache();
  if (typeof clearAccessRegionCache === 'function') clearAccessRegionCache();
  if (typeof clearDesignationsCache === 'function') clearDesignationsCache();
  if (typeof clearUsersCache === 'function') clearUsersCache();

  return metadataSummary;
}

/**
 * Clears and immediately rebuilds the critical APP runtime caches.
 * Intended for the Google Sheet admin menu when sheet-backed config changed.
 */
function regenerateAllAppCaches() {
  var summary = clearAllAppCaches();
  var rebuilt = [];
  var skipped = [];

  function warmCache(label, fnName) {
    if (typeof this[fnName] !== 'function') {
      skipped.push(label + ' (' + fnName + ' unavailable)');
      return;
    }
    this[fnName]();
    rebuilt.push(label);
  }

  warmCache('APP.Config', 'getConfigMap');
  warmCache('APP.Resources', 'getResourceConfigMap');
  warmCache('APP.RolePermissions', 'getRolePermissionsContext');
  warmCache('APP.Roles', 'getRolesCache');
  warmCache('APP.AccessRegions', 'getAccessRegionContext');
  warmCache('APP.Designations', 'getDesignationsCache');

  var headerSummary = warmResourceHeaderCaches();

  summary.rebuiltCaches = rebuilt;
  summary.skippedCaches = skipped;
  summary.headerCachesRebuilt = headerSummary.rebuilt;
  summary.headerCachesPersisted = headerSummary.persisted;
  summary.headerCachesSkipped = headerSummary.skipped;
  summary.headerCacheFailures = headerSummary.failures;
  summary.message = 'APP caches cleared and regenerated.';
  return summary;
}

/**
 * Warms sheet header metadata so login does not pay the first cross-file reads.
 */
function warmResourceHeaderCaches() {
  var result = { rebuilt: 0, skipped: 0, persisted: 0, failures: [] };

  if (typeof getResourceConfigMap !== 'function') {
    result.failures.push('APP.Resources config map unavailable.');
    return result;
  }

  var configMap = getResourceConfigMap() || {};
  var entries = [];
  var pairToResource = {};

  Object.keys(configMap).forEach(function(resourceName) {
    var config = configMap[resourceName] || {};
    if (config.functional || config.isActive === false || !config.fileId || !config.sheetName) {
      result.skipped++;
      return;
    }
    var pairKey = config.fileId + '::' + config.sheetName;
    if (pairToResource[pairKey] === undefined) {
      pairToResource[pairKey] = resourceName;
      entries.push({ fileId: config.fileId, sheetName: config.sheetName });
    }
  });

  if (!entries.length) return result;

  var headersByPair;
  try {
    // Forced: this IS the rebuild, so it must not read the cache it is rebuilding.
    headersByPair = getSheetHeadersBatch(entries, { force: true });
  } catch (e) {
    result.failures.push('Batch header warm failed: ' + (e && e.message ? e.message : e));
    return result;
  }

  Object.keys(pairToResource).forEach(function(pairKey) {
    var headers = headersByPair[pairKey];
    if (headers && headers.length) {
      result.rebuilt++;
    } else {
      result.skipped++;
      result.failures.push(pairToResource[pairKey] + ': no headers resolved');
    }
  });

  // `rebuilt > 0` with `persisted === 0` is the stale-cache signature: nothing was re-read.
  result.persisted = headersByPair.__persisted || 0;
  if (result.rebuilt && !result.persisted) {
    result.failures.push('Headers resolved but none persisted — they came from a cache, not the sheet.');
  }

  return result;
}

// Editor check after a schema change: compares live sheet headers against both cache
// tiers. `healthy: true` is the pass; omit the name to check every resource.
function diagResourceHeaders(resourceName) {
  var configMap = getResourceConfigMap() || {};
  var names = resourceName
    ? [resourceName]
    : Object.keys(configMap).filter(function(name) {
        var config = configMap[name] || {};
        return !config.functional && config.isActive !== false && config.fileId && config.sheetName;
      });

  var report = { checked: 0, stale: [], rows: [] };
  var scriptCache = CacheService.getScriptCache();

  names.forEach(function(name) {
    var config = configMap[name];
    if (!config || !config.fileId || !config.sheetName) return;

    var cacheKey = 'HEADERS_' + config.fileId + '_' + config.sheetName;
    var live = [];
    try {
      var ss = openSpreadsheetById(config.fileId);
      var sheet = ss ? ss.getSheetByName(config.sheetName) : null;
      var lastColumn = sheet ? sheet.getLastColumn() : 0;
      if (sheet && lastColumn) live = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
    } catch (e) { /* reported as an empty live list below */ }

    function parse(raw) {
      if (!raw) return null;
      try { return JSON.parse(raw); } catch (e) { return null; }
    }

    var fromCache = parse(scriptCache.get(cacheKey));
    var fromMetadata = parse(getPermanentMetadata(cacheKey));
    var liveJson = JSON.stringify(live);

    var row = {
      resource: name,
      sheetColumns: live.length,
      cache: fromCache ? (JSON.stringify(fromCache) === liveJson ? 'in sync' : 'STALE') : 'absent',
      metadata: fromMetadata ? (JSON.stringify(fromMetadata) === liveJson ? 'in sync' : 'STALE') : 'absent',
      missingFromCache: fromCache
        ? live.filter(function(h) { return fromCache.indexOf(h) === -1; })
        : [],
      missingFromMetadata: fromMetadata
        ? live.filter(function(h) { return fromMetadata.indexOf(h) === -1; })
        : []
    };

    report.checked++;
    report.rows.push(row);
    if (row.cache === 'STALE' || row.metadata === 'STALE') report.stale.push(name);
  });

  report.healthy = report.stale.length === 0;
  Logger.log(JSON.stringify(report, null, 2));
  return report;
}

// Ops check: confirms the config map actually persists across executions.
// Run from the Apps Script editor (never as a cell formula - custom functions
// cannot write, so the purge silently no-ops and the result is meaningless).
// warmSource 'cache' + healthy true is the pass condition.
function diagCacheHealth() {
  var report = {};
  var scopedKey = RESOURCE_CONFIG_CACHE_KEY + '_' + getAppSpreadsheet().getId();

  clearResourceConfigCache();
  report.purgedCache = !getChunkedCache(scopedKey);
  report.purgedMetadata = !getPermanentMetadataLarge(RESOURCE_CONFIG_CACHE_KEY);

  _resource_config_map_source = '';
  var t0 = Date.now();
  var map = getResourceConfigMap();
  report.coldMs = Date.now() - t0;
  report.coldSource = _resource_config_map_source;
  report.resources = Object.keys(map).length;
  report.bytes = JSON.stringify(map).length;

  _resource_config_map_cache = null;
  _resource_registry_context_cache = null;
  _metadata_cache = null;
  _resource_config_map_source = '';

  var t1 = Date.now();
  getResourceConfigMap();
  report.warmMs = Date.now() - t1;
  report.warmSource = _resource_config_map_source;

  report.cachePersisted = !!getChunkedCache(scopedKey);
  report.metadataPersisted = !!getPermanentMetadataLarge(RESOURCE_CONFIG_CACHE_KEY);
  report.catalogGeneration = getCatalogGeneration();
  report.healthy = report.warmSource === 'cache'
    && report.cachePersisted
    && report.metadataPersisted;

  Logger.log(JSON.stringify(report, null, 2));
  return report;
}
