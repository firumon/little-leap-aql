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
  var cacheKey = 'AQL_RESOURCE_CONFIG_MAP_V1';
  var cachedJson = scriptCache.get(cacheKey);
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
      menuGroup: (readOptionalCell(row, registry.idx.MenuGroup, '') || '').toString().trim(),
      menuOrder: Number(readOptionalCell(row, registry.idx.MenuOrder, 9999) || 9999),
      menuLabel: (readOptionalCell(row, registry.idx.MenuLabel, name) || '').toString().trim() || name,
      menuIcon: (readOptionalCell(row, registry.idx.MenuIcon, 'list_alt') || '').toString().trim() || 'list_alt',
      routePath: (readOptionalCell(row, registry.idx.RoutePath, '') || '').toString().trim(),
      pageTitle: (readOptionalCell(row, registry.idx.PageTitle, name) || '').toString().trim() || name,
      pageDescription: (readOptionalCell(row, registry.idx.PageDescription, '') || '').toString().trim(),
      uiFields: parseJsonCell(readOptionalCell(row, registry.idx.UIFields, '[]'), []),
      showInMenu: toBooleanCell(readOptionalCell(row, registry.idx.ShowInMenu, true)),
      includeInAuthorizationPayload: toBooleanCell(readOptionalCell(row, registry.idx.IncludeInAuthorizationPayload, true)),
      additionalActions: parseStringList(readOptionalCell(row, registry.idx.AdditionalActions, '')),
      functional: toBooleanCell(readOptionalCell(row, registry.idx.Functional, false)),
      preAction: (readOptionalCell(row, registry.idx.PreAction, '') || '').toString().trim(),
      postAction: (readOptionalCell(row, registry.idx.PostAction, '') || '').toString().trim(),
      reports: parseJsonCell(readOptionalCell(row, registry.idx.Reports, '[]'), [])
    };
  }

  _resource_config_map_cache = map;

  // Persist to CacheService AND Permanent Metadata
  try {
    var json = JSON.stringify(map);
    if (json.length < 100000) {
      scriptCache.put(cacheKey, json, 300);
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
  try {
    CacheService.getScriptCache().remove('AQL_RESOURCE_CONFIG_MAP_V1');
  } catch (e) { /* non-fatal */ }
  // Clear Permanent Metadata fallback so stale data is not served on cold start
  try {
    var ctx = getMetadataContext();
    if (ctx.sheet) {
      var row = findRowByValue(ctx.sheet, ctx.idx.Key, 'AQL_RESOURCE_CONFIG_MAP_V1', 2, true);
      if (row !== -1) {
        ctx.sheet.deleteRow(row);
        if (ctx.map) delete ctx.map['AQL_RESOURCE_CONFIG_MAP_V1'];
      }
    }
  } catch (e) { /* non-fatal */ }
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

  const fileCacheKey = config.fileId;
  var file = _resource_file_cache[fileCacheKey];
  if (!file) {
    file = SpreadsheetApp.openById(config.fileId);
    _resource_file_cache[fileCacheKey] = file;
  }

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

function updateResourceSyncCursor(resourceName) {
  var name = (resourceName || '').toString().trim();
  if (!name) {
    throw new Error('Resource name is required');
  }

  var registry = getResourceRegistryContext();
  if (registry.idx.LastDataUpdatedAt === undefined) {
    return;
  }

  for (var i = 1; i < registry.values.length; i++) {
    var row = registry.values[i];
    var rowName = (row[registry.idx.Name] || '').toString().trim();
    if (rowName !== name) continue;

    var now = Date.now();
    registry.appSheet.getRange(i + 1, registry.idx.LastDataUpdatedAt + 1).setValue(now);

    // Update the in-memory config map if loaded, so subsequent reads in
    // the same execution see the new cursor without re-reading the sheet
    if (_resource_config_map_cache && _resource_config_map_cache[name]) {
      _resource_config_map_cache[name].lastDataUpdatedAt = now;
    }
    return;
  }

  throw new Error('Resource not configured: ' + name);
}

function normalizeCodeSequenceLength(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return 6;
  }
  return Math.floor(num);
}

function normalizeResourceScope(value) {
  const normalized = (value || 'master').toString().trim().toLowerCase();
  if (normalized === 'operation') return 'operation';
  if (normalized === 'accounts') return 'accounts';
  if (normalized === 'report') return 'report';
  if (normalized === 'system') return 'system';
  return 'master';
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
  var cachedJson = scriptCache.get('AQL_ROLE_PERMS_CONTEXT_V1');
  if (cachedJson) {
    try {
      var parsed = JSON.parse(cachedJson);
      // Reconstruct: we cache {values, headers, idx} but NOT the sheet object
      // The sheet object is only needed for writes — permissions context is read-only in API paths
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

  // Persist to CacheService (serializable parts only — exclude sheet object)
  try {
    var json = JSON.stringify({ values: values, headers: headers, idx: idx });
    if (json.length < 100000) {
      scriptCache.put('AQL_ROLE_PERMS_CONTEXT_V1', json, 300);
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
    CacheService.getScriptCache().remove('AQL_ROLE_PERMS_CONTEXT_V1');
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
          resourceMap[resourceName].allowedActions = [];
        }
      }

      const permissionSet = buildPermissionSetFromActions(actionList, {
        resourceActions: includeUiConfig ? resourceMap[resourceName].actions : []
      });
      const hasAnyPermission = permissionSet.canRead || permissionSet.canWrite || permissionSet.canUpdate || permissionSet.canDelete;
      if (!hasAnyPermission) continue;

      resourceMap[resourceName].permissions.canRead = resourceMap[resourceName].permissions.canRead || permissionSet.canRead;
      resourceMap[resourceName].permissions.canWrite = resourceMap[resourceName].permissions.canWrite || permissionSet.canWrite;
      resourceMap[resourceName].permissions.canUpdate = resourceMap[resourceName].permissions.canUpdate || permissionSet.canUpdate;
      resourceMap[resourceName].permissions.canDelete = resourceMap[resourceName].permissions.canDelete || permissionSet.canDelete;
      if (permissionSet.actions && permissionSet.actions.length) {
        resourceMap[resourceName].allowedActions = mergeStringLists(resourceMap[resourceName].allowedActions, permissionSet.actions);
      }
    }
  }

  return Object.keys(resourceMap).map(function(resourceName) {
    return resourceMap[resourceName];
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
    sheetName: config.sheetName,
    codePrefix: config.codePrefix,
    codeSequenceLength: config.codeSequenceLength,
    functional: config.functional || false,
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
      menuGroup: config.menuGroup,
      menuOrder: config.menuOrder,
      menuLabel: config.menuLabel,
      menuIcon: config.menuIcon,
      routePath: config.routePath,
      pageTitle: config.pageTitle,
      pageDescription: config.pageDescription,
      fields: Array.isArray(config.uiFields) ? config.uiFields : [],
      showInMenu: config.showInMenu
    };
    entry.actions = config.additionalActions || [];
    entry.allowedActions = [];
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
  const set = {};
  (currentList || []).forEach(function(entry) {
    const key = (entry || '').toString().trim();
    if (key) set[key] = true;
  });
  (incomingList || []).forEach(function(entry) {
    const key = (entry || '').toString().trim();
    if (key) set[key] = true;
  });
  return Object.keys(set);
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
