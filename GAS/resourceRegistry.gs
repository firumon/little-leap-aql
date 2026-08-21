/**
 * ============================================================
 * AQL - Resource Registry Helpers
 * ============================================================
 * Reads the APP.Resources sheet to resolve target file/sheet dynamically.
 */

var _resource_file_cache = {};
var _resource_sheet_cache = {};
var _resource_registry_context_cache = null;
var _resource_config_map_cache = null;
var _role_permissions_context_cache = null;

// Bump this whenever the config map shape changes so stale caches are not served.
var RESOURCE_CONFIG_CACHE_KEY = 'AQL_RESOURCE_CONFIG_MAP_V3';
var RESOURCE_CONFIG_LEGACY_CACHE_KEYS = ['AQL_RESOURCE_CONFIG_MAP_V2'];

function getResourceRegistryContext() {
  if (_resource_registry_context_cache) return _resource_registry_context_cache;

  const appSheet = getAppSpreadsheet().getSheetByName(CONFIG.SHEETS.RESOURCES);
  if (!appSheet) {
    throw new Error('Resources sheet not found in APP file');
  }

  const values = appSheet.getDataRange().getValues();
  if (!values || values.length < 1) {
    throw new Error('Resources sheet is empty');
  }

  const headers = values[0];
  const idx = getHeaderIndexMap(headers);
  _resource_registry_context_cache = { appSheet, values, headers, idx };
  return _resource_registry_context_cache;
}

/**
 * Builds and caches a map of resourceName -> config for all resources.
 * Uses getResourceRegistryContext() (itself cached) as the data source.
 * Parses each resource row exactly once.
 */
function getResourceConfigMap() {
  if (_resource_config_map_cache) return _resource_config_map_cache;

  // Try CacheService for cross-execution persistence
  var scriptCache = CacheService.getScriptCache();
  var cacheKey = RESOURCE_CONFIG_CACHE_KEY;
  var cachedJson = scriptCache.get(cacheKey + '_' + getAppSpreadsheet().getId());
  if (!cachedJson) {
    // Try Permanent Metadata fallback
    cachedJson = getPermanentMetadata(cacheKey);
  }

  if (cachedJson) {
    try {
      _resource_config_map_cache = JSON.parse(cachedJson);
      return _resource_config_map_cache;
    } catch (e) { /* fall through to fresh build */ }
  }

  var registry = getResourceRegistryContext();
  var map = {};

  for (var i = 1; i < registry.values.length; i++) {
    var row = registry.values[i];
    var name = (row[registry.idx.Name] || '').toString().trim();
    if (!name || map[name]) continue;

    var scope = normalizeResourceScope(readOptionalCell(row, registry.idx.Scope, 'master'));
    var rawFileId = (row[registry.idx.FileID] || '').toString().trim();

    var listViewsMeta = parseListViewsCell(readOptionalCell(row, registry.idx.ListViews, ''));
    var menuRaw = parseJsonCell(readOptionalCell(row, registry.idx.Menu, '[]'), []);
    var menuArr = Array.isArray(menuRaw) ? menuRaw : (menuRaw && typeof menuRaw === 'object' ? [menuRaw] : []);

    map[name] = {
      name: name,
      scope: scope,
      fileId: resolveFileIdForScope(scope, rawFileId),
      sheetName: (row[registry.idx.SheetName] || '').toString().trim(),
      isActive: toBooleanCell(readOptionalCell(row, registry.idx.IsActive, true)),
      audit: toBooleanCell(readOptionalCell(row, registry.idx.Audit, false)),
      codePrefix: registry.idx.CodePrefix === undefined
        ? ''
        : (row[registry.idx.CodePrefix] || '').toString().trim(),
      codeSequenceLength: normalizeCodeSequenceLength(
        registry.idx.CodeSequenceLength === undefined
          ? ''
          : row[registry.idx.CodeSequenceLength]
      ),
      lastDataUpdatedAt: Number(readOptionalCell(row, registry.idx.LastDataUpdatedAt, 0)) || 0,
      requiredHeaders: parseHeaderList(readOptionalCell(row, registry.idx.RequiredHeaders, '')),
      uniqueHeaders: parseHeaderList(readOptionalCell(row, registry.idx.UniqueHeaders, '')),
      uniqueCompositeHeaders: parseCompositeHeaders(readOptionalCell(row, registry.idx.UniqueCompositeHeaders, '')),
      defaultValues: parseJsonCell(readOptionalCell(row, registry.idx.DefaultValues, '{}'), {}),
      recordAccessPolicy: normalizeRecordAccessPolicy(readOptionalCell(row, registry.idx.RecordAccessPolicy, 'all')),
      ownerUserField: (readOptionalCell(row, registry.idx.OwnerUserField, 'CreatedBy') || '').toString().trim() || 'CreatedBy',
      menus: menuArr.map(function(m) {
        // Canonical outbound key is `group`; tolerate legacy sheet/menu shapes on read.
        var rawGroup = m.group;
        if (!rawGroup && m.groupPath) rawGroup = m.groupPath;

        // Role-aware objects (keys are role IDs or "default") pass through as-is
        function isCustomizable(thing) {
          if (thing === null || thing === undefined) return false;
          if (Array.isArray(thing)) return false;
          return typeof thing === 'object';
        }

        var group;
        if (isCustomizable(rawGroup)) {
          group = rawGroup;
        } else {
          group = [];
          if (Array.isArray(rawGroup)) {
            group = rawGroup.map(function(part) { return (part || '').toString().trim(); }).filter(Boolean);
          } else if (rawGroup !== null && rawGroup !== undefined && rawGroup !== '') {
            group = [(rawGroup || '').toString().trim()].filter(Boolean);
          }
          if (!group.length) group = ['General'];
        }

        return {
          group: group,
          order: isCustomizable(m.order) ? m.order : (Number(m.order) || 9999),
          label: isCustomizable(m.label) ? m.label : (m.label || name),
          icon: isCustomizable(m.icon) ? m.icon : (m.icon || 'list_alt'),
          route: m.route || '',
          pageTitle: isCustomizable(m.pageTitle) ? m.pageTitle : (m.pageTitle || name),
          pageDescription: isCustomizable(m.pageDescription) ? m.pageDescription : (m.pageDescription || ''),
          show: m.show !== undefined ? (isCustomizable(m.show) ? m.show : toBooleanCell(m.show)) : true,
          menuAccess: m.menuAccess || null
        };
      }),
      uiFields: parseJsonCell(readOptionalCell(row, registry.idx.UIFields, '[]'), []),
      includeInAuthorizationPayload: toBooleanCell(readOptionalCell(row, registry.idx.IncludeInAuthorizationPayload, true)),
      parentResource: (readOptionalCell(row, registry.idx.ParentResource, '') || '').toString().trim(),
      additionalActions: parseAdditionalActions(readOptionalCell(row, registry.idx.AdditionalActions, '')),
      functional: toBooleanCell(readOptionalCell(row, registry.idx.Functional, false)),
      preAction: (readOptionalCell(row, registry.idx.PreAction, '') || '').toString().trim(),
      postAction: (readOptionalCell(row, registry.idx.PostAction, '') || '').toString().trim(),
      reports: parseJsonCell(readOptionalCell(row, registry.idx.Reports, '[]'), []),
      customUIName: (readOptionalCell(row, registry.idx.CustomUIName, '') || '').toString().trim(),
      listViews: listViewsMeta.views,
      listViewsMode: listViewsMeta.mode,
      relations: parseRelationsCell(readOptionalCell(row, registry.idx.Relations, ''))
    };
  }

  _resource_config_map_cache = map;

  // Persist to CacheService AND Permanent Metadata
  try {
    var json = JSON.stringify(map);
    if (json.length < 100000) {
      scriptCache.put(cacheKey + '_' + getAppSpreadsheet().getId(), json, 300);
    }
    setPermanentMetadata(cacheKey, json);
  } catch (e) { /* non-fatal */ }

  return map;
}

/**
 * Clears the cached resource config map from both memory and CacheService.
 * Call after any write to the Resources sheet (setup, sync, manual edits).
 */
function clearResourceConfigCache() {
  _resource_config_map_cache = null;
  _resource_registry_context_cache = null;
  _resource_sheet_cache = {};

  var keys = [RESOURCE_CONFIG_CACHE_KEY].concat(RESOURCE_CONFIG_LEGACY_CACHE_KEYS);
  for (var i = 0; i < keys.length; i++) {
    try {
      CacheService.getScriptCache().remove(keys[i] + '_' + getAppSpreadsheet().getId());
    } catch (e) { /* non-fatal */ }
    // Clear Permanent Metadata fallback so stale data is not served on cold start
    try {
      var ctx = getMetadataContext();
      if (ctx.sheet) {
        var row = findRowByValue(ctx.sheet, ctx.idx.Key, keys[i], 2, true);
        if (row !== -1) {
          ctx.sheet.deleteRow(row);
          if (ctx.map) delete ctx.map[keys[i]];
        }
      }
    } catch (e) { /* non-fatal */ }
  }
}

function getResourceConfig(resourceName) {
  var name = (resourceName || '').toString().trim();
  if (!name) {
    throw new Error('Resource name is required');
  }

  var map = getResourceConfigMap();
  var config = map[name];
  if (!config) {
    throw new Error('Resource not configured: ' + name);
  }
  return config;
}

function openResourceSheet(resourceName) {
  const config = getResourceConfig(resourceName);
  if (!config.fileId) {
    throw new Error('Resource fileId could not be resolved for: ' + resourceName + ' (scope=' + config.scope + '). Check Resources.FileID or Config[' + config.scope.charAt(0).toUpperCase() + config.scope.slice(1) + 'FileID].');
  }
  if (!config.sheetName) {
    throw new Error('Resource sheetName is missing for: ' + resourceName + '. Set SheetName in APP.Resources.');
  }

  var file = openSpreadsheetById(config.fileId);

  const sheetCacheKey = config.fileId + '::' + config.sheetName;
  var sheet = _resource_sheet_cache[sheetCacheKey];
  if (!sheet) {
    sheet = file.getSheetByName(config.sheetName);
    if (sheet) {
      _resource_sheet_cache[sheetCacheKey] = sheet;
    }
  }
  if (!sheet) {
    throw new Error('Sheet not found for resource ' + resourceName + ': ' + config.sheetName);
  }

  return { config, file, sheet };
}

/**
 * ------------------------------------------------------------
 * Dynamic sync cursor store
 * ------------------------------------------------------------
 * The data cursor (`LastDataUpdatedAt`) changes on every write, so it is kept
 * OUT of the heavy, long-lived resource config snapshot
 * (AQL_RESOURCE_CONFIG_MAP_V3 / permanent metadata) which is intentionally
 * frozen. Cursors live in their own CacheService keys:
 *
 *   AQL_CURSOR_<SpreadsheetId>_<ResourceName>
 *
 * The spreadsheet id is part of the key so standalone (AqlCore) deployments
 * shared across tenants cannot collide. APP.Resources remains the durable
 * store; CacheService is the fast path with a 6h TTL and a sheet-backed
 * fallback on cold start.
 */
var CURSOR_CACHE_PREFIX = 'AQL_CURSOR_';
var CURSOR_CACHE_TTL_SEC = 21600; // 6 hours
var _resource_cursor_cache = {};

function buildResourceCursorCacheKey(resourceName) {
  return CURSOR_CACHE_PREFIX + getAppSpreadsheet().getId() + '_' + resourceName;
}

/**
 * Reads sync cursors for the given resource names.
 * Fast path: CacheService (one batched getAll). Cold start falls back to the
 * LastDataUpdatedAt cell in APP.Resources and re-populates the cache.
 *
 * @param {string[]} resourceNames
 * @return {Object} map of resourceName -> epoch millis (0 when unknown)
 */
function getResourceSyncCursors(resourceNames) {
  var names = [];
  var out = {};
  var list = Array.isArray(resourceNames) ? resourceNames : [resourceNames];

  for (var n = 0; n < list.length; n++) {
    var name = (list[n] || '').toString().trim();
    if (!name || out[name] !== undefined) continue;
    out[name] = 0;
    names.push(name);
  }
  if (!names.length) return out;

  var pending = [];
  for (var a = 0; a < names.length; a++) {
    var memName = names[a];
    if (_resource_cursor_cache[memName] !== undefined) {
      out[memName] = _resource_cursor_cache[memName];
    } else {
      pending.push(memName);
    }
  }
  if (!pending.length) return out;

  var keys = [];
  var keyToName = {};
  for (var b = 0; b < pending.length; b++) {
    var key = buildResourceCursorCacheKey(pending[b]);
    keys.push(key);
    keyToName[key] = pending[b];
  }

  var cached = {};
  try {
    cached = CacheService.getScriptCache().getAll(keys) || {};
  } catch (e) {
    cached = {};
  }

  var missing = [];
  for (var c = 0; c < keys.length; c++) {
    var k = keys[c];
    var nm = keyToName[k];
    if (cached[k] !== undefined && cached[k] !== null && cached[k] !== '') {
      var parsed = Number(cached[k]) || 0;
      out[nm] = parsed;
      _resource_cursor_cache[nm] = parsed;
    } else {
      missing.push(nm);
    }
  }

  if (!missing.length) return out;

  // Cold start: hydrate the misses from APP.Resources in a single sheet read.
  var toCache = {};
  try {
    var registry = getResourceRegistryContext();
    if (registry.idx.LastDataUpdatedAt !== undefined) {
      var wanted = {};
      for (var m = 0; m < missing.length; m++) wanted[missing[m]] = true;

      for (var i = 1; i < registry.values.length; i++) {
        var row = registry.values[i];
        var rowName = (row[registry.idx.Name] || '').toString().trim();
        if (!rowName || !wanted[rowName]) continue;

        var value = Number(row[registry.idx.LastDataUpdatedAt]) || 0;
        out[rowName] = value;
        _resource_cursor_cache[rowName] = value;
        toCache[buildResourceCursorCacheKey(rowName)] = String(value);
      }
    }
  } catch (e) {
    console.warn('getResourceSyncCursors: sheet fallback failed: ' + e.message);
  }

  if (Object.keys(toCache).length) {
    try {
      CacheService.getScriptCache().putAll(toCache, CURSOR_CACHE_TTL_SEC);
    } catch (e) { /* cache is best-effort */ }
  }

  return out;
}

/** Single-resource convenience wrapper around getResourceSyncCursors(). */
function getResourceSyncCursor(resourceName) {
  var name = (resourceName || '').toString().trim();
  if (!name) return 0;
  return getResourceSyncCursors([name])[name] || 0;
}

/**
 * Writes a cursor to CacheService (and the in-memory mirror) without touching
 * the sheet. Monotonic: an older timestamp never rewinds a newer one.
 * Used by read paths that derive max(UpdatedAt) from the rows they just read.
 */
function bumpResourceSyncCursorCache(resourceName, timestamp) {
  var name = (resourceName || '').toString().trim();
  var ts = Number(timestamp) || 0;
  if (!name || !ts) return 0;

  var current = _resource_cursor_cache[name];
  if (current === undefined) {
    current = getResourceSyncCursors([name])[name] || 0;
  }
  if (ts <= current) return current;

  _resource_cursor_cache[name] = ts;
  try {
    CacheService.getScriptCache().put(buildResourceCursorCacheKey(name), String(ts), CURSOR_CACHE_TTL_SEC);
  } catch (e) { /* cache is best-effort */ }
  return ts;
}

/**
 * Advances the durable sync cursor for a resource.
 * Writes APP.Resources.LastDataUpdatedAt and immediately refreshes the
 * CacheService key so the very next poll execution observes the change.
 *
 * @param {string} resourceName
 * @param {number} [timestamp] epoch millis; defaults to Date.now(). Callers
 *   that just stamped audit fields should pass the identical timestamp so the
 *   cursor and the row's UpdatedAt cannot disagree.
 */
function updateResourceSyncCursor(resourceName, timestamp) {
  var name = (resourceName || '').toString().trim();
  if (!name) {
    throw new Error('Resource name is required');
  }

  var now = Number(timestamp) || Date.now();

  var registry = getResourceRegistryContext();
  if (registry.idx.LastDataUpdatedAt === undefined) {
    return;
  }

  for (var i = 1; i < registry.values.length; i++) {
    var row = registry.values[i];
    var rowName = (row[registry.idx.Name] || '').toString().trim();
    if (rowName !== name) continue;

    registry.appSheet.getRange(i + 1, registry.idx.LastDataUpdatedAt + 1).setValue(now);
    // Keep the cached registry values in step so a later read in this same
    // execution does not resurrect the pre-write value.
    row[registry.idx.LastDataUpdatedAt] = now;

    // Dynamic cursor store: visible to the next execution's poll in ~1ms.
    _resource_cursor_cache[name] = now;
    try {
      CacheService.getScriptCache().put(buildResourceCursorCacheKey(name), String(now), CURSOR_CACHE_TTL_SEC);
    } catch (e) { /* cache is best-effort */ }

    // Update the in-memory config map if loaded, so subsequent reads in
    // the same execution see the new cursor without re-reading the sheet
    if (_resource_config_map_cache && _resource_config_map_cache[name]) {
      _resource_config_map_cache[name].lastDataUpdatedAt = now;
    }
    return;
  }

  throw new Error('Resource not configured: ' + name);
}

/**
 * Advances the durable sync cursor for multiple resources in a single batch write.
 * Writes APP.Resources.LastDataUpdatedAt and immediately refreshes the
 * CacheService keys so poll executions observe the changes.
 *
 * @param {Object} cursorMap Map of resourceName -> timestamp (epoch millis)
 * @return {Object} summary of updated resources
 */
function updateMultipleResourceSyncCursors(cursorMap) {
  if (!cursorMap || typeof cursorMap !== 'object') {
    return { updated: 0, resources: [] };
  }

  var registry = getResourceRegistryContext();
  if (registry.idx.LastDataUpdatedAt === undefined) {
    return { updated: 0, resources: [] };
  }

  var toCache = {};
  var updatedNames = [];
  var hasChanges = false;

  for (var i = 1; i < registry.values.length; i++) {
    var row = registry.values[i];
    var rowName = (row[registry.idx.Name] || '').toString().trim();
    if (!rowName || cursorMap[rowName] === undefined) continue;

    var ts = Number(cursorMap[rowName]) || 0;
    row[registry.idx.LastDataUpdatedAt] = ts;

    _resource_cursor_cache[rowName] = ts;
    toCache[buildResourceCursorCacheKey(rowName)] = String(ts);

    if (_resource_config_map_cache && _resource_config_map_cache[rowName]) {
      _resource_config_map_cache[rowName].lastDataUpdatedAt = ts;
    }

    updatedNames.push(rowName);
    hasChanges = true;
  }

  if (hasChanges && registry.values.length > 1) {
    var colValues = [];
    for (var r = 1; r < registry.values.length; r++) {
      colValues.push([registry.values[r][registry.idx.LastDataUpdatedAt] || 0]);
    }
    registry.appSheet.getRange(2, registry.idx.LastDataUpdatedAt + 1, colValues.length, 1).setValues(colValues);
  }

  if (Object.keys(toCache).length) {
    try {
      CacheService.getScriptCache().putAll(toCache, CURSOR_CACHE_TTL_SEC);
    } catch (e) { /* cache is best-effort */ }
  }

  return { updated: updatedNames.length, resources: updatedNames };
}

/**
 * Scans each active, sheet-backed resource in APP.Resources, finds its maximum
 * UpdatedAt timestamp, and updates both APP.Resources.LastDataUpdatedAt and CacheService
 * in a single batch operation.
 *
 * @return {Object} execution summary
 */
function recalculateAllResourcesLastDataUpdatedAt() {
  var registry = getResourceRegistryContext();
  if (registry.idx.LastDataUpdatedAt === undefined) {
    throw new Error('APP.Resources sheet missing LastDataUpdatedAt column');
  }

  var cursorMap = {};
  var details = [];
  var errors = [];
  var skipped = 0;
  var spreadsheetMap = {};

  function openSpreadsheetSafe(fileId) {
    if (!fileId) return null;
    if (spreadsheetMap[fileId]) return spreadsheetMap[fileId];
    try {
      var ss = SpreadsheetApp.openById(fileId);
      spreadsheetMap[fileId] = ss;
      return ss;
    } catch (e) {
      return null;
    }
  }

  for (var i = 1; i < registry.values.length; i++) {
    var row = registry.values[i];
    var name = (row[registry.idx.Name] || '').toString().trim();
    if (!name) continue;

    var isActive = row[registry.idx.IsActive];
    var isFunctional = row[registry.idx.Functional];
    var isDeactivated = (isActive !== undefined && (isActive === false || String(isActive).trim().toUpperCase() === 'FALSE'));
    var isFunc = (isFunctional !== undefined && (isFunctional === true || String(isFunctional).trim().toUpperCase() === 'TRUE'));

    if (isDeactivated || isFunc) {
      skipped++;
      continue;
    }

    var scope = (row[registry.idx.Scope] || 'master').toString().trim();
    var rawFileId = (row[registry.idx.FileID] || '').toString().trim();
    var sheetName = (row[registry.idx.SheetName] || name).toString().trim();
    var fileId = resolveFileIdForScope(scope, rawFileId);

    if (!fileId || !sheetName) {
      skipped++;
      continue;
    }

    try {
      var ss = openSpreadsheetSafe(fileId);
      if (!ss) {
        errors.push(name + ': Could not open spreadsheet ' + fileId);
        continue;
      }

      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        errors.push(name + ': Sheet "' + sheetName + '" not found in ' + fileId);
        continue;
      }

      var data = sheet.getDataRange().getValues();
      var maxUpdatedAt = 0;

      if (data && data.length > 1) {
        var headers = data[0];
        var updatedAtIdx = -1;
        var createdAtIdx = -1;

        for (var h = 0; h < headers.length; h++) {
          var hName = (headers[h] || '').toString().trim();
          if (hName === 'UpdatedAt') {
            updatedAtIdx = h;
            break;
          }
          if (hName === 'CreatedAt') {
            createdAtIdx = h;
          }
        }

        var checkColIdx = updatedAtIdx !== -1 ? updatedAtIdx : createdAtIdx;

        if (checkColIdx !== -1) {
          for (var r = 1; r < data.length; r++) {
            var cellVal = data[r][checkColIdx];
            var ts = typeof normalizeUpdatedAtMillis === 'function'
              ? normalizeUpdatedAtMillis(cellVal)
              : (Number(cellVal) || (cellVal instanceof Date ? cellVal.getTime() : 0));
            if (ts > maxUpdatedAt) {
              maxUpdatedAt = ts;
            }
          }
        }
      }

      cursorMap[name] = maxUpdatedAt;
      details.push({
        name: name,
        sheetName: sheetName,
        maxUpdatedAt: maxUpdatedAt
      });
    } catch (err) {
      errors.push(name + ': ' + err.message);
    }
  }

  var updateResult = updateMultipleResourceSyncCursors(cursorMap);

  return {
    scanned: details.length,
    updated: updateResult.updated,
    skipped: skipped,
    details: details,
    errors: errors
  };
}

function normalizeCodeSequenceLength(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    return 6;
  }
  return Math.floor(num);
}

function normalizeResourceScope(value) {
  var normalized = (value || 'master').toString().trim().toLowerCase();
  var validScopes = getConfiguredScopes();
  if (validScopes.indexOf(normalized) !== -1) return normalized;
  throw new Error('Invalid scope value: "' + value + '". Must be one of: ' + validScopes.join(', ') + '.');
}

function normalizeRecordAccessPolicy(value) {
  const normalized = (value || 'all').toString().trim().toUpperCase();
  if (normalized === 'OWNER') return 'OWNER';
  if (normalized === 'OWNER_GROUP') return 'OWNER_GROUP';
  if (normalized === 'OWNER_AND_UPLINE') return 'OWNER_AND_UPLINE';
  return 'ALL';
}

function readOptionalCell(row, index, fallback) {
  if (index === undefined) return fallback;
  const value = row[index];
  return value === undefined ? fallback : value;
}

function parseJsonCell(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (err) {
    return fallback;
  }
}

/**
 * ListViews mode contract from a single cell:
 * - "" (blank) => auto
 * - [] => off
 * - [ ...non-empty ] => custom
 * - invalid => auto (safe fallback)
 */
function parseListViewsCell(value) {
  if (value === undefined || value === null) {
    return { mode: 'auto', views: [] };
  }

  if (Array.isArray(value)) {
    return {
      mode: value.length ? 'custom' : 'off',
      views: value
    };
  }

  var raw = (value || '').toString().trim();
  if (!raw) {
    return { mode: 'auto', views: [] };
  }

  try {
    var parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return { mode: 'auto', views: [] };
    }
    return {
      mode: parsed.length ? 'custom' : 'off',
      views: parsed
    };
  } catch (e) {
    return { mode: 'auto', views: [] };
  }
}

function parseHeaderList(value) {
  return parseStringList(value);
}

function parseStringList(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(function(entry) {
      return (entry || '').toString().trim();
    }).filter(function(entry) {
      return !!entry;
    });
  }

  return value.toString().split(',').map(function(entry) {
    return (entry || '').toString().trim();
  }).filter(function(entry) {
    return !!entry;
  });
}

/**
 * Parses AdditionalActions JSON from the resource config cell.
 * Always JSON: [{action:"Approve",label:"Approve",column:"Progress",...}]
 */
function parseAdditionalActions(value) {
  if (!value) return [];
  var str = (value || '').toString().trim();
  if (!str) return [];
  try { return JSON.parse(str); } catch (e) { return []; }
}

/**
 * Parses the APP.Resources.Relations cell into a header -> relation map.
 *
 * Accepted entry shapes:
 *   "SupplierCode": "Suppliers"                                  (shorthand)
 *   "ParentCode": { resource, targetHeader?, labelHeader? }       (extended)
 *
 * Shorthand entries are preserved as-is; extended entries are trimmed and
 * stripped of unknown keys. Entries without a target resource are dropped.
 */
function parseRelationsCell(value) {
  var parsed = parseJsonCell(value, {});
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

  var relations = {};
  Object.keys(parsed).forEach(function(header) {
    var key = (header || '').toString().trim();
    if (!key) return;

    var spec = parsed[header];
    if (typeof spec === 'string') {
      var shorthand = spec.trim();
      if (shorthand) relations[key] = shorthand;
      return;
    }

    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return;

    var resource = (spec.resource || '').toString().trim();
    if (!resource) return;

    var entry = { resource: resource };
    var targetHeader = (spec.targetHeader || '').toString().trim();
    var labelHeader = (spec.labelHeader || '').toString().trim();
    if (targetHeader) entry.targetHeader = targetHeader;
    if (labelHeader) entry.labelHeader = labelHeader;
    relations[key] = entry;
  });

  return relations;
}

function parseCompositeHeaders(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().startsWith('[')) {
    return parseJsonCell(value, []);
  }

  return value.toString().split(';').map(function(group) {
    return group.split('+').map(function(item) {
      return (item || '').toString().trim();
    }).filter(function(item) {
      return !!item;
    });
  }).filter(function(group) {
    return group.length > 1;
  });
}

function getRolePermissionsContext() {
  if (_role_permissions_context_cache) return _role_permissions_context_cache;

  // Try CacheService
  var scriptCache = CacheService.getScriptCache();
  var cachedJson = scriptCache.get('AQL_ROLE_PERMS_CONTEXT_V1_' + getAppSpreadsheet().getId());
  if (cachedJson) {
    try {
      var parsed = JSON.parse(cachedJson);
      // Reconstruct: we cache {values, headers, idx} but NOT the sheet object
      // The sheet object is only needed for writes â€” permissions context is read-only in API paths
      _role_permissions_context_cache = {
        rolePermSheet: null,
        values: parsed.values,
        headers: parsed.headers,
        idx: parsed.idx
      };
      return _role_permissions_context_cache;
    } catch (e) { /* fall through */ }
  }

  var rolePermSheet = getAppSpreadsheet().getSheetByName(CONFIG.SHEETS.ROLE_PERMISSIONS);
  if (!rolePermSheet) {
    throw new Error('RolePermissions sheet not found in APP file');
  }

  var values = rolePermSheet.getDataRange().getValues();
  var headers = values && values.length ? values[0] : [];
  var idx = getHeaderIndexMap(headers);

  _role_permissions_context_cache = { rolePermSheet: rolePermSheet, values: values, headers: headers, idx: idx };

  // Persist to CacheService (serializable parts only â€” exclude sheet object)
  try {
    var json = JSON.stringify({ values: values, headers: headers, idx: idx });
    if (json.length < 100000) {
      scriptCache.put('AQL_ROLE_PERMS_CONTEXT_V1_' + getAppSpreadsheet().getId(), json, 300);
    }
  } catch (e) { /* non-fatal */ }

  return _role_permissions_context_cache;
}

/**
 * Clears the cached role permissions context.
 * Call after any write to the RolePermissions sheet.
 */
function clearRolePermissionsCache() {
  _role_permissions_context_cache = null;
  try {
    CacheService.getScriptCache().remove('AQL_ROLE_PERMS_CONTEXT_V1_' + getAppSpreadsheet().getId());
  } catch (e) { /* non-fatal */ }
}

function getRoleResourceAccess(roleId, options) {
  const roleIds = normalizeRoleIds(roleId);
  if (!roleIds.length) return [];

  const includeHeaders = options && options.includeHeaders === true;
  const includeUiConfig = !(options && options.includeUiConfig === false);
  const scopeFilter = options && options.scope ? normalizeResourceScope(options.scope) : '';
  const permissionsContext = getRolePermissionsContext();
  const wildcardTargets = getAllConfiguredResourceNames();
  const resourceMap = {};
  const allowedActionsMap = {};
  const possibleActionsMap = {};

  for (let i = 1; i < permissionsContext.values.length; i++) {
    const row = permissionsContext.values[i];
    const rowRoleId = (row[permissionsContext.idx.RoleID] || '').toString().trim();
    if (roleIds.indexOf(rowRoleId) === -1) continue;

    const rowResource = (row[permissionsContext.idx.Resource] || '').toString().trim();
    if (!rowResource) continue;

    const targetResources = isWildcardValue(rowResource) ? wildcardTargets : [rowResource];
    if (!targetResources.length) continue;

    const actionList = parseStringList(readOptionalCell(row, permissionsContext.idx.Actions, ''));
    for (let t = 0; t < targetResources.length; t++) {
      const resourceName = targetResources[t];

      if (!resourceMap[resourceName]) {
        const entry = buildAuthorizedResourceEntry(resourceName, {
          includeHeaders: includeHeaders,
          includeUiConfig: includeUiConfig,
          scopeFilter: scopeFilter
        });
        if (!entry) continue;
        resourceMap[resourceName] = entry;
        if (includeUiConfig) {
          allowedActionsMap[resourceName] = [];
          possibleActionsMap[resourceName] = entry.additionalActions.map(function(a) {
            return (a.action || '');
          }).filter(Boolean);
        }
      }

      const permissionSet = buildPermissionSetFromActions(actionList, {
        resourceActions: includeUiConfig ? possibleActionsMap[resourceName] : []
      });
      const hasAnyPermission = permissionSet.canRead || permissionSet.canWrite || permissionSet.canUpdate || permissionSet.canDelete;
      if (!hasAnyPermission) continue;

      resourceMap[resourceName].permissions.canRead = resourceMap[resourceName].permissions.canRead || permissionSet.canRead;
      resourceMap[resourceName].permissions.canWrite = resourceMap[resourceName].permissions.canWrite || permissionSet.canWrite;
      resourceMap[resourceName].permissions.canUpdate = resourceMap[resourceName].permissions.canUpdate || permissionSet.canUpdate;
      resourceMap[resourceName].permissions.canDelete = resourceMap[resourceName].permissions.canDelete || permissionSet.canDelete;
      if (includeUiConfig && permissionSet.actions && permissionSet.actions.length) {
        allowedActionsMap[resourceName] = mergeStringLists(allowedActionsMap[resourceName], permissionSet.actions);
      }
    }
  }

  return Object.keys(resourceMap).map(function(resourceName) {
    const entry = resourceMap[resourceName];
    const possibleActions = possibleActionsMap[resourceName] || [];
    if (includeUiConfig && possibleActions.length) {
      const allowed = allowedActionsMap[resourceName] || [];
      possibleActions.forEach(function(actionName) {
        const isAllowed = allowed.some(function(allowedAct) {
          return String(allowedAct).toUpperCase() === String(actionName).toUpperCase();
        });
        const pascalName = actionName.charAt(0).toUpperCase() + actionName.slice(1);
        entry.permissions['can' + pascalName] = isAllowed;
      });
    }
    return entry;
  });
}

function buildAuthorizedResourceEntry(resourceName, options) {
  const opts = options || {};
  let config;

  try {
    config = getResourceConfig(resourceName);
  } catch (err) {
    console.warn('buildAuthorizedResourceEntry skipped resource "' + resourceName + '": ' + (err && err.message ? err.message : err));
    return null;
  }

  if (!config.isActive) return null;
  if (opts.scopeFilter && config.scope !== opts.scopeFilter) return null;
  if (!config.includeInAuthorizationPayload) return null;

  const entry = {
    name: resourceName,
    scope: config.scope,
    parentResource: config.parentResource || '',
    relations: config.relations || {},
    sheetName: config.sheetName,
    codePrefix: config.codePrefix,
    codeSequenceLength: config.codeSequenceLength,
    functional: config.functional || false,
    defaultValues: config.defaultValues || {},
    permissions: {
      canRead: false,
      canWrite: false,
      canUpdate: false,
      canDelete: false
    }
  };

  if (opts.includeHeaders && !config.functional) {
    try {
      // Use meta-only fetch (checks cache first before openById)
      entry.headers = getSheetHeadersByMeta(config.fileId, config.sheetName);
    } catch (err) {
      entry.headers = [];
    }
  } else if (opts.includeHeaders && config.functional) {
    entry.headers = [];
  }

  if (opts.includeUiConfig) {
    entry.ui = {
      menus: Array.isArray(config.menus) ? config.menus : [],
      fields: Array.isArray(config.uiFields) ? config.uiFields : [],
      customUIName: config.customUIName || '',
      listViews: Array.isArray(config.listViews) ? config.listViews : [],
      listViewsMode: (config.listViewsMode || 'auto').toString()
    };
    entry.additionalActions = Array.isArray(config.additionalActions) ? config.additionalActions : [];
    entry.reports = Array.isArray(config.reports) ? config.reports : [];
  }

  return entry;
}

function toBooleanCell(value) {
  if (value === true) return true;
  if (value === false) return false;

  const normalized = (value || '').toString().trim().toLowerCase();
  return normalized === 'true' || normalized === 'yes' || normalized === '1';
}

function getRolePermissionForResource(roleId, resourceName) {
  const normalizedRoleIds = normalizeRoleIds(roleId);
  const normalizedResourceName = (resourceName || '').toString().trim();
  const emptyPermissions = {
    canRead: false,
    canWrite: false,
    canUpdate: false,
    canDelete: false
  };

  if (!normalizedRoleIds.length || !normalizedResourceName) {
    return emptyPermissions;
  }

  const permissionsContext = getRolePermissionsContext();
  const result = {
    canRead: false,
    canWrite: false,
    canUpdate: false,
    canDelete: false
  };

  for (let i = 1; i < permissionsContext.values.length; i++) {
    const row = permissionsContext.values[i];
    const rowRoleId = (row[permissionsContext.idx.RoleID] || '').toString().trim();
    const rowResource = (row[permissionsContext.idx.Resource] || '').toString().trim();

    if (normalizedRoleIds.indexOf(rowRoleId) === -1) {
      continue;
    }
    if (!isWildcardValue(rowResource) && rowResource !== normalizedResourceName) {
      continue;
    }

    const permissionSet = buildPermissionSetFromActions(
      parseStringList(readOptionalCell(row, permissionsContext.idx.Actions, ''))
    );
    result.canRead = result.canRead || permissionSet.canRead;
    result.canWrite = result.canWrite || permissionSet.canWrite;
    result.canUpdate = result.canUpdate || permissionSet.canUpdate;
    result.canDelete = result.canDelete || permissionSet.canDelete;
  }

  return result;
}

function hasRolePermission(roleId, resourceName, permissionName) {
  const permissions = getRolePermissionForResource(roleId, resourceName);
  return permissions && permissions[permissionName] === true;
}

function hasRoleActionPermission(roleId, resourceName, actionName) {
  const normalizedAction = normalizeActionName(actionName);
  if (!normalizedAction) return false;

  const roleIds = normalizeRoleIds(roleId);
  if (!roleIds.length) return false;

  const permissionsContext = getRolePermissionsContext();
  for (let i = 1; i < permissionsContext.values.length; i++) {
    const row = permissionsContext.values[i];
    const rowRoleId = (row[permissionsContext.idx.RoleID] || '').toString().trim();
    const rowResource = (row[permissionsContext.idx.Resource] || '').toString().trim();
    if (roleIds.indexOf(rowRoleId) === -1) {
      continue;
    }
    if (!isWildcardValue(rowResource) && rowResource !== resourceName) {
      continue;
    }

    const permissionSet = buildPermissionSetFromActions(
      parseStringList(readOptionalCell(row, permissionsContext.idx.Actions, '')),
      { resourceActions: getResourceAdditionalActions(resourceName) }
    );
    if (permissionSet.actions.indexOf(normalizedAction) !== -1) {
      return true;
    }
    if (normalizedAction === 'CREATE' && permissionSet.canWrite) {
      return true;
    }
    if (normalizedAction === 'WRITE' && permissionSet.canWrite) {
      return true;
    }
    if (normalizedAction === 'READ' && permissionSet.canRead) {
      return true;
    }
    if (normalizedAction === 'UPDATE' && permissionSet.canUpdate) {
      return true;
    }
    if (normalizedAction === 'DELETE' && permissionSet.canDelete) {
      return true;
    }
  }

  return false;
}

function getResourceAdditionalActions(resourceName) {
  try {
    const config = getResourceConfig(resourceName);
    return Array.isArray(config.additionalActions) ? config.additionalActions : [];
  } catch (err) {
    return [];
  }
}

function getAllConfiguredResourceNames() {
  var map = getResourceConfigMap();
  return Object.keys(map);
}

function isWildcardValue(value) {
  return (value || '').toString().trim() === '*';
}

function buildPermissionSetFromActions(actions, options) {
  const normalizedActions = (actions || []).map(function(action) {
    return normalizeActionName(action);
  }).filter(function(action) {
    return !!action;
  });
  const hasAllActions = normalizedActions.indexOf('*') !== -1;
  const resourceActions = options && Array.isArray(options.resourceActions)
    ? options.resourceActions.map(function(action) {
      return normalizeActionName(action);
    }).filter(function(action) {
      return !!action;
    })
    : [];
  const allActionsSet = mergeStringLists(
    ['READ', 'CREATE', 'WRITE', 'UPDATE', 'DELETE'],
    resourceActions
  );
  const effectiveActions = hasAllActions ? allActionsSet : normalizedActions;

  return {
    canRead: hasAllActions || effectiveActions.indexOf('READ') !== -1,
    canWrite: hasAllActions || effectiveActions.indexOf('WRITE') !== -1 || effectiveActions.indexOf('CREATE') !== -1,
    canUpdate: hasAllActions || effectiveActions.indexOf('UPDATE') !== -1,
    canDelete: hasAllActions || effectiveActions.indexOf('DELETE') !== -1,
    actions: effectiveActions
  };
}

function normalizeRoleIds(roleIdsOrSingle) {
  if (Array.isArray(roleIdsOrSingle)) {
    return roleIdsOrSingle.map(function(roleId) {
      return (roleId || '').toString().trim();
    }).filter(function(roleId) {
      return !!roleId;
    });
  }

  const single = (roleIdsOrSingle || '').toString().trim();
  if (!single) return [];
  return [single];
}

function mergeStringLists(currentList, incomingList) {
  const uniqueMap = {};
  (currentList || []).forEach(function(entry) {
    const key = (entry || '').toString().trim();
    if (key) uniqueMap[key] = true;
  });
  (incomingList || []).forEach(function(entry) {
    const key = (entry || '').toString().trim();
    if (key) uniqueMap[key] = true;
  });
  return Object.keys(uniqueMap);
}

function normalizeActionName(value) {
  return (value || '').toString().trim().toUpperCase();
}

function getResourcesByScope(scope, options) {
  var normalizedScope = normalizeResourceScope(scope);
  var includeInactive = options && options.includeInactive === true;
  var map = getResourceConfigMap();
  var result = [];

  var names = Object.keys(map);
  for (var i = 0; i < names.length; i++) {
    var config = map[names[i]];
    if (config.scope !== normalizedScope) continue;
    if (!includeInactive && !config.isActive) continue;
    result.push(config);
  }

  return result;
}
function getAllResourcesConfigs(options) {
  var includeInactive = options && options.includeInactive === true;
  var map = getResourceConfigMap();
  var result = [];

  var names = Object.keys(map);
  for (var i = 0; i < names.length; i++) {
    var config = map[names[i]];
    if (!includeInactive && !config.isActive) continue;
    result.push(config);
  }

  return result;
}

